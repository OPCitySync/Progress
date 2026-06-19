import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import {
  getStorageAdapter,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from '@/lib/storage/storage'

export const dynamic = 'force-dynamic'

/**
 * Image upload for the issuer profile builder. Issuer-only, validates type
 * and size, stores via the configured storage adapter, returns { url }.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'issuer' || !session.orgId) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  const ext = ALLOWED_IMAGE_TYPES[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'Unsupported file type. Use PNG, JPG, WEBP, or GIF.' },
      { status: 400 },
    )
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const key = `orgs/${session.orgId}/${randomUUID()}.${ext}`

  try {
    const adapter = getStorageAdapter()
    const { url } = await adapter.put({ key, bytes, contentType: file.type })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('upload failed', err)
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 })
  }
}
