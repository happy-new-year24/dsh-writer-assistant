/* ============================================================================
 * relations.test.mjs — 关系图数据层与布局
 * ----------------------------------------------------------------------------
 * 两件事分开测：
 *   1) normalizeGraph 的清洗规则（脏数据不能把面板搞崩）
 *   2) layoutGraph 的几何性质（不出 NaN、不出画布、不重叠、确定性）
 *
 * 布局函数写在客户端 bundle 里（它要跑在浏览器），这里从源码里取出来跑，
 * 避免为了测试而在浏览器代码里塞导出。
 * ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizeGraph,
  sampleGraph,
  RELATION_TYPES,
  RELATION_TYPE_IDS,
  MAX_CHARACTERS,
  MAX_RELATIONS,
  MAX_NAME
} from '../lib/relations.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* ── 从客户端源码里取出 layoutGraph ──────────────────────────────────────── */

function loadLayoutGraph() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8')
  const start = src.indexOf('function layoutGraph(')
  assert.ok(start > 0, '在 client.js 里找不到 layoutGraph')

  let depth = 0
  let end = start
  let opened = false
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') { depth++; opened = true }
    else if (src[i] === '}') { depth--; if (opened && depth === 0) { end = i + 1; break } }
  }

  const body = src.slice(start, end)
  /* eslint-disable no-new-func */
  return new Function(body + '\nreturn layoutGraph')()
}

const layoutGraph = loadLayoutGraph()
const W = 720
const H = 460

function makeChars(n) {
  const out = []
  for (let i = 0; i < n; i++) out.push({ id: 'c' + i, name: '角色' + i })
  return out
}

function makeRels(chars, limit) {
  const out = []
  for (let i = 0; i < chars.length && out.length < limit; i++) {
    for (let j = i + 1; j < chars.length && out.length < limit; j++) {
      out.push({
        id: 'r' + out.length,
        from: chars[i].id,
        to: chars[j].id,
        type: 'kin',
        strength: 20 + ((i * 37 + j * 11) % 80)
      })
    }
  }
  return out
}

/* ── 清洗规则 ─────────────────────────────────────────────────────────────── */

test('空输入得到一个空图', () => {
  for (const input of [null, undefined, {}, { characters: 'x' }, { relations: 5 }]) {
    const g = normalizeGraph(input)
    assert.equal(g.version, 1)
    assert.deepEqual(g.characters, [])
    assert.deepEqual(g.relations, [])
  }
})

test('角色名去空白、去重、截断', () => {
  const g = normalizeGraph({
    characters: [
      { name: '  沈未晞  ' },
      { name: '沈未晞' },
      { name: '' },
      null,
      { name: 'x'.repeat(60) }
    ]
  })
  assert.equal(g.characters.length, 2)
  assert.equal(g.characters[0].name, '沈未晞')
  assert.equal(g.characters[1].name.length, MAX_NAME)
})

test('缺 id 时自动补，且不重名冲突', () => {
  const g = normalizeGraph({ characters: [{ name: '甲' }, { name: '乙' }, { name: '丙' }] })
  const ids = g.characters.map(c => c.id)
  assert.equal(new Set(ids).size, 3)
  for (const id of ids) assert.ok(id.length > 0)
})

test('自环关系被丢弃', () => {
  const g = normalizeGraph({
    characters: [{ id: 'a', name: '甲' }],
    relations: [{ from: 'a', to: 'a', type: 'love', strength: 80 }]
  })
  assert.equal(g.relations.length, 0)
})

test('指向不存在角色的关系被丢弃', () => {
  const g = normalizeGraph({
    characters: [{ id: 'a', name: '甲' }],
    relations: [
      { from: 'a', to: 'ghost', type: 'kin' },
      { from: 'ghost', to: 'a', type: 'kin' }
    ]
  })
  assert.equal(g.relations.length, 0)
})

test('同一对人只保留一条关系（正反都算）', () => {
  const g = normalizeGraph({
    characters: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }],
    relations: [
      { from: 'a', to: 'b', type: 'kin', strength: 80 },
      { from: 'b', to: 'a', type: 'kin', strength: 30 },
      { from: 'a', to: 'b', type: 'ally', strength: 50 }
    ]
  })
  assert.equal(g.relations.length, 1)
  assert.equal(g.relations[0].strength, 80, '应该保留先出现的那条')
})

test('未知类型回落到 other', () => {
  const g = normalizeGraph({
    characters: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }],
    relations: [{ from: 'a', to: 'b', type: '不存在的类型', strength: 50 }]
  })
  assert.equal(g.relations[0].type, 'other')
})

test('关联度被夹在 0–100', () => {
  const g = normalizeGraph({
    characters: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }, { id: 'c', name: '丙' }],
    relations: [
      { from: 'a', to: 'b', type: 'kin', strength: 1000 },
      { from: 'a', to: 'c', type: 'kin', strength: -50 }
    ]
  })
  assert.equal(g.relations[0].strength, 100)
  assert.equal(g.relations[1].strength, 0)
})

test('关联度缺失时是 0 而不是 NaN', () => {
  const g = normalizeGraph({
    characters: [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }],
    relations: [{ from: 'a', to: 'b', type: 'kin' }]
  })
  assert.equal(g.relations[0].strength, 0)
  assert.ok(Number.isFinite(g.relations[0].strength))
})

