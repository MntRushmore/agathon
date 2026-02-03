import { NextRequest, NextResponse } from 'next/server';
import { voiceLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { callHackClubAI } from '@/lib/ai/hackclub';

/**
 * Uses Hack Club AI for workspace analysis (vision-capable).
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

    const systemPrompt =
      'You are analyzing a student whiteboard canvas. Describe what the user is working on, ' +
      'how far along they are, any apparent mistakes or gaps, and where they might need help. ' +
      'Be concrete and concise. You are only returning analysis for a voice assistant; ' +
      'do not invent actions or drawings.';

    const userPrompt = focus
      ? `Here is a snapshot of the user canvas. Focus on: ${focus}`
      : 'Here is a snapshot of the user canvas. Describe what they are working on and how you could help.';

    let analysis = '';

    // All users get Hack Club AI — no credit gating
    voiceLogger.info('Using Hack Club AI for workspace analysis');

    try {
      const hackclubResponse = await callHackClubAI({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: image } },
              { type: 'text', text: userPrompt },
            ],
          },
        ],
        stream: false,
      });

      const data = await hackclubResponse.json();
      analysis = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.message?.text ?? '';

      // Track AI usage for monitoring
      try {
        if (data.usage) {
          const inputTokens = data.usage.prompt_tokens || 0;
          const outputTokens = data.usage.completion_tokens || 0;
          const hackclubModel = process.env.HACKCLUB_AI_MODEL || 'google/gemini-2.5-flash';

          await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/track-ai-usage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'voice_analysis',
              prompt: focus || 'Voice workspace analysis',
              responseSummary: typeof analysis === 'string' ? analysis.slice(0, 500) : '',
              inputTokens,
              outputTokens,
              totalCost: 0,
              modelUsed: hackclubModel,
            }),
          });
        }
      } catch (trackError) {
        voiceLogger.warn({ error: trackError }, 'Failed to track voice analysis usage');
      }
    } catch (hackclubError) {
      voiceLogger.error({ error: hackclubError }, 'Hack Club AI error');
      return NextResponse.json(
        { error: 'Workspace analysis failed' },
        { status: 500 },
      );
    }

    const duration = Date.now() - startTime;
    voiceLogger.info(
      {
        duration,
        textLength: typeof analysis === 'string' ? analysis.length : 0,
        provider: 'hackclub',
      },
      'Workspace analysis completed successfully',
    );

    return NextResponse.json({
      success: true,
      analysis,
      provider: 'hackclub',
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
