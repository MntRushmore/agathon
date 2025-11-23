"use client";

import {
  Tldraw,
  useEditor,
  createShapeId,
  AssetRecordType,
  TLShapeId,
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
  const lastCheckTimeRef = useRef<number>(0);

  const handleAutoGeneration = useCallback(async () => {
    if (!editor || isProcessingRef.current) return;

    // Rate limiting: max 1 check per minute
    const now = Date.now();
    if (now - lastCheckTimeRef.current < 60000) {
      return;
    }

    // Check if canvas has content
    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) {
      return;
    }

    isProcessingRef.current = true;
    lastCheckTimeRef.current = now;
    
    // Create abort controller for this request chain
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      // Step 1: Capture viewport
      const viewportBounds = editor.getViewportPageBounds();
      const { blob } = await editor.toImage([...shapeIds], {
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

      if (signal.aborted) return;

      // Step 2: OCR - Extract handwriting
      setStatus("analyzing");
      const ocrResponse = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
        signal,
      });

      if (!ocrResponse.ok || signal.aborted) {
        throw new Error('OCR failed');
      }

      const ocrData = await ocrResponse.json();
      const extractedText = ocrData.text || '';

      if (signal.aborted) return;

      // Step 3: Check if help is needed
      setStatus("checking");
      const checkResponse = await fetch('/api/check-help-needed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText, image: base64 }),
        signal,
      });

      if (!checkResponse.ok || signal.aborted) {
        throw new Error('Help check failed');
      }

      const checkData = await checkResponse.json();

      if (signal.aborted) return;

      // If help is not needed, stop here
      if (!checkData.needsHelp) {
        console.log('Help not needed:', checkData.reason);
        setStatus("idle");
        isProcessingRef.current = false;
        return;
      }

      // Step 4: Generate solution
      setStatus("generating");
      const solutionResponse = await fetch('/api/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, ocrText: extractedText }),
        signal,
      });

      if (!solutionResponse.ok || signal.aborted) {
        throw new Error('Solution generation failed');
      }

      const solutionData = await solutionResponse.json();
      const imageUrl = solutionData.imageUrl;

      if (!imageUrl || signal.aborted) {
        throw new Error('No image URL in response');
      }

      // Create asset and shape
      const assetId = AssetRecordType.createId();
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      if (signal.aborted) return;

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

      setPendingImageIds((prev) => [...prev, shapeId]);
      setStatus("idle");
    } catch (error) {
      if (signal.aborted) {
        setStatus("idle");
        return;
      }
      
      console.error('Auto-generation error:', error);
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
  }, [editor]);

  // Listen for user activity and trigger auto-generation after 3 seconds of inactivity
  useDebounceActivity(handleAutoGeneration, 3000);

  // Cancel in-flight requests when user starts drawing again
  const handleUserActivity = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus("idle");
      isProcessingRef.current = false;
    }
  }, []);

  // Cancel in-flight requests on general user activity
  useEffect(() => {
    const cancelOnActivity = () => {
      handleUserActivity();
    };

    window.addEventListener("pointerdown", cancelOnActivity);
    window.addEventListener("pointermove", cancelOnActivity);
    window.addEventListener("keydown", cancelOnActivity);
    window.addEventListener("wheel", cancelOnActivity);

    return () => {
      window.removeEventListener("pointerdown", cancelOnActivity);
      window.removeEventListener("pointermove", cancelOnActivity);
      window.removeEventListener("keydown", cancelOnActivity);
      window.removeEventListener("wheel", cancelOnActivity);
    };
  }, [handleUserActivity]);

  const handleAccept = useCallback(
    (shapeId: TLShapeId) => {
      if (!editor) return;
      
      // Keep the shape locked but update opacity to 100%
      editor.updateShape({
        id: shapeId,
        type: "image",
        opacity: 1.0,
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
