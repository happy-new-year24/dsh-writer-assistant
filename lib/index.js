/* ============================================================================
 * dsh-writer-assistant — Host 半侧
 * ----------------------------------------------------------------------------
 * 职责：
 *   1) 暴露 /writer-assistant/api：状态、连接/重启、每日签到、作品列表、
 *      新建草稿、最高使用大纲、阅创学堂写作技巧、功能入口。
 *   2) 每天在设定时间之后自动签到一次（需要 DSH 处于运行状态）。
 *   3) 配置持久化到 ~/.dsh/writer-assistant.json，面板里可以改。
 *
 * 刻意不做：
 *   - 不保存账号、密码、Cookie；
 *   - 不监听 0.0.0.0，只连 127.0.0.1:9222；
 *   - 不在未确认的情况下强杀正在写作的进程；重启需要面板里二次确认。
 * ========================================================================== */

import { WriterCore, readConfig, writeConfig, todayKey } from './core.js'
import {
  readGraph,
  writeGraph,
  sampleGraph,
  RELATION_TYPES,
  RELATION_TYPE_IDS,
  ROLE_PRESETS
} from './relations.js'

const NS = 'dsh-writer-assistant'
const ROUTE_BASE = '/writer-assistant'

const core = new WriterCore()
let disposed = false
let timer = null
let initialTimer = null
let dailyTimer = null
let armDailyRef = null

function resolveWebServer(ctx) {
  try {
    const viaGet = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
    if (viaGet) return viaGet
  } catch {
    /* 取不到就当没有 */
  }
  return ctx.webServer
}

function hasRoutes(server) {
  return !!server && typeof server.register === 'function'
}

function normalizePatch(patch) {
  const src = patch && typeof patch === 'object' ? patch : {}
  const out = {}
  if ('autoCheckin' in src) out.autoCheckin = src.autoCheckin === true || src.autoCheckin === 'true'
  if ('checkinHour' in src) {
    const n = Number(src.checkinHour)
    if (Number.isFinite(n)) out.checkinHour = Math.min(23, Math.max(0, Math.round(n)))
  }
  if ('port' in src) {
    const n = Number(src.port)
    if (Number.isFinite(n) && n >= 1024 && n <= 65535) out.port = Math.round(n)
  }
  if ('appPath' in src && String(src.appPath || '').trim()) {
    out.appPath = String(src.appPath).trim()
  }
  return out
}

