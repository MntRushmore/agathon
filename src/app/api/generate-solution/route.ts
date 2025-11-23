import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { image, ocrText } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

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
      throw new Error(errorData.error?.message || 'OpenRouter API error');
    }

    const data = await response.json();

    // Extract the generated image from the response
    const message = data.choices?.[0]?.message;
    const generatedImages = message?.images;

    if (!generatedImages || generatedImages.length === 0) {
      throw new Error('No image generated in response');
    }

    // Get the first generated image (base64 data URL)
    const imageUrl = generatedImages[0].image_url.url;

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      textContent: message?.content || '',
    });
  } catch (error) {
    console.error('Error generating solution:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate solution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

