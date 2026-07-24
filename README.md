# 🏢 أورمنال ERP — نظام إدارة موارد المؤسسات المتكامل
### **Orminal Enterprise Resource Planning System**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.0-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-blue?style=for-the-badge)](#)

---

## 📌 عن النظام (System Overview)

**نظام أورمنال (Orminal ERP)** هو نظام متكامل ومتقدم لإدارة كافة العمليات التشغيلية، المالية، والمخزنية للمؤسسات والشركات ذات الفروع المتعددة. تم تصميمه وتطويره بالاعتماد على أحدث المعايير البرمجية والهندسية العالمية (Enterprise ERP Standards) ليتوافق مع أنظمة الشركات الكبرى مثل **SAP Fiori**, **Microsoft Dynamics 365**, و **Odoo Enterprise**.

يتميز النظام بدعمه الكامل للغة العربية والإنجليزية (RTL/LTR)، والواجهات المظلمة والمضيئة (Dark/Light Modes)، مع هيكلية محاسبية مزدوجة (Double-Entry Bookkeeping System) وربط تلقائي لكافة العمليات بالدليل المحاسبي الشجري وتوافق كامل مع متطلبات الفوترة الإلكترونية (ZATCA Phase 2).

---

## 🚀 الموديولات والأنظمة الفرعية (ERP Modules)

```
                       ┌─────────────────────────────────────────┐
                       │           Orminal ERP Core              │
                       └────────────────────┬────────────────────┘
                                            │
         ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
         │                  │               │               │                  │
┌────────┴────────┐ ┌───────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐ ┌────────┴────────┐
│  البيانات الأساسية │ │   المبيعات    │ │  المشتريات    │ │   المخزون    │ │ الموارد البشرية  │
│   Master Data   │ │     Sales    │ │ Procurement │ │  Inventory  │ │  HR & Payroll   │
└─────────────────┘ └──────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘
         │                  │               │               │                  │
         └──────────────────┴───────────────┼───────────────┴──────────────────┘
                                            │
                       ┌────────────────────┴────────────────────┐
                       │          محرك المحاسبة والمالية         │
                       │     Financial Accounting Engine         │
                       └─────────────────────────────────────────┘
```

### 1. 🏢 البيانات الأساسية والهيكل التنظيمي (Master Data)
- **إدارة الفروع (Branches Management)**: إنشاء وتخصيص الفروع وتتبع أرقامها الضريبية وإعداداتها المستقلة.
- **إدارة المستودعات الموحدة (Unified Warehouses)**: دمج وتوحيد إدارة المخازن والمستودعات تحت شاشة موحدة مرتبطة بالفروع.
- **دليل المنتجات والتصنيفات (Products & Categories)**: كتالوج شامل للمنتجات، وحدات القياس، باركود، أسعار البيع والشراء، والحدود الأدنى/الأقصى للمخزون.
- **شركاء الأعمال (Business Partners)**: إدارة بيانات العملاء والموردين، حد الائتمان، والأرقام الضريبية.

### 2. 💰 موديول المبيعات والنقطية (Sales & POS)
- **عروض الأسعار (Sales Quotations)**: إصدار عروض الأسعار وتحويلها التلقائي إلى أوامر مبيعات.
- **أوامر المبيعات (Sales Orders)**: إدارة الطلبات، حالة الاعتماد، والتسليم.
- **الفواتير والإشعارات (Sales Invoices & Credit Notes)**: الفوترة الإلكترونية الضريبية، الخصومات، والربط المحاسبي التلقائي.
- **سندات المقبوضات (Sales Payments)**: تحصيل المستحقات نقداً، شبكة، أو تحويل بنكي على الخزائن والصناديق.
- **نقطة البيع (Point of Sale - POS)**: واجهة سريعة ومخصصة للمبيعات المباشرة.

