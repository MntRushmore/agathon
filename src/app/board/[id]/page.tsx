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
  Box,
} from "tldraw";
import { toRichText } from "@tldraw/tlschema";
import React, { useCallback, useState, useRef, useEffect, useMemo, type ReactElement } from "react";
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
// useDebounceActivity no longer used — auto-solve disabled
import { StatusIndicator, type StatusIndicatorState } from "@/components/StatusIndicator";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Volume2, VolumeX, Info, Eye, Users, Sparkles } from "lucide-react";
import { sileo } from "sileo";
import { useRealtimeBoard } from "@/hooks/useRealtimeBoard";
import { getSubmissionByBoardId, updateSubmissionStatus } from "@/lib/api/assignments";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Check, Clock, ExternalLink, FileText, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { formatDistance } from "date-fns";
import { CustomToolbar } from "@/components/board/CustomToolbar";
import { WhiteboardOnboarding } from "@/components/board/WhiteboardOnboarding";
import type { CanvasContext } from "@/hooks/useChat";
import { FirstBoardTutorial } from "@/components/board/FirstBoardTutorial";
import { celebrateMilestone } from "@/lib/celebrations";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DocumentPanelContext } from "@/lib/contexts/document-panel-context";
import { MyScriptMathOverlay } from "@/components/board/MyScriptMathOverlay";
import { LassoSolveTool, type LassoSolveCompleteEvent } from "@/components/board/tools/LassoSolveTool";
import { LassoActionPrompt } from "@/components/board/LassoActionPrompt";
import { AdminPlanToggle } from "@/components/board/AdminPlanToggle";
import { AITutorPanel } from "@/components/board/AITutorPanel";
import { AITutorButton } from "@/components/board/AITutorButton";
import { useAITutor } from "@/hooks/useAITutor";
import { HintButton } from "@/components/board/HintButton";
import { FeedbackCard } from "@/components/board/FeedbackCard";
import { LaTeXShapeUtil } from "@/components/board/LaTeXShape";
import { TopBar } from "@/components/board/TopBar";

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

