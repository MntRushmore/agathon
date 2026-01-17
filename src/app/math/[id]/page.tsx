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
import { MathCanvas, Stroke, EquationLine } from '@/components/math-board/MathCanvas';
import { MathToolbar } from '@/components/math-board/MathToolbar';
import { MathGraph } from '@/components/math-board/MathGraph';

interface MathWhiteboard {
  id: string;
  user_id: string;
  title: string;
  strokes: Stroke[];
  equations: EquationLine[];
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
  const [equations, setEquations] = useState<EquationLine[]>([]);
  const [variables, setVariables] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [showGraph, setShowGraph] = useState(false);

  // History for undo/redo
  const [history, setHistory] = useState<{ strokes: Stroke[]; equations: EquationLine[] }[]>([]);
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
      setEquations(data.equations || []);
      setVariables(data.variables || {});
      setLoading(false);

      // Initialize history
      setHistory([{ strokes: data.strokes || [], equations: data.equations || [] }]);
      setHistoryIndex(0);
    }

    loadWhiteboard();
  }, [params.id, user, supabase, router]);

  // Auto-save with debounce
  const saveWhiteboard = useCallback(
    debounce(async (newTitle: string, newStrokes: Stroke[], newEquations: EquationLine[], newVariables: Record<string, number>) => {
      if (!whiteboard) return;

      setSaving(true);
      const { error } = await supabase
        .from('math_whiteboards')
        .update({
          title: newTitle,
          strokes: newStrokes,
          equations: newEquations,
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
      saveWhiteboard(title, strokes, equations, variables);
    }
  }, [title, strokes, equations, variables, whiteboard, loading, saveWhiteboard]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
  };

  const handleStrokesChange = (newStrokes: Stroke[]) => {
    setStrokes(newStrokes);
  };

  const handleEquationsChange = (newEquations: EquationLine[]) => {
    setEquations(newEquations);
  };

  const addToHistory = (newStrokes: Stroke[], newEquations: EquationLine[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ strokes: newStrokes, equations: newEquations });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex].strokes);
      setEquations(history[newIndex].equations);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex].strokes);
      setEquations(history[newIndex].equations);
    }
  };

  const handleClear = () => {
    if (confirm('Clear everything?')) {
      setStrokes([]);
      setEquations([]);
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

  const handleGraph = () => {
    setShowGraph(true);
  };

  // Get graphable equations (those with recognized solutions that look like functions)
  const getGraphableEquations = (): string[] => {
    return equations
      .filter(eq => eq.solution)
      .map(eq => {
        // The solution text like "= 2x + 1" needs to be converted to something graphable
        let sol = eq.solution || '';
        // Remove the leading "= " if present
        sol = sol.replace(/^=\s*/, '');
        return sol;
      })
      .filter(sol => {
        // Only include if it looks like a function (contains x or is an equation)
        return sol.includes('x') || sol.includes('y') || sol.includes('=');
      });
  };

  const graphableEquations = getGraphableEquations();

  // Handle recognition request from canvas
  const handleRecognitionRequest = async (
    imageData: string,
    equation: EquationLine,
    bounds: { x: number; y: number; width: number; height: number }
  ) => {
    setRecognizing(true);

    try {
      // Step 1: Call OCR API to recognize the handwritten math
      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
      });

      if (!ocrResponse.ok) {
        throw new Error('OCR failed');
      }

      const ocrData = await ocrResponse.json();
      let recognized = ocrData.text || '';

      // Clean up - remove $ delimiters and LaTeX formatting
      recognized = recognized
        .replace(/^\$+|\$+$/g, '')
        .replace(/\$/g, '')
        .replace(/\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\cdot/g, '·')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
        .replace(/\\\\/g, '')
        .trim();

      if (!recognized) {
        setRecognizing(false);
        return;
      }

      console.log('Recognized:', recognized);

      // Step 2: Call AI to solve the math
      const solveResponse = await fetch('/api/solve-math', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expression: recognized,
          variables: variables,
        }),
      });

      if (!solveResponse.ok) {
        throw new Error('Solve failed');
      }

      const solveData = await solveResponse.json();
      let answer = solveData.answer || '?';

      if (answer && answer !== '?') {
        // Format the display text
        let displayText = answer;

        // If answer doesn't start with = or contain =, add it
        if (!displayText.startsWith('=') && !displayText.includes('=')) {
          displayText = `= ${displayText}`;
        }

        // Update the equation with the solution
        const updatedEquations = equations.map(eq =>
          eq.id === equation.id
            ? { ...eq, solution: displayText, recognized: true, bounds }
            : eq
        );

        // Check if this was a variable assignment and update variables
        const varMatch = answer.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\d.-]+)$/);
        if (varMatch) {
          const varName = varMatch[1];
          const varValue = parseFloat(varMatch[2]);
          if (!isNaN(varValue)) {
            setVariables(prev => ({
              ...prev,
              [varName]: varValue,
            }));
          }
        }

        setEquations(updatedEquations);
        addToHistory(strokes, updatedEquations);

        toast.success(displayText);
      }
    } catch (error) {
      console.error('Recognition/solve error:', error);
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
          onGraph={handleGraph}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          canGraph={graphableEquations.length > 0}
        />
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <MathCanvas
          ref={canvasRef}
          strokes={strokes}
          equations={equations}
          onStrokesChange={handleStrokesChange}
          onEquationsChange={handleEquationsChange}
          onRecognitionRequest={handleRecognitionRequest}
          tool={tool}
          disabled={recognizing}
        />

        {/* Graph overlay */}
        {showGraph && graphableEquations.length > 0 && (
          <MathGraph
            equations={graphableEquations}
            onClose={() => setShowGraph(false)}
          />
        )}
      </div>

      {/* Instructions */}
      {strokes.length === 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm">
          Write any math - algebra, trig, calculus, and more!
        </div>
      )}
    </div>
  );
}
