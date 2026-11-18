/* ============================================================================
 * docs-sync.test.mjs — README 与代码一致性
 * ----------------------------------------------------------------------------
 * 这个插件的 README 里写了不少具体事实：接口列表、标签名、配置项、关系类型、
 * 文件路径。文档漂移的代价是「照 README 做却不通」，而那种问题通常要等
 * 用户踩到了才被发现。
 *
 * 所以这里把 README 当成被断言的对象：
 *   - 代码里有的 action，README 必须列出来
 *   - README 列出来的 action，代码必须真的有
 *   - 标签名、关系类型、配置键、文件名、版本号，两边必须一致
 *
 * 零依赖，只用 node:test + node:fs。
 * ========================================================================== */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  RELATION_TYPES,
  RELATION_TYPE_IDS,
  MAX_CHARACTERS,
  MAX_RELATIONS,
  GRAPH_FILE,
  ROLE_PRESETS
} from '../lib/relations.js'
import { DEFAULT_CONFIG, TIP_CATEGORIES, CONFIG_FILE } from '../lib/core.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')
const clientSrc = fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8')
const indexSrc = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

/* ── 接口 ─────────────────────────────────────────────────────────────────── */

/* 从 index.js 的 switch 里抽出所有 case '...' */
function actionsInCode(source) {
  const set = new Set()
  for (const m of source.matchAll(/^\s*case '([a-zA-Z]+)':/gm)) set.add(m[1])
  return set
}

/* 从 README 的接口代码块里抽出所有 action */
function actionsInReadme(markdown) {
  const section = markdown.split('## 接口')[1] || ''
  const block = (section.match(/```json\n([\s\S]*?)```/) || [])[1] || ''
  const set = new Set()
  for (const m of block.matchAll(/"action":\s*"([a-zA-Z]+)"/g)) set.add(m[1])
  return set
}

test('README 列出的每个 action 在代码里都有实现', () => {
  const code = actionsInCode(indexSrc)
  const documented = actionsInReadme(readme)
  assert.ok(documented.size > 0, 'README 的接口块没解析到任何 action')

  const missing = [...documented].filter(name => !code.has(name))
  assert.deepEqual(missing, [], 'README 写了但代码没有：' + missing.join(', '))
})

test('代码里的每个 action 都写进了 README', () => {
  const code = actionsInCode(indexSrc)
  const documented = actionsInReadme(readme)

  const undocumented = [...code].filter(name => !documented.has(name))
  assert.deepEqual(undocumented, [], '代码有但 README 没写：' + undocumented.join(', '))
})

test('接口块里的 JSON 每一行都能解析', () => {
  const section = readme.split('## 接口')[1] || ''
  const block = (section.match(/```json\n([\s\S]*?)```/) || [])[1] || ''
  const lines = block.split('\n').map(line => line.trim()).filter(Boolean)

  assert.ok(lines.length > 0, '接口块是空的')
  for (const line of lines) {
    assert.doesNotThrow(() => JSON.parse(line), '这一行不是合法 JSON：' + line)
  }
})

/* ── 标签页 ───────────────────────────────────────────────────────────────── */

function tabsInCode(source) {
  const block = (source.match(/var TABS = \[([\s\S]*?)\]/) || [])[1] || ''
  return [...block.matchAll(/label: '([^']+)'/g)].map(m => m[1])
}

test('五个标签页的名字与 README 一致', () => {
  const labels = tabsInCode(clientSrc)
  assert.deepEqual(labels, ['创作', '灵感', '大纲', '关系', '我的'])

  /* 只取「五个标签：」到下一个 ## 标题之间的部分，
     否则会把后面「什么时候不该用」的列表也吸进来。 */
  const section = (readme.split('五个标签：')[1] || '').split('\n## ')[0]
  const listed = [...section.matchAll(/^- \*\*([^*]+)\*\*/gm)].map(m => m[1])
  assert.deepEqual(listed, labels, 'README 的标签列表与 TABS 顺序不一致')
})

