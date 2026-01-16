import { NextRequest, NextResponse } from 'next/server';
import { ocrLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  ocrLogger.info({ requestId }, 'OCR request started');

  try {
    const { image } = await req.json();

    if (!image) {
      ocrLogger.warn({ requestId }, 'No image provided in request');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate image format
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      ocrLogger.warn({ requestId }, 'Invalid image format');
      return NextResponse.json(
        { error: 'Image must be a valid base64 data URL (data:image/...)' },
        { status: 400 }
      );
    }

    ocrLogger.debug({ requestId, imageSize: image.length }, 'Image received');

    ocrLogger.info({ requestId }, 'Calling Hack Club API (Gemini Flash) for OCR');

    // Call Gemini Flash model for OCR via Hack Club API (free)
    const response = await fetch('https://ai.hackclub.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview-05-20',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: image, // base64 data URL
                },
              },
              {
                type: 'text',
                text: 'Extract all handwritten and typed text from this image. Return only the extracted text, preserving the structure and layout as much as possible. If there are mathematical equations, convert them to LaTeX format wrapped in $ symbols for inline or $$ for display equations.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      ocrLogger.error({
        requestId,
        status: response.status,
        error: errorData
      }, 'Hack Club API error');
      throw new Error(errorData.error?.message || 'Hack Club API error');
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    const duration = Date.now() - startTime;
    ocrLogger.info({
      requestId,
      duration,
      textLength: extractedText.length,
      tokensUsed: data.usage?.total_tokens
    }, 'OCR completed successfully');

    // Track AI usage (free via Hack Club, but still track for analytics)
    try {
      const { data: { user } } = await (await import('@/lib/supabase/server')).createServerSupabaseClient().then(s => s.auth.getUser());

      if (user) {
        const inputTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/track-ai-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'ocr',
            prompt: 'OCR text extraction from image',
            responseSummary: `Extracted ${extractedText.length} characters`,
            inputTokens,
            outputTokens,
            totalCost: 0, // Free via Hack Club API
            modelUsed: 'google/gemini-2.5-flash-preview-05-20',
          }),
        });
      }
    } catch (trackError) {
      ocrLogger.warn({ requestId, error: trackError }, 'Failed to track OCR usage');
    }

    return NextResponse.json({
      success: true,
      text: extractedText,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    ocrLogger.error({
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Error performing OCR');

    return NextResponse.json(
      {
        error: 'Failed to perform OCR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}




