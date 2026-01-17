'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { MathCanvas, Stroke, SolutionOverlay } from '@/components/math-board/MathCanvas';
import { MathToolbar } from '@/components/math-board/MathToolbar';

interface MathWhiteboard {
  id: string;
  user_id: string;
  title: string;
  strokes: Stroke[];
  solutions: SolutionOverlay[];
  variables: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export default function MathWhiteboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const canvasRef = useRef<any>(null);

  const [whiteboard, setWhiteboard] = useState<MathWhiteboard | null>(null);
  const [title, setTitle] = useState('');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [solutions, setSolutions] = useState<SolutionOverlay[]>([]);
  const [variables, setVariables] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  // History for undo/redo
  const [history, setHistory] = useState<{ strokes: Stroke[]; solutions: SolutionOverlay[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Load whiteboard
  useEffect(() => {
    async function loadWhiteboard() {
      if (!user || !params.id) return;

      const { data, error } = await supabase
        .from('math_whiteboards')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Failed to load math whiteboard:', error);
        toast.error('Failed to load math whiteboard');
        router.push('/math');
        return;
      }

      setWhiteboard(data);
      setTitle(data.title);
      setStrokes(data.strokes || []);
      // Load solutions from equations field (repurposed)
      setSolutions(data.equations || []);
      setVariables(data.variables || {});
      setLoading(false);

      // Initialize history
      setHistory([{ strokes: data.strokes || [], solutions: data.equations || [] }]);
      setHistoryIndex(0);
    }

    loadWhiteboard();
  }, [params.id, user, supabase, router]);

  // Auto-save with debounce
  const saveWhiteboard = useCallback(
    debounce(async (newTitle: string, newStrokes: Stroke[], newSolutions: SolutionOverlay[], newVariables: Record<string, number>) => {
      if (!whiteboard) return;

      setSaving(true);
      const { error } = await supabase
        .from('math_whiteboards')
        .update({
          title: newTitle,
          strokes: newStrokes,
          equations: newSolutions, // Store solutions in equations field
          variables: newVariables,
        })
        .eq('id', whiteboard.id);

      if (error) {
        console.error('Failed to save:', error);
        toast.error('Failed to save');
      }
      setSaving(false);
    }, 1000),
    [whiteboard, supabase]
  );

  // Save on changes
  useEffect(() => {
    if (whiteboard && !loading) {
      saveWhiteboard(title, strokes, solutions, variables);
    }
  }, [title, strokes, solutions, variables, whiteboard, loading, saveWhiteboard]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    setStrokes(newStrokes);
    // Clear solutions when strokes change (user is writing new stuff)
    if (newStrokes.length < strokes.length) {
      // Strokes were erased, clear solutions too
      setSolutions([]);
    }
  };

  const addToHistory = (newStrokes: Stroke[], newSolutions: SolutionOverlay[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ strokes: newStrokes, solutions: newSolutions });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex].strokes);
      setSolutions(history[newIndex].solutions);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex].strokes);
      setSolutions(history[newIndex].solutions);
    }
  };

  const handleClear = () => {
    if (confirm('Clear everything?')) {
      setStrokes([]);
      setSolutions([]);
      setVariables({});
      addToHistory([], []);
    }
  };

  const handleExport = () => {
    if (canvasRef.current?.getCanvasImage) {
      const imageData = canvasRef.current.getCanvasImage();
      const link = document.createElement('a');
      link.download = `${title || 'math-board'}.png`;
      link.href = imageData;
      link.click();
      toast.success('Exported!');
    }
  };

  // Handle recognition request from canvas
  const handleRecognitionRequest = async (imageData: string, bounds: { x: number; y: number; width: number; height: number }) => {
    setRecognizing(true);

    try {
      // Call OCR API to recognize the handwritten math
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      if (!response.ok) {
        throw new Error('OCR failed');
      }

      const data = await response.json();
      let recognized = data.text || '';

      // Clean up - remove $ delimiters
      recognized = recognized.replace(/^\$+|\$+$/g, '').replace(/\$/g, '').trim();

      if (!recognized) {
        setRecognizing(false);
        return;
      }

      console.log('Recognized:', recognized);

      // Try to evaluate the expression and show the result
      const result = evaluateAndSolve(recognized, variables);

      if (result !== null) {
        // Create solution overlay positioned to the right of the handwriting
        const newSolution: SolutionOverlay = {
          id: crypto.randomUUID(),
          text: result.display,
          position: {
            x: bounds.x + bounds.width + 10, // To the right of the handwriting
            y: bounds.y + bounds.height / 2, // Vertically centered
          },
        };

        // Update variables if this was an assignment
        if (result.variableName && result.value !== undefined) {
          setVariables(prev => ({
            ...prev,
            [result.variableName!]: result.value!,
          }));
        }

        const newSolutions = [...solutions, newSolution];
        setSolutions(newSolutions);
        addToHistory(strokes, newSolutions);

        toast.success(`${result.display}`);
      }
    } catch (error) {
      console.error('Recognition error:', error);
      // Don't show error toast - it's okay if recognition fails silently
    } finally {
      setRecognizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="border-b bg-white sticky top-0 z-20">
        <div className="max-w-full px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/math')}
            className="min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-lg font-semibold border-none shadow-none flex-1 max-w-md min-h-[44px]"
            placeholder="Untitled Math Board"
          />

          <div className="flex items-center gap-2">
            {recognizing && (
              <div className="flex items-center gap-2 text-sm text-cyan-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating...
              </div>
            )}
            {saving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="absolute top-20 left-4 z-10">
        <MathToolbar
          tool={tool}
          onToolChange={setTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          onExport={handleExport}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
        />
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <MathCanvas
          ref={canvasRef}
          strokes={strokes}
          solutions={solutions}
          onStrokesChange={handleStrokesChange}
          onRecognitionRequest={handleRecognitionRequest}
          tool={tool}
          disabled={recognizing}
        />
      </div>

      {/* Instructions */}
      {strokes.length === 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
          Write a math equation (e.g., 3 + 5 = or x = 10 * 2)
        </div>
      )}
    </div>
  );
}

// Evaluate math expression and return result
function evaluateAndSolve(
  expression: string,
  variables: Record<string, number>
): { display: string; value?: number; variableName?: string } | null {
  try {
    // Clean up the expression
    let expr = expression
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if it's a variable assignment: "x = 5" or "y = 10 * 2"
    const assignmentMatch = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (assignmentMatch) {
      const varName = assignmentMatch[1];
      const valueExpr = assignmentMatch[2];
      const value = evaluateSimpleExpression(valueExpr, variables);
      if (value !== null) {
        return {
          display: `= ${formatNumber(value)}`,
          value: value,
          variableName: varName,
        };
      }
    }

    // Check if it ends with = (user wants the answer)
    if (expr.endsWith('=')) {
      const leftSide = expr.slice(0, -1).trim();
      const value = evaluateSimpleExpression(leftSide, variables);
      if (value !== null) {
        return {
          display: `${formatNumber(value)}`,
          value: value,
        };
      }
    }

    // Try to evaluate as a simple expression
    const value = evaluateSimpleExpression(expr, variables);
    if (value !== null) {
      return {
        display: `= ${formatNumber(value)}`,
        value: value,
      };
    }

    return null;
  } catch (e) {
    console.error('Evaluation error:', e);
    return null;
  }
}

function evaluateSimpleExpression(expr: string, variables: Record<string, number>): number | null {
  try {
    // Substitute variables
    let substituted = expr;
    for (const [name, value] of Object.entries(variables)) {
      substituted = substituted.replace(new RegExp(`\\b${name}\\b`, 'g'), String(value));
    }

    // Handle common math notation
    substituted = substituted
      .replace(/(\d+)\s*\^\s*(\d+)/g, 'Math.pow($1,$2)') // Power
      .replace(/√(\d+)/g, 'Math.sqrt($1)') // Square root
      .replace(/sqrt\(([^)]+)\)/gi, 'Math.sqrt($1)')
      .replace(/pi/gi, 'Math.PI')
      .replace(/π/g, 'Math.PI');

    // Safety check - only allow numbers, operators, parentheses, and Math functions
    if (!/^[\d\s+\-*/().Math,powsqrtPI]+$/i.test(substituted)) {
      return null;
    }

    const result = eval(substituted);
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return result;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function formatNumber(n: number): string {
  // Round to avoid floating point issues
  const rounded = Math.round(n * 1000000) / 1000000;

  // Check if it's essentially an integer
  if (Math.abs(rounded - Math.round(rounded)) < 0.000001) {
    return String(Math.round(rounded));
  }

  // Otherwise show up to 4 decimal places
  return rounded.toFixed(4).replace(/\.?0+$/, '');
}
