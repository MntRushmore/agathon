import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkUserCredits, deductCredits } from '@/lib/ai/credits';

/**
 * Uses Gemini 3.0 Pro Preview (via Vertex AI OpenAI-compatible endpoint)
 * to analyze the current whiteboard image and return a concise analysis.
 * Requires credits as this feature needs image processing.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check - require login for all AI features
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const { image, focus } = await req.json();

    if (!image) {
      voiceLogger.warn('No image provided to analyze-workspace route');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 },
      );
    }

    // Validate image format
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      voiceLogger.warn('Invalid image format in analyze-workspace route');
      return NextResponse.json(
        { error: 'Image must be a valid base64 data URL (data:image/...)' },
        { status: 400 },
      );
    }

    // Validate focus if provided
    if (focus && typeof focus !== 'string') {
      voiceLogger.warn('Invalid focus format');
      return NextResponse.json(
        { error: 'Focus must be a string' },
        { status: 400 },
      );
    }

    if (focus && focus.length > 1000) {
      voiceLogger.warn({ focusLength: focus.length }, 'Focus too long');
      return NextResponse.json(
        { error: 'Focus exceeds maximum length of 1000 characters' },
        { status: 400 },
      );
    }

    // Check credits - workspace analysis requires image processing (no fallback)
    const creditCheck = await checkUserCredits(user.id);

    if (!creditCheck.hasCredits) {
      return NextResponse.json(
        {
          error: 'no_credits',
          message: 'Voice workspace analysis requires credits for image processing. Purchase credits to continue.',
          upgradePrompt: true,
          creditBalance: creditCheck.currentBalance,
        },
        { status: 402 }
      );
    }

    // Deduct credit
    const deduction = await deductCredits(user.id, 'voice-analyze', 'Voice workspace analysis');

    if (!deduction.success) {
      return NextResponse.json(
        {
          error: 'no_credits',
          message: 'Failed to process credits. Please try again.',
          creditBalance: deduction.newBalance,
        },
        { status: 402 }
      );
    }

    const projectId = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const accessToken = process.env.VERTEX_ACCESS_TOKEN;
    const apiKey = process.env.VERTEX_API_KEY;
    const model = process.env.VERTEX_MODEL_ID || 'google/gemini-3-pro-image-preview';

    if (!accessToken && !apiKey) {
      voiceLogger.error('Vertex credentials missing');
      return NextResponse.json(
        { error: 'Vertex credentials missing (set VERTEX_ACCESS_TOKEN or VERTEX_API_KEY)' },
        { status: 500 },
      );
    }

    if (accessToken && !projectId) {
      voiceLogger.error('VERTEX_PROJECT_ID not configured');
      return NextResponse.json(
        { error: 'VERTEX_PROJECT_ID not configured' },
        { status: 500 },
      );
    }

    const systemPrompt =
      'You are analyzing a student whiteboard canvas. Describe what the user is working on, ' +
      'how far along they are, any apparent mistakes or gaps, and where they might need help. ' +
      'Be concrete and concise. You are only returning analysis for a voice assistant; ' +
      'do not invent actions or drawings.';

    const userPrompt = focus
      ? `Here is a snapshot of the user canvas. Focus on: ${focus}`
      : 'Here is a snapshot of the user canvas. Describe what they are working on and how you could help.';

    voiceLogger.info('Calling Vertex AI Gemini 3.0 Pro Preview for workspace analysis');

    // For API key, use query param; for OAuth token, use Bearer auth
    const apiUrl = accessToken
      ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`
      : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;

    // For API key flow, use simpler model name without google/ prefix
    const effectiveModel = accessToken ? model : model.replace('google/', '');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Google AI Studio OpenAI endpoint requires Authorization header even with API key
        Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      voiceLogger.error(
        {
          status: response.status,
          error: errorData,
        },
        'Vertex Gemini 3.0 Pro API error',
      );
      return NextResponse.json(
        { error: 'Workspace analysis failed' },
        { status: 500 },
      );
    }

    const data = await response.json();
    const analysis =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.message?.text ??
      '';

    const duration = Date.now() - startTime;
    voiceLogger.info(
      {
        duration,
        textLength: typeof analysis === 'string' ? analysis.length : 0,
        tokensUsed: data.usage?.total_tokens,
      },
      'Workspace analysis completed successfully',
    );

    // Track AI usage for cost monitoring
    try {
      if (data.usage) {
        const inputTokens = data.usage.prompt_tokens || 0;
        const outputTokens = data.usage.completion_tokens || 0;
        const totalCost = 0; // Vertex billing handled externally; tracking set to zero to avoid mis-estimation

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/track-ai-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'voice_analysis',
            prompt: focus || 'Voice workspace analysis',
            responseSummary: typeof analysis === 'string' ? analysis.slice(0, 500) : '',
            inputTokens,
            outputTokens,
            totalCost,
            modelUsed: model,
          }),
        });
      }
    } catch (trackError) {
      voiceLogger.warn({ error: trackError }, 'Failed to track voice analysis usage');
    }

    return NextResponse.json({
      success: true,
      analysis,
      creditsRemaining: deduction.newBalance,
      provider: 'vertex',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    voiceLogger.error(
      {
        duration,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
      },
      'Error analyzing workspace',
    );

    return NextResponse.json(
      { error: 'Error analyzing workspace' },
      { status: 500 },
    );
  }
}
