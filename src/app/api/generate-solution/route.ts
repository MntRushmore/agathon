import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';

// Response structure for text-based feedback that can be rendered on canvas
interface FeedbackAnnotation {
  type: 'correction' | 'hint' | 'encouragement' | 'step' | 'answer';
  content: string;
  position?: 'above' | 'below' | 'right' | 'inline';
}

interface StructuredFeedback {
  summary: string;
  annotations: FeedbackAnnotation[];
  nextStep?: string;
  isCorrect?: boolean;
}

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

    // Generate mode-specific prompt for text-based feedback
    const getModePrompt = (mode: string): string => {
      const baseAnalysis = `You are a helpful math tutor analyzing a student's handwritten work on a whiteboard.

CRITICAL MATH EVALUATION RULES:
1. CAREFULLY read the handwritten numbers. Handwriting can be messy - look closely at each digit.
2. ALWAYS CALCULATE the correct answer yourself before evaluating. For example, 50 + 2 = 52 (not 39).
3. DO NOT assume the student is wrong. Verify by computing: if they wrote "50 + 2 = 52", that IS CORRECT.
4. If there's a question mark (?) next to the answer, the student is asking if their answer is right.
5. Common errors to avoid: misreading "5" as "3", "0" as "6", etc.

Look at the image carefully and identify:
1. What problem or equation the student is working on
2. The actual numbers written (be very careful with handwriting recognition)
3. Calculate the correct answer yourself
4. Compare your calculation with what the student wrote

IMPORTANT: You must respond with a valid JSON object only. No markdown, no code fences, just pure JSON.`;

      const jsonFormat = `
Response format (JSON only, no markdown):
{
  "summary": "Brief description of what the student is working on",
  "isCorrect": true/false,
  "annotations": [
    {
      "type": "correction|hint|encouragement|step|answer",
      "content": "The feedback text",
      "position": "below"
    }
  ],
  "nextStep": "Optional suggestion for what to do next"
}`;

      switch (mode) {
        case 'feedback':
          return `${baseAnalysis}

TASK: Provide light, encouraging feedback.
- FIRST calculate the correct answer yourself
- If the student's answer matches your calculation, mark it as CORRECT with encouragement (use "✓ Correct!" or "✓ Great work!")
- If the student has a question mark (?), answer whether their work is correct
- Only point out errors if the answer is ACTUALLY WRONG
- Keep feedback minimal and non-intrusive
- Use "correction" type ONLY for actual errors, "encouragement" type for correct work

${jsonFormat}`;

        case 'suggest':
          return `${baseAnalysis}

TASK: Provide a helpful hint to guide the student.
- FIRST verify if their current work is correct before suggesting changes
- If they're correct, encourage them and suggest next steps
- If there's an error, give a hint that helps them figure it out WITHOUT giving the full answer
- Ask guiding questions or suggest an approach
- Use "hint" type for suggestions

${jsonFormat}`;

        case 'answer':
          return `${baseAnalysis}

TASK: Provide the complete solution with all steps.
- FIRST calculate the correct answer yourself
- Show the full worked solution step by step
- Explain each step briefly
- If their work is already correct, confirm it with "✓ Your answer is correct!"
- Use "step" type for solution steps, "answer" type for the final answer

${jsonFormat}`;

        default:
          return `${baseAnalysis}

TASK: Provide helpful assistance.
${jsonFormat}`;
      }
    };

    const basePrompt = getModePrompt(mode);
    const finalPrompt = prompt
      ? `${basePrompt}\n\nAdditional context from tutor: ${prompt}`
      : basePrompt;

    solutionLogger.info({ requestId, mode }, 'Calling Hack Club API with Gemini for text feedback');

    const apiKey = process.env.HACKCLUB_AI_API_KEY;
    if (!apiKey) {
      solutionLogger.error({ requestId }, 'HACKCLUB_AI_API_KEY not configured');
      return NextResponse.json(
        { error: 'HACKCLUB_AI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Call Hack Club API with Gemini 2.5 Flash (supports image input for analysis)
    const apiUrl = 'https://ai.hackclub.com/proxy/v1/chat/completions';
    const model = 'google/gemini-2.5-flash';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const requestBody = {
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
    const message = data.choices?.[0]?.message;
    let textContent = message?.content || '';

    // Parse the JSON response from Gemini
    let feedback: StructuredFeedback;
    try {
      // Clean up potential markdown code fences
      let jsonStr = textContent.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      jsonStr = jsonStr.trim();

      feedback = JSON.parse(jsonStr);
    } catch (parseError) {
      solutionLogger.warn({ requestId, textContent }, 'Failed to parse JSON response, using raw text');
      // Fallback: create a simple feedback structure from raw text
      feedback = {
        summary: 'AI Feedback',
        annotations: [
          {
            type: mode === 'answer' ? 'answer' : 'hint',
            content: textContent,
            position: 'below',
          },
        ],
      };
    }

    const duration = Date.now() - startTime;
    solutionLogger.info({
      requestId,
      duration,
      hasAnnotations: feedback.annotations?.length > 0,
      tokensUsed: data.usage?.total_tokens
    }, 'Solution generation completed successfully');

    // Track AI usage
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/server');
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const inputTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/track-ai-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: `solution_${mode}`,
            prompt: prompt || `${mode} mode text feedback`,
            responseSummary: feedback.summary || 'Text feedback generated',
            inputTokens,
            outputTokens,
            totalCost: 0,
            modelUsed: model,
          }),
        });
      }
    } catch (trackError) {
      solutionLogger.warn({ requestId, error: trackError }, 'Failed to track solution generation usage');
    }

    return NextResponse.json({
      success: true,
      feedback,
      textContent: feedback.summary || '',
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
