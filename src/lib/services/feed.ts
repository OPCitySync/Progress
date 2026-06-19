import { randomUUID } from 'crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { posts, postHearts, orgs, users } from '@/lib/db/schema'
import { appendEvent } from '@/lib/ledger/ledger'
import { EventTypes } from '@/lib/ledger/events'
import type { Result } from './identity'

/**
 * MyCity Feed. Issuer and Redeemer organizations post; Civic Participants
 * can heart a post (no comments, by design). Visible to every role.
 */

const MAX_POST_LENGTH = 1000

export async function createPost(input: {
  orgId: string
  actorId: string
  body: string
}): Promise<Result<{ id: string }>> {
  const body = input.body.trim()
  if (!body) return { ok: false, error: 'Write something first.' }
  if (body.length > MAX_POST_LENGTH) {
    return { ok: false, error: `Posts are limited to ${MAX_POST_LENGTH} characters.` }
  }
  const org = (await db.select().from(orgs).where(eq(orgs.id, input.orgId)).limit(1))[0]
  if (!org || org.status !== 'approved') {
    return { ok: false, error: 'Your organization must be active to post.' }
  }

  const id = randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(posts).values({
      id,
      orgId: input.orgId,
      authorUserId: input.actorId,
      body,
      createdAt: Date.now(),
    })
    await appendEvent(tx, EventTypes.POST_CREATED, { postId: id, orgId: input.orgId }, input.actorId)
  })
  return { ok: true, id }
}

/** Toggle a participant's heart. Returns the new state. */
export async function toggleHeart(postId: string, userId: string): Promise<Result<{ hearted: boolean }>> {
  const post = (await db.select().from(posts).where(eq(posts.id, postId)).limit(1))[0]
  if (!post) return { ok: false, error: 'Post not found.' }

  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
  if (!user || user.role !== 'participant') {
    return { ok: false, error: 'Only civic participants can heart posts.' }
  }

  const existing = (
    await db
      .select()
      .from(postHearts)
      .where(and(eq(postHearts.postId, postId), eq(postHearts.userId, userId)))
      .limit(1)
  )[0]

  if (existing) {
    await db.transaction(async (tx) => {
      await tx.delete(postHearts).where(eq(postHearts.id, existing.id))
      await appendEvent(tx, EventTypes.POST_UNHEARTED, { postId }, userId)
    })
    return { ok: true, hearted: false }
  }

  await db.transaction(async (tx) => {
    await tx.insert(postHearts).values({
      id: randomUUID(),
      postId,
      userId,
      createdAt: Date.now(),
    })
    await appendEvent(tx, EventTypes.POST_HEARTED, { postId }, userId)
  })
  return { ok: true, hearted: true }
}

export async function getFeed(viewerUserId: string) {
  const feed = await db
    .select({ post: posts, org: orgs })
    .from(posts)
    .innerJoin(orgs, eq(posts.orgId, orgs.id))
    .orderBy(desc(posts.createdAt))
    .limit(100)

  const ids = feed.map((f) => f.post.id)
  const heartCounts =
    ids.length > 0
      ? await db
          .select({ postId: postHearts.postId, n: sql<number>`count(*)` })
          .from(postHearts)
          .where(inArray(postHearts.postId, ids))
          .groupBy(postHearts.postId)
      : []
  const mine =
    ids.length > 0
      ? await db
          .select({ postId: postHearts.postId })
          .from(postHearts)
          .where(and(eq(postHearts.userId, viewerUserId), inArray(postHearts.postId, ids)))
      : []

  const countBy = new Map(heartCounts.map((h) => [h.postId, Number(h.n)]))
  const mineSet = new Set(mine.map((m) => m.postId))

  return feed.map(({ post, org }) => ({
    post,
    org,
    hearts: countBy.get(post.id) ?? 0,
    heartedByMe: mineSet.has(post.id),
  }))
}
