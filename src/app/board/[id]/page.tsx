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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Loader2, Volume2, VolumeX, Info, Eye, Users } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeBoard } from "@/hooks/useRealtimeBoard";
import { getSubmissionByBoardId, updateSubmissionStatus } from "@/lib/api/assignments";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Check, Clock } from "lucide-react";
import { formatDistance } from "date-fns";

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

function ModeInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="How the help modes work"
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Help modes</DialogTitle>
          <DialogDescription>
            Choose how strongly the tutor helps on your canvas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-6">
          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/feedback.png"
              alt="Feedback mode example"
              className="h-48 w-auto rounded-md border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-medium mb-1">Feedback</p>
            <p className="text-sm text-muted-foreground">
              Light annotations pointing out mistakes without giving away answers.
            </p>
          </div>

          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/suggest.png"
              alt="Suggest mode example"
              className="h-48 w-auto rounded-md border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-medium mb-1">Suggest</p>
            <p className="text-sm text-muted-foreground">
              Hints and partial steps to nudge you in the right direction.
            </p>
          </div>

          <div className="flex-1 flex flex-col items-start">
            <img
              src="/modes/solve.png"
              alt="Solve mode example"
              className="h-48 w-auto rounded-md border bg-muted object-contain mb-3"
            />
            <p className="text-sm font-medium mb-1">Solve</p>
            <p className="text-sm text-muted-foreground">
              Full worked solution overlaid on your canvas for comparison.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageActionButtons({
  pendingImageIds,
  onAccept,
  onReject,
  isVoiceSessionActive,
}: {
  pendingImageIds: TLShapeId[];
  onAccept: (shapeId: TLShapeId) => void;
  onReject: (shapeId: TLShapeId) => void;
  isVoiceSessionActive: boolean;
}) {
  // Only show buttons when there's a pending image
  if (pendingImageIds.length === 0) return null;

  // For now, we'll just handle the most recent pending image
  const currentImageId = pendingImageIds[pendingImageIds.length - 1];

  return (
    <div
      style={{
        position: 'absolute',
        // In normal mode, sit at the top-center like before.
        // When voice is active, shift down a bit so it doesn't clash
        // with the voice status banner at the very top.
        top: isVoiceSessionActive ? '56px' : '10px',
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
  ) => Promise<boolean>;
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

          const success =
            (await onSolveWithPrompt(
              mode,
              args.instructions ?? undefined,
            )) ?? false;

          dc.send(
            JSON.stringify({
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: JSON.stringify({
                  success,
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

type AssignmentMeta = {
  templateId?: string;
  subject?: string;
  gradeLevel?: string;
  instructions?: string;
  defaultMode?: "off" | "feedback" | "suggest" | "answer";
  // AI restriction settings from teacher
  allowAI?: boolean;
  allowedModes?: string[];
};

type HelpCheckDecision = {
  needsHelp: boolean;
  confidence: number;
  reason: string;
};

type BoardContentProps = {
  id: string;
  assignmentMeta?: AssignmentMeta | null;
  boardTitle?: string;
  isSubmitted?: boolean;
  isAssignmentBoard?: boolean; // If true, hide the right-side info card (banner shows it)
  assignmentRestrictions?: {
    allowAI?: boolean;
    allowedModes?: string[];
  } | null;
};

function BoardContent({ id, assignmentMeta, boardTitle, isSubmitted, isAssignmentBoard, assignmentRestrictions }: BoardContentProps) {
  const editor = useEditor();
  const router = useRouter();
  const [pendingImageIds, setPendingImageIds] = useState<TLShapeId[]>([]);
  const [status, setStatus] = useState<StatusIndicatorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [assistanceMode, setAssistanceMode] = useState<"off" | "feedback" | "suggest" | "answer">("off");
  const [helpCheckStatus, setHelpCheckStatus] = useState<"idle" | "checking">("idle");
  const [helpCheckReason, setHelpCheckReason] = useState<string>("");
  const [isLandscape, setIsLandscape] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCanvasImageRef = useRef<string | null>(null);
  const isUpdatingImageRef = useRef(false);

  // Determine if AI is allowed and which modes based on assignment restrictions
  const aiAllowed = assignmentRestrictions?.allowAI !== false; // Default to true if not set
  const allowedModes = assignmentRestrictions?.allowedModes || ['feedback', 'suggest', 'answer'];

  // Check if a specific mode is allowed
  const isModeAllowed = (mode: string) => {
    if (!aiAllowed) return mode === 'off';
    if (mode === 'off') return true; // Off is always allowed
    return allowedModes.includes(mode);
  };

  // Get current user ID for realtime
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUserId();
  }, []);

  // Realtime collaboration (disabled for temp boards)
  const shouldEnableRealtime = !id.startsWith('temp-') && userId;
  const { activeUsers, isConnected } = useRealtimeBoard({
    boardId: shouldEnableRealtime ? id : '',
    userId: shouldEnableRealtime ? userId : '',
    onBoardUpdate: useCallback(async (updatedBoard: any) => {
      // Board was updated by another user - reload the canvas
      if (!editor || !shouldEnableRealtime) return;

      // Show notification
      toast.info("Board updated by another user", {
        description: "Reloading canvas...",
        duration: 2000,
      });

      try {
        if (updatedBoard.data && Object.keys(updatedBoard.data).length > 0) {
          loadSnapshot(editor.store, updatedBoard.data);
          logger.info({ boardId: id }, "Canvas reloaded from remote update");
        }
      } catch (error) {
        console.error("Failed to reload canvas from remote update:", error);
        toast.error("Failed to sync changes");
      }
    }, [editor, id, shouldEnableRealtime]),
  });

  // Detect orientation for landscape mode
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth >= 768);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Apple Pencil detection and enhancements
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'pen') {
        // Apple Pencil detected - could add visual feedback or special features
        console.log('Apple Pencil detected');
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Palm rejection - ignore large touch areas
      const touch = e.touches[0];
      if (touch && (touch as any).radiusX > 20) {
        // Likely a palm, but don't prevent - TLDraw handles this
        console.log('Large touch detected (possible palm)');
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

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

  useEffect(() => {
    if (assignmentMeta?.defaultMode) {
      setAssistanceMode(assignmentMeta.defaultMode);
    }
  }, [assignmentMeta]);

  const runHelpCheck = useCallback(
    async (image: string, signal: AbortSignal): Promise<HelpCheckDecision | null> => {
      try {
        setHelpCheckStatus("checking");
        const res = await fetch('/api/check-help-needed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
          signal,
        });

        if (!res.ok) {
          throw new Error('Help check request failed');
        }

        const data = await res.json();
        const decision: HelpCheckDecision = {
          needsHelp: !!data.needsHelp,
          confidence: Number(data.confidence ?? 0),
          reason: data.reason || '',
        };
        setHelpCheckReason(decision.reason || '');
        setHelpCheckStatus("idle");
        return decision;
      } catch (error) {
        if (signal.aborted) return null;
        logger.warn({ error }, 'Help check failed');
        setHelpCheckStatus("idle");
        return null;
      }
    },
    [],
  );

  const generateSolution = useCallback(
    async (options?: {
      modeOverride?: "feedback" | "suggest" | "answer";
      promptOverride?: string;
      force?: boolean;
      source?: "auto" | "voice";
    }): Promise<boolean> => {
      // Block when we don't have an editor or a generation is already running.
      // Also block auto generations while a voice session is active, but allow
      // explicit voice-triggered generations to proceed.
      if (
        !editor ||
        isProcessingRef.current ||
        (isVoiceSessionActive && options?.source !== "voice")
      ) {
        return false;
      }

      let mode = options?.modeOverride ?? assistanceMode;
      if (mode === "off") return false;

      // Enforce AI restrictions - block if AI is disabled or mode not allowed
      if (!aiAllowed) {
        logger.info('AI assistance is disabled for this assignment');
        return false;
      }
      if (!isModeAllowed(mode)) {
        logger.info({ mode }, 'This AI mode is not allowed for this assignment');
        toast.error(`${mode} mode is not allowed for this assignment`);
        return false;
      }

      // Check if canvas has content
      const shapeIds = editor.getCurrentPageShapeIds();
      if (shapeIds.size === 0) {
        return false;
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
          return false;
        }
        
        const { blob } = await editor.toImage(shapesToCapture, {
          format: "png",
          bounds: viewportBounds,
          background: true,
          scale: 1,
          padding: 0,
        });

        if (!blob || signal.aborted) return false;

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
          return false;
        }
        lastCanvasImageRef.current = base64;

        if (signal.aborted) return false;

        // Step 2: Run a light help check for auto assistance
        let helpDecision: HelpCheckDecision | null = null;
        if ((options?.source ?? "auto") === "auto") {
          helpDecision = await runHelpCheck(base64, signal);

          if (helpDecision && helpDecision.needsHelp === false) {
            setStatus("idle");
            setStatusMessage("Looking good—keep going.");
            isProcessingRef.current = false;
            return false;
          }

          if (
            helpDecision &&
            helpDecision.needsHelp &&
            helpDecision.confidence < 0.5 &&
            mode === "answer"
          ) {
            mode = "suggest";
            setStatusMessage("Showing hints first before full solutions.");
          }
        }

        // Step 3: Generate solution (Gemini decides if help is needed)
        setStatus("generating");
        setStatusMessage(getStatusMessage(mode, "generating"));

        const body: Record<string, unknown> = {
          image: base64,
          mode,
        };

        if (options?.promptOverride) {
          body.prompt = options.promptOverride;
        }

        // Let the backend know whether this was triggered automatically or
        // explicitly by the voice tutor.
        body.source = options?.source ?? "auto";

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
          return false;
        }

        const processedImageUrl = imageUrl;

        if (signal.aborted) return false;

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

        if (signal.aborted) return false;

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

        return true;
      } catch (error) {
        if (signal.aborted) {
          setStatus("idle");
          setStatusMessage("");
          return false;
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

        return false;
      } finally {
        isProcessingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [editor, pendingImageIds, isVoiceSessionActive, assistanceMode, getStatusMessage],
  );

  const handleAutoGeneration = useCallback(() => {
    void generateSolution({ source: "auto" });
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

    let saveTimeout: ReturnType<typeof setTimeout>;

    const handleChange = () => {
      // Don't save during image updates
      if (isUpdatingImageRef.current) return;

      // Skip auto-save for temporary boards (no auth)
      if (id.startsWith('temp-')) {
        console.log('Skipping auto-save for temporary board');
        return;
      }

      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        // If we're offline, skip auto-save to avoid noisy errors
        if (typeof window !== "undefined" && window.navigator && !window.navigator.onLine) {
          logger.warn({ id }, "Skipping auto-save while offline");
          return;
        }

        try {
          // Validate editor state
          if (!editor || !editor.store) {
            console.warn("Editor or store not available for auto-save");
            return;
          }

          const snapshot = getSnapshot(editor.store);
          
          if (!snapshot) {
            console.warn("Failed to get snapshot from editor");
            return;
          }

          // Ensure the snapshot is JSON-serializable before sending to Supabase
          let safeSnapshot: unknown = snapshot;
          try {
            safeSnapshot = JSON.parse(JSON.stringify(snapshot));
          } catch (e) {
            console.error("Failed to serialize board snapshot:", e);
            logger.error(
              {
                error:
                  e instanceof Error
                    ? { message: e.message, name: e.name, stack: e.stack }
                    : String(e),
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
                scale: 0.75,  // Increased from 0.5 for better preview quality (50% more detail)
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
            console.warn("Thumbnail generation failed:", e);
            logger.warn(
              {
                error:
                  e instanceof Error
                    ? { message: e.message, name: e.name, stack: e.stack }
                    : String(e),
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
              console.warn(`Preview too large (${previewUrl.length} bytes), skipping`);
              logger.warn(
                { id, length: previewUrl.length, maxLength: MAX_PREVIEW_LENGTH },
                "Preview too large, skipping storing preview in database"
              );
            } else {
              updateData.preview = previewUrl;
            }
          }

          // Validate Supabase client and configuration
          if (!supabase) {
            throw new Error("Supabase client not initialized");
          }

          // Check if Supabase is properly configured
          if (typeof window !== 'undefined') {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
              throw new Error("Supabase URL is not configured. Please set NEXT_PUBLIC_SUPABASE_URL in your environment variables.");
            }
            
            if (!supabaseKey || supabaseKey === 'placeholder-key') {
              throw new Error("Supabase anon key is not configured. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.");
            }
          }

          console.log(`Attempting to save board ${id}...`);
          
          const { error, data } = await supabase
            .from("whiteboards")
            .update(updateData)
            .eq("id", id)
            .select();

          if (error) {
            // Special-case Supabase statement timeouts (code 57014).
            // These can happen if the user navigates away mid-request or if
            // the database is briefly under load. Treat them as non-fatal and
            // avoid noisy console errors.
            const isTimeoutError =
              (error as any)?.code === "57014" ||
              /statement timeout/i.test(error.message ?? "");

            if (isTimeoutError) {
              console.warn("Supabase auto-save timed out, skipping noisy error log.", {
                id,
                code: (error as any)?.code,
                message: error.message,
              });

              logger.warn(
                {
                  id,
                  code: (error as any)?.code,
                  message: error.message,
                },
                "Supabase auto-save timed out (often due to navigation away); ignoring.",
              );

              // Don't throw so the outer catch block doesn't treat this as a hard error.
              return;
            }

            // For all other errors, log detailed information and surface a clear message.
            const errorDetails = {
              message: error.message,
              code: (error as any)?.code,
              details: (error as any)?.details,
              hint: (error as any)?.hint,
              // Capture all properties for richer debugging
              ...Object.getOwnPropertyNames(error).reduce((acc, key) => {
                acc[key] = (error as any)[key];
                return acc;
              }, {} as Record<string, any>),
            };

            console.error("Supabase update error:", errorDetails);
            throw new Error(
              `Supabase error: ${error.message || "Unknown error"} (code: ${
                (error as any)?.code || "N/A"
              })`,
            );
          }
          
          if (!data || data.length === 0) {
            console.warn("No rows updated - board may not exist:", id);
          }
          
          logger.info({ id }, "Board auto-saved successfully");
        } catch (error) {
          // Extract all error properties for proper logging
          const errorInfo: Record<string, any> = {
            id,
            errorType: typeof error,
            errorConstructor: error?.constructor?.name,
          };

          if (error instanceof Error) {
            errorInfo.message = error.message;
            errorInfo.name = error.name;
            errorInfo.stack = error.stack;
          } else if (error && typeof error === 'object') {
            // Extract all enumerable and non-enumerable properties
            Object.getOwnPropertyNames(error).forEach(key => {
              try {
                errorInfo[key] = (error as any)[key];
              } catch (e) {
                errorInfo[key] = '[Unable to access property]';
              }
            });
          } else {
            errorInfo.value = String(error);
          }

          // Use console.error for proper browser error logging
          console.error("Error auto-saving board:", errorInfo);
          
          // Also log with logger for consistency
          logger.error(
            {
              error: errorInfo,
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
      {/* Active users indicator */}
      {activeUsers.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[1000] ios-safe-bottom ios-safe-right">
          <div className="bg-card border rounded-lg shadow-sm px-3 py-2 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'} animate-pulse`} />
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <p className="text-xs font-medium">
                {activeUsers.length} {activeUsers.length === 1 ? 'person' : 'people'} viewing
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                {activeUsers.map(u => u.userName).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs at top left */}
      {!isVoiceSessionActive && (
        <>
          {/* Back button - stays on left */}
          <div
            className={
              isLandscape
                ? "fixed left-4 top-4 z-[1000] ios-safe-left ios-safe-top"
                : "fixed top-4 left-4 z-[1000] ios-safe-top ios-safe-left"
            }
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="touch-target"
            >
              <ArrowLeft01Icon size={20} strokeWidth={2} />
            </Button>
          </div>

          {/* Mode tabs - horizontal at top center in landscape, next to back button in portrait */}
          <div
            className={
              isLandscape
                ? "fixed top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 ios-safe-top"
                : "fixed top-4 left-20 z-[1000] flex items-center gap-2 ios-safe-top ios-safe-left"
            }
          >
            {/* Show AI disabled message if AI is completely blocked */}
            {!aiAllowed ? (
              <div className="px-4 py-2 bg-amber-100 border border-amber-300 rounded-lg text-amber-800 text-sm font-medium">
                AI assistance disabled for this assignment
              </div>
            ) : (
              <Tabs
                value={assistanceMode}
                onValueChange={(value) => {
                  if (isModeAllowed(value)) {
                    setAssistanceMode(value as "off" | "feedback" | "suggest" | "answer");
                  }
                }}
                className="w-auto rounded-xl"
              >
                <TabsList className="gap-1 p-1.5 bg-muted/50 backdrop-blur-sm border shadow-md">
                  <TabsTrigger value="off" className="touch-target min-w-[70px] rounded-lg">Off</TabsTrigger>
                  {isModeAllowed('feedback') && (
                    <TabsTrigger value="feedback" className="touch-target min-w-[70px] rounded-lg">Feedback</TabsTrigger>
                  )}
                  {isModeAllowed('suggest') && (
                    <TabsTrigger value="suggest" className="touch-target min-w-[70px] rounded-lg">Suggest</TabsTrigger>
                  )}
                  {isModeAllowed('answer') && (
                    <TabsTrigger value="answer" className="touch-target min-w-[70px] rounded-lg">Solve</TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            )}
            <ModeInfoDialog />
          </div>
        </>
      )}

      {/* When a voice session is active, let the voice banner own the top-center space. */}
      {!isVoiceSessionActive && (
        <StatusIndicator
          status={status}
          errorMessage={errorMessage}
          customMessage={statusMessage}
        />
      )}

      {/* Only show right-side info card for non-assignment boards (assignments use the top banner) */}
      {!isAssignmentBoard && (assignmentMeta || helpCheckReason) && (
        <div
          className={
            isLandscape
              ? "fixed right-4 top-4 z-[1100] max-w-xs ios-safe-right ios-safe-top"
              : "fixed top-4 right-4 z-[1100] max-w-sm ios-safe-top ios-safe-right"
          }
        >
          <div className="bg-card border rounded-lg shadow-sm p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Assignment</p>
            <p className="font-semibold leading-tight">{boardTitle || 'Class board'}</p>
            <p className="text-sm text-muted-foreground leading-tight">
              {(assignmentMeta?.subject || 'Subject')}{assignmentMeta?.gradeLevel ? ` - ${assignmentMeta.gradeLevel}` : ''}{assignmentMeta?.templateId ? ` - ${assignmentMeta.templateId.replace(/-/g, ' ')}` : ''}
            </p>
            {assignmentMeta?.instructions && (
              <p className="text-sm leading-relaxed mt-2">
                {assignmentMeta.instructions}
              </p>
            )}
            {helpCheckReason && helpCheckStatus === "idle" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                Tutor note: {helpCheckReason}
              </p>
            )}
          </div>
        </div>
      )}
      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        isVoiceSessionActive={isVoiceSessionActive}
        onAccept={handleAccept}
        onReject={handleReject}
      />
      {/* Voice mode hidden for now */}
      {/* <VoiceAgentControls
        onSessionChange={setIsVoiceSessionActive}
        onSolveWithPrompt={async (mode, instructions) => {
          const success = await generateSolution({
            modeOverride: mode,
            promptOverride: instructions,
            force: true,
            source: "voice",
          });
          return success;
        }}
      /> */}
    </>
  );
}

export default function BoardPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);
  const [assignmentMeta, setAssignmentMeta] = useState<AssignmentMeta | null>(null);
  const [boardTitle, setBoardTitle] = useState<string>("");
  const [canEdit, setCanEdit] = useState(true);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadBoard() {
      try {
        // If it's a temp board (no auth), just allow editing
        if (id.startsWith('temp-')) {
          console.log('Loading temporary board (no auth)');
          setBoardTitle('Temporary Board');
          setCanEdit(true);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('whiteboards')
          .select('data, metadata, title, user_id')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          setBoardTitle(data.title || 'Class board');
          setAssignmentMeta(data.metadata || null);
          if (data.data && Object.keys(data.data).length > 0) {
            setInitialData(data.data);
          }

          // Check edit permission
          const { data: { user } } = await supabase.auth.getUser();

          if (!user) {
            // No auth - allow editing for temp boards
            setCanEdit(true);
            return;
          }

          const isOwner = data.user_id === user.id;

          if (isOwner) {
            setCanEdit(true);
          } else {
            // Check if user has share permission
            const { data: share } = await supabase
              .from('board_shares')
              .select('permission')
              .eq('board_id', id)
              .eq('shared_with_user_id', user.id)
              .single();

            setCanEdit(share?.permission === 'edit');
          }
        }
      } catch (e) {
        console.error("Error loading board:", e);
        // Allow editing even on error (for temp boards)
        setCanEdit(true);
      } finally {
        setLoading(false);
      }
    }
    loadBoard();
  }, [id]);

  // Check if this board is an assignment submission
  useEffect(() => {
    async function checkIfAssignment() {
      if (!id.startsWith('temp-')) {
        try {
          const submission = await getSubmissionByBoardId(id);
          setSubmissionData(submission);
          // Lock the board if already submitted
          if (submission?.status === 'submitted') {
            setCanEdit(false);
          }
        } catch (error) {
          console.error('Error checking assignment:', error);
        }
      }
    }
    checkIfAssignment();
  }, [id]);

  // Update editor read-only state when canEdit changes
  useEffect(() => {
    const editor = (window as any).__tldrawEditor;
    if (editor) {
      editor.updateInstanceState({ isReadonly: !canEdit });
    }
  }, [canEdit]);

  const handleSubmit = async () => {
    if (!submissionData) return;

    if (!confirm('Submit this assignment? Your work will be locked and you won\'t be able to make further changes.')) {
      return;
    }

    setSubmitting(true);
    try {
      await updateSubmissionStatus(submissionData.id, 'submitted');
      toast.success('Assignment submitted! Your work is now locked.');
      setSubmissionData({
        ...submissionData,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      });
      // Lock the board by disabling edit
      setCanEdit(false);
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast.error('Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

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

  // Compute a top offset so fixed banners never cover the canvas
  const hasViewOnlyBanner = !canEdit && !submissionData;
  const hasSubmittedBanner = !canEdit && submissionData?.status === 'submitted';
  const hasAssignmentBanner = !!submissionData;

  // Approximate banner heights (px): top notice (~40), assignment bar (~80)
  const TOP_NOTICE_HEIGHT = 40; // py-2 banner
  const ASSIGNMENT_BAR_HEIGHT = 80; // header with title, class, actions
  const topOffset =
    (hasViewOnlyBanner ? TOP_NOTICE_HEIGHT : 0) +
    (hasSubmittedBanner ? TOP_NOTICE_HEIGHT : 0) +
    (hasAssignmentBanner ? ASSIGNMENT_BAR_HEIGHT : 0);

  return (
    <div style={{ position: "fixed", inset: 0, top: topOffset }}>
      {/* View-only banner */}
      {!canEdit && !submissionData && (
        <div className="fixed top-0 left-0 right-0 z-[10000] bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          View Only - You don't have permission to edit this board
        </div>
      )}

      {/* Submitted assignment banner */}
      {!canEdit && submissionData?.status === 'submitted' && (
        <div className="fixed top-0 left-0 right-0 z-[10000] bg-green-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          Assignment Submitted - Your work has been locked
        </div>
      )}

      {/* Assignment banner - positioned below submission banner if submitted */}
      {submissionData && (
        <div className={`fixed left-0 right-0 z-[9999] bg-card border-b shadow-md ${submissionData.status === 'submitted' ? 'top-10' : 'top-0'}`}>
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{submissionData.assignment.title}</h3>
                  <Badge variant={
                    submissionData.status === 'submitted' ? 'default' :
                    submissionData.status === 'in_progress' ? 'secondary' :
                    'outline'
                  }>
                    {submissionData.status === 'submitted' ? 'Submitted' :
                     submissionData.status === 'in_progress' ? 'In Progress' :
                     'Not Started'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{submissionData.assignment.class.name}</p>
                {submissionData.assignment.instructions && (
                  <p className="text-sm mt-2">{submissionData.assignment.instructions}</p>
                )}
                {submissionData.assignment.due_date && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due {formatDistance(new Date(submissionData.assignment.due_date), new Date(), { addSuffix: true })}
                  </p>
                )}
              </div>

              {submissionData.status !== 'submitted' ? (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Mark as Submitted'}
                </Button>
              ) : (
                <div className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Submitted {submissionData.submitted_at && formatDistance(new Date(submissionData.submitted_at), new Date(), { addSuffix: true })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Tldraw
        licenseKey="tldraw-2026-03-19/WyJSZHJJZ3NSWCIsWyIqIl0sMTYsIjIwMjYtMDMtMTkiXQ.8X9Dhayg/Q1F82ArvwNCMl//yOg8tTOTqLIfhMAySFKg50Wq946/jip5Qved7oDYoVA+YWYTNo4/zQEPK2+neQ"
        overrides={hugeIconsOverrides}
        components={{
          MenuPanel: null,
          NavigationPanel: null,
          HelperButtons: null,
        }}
        onMount={(editor) => {
          // Store editor ref for later use
          (window as any).__tldrawEditor = editor;

          if (initialData) {
            try {
              loadSnapshot(editor.store, initialData);
            } catch (e) {
              console.error("Failed to load snapshot:", e);
              toast.error("Failed to restore canvas state");
            }
          }

          // Set read-only mode immediately if needed
          if (!canEdit) {
            editor.updateInstanceState({ isReadonly: true });
          }
        }}
      >
        <BoardContent
          id={id}
          assignmentMeta={assignmentMeta}
          boardTitle={boardTitle}
          isSubmitted={submissionData?.status === 'submitted'}
          isAssignmentBoard={!!submissionData}
          assignmentRestrictions={submissionData?.assignment?.metadata}
        />
      </Tldraw>
    </div>
  );
}
