import { createClient } from '@/lib/supabase';
import type { AnnotationFile, PageAnnotations } from './types';

const TABLE = 'annotation_files';
const BUCKET = 'annotation-files';

/**
 * Upload the source file to Supabase Storage and return the storage path.
 */
async function uploadFile(
  userId: string,
  fileId: string,
  dataUrl: string,
  fileType: 'pdf' | 'image',
): Promise<string | null> {
  const supabase = createClient();

  // Convert data URL to Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = fileType === 'pdf' ? 'pdf' : 'png';
  const path = `${userId}/${fileId}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type });

  if (error) {
    console.error('Failed to upload file to storage:', error);
    return null;
  }

  return path;
}

/**
 * Download a file from Supabase Storage and return as a data URL.
 */
export async function downloadFile(path: string): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) {
    console.error('Failed to download file:', error);
    return null;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(data);
  });
}

/**
 * Generate a small thumbnail data URL from the file.
 */
async function generateThumbnail(
  dataUrl: string,
  fileType: 'pdf' | 'image',
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    const thumbW = 200;
    const thumbH = 260;
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, thumbW, thumbH);

    if (fileType === 'pdf') {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument(dataUrl).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(thumbW / viewport.width, thumbH / viewport.height);
      const scaledViewport = page.getViewport({ scale });

      const offscreen = document.createElement('canvas');
      offscreen.width = scaledViewport.width;
      offscreen.height = scaledViewport.height;
      const offCtx = offscreen.getContext('2d')!;
      await page.render({ canvasContext: offCtx, viewport: scaledViewport, canvas: offscreen } as any).promise;

      const offsetX = (thumbW - scaledViewport.width) / 2;
      const offsetY = (thumbH - scaledViewport.height) / 2;
      ctx.drawImage(offscreen, offsetX, offsetY);
    } else {
      await new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const scale = Math.min(thumbW / img.width, thumbH / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (thumbW - w) / 2, (thumbH - h) / 2, w, h);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
    }

    return canvas.toDataURL('image/jpeg', 0.6);
  } catch (err) {
    console.error('Failed to generate thumbnail:', err);
    return null;
  }
}

/**
 * Count total annotations across all pages.
 */
function countAnnotations(annotations: PageAnnotations): number {
  return Object.values(annotations).reduce((sum, arr) => sum + (arr?.length || 0), 0);
}

/**
 * Save a new annotation file or update an existing one.
 */
export async function saveAnnotationFile(
  userId: string,
  fileDataUrl: string,
  fileName: string,
  fileType: 'pdf' | 'image',
  pageCount: number,
  annotations: PageAnnotations,
  existingId?: string,
): Promise<AnnotationFile | null> {
  const supabase = createClient();

  const id = existingId || crypto.randomUUID();

  // Upload file to storage (only on first save)
  let storagePath: string | null = null;
  if (!existingId) {
    storagePath = await uploadFile(userId, id, fileDataUrl, fileType);
  }

  // Generate thumbnail
  const thumbnail = await generateThumbnail(fileDataUrl, fileType);
  const annotationCount = countAnnotations(annotations);

  const record = {
    id,
    user_id: userId,
    file_name: fileName,
    file_type: fileType,
    page_count: pageCount,
    annotation_count: annotationCount,
    thumbnail,
    annotations,
    ...(storagePath ? { file_storage_path: storagePath } : {}),
    updated_at: new Date().toISOString(),
    ...(!existingId ? { created_at: new Date().toISOString() } : {}),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(record, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Failed to save annotation file:', error);
    return null;
  }

  return data as AnnotationFile;
}

/**
 * Fetch all annotation files for a user.
 */
export async function fetchAnnotationFiles(userId: string): Promise<AnnotationFile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, user_id, file_name, file_type, page_count, annotation_count, thumbnail, file_storage_path, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch annotation files:', error);
    return [];
  }

  return (data || []) as AnnotationFile[];
}

/**
 * Fetch a single annotation file with full annotations data.
 */
export async function fetchAnnotationFile(id: string): Promise<AnnotationFile | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Failed to fetch annotation file:', error);
    return null;
  }

  return data as AnnotationFile;
}

/**
 * Delete an annotation file and its stored file.
 */
export async function deleteAnnotationFile(id: string, storagePath: string | null): Promise<boolean> {
  const supabase = createClient();

  // Delete from storage
  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
  }

  // Delete from database
  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    console.error('Failed to delete annotation file:', error);
    return false;
  }

  return true;
}

/**
 * Rename an annotation file.
 */
export async function renameAnnotationFile(id: string, newName: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from(TABLE)
    .update({ file_name: newName, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Failed to rename annotation file:', error);
    return false;
  }

  return true;
}
