import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs transition-all duration-150",
        "placeholder:text-gray-400 placeholder:text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "dark:border-input dark:bg-input/30 dark:text-gray-100 dark:placeholder:text-gray-500",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
