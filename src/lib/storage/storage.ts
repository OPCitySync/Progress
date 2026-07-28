import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

/**
 * Storage port. Same shape as the anchoring port in lib/protocol/anchor.ts:
 * an adapter receives bytes and returns where they were stored. Swapping the
 * local adapter for the Vercel Blob adapter changes nothing else in the app.
 *
 *   STORAGE_MODE=local  -> writes to /public/uploads, served from /uploads/...  (dev default)
 *   STORAGE_MODE=blob   -> Vercel Blob (needs BLOB_READ_WRITE_TOKEN)            (Vercel default)
 *
 * Vercel's runtime filesystem is read-only, so the local adapter is for dev
 * only; production should run with STORAGE_MODE=blob.
 */
export interface StorageAdapter {
  backend: string
  put(input: { key: string; bytes: Buffer; contentType: string }): Promise<{ url: string }>
}

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

// Legal waiver attachments remain optional because organizations can still
// publish their waiver as accessible text. When included, the same storage
// port keeps the immutable file available alongside the versioned record.
export const ALLOWED_WAIVER_DOCUMENT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

export const MAX_WAIVER_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10 MB

class LocalStorageAdapter implements StorageAdapter {
  backend = 'local'
  async put({ key, bytes }: { key: string; bytes: Buffer; contentType: string }) {
    const dest = path.join(process.cwd(), 'public', 'uploads', key)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, bytes)
    return { url: `/uploads/${key}` }
  }
}

class BlobStorageAdapter implements StorageAdapter {
  backend = 'vercel-blob'
  async put({ key, bytes, contentType }: { key: string; bytes: Buffer; contentType: string }) {
    // @vercel/blob is an optional, production-only dependency. Loaded via a
    // non-literal specifier so dev type-checking/builds don't require it.
    const spec = '@vercel/blob'
    const blob = (await import(spec)) as {
      put: (
        k: string,
        body: Buffer,
        opts: { access: 'public'; contentType?: string; token?: string; addRandomSuffix?: boolean },
      ) => Promise<{ url: string }>
    }
    const { url } = await blob.put(key, bytes, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url }
  }
}

export function getStorageAdapter(): StorageAdapter {
  return process.env.STORAGE_MODE === 'blob' ? new BlobStorageAdapter() : new LocalStorageAdapter()
}
