'use client'

import { useSession } from 'next-auth/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck } from 'lucide-react'
import { useT } from '@/lib/i18n/use-t'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function RoleBadge() {
  const { data: session } = useSession()
  const { t } = useT()

  const name = session?.user?.nameAr ?? 'مدير النظام'
  const roleKey = `role.${session?.user?.roleCode ?? 'admin'}` as any

  return ( // role.admin, role.manager, etc.
    <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 p-2.5 ring-1 ring-sidebar-border">
      <Avatar className="size-9 ring-2 ring-background">
        {session?.user?.avatar && <AvatarImage src={session.user.avatar} alt={name} />}
        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold truncate">{name}</p>
        <Badge
          variant="outline"
          className="mt-0.5 text-[10px] py-0 h-4 gap-0.5 bg-primary/10 text-primary border-primary/20"
        >
          <ShieldCheck className="size-2.5" />
          {t(roleKey)}
        </Badge>
      </div>
    </div>
  )
}
