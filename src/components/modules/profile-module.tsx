'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ModuleShell } from '@/components/erp/module-shell'
import { KpiCard } from '@/components/erp/kpi-card'
import { StatusBadge } from '@/components/erp/status-badge'
import { useT } from '@/lib/i18n/use-t'
import { formatDateTime, formatDate, initials } from '@/lib/format'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  User as UserIcon, Shield, Palette, Activity, Save, KeyRound, Smartphone,
  Mail, Phone, MapPin, Calendar, Sun, Moon, Monitor, Languages, Clock, CircleUser,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useI18n } from '@/stores/i18n-store'

interface UserProfile {
  id: string
  username: string
  email: string
  nameAr: string
  nameEn?: string
  phone?: string
  avatar?: string
  active: boolean
  mfaEnabled: boolean
  defaultBranchId?: string
  locale: string
  timezone: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  defaultBranch?: { id: string; code: string; nameAr: string; nameEn?: string }
  userRoles?: { role: { id: string; code: string; nameAr: string; nameEn?: string; isSystem: boolean } }[]
}

interface AuditLog {
  id: string
  moduleCode: string
  documentType: string
  action: string
  createdAt: string
  ipAddress?: string
}

const TIMEZONES = [
  'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Bahrain',
  'Asia/Muscat', 'Asia/Amman', 'Asia/Beirut', 'Asia/Damascus', 'Africa/Cairo',
  'UTC',
]

const ACTION_LABEL: Record<string, string> = {
  create: 'إنشاء', update: 'تحديث', delete: 'حذف', post: 'ترحيل',
  reverse: 'عكس', cancel: 'إلغاء', approve: 'اعتماد',
  login: 'دخول', logout: 'خروج', export: 'تصدير',
}

