import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';

/**
 * Uses Gemini 2.5 Flash (via OpenRouter) to analyze the current whiteboard image
 * and return a natural language description / analysis of the workspace.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
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

    if (!process.env.OPENROUTER_API_KEY) {
      voiceLogger.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
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

    voiceLogger.info('Calling OpenRouter Gemini 2.5 Flash for workspace analysis');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Madhacks AI Canvas - Voice Workspace Analysis',
      },
      body: JSON.stringify({
        // Model name may vary; adjust if needed in configuration.
        model: process.env.OPENROUTER_VOICE_ANALYSIS_MODEL || 'google/gemini-2.5-flash',
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
        'OpenRouter Gemini 2.5 Flash API error',
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
      const { data: { user } } = await (await import('@/lib/supabase/server')).createServerSupabaseClient().then(s => s.auth.getUser());

      if (user && data.usage) {
        // OpenRouter Gemini 2.5 Flash pricing (approximate)
        const inputCostPer1M = 0.075;   // $0.075 per 1M input tokens
        const outputCostPer1M = 0.30;   // $0.30 per 1M output tokens
        const inputTokens = data.usage.prompt_tokens || 0;
        const outputTokens = data.usage.completion_tokens || 0;
        const totalCost = ((inputTokens * inputCostPer1M) + (outputTokens * outputCostPer1M)) / 1000000;

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
            modelUsed: process.env.OPENROUTER_VOICE_ANALYSIS_MODEL || 'google/gemini-2.5-flash',
          }),
        });
      }
    } catch (trackError) {
      voiceLogger.warn({ error: trackError }, 'Failed to track voice analysis usage');
    }

    return NextResponse.json({
      success: true,
      analysis,
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


