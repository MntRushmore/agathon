'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { fetchAnnotationFiles, deleteAnnotationFile, renameAnnotationFile } from '@/lib/annotate/storage';
import type { AnnotationFile } from '@/lib/annotate/types';
import { getFriendlyTimestamp } from '@/components/dashboard/study-tips';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  MagnifyingGlass,
  Plus,
  Trash,
  PencilSimple,
  DotsThree,
  GridNine,
  ListBullets,
  HighlighterCircle,
  FileText,
  ImageSquare,
} from '@phosphor-icons/react';
import { Logo } from '@/components/ui/logo';

export default function AnnotationFilesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [files, setFiles] = useState<AnnotationFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/?auth=required');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    loadFiles();
  }, [user]);

  async function loadFiles() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchAnnotationFiles(user.id);
      setFiles(data);
    } catch (err) {
      console.error('Error loading files:', err);
      toast.error('Failed to load annotation files');
    } finally {
      setLoading(false);
    }
  }

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    return files.filter(f =>
      f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  const handleDelete = useCallback(async (id: string, storagePath: string | null) => {
    const success = await deleteAnnotationFile(id, storagePath);
    if (success) {
      setFiles(prev => prev.filter(f => f.id !== id));
      toast.success('File deleted');
    } else {
      toast.error('Failed to delete file');
    }
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameId || !renameValue.trim()) return;
    const success = await renameAnnotationFile(renameId, renameValue.trim());
    if (success) {
      setFiles(prev => prev.map(f =>
        f.id === renameId ? { ...f, file_name: renameValue.trim() } : f
      ));
      toast.success('File renamed');
    } else {
      toast.error('Failed to rename file');
    }
    setRenameId(null);
  }, [renameId, renameValue]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" weight="duotone" />
            </button>
            <Logo size="sm" showText />
          </div>
          <Button onClick={() => router.push('/annotate')} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Annotation
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">My Annotations</h1>
            <p className="text-sm text-muted-foreground mt-1">All your annotated PDFs and images</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === 'grid' ? "bg-card shadow-sm" : "hover:bg-card/50"
                )}
              >
                <GridNine className="w-4 h-4" weight="duotone" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === 'list' ? "bg-card shadow-sm" : "hover:bg-card/50"
                )}
              >
                <ListBullets className="w-4 h-4" weight="duotone" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" weight="duotone" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-56 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              : "space-y-2"
          )}>
            {[1, 2, 3, 4, 5, 6].map((i) =>
              viewMode === 'grid' ? (
                <div key={i} className="bg-card rounded-xl border border-border p-3 animate-pulse">
                  <Skeleton className="w-full aspect-[3/4] rounded-lg mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ) : (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              )
            )}
          </div>
        ) : filteredFiles.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="empty-state-card rounded-2xl p-12 text-center max-w-md w-full">
              <div className="icon-container icon-container-lg mx-auto mb-5" style={{ background: 'oklch(0.95 0.04 285)', color: 'oklch(0.45 0.14 285)' }}>
                <HighlighterCircle className="w-6 h-6" weight="duotone" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                {searchQuery ? 'No files found' : 'No annotations yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {searchQuery
                  ? 'Try a different search term.'
                  : 'Upload a PDF or image and start annotating. Your work will be saved automatically.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => router.push('/annotate')} size="lg" className="px-6">
                  <Plus className="w-4 h-4 mr-2" />
                  Start Annotating
                </Button>
              )}
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid view */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredFiles.map((file, index) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="group bg-card border border-border rounded-xl overflow-hidden hover:bg-muted/30 transition-colors cursor-pointer relative"
                onClick={() => router.push(`/annotate?file=${file.id}`)}
              >
                {/* Thumbnail */}
                <div className="w-full aspect-[3/4] bg-muted relative overflow-hidden">
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {file.file_type === 'pdf' ? (
                        <FileText className="w-10 h-10 text-muted-foreground/30" weight="duotone" />
                      ) : (
                        <ImageSquare className="w-10 h-10 text-muted-foreground/30" weight="duotone" />
                      )}
                    </div>
                  )}
                  {/* Type badge */}
                  <span className="absolute top-2 left-2 text-[10px] font-medium uppercase bg-card/90 backdrop-blur-sm text-muted-foreground px-1.5 py-0.5 rounded">
                    {file.file_type}
                  </span>
                </div>

                {/* Info */}
                <div className="p-3">
                  {renameId === file.id ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-[13px] mb-1"
                    />
                  ) : (
                    <h3 className="text-[13px] font-semibold text-foreground truncate pr-6">
                      {file.file_name}
                    </h3>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-muted-foreground/60">
                      {file.page_count} {file.page_count === 1 ? 'page' : 'pages'}
                    </span>
                    <span className="text-[11px] text-muted-foreground/40">·</span>
                    <span className="text-[11px] text-muted-foreground/60">
                      {file.annotation_count || 0} annotations
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/50 mt-1 block">
                    {getFriendlyTimestamp(new Date(file.updated_at))}
                  </span>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-1.5 rounded-md bg-card/90 backdrop-blur-sm hover:bg-muted transition-colors">
                        <DotsThree className="w-4 h-4 text-muted-foreground" weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => {
                        setRenameId(file.id);
                        setRenameValue(file.file_name);
                      }}>
                        <PencilSimple className="w-4 h-4 mr-2" weight="duotone" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(file.id, file.file_storage_path)}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="border border-border rounded-lg bg-card divide-y divide-border">
            {filteredFiles.map((file, index) => (
              <motion.button
                key={file.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                onClick={() => router.push(`/annotate?file=${file.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors first:rounded-t-lg last:rounded-b-lg group"
              >
                {/* Thumbnail */}
                <div className="w-10 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-border/50">
                  {file.thumbnail ? (
                    <img
                      src={file.thumbnail}
                      alt={file.file_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {file.file_type === 'pdf' ? (
                        <FileText className="w-4 h-4 text-muted-foreground/40" weight="duotone" />
                      ) : (
                        <ImageSquare className="w-4 h-4 text-muted-foreground/40" weight="duotone" />
                      )}
                    </div>
                  )}
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  {renameId === file.id ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') setRenameId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 text-[13px]"
                    />
                  ) : (
                    <span className="text-[13px] font-medium text-foreground truncate block">
                      {file.file_name}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground/60">
                    {file.page_count} {file.page_count === 1 ? 'page' : 'pages'} · {file.annotation_count || 0} annotations
                  </span>
                </div>

                {/* Right meta */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground/50 uppercase">
                    {file.file_type}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                    {getFriendlyTimestamp(new Date(file.updated_at))}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-1 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                        <DotsThree className="w-4 h-4 text-muted-foreground" weight="bold" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => {
                        setRenameId(file.id);
                        setRenameValue(file.file_name);
                      }}>
                        <PencilSimple className="w-4 h-4 mr-2" weight="duotone" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(file.id, file.file_storage_path)}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
