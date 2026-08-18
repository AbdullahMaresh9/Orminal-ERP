'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { formatCurrency, formatInt } from '@/lib/format'

import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import {
  BookOpen, Plus, Download, Upload, Settings2, LayoutList, TreePine,
  ChevronsUpDown, ChevronUp, ChevronDown, AlertTriangle, AlertCircle,
  Layers, Lock, TrendingUp, TrendingDown, Scale, Wallet,
} from 'lucide-react'

import { AccountTree } from '@/components/erp/coa/account-tree'
import { FlatTable } from '@/components/erp/coa/flat-table'
import { AccountDetailSheet } from '@/components/erp/coa/account-detail-sheet'
import { LedgerSheet } from '@/components/erp/coa/ledger-sheet'
import { AccountFormDialog } from '@/components/erp/coa/account-form-dialog'
import { RolesDialog } from '@/components/erp/coa/roles-dialog'
import { ImportDialog } from '@/components/erp/coa/import-dialog'

import type {
  AccountNode, AccountDetail, AccountStats, AccountMeta,
  CreateAccountPayload, ViewMode, TreeFilters, FlatAccount, AccountClass,
} from '@/components/erp/coa/types'

// ─── Filter helpers ─────────────────────────────────────────────────────────

function matchesFilters(node: AccountNode, filters: TreeFilters): boolean {
  if (filters.accountClass !== 'all' && node.accountClass !== filters.accountClass) return false
  if (filters.active === 'active' && !node.active) return false
  if (filters.active === 'inactive' && node.active) return false
  if (filters.kind === 'group' && node.isPosting) return false
  if (filters.kind === 'posting' && !node.isPosting) return false
  if (filters.systemOnly && !node.isSystem) return false
  if (filters.search) {
    const q = filters.search.toLowerCase()
    const matchSelf =
      node.code.toLowerCase().includes(q) ||
      node.nameAr.toLowerCase().includes(q) ||
      (node.nameEn ?? '').toLowerCase().includes(q)
    if (!matchSelf) return false
  }
  return true
}

function filterTree(nodes: AccountNode[], filters: TreeFilters): AccountNode[] {
  if (!filters.search && filters.accountClass === 'all' && filters.active === 'all' && filters.kind === 'all' && !filters.systemOnly) {
    return nodes
  }
  function recurse(ns: AccountNode[]): AccountNode[] {
    const result: AccountNode[] = []
    for (const n of ns) {
      const filteredChildren = recurse(n.children ?? [])
      const selfMatch = matchesFilters(n, filters)
      if (selfMatch || filteredChildren.length > 0) {
        result.push({ ...n, children: filteredChildren })
      }
    }
    return result
  }
  return recurse(nodes)
}