### 3. 🛍️ موديول المشتريات وإدارة الموردين (Procurement)
- **طلبات الشراء (Purchase Requests)**: تقديم واعتماد طلبات الاحتياج الداخلي.
- **أوامر الشراء (Purchase Orders)**: إصدار أوامر التوريد للموردين وتتبع حالات التوريد.
- **فواتير وإشعارات المشتريات (Vendor Bills & Debit Notes)**: تسجيل الاستحقاقات، الخصم، وتأثير المخزون.
- **سندات الصرف للموردين (Vendor Payments)**: تسوية حسابات الموردين وتفريغ الاستحقاقات.

### 4. 📦 موديول المخزون وحركة المواد (Inventory)
- **جرد المخزون الحالي (Stock on Hand & Quants)**: تتبع الكميات المتوفرة والتكلفة المتوسطة المرجحة (WAVC).
- **التحويلات المخزنية (Stock Transfers)**: نقل الكميات بين المستودعات بمرونة مع التوثيق المحاسبي المخزني.
- **تسويات المخزون (Stock Adjustments)**: معالجة العجز والزيادة المخزنية.

### 5. 👥 موديول الموارد البشرية والرواتب (HRMS & Payroll)
- **سجل الموظفين (Employee Profiles)**: حفظ البيانات الشخصية والوظيفية، والربط بالمنصب والفرع التابع له.
- **المناصب الوظيفية (Job Positions)**: قائمة ديناميكية للمناصب الوظيفية مع إمكانية الإضافة الفورية.
- **الإجازات والعقود (Leaves & Contracts)**: إدارة العقود والبدلات والاستقطاعات وتتبع طلبات الإجازات.
- **مسيرات الرواتب (Payroll Processing)**: احتساب المستحقات والرواتب وإصدار مسيرات الرواتب والقيود المحاسبية الخاصة بها.

### 6. 📊 موديول المحاسبة العامة والمالية (Finance & General Ledger)
- **محرك القيود التلقائي (Accounting Engine)**: إنشاء قيود اليومية المزدوجة (Journal Entries) تلقائياً عند اعتماد أي معاملة (فاتورة، سند، مسير رواتب).
- **دليل الحسابات الشجري (Chart of Accounts)**: هيكل محاسبي مرن وشجري يغطي الأصول، الخصوم، حقوق الملكية، الإيرادات، والمصروفات.
- **إدارة الخزائن والصناديق (Treasury & Safes)**: متابعة أردسة الصناديق والحسابات البنكية وحركتها.
- **التقارير القوائم المالية (Financial Reports)**:
  - ميزان المراجعة (Trial Balance)
  - قائمة الدخل / الأرباح والخسائر (Profit & Loss)
  - الميزانية العمومية (Balance Sheet)
  - دفتر الاستاد واليومية العامة (General Ledger & Journal)

### 7. ⚙️ إدارة الأمان والصلاحيات (RBAC Security)
- **الأدوار والصلاحيات (Roles & Permissions)**: نظام صلاحيات دقيق (Granular Permissions) لمنح المستخدمين إمكانية الوصول بحسب دورهم.
- **سجل المراجعة والتدقيق (Audit Trail)**: توثيق كافة العمليات (إنشاء، تعديل، حذف) مع تتبع هوية المستخدم والتاريخ.

---

## 🛠️ التقنيات المستخدمة (Technology Stack)

