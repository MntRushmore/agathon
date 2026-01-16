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
    <div className="max-w-4xl mx-auto space-y-6 py-8 px-4 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
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
        <div className="flex justify-center pt-6 pb-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => addStep()}
            className="gap-2 min-h-[48px] min-w-[140px] touch-manipulation"
          >
            <Plus className="h-5 w-5" />
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
  const [isFocused, setIsFocused] = useState(false);

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
            const allFields = document.querySelectorAll('math-field[data-step-id]');
            const currentIndex = Array.from(allFields).findIndex(
              (f) => f.getAttribute('data-step-id') === step.id
            );
            const nextField = allFields[currentIndex + 1] as MathfieldElement;
            if (nextField) {
              nextField.focus();
            }
          }, 150);
        }
      };

      const handleFocus = () => setIsFocused(true);
      const handleBlur = () => setIsFocused(false);

      mf.addEventListener('input', handleInput);
      mf.addEventListener('keydown', handleKeyDown);
      mf.addEventListener('focus', handleFocus);
      mf.addEventListener('blur', handleBlur);

      return () => {
        mf.removeEventListener('input', handleInput);
        mf.removeEventListener('keydown', handleKeyDown);
        mf.removeEventListener('focus', handleFocus);
        mf.removeEventListener('blur', handleBlur);
      };
    }
  }, [mathLiveLoaded, step.latex, onUpdate, onAddAfter, step.id]);

  return (
    <div className="group relative" style={{ touchAction: 'pan-y' }}>
      <div className="flex items-start gap-3 md:gap-4">
        {/* Step number */}
        <div className="flex-shrink-0 w-8 pt-5 text-right text-sm text-gray-400 font-mono">
          {index + 1}
        </div>

        {/* Math field */}
        <div className="flex-1 min-w-0">
          {mathLiveLoaded ? (
            <div className={`relative bg-white rounded-xl border-2 transition-colors p-3 md:p-4 ${
              isFocused ? 'border-blue-500 shadow-md' : 'border-gray-200'
            }`}>
              {React.createElement('math-field', {
                ref: mathfieldRef,
                'data-step-id': step.id,
                className: "w-full text-xl md:text-2xl outline-none",
                style: {
                  display: 'block',
                  minHeight: '50px',
                  width: '100%',
                  border: 'none',
                  touchAction: 'manipulation',
                },
              })}

              {/* Delete button - always visible on touch, hover on desktop */}
              {editable && canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-10 w-10 md:h-8 md:w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity touch-manipulation text-gray-400 hover:text-red-500 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 min-h-[80px] flex items-center justify-center text-gray-400">
              Loading...
            </div>
          )}
        </div>
      </div>

      {/* Add step button - always visible between steps */}
      {editable && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 md:h-6 md:w-6 rounded-full bg-gray-100 hover:bg-blue-100 hover:text-blue-600 opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onAddAfter();
            }}
          >
            <Plus className="h-4 w-4 md:h-3 md:w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
