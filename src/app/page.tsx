"use client";

import {
  Tldraw,
  useEditor,
  createShapeId,
  AssetRecordType,
  TLShapeId,
  type TLUiOverrides,
} from "tldraw";
import { useCallback, useState, type ReactElement } from "react";
import "tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import {
  Tick01Icon,
  Cancel01Icon,
  Cursor02Icon,
  ThreeFinger05Icon,
  PencilIcon,
  EraserIcon,
  ArrowUpRight01Icon,
  TextIcon,
} from "hugeicons-react";

const hugeIconsOverrides: TLUiOverrides = {
  tools(_editor: unknown, tools: Record<string, any>) {
    const toolIconMap: Record<string, ReactElement> = {
      select: (
        <div>
          <Cursor02Icon size={22} strokeWidth={1.8} />
        </div>
      ),
      hand: (
        <div>
          <ThreeFinger05Icon size={22} strokeWidth={1.8} />
        </div>
      ),
      draw: (
        <div>
          <PencilIcon size={22} strokeWidth={1.8} />
        </div>
      ),
      eraser: (
        <div>
          <EraserIcon size={22} strokeWidth={1.8} />
        </div>
      ),
      arrow: (
        <div>
          <ArrowUpRight01Icon size={22} strokeWidth={1.8} />
        </div>
      ),
      text: (
        <div>
          <TextIcon size={22} strokeWidth={1.8} />
        </div>
      ),
    };

    Object.keys(toolIconMap).forEach((id) => {
      const icon = toolIconMap[id];
      if (!tools[id] || !icon) return;
      tools[id].icon = icon;
    });

    return tools;
  },
};

function GenerateSolutionButton({
  onImageGenerated,
}: {
  onImageGenerated: (shapeId: TLShapeId) => void;
}) {
  const editor = useEditor();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSolution = useCallback(async () => {
    if (!editor || isGenerating) return;

    setIsGenerating(true);

    try {
      // Get the viewport bounds in page space (what you're currently seeing)
      const viewportBounds = editor.getViewportPageBounds();

      // Get all shapes on the current page
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        throw new Error("No shapes on the canvas to export");
      }

      // Export exactly the current viewport as a PNG. We pass both the shapes
      // and explicit bounds so tldraw renders a screenshot of the visible area,
      // not a tight crop around the content. See:
      // https://tldraw.dev/examples/export-canvas-as-image
      const { blob } = await editor.toImage([...shapeIds], {
        format: "png",
        bounds: viewportBounds,
        background: true,
        scale: 1,
        padding: 0, // ensure no extra margin so export matches viewport exactly
      });

      if (!blob) {
        throw new Error("Failed to export viewport to image");
      }

      // Convert blob to base64 data URL for OpenRouter
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // Send to API
      const response = await fetch('/api/generate-solution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate solution');
      }

      const data = await response.json();
      console.log('API Response:', data);

      // Extract the image URL from the response
      const imageUrl = data.imageUrl;

      if (!imageUrl) {
        throw new Error('No image URL found in response');
      }

      // Create an asset for the image
      const assetId = AssetRecordType.createId();
      
      // Get image dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Create the asset
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

      // Create an image shape using the asset:
      // - center the image within the viewport
      // - scale proportionally so it COVERS the viewport
      //   (one dimension matches exactly, the other may exceed slightly)
      const shapeId = createShapeId();
      // Scale so the image FITS inside the viewport (no stretching):
      // one dimension matches the viewport, the other is smaller.
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

      // Notify parent component of the new image
      onImageGenerated(shapeId);
    } catch (error) {
      console.error('Error generating solution:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate solution');
    } finally {
      setIsGenerating(false);
    }
  }, [editor, isGenerating, onImageGenerated]);

  return (
    <Button
      onClick={handleGenerateSolution}
      disabled={isGenerating}
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
      }}
    >
      {isGenerating ? 'Generating...' : 'Generate Solution'}
    </Button>
  );
}

function ImageActionButtons({
  pendingImageIds,
  onAccept,
  onReject,
}: {
  pendingImageIds: TLShapeId[];
  onAccept: (shapeId: TLShapeId) => void;
  onReject: (shapeId: TLShapeId) => void;
}) {
  // Only show buttons when there's a pending image
  if (pendingImageIds.length === 0) return null;

  // For now, we'll just handle the most recent pending image
  const currentImageId = pendingImageIds[pendingImageIds.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
      }}
    >
      <Button
        variant="default"
        onClick={() => onAccept(currentImageId)}
      >
        <Tick01Icon size={20} strokeWidth={2.5} />
        <span className="ml-2">Accept</span>
      </Button>
      <Button
        variant="secondary"
        onClick={() => onReject(currentImageId)}
      >
        <Cancel01Icon size={20} strokeWidth={2.5} />
        <span className="ml-2">Reject</span>
      </Button>
    </div>
  );
}

function HomeContent() {
  const editor = useEditor();
  const [pendingImageIds, setPendingImageIds] = useState<TLShapeId[]>([]);

  const handleImageGenerated = useCallback((shapeId: TLShapeId) => {
    setPendingImageIds((prev) => [...prev, shapeId]);
  }, []);

  const handleAccept = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;
      
      // Unlock the shape and update opacity to 100%
      editor.updateShape({
        id: shapeId,
        type: "image",
        opacity: 1.0,
        isLocked: false,
      });

      // Remove from pending list
      setPendingImageIds((prev) => prev.filter((id) => id !== shapeId));
    },
    [editor]
  );

  const handleReject = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;

      // Unlock the shape first, then delete it
      editor.updateShape({
        id: shapeId,
        type: "image",
        isLocked: false,
      });
      
      editor.deleteShape(shapeId);

      // Remove from pending list
      setPendingImageIds((prev) => prev.filter((id) => id !== shapeId));
    },
    [editor]
  );

  return (
    <>
      <GenerateSolutionButton onImageGenerated={handleImageGenerated} />
      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        onAccept={handleAccept}
        onReject={handleReject}
      />
    </>
  );
}

export default function Home() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        overrides={hugeIconsOverrides}
        components={{
          MenuPanel: null,
          NavigationPanel: null,
        }}
      >
        <HomeContent />
      </Tldraw>
    </div>
  );
}
