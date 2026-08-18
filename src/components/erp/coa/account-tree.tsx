'use client'

import { memo, useCallback } from 'react'
import { useT } from '@/lib/i18n/use-t'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronRight, ChevronDown, Lock, MoreHorizontal, Plus, Pencil, PowerOff,
  RotateCcw, Trash2, BookOpenText, Eye, Copy,
} from 'lucide-react'
import { formatCurrency } from '@/lib/format'
import { getClassMeta } from './class-meta'
import type { AccountNode } from './types'

interface AccountTreeProps {
  nodes: AccountNode[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (node: AccountNode) => void
  onEdit: (node: AccountNode) => void
  onAddChild: (node: AccountNode) => void
  onDeactivate: (node: AccountNode) => void
  onHardDelete: (node: AccountNode) => void
  onViewLedger: (node: AccountNode) => void
  isLoading: boolean
}

interface TreeRowProps {
  node: AccountNode
  depth: number
  isRTL: boolean
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect: (node: AccountNode) => void
  onEdit: (node: AccountNode) => void
  onAddChild: (node: AccountNode) => void
  onDeactivate: (node: AccountNode) => void
  onHardDelete: (node: AccountNode) => void
  onViewLedger: (node: AccountNode) => void
}

const INDENT_PX = 20
const VISIBLE_ROWS = 6
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 44

const stickyHead =
  'sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold whitespace-nowrap shadow-[inset_0_-1px_0_0_hsl(var(--border))] text-xs select-none py-2.5'

function TreeRow({
  node, depth, isRTL, expanded, onToggle, onSelect, onEdit, onAddChild, onDeactivate, onHardDelete, onViewLedger,
}: TreeRowProps) {
  const { t } = useT()
  const hasChildren = (node.children?.length ?? 0) > 0 || (node.descendantCount ?? 0) > 0
  const isExpanded = expanded.has(node.id)
  const classMeta = getClassMeta(node.accountClass)
  const balance = node.isPosting ? (node.ownBalance ?? node.balance ?? 0) : (node.aggregateBalance ?? node.balance ?? 0)

  const indentStyle = isRTL
    ? { paddingRight: `${depth * INDENT_PX + 16}px` }
    : { paddingLeft: `${depth * INDENT_PX + 16}px` }

  return (
    <>
      <tr
        className={cn(
          'group transition-colors',
          node.active ? 'hover:bg-muted/40' : 'opacity-60 hover:bg-muted/30',
          !node.isPosting && depth === 0 && 'bg-muted/20',
        )}
      >
        {/* Code + expand */}
        <td className="py-2 whitespace-nowrap border-b border-slate-100 dark:border-slate-800/60" style={indentStyle}>
          <div className="flex items-center gap-1.5">
            {/* Guide lines for depth > 0 */}
            {hasChildren ? (
              <button
                onClick={() => onToggle(node.id)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? t('coa.collapseAll') : t('coa.expandAll')}
                className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
              >
                {isExpanded
                  ? <ChevronDown className="size-3.5" />
                  : <ChevronRight className={cn('size-3.5', isRTL && 'rotate-180')} />
                }
              </button>
            ) : (
              <span className="size-5 shrink-0" />
            )}
            <span
              className={cn(
                'font-mono text-xs tabular-nums select-none cursor-pointer hover:text-primary transition-colors',
                !node.isPosting && 'font-semibold text-foreground',
                node.isPosting && 'text-muted-foreground',
              )}
              dir="ltr"
              onClick={() => onSelect(node)}
            >
              {node.code}
            </span>
          </div>
        </td>

        {/* Name */}
        <td className="py-2 pe-3 border-b border-slate-100 dark:border-slate-800/60">
          <button
            className="flex items-center gap-2 text-start hover:text-primary transition-colors w-full focus-visible:outline-none focus-visible:underline"
            onClick={() => onSelect(node)}
          >
            <span className={cn(
              'text-sm truncate max-w-[280px]',
              !node.isPosting && 'font-semibold',
            )}>
              {node.nameAr}
            </span>
            {node.isSystem && (
              <Badge className="shrink-0 gap-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900 text-[10px]">
                <Lock className="size-2.5" />{t('coa.systemBadge')}
              </Badge>
            )}
            {!node.active && (
              <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
                {t('coa.inactiveBadge')}
              </Badge>
            )}
          </button>
          {/* System roles chips */}
          {node.roles && node.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {node.roles.slice(0, 3).map((role) => (
                <span key={role} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900 font-mono">
                  {role}
                </span>
              ))}
              {node.roles.length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{node.roles.length - 3}</span>
              )}
            </div>
          )}
        </td>

        {/* Class badge */}
        <td className="py-2 pe-3 border-b border-slate-100 dark:border-slate-800/60">
          <Badge
            variant="outline"
            className={cn('text-[10px] font-semibold whitespace-nowrap', classMeta.badgeClass)}
          >
            {classMeta.labelAr}
          </Badge>
        </td>

