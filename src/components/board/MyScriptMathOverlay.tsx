'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toRichText } from '@tldraw/tlschema';
import { createShapeId, Editor, TLShapeId } from 'tldraw';

// MyScript iink-ts types
interface StrokeData {
  x: number[];
  y: number[];
  t: number[];
  p?: number[];
}

interface MyScriptConfig {
  applicationKey: string;
  hmacKey: string;
}

interface RecognitionResult {
  latex?: string;
  mathml?: string;
  value?: string | number;
  expression?: string | null;
}

// Debounce delay - wait this long after the user stops drawing before showing answer
const RECOGNITION_DELAY_MS = 2500;

// Convert a limited subset of LaTeX into an evaluable string for nerdamer
function latexToExpression(latex?: string): string | null {
  if (!latex) return null;

  let expr = latex;

  // Strip whitespace and common wrappers
  expr = expr.replace(/\\!/g, '').replace(/\s+/g, '');

  // Handle \frac{a}{b}
  expr = expr.replace(/\\frac\s*{([^}]+)}{([^}]+)}/g, '($1)/($2)');

  // Replace multiplication and division symbols
  expr = expr.replace(/\\cdot|\\times|·/g, '*').replace(/÷/g, '/');

  // Replace power notation ^{n}
  expr = expr.replace(/\^{([^}]+)}/g, '^($1)');

  // Replace \sqrt{a} and \sqrt[n]{a}
  expr = expr.replace(/\\sqrt{([^}]+)}/g, 'sqrt($1)');
  expr = expr.replace(/\\sqrt\[([^\]]+)\]{([^}]+)}/g, 'root($1, $2)');

  // Replace braces with parentheses
  expr = expr.replace(/{/g, '(').replace(/}/g, ')');

  // Remove LaTeX equals annotations; evaluate left-hand side
  if (expr.includes('=')) {
    expr = expr.split('=')[0];
  }

  // Basic sanity check to avoid empty or dangerous strings
  if (!expr || /[^0-9+\-*/^().,a-zA-Z]/.test(expr)) {
    return null;
  }

  return expr;
}

interface MyScriptMathOverlayProps {
  editor: Editor | null;
  enabled: boolean;
  onResult?: (result: RecognitionResult) => void;
}

async function evaluateLocally(latex?: string): Promise<Pick<RecognitionResult, 'value' | 'expression'>> {
  const parsedExpression = latexToExpression(latex);
  if (!parsedExpression) {
    return { value: undefined, expression: null };
  }

  // Keep evaluation bounded for perf/safety on iPad streaming contexts
  if (parsedExpression.length > 120) {
    return { value: 'Too long', expression: parsedExpression };
  }

  try {
    const nerdamer = await import('nerdamer');
    // @ts-expect-error nerdamer types are not bundled
    const evaluated = nerdamer.default ? nerdamer.default(parsedExpression).evaluate() : nerdamer(parsedExpression).evaluate();
    const valueText = evaluated.text ? evaluated.text() : String(evaluated);
    return { value: valueText, expression: parsedExpression };
  } catch (error) {
    console.warn('Local evaluation failed for', parsedExpression, error);
    return { value: undefined, expression: parsedExpression };
  }
}

// Check if a string looks like a math expression
function isMathExpression(text: string): boolean {
  if (!text || text.trim().length < 2) return false;

  const cleaned = text.trim();

  // Must contain at least one digit
  if (!/\d/.test(cleaned)) return false;

  // Must contain a math operator or equals sign
  if (!/[+\-*/=×÷^]/.test(cleaned)) return false;

  // Should not be mostly text/words
  const wordCount = (cleaned.match(/[a-zA-Z]{3,}/g) || []).length;
  if (wordCount > 2) return false;

  return true;
}

// Use Gemini vision API to recognize and solve math from an image
async function recognizeWithGemini(imageBase64: string): Promise<RecognitionResult | null> {
  try {
    // Call the solve-math API which can handle images via Gemini
    const response = await fetch('/api/solve-math', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        quick: true,
      }),
    });

    if (!response.ok) {
      console.warn('Gemini solve-math API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (!data.success || !data.answer || data.answer === '?') {
      return null;
    }

    // Check if the recognized expression looks like math
    const expression = data.recognized || '';
    if (expression && !isMathExpression(expression)) {
      console.log('Skipping non-math content:', expression);
      return null;
    }

    return {
      latex: data.recognized,
      expression: data.recognized,
      value: data.answer,
    };
  } catch (error) {
    console.error('Gemini recognition error:', error);
    return null;
  }
}

