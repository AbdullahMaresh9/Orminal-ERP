"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import { useI18n } from "@/stores/i18n-store"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  dir,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const locale = useI18n((s) => s.locale)
  const currentDir = dir || (locale === 'ar' ? 'rtl' : 'ltr')
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        dir={currentDir}
        className={cn(
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 flex flex-col w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-xl border border-slate-300 dark:border-slate-700 shadow-modal duration-200 max-h-[95vh] overflow-hidden bg-white dark:bg-slate-950",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="
              absolute
              top-4
              end-4
              z-20

              w-11
              h-9
              rounded-xl

              flex
              items-center
              justify-center

              bg-slate-100
              text-slate-600

              border
              border-slate-200

              shadow-sm

              transition-all
              duration-200

              hover:bg-red-50
              hover:text-red-600
              hover:border-red-200

              dark:bg-white/10
              dark:text-white
              dark:border-white/20

              dark:hover:bg-red-500/20
              dark:hover:text-red-400
              dark:hover:border-red-500/30

              focus:outline-none
              focus:ring-2
              focus:ring-blue-500
              focus:ring-offset-2

              disabled:pointer-events-none

              [&_svg]:pointer-events-none
              [&_svg]:shrink-0
              [&_svg:not([class*='size-'])]:size-4
            "
          >
            <XIcon />
            <span className="sr-only">إغلاق</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1 px-6 py-6 p-4 sm:p-6 bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF]  dark:bg-none dark:bg-blue-700/80  border-b border-blue-100 dark:border-blue-700/40 text-start shrink-0 relative",
        className
      )}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex-1 overflow-y-auto px-6 py-4 bg-white dark:bg-slate-950", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-between px-4 py-5 sm:px-6 border-t border-slate-300 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/80 ",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-xl font-bold text-[#1a3a5f] dark:text-white", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-[#4a6a8f] dark:text-blue-100/90", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}