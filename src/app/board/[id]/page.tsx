"use client";

import {
  Tldraw,
  useEditor,
  createShapeId,
  AssetRecordType,
  TLShapeId,
  DefaultColorThemePalette,
  type TLUiOverrides,
  getSnapshot,
  loadSnapshot,
} from "tldraw";
import React, { useCallback, useState, useRef, useEffect, useMemo, type ReactElement } from "react";
import "tldraw/tldraw.css";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Tick01Icon,
  Cancel01Icon,
  Cursor02Icon,
  ThreeFinger05Icon,
  PencilIcon,
  EraserIcon,
  ArrowUpRight01Icon,
  ArrowLeft01Icon,
  TextIcon,
  StickyNote01Icon,
  Image01Icon,
  AddSquareIcon,
  Mic02Icon,
  MicOff02Icon,
  Loading03Icon,
} from "hugeicons-react";
import { useDebounceActivity } from "@/hooks/useDebounceActivity";
import { StatusIndicator, type StatusIndicatorState } from "@/components/StatusIndicator";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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

function VoiceAgentControls({ onSessionChange }: { onSessionChange: (active: boolean) => void }) {
  const editor = useEditor();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState("Idle");

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const handleServerEventRef = useRef<((event: any) => void) | null>(null);

  // Memoize tools to prevent unnecessary re-renders
  const tools = useMemo(() => [
    {
      type: "function",
      name: "solve_canvas",
      description:
        "Generate a solution image for the current whiteboard canvas and overlay it on the board.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "Instructions for how to solve or modify the content on the canvas, e.g. 'solve the equation and write the steps'.",
          },
        },
        required: ["prompt"],
      },
    },
  ], []);

  const exportCanvasImage = useCallback(async (): Promise<string | null> => {
    if (!editor) return null;

    const viewportBounds = editor.getViewportPageBounds();
    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) {
      return null;
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

    return base64;
  }, [editor]);

  const pendingToolArgs = useRef<Record<string, string>>({});

  const sendToolOutput = useCallback(
    (callId: string, payload: any) => {
      console.log("[Voice Agent] Sending tool output for call:", callId, payload);
      
      if (!dataChannel.current || dataChannel.current.readyState !== "open") {
        console.error("[Voice Agent] Data channel not available or not open");
        return;
      }

      const toolResponse = {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(payload),
        },
      };

      console.log("[Voice Agent] Sending conversation.item.create for tool output:", toolResponse);
      dataChannel.current.send(JSON.stringify(toolResponse));

      const responseCreate = { type: "response.create" };
      console.log("[Voice Agent] Sending response.create after tool output:", responseCreate);
      dataChannel.current.send(JSON.stringify(responseCreate));
      console.log("[Voice Agent] Tool output and response.create sent successfully");
    },
    []
  );

  const handleToolCall = useCallback(
    async (event: any) => {
      const { call_id, name } = event;
      const argsString: string = event.arguments ?? "";

      console.log("[Voice Agent] handleToolCall called:", { call_id, name, argsString });

      if (name !== "solve_canvas") {
        console.log("[Voice Agent] Ignoring non-solve_canvas tool:", name);
        return;
      }

      if (!editor) {
        console.error("[Voice Agent] Editor not ready");
        sendToolOutput(call_id, {
          status: "error",
          message: "Canvas editor is not ready.",
        });
        return;
      }

      console.log("[Voice Agent] Starting canvas solve...");

      let prompt =
        "Modify the image to include the solution in handwriting with clear steps.";

      try {
        if (argsString) {
          const args = JSON.parse(argsString);
          if (typeof args.prompt === "string" && args.prompt.trim().length > 0) {
            prompt = `${args.prompt}. Modify the image to include the solution in handwriting.`;
          }
        }
      } catch (e) {
        console.error("Failed to parse tool arguments:", e);
      }

      try {
        setStatus("Solving canvas with AI...");

        const base64 = await exportCanvasImage();

        if (!base64) {
          setStatus("No content on canvas");
          sendToolOutput(call_id, {
            status: "error",
            message: "There are no shapes on the canvas to analyze.",
          });
          return;
        }

        const response = await fetch("/api/generate-solution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, prompt }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Tool call failed with error:", error);
          const errorMessage = error.details || error.error || "Failed to generate solution";
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const imageUrl = data.imageUrl;

        if (!imageUrl) {
          throw new Error("No image URL found in response");
        }

        const viewportBounds = editor.getViewportPageBounds();
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
            type: "image",
            typeName: "asset",
            props: {
              name: "generated-solution.png",
              src: imageUrl,
              w: img.width,
              h: img.height,
              mimeType: "image/png",
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
          opacity: 1.0,
          isLocked: true,
          props: {
            w: shapeWidth,
            h: shapeHeight,
            assetId: assetId,
          },
        });

        setStatus("Solution added to canvas");

        console.log("[Voice Agent] Solution successfully added, sending success response");
        sendToolOutput(call_id, {
          status: "ok",
          imageUrl,
          message: "Solution image has been added to the canvas.",
        });
      } catch (error) {
        console.error("[Voice Agent] Error generating solution via tool:", error);
        setStatus("Error solving canvas");
        sendToolOutput(call_id, {
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to generate solution",
        });
      }
    },
    [editor, exportCanvasImage, sendToolOutput]
  );

  const handleServerEvent = useCallback(
    (event: any) => {
      if (!event || typeof event.type !== "string") return;

      // Log all events for debugging
      console.log("[Voice Agent] Received event:", event.type, event);

      if (event.type === "response.function_call_arguments.delta") {
        const callId = event.call_id as string;
        const chunk = event.arguments as string;
        if (!callId || typeof chunk !== "string") return;
        pendingToolArgs.current[callId] =
          (pendingToolArgs.current[callId] || "") + chunk;
        console.log("[Voice Agent] Accumulating args for call:", callId);
      } else if (event.type === "response.function_call_arguments.done") {
        const callId = event.call_id as string;
        const fullArgs =
          pendingToolArgs.current[callId] ??
          (typeof event.arguments === "string" ? event.arguments : "");
        delete pendingToolArgs.current[callId];
        console.log("[Voice Agent] Tool call done, executing:", callId, fullArgs);
        handleToolCall({ ...event, arguments: fullArgs });
      } else if (event.type === "error") {
        // Log full error payload for debugging
        try {
          console.error(
            "Realtime error event:",
            event,
            "stringified:",
            JSON.stringify(event)
          );
        } catch {
          console.error("Realtime error (non-serializable event):", event);
        }
        setStatus("Realtime error");
      } else if (event.type === "response.audio.delta") {
         // Do nothing, just receiving audio
      } else if (
        event.type === "response.output_text.delta" ||
        event.type === "response.text.delta"
      ) {
        // Text streaming (GA name: response.output_text.delta) – currently unused
      } else {
        console.log("[Voice Agent] Unhandled event type:", event.type, event);
      }
    },
    [handleToolCall]
  );

  // Update ref whenever handleServerEvent changes
  useEffect(() => {
    handleServerEventRef.current = handleServerEvent;
  }, [handleServerEvent]);

  const stopSession = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    setIsSessionActive(false);
    setStatus("Idle");
    onSessionChange(false);
  }, [onSessionChange]);

  const startSession = useCallback(async () => {
    try {
      setStatus("Requesting token...");

      const tokenResponse = await fetch("/api/voice/token");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get realtime token");
      }
      const data = await tokenResponse.json();
      // Support both GA client_secrets shape ({ value }) and legacy ({ client_secret: { value } })
      const ephemeralKey =
        data?.client_secret?.value ??
        data?.value ??
        null;

      if (!ephemeralKey) {
        console.error("[Voice Agent] No ephemeral key in /api/voice/token response:", data);
        throw new Error("No ephemeral key returned from server");
      }

      setStatus("Initializing WebRTC...");

      const pc = new RTCPeerConnection();
      peerConnection.current = pc;

      // Play remote audio from the model
      audioEl.current = document.createElement("audio");
      audioEl.current.autoplay = true;
      audioEl.current.playsInline = true;
      audioEl.current.muted = false;
      // Attach to DOM so browser audio policies are satisfied
      try {
        document.body.appendChild(audioEl.current);
      } catch {
        // In non-browser environments this may fail; ignore
      }
      pc.ontrack = (e) => {
        if (audioEl.current) {
          audioEl.current.srcObject = e.streams[0];
          console.log("[Voice Agent] Received remote audio track, starting playback");
          audioEl.current
            .play()
            .then(() => {
              console.log("[Voice Agent] Audio playback started");
            })
            .catch((err) => {
              console.error("[Voice Agent] Failed to start audio playback:", err);
            });
        }
      };

      // Add local microphone
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      pc.addTrack(ms.getTracks()[0]);

      // Data channel for events
      const dc = pc.createDataChannel("oai-events");
      dataChannel.current = dc;

      dc.addEventListener("open", () => {
        setStatus("Connected");
        const sessionUpdate = {
          type: "session.update",
          session: {
            instructions:
              "You are an AI tutor helping the user work on a whiteboard. " +
              "You have a tool called solve_canvas which captures an image of the current canvas and lets you modify it. " +
              "Whenever the user asks you to solve, add, erase, annotate, rearrange, or otherwise change anything on the board, " +
              "you MUST call the solve_canvas tool. Each separate request to modify the board requires its own solve_canvas tool call. " +
              "Never say that you have changed the board unless you have successfully called the solve_canvas tool.",
            tools,
            // Force solve_canvas usage while debugging tool plumbing
            tool_choice: {
              type: "function",
              name: "solve_canvas",
            },
          },
        };
        dc.send(JSON.stringify(sessionUpdate));

        // Trigger an initial response to confirm audio is working
        const initialMessage = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Say hello!",
              },
            ],
          },
        };
        dc.send(JSON.stringify(initialMessage));
        dc.send(JSON.stringify({ type: "response.create" }));
      });

      dc.addEventListener("message", (e) => {
        try {
          const event = JSON.parse(e.data);
          // Use ref to always call the current version
          handleServerEventRef.current?.(event);
        } catch (e) {
          console.error("Failed to parse realtime event:", e);
        }
      });

      dc.addEventListener("close", () => {
        console.warn("[Voice Agent] Data channel closed");
        setStatus("Idle");
        setIsSessionActive(false);
        onSessionChange(false);
      });

      dc.addEventListener("error", (e) => {
        console.error("[Voice Agent] Data channel error:", e);
        setStatus("Realtime error");
      });

      // Create offer and exchange SDP with OpenAI Realtime API
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // WebRTC SDP handshake with OpenAI Realtime API
      // The model is already defined in the ephemeral token's session config
      const baseUrl = "https://api.openai.com/v1/realtime";
      const sdpResponse = await fetch(baseUrl, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
          // Required for Realtime API
          "OpenAI-Beta": "realtime=v1",
        },
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        console.error(`SDP error [${sdpResponse.status}]:`, text);
        throw new Error(`Failed to handshake with OpenAI (Status: ${sdpResponse.status})`);
      }

      const answerSdp = await sdpResponse.text();
      const answer = {
        type: "answer" as RTCSdpType,
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log("[Voice Agent] Peer connection state:", state);
        if (state === "failed" || state === "disconnected" || state === "closed") {
          setStatus("Realtime error");
          setIsSessionActive(false);
          onSessionChange(false);
        }
      };

      setIsSessionActive(true);
      setStatus("Listening");
      onSessionChange(true);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setStatus("Permission denied");
        console.error("Microphone permission denied");
      } else {
        setStatus("Error starting session");
      }
      stopSession();
    }
  }, [handleServerEvent, stopSession, tools, onSessionChange]);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const handleClick = () => {
    if (isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  const statusMessages: Record<string, string> = {
    "Requesting token...": "Connecting to voice...",
    "Initializing WebRTC...": "Initializing voice...",
    "Connected": "Voice connected",
    "Listening": "Listening...",
    "Solving canvas with AI...": "Solving canvas...",
    "Solution added to canvas": "Solution added",
    "No content on canvas": "No content on canvas",
    "Error solving canvas": "Error solving canvas",
    "Permission denied": "Microphone permission denied",
    "Error starting session": "Error starting session",
    "Realtime error": "Voice error",
  };

  const showStatus = status !== "Idle" && statusMessages[status];
  const isError = status.includes("Error") || status.includes("Permission denied") || status.includes("error");

  return (
    <>
      {/* Status indicator at top center */}
      {showStatus && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          {!isError && status !== "Solution added to canvas" && (
            <Loading03Icon 
              size={16} 
              strokeWidth={2} 
              className="animate-spin text-blue-600"
            />
          )}
          <span className={`text-sm font-medium ${isError ? "text-red-600" : "text-gray-700"}`}>
            {statusMessages[status]}
          </span>
        </div>
      )}

      {/* Voice button at center bottom */}
      <div 
        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[2000] pointer-events-auto"
      >
        <Button
          onClick={handleClick}
          variant={"outline"}
          className="rounded-full shadow-md bg-white hover:bg-gray-50"
          size="lg"
        >
          {isSessionActive ? (
            <>
              <MicOff02Icon size={20} strokeWidth={2} />
              <span className="ml-2 font-medium">Stop Voice</span>
            </>
          ) : (
            <>
              <Mic02Icon size={20} strokeWidth={2} />
              <span className="ml-2 font-medium">Voice Mode</span>
            </>
          )}
        </Button>
      </div>
    </>
  );
}