test('README 开头声明的标签数量与实际一致', () => {
  const declared = /([一二三四五六七八九十\d]+)个标签/.exec(readme)
  assert.ok(declared, 'README 没写「N 个标签」')
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8 }
  const n = map[declared[1]] ?? Number(declared[1])
  assert.equal(n, tabsInCode(clientSrc).length)
})

/* ── 关系类型 ─────────────────────────────────────────────────────────────── */

test('七种关系类型都出现在 README 里', () => {
  for (const type of RELATION_TYPES) {
    assert.ok(
      readme.includes(type.label),
      'README 缺少关系类型：' + type.label
    )
  }
})

test('关系类型 id 唯一且格式规范', () => {
  assert.equal(new Set(RELATION_TYPE_IDS).size, RELATION_TYPE_IDS.length)
  for (const id of RELATION_TYPE_IDS) {
    assert.match(id, /^[a-z]+$/, '类型 id 应该是小写字母：' + id)
  }
  assert.ok(RELATION_TYPE_IDS.includes('other'), '必须有一个兜底类型 other')
})

test('每种关系类型都有独立的十六进制颜色', () => {
  const colors = RELATION_TYPES.map(t => t.color)
  for (const color of colors) assert.match(color, /^#[0-9a-f]{6}$/i)
  assert.equal(new Set(colors.map(c => c.toLowerCase())).size, colors.length, '颜色有重复，图上分不出来')
})

test('README 的接口示例里 type 取值合法', () => {
  const section = readme.split('## 接口')[1] || ''
  const block = (section.match(/```json\n([\s\S]*?)```/) || [])[1] || ''
  for (const m of block.matchAll(/"type":\s*"([a-z]+)"/g)) {
    assert.ok(RELATION_TYPE_IDS.includes(m[1]), '示例里的 type 不在类型表里：' + m[1])
  }
})

/* ── 配置与文件路径 ───────────────────────────────────────────────────────── */

test('README 的配置 JSON 解析后与 DEFAULT_CONFIG 键一致', () => {
  const section = readme.split('## 配置文件')[1] || ''
  const block = (section.match(/```json\n([\s\S]*?)```/) || [])[1] || ''
  const example = JSON.parse(block)

  assert.deepEqual(
    Object.keys(example).sort(),
    Object.keys(DEFAULT_CONFIG).sort(),
    'README 示例的配置项与 DEFAULT_CONFIG 不一致'
  )
})

test('README 写到的配置项类型与默认值一致', () => {
  const section = readme.split('## 配置文件')[1] || ''
  const block = (section.match(/```json\n([\s\S]*?)```/) || [])[1] || ''
  const example = JSON.parse(block)

  assert.equal(typeof example.autoCheckin, typeof DEFAULT_CONFIG.autoCheckin)
  assert.equal(typeof example.checkinHour, typeof DEFAULT_CONFIG.checkinHour)
  assert.equal(typeof example.port, typeof DEFAULT_CONFIG.port)
  assert.equal(typeof example.appPath, typeof DEFAULT_CONFIG.appPath)
})

test('README 提到的文件路径与代码里的常量一致', () => {
  const names = [
    path.basename(CONFIG_FILE),
    path.basename(GRAPH_FILE)
  ]
  for (const name of names) {
    assert.ok(readme.includes(name), 'README 没提到配置文件：' + name)
  }
})

test('关系图容量上限与 README 一致', () => {
  assert.ok(readme.includes(String(MAX_CHARACTERS) + ' 个角色'), 'README 没写角色上限 ' + MAX_CHARACTERS)
  assert.ok(readme.includes(String(MAX_RELATIONS) + ' 条关系'), 'README 没写关系上限 ' + MAX_RELATIONS)
})

/* ── 清单一致性 ───────────────────────────────────────────────────────────── */

test('核心里的写作技巧分类与客户端一致', () => {
  const block = (clientSrc.match(/var TIP_CATEGORIES = \[([\s\S]*?)\]/) || [])[1] || ''
  const clientList = [...block.matchAll(/'([^']+)'/g)].map(m => m[1])
  assert.deepEqual(clientList, TIP_CATEGORIES, 'client.js 与 core.js 的分类列表不一致')
})

test('身份预设出现在客户端的选择器里', () => {
  for (const role of ROLE_PRESETS) {
    assert.ok(ROLE_PRESETS.includes(role))
  }
  assert.ok(
    clientSrc.includes('graph.roles'),
    'client.js 没有使用宿主返回的身份预设列表'
  )
})

/* ── 包清单 ───────────────────────────────────────────────────────────────── */

test('package.json 的 dsh.bundle 指向存在的补丁文件', () => {
  const patch = pkg.dsh?.bundle?.patch
  assert.ok(patch, '缺少 dsh.bundle.patch')
  const full = path.join(ROOT, patch.replace(/^\.\//, ''))
  assert.ok(fs.existsSync(full), '补丁文件不存在：' + patch)
})

test('package.json 没有把官方包写成 dependencies', () => {
  const deps = Object.keys(pkg.dependencies || {})
  const offenders = deps.filter(name => name.startsWith('@deepseek-ai/'))
  assert.deepEqual(offenders, [], '官方包应该在 peerDependencies，不是 dependencies')
})

test('package.json 声明的入口文件都存在', () => {
  assert.ok(fs.existsSync(path.join(ROOT, pkg.main)), 'main 不存在：' + pkg.main)
  const client = pkg.exports?.['./client']
  assert.ok(client, '缺少 ./client 导出')
  assert.ok(fs.existsSync(path.join(ROOT, client.replace(/^\.\//, ''))), '客户端文件不存在')
})

test('package.json 的 repository 指回本仓库', () => {
  const url = pkg.repository?.url || ''
  assert.match(url, /github\.com[:/][^/]+\/dsh-writer-assistant/, 'repository 不指向 dsh-writer-assistant')
})

/* ── 已知失效章节 ─────────────────────────────────────────────────────────── */

test('README 有「什么时候不该用」章节且不是空话', () => {
  const section = readme.split('## 什么时候不该用这个插件')[1] || ''
  assert.ok(section.length > 0, '缺少这一章')

  const bullets = section.split('\n').filter(line => line.startsWith('- **'))
  assert.ok(bullets.length >= 4, '至少列 4 条不该用的情形，现在只有 ' + bullets.length)
})

test('README 有「已知失效与应对」章节并给出自检顺序', () => {
  const section = readme.split('## 已知失效与应对')[1] || ''
  assert.ok(section.length > 0, '缺少这一章')
  assert.ok(/自检的顺序/.test(section), '应该给出升级后的自检顺序')

  const tableRows = section.split('\n').filter(line => /^\| 作家助手|^\| 手机/.test(line))
  assert.ok(tableRows.length > 0, '应该有环境兼容性表格')
})

test('README 记录了验证过的作家助手版本', () => {
  assert.match(readme, /5\.25\.0/, 'README 应该写明验证过的客户端版本')
})

/* ── 自检命令 ─────────────────────────────────────────────────────────────── */

test('README 给出的自检命令与 package.json 一致', () => {
  const scripts = pkg.scripts || {}
  assert.ok(scripts.test, 'package.json 应该有 test 脚本')
  assert.ok(
    readme.includes('node --test') || readme.includes('npm test'),
    'README 应该告诉读者怎么跑自检'
  )
  assert.match(scripts.test, /--test/, 'test 脚本应该用 node --test')
})

test('test 目录里至少有一个测试文件', () => {
  const dir = path.join(ROOT, 'test')
  assert.ok(fs.existsSync(dir), 'test 目录不存在')
  const files = fs.readdirSync(dir).filter(name => name.endsWith('.test.mjs'))
  assert.ok(files.length > 0, 'test 目录里没有 *.test.mjs')
})
