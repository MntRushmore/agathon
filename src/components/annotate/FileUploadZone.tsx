'use client';

import { useRef, useState, useCallback } from 'react';
import { Upload, FileText, Image } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFileLoaded: (dataUrl: string, fileType: 'pdf' | 'image', totalPages: number, fileName: string) => void;
}

export function FileUploadZone({ onFileLoaded }: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateFile = (file: File): string | null => {
    const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validTypes = [...validImageTypes, 'application/pdf'];

    if (!validTypes.includes(file.type)) {
      return 'Invalid file type. Please upload PNG, JPG, or PDF.';
    }

    const maxSize = file.type === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`;
    }

    return null;
  };

  const processFile = useCallback(async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;

        if (file.type === 'application/pdf') {
          try {
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument(dataUrl).promise;
            onFileLoaded(dataUrl, 'pdf', pdf.numPages, file.name);
          } catch {
            toast.error('Failed to process PDF');
          }
        } else {
          onFileLoaded(dataUrl, 'image', 1, file.name);
        }

        setLoading(false);
      };

      reader.onerror = () => {
        toast.error('Failed to read file');
        setLoading(false);
      };

      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to upload file');
      setLoading(false);
    }
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="flex items-center justify-center w-full h-full p-8">
      <button
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        disabled={loading}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4',
          'w-full max-w-lg h-80 rounded-2xl cursor-pointer',
          'border-2 border-dashed transition-all duration-200',
          dragging
            ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-muted)] scale-[1.02]'
            : 'border-[var(--border)] hover:border-[oklch(0.70_0.06_225)] hover:bg-[oklch(0.96_0.02_225_/_50%)]',
          loading && 'opacity-60 pointer-events-none'
        )}
      >
        {loading ? (
          <>
            <div className="h-8 w-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted-foreground)]">Processing file...</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent-blue-muted)]">
              <Upload className="w-7 h-7 text-[var(--accent-blue)]" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-medium text-[var(--foreground)]">
                Drop a file here, or click to upload
              </p>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                PDF, PNG, or JPG
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <FileText className="w-3.5 h-3.5" />
                <span>PDF up to 10MB</span>
              </div>
              <div className="w-px h-3 bg-[var(--border)]" />
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                <Image className="w-3.5 h-3.5" />
                <span>Images up to 5MB</span>
              </div>
            </div>
          </>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
