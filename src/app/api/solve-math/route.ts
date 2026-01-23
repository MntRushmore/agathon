import { NextRequest, NextResponse } from 'next/server';
import { quickSolve, canQuickSolve } from '@/lib/cas-solver';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkUserCredits, deductCredits } from '@/lib/ai/credits';
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

    const { expression, image, variables, quick } = await req.json();

    // If image is provided, use Gemini vision to recognize and solve
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      // Image processing requires credits
      const creditCheck = await checkUserCredits(user.id);

      if (!creditCheck.hasCredits) {
        return NextResponse.json(
          {
            error: 'no_credits',
            message: 'Image recognition requires credits. Type the expression instead or purchase credits.',
            upgradePrompt: true,
            creditBalance: creditCheck.currentBalance,
          },
          { status: 402 }
        );
      }

      // Deduct credit for image processing
      const deduction = await deductCredits(user.id, 'solve-math', 'Math solve with image recognition');

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

      const projectId = process.env.VERTEX_PROJECT_ID;
      const location = process.env.VERTEX_LOCATION || 'us-central1';
      const accessToken = process.env.VERTEX_ACCESS_TOKEN;
      const apiKey = process.env.VERTEX_API_KEY;
      const model = process.env.VERTEX_MODEL_ID || 'google/gemini-3-pro-image-preview';

      if (!accessToken && !apiKey) {
        return NextResponse.json(
          { error: 'Vertex credentials missing (set VERTEX_ACCESS_TOKEN or VERTEX_API_KEY)' },
          { status: 500 }
        );
      }

      if (accessToken && !projectId) {
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

      // Use Gemini vision to recognize AND solve the math in one call
      const response = await fetch(apiUrl, {
        method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
        body: JSON.stringify({
          model: effectiveModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: image },
                },
                {
                  type: 'text',
                  text: `Look at this handwritten content. If it contains a math expression or equation, recognize it and solve it.

IMPORTANT RULES:
1. First, determine if this is a math problem. If it's NOT a math problem (just text, drawing, etc.), respond with exactly: NOT_MATH
2. If it IS math, respond in this exact format:
   EXPRESSION: [the math expression you see, e.g., "36 + 15" or "9 + 18"]
   ANSWER: [the computed answer, e.g., "51" or "27"]
3. Be very careful reading handwritten numbers - common confusions:
   - 1 vs 7 vs l
   - 6 vs 0 vs 9
   - 8 vs 0
   - + vs × vs ÷
4. If the math is incomplete (e.g., "3 +" with nothing after), respond: INCOMPLETE
5. If you can't read it clearly, respond: UNCLEAR
6. Only give the final numerical answer, no steps or explanation.

Examples:
- "36 + 15" → EXPRESSION: 36 + 15, ANSWER: 51
- "9 + 18" → EXPRESSION: 9 + 18, ANSWER: 27
- "3 + 14" → EXPRESSION: 3 + 14, ANSWER: 17
- "hello world" → NOT_MATH
- "2x + 5 = 15" → EXPRESSION: 2x + 5 = 15, ANSWER: x = 5`,
                },
              ],
            },
          ],
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini vision API error:', response.status, errorText);
        return NextResponse.json(
          { error: 'Vision API error', details: errorText },
          { status: 500 }
        );
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim() || '';

      // Parse the response
      if (content === 'NOT_MATH' || content === 'INCOMPLETE' || content === 'UNCLEAR') {
        return NextResponse.json({
          success: false,
          answer: null,
          recognized: null,
          reason: content.toLowerCase(),
          creditsRemaining: deduction.newBalance,
        });
      }

      // Parse EXPRESSION and ANSWER from response
      const expressionMatch = content.match(/EXPRESSION:\s*(.+?)(?:,|\n|ANSWER)/i);
      const answerMatch = content.match(/ANSWER:\s*(.+)/i);

      const recognized = expressionMatch?.[1]?.trim() || '';
      let answer = answerMatch?.[1]?.trim() || '';

      // Clean up the answer
      answer = answer.replace(/\*\*/g, '').replace(/`/g, '').trim();

      if (!answer || answer === '?') {
        return NextResponse.json({
          success: false,
          answer: null,
          recognized,
          reason: 'could_not_solve',
          creditsRemaining: deduction.newBalance,
        });
      }

      return NextResponse.json({
        success: true,
        answer,
        recognized,
        source: 'gemini-vision',
        creditsRemaining: deduction.newBalance,
        provider: 'vertex',
      });
    }

    if (!expression) {
      return NextResponse.json(
        { error: 'No expression or image provided' },
        { status: 400 }
      );
    }

    // Quick mode: use CAS for instant computation (no credits needed - local computation)
    if (quick) {
      if (canQuickSolve(expression)) {
        const result = quickSolve(expression);
        if (result.success) {
          return NextResponse.json({
            success: true,
            answer: result.answer,
            source: 'cas',
            provider: 'local',
          });
        }
        // If CAS fails, fall through to LLM
        console.log('CAS failed, falling back to LLM:', result.error);
      }
    }

    // Text-based solving - check credits and use appropriate provider
    const creditCheck = await checkUserCredits(user.id);

    if (creditCheck.hasCredits) {
      // Use Vertex AI with credits
      const deduction = await deductCredits(user.id, 'solve-math', 'Math solve with AI');

      if (deduction.success) {
        const projectId = process.env.VERTEX_PROJECT_ID;
        const location = process.env.VERTEX_LOCATION || 'us-central1';
        const accessToken = process.env.VERTEX_ACCESS_TOKEN;
        const apiKey = process.env.VERTEX_API_KEY;
        const model = process.env.VERTEX_MODEL_ID || 'google/gemini-3-pro-image-preview';

        if (!accessToken && !apiKey) {
          // Fall through to Hack Club AI
        } else {
          // Build context about known variables
          let variableContext = '';
          if (variables && Object.keys(variables).length > 0) {
            variableContext = '\n\nKnown variables:\n' +
              Object.entries(variables)
                .map(([name, value]) => `${name} = ${value}`)
                .join('\n');
          }

          // For API key, use query param; for OAuth token, use Bearer auth
          const apiUrl = accessToken
            ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi/chat/completions`
            : `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${apiKey}`;

          // For API key flow, use simpler model name without google/ prefix
          const effectiveModel = accessToken ? model : model.replace('google/', '');

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
              model: effectiveModel,
              messages: [
                {
                  role: 'system',
                  content: `You are a math solver. Given a mathematical expression or equation (may be in LaTeX format), compute the answer.

RULES:
1. Return ONLY the final numerical answer or simplified result
2. Do NOT show work or steps
3. Do NOT include explanations
4. Understand LaTeX notation: \\frac{a}{b} means a/b, ^{n} means power, \\sqrt{x} means square root, \\int means integral, etc.
5. If it's an equation to solve (like "2x + 5 = 15"), return the solution (like "x = 5")
6. If it's an expression to evaluate (like "3 + 5"), return the result (like "8")
7. If it's a simplification, return simplified form
8. For integrals, return the antiderivative with + C
9. For derivatives, return the derivative
10. For trig, use degrees unless radians specified
11. Round decimals to 4 places max
12. If you cannot solve it or it's incomplete, return "?"

Examples:
- Input: "2 + 3" → Output: "5"
- Input: "\\frac{1}{2} + \\frac{1}{4}" → Output: "3/4"
- Input: "2x + 5 = 15" → Output: "x = 5"
- Input: "\\sqrt{144}" → Output: "12"
- Input: "\\int x^2 dx" → Output: "x³/3 + C"
- Input: "\\frac{d}{dx} x^3" → Output: "3x²"
- Input: "x^2 + 5x + 6 = 0" → Output: "x = -2, -3"
- Input: "\\sin(30°)" → Output: "0.5"`,
                },
                {
                  role: 'user',
                  content: `Solve: ${expression}${variableContext}`,
                },
              ],
              max_tokens: 100,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            let answer = data.choices?.[0]?.message?.content || '';
            answer = answer.trim().replace(/\*\*/g, '').replace(/`/g, '');
            answer = answer.replace(/^(Answer|Result|Solution):\s*/i, '');

            return NextResponse.json({
              success: true,
              answer: answer || '?',
              source: 'llm',
              creditsRemaining: deduction.newBalance,
              provider: 'vertex',
            });
          }
        }
      }
    }

    // Fallback to Hack Club AI (free, text-only)
    let variableContext = '';
    if (variables && Object.keys(variables).length > 0) {
      variableContext = '\n\nKnown variables:\n' +
        Object.entries(variables)
          .map(([name, value]) => `${name} = ${value}`)
          .join('\n');
    }

    try {
      const hackclubResponse = await callHackClubAI({
        messages: [
          {
            role: 'system',
            content: `You are a math solver. Given a mathematical expression or equation, compute the answer.
Return ONLY the final numerical answer or simplified result. No explanations, no steps.
If you cannot solve it, return "?"`,
          },
          {
            role: 'user',
            content: `Solve: ${expression}${variableContext}`,
          },
        ],
        stream: false,
      });

      const hackclubData = await hackclubResponse.json();
      let answer = hackclubData.choices?.[0]?.message?.content || '';
      answer = answer.trim().replace(/\*\*/g, '').replace(/`/g, '');
      answer = answer.replace(/^(Answer|Result|Solution):\s*/i, '');

      return NextResponse.json({
        success: true,
        answer: answer || '?',
        source: 'llm',
        creditsRemaining: creditCheck.currentBalance,
        provider: 'hackclub',
      });
    } catch (hackclubError) {
      console.error('Hack Club AI error:', hackclubError);
      return NextResponse.json(
        { error: 'Failed to solve', details: 'AI service unavailable' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error solving math:', error);
    return NextResponse.json(
      {
        error: 'Failed to solve',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
