"use client";

import { Tldraw, useEditor, createShapeId, AssetRecordType, getSnapshot, loadSnapshot } from "tldraw";
import { useCallback, useEffect, useRef, useState } from "react";
import "tldraw/tldraw.css";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Wand2, 
  CheckCircle2,
  Loader2,
  Cloud,
  Mic,
  MicOff,
} from "lucide-react";
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
        console.error("Generation failed:", error);
        throw new Error(error.details || error.error || 'Failed to generate solution');
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
        <Loader2 className="animate-spin w-4 h-4 mr-2" />
      ) : (
        <Wand2 className="w-4 h-4 mr-2" />
      )}
      {isGenerating ? 'Solving...' : 'Solve with AI'}
    </Button>
  );
}

function VoiceAgentControls() {
  const editor = useEditor();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState("Idle");

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);

  const tools = [
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
  ];

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
      if (!dataChannel.current || dataChannel.current.readyState !== "open") {
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

      dataChannel.current.send(JSON.stringify(toolResponse));
      dataChannel.current.send(JSON.stringify({ type: "response.create" }));
    },
    []
  );

  const handleToolCall = useCallback(
    async (event: any) => {
      const { call_id, name } = event;
      const argsString: string = event.arguments ?? "";

      if (name !== "solve_canvas") return;

      if (!editor) {
        sendToolOutput(call_id, {
          status: "error",
          message: "Canvas editor is not ready.",
        });
        return;
      }

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
          opacity: 0.3,
          isLocked: true,
          props: {
            w: shapeWidth,
            h: shapeHeight,
            assetId: assetId,
          },
        });

        setStatus("Solution added to canvas");

        sendToolOutput(call_id, {
          status: "ok",
          imageUrl,
          message: "Solution image has been added to the canvas.",
        });
      } catch (error) {
        console.error("Error generating solution via tool:", error);
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

      if (event.type === "response.function_call_arguments.delta") {
        const callId = event.call_id as string;
        const chunk = event.arguments as string;
        if (!callId || typeof chunk !== "string") return;
        pendingToolArgs.current[callId] =
          (pendingToolArgs.current[callId] || "") + chunk;
      } else if (event.type === "response.function_call_arguments.done") {
        const callId = event.call_id as string;
        const fullArgs =
          pendingToolArgs.current[callId] ??
          (typeof event.arguments === "string" ? event.arguments : "");
        delete pendingToolArgs.current[callId];
        handleToolCall({ ...event, arguments: fullArgs });
      } else if (event.type === "error") {
        console.error("Realtime error:", event);
        setStatus("Realtime error");
      }
    },
    [handleToolCall]
  );

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
  }, []);

  const startSession = useCallback(async () => {
    try {
      setStatus("Requesting token...");

      const tokenResponse = await fetch("/api/voice/token");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get realtime token");
      }
      const data = await tokenResponse.json();
      const ephemeralKey = data.client_secret?.value;

      if (!ephemeralKey) {
        throw new Error("No ephemeral key returned from server");
      }

      setStatus("Initializing WebRTC...");

      const pc = new RTCPeerConnection();
      peerConnection.current = pc;

      // Play remote audio from the model
      audioEl.current = document.createElement("audio");
      audioEl.current.autoplay = true;
      pc.ontrack = (e) => {
        if (audioEl.current) {
          audioEl.current.srcObject = e.streams[0];
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
            modalities: ["text", "audio"],
            instructions:
              "You are an AI tutor helping the user work on a whiteboard. " +
              "You can see an image of the canvas when you call the solve_canvas tool. " +
              "Use this tool when the user asks you to solve or annotate something on the board.",
            tools,
            tool_choice: "auto",
          },
        };
        dc.send(JSON.stringify(sessionUpdate));
      });

      dc.addEventListener("message", (e) => {
        try {
          const event = JSON.parse(e.data);
          handleServerEvent(event);
        } catch (e) {
          console.error("Failed to parse realtime event:", e);
        }
      });

      // Create offer and exchange SDP with OpenAI Realtime API
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const text = await sdpResponse.text();
        console.error("SDP error:", text);
        throw new Error("Failed to handshake with OpenAI");
      }

      const answerSdp = await sdpResponse.text();
      const answer = {
        type: "answer" as RTCSdpType,
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);

      setIsSessionActive(true);
      setStatus("Listening");
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
  }, [handleServerEvent, stopSession, tools]);

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

  return (
    <div className="absolute top-[140px] right-4 z-[2000] flex flex-col items-end gap-2 pointer-events-auto">
      <Button
        onClick={handleClick}
        variant={isSessionActive ? "destructive" : "outline"}
        className="shadow-lg bg-white/90 backdrop-blur hover:bg-white"
      >
        {isSessionActive ? (
          <>
            <MicOff className="w-4 h-4 mr-2" />
            Stop Voice
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Voice Agent
          </>
        )}
      </Button>
      <span className="text-[11px] text-gray-600 bg-white/90 px-2 py-0.5 rounded shadow-sm">
        {status}
      </span>
    </div>
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
          <ArrowLeft className="w-5 h-5" />
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
                 <Loader2 className="w-3 h-3 animate-spin" />
                 Saving...
               </span>
            ) : lastSaved ? (
               <span className="flex items-center gap-1 text-green-600">
                 <Cloud className="w-3 h-3" />
                 Saved {lastSaved.toLocaleTimeString()}
               </span>
            ) : (
               <span className="flex items-center gap-1">
                 <CheckCircle2 className="w-3 h-3" />
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
        <VoiceAgentControls />
      </Tldraw>
    </div>
  );
}
