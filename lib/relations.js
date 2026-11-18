/* ============================================================================
 * dsh-writer-assistant — 角色关系图数据层
 * ----------------------------------------------------------------------------
 * 纯本地数据，不需要连接作家助手也能用：
 *   ~/.dsh/writer-assistant-relations.json
 *
 * 设计上刻意保持「文件即数据」：
 *   - 一个 JSON，人可以直接打开改、git 可以版本化；
 *   - 没有数据库、没有迁移脚本；
 *   - 写坏了大不了删掉这个文件，插件会重建空图。
 *
 * 数据形状：
 *   {
 *     version: 1,
 *     characters: [{ id, name, role, note }],
 *     relations:  [{ id, from, to, type, strength, note }]
 *   }
 *   from / to 是 character 的 id；strength 是 0–100 的关联度。
 * ========================================================================== */

import fs from 'node:fs'
import path from 'node:path'
import { HOME } from './core.js'

export const GRAPH_FILE = path.join(HOME, 'writer-assistant-relations.json')

/* 关系类型与配色。颜色写死而不是用主题变量：
   关系图靠颜色区分类型，跟着主题漂移就失去意义了。
   这几个色在浅色和深色底上都能分辨，且不依赖 RGB 之外的假设。 */
export const RELATION_TYPES = [
  { id: 'kin', label: '亲缘', color: '#c98a2b' },
  { id: 'love', label: '情感', color: '#d6538a' },
  { id: 'foe', label: '敌对', color: '#d64545' },
  { id: 'mentor', label: '师徒', color: '#4d6bfe' },
  { id: 'ally', label: '盟友', color: '#1f9d63' },
  { id: 'rank', label: '上下级', color: '#8a5cff' },
  { id: 'other', label: '其他', color: '#7a8699' }
]

export const RELATION_TYPE_IDS = RELATION_TYPES.map(item => item.id)

export const ROLE_PRESETS = ['主角', '女主', '男主', '反派', '配角', '导师', '路人']

export const MAX_CHARACTERS = 60
export const MAX_RELATIONS = 200
export const MAX_NAME = 20
export const MAX_NOTE = 120

const DEFAULT_GRAPH = { version: 1, characters: [], relations: [] }

function text(value, limit) {
  const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim()
  return s.length > limit ? s.slice(0, limit) : s
}

function slugId(prefix, index) {
  return prefix + (index + 1)
}

/* 统一整理成可渲染、可存储的规范形状。
   宁可静默丢弃坏条目也不抛错：这个文件是给人手改的，不能因为
   多打一个逗号就让整个面板打不开。 */
export function normalizeGraph(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const rawChars = Array.isArray(src.characters) ? src.characters : []
  const rawRels = Array.isArray(src.relations) ? src.relations : []

  const seenIds = new Set()
  const seenNames = new Set()
  const characters = []

  for (const item of rawChars) {
    if (characters.length >= MAX_CHARACTERS) break
    const name = text(item && item.name, MAX_NAME)
    if (!name) continue
    const key = name.toLowerCase()
    if (seenNames.has(key)) continue
    seenNames.add(key)
    let id = text(item && item.id, 40) || slugId('c', characters.length)
    if (seenIds.has(id)) id = slugId('c', characters.length)
    seenIds.add(id)
    characters.push({
      id,
      name,
      role: text(item && item.role, MAX_NAME),
      note: text(item && item.note, MAX_NOTE)
    })
  }

  const byId = new Map(characters.map(item => [item.id, item]))
  const seenPairs = new Set()
  const relations = []

  for (const item of rawRels) {
    if (relations.length >= MAX_RELATIONS) break
    const from = text(item && item.from, 40)
    const to = text(item && item.to, 40)
    if (!from || !to || from === to) continue
    if (!byId.has(from) || !byId.has(to)) continue
    const type = RELATION_TYPE_IDS.includes(item && item.type) ? item.type : 'other'
    /* 同一对人只保留一条主关系；多类型会给布局和配色都带来歧义。
       要记多个层次的羁绊，写在 note 里。 */
    const pair = [from, to].sort().join('\u0000') + '\u0000' + type
    const undirected = [from, to].sort().join('\u0000')
    if (seenPairs.has(pair) || seenPairs.has(undirected)) continue
    seenPairs.add(pair)
    seenPairs.add(undirected)
    const strength = Math.round(Math.min(100, Math.max(0, Number(item && item.strength) || 0)))
    let id = text(item && item.id, 40) || slugId('r', relations.length)
    relations.push({ id, from, to, type, strength, note: text(item && item.note, MAX_NOTE) })
  }

  return { version: 1, characters, relations }
}

export function readGraph() {
  let raw = null
  try {
    raw = JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf8'))
  } catch {
    raw = null
  }
  return normalizeGraph(raw || DEFAULT_GRAPH)
}

export function writeGraph(raw) {
  const next = normalizeGraph(raw)
  fs.mkdirSync(path.dirname(GRAPH_FILE), { recursive: true })
  fs.writeFileSync(GRAPH_FILE, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/* 一份可以直接看的示例，用来验证布局与配色。
   只有当用户主动点「载入示例」时才会写进去，不会自动覆盖空图。 */
export function sampleGraph() {
  const characters = [
    { id: 'c1', name: '沈未晞', role: '主角', note: '能听见器物说话' },
    { id: 'c2', name: '陆停云', role: '男主', note: '断剑宗弃徒' },
    { id: 'c3', name: '白鹭洲', role: '女主', note: '鉴宝阁掌柜' },
    { id: 'c4', name: '董不语', role: '反派', note: '暗中操纵古物行市' },
    { id: 'c5', name: '沈砚', role: '配角', note: '主角生父，已亡' },
    { id: 'c6', name: '云深处', role: '导师', note: '传授器语之术' },
    { id: 'c7', name: '柳三娘', role: '配角', note: '情报贩子' }
  ]
  const relations = [
    { id: 'r1', from: 'c1', to: 'c5', type: 'kin', strength: 90, note: '父子，主线谜题起点' },
    { id: 'r2', from: 'c1', to: 'c2', type: 'love', strength: 75, note: '并肩但互有隐瞒' },
    { id: 'r3', from: 'c2', to: 'c3', type: 'love', strength: 40, note: '旧识，立场对立' },
    { id: 'r4', from: 'c1', to: 'c4', type: 'foe', strength: 95, note: '杀父之仇，贯穿全书' },
    { id: 'r5', from: 'c1', to: 'c6', type: 'mentor', strength: 70, note: '器语启蒙' },
    { id: 'r6', from: 'c6', to: 'c4', type: 'foe', strength: 55, note: '当年逐出师门的旧账' },
    { id: 'r7', from: 'c1', to: 'c7', type: 'ally', strength: 45, note: '情报交易' },
    { id: 'r8', from: 'c4', to: 'c7', type: 'rank', strength: 60, note: '柳三娘受其钳制' },
    { id: 'r9', from: 'c2', to: 'c6', type: 'ally', strength: 35, note: '共同护送主角' },
    /* 「其他」也要有一条，否则图例里那一项永远没有样例可对照 */
    { id: 'r10', from: 'c5', to: 'c4', type: 'other', strength: 25, note: '生前有过一笔说不清的往来' }
  ]
  return normalizeGraph({ version: 1, characters, relations })
}