// ModeInfoDialog moved to TopBar component

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
        bottom: '80px', // Position above the voice button and chat
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 11000,
        display: 'flex',
        gap: '12px',
      }}
    >
      <Button
        variant="default"
        size="lg"
        onClick={() => onAccept(currentImageId)}
        className="shadow-xl bg-green-600 hover:bg-green-700 text-white rounded-full px-6"
      >
        <Tick01Icon size={20} strokeWidth={2.5} />
        <span className="ml-2 font-bold">Accept Help</span>
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => onReject(currentImageId)}
        className="shadow-xl bg-white hover:bg-gray-100 rounded-full px-6"
      >
        <Cancel01Icon size={20} strokeWidth={2.5} />
        <span className="ml-2 font-bold">Reject</span>
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
            break;
          }
          default:
            break;
        }
      },
      [handleFunctionCall],
    );

    const setupDataChannel = useCallback((dc: RTCDataChannel) => {
      dc.onopen = () => {
        console.log("[Voice Agent] Data channel open, configuring session...");
        const sessionConfig = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: `You are a helpful math tutor. Guide the student through problems without giving answers directly. Use Socratic questioning.`,
            voice: "alloy",
            input_audio_transcription: { model: "whisper-1" },
            tools: [
              {
                type: "function",
                name: "analyze_workspace",
                description: "Analyzes what the student has written on the canvas.",
                parameters: {
                  type: "object",
                  properties: { focus: { type: "string" } },
                },
              },
              {
                type: "function",
                name: "draw_on_canvas",
                description: "Generates visual AI assistance on the canvas.",
                parameters: {
                  type: "object",
                  properties: {
                    mode: { type: "string", enum: ["feedback", "suggest", "answer"] },
                    instructions: { type: "string" },
                  },
                  required: ["mode"],
                },
              },
            ],
          },
        };
        dc.send(JSON.stringify(sessionConfig));
      };

      dc.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data);
          handleServerEvent(event);
        } catch (e) {
          console.error("[Voice Agent] Failed to parse event", e);
        }
      };

      dc.onclose = () => {
        console.log("[Voice Agent] Data channel closed");
        stopSession();
      };
    }, [handleServerEvent, stopSession]);

    const startSession = useCallback(async () => {
      setStatus("connecting");
      onSessionChange(true);

      try {
        const tokenRes = await fetch("/api/voice/token");
        if (!tokenRes.ok) throw new Error("Failed to get ephemeral token");
        const { client_secret } = await tokenRes.json();
        const EPHEMERAL_KEY = client_secret?.value;
        if (!EPHEMERAL_KEY) throw new Error("No ephemeral key returned");

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const audio = document.createElement("audio");
        audio.autoplay = true;
        remoteAudioRef.current = audio;

        pc.ontrack = (ev) => {
          audio.srcObject = ev.streams[0];
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const dc = pc.createDataChannel("oai-events");
        setupDataChannel(dc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = "gpt-4o-realtime-preview-2024-12-17";
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });

        if (!sdpResponse.ok) throw new Error("Realtime handshake failed");
        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

        setIsSessionActive(true);
        setStatus("listening");
      } catch (err) {
        cleanupSession();
        setIsSessionActive(false);
        onSessionChange(false);
        setErrorStatus(err instanceof Error ? err.message : "Unknown error");
      }
    }, [cleanupSession, onSessionChange, setErrorStatus, setupDataChannel]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMutedState = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMutedState;
    });
    setIsMuted(newMutedState);
  }, [isMuted]);

  const handleClick = useCallback(async () => {
    if (isSessionActive) {
      stopSession();
    } else {
      await startSession();
    }
  }, [isSessionActive, startSession, stopSession]);

  return (
    <>
      <audio ref={remoteAudioRef} autoPlay />

      {isSessionActive && status !== "idle" && (
        <div className="fixed top-0 left-0 right-0 z-[10000] flex flex-col items-center justify-center pt-4 pointer-events-none">
          <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg animate-pulse">
            <Loading03Icon size={20} className="animate-spin" />
            <span className="text-sm font-medium">
              {statusMessages[status]}
              {statusDetail ? ` (${statusDetail})` : ""}
            </span>
          </div>

          <div className="flex gap-4 mt-4 pointer-events-auto">
            <Button
              variant="outline"
              size="sm"
              className="bg-white rounded-full px-4"
              onClick={toggleMute}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 mr-2" /> Unmute Mic
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" /> Mute Mic
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[10000]">
        <div className="flex items-center gap-4">
          {isSessionActive && (
            <span className="text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
              Voice session active
            </span>
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

function TeacherAIIndicator({ editor, onAIShapeCount }: { editor: any; onAIShapeCount?: (count: number) => void }) {
  const [aiShapes, setAiShapes] = useState<any[]>([]);
  const [showLegend, setShowLegend] = useState(true);

  useEffect(() => {
    if (!editor) return;

    const updateAIShapes = () => {
      const shapes = editor.getCurrentPageShapes();
      const aiGenerated = shapes.filter((s: any) => s.meta?.aiGenerated);
      setAiShapes(aiGenerated);
      onAIShapeCount?.(aiGenerated.length);
    };

    updateAIShapes();
    const dispose = editor.store.listen(updateAIShapes, { source: 'all', scope: 'document' });
    return () => dispose();
  }, [editor, onAIShapeCount]);

  const aiStats = {
    total: aiShapes.length,
    feedback: aiShapes.filter((s: any) => s.meta?.aiMode === 'feedback').length,
    suggest: aiShapes.filter((s: any) => s.meta?.aiMode === 'suggest').length,
    answer: aiShapes.filter((s: any) => s.meta?.aiMode === 'answer').length,
  };

  // Generate CSS rules to highlight AI shapes with blue outlines
  const cssRules = useMemo(() => {
    if (aiShapes.length === 0) return '';

    const rules: string[] = [];

    rules.push(`
      @keyframes ai-pulse-glow {
        0%, 100% { box-shadow: 0 0 8px 2px rgba(0, 123, 165, 0.5); }
        50% { box-shadow: 0 0 16px 4px rgba(0, 123, 165, 0.7); }
      }
    `);

    aiShapes.forEach((shape: any) => {
      const mode = shape.meta?.aiMode || 'feedback';
      const selector = `.tl-shape[data-shape-id="${shape.id}"]`;

      switch (mode) {
        case 'suggest':
          rules.push(`${selector} {
            outline: 2px solid rgba(0, 123, 165, 0.7) !important;
            outline-offset: 3px;
            box-shadow: 0 0 8px 1px rgba(0, 123, 165, 0.3);
            border-radius: 4px;
          }`);
          break;
        case 'answer':
          rules.push(`${selector} {
            outline: 3px solid rgba(0, 101, 137, 0.85) !important;
            outline-offset: 3px;
            animation: ai-pulse-glow 2s ease-in-out infinite;
            border-radius: 4px;
          }`);
          break;
        default:
          // feedback and other modes get subtle dashed outline
          rules.push(`${selector} {
            outline: 2px dashed rgba(56, 163, 201, 0.6) !important;
            outline-offset: 3px;
            border-radius: 4px;
          }`);
      }
    });

    return rules.join('\n');
  }, [aiShapes]);

  if (aiShapes.length === 0 && !showLegend) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[var(--z-controls)]">
      {cssRules && (
        <style dangerouslySetInnerHTML={{ __html: cssRules }} />
      )}

      {showLegend && (
        <div className="bg-card/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 mb-2 max-w-xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600" />
              AI Usage Summary
            </h4>
            <button onClick={() => setShowLegend(false)} className="text-muted-foreground hover:text-foreground">
              <Cancel01Icon size={16} />
            </button>
          </div>

          {aiShapes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AI assistance was used on this submission.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Student used AI assistance <span className="font-semibold text-foreground">{aiStats.total}</span> time{aiStats.total !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5">
                {aiStats.feedback > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-5 border-t-2 border-dashed border-sky-400" />
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                      {aiStats.feedback} Light Hint{aiStats.feedback !== 1 ? 's' : ''}
                    </span>
                    <span className="text-muted-foreground">Dashed outline</span>
                  </div>
                )}
                {aiStats.suggest > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-5 border-t-2 border-solid border-sky-500" />
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                      {aiStats.suggest} Guided Hint{aiStats.suggest !== 1 ? 's' : ''}
                    </span>
                    <span className="text-muted-foreground">Solid outline + glow</span>
                  </div>
                )}
                {aiStats.answer > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-5 border-t-[3px] border-solid border-sky-700" />
                    <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                      {aiStats.answer} Solution{aiStats.answer !== 1 ? 's' : ''}
                    </span>
                    <span className="text-muted-foreground">Thick outline + pulse</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                AI-generated content is outlined in blue on the canvas.
              </p>
            </div>
          )}
        </div>
      )}

      {!showLegend && aiShapes.length > 0 && (
        <button
          onClick={() => setShowLegend(true)}
          className="bg-[#007ba5] text-white rounded-full p-3 shadow-lg hover:bg-[#006589] transition-colors"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/** Convert Google URLs to embeddable format (add /preview suffix) */
function toEmbedUrl(url: string): string {
  // Google Docs
  if (url.includes('docs.google.com/document')) {
    return url.replace(/\/(edit|view).*$/, '/preview');
  }
  // Google Slides
  if (url.includes('docs.google.com/presentation')) {
    return url.replace(/\/(edit|view).*$/, '/embed');
  }
  // Google Sheets
  if (url.includes('docs.google.com/spreadsheets')) {
    return url.replace(/\/(edit|view).*$/, '/htmlview');
  }
  // Google Drive file
  const driveMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch && url.includes('drive.google.com')) {
    return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  }
  // Other Google Docs types
  if (url.includes('docs.google.com/')) {
    return url.replace(/\/(edit|view).*$/, '/preview');
  }
  return url;
}

/** Check if a URL is a Google service URL that can't be iframed directly */
function isNonEmbeddableGoogleUrl(url: string): boolean {
  return (
    url.includes('classroom.google.com') ||
    (url.includes('google.com') && !url.includes('/preview') && !url.includes('/embed') && !url.includes('/htmlview'))
  );
}

function DocumentPanel({
  url,
  title,
  isOpen,
  onClose,
}: {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(420);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(420);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    startX.current = e.clientX;
    startWidth.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      // Dragging left edge: moving left increases width
      const newWidth = Math.min(700, Math.max(300, startWidth.current - (e.clientX - startX.current)));
      setWidth(newWidth);
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  if (!isOpen) return null;

  // Convert to embed-friendly URL for Google services
  const embedUrl = toEmbedUrl(url);
  const canEmbed = !isNonEmbeddableGoogleUrl(embedUrl);

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white border-l border-gray-200 z-[var(--z-panel)] flex flex-col shadow-lg"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 bg-gray-50/80 shrink-0">
        <FileText className="h-4 w-4 text-gray-500 shrink-0" />
        <span className="text-sm font-medium text-gray-800 truncate flex-1">{title}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-md hover:bg-gray-200 transition-colors text-gray-500"
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-200 transition-colors text-gray-500"
          title="Close document panel"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-hidden relative">
        {canEmbed ? (
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            allow="autoplay"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            title={title}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-700 mb-2">This document can&apos;t be previewed here</p>
            <p className="text-xs text-gray-500 mb-4">Open it in a new tab to view the full content</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Open Document
            </a>
          </div>
        )}
        {/* Overlay blocks iframe from stealing mouse events while resizing */}
        {dragging && <div className="absolute inset-0" />}
      </div>
      {/* Resize handle — left edge */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
      />
    </div>
  );
}

type AssignmentMeta = {
  templateId?: string;
  subject?: string;
  gradeLevel?: string;
  instructions?: string;
  defaultMode?: "off" | /* "feedback" | */ "suggest" | "answer";
  // AI restriction settings from teacher
  allowAI?: boolean;
  allowedModes?: string[];
  hintLimit?: number | null;
  backgroundStyle?: string;
  documentUrl?: string;
  documentTitle?: string;
  // Google Classroom submission linkage
  gcCourseId?: string;
  gcCourseworkId?: string;
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
  isAssignmentBoard?: boolean;
    assignmentRestrictions?: {
      allowAI?: boolean;
      allowedModes?: string[];
      hintLimit?: number | null;
      socraticMode?: boolean;
    } | null;
    isTeacherViewing?: boolean;
    hasBanner?: boolean;
    submissionId?: string | null;
    assignmentId?: string | null;
    initialHintCount?: number;
    docPanelOpen?: boolean;
    setDocPanelOpen?: (open: boolean) => void;
  };

function BoardContent({ id, assignmentMeta, boardTitle, isSubmitted, isAssignmentBoard, assignmentRestrictions, isTeacherViewing, hasBanner, submissionId, assignmentId, initialHintCount = 0, docPanelOpen = false, setDocPanelOpen }: BoardContentProps) {

  const editor = useEditor();
  const router = useRouter();
  const [pendingImageIds, setPendingImageIds] = useState<TLShapeId[]>([]);
  const [status, setStatus] = useState<StatusIndicatorState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isVoiceSessionActive, setIsVoiceSessionActive] = useState(false);
  const [assistanceMode, setAssistanceMode] = useState<"off" | /* "feedback" | */ "suggest" | "answer">("suggest");
  const [helpCheckStatus, setHelpCheckStatus] = useState<"idle" | "checking">("idle");
    const [helpCheckReason, setHelpCheckReason] = useState<string>("");
    const [isLandscape, setIsLandscape] = useState(false);
    const [aiTutorOpen, setAiTutorOpen] = useState(false);
    const [aiTutorImage, setAiTutorImage] = useState<string | null>(null);
    const [aiTutorAnswer, setAiTutorAnswer] = useState<string>("");
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [feedbackCard, setFeedbackCard] = useState<{
      summary: string;
      annotations: { type: string; content: string }[];
      isCorrect?: boolean | null;
      solution?: string;
      position: { x: number; y: number };
    } | null>(null);
    const [lassoPrompt, setLassoPrompt] = useState<{
      shapeIds: TLShapeId[];
      bounds: { x: number; y: number; width: number; height: number };
      screenPos: { x: number; y: number };
    } | null>(null);
    const [feedbackCardClosing, setFeedbackCardClosing] = useState(false);
    const [lassoPromptClosing, setLassoPromptClosing] = useState(false);
    const [userId, setUserId] = useState<string>("");
    const [showOnboarding, setShowOnboarding] = useState(true);
    const [hintLimit, setHintLimit] = useState<number | null>(assignmentRestrictions?.hintLimit ?? null);
    const [currentHintCount, setCurrentHintCount] = useState<number>(initialHintCount);
    const isProcessingRef = useRef(false);

  // Unified AI Tutor hook
  const getCanvasContextForTutor = useCallback(async (): Promise<CanvasContext> => {
    const shapes = editor?.getCurrentPageShapes() || [];
    let imageBase64: string | undefined;
    if (editor && shapes.length > 0) {
      try {
        const shapeIds = editor.getCurrentPageShapeIds();
        const result = await editor.toImage([...shapeIds], {
          format: 'png',
          background: true,
          scale: 0.5,
        });
        if (result?.blob) {
          const reader = new FileReader();
          imageBase64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(result.blob);
          });
        }
      } catch (err) {
        console.error('Failed to capture canvas:', err);
      }
    }
    return {
      subject: assignmentMeta?.subject,
      gradeLevel: assignmentMeta?.gradeLevel,
      instructions: assignmentMeta?.instructions,
      description: shapes.length > 0
        ? `Canvas has ${shapes.length} elements (drawings, text, shapes, etc.)`
        : 'Canvas is empty',
      imageBase64,
    } as CanvasContext;
  }, [editor, assignmentMeta]);

  const aiTutor = useAITutor({ getCanvasContext: getCanvasContextForTutor });

  // Auto-trigger analysis when a problem image is captured (from generate-solution or lasso-solve)
  useEffect(() => {
    if (aiTutorImage) {
      aiTutor.fetchAnalysis(aiTutorImage, aiTutorAnswer);
      setAiTutorOpen(true);
      // Reset so future captures re-trigger
      setAiTutorImage(null);
      setAiTutorAnswer('');
    }
  }, [aiTutorImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastCanvasImageRef = useRef<string | null>(null);
  const isUpdatingImageRef = useRef(false);

  useEffect(() => {
    setHintLimit(assignmentRestrictions?.hintLimit ?? null);
  }, [assignmentRestrictions?.hintLimit]);

  useEffect(() => {
    setCurrentHintCount(initialHintCount);
  }, [initialHintCount]);

  const maybeWarnHintLimit = useCallback((nextCount: number) => {
    if (!hintLimit || hintLimit <= 0) return;
    const remaining = hintLimit - nextCount;
    if (remaining >= 0 && remaining <= 2) {
      sileo.warning({
        title: remaining === 0
          ? 'You have reached the hint limit for this assignment.'
          : `${remaining} hint${remaining === 1 ? '' : 's'} remaining—use them wisely.`,
      });
    }
  }, [hintLimit]);

  const hintsRemaining = hintLimit !== null ? Math.max(hintLimit - currentHintCount, 0) : null;

  const trackAIUsage = useCallback(async (mode: string, prompt?: string, aiResponse?: string) => {
    try {
      const response = await fetch('/api/track-ai-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submissionId || undefined,
          assignmentId: assignmentId || undefined,
          whiteboardId: id,
          mode,
          prompt: prompt || `Auto-triggered ${mode} mode assistance`,
          aiResponse,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (payload?.helpCount !== undefined) {
        setCurrentHintCount(payload.helpCount);
        maybeWarnHintLimit(payload.helpCount);
      } else if (hintLimit) {
        setCurrentHintCount((prev) => {
          const next = prev + 1;
          maybeWarnHintLimit(next);
          return next;
        });
      }

      // Check for first AI usage milestone
      const supabaseClient = createClient();
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (user) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('milestones_achieved')
          .eq('id', user.id)
          .single();

        const milestones = profile?.milestones_achieved || [];

        if (!milestones.includes('first_ai_used')) {
          // Track the milestone
          await supabaseClient
            .from('profiles')
            .update({
              milestones_achieved: [...milestones, 'first_ai_used']
            })
            .eq('id', user.id);

          // Celebrate!
          celebrateMilestone('first_ai_used');
        }
      }
    } catch (error) {
      console.error('Failed to track AI usage:', error);
    }
  }, [id, submissionId, assignmentId, hintLimit, maybeWarnHintLimit]);

  // Determine if AI is allowed and which modes based on assignment restrictions
  const aiAllowed = assignmentRestrictions?.allowAI !== false; // Default to true if not set
  const allowedModes = assignmentRestrictions?.allowedModes || [/* 'feedback', */ 'suggest', 'answer'];

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
      sileo.info({ title: "Board updated by another user", description: "Reloading canvas...", duration: 2000 });

      try {
        if (updatedBoard.data && Object.keys(updatedBoard.data).length > 0) {
          loadSnapshot(editor.store, updatedBoard.data);
          logger.info({ boardId: id }, "Canvas reloaded from remote update");
        }
      } catch (error) {
        console.error("Failed to reload canvas from remote update:", error);
        sileo.error({ title: "Failed to sync changes" });
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
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Palm rejection - ignore large touch areas
      const touch = e.touches[0];
      if (touch && (touch as Touch & { radiusX?: number }).radiusX && (touch as Touch & { radiusX?: number }).radiusX! > 20) {
        // Likely a palm, but don't prevent - TLDraw handles this
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
  const getStatusMessage = useCallback((mode: "off" | /* "feedback" | */ "suggest" | "answer", statusType: "generating" | "success") => {
    if (statusType === "generating") {
      switch (mode) {
        case "off":
          return "";
        // case "feedback":
        //   return "Adding feedback...";
        case "suggest":
          return "Generating suggestion...";
        case "answer":
          return "Solving problem...";
      }
    } else if (statusType === "success") {
      switch (mode) {
        case "off":
          return "";
        // case "feedback":
        //   return "Feedback added";
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
    } else {
      // Fall back to user's preferred AI mode from settings
      const stored = localStorage.getItem('agathon_pref_ai_mode');
      if (/* stored === 'feedback' || */ stored === 'suggest' || stored === 'answer') {
        setAssistanceMode(stored);
      }
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
      modeOverride?: /* "feedback" | */ "suggest" | "answer";
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

      // Enforce AI restrictions for remote AI modes
      if (mode !== "off") {
        if (!aiAllowed) {
          logger.info('AI assistance is disabled for this assignment');
          mode = "off";
        } else if (!isModeAllowed(mode)) {
          logger.info({ mode }, 'This AI mode is not allowed for this assignment');
          sileo.error({ title: `${mode} mode is not allowed for this assignment` });
          mode = "off";
        }
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
          
          // Ensure viewport has reasonable dimensions to avoid SVG attribute errors
          if (viewportBounds.width < 50 || viewportBounds.height < 50) {
            logger.warn({ width: viewportBounds.width, height: viewportBounds.height }, 'Viewport too small for generation');
            isProcessingRef.current = false;
            return false;
          }
          
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

        // Quick solve is now handled by MyScriptMathOverlay (real-time as you write)
        // This function only handles the AI modes (feedback, suggest, answer with detailed explanation)

        // If mode is off, we're done (MyScript handles quick solving separately)
        if (mode === "off") {
          setStatus("idle");
          setStatusMessage("");
          isProcessingRef.current = false;
          return false;
        }

        // Generate solution using AI (Gemini decides if help is needed)
        setStatus("generating");
        setStatusMessage(getStatusMessage(mode, "generating"));

          const body: Record<string, unknown> = {
            image: base64,
            mode,
            isSocratic: assignmentRestrictions?.socraticMode ?? false,
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
          const feedback = solutionData.feedback;
          const textContent = solutionData.textContent || '';
          const isPremium = solutionData.isPremium;
          const imageUrl = solutionData.imageUrl as string | null | undefined;

          logger.info({
            hasFeedback: !!feedback,
            annotationCount: feedback?.annotations?.length || 0,
            summary: feedback?.summary?.slice(0, 100),
            isPremium,
            hasImageUrl: !!imageUrl,
          }, 'Solution data received');

          // If no feedback was returned, stop gracefully
          const hasAnnotations = feedback?.annotations && feedback.annotations.length > 0;
          const hasFeedbackContent = hasAnnotations || (isPremium && imageUrl);

          if (!hasFeedbackContent || signal.aborted) {
            logger.info({ textContent, hasAnnotations, isPremium, hasImageUrl: !!imageUrl }, 'No feedback content returned');
            setStatus("idle");
            setStatusMessage("");
            isProcessingRef.current = false;
            return false;
          }


        if (signal.aborted) return false;

        logger.info('Creating feedback annotations on canvas...');

        // Set flag to prevent these shape additions from triggering activity detection
        isUpdatingImageRef.current = true;

        // Get color based on annotation type
        const getAnnotationColor = (type: string): string => {
          switch (type) {
            case 'correction': return 'red';
            case 'hint': return 'yellow';
            case 'encouragement': return 'green';
            case 'step': return 'blue';
            case 'answer': return 'violet';
            default: return 'yellow';
          }
        };

        // Create note shapes for each annotation
        const createdShapeIds: TLShapeId[] = [];
        const noteWidth = 200;  // Smaller notes
        const noteHeight = 100; // Smaller height
        const padding = 15;
        const verticalGap = 10;

        // Position notes alternating between left and right sides
        let leftYOffset = viewportBounds.y + padding;
        let rightYOffset = viewportBounds.y + padding;
        const leftXPosition = viewportBounds.x + padding;
        const rightXPosition = viewportBounds.x + viewportBounds.width - noteWidth - padding;

        // In "feedback" mode, show at full opacity without accept/reject
        // In "suggest" and "answer" modes, show at reduced opacity with accept/reject
        const isFeedbackMode = false; // mode === "feedback" — feedback mode disabled

        // Create feedback shapes
        if (isPremium && imageUrl) {
          // Premium: Paste a hand-drawn image of the feedback
          const assetId = AssetRecordType.createId();
          const shapeId = createShapeId();

          // Load image to get dimensions
          const img = new Image();
          await new Promise((resolve) => {
            img.onload = resolve;
            img.src = imageUrl;
          });

          // Scale image to fit viewport nicely
          const scale = Math.min(
            (viewportBounds.width * 0.8) / img.width,
            (viewportBounds.height * 0.8) / img.height,
            1.0
          );
          const w = img.width * scale;
          const h = img.height * scale;

          editor.createAssets([
            {
              id: assetId,
              type: 'image',
              typeName: 'asset',
              props: {
                name: 'ai-handwriting.png',
                src: imageUrl,
                w: img.width,
                h: img.height,
                mimeType: 'image/png',
                isAnimated: false,
              },
              meta: {},
            },
          ]);

          editor.createShape({
            id: shapeId,
            type: "image",
            x: viewportBounds.x + (viewportBounds.width - w) / 2,
            y: viewportBounds.y + (viewportBounds.height - h) / 2,
            opacity: isFeedbackMode ? 1.0 : 0.8,
            isLocked: true,
            props: {
              w,
              h,
              assetId,
            },
            meta: {
              aiGenerated: true,
              aiMode: mode,
              aiTimestamp: new Date().toISOString(),
            },
          });

          createdShapeIds.push(shapeId);
        } else {
          // Free tier: Show floating FeedbackCard with LaTeX support
          // Position card in top-right area of the viewport
          const cardX = viewportBounds.x + viewportBounds.width - 340;
          const cardY = viewportBounds.y + 80;

          // Convert screen coordinates
          const screenPoint = editor.pageToScreen({ x: cardX, y: cardY });

          setFeedbackCard({
            summary: feedback.summary || '',
            annotations: feedback.annotations.map((a: { type: string; content: string }) => ({
              type: a.type,
              content: a.content,
            })),
            isCorrect: feedback.isCorrect,
            solution: (feedback as any).solution,
            position: { x: screenPoint.x, y: screenPoint.y },
          });

          // Also store for AI Tutor analysis
          setAiTutorImage(base64);
          setAiTutorAnswer(feedback.summary || textContent);
        }

        // Only add to pending list if not in feedback mode
        if (!isFeedbackMode) {
          setPendingImageIds((prev) => [...prev, ...createdShapeIds]);
        }

        // Track AI usage for teacher analytics
        trackAIUsage(mode, options?.promptOverride, textContent);

        /* ====== COMMENTED OUT: Image-based solution generation (for future use) ======
        const imageUrl = solutionData.imageUrl as string | null | undefined;

        logger.info({
          hasImageUrl: !!imageUrl,
          imageUrlLength: imageUrl?.length,
          imageUrlStart: imageUrl?.slice(0, 50),
          textContent: textContent.slice(0, 100),
        }, 'Solution data received');

        // If the model didn't return an image, it means Gemini decided help isn't needed.
        if (!imageUrl || signal.aborted) {
          logger.info({ textContent }, 'Gemini decided help is not needed');
          setStatus("idle");
          setStatusMessage("");
          isProcessingRef.current = false;
          return false;
        }

        const processedImageUrl = imageUrl;

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

        logger.info('Creating asset and shape...');

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
          opacity: isFeedbackMode ? 1.0 : 0.3,
          isLocked: true,
          props: {
            w: shapeWidth,
            h: shapeHeight,
            assetId: assetId,
          },
          meta: {
            aiGenerated: true,
            aiMode: mode,
            aiTimestamp: new Date().toISOString(),
          },
        });

        if (!isFeedbackMode) {
          setPendingImageIds((prev) => [...prev, shapeId]);
        }

        trackAIUsage(mode, options?.promptOverride, textContent);
        ====== END COMMENTED OUT ====== */
          
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
      [editor, pendingImageIds, isVoiceSessionActive, assistanceMode, getStatusMessage, trackAIUsage],
    );

  // Auto-solve disabled — users now trigger AI via the lasso tool action prompt

  // Generate solution for specific lassoed shapes
  const generateSolutionForShapes = useCallback(
    async (shapeIds: TLShapeId[], bounds: { x: number; y: number; width: number; height: number }, modeOverride?: /* 'feedback' | */ 'suggest' | 'answer') => {
      if (!editor || shapeIds.length === 0 || isProcessingRef.current) return;

      // Use explicit modeOverride from lasso prompt, fall back to current assistanceMode
      let mode = modeOverride ?? (assistanceMode === 'off' ? 'answer' : assistanceMode);

      // Enforce AI restrictions
      if (!aiAllowed) {
        sileo.error({ title: 'AI assistance is disabled for this assignment' });
        return;
      }
      if (!isModeAllowed(mode)) {
        sileo.error({ title: `${mode} mode is not allowed for this assignment` });
        return;
      }

      isProcessingRef.current = true;
      setStatus('generating');
      setStatusMessage('Solving selected problem...');

      try {
        logger.info({ shapeIds: shapeIds.length, bounds }, 'Lasso solve starting');

        // Capture only the lassoed shapes
        let blob: Blob | undefined;
        try {
          // Create bounds box for the capture with some padding
          const captureBounds = new Box(
            bounds.x - 20,
            bounds.y - 20,
            bounds.width + 40,
            bounds.height + 40
          );

          const result = await editor.toImage(shapeIds, {
            format: 'png',
            bounds: captureBounds,
            background: true,
            scale: 1,
            padding: 0,
          });
          blob = result.blob;
        } catch (captureError) {
          logger.error({ captureError }, 'Failed to capture shapes with toImage');
          throw new Error('Failed to capture selected shapes');
        }

        if (!blob) {
          throw new Error('Failed to capture shapes - no blob returned');
        }

        logger.info({ blobSize: blob.size }, 'Shape capture successful');

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        const solutionResponse = await fetch('/api/generate-solution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            mode,
            isSocratic: assignmentRestrictions?.socraticMode ?? false,
            source: 'lasso',
          }),
        });

        if (!solutionResponse.ok) {
          throw new Error('Solution generation failed');
        }

        const solutionData = await solutionResponse.json();
        const feedback = solutionData.feedback;
        const isPremium = solutionData.isPremium;
        const imageUrl = solutionData.imageUrl as string | null | undefined;

        const hasAnnotations = feedback?.annotations && feedback.annotations.length > 0;
        const hasFeedbackContent = hasAnnotations || (isPremium && imageUrl);

        if (!hasFeedbackContent) {
          setStatus('idle');
          setStatusMessage('');
          sileo.info({ title: 'No solution needed for this selection' });
          return;
        }

        // Set flag to prevent triggering activity detection
        isUpdatingImageRef.current = true;

        // Position the response near the lassoed area (to the right)
        const responseX = bounds.x + bounds.width + 30;
        const responseY = bounds.y;

        if (isPremium && imageUrl) {
          // Premium: place the generated image
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });

          const maxWidth = 400;
          const scale = Math.min(1, maxWidth / img.width);
          const w = img.width * scale;
          const h = img.height * scale;

          const assetId = AssetRecordType.createId();
          editor.createAssets([{
            id: assetId,
            type: 'image',
            typeName: 'asset',
            props: {
              name: 'ai-solution.png',
              src: imageUrl,
              w: img.width,
              h: img.height,
              mimeType: 'image/png',
              isAnimated: false,
            },
            meta: {},
          }]);

          const shapeId = createShapeId();
          editor.createShape({
            id: shapeId,
            type: 'image',
            x: responseX,
            y: responseY,
            isLocked: true,
            opacity: 0.9,
            props: { w, h, assetId },
            meta: {
              aiGenerated: true,
              aiMode: mode,
              aiTimestamp: new Date().toISOString(),
            },
          });

          setPendingImageIds((prev) => [...prev, shapeId]);
        } else if (hasAnnotations) {
          // Free tier: show FeedbackCard with LaTeX support
          const screenPoint = editor.pageToScreen({ x: responseX, y: responseY });

          setFeedbackCard({
            summary: feedback.summary || '',
            annotations: feedback.annotations.map((a: any) => ({
              type: a.type,
              content: a.content || a.message || '',
            })),
            isCorrect: feedback.isCorrect,
            solution: (feedback as any).solution,
            position: { x: screenPoint.x, y: screenPoint.y },
          });

          // Store for AI Tutor analysis
          setAiTutorImage(base64);
          setAiTutorAnswer(feedback.summary || '');
        }

        // Track AI usage
        await trackAIUsage(mode, 'Lasso-selected problem');

        setStatus('idle');
        setStatusMessage('');
        sileo.success({ title: 'Solution generated!' });

      } catch (error) {
        console.error('[LassoSolve] Error:', error);
        logger.error({ error, message: error instanceof Error ? error.message : 'unknown' }, 'Lasso solve error');
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Generation failed');
        setTimeout(() => {
          setStatus('idle');
          setErrorMessage('');
        }, 3000);
      } finally {
        isProcessingRef.current = false;
        isUpdatingImageRef.current = false;
      }
    },
    [editor, assistanceMode, aiAllowed, isModeAllowed, assignmentRestrictions, trackAIUsage],
  );

  // Listen for lasso solve events — show action prompt
  useEffect(() => {
    const handleLassoSolve = (event: Event) => {
      const customEvent = event as CustomEvent<LassoSolveCompleteEvent>;
      const { shapeIds, bounds } = customEvent.detail;
      if (!editor) return;

      try {
        // Convert the center-bottom of the bounds to screen coordinates
        const screenPoint = editor.pageToScreen({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height });
        setLassoPrompt({
          shapeIds,
          bounds,
          screenPos: { x: screenPoint.x, y: screenPoint.y },
        });
      } catch (err) {
        // Fallback: center of viewport
        logger.error({ err }, 'pageToScreen failed for lasso prompt');
        setLassoPrompt({
          shapeIds,
          bounds,
          screenPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        });
      }
    };

    window.addEventListener('lasso-solve-complete', handleLassoSolve);
    return () => window.removeEventListener('lasso-solve-complete', handleLassoSolve);
  }, [editor]);

  // Handle lasso action prompt selection — all actions open AI chat
  const handleLassoAction = useCallback(
    async (action: /* 'feedback' | */ 'suggest' | 'answer' | 'chat') => {
      if (!lassoPrompt || !editor) return;
      const { shapeIds, bounds } = lassoPrompt;
      setLassoPrompt(null);

      // All actions now open the AI Tutor chat (sticky note generation disabled)
      try {
        const captureBounds = new Box(
          bounds.x - 20,
          bounds.y - 20,
          bounds.width + 40,
          bounds.height + 40,
        );
        const result = await editor.toImage(shapeIds, {
          format: 'png',
          bounds: captureBounds,
          background: true,
          scale: 1,
          padding: 0,
        });
        if (result.blob) {
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(result.blob);
          });
          setAiTutorImage(base64);
          setAiTutorOpen(true);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to capture lasso shapes for AI Tutor');
      }
    },
    [lassoPrompt, editor],
  );

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

      const shape = editor.getShape(shapeId);
      if (!shape) return;

      // Set flag to prevent triggering activity detection
      isUpdatingImageRef.current = true;

      // First unlock to ensure we can update opacity
      editor.updateShape({
        id: shapeId,
        type: shape.type as any,
        isLocked: false,
        opacity: 1,
        meta: {
          ...shape.meta,
          aiGenerated: false, // Mark as no longer AI-generated content (accepted)
        }
      });

      // Then immediately lock it again to make it non-selectable
      editor.updateShape({
        id: shapeId,
        type: shape.type as any,
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

      const shape = editor.getShape(shapeId);
      if (!shape) return;

      // Set flag to prevent triggering activity detection
      isUpdatingImageRef.current = true;

      // Unlock the shape first, then delete it
      editor.updateShape({
        id: shapeId,
        type: shape.type as any,
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
                  background: true,
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
              const MAX_PREVIEW_LENGTH = 200000;
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

  // AI shape count for teacher view (set via TeacherAIIndicator callback)
  const [aiShapeCount, setAiShapeCount] = useState(0);

  return (
    <>
      {/* MyScript real-time math recognition - currently disabled */}
      <MyScriptMathOverlay
        editor={editor}
        enabled={false}
        onResult={() => {}}
      />

      {/* Active users indicator */}
      {activeUsers.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[var(--z-controls)] ios-safe-bottom ios-safe-right">
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

      {/* AI Content Stats for Teachers */}
      {isTeacherViewing && aiShapeCount > 0 && (
        <div className="fixed bottom-4 left-4 z-[var(--z-controls)] ios-safe-bottom ios-safe-left">
          <div className="bg-sky-100 dark:bg-sky-900/30 border border-sky-300 dark:border-sky-700 rounded-lg shadow-sm px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-sky-500" />
              <span className="text-sm font-semibold text-sky-800 dark:text-sky-300">AI Usage Detected</span>
            </div>
            <p className="text-xs text-sky-700 dark:text-sky-400">
              {aiShapeCount} AI-generated {aiShapeCount === 1 ? 'element' : 'elements'} on this canvas
            </p>
          </div>
        </div>
      )}

      {/* Unified Top Bar */}
      <TopBar
        onBack={() => router.back()}
        assignmentTitle={boardTitle || (isAssignmentBoard ? 'Assignment' : undefined)}
        assignmentSubject={assignmentMeta?.subject}
        assignmentGradeLevel={assignmentMeta?.gradeLevel}
        assignmentInstructions={assignmentMeta?.instructions}
        submissionStatus={submissionId ? (isSubmitted ? 'submitted' : 'in_progress') : null}
        isAssignmentBoard={isAssignmentBoard}
        assistanceMode={assistanceMode}
        onModeChange={(value) => setAssistanceMode(value as "off" | /* "feedback" | */ "suggest" | "answer")}
        aiAllowed={aiAllowed}
        isModeAllowed={isModeAllowed}
        status={status}
        statusMessage={statusMessage}
        errorMessage={errorMessage}
        hintLimit={hintLimit}
        hintsRemaining={hintsRemaining}
        isTeacherViewing={isTeacherViewing ?? false}
        isVoiceSessionActive={isVoiceSessionActive}
        bannerOffset={hasBanner ? 40 : 0}
        isDocPanelOpen={docPanelOpen}
      />

      <ImageActionButtons
        pendingImageIds={pendingImageIds}
        isVoiceSessionActive={isVoiceSessionActive}
        onAccept={handleAccept}
        onReject={handleReject}
      />

          {/* Document Panel — shows when board was created from a KB document with a URL */}
          {assignmentMeta?.documentUrl && (
            <>
              <DocumentPanel
                url={assignmentMeta.documentUrl}
                title={assignmentMeta.documentTitle || 'Document'}
                isOpen={docPanelOpen}
                onClose={() => setDocPanelOpen?.(false)}
              />
              {!docPanelOpen && (
                <button
                  onClick={() => setDocPanelOpen?.(true)}
                  className="fixed right-3 top-16 z-[var(--z-panel)] bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-md p-2 hover:bg-muted transition-colors"
                  title="Show document"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </>
          )}

{/* AI Tutor Panel + Button - hide when teacher is viewing student board */}
          {!isTeacherViewing && (
            <>
              <AITutorPanel
                isOpen={aiTutorOpen}
                onClose={() => setAiTutorOpen(false)}
                activeTab={aiTutor.activeTab}
                setActiveTab={aiTutor.setActiveTab}
                messages={aiTutor.messages}
                isChatLoading={aiTutor.isChatLoading}
                isSocratic={aiTutor.isSocratic}
                setIsSocratic={aiTutor.setIsSocratic}
                sendMessage={aiTutor.sendMessage}
                checkWork={aiTutor.checkWork}
                clearChat={aiTutor.clearChat}
                stopChatGeneration={aiTutor.stopChatGeneration}
                analysisData={aiTutor.analysisData}
                isAnalysisLoading={aiTutor.isAnalysisLoading}
                analysisError={aiTutor.analysisError}
                analysisConversation={aiTutor.analysisConversation}
                isAnalysisStreaming={aiTutor.isAnalysisStreaming}
                sendAnalysisFollowUp={aiTutor.sendAnalysisFollowUp}
              />
            </>
          )}

          {/* AI Content Indicator for Teacher View */}
          {isTeacherViewing && editor && (
            <TeacherAIIndicator editor={editor} onAIShapeCount={setAiShapeCount} />
          )}

          {/* Onboarding overlay - shows on first visit, dismisses when drawing starts */}
          {showOnboarding && !isTeacherViewing && (
            <WhiteboardOnboarding onDismiss={() => setShowOnboarding(false)} />
          )}

          {/* Grouped floating controls — bottom-right */}
          {!isTeacherViewing && editor && (
            <div className="fixed bottom-4 right-4 z-[var(--z-panel)] ios-safe-bottom ios-safe-right flex flex-col items-end gap-2">
              <HintButton
                isLoading={isHintLoading}
                onClick={async () => {
                  if (isHintLoading) return;
                  const shapeIds = editor.getCurrentPageShapeIds();
                  if (shapeIds.size === 0) {
                    sileo.info({ title: 'Draw something first to get a hint!' });
                    return;
                  }
                  setIsHintLoading(true);
                  try {
                    await generateSolution({ modeOverride: 'suggest', force: true });
                  } finally {
                    setIsHintLoading(false);
                  }
                }}
              />
              <AITutorButton
                onClick={() => setAiTutorOpen(true)}
                isOpen={aiTutorOpen}
                messageCount={aiTutor.messages.length}
              />
            </div>
          )}

          {/* Lasso Action Prompt — all actions now open AI chat */}
          {lassoPrompt && (
            <LassoActionPrompt
              position={lassoPrompt.screenPos}
              onAction={handleLassoAction}
              isClosing={lassoPromptClosing}
              onDismiss={() => {
                setLassoPromptClosing(true);
                setTimeout(() => {
                  setLassoPrompt(null);
                  setLassoPromptClosing(false);
                }, 150);
              }}
            />
          )}

          {/* Feedback Card (Free tier) */}
          {feedbackCard && (
            <FeedbackCard
              summary={feedbackCard.summary}
              annotations={feedbackCard.annotations as any}
              isCorrect={feedbackCard.isCorrect}
              solution={feedbackCard.solution}
              position={feedbackCard.position}
              isClosing={feedbackCardClosing}
              onClose={() => {
                setFeedbackCardClosing(true);
                setTimeout(() => {
                  setFeedbackCard(null);
                  setFeedbackCardClosing(false);
                }, 200);
              }}
              onDragEnd={(x, y) => {
                setFeedbackCard(prev => prev ? { ...prev, position: { x, y } } : null);
              }}
            />
          )}

    </>
  );
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);
  const [assignmentMeta, setAssignmentMeta] = useState<AssignmentMeta | null>(null);
  const [boardTitle, setBoardTitle] = useState<string>("");
  const [canEdit, setCanEdit] = useState(true);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isTeacherViewing, setIsTeacherViewing] = useState(false);
  const [studentName, setStudentName] = useState<string>("");
  const [showTutorial, setShowTutorial] = useState(false);
  const [docPanelOpen, setDocPanelOpen] = useState(false);
  const [gcSubmitting, setGcSubmitting] = useState(false);
  const [gcSubmitted, setGcSubmitted] = useState(false);

  // Open doc panel once assignmentMeta loads with a documentUrl
  useEffect(() => {
    if (assignmentMeta?.documentUrl) setDocPanelOpen(true);
  }, [assignmentMeta]);

  // Check if this GC assignment was already submitted
  useEffect(() => {
    async function checkGcSubmissionStatus() {
      if (!assignmentMeta?.gcCourseworkId) return;
      try {
        const { data } = await supabase
          .from('knowledge_base')
          .select('metadata')
          .eq('source', 'google_classroom')
          .eq('source_id', `cw_${assignmentMeta.gcCourseworkId}`)
          .maybeSingle();
        if ((data?.metadata as Record<string, unknown>)?.submission_state === 'TURNED_IN') {
          setGcSubmitted(true);
        }
      } catch { /* best-effort */ }
    }
    checkGcSubmissionStatus();
  }, [assignmentMeta]);

  const handleGoogleClassroomSubmit = async () => {
    if (!assignmentMeta?.gcCourseId || !assignmentMeta?.gcCourseworkId) return;

    if (!confirm('Submit this whiteboard to Google Classroom? A link to your board will be attached and the assignment will be turned in.')) {
      return;
    }

    setGcSubmitting(true);
    try {
      const res = await fetch('/api/classroom/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: assignmentMeta.gcCourseId,
          courseworkId: assignmentMeta.gcCourseworkId,
          boardId: id,
          boardTitle: boardTitle || 'Whiteboard',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsReconnect) {
          sileo.error({ title: 'Google Classroom connection expired. Please reconnect in Knowledge Base.' });
        } else if (data.alreadySubmitted) {
          sileo.info({ title: 'This assignment was already turned in on Google Classroom.' });
          setGcSubmitted(true);
        } else {
          sileo.error({ title: data.error || 'Failed to submit to Google Classroom' });
        }
        return;
      }

      sileo.success({ title: 'Submitted to Google Classroom!' });
      setGcSubmitted(true);
    } catch (error) {
      console.error('Google Classroom submission error:', error);
      sileo.error({ title: 'Failed to submit to Google Classroom' });
    } finally {
      setGcSubmitting(false);
    }
  };

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
          .select('data, metadata, title, user_id, is_public')
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

            if (share?.permission === 'edit') {
              setCanEdit(true);
            } else if (share?.permission === 'view' || (data as any).is_public) {
              // View-only: explicit share or public board (e.g. submitted to Google Classroom)
              setCanEdit(false);
            } else {
              setCanEdit(false);
            }
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

          // Get current user
          const { data: { user } } = await supabase.auth.getUser();

          if (submission && user) {
            // Check if current user is the teacher of this assignment's class
            if (submission.assignment?.class?.id) {
              const { data: classData } = await supabase
                .from('classes')
                .select('teacher_id')
                .eq('id', submission.assignment.class.id)
                .single();

              if (classData?.teacher_id === user.id) {
                // Current user is the teacher viewing a student's board
                setIsTeacherViewing(true);
                setCanEdit(false); // Teachers can view but not edit student boards

                // Get student name for the banner
                const { data: studentProfile } = await supabase
                  .from('profiles')
                  .select('full_name, email')
                  .eq('id', submission.student_id)
                  .single();

                setStudentName(studentProfile?.full_name || studentProfile?.email || 'Student');
              } else if (submission.status === 'submitted') {
                // Student viewing their own submitted assignment
                setCanEdit(false);
              }
            }
          } else if (submission?.status === 'submitted') {
            // Lock the board if already submitted
            setCanEdit(false);
          }
        } catch (error) {
          console.error('Error checking assignment:', error);
        }
      }
    }
    checkIfAssignment();
  }, [id]);

  // Check if user should see tutorial (first-time board user)
  useEffect(() => {
    async function checkTutorialStatus() {
      // Don't show tutorial for temp boards or if teacher is viewing
      if (id.startsWith('temp-') || isTeacherViewing) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('has_completed_board_tutorial')
          .eq('id', user.id)
          .single();

        const localCompleted = localStorage.getItem('board_tutorial_completed');

        // Temporarily disabled onboarding flow
        // if (!profile?.has_completed_board_tutorial && !localCompleted && !loading) {
        //   // Delay to let the UI render first
        //   setTimeout(() => setShowTutorial(true), 2000);
        // }
      } catch (error) {
        console.error('Error checking tutorial status:', error);
      }
    }

    checkTutorialStatus();
  }, [id, isTeacherViewing, loading]);

  // Update editor read-only state when canEdit changes
  useEffect(() => {
    const editor = (window as any).__tldrawEditor;
    if (editor) {
      editor.updateInstanceState({ isReadonly: !canEdit });
    }
  }, [canEdit]);

  // Apply background styles based on template metadata by creating background shapes
  useEffect(() => {
    const backgroundStyle = assignmentMeta?.backgroundStyle || initialData?.metadata?.backgroundStyle;

    if (!backgroundStyle) return;

    let attempts = 0;
    const maxAttempts = 20;
    let hasCreated = false;

    const intervalId = setInterval(() => {
      const editor = (window as any).__tldrawEditor;
      attempts++;

      if (editor && !loading && !hasCreated) {
        hasCreated = true;
        clearInterval(intervalId);
        createBackgroundShape(editor, backgroundStyle);
      } else if (attempts >= maxAttempts) {
        clearInterval(intervalId);
      }
    }, 100);

    const createBackgroundShape = (editor: any, style: string) => {
      // Create multiple smaller tiles instead of one huge image for better performance
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      // Much smaller tile size - will create multiple
      const tileSize = 1000;
      canvas.width = tileSize;
      canvas.height = tileSize;

      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tileSize, tileSize);

      if (style === 'lined') {
        // Draw horizontal lines
        ctx.strokeStyle = '#e2e4e8';
        ctx.lineWidth = 1;
        const lineSpacing = 32;

        for (let y = 0; y < tileSize; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(tileSize, y);
          ctx.stroke();
        }
      } else if (style === 'grid') {
        // Draw grid
        ctx.strokeStyle = '#e2e4e8';
        ctx.lineWidth = 1;
        const gridSize = 20;

        // Vertical lines
        for (let x = 0; x < tileSize; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, tileSize);
          ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y < tileSize; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(tileSize, y);
          ctx.stroke();
        }
      }

      const dataUrl = canvas.toDataURL('image/png');

      // Create the background as a single centered tile
      const assetId = AssetRecordType.createId();
      const shapeId = createShapeId();

      editor.createAssets([{
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: `background-${style}.png`,
          src: dataUrl,
          w: tileSize,
          h: tileSize,
          mimeType: 'image/png',
          isAnimated: false,
        },
        meta: {}
      }]);

      editor.createShape({
        id: shapeId,
        type: 'image',
        x: -tileSize / 2,
        y: -tileSize / 2,
        props: {
          assetId,
          w: tileSize,
          h: tileSize,
        },
        isLocked: true,
      });

      // Send to back
      editor.sendToBack([shapeId]);
    };

    return () => {
      clearInterval(intervalId);
    };
  }, [assignmentMeta, initialData, loading]);

  // Handle uploaded files from template selection
  useEffect(() => {
    console.log('[Upload Effect] Effect triggered, searchParams:', searchParams.toString());

    const hasUpload = searchParams.get('hasUpload');
    console.log('[Upload Effect] hasUpload param:', hasUpload);

    if (!hasUpload) {
      console.log('[Upload Effect] No hasUpload param, exiting');
      return;
    }

    // Check if data is in sessionStorage (if not, we already processed it)
    const storedData = sessionStorage.getItem('uploadedFile');
    if (!storedData) {
      console.log('[Upload Effect] No data in sessionStorage, already processed');
      return;
    }

    console.log('[Upload Effect] Starting upload process...');

    // Clear URL param immediately to prevent re-triggering
    router.replace(`/board/${id}`);
    console.log('[Upload Effect] Cleared URL param');

    let attempts = 0;
    const maxAttempts = 20;
    let hasLoaded = false;

    const intervalId = setInterval(() => {
      const editor = (window as any).__tldrawEditor;
      attempts++;

      console.log(`[Upload Effect] Attempt ${attempts}: editor=${!!editor}, loading=${loading}, hasLoaded=${hasLoaded}`);

      if (editor && !loading && !hasLoaded) {
        console.log('[Upload Effect] Editor ready, calling loadUploadedFiles');
        hasLoaded = true;
        clearInterval(intervalId);
        loadUploadedFiles(editor);
      } else if (attempts >= maxAttempts) {
        console.log('[Upload Effect] Max attempts reached, giving up');
        clearInterval(intervalId);
        if (!hasLoaded) {
          sileo.error({ title: 'Failed to initialize editor' });
        }
      }
    }, 100);

    const loadUploadedFiles = async (editor: any) => {
      try {
        // Retrieve from sessionStorage
        const storedData = sessionStorage.getItem('uploadedFile');
        if (!storedData) {
          console.log('No stored file data');
          return;
        }

        console.log('Found stored file data, length:', storedData.length);

        // Clear from sessionStorage
        sessionStorage.removeItem('uploadedFile');

        // Parse the data
        const parsed = JSON.parse(storedData);
        let imageUrls: string[];

        // Check if it's an array (multi-page PDF) or single image
        imageUrls = Array.isArray(parsed) ? parsed : [parsed];
        console.log(`Loading ${imageUrls.length} image(s)`);

        const viewportBounds = editor.getViewportPageBounds();
        const viewportCenter = viewportBounds.center;
        const maxDimension = 600;
        let currentY = viewportCenter.y;

        for (let i = 0; i < imageUrls.length; i++) {
          const imageUrl = imageUrls[i];

          await new Promise<void>((resolve) => {
            const img = new Image();

            img.onload = () => {
              const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;

              const assetId = AssetRecordType.createId();
              const shapeId = createShapeId();

              // Create asset
              editor.createAssets([{
                id: assetId,
                type: 'image',
                typeName: 'asset',
                props: {
                  name: `uploaded-file-${i + 1}.png`,
                  src: imageUrl,
                  w: img.width,
                  h: img.height,
                  mimeType: 'image/png',
                  isAnimated: false,
                },
                meta: {}
              }]);

              // Create image shape
              editor.createShape({
                id: shapeId,
                type: 'image',
                x: viewportCenter.x - scaledWidth / 2,
                y: currentY - scaledHeight / 2,
                props: {
                  assetId,
                  w: scaledWidth,
                  h: scaledHeight,
                }
              });

              // Update Y position for next image (with spacing)
              currentY += scaledHeight + 20;

              resolve();
            };

            img.onerror = () => {
              sileo.error({ title: 'Failed to load uploaded image' });
              resolve();
            };

            img.src = imageUrl;
          });
        }

        // Zoom to fit all uploaded images
        editor.zoomToFit();
      } catch (error) {
        console.error('Error loading uploaded files:', error);
        sileo.error({ title: 'Failed to load uploaded files' });
      }
    };

    return () => {
      clearInterval(intervalId);
    };
  }, [searchParams, loading, id, router]);

  const handleSubmit = async () => {
    if (!submissionData) return;

    if (!confirm('Submit this assignment? Your work will be locked and you won\'t be able to make further changes.')) {
      return;
    }

    setSubmitting(true);
    try {
      await updateSubmissionStatus(submissionData.id, 'submitted');
      sileo.success({ title: 'Assignment submitted! Your work is now locked.' });
      setSubmissionData({
        ...submissionData,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      });
      // Lock the board by disabling edit
      setCanEdit(false);

      // Also submit to Google Classroom if this is a GC-linked assignment
      const gcCourseId = (submissionData.assignment as any)?.class?.gc_course_id;
      const gcCourseworkId = (submissionData.assignment as any)?.gc_coursework_id;
      if (gcCourseId && gcCourseworkId) {
        try {
          const res = await fetch('/api/classroom/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: gcCourseId,
              courseworkId: gcCourseworkId,
              boardId: id,
              boardTitle: boardTitle || 'Whiteboard',
            }),
          });
          if (res.ok) {
            sileo.success({ title: 'Also submitted to Google Classroom!' });
          }
        } catch {
          // GC submission is best-effort, don't block the main submit
          console.error('Failed to submit to Google Classroom');
        }
      }
    } catch (error) {
      console.error('Error submitting assignment:', error);
      sileo.error({ title: 'Failed to submit assignment' });
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
  const hasViewOnlyBanner = !canEdit && !submissionData && !isTeacherViewing;
  const hasSubmittedBanner = !canEdit && submissionData?.status === 'submitted' && !isTeacherViewing;
  const hasTeacherBanner = isTeacherViewing;

  // Banners + top bar push down the canvas
  const TOP_NOTICE_HEIGHT = 40; // py-2 banner
  const TOP_BAR_HEIGHT = 48; // h-12 top bar
  const bannerHeight =
    (hasViewOnlyBanner ? TOP_NOTICE_HEIGHT : 0) +
    (hasSubmittedBanner ? TOP_NOTICE_HEIGHT : 0) +
    (hasTeacherBanner ? TOP_NOTICE_HEIGHT : 0);
  const topOffset = bannerHeight + TOP_BAR_HEIGHT;

  return (
    <div style={{ position: "fixed", inset: 0, top: topOffset }}>
      {/* View-only banner */}
      {!canEdit && !submissionData && (
        <div className="fixed top-0 left-0 right-0 z-[var(--z-banner)] bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          View Only - You don't have permission to edit this board
        </div>
      )}

      {/* Submitted assignment banner */}
      {!canEdit && submissionData?.status === 'submitted' && !isTeacherViewing && (
        <div className="fixed top-0 left-0 right-0 z-[var(--z-banner)] bg-green-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Check className="w-4 h-4" />
          Assignment Submitted - Your work has been locked
        </div>
      )}

      {/* Teacher viewing student board banner */}
      {isTeacherViewing && (
        <div className="fixed top-0 left-0 right-0 z-[var(--z-banner)] bg-blue-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <Eye className="w-4 h-4" />
          Viewing {studentName}'s submission - AI-generated content is highlighted in blue
        </div>
      )}

      {/* Assignment pill is now in TopBar */}

      {/* Google Classroom submit button - shown for boards from GC assignments */}
      {assignmentMeta?.gcCourseId && assignmentMeta?.gcCourseworkId && !isTeacherViewing && (
        <div className="fixed bottom-4 left-4 z-[var(--z-controls)]" style={{ pointerEvents: 'auto' }}>
          {gcSubmitted ? (
            <div className="bg-green-100 border border-green-300 rounded-full px-4 py-2 flex items-center gap-2 shadow-md">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">Submitted to Google Classroom</span>
            </div>
          ) : (
            <Button
              onClick={handleGoogleClassroomSubmit}
              disabled={gcSubmitting}
              className="rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white px-4"
            >
              {gcSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {gcSubmitting ? 'Submitting...' : 'Submit to Google Classroom'}
            </Button>
          )}
        </div>
      )}

        <DocumentPanelContext.Provider value={docPanelOpen}>
        <Tldraw
          licenseKey="tldraw-2026-03-19/WyJSZHJJZ3NSWCIsWyIqIl0sMTYsIjIwMjYtMDMtMTkiXQ.8X9Dhayg/Q1F82ArvwNCMl//yOg8tTOTqLIfhMAySFKg50Wq946/jip5Qved7oDYoVA+YWYTNo4/zQEPK2+neQ"
          tools={[LassoSolveTool]}
          shapeUtils={[LaTeXShapeUtil]}
          overrides={hugeIconsOverrides}
          components={{
            Toolbar: CustomToolbar,
            MenuPanel: null,
            NavigationPanel: null,
            HelperButtons: null,
            ActionsMenu: null,
            PageMenu: null,
            StylePanel: null,
          }}
          onMount={(editor) => {
            // Store editor ref for later use
            (window as any).__tldrawEditor = editor;

            // Completely disable all animations for immediate, responsive controls
            editor.user.updateUserPreferences({
              animationSpeed: 0,
              isWrapMode: false,
            });

            // Disable camera inertia by setting it to stop immediately
            (editor as any).cameraOptions = {
              ...((editor as any).cameraOptions || {}),
              friction: 1,
              isLocked: false,
              panSpeed: 1,
              zoomSpeed: 1,
              zoomSteps: [0.1, 0.25, 0.5, 1, 2, 4, 8],
              wheelBehavior: 'zoom',
              constraints: {
                initialZoom: 'default',
                baseZoom: 'default',
                bounds: 'default',
                behavior: 'free',
                origin: { x: 0.5, y: 0.5 },
                padding: { x: 0, y: 0 },
              },
            };

            if (initialData) {
              try {
                loadSnapshot(editor.store, initialData);
              } catch (e) {
                console.error("Failed to load snapshot:", e);
                sileo.error({ title: "Failed to restore canvas state" });
              }
            }

            // Auto-populate a note when opening from Knowledge Base with content but no canvas data
            if (!initialData && assignmentMeta?.instructions && assignmentMeta.instructions.length > 10) {
              const noteId = createShapeId();
              editor.createShape({
                id: noteId,
                type: 'note',
                x: 200,
                y: 200,
                props: {
                  richText: toRichText(assignmentMeta.instructions.slice(0, 3000)),
                  size: 'm',
                  color: 'yellow',
                  font: 'sans',
                },
              });
              editor.zoomToFit({ animation: { duration: 200 } });
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
              isTeacherViewing={isTeacherViewing}
              hasBanner={bannerHeight > 0}
              submissionId={submissionData?.id}
              assignmentId={submissionData?.assignment_id}
              initialHintCount={submissionData?.ai_help_count ?? 0}
              docPanelOpen={docPanelOpen}
              setDocPanelOpen={setDocPanelOpen}
            />
        </Tldraw>
        </DocumentPanelContext.Provider>

        {/* First-time board tutorial */}
        {showTutorial && (
          <FirstBoardTutorial
            onComplete={() => setShowTutorial(false)}
            onSkip={() => setShowTutorial(false)}
          />
        )}
    </div>
  );
}
