'use client'

import { useState } from 'react'
import { ModuleShell } from '@/components/erp/module-shell'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatDate } from '@/lib/format'
import { exportToCSV, printHTML } from '@/lib/export'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Building2, Plus, Search, Filter, Printer, Download, Calculator, ArrowLeftRight,
  Trash2, FolderTree, Scale, CheckCircle2, AlertCircle, RefreshCcw, Layers, ShieldCheck,
} from 'lucide-react'

export interface AssetRecord {
  id: string
  code: string
  nameAr: string
  nameEn: string
  categoryId: string
  categoryName: string
  purchaseDate: string
  purchaseCost: number
  salvageValue: number
  usefulLifeYears: number
  depreciationMethod: 'straight_line' | 'declining_balance'
  accumulatedDepreciation: number
  netBookValue: number
  status: 'active' | 'fully_depreciated' | 'transferred' | 'disposed'
  location: string
  custodian: string
}

export interface AssetCategoryRecord {
  id: string
  code: string
  nameAr: string
  nameEn: string
  defaultUsefulLife: number
  depreciationRate: number
  accountAsset: string
  accountDepreciation: string
  accountExpense: string
  assetCount: number
}

export interface AssetTransferRecord {
  id: string
  code: string
  assetId: string
  assetName: string
  transferDate: string
  fromBranch: string
  toBranch: string
  fromCustodian: string
  toCustodian: string
  reason: string
  status: 'completed' | 'pending'
}

export interface AssetDisposalRecord {
  id: string
  code: string
  assetId: string
  assetName: string
  disposalDate: string
  disposalType: 'sale' | 'scrap' | 'write_off'
  saleAmount: number
  bookValueAtDisposal: number
  gainOrLoss: number
  status: 'posted' | 'draft'
}

const INITIAL_ASSETS: AssetRecord[] = [
  {
    id: 'ast-1',
    code: 'AST-2026-0001',
    nameAr: 'سيارة نقل بضائع فورد',
    nameEn: 'Ford Cargo Delivery Truck',
    categoryId: 'cat-1',
    categoryName: 'وسائط نقل وسيارات',
    purchaseDate: '2024-01-15',
    purchaseCost: 120000,
    salvageValue: 10000,
    usefulLifeYears: 5,
    depreciationMethod: 'straight_line',
    accumulatedDepreciation: 44000,
    netBookValue: 76000,
    status: 'active',
    location: 'المستودع الرئيسي - الرياض',
    custodian: 'أحمد محمود',
  },
  {
    id: 'ast-2',
    code: 'AST-2026-0002',
    nameAr: 'خادم بيانات Dell PowerEdge',
    nameEn: 'Dell PowerEdge Data Server',
    categoryId: 'cat-2',
    categoryName: 'أجهزة ومعدات تقنية',
    purchaseDate: '2024-06-01',
    purchaseCost: 45000,
    salvageValue: 3000,
    usefulLifeYears: 3,
    depreciationMethod: 'straight_line',
    accumulatedDepreciation: 28000,
    netBookValue: 17000,
    status: 'active',
    location: 'مركز البيانات - الفرع الرئيسي',
    custodian: 'م. خالد العتيبي',
  },
  {
    id: 'ast-3',
    code: 'AST-2026-0003',
    nameAr: 'طقم أثاث مكاتب الإدارة العليا',
    nameEn: 'Executive Office Furniture Set',
    categoryId: 'cat-3',
    categoryName: 'أثاث ومفروشات',
    purchaseDate: '2023-03-10',
    purchaseCost: 35000,
    salvageValue: 2000,
    usefulLifeYears: 7,
    depreciationMethod: 'straight_line',
    accumulatedDepreciation: 14142,
    netBookValue: 20858,
    status: 'active',
    location: 'الإدارة العامة',
    custodian: 'سارة السليمان',
  },
  {
    id: 'ast-4',
    code: 'AST-2026-0004',
    nameAr: 'ماكينة تغليف وتعبئة آلية',
    nameEn: 'Automated Packing Machine',
    categoryId: 'cat-4',
    categoryName: 'آلات ومعدات تشغيلية',
    purchaseDate: '2022-11-20',
    purchaseCost: 180000,
    salvageValue: 15000,
    usefulLifeYears: 8,
    depreciationMethod: 'straight_line',
    accumulatedDepreciation: 68750,
    netBookValue: 111250,
    status: 'active',
    location: 'مصنع الإنتاج - جدة',
    custodian: 'المهندس الفني',
  },
]

