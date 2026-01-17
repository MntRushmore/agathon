'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, LineChart, X, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import dynamic from 'next/dynamic';

// Dynamically import tldraw component to avoid SSR issues
const TldrawMathCanvas = dynamic(
  () => import('@/components/math-board/TldrawMathCanvas').then(mod => mod.TldrawMathCanvas),
  { ssr: false, loading: () => <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
);

interface EquationResult {
  id: string;
  recognized: string;
  solution: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface MathWhiteboard {
  id: string;
  user_id: string;
  title: string;
  equations: EquationResult[];
  variables: Record<string, number>;
  created_at: string;
  updated_at: string;
}

// Desmos Graph Component
function DesmosGraph({ equations, onClose }: { equations: string[]; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).Desmos) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !containerRef.current || !(window as any).Desmos) return;

    calculatorRef.current = (window as any).Desmos.GraphingCalculator(containerRef.current, {
      expressions: false,
      settingsMenu: false,
      zoomButtons: true,
      lockViewport: false,
      border: false,
      keypad: false,
    });

    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
      }
    };
  }, [loaded]);

  useEffect(() => {
    if (!calculatorRef.current) return;

    calculatorRef.current.setBlank();

    equations.forEach((eq, index) => {
      let cleanEq = eq
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/·/g, '*')
        .replace(/^=\s*/, '')
        .trim();

      // Try to graph as y = expression
      if (!cleanEq.includes('=') && cleanEq.includes('x')) {
        calculatorRef.current.setExpression({
          id: `eq-${index}`,
          latex: `y=${cleanEq}`,
          color: '#00B4D8',
        });
      } else if (cleanEq.includes('=')) {
        calculatorRef.current.setExpression({
          id: `eq-${index}`,
          latex: cleanEq,
          color: '#00B4D8',
        });
      }
    });
  }, [equations]);

  return (
    <div
      className={`absolute bg-white rounded-lg shadow-xl border overflow-hidden transition-all duration-200 ${
        isExpanded ? 'inset-4 z-50' : 'bottom-4 right-4 w-80 h-64 z-30'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <span className="text-sm font-medium text-gray-700">Graph</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: isExpanded ? 'calc(100% - 41px)' : '223px' }}
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-sm text-gray-500">Loading graph...</div>
        </div>
      )}
    </div>
  );
}

export default function MathWhiteboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const canvasRef = useRef<any>(null);

  const [whiteboard, setWhiteboard] = useState<MathWhiteboard | null>(null);
  const [title, setTitle] = useState('');
  const [equations, setEquations] = useState<EquationResult[]>([]);
  const [variables, setVariables] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

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
      setEquations(data.equations || []);
      setVariables(data.variables || {});
      setLoading(false);
    }

    loadWhiteboard();
  }, [params.id, user, supabase, router]);

  // Auto-save with debounce
  const saveWhiteboard = useCallback(
    debounce(async (newTitle: string, newEquations: EquationResult[], newVariables: Record<string, number>) => {
      if (!whiteboard) return;

      setSaving(true);
      const { error } = await supabase
        .from('math_whiteboards')
        .update({
          title: newTitle,
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
      saveWhiteboard(title, equations, variables);
    }
  }, [title, equations, variables, whiteboard, loading, saveWhiteboard]);

  // Handle recognition request from canvas
  const handleRecognitionRequest = async (
    imageData: string,
    bounds: { x: number; y: number; width: number; height: number }
  ): Promise<{ recognized: string; solution: string } | null> => {
    setRecognizing(true);

    try {
      // Step 1: Call OCR API
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

      // Clean up LaTeX formatting
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
        return null;
      }

      console.log('Recognized:', recognized);

      // Step 2: Call AI to solve
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
      const answer = solveData.answer || '?';

      if (answer && answer !== '?') {
        // Check for variable assignment
        const varMatch = answer.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\d.-]+)$/);
        if (varMatch) {
          const varName = varMatch[1];
          const varValue = parseFloat(varMatch[2]);
          if (!isNaN(varValue)) {
            setVariables(prev => ({ ...prev, [varName]: varValue }));
          }
        }

        toast.success(`= ${answer}`);
        return { recognized, solution: answer };
      }

      return null;
    } catch (error) {
      console.error('Recognition/solve error:', error);
      return null;
    } finally {
      setRecognizing(false);
    }
  };

  const handleEquationsChange = (newEquations: EquationResult[]) => {
    setEquations(newEquations);
  };

  // Get graphable equations
  const graphableEquations = equations
    .filter(eq => eq.solution)
    .map(eq => eq.solution)
    .filter(sol => sol.includes('x') || sol.includes('y') || sol.includes('='));

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
            onChange={(e) => setTitle(e.target.value)}
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGraph(!showGraph)}
              disabled={graphableEquations.length === 0}
              className="gap-2"
            >
              <LineChart className="h-4 w-4" />
              Graph
            </Button>

            {saving && (
              <span className="text-xs text-muted-foreground">Saving...</span>
            )}
          </div>
        </div>
      </div>

      {/* Canvas area - tldraw */}
      <div className="flex-1 relative">
        <TldrawMathCanvas
          ref={canvasRef}
          onRecognitionRequest={handleRecognitionRequest}
          onEquationsChange={handleEquationsChange}
          disabled={recognizing}
        />

        {/* Graph overlay */}
        {showGraph && graphableEquations.length > 0 && (
          <DesmosGraph
            equations={graphableEquations}
            onClose={() => setShowGraph(false)}
          />
        )}
      </div>

      {/* Instructions */}
      {equations.length === 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full text-sm z-10">
          Draw any math equation - it will be solved automatically!
        </div>
      )}
    </div>
  );
}
