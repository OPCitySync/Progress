import { randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { savedItems } from '@/lib/db/schema'

export type SavedItemKind = 'post' | 'task'

export async function savedItemIds(userId: string, kind: SavedItemKind, ids?: string[]) {
  if (ids && ids.length === 0) return new Set<string>()
  const rows = await db
    .select({ itemId: savedItems.itemId })
    .from(savedItems)
    .where(ids ? and(eq(savedItems.userId, userId), eq(savedItems.kind, kind), inArray(savedItems.itemId, ids)) : and(eq(savedItems.userId, userId), eq(savedItems.kind, kind)))
  return new Set(rows.map((row) => row.itemId))
}

export async function toggleSavedItem(userId: string, kind: SavedItemKind, itemId: string) {
  const existing = (await db.select({ id: savedItems.id }).from(savedItems).where(and(eq(savedItems.userId, userId), eq(savedItems.kind, kind), eq(savedItems.itemId, itemId))).limit(1))[0]
  if (existing) {
    await db.delete(savedItems).where(eq(savedItems.id, existing.id))
    return { saved: false }
  }
  await db.insert(savedItems).values({ id: randomUUID(), userId, kind, itemId, createdAt: Date.now() })
  return { saved: true }
}
