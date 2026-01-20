import { NextRequest, NextResponse } from 'next/server';
import { quickSolve, canQuickSolve } from '@/lib/cas-solver';

// Check if text looks like a math expression
function isMathExpression(text: string): boolean {
  if (!text || text.trim().length < 2) return false;

  const cleaned = text.trim();

  // Must contain at least one digit
  if (!/\d/.test(cleaned)) return false;

  // Must contain a math operator or equals sign
  if (!/[+\-*/=×÷^]/.test(cleaned)) return false;

  // Should not be mostly text/words (allow short variable names like x, y, etc)
  const wordCount = (cleaned.match(/[a-zA-Z]{3,}/g) || []).length;
  if (wordCount > 2) return false;

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const { expression, image, variables, quick } = await req.json();

    // If image is provided, use Gemini vision to recognize and solve
    if (image && typeof image === 'string' && image.startsWith('data:image/')) {
      const apiKey = process.env.HACKCLUB_AI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: 'HACKCLUB_AI_API_KEY not configured' },
          { status: 500 }
        );
      }

      // Use Gemini vision to recognize AND solve the math in one call
      const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
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
        });
      }

      return NextResponse.json({
        success: true,
        answer,
        recognized,
        source: 'gemini-vision',
      });
    }

    if (!expression) {
      return NextResponse.json(
        { error: 'No expression or image provided' },
        { status: 400 }
      );
    }

    // Quick mode: use CAS for instant computation
    if (quick) {
      // Check if expression is suitable for CAS
      if (canQuickSolve(expression)) {
        const result = quickSolve(expression);
        if (result.success) {
          return NextResponse.json({
            success: true,
            answer: result.answer,
            source: 'cas',
          });
        }
        // If CAS fails, fall through to LLM
        console.log('CAS failed, falling back to LLM:', result.error);
      }
    }

    const apiKey = process.env.HACKCLUB_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HACKCLUB_AI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Build context about known variables
    let variableContext = '';
    if (variables && Object.keys(variables).length > 0) {
      variableContext = '\n\nKnown variables:\n' +
        Object.entries(variables)
          .map(([name, value]) => `${name} = ${value}`)
          .join('\n');
    }

    // Call Hack Club API (Gemini) for solving
    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return NextResponse.json(
        { error: 'Solve API error', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    let answer = data.choices?.[0]?.message?.content || '';

    // Clean up the answer
    answer = answer.trim();

    // Remove any markdown formatting
    answer = answer.replace(/\*\*/g, '').replace(/`/g, '');

    // If it starts with "Answer:" or similar, remove it
    answer = answer.replace(/^(Answer|Result|Solution):\s*/i, '');

    return NextResponse.json({
      success: true,
      answer: answer || '?',
      source: 'llm',
    });
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
