import { db } from '@/lib/db'
import { ok, badRequest } from '@/lib/erp/api-response'

export async function GET() {
  const settings = await db.setting.findMany()
  const obj: Record<string, string> = {}
  for (const s of settings) obj[s.key] = s.value
  return ok(obj)
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Record<string, string>
    const ops = Object.entries(body).map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
    await Promise.all(ops)
    return ok({ success: true })
  } catch (e: any) {
    return badRequest(e.message)
  }
}
