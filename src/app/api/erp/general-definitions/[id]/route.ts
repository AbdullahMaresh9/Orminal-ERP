// =============================================================================
// Enterprise ERP — General Definitions ID API Endpoint
// PUT /api/erp/general-definitions/[id]
// DELETE /api/erp/general-definitions/[id]
// =============================================================================

import { NextResponse } from 'next/server'
import { ok, badRequest, serverError } from '@/lib/erp/api-response'
import { updateDefinition, deleteDefinition } from '@/lib/erp/general-definitions-service'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await updateDefinition(id, body)
    return ok(updated)
  } catch (e: any) {
    return badRequest(e.message || 'فشل تعديل عنصر التعريف.')
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await deleteDefinition(id)
    return ok(result)
  } catch (e: any) {
    return badRequest(e.message || 'تعذر حذف التعريف.')
  }
}
