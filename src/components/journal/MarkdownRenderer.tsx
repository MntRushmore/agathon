'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const renderMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = 0;
    let inList = false;
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' = 'ul';

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ul') {
          elements.push(
            <ul key={`list-${key++}`} className="my-4 ml-6 space-y-2">
              {listItems.map((item, i) => (
                <li key={i} className="text-gray-700 leading-relaxed flex items-start gap-2">
                  <span className="text-gray-400 mt-2">•</span>
                  <span>{renderInlineContent(item)}</span>
                </li>
              ))}
            </ul>
          );
        } else {
          elements.push(
            <ol key={`list-${key++}`} className="my-4 ml-6 space-y-2">
              {listItems.map((item, i) => (
                <li key={i} className="text-gray-700 leading-relaxed flex items-start gap-3">
                  <span className="text-gray-500 font-medium">{i + 1}.</span>
                  <span>{renderInlineContent(item)}</span>
                </li>
              ))}
            </ol>
          );
        }
        listItems = [];
        inList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines but flush list if we were in one
      if (!trimmedLine) {
        flushList();
        continue;
      }

      // H1: # heading
      if (trimmedLine.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={`h1-${key++}`} className="text-3xl font-bold text-gray-900 mt-8 mb-4 first:mt-0">
            {renderInlineContent(trimmedLine.slice(2))}
          </h1>
        );
        continue;
      }

      // H2: ## heading
      if (trimmedLine.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={`h2-${key++}`} className="text-2xl font-bold text-gray-900 mt-8 mb-3">
            {renderInlineContent(trimmedLine.slice(3))}
          </h2>
        );
        continue;
      }

      // H3: ### heading
      if (trimmedLine.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={`h3-${key++}`} className="text-xl font-semibold text-gray-800 mt-6 mb-2">
            {renderInlineContent(trimmedLine.slice(4))}
          </h3>
        );
        continue;
      }

      // Horizontal rule
      if (trimmedLine === '---' || trimmedLine === '***') {
        flushList();
        elements.push(<hr key={`hr-${key++}`} className="my-6 border-gray-200" />);
        continue;
      }

      // Unordered list: - item or * item or • item
      if (/^[-*•]\s/.test(trimmedLine)) {
        if (!inList || listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        inList = true;
        listItems.push(trimmedLine.slice(2));
        continue;
      }

      // Ordered list: 1. item
      if (/^\d+\.\s/.test(trimmedLine)) {
        if (!inList || listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        inList = true;
        listItems.push(trimmedLine.replace(/^\d+\.\s/, ''));
        continue;
      }

      // Code block with backticks
      if (trimmedLine.startsWith('```')) {
        flushList();
        const codeLines: string[] = [];
        i++; // move past opening ```
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <pre key={`code-${key++}`} className="my-4 p-4 bg-[#F5F2EB] rounded-lg overflow-x-auto">
            <code className="text-sm text-gray-800 font-mono whitespace-pre">
              {codeLines.join('\n')}
            </code>
          </pre>
        );
        continue;
      }

      // Regular paragraph
      flushList();
      elements.push(
        <p key={`p-${key++}`} className="text-gray-700 leading-relaxed my-3">
          {renderInlineContent(trimmedLine)}
        </p>
      );
    }

    // Flush any remaining list
    flushList();

    return elements;
  };

  const renderInlineContent = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Look for inline math with $ notation: $a + b = c$
      const mathMatch = remaining.match(/\$([^$]+)\$/);
      
      // Look for bold **text**
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      
      // Look for inline code `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find the earliest match
      const matches = [
        mathMatch && { type: 'math', match: mathMatch, index: mathMatch.index! },
        boldMatch && { type: 'bold', match: boldMatch, index: boldMatch.index! },
        codeMatch && { type: 'code', match: codeMatch, index: codeMatch.index! },
      ].filter(Boolean) as Array<{ type: string; match: RegExpMatchArray; index: number }>;

      if (matches.length === 0) {
        parts.push(<span key={`text-${key++}`}>{remaining}</span>);
        break;
      }

      // Sort by index to find earliest
      matches.sort((a, b) => a.index - b.index);
      const earliest = matches[0];

      // Add text before match
      if (earliest.index > 0) {
        parts.push(<span key={`text-${key++}`}>{remaining.slice(0, earliest.index)}</span>);
      }

      // Render the match
      switch (earliest.type) {
        case 'math':
          try {
            const mathContent = earliest.match[1].trim();
            const html = katex.renderToString(mathContent, {
              displayMode: false,
              throwOnError: false,
            });
            parts.push(
              <span
                key={`math-${key++}`}
                className="mx-0.5"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            parts.push(<span key={`math-err-${key++}`}>{earliest.match[0]}</span>);
          }
          break;
        case 'bold':
          parts.push(
            <strong key={`bold-${key++}`} className="font-semibold text-gray-900">
              {earliest.match[1]}
            </strong>
          );
          break;
        case 'code':
          parts.push(
            <code key={`code-${key++}`} className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono">
              {earliest.match[1]}
            </code>
          );
          break;
      }

      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }

    return parts;
  };

  return (
    <div className={cn('prose prose-gray max-w-none', className)}>
      {renderMarkdown(content)}
    </div>
  );
}
