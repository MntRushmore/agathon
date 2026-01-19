import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface StrokeData {
  x: number[];
  y: number[];
  t?: number[];
  p?: number[];
}

interface RecognitionRequest {
  strokes: StrokeData[];
  contentType?: 'MATH' | 'TEXT' | 'DIAGRAM';
}

interface RecognitionResult {
  latex?: string;
  mathml?: string;
  text?: string;
  confidence?: number;
}

function computeHmac(
  message: string,
  applicationKey: string,
  hmacKey: string
): string {
  // MyScript HMAC: key = applicationKey + hmacKey, algorithm = SHA-512
  const key = applicationKey + hmacKey;
  const hmac = crypto.createHmac('sha512', key);
  hmac.update(message);
  return hmac.digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const { strokes, contentType = 'MATH' }: RecognitionRequest = await req.json();

    if (!strokes || !Array.isArray(strokes) || strokes.length === 0) {
      return NextResponse.json(
        { error: 'No stroke data provided' },
        { status: 400 }
      );
    }

    const applicationKey = process.env.MYSCRIPT_APP_KEY;
    const hmacKey = process.env.MYSCRIPT_HMAC_KEY;

    if (!applicationKey || !hmacKey) {
      console.error('MyScript API keys not configured');
      return NextResponse.json(
        { error: 'MyScript API keys not configured' },
        { status: 500 }
      );
    }

    // Build the recognition request for MyScript REST API
    // Using the batch recognition endpoint with correct format
    const recognitionInput = {
      xDPI: 96,
      yDPI: 96,
      contentType: contentType === 'MATH' ? 'Math' : contentType === 'TEXT' ? 'Text' : 'Diagram',
      strokeGroups: [
        {
          strokes: strokes.map((stroke, index) => ({
            id: `stroke-${index}`,
            x: stroke.x,
            y: stroke.y,
            t: stroke.t || stroke.x.map((_, i) => Date.now() + i * 10),
            p: stroke.p || stroke.x.map(() => 0.5),
          })),
        },
      ],
    };

    const requestBody = JSON.stringify(recognitionInput);
    const hmacSignature = computeHmac(requestBody, applicationKey, hmacKey);

    console.log('Sending request to MyScript API...');
    console.log('Application Key:', applicationKey.slice(0, 8) + '...');
    console.log('Content Type:', recognitionInput.contentType);
    console.log('Strokes count:', strokes.length);

    // MyScript Cloud REST API endpoint for batch recognition
    const apiUrl = 'https://cloud.myscript.com/api/v4.0/iink/batch';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.myscript.jiix,application/json',
          'applicationKey': applicationKey,
          'hmac': hmacSignature,
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('MyScript API error:', response.status, errorText);
        return NextResponse.json(
          { error: `MyScript API error: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }

      const data = await response.json();
      console.log('MyScript API response:', JSON.stringify(data).slice(0, 200));

      // Extract recognition results
      const result: RecognitionResult = {};

      // Parse JIIX format response for math
      if (contentType === 'MATH') {
        // JIIX format contains expressions with LaTeX
        if (data.expressions && data.expressions.length > 0) {
          const expr = data.expressions[0];
          result.latex = expr.latex || extractLatexFromJiix(data);
          result.mathml = expr.mathml;
        } else if (data.label) {
          result.latex = data.label;
        }
      } else {
        // Text recognition
        result.text = data.label || data.text || '';
      }

      // Try to extract confidence if available
      if (data.expressions?.[0]?.candidates) {
        const candidates = data.expressions[0].candidates;
        if (candidates.length > 0 && typeof candidates[0].score === 'number') {
          result.confidence = candidates[0].score;
        }
      }

      return NextResponse.json({
        success: true,
        result,
        raw: data,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('MyScript API request timed out');
        return NextResponse.json(
          { error: 'Request to MyScript API timed out' },
          { status: 504 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      {
        error: 'Failed to recognize handwriting',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Helper to extract LaTeX from JIIX format
function extractLatexFromJiix(jiix: any): string | undefined {
  try {
    if (jiix.type === 'Math' && jiix.expressions) {
      return jiix.expressions.map((e: any) => e.latex || e.label).join(' ');
    }
    if (jiix.label) {
      return jiix.label;
    }
    // Recursively search for latex in children
    if (jiix.items) {
      for (const item of jiix.items) {
        const latex = extractLatexFromJiix(item);
        if (latex) return latex;
      }
    }
    if (jiix.children) {
      for (const child of jiix.children) {
        const latex = extractLatexFromJiix(child);
        if (latex) return latex;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined;
}
