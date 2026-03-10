"use client"

export function SetupErrorMessage({
  aiSetupError,
  collabSetupError,
}: {
  aiSetupError?: boolean
  collabSetupError?: boolean
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          Setup Required
        </h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          {collabSetupError && (
            <p>
              Collaboration is not configured. Please set the{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                NEXT_PUBLIC_TIPTAP_COLLAB_APP_ID
              </code>{" "}
              and{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                NEXT_PUBLIC_TIPTAP_COLLAB_TOKEN
              </code>{" "}
              environment variables.
            </p>
          )}
          {aiSetupError && (
            <p>
              AI features are not configured. Please set the{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                NEXT_PUBLIC_TIPTAP_AI_APP_ID
              </code>{" "}
              and{" "}
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                NEXT_PUBLIC_TIPTAP_AI_TOKEN
              </code>{" "}
              environment variables.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
