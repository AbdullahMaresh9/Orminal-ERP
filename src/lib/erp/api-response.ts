// Enterprise ERP — Standard API Response Envelope
// Source: Book 4 §4.8 Response Standards
// All API routes MUST use these helpers for consistent responses.

import { NextResponse } from 'next/server'

export interface ApiResponseMeta {
  requestId?: string
  correlationId?: string
  timestamp: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasMore: boolean
  }
}

export interface ApiSuccessResponse<T> {
  data: T
  meta: ApiResponseMeta
}

export interface ApiListResponse<T> {
  data: T[]
  meta: ApiResponseMeta & { pagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } }
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    field?: string
    errors?: { field: string; code: string; message: string; rejectedValue?: any }[]
  }
  meta: ApiResponseMeta
}

function meta(): ApiResponseMeta {
  return { timestamp: new Date().toISOString() }
}

export function ok<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data, meta: meta() }, { status })
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data, meta: meta() }, { status: 201 })
}

export function accepted<T>(data: T): NextResponse {
  return NextResponse.json({ data, meta: meta() }, { status: 202 })
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function list<T>(data: T[], total: number, page: number = 1, pageSize: number = 50): NextResponse {
  const totalPages = Math.ceil(total / pageSize) || 1
  return NextResponse.json({
    data,
    meta: {
      ...meta(),
      pagination: { page, pageSize, total, totalPages, hasMore: page < totalPages },
    },
  })
}

export function badRequest(message: string, code: string = 'VALIDATION_ERROR', details?: any): NextResponse {
  return NextResponse.json(
    { error: { code, message, details }, meta: meta() },
    { status: 400 }
  )
}

export function unauthorized(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message }, meta: meta() },
    { status: 401 }
  )
}

export function forbidden(message: string = 'Forbidden', code: string = 'FORBIDDEN'): NextResponse {
  return NextResponse.json(
    { error: { code, message }, meta: meta() },
    { status: 403 }
  )
}

export function notFound(message: string = 'Not found'): NextResponse {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message }, meta: meta() },
    { status: 404 }
  )
}

export function conflict(message: string, code: string = 'CONFLICT', details?: any): NextResponse {
  return NextResponse.json(
    { error: { code, message, details }, meta: meta() },
    { status: 409 }
  )
}

export function unprocessableEntity(message: string, errors: { field: string; code: string; message: string; rejectedValue?: any }[]): NextResponse {
  return NextResponse.json(
    { error: { code: 'VALIDATION_FAILED', message, errors }, meta: meta() },
    { status: 422 }
  )
}

export function serverError(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR'): NextResponse {
  return NextResponse.json(
    { error: { code, message }, meta: meta() },
    { status: 500 }
  )
}

// Parse pagination params from URL
export function parsePagination(req: Request) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') || url.searchParams.get('limit') || '50')))
  const skip = (page - 1) * pageSize
  return { page, pageSize, skip }
}

// Parse filter params (simple ?field=value)
export function parseFilters(req: Request, allowed: string[]): Record<string, string> {
  const url = new URL(req.url)
  const filters: Record<string, string> = {}
  for (const key of allowed) {
    const val = url.searchParams.get(key)
    if (val) filters[key] = val
  }
  return filters
}

// Parse search param
export function parseSearch(req: Request): string {
  const url = new URL(req.url)
  return (url.searchParams.get('q') || url.searchParams.get('search') || '').trim()
}
