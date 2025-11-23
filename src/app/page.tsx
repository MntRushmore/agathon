"use client";

import {
  Tldraw,
  useEditor,
  createShapeId,
  AssetRecordType,
  TLShapeId,
  DefaultColorThemePalette,
  type TLUiOverrides,
} from "tldraw";
import { useCallback, useState, useRef, useEffect, type ReactElement } from "react";
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
  StickyNote01Icon,
  Image01Icon,
  AddSquareIcon,
} from "hugeicons-react";
import { useDebounceActivity } from "@/hooks/useDebounceActivity";
import { StatusIndicator, type StatusIndicatorState } from "@/components/StatusIndicator";
import { logger } from "@/lib/logger";
// import { correctYellowedWhites } from "@/utils/imageProcessing";

// Ensure the tldraw canvas background is pure white in both light and dark modes
DefaultColorThemePalette.lightMode.background = "#FFFFFF";
DefaultColorThemePalette.darkMode.background = "#FFFFFF";

const hugeIconsOverrides: TLUiOverrides = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools(_editor: unknown, tools: Record<string, any>) {
    const toolIconMap: Record<string, ReactElement> = {
      select: (
        <div>
          <Cursor02Icon size={22} strokeWidth={1.5} />
        </div>
      ),
      hand: (
        <div>
          <ThreeFinger05Icon size={22} strokeWidth={1.5} />
        </div>
      ),
      draw: (
        <div>
          <PencilIcon size={22} strokeWidth={1.5} />
        </div>
      ),
      eraser: (
        <div>
          <EraserIcon size={22} strokeWidth={1.5} />
        </div>
      ),
      arrow: (
        <div>
          <ArrowUpRight01Icon size={22} strokeWidth={1.5} />
        </div>
      ),
      text: (
        <div>
          <TextIcon size={22} strokeWidth={1.5} />
        </div>
      ),
      note: (
        <div>
          <StickyNote01Icon size={22} strokeWidth={1.5} />
        </div>
      ),
      asset: (
        <div>
          <Image01Icon size={22} strokeWidth={1.5} />
        </div>
      ),
      rectangle: (
        <div>
          <AddSquareIcon size={22} strokeWidth={1.5} />
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

// Note: The "More" button chevron-up icon override would require
// a custom toolbar component or CSS-based solution since assetUrls
// expects string URLs, not React components.

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
  const [status, setStatus] = useState<StatusIndicatorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCanvasImageRef = useRef<string | null>(null);
  const isUpdatingImageRef = useRef(false); // Flag to prevent triggering during accept/reject

  const handleAutoGeneration = useCallback(async () => {
    if (!editor || isProcessingRef.current) return;

    // Check if canvas has content
    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) {
      return;
    }

    isProcessingRef.current = true;
    
    // Create abort controller for this request chain
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Step 1: Capture viewport (excluding pending generated images)
      const viewportBounds = editor.getViewportPageBounds();
      
      // Filter out pending generated images from the capture
      // so that accepting/rejecting them doesn't change the canvas hash
      const shapesToCapture = [...shapeIds].filter(id => !pendingImageIds.includes(id));
      
      if (shapesToCapture.length === 0) {
        isProcessingRef.current = false;
        return;
      }
      
      const { blob } = await editor.toImage(shapesToCapture, {
        format: "png",
        bounds: viewportBounds,
        background: true,
        scale: 1,
        padding: 0,
      });

      if (!blob || signal.aborted) return;

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      // If the canvas image hasn't changed since the last successful check,
      // don't run the expensive OCR / help-check / generation pipeline again.
      if (lastCanvasImageRef.current === base64) {
        isProcessingRef.current = false;
        setStatus("idle");
        return;
      }
      lastCanvasImageRef.current = base64;

      if (signal.aborted) return;

      // Step 2: Generate solution (Gemini decides if help is needed)
      setStatus("generating");
      const solutionResponse = await fetch('/api/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
        signal,
      });

      if (!solutionResponse.ok || signal.aborted) {
        throw new Error('Solution generation failed');
      }

      const solutionData = await solutionResponse.json();
      const imageUrl = solutionData.imageUrl as string | null | undefined;
      const textContent = solutionData.textContent || '';

      logger.info({ 
        hasImageUrl: !!imageUrl, 
        imageUrlLength: imageUrl?.length,
        imageUrlStart: imageUrl?.slice(0, 50),
        textContent: textContent.slice(0, 100)
      }, 'Solution data received');

      // If the model didn't return an image, it means Gemini decided help isn't needed.
      // Log the reason and gracefully stop.
      if (!imageUrl || signal.aborted) {
        logger.info({ textContent }, 'Gemini decided help is not needed');
        setStatus("idle");
        isProcessingRef.current = false;
        return;
      }

      // Post-process image to fix yellowed whites
      // const processedImageUrl = await correctYellowedWhites(imageUrl);
      // Temporarily skip image post-processing and use the original image URL
      const processedImageUrl = imageUrl;

      if (signal.aborted) return;

      // Create asset and shape
      const assetId = AssetRecordType.createId();
      const img = new Image();
      logger.info('Loading image into asset...');
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          logger.info({ width: img.width, height: img.height }, 'Image loaded successfully');
          resolve(null);
        };
        img.onerror = (e) => {
          logger.error({ error: e }, 'Image load failed');
          reject(new Error('Failed to load generated image'));
        };
        img.src = processedImageUrl;
      });

      if (signal.aborted) return;

      logger.info('Creating asset and shape...');

      // Set flag to prevent these shape additions from triggering activity detection
      isUpdatingImageRef.current = true;

      editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated-solution.png',
            src: processedImageUrl,
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

      setPendingImageIds((prev) => [...prev, shapeId]);
      setStatus("idle");

      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingImageRef.current = false;
      }, 100);
    } catch (error) {
      if (signal.aborted) {
        setStatus("idle");
        return;
      }
      
      logger.error({ error }, 'Auto-generation error');
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
      setStatus("error");
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage("");
      }, 3000);
    } finally {
      isProcessingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [editor, pendingImageIds]);

  // Listen for user activity and trigger auto-generation after 2 seconds of inactivity
  useDebounceActivity(handleAutoGeneration, 2000, editor, isUpdatingImageRef, isProcessingRef);

  // Cancel in-flight requests when user edits the canvas
  useEffect(() => {
    if (!editor) return;

    const handleEditorChange = () => {
      // Ignore if we're just updating accepted/rejected images
      if (isUpdatingImageRef.current) {
        return;
      }

      // Only cancel if there's an active generation in progress
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStatus("idle");
        isProcessingRef.current = false;
      }
    };

    // Listen to editor changes (actual edits)
    const dispose = editor.store.listen(handleEditorChange, {
      source: 'user',
      scope: 'document'
    });

    return () => {
      dispose();
    };
  }, [editor]);

  const handleAccept = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;

      // Set flag to prevent triggering activity detection
      isUpdatingImageRef.current = true;

      // First unlock to ensure we can update opacity
      editor.updateShape({
        id: shapeId,
        type: "image",
        isLocked: false,
        opacity: 1,
      });

      // Then immediately lock it again to make it non-selectable
      editor.updateShape({
        id: shapeId,
        type: "image",
        isLocked: true,
      });

      // Remove this shape from the pending list
      setPendingImageIds((prev) => prev.filter((id) => id !== shapeId));

      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingImageRef.current = false;
      }, 100);
    },
    [editor]
  );

  const handleReject = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;

      // Set flag to prevent triggering activity detection
      isUpdatingImageRef.current = true;

      // Unlock the shape first, then delete it
      editor.updateShape({
        id: shapeId,
        type: "image",
        isLocked: false,
      });
      
      editor.deleteShape(shapeId);

      // Remove from pending list
      setPendingImageIds((prev) => prev.filter((id) => id !== shapeId));

      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingImageRef.current = false;
      }, 100);
    },
    [editor]
  );

  return (
    <>
      <StatusIndicator status={status} errorMessage={errorMessage} />
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
