import { sha256Hex } from './hash'

/**
 * Merkle root over a list of event hashes (hex strings).
 * Odd nodes are paired with themselves. Empty set has a defined sentinel
 * root so "anchor of zero events" is unambiguous.
 */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256Hex('citysync:empty')
  let level = leaves.map((l) => sha256Hex(`leaf:${l}`))
  while (level.length > 1) {
    const next: string[] = []
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = i + 1 < level.length ? level[i + 1] : left
      next.push(sha256Hex(`node:${left}${right}`))
    }
    level = next
  }
  return level[0]
}
