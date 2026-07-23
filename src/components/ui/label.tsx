"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-sm font-medium text-gray-700 select-none leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-300",
        className
      )}
      {...props}
    />
  )
}

export { Label }
