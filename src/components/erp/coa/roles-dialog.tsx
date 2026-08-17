'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody,
} from '@/components/ui/dialog'
import { AlertTriangle, CheckCircle2, Shield, X } from 'lucide-react'
import { getClassMeta } from './class-meta'
import type { RoleMapping, AccountNode } from './types'

interface RolesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RolesApiResponse {
  data: {
    scope: string
    roles: RoleMapping[]
    missingRequired: string[]
  }
}

export function RolesDialog({ open, onOpenChange }: RolesDialogProps) {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()

  const [pendingChanges, setPendingChanges] = useState<Record<string, string | null>>({})
  const [search, setSearch] = useState('')

  const { data: rolesData, isLoading } = useQuery<RolesApiResponse>({
    queryKey: ['account-roles'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts/roles')
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: open,
  })

  const { data: flatData } = useQuery<{ data: AccountNode[] }>({
    queryKey: ['accounts-flat-posting'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts?view=flat&isPosting=true&pageSize=500&sortBy=code&sortDir=asc')
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: open,
  })

  const roles = rolesData?.data?.roles ?? []
  const missingRequired = rolesData?.data?.missingRequired ?? []
  const flatAccounts = flatData?.data ?? []

  const saveMutation = useMutation({
    mutationFn: async (changes: Record<string, string | null>) => {
      const promises = Object.entries(changes).map(async ([role, accountId]) => {
        if (accountId) {
          const r = await fetch('/api/erp/accounts/roles', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, accountId }),
          })
          if (!r.ok) {
            const err = await r.json().catch(() => ({}))
            throw new Error(err?.error?.message ?? L('فشل حفظ الربط', 'Failed to save mapping'))
          }
          return r.json()
        } else {
          const r = await fetch(`/api/erp/accounts/roles?role=${encodeURIComponent(role)}`, { method: 'DELETE' })
          if (!r.ok) {
            const err = await r.json().catch(() => ({}))
            throw new Error(err?.error?.message ?? L('فشل إزالة الربط', 'Failed to remove mapping'))
          }
          return r.json()
        }
      })
      await Promise.all(promises)
    },
    onSuccess: () => {
      toast.success(t('coa.success.rolesSaved'))
      qc.invalidateQueries({ queryKey: ['account-roles'] })
      qc.invalidateQueries({ queryKey: ['accounts-stats'] })
      setPendingChanges({})
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // Group roles by group field
  const grouped = useMemo(() => {
    const filtered = roles.filter((r) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return r.nameAr.toLowerCase().includes(q) || r.nameEn.toLowerCase().includes(q) || r.role.toLowerCase().includes(q)
    })
    const groups: Record<string, RoleMapping[]> = {}
    for (const role of filtered) {
      const grp = role.group || t('coa.roles.noGroup')
      if (!groups[grp]) groups[grp] = []
      groups[grp].push(role)
    }
    return groups
  }, [roles, search, t])

  const hasChanges = Object.keys(pendingChanges).length > 0

  function getEffectiveAccountId(role: RoleMapping): string {
    if (role.role in pendingChanges) return pendingChanges[role.role] ?? ''
    return role.mapping?.account?.id ?? ''
  }

  function handleChange(roleCode: string, accountId: string | null) {
    setPendingChanges((prev) => ({ ...prev, [roleCode]: accountId }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden" dir={dir}>
        <DialogHeader className="px-6 py-5 shrink-0">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-xl bg-white dark:bg-violet-950/60 border border-violet-100 dark:border-violet-500/20 text-violet-600 dark:text-violet-300 flex items-center justify-center shadow-sm shrink-0">
              <Shield className="size-6" />
            </div>
            <div className="space-y-0.5 flex-1 min-w-0">
              <DialogTitle>{t('coa.roles.title')}</DialogTitle>
              <DialogDescription>{t('coa.roles.desc')}</DialogDescription>
            </div>
          </div>
          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold">{L('أدوار مطلوبة غير مربوطة:', 'Required unmapped roles:')}</p>
                <p className="mt-0.5">{missingRequired.join(', ')}</p>
              </div>
            </div>
          )}
          {/* Search */}
          <div className="relative mt-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L('بحث في الأدوار...', 'Search roles...')}
              className="h-8 text-xs ps-8"
            />
          </div>
        </DialogHeader>

        <DialogBody className="p-0">
          <ScrollArea className="max-h-[50vh]">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {Object.entries(grouped).map(([group, groupRoles]) => (
                  <div key={group}>
                    <div className="px-5 py-2 bg-muted/30 sticky top-0 z-10">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group}</p>
                    </div>
                    {groupRoles.map((role) => {
                      const effectiveId = getEffectiveAccountId(role)
                      const isPending = role.role in pendingChanges
                      const isMapped = !!effectiveId
                      const allowedAccounts = flatAccounts.filter(
                        (a) => !role.allowedClasses.length || role.allowedClasses.includes(a.accountClass as Parameters<typeof role.allowedClasses.includes>[0])
                      )

                      return (
                        <div
                          key={role.role}
                          className={cn(
                            'flex items-center gap-3 px-5 py-3 transition-colors',
                            !isMapped && role.required && 'bg-rose-50/50 dark:bg-rose-950/20',
                            isPending && 'bg-blue-50/40 dark:bg-blue-950/20',
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold">{isRTL ? role.nameAr : role.nameEn}</span>
                              {role.required && (
                                <Badge className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400">
                                  {t('coa.roles.required')}
                                </Badge>
                              )}
                              <span className="text-[10px] font-mono text-muted-foreground">{role.role}</span>
                            </div>
                            {role.descriptionAr && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{role.descriptionAr}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0 w-[220px]">
                            <Select
                              value={effectiveId || '__none'}
                              onValueChange={(v) => handleChange(role.role, v === '__none' ? null : v)}
                            >
                              <SelectTrigger className={cn(
                                'h-8 text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950',
                                !isMapped && role.required && 'border-rose-300 dark:border-rose-700',
                              )} dir={dir}>
                                <SelectValue placeholder={t('coa.roles.pickAccount')} />
                              </SelectTrigger>
                              <SelectContent dir={dir}>
                                <SelectItem value="__none">
                                  <span className="text-muted-foreground">{t('coa.roles.unmapped')}</span>
                                </SelectItem>
                                {allowedAccounts.map((a) => {
                                  const cm = getClassMeta(a.accountClass)
                                  return (
                                    <SelectItem key={a.id} value={a.id}>
                                      <div className="flex items-center gap-2">
                                        <span className={cn('text-[10px] font-semibold', cm.color)}>●</span>
                                        <span className="font-mono text-xs">{a.code}</span>
                                        <span className="text-xs truncate">{a.nameAr}</span>
                                      </div>
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>

                            {isMapped ? (
                              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                            ) : (
                              <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setPendingChanges({}); onOpenChange(false) }}>
            {t('action.cancel')}
          </Button>
          <Button
            onClick={() => saveMutation.mutate(pendingChanges)}
            disabled={!hasChanges || saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saveMutation.isPending ? L('جاري الحفظ...', 'Saving...') : t('coa.roles.saveAll')}
            {hasChanges && !saveMutation.isPending && (
              <Badge className="ms-1.5 bg-white text-blue-700 text-[10px]">
                {Object.keys(pendingChanges).length}
              </Badge>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
