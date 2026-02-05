'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Pencil, FileText, Grid3x3, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect: (templateId: string, fileData?: string | string[]) => void;
  creating: boolean;
}

type TemplateId = 'blank' | 'lined' | 'graph' | 'file-upload';

interface Template {
  id: TemplateId;
  icon: React.ElementType;
  title: string;
  description: string;
  colorClass: string;
}

const templates: Template[] = [
  {
    id: 'blank',
    icon: Pencil,
    title: 'Blank Canvas',
    description: 'Start with a clean slate',
    colorClass: 'text-blue-600',
  },
  {
    id: 'lined',
    icon: FileText,
    title: 'Lined Paper',
    description: 'Ruled notebook lines',
    colorClass: 'text-purple-600',
  },
  {
    id: 'graph',
    icon: Grid3x3,
    title: 'Graph Paper',
    description: 'Grid for math and diagrams',
    colorClass: 'text-green-600',
  },
  {
    id: 'file-upload',
    icon: Upload,
    title: 'Upload File',
    description: 'Import PDF or image',
    colorClass: 'text-amber-600',
  },
];

export function TemplateSelectionDialog({
  open,
  onOpenChange,
  onTemplateSelect,
  creating,
}: TemplateSelectionDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTemplateClick = (templateId: TemplateId) => {
    if (creating || uploading) return;

    if (templateId === 'file-upload') {
      // Trigger file input
      fileInputRef.current?.click();
    } else {
      setSelectedTemplate(templateId);
      onTemplateSelect(templateId);
    }
  };

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

  const convertPdfToImages = async (pdfDataUrl: string): Promise<string[]> => {
    // Dynamic import to avoid loading pdfjs unless needed
    const pdfjsLib = await import('pdfjs-dist');

    // Configure worker - use local worker file
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument(pdfDataUrl).promise;
    const images: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/png'));
    }

    return images;
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      e.target.value = ''; // Reset input
      return;
    }

    setUploading(true);
    setSelectedTemplate('file-upload');

    try {
      const reader = new FileReader();

      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;

        if (file.type === 'application/pdf') {
          try {
            console.log('Converting PDF...');
            // Convert all PDF pages to images
            const images = await convertPdfToImages(dataUrl);
            console.log(`PDF converted to ${images.length} images`);
            if (images.length === 0) {
              toast.error('PDF appears to be empty');
              setUploading(false);
              return;
            }
            console.log('Calling onTemplateSelect with images');
            onTemplateSelect('file-upload', images);
          } catch (error) {
            console.error('Error converting PDF:', error);
            toast.error('Failed to process PDF');
            setUploading(false);
          }
        } else {
          // Single image
          console.log('Processing single image');
          onTemplateSelect('file-upload', dataUrl);
        }
      };

      reader.onerror = () => {
        toast.error('Failed to read file');
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
      setUploading(false);
    } finally {
      // Reset file input
      e.target.value = '';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Choose a template</DialogTitle>
            <DialogDescription>
              Start with a blank canvas or import a file
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 mt-4">
            {templates.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;
              const isLoading = (creating && isSelected) || (uploading && template.id === 'file-upload');

              return (
                <button
                  key={template.id}
                  onClick={() => handleTemplateClick(template.id)}
                  disabled={creating || uploading}
                  className={`
                    group relative flex flex-col items-center justify-center
                    h-40 p-4 bg-white border rounded-xl
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isSelected && !isLoading
                      ? 'border-[#1a1a1a] ring-2 ring-[#1a1a1a]/20'
                      : 'border-[#E8E4DC] hover:border-[#1a1a1a] hover:shadow-md'
                    }
                  `}
                >
                  <div className={`mb-3 ${template.colorClass}`}>
                    <Icon className="w-10 h-10" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-semibold text-[#1a1a1a] mb-1">
                    {template.title}
                  </h3>
                  <p className="text-sm text-[#666] text-center">
                    {template.description}
                  </p>

                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                      <div className="h-6 w-6 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </>
  );
}
