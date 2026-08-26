import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface OrgItem {
  id: string
  code: string
  nameAr: string
  nameEn: string | null
  parentId: string | null
  parent?: { id: string; code: string; nameAr: string } | null
  type: string
  level: number
  notes: string | null
  active?: boolean
  isSuspended?: boolean
  suspensionReason?: string | null
  createdAt?: string
  updatedAt?: string
}

// In-memory fallback seed items
let memoryOrgItems: OrgItem[] = [
  { id: '1', code: '1', nameAr: 'المدير العام', nameEn: 'General Manager', type: 'قطاع', level: 1, notes: 'أعلى مستوى', parentId: null, parent: null },
  { id: '2', code: '2', nameAr: 'إدارة المالية', nameEn: 'Finance Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentId: '1', parent: { id: '1', code: '1', nameAr: 'المدير العام' } },
  { id: '3', code: '3', nameAr: 'إدارة التسويق', nameEn: 'Marketing Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentId: '1', parent: { id: '1', code: '1', nameAr: 'المدير العام' } },
  { id: '4', code: '4', nameAr: 'إدارة المبيعات', nameEn: 'Sales Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentId: '1', parent: { id: '1', code: '1', nameAr: 'المدير العام' } },
  { id: '5', code: '5', nameAr: 'المحاسبة', nameEn: 'Accounting', type: 'إدارة', level: 3, notes: 'نفس إدارة المالية', parentId: '2', parent: { id: '2', code: '2', nameAr: 'إدارة المالية' } },
  { id: '6', code: '6', nameAr: 'التسويق الرقمي', nameEn: 'Digital Marketing', type: 'إدارة', level: 3, notes: 'تخصص فرعي', parentId: '3', parent: { id: '3', code: '3', nameAr: 'إدارة التسويق' } },
  { id: '7', code: '7', nameAr: 'الموارد البشرية', nameEn: 'Human Resources', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentId: '1', parent: { id: '1', code: '1', nameAr: 'المدير العام' } },
  { id: '8', code: '8', nameAr: 'التوظيف والتدريب', nameEn: 'Recruitment & Training', type: 'إدارة', level: 3, notes: 'فرع من الموارد البشرية', parentId: '7', parent: { id: '7', code: '7', nameAr: 'الموارد البشرية' } },
  { id: '9', code: '9', nameAr: 'إدارة تقنية المعلومات', nameEn: 'IT Department', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentId: '1', parent: { id: '1', code: '1', nameAr: 'المدير العام' } },
  { id: '10', code: '10', nameAr: 'الدعم الفني', nameEn: 'Technical Support', type: 'إدارة', level: 3, notes: 'فرعي تقنية المعلومات', parentId: '9', parent: { id: '9', code: '9', nameAr: 'إدارة تقنية المعلومات' } },
]

function getPrismaModel() {
  const client = db as any
  if (client && client.orgStructure && typeof client.orgStructure.findMany === 'function') {
    return client.orgStructure
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const model = getPrismaModel()
    if (model) {
      try {
        let items = await model.findMany({
          orderBy: [{ level: 'asc' }, { code: 'asc' }],
          include: {
            parent: {
              select: { id: true, code: true, nameAr: true },
            },
          },
        })

        if (!items || items.length === 0) {
          const createdMap = new Map<string, any>()
          for (const raw of memoryOrgItems) {
            if (!raw.parentId) {
              const item = await model.create({
                data: {
                  code: raw.code,
                  nameAr: raw.nameAr,
                  nameEn: raw.nameEn,
                  type: raw.type,
                  level: raw.level,
                  notes: raw.notes,
                },
              })
              createdMap.set(raw.code, item)
            }
          }
          for (const raw of memoryOrgItems) {
            if (raw.parentId) {
              const parentObj = createdMap.get(raw.parentId) || createdMap.get(raw.code)
              const item = await model.create({
                data: {
                  code: raw.code,
                  nameAr: raw.nameAr,
                  nameEn: raw.nameEn,
                  type: raw.type,
                  level: raw.level,
                  notes: raw.notes,
                  parentId: parentObj?.id ?? null,
                },
              })
              createdMap.set(raw.code, item)
            }
          }
          items = await model.findMany({
            orderBy: [{ level: 'asc' }, { code: 'asc' }],
            include: {
              parent: {
                select: { id: true, code: true, nameAr: true },
              },
            },
          })
        }

        return NextResponse.json({ ok: true, data: items })
      } catch (dbErr) {
        console.warn('[OrgStructure GET] DB access error, fallback to memory:', dbErr)
      }
    }

    return NextResponse.json({ ok: true, data: memoryOrgItems })
  } catch (err: any) {
    console.error('[OrgStructure API] GET error:', err)
    return NextResponse.json({ ok: true, data: memoryOrgItems })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, nameAr, nameEn, parentId, type, notes } = body

    if (!code || !nameAr) {
      return NextResponse.json(
        { ok: false, message: 'رقم الهيكل واسم الهيكل حقول مطلوبة' },
        { status: 400 }
      )
    }

    const model = getPrismaModel()
    let calculatedLevel = 1

    if (model) {
      try {
        if (parentId) {
          const parent = await model.findUnique({
            where: { id: parentId },
          })
          if (parent) {
            calculatedLevel = parent.level + 1
          }
        }

        const newItem = await model.create({
          data: {
            code,
            nameAr,
            nameEn: nameEn || null,
            parentId: parentId || null,
            type: type || 'إدارة',
            level: calculatedLevel,
            notes: notes || null,
          },
          include: {
            parent: {
              select: { id: true, code: true, nameAr: true },
            },
          },
        })

        return NextResponse.json({ ok: true, data: newItem })
      } catch (dbErr) {
        console.warn('[OrgStructure POST] DB write error, fallback to memory:', dbErr)
      }
    }

    // In-memory fallback
    const parentObj = memoryOrgItems.find((i) => i.id === parentId || i.code === parentId)
    calculatedLevel = parentObj ? parentObj.level + 1 : 1

    const newItem: OrgItem = {
      id: String(Date.now()),
      code,
      nameAr,
      nameEn: nameEn || null,
      parentId: parentObj ? parentObj.id : (parentId || null),
      parent: parentObj ? { id: parentObj.id, code: parentObj.code, nameAr: parentObj.nameAr } : null,
      type: type || 'إدارة',
      level: calculatedLevel,
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    memoryOrgItems.push(newItem)
    return NextResponse.json({ ok: true, data: newItem })
  } catch (err: any) {
    console.error('[OrgStructure API] POST error:', err)
    return NextResponse.json(
      { ok: false, message: err.message || 'فشل حفظ الهيكل التنظيمي' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, code, nameAr, nameEn, parentId, type, notes } = body

    if (!id || !code || !nameAr) {
      return NextResponse.json(
        { ok: false, message: 'معرف الهيكل وركمه واسمه مطلوبان' },
        { status: 400 }
      )
    }

    const model = getPrismaModel()
    let calculatedLevel = 1

    if (model) {
      try {
        if (parentId) {
          const parent = await model.findUnique({
            where: { id: parentId },
          })
          if (parent) {
            calculatedLevel = parent.level + 1
          }
        }

        const updatedItem = await model.update({
          where: { id },
          data: {
            code,
            nameAr,
            nameEn: nameEn || null,
            parentId: parentId || null,
            type: type || 'إدارة',
            level: calculatedLevel,
            notes: notes || null,
          },
          include: {
            parent: {
              select: { id: true, code: true, nameAr: true },
            },
          },
        })

        return NextResponse.json({ ok: true, data: updatedItem })
      } catch (dbErr) {
        console.warn('[OrgStructure PUT] DB write error, fallback to memory:', dbErr)
      }
    }

    // In-memory fallback
    const parentObj = memoryOrgItems.find((i) => i.id === parentId || i.code === parentId)
    calculatedLevel = parentObj ? parentObj.level + 1 : 1

    const existingIndex = memoryOrgItems.findIndex((i) => i.id === id || i.code === code)
    const updatedItem: OrgItem = {
      id: existingIndex !== -1 ? memoryOrgItems[existingIndex].id : (id || String(Date.now())),
      code,
      nameAr,
      nameEn: nameEn || null,
      parentId: parentObj ? parentObj.id : (parentId || null),
      parent: parentObj ? { id: parentObj.id, code: parentObj.code, nameAr: parentObj.nameAr } : null,
      type: type || 'إدارة',
      level: calculatedLevel,
      notes: notes || null,
      updatedAt: new Date().toISOString(),
    }

    if (existingIndex !== -1) {
      memoryOrgItems[existingIndex] = { ...memoryOrgItems[existingIndex], ...updatedItem }
    } else {
      memoryOrgItems.push(updatedItem)
    }

    return NextResponse.json({ ok: true, data: updatedItem })
  } catch (err: any) {
    console.error('[OrgStructure API] PUT error:', err)
    return NextResponse.json(
      { ok: false, message: err.message || 'فشل تعديل الهيكل التنظيمي' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ ok: false, message: 'معرف الهيكل غير محدد' }, { status: 400 })
    }

    const model = getPrismaModel()
    if (model) {
      try {
        const childCount = await model.count({
          where: { parentId: id },
        })

        if (childCount > 0) {
          return NextResponse.json(
            { ok: false, message: 'لا يمكن حذف هذا الهيكل لأنه يحتوي على هياكل تابعة له' },
            { status: 400 }
          )
        }

        await model.delete({
          where: { id },
        })

        return NextResponse.json({ ok: true, message: 'تم حذف الهيكل بنجاح' })
      } catch (dbErr) {
        console.warn('[OrgStructure DELETE] DB delete error, fallback to memory:', dbErr)
      }
    }

    // In-memory fallback
    const hasChildren = memoryOrgItems.some((i) => i.parentId === id)
    if (hasChildren) {
      return NextResponse.json(
        { ok: false, message: 'لا يمكن حذف هذا الهيكل لأنه يحتوي على هياكل تابعة له' },
        { status: 400 }
      )
    }

    memoryOrgItems = memoryOrgItems.filter((i) => i.id !== id && i.code !== id)
    return NextResponse.json({ ok: true, message: 'تم حذف الهيكل بنجاح' })
  } catch (err: any) {
    console.error('[OrgStructure API] DELETE error:', err)
    return NextResponse.json(
      { ok: false, message: err.message || 'فشل حذف الهيكل' },
      { status: 500 }
    )
  }
}