        {/* Kind badge */}
        <td className="py-2 pe-3 border-b border-slate-100 dark:border-slate-800/60">
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold',
              node.isPosting
                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900'
                : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
            )}
          >
            {node.isPosting ? t('coa.kind.posting') : t('coa.kind.group')}
          </Badge>
        </td>

        {/* Balance */}
        <td className="py-2 pe-3 text-end border-b border-slate-100 dark:border-slate-800/60">
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              balance < 0 ? 'text-rose-600 dark:text-rose-400' : classMeta.color,
            )}
            dir="ltr"
          >
            {formatCurrency(balance)}
          </span>
        </td>

        {/* Currency */}
        <td className="py-2 pe-3 text-center border-b border-slate-100 dark:border-slate-800/60">
          <span className="text-xs text-muted-foreground font-mono">{node.currencyId ? node.currencyId : '—'}</span>
        </td>

        {/* Status dot */}
        <td className="py-2 pe-3 text-center border-b border-slate-100 dark:border-slate-800/60">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium',
            node.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}>
            <span className={cn('size-1.5 rounded-full', node.active ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
            {node.active ? t('coa.activeBadge') : t('coa.inactiveBadge')}
          </span>
        </td>

        {/* Actions */}
        <td className="py-2 pe-4 text-end border-b border-slate-100 dark:border-slate-800/60">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                aria-label={t('action.actions')}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? 'start' : 'end'} sideOffset={4} className="w-48">
              <DropdownMenuItem onClick={() => onSelect(node)} className="gap-2 text-xs">
                <Eye className="size-3.5 text-blue-600" />
                {t('action.view')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewLedger(node)} className="gap-2 text-xs">
                <BookOpenText className="size-3.5 text-violet-600" />
                {t('coa.action.viewLedger')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(node)} className="gap-2 text-xs">
                <Pencil className="size-3.5 text-slate-600" />
                {t('coa.action.edit')}
              </DropdownMenuItem>
              {!node.isPosting && (
                <DropdownMenuItem onClick={() => onAddChild(node)} className="gap-2 text-xs">
                  <Plus className="size-3.5 text-emerald-600" />
                  {t('coa.action.createChild')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {node.active ? (
                <DropdownMenuItem
                  onClick={() => onDeactivate(node)}
                  className="gap-2 text-xs text-amber-600 focus:text-amber-700"
                >
                  <PowerOff className="size-3.5" />
                  {t('coa.action.deactivate')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onDeactivate(node)}
                  className="gap-2 text-xs text-emerald-600 focus:text-emerald-700"
                >
                  <RotateCcw className="size-3.5" />
                  {t('coa.action.reactivate')}
                </DropdownMenuItem>
              )}
              {!node.isSystem && (
                <DropdownMenuItem
                  onClick={() => onHardDelete(node)}
                  className="gap-2 text-xs text-rose-600 focus:text-rose-700"
                >
                  <Trash2 className="size-3.5" />
                  {t('coa.action.hardDelete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {/* Render children if expanded */}
      {isExpanded && node.children?.map((child) => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          isRTL={isRTL}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDeactivate={onDeactivate}
          onHardDelete={onHardDelete}
          onViewLedger={onViewLedger}
        />
      ))}
    </>
  )
}

const MemoTreeRow = memo(TreeRow)

export function AccountTree({
  nodes,
  expanded,
  onToggle,
  onSelect,
  onEdit,
  onAddChild,
  onDeactivate,
  onHardDelete,
  onViewLedger,
  isLoading,
}: AccountTreeProps) {
  const { t, isRTL } = useT()

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <BookOpenText className="size-12 text-muted-foreground/30" />
        <div>
          <p className="font-semibold text-muted-foreground">{t('coa.empty.noResults')}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t('coa.empty.noAccountsDesc')}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="w-full overflow-y-auto overflow-x-auto overscroll-contain scrollbar-thin"
      style={{ maxHeight: HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT }}
    >
      <table className="w-full caption-bottom text-sm min-w-[940px] table-fixed border-separate border-spacing-0">
        <colgroup>
          <col className="w-[170px]" />
          <col className="w-[260px]" />
          <col className="w-[130px]" />
          <col className="w-[100px]" />
          <col className="w-[140px]" />
          <col className="w-[80px]" />
          <col className="w-[100px]" />
          <col className="w-[60px]" />
        </colgroup>
        <thead>
          <tr className="hover:bg-transparent">
            <th className={cn(stickyHead, 'ps-4 text-start')}>{t('coa.col.code')}</th>
            <th className={cn(stickyHead, 'text-start')}>{t('coa.col.name')}</th>
            <th className={cn(stickyHead, 'text-start')}>{t('coa.col.class')}</th>
            <th className={cn(stickyHead, 'text-start')}>{t('coa.col.kind')}</th>
            <th className={cn(stickyHead, 'text-end pe-3')}>{t('coa.col.balance')}</th>
            <th className={cn(stickyHead, 'text-center')}>{t('coa.col.currency')}</th>
            <th className={cn(stickyHead, 'text-center')}>{t('coa.col.status')}</th>
            <th className={cn(stickyHead, 'text-end pe-4')}>{t('coa.col.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <MemoTreeRow
              key={node.id}
              node={node}
              depth={0}
              isRTL={isRTL}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDeactivate={onDeactivate}
              onHardDelete={onHardDelete}
              onViewLedger={onViewLedger}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