// Simple HMAC-SHA-512 implementation for MyScript authentication
async function computeHmac(message: string, applicationKey: string, hmacKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(`${applicationKey}${hmacKey}`);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function MyScriptMathOverlay({ editor, enabled, onResult }: MyScriptMathOverlayProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authFailedRef = useRef(false);
  const missingConfigWarnedRef = useRef(false);
  const lastResultRef = useRef<RecognitionResult | null>(null);
  const lastResultShapeIdRef = useRef<ReturnType<typeof createShapeId> | null>(null);
  const lastResultAtRef = useRef(0);
  const lastBoundsRef = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
  const lastShapesSignatureRef = useRef<string>('');

  // Get MyScript credentials from environment (passed via props or context in real impl)
  const config: MyScriptConfig = {
    applicationKey: process.env.NEXT_PUBLIC_MYSCRIPT_APP_KEY || '',
    hmacKey: process.env.NEXT_PUBLIC_MYSCRIPT_HMAC_KEY || '',
  };

  // Extract stroke data from the provided draw shapes (already filtered/sorted)
  const extractStrokesFromShapes = useCallback((targetShapes: any[]) => {
    if (!editor || targetShapes.length === 0) return [];

    const strokes: StrokeData[] = [];

    targetShapes.forEach((shape) => {
      const segments = (shape as any)?.props?.segments || [];

      segments.forEach((segment: any) => {
        if (segment.type === 'free' && segment.points?.length > 0) {
          const stroke: StrokeData = {
            x: [],
            y: [],
            t: [],
            p: [],
          };

          segment.points.forEach((point: any, index: number) => {
            // Transform from shape-local coords to page coords
            stroke.x.push(shape.x + point.x);
            stroke.y.push(shape.y + point.y);
            // Generate timestamps (MyScript needs them for velocity analysis)
            stroke.t.push(Date.now() - (segment.points.length - index) * 10);
            stroke.p?.push(point.z || 0.5); // Pressure
          });

          if (stroke.x.length > 0) {
            strokes.push(stroke);
          }
        }
      });
    });

    return strokes;
  }, [editor]);

  // Capture image from canvas shapes for Gemini vision recognition
  const captureImageFromShapes = useCallback(async (shapeIds: TLShapeId[]): Promise<string | null> => {
    if (!editor || shapeIds.length === 0) return null;

    try {
      const svg = await editor.getSvgString(shapeIds);
      if (!svg) return null;

      return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
          // Add padding and ensure minimum size
          const padding = 40;
          canvas.width = Math.max(img.width + padding * 2, 200);
          canvas.height = Math.max(img.height + padding * 2, 100);

          // White background
          ctx!.fillStyle = 'white';
          ctx!.fillRect(0, 0, canvas.width, canvas.height);
          ctx!.drawImage(img, padding, padding);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null);
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.svg)));
      });
    } catch (error) {
      console.error('Failed to capture image:', error);
      return null;
    }
  }, [editor]);

  // Use Gemini vision as primary recognition method (more accurate for handwriting)
  const recognizeWithGeminiVision = useCallback(async (shapeIds: TLShapeId[]): Promise<RecognitionResult | null> => {
    const imageBase64 = await captureImageFromShapes(shapeIds);
    if (!imageBase64) return null;

    return recognizeWithGemini(imageBase64);
  }, [captureImageFromShapes]);

  // Send strokes to MyScript for recognition (fallback if Gemini fails)
  const recognizeStrokes = useCallback(async (strokes: StrokeData[]): Promise<RecognitionResult | null> => {
    if (strokes.length === 0) {
      return null;
    }

    // Skip MyScript if not configured - will use Gemini instead
    if (!config.applicationKey || !config.hmacKey) {
      if (!missingConfigWarnedRef.current) {
        console.log('MyScript not configured, using Gemini vision for recognition');
        missingConfigWarnedRef.current = true;
      }
      return null;
    }

    if (authFailedRef.current) {
      return null;
    }

    setIsProcessing(true);

    try {
      // Build the request body for MyScript batch API
      const requestBody = {
        xDPI: 96,
        yDPI: 96,
        contentType: 'Math',
        conversionState: 'DIGITAL_EDIT',
        strokeGroups: [
          {
            strokes: strokes.map(stroke => ({
              x: stroke.x,
              y: stroke.y,
              t: stroke.t,
              p: stroke.p,
            })),
          },
        ],
      };

      const bodyString = JSON.stringify(requestBody);
      const hmac = await computeHmac(bodyString, config.applicationKey, config.hmacKey);

      const response = await fetch('https://cloud.myscript.com/api/v4.0/iink/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.myscript.jiix',
          'applicationKey': config.applicationKey,
          'hmac': hmac,
        },
        body: bodyString,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          if (!authFailedRef.current) {
            console.error('MyScript API unauthorized:', errorText);
            authFailedRef.current = true;
          }
        } else {
          console.error('MyScript API error:', response.status, errorText);
        }
        return null;
      }

      const result = await response.json();

      // Extract the recognized expression (LaTeX) and run our own local evaluation
      const latex = result.expressions?.[0]?.label || result.label;
      const { value, expression } = await evaluateLocally(latex);
      const recognition: RecognitionResult = {
        latex,
        value,
        expression,
      };

      return recognition;
    } catch (error) {
      console.error('MyScript recognition error:', error);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [config.applicationKey, config.hmacKey]);

  // Display the result on the canvas
  const displayResult = useCallback((result: RecognitionResult) => {
    if (!editor || !result.value) return;

    const now = Date.now();
    if (lastResultRef.current?.value === result.value && now - lastResultAtRef.current < 2000) {
      return;
    }

    const viewportBounds = editor.getViewportPageBounds();
    const targetBounds = lastBoundsRef.current || {
      minX: viewportBounds.x,
      minY: viewportBounds.y,
      maxX: viewportBounds.x + viewportBounds.width,
      maxY: viewportBounds.y + viewportBounds.height,
    };

    const maxX = targetBounds.maxX;
    const avgY = targetBounds.minY + (targetBounds.maxY - targetBounds.minY) / 2;

    if (lastResultShapeIdRef.current) {
      const existing = editor.getShape(lastResultShapeIdRef.current);
      if (existing) {
        editor.deleteShape(lastResultShapeIdRef.current);
      }
    }

    // Create text shape with the answer
    const shapeId = createShapeId();
    editor.createShape({
      id: shapeId,
      type: 'text',
      x: maxX + 30,
      y: avgY - 20,
      isLocked: true,
      props: {
        richText: toRichText(`= ${result.value}`),
        size: 'l',
        color: 'light-blue',
        font: 'draw',
      },
      meta: {
        aiGenerated: true,
        aiMode: 'myscript-quick',
        aiTimestamp: new Date().toISOString(),
        latex: result.latex,
        expression: result.expression,
      },
    });

    lastResultRef.current = result;
    lastResultShapeIdRef.current = shapeId;
    lastResultAtRef.current = now;

    onResult?.(result);
  }, [editor, onResult]);

  // Watch for drawing changes and trigger recognition
  useEffect(() => {
    if (!editor || !enabled) return;

    const handleChange = () => {
      const shapes = editor.getCurrentPageShapes();
      const drawShapes = shapes
        .filter((s: any) => s.type === 'draw' && !s.meta?.aiGenerated)
        .sort((a: any, b: any) => a.index.localeCompare(b.index));

      if (drawShapes.length === 0) return;

      const lastShape = drawShapes[drawShapes.length - 1];
      const lastBounds = editor.getShapePageBounds(lastShape);
      if (!lastBounds) return;

      // Collect shapes that live on the same horizontal band as the latest stroke
      // Tighten the vertical band so we only consider the local equation cluster
      // immediately around the last stroke.
      const BAND_PADDING = 90;
      const equationShapes = drawShapes.filter((shape: any) => {
        const bounds = editor.getShapePageBounds(shape);
        if (!bounds) return false;
        const overlapsBand =
          bounds.maxY >= lastBounds.y - BAND_PADDING &&
          bounds.y <= lastBounds.maxY + BAND_PADDING;
        return overlapsBand;
      });

      if (equationShapes.length === 0) return;

      // Cache the bounding box for positioning the answer
      const bounds = equationShapes.reduce(
        (acc, shape: any) => {
          const b = editor.getShapePageBounds(shape);
          if (!b) return acc;
          return {
            minX: Math.min(acc.minX, b.x),
            minY: Math.min(acc.minY, b.y),
            maxX: Math.max(acc.maxX, b.x + b.width),
            maxY: Math.max(acc.maxY, b.y + b.height),
          };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );
      if (Number.isFinite(bounds.minX)) {
        lastBoundsRef.current = bounds;
      }

      // Avoid re-processing the same set of shapes
      const signature = equationShapes
        .map((shape: any) => `${shape.id}:${(shape.props?.segments || []).length}`)
        .join('|');
      if (signature === lastShapesSignatureRef.current) return;
      lastShapesSignatureRef.current = signature;

      // Debounce recognition - wait 1s after the last change so it only fires
      // once the student pauses writing.
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }

      recognitionTimeoutRef.current = setTimeout(async () => {
        setIsProcessing(true);

        try {
          // Try MyScript first (if configured) - it's faster
          const strokes = extractStrokesFromShapes(equationShapes);
          let result: RecognitionResult | null = null;

          if (strokes.length > 0) {
            result = await recognizeStrokes(strokes);
          }

          // If MyScript didn't work, fall back to Gemini vision (more accurate)
          if (!result || result.value === undefined || result.value === null) {
            const shapeIds = equationShapes.map((s: any) => s.id);
            result = await recognizeWithGeminiVision(shapeIds);
          }

          if (result && result.value !== undefined && result.value !== null) {
            displayResult(result);
          }
        } finally {
          setIsProcessing(false);
        }
      }, RECOGNITION_DELAY_MS); // Wait until user stops drawing before showing the quick answer
    };

    // Subscribe to editor changes
    const unsubscribe = editor.store.listen(handleChange, { source: 'user' });

    return () => {
      unsubscribe();
      if (recognitionTimeoutRef.current) {
        clearTimeout(recognitionTimeoutRef.current);
      }
    };
  }, [editor, enabled, extractStrokesFromShapes, recognizeStrokes, recognizeWithGeminiVision, displayResult]);

  // No visible UI - this is an overlay that just processes
  return null;
}