const INITIAL_CATEGORIES: AssetCategoryRecord[] = [
  {
    id: 'cat-1',
    code: 'CAT-VEH',
    nameAr: 'وسائط نقل وسيارات',
    nameEn: 'Vehicles & Transport',
    defaultUsefulLife: 5,
    depreciationRate: 20,
    accountAsset: '1210 - السيارات والمعدات',
    accountDepreciation: '1219 - مجمع إهلاك السيارات',
    accountExpense: '5210 - مصروف إهلاك السيارات',
    assetCount: 8,
  },
  {
    id: 'cat-2',
    code: 'CAT-IT',
    nameAr: 'أجهزة ومعدات تقنية',
    nameEn: 'IT & Hardware Equipment',
    defaultUsefulLife: 3,
    depreciationRate: 33.33,
    accountAsset: '1220 - أجهزة الكمبيوتر والشبكات',
    accountDepreciation: '1229 - مجمع إهلاك الحاسبات',
    accountExpense: '5220 - مصروف إهلاك الحاسبات',
    assetCount: 14,
  },
  {
    id: 'cat-3',
    code: 'CAT-FUR',
    nameAr: 'أثاث ومفروشات',
    nameEn: 'Furniture & Fixtures',
    defaultUsefulLife: 7,
    depreciationRate: 14.28,
    accountAsset: '1230 - الأثاث والمكاتب',
    accountDepreciation: '1239 - مجمع إهلاك الأثاث',
    accountExpense: '5230 - مصروف إهلاك الأثاث',
    assetCount: 12,
  },
  {
    id: 'cat-4',
    code: 'CAT-MAC',
    nameAr: 'آلات ومعدات تشغيلية',
    nameEn: 'Machinery & Equipment',
    defaultUsefulLife: 8,
    depreciationRate: 12.5,
    accountAsset: '1240 - الآلات والمعدات',
    accountDepreciation: '1249 - مجمع إهلاك الآلات',
    accountExpense: '5240 - مصروف إهلاك الآلات',
    assetCount: 6,
  },
]

const INITIAL_TRANSFERS: AssetTransferRecord[] = [
  {
    id: 'tr-1',
    code: 'TRF-2026-001',
    assetId: 'ast-1',
    assetName: 'سيارة نقل بضائع فورد',
    transferDate: '2026-01-10',
    fromBranch: 'الفرع الرئيسي',
    toBranch: 'فرع جدة',
    fromCustodian: 'أحمد محمود',
    toCustodian: 'محمد العمري',
    reason: 'دعم العمليات اللوجستية في المنظمة الغربية',
    status: 'completed',
  },
]

const INITIAL_DISPOSALS: AssetDisposalRecord[] = [
  {
    id: 'disp-1',
    code: 'DSP-2026-001',
    assetId: 'ast-old',
    assetName: 'طابعة ليزر قديمة HP HP400',
    disposalDate: '2026-02-01',
    disposalType: 'sale',
    saleAmount: 800,
    bookValueAtDisposal: 500,
    gainOrLoss: 300,
    status: 'posted',
  },
]

interface FixedAssetsModuleProps {
  initialTab?: 'fixed-assets' | 'asset-categories' | 'asset-depreciation' | 'asset-transfers' | 'asset-disposals'
}