- **الواجهة الأمامية (Frontend)**:
  - [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
  - [React 19](https://react.dev/)
  - [TypeScript](https://www.typescriptlang.org/)
  - [Tailwind CSS 3.4](https://tailwindcss.com/)
  - [shadcn/ui](https://ui.shadcn.com/) & [Radix UI](https://www.radix-ui.com/)
  - [Lucide React Icons](https://lucide.dev/)
  - [TanStack Query (React Query v5)](https://tanstack.com/query)
  - [Zustand](https://zustand-demo.pmnd.rs/) (إدارة الحالة المحلية)

- **الواجهة الخلفية وقواعد البيانات (Backend & Database)**:
  - Next.js Server Components & API Route Handlers
  - [Prisma ORM 6.0](https://www.prisma.io/)
  - [PostgreSQL](https://www.postgresql.org/) (Amazon Aurora PostgreSQL / Local PostgreSQL)
  - JWT Session Cookie Authentication Guard

---

## 💻 متطلبات التشغيل والتثبيت (Getting Started)

### 1. المتطلبات الأساسية (Prerequisites)
- **Node.js**: الإصدار `v18.17.0` أو أحدث.
- **PostgreSQL**: الإصدار `v14` أو أحدث.
- **npm** أو **yarn** أو **pnpm**.

### 2. استنساخ المستودع (Clone Repository)
```bash
git clone https://github.com/AbdullahMaresh9/Orminal-ERP.git
cd Orminal-ERP
```

### 3. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 4. إعداد متغيرات البيئة (Environment Variables)
قم بإنشاء ملف `.env` في مجلد المشروع الرئيسي وأضف البيانات التالية:

```env
# رابط الاتصال بقاعدة البيانات PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/orminal_erp?schema=public"

# مفتاح التشفير للجلسات (JWT Secret)
JWT_SECRET="your-super-secret-jwt-key-here"

# وضع البيئة (development / production)
NODE_ENV="development"
```

### 5. إعداد قاعدة البيانات والتهجير (Database Setup & Prisma Migration)
تطبيق هيكل قاعدة البيانات وتنزيل عميل Prisma:

```bash
# إنشاء الهيكل في قاعدة البيانات
npx prisma db push

# (اختياري) بذر البيانات الأولية التجريبية
npx prisma db seed
```

### 6. تشغيل خادم التطوير (Run Development Server)
```bash
npm run dev
```
افتح المتصفح وادخل على الرابط: `http://localhost:3000`

---

## 🏗️ هيكل المشروع (Project Directory Structure)

```
orminal-system-v0/
├── prisma/
│   └── schema.prisma         # هيكل وتصميم قاعدة البيانات
├── src/
│   ├── app/                  # صفحات Next.js مسارات API والـ Routing
│   │   ├── api/erp/          # كافة نقاط اتصال API للنظام المحاسبي
│   │   ├── layout.tsx        # المخطط الرئيسي للواجهات والشاشات
│   │   └── page.tsx          # الصفحة الرئيسية لوحة التحكم
│   ├── components/
│   │   ├── erp/              # المكونات الأساسية للنظام ERP Shell, Nav, Header
│   │   ├── modules/          # شاشات وموديولات النظام التفصيلية
│   │   └── ui/               # مكونات الواجهة shadcn/ui
│   ├── hooks/                # الخطافات المخصصة Custom React Hooks
│   ├── lib/
│   │   ├── erp/              # محرك المحاسبة والخدمات الخلفية Accounting Engine
│   │   ├── db.ts             # عميل الاتصال بقاعدة البيانات Prisma Client
│   │   └── utils.ts          # دوال مساعدة عامة
│   ├── stores/               # إدارة حالة التطبيق Zustand Stores
│   └── types/                # تعريف الأنواع والأنماط TypeScript Types
├── public/                   # الملفات والشعارات الساكنة
├── package.json              # حزم المشروع والإعدادات
└── README.md                 # وثيقة شرح المشروع
```

---

## 🔐 الأمان والخصوصية (Security & Governance)

1. **تشفير كلمات المرور**: استخدام خوارزمية `scrypt` وحماية الجلسات بـ HTTP-only Cookies.
2. **التحكم بالوصول المعتمد على الأدوار (RBAC)**: فحص صلاحيات المستخدم قبل تنفيذ أي عملية في الواجهة الأمامية والأنظمة الخلفية.
3. **التحقق من البيانات (Input Validation)**: فحص كافة البيانات المدخلة لمنع ثغرات SQL Injection و XSS.

---

## 📄 الترخيص والمساهمة (License & Contribution)

هذا المشروع مملوك حصرياً لـ **Orminal Tech** و مخصص للاستخدام المؤسسي Enterprise Use.

تصميم وتطوير بواسطة **عبدالله مارش (Abdullah Maresh)** 🚀



| التواصل | الرابط |
|---------|--------|
| 📧 البريد الإلكتروني | [abdullah55maresh@gmail.com](mailto:abdullah55maresh@gmail.com) |
| 💼 GitHub | [github.com/AbdullahMaresh9](https://github.com/AbdullahMaresh9) |

---