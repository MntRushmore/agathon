import { Loading03Icon } from "hugeicons-react";

export type StatusIndicatorState = 
  | "idle"
  | "analyzing"
  | "checking"
  | "generating"
  | "error";

interface StatusIndicatorProps {
  status: StatusIndicatorState;
  errorMessage?: string;
}

const statusMessages: Record<Exclude<StatusIndicatorState, "idle">, string> = {
  analyzing: "Analyzing handwriting...",
  checking: "Checking if help needed...",
  generating: "Generating solution...",
  error: "Error occurred",
};

export function StatusIndicator({ status, errorMessage }: StatusIndicatorProps) {
  // Don't render anything when idle
  if (status === "idle") return null;

  const message = status === "error" && errorMessage 
    ? errorMessage 
    : statusMessages[status];

  return (
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
      {status !== "error" && (
        <Loading03Icon 
          size={16} 
          strokeWidth={2} 
          className="animate-spin text-blue-600"
        />
      )}
      <span className={`text-sm font-medium ${status === "error" ? "text-red-600" : "text-gray-700"}`}>
        {message}
      </span>
    </div>
  );
}

