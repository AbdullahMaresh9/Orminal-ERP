'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber } from '@/lib/format'
import { printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, CreditCard,
  Banknote, Wallet, CheckCircle2, Receipt, Printer, Barcode, Tag,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Product {
  id: string; name: string; nameAr?: string | null; sku: string; salePrice: number; costPrice: number
  taxRate: number; unit: string; stock: number; categoryId?: string | null
  category?: { name: string; nameAr?: string | null } | null
  image?: string | null
}

interface CartItem {
  product: Product
  qty: number
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'نقد', icon: <Banknote className="size-4" /> },
  { value: 'card', label: 'بطاقة', icon: <CreditCard className="size-4" /> },
  { value: 'transfer', label: 'تحويل', icon: <Wallet className="size-4" /> },
]

export function PosModule() {
  const { t, locale } = useT()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [amountReceived, setAmountReceived] = useState<string>('')
  const [receipt, setReceipt] = useState<any | null>(null)
  const [clientId, setClientId] = useState<string>('')

  // Fetch the first client as the default POS walk-in customer
  const { data: clientsData } = useQuery<{ data: any[] }>({
    queryKey: ['pos-clients'],
    queryFn: async () => {
      const r = await fetch('/api/erp/clients')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  // Pick the first client once available (prefer one named "WALK-IN" or similar)
  const [pickedClient, setPickedClient] = useState(false)
  if (clientsData?.data?.length && !pickedClient) {
    const walkIn = clientsData.data.find((c) => c.code === 'WALK-IN' || /walk/i.test(c.name))
    setClientId((walkIn ?? clientsData.data[0]).id)
    setPickedClient(true)
  }

  const { data: productsData, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ['pos-products'],
    queryFn: async () => {
      const r = await fetch('/api/erp/products?active=true')
      if (!r.ok) throw new Error()
      return r.json()
    },
  })

  const products = productsData?.data ?? []
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) {
      if (p.categoryId && p.category) {
        map.set(p.categoryId, p.category.nameAr ?? p.category.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const filtered = products.filter((p) => {
    if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || (p.nameAr ?? '').includes(search) || p.sku.toLowerCase().includes(q)
    }
    return true
  })

  const subtotal = cart.reduce((s, it) => s + it.product.salePrice * it.qty, 0)
  const taxTotal = cart.reduce((s, it) => s + it.product.salePrice * it.qty * (it.product.taxRate / 100), 0)
  const total = subtotal + taxTotal
  const received = Number(amountReceived) || 0
  const change = received - total

  function addToCart(p: Product) {
    setCart((prev) => {
      const ex = prev.find((i) => i.product.id === p.id)
      if (ex) {
        return prev.map((i) => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { product: p, qty: 1 }]
    })
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => prev
      .map((i) => i.product.id === id ? { ...i, qty: i.qty + delta } : i)
      .filter((i) => i.qty > 0))
  }

  function removeItem(id: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== id))
  }

  function clearCart() {
    setCart([])
    setAmountReceived('')
  }

  const checkout = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('السلة فارغة')
      if (!clientId) throw new Error('لا يوجد عميل متاح — الرجاء إضافة عميل أولاً')
      const payload = {
        isPos: true,
        clientId,
        status: 'confirmed',
        paymentMethod,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.qty,
          unitPrice: i.product.salePrice,
          taxRate: i.product.taxRate,
        })),
      }
      const r = await fetch('/api/erp/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error || 'checkout failed')
      }
      return r.json()
    },
    onSuccess: (data) => {
      toast.success('تمت عملية البيع بنجاح')
      setReceipt({
        code: data.code,
        items: cart,
        subtotal, taxTotal, total,
        received, change,
        paymentMethod,
        date: new Date(),
      })
      clearCart()
    },
    onError: (e: any) => toast.error(e.message || 'فشلت عملية البيع'),
  })

  function handleCheckout() {
    if (cart.length === 0) return toast.error('السلة فارغة')
    if (paymentMethod === 'cash' && received < total) return toast.error('المبلغ المستلم أقل من الإجمالي')
    checkout.mutate()
  }

  function printReceipt(r: any) {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>مؤسسة أورمنال</h2><p>نقطة البيع</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">إيصال</div>
          <div class="code">${r.code}</div>
          <div class="date">${r.date.toLocaleString('ar-SA')}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${r.items.map((it: CartItem) => `<tr><td>${it.product.nameAr ?? it.product.name}</td><td>${it.qty}</td><td>${formatCurrency(it.product.salePrice)}</td><td>${formatCurrency(it.product.salePrice * it.qty)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>المجموع الفرعي</span><span>${formatCurrency(r.subtotal)}</span></div>
        <div class="row"><span>الضريبة</span><span>${formatCurrency(r.taxTotal)}</span></div>
        <div class="row grand"><span>الإجمالي</span><span>${formatCurrency(r.total)}</span></div>
        <div class="row"><span>المدفوع</span><span>${formatCurrency(r.received)}</span></div>
        <div class="row"><span>الباقي</span><span>${formatCurrency(r.change)}</span></div>
      </div>
    `
    printHTML(html, `إيصال ${r.code}`)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-3.5rem)] p-4 max-w-[1600px] mx-auto">
      {/* LEFT — product grid */}
      <div className="flex-1 flex flex-col min-w-0 gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو SKU أو الباركود..."
              className="ps-9 h-10"
              autoFocus
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-10"><SelectValue placeholder="الفئة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 scrollbar-thin">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Barcode className="size-12 mx-auto mb-2 opacity-50" />
              <p>لا توجد منتجات مطابقة</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-2">
              {filtered.map((p) => {
                const inCart = cart.find((i) => i.product.id === p.id)
                const out = p.stock <= 0
                return (
                  <button
                    key={p.id}
                    onClick={() => !out && addToCart(p)}
                    disabled={out}
                    className={cn(
                      'group text-start rounded-xl border bg-card p-3 hover:shadow-md hover:border-primary/40 transition-all relative overflow-hidden',
                      out && 'opacity-50 cursor-not-allowed',
                      inCart && 'ring-2 ring-primary'
                    )}
                  >
                    {inCart && (
                      <span className="absolute top-2 end-2 size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center z-10">
                        {inCart.qty}
                      </span>
                    )}
                    <div className="aspect-square rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-2 text-2xl font-bold text-primary/40">
                      {(p.nameAr ?? p.name).charAt(0)}
                    </div>
                    <p className="text-xs font-semibold line-clamp-2 leading-tight">{p.nameAr ?? p.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-primary"><span className="num">{formatCurrency(p.salePrice)}</span></span>
                      <Badge variant="outline" className={cn('text-[9px]', p.stock > 0 ? 'text-emerald-600' : 'text-rose-600')}>
                        {p.stock > 0 ? <><span className="num">{formatNumber(p.stock, 0)}</span> {p.unit}</> : 'نفد'}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT — cart panel */}
      <Card className="lg:w-[380px] shrink-0 flex flex-col h-full rounded-xl">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart className="size-5" />
            </div>
            <div>
              <h3 className="font-bold">السلة</h3>
              <p className="text-[10px] text-muted-foreground">{cart.length} منتج</p>
            </div>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearCart} className="text-rose-600 hover:text-rose-700 gap-1 text-xs h-8">
              <Trash2 className="size-3.5" /> تفريغ
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <ShoppingCart className="size-12 opacity-30 mb-2" />
              <p className="text-sm">السلة فارغة</p>
              <p className="text-xs mt-1">اضغط على المنتجات لإضافتها</p>
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((it) => (
                <div key={it.product.id} className="flex items-start gap-2 p-3">
                  <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {(it.product.nameAr ?? it.product.name).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold line-clamp-1">{it.product.nameAr ?? it.product.name}</p>
                    <p className="text-[10px] text-muted-foreground"><span className="num">{formatCurrency(it.product.salePrice)}</span> × <span className="num">{it.qty}</span></p>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="size-6" onClick={() => updateQty(it.product.id, -1)}>
                          <Minus className="size-3" />
                        </Button>
                        <span className="text-xs font-bold w-6 text-center"><span className="num">{it.qty}</span></span>
                        <Button variant="outline" size="icon" className="size-6" onClick={() => updateQty(it.product.id, 1)}>
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold"><span className="num">{formatCurrency(it.product.salePrice * it.qty)}</span></span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 text-rose-600 shrink-0" onClick={() => removeItem(it.product.id)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Totals + checkout */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-3 shrink-0">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="font-medium"><span className="num">{formatCurrency(subtotal)}</span></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الضريبة (15%)</span>
                <span className="font-medium"><span className="num">{formatCurrency(taxTotal)}</span></span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t">
                <span className="font-bold">الإجمالي</span>
                <span className="text-xl font-bold text-primary"><span className="num">{formatCurrency(total)}</span></span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">طريقة الدفع</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors',
                      paymentMethod === m.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
                    )}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">المبلغ المستلم</p>
                  {received >= total && (
                    <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40">
                      الباقي: <span className="num">{formatCurrency(change)}</span>
                    </Badge>
                  )}
                </div>
                <Input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="0.00"
                  className="text-lg font-bold tabular-nums h-10"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500].map((amt, i) => (
                    <Button key={i} variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setAmountReceived(String(Math.round(amt)))}>
                      {i === 0 ? 'دقيق' : <span className="num">{formatNumber(amt, 0)}</span>}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full h-14 text-base gap-2 shadow-md hover:shadow-lg transition-shadow"
              onClick={handleCheckout}
              disabled={checkout.isPending || (paymentMethod === 'cash' && received < total)}
            >
              {checkout.isPending ? (
                <Receipt className="size-5 animate-pulse" />
              ) : (
                <CheckCircle2 className="size-5" />
              )}
              {checkout.isPending ? 'جاري المعالجة...' : 'إتمام البيع'}
            </Button>
          </div>
        )}
      </Card>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 justify-center text-emerald-600">
              <CheckCircle2 className="size-6" />
              تمت العملية بنجاح
            </DialogTitle>
          </DialogHeader>
          <DialogBody>          <DialogBody>          {receipt && (
            <div className="py-2 space-y-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">رقم الإيصال</p>
                <p className="font-mono font-bold text-lg">{receipt.code}</p>
              </div>
              <div className="rounded-lg border divide-y">
                {receipt.items.map((it: CartItem) => (
                  <div key={it.product.id} className="flex items-center justify-between p-2 text-xs">
                    <span className="flex-1 line-clamp-1">{it.product.nameAr ?? it.product.name} × <span className="num">{it.qty}</span></span>
                    <span className="font-medium"><span className="num">{formatCurrency(it.product.salePrice * it.qty)}</span></span>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">المجموع الفرعي</span><span><span className="num">{formatCurrency(receipt.subtotal)}</span></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الضريبة</span><span><span className="num">{formatCurrency(receipt.taxTotal)}</span></span></div>
                <div className="flex justify-between font-bold text-base pt-1 border-t"><span>الإجمالي</span><span className="text-primary"><span className="num">{formatCurrency(receipt.total)}</span></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">المدفوع</span><span><span className="num">{formatCurrency(receipt.received)}</span></span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الباقي</span><span><span className="num">{formatCurrency(receipt.change)}</span></span></div>
              </div>
            </div>
          )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)} className="gap-1.5">
              {t('action.close')}
            </Button>
            <Button onClick={() => printReceipt(receipt)} className="gap-1.5">
              <Printer className="size-4" /> طباعة الإيصال
            </Button>
          </DialogFooter>
        </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}
