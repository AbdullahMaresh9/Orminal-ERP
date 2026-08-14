"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { ar, enUS } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useI18n } from "@/stores/i18n-store"

export interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const locale = useI18n((s) => s.locale)
  const isRTL = locale === "ar"

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const parsed = new Date(value + "T00:00:00")
    return isNaN(parsed.getTime()) ? undefined : parsed
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      onChange?.(`${year}-${month}-${day}`)
    } else {
      onChange?.("")
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 sm:h-10 w-full justify-between text-start text-xs sm:text-sm font-mono px-3 bg-background border-input hover:bg-accent/50 transition-colors shadow-2xs",
            !value && "text-muted-foreground font-sans",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
        >
          <span className="truncate">
            {selectedDate
              ? format(selectedDate, "yyyy/MM/dd")
              : placeholder || (isRTL ? "اختر التاريخ" : "Select Date")}
          </span>
          <CalendarIcon className="ml-2 size-3.5 sm:size-4 shrink-0 text-red-foreground opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={isRTL ? "end" : "start"}
        className="w-auto p-1.5 bg-popover border-border shadow-xl rounded-xl overflow-hidden"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={isRTL ? ar : enUS}
          dir={isRTL ? "rtl" : "ltr"}
          initialFocus
          className="p-1 scale-90 sm:scale-100 origin-top-left rtl:origin-top-right"
        />
      </PopoverContent>
    </Popover>
  )
}
