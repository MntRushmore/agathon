import { NextRequest, NextResponse } from 'next/server';
import { helpCheckLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  helpCheckLogger.info({ requestId }, 'Help check request started');

  try {
    // Auth check
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { text, image } = await req.json();

    if (!text && !image) {
      helpCheckLogger.warn({ requestId }, 'No text or image provided in request');
      return NextResponse.json(
        { error: 'No text or image provided' },
        { status: 400 }
      );
    }

    // Input size validation
    if (text && (typeof text !== 'string' || text.length > 50000)) {
      return NextResponse.json(
        { error: 'Text too long (max 50000 characters)' },
        { status: 400 }
      );
    }
    if (image && (typeof image !== 'string' || image.length > 10_000_000)) {
      return NextResponse.json(
        { error: 'Image data too large' },
        { status: 400 }
      );
    }

    helpCheckLogger.debug({
      requestId,
      hasText: !!text,
      textLength: text?.length || 0,
      hasImage: !!image
    }, 'Request payload received');

    if (!process.env.OPENROUTER_API_KEY) {
      helpCheckLogger.error({ requestId }, 'OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Build the message content
    type MessageContentPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };
    const content: MessageContentPart[] = [];

    if (image) {
      content.push({
        type: 'image_url',
        image_url: {
          url: image, // base64 data URL
        },
      });
    }

    const promptText = text
      ? `Here is the extracted text from the user's canvas:\n\n${text}\n\nBased on this text and/or the image, does this user appear to need help with a problem? Look for incomplete work, questions, stuck points, math problems, coding problems, or any indication that they're working through something challenging and might benefit from a solution or hint.\n\nRespond with a JSON object containing:\n- "needsHelp": true or false\n- "confidence": a number between 0 and 1 indicating your confidence\n- "reason": a brief explanation of your decision\n\nExample: {"needsHelp": true, "confidence": 0.85, "reason": "User has written an incomplete math problem with no solution"}`
      : `Based on the image, does this user appear to need help with a problem? Look for incomplete work, questions, stuck points, math problems, coding problems, or any indication that they're working through something challenging and might benefit from a solution or hint.\n\nRespond with a JSON object containing:\n- "needsHelp": true or false\n- "confidence": a number between 0 and 1 indicating your confidence\n- "reason": a brief explanation of your decision\n\nExample: {"needsHelp": true, "confidence": 0.85, "reason": "User has written an incomplete math problem with no solution"}`;

    content.push({
      type: 'text',
      text: promptText,
    });

    helpCheckLogger.info({ requestId }, 'Calling OpenRouter GPT-4.1-mini API');

    // Call GPT-4.1-mini via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Madhacks AI Canvas',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: content,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      helpCheckLogger.error({
        requestId,
        status: response.status,
        error: errorData
      }, 'OpenRouter API error');
      throw new Error(errorData.error?.message || 'OpenRouter API error');
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '{}';

    // Parse the JSON response safely
    let decision;
    try {
      decision = JSON.parse(responseText);
    } catch {
      helpCheckLogger.warn({ requestId, responseText: responseText.slice(0, 200) }, 'Failed to parse JSON response');
      decision = { needsHelp: false, confidence: 0, reason: 'Failed to parse response' };
    }

    const duration = Date.now() - startTime;
    helpCheckLogger.info({
      requestId,
      duration,
      needsHelp: decision.needsHelp,
      confidence: decision.confidence,
      reason: decision.reason,
      tokensUsed: data.usage?.total_tokens
    }, 'Help check completed');

    return NextResponse.json({
      success: true,
      needsHelp: decision.needsHelp || false,
      confidence: decision.confidence || 0,
      reason: decision.reason || '',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    helpCheckLogger.error({
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Error checking if help is needed');

    return NextResponse.json(
      {
        error: 'Failed to check if help is needed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
