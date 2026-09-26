import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { posix } from 'node:path'
import { COORDINATION_ASSETS, coordinationAsset, coordinationPrototypeEnabled } from '../src/lib/coordination-prototype'

async function main() {
  for (const name of COORDINATION_ASSETS) {
    const asset = await coordinationAsset(name)
    assert.ok(asset, `Runtime asset missing: ${name}`)
    const original = await readFile(`experiments/volunteer-coordination/${name}`, 'utf8')
    if (!['index.html', 'feed-model.js', 'app.js'].includes(name)) {
      assert.equal(asset.body, original, `${name}: original design/runtime must be served unchanged`)
    }
    if (name.endsWith('.js')) {
      for (const match of Array.from(asset.body.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g))) {
        const dependency = posix.join(posix.dirname(name), match[1])
        assert.ok((COORDINATION_ASSETS as readonly string[]).includes(dependency), `Unserved dependency: ${dependency}`)
      }
    }
  }
  const html = (await coordinationAsset('index.html'))!.body
  assert.ok(html.includes('citysync-data-mode'))
  for (const match of Array.from(html.matchAll(/(?:href|src)="\/coordination\/([^"]+)"/g))) {
    assert.ok((COORDINATION_ASSETS as readonly string[]).includes(match[1]), `Missing HTML asset: ${match[1]}`)
  }
  assert.ok(!html.includes('/_next/'), 'Do not load platform CSS or a second rendering runtime')
  for (const path of ['../package.json', 'server.mjs', 'README.md', 'model.test.mjs', '/index.html', 'assets/../../.env']) {
    assert.equal(await coordinationAsset(path), null, `Unexpected public asset: ${path}`)
  }
  const app = (await coordinationAsset('app.js'))!.body
  assert.ok(app.includes("(location.origin + '/coordination') + '/#join'"))
  const previousMode = process.env.CITYSYNC_COORDINATION_UI
  const previousVercel = process.env.VERCEL
  try {
    delete process.env.CITYSYNC_COORDINATION_UI
    assert.equal(coordinationPrototypeEnabled(), false)
    process.env.CITYSYNC_COORDINATION_UI = 'prototype'
    delete process.env.VERCEL
    assert.equal(coordinationPrototypeEnabled(), true)
    process.env.VERCEL = '1'
    assert.equal(coordinationPrototypeEnabled(), false)
  } finally {
    if (previousMode === undefined) delete process.env.CITYSYNC_COORDINATION_UI
    else process.env.CITYSYNC_COORDINATION_UI = previousMode
    if (previousVercel === undefined) delete process.env.VERCEL
    else process.env.VERCEL = previousVercel
  }
  console.log('PASS: exact source assets, complete runtime imports, mounted links, asset allowlist, and explicit local-demo gate.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
