'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { useI18n } from '@/stores/i18n-store'
import { formatDate, formatDateTime } from '@/lib/format'
import { toast } from 'sonner'
import { User, Shield, Settings, Activity, Camera, Save, Lock, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function ProfileModule() {
  const { t } = useT()
  const { locale, setLocale } = useI18n()
  const { theme, setTheme } = useTheme()

  // Fetch the first user as the "current user" for demo
  const { data: user } = useQuery<any>({
    queryKey: ['me'],
    queryFn: async () => {
      const r = await fetch('/api/erp/users')
      if (!r.ok) throw new Error()
      const j = await r.json()
      return j.data?.[0]
    },
  })

  const [personal, setPersonal] = useState({ name: '', email: '', phone: '', address: '' })
  const [security, setSecurity] = useState({ current: '', next: '', confirm: '' })
  const [userId, setUserId] = useState<string | null>(null)

  // Sync personal form when the user record loads/changes.
  // Using conditional setState-during-render (React 19) instead of useEffect.
  if (user && user.id !== userId) {
    setUserId(user.id)
    setPersonal({ name: user.name ?? '', email: user.email ?? '', phone: user.phone ?? '', address: '' })
  }

  const savePersonal = useMutation({
    mutationFn: async (payload: any) => {
      if (!user) throw new Error('no user')
      const r = await fetch(`/api/erp/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error()
      return r.json()
    },
    onSuccess: () => toast.success(t('success.saved')),
    onError: () => toast.error(t('error.save')),
  })

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('no user')
      if (security.next !== security.confirm) throw new Error('كلمتا المرور غير متطابقتين')
      if (security.next.length < 6) throw new Error('كلمة المرور قصيرة جداً')
      const r = await fetch(`/api/erp/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: security.next }),
      })
      if (!r.ok) throw new Error()
    },
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور')
      setSecurity({ current: '', next: '', confirm: '' })
    },
    onError: (e: any) => toast.error(e.message || t('error.save')),
  })

  return (
    <ModuleShell
      title={t('module.profile')}
      description="ملفك الشخصي وتفضيلاتك"
      icon={<User className="size-5" />}
    >
      {/* Profile header */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative">
            <Avatar className="size-20 ring-4 ring-background shadow-md">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {(user?.name ?? 'م ن').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <button className="absolute -bottom-1 -end-1 size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center ring-2 ring-background hover:scale-110 transition-transform" title="تغيير الصورة">
              <Camera className="size-4" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold">{user?.name ?? '—'}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <Mail className="size-3.5" /> {user?.email ?? '—'}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Shield className="size-3.5" /> {user ? t(`role.${user.role}` as any) : '—'}
              </span>
              {user?.branch?.name && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {user.branch.name}
                </span>
              )}
              {user?.createdAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5" /> عضو منذ {formatDate(user.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="personal" className="gap-4">
        <TabsList className="flex w-max justify-start gap-1 bg-transparent h-auto p-1">
          <TabsTrigger value="personal" className="gap-1.5 whitespace-nowrap text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><User className="size-3.5" /> المعلومات الشخصية</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 whitespace-nowrap text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Lock className="size-3.5" /> الأمان</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-1.5 whitespace-nowrap text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Settings className="size-3.5" /> التفضيلات</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5 whitespace-nowrap text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Activity className="size-3.5" /> النشاط</TabsTrigger>
        </TabsList>

        {/* PERSONAL */}
        <TabsContent value="personal">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">المعلومات الشخصية</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>الاسم الكامل</Label>
                <Input value={personal.name || user?.name || ''} onChange={(e) => setPersonal({ ...personal, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={personal.email || user?.email || ''} onChange={(e) => setPersonal({ ...personal, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>الهاتف</Label>
                <Input value={personal.phone || user?.phone || ''} onChange={(e) => setPersonal({ ...personal, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>العنوان</Label>
                <Input value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} placeholder="المدينة، الدولة" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => savePersonal.mutate({ name: personal.name, email: personal.email, phone: personal.phone, role: user?.role, branchId: user?.branchId, active: user?.active })} disabled={savePersonal.isPending} className="gap-1.5">
                <Save className="size-4" /> {savePersonal.isPending ? t('loading') : t('action.save')}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Lock className="size-4" /> تغيير كلمة المرور</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
              <div className="space-y-1.5">
                <Label>كلمة المرور الحالية</Label>
                <Input type="password" value={security.current} onChange={(e) => setSecurity({ ...security, current: e.target.value })} placeholder="••••••" />
              </div>
              <div className="space-y-1.5">
                <Label>كلمة المرور الجديدة</Label>
                <Input type="password" value={security.next} onChange={(e) => setSecurity({ ...security, next: e.target.value })} placeholder="••••••" />
              </div>
              <div className="space-y-1.5">
                <Label>تأكيد كلمة المرور</Label>
                <Input type="password" value={security.confirm} onChange={(e) => setSecurity({ ...security, confirm: e.target.value })} placeholder="••••••" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending} className="gap-1.5">
                <Lock className="size-4" /> {changePassword.isPending ? t('loading') : 'تغيير كلمة المرور'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* PREFERENCES */}
        <TabsContent value="preferences">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Settings className="size-4" /> التفضيلات</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">{t('appearance.theme')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'light', label: t('appearance.theme.light'), icon: '☀️' },
                    { v: 'dark', label: t('appearance.theme.dark'), icon: '🌙' },
                    { v: 'system', label: t('appearance.theme.system'), icon: '🖥️' },
                  ].map((opt) => (
                    <button key={opt.v} onClick={() => setTheme(opt.v)} className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-lg border text-sm font-medium transition-all ${theme === opt.v ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted border-border'}`}>
                      <span className="text-lg">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">{t('appearance.language')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'ar', label: t('appearance.language.ar'), icon: '🇸🇦' },
                    { v: 'en', label: t('appearance.language.en'), icon: '🇬🇧' },
                  ].map((opt) => (
                    <button key={opt.v} onClick={() => setLocale(opt.v as 'ar' | 'en')} className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-lg border text-sm font-medium transition-all ${locale === opt.v ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted border-border'}`}>
                      <span className="text-lg">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity">
          <Card className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="size-4" /> النشاط</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Calendar className="size-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">عضو منذ</p>
                  <p className="text-sm font-semibold"><span className="num">{user?.createdAt ? formatDate(user.createdAt) : '—'}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Activity className="size-5 text-emerald-600" />
                <div>
                  <p className="text-xs text-muted-foreground">آخر تحديث</p>
                  <p className="text-sm font-semibold"><span className="num">{user?.updatedAt ? formatDateTime(user.updatedAt) : '—'}</span></p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </ModuleShell>
  )
}