function collectIds(nodes: AccountNode[]): string[] {
  const ids: string[] = []
  function walk(ns: AccountNode[]) {
    for (const n of ns) {
      ids.push(n.id)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return ids
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ChartOfAccountsModule() {
  const { t, isRTL, dir } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const qc = useQueryClient()

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [filters, setFilters] = useState<TreeFilters>({
    search: '',
    accountClass: 'all',
    active: 'all',
    kind: 'all',
    systemOnly: false,
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // ── Dialog state ──
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Account statement (كشف حساب) target — opened from any row's actions menu.
  const [ledgerId, setLedgerId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'createGroup' | 'createPosting' | 'edit' | 'createChild'>('createPosting')
  const [editingAccount, setEditingAccount] = useState<AccountNode | null>(null)
  const [parentForCreate, setParentForCreate] = useState<AccountNode | null>(null)
  const [rolesOpen, setRolesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<AccountNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AccountNode | null>(null)
  const [deactivateReason, setDeactivateReason] = useState('')
  const [formErrors, setFormErrors] = useState<{ field: string; code: string; message: string }[]>([])

  // ── API queries ──
  const { data: treeData, isLoading: treeLoading, refetch: refetchTree } = useQuery<{ data: { tree: AccountNode[]; totalAccounts: number } }>({
    queryKey: ['accounts-tree', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('view', 'tree')
      if (filters.search) params.set('q', filters.search)
      if (filters.accountClass !== 'all') params.set('class', filters.accountClass)
      if (filters.active !== 'all') params.set('active', filters.active === 'active' ? 'true' : 'false')
      if (filters.kind !== 'all') params.set('isPosting', filters.kind === 'posting' ? 'true' : 'false')
      if (filters.systemOnly) params.set('isSystem', 'true')
      const r = await fetch(`/api/erp/accounts?${params}`)
      if (!r.ok) throw new Error(t('error.fetch'))
      return r.json()
    },
    enabled: viewMode === 'tree',
  })

  const { data: statsData, isLoading: statsLoading } = useQuery<{ data: AccountStats }>({
    queryKey: ['accounts-stats'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts/stats')
      if (!r.ok) throw new Error(t('error.fetch'))
      return r.json()
    },
  })

  const { data: metaData } = useQuery<{ data: AccountMeta }>({
    queryKey: ['accounts-meta'],
    queryFn: async () => {
      const r = await fetch('/api/erp/accounts/meta')
      if (!r.ok) throw new Error(t('error.fetch'))
      return r.json()
    },
  })

  const tree = useMemo(() => filterTree(treeData?.data?.tree ?? [], filters), [treeData, filters])
  const stats = statsData?.data
  const meta = metaData?.data ?? null
  const missingRoles = stats?.determination?.missingRequiredRoles ?? []

  // ── Expand / Collapse ──
  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleExpandAll = () => setExpanded(new Set(collectIds(tree)))
  const handleCollapseAll = () => setExpanded(new Set())

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async ({ payload, id }: { payload: CreateAccountPayload; id?: string }) => {
      const url = id ? `/api/erp/accounts/${id}` : '/api/erp/accounts'
      const method = id ? 'PUT' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) {
        if (r.status === 422 && data?.error?.errors) {
          setFormErrors(data.error.errors)
          throw new Error(data.error.message ?? t('error.save'))
        }
        throw new Error(data?.error?.message ?? t('error.save'))
      }
      return data
    },
    onSuccess: (_, vars) => {
      toast.success(vars.id ? t('coa.success.updated') : t('coa.success.created'))
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-tree'] })
      qc.invalidateQueries({ queryKey: ['accounts-stats'] })
      qc.invalidateQueries({ queryKey: ['accounts-flat'] })
      qc.invalidateQueries({ queryKey: ['account-detail'] })
      setFormOpen(false)
      setEditingAccount(null)
      setFormErrors([])
    },
    onError: (e: Error) => {
      if (formErrors.length === 0) toast.error(e.message)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async ({ id, active, reason }: { id: string; active: boolean; reason?: string }) => {
      const r = await fetch(`/api/erp/accounts/${id}/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, reason }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error?.message ?? t('error.save'))
      return data
    },
    onSuccess: (_, vars) => {
      toast.success(vars.active ? t('coa.success.reactivated') : t('coa.success.deactivated'))
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-tree'] })
      qc.invalidateQueries({ queryKey: ['accounts-stats'] })
      qc.invalidateQueries({ queryKey: ['accounts-flat'] })
      qc.invalidateQueries({ queryKey: ['account-detail'] })
      setDeactivateTarget(null)
      setDeactivateReason('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/erp/accounts/${id}?hard=true`, { method: 'DELETE' })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error?.message ?? t('error.delete'))
      return data
    },
    onSuccess: () => {
      toast.success(t('coa.success.deleted'))
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-tree'] })
      qc.invalidateQueries({ queryKey: ['accounts-stats'] })
      qc.invalidateQueries({ queryKey: ['accounts-flat'] })
      setDeleteTarget(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Open form helpers ──
  function openCreateGroup() {
    setEditingAccount(null)
    setParentForCreate(null)
    setFormMode('createGroup')
    setFormErrors([])
    setFormOpen(true)
  }

  function openCreatePosting() {
    setEditingAccount(null)
    setParentForCreate(null)
    setFormMode('createPosting')
    setFormErrors([])
    setFormOpen(true)
  }

  function openEdit(account: AccountNode | AccountDetail | FlatAccount) {
    setEditingAccount(account as AccountNode)
    setParentForCreate(null)
    setFormMode('edit')
    setFormErrors([])
    setFormOpen(true)
  }

  function openAddChild(account: AccountNode | AccountDetail | FlatAccount) {
    setEditingAccount(null)
    setParentForCreate(account as AccountNode)
    setFormMode('createChild')
    setFormErrors([])
    setFormOpen(true)
  }

  function openDeactivate(account: AccountNode | AccountDetail | FlatAccount) {
    setDeactivateTarget(account as AccountNode)
    setDeactivateReason('')
  }

  function openHardDelete(account: AccountNode | AccountDetail | FlatAccount) {
    setDeleteTarget(account as AccountNode)
  }

  async function handleFormSubmit(payload: CreateAccountPayload) {
    if (formMode === 'createChild' && parentForCreate) {
      // POST to /accounts/:id/children
      const r = await fetch(`/api/erp/accounts/${parentForCreate.id}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) {
        if (r.status === 422 && data?.error?.errors) {
          setFormErrors(data.error.errors)
          throw new Error(data.error.message ?? t('error.save'))
        }
        throw new Error(data?.error?.message ?? t('error.save'))
      }
      toast.success(t('coa.success.created'))
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['accounts-tree'] })
      qc.invalidateQueries({ queryKey: ['accounts-stats'] })
      qc.invalidateQueries({ queryKey: ['accounts-flat'] })
      qc.invalidateQueries({ queryKey: ['account-detail'] })
      setFormOpen(false)
      setFormErrors([])
    } else {
      await saveMutation.mutateAsync({
        payload: {
          ...payload,
          isPosting: formMode === 'createGroup' ? false : payload.isPosting,
        },
        id: editingAccount?.id,
      })
    }
  }

  // ── Export ──
  function handleExport() {
    window.open('/api/erp/accounts/export?format=csv', '_blank')
    toast.success(t('coa.success.exported'))
  }

  // ── Render actions for header ──
  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* View toggle */}
      <div className="flex items-center rounded-lg border border-border overflow-hidden">
        <Button
          variant={viewMode === 'tree' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('tree')}
          className={cn('h-8 rounded-none px-2.5 gap-1.5 text-xs', viewMode === 'tree' ? 'shadow-none' : '')}
          aria-label={t('coa.viewTree')}
        >
          <TreePine className="size-3.5" />
          <span className="hidden sm:inline">{t('coa.viewTree')}</span>
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant={viewMode === 'flat' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('flat')}
          className={cn('h-8 rounded-none px-2.5 gap-1.5 text-xs', viewMode === 'flat' ? 'shadow-none' : '')}
          aria-label={t('coa.viewFlat')}
        >
          <LayoutList className="size-3.5" />
          <span className="hidden sm:inline">{t('coa.viewFlat')}</span>
        </Button>
      </div>

      {/* Expand / collapse (tree only) */}
      {viewMode === 'tree' && (
        <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1.5 text-xs" onClick={handleExpandAll}>
          <ChevronsUpDown className="size-3.5" />
          <span className="hidden md:inline">{t('coa.expandAll')}</span>
        </Button>
      )}

      {/* Import */}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setImportOpen(true)}>
        <Upload className="size-3.5" />
        <span className="hidden sm:inline">{t('coa.import')}</span>
      </Button>

      {/* Export */}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
        <Download className="size-3.5" />
        <span className="hidden sm:inline">{t('coa.exportCsv')}</span>
      </Button>

      {/* Roles / determination */}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setRolesOpen(true)}>
        <Settings2 className="size-3.5" />
        <span className="hidden sm:inline">{t('coa.settings')}</span>
        {missingRoles.length > 0 && (
          <Badge className="ms-1 bg-rose-500 text-white text-[10px] px-1.5 py-0">{missingRoles.length}</Badge>
        )}
      </Button>

      {/* Add group */}
      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreateGroup}>
        <Plus className="size-3.5" />
        <span className="hidden sm:inline">{t('coa.addGroup')}</span>
      </Button>

      {/* Add account (primary CTA) */}
      <Button size="sm" className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreatePosting}>
        <Plus className="size-3.5" />
        {t('coa.addAccount')}
      </Button>
    </div>
  )

  // ── Filter controls ──
  const filterControls = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Class filter */}
      <Select
        value={filters.accountClass}
        onValueChange={(v) => setFilters((f) => ({ ...f, accountClass: v as AccountClass | 'all' }))}
      >
        <SelectTrigger className="h-8 w-36 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <SelectValue placeholder={t('coa.filter.allClasses')} />
        </SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="all">{t('coa.filter.allClasses')}</SelectItem>
          <SelectItem value="asset">{t('coa.class.asset')}</SelectItem>
          <SelectItem value="liability">{t('coa.class.liability')}</SelectItem>
          <SelectItem value="equity">{t('coa.class.equity')}</SelectItem>
          <SelectItem value="revenue">{t('coa.class.revenue')}</SelectItem>
          <SelectItem value="cogs">{t('coa.class.cogs')}</SelectItem>
          <SelectItem value="operating_expense">{t('coa.class.operating_expense')}</SelectItem>
          <SelectItem value="other_income">{t('coa.class.other_income')}</SelectItem>
          <SelectItem value="other_expense">{t('coa.class.other_expense')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={filters.active}
        onValueChange={(v) => setFilters((f) => ({ ...f, active: v as 'all' | 'active' | 'inactive' }))}
      >
        <SelectTrigger className="h-8 w-32 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <SelectValue placeholder={t('coa.filter.allStatus')} />
        </SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="all">{t('coa.filter.allStatus')}</SelectItem>
          <SelectItem value="active">{t('coa.activeBadge')}</SelectItem>
          <SelectItem value="inactive">{t('coa.inactiveBadge')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Kind filter */}
      <Select
        value={filters.kind}
        onValueChange={(v) => setFilters((f) => ({ ...f, kind: v as 'all' | 'group' | 'posting' }))}
      >
        <SelectTrigger className="h-8 w-32 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" dir={dir}>
          <SelectValue placeholder={t('coa.filter.allKinds')} />
        </SelectTrigger>
        <SelectContent dir={dir}>
          <SelectItem value="all">{t('coa.filter.allKinds')}</SelectItem>
          <SelectItem value="group">{t('coa.kind.group')}</SelectItem>
          <SelectItem value="posting">{t('coa.kind.posting')}</SelectItem>
        </SelectContent>
      </Select>

      {/* System only toggle */}
      <Button
        variant={filters.systemOnly ? 'default' : 'outline'}
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setFilters((f) => ({ ...f, systemOnly: !f.systemOnly }))}
      >
        <Lock className="size-3.5" />
        {t('coa.filter.systemOnly')}
      </Button>
    </div>
  )

  return (
    <>
      <ModuleShell
        title={t('module.chart-of-accounts')}
        description={t('coa.description')}
        icon={<BookOpen className="size-5" />}
        actions={headerActions}
        searchValue={filters.search}
        onSearch={(q) => setFilters((f) => ({ ...f, search: q }))}
        searchPlaceholder={t('coa.searchPlaceholder')}
        filters={filterControls}
      >
        {/* Missing roles warning strip */}
        {missingRoles.length > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 mb-4">
            <AlertTriangle className="size-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-rose-700 dark:text-rose-300">{t('coa.missingRoles.title')}</p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{t('coa.missingRoles.desc')}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {missingRoles.map((role) => (
                  <Badge key={role} className="font-mono text-[10px] bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs h-8 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60"
              onClick={() => setRolesOpen(true)}
            >
              {t('coa.missingRoles.fix')}
            </Button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
          {statsLoading ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <KpiCard
                title={t('coa.kpi.total')}
                value={formatInt(stats?.totals?.accounts ?? 0)}
                icon={<BookOpen className="size-4" />}
                accent="blue"
              />
              <KpiCard
                title={t('coa.kpi.posting')}
                value={formatInt(stats?.totals?.postingAccounts ?? 0)}
                icon={<Layers className="size-4" />}
                accent="sky"
              />
              <KpiCard
                title={t('coa.kpi.group')}
                value={formatInt(stats?.totals?.groupAccounts ?? 0)}
                icon={<TreePine className="size-4" />}
                accent="violet"
              />
              <KpiCard
                title={t('coa.kpi.active')}
                value={formatInt(stats?.totals?.activeAccounts ?? 0)}
                icon={<TrendingUp className="size-4" />}
                accent="sky"
              />
              <KpiCard
                title={t('coa.kpi.system')}
                value={formatInt(stats?.totals?.systemAccounts ?? 0)}
                icon={<Lock className="size-4" />}
                accent="amber"
              />
              <KpiCard
                title={t('coa.kpi.assets')}
                value={formatCurrency(stats?.financial?.totalAssets ?? 0)}
                icon={<Wallet className="size-4" />}
                accent="blue"
              />
              <KpiCard
                title={t('coa.kpi.liabilities')}
                value={formatCurrency(stats?.financial?.totalLiabilities ?? 0)}
                icon={<TrendingDown className="size-4" />}
                accent="rose"
              />
              <KpiCard
                title={t('coa.kpi.equity')}
                value={formatCurrency(stats?.financial?.totalEquity ?? 0)}
                icon={<Scale className="size-4" />}
                accent="violet"
              />
            </>
          )}
        </div>

        {/* Main content card */}
        <Card className="rounded-xl overflow-hidden">
          {viewMode === 'tree' ? (
            <AccountTree
              nodes={tree}
              expanded={expanded}
              onToggle={handleToggle}
              onSelect={(node) => setSelectedId(node.id)}
              onEdit={openEdit}
              onAddChild={openAddChild}
              onDeactivate={openDeactivate}
              onHardDelete={openHardDelete}
              onViewLedger={(node) => setLedgerId(node.id)}
              isLoading={treeLoading}
            />
          ) : (
            <FlatTable
              filters={filters}
              onSelect={(a) => setSelectedId(a.id)}
              onEdit={openEdit}
              onAddChild={openAddChild}
              onDeactivate={openDeactivate}
              onHardDelete={openHardDelete}
              onViewLedger={(a) => setLedgerId(a.id)}
            />
          )}
        </Card>
      </ModuleShell>

      {/* Account detail sheet */}
      <AccountDetailSheet
        accountId={selectedId}
        isRTL={isRTL}
        onClose={() => setSelectedId(null)}
        onEdit={(a) => { openEdit(a); setSelectedId(null) }}
        onAddChild={(a) => { openAddChild(a); setSelectedId(null) }}
        onDeactivate={(a) => { openDeactivate(a); setSelectedId(null) }}
        onHardDelete={(a) => { openHardDelete(a); setSelectedId(null) }}
        onViewLedger={(a) => { setLedgerId(a.id); setSelectedId(null) }}
      />

      {/* Account statement / general ledger */}
      <LedgerSheet accountId={ledgerId} isRTL={isRTL} onClose={() => setLedgerId(null)} />

      {/* Account create / edit form — key forces remount when target changes */}
      <AccountFormDialog
        key={`${editingAccount?.id ?? 'new'}-${formMode}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editingAccount}
        parentAccount={parentForCreate}
        forceGroup={formMode === 'createGroup'}
        onSubmit={handleFormSubmit}
        isPending={saveMutation.isPending}
        serverErrors={formErrors}
        meta={meta}
      />

      {/* Roles / Determination dialog */}
      <RolesDialog open={rolesOpen} onOpenChange={setRolesOpen} />

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['accounts-tree'] })
          qc.invalidateQueries({ queryKey: ['accounts-stats'] })
          qc.invalidateQueries({ queryKey: ['accounts-flat'] })
        }}
      />

      {/* Deactivate confirm dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={(o) => { if (!o) { setDeactivateTarget(null); setDeactivateReason('') } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden" dir={dir}>
          <DialogHeader className="px-6 py-5 shrink-0">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <DialogTitle>
                  {deactivateTarget?.active ? t('coa.action.deactivateConfirm') : t('coa.action.reactivate')}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {deactivateTarget?.active ? t('coa.action.deactivateDesc') : L('هل تريد إعادة تفعيل هذا الحساب؟', 'Reactivate this account?')}
                </DialogDescription>
                {deactivateTarget && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-xs">{deactivateTarget.code}</span>
                    <span className="text-sm font-medium">{deactivateTarget.nameAr}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>
          {deactivateTarget?.active && (
            <DialogBody>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('coa.action.deactivateReason')}</Label>
                <Input
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  placeholder={L('سبب الإيقاف...', 'Reason for deactivation...')}
                  className="h-9"
                />
              </div>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeactivateTarget(null); setDeactivateReason('') }}>
              {t('action.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (!deactivateTarget) return
                deactivateMutation.mutate({
                  id: deactivateTarget.id,
                  active: !deactivateTarget.active,
                  reason: deactivateReason || undefined,
                })
              }}
              disabled={deactivateMutation.isPending}
              className={cn(
                'text-white',
                deactivateTarget?.active
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700',
              )}
            >
              {deactivateMutation.isPending
                ? L('جاري...', 'Processing...')
                : deactivateTarget?.active ? t('coa.action.deactivate') : t('coa.action.reactivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md p-0 overflow-hidden" dir={dir}>
          <DialogHeader className="px-6 py-5 shrink-0">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle>{t('coa.action.hardDeleteConfirm')}</DialogTitle>
                <DialogDescription className="mt-1">{t('coa.action.hardDeleteDesc')}</DialogDescription>
                {deleteTarget && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-xs">{deleteTarget.code}</span>
                    <span className="text-sm font-medium">{deleteTarget.nameAr}</span>
                  </div>
                )}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('action.cancel')}</Button>
            <Button
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? L('جاري الحذف...', 'Deleting...') : t('action.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default ChartOfAccountsModule
