'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Edit2, Loader2, Copy, Wand2 } from 'lucide-react';
import { RecognitionResult } from '@/lib/services/handwriting-recognition';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

interface RecognitionPreviewProps {
  results: RecognitionResult[];
  isRecognizing: boolean;
  onAccept?: (result: RecognitionResult) => void;
  onDismiss?: () => void;
  onEdit?: (result: RecognitionResult) => void;
  className?: string;
}

export function RecognitionPreview({
  results,
  isRecognizing,
  onAccept,
  onDismiss,
  onEdit,
  className,
}: RecognitionPreviewProps) {
  // Render LaTeX with KaTeX
  const renderLatex = (latex: string): string | null => {
    try {
      const katex = require('katex');
      return katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
        strict: false,
      });
    } catch {
      return null;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Don't show if no results and not recognizing
  if (results.length === 0 && !isRecognizing) {
    return null;
  }

  return (
    <div className={cn('fixed bottom-24 left-1/2 -translate-x-1/2 z-50', className)}>
      <Card className="shadow-2xl border-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm min-w-[300px] max-w-[500px]">
        <CardContent className="p-4">
          {isRecognizing ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Recognizing handwriting...
              </span>
            </div>
          ) : (
            <>
              {results.map((result, index) => (
                <div key={index} className="space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">
                        Recognized Math
                      </span>
                    </div>
                    {result.confidence !== undefined && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(result.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>

                  {/* LaTeX Preview */}
                  {result.latex && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 flex items-center justify-center min-h-[60px]">
                      {(() => {
                        const html = renderLatex(result.latex);
                        if (html) {
                          return (
                            <span
                              className="text-xl"
                              dangerouslySetInnerHTML={{ __html: html }}
                            />
                          );
                        }
                        return (
                          <span className="font-mono text-sm">{result.latex}</span>
                        );
                      })()}
                    </div>
                  )}

                  {/* Text Result (for non-math recognition) */}
                  {result.text && !result.latex && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                      <span className="text-sm">{result.text}</span>
                    </div>
                  )}

                  {/* LaTeX Source (collapsible) */}
                  {result.latex && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <code className="flex-1 bg-gray-100 dark:bg-gray-800 rounded px-2 py-1 font-mono truncate">
                        {result.latex}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(result.latex!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDismiss}
                      className="h-8 text-xs text-gray-500"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Dismiss
                    </Button>
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(result)}
                        className="h-8 text-xs"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                    {onAccept && (
                      <Button
                        size="sm"
                        onClick={() => onAccept(result)}
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Insert as Text
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
