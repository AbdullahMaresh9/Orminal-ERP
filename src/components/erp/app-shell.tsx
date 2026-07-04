'use client'

import { useNav } from '@/stores/nav-store'
import { useI18n } from '@/stores/i18n-store'
import { SidebarNav } from './sidebar-nav'
import { Topbar } from './topbar'
import { moduleRegistry } from './module-registry'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

export function AppShell() {
  const { activeModule, sidebarCollapsed } = useNav()
  const { locale } = useI18n()

  // Sync document dir/lang with locale
  useEffect(() => {
    if (typeof document === 'undefined') return
    const dir = locale === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', locale)
  }, [locale])

  const ActiveModule = moduleRegistry[activeModule] ?? moduleRegistry.dashboard

  return (
    <div className="h-screen overflow-hidden flex bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex shrink-0 transition-[width] duration-200 border-e border-sidebar-border',
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'
        )}
      >
        <SidebarNav />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin min-h-0">
          <ActiveModule />
          <footer className="mt-auto border-t bg-muted/30 py-4 px-6 text-center text-xs text-muted-foreground shrink-0">
            <span className="font-semibold text-foreground">الأستاذ</span> — نظام المحاسبة والإدارة المالية ·
            جميع الحقوق محفوظة © {new Date().getFullYear()}
          </footer>
        </main>
      </div>
    </div>
  )
}
