'use client'

import { useState, useMemo, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useI18n } from '@/stores/i18n-store'
import { useT } from '@/lib/i18n/use-t'
import { useTheme } from 'next-themes'
import {
  Eye, EyeOff, Loader2, ShieldCheck, CheckCircle2, User, Lock, Mail, Building2,
  Sparkles, Check, Languages, Sun, Moon, Monitor, ArrowRight, ArrowLeft,
  ChevronRight, KeyRound, AlertCircle, Info, Layers, BarChart3, Globe, ShieldAlert,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AuthPageProps {
  initialMode?: 'login' | 'signup'
}

export default function AuthPage({ initialMode = 'login' }: AuthPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode')

  const [mode, setMode] = useState<'login' | 'signup'>(
    (modeParam === 'signup' || modeParam === 'login') ? modeParam : initialMode
  )

  const { locale, setLocale } = useI18n()
  const { t, isRTL, dir } = useT()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Login form state
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showLoginPass, setShowLoginPass] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [demoFilledToast, setDemoFilledToast] = useState(false)

  // Sign up form state
  const [signUpName, setSignUpName] = useState('')
  const [signUpUsername, setSignUpUsername] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpCompany, setSignUpCompany] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [showSignUpPass, setShowSignUpPass] = useState(false)
  const [showSignUpConfirmPass, setShowSignUpConfirmPass] = useState(false)
  const [signUpLoading, setSignUpLoading] = useState(false)
  const [signUpError, setSignUpError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState<string | null>(null)

  // Forgot Password Dialog state
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!signUpPassword) return { score: 0, label: '', color: '' }
    let score = 0
    if (signUpPassword.length >= 6) score += 1
    if (signUpPassword.length >= 8) score += 1
    if (/[A-Z]/.test(signUpPassword) && /[a-z]/.test(signUpPassword)) score += 1
    if (/[0-9]/.test(signUpPassword)) score += 1
    if (/[^A-Za-z0-9]/.test(signUpPassword)) score += 1

    if (score <= 1) return { score: 1, label: isRTL ? 'ضعيفة' : 'Weak', color: 'bg-rose-500' }
    if (score <= 3) return { score: 2, label: isRTL ? 'متوسطة' : 'Fair', color: 'bg-amber-500' }
    if (score === 4) return { score: 3, label: isRTL ? 'قوية' : 'Strong', color: 'bg-emerald-500' }
    return { score: 4, label: isRTL ? 'ممتازة' : 'Excellent', color: 'bg-blue-600' }
  }, [signUpPassword, isRTL])

  // Handle Quick Demo Login
  const handleQuickDemo = () => {
    setLoginUsername('admin')
    setLoginPassword('admin123')
    setLoginError(null)
    setDemoFilledToast(true)
    setTimeout(() => setDemoFilledToast(false), 3000)
  }

  // Handle Login Submit
  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoginLoading(true)

    try {
      const result = await signIn('credentials', {
        username: loginUsername.trim(),
        password: loginPassword,
        redirect: false,
      })

      if (result?.error) {
        setLoginError(isRTL ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Invalid username or password')
      } else {
        router.replace('/')
        router.refresh()
      }
    } catch {
      setLoginError(isRTL ? 'حدث خطأ أثناء الاتصال بالخادم. الرجاء المحاولة لاحقاً' : 'Connection error. Please try again later')
    } finally {
      setLoginLoading(false)
    }
  }

  // Handle Sign Up Submit
  async function handleSignUpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSignUpError(null)
    setSignUpSuccess(null)

    if (!agreeTerms) {
      setSignUpError(isRTL ? 'يجب الموافقة على الشروط والأحكام وسياسة الخصوصية للمتابعة' : 'You must agree to the Terms & Privacy Policy to proceed')
      return
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setSignUpError(isRTL ? 'كلمة المرور وتأكيد كلمة المرور غير متطابقين' : 'Passwords do not match')
      return
    }

    setSignUpLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpName,
          username: signUpUsername,
          email: signUpEmail,
          companyName: signUpCompany,
          password: signUpPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setSignUpError(data.error || (isRTL ? 'فشل إنشاء الحساب. حاول مجدداً' : 'Registration failed. Try again.'))
      } else {
        setSignUpSuccess(isRTL ? 'تم إنشاء حسابك بنجاح! جاري تسجيل دخولك ...' : 'Account created successfully! Logging you in...')

        // Auto login after sign up
        setTimeout(async () => {
          const result = await signIn('credentials', {
            username: signUpUsername.trim(),
            password: signUpPassword,
            redirect: false,
          })
          if (result?.error) {
            setMode('login')
            setLoginUsername(signUpUsername)
            setLoginError(isRTL ? 'تم إنشاء الحساب! أدخل كلمة المرور لتسجيل الدخول.' : 'Account created! Enter password to log in.')
          } else {
            router.replace('/')
            router.refresh()
          }
        }, 1200)
      }
    } catch {
      setSignUpError(isRTL ? 'حدث خطأ في الاتصال بالخادم' : 'Server connection error')
    } finally {
      setSignUpLoading(false)
    }
  }

  // Handle Forgot Password Submit
  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotEmail) return
    setForgotLoading(true)
    setTimeout(() => {
      setForgotLoading(false)
      setForgotSuccess(true)
    }, 1000)
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans" dir={dir}>
      {/* LEFT / RIGHT BRANDING HERO COLUMN (Hidden on Small Screens) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-950 text-white relative overflow-hidden flex-col justify-between p-12 border-e border-blue-900/40">
        {/* Animated Background Glow Blobs */}
        <div className="absolute -top-32 -start-32 size-96 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -end-32 size-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 start-1/3 size-96 rounded-full bg-sky-500/15 blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

        {/* Top Branding Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-inner flex items-center justify-center">
              <img src="/logo.png" alt="أورمنال" className="size-8 object-contain" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block" > {isRTL ? "أورمنال ERP" : "Orminal ERP"}</span>
              <span className="text-xs text-blue-200/80 font-medium block">Enterprise Business Management Platform</span>
            </div>
          </div>
        </div>

        {/* Middle Hero Content */}
        <div className="relative z-10 my-auto space-y-8 py-8">
          <div className="space-y-4">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 border border-blue-400/30 px-3.5 py-1 text-xs font-semibold text-blue-300 backdrop-blur-md">
                <Sparkles className="size-3.5 text-blue-400" />
                {isRTL ? 'إدارة متكاملة ... وأداء بلا حدود.' : 'Integrated Management... Limitless Performance'}
              </div>

              <div>
                <Badge variant="outline" className="bg-blue-850/40 text-blue-200 border-blue-400/30 backdrop-blur-md px-4 py-8 text-xs">
                  <div className="space-y-2 text-start">
                    <h4 className="text-[14px] font-bold text-green-600">
                      <span className="bg-green-100 rounded-full px-2 py-1 inline-block">
                        {isRTL ? 'معتمد من ZATCA' : 'ZATCA Compliant'}
                      </span>
                    </h4>
                    <p className="text-[13px] text-blue-100/80  py-1 ">
                      {isRTL ? "1- الفاتورة الإلكترونية" : "1- E-Invoicing"}
                    </p>
                    <p className="text-[13px] text-blue-100/80">
                      {isRTL ? "2- التقارير الضريبية" : "2- Tax Reports"}
                    </p>
                  </div>
                </Badge>
              </div>
            </div>

            <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-snug text-white">
              {isRTL
                ? 'إدارة مؤسستك بدقة... واتخذ قراراتك بثقة'
                : 'Manage your business with precision... Make every decision with confidence'}
            </h1>

            <p className="text-sm xl:text-base text-blue-100/80 max-w-xl leading-relaxed">
              {isRTL
                ? 'نظام ERP متكامل يجمع عمليات المؤسسة في نظام واحد تشمل المحاسبة والمالية والمبيعات والمشتريات والمخزون والموارد البشرية والفروع، مع تقارير لحظية، أتمتة ذكية، وصلاحيات مؤسسية متقدمة.'
                : 'An integrated ERP system that unifies enterprise operations in one system including accounting, finance, sales, purchasing, inventory, human resources, and branches, with real-time reporting, smart automation, and advanced enterprise permissions.'}
            </p>
          </div>

          {/* Value proposition feature highlights grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/20 shrink-0">
                <Layers className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{isRTL ? 'قيود مزدوجة آلية' : 'Automated Ledger'}</h4>
                <p className="text-[11px] text-blue-200/70 mt-0.5">{isRTL ? 'ربط آلي للعمليات بالدليل المحاسبي' : 'Real-time journal entry generation'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{isRTL ? 'امتثال ZATCA الفاز 2' : 'ZATCA Phase 2 Ready'}</h4>
                <p className="text-[11px] text-blue-200/70 mt-0.5">{isRTL ? 'فوترة ضريبية ممتثلة ومعتمدة' : 'Tax & E-Invoicing Compliance'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 shrink-0">
                <Building2 className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{isRTL ? 'مستودعات وفروع موحدة' : 'Unified Multi-Branch'}</h4>
                <p className="text-[11px] text-blue-200/70 mt-0.5">{isRTL ? 'إدارة دقيقة لمخزون الأفرع' : 'Real-time stock transfers & control'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/20 shrink-0">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{isRTL ? 'تقارير مالية ختامية' : 'Executive Reporting'}</h4>
                <p className="text-[11px] text-blue-200/70 mt-0.5">{isRTL ? 'ميزان المراجعة والأرباح والخسائر' : 'Trial balance & profit/loss sheets'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer KPI Statistics Bar */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-blue-200/80">
          <div className="flex items-center gap-6">
            <div>
              <span className="font-extrabold text-white text-base block">99.99%</span>
              <span className="text-[10px] text-blue-300/70">{isRTL ? 'جاهزية تشغيلية' : 'Uptime Guarantee'}</span>
            </div>
            <div className="h-6 w-px bg-white/15" />
            <div>
              <span className="font-extrabold text-white text-base block">+500K</span>
              <span className="text-[10px] text-blue-300/70">{isRTL ? 'معاملة مسجلة' : 'Ledger Entries'}</span>
            </div>
            <div className="h-6 w-px bg-white/15" />
            <div>
              <span className="font-extrabold text-white text-base block">SOC2 / ISO</span>
              <span className="text-[10px] text-blue-300/70">{isRTL ? 'أمان المؤسسات' : 'Certified Security'}</span>
            </div>
          </div>

          <span className="text-[11px] text-blue-300/60 font-medium">© {new Date().getFullYear()} Orminal ERP</span>
        </div>
      </div>

      {/* RIGHT / MAIN FORM COLUMN */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-8 lg:p-12 relative z-10 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
        {/* TOP CONTROLS (Language + Theme Switcher) */}
        <div className="w-full flex items-center justify-between mb-6 shrink-0">
          {/* Mobile Logo Branding (Visible only on mobile) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5">
              <img src="/logo.png" alt="أورمنال" className="size-6 object-contain" />
            </div>
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">أورمنال ERP</span>
          </div>

          <div className="flex items-center gap-2 ms-auto">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 gap-1.5 text-[14px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-white">
                  <Languages className="size-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{locale === 'ar' ? 'العربية' : 'English'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                <DropdownMenuItem onClick={() => setLocale('ar')} className="justify-between text-xs">
                  العربية {locale === 'ar' && <Check className="size-3.5 text-blue-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale('en')} className="justify-between text-xs">
                  English {locale === 'en' && <Check className="size-3.5 text-blue-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 dark:text-white" aria-label="تغيير المظهر">
                  {mounted && theme === 'dark' ? <Moon className="size-4 text-blue-400" /> : <Sun className="size-4 text-amber-500" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 dark:bg-slate-900 dark:border-slate-800 dark:text-white">
                <DropdownMenuItem onClick={() => setTheme('light')} className="justify-between text-xs">
                  <span className="flex items-center gap-2"><Sun className="size-3.5" /> {isRTL ? 'مضيء' : 'Light'}</span>
                  {mounted && theme === 'light' && <Check className="size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="justify-between text-xs">
                  <span className="flex items-center gap-2"><Moon className="size-3.5" /> {isRTL ? 'داكن' : 'Dark'}</span>
                  {mounted && theme === 'dark' && <Check className="size-3.5" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')} className="justify-between text-xs">
                  <span className="flex items-center gap-2"><Monitor className="size-3.5" /> {isRTL ? 'النظام' : 'System'}</span>
                  {mounted && theme === 'system' && <Check className="size-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* AUTH CARD CONTAINER */}
        <div className="w-full max-w-md mx-auto my-auto space-y-4">
          {/* SEGMENTED TAB SWITCHER (Login / Sign Up) */}
          <div className="bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl flex items-center border border-slate-300/60 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-3 px-4 text-sm sm:text-sm font-bold rounded-lg transition-all duration-200 ${mode === 'login'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              {isRTL ? 'تسجيل الدخول' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-3 px-4 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'signup'
                ? 'bg-white dark:bg-slate-800 text-blue-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
            >
              {isRTL ? 'إنشاء حساب جديد' : 'Create Account'}
            </button>
          </div>

          {/* MAIN FORM CARD */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-6 sm:p-8 space-y-6">
            {/* LOGIN MODE */}
            {mode === 'login' && (
              <div className="space-y-6">
                <div className="space-y-1 text-center">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {isRTL ? 'تسجيل الدخول إلى النظام' : 'Login to the System'}
                  </h2>

                </div>



                {/* LOGIN FORM */}
                <form onSubmit={handleLoginSubmit} className="space-y-6">
                  {/* Username / Email Field */}
                  <div className="space-y-1.5 mt-8">
                    <Label htmlFor="loginUsername" className="text-[14px] font-semibold text-slate-700 dark:text-slate-300 px-1 ">
                      {isRTL ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email Address'}
                    </Label>
                    <div className="relative pt-2">
                      <User className="absolute inset-y-0 start-3 my-auto size-5 text-slate-400 pointer-events-none " />
                      <Input
                        id="loginUsername"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        placeholder={isRTL ? 'أدخل اسم المستخدم (مثال: username)' : 'Enter username (e.g., username )'}
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        disabled={loginLoading}
                        required
                        className="ps-10 h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 text-sm "
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5 pt-2">

                    <Label htmlFor="loginPassword" className="text-[14px] font-semibold text-slate-700 dark:text-slate-300 px-1">
                      {isRTL ? 'كلمة المرور' : 'Password'}
                    </Label>



                    <div className="relative">
                      <Lock className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="loginPassword"
                        type={showLoginPass ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        disabled={loginLoading}
                        required
                        className="ps-9 pe-10 h-11 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass((v) => !v)}
                        className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        tabIndex={-1}
                      >
                        {showLoginPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember me Checkbox */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="rememberMe"
                        checked={rememberMe}
                        onCheckedChange={(c) => setRememberMe(!!c)}
                      />
                      <Label htmlFor="rememberMe" className="text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer">
                        {isRTL ? 'تذكر جلسة الدخول على هذا الجهاز ' : 'Remember me on this device'}
                      </Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForgotDialogOpen(true)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {isRTL ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </button>
                  </div>


                  {/* Error Alert */}
                  {loginError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all gap-2 mt-2"
                    disabled={loginLoading}
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {isRTL ? 'جاري تسجيل الدخول...' : 'Signing in...'}
                      </>
                    ) : (
                      <>
                        {isRTL ? 'تسجيل الدخول' : 'Sign In'}
                        {isRTL ? <ArrowLeft className="size-4 ms-1" /> : <ArrowRight className="size-4 ms-1" />}
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}

            {/* SIGN UP MODE */}
            {mode === 'signup' && (
              <div className="space-y-6">
                <div className="space-y-1 text-center">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {isRTL ? 'إنشاء حساب جديد' : 'Create New Account'}
                  </h2>

                </div>

                {/* SIGN UP FORM */}
                <form onSubmit={handleSignUpSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signUpName" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'الاسم الكامل' : 'Full Name'}
                    </Label>
                    <div className="relative">
                      <User className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="signUpName"
                        type="text"
                        placeholder={isRTL ? 'مثال: احمد سعيد على' : 'e.g., Ahmed Saeed Ali'}
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        disabled={signUpLoading}
                        required
                        className="ps-9 h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-sm"
                      />
                    </div>
                  </div>

                  {/* Username & Email Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signUpUsername" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'اسم المستخدم' : 'Username'}
                      </Label>
                      <div className="relative">
                        <User className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="signUpUsername"
                          type="text"
                          placeholder="username"
                          value={signUpUsername}
                          onChange={(e) => setSignUpUsername(e.target.value)}
                          disabled={signUpLoading}
                          required
                          className="ps-9 h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="signUpEmail" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="signUpEmail"
                          type="email"
                          placeholder="name@company.com"
                          value={signUpEmail}
                          onChange={(e) => setSignUpEmail(e.target.value)}
                          disabled={signUpLoading}
                          required
                          className="ps-9 h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signUpCompany" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {isRTL ? 'اسم الشركة / المؤسسة' : 'Company / Organization Name'}
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="signUpCompany"
                        type="text"
                        placeholder={isRTL ? 'شركة أورمنال للتجارة' : 'Orminal Trading Co.'}
                        value={signUpCompany}
                        onChange={(e) => setSignUpCompany(e.target.value)}
                        disabled={signUpLoading}
                        className="ps-9 h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-sm"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm Password */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signUpPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'كلمة المرور' : 'Password'}
                      </Label>
                      <div className="relative">
                        <Lock className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="signUpPassword"
                          type={showSignUpPass ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signUpPassword}
                          onChange={(e) => setSignUpPassword(e.target.value)}
                          disabled={signUpLoading}
                          required
                          className="ps-9 pe-10 h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpPass((v) => !v)}
                          className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                          tabIndex={-1}
                        >
                          {showSignUpPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* PASSWORD STRENGTH INDICATOR BAR */}
                    {signUpPassword && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>{isRTL ? 'قوة كلمة المرور:' : 'Password Strength:'}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{passwordStrength.label}</span>
                        </div>

                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passwordStrength.score >= 1 ? passwordStrength.color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passwordStrength.score >= 2 ? passwordStrength.color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passwordStrength.score >= 3 ? passwordStrength.color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passwordStrength.score >= 4 ? passwordStrength.color : 'bg-transparent'}`} />
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="signUpConfirmPassword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                      </Label>
                      <div className="relative">
                        <Lock className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="signUpConfirmPassword"
                          type={showSignUpConfirmPass ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signUpConfirmPassword}
                          onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                          disabled={signUpLoading}
                          required
                          className="ps-9 pe-10 h-10 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpConfirmPass((v) => !v)}
                          className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                          tabIndex={-1}
                        >
                          {showSignUpConfirmPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Terms & Privacy Checkbox */}
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox
                      id="agreeTerms"
                      checked={agreeTerms}
                      onCheckedChange={(c) => setAgreeTerms(!!c)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="agreeTerms" className="text-xs font-normal text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer">
                      {isRTL
                        ? 'أوافق على الشروط والأحكام وسياسة الخصوصية الخاصة بنظام أورمنال ERP'
                        : 'I agree to the Terms of Service and Privacy Policy of Orminal ERP'}
                    </Label>
                  </div>

                  {/* Error & Success Banners */}
                  {signUpError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{signUpError}</span>
                    </div>
                  )}

                  {signUpSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                      <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                      <span>{signUpSuccess}</span>
                    </div>
                  )}

                  {/* SUBMIT BUTTON */}
                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all gap-2 mt-2"
                    disabled={signUpLoading}
                  >
                    {signUpLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {isRTL ? 'جاري إنشاء الحساب...' : 'Creating Account...'}
                      </>
                    ) : (
                      <>
                        {isRTL ? 'إنشاء الحساب والبدء' : 'Create Account & Begin'}
                        {isRTL ? <ArrowLeft className="size-4 ms-1" /> : <ArrowRight className="size-4 ms-1" />}
                      </>
                    )}
                  </Button>
                </form>
              </div>
            )}
          </div>

          {/* SECURITY & TRUST FOOTER */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400 space-y-1.5 pt-2">

            <p>© {new Date().getFullYear()} Orminal ERP Systems — {isRTL ? 'جميع الحقوق محفوظة' : 'All Rights Reserved'}</p>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD DIALOG */}
      <Dialog open={forgotDialogOpen} onOpenChange={setForgotDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
          <DialogHeader className="bg-gradient-to-r rtl:bg-gradient-to-l from-blue-50 to-[#E6F0FF] dark:from-blue-700/80 dark:to-blue-800/90 border-b border-blue-100 dark:border-blue-700/40 p-6 shrink-0 relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-blue-950/60 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300 shadow-xs">
                <KeyRound className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-white">
                  {isRTL ? 'استعادة كلمة المرور' : 'Reset Password'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 dark:text-blue-100/90">
                  {isRTL ? 'أدخل بريدك الإلكتروني لإرسال تعليمات إعادة الضبط' : 'Enter your registered email to receive reset instructions'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="p-6 dark:bg-slate-950 space-y-4">
            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 space-y-2 text-center">
                <CheckCircle2 className="size-8 mx-auto text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-sm">{isRTL ? 'تم إرسال رابط الضبط!' : 'Reset Link Sent!'}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {isRTL
                    ? `تم إرسال تعليمات استعادة كلمة المرور إلى البريد: ${forgotEmail}`
                    : `Password reset instructions have been sent to: ${forgotEmail}`}
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgotEmail" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isRTL ? 'البريد الإلكتروني المسجل' : 'Registered Email Address'}
                  </Label>
                  <div className="relative">
                    <Mail className="absolute inset-y-0 start-3 my-auto size-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="forgotEmail"
                      type="email"
                      placeholder="admin@orminal.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      disabled={forgotLoading}
                      required
                      className="ps-9 h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-sm"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {isRTL ? 'جاري الإرسال...' : 'Sending...'}
                    </>
                  ) : (
                    <>
                      {isRTL ? 'إرسال رابط الاستعادة' : 'Send Reset Link'}
                    </>
                  )}
                </Button>
              </form>
            )}
          </DialogBody>

          <DialogFooter className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setForgotDialogOpen(false)
                setForgotSuccess(false)
              }}
              className="text-xs font-semibold dark:border-slate-800 dark:text-slate-300"
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