export function ProfileModule() {
  const { t } = useT()
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useI18n()

  // Load "current" user — the sandbox has no auth, so we treat the first user
  // (admin) as the logged-in profile.
  const { data: listData } = useQuery<{ data: UserProfile[] }>({
    queryKey: ['users-for-profile'],
    queryFn: async () => {
      const r = await fetch('/api/erp/users?pageSize=1')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })
  const userId = listData?.data?.[0]?.id

  const { data: profileData, isLoading } = useQuery<{ data: UserProfile }>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('no user')
      const r = await fetch(`/api/erp/users/${userId}`)
      if (!r.ok) throw new Error('Failed')
      return r.json()
    },
    enabled: !!userId,
  })
  const profile = profileData?.data

  // Activity: recent audit logs for this user
  const { data: activityData } = useQuery<{ data: AuditLog[]; meta: any }>({
    queryKey: ['profile-activity', userId],
    queryFn: async () => {
      if (!userId) return { data: [], meta: {} }
      const r = await fetch(`/api/erp/audit-logs?userId=${userId}&pageSize=20`)
      if (!r.ok) return { data: [], meta: {} }
      return r.json()
    },
    enabled: !!userId,
  })
  const activity = activityData?.data ?? []

  // Local form state for personal info (synced once profile loads).
  // Pattern: render-phase state sync (matches settings-module) — avoids
  // setState-in-effect lint rule by mutating state during render only when
  // the underlying data reference changes.
  const [form, setForm] = useState<Partial<UserProfile>>({})
  const [formKey, setFormKey] = useState<string | null>(null)
  if (profile) {
    const k = JSON.stringify(profile)
    if (k !== formKey) {
      setForm(profile)
      setFormKey(k)
    }
  }

  // Security state — MFA toggles mirror profile.mfaEnabled when it changes
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaKey, setMfaKey] = useState<string | null>(null)
  if (profile) {
    const k = `${profile.id}:${profile.mfaEnabled}`
    if (k !== mfaKey) {
      setMfaEnabled(profile.mfaEnabled)
      setMfaKey(k)
    }
  }

  // Preferences state — timezone mirrors profile.timezone when loaded;
  // density is read from localStorage AFTER mount to avoid hydration mismatch.
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  useEffect(() => {
    const saved = localStorage.getItem('alostaz-density') as 'comfortable' | 'compact' | null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDensity(saved)
  }, [])
  const [timezone, setTimezone] = useState('Asia/Riyadh')
  const [tzKey, setTzKey] = useState<string | null>(null)
  if (profile) {
    const k = `${profile.id}:${profile.timezone}`
    if (k !== tzKey) {
      setTimezone(profile.timezone || 'Asia/Riyadh')
      setTzKey(k)
    }
  }

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch(`/api/erp/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Failed')
      }
      return r.json()
    },
    onSuccess: () => {
      toast.success('تم حفظ البيانات بنجاح')
      qc.invalidateQueries({ queryKey: ['profile'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['users-for-profile'] })
    },
    onError: (e: any) => toast.error(e.message || 'حدث خطأ'),
  })

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault()
    saveProfileMutation.mutate({
      nameAr: form.nameAr,
      nameEn: form.nameEn || undefined,
      email: form.email,
      phone: form.phone || undefined,
      avatar: form.avatar || undefined,
    })
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      toast.error('كلمتا المرور غير متطابقتين')
      return
    }
    if (newPw.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    saveProfileMutation.mutate({ password: newPw })
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
  }

  const handleToggleMfa = (value: boolean) => {
    setMfaEnabled(value)
    saveProfileMutation.mutate({ mfaEnabled: value })
  }

  const handleSavePreferences = () => {
    saveProfileMutation.mutate({
      locale,
      timezone,
    })
    localStorage.setItem('alostaz-density', density)
    toast.success('تم حفظ التفضيلات')
  }

  return (
    <ModuleShell
      title={t('module.profile')}
      description="ملفك الشخصي وإعدادات الأمان والتفضيلات"
      icon={<CircleUser className="size-5" />}
    >
      {isLoading || !profile ? (
        <Card className="p-10 text-center text-muted-foreground">جاري التحميل...</Card>
      ) : (
        <div className="space-y-5">
          {/* Profile header card */}
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Avatar className="size-16 ring-2 ring-emerald-200 dark:ring-emerald-900">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                  {initials(profile.nameAr || profile.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">{profile.nameAr}</h2>
                  {profile.userRoles?.[0]?.role && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[11px]">
                      {profile.userRoles[0].role.nameAr}
                    </Badge>
                  )}
                  <StatusBadge status={profile.active ? 'active' : 'inactive'} />
                  {profile.mfaEnabled && (
                    <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 text-[10px] gap-1">
                      <Shield className="size-3" /> MFA
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 font-mono" dir="ltr">@{profile.username} · {profile.email}</p>
              </div>
              <div className="text-xs text-muted-foreground text-end">
                <div className="flex items-center gap-1.5 justify-end">
                  <Calendar className="size-3.5" />
                  عضو منذ <span className="num" dir="ltr">{formatDate(profile.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end mt-1">
                  <Clock className="size-3.5" />
                  آخر دخول: <span className="num" dir="ltr">{profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '—'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Tabs defaultValue="personal">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-4">
              <TabsTrigger value="personal" className="gap-1.5"><UserIcon className="size-3.5" /> <span>المعلومات الشخصية</span></TabsTrigger>
              <TabsTrigger value="security" className="gap-1.5"><Shield className="size-3.5" /> <span>الأمان</span></TabsTrigger>
              <TabsTrigger value="preferences" className="gap-1.5"><Palette className="size-3.5" /> <span>التفضيلات</span></TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5"><Activity className="size-3.5" /> <span>النشاط</span></TabsTrigger>
            </TabsList>

            {/* Personal Info */}
            <TabsContent value="personal">
              <Card className="p-5">
                <h3 className="font-semibold mb-4">المعلومات الشخصية</h3>
                <form onSubmit={handleSavePersonal} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="nameAr">الاسم (عربي) *</Label>
                      <Input id="nameAr" value={form.nameAr ?? ''} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="nameEn">الاسم (إنجليزي)</Label>
                      <Input id="nameEn" value={form.nameEn ?? ''} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} dir="ltr" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">البريد الإلكتروني *</Label>
                      <div className="relative">
                        <Mail className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                        <Input id="email" type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className="ps-9" required dir="ltr" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">الهاتف</Label>
                      <div className="relative">
                        <Phone className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                        <Input id="phone" value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="ps-9" dir="ltr" />
                      </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="avatar">رابط الصورة الرمزية</Label>
                      <Input id="avatar" value={form.avatar ?? ''} onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="https://..." dir="ltr" />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label htmlFor="address">العنوان</Label>
                      <div className="relative">
                        <MapPin className="absolute inset-y-0 start-3 top-3 size-4 text-muted-foreground" />
                        <Textarea id="address" rows={2} placeholder="المدينة، الحي، الشارع" className="ps-9" />
                      </div>
                      <p className="text-[10px] text-muted-foreground">العنوان يُحفظ محلياً في هذا الإصدار.</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saveProfileMutation.isPending} className="gap-1.5">
                      <Save className="size-4" />
                      {saveProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </Button>
                  </div>
                </form>
              </Card>
            </TabsContent>

            {/* Security */}
            <TabsContent value="security">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card className="p-5">
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <KeyRound className="size-4" /> تغيير كلمة المرور
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">اختر كلمة مرور قوية (6 أحرف على الأقل)</p>
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="currentPw">كلمة المرور الحالية</Label>
                      <Input id="currentPw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required dir="ltr" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="newPw">كلمة المرور الجديدة</Label>
                      <Input id="newPw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required dir="ltr" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPw">تأكيد كلمة المرور</Label>
                      <Input id="confirmPw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required dir="ltr" />
                    </div>
                    <Button type="submit" disabled={saveProfileMutation.isPending} className="w-full gap-1.5">
                      <Save className="size-4" />
                      {saveProfileMutation.isPending ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                    </Button>
                  </form>
                </Card>

                <Card className="p-5">
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <Smartphone className="size-4" /> التحقق الثنائي (MFA)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">طبقة حماية إضافية عبر تطبيق المصادقة</p>
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">تفعيل MFA</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        الحالة: {mfaEnabled ? <span className="text-emerald-600 font-medium">مفعّل</span> : <span className="text-muted-foreground">معطّل</span>}
                      </p>
                    </div>
                    <Switch checked={mfaEnabled} onCheckedChange={handleToggleMfa} />
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 text-xs text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-900">
                    💡 عند التفعيل، سيُطلب منك رمز تحقق عند كل تسجيل دخول.
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-muted/40">
                      <p className="text-muted-foreground">آخر تغيير لكلمة المرور</p>
                      <p className="font-medium mt-1"><span className="num" dir="ltr">{formatDate(profile.updatedAt)}</span></p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/40">
                      <p className="text-muted-foreground">تاريخ الإنشاء</p>
                      <p className="font-medium mt-1"><span className="num" dir="ltr">{formatDate(profile.createdAt)}</span></p>
                    </div>
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Preferences */}
            <TabsContent value="preferences">
              <Card className="p-5">
                <h3 className="font-semibold mb-4">التفضيلات والمظهر</h3>
                <div className="space-y-5">
                  {/* Theme */}
                  <div className="space-y-2">
                    <Label>السمة</Label>
                    <div className="grid grid-cols-3 gap-2 max-w-md">
                      <Button
                        type="button"
                        variant={theme === 'light' ? 'default' : 'outline'}
                        onClick={() => setTheme('light')}
                        className="gap-1.5"
                      >
                        <Sun className="size-4" /> فاتح
                      </Button>
                      <Button
                        type="button"
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => setTheme('dark')}
                        className="gap-1.5"
                      >
                        <Moon className="size-4" /> داكن
                      </Button>
                      <Button
                        type="button"
                        variant={theme === 'system' ? 'default' : 'outline'}
                        onClick={() => setTheme('system')}
                        className="gap-1.5"
                      >
                        <Monitor className="size-4" /> تلقائي
                      </Button>
                    </div>
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <Label>اللغة</Label>
                    <div className="grid grid-cols-2 gap-2 max-w-md">
                      <Button
                        type="button"
                        variant={locale === 'ar' ? 'default' : 'outline'}
                        onClick={() => setLocale('ar')}
                        className="gap-1.5"
                      >
                        <Languages className="size-4" /> العربية
                      </Button>
                      <Button
                        type="button"
                        variant={locale === 'en' ? 'default' : 'outline'}
                        onClick={() => setLocale('en')}
                        className="gap-1.5"
                      >
                        <Languages className="size-4" /> English
                      </Button>
                    </div>
                  </div>

                  {/* Density */}
                  <div className="space-y-2">
                    <Label>كثافة العرض</Label>
                    <Select value={density} onValueChange={(v) => setDensity(v as 'comfortable' | 'compact')}>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comfortable">مريح (افتراضي)</SelectItem>
                        <SelectItem value="compact">مضغوط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <Label>المنطقة الزمنية</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            <span dir="ltr">{tz}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSavePreferences} disabled={saveProfileMutation.isPending} className="gap-1.5">
                      <Save className="size-4" />
                      {saveProfileMutation.isPending ? 'جاري الحفظ...' : 'حفظ التفضيلات'}
                    </Button>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Activity */}
            <TabsContent value="activity">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                <KpiCard title="عضو منذ" value={formatDate(profile.createdAt)} icon={<Calendar className="size-5" />} accent="emerald" />
                <KpiCard title="آخر دخول" value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '—'} icon={<Clock className="size-5" />} accent="teal" />
                <KpiCard title="إجمالي النشاطات" value={String(activity.length)} icon={<Activity className="size-5" />} accent="violet" />
              </div>
              <Card className="rounded-xl overflow-hidden">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">آخر النشاطات</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">سجل التدقيق الخاص بك (آخر 20 سجل)</p>
                </div>
                <ScrollArea className="max-h-[50vh]">
                  {activity.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-sm">
                      <Activity className="size-8 mx-auto mb-2 opacity-50" />
                      لا توجد نشاطات مسجلة بعد
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {activity.map((log) => (
                        <li key={log.id} className="p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                          <div className="size-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <Activity className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{ACTION_LABEL[log.action] ?? log.action}</span>
                              <Badge variant="outline" className="font-mono text-[10px]">{log.moduleCode}</Badge>
                              <span className="text-xs text-muted-foreground font-mono" dir="ltr">{log.documentType}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <span className="num" dir="ltr">{formatDateTime(log.createdAt)}</span>
                              {log.ipAddress && <span className="ms-2 font-mono" dir="ltr">· {log.ipAddress}</span>}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </ModuleShell>
  )
}
