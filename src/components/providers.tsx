'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl'
import { useState, useEffect } from 'react'
import { useI18n } from '@/stores/i18n-store'
import { useNav } from '@/stores/nav-store'
import { arMessages } from '@/lib/i18n/messages/ar'
import { enMessages } from '@/lib/i18n/messages/en'

/** Inner provider that subscribes to locale after hydration */
function IntlSyncProvider({ children }: { children: React.ReactNode }) {
  const locale = useI18n((s) => s.locale)
  const messages = locale === 'ar' ? arMessages : enMessages

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Riyadh">
      {children}
    </NextIntlClientProvider>
  )
}

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

  // Rehydrate persisted Zustand stores AFTER mount to avoid hydration mismatch.
  useEffect(() => {
    useI18n.persist.rehydrate()
    useNav.persist.rehydrate()
  }, [])

  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <QueryClientProvider client={queryClient}>
          <IntlSyncProvider>{children}</IntlSyncProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
