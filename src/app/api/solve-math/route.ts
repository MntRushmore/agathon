import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { expression, variables } = await req.json();

    if (!expression) {
      return NextResponse.json(
        { error: 'No expression provided' },
        { status: 400 }
      );
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
