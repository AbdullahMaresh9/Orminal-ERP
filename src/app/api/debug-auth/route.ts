import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt) as (password: string | Buffer, salt: string | Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>

export async function GET() {
  try {
    const dbUrl = process.env.POSTGRES_PRISMA_URL?.substring(0, 70) ?? 'NOT SET'
    const directUrl = process.env.DATABASE_URL_UNPOOLED?.substring(0, 70) ?? 'NOT SET'
    const userCount = await db.user.count()
    const user = await db.user.findFirst({ where: { username: 'admin' } })
    
    const [params, salt, stored] = (user?.passwordHash ?? '').split('$')
    const [, N, r, p] = params.split(':').map(Number)
    const key = await scryptAsync('admin123', Buffer.from(salt, 'hex'), 64, { N, r, p })
    const valid = timingSafeEqual(key, Buffer.from(stored, 'hex'))

    return NextResponse.json({
      dbUrl,
      directUrl,
      userCount,
      userFound: !!user,
      userActive: user?.active,
      pwdValid: valid,
      nodeEnv: process.env.NODE_ENV,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.substring(0, 500) }, { status: 500 })
  }
}
