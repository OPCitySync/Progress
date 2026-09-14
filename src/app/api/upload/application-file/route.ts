import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { ALLOWED_ORGANIZATION_DOCUMENT_TYPES, getPrivateStorageAdapter, MAX_ORGANIZATION_DOCUMENT_BYTES } from '@/lib/storage/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || session.role !== 'participant') return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  const data = await request.formData()
  const file = data.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 })
  const extension = ALLOWED_ORGANIZATION_DOCUMENT_TYPES[file.type]
  if (!extension) return NextResponse.json({ error: 'Use a PDF, DOC, or DOCX file.' }, { status: 400 })
  if (file.size > MAX_ORGANIZATION_DOCUMENT_BYTES) return NextResponse.json({ error: 'Files must be 10 MB or smaller.' }, { status: 400 })
  try {
    const stored = await getPrivateStorageAdapter().put({ key: `applications/${session.sub}/${randomUUID()}.${extension}`, bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type })
    return NextResponse.json({ url: stored.url })
  } catch (error) {
    console.error('application file upload failed', error)
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 })
  }
}
