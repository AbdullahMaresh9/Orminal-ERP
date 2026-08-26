import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Default seed records matching Image 1
const DEFAULT_ORG_ITEMS = [
  { code: '1', nameAr: 'المدير العام', nameEn: 'General Manager', type: 'قطاع', level: 1, notes: 'أعلى مستوى', parentCode: null },
  { code: '2', nameAr: 'إدارة المالية', nameEn: 'Finance Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentCode: '1' },
  { code: '3', nameAr: 'إدارة التسويق', nameEn: 'Marketing Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentCode: '1' },
  { code: '4', nameAr: 'إدارة المبيعات', nameEn: 'Sales Dept', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentCode: '1' },
  { code: '5', nameAr: 'المحاسبة', nameEn: 'Accounting', type: 'إدارة', level: 3, notes: 'نفس إدارة المالية', parentCode: '2' },
  { code: '6', nameAr: 'التسويق الرقمي', nameEn: 'Digital Marketing', type: 'إدارة', level: 3, notes: 'تخصص فرعي', parentCode: '3' },
  { code: '7', nameAr: 'الموارد البشرية', nameEn: 'Human Resources', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentCode: '1' },
  { code: '8', nameAr: 'التوظيف والتدريب', nameEn: 'Recruitment & Training', type: 'إدارة', level: 3, notes: 'فرع من الموارد البشرية', parentCode: '7' },
  { code: '9', nameAr: 'إدارة تقنية المعلومات', nameEn: 'IT Department', type: 'إدارة عامة', level: 2, notes: 'تابعة للمدير العام', parentCode: '1' },
  { code: '10', nameAr: 'الدعم الفني', nameEn: 'Technical Support', type: 'إدارة', level: 3, notes: 'فرعي تقنية المعلومات', parentCode: '9' },
]

export async function GET(req: NextRequest) {
  try {
    let items = await (db as any).orgStructure.findMany({
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
      include: {
        parent: {
          select: { id: true, code: true, nameAr: true },
        },
      },
    })

    // Seed default data if database is empty
    if (!items || items.length === 0) {
      const createdMap = new Map<string, any>()
      // First pass: create parentless or level 1 nodes
      for (const raw of DEFAULT_ORG_ITEMS) {
        if (!raw.parentCode) {
          const item = await (db as any).orgStructure.create({
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
      // Second pass: create child nodes with parentId
      for (const raw of DEFAULT_ORG_ITEMS) {
        if (raw.parentCode) {
          const parentObj = createdMap.get(raw.parentCode)
          const item = await (db as any).orgStructure.create({
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
      items = await (db as any).orgStructure.findMany({
        orderBy: [{ level: 'asc' }, { code: 'asc' }],
        include: {
          parent: {
            select: { id: true, code: true, nameAr: true },
          },
        },
      })
    }

    return NextResponse.json({ ok: true, data: items })
  } catch (err: any) {
    console.error('[OrgStructure API] GET error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
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

    let calculatedLevel = 1
    if (parentId) {
      const parent = await (db as any).orgStructure.findUnique({
        where: { id: parentId },
      })
      if (parent) {
        calculatedLevel = parent.level + 1
      }
    }

    const newItem = await (db as any).orgStructure.create({
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

    let calculatedLevel = 1
    if (parentId) {
      const parent = await (db as any).orgStructure.findUnique({
        where: { id: parentId },
      })
      if (parent) {
        calculatedLevel = parent.level + 1
      }
    }

    const updatedItem = await (db as any).orgStructure.update({
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

    // Check children
    const childCount = await (db as any).orgStructure.count({
      where: { parentId: id },
    })

    if (childCount > 0) {
      return NextResponse.json(
        { ok: false, message: 'لا يمكن حذف هذا الهيكل لأنه يحتوي على هياكل تابعة له' },
        { status: 400 }
      )
    }

    await (db as any).orgStructure.delete({
      where: { id },
    })

    return NextResponse.json({ ok: true, message: 'تم حذف الهيكل بنجاح' })
  } catch (err: any) {
    console.error('[OrgStructure API] DELETE error:', err)
    return NextResponse.json(
      { ok: false, message: err.message || 'فشل حذف الهيكل' },
      { status: 500 }
    )
  }
}
