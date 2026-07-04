'use client'

import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { Construction } from 'lucide-react'

export function ModuleComingSoon({ title, description }: { title: string; description?: string }) {
  const { t } = useT()
  return (
    <ModuleShell title={title} description={description} icon={<Construction className="size-5" />}>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Construction className="size-8" />
        </div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {description ?? 'هذه الوحدة قيد التطوير وستكون متاحة قريباً.'}
        </p>
      </div>
    </ModuleShell>
  )
}
