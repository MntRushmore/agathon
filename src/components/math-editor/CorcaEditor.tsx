'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RichTextBlock, RichBlock, RichTextBlockRef } from './RichTextBlock';
import { CorcaSidebar } from './CorcaSidebar';
import { GraphPanel } from './GraphPanel';
import { Button } from '@/components/ui/button';
import { LineChart, PanelRightClose, PanelRight, Share, Download, MessageCircle, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectMathSegments, hasMath } from '@/lib/math-detection';

// Re-export types for compatibility
export type BlockType = 'rich' | 'heading';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  level?: 1 | 2 | 3;
}

interface CorcaEditorProps {
  title: string;
  blocks: Block[];
  onTitleChange: (title: string) => void;
  onBlocksChange: (blocks: Block[]) => void;
  onSolveEquation?: (latex: string) => Promise<string | null>;
}

export function CorcaEditor({
  title,
  blocks,
  onTitleChange,
  onBlocksChange,
  onSolveEquation,
}: CorcaEditorProps) {
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showGraph, setShowGraph] = useState(false);
  const [graphedEquations, setGraphedEquations] = useState<string[]>([]);
  const [variables, setVariables] = useState<Array<{ symbol: string; description: string; color?: string }>>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<Map<string, RichTextBlockRef>>(new Map());

  // Generate unique ID
  const generateId = () => crypto.randomUUID();

  // Add new block
  const addBlock = useCallback((afterId?: string, type: BlockType = 'rich') => {
    const newBlock: Block = {
      id: generateId(),
      type,
      content: '',
    };

    if (afterId) {
      const index = blocks.findIndex(b => b.id === afterId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      onBlocksChange(newBlocks);
    } else {
      onBlocksChange([...blocks, newBlock]);
    }

    setTimeout(() => setFocusedBlockId(newBlock.id), 50);
    return newBlock.id;
  }, [blocks, onBlocksChange]);

  // Update block content
  const updateBlockContent = useCallback((id: string, content: string) => {
    onBlocksChange(
      blocks.map(b => b.id === id ? { ...b, content } : b)
    );
  }, [blocks, onBlocksChange]);

  // Update block type
  const updateBlockType = useCallback((id: string, type: BlockType, level?: 1 | 2 | 3) => {
    onBlocksChange(
      blocks.map(b => b.id === id ? { ...b, type, content: '', level } : b)
    );
    setTimeout(() => {
      const ref = blockRefs.current.get(id);
      ref?.focus();
    }, 100);
  }, [blocks, onBlocksChange]);

  // Delete block
  const deleteBlock = useCallback((id: string) => {
    if (blocks.length <= 1) return;

    const index = blocks.findIndex(b => b.id === id);
    const newBlocks = blocks.filter(b => b.id !== id);
    onBlocksChange(newBlocks);

    if (index > 0) {
      setFocusedBlockId(newBlocks[index - 1].id);
      setTimeout(() => {
        const ref = blockRefs.current.get(newBlocks[index - 1].id);
        ref?.focus();
      }, 50);
    }
  }, [blocks, onBlocksChange]);

  // Handle Enter - create new rich text block
  const handleEnter = useCallback((blockId: string) => {
    addBlock(blockId, 'rich');
  }, [addBlock]);

  // Handle Backspace on empty
  const handleBackspaceEmpty = useCallback((blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // If it's a heading, convert to rich first
    if (block.type === 'heading') {
      updateBlockType(blockId, 'rich');
      return;
    }

    // Otherwise delete
    deleteBlock(blockId);
  }, [blocks, deleteBlock, updateBlockType]);

  // Insert symbol from sidebar
  const handleInsertSymbol = useCallback((latex: string) => {
    if (!focusedBlockId) return;

    const ref = blockRefs.current.get(focusedBlockId);
    if (ref) {
      ref.insertText(latex);
    }
  }, [focusedBlockId]);

  // Extract variables from blocks (including inline math)
  useEffect(() => {
    const vars: Array<{ symbol: string; description: string; color?: string }> = [];

    // Common math variables with descriptions
    const commonVars = [
      { symbol: 'x', description: 'Variable x', color: 'text-blue-500' },
      { symbol: 'y', description: 'Variable y', color: 'text-green-500' },
      { symbol: 'z', description: 'Variable z', color: 'text-purple-500' },
      { symbol: 'n', description: 'Integer n', color: 'text-orange-500' },
      { symbol: 'i', description: 'Index variable', color: 'text-cyan-500' },
    ];

    // Extract from blocks - check inline math segments
    blocks.forEach((block, index) => {
      const segments = detectMathSegments(block.content);
      segments.forEach(segment => {
        if (segment.type === 'math') {
          const matches = segment.content.match(/([a-zA-Z])(?:\s*=|_|\^)/g);
          if (matches) {
            matches.forEach(match => {
              const symbol = match[0];
              if (!vars.find(v => v.symbol === symbol)) {
                const common = commonVars.find(c => c.symbol === symbol);
                vars.push({
                  symbol,
                  description: common?.description || `Defined in line ${index + 1}`,
                  color: common?.color,
                });
              }
            });
          }
        }
      });
    });

    // Add common ones if not already present
    commonVars.forEach(cv => {
      if (!vars.find(v => v.symbol === cv.symbol)) {
        vars.push(cv);
      }
    });

    setVariables(vars.slice(0, 6));
  }, [blocks]);

  // Get blocks that contain graphable math (with x or y)
  const getGraphableEquations = () => {
    const equations: string[] = [];
    blocks.forEach(block => {
      const segments = detectMathSegments(block.content);
      segments.forEach(segment => {
        if (segment.type === 'math' && /[xy]/.test(segment.content)) {
          equations.push(segment.content);
        }
      });
    });
    return equations;
  };

  // Ensure at least one block exists
  useEffect(() => {
    if (blocks.length === 0) {
      addBlock(undefined, 'rich');
    }
  }, [blocks.length, addBlock]);

  // Convert old block types to new format
  const convertBlock = (block: Block): RichBlock => {
    // Handle old block types
    if ((block.type as string) === 'paragraph' || (block.type as string) === 'text') {
      return { ...block, type: 'rich' };
    }
    if ((block.type as string) === 'math') {
      return { ...block, type: 'rich' };
    }
    return block as RichBlock;
  };

  const graphableEquations = getGraphableEquations();

  return (
    <div className={cn('flex h-full', isDarkMode ? 'dark bg-gray-950' : 'bg-white')}>
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Document header */}
        <div className="px-12 pt-8 pb-4">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled Document"
            className={cn(
              'w-full text-4xl font-bold bg-transparent border-none outline-none',
              'placeholder:text-gray-300 dark:placeholder:text-gray-700',
              'dark:text-white'
            )}
          />
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
            <span>Your Name</span>
            <span>·</span>
            <span>@username</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Blocks */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-8"
        >
          {blocks.map((block, index) => (
            <RichTextBlock
              key={block.id}
              ref={(ref) => {
                if (ref) blockRefs.current.set(block.id, ref);
                else blockRefs.current.delete(block.id);
              }}
              block={convertBlock(block)}
              lineNumber={index + 1}
              isFocused={focusedBlockId === block.id}
              onContentChange={(content) => updateBlockContent(block.id, content)}
              onFocus={() => setFocusedBlockId(block.id)}
              onBlur={() => {}}
              onEnter={() => handleEnter(block.id)}
              onBackspaceEmpty={() => handleBackspaceEmpty(block.id)}
              onConvertToHeading={(level) => updateBlockType(block.id, 'heading', level)}
              autoFocus={index === blocks.length - 1 && block.content === ''}
            />
          ))}

          {/* Add block hint */}
          <div className="py-8 px-12">
            <button
              onClick={() => addBlock(undefined, 'rich')}
              className={cn(
                'flex items-center gap-3 text-sm transition-colors',
                'text-gray-300 hover:text-gray-500 dark:text-gray-700 dark:hover:text-gray-500'
              )}
            >
              <span className="w-8 text-right font-mono">{blocks.length + 1}.</span>
              <span>Type here or click to add a new line...</span>
            </button>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="border-t bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
              <Download className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showGraph ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setGraphedEquations(graphableEquations);
                setShowGraph(!showGraph);
              }}
              disabled={graphableEquations.length === 0}
              className="gap-2"
            >
              <LineChart className="h-4 w-4" />
              Graph
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className="h-9 w-9"
            >
              {showSidebar ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRight className="h-4 w-4" />
              )}
            </Button>

            <Button variant="default" size="sm" className="gap-2 bg-blue-500 hover:bg-blue-600">
              <Share className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      {showSidebar && (
        <CorcaSidebar
          onInsertSymbol={handleInsertSymbol}
          variables={variables}
        />
      )}

      {/* Graph panel */}
      {showGraph && (
        <GraphPanel
          equations={graphedEquations}
          onClose={() => setShowGraph(false)}
          onRemoveEquation={(eq) => {
            setGraphedEquations(prev => prev.filter(e => e !== eq));
          }}
        />
      )}
    </div>
  );
}
