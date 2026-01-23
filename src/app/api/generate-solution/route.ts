import { NextRequest, NextResponse } from 'next/server';
import { solutionLogger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkAndDeductCredits } from '@/lib/ai/credits';
import { callHackClubAI } from '@/lib/ai/hackclub';

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
    // Auth check - require login for all AI features
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

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

    // Check and deduct credits (costs 2 credits for solution generation)
    const { usePremium, creditBalance } = await checkAndDeductCredits(
      user.id,
      'generate-solution',
      `Generate solution (${mode} mode)`
    );

    // If no credits, this feature requires image processing - return 402
    if (!usePremium) {
      solutionLogger.info({ requestId, creditBalance }, 'No credits for solution generation, trying text-only fallback');

      // For solution generation, we can provide a text-only fallback
      // but it won't be able to see the canvas
      const textOnlyPrompt = getTextOnlyFallbackPrompt(mode, prompt);

      try {
        const hackclubResponse = await callHackClubAI({
          messages: [
            { role: 'system', content: textOnlyPrompt.systemPrompt },
            { role: 'user', content: textOnlyPrompt.userMessage },
          ],
          stream: false,
        });

        const hackclubData = await hackclubResponse.json();
        const textContent = hackclubData.choices?.[0]?.message?.content || '';

        // Parse as JSON or create fallback structure
        let feedback: StructuredFeedback;
        try {
          let jsonStr = textContent.trim();
          if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
          else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
          if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
          feedback = JSON.parse(jsonStr.trim());
        } catch {
          feedback = {
            summary: 'Text-only feedback (upgrade for visual analysis)',
            annotations: [
              {
                type: 'hint',
                content: textContent || 'Please describe your work so I can help you.',
                position: 'below',
              },
            ],
          };
        }

        return NextResponse.json({
          success: true,
          feedback,
          textContent: feedback.summary || '',
          provider: 'hackclub',
          creditsRemaining: creditBalance,
          imageSupported: false,
        });
      } catch (hackclubError) {
        solutionLogger.error({ requestId, error: hackclubError }, 'Hack Club AI fallback failed');
        return NextResponse.json(
          {
            error: 'no_credits',
            message: 'Solution generation requires credits for image analysis. Purchase credits to continue.',
            upgradePrompt: true,
            creditBalance,
          },
          { status: 402 }
        );
      }
    }

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

    solutionLogger.info({ requestId, mode }, 'Calling Vertex AI (Gemini 3) for text feedback');

    const projectId = process.env.VERTEX_PROJECT_ID;
    const location = process.env.VERTEX_LOCATION || 'us-central1';
    const accessToken = process.env.VERTEX_ACCESS_TOKEN;
    const apiKey = process.env.VERTEX_API_KEY;
    // Default to image-capable Gemini 3 Pro Image Preview for handwriting inputs
    const model = process.env.VERTEX_MODEL_ID || 'google/gemini-3-pro-image-preview';

    if (!accessToken && !apiKey) {
      solutionLogger.error({ requestId }, 'Vertex credentials missing');
      return NextResponse.json(
        { error: 'Set VERTEX_ACCESS_TOKEN (preferred) or VERTEX_API_KEY' },
        { status: 500 }
      );
    }

    // If using OAuth token, we need the project/location endpoint; API keys use AI Studio endpoint
    if (accessToken && !projectId) {
      solutionLogger.error({ requestId }, 'VERTEX_PROJECT_ID not configured for OAuth flow');
      return NextResponse.json(
        { error: 'VERTEX_PROJECT_ID not configured' },
        { status: 500 }
      );
    }

    // For API key, use query param; for OAuth token, use Bearer auth
    const apiUrl = accessToken
      ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`
      : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;

    // For API key flow, use simpler model name without google/ prefix
    const effectiveModel = accessToken ? model : model.replace('google/', '');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Google AI Studio OpenAI endpoint requires Authorization header even with API key
      Authorization: accessToken ? `Bearer ${accessToken}` : `Bearer ${apiKey}`,
    };

    const requestBody = {
      model: effectiveModel,
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
      const errorText = await response.text().catch(() => '');
      let errorData: any = {};
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = { raw: errorText };
      }
      solutionLogger.error({
        requestId,
        status: response.status,
        error: errorData
      }, 'Vertex AI API error');
      throw new Error(errorData.error?.message || errorData.message || errorData.raw || 'Vertex AI API error');
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
    } catch (trackError) {
      solutionLogger.warn({ requestId, error: trackError }, 'Failed to track solution generation usage');
    }

    return NextResponse.json({
      success: true,
      feedback,
      textContent: feedback.summary || '',
      provider: 'vertex',
      creditsRemaining: creditBalance,
      imageSupported: true,
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

// Helper function for text-only fallback prompts
function getTextOnlyFallbackPrompt(mode: string, additionalPrompt?: string): { systemPrompt: string; userMessage: string } {
  const baseSystem = `You are a helpful math tutor. The student is working on a whiteboard but you cannot see their work.
You must ask them to describe what they've written or provide the problem in text form.

IMPORTANT: Respond with a valid JSON object only. No markdown, no code fences, just pure JSON.

Response format:
{
  "summary": "Brief description of your response",
  "annotations": [
    {
      "type": "hint",
      "content": "Your helpful message",
      "position": "below"
    }
  ]
}`;

  const modeMessages: Record<string, string> = {
    feedback: 'I want feedback on my work, but I understand you cannot see my whiteboard. What should I describe to get help?',
    suggest: 'I need a hint, but I understand you cannot see my whiteboard. Can you help me if I describe my work?',
    answer: 'I want to see the full solution, but I understand you cannot see my whiteboard. Please ask me to describe the problem.',
  };

  return {
    systemPrompt: baseSystem,
    userMessage: additionalPrompt
      ? `${modeMessages[mode] || modeMessages.suggest}\n\nContext: ${additionalPrompt}`
      : modeMessages[mode] || modeMessages.suggest,
  };
}
