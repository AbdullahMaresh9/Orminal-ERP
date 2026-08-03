export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
    const dbUrl = process.env.DATABASE_URL_UNPOOLED?.substring(0, 60)
    
    const user = await db.user.findFirst({
      where: { OR: [{ username }, { email: username }], active: true },
      select: { id: true, username: true, passwordHash: true, active: true }
    })

    if (!user) {
      return NextResponse.json({ ok: false, reason: 'user_not_found', dbUrl })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    return NextResponse.json({
      ok: valid,
      username: user.username,
      hashPrefix: user.passwordHash.substring(0, 7),
      dbUrl
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message, stack: e.stack?.substring(0, 300) }, { status: 500 })
  }
}
