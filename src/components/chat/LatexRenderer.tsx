'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface LatexRendererProps {
  content: string;
  className?: string;
}

// Parse content and render LaTeX expressions
// $...$ for inline math
// $$...$$ for block/display math
export function LatexRenderer({ content, className = '' }: LatexRendererProps) {
  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    // Process block math first ($$...$$)
    while (remaining.length > 0) {
      // Look for block math $$...$$
      const blockMatch = remaining.match(/\$\$([^$]+)\$\$/);
      if (blockMatch && blockMatch.index !== undefined) {
        // Add text before the match
        if (blockMatch.index > 0) {
          const beforeText = remaining.slice(0, blockMatch.index);
          parts.push(...renderInlineMath(beforeText, key));
          key += 100;
        }

        // Render block math
        try {
          const html = katex.renderToString(blockMatch[1].trim(), {
            displayMode: true,
            throwOnError: false,
          });
          parts.push(
            <div
              key={`block-${key++}`}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          parts.push(
            <div key={`block-err-${key++}`} className="my-2 text-red-500">
              {blockMatch[0]}
            </div>
          );
        }

        remaining = remaining.slice(blockMatch.index + blockMatch[0].length);
      } else {
        // No more block math, process remaining for inline math
        parts.push(...renderInlineMath(remaining, key));
        break;
      }
    }

    return parts;
  };

  // Render inline math ($...$) within text
  const renderInlineMath = (text: string, startKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = startKey;

    while (remaining.length > 0) {
      // Look for inline math $...$
      // Make sure we don't match $$ (block math)
      const inlineMatch = remaining.match(/(?<!\$)\$(?!\$)([^$\n]+)\$(?!\$)/);
      if (inlineMatch && inlineMatch.index !== undefined) {
        // Add text before the match
        if (inlineMatch.index > 0) {
          parts.push(
            <span key={`text-${key++}`}>
              {formatText(remaining.slice(0, inlineMatch.index))}
            </span>
          );
        }

        // Render inline math
        try {
          const html = katex.renderToString(inlineMatch[1].trim(), {
            displayMode: false,
            throwOnError: false,
          });
          parts.push(
            <span
              key={`inline-${key++}`}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          parts.push(
            <span key={`inline-err-${key++}`} className="text-red-500">
              {inlineMatch[0]}
            </span>
          );
        }

        remaining = remaining.slice(inlineMatch.index + inlineMatch[0].length);
      } else {
        // No more inline math, add remaining text
        if (remaining) {
          parts.push(
            <span key={`text-final-${key++}`}>{formatText(remaining)}</span>
          );
        }
        break;
      }
    }

    return parts;
  };

  // Format text with basic markdown-like formatting
  const formatText = (text: string): React.ReactNode => {
    // Split by newlines to handle line breaks
    return text.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return <div className={className}>{renderContent()}</div>;
}
