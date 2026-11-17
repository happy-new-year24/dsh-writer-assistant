/* ============================================================================
 * dsh-writer-assistant — 核心连接层
 * ----------------------------------------------------------------------------
 * 通过 Chromium DevTools Protocol 连接本机「作家助手」Electron 客户端。
 * 只监听 127.0.0.1 的调试端口，不读取/保存账号密码，复用客户端自身登录态。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'

export const APP_EXE_DEFAULT = 'D:\\作家助手\\yuewenedit\\program\\yuewenedit.exe'
export const DEBUG_PORT = 9222
export const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
export const CONFIG_FILE = path.join(HOME, 'writer-assistant.json')

export const TIP_CATEGORIES = ['写作技巧', '剧情设计', '人物设定', '开篇创作', '写作雷区', '作品包装', '世界观', '题材指南', '全部']

export const DEFAULT_CONFIG = {
  autoCheckin: true,
  checkinHour: 9,
  lastCheckin: '',
  port: DEBUG_PORT,
  appPath: APP_EXE_DEFAULT
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function readConfig() {
  let raw = {}
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch {
    raw = {}
  }
  const cfg = { ...DEFAULT_CONFIG, ...(raw && typeof raw === 'object' ? raw : {}) }
  cfg.port = Number.isFinite(Number(cfg.port)) ? Number(cfg.port) : DEBUG_PORT
  cfg.checkinHour = Math.min(23, Math.max(0, Number(cfg.checkinHour) || 0))
  cfg.autoCheckin = cfg.autoCheckin !== false
  cfg.appPath = String(cfg.appPath || APP_EXE_DEFAULT)
  cfg.lastCheckin = String(cfg.lastCheckin || '')
  return cfg
}

export function writeConfig(patch = {}) {
  const current = readConfig()
  const next = { ...current, ...(patch && typeof patch === 'object' ? patch : {}) }
  next.port = Math.min(65535, Math.max(1024, Number(next.port) || DEBUG_PORT))
  next.checkinHour = Math.min(23, Math.max(0, Number(next.checkinHour) || 0))
  next.autoCheckin = next.autoCheckin !== false
  next.appPath = String(next.appPath || APP_EXE_DEFAULT)
  next.lastCheckin = String(next.lastCheckin || '')
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8')
  return next
}

function jsString(value) {
  return JSON.stringify(String(value == null ? '' : value))
}

function parseUsage(text) {
  const s = String(text || '').replace(/,/g, '').trim()
  const m = s.match(/([\d.]+)\s*(万|w)?/i)
  if (!m) return 0
  const n = Number(m[1])
  if (!Number.isFinite(n)) return 0
  return Math.round(n * (m[2] ? 10000 : 1))
}

/* ── CDP ─────────────────────────────────────────────────────────────────── */

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.ws = null
    this.nextId = 0
    this.pending = new Map()
  }

  async open() {
    const WS = globalThis.WebSocket
    if (typeof WS !== 'function') {
      throw new Error('当前运行环境没有 WebSocket，无法连接作家助手调试端口')
    }
    this.ws = new WS(this.wsUrl)
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('连接作家助手调试端口超时')), 6000)
      const onOpen = () => { clearTimeout(timer); resolve() }
      const onError = () => { clearTimeout(timer); reject(new Error('连接作家助手调试端口失败')) }
      this.ws.addEventListener('open', onOpen, { once: true })
      this.ws.addEventListener('error', onError, { once: true })
    })
    this.ws.addEventListener('message', async (ev) => {
      let text
      try {
        if (typeof ev.data === 'string') text = ev.data
        else if (ev.data instanceof ArrayBuffer) text = Buffer.from(ev.data).toString('utf8')
        else if (ArrayBuffer.isView(ev.data)) {
          text = Buffer.from(ev.data.buffer, ev.data.byteOffset, ev.data.byteLength).toString('utf8')
        } else if (ev.data && typeof ev.data.text === 'function') text = await ev.data.text()
        else text = String(ev.data)
        const msg = JSON.parse(text)
        if (msg.id && this.pending.has(msg.id)) {
          const entry = this.pending.get(msg.id)
          this.pending.delete(msg.id)
          if (msg.error) entry.reject(new Error(msg.error.message || 'CDP 请求失败'))
          else entry.resolve(msg.result)
        }
      } catch {
        /* 忽略无法解析的调试消息 */
      }
    })
    this.ws.addEventListener('close', () => {
      for (const entry of this.pending.values()) entry.reject(new Error('调试连接已关闭'))
      this.pending.clear()
    })
  }

  send(method, params = {}, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error('调试连接未就绪'))
        return
      }
      const id = ++this.nextId
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`调试请求超时：${method}`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value) },
        reject: error => { clearTimeout(timer); reject(error) }
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression, timeoutMs = 30000) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      timeout: Math.max(1000, timeoutMs - 1000)
    }, timeoutMs)
    if (result && result.exceptionDetails) {
      const detail = result.exceptionDetails
      const desc = detail.exception && detail.exception.description
      throw new Error(desc || detail.text || '页面脚本执行失败')
    }
    return result && result.result ? result.result.value : undefined
  }

  close() {
    try {
      if (this.ws) this.ws.close()
    } catch {
      /* noop */
    }
    this.ws = null
    for (const entry of this.pending.values()) entry.reject(new Error('调试连接已关闭'))
    this.pending.clear()
  }
}

