import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  solutionLogger.info({ requestId }, 'Solution generation request started');

  try {
    // Parse the request body
    const {
      image,
      prompt,
      mode = 'suggest',
      source = 'auto',
    } = await req.json();

    if (!image) {
      solutionLogger.warn({ requestId }, 'No image provided in request');
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate image format
    if (typeof image !== 'string' || !image.startsWith('data:image/')) {
      solutionLogger.warn({ requestId }, 'Invalid image format');
      return NextResponse.json(
        { error: 'Image must be a valid base64 data URL (data:image/...)' },
        { status: 400 }
      );
    }

    // Validate mode
    const validModes = ['feedback', 'suggest', 'answer'];
    if (!validModes.includes(mode)) {
      solutionLogger.warn({ requestId, mode }, 'Invalid mode');
      return NextResponse.json(
        { error: `Mode must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate source
    if (source !== 'auto' && source !== 'voice') {
      solutionLogger.warn({ requestId, source }, 'Invalid source');
      return NextResponse.json(
        { error: 'Source must be either "auto" or "voice"' },
        { status: 400 }
      );
    }

    // Validate prompt if provided
    if (prompt && typeof prompt !== 'string') {
      solutionLogger.warn({ requestId }, 'Invalid prompt format');
      return NextResponse.json(
        { error: 'Prompt must be a string' },
        { status: 400 }
      );
    }

    if (prompt && prompt.length > 5000) {
      solutionLogger.warn({ requestId, promptLength: prompt.length }, 'Prompt too long');
      return NextResponse.json(
        { error: 'Prompt exceeds maximum length of 5000 characters' },
        { status: 400 }
      );
    }

    solutionLogger.debug({
      requestId,
      imageSize: image.length
    }, 'Request payload received');

    // Generate mode-specific prompt.
    // The `source` controls whether this was triggered automatically ("auto")
    // or explicitly by the voice tutor ("voice").
        const getModePrompt = (
          mode: string,
        ): string => {

          const baseAnalysis = 'Analyze the user\'s writing in the image carefully. Identify what problem they are trying to solve or what they have written.';

            const coreRules =
              '\n\n**CRITICAL RULES - MUST FOLLOW:**\n' +
              '1. **PRESERVE EXISTING CONTENT:** DO NOT remove, modify, move, transform, edit, or touch ANY of the image\'s existing content. Leave EVERYTHING in the image EXACTLY as it is in its current state, and *only* add to it.\n' +
              '2. **HANDWRITING ONLY:** You MUST write your response using realistic handwriting that matches the user\'s handwriting style. NEVER use typed/printed text. Always handwrite everything like a student would with a pen.\n' +
              '3. **USE BLACK INK:** Use PURE BLACK for any handwriting or normal text to match the user\'s pen.\n' +
              '4. **WHITE/TRANSPARENT BACKGROUND:** The output image MUST have a WHITE or TRANSPARENT background. Do NOT add any colored backgrounds, gradients, or fills.\n' +
              '5. **NO OVERLAPPING:** Position your new content in EMPTY SPACE on the canvas. Do NOT write on top of or overlap with any existing content. Find blank areas below, beside, or around the existing work.\n' +
              '6. **CLEAR SPACING:** Leave adequate spacing between the existing content and your additions. Your content should be clearly separate and readable.\n' +
              '7. **IMAGE OUTPUT REQUIRED:** ALWAYS generate an updated image of the canvas with handwritten content; do not respond with text-only.';

            switch (mode) {
              case 'feedback':
                return `${baseAnalysis}\n\n**TASK: PROVIDE LIGHT FEEDBACK**\n- Provide the least intrusive assistance - think of adding visual annotations\n- Add visual feedback elements: highlighting, underlining, arrows, circles, light margin notes, etc.\n- Point out mistakes or areas for improvement without giving the answer.\n- Use colors like red or orange for corrections, blue or green for positive feedback, and PURE BLACK for any supporting text or handwriting.\n- Position annotations near the relevant content but NOT overlapping it.${coreRules}`;

              case 'suggest':
                return `${baseAnalysis}\n\n**TASK: PROVIDE A SUGGESTION/HINT**\n- Provide a HELPFUL HINT or guide them to the next step - don\'t give them the end solution.\n- Add suggestions for what to try next, guiding questions, or a partial next step.\n- Match the user's handwriting and style for the suggestion using PURE BLACK.\n- Write your hint in an empty area of the canvas, clearly separated from existing work.${coreRules}`;

              case 'answer':
                return `${baseAnalysis}\n\n**TASK: PROVIDE FULL SOLUTION**\n- Provide COMPLETE, DETAILED assistance - fully solve the problem or answer the question.\n- Show all working steps clearly on the canvas using PURE BLACK for handwriting.\n- Write the solution in empty space below or beside the existing work. DO NOT write over existing content.${coreRules}`;

            default:
              return `${baseAnalysis}\n\n**TASK: PROVIDE ASSISTANCE**\n- Provide a helpful hint or guide them to the next step.${coreRules}`;
          }
        };


    const basePrompt = getModePrompt(mode);

    const finalPrompt = prompt
      ? `${basePrompt}\n\nAdditional drawing instructions from the tutor:\n${prompt}`
      : basePrompt;

    solutionLogger.info({ requestId, mode }, 'Calling Hack Club API with Gemini for image generation');

    // Call Hack Club API with Gemini 3 Pro Image model (supports image generation with handwriting)
    const apiUrl = 'https://ai.hackclub.com/chat/completions';
    const model = 'google/gemini-3-pro-image-preview';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const requestBody: any = {
      model,
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
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      solutionLogger.error({
        requestId,
        status: response.status,
        error: errorData
      }, 'Hack Club API error');
      throw new Error(errorData.error?.message || 'Hack Club API error');
    }

    const data = await response.json();

    // Try to extract a generated image from the response as flexibly as possible.
    // Different providers / models can structure image outputs differently.
    const message = data.choices?.[0]?.message;
    const textContent = message?.content || '';

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
      // This is an expected path in auto mode: Gemini may decide that no help is needed
      // and return only text. In voice mode we strongly discouraged this in the prompt,
      // but still handle it gracefully.
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
        source === 'voice'
          ? 'Solution generation completed without image in voice mode (Gemini returned text-only response)'
          : 'Solution generation completed without image (Gemini returned text-only response)'
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

    // Track AI usage (Hack Club API is free, so no cost tracking needed)
    try {
      const { data: { user } } = await (await import('@/lib/supabase/server')).createServerSupabaseClient().then(s => s.auth.getUser());

      if (user) {
        const inputTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/track-ai-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: `solution_${mode}`,
            prompt: prompt || `${mode} mode image generation`,
            responseSummary: `Generated solution image (${mode} mode) via Hack Club API`,
            inputTokens,
            outputTokens,
            totalCost: 0, // Hack Club API is free
            modelUsed: model,
          }),
        });
      }
    } catch (trackError) {
      solutionLogger.warn({ requestId, error: trackError }, 'Failed to track solution generation usage');
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      textContent: textContent || '',
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
