import { Loading03Icon } from "hugeicons-react";

export type StatusIndicatorState = 
  | "idle"
  | "generating"
  | "success"
  | "error";

interface StatusIndicatorProps {
  status: StatusIndicatorState;
  errorMessage?: string;
  customMessage?: string;
  className?: string;
  disableAbsolute?: boolean;
}

const statusMessages: Record<StatusIndicatorState, string> = {
  idle: "",
  generating: "Generating...",
  success: "Done!",
  error: "Error",
};

export function StatusIndicator({ status, errorMessage, customMessage, className, disableAbsolute = false }: StatusIndicatorProps) {
  // Don't render anything when idle
  if (status === "idle") return null;

  const message = customMessage || (status === "error" && errorMessage 
    ? errorMessage 
    : statusMessages[status]);

  const baseStyles = "flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm animate-in fade-in slide-in-from-top-2 duration-300";
  const absoluteStyles = disableAbsolute ? "" : "fixed top-[10px] left-1/2 -translate-x-1/2 z-[12000]";

  return (
    <div
      className={`${baseStyles} ${absoluteStyles} ${className || ""}`}
    >
      {status === "generating" && (
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

