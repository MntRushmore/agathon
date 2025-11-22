"use client";

import { Tldraw, useEditor, createShapeId, AssetRecordType, getSnapshot, loadSnapshot } from "tldraw";
import { useCallback, useEffect, useState } from "react";
import "tldraw/tldraw.css";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft02Icon, 
  MagicWand02Icon, 
  CheckmarkCircle02Icon,
  Loading03Icon,
  CloudIcon
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function GenerateSolutionButton() {
  const editor = useEditor();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSolution = useCallback(async () => {
    if (!editor || isGenerating) return;

    setIsGenerating(true);

    try {
      const viewportBounds = editor.getViewportPageBounds();
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        toast.error("No shapes on the canvas to export");
        return;
      }

      const { blob } = await editor.toImage([...shapeIds], {
        format: "png",
        bounds: viewportBounds,
        background: true,
        scale: 1,
        padding: 0,
      });

      if (!blob) throw new Error("Failed to export viewport to image");

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const response = await fetch('/api/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate solution');
      }

      const data = await response.json();
      const imageUrl = data.imageUrl;

      if (!imageUrl) throw new Error('No image URL found in response');

      const assetId = AssetRecordType.createId();
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated-solution.png',
            src: imageUrl,
            w: img.width,
            h: img.height,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {},
        },
      ]);

      const shapeId = createShapeId();
      const scale = Math.min(
        viewportBounds.width / img.width,
        viewportBounds.height / img.height
      );
      const shapeWidth = img.width * scale;
      const shapeHeight = img.height * scale;

      editor.createShape({
        id: shapeId,
        type: "image",
        x: viewportBounds.x + (viewportBounds.width - shapeWidth) / 2,
        y: viewportBounds.y + (viewportBounds.height - shapeHeight) / 2,
        opacity: 0.3,
        isLocked: true,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          assetId: assetId,
        },
      });
      toast.success("Solution generated!");
    } catch (error) {
      console.error('Error generating solution:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate solution');
    } finally {
      setIsGenerating(false);
    }
  }, [editor, isGenerating]);

  return (
    <Button
      onClick={handleGenerateSolution}
      disabled={isGenerating}
      className="absolute top-[80px] right-4 z-[2000] shadow-lg shadow-indigo-500/20 bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 border-0"
    >
      {isGenerating ? (
        <Loading03Icon className="animate-spin w-4 h-4 mr-2" />
      ) : (
        <MagicWand02Icon className="w-4 h-4 mr-2" />
      )}
      {isGenerating ? 'Solving...' : 'Solve with AI'}
    </Button>
  );
}

function TopBar({ id, initialTitle }: { id: string, initialTitle: string }) {
  const editor = useEditor();
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const router = useRouter();
  
  // Debounce title updates
  const debouncedTitle = useDebounce(title, 1000);
  
  // Track if we need to save canvas content
  const [needsSave, setNeedsSave] = useState(false);

  const saveBoard = useCallback(async (currentTitle: string) => {
    if (!editor) return;
    setSaving(true);
    try {
      // Use the standalone getSnapshot function instead of editor.store.getSnapshot()
      const snapshot = getSnapshot(editor.store);
      
      // Generate a thumbnail
      let previewUrl = null;
      try {
          const shapeIds = editor.getCurrentPageShapeIds();
          if (shapeIds.size > 0) {
             // Export a small preview
             const viewportBounds = editor.getViewportPageBounds();
             const { blob } = await editor.toImage([...shapeIds], {
                format: "png",
                bounds: viewportBounds,
                background: false,
                scale: 0.5, // 50% scale for thumbnail
             });
             
             if (blob) {
                previewUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
             }
          }
      } catch (e) {
          console.error("Thumbnail generation failed", e);
      }

      const updateData: any = { 
        title: currentTitle, 
        data: snapshot,
        updated_at: new Date().toISOString()
      };

      if (previewUrl) {
          updateData.preview = previewUrl;
      }

      const { error } = await supabase
        .from('whiteboards')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      setLastSaved(new Date());
      setNeedsSave(false);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error("Failed to auto-save");
    } finally {
      setSaving(false);
    }
  }, [editor, id]);

  // Auto-save on canvas changes
  useEffect(() => {
    if (!editor) return;
    const unsubscribe = editor.store.listen(() => {
      setNeedsSave(true);
    });
    return () => unsubscribe();
  }, [editor]);

  // Debounced auto-save effect
  useEffect(() => {
    if (needsSave) {
      const timer = setTimeout(() => {
        saveBoard(title);
      }, 2000); // Save 2 seconds after last change
      return () => clearTimeout(timer);
    }
  }, [needsSave, title, saveBoard]);

  // Save on title change (debounced)
  useEffect(() => {
    if (debouncedTitle !== initialTitle) {
      saveBoard(debouncedTitle);
    }
  }, [debouncedTitle, initialTitle, saveBoard]);

  return (
    <div className="absolute top-0 left-0 right-0 z-[2000] h-16 px-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200/50 pointer-events-auto">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push('/dashboard')}
          className="text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft02Icon className="w-5 h-5" />
        </Button>
        
        <div className="h-6 w-px bg-gray-200 mx-1" />

        <div className="flex flex-col justify-center">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 bg-transparent border-none text-sm font-semibold text-gray-900 px-1 -ml-1 w-64 shadow-none focus-visible:ring-0 focus-visible:bg-gray-100/50 rounded-sm"
            placeholder="Untitled Board"
          />
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium px-1 h-4">
            {saving ? (
               <span className="flex items-center gap-1 text-blue-500">
                 <Loading03Icon className="w-3 h-3 animate-spin" />
                 Saving...
               </span>
            ) : lastSaved ? (
               <span className="flex items-center gap-1 text-green-600">
                 <CloudIcon className="w-3 h-3" />
                 Saved {lastSaved.toLocaleTimeString()}
               </span>
            ) : (
               <span className="flex items-center gap-1">
                 <CheckmarkCircle02Icon className="w-3 h-3" />
                 Ready
               </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);
  const [title, setTitle] = useState("Untitled");

  useEffect(() => {
    async function loadBoard() {
      try {
        const { data, error } = await supabase
          .from('whiteboards')
          .select('title, data')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
           setTitle(data.title);
           if (data.data && Object.keys(data.data).length > 0) {
             setInitialData(data.data);
           }
        }
      } catch (e) {
        console.error("Error loading board:", e);
        toast.error("Failed to load board");
      } finally {
        setLoading(false);
      }
    }
    loadBoard();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loading03Icon className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium animate-pulse">Loading your canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#F9FAFB]">
      <Tldraw 
        onMount={(editor) => {
            if (initialData) {
                try {
                    loadSnapshot(editor.store, initialData);
                } catch (e) {
                    console.error("Failed to load snapshot:", e);
                    toast.error("Failed to restore canvas state");
                }
            }
        }}
      >
        <TopBar id={id} initialTitle={title} />
        <GenerateSolutionButton />
      </Tldraw>
    </div>
  );
}