function BoardContent({ id }: { id: string }) {
  const editor = useEditor();
  const router = useRouter();
  const [pendingImageIds, setPendingImageIds] = useState<TLShapeId[]>([]);
  const [status, setStatus] = useState<StatusIndicatorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [assistanceMode, setAssistanceMode] = useState<"off" | "feedback" | "suggest" | "answer">("suggest");
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCanvasImageRef = useRef<string | null>(null);
  const isUpdatingImageRef = useRef(false);

  // Helper function to get mode-aware status messages
  const getStatusMessage = useCallback((mode: "off" | "feedback" | "suggest" | "answer", statusType: "generating" | "success") => {
    if (statusType === "generating") {
      switch (mode) {
        case "off":
          return "";
        case "feedback":
          return "Adding feedback...";
        case "suggest":
          return "Generating suggestion...";
        case "answer":
          return "Solving problem...";
      }
    } else if (statusType === "success") {
      switch (mode) {
        case "off":
          return "";
        case "feedback":
          return "Feedback added";
        case "suggest":
          return "Suggestion added";
        case "answer":
          return "Solution added";
      }
    }
    return "";
  }, []);

  const handleAutoGeneration = useCallback(async () => {
    if (!editor || isProcessingRef.current || isVoiceSessionActive || assistanceMode === "off") return;

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
        setStatusMessage("");
        return;
      }
      lastCanvasImageRef.current = base64;

      if (signal.aborted) return;

      // Step 2: Generate solution (Gemini decides if help is needed)
      setStatus("generating");
      setStatusMessage(getStatusMessage(assistanceMode, "generating"));
      const solutionResponse = await fetch('/api/generate-solution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mode: assistanceMode }),
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
        setStatusMessage("");
        isProcessingRef.current = false;
        return;
      }

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

      // In "feedback" mode, show at full opacity without accept/reject
      // In "suggest" and "answer" modes, show at reduced opacity with accept/reject
      const isFeedbackMode = assistanceMode === "feedback";
      
      editor.createShape({
        id: shapeId,
        type: "image",
        x: viewportBounds.x + (viewportBounds.width - shapeWidth) / 2,
        y: viewportBounds.y + (viewportBounds.height - shapeHeight) / 2,
        opacity: isFeedbackMode ? 1.0 : 0.3,
        isLocked: true,
        props: {
          w: shapeWidth,
          h: shapeHeight,
          assetId: assetId,
        },
      });

      // Only add to pending list if not in feedback mode
      if (!isFeedbackMode) {
        setPendingImageIds((prev) => [...prev, shapeId]);
      }
      
      // Show success message briefly, then return to idle
      setStatus("success");
      setStatusMessage(getStatusMessage(assistanceMode, "success"));
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 2000);

      // Reset flag after a brief delay
      setTimeout(() => {
        isUpdatingImageRef.current = false;
      }, 100);
    } catch (error) {
      if (signal.aborted) {
        setStatus("idle");
        setStatusMessage("");
        return;
      }
      
      logger.error({ error }, 'Auto-generation error');
      setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
      setStatus("error");
      setStatusMessage("");
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setStatus("idle");
        setErrorMessage("");
      }, 3000);
    } finally {
      isProcessingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [editor, pendingImageIds, isVoiceSessionActive, assistanceMode, getStatusMessage]);

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
        setStatusMessage("");
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

  // Auto-save logic
  useEffect(() => {
    if (!editor) return;

    let saveTimeout: NodeJS.Timeout;

    const handleChange = () => {
      // Don't save during image updates
      if (isUpdatingImageRef.current) return;

      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        // If we're offline, skip auto-save to avoid noisy errors
        if (typeof window !== "undefined" && window.navigator && !window.navigator.onLine) {
          logger.warn({ id }, "Skipping auto-save while offline");
          return;
        }

        try {
          const snapshot = getSnapshot(editor.store);
          
          // Generate a thumbnail
          let previewUrl = null;
          try {
            const shapeIds = editor.getCurrentPageShapeIds();
            if (shapeIds.size > 0) {
              const viewportBounds = editor.getViewportPageBounds();
              const { blob } = await editor.toImage([...shapeIds], {
                format: "png",
                bounds: viewportBounds,
                background: false,
                scale: 0.5,
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
            logger.warn(
              {
                error:
                  e instanceof Error
                    ? { message: e.message, name: e.name, stack: e.stack }
                    : e,
                id,
              },
              "Thumbnail generation failed, continuing without preview"
            );
          }

          const updateData: any = { 
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
        } catch (error) {
          logger.error(
            {
              error:
                error instanceof Error
                  ? { message: error.message, name: error.name, stack: error.stack }
                  : error,
              id,
            },
            "Error auto-saving board"
          );
        }
      }, 2000);
    };

    const dispose = editor.store.listen(handleChange, {
      source: 'user',
      scope: 'document'
    });

    return () => {
      clearTimeout(saveTimeout);
      dispose();
    };
  }, [editor, id]);

  return (
    <>
      {/* Tabs at top left */}
      {!isVoiceSessionActive && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft01Icon size={20} strokeWidth={2} />
          </Button>
          <Tabs 
            value={assistanceMode} 
            onValueChange={(value) => setAssistanceMode(value as "off" | "feedback" | "suggest" | "answer")}
            className="w-auto shadow-sm rounded-lg"
          >
            <TabsList>
              <TabsTrigger value="off">Off</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="suggest">Suggest</TabsTrigger>
              <TabsTrigger value="answer">Answer</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <StatusIndicator status={status} errorMessage={errorMessage} customMessage={statusMessage} />
      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        onAccept={handleAccept}
        onReject={handleReject}
      />
      <VoiceAgentControls onSessionChange={setIsVoiceSessionActive} />
    </>
  );
}

export default function BoardPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    async function loadBoard() {
      try {
        const { data, error } = await supabase
          .from('whiteboards')
          .select('data')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500 font-medium animate-pulse">Loading your canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        overrides={hugeIconsOverrides}
        components={{
          MenuPanel: null,
          NavigationPanel: null,
        }}
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
        <BoardContent id={id} />
      </Tldraw>
    </div>
  );
}
