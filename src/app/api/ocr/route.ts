import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkUserCredits, deductCredits } from '@/lib/ai/credits';

export async function POST(req: NextRequest) {
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

    const { image } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate image format
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Image must be a valid base64 data URL (data:image/...)' },
        { status: 400 }
      );
    }

    // Check credits - OCR requires image processing (no text-only fallback possible)
    const creditCheck = await checkUserCredits(user.id);

    if (!creditCheck.hasCredits) {
      return NextResponse.json(
        {
          error: 'no_credits',
          message: 'OCR requires credits for image processing. Purchase credits to continue.',
          upgradePrompt: true,
          creditBalance: creditCheck.currentBalance,
        },
        { status: 402 }
      );
    }

    // Deduct credit
    const deduction = await deductCredits(user.id, 'ocr', 'OCR handwriting recognition');

    if (!deduction.success) {
      return NextResponse.json(
        {
          error: 'no_credits',
          message: 'Failed to process credits. Please try again.',
          creditBalance: deduction.newBalance,
        },
        { status: 402 }
      );
    }

    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';

    if (!openrouterApiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Call Gemini model for OCR via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterApiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Whiteboard AI Tutor',
      },
      body: JSON.stringify({
        model,
        messages: [
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
                text: 'Look at this handwritten math. Extract ONLY the mathematical expression or equation. Return it as plain text (not LaTeX). For example: "3 + 5" or "2x + 3 = 7" or "y = 2x + 1". If you cannot read it clearly, return an empty string.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'OCR API error', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      text: extractedText.trim(),
      creditsRemaining: deduction.newBalance,
      provider: 'openrouter',
    });
  } catch (error) {
    console.error('OCR error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform OCR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
