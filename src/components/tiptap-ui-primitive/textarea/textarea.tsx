"use client"

import { cn } from "@/lib/tiptap-utils"
import "@/components/tiptap-ui-primitive/textarea/textarea.scss"

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="tiptap-textarea"
      className={cn("tiptap-textarea", className)}
      {...props}
    />
  )
}

export { Textarea }
