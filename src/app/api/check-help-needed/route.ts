import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, image } = await req.json();

    if (!text && !image) {
      return NextResponse.json(
        { error: 'No text or image provided' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Build the message content
    const content: any[] = [];
    
    if (image) {
      content.push({
        type: 'image_url',
        image_url: {
          url: image, // base64 data URL
        },
      });
    }
    
    const promptText = text 
      ? `Here is the extracted text from the user's canvas:\n\n${text}\n\nBased on this text and/or the image, does this user appear to need help with a problem? Look for incomplete work, questions, stuck points, math problems, coding problems, or any indication that they're working through something challenging and might benefit from a solution or hint.\n\nRespond with a JSON object containing:\n- "needsHelp": true or false\n- "confidence": a number between 0 and 1 indicating your confidence\n- "reason": a brief explanation of your decision\n\nExample: {"needsHelp": true, "confidence": 0.85, "reason": "User has written an incomplete math problem with no solution"}`
      : `Based on the image, does this user appear to need help with a problem? Look for incomplete work, questions, stuck points, math problems, coding problems, or any indication that they're working through something challenging and might benefit from a solution or hint.\n\nRespond with a JSON object containing:\n- "needsHelp": true or false\n- "confidence": a number between 0 and 1 indicating your confidence\n- "reason": a brief explanation of your decision\n\nExample: {"needsHelp": true, "confidence": 0.85, "reason": "User has written an incomplete math problem with no solution"}`;
    
    content.push({
      type: 'text',
      text: promptText,
    });

    // Call GPT-4o-mini via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Madhacks AI Canvas',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: content,
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenRouter API error');
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '{}';
    
    // Parse the JSON response
    const decision = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      needsHelp: decision.needsHelp || false,
      confidence: decision.confidence || 0,
      reason: decision.reason || '',
    });
  } catch (error) {
    console.error('Error checking if help is needed:', error);
    return NextResponse.json(
      {
        error: 'Failed to check if help is needed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

