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
import React, { useCallback, useState, useRef, useEffect, type ReactElement } from "react";
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
import { Loader2, Volume2, VolumeX } from "lucide-react";
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

type VoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "callingTool"
  | "error";

interface VoiceAgentControlsProps {
  onSessionChange: (active: boolean) => void;
  onSolveWithPrompt: (
    mode: "feedback" | "suggest" | "answer",
    instructions?: string
  ) => Promise<void>;
}

function VoiceAgentControls({
  onSessionChange,
  onSolveWithPrompt,
}: VoiceAgentControlsProps) {
  const editor = useEditor();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const statusMessages: Record<Exclude<VoiceStatus, "idle">, string> = {
    connecting: "Connecting voice assistant...",
    listening: "Listening...",
    thinking: "Thinking...",
    callingTool: "Working on your canvas...",
    error: "Voice error",
  };

  const setErrorStatus = useCallback((message: string) => {
    setStatus("error");
    setStatusDetail(message);
    console.error("[Voice Agent]", message);
  }, []);

  const cleanupSession = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();

    dcRef.current = null;
    pcRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
  }, []);

  const stopSession = useCallback(() => {
    cleanupSession();
    setIsSessionActive(false);
    setStatus("idle");
    setStatusDetail(null);
    setIsMuted(false);
    onSessionChange(false);
  }, [cleanupSession, onSessionChange]);

  const captureCanvasImage = useCallback(async (): Promise<string | null> => {
    if (!editor) return null;

    const shapeIds = editor.getCurrentPageShapeIds();
    if (shapeIds.size === 0) return null;

    const viewportBounds = editor.getViewportPageBounds();
    const { blob } = await editor.toImage([...shapeIds], {
      format: "png",
      bounds: viewportBounds,
      background: true,
      scale: 1,
      padding: 0,
    });

    if (!blob) return null;

    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }, [editor]);

  const handleFunctionCall = useCallback(
    async (name: string, argsJson: string, callId: string) => {
      const dc = dcRef.current;
      if (!dc) return;

      let args: any = {};
      try {
        args = argsJson ? JSON.parse(argsJson) : {};
      } catch (e) {
        setErrorStatus(`Failed to parse tool arguments for ${name}`);
        return;
      }

      try {
        if (name === "analyze_workspace") {
          setStatus("callingTool");
          setStatusDetail("Analyzing your canvas...");

          const image = await captureCanvasImage();
          if (!image) {
            throw new Error("Canvas is empty or could not be captured");
          }

          const res = await fetch("/api/voice/analyze-workspace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image,
              focus: args.focus ?? null,
            }),
          });

          if (!res.ok) {
            throw new Error("Workspace analysis request failed");
          }

          const data = await res.json();
          const analysis = data.analysis ?? "";

          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  analysis,
                }),
              },
            }),
          );

          dc.send(
            JSON.stringify({
              type: "response.create",
            }),
          );

          setStatus("thinking");
          setStatusDetail(null);
        } else if (name === "draw_on_canvas") {
          setStatus("callingTool");
          setStatusDetail("Updating your canvas...");

          const mode =
            args.mode === "feedback" ||
            args.mode === "suggest" ||
            args.mode === "answer"
              ? args.mode
              : "suggest";

          await onSolveWithPrompt(mode, args.instructions ?? undefined);

          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success: true,
                  mode,
                }),
              },
            }),
          );

          dc.send(
            JSON.stringify({
              type: "response.create",
            }),
          );

          setStatus("thinking");
          setStatusDetail(null);
        }
      } catch (error) {
        console.error("[Voice Agent] Tool error", error);

        dc.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify({
                error:
                  error instanceof Error ? error.message : "Tool execution failed",
              }),
            },
          }),
        );

        dc.send(
          JSON.stringify({
            type: "response.create",
          }),
        );

        setErrorStatus(
          `Tool ${name} failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    },
    [captureCanvasImage, onSolveWithPrompt, setErrorStatus],
  );

  const handleServerEvent = useCallback(
    (event: any) => {
      if (!event || typeof event !== "object") return;

      switch (event.type) {
        case "response.created":
          setStatus("thinking");
          setStatusDetail(null);
          break;
        case "response.output_text.delta":
          // Streaming text tokens are available here if you want on-screen captions.
          break;
        case "response.done": {
          const output = event.response?.output ?? [];
          for (const item of output) {
            if (item.type === "function_call") {
              handleFunctionCall(
                item.name,
                item.arguments ?? "{}",
                item.call_id,
              );
            }
          }
          setStatus("listening");
          setStatusDetail(null);
          break;
        }
        case "input_audio_buffer.speech_started":
          setStatus("listening");
          setStatusDetail("Listening...");
          break;
        case "input_audio_buffer.speech_stopped":
          setStatus("thinking");
          setStatusDetail(null);
          break;
        case "error":
          // Log the full error object for debugging
          console.error("[Voice Agent] Server error event:", event);
          setErrorStatus(event.error?.message || event.message || "Realtime error");
          break;
        case "invalid_request_error":
          console.error("[Voice Agent] Invalid request error:", event);
          setErrorStatus(event.message || "Invalid request");
          break;
        default:
          break;
      }
    },
    [handleFunctionCall, setErrorStatus],
  );

  const startSession = useCallback(async () => {
    if (isSessionActive) return;

    if (!editor) {
      setErrorStatus("Canvas not ready yet");
      return;
    }

    try {
      setStatus("connecting");
      setStatusDetail(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      remoteAudioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("listening");
        setStatusDetail(null);
        setIsSessionActive(true);
        onSessionChange(true);

        const tools = [
          {
            type: "function",
            name: "analyze_workspace",
            description:
              "Analyze the current whiteboard canvas to understand what the user is working on and where they might need help.",
            parameters: {
              type: "object",
              properties: {
                focus: {
                  type: "string",
                  description:
                    "Optional focus for the analysis, e.g. 'find mistakes in the algebra' or 'summarize progress'.",
                },
              },
              required: [],
            },
          },
          {
            type: "function",
            name: "draw_on_canvas",
            description:
              "Use the Gemini 3 Pro canvas solver to add feedback, hints, or full solutions directly onto the whiteboard image.",
            parameters: {
              type: "object",
              properties: {
                mode: {
                  type: "string",
                  enum: ["feedback", "suggest", "answer"],
                  description:
                    "How strong the help should be: 'feedback' for light annotations, 'suggest' for hints, 'answer' for full solutions.",
                },
                instructions: {
                  type: "string",
                  description:
                    "Optional instructions about what to draw, which problem to focus on, or style preferences.",
                },
              },
              required: ["mode"],
            },
          },
        ];

        const sessionUpdate = {
          type: "session.update",
          session: {
            // Model and core configuration are set when creating the session;
            // here we provide instructions and tools.
            modalities: ["audio", "text"],
            instructions:
              "You are a realtime voice tutor for a handwritten whiteboard canvas. " +
              "Speak clearly and briefly. Use tools when you need to inspect the canvas " +
              "or add visual help. Prefer gentle hints before full solutions.",
            tools,
            tool_choice: "auto",
          },
        };

        dc.send(JSON.stringify(sessionUpdate));
      };

      dc.onmessage = (event) => {
        try {
          const serverEvent = JSON.parse(event.data);
          handleServerEvent(serverEvent);
        } catch (e) {
          console.error("[Voice Agent] Failed to parse server event", e);
        }
      };

      dc.onerror = (e) => {
        console.error("[Voice Agent] DataChannel error", e);
        setErrorStatus("Voice channel error");
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setErrorStatus("Voice connection lost");
          stopSession();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete before sending SDP to OpenAI.
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const checkState = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", checkState);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", checkState);
      });

      const tokenRes = await fetch("/api/voice/token", {
        method: "POST",
      });

      if (!tokenRes.ok) {
        throw new Error("Failed to obtain Realtime session token");
      }

      const { client_secret } = await tokenRes.json();
      if (!client_secret) {
        throw new Error("Realtime token missing client_secret");
      }

      // Note: client_secret is used as a Bearer token in the Authorization header
      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-realtime",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
          body: pc.localDescription?.sdp ?? "",
        },
      );

      if (!sdpRes.ok) {
        const errorText = await sdpRes.text().catch(() => "");
        console.error(
          "[Voice Agent] SDP exchange failed",
          sdpRes.status,
          errorText,
        );
        throw new Error("Failed to exchange SDP with Realtime API");
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (error) {
      console.error("[Voice Agent] Failed to start session", error);
      setErrorStatus(
        error instanceof Error ? error.message : "Failed to start voice session",
      );
      stopSession();
    }
  }, [editor, isSessionActive, handleServerEvent, onSessionChange, setErrorStatus, stopSession]);

  const handleClick = () => {
    if (isSessionActive) {
      stopSession();
    } else {
      void startSession();
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;

      // Following WebRTC best practices for Realtime:
      // mute by disabling the outgoing microphone track(s),
      // so no audio is sent to the agent while keeping the session alive.
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }

      return next;
    });
  };

  const showStatus = status !== "idle";
  const isError = status === "error";

  return (
    <>
      {/* Status indicator at top center */}
      {showStatus && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
          }}
        >
          {status !== "error" && (
            <Loading03Icon
              size={16}
              strokeWidth={2}
              className="animate-spin text-blue-600"
            />
          )}
          <span
            className={`text-sm font-medium ${
              isError ? "text-red-600" : "text-gray-700"
            }`}
          >
            {statusDetail || statusMessages[status] || "Voice status"}
          </span>
        </div>
      )}

      {/* Voice controls at center bottom */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[2000] pointer-events-auto">
        <div className="flex items-center gap-2">
          {isSessionActive && (
            <Button
              type="button"
              onClick={handleToggleMute}
              variant="outline"
              size="icon"
              className="rounded-full shadow-md bg-white hover:bg-gray-50"
              aria-label={isMuted ? "Unmute tutor" : "Mute tutor"}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            onClick={handleClick}
            variant={"outline"}
            className="rounded-full shadow-md bg-white hover:bg-gray-50"
            size="lg"
          >
            {isSessionActive ? (
              <MicOff02Icon size={20} strokeWidth={2} />
            ) : (
              <Mic02Icon size={20} strokeWidth={2} />
            )}
            <span className="ml-2 font-medium">
              {isSessionActive ? "End Session" : "Voice Mode"}
            </span>
          </Button>
        </div>
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
  const [assistanceMode, setAssistanceMode] = useState<"off" | "feedback" | "suggest" | "answer">("off");
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

  const generateSolution = useCallback(
    async (options?: {
      modeOverride?: "feedback" | "suggest" | "answer";
      promptOverride?: string;
      force?: boolean;
    }) => {
      if (!editor || isProcessingRef.current || isVoiceSessionActive) return;

      const mode = options?.modeOverride ?? assistanceMode;
      if (mode === "off") return;

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
        if (!options?.force && lastCanvasImageRef.current === base64) {
          isProcessingRef.current = false;
          setStatus("idle");
          setStatusMessage("");
          return;
        }
        lastCanvasImageRef.current = base64;

        if (signal.aborted) return;

        // Step 2: Generate solution (Gemini decides if help is needed)
        setStatus("generating");
        setStatusMessage(getStatusMessage(mode, "generating"));

        const body: Record<string, unknown> = {
          image: base64,
          mode,
        };

        if (options?.promptOverride) {
          body.prompt = options.promptOverride;
        }

        const solutionResponse = await fetch('/api/generate-solution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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
        const isFeedbackMode = mode === "feedback";
        
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
        setStatusMessage(getStatusMessage(mode, "success"));
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
    },
    [editor, pendingImageIds, isVoiceSessionActive, assistanceMode, getStatusMessage],
  );

  const handleAutoGeneration = useCallback(() => {
    void generateSolution();
  }, [generateSolution]);

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

          // Ensure the snapshot is JSON-serializable before sending to Supabase
          let safeSnapshot: unknown = snapshot;
          try {
            safeSnapshot = JSON.parse(JSON.stringify(snapshot));
          } catch (e) {
            logger.error(
              {
                error:
                  e instanceof Error
                    ? { message: e.message, name: e.name, stack: e.stack }
                    : e,
                id,
              },
              "Failed to serialize board snapshot for auto-save"
            );
            return;
          }
          
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
            data: safeSnapshot,
            updated_at: new Date().toISOString()
          };

          if (previewUrl) {
            // Guard against oversized previews that may violate DB column limits
            const MAX_PREVIEW_LENGTH = 8000;
            if (previewUrl.length > MAX_PREVIEW_LENGTH) {
              logger.warn(
                { id, length: previewUrl.length, maxLength: MAX_PREVIEW_LENGTH },
                "Preview too large, skipping storing preview in database"
              );
            } else {
              updateData.preview = previewUrl;
            }
          }

          const { error } = await supabase
            .from('whiteboards')
            .update(updateData)
            .eq('id', id);

          if (error) throw error;
          
          logger.info({ id }, "Board auto-saved successfully");
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
      <VoiceAgentControls
        onSessionChange={setIsVoiceSessionActive}
        onSolveWithPrompt={async (mode, instructions) => {
          await generateSolution({
            modeOverride: mode,
            promptOverride: instructions,
            force: true,
          });
        }}
      />
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
