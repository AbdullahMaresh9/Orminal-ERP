'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
export type Locale = 'ar' | 'en'

interface I18nState {
  locale: Locale
  setLocale: (l: Locale) => void
  toggle: () => void
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'ar',
      setLocale: (l) => set({ locale: l }),
      toggle: () => set((s) => ({ locale: s.locale === 'ar' ? 'en' : 'ar' })),
    }),
    { name: 'ormenal-i18n', skipHydration: true }
  )
)

export const isRTL = (locale: Locale) => locale === 'ar'