export default function FixedAssetsModule({ initialTab = 'fixed-assets' }: FixedAssetsModuleProps) {
  const { t, isRTL } = useT()
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [assets, setAssets] = useState<AssetRecord[]>(INITIAL_ASSETS)
  const [categories, setCategories] = useState<AssetCategoryRecord[]>(INITIAL_CATEGORIES)
  const [transfers, setTransfers] = useState<AssetTransferRecord[]>(INITIAL_TRANSFERS)
  const [disposals, setDisposals] = useState<AssetDisposalRecord[]>(INITIAL_DISPOSALS)
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false)
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [isDepreciationModalOpen, setIsDepreciationModalOpen] = useState(false)

  // Form states
  const [newAsset, setNewAsset] = useState<Partial<AssetRecord>>({
    nameAr: '',
    nameEn: '',
    categoryName: INITIAL_CATEGORIES[0].nameAr,
    purchaseDate: new Date().toISOString().split('T')[0],
    purchaseCost: 0,
    salvageValue: 0,
    usefulLifeYears: 5,
    location: '',
    custodian: '',
  })

  // KPI Computations
  const totalPurchaseCost = assets.reduce((sum, a) => sum + a.purchaseCost, 0)
  const totalAccumulatedDepreciation = assets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0)
  const totalNetBookValue = assets.reduce((sum, a) => sum + a.netBookValue, 0)
  const activeAssetsCount = assets.filter((a) => a.status === 'active').length

  const filteredAssets = assets.filter(
    (a) =>
      a.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.categoryName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreateAsset = () => {
    if (!newAsset.nameAr || !newAsset.purchaseCost) {
      toast.error('يرجى ملء جميع الحقول الإلزامية')
      return
    }

    const created: AssetRecord = {
      id: `ast-${Date.now()}`,
      code: `AST-2026-${String(assets.length + 1).padStart(4, '0')}`,
      nameAr: newAsset.nameAr || '',
      nameEn: newAsset.nameEn || '',
      categoryId: 'cat-1',
      categoryName: newAsset.categoryName || 'عام',
      purchaseDate: newAsset.purchaseDate || new Date().toISOString().split('T')[0],
      purchaseCost: Number(newAsset.purchaseCost) || 0,
      salvageValue: Number(newAsset.salvageValue) || 0,
      usefulLifeYears: Number(newAsset.usefulLifeYears) || 5,
      depreciationMethod: 'straight_line',
      accumulatedDepreciation: 0,
      netBookValue: Number(newAsset.purchaseCost) || 0,
      status: 'active',
      location: newAsset.location || 'المركز الرئيسي',
      custodian: newAsset.custodian || 'غير محدد',
    }

    setAssets([created, ...assets])
    setIsAddAssetOpen(false)
    toast.success('تمت إضافة الأصل الثابت بنجاح')
    setNewAsset({
      nameAr: '',
      nameEn: '',
      categoryName: INITIAL_CATEGORIES[0].nameAr,
      purchaseDate: new Date().toISOString().split('T')[0],
      purchaseCost: 0,
      salvageValue: 0,
      usefulLifeYears: 5,
      location: '',
      custodian: '',
    })
  }

  const handleRunDepreciation = () => {
    // Run straight line monthly depreciation logic
    const updated = assets.map((a) => {
      const depreciableAmount = a.purchaseCost - a.salvageValue
      const monthlyDep = depreciableAmount / (a.usefulLifeYears * 12)
      const newAcc = Math.min(a.purchaseCost, a.accumulatedDepreciation + monthlyDep)
      const newNet = Math.max(0, a.purchaseCost - newAcc)
      return {
        ...a,
        accumulatedDepreciation: Math.round(newAcc),
        netBookValue: Math.round(newNet),
        status: newNet === 0 ? ('fully_depreciated' as const) : a.status,
      }
    })
    setAssets(updated)
    setIsDepreciationModalOpen(false)
    toast.success('تم الاحتساب والترحيل المحاسبي لإهلاك الفترة بنجاح')
  }

  const handleExportCSV = () => {
    const csvData = assets.map((a) => ({
      'رمز الأصل': a.code,
      'اسم الأصل': a.nameAr,
      'التصنيف': a.categoryName,
      'تاريخ الشراء': a.purchaseDate,
      'تكلفة الشراء': a.purchaseCost,
      'مجمع الإهلاك': a.accumulatedDepreciation,
      'صافي القيمة الدفترية': a.netBookValue,
      'الحالة': a.status === 'active' ? 'نشط' : 'مكتمل الإهلاك',
      'الموقع': a.location,
      'العهدة': a.custodian,
    }))
    exportToCSV('الأصول_الثابتة_Orminal_ERP', csvData)
    toast.success('تم تصدير سجل الأصول الثابتة')
  }

  return (
    <ModuleShell
      title="الأصول الثابتة والتهيئة المالية"
      description="إدارة شجرة الأصول الثابتة، تصنيفات الإهلاك، وحساب القيود المحاسبية التلقائية"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsDepreciationModalOpen(true)}
            variant="outline"
            className="gap-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Calculator className="size-4" />
            <span>احتساب إهلاك الفترة</span>
          </Button>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="size-4" />
            <span>تصدير Excel</span>
          </Button>
          <Button onClick={() => setIsAddAssetOpen(true)} className="gap-2 bg-primary text-primary-foreground">
            <Plus className="size-4" />
            <span>إضافة أصل جديد</span>
          </Button>
        </div>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 flex items-center justify-between border border-border shadow-sm bg-card">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">إجمالي تكلفة الأصول</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalPurchaseCost, 'SAR')}</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Building2 className="size-6" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-border shadow-sm bg-card">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">مجمع الإهلاك التراكمي</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalAccumulatedDepreciation, 'SAR')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Scale className="size-6" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-border shadow-sm bg-card">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">صافي القيمة الدفترية</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalNetBookValue, 'SAR')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-6" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border border-border shadow-sm bg-card">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">الأصول النشطة</p>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{activeAssetsCount} أصل</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Layers className="size-6" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-xl flex flex-wrap gap-1 border border-border/50">
          <TabsTrigger value="fixed-assets" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <Building2 className="size-4" />
            <span>الأصول الثابتة</span>
          </TabsTrigger>
          <TabsTrigger value="asset-categories" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <FolderTree className="size-4" />
            <span>تصنيفات الأصول</span>
          </TabsTrigger>
          <TabsTrigger value="asset-depreciation" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <Calculator className="size-4" />
            <span>إهلاك الأصول</span>
          </TabsTrigger>
          <TabsTrigger value="asset-transfers" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <ArrowLeftRight className="size-4" />
            <span>نقل الأصول</span>
          </TabsTrigger>
          <TabsTrigger value="asset-disposals" className="gap-2 rounded-lg data-[state=active]:bg-background">
            <Trash2 className="size-4" />
            <span>استبعاد الأصول</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Fixed Assets Table */}
        <TabsContent value="fixed-assets" className="space-y-4">
          <Card className="p-4 border border-border bg-card">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث باسم الأصل، الرمز، أو التصنيف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right">رمز الأصل</TableHead>
                    <TableHead className="text-right">اسم الأصل</TableHead>
                    <TableHead className="text-right">التصنيف</TableHead>
                    <TableHead className="text-right">تاريخ الشراء</TableHead>
                    <TableHead className="text-right">تكلفة الشراء</TableHead>
                    <TableHead className="text-right">مجمع الإهلاك</TableHead>
                    <TableHead className="text-right">صافي القيمة الدفترية</TableHead>
                    <TableHead className="text-right">الموقع والعهدة</TableHead>
                    <TableHead className="text-center">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        لا توجد أصول متطابقة مع شروط البحث
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssets.map((asset) => (
                      <TableRow key={asset.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono font-medium text-xs text-primary">{asset.code}</TableCell>
                        <TableCell className="font-semibold text-foreground">{asset.nameAr}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                            {asset.categoryName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(asset.purchaseDate)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(asset.purchaseCost, 'SAR')}</TableCell>
                        <TableCell className="text-amber-600 dark:text-amber-400 font-medium">
                          {formatCurrency(asset.accumulatedDepreciation, 'SAR')}
                        </TableCell>
                        <TableCell className="text-emerald-600 dark:text-emerald-400 font-bold">
                          {formatCurrency(asset.netBookValue, 'SAR')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>{asset.location}</div>
                          <div className="text-[11px] text-muted-foreground/70">عهدة: {asset.custodian}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              asset.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                                : 'bg-slate-500/10 text-slate-600 border-slate-200'
                            }
                          >
                            {asset.status === 'active' ? 'نشط' : 'مكتمل الإهلاك'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Asset Categories */}
        <TabsContent value="asset-categories" className="space-y-4">
          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">تصنيفات ومجموعات الأصول الثابتة</h3>
              <Button onClick={() => setIsAddCategoryOpen(true)} size="sm" variant="outline" className="gap-2">
                <Plus className="size-4" />
                <span>إضافة تصنيف</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat) => (
                <Card key={cat.id} className="p-4 border border-border/80 bg-background/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderTree className="size-5 text-primary" />
                      <span className="font-bold text-foreground">{cat.nameAr}</span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {cat.code}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-b border-border/40 py-2">
                    <div>العمر الافتراضي: <span className="font-bold text-foreground">{cat.defaultUsefulLife} سنوات</span></div>
                    <div>نسبة الإهلاك السنوي: <span className="font-bold text-foreground">{cat.depreciationRate}%</span></div>
                    <div>عدد الأصول: <span className="font-bold text-foreground">{cat.assetCount} أصل</span></div>
                  </div>
                  <div className="space-y-1 text-[11px] font-mono text-muted-foreground/80">
                    <div>حـ/ الأصل: {cat.accountAsset}</div>
                    <div>حـ/ مجمع الإهلاك: {cat.accountDepreciation}</div>
                    <div>حـ/ مصروف الإهلاك: {cat.accountExpense}</div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Asset Depreciation */}
        <TabsContent value="asset-depreciation" className="space-y-4">
          <Card className="p-6 border border-border bg-card text-center space-y-4">
            <div className="size-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Calculator className="size-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-lg font-bold">احتساب وجدولة إهلاك الأصول المحاسبي</h3>
              <p className="text-sm text-muted-foreground">
                يقوم النظام بحساب الإهلاك الشهري التلقائي لجميع الأصول النشطة وتوليد قيد اليومية المناسب في المحرك المحاسبي.
              </p>
            </div>
            <Button onClick={() => setIsDepreciationModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <CheckCircle2 className="size-4" />
              <span>بدء احتساب إهلاك الشهر الحالي</span>
            </Button>
          </Card>
        </TabsContent>

        {/* Tab 4: Asset Transfers */}
        <TabsContent value="asset-transfers" className="space-y-4">
          <Card className="p-4 border border-border bg-card">
            <h3 className="text-base font-bold mb-4">سجل نقل العهد والأصول بين الفروع والمواقع</h3>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">رقم الحركة</TableHead>
                  <TableHead className="text-right">اسم الأصل</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">من موقع / عهدة</TableHead>
                  <TableHead className="text-right">إلى موقع / عهدة</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-mono text-xs text-primary">{tr.code}</TableCell>
                    <TableCell className="font-semibold">{tr.assetName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tr.transferDate}</TableCell>
                    <TableCell className="text-xs">{tr.fromBranch} - {tr.fromCustodian}</TableCell>
                    <TableCell className="text-xs font-semibold">{tr.toBranch} - {tr.toCustodian}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">مكتمل</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 5: Asset Disposals */}
        <TabsContent value="asset-disposals" className="space-y-4">
          <Card className="p-4 border border-border bg-card">
            <h3 className="text-base font-bold mb-4">سجل استبعاد وبيع الأصول الثابتة</h3>
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">رقم العملية</TableHead>
                  <TableHead className="text-right">اسم الأصل</TableHead>
                  <TableHead className="text-right">تاريخ الاستبعاد</TableHead>
                  <TableHead className="text-right">نوع الاستبعاد</TableHead>
                  <TableHead className="text-right">قيمة البيع</TableHead>
                  <TableHead className="text-right">القيمة الدفترية</TableHead>
                  <TableHead className="text-right">أرباح / خسائر البيع</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disposals.map((disp) => (
                  <TableRow key={disp.id}>
                    <TableCell className="font-mono text-xs text-primary">{disp.code}</TableCell>
                    <TableCell className="font-semibold">{disp.assetName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{disp.disposalDate}</TableCell>
                    <TableCell className="text-xs">بيع نقد</TableCell>
                    <TableCell>{formatCurrency(disp.saleAmount, 'SAR')}</TableCell>
                    <TableCell>{formatCurrency(disp.bookValueAtDisposal, 'SAR')}</TableCell>
                    <TableCell className="text-emerald-600 font-bold">
                      +{formatCurrency(disp.gainOrLoss, 'SAR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Add New Asset */}
      <Dialog open={isAddAssetOpen} onOpenChange={setIsAddAssetOpen}>
        <DialogContent className="max-w-md dark:bg-slate-900 border-slate-800" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-right text-base font-bold">إضافة أصل ثابت جديد</DialogTitle>
            <DialogDescription className="text-right text-xs">
              أدخل بيانات الأصل والمبلغ الإجمالي والعمر الافتراضي
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-right">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">اسم الأصل (بالعربي)</Label>
              <Input
                placeholder="مثال: سيارة نقل تويوتا"
                value={newAsset.nameAr || ''}
                onChange={(e) => setNewAsset({ ...newAsset, nameAr: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تكلفة الشراء (SAR)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newAsset.purchaseCost || ''}
                  onChange={(e) => setNewAsset({ ...newAsset, purchaseCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">قيمة الخردة / النفاية</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={newAsset.salvageValue || ''}
                  onChange={(e) => setNewAsset({ ...newAsset, salvageValue: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">العمر الافتراضي (سنوات)</Label>
                <Input
                  type="number"
                  value={newAsset.usefulLifeYears || 5}
                  onChange={(e) => setNewAsset({ ...newAsset, usefulLifeYears: parseInt(e.target.value) || 5 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تاريخ الشراء</Label>
                <Input
                  type="date"
                  value={newAsset.purchaseDate || ''}
                  onChange={(e) => setNewAsset({ ...newAsset, purchaseDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">الموقع والمبنى</Label>
              <Input
                placeholder="مثال: المستودع الرئيسي"
                value={newAsset.location || ''}
                onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">الموظف المسئول (العهدة)</Label>
              <Input
                placeholder="اسم الموظف المستلم"
                value={newAsset.custodian || ''}
                onChange={(e) => setNewAsset({ ...newAsset, custodian: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleCreateAsset} className="bg-primary text-primary-foreground">
              حفظ الأصل
            </Button>
            <Button variant="ghost" onClick={() => setIsAddAssetOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Depreciation Confirmation */}
      <Dialog open={isDepreciationModalOpen} onOpenChange={setIsDepreciationModalOpen}>
        <DialogContent className="max-w-sm dark:bg-slate-900 border-slate-800" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="text-right text-base font-bold">تأكيد احتساب الإهلاك الشهرية</DialogTitle>
            <DialogDescription className="text-right text-xs">
              سيتم حساب إهلاك الشهر الحالي وإنشاء قيد محاسبي آلي بقيمة الإهلاك في دفاتر النظام.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-sm text-right space-y-2">
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">عدد الأصول النشطة:</span>
              <span className="font-bold">{activeAssetsCount} أصل</span>
            </div>
            <div className="flex justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">التاريخ المستهدف:</span>
              <span className="font-mono font-semibold">{new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleRunDepreciation} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              تأكيد والترحيل لدفتر اليومية
            </Button>
            <Button variant="ghost" onClick={() => setIsDepreciationModalOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleShell>
  )
}
