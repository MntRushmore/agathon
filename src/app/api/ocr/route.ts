import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!process.env.MISTRAL_API_KEY) {
      return NextResponse.json(
        { error: 'MISTRAL_API_KEY not configured' },
        { status: 500 }
      );
    }

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
      throw new Error(errorData.error?.message || 'Mistral API error');
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      text: extractedText,
    });
  } catch (error) {
    console.error('Error performing OCR:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform OCR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

