'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'

export function RoleBadge() {
  const { t } = useT()
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 p-2.5 ring-1 ring-sidebar-border">
      <Avatar className="size-9 ring-2 ring-background">
        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">م ن</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">مدير النظام</p>
        <Badge variant="outline" className="mt-0.5 text-[10px] py-0 h-4 gap-0.5 bg-primary/10 text-primary border-primary/20">
          <ShieldCheck className="size-2.5" />
          {t('role.admin')}
        </Badge>
      </div>
    </div>
  )
}
