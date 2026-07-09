'use client'

import { useNav } from '@/stores/nav-store'
import { useI18n } from '@/stores/i18n-store'
import { useT } from '@/lib/i18n/use-t'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sheet, SheetContent, SheetTrigger, SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { SidebarNav } from './sidebar-nav'
import {
  Menu, Search, Bell, Sun, Moon, Monitor, Languages, Settings,
  User, LogOut, Check, ChevronDown, Plus, Command,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { initials } from '@/lib/format'

// Hydration-safe mount detector (avoids setState-in-effect lint rule)
function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  return mounted
}

export function Topbar() {
  const { toggleSidebar, setMobileSidebarOpen, mobileSidebarOpen, activeModule, setActiveModule } = useNav()
  const { locale, setLocale } = useI18n()
  const { t } = useT()
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  // Notifications
  const { data: notifData } = useQuery<{ data: any[] }>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const r = await fetch('/api/erp/notifications')
      if (!r.ok) return { data: [] }
      return r.json()
    },
    staleTime: 60 * 1000,
  })
  const notifications = notifData?.data ?? []
  const unread = notifications.filter((n: any) => !n.isRead).length

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 shrink-0">
      {/* Mobile sidebar toggle */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="فتح القائمة">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="p-0 w-72" aria-label="القائمة الجانبية">
          <SheetTitle className="sr-only">القائمة الجانبية</SheetTitle>
          <SidebarNav />
        </SheetContent>
      </Sheet>

      {/* Desktop collapse */}
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={toggleSidebar} aria-label="طي القائمة">
        <Menu className="size-5" />
      </Button>

      {/* Search */}
      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={t('topbar.searchPlaceholder')}
          className="ps-9 pe-12 bg-muted/40 border-transparent focus-visible:bg-background"
        />
        <kbd className="absolute inset-y-0 end-2 my-auto hidden md:flex items-center gap-0.5 text-[10px] text-muted-foreground bg-background border rounded px-1.5 h-5">
          <Command className="size-2.5" />K
        </kbd>
      </div>

      <div className="flex-1 sm:hidden" />

      {/* Quick add */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t('topbar.quickAdd')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{t('action.create')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActiveModule('sales-invoices')}>فاتورة ضريبية</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('sales-orders')}>أمر بيع</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('purchase-invoices')}>فاتورة شراء</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('journal-entries')}>قيد محاسبي</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('sales-payments')}>سند قبض</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('purchase-payments')}>سند صرف</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActiveModule('clients')}>عميل جديد</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('suppliers')}>مورد جديد</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('products')}>منتج جديد</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Language */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="اللغة">
            <Languages className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>{t('appearance.language')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLocale('ar')} className="justify-between">
            العربية
            {locale === 'ar' && <Check className="size-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLocale('en')} className="justify-between">
            English
            {locale === 'en' && <Check className="size-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="السمة">
            {mounted ? (
              theme === 'dark' ? <Moon className="size-5" /> : theme === 'system' ? <Monitor className="size-5" /> : <Sun className="size-5" />
            ) : (
              <Sun className="size-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>{t('appearance.theme')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setTheme('light')} className="justify-between">
            <span className="flex items-center gap-2"><Sun className="size-4" /> {t('appearance.theme.light')}</span>
            {mounted && theme === 'light' && <Check className="size-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')} className="justify-between">
            <span className="flex items-center gap-2"><Moon className="size-4" /> {t('appearance.theme.dark')}</span>
            {mounted && theme === 'dark' && <Check className="size-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')} className="justify-between">
            <span className="flex items-center gap-2"><Monitor className="size-4" /> {t('appearance.theme.system')}</span>
            {mounted && theme === 'system' && <Check className="size-4" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="الإشعارات">
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -end-0.5 size-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between p-3 border-b">
            <p className="font-semibold text-sm">{t('topbar.notifications')}</p>
            <Badge variant="secondary" className="text-[10px]">{unread} جديد</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</p>
            ) : (
              notifications.slice(0, 8).map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => n.link && setActiveModule(n.link as any)}
                  className={`flex flex-col gap-1 w-full p-3 border-b text-start hover:bg-muted/50 transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 size-2 rounded-full shrink-0 ${n.type === 'warning' ? 'bg-amber-500' : n.type === 'error' ? 'bg-rose-500' : n.type === 'success' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          <button
            onClick={() => setActiveModule('notifications')}
            className="w-full p-3 text-center text-xs font-medium text-primary hover:bg-muted/50 border-t"
          >
            {t('misc.viewAll')}
          </button>
        </PopoverContent>
      </Popover>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full hover:bg-muted/60 p-1 pe-2 transition-colors" aria-label="حساب المستخدم">
            <span className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold ring-2 ring-background">
              {initials('مدير النظام')}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">مدير النظام</span>
              <span className="text-xs text-muted-foreground font-normal">admin@ormenal.io</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setActiveModule('profile')}>
            <User className="size-4 ms-2" />
            {t('topbar.profile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule('settings')}>
            <Settings className="size-4 ms-2" />
            {t('topbar.settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-rose-600 focus:text-rose-600">
            <LogOut className="size-4 ms-2" />
            {t('topbar.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
