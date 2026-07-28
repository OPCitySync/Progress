import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { ALLOWED_IMAGE_TYPES, getStorageAdapter, MAX_IMAGE_BYTES } from '@/lib/storage/storage'

export const dynamic = 'force-dynamic'

/** Upload a profile photo for the signed-in individual, independent of org ownership. */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No image provided.' }, { status: 400 })

  const ext = ALLOWED_IMAGE_TYPES[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Use a PNG, JPG, WEBP, or GIF image.' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Profile pictures must be 5 MB or smaller.' }, { status: 400 })
  }

  try {
    const { url } = await getStorageAdapter().put({
      key: `avatars/${session.sub}/${randomUUID()}.${ext}`,
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    })
    return NextResponse.json({ url })
  } catch (error) {
    console.error('avatar upload failed', error)
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 })
  }
}
