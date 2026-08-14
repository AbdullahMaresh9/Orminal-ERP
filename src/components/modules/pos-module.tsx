'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useT } from '@/lib/i18n/use-t'
import { formatCurrency, formatNumber } from '@/lib/format'
import { printHTML } from '@/lib/export'
import { toast } from 'sonner'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, CreditCard,
  Banknote, Wallet, CheckCircle2, Receipt, Printer, Barcode, Tag, User,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface Product {
  id: string; name: string; nameAr?: string | null; sku: string; salePrice: number; costPrice: number
  taxRate?: number; taxCode?: { rate: number } | null; unit?: string; stock: number; categoryId?: string | null
  category?: { name: string; nameAr?: string | null } | null
  image?: string | null
}

interface CartItem {
  product: Product
  qty: number
}

export function PosModule() {
  const { t, isRTL } = useT()
  const L = (ar: string, en: string) => (isRTL ? ar : en)
  const productName = (p: Product) => {
    if (!p) return ''
    return isRTL ? (p.nameAr || p.name || '') : (p.name || p.nameAr || '')
  }
  const getTaxRate = (p: Product) => (typeof p.taxRate === 'number' ? p.taxRate : (p.taxCode?.rate ?? 15))

  const paymentMethods = useMemo(() => [
    { value: 'cash', label: L('نقد', 'Cash'), icon: <Banknote className="size-4" /> },
    { value: 'card', label: L('بطاقة', 'Card'), icon: <CreditCard className="size-4" /> },
    { value: 'transfer', label: L('تحويل', 'Transfer'), icon: <Wallet className="size-4" /> },
  ], [isRTL])

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<string>('cash')
  const [amountReceived, setAmountReceived] = useState<string>('')
  const [receipt, setReceipt] = useState<any | null>(null)
  const [clientId, setClientId] = useState<string>('')

  // Fetch partners (customers) from correct API endpoint /api/erp/partners?isCustomer=true
  const { data: clientsData } = useQuery<{ data: any[] }>({
    queryKey: ['pos-clients'],
    queryFn: async () => {
      const r = await fetch('/api/erp/partners?isCustomer=true&pageSize=200')
      if (!r.ok) return { data: [] }
      return r.json()
    },
  })

  const clients = clientsData?.data ?? []

  // Auto-select first customer or walk-in customer once loaded
  const [pickedClient, setPickedClient] = useState(false)
  if (clients.length > 0 && !pickedClient) {
    const walkIn = clients.find((c) => c.code === 'WALK-IN' || /walk|نقدي|نقد/i.test(c.nameAr || c.nameEn || ''))
    setClientId((walkIn ?? clients[0]).id)
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
      if (p?.categoryId && p?.category) {
        const catName = isRTL ? (p.category.nameAr || p.category.name) : (p.category.name || p.category.nameAr || '')
        if (catName) map.set(p.categoryId, catName)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [products, isRTL])

  const filtered = products.filter((p) => {
    if (!p) return false
    if (categoryFilter !== 'all' && p.categoryId !== categoryFilter) return false
    if (search) {
      const q = search.trim().toLowerCase()
      if (!q) return true
      const name = (p.name ?? '').toLowerCase()
      const nameAr = (p.nameAr ?? '').toLowerCase()
      const sku = (p.sku ?? '').toLowerCase()
      return name.includes(q) || nameAr.includes(q) || sku.includes(q)
    }
    return true
  })

  const subtotal = cart.reduce((s, it) => s + (it.product.salePrice ?? 0) * it.qty, 0)
  const taxTotal = cart.reduce((s, it) => s + (it.product.salePrice ?? 0) * it.qty * (getTaxRate(it.product) / 100), 0)
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
      if (cart.length === 0) throw new Error(L('السلة فارغة', 'Cart is empty'))
      if (!clientId) throw new Error(L('لا يوجد عميل متاح — الرجاء إضافة عميل أولاً', 'No customer available — Please add a customer first'))
      const payload = {
        partnerId: clientId,
        paymentMethod,
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.qty,
          unitPrice: i.product.salePrice ?? 0,
          taxRate: getTaxRate(i.product),
        })),
      }
      const r = await fetch('/api/erp/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        throw new Error(e.error?.message || e.error || L('فشلت عملية البيع', 'Checkout failed'))
      }
      const json = await r.json()
      return json.data ?? json
    },
    onSuccess: (data) => {
      toast.success(L('تمت عملية البيع بنجاح', 'Sale completed successfully'))
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
    onError: (e: any) => toast.error(e.message || L('فشلت عملية البيع', 'Sale failed')),
  })

  function handleCheckout() {
    if (cart.length === 0) return toast.error(L('السلة فارغة', 'Cart is empty'))
    if (paymentMethod === 'cash' && received < total) return toast.error(L('المبلغ المستلم أقل من الإجمالي', 'Amount received is less than total'))
    checkout.mutate()
  }

  function printReceipt(r: any) {
    const html = `
      <div class="doc-header">
        <div class="company">
          <img src="/logo.png" class="logo" style="width:56px;height:56px;object-fit:contain;border-radius:8px;" />
          <div class="info"><h2>${L('مؤسسة أورمنال', 'Orminal Est.')}</h2><p>${L('نقطة البيع', 'Point of Sale')}</p></div>
        </div>
        <div class="doc-meta">
          <div class="type">${L('إيصال', 'Receipt')}</div>
          <div class="code">${r.code}</div>
          <div class="date">${r.date.toLocaleString(isRTL ? 'ar-SA' : 'en-US')}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>${L('الصنف', 'Item')}</th><th>${L('الكمية', 'Qty')}</th><th>${L('السعر', 'Price')}</th><th>${L('الإجمالي', 'Total')}</th></tr></thead>
        <tbody>
          ${r.items.map((it: CartItem) => `<tr><td>${productName(it.product)}</td><td>${it.qty}</td><td>${formatCurrency(it.product.salePrice)}</td><td>${formatCurrency((it.product.salePrice ?? 0) * it.qty)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>${L('المجموع الفرعي', 'Subtotal')}</span><span>${formatCurrency(r.subtotal)}</span></div>
        <div class="row"><span>${L('الضريبة', 'Tax')}</span><span>${formatCurrency(r.taxTotal)}</span></div>
        <div class="row grand"><span>${L('الإجمالي', 'Total')}</span><span>${formatCurrency(r.total)}</span></div>
        <div class="row"><span>${L('المدفوع', 'Paid')}</span><span>${formatCurrency(r.received)}</span></div>
        <div class="row"><span>${L('الباقي', 'Change')}</span><span>${formatCurrency(r.change)}</span></div>
      </div>
    `
    printHTML(html, `${L('إيصال', 'Receipt')} ${r.code}`)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 max-w-[1600px] mx-auto w-full overflow-hidden">
      {/* LEFT — product grid */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 gap-3 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L('ابحث بالاسم أو SKU أو الباركود...', 'Search by name, SKU, or barcode...')}
              className="ps-9 h-10"
              autoFocus
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-10"><SelectValue placeholder={L('الفئة', 'Category')} /></SelectTrigger>
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              <SelectItem value="all">{L('كل الفئات', 'All Categories')}</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Barcode className="size-12 mx-auto mb-2 opacity-50" />
              <p>{L('لا توجد منتجات مطابقة', 'No matching products found')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-2">
              {filtered.map((p) => {
                const inCart = cart.find((i) => i.product.id === p.id)
                const out = p.stock <= 0
                const pName = productName(p)
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
                      {pName.charAt(0)}
                    </div>
                    <p className="text-xs font-semibold line-clamp-2 leading-tight">{pName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{p.sku}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-bold text-primary"><span className="num">{formatCurrency(p.salePrice)}</span></span>
                      <Badge variant="outline" className={cn('text-[9px]', p.stock > 0 ? 'text-blue-600' : 'text-rose-600')}>
                        {p.stock > 0 ? <><span className="num">{formatNumber(p.stock, 0)}</span> {p.unit ?? ''}</> : L('نفد', 'Out of stock')}
                      </Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — cart panel */}
      <Card className="lg:w-[380px] shrink-0 flex flex-col h-full lg:h-auto min-h-0 rounded-xl overflow-hidden bg-card">
        <div className="p-3 border-b space-y-2 shrink-0 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShoppingCart className="size-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm">{L('السلة', 'Cart')}</h3>
                <p className="text-[10px] text-muted-foreground">{cart.length} {L('منتج', cart.length === 1 ? 'item' : 'items')}</p>
              </div>
            </div>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearCart} className="text-rose-600 hover:text-rose-700 gap-1 text-xs h-7">
                <Trash2 className="size-3.5" /> {L('تفريغ', 'Clear')}
              </Button>
            )}
          </div>

          {/* Customer Selector */}
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="h-8 text-xs w-full bg-muted/30">
              <div className="flex items-center gap-1.5 truncate">
                <User className="size-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">
                  {clients.find((c) => c.id === clientId)?.nameAr || clients.find((c) => c.id === clientId)?.nameEn || L('اختر العميل...', 'Select Customer...')}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent dir={isRTL ? 'rtl' : 'ltr'}>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  {c.nameAr || c.nameEn} {c.code ? `(${c.code})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin bg-card">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <ShoppingCart className="size-12 opacity-30 mb-2" />
              <p className="text-sm">{L('السلة فارغة', 'Cart is empty')}</p>
              <p className="text-xs mt-1">{L('اضغط على المنتجات ل��ضافتها', 'Click products to add them')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((it) => {
                const itemPName = productName(it.product)
                return (
                  <div key={it.product.id} className="flex items-start gap-2 p-3">
                    <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {itemPName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold line-clamp-1">{itemPName}</p>
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
                )
              })}
            </div>
          )}
        </div>

        {/* Totals + checkout */}
        {cart.length > 0 && (
          <div className="border-t p-4 space-y-3 shrink-0 bg-card">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</span>
                <span className="font-medium"><span className="num">{formatCurrency(subtotal)}</span></span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{L('الضريبة (15%)', 'Tax (15%)')}</span>
                <span className="font-medium"><span className="num">{formatCurrency(taxTotal)}</span></span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t">
                <span className="font-bold">{L('الإجمالي', 'Total')}</span>
                <span className="text-xl font-bold text-primary"><span className="num">{formatCurrency(total)}</span></span>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{L('طريقة الدفع', 'Payment Method')}</p>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((m) => (
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
                  <p className="text-xs font-medium text-muted-foreground">{L('المبلغ المستلم', 'Amount Received')}</p>
                  {received >= total && (
                    <Badge variant="outline" className="text-[10px] text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40">
                      {L('الباقي', 'Change')}: <span className="num">{formatCurrency(change)}</span>
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
                      {i === 0 ? L('دقيق', 'Exact') : <span className="num">{formatNumber(amt, 0)}</span>}
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
              {checkout.isPending ? L('جاري المعالجة...', 'Processing...') : L('إتمام البيع', 'Complete Sale')}
            </Button>
          </div>
        )}
      </Card>

      {/* Receipt dialog */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="sm:max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader >
            <DialogTitle className="flex items-center gap-2 justify-center text-blue-600">
              <CheckCircle2 className="size-6" />
              {L('تمت العملية بنجاح', 'Transaction Completed Successfully')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            {receipt && (
              <div className="py-2 space-y-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{L('رقم الإيصال', 'Receipt No.')}</p>
                  <p className="font-mono font-bold text-lg">{receipt.code}</p>
                </div>
                <div className="rounded-lg border divide-y">
                  {receipt.items.map((it: CartItem) => (
                    <div key={it.product.id} className="flex items-center justify-between p-2 text-xs">
                      <span className="flex-1 line-clamp-1">{productName(it.product)} × <span className="num">{it.qty}</span></span>
                      <span className="font-medium"><span className="num">{formatCurrency(it.product.salePrice * it.qty)}</span></span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">{L('المجموع الفرعي', 'Subtotal')}</span><span><span className="num">{formatCurrency(receipt.subtotal)}</span></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{L('ال��ريبة', 'Tax')}</span><span><span className="num">{formatCurrency(receipt.taxTotal)}</span></span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>{L('الإجمالي', 'Total')}</span><span className="text-primary"><span className="num">{formatCurrency(receipt.total)}</span></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{L('المدفوع', 'Paid')}</span><span><span className="num">{formatCurrency(receipt.received)}</span></span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">{L('الباقي', 'Change')}</span><span><span className="num">{formatCurrency(receipt.change)}</span></span></div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)} className="gap-1.5">
              {t('action.close')}
            </Button>
            <Button onClick={() => printReceipt(receipt)} className="gap-1.5">
              <Printer className="size-4" /> {L('طباعة', 'Print')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
