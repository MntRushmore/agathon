import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  solutionLogger.info({ requestId }, 'Solution generation request started');

  try {
    // Parse the request body
    const { image, ocrText } = await req.json();

    if (!image) {
      solutionLogger.warn({ requestId }, 'No image provided in request');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    solutionLogger.debug({
      requestId,
      imageSize: image.length,
      hasOcrText: !!ocrText,
      ocrTextLength: ocrText?.length || 0
    }, 'Request payload received');

    if (!process.env.OPENROUTER_API_KEY) {
      solutionLogger.error({ requestId }, 'OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    solutionLogger.info({ requestId }, 'Calling OpenRouter Gemini API for image generation');

    // Call Gemini image generation model via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Madhacks AI Canvas',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-image-preview',
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
                text: ocrText
                  ? `Here is the extracted text from the canvas:\n\n${ocrText}\n\nModify the image to include the solution to the problem shown, written in handwriting style.`
                  : 'Modify the image to include the solution in handwriting.',
              },
            ],
          },
        ],
        /*
        provider: {
          order: ['google-ai-studio'],
          allow_fallbacks: false
        },
        */
        modalities: ['image', 'text'], // Required for image generation
        reasoning_effort: 'none',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      solutionLogger.error({
        requestId,
        status: response.status,
        error: errorData
      }, 'OpenRouter API error');
      throw new Error(errorData.error?.message || 'OpenRouter API error');
    }

    const data = await response.json();

    // Extract the generated image from the response
    const message = data.choices?.[0]?.message;
    const generatedImages = message?.images;

    if (!generatedImages || generatedImages.length === 0) {
      solutionLogger.error({ requestId }, 'No image generated in response');
      throw new Error('No image generated in response');
    }

    // Get the first generated image (base64 data URL)
    const imageUrl = generatedImages[0].image_url.url;

    const duration = Date.now() - startTime;
    solutionLogger.info({
      requestId,
      duration,
      generatedImageSize: imageUrl.length,
      hasTextContent: !!message?.content,
      tokensUsed: data.usage?.total_tokens
    }, 'Solution generation completed successfully');

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      textContent: message?.content || '',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    solutionLogger.error({
      requestId,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, 'Error generating solution');

    return NextResponse.json(
      {
        error: 'Failed to generate solution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
