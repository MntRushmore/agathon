"use client";

import { Tldraw, useEditor, createShapeId, AssetRecordType, getSvgAsImage } from "tldraw";
import { useCallback, useState } from "react";
import "tldraw/tldraw.css";

function GenerateSolutionButton() {
  const editor = useEditor();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSolution = useCallback(async () => {
    if (!editor || isGenerating) return;

    setIsGenerating(true);

    try {
      // Get all shapes on the current page
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      
      // First, export to SVG
      const svg = await editor.getSvgString(shapeIds, {
        background: true,
        padding: 0,
        darkMode: false,
      });
      
      if (!svg) {
        throw new Error('Failed to generate SVG');
      }
      
      // Get the viewport size for proper dimensions
      const viewportBounds = editor.getViewportPageBounds();
      
      // Convert SVG to PNG blob
      const blob = await getSvgAsImage(svg.svg, {
        type: 'png',
        width: Math.round(viewportBounds.width),
        height: Math.round(viewportBounds.height),
        quality: 1,
      });
      
      if (!blob) {
        throw new Error('Failed to convert SVG to PNG');
      }

      // Convert blob to base64
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

      // Create an image shape using the asset
      const shapeId = createShapeId();
      const center = {
        x: viewportBounds.x + viewportBounds.width / 2,
        y: viewportBounds.y + viewportBounds.height / 2,
      };
      const shapeWidth = Math.min(img.width, 500);
      const shapeHeight = (img.height / img.width) * shapeWidth;

      editor.createShape({
        id: shapeId,
        type: 'image',
        x: center.x - shapeWidth / 2,
        y: center.y - shapeHeight / 2,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          assetId: assetId,
        },
      });

      // Select the new shape
      editor.select(shapeId);
    } catch (error) {
      console.error('Error generating solution:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate solution');
    } finally {
      setIsGenerating(false);
    }
  }, [editor, isGenerating]);

  return (
    <button
      onClick={handleGenerateSolution}
      disabled={isGenerating}
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        padding: '10px 20px',
        backgroundColor: isGenerating ? '#ccc' : '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: isGenerating ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {isGenerating ? 'Generating...' : 'Generate Solution'}
    </button>
  );
}

export default function Home() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw>
        <GenerateSolutionButton />
      </Tldraw>
    </div>
  );
}
