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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      ocrLogger.error({ requestId }, 'OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    ocrLogger.info({ requestId }, 'Calling OpenRouter Pixtral API for OCR');

    // Call Pixtral model for OCR via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Madhacks AI Canvas OCR',
      },
      body: JSON.stringify({
        model: 'mistralai/pixtral-12b-2409',
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
                text: 'Extract all handwritten and typed text from this image. Return only the extracted text, preserving the structure and layout as much as possible. If there are mathematical equations, preserve them in a readable format.',
              },
            ],
          },
        ],
        max_tokens: parseInt(process.env.MISTRAL_OCR_MAX_TOKENS || '1000', 10),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      ocrLogger.error({
        requestId,
        status: response.status,
        error: errorData
      }, 'Mistral API error');
      throw new Error(errorData.error?.message || 'Mistral API error');
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




