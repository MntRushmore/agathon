import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  solutionLogger.info({ requestId }, 'Solution generation request started');

  try {
    // Parse the request body
    const { image, prompt, mode = 'suggest' } = await req.json();

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

    // Generate mode-specific prompt
    const getModePrompt = (mode: string): string => {
      const baseAnalysis = 'Analyze this canvas/whiteboard image carefully. Look for incomplete work or any indication that the user is working through something challenging and might benefit from help.';
      
      const noHelpInstruction = '\n\nIf the user does NOT need help (e.g., just notes, completed work, casual doodles, or nothing significant):\n- Simply respond concisely with text explaining why help isn\'t needed. Do not generate an image.\n\nBe thoughtful about when to offer help - look for clear signs of incomplete problems or questions.';
      
      const coreRules = '\n\n**CRITICAL RULES:**\n- DO NOT remove, modify, move, or touch ANY of the user\'s existing content\n- ONLY add new content to the image\n- Match the user\'s handwriting style\n- Use different colors to distinguish your additions from the user\'s work';

      switch (mode) {
        case 'feedback':
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide the LEAST INTRUSIVE assistance - think of adding visual annotations like a teacher marking up a paper\n- Add visual feedback elements: highlighting (use semi-transparent colors), underlining, arrows pointing to specific parts, circles around key areas, light margin notes\n- Keep suggestions brief and minimal - just enough to guide attention\n- Use colors that stand out but complement the work (e.g., soft reds, blues, greens)\n- Write in a natural handwriting style that matches the user\'s but is clearly distinguishable by color${coreRules}${noHelpInstruction}`;
        
        case 'suggest':
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide a HELPFUL HINT or guide them to the next step - don\'t solve everything\n- Add suggestions for what to try next, guiding questions, or directional arrows with brief explanations\n- Point out which direction to go without giving the full answer\n- If it\'s a math problem, show the next step or formula they should apply\n- If it\'s a concept, ask a leading question or provide a key insight\n- Keep it substantial enough to be helpful but stop short of complete solutions${coreRules}${noHelpInstruction}`;
        
        case 'answer':
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide COMPLETE, DETAILED assistance - fully solve the problem or answer the question\n- Show all steps clearly in handwriting\n- Include explanations for each major step\n- Provide the full solution with proper work shown\n- Make it comprehensive and educational${coreRules}${noHelpInstruction}`;
        
        default:
          return `${baseAnalysis}\n\nIf the user needs help:\n- Provide a helpful hint or guide them to the next step${coreRules}${noHelpInstruction}`;
      }
    };

    const finalPrompt = prompt || getModePrompt(mode);

    solutionLogger.info({ requestId, mode }, 'Calling OpenRouter Gemini API for image generation');

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
                text: finalPrompt,
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
