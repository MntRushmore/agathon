import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkAndDeductCredits } from '@/lib/ai/credits';
import { callHackClubAI } from '@/lib/ai/hackclub';

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

    const ocrPrompt = 'Look at this handwritten math. Extract ONLY the mathematical expression or equation. Return it as plain text (not LaTeX). For example: "3 + 5" or "2x + 3 = 7" or "y = 2x + 1". If you cannot read it clearly, return an empty string.';

    // Check credits to determine which AI to use
    const { usePremium, creditBalance } = await checkAndDeductCredits(
      user.id,
      'ocr',
      'OCR recognition'
    );

    let extractedText = '';
    let provider = 'hackclub';

    if (usePremium) {
      // Premium: Use OpenRouter
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-pro-image-preview';

      if (openrouterApiKey) {
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
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: image } },
                { type: 'text', text: ocrPrompt },
              ],
            }],
            max_tokens: 100,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          extractedText = data.choices?.[0]?.message?.content?.trim() || '';
          provider = 'openrouter';
        }
      }
    }

    // Fallback to Hack Club AI if premium failed or not available
    if (!extractedText && provider === 'hackclub') {
      try {
        const hackclubResponse = await callHackClubAI({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: image } },
                { type: 'text', text: ocrPrompt },
              ],
            },
          ],
          stream: false,
        });

        const data = await hackclubResponse.json();
        extractedText = data.choices?.[0]?.message?.content || '';
        provider = 'hackclub';
      } catch (hackclubError) {
        console.error('Hack Club AI OCR error:', hackclubError);
        return NextResponse.json(
          { error: 'OCR API error', details: hackclubError instanceof Error ? hackclubError.message : 'Unknown error' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      text: extractedText.trim(),
      provider,
      creditsRemaining: creditBalance,
      isPremium: usePremium,
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
