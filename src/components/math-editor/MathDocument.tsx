'use client';

import React, { useState, useCallback, useRef } from 'react';
import { MathEquationRow } from './MathEquationRow';
import { QuickSymbolBar } from './QuickSymbolBar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { MathfieldElement } from 'mathlive';

export interface Equation {
  id: string;
  latex: string;
  solution: string | null;
  isGraphed: boolean;
}

interface MathDocumentProps {
  equations: Equation[];
  onEquationsChange: (equations: Equation[]) => void;
  onGraphEquation: (latex: string, add: boolean) => void;
  onSolveEquation: (id: string, latex: string) => Promise<string | null>;
  variables?: Record<string, number>;
}

export function MathDocument({
  equations,
  onEquationsChange,
  onGraphEquation,
  onSolveEquation,
  variables = {},
}: MathDocumentProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [solvingIds, setSolvingIds] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate unique ID
  const generateId = () => crypto.randomUUID();

  // Add new equation
  const addEquation = useCallback((afterId?: string) => {
    const newEquation: Equation = {
      id: generateId(),
      latex: '',
      solution: null,
      isGraphed: false,
    };

    if (afterId) {
      const index = equations.findIndex(eq => eq.id === afterId);
      const newEquations = [...equations];
      newEquations.splice(index + 1, 0, newEquation);
      onEquationsChange(newEquations);
    } else {
      onEquationsChange([...equations, newEquation]);
    }

    // Focus the new equation
    setTimeout(() => {
      setFocusedId(newEquation.id);
    }, 50);

    return newEquation.id;
  }, [equations, onEquationsChange]);

  // Update equation latex
  const updateLatex = useCallback((id: string, latex: string) => {
    onEquationsChange(
      equations.map(eq =>
        eq.id === id ? { ...eq, latex, solution: null } : eq
      )
    );
  }, [equations, onEquationsChange]);

  // Solve equation
  const handleSolve = useCallback(async (id: string) => {
    const equation = equations.find(eq => eq.id === id);
    if (!equation || !equation.latex.trim()) return;

    setSolvingIds(prev => new Set(prev).add(id));

    try {
      const solution = await onSolveEquation(id, equation.latex);
      onEquationsChange(
        equations.map(eq =>
          eq.id === id ? { ...eq, solution } : eq
        )
      );
    } catch (error) {
      console.error('Failed to solve equation:', error);
    } finally {
      setSolvingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [equations, onEquationsChange, onSolveEquation]);

  // Delete equation
  const deleteEquation = useCallback((id: string) => {
    const index = equations.findIndex(eq => eq.id === id);
    const newEquations = equations.filter(eq => eq.id !== id);
    onEquationsChange(newEquations);

    // Focus previous equation if exists
    if (index > 0 && newEquations.length > 0) {
      setFocusedId(newEquations[Math.min(index - 1, newEquations.length - 1)].id);
    }
  }, [equations, onEquationsChange]);

  // Toggle graph
  const toggleGraph = useCallback((id: string) => {
    const equation = equations.find(eq => eq.id === id);
    if (!equation) return;

    const newIsGraphed = !equation.isGraphed;
    onEquationsChange(
      equations.map(eq =>
        eq.id === id ? { ...eq, isGraphed: newIsGraphed } : eq
      )
    );
    onGraphEquation(equation.latex, newIsGraphed);
  }, [equations, onEquationsChange, onGraphEquation]);

  // Handle Enter key - add new equation after current
  const handleEnter = useCallback((id: string) => {
    addEquation(id);
  }, [addEquation]);

  // Handle Backspace on empty - delete and focus previous
  const handleBackspaceEmpty = useCallback((id: string) => {
    if (equations.length <= 1) return; // Keep at least one equation
    deleteEquation(id);
  }, [equations.length, deleteEquation]);

  // Insert symbol into focused equation
  const handleInsertSymbol = useCallback((symbol: string) => {
    if (!focusedId) return;

    // Find the mathfield and insert
    const mathfield = document.getElementById(`mathfield-${focusedId}`) as MathfieldElement | null;
    if (mathfield) {
      mathfield.executeCommand(['insert', symbol]);
      mathfield.focus();
    }
  }, [focusedId]);

  // Ensure at least one equation exists
  React.useEffect(() => {
    if (equations.length === 0) {
      addEquation();
    }
  }, [equations.length, addEquation]);

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Equations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {equations.map((equation, index) => (
          <MathEquationRow
            key={equation.id}
            id={equation.id}
            latex={equation.latex}
            solution={equation.solution}
            isSolving={solvingIds.has(equation.id)}
            isFocused={focusedId === equation.id}
            onLatexChange={(latex) => updateLatex(equation.id, latex)}
            onBlur={() => {
              setFocusedId(null);
              if (equation.latex.trim()) {
                handleSolve(equation.id);
              }
            }}
            onFocus={() => setFocusedId(equation.id)}
            onGraph={() => toggleGraph(equation.id)}
            onDelete={() => deleteEquation(equation.id)}
            onEnter={() => handleEnter(equation.id)}
            onBackspaceEmpty={() => handleBackspaceEmpty(equation.id)}
            autoFocus={index === equations.length - 1 && equation.latex === ''}
          />
        ))}

        {/* Add Equation Button */}
        <Button
          variant="ghost"
          className="w-full h-12 border-2 border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500"
          onClick={() => addEquation()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add equation
        </Button>
      </div>

      {/* Quick Symbol Bar */}
      <QuickSymbolBar
        onInsertSymbol={handleInsertSymbol}
        disabled={!focusedId}
      />
    </div>
  );
}
