"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VoicePage() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [logs, setLogs] = useState<string[]>([]);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const pendingToolArgs = useRef<Record<string, string>>({});

  // Helper to add logs
  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  // Tool definition
  const tools = [
    {
      type: "function",
      name: "get_weather",
      description: "Get the current weather for a specific location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "The unit of temperature",
          },
        },
        required: ["location"],
      },
    },
  ];

  // Initialize the WebRTC session
  const startSession = async () => {
    try {
      setStatus("Requesting token...");
      addLog("Requesting ephemeral token...");
      
      const tokenResponse = await fetch("/api/voice/token");
      if (!tokenResponse.ok) {
        throw new Error("Failed to get token");
      }
      const data = await tokenResponse.json();
      const ephemeralKey = data.client_secret.value;

      setStatus("Initializing WebRTC...");
      addLog("Got token. Initializing WebRTC...");

      const pc = new RTCPeerConnection();
      peerConnection.current = pc;

      // Play remote audio
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

      // Data Channel for events
      const dc = pc.createDataChannel("oai-events");
      dataChannel.current = dc;

      dc.addEventListener("open", () => {
        addLog("Data channel open");
        // Configure session with tools once connected
        const sessionUpdate = {
          type: "session.update",
          session: {
            modalities: ["text", "audio"],
            instructions: "You are a helpful assistant. You can check the weather using the get_weather tool.",
            tools: tools,
            tool_choice: "auto",
          },
        };
        dc.send(JSON.stringify(sessionUpdate));
      });

      dc.addEventListener("message", (e) => {
        try {
          const event = JSON.parse(e.data);
          handleServerEvent(event);
        } catch (error) {
          console.error("Failed to parse realtime event", error);
        }
      });

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send to OpenAI Realtime API
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
        throw new Error("Failed to handshake with OpenAI");
      }

      const answerSdp = await sdpResponse.text();
      const answer = {
        type: "answer" as RTCSdpType,
        sdp: answerSdp,
      };

      await pc.setRemoteDescription(answer);
      
      setIsSessionActive(true);
      setStatus("Connected");
      addLog("Session started!");

    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.name === "NotAllowedError") {
        setStatus("Permission Denied");
        addLog("Error: Microphone permission denied. Please allow microphone access.");
      } else {
        setStatus("Error");
        addLog(`Error: ${err instanceof Error ? err.message : String(err)}`);
      }
      stopSession();
    }
  };

  // Handle events from the server
  const handleServerEvent = (event: any) => {
    if (!event || typeof event.type !== "string") return;

    if (event.type === "response.function_call_arguments.delta") {
      // Streamed tool arguments – accumulate by call_id
      const callId = event.call_id as string;
      const chunk = event.arguments as string;
      if (!callId || typeof chunk !== "string") return;
      pendingToolArgs.current[callId] =
        (pendingToolArgs.current[callId] || "") + chunk;
    } else if (event.type === "response.function_call_arguments.done") {
      // Finalize arguments and execute tool
      const callId = event.call_id as string;
      const fullArgs =
        pendingToolArgs.current[callId] ??
        (typeof event.arguments === "string" ? event.arguments : "");
      delete pendingToolArgs.current[callId];
      handleToolCall({ ...event, arguments: fullArgs });
    } else if (event.type === "response.text.delta") {
      // Handle text streaming if needed
    } else if (event.type === "error") {
      addLog(
        `Error from server: ${
          event.error?.message || JSON.stringify(event.error || event)
        }`
      );
    }
  };

  // Handle function calls
  const handleToolCall = async (event: any) => {
    const { call_id, name } = event;
    const argsString: string = event.arguments ?? "";
    addLog(`Tool call detected: ${name}(${argsString})`);

    if (name === "get_weather") {
      try {
        const args = argsString ? JSON.parse(argsString) : {};
        // Simulate fetching weather
        const result = {
          temperature: 72,
          unit: args.unit || "fahrenheit",
          condition: "Sunny",
          location: args.location,
        };

        addLog(`Executing ${name}... Result: ${JSON.stringify(result)}`);

        // Send result back
        const toolResponse = {
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: call_id,
            output: JSON.stringify(result),
          },
        };
        
        if (dataChannel.current && dataChannel.current.readyState === "open") {
          dataChannel.current.send(JSON.stringify(toolResponse));
          
          // Trigger response generation
          const responseCreate = {
            type: "response.create",
          };
          dataChannel.current.send(JSON.stringify(responseCreate));
        }
      } catch (error) {
        console.error("Failed to execute get_weather tool", error);
        addLog("Failed to execute get_weather tool");
      }
    }
  };

  const stopSession = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setIsSessionActive(false);
    setStatus("Idle");
    addLog("Session stopped");
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Realtime Voice Agent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={isSessionActive ? stopSession : startSession}
              variant={isSessionActive ? "destructive" : "default"}
            >
              {isSessionActive ? "End Session" : "Start Session"}
            </Button>
            <span className="text-sm text-muted-foreground">Status: {status}</span>
          </div>

          <div className="bg-slate-100 p-4 rounded-md h-64 overflow-y-auto font-mono text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {logs.length === 0 && <div className="text-slate-400">Logs will appear here...</div>}
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

