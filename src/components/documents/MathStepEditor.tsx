'use client';

import { useState, useRef, useEffect } from 'react';
import { MathfieldElement } from 'mathlive';
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MathStep {
  id: string;
  latex: string;
}

interface MathStepEditorProps {
  content: MathStep[];
  onChange: (content: MathStep[]) => void;
  editable?: boolean;
}

export function MathStepEditor({ content, onChange, editable = true }: MathStepEditorProps) {
  const [steps, setSteps] = useState<MathStep[]>(content.length > 0 ? content : [{ id: '1', latex: '' }]);
  const [mathLiveLoaded, setMathLiveLoaded] = useState(false);

  useEffect(() => {
    // Load MathLive once
    import('mathlive').then(() => {
      setMathLiveLoaded(true);
    });
  }, []);

  useEffect(() => {
    // Sync changes to parent
    onChange(steps);
  }, [steps]);

  const addStep = (afterIndex?: number) => {
    const newId = Date.now().toString();
    const insertIndex = afterIndex !== undefined ? afterIndex + 1 : steps.length;
    const newSteps = [...steps];
    newSteps.splice(insertIndex, 0, { id: newId, latex: '' });
    setSteps(newSteps);
  };

  const updateStep = (id: string, latex: string) => {
    setSteps(steps.map(step => step.id === id ? { ...step, latex } : step));
  };

  const deleteStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(step => step.id !== id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 py-8">
      {steps.map((step, index) => (
        <MathStepRow
          key={step.id}
          step={step}
          index={index}
          mathLiveLoaded={mathLiveLoaded}
          onUpdate={(latex) => updateStep(step.id, latex)}
          onDelete={() => deleteStep(step.id)}
          onAddAfter={() => addStep(index)}
          canDelete={steps.length > 1}
          editable={editable}
        />
      ))}

      {editable && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addStep()}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
      )}
    </div>
  );
}

interface MathStepRowProps {
  step: MathStep;
  index: number;
  mathLiveLoaded: boolean;
  onUpdate: (latex: string) => void;
  onDelete: () => void;
  onAddAfter: () => void;
  canDelete: boolean;
  editable: boolean;
}

function MathStepRow({
  step,
  index,
  mathLiveLoaded,
  onUpdate,
  onDelete,
  onAddAfter,
  canDelete,
  editable
}: MathStepRowProps) {
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (mathLiveLoaded && mathfieldRef.current) {
      const mf = mathfieldRef.current;
      mf.value = step.latex || '';

      const handleInput = (evt: Event) => {
        const newLatex = (evt.target as MathfieldElement).value;
        onUpdate(newLatex);
      };

      const handleKeyDown = (evt: Event) => {
        const keyEvent = evt as KeyboardEvent;
        // Enter key adds a new step
        if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
          keyEvent.preventDefault();
          onAddAfter();
          // Focus next step after it's created
          setTimeout(() => {
            const nextField = document.querySelector(`math-field[data-step-id="${step.id}"]`)
              ?.parentElement?.nextElementSibling?.querySelector('math-field') as MathfieldElement;
            if (nextField) {
              nextField.focus();
            }
          }, 100);
        }
      };

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeyDown);

      return () => {
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [mathLiveLoaded, step.latex, onUpdate, onAddAfter, step.id]);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-4">
        {/* Step number */}
        <div className="flex-shrink-0 w-8 pt-4 text-right text-sm text-gray-400 font-mono">
          {index + 1}
        </div>

        {/* Math field */}
        <div className="flex-1">
          {mathLiveLoaded ? (
            <div className="relative bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 focus-within:border-blue-500 transition-colors p-4">
              {React.createElement('math-field', {
                ref: mathfieldRef,
                'data-step-id': step.id,
                className: "w-full text-2xl outline-none",
                style: {
                  display: 'block',
                  minHeight: '60px',
                  width: '100%',
                  border: 'none',
                },
              })}

              {/* Delete button */}
              {editable && canDelete && isHovered && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 min-h-[88px] flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Add step button (appears on hover) */}
      {editable && isHovered && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onAddAfter}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
