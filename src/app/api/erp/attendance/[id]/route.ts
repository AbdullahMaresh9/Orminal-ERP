import { db } from '@/lib/db'
import { ok, notFound, badRequest, serverError } from '@/lib/erp/api-response'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.attendance.findUnique({
      where: { id },
      include: { employee: { select: { id: true, employeeNo: true, nameAr: true } } },
    })
    if (!item) return notFound('Attendance record not found')
    return ok(item)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const exists = await db.attendance.findUnique({ where: { id } })
    if (!exists) return notFound('Attendance record not found')

    const { id: _id, ...rest } = body
    if (rest.date) rest.date = new Date(rest.date)
    if (rest.checkIn) rest.checkIn = new Date(rest.checkIn)
    if (rest.checkOut) rest.checkOut = new Date(rest.checkOut)
    const updated = await db.attendance.update({ where: { id }, data: rest })
    return ok(updated)
  } catch (e: any) {
    return serverError(e.message)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const exists = await db.attendance.findUnique({ where: { id } })
    if (!exists) return notFound('Attendance record not found')
    await db.attendance.delete({ where: { id } })
    return ok({ success: true })
  } catch (e: any) {
    return serverError(e.message)
  }
}
