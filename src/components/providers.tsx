'use client'

import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { useI18n } from "@/stores/i18n-store"
import { useNav } from "@/stores/nav-store"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  // Rehydrate persisted stores AFTER mount to avoid hydration mismatch.
  // With skipHydration: true, the stores use default values during SSR and
  // the first client render (matching the server), then load from localStorage
  // after the component mounts.
  useEffect(() => {
    useI18n.persist.rehydrate()
    useNav.persist.rehydrate()
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  )
}
