import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { put } from '@vercel/blob'

/**
 * Storage port. Same shape as the anchoring port in lib/protocol/anchor.ts:
 * an adapter receives bytes and returns where they were stored. Swapping the
 * local adapter for the Vercel Blob adapter changes nothing else in the app.
 *
 *   STORAGE_MODE=local  -> writes to /public/uploads, served from /uploads/...  (dev default)
 *   STORAGE_MODE=blob   -> Vercel Blob using separate public/private stores     (production)
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

// Guides, safety plans, and operational templates use the same deliberate
// format and size limits as waiver attachments. The content remains owned by
// the organization and is stored through the same replaceable storage adapter.
export const ALLOWED_ORGANIZATION_DOCUMENT_TYPES = ALLOWED_WAIVER_DOCUMENT_TYPES
export const MAX_ORGANIZATION_DOCUMENT_BYTES = MAX_WAIVER_DOCUMENT_BYTES

class LocalStorageAdapter implements StorageAdapter {
  backend = 'local'
  async put({ key, bytes }: { key: string; bytes: Buffer; contentType: string }) {
    const dest = path.join(process.cwd(), 'public', 'uploads', key)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, bytes)
    return { url: `/uploads/${key}` }
  }
}

const PRIVATE_LOCAL_PREFIX = 'local-private:'
class LocalPrivateStorageAdapter implements StorageAdapter {
  backend = 'local-private'
  async put({ key, bytes }: { key: string; bytes: Buffer; contentType: string }) {
    const dest = path.join(process.cwd(), '.private-uploads', key)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, bytes)
    return { url: `${PRIVATE_LOCAL_PREFIX}${key}` }
  }
}

export async function readPrivateLocalFile(url:string):Promise<Buffer|null>{
  if(!url.startsWith(PRIVATE_LOCAL_PREFIX))return null
  const key=url.slice(PRIVATE_LOCAL_PREFIX.length)
  const root=path.resolve(process.cwd(),'.private-uploads')
  const file=path.resolve(root,key)
  if(!file.startsWith(root+path.sep))return null
  try{return await readFile(file)}catch{return null}
}

type BlobAccess = 'private' | 'public'

function blobToken(access: BlobAccess) {
  const name = access === 'public'
    ? 'BLOB_PUBLIC_READ_WRITE_TOKEN'
    : 'BLOB_PRIVATE_READ_WRITE_TOKEN'
  const token = process.env[name] || process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new Error(`Missing ${name}. Configure a ${access} Vercel Blob store for production uploads.`)
  }
  return token
}

export function getPrivateBlobToken() {
  return blobToken('private')
}

class BlobStorageAdapter implements StorageAdapter {
  backend = 'vercel-blob'
  constructor(private readonly access: BlobAccess) {}
  async put({ key, bytes, contentType }: { key: string; bytes: Buffer; contentType: string }) {
    const { url } = await put(key, bytes, {
      access: this.access,
      contentType,
      token: blobToken(this.access),
    })
    return { url }
  }
}

export function getStorageAdapter(): StorageAdapter {
  return process.env.STORAGE_MODE === 'blob' ? new BlobStorageAdapter('public') : new LocalStorageAdapter()
}

/**
 * Private source files for waivers and organization documents. The stored URL
 * is never rendered directly; `/api/organization-files/...` authorizes and
 * streams it to an allowed reader.
 */
export function getPrivateStorageAdapter(): StorageAdapter {
  return process.env.STORAGE_MODE === 'blob' ? new BlobStorageAdapter('private') : new LocalPrivateStorageAdapter()
}
