'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import DOMPurify from 'dompurify';

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
          const safeHtml = DOMPurify.sanitize(html);
          parts.push(
            <div
              key={`block-${key++}`}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
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
      // Use a simpler regex that avoids lookbehind (not supported in all browsers)
      // Find first $ that's not followed by another $
      let startIdx = -1;
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === '$') {
          // Check if it's not part of $$
          if (remaining[i + 1] !== '$' && (i === 0 || remaining[i - 1] !== '$')) {
            startIdx = i;
            break;
          }
        }
      }

      if (startIdx === -1) {
        // No inline math found
        if (remaining) {
          parts.push(
            <span key={`text-final-${key++}`}>{formatText(remaining)}</span>
          );
        }
        break;
      }

      // Find closing $
      let endIdx = -1;
      for (let i = startIdx + 1; i < remaining.length; i++) {
        if (remaining[i] === '$' && remaining[i + 1] !== '$' && remaining[i - 1] !== '$') {
          // Also make sure there's no newline in between
          const content = remaining.slice(startIdx + 1, i);
          if (!content.includes('\n')) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) {
        // No closing $ found, treat rest as text
        if (remaining) {
          parts.push(
            <span key={`text-final-${key++}`}>{formatText(remaining)}</span>
          );
        }
        break;
      }

      // Add text before the match
      if (startIdx > 0) {
        parts.push(
          <span key={`text-${key++}`}>
            {formatText(remaining.slice(0, startIdx))}
          </span>
        );
      }

      // Extract and render inline math
      const mathContent = remaining.slice(startIdx + 1, endIdx);
        try {
          const html = katex.renderToString(mathContent.trim(), {
            displayMode: false,
            throwOnError: false,
          });
          const safeHtml = DOMPurify.sanitize(html);
          parts.push(
            <span
              key={`inline-${key++}`}
              className="inline-block align-middle"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          );
        } catch {
        parts.push(
          <span key={`inline-err-${key++}`} className="text-red-500">
            ${mathContent}$
          </span>
        );
      }

      remaining = remaining.slice(endIdx + 1);
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
