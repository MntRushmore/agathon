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

    ocrLogger.debug({ requestId, imageSize: image.length }, 'Image received');

    if (!process.env.MISTRAL_API_KEY) {
      ocrLogger.error({ requestId }, 'MISTRAL_API_KEY not configured');
      return NextResponse.json(
        { error: 'MISTRAL_API_KEY not configured' },
        { status: 500 }
      );
    }

    ocrLogger.info({ requestId }, 'Calling Mistral Pixtral API for OCR');

    // Call Mistral Pixtral model for OCR via their API
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: image, // base64 data URL
              },
              {
                type: 'text',
                text: 'Extract all handwritten and typed text from this image. Return only the extracted text, preserving the structure and layout as much as possible. If there are mathematical equations, preserve them in a readable format.',
              },
            ],
          },
        ],
        max_tokens: 1000,
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

