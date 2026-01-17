'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Pen, Eraser, Undo2, Redo2, Trash2, Download, LineChart } from 'lucide-react';

interface MathToolbarProps {
  tool: 'pen' | 'eraser';
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
  onGraph: () => void;
  canUndo: boolean;
  canRedo: boolean;
  canGraph: boolean;
}

export function MathToolbar({
  tool,
  onToolChange,
  onUndo,
  onRedo,
  onClear,
  onExport,
  onGraph,
  canUndo,
  canRedo,
  canGraph,
}: MathToolbarProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 p-2 bg-white rounded-lg shadow-md border">
        {/* Drawing tools */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={tool === 'pen' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => onToolChange('pen')}
              className="h-10 w-10 touch-manipulation"
            >
              <Pen className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Pen (write equations)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={tool === 'eraser' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => onToolChange('eraser')}
              className="h-10 w-10 touch-manipulation"
            >
              <Eraser className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Eraser</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* History controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-10 w-10 touch-manipulation"
            >
              <Undo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRedo}
              disabled={!canRedo}
              className="h-10 w-10 touch-manipulation"
            >
              <Redo2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        {/* Actions */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="h-10 w-10 touch-manipulation text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear all</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onExport}
              className="h-10 w-10 touch-manipulation"
            >
              <Download className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Export as image</p>
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-8 bg-gray-200 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onGraph}
              disabled={!canGraph}
              className="h-10 w-10 touch-manipulation text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
            >
              <LineChart className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Graph equations</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