test('容量上限生效', () => {
  const chars = []
  for (let i = 0; i < 120; i++) chars.push({ name: '角色' + i })
  const rels = []
  for (let i = 0; i < 400; i++) rels.push({ from: 'c1', to: 'c2', type: 'kin', strength: 50 })

  const g = normalizeGraph({ characters: chars, relations: rels })
  assert.equal(g.characters.length, MAX_CHARACTERS)
  assert.ok(g.relations.length <= MAX_RELATIONS)
})

test('示例图自洽且幂等', () => {
  const sample = sampleGraph()
  assert.ok(sample.characters.length >= 5)
  assert.ok(sample.relations.length >= 5)

  const ids = new Set(sample.characters.map(c => c.id))
  for (const rel of sample.relations) {
    assert.ok(ids.has(rel.from), '端点不存在：' + rel.from)
    assert.ok(ids.has(rel.to), '端点不存在：' + rel.to)
    assert.notEqual(rel.from, rel.to)
    assert.ok(RELATION_TYPE_IDS.includes(rel.type))
  }

  assert.deepEqual(normalizeGraph(sample), sample, '再规范化一次应该完全不变')
})

test('示例图覆盖全部关系类型', () => {
  const used = new Set(sampleGraph().relations.map(r => r.type))
  const missing = RELATION_TYPE_IDS.filter(id => !used.has(id))
  assert.deepEqual(missing, [], '示例图没覆盖：' + missing.join(', '))
})

test('类型表本身合法', () => {
  assert.equal(new Set(RELATION_TYPE_IDS).size, RELATION_TYPES.length)
  const colors = RELATION_TYPES.map(t => t.color.toLowerCase())
  assert.equal(new Set(colors).size, colors.length, '颜色重复会让类型在图上看不出来')
  for (const t of RELATION_TYPES) {
    assert.ok(t.label.length > 0)
    assert.match(t.color, /^#[0-9a-f]{6}$/i)
  }
})

/* ── 布局几何 ─────────────────────────────────────────────────────────────── */

for (const n of [1, 2, 3, 5, 9, 17, 30, 60]) {
  test(`布局：${n} 个节点`, () => {
    const chars = makeChars(n)
    const rels = makeRels(chars, Math.min(200, n * 4))
    const pos = layoutGraph(chars, rels, W, H)
    const pts = Object.keys(pos).map(k => pos[k])

    assert.equal(pts.length, n, '每个角色都应该有坐标')

    for (const p of pts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), '坐标必须是有限数')
      assert.ok(p.x >= 0 && p.x <= W, 'x 越界：' + p.x)
      assert.ok(p.y >= 0 && p.y <= H, 'y 越界：' + p.y)
    }

    if (n > 1) {
      let minDist = Infinity
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
          if (d < minDist) minDist = d
        }
      }
      assert.ok(minDist > 26, '节点重叠了，最小间距 ' + minDist.toFixed(1) + 'px')
    }

    const again = layoutGraph(chars, rels, W, H)
    assert.deepEqual(again, pos, '同一份数据两次布局应该完全一致')
  })
}

test('布局：单节点居中', () => {
  const pos = layoutGraph([{ id: 'x', name: '孤独' }], [], W, H)
  assert.equal(Math.round(pos.x.x), W / 2)
  assert.equal(Math.round(pos.x.y), H / 2)
})

test('布局：没有关系时也能散开', () => {
  const pos = layoutGraph(makeChars(8), [], W, H)
  assert.equal(Object.keys(pos).length, 8)
})

test('布局：悬空关系不影响结果', () => {
  const pos = layoutGraph(
    [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    [{ id: 'r1', from: 'a', to: 'ghost', type: 'kin', strength: 50 }],
    W, H
  )
  assert.equal(Object.keys(pos).length, 2)
  for (const key of Object.keys(pos)) {
    assert.ok(Number.isFinite(pos[key].x))
  }
})

test('布局：空图返回空对象', () => {
  assert.deepEqual(layoutGraph([], [], W, H), {})
})

test('布局：有关联的节点比没关联的更近', () => {
  /* 这里测的是「关联把节点拉到一起」这件事本身，不是关联度的严格排序。
     关联度的强弱由连线粗细与透明度表达；布局只保证不重叠，
     所以距离有物理下限（两倍节点半径），不能承诺 100 比 0 更近。 */
  const chars = [
    { id: 'a', name: 'A' }, { id: 'b', name: 'B' },
    { id: 'x', name: 'X' }, { id: 'y', name: 'Y' }
  ]
  const linked = layoutGraph(
    chars,
    [{ id: 'r1', from: 'a', to: 'b', type: 'love', strength: 80 }],
    W, H
  )
  const dLinked = Math.hypot(linked.a.x - linked.b.x, linked.a.y - linked.b.y)

  /* 同一批节点，但 a-b 之间没有边 */
  const unlinked = layoutGraph(chars, [], W, H)
  const dUnlinked = Math.hypot(unlinked.a.x - unlinked.b.x, unlinked.a.y - unlinked.b.y)

  assert.ok(
    dLinked < dUnlinked,
    `有边的一对应更近：${dLinked.toFixed(1)} vs ${dUnlinked.toFixed(1)}`
  )
})

test('布局：任何情况下都不重叠（节点直径约 40）', () => {
  for (const n of [4, 12, 40]) {
    const chars = makeChars(n)
    const rels = makeRels(chars, n * 3)
    const pos = layoutGraph(chars, rels, W, H)
    const pts = Object.values(pos)
    let minDist = Infinity
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        minDist = Math.min(minDist, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y))
      }
    }
    assert.ok(minDist >= 26, `${n} 节点时最小间距 ${minDist.toFixed(1)}，节点会压在一起`)
  }
})
