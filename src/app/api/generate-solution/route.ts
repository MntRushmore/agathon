import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  solutionLogger.info({ requestId }, 'Solution generation request started');

  try {
    // Parse the request body
    const { image, prompt } = await req.json();

    if (!image) {
      solutionLogger.warn({ requestId }, 'No image provided in request');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    solutionLogger.debug({
      requestId,
      imageSize: image.length
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
                text: prompt || 'Analyze this canvas/whiteboard image carefully. Look for incomplete work or any indication that the user is working through something challenging and might benefit from help.\n\nIf the user needs help:\n- **Modify** the user\'s initial screen with edits, advice, or solutions written in their handwriting style\n- DO NOT remove any of the existing content in the image. Only add to the image. DO NOT touch, modify, or move any of the user\'s initial writing.\n\nIf the user does NOT need help (e.g., just notes, completed work, casual doodles, or nothing significant):\n- Simply respond concisely with text explaining why help isn\'t needed. Do not generate an image.\n\nBe thoughtful about when to offer help - look for clear signs of incomplete problems or questions.',
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
        reasoning_effort: 'minimal',
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

    // Try to extract a generated image from the response as flexibly as possible.
    // Different providers / models can structure image outputs differently.
    const message = data.choices?.[0]?.message;

    let imageUrl: string | null = null;

    // 1) Legacy / hypothetical format: message.images[0].image_url.url
    const legacyImages = (message as any)?.images;
    if (Array.isArray(legacyImages) && legacyImages.length > 0) {
      const first = legacyImages[0];
      imageUrl =
        first?.image_url?.url ??
        first?.url ??
        null;
    }

    // 2) OpenAI-style content array: look for any image-like item
    if (!imageUrl) {
      const content = (message as any)?.content;

      if (Array.isArray(content)) {
        for (const part of content) {
          if (part?.type === 'image_url' && part.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
          if (part?.type === 'output_image' && (part.url || part.image_url?.url)) {
            imageUrl = part.url || part.image_url?.url;
            break;
          }
        }
      } else if (typeof content === 'string') {
        // 3) Fallback: scan text content for a plausible image URL or data URL
        const text: string = content;
        const dataUrlMatch = text.match(/data:image\/[a-zA-Z+]+;base64,[^\s")'}]+/);
        const httpUrlMatch = text.match(/https?:\/\/[^\s")'}]+?\.(?:png|jpg|jpeg|gif|webp)/i);

        if (dataUrlMatch) {
          imageUrl = dataUrlMatch[0];
        } else if (httpUrlMatch) {
          imageUrl = httpUrlMatch[0];
        }
      }
    }

    if (!imageUrl) {
      // This is now an expected path: Gemini may decide that no help is needed
      // and return only text. Log at info level instead of error.
      const textContent = (message as any)?.content || '';

      const duration = Date.now() - startTime;
      solutionLogger.info(
        {
          requestId,
          duration,
          generatedImageSize: 0,
          hasTextContent: !!textContent,
          tokensUsed: data.usage?.total_tokens,
          rawResponseSnippet: JSON.stringify(data).slice(0, 2000),
        },
        'Solution generation completed without image (Gemini returned text-only response)'
      );

      // Return a successful response with text content (if any), but no image.
      // The frontend should gracefully handle the absence of imageUrl.
      return NextResponse.json({
        success: false,
        imageUrl: null,
        textContent,
        reason: 'Model did not return an image (likely decided help was not needed).',
      });
    }

    const duration = Date.now() - startTime;
    solutionLogger.info({
      requestId,
      duration,
      generatedImageSize: imageUrl.length,
      hasTextContent: !!(message as any)?.content,
      tokensUsed: data.usage?.total_tokens
    }, 'Solution generation completed successfully');

    return NextResponse.json({
      success: true,
      imageUrl,
      textContent: (message as any)?.content || '',
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
