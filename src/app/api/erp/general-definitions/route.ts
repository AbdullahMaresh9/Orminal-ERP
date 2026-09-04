// =============================================================================
// Enterprise ERP — General Definitions API Endpoint
// GET /api/erp/general-definitions
// POST /api/erp/general-definitions
// =============================================================================

import { NextResponse } from 'next/server'
import { ok, badRequest, serverError } from '@/lib/erp/api-response'
import {
  getTypeSummaryList,
  getDefinitions,
  createDefinition,
  seedInitialDefinitions,
} from '@/lib/erp/general-definitions-service'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode')
    const typeCode = searchParams.get('typeCode')
    const q = searchParams.get('q') || undefined
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const seed = searchParams.get('seed') === 'true'

    if (seed) {
      await seedInitialDefinitions()
    }

    if (mode === 'types') {
      const types = await getTypeSummaryList()
      return ok(types)
    }

    if (!typeCode) {
      return badRequest('نوع التعريف (typeCode) مطلوب عند الاستعلام عن القيم.')
    }

    const items = await getDefinitions(typeCode, '*', q, activeOnly)
    return ok(items)
  } catch (e: any) {
    return serverError(e.message || 'حدث خطأ في استرجاع التعريفات العامة.')
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.typeCode) return badRequest('نوع التعريف (typeCode) مطلوب.')
    if (!body.code) return badRequest('رمز التعريف (code) مطلوب.')
    if (!body.nameAr) return badRequest('الاسم العربي مطلوب.')

    const created = await createDefinition(body)
    return ok(created)
  } catch (e: any) {
    return badRequest(e.message || 'فشل إضافة عنصر التعريف.')
  }
}
