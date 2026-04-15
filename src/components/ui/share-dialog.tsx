'use client';

/**
 * Share & Export Dialog
 * Tabs: Share (copy link, visibility) | Export (Markdown, plain text)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { sileo } from 'sileo';
import {
  X, Link, Globe, Lock, Copy, Check,
  DownloadSimple, FileText, FileMd,
} from '@phosphor-icons/react';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  journalId?: string;
  journalTitle?: string;
  content?: string;           // raw markdown/text content
  isPublic?: boolean;
  onTogglePublic?: (isPublic: boolean) => Promise<void>;
}

type Tab = 'share' | 'export';

export function ShareDialog({
  open,
  onClose,
  journalId,
  journalTitle = 'Untitled Journal',
  content = '',
  isPublic = false,
  onTogglePublic,
}: ShareDialogProps) {
  const [tab, setTab] = useState<Tab>('share');
  const [copied, setCopied] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [publicState, setPublicState] = useState(isPublic);

  useEffect(() => { setPublicState(isPublic); }, [isPublic]);

  useEffect(() => {
    if (!open) return;
    setTab('share');
    setCopied(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const shareUrl = journalId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/journal/${journalId}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      sileo.error({ title: 'Could not copy link' });
    }
  };

  const handleTogglePublic = async () => {
    if (!onTogglePublic) return;
    setTogglingPublic(true);
    try {
      const next = !publicState;
      await onTogglePublic(next);
      setPublicState(next);
      sileo.success({ title: next ? 'Journal is now public' : 'Journal is now private' });
    } catch {
      sileo.error({ title: 'Failed to update visibility' });
    } finally {
      setTogglingPublic(false);
    }
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${sanitizeFilename(journalTitle)}.md`);
  };

  const handleExportText = () => {
    // Strip common markdown syntax for plain text
    const plain = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`{1,3}([\s\S]*?)`{1,3}/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '• ');
    const blob = new Blob([plain], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${sanitizeFilename(journalTitle)}.txt`);
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-[300] flex items-center justify-center',
        'transition-all duration-150',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full max-w-[440px] mx-4 bg-white rounded-2xl shadow-2xl border border-[#e2e4e8] overflow-hidden',
          'transition-all duration-150',
          open ? 'scale-100 translate-y-0' : 'scale-95 translate-y-1'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1a1d2b]">Share & Export</h2>
            <p className="text-[12px] text-[#9096a2] mt-0.5 truncate max-w-[300px]">{journalTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#9096a2] hover:text-[#1a1d2b] hover:bg-[#f0f1f3] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 px-5 border-b border-[#f0f1f3]">
          {(['share', 'export'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-2.5 text-[13px] font-medium capitalize border-b-2 -mb-px transition-colors',
                tab === t
                  ? 'border-[#1e6ee8] text-[#1e6ee8]'
                  : 'border-transparent text-[#9096a2] hover:text-[#4a4f5c]'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-5">
          {tab === 'share' && (
            <div className="space-y-4">
              {/* Visibility toggle */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#e2e4e8] bg-[#f8f9fa]">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex items-center justify-center w-9 h-9 rounded-xl',
                    publicState ? 'bg-[#eef3fd] text-[#1e6ee8]' : 'bg-[#f0f1f3] text-[#9096a2]'
                  )}>
                    {publicState ? <Globe className="h-4.5 w-4.5" weight="duotone" /> : <Lock className="h-4.5 w-4.5" weight="duotone" />}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-[#1a1d2b]">
                      {publicState ? 'Public' : 'Private'}
                    </div>
                    <div className="text-[11px] text-[#9096a2]">
                      {publicState ? 'Anyone with the link can view' : 'Only you can access this journal'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleTogglePublic}
                  disabled={togglingPublic || !onTogglePublic}
                  role="switch"
                  aria-checked={publicState}
                  className={cn(
                    'relative w-9 h-5 rounded-full transition-colors duration-150',
                    publicState ? 'bg-[#1e6ee8]' : 'bg-[#d1d5db]',
                    (!onTogglePublic || togglingPublic) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150',
                    publicState ? 'translate-x-4' : 'translate-x-0'
                  )} />
                </button>
              </div>

              {/* Copy link */}
              <div>
                <label className="text-[11px] font-semibold text-[#9096a2] uppercase tracking-wider block mb-2">Link</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 h-9 px-3 rounded-xl border border-[#e2e4e8] bg-[#f8f9fa]">
                    <Link className="h-3.5 w-3.5 text-[#9096a2] flex-shrink-0" weight="duotone" />
                    <span className="text-[12px] text-[#4a4f5c] truncate font-mono">{shareUrl || 'No URL available'}</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    disabled={!shareUrl}
                    className={cn(
                      'flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold transition-all',
                      copied
                        ? 'bg-green-50 border border-green-200 text-green-600'
                        : 'bg-[#1e6ee8] text-white hover:bg-[#1a5fcf]',
                      !shareUrl && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" weight="duotone" /> : <Copy className="h-3.5 w-3.5" weight="duotone" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {!publicState && (
                <p className="text-[11px] text-[#9096a2] bg-[#f8f9fa] rounded-xl px-3 py-2.5 border border-[#f0f1f3]">
                  Enable public access above to share this link with others.
                </p>
              )}
            </div>
          )}

          {tab === 'export' && (
            <div className="space-y-3">
              <p className="text-[12px] text-[#9096a2]">Download your journal in a portable format.</p>

              <button
                onClick={handleExportMarkdown}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#e2e4e8] bg-white hover:bg-[#f8f9fa] transition-colors text-left group"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#eef3fd] text-[#1e6ee8] flex-shrink-0">
                  <FileMd className="h-5 w-5" weight="duotone" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1a1d2b]">Markdown</div>
                  <div className="text-[11px] text-[#9096a2]">Full formatting preserved (.md)</div>
                </div>
                <DownloadSimple className="h-4 w-4 text-[#c4c7cd] group-hover:text-[#4a4f5c] transition-colors" weight="duotone" />
              </button>

              <button
                onClick={handleExportText}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#e2e4e8] bg-white hover:bg-[#f8f9fa] transition-colors text-left group"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#f0f1f3] text-[#4a4f5c] flex-shrink-0">
                  <FileText className="h-5 w-5" weight="duotone" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1a1d2b]">Plain text</div>
                  <div className="text-[11px] text-[#9096a2]">No formatting, universal (.txt)</div>
                </div>
                <DownloadSimple className="h-4 w-4 text-[#c4c7cd] group-hover:text-[#4a4f5c] transition-colors" weight="duotone" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-z0-9_\-\s]/gi, '').replace(/\s+/g, '_').toLowerCase() || 'journal';
}