/* ── WriterCore ──────────────────────────────────────────────────────────── */

export class WriterCore {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options }
    this.busy = false
  }

  cfg() {
    return readConfig()
  }

  get port() {
    return this.cfg().port
  }

  get appPath() {
    return this.cfg().appPath
  }

  async listTargets() {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/list`, {
      signal: AbortSignal.timeout(2500)
    })
    if (!res.ok) throw new Error(`调试端口返回 ${res.status}`)
    return await res.json()
  }

  async findTarget(match) {
    try {
      const list = await this.listTargets()
      return list.find(t => t.type === 'page' && `${t.url} ${t.title}`.includes(match)) || null
    } catch {
      return null
    }
  }

  async waitForTarget(match, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const target = await this.findTarget(match)
      if (target) return target
      await sleep(350)
    }
    return null
  }

  async isPortAlive() {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/version`, {
        signal: AbortSignal.timeout(1200)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async isAppRunning() {
    return await new Promise(resolve => {
      execFile('tasklist', ['/FI', 'IMAGENAME eq yuewenedit.exe', '/FO', 'CSV', '/NH'], {
        windowsHide: true,
        timeout: 4000
      }, (error, stdout) => {
        if (error) resolve(false)
        else resolve(String(stdout || '').toLowerCase().includes('yuewenedit.exe'))
      })
    })
  }

  async launch() {
    const cfg = this.cfg()
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    env.AUTHORWRITE_ALLOW_DEBUG_ARGV = '1'
    const child = spawn(cfg.appPath, [`--remote-debugging-port=${cfg.port}`], {
      cwd: path.dirname(cfg.appPath),
      env,
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    })
    child.unref()
  }

  async ensure() {
    if (await this.isPortAlive()) {
      return { connected: true, launched: false }
    }
    const running = await this.isAppRunning()
    if (running) {
      return {
        connected: false,
        appRunning: true,
        needsRestart: true,
        error: 'APP_RUNNING_NO_DEBUG',
        message: '作家助手正在运行，但没有开启调试端口。请先保存工作，再点击「重启并连接」。'
      }
    }
    await this.launch()
    const deadline = Date.now() + 35000
    while (Date.now() < deadline) {
      await sleep(700)
      if (await this.isPortAlive()) {
        return { connected: true, launched: true }
      }
    }
    throw new Error('作家助手启动超时。请手动打开一次，确认能正常进入首页后重试。')
  }

  async ensureMain() {
    const ensured = await this.ensure()
    if (ensured.needsRestart) {
      const err = new Error(ensured.message || 'APP_RUNNING_NO_DEBUG')
      err.code = 'APP_RUNNING_NO_DEBUG'
      err.needsRestart = true
      throw err
    }
    let target = await this.findTarget('renderer/index.html')
    if (!target) {
      /* 主窗口被关掉但进程还在：用第二次启动唤醒它 */
      const env = { ...process.env }
      delete env.ELECTRON_RUN_AS_NODE
      try {
        const child = spawn(this.cfg().appPath, [], {
          cwd: path.dirname(this.cfg().appPath),
          env,
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        })
        child.unref()
      } catch {
        /* noop */
      }
      target = await this.waitForTarget('renderer/index.html', 5000)
    }
    if (!target) throw new Error('找不到作家助手主窗口，请先打开「作家助手」首页。')
    return target
  }

  async evalOn(match, expression, timeoutMs = 30000) {
    const target = typeof match === 'string' ? await this.findTarget(match) : match
    if (!target) throw new Error('找不到目标窗口：' + match)
    const session = new CdpSession(target.webSocketDebuggerUrl)
    await session.open()
    try {
      return await session.evaluate(expression, timeoutMs)
    } finally {
      session.close()
    }
  }

  async evaluateMain(expression, timeoutMs = 30000) {
    await this.ensureMain()
    return await this.evalOn('renderer/index.html', expression, timeoutMs)
  }

  async bringToFront(match) {
    const target = await this.findTarget(match)
    if (!target) return false
    const session = new CdpSession(target.webSocketDebuggerUrl)
    await session.open()
    try {
      await session.send('Page.bringToFront')
      await session.evaluate('window.focus()')
      return true
    } finally {
      session.close()
    }
  }

  async focus() {
    const ok = await this.bringToFront('renderer/index.html')
    if (!ok) return { ok: false, error: '找不到作家助手主窗口' }
    return { ok: true }
  }

  /* ── 状态 ─────────────────────────────────────────────────────────────── */

  async status() {
    const cfg = this.cfg()
    const alive = await this.isPortAlive()
    const running = alive || await this.isAppRunning()
    const base = {
      connected: false,
      appRunning: running,
      needsRestart: false,
      port: cfg.port,
      appPath: cfg.appPath,
      config: cfg,
      today: todayKey()
    }
    if (!alive) {
      return {
        ...base,
        needsRestart: running,
        error: running ? 'APP_RUNNING_NO_DEBUG' : 'APP_NOT_RUNNING',
        message: running
          ? '作家助手在运行，但未开启调试端口。保存工作后可重启连接。'
          : '作家助手尚未启动。'
      }
    }
    try {
      const info = await this.evaluateMain(`(() => {
        const text = document.body.innerText || '';
        const account = (document.querySelector('.userinfo .name') || {}).innerText || '';
        const m = text.match(/做任务赚墨水\\s*\\((\\d+)\\/(\\d+)\\)/);
        const signBtn = Array.from(document.querySelectorAll('button.checkInButton'))
          .find(b => b.offsetParent !== null && (b.innerText || '').trim() === '签到');
        const works = Array.from(document.querySelectorAll('.book_list .item')).map(item => ({
          title: ((item.querySelector('.book_title') || {}).innerText || '').trim(),
          status: ((item.querySelector('.tags') || {}).innerText || '').trim(),
          words: ((item.querySelector('.num_area') || {}).innerText || '').trim(),
          cover: ((item.querySelector('img.cover') || {}).src || '')
        })).filter(x => x.title);
        const ua = navigator.userAgent || '';
        const vm = ua.match(/authorwrite\\/([\\d.]+)/);
        return {
          account,
          taskDone: m ? Number(m[1]) : null,
          taskTotal: m ? Number(m[2]) : null,
          signedToday: !signBtn,
          onBooks: String(location.hash || '').startsWith('#/books'),
          works,
          route: location.hash,
          version: vm ? vm[1] : ''
        };
      })()`)
      return {
        ...base,
        ...info,
        connected: true,
        appRunning: true,
        needsRestart: false,
        config: cfg
      }
    } catch (error) {
      return {
        ...base,
        connected: false,
        appRunning: true,
        error: 'PAGE_EVAL_FAILED',
        message: String(error && error.message || error)
      }
    }
  }

  /* ── 每日签到 ─────────────────────────────────────────────────────────── */

  async checkin() {
    await this.ensureMain()
    const result = await this.evalOn('renderer/index.html', `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      if (!String(location.hash || '').startsWith('#/books')) {
        location.hash = '#/books';
        await sleep(1200);
      }
      const visible = el => !!(el && el.offsetParent !== null && el.getClientRects().length);
      const close = Array.from(document.querySelectorAll('button'))
        .find(b => visible(b) && (b.innerText || '').trim() === '知道了');
      if (close) { close.click(); await sleep(300); }
      const textBefore = document.body.innerText || '';
      const mb = textBefore.match(/做任务赚墨水\\s*\\((\\d+)\\/(\\d+)\\)/);
      const progressBefore = mb ? mb[1] : '';
      const btn = Array.from(document.querySelectorAll('button.checkInButton'))
        .find(b => visible(b) && (b.innerText || '').trim() === '签到');
      if (!btn) {
        return { already: true, progressBefore, progressAfter: progressBefore, message: '今天已经签到过了' };
      }
      btn.click();
      await sleep(2800);
      const textAfter = document.body.innerText || '';
      const ma = textAfter.match(/做任务赚墨水\\s*\\((\\d+)\\/(\\d+)\\)/);
      const progressAfter = ma ? ma[1] : progressBefore;
      const still = Array.from(document.querySelectorAll('button.checkInButton'))
        .some(b => visible(b) && (b.innerText || '').trim() === '签到');
      const toasts = Array.from(document.querySelectorAll('.ant-message-notice,.ant-notification-notice,.ant-modal-root'))
        .filter(visible)
        .map(e => (e.innerText || '').trim())
        .filter(Boolean)
        .slice(0, 4);
      return {
        already: false,
        progressBefore,
        progressAfter,
        still,
        toasts,
        success: Boolean(!still || progressAfter !== progressBefore || toasts.some(t => /签到成功|签到完成|已签到/.test(t)))
      };
    })()`, 30000)
    if (result && result.already) {
      return { ok: true, already: true, message: '今天已经签到过了', ...result }
    }
    if (result && result.success) {
      return { ok: true, already: false, message: '签到成功', ...result }
    }
    return {
      ok: false,
      already: false,
      message: '点击了签到，但没有检测到成功状态。请打开作家助手确认。',
      ...result
    }
  }

  /* ── 大纲模板 ─────────────────────────────────────────────────────────── */

  async ensureTemplate() {
    await this.ensureMain()
    let target = await this.findTarget('templatecenter')
    if (target) return target
    await this.evaluateMain(`(() => {
      const el = Array.from(document.querySelectorAll('*'))
        .find(e => e.children.length === 0 && (e.textContent || '').trim() === '模板中心');
      if (!el) return false;
      const card = el.closest('.template-card') || el;
      card.click();
      return true;
    })()`)
    target = await this.waitForTarget('templatecenter', 10000)
    if (!target) throw new Error('无法打开模板中心，请手动点击一次「模板中心」。')
    return target
  }

  async topOutlines() {
    const target = await this.ensureTemplate()
    const data = await this.evalOn(target, `(() => {
      const cards = Array.from(document.querySelectorAll('.template-list.outline .template-cover-box'));
      const parse = s => {
        const m = String(s || '').replace(/,/g, '').match(/([\\d.]+)\\s*(万|w)?/i);
        if (!m) return 0;
        return Math.round(Number(m[1]) * (m[2] ? 10000 : 1));
      };
      const items = cards.map((card, index) => {
        const title = ((card.querySelector('.title') || {}).innerText || '').trim();
        const text = card.innerText || '';
        const um = text.match(/([\\d.]+\\s*(?:万|w)?)\\s*使用/i);
        const usageText = um ? um[1].replace(/\\s+/g, '') : '';
        const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
        const desc = lines.find(l => l !== title && !/使用$/.test(l) && !/^(新人推荐|专业推荐|征集活动)$/.test(l)) || '';
        return { title, usageText, usage: usageText ? parse(usageText) : 0, desc, index };
      }).filter(x => x.title);
      items.sort((a, b) => b.usage - a.usage);
      return items;
    })()`, 30000)
    const items = Array.isArray(data) ? data : []
    return {
      ok: items.length > 0,
      top: items[0] || null,
      items: items.slice(0, 12),
      url: 'https://pcwrite.yuewen.com/authorh5/templatecenter'
    }
  }

  async closeModals(match) {
    try {
      await this.evalOn(match, `(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 4; i++) {
          const buttons = Array.from(document.querySelectorAll('.ant-modal-close'))
            .filter(b => b.offsetParent !== null);
          if (!buttons.length) break;
          buttons[buttons.length - 1].click();
          await sleep(260);
        }
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await sleep(200);
        return true;
      })()`, 12000)
    } catch {
      /* noop */
    }
  }

  async fillAndSubmit(match, title, synopsis) {
    const expr = `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const visible = el => !!(el && el.offsetParent !== null && el.getClientRects().length);
      const modal = Array.from(document.querySelectorAll('.ant-modal'))
        .find(m => visible(m) && (m.innerText || '').includes('新建私密作品'));
      if (!modal) return { ok: false, error: 'NO_MODAL' };
      const input = modal.querySelector('#privateInput')
        || modal.querySelector('input[placeholder="请输入草稿名称"]')
        || modal.querySelector('input[type="text"]');
      const textarea = modal.querySelector('textarea');
      const set = (el, value) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      };
      if (!input) return { ok: false, error: 'NO_INPUT' };
      set(input, ${jsString(title)});
      if (textarea) set(textarea, ${jsString(synopsis)});
      await sleep(500);
      const btn = Array.from(modal.querySelectorAll('button'))
        .find(b => visible(b) && (b.innerText || '').trim() === '新建私密作品');
      if (!btn) return { ok: false, error: 'NO_SUBMIT' };
      btn.click();
      return { ok: true, title: input.value, synopsis: textarea ? textarea.value : '' };
    })()`
    return await this.evalOn(match, expr, 20000)
  }

  async createDraft(options = {}) {
    await this.ensureMain()
    const title = String(options.title || '').trim().slice(0, 20) || `未命名草稿${todayKey().slice(5)}`
    const synopsis = String(options.synopsis || '').slice(0, 500)
    const useOutline = options.useOutline !== false
    const before = new Set((await this.listTargets()).map(t => t.id))
    let chosen = null

    if (useOutline) {
      const target = await this.ensureTemplate()
      const list = await this.topOutlines()
      chosen = (options.outlineTitle && list.items.find(x => x.title === options.outlineTitle))
        || list.top
      if (!chosen) throw new Error('模板中心里没有解析到大纲模板。')

      await this.closeModals('templatecenter')
      await sleep(400)

      const clicked = await this.evalOn(target, `(() => {
        const cards = Array.from(document.querySelectorAll('.template-list.outline .template-cover-box'));
        const card = cards.find(c => ((c.querySelector('.title') || {}).innerText || '').trim() === ${jsString(chosen.title)});
        if (!card) return false;
        card.click();
        return true;
      })()`, 12000)
      if (!clicked) throw new Error('没有找到大纲卡片：' + chosen.title)
      await sleep(1400)

      const applied = await this.evalOn('templatecenter', `(() => {
        const btn = Array.from(document.querySelectorAll('button'))
          .find(b => b.offsetParent !== null && (b.innerText || '').trim() === '应用于新建书籍');
        if (!btn) return false;
        btn.click();
        return true;
      })()`, 12000)
      if (!applied) throw new Error('没有找到「应用于新建书籍」按钮，模板详情可能还没加载完。')
      await sleep(1400)

      const filled = await this.fillAndSubmit('templatecenter', title, synopsis)
      if (!filled || !filled.ok) throw new Error('新建草稿表单填写失败：' + ((filled && filled.error) || '未知错误'))
      await sleep(500)
    } else {
      await this.ensureMain()
      const opened = await this.evaluateMain(`(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const card = document.querySelector('.create-summary-card');
        if (!card) return false;
        for (const type of ['mouseenter', 'mouseover', 'mousemove']) {
          card.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 300, clientY: 300 }));
        }
        await sleep(700);
        const dropdown = Array.from(document.querySelectorAll('.ant-dropdown'))
          .find(e => e.offsetParent !== null);
        if (!dropdown) return false;
        const item = Array.from(dropdown.querySelectorAll('*'))
          .find(e => e.children.length === 0 && (e.textContent || '').trim() === '私密作品');
        if (!item) return false;
        (item.closest('li,div,button,a') || item).click();
        return true;
      })()`, 15000)
      if (!opened) throw new Error('没有打开「新建 → 私密作品」菜单。')
      await sleep(1000)
      const filled = await this.fillAndSubmit('renderer/index.html', title, synopsis)
      if (!filled || !filled.ok) throw new Error('新建草稿表单填写失败：' + ((filled && filled.error) || '未知错误'))
      await sleep(500)
    }

    let created = null
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      await sleep(500)
      try {
        const list = await this.listTargets()
        const fresh = list.filter(t => !before.has(t.id))
        created = fresh.find(t => /creation\.html#\/outline\/(\d+)/.test(t.url) || /write\.html#\/chapter\/(\d+)/.test(t.url)) || null
        if (created) break
      } catch {
        /* 页面切换时调试端口可能短暂抖动 */
      }
    }

    let bookId = ''
    if (created) {
      const m = created.url.match(/(?:outline|chapter)\/(\d+)/)
      if (m) bookId = m[1]
    }

    if (useOutline) await this.closeModals('templatecenter')

    return {
      ok: true,
      title,
      bookId,
      outline: chosen ? chosen.title : null,
      outlineUsage: chosen ? chosen.usageText : null,
      url: created ? created.url : null
    }
  }

  /* ── 写作技巧 / 阅创学堂 ─────────────────────────────────────────────── */

  async ensureSchool() {
    await this.ensureMain()
    let target = await this.findTarget('write.qq.com/portal/article')
    if (target) return target
    await this.evaluateMain(`(() => {
      const el = Array.from(document.querySelectorAll('.items'))
        .find(e => (e.innerText || '').trim() === '阅创学堂');
      if (!el) return false;
      el.click();
      return true;
    })()`)
    target = await this.waitForTarget('write.qq.com/portal/article', 10000)
    if (!target) throw new Error('无法打开阅创学堂，请手动点击一次侧边栏的「阅创学堂」。')
    return target
  }

  async listTips(category = '写作技巧') {
    const target = await this.ensureSchool()
    const cat = TIP_CATEGORIES.includes(category) ? category : '写作技巧'
    if (cat !== '全部') {
      const url = 'https://write.qq.com/portal/article?page=1&filterType=1&label1=' + encodeURIComponent(cat)
      const session = new CdpSession(target.webSocketDebuggerUrl)
      await session.open()
      try {
        await session.send('Page.navigate', { url })
      } finally {
        session.close()
      }
      await sleep(2200)
    }
    const data = await this.evalOn('write.qq.com/portal/article', `(() => {
      const groups = new Map();
      document.querySelectorAll('a[href*="/portal/content/"]').forEach(a => {
        const url = String(a.href || '').split('?')[0];
        if (!url) return;
        const text = (a.innerText || '').trim();
        if (text.length < 4) return;
        const g = groups.get(url) || { url, texts: [] };
        g.texts.push(text);
        groups.set(url, g);
      });
      const seen = new Set();
      const items = [];
      for (const g of groups.values()) {
        const texts = Array.from(new Set(g.texts)).sort((a, b) => a.length - b.length);
        const title = texts.find(t => t.length >= 4 && t.length <= 80) || texts[0] || '';
        const summary = texts.filter(t => t.length > title.length).sort((a, b) => b.length - a.length)[0] || '';
        if (!title || seen.has(title)) continue;
        seen.add(title);
        items.push({ title, summary: summary.slice(0, 180), url: g.url });
      }
      return {
        items: items.slice(0, 12),
        url: location.href,
        categories: ${JSON.stringify(TIP_CATEGORIES)}
      };
    })()`, 30000)
    return { ok: true, category: cat, ...(data || { items: [] }) }
  }

  async openTip(url) {
    const safe = String(url || '')
    if (!/^https:\/\/write\.qq\.com\/portal\/content\//.test(safe)) {
      throw new Error('只允许打开阅创学堂文章链接')
    }
    const target = await this.ensureSchool()
    const session = new CdpSession(target.webSocketDebuggerUrl)
    await session.open()
    try {
      await session.send('Page.navigate', { url: safe })
      await session.send('Page.bringToFront')
    } finally {
      session.close()
    }
    return { ok: true, url: safe }
  }

  /* ── 作品与功能入口 ───────────────────────────────────────────────────── */

  async listWorks() {
    await this.ensureMain()
    const works = await this.evaluateMain(`(() => Array.from(document.querySelectorAll('.book_list .item')).map(item => ({
      title: ((item.querySelector('.book_title') || {}).innerText || '').trim(),
      status: ((item.querySelector('.tags') || {}).innerText || '').trim(),
      words: ((item.querySelector('.num_area') || {}).innerText || '').trim(),
      cover: ((item.querySelector('img.cover') || {}).src || '')
    })).filter(x => x.title))()`)
    return { ok: true, items: Array.isArray(works) ? works : [] }
  }

  async openWork(title) {
    await this.ensureMain()
    const ok = await this.evaluateMain(`(() => {
      const want = ${jsString(title)};
      const item = Array.from(document.querySelectorAll('.book_list .item'))
        .find(i => ((i.querySelector('.book_title') || {}).innerText || '').trim() === want);
      if (!item) return false;
      item.click();
      return true;
    })()`, 12000)
    return { ok: Boolean(ok) }
  }

  async openFeature(label) {
    const name = String(label || '').trim()
    if (!name) throw new Error('缺少功能名称')
    if (name === '模板中心') {
      await this.ensureTemplate()
      await this.bringToFront('templatecenter')
      return { ok: true, label: name, external: true }
    }
    await this.ensureMain()
    const ok = await this.evaluateMain(`(() => {
      const want = ${jsString(name)};
      const el = Array.from(document.querySelectorAll('.items'))
        .find(e => (e.innerText || '').trim() === want);
      if (!el) return false;
      el.click();
      return true;
    })()`, 12000)
    await sleep(1200)
    if (name === '阅创学堂') {
      await this.bringToFront('write.qq.com/portal/article')
    } else {
      await this.bringToFront('renderer/index.html')
    }
    return { ok: Boolean(ok), label: name }
  }

  /* ── 配置与自动签到 ───────────────────────────────────────────────────── */

  async restart() {
    await new Promise(resolve => {
      execFile('taskkill', ['/IM', 'yuewenedit.exe', '/T'], { windowsHide: true, timeout: 6000 }, () => resolve())
    })
    const deadline = Date.now() + 12000
    while (Date.now() < deadline) {
      if (!(await this.isAppRunning())) break
      await sleep(500)
    }
    if (await this.isAppRunning()) {
      return { ok: false, error: 'APP_STILL_RUNNING', message: '作家助手没有退出，请手动关闭后再试。' }
    }
    await this.launch()
    const portDeadline = Date.now() + 35000
    while (Date.now() < portDeadline) {
      await sleep(700)
      if (await this.isPortAlive()) {
        return { ok: true, message: '已重启并连接' }
      }
    }
    return { ok: false, error: 'PORT_TIMEOUT', message: '重启后没有等到调试端口。' }
  }

  async maybeAutoCheckin() {
    const cfg = this.cfg()
    if (!cfg.autoCheckin) return { skipped: 'disabled' }
    const now = new Date()
    if (now.getHours() < cfg.checkinHour) return { skipped: 'before-hour' }
    if (cfg.lastCheckin === todayKey(now)) return { skipped: 'done' }
    if (this.busy) return { skipped: 'busy' }
    this.busy = true
    try {
      const res = await this.checkin()
      if (res && (res.ok || res.already)) {
        writeConfig({ lastCheckin: todayKey(now) })
      }
      return res
    } catch (error) {
      return { ok: false, error: String(error && error.message || error) }
    } finally {
      this.busy = false
    }
  }
}