function apply(ctx) {
  const webServer = resolveWebServer(ctx)
  if (!hasRoutes(webServer)) {
    try {
      ctx.logger?.warn?.(
        `[${NS}] 当前 profile 没有可用的 webServer；Host 半侧不注册路由。` +
        `请确认 DSH 以 web/desktop 方式启动。`
      )
    } catch {
      /* noop */
    }
    return
  }

  function rejected(req, res) {
    try {
      const conn = (typeof ctx.get === 'function' ? ctx.get('connection') : undefined) || ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch {
      return false
    }
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 256 * 1024) {
    return new Promise(resolve => {
      let size = 0
      const chunks = []
      req.on('data', chunk => {
        size += chunk.length
        if (size > limit) {
          req.destroy()
          resolve('')
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  function errorPayload(error) {
    return {
      ok: false,
      error: String((error && error.message) || error || '未知错误'),
      code: (error && error.code) || '',
      needsRestart: Boolean(error && error.needsRestart)
    }
  }

  async function handleAction(action, payload) {
    switch (action) {
      case 'status':
        return await core.status()

      case 'connect': {
        const ensured = await core.ensure()
        if (ensured.needsRestart) {
          return { ok: false, ...ensured }
        }
        return await core.status()
      }

      case 'restart':
        return await core.restart()

      case 'checkin': {
        const result = await core.checkin()
        if (result && (result.ok || result.already)) {
          writeConfig({ lastCheckin: todayKey() })
        }
        return result
      }

      case 'listWorks':
        return await core.listWorks()

      case 'openWork':
        return await core.openWork(payload.title)

      case 'topOutlines':
        return await core.topOutlines()

      case 'createDraft':
        return await core.createDraft({
          title: payload.title,
          synopsis: payload.synopsis,
          useOutline: payload.useOutline,
          outlineTitle: payload.outlineTitle
        })

      case 'listTips':
        return await core.listTips(payload.category)

      case 'openTip':
        return await core.openTip(payload.url)

      case 'openFeature':
        return await core.openFeature(payload.label)

      case 'focus':
        return await core.focus()

      case 'getConfig':
        return { ok: true, config: readConfig(), today: todayKey() }

      /* ── 角色关系图 ──────────────────────────────────────────────────────
         纯本地数据，不需要连上作家助手。前端每次都拿全量图，
         改动后整图回写——比逐个增删接口简单，也不会出现半更新状态。 */
      case 'getGraph':
        return {
          ok: true,
          graph: readGraph(),
          types: RELATION_TYPES,
          roles: ROLE_PRESETS
        }

      case 'saveGraph': {
        const graph = writeGraph(payload.graph || payload)
        return { ok: true, graph, types: RELATION_TYPES }
      }

      case 'loadSampleGraph':
        return { ok: true, graph: writeGraph(sampleGraph()), types: RELATION_TYPES }

      case 'clearGraph':
        return { ok: true, graph: writeGraph({ version: 1, characters: [], relations: [] }) }

      case 'setConfig': {
        const patch = normalizePatch(payload.patch || payload.config || payload)
        const config = writeConfig(patch)
        try { armDailyRef?.() } catch { /* noop */ }
        return { ok: true, config }
      }

      case 'runAutomation': {
        const result = await core.maybeAutoCheckin()
        return { ok: true, result, config: readConfig(), today: todayKey() }
      }

      case 'openConfigFolder':
        return { ok: false, error: '请在「我的」里直接修改设置。' }

      default:
        return { ok: false, error: '未知操作：' + String(action || '') }
    }
  }

  const disposeRoute = webServer.register({
    kind: 'exact',
    path: ROUTE_BASE + '/api',
    handler: async (req, res) => {
      if (rejected(req, res)) return
      const method = String(req.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      let action = ''
      let payload = {}
      if (method === 'GET') {
        try {
          const url = new URL(req.url || '/', 'http://127.0.0.1')
          action = url.searchParams.get('action') || ''
        } catch {
          action = ''
        }
      } else {
        const text = await readBody(req)
        try {
          payload = text ? JSON.parse(text) : {}
        } catch {
          sendJson(res, 400, { ok: false, error: 'invalid json' })
          return
        }
        action = String(payload.action || '')
      }
      if (!action) {
        sendJson(res, 400, { ok: false, error: 'missing action' })
        return
      }
      try {
        const data = await handleAction(action, payload || {})
        sendJson(res, 200, { ok: true, data })
      } catch (error) {
        sendJson(res, 200, errorPayload(error))
      }
    }
  })

  /* 自动签到：启动 20 秒后先检查一次；之后每天在设定时间附近再检查一次，
     另外保留 30 分钟轮询兜底（比如到点时 DSH 还没启动，或签到失败要重试）。
     只有到了设定时间、今天还没签到、且当前没有其它操作时才动。 */
  async function tick() {
    if (disposed) return
    try {
      const result = await core.maybeAutoCheckin()
      if (result && !result.skipped) {
        try {
          ctx.logger?.info?.(`[${NS}] 自动签到：${JSON.stringify(result).slice(0, 500)}`)
        } catch {
          /* noop */
        }
      }
    } catch (error) {
      try {
        ctx.logger?.warn?.(`[${NS}] 自动签到失败：${String((error && error.message) || error)}`)
      } catch {
        /* noop */
      }
    }
  }

  function delayToNext(hour) {
    const now = new Date()
    const cfg = readConfig()
    const next = new Date(now)
    next.setHours(hour, 0, 30, 0)
    if (next.getTime() <= now.getTime()) {
      if (cfg.lastCheckin !== todayKey(now) && now.getHours() >= hour) return 5000
      next.setDate(next.getDate() + 1)
    }
    return Math.max(1000, next.getTime() - now.getTime())
  }

  function armDaily() {
    if (disposed) return
    if (dailyTimer) clearTimeout(dailyTimer)
    const cfg = readConfig()
    if (!cfg.autoCheckin) return
    dailyTimer = setTimeout(async () => {
      await tick()
      armDaily()
    }, delayToNext(cfg.checkinHour))
    try { dailyTimer.unref?.() } catch { /* noop */ }
  }

  armDailyRef = armDaily
  initialTimer = setTimeout(tick, 20000)
  timer = setInterval(tick, 30 * 60 * 1000)
  try { initialTimer.unref?.() } catch { /* noop */ }
  try { timer.unref?.() } catch { /* noop */ }
  armDaily()

  ctx.effect(() => () => {
    disposed = true
    if (initialTimer) clearTimeout(initialTimer)
    if (timer) clearInterval(timer)
    if (dailyTimer) clearTimeout(dailyTimer)
    try { disposeRoute?.() } catch { /* noop */ }
  })

  try {
    ctx.logger?.info?.(
      `[${NS}] 已加载：${ROUTE_BASE}/api · 调试端口 ${readConfig().port} · ` +
      `自动签到 ${readConfig().autoCheckin ? readConfig().checkinHour + ':00' : '关闭'}`
    )
  } catch {
    /* noop */
  }
}

export { apply }
export const name = NS
export const inject = ['webServer', 'connection']
