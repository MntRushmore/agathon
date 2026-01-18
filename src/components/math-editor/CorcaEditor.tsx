'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MathBlock, Block, BlockType } from './MathBlock';
import { SymbolsSidebar } from './SymbolsSidebar';
import { GraphPanel } from './GraphPanel';
import { Button } from '@/components/ui/button';
import { LineChart, PanelRightClose, PanelRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MathfieldElement } from 'mathlive';

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
  const [variables, setVariables] = useState<Array<{ name: string; description: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate unique ID
  const generateId = () => crypto.randomUUID();

  // Add new block
  const addBlock = useCallback((afterId?: string, type: BlockType = 'text') => {
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
  const updateBlockType = useCallback((id: string, type: BlockType) => {
    onBlocksChange(
      blocks.map(b => b.id === id ? { ...b, type } : b)
    );
  }, [blocks, onBlocksChange]);

  // Delete block
  const deleteBlock = useCallback((id: string) => {
    if (blocks.length <= 1) return; // Keep at least one block

    const index = blocks.findIndex(b => b.id === id);
    const newBlocks = blocks.filter(b => b.id !== id);
    onBlocksChange(newBlocks);

    // Focus previous block
    if (index > 0) {
      setFocusedBlockId(newBlocks[index - 1].id);
    }
  }, [blocks, onBlocksChange]);

  // Handle Enter - create new block
  const handleEnter = useCallback((blockId: string) => {
    addBlock(blockId);
  }, [addBlock]);

  // Handle Backspace on empty - delete block
  const handleBackspaceEmpty = useCallback((blockId: string) => {
    deleteBlock(blockId);
  }, [deleteBlock]);

  // Insert symbol from sidebar
  const handleInsertSymbol = useCallback((latex: string) => {
    if (!focusedBlockId) return;

    const block = blocks.find(b => b.id === focusedBlockId);
    if (!block) return;

    if (block.type === 'math') {
      // Insert into mathfield
      const mathfield = document.querySelector(`math-field`) as MathfieldElement | null;
      if (mathfield) {
        mathfield.executeCommand(['insert', latex]);
        mathfield.focus();
      }
    } else {
      // For text blocks, convert to math or append
      updateBlockContent(focusedBlockId, block.content + latex);
    }
  }, [focusedBlockId, blocks, updateBlockContent]);

  // Extract variables from blocks
  useEffect(() => {
    const vars: Array<{ name: string; description: string }> = [];
    const varRegex = /([a-zA-Z])\s*=/g;

    blocks.forEach(block => {
      if (block.type === 'math') {
        let match;
        while ((match = varRegex.exec(block.content)) !== null) {
          const name = match[1];
          if (!vars.find(v => v.name === name)) {
            vars.push({ name, description: `Defined in line ${blocks.indexOf(block) + 1}` });
          }
        }
      }
    });

    setVariables(vars);
  }, [blocks]);

  // Get graphable equations
  const getMathBlocks = () => blocks.filter(b => b.type === 'math' && b.content.trim());

  // Ensure at least one block exists
  useEffect(() => {
    if (blocks.length === 0) {
      addBlock();
    }
  }, [blocks.length, addBlock]);

  return (
    <div className="flex h-full bg-white dark:bg-gray-950">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Document header */}
        <div className="px-8 py-6 border-b">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled Document"
            className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700"
          />
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{blocks.length} blocks</span>
            <span>•</span>
            <span>{getMathBlocks().length} equations</span>
          </div>
        </div>

        {/* Blocks */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto py-4"
        >
          {blocks.map((block, index) => (
            <MathBlock
              key={block.id}
              block={block}
              lineNumber={index + 1}
              isFocused={focusedBlockId === block.id}
              onContentChange={(content) => updateBlockContent(block.id, content)}
              onFocus={() => setFocusedBlockId(block.id)}
              onBlur={() => {}}
              onEnter={() => handleEnter(block.id)}
              onBackspaceEmpty={() => handleBackspaceEmpty(block.id)}
              onTypeChange={(type) => updateBlockType(block.id, type)}
              autoFocus={index === blocks.length - 1 && block.content === ''}
            />
          ))}

          {/* Add block button */}
          <div className="px-4 py-2">
            <button
              onClick={() => addBlock()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-lg transition-colors"
            >
              <span className="w-8 text-right">{blocks.length + 1}.</span>
              <span>Click to add a new block...</span>
            </button>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="border-t bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-[10px] border">$</kbd> for math,{' '}
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-[10px] border">#</kbd> for heading
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={showGraph ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const mathEqs = getMathBlocks().map(b => b.content);
                setGraphedEquations(mathEqs);
                setShowGraph(!showGraph);
              }}
              disabled={getMathBlocks().length === 0}
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
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      {showSidebar && (
        <SymbolsSidebar
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
