/* ============================================================================
 * dsh-writer-assistant — Client 半侧
 * ----------------------------------------------------------------------------
 * 在 DSH 主区注册「作家助手」面板，在侧边栏注册入口。
 * 四个标签：创作 / 灵感 / 大纲 / 我的。
 * 纯手工 bundle：不依赖构建，window.__ModuleLoader__.load 直接注册。
 * ========================================================================== */

window.__ModuleLoader__.load({
  id: 'dsh-writer-assistant',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef

    var CSS = `
.wa-root {
  --wa-text: var(--dsw-alias-label-primary, #141e29);
  --wa-muted: var(--dsw-alias-label-secondary, rgba(20, 30, 41, .62));
  --wa-faint: var(--dsw-alias-label-tertiary, rgba(20, 30, 41, .42));
  --wa-bg: var(--dsw-alias-bg-base, #ffffff);
  --wa-layer: var(--dsw-alias-bg-layer-1, #f7f8fa);
  --wa-layer2: var(--dsw-alias-bg-layer-2, #eef0f4);
  --wa-overlay: var(--dsw-alias-bg-overlay, #ffffff);
  --wa-border: var(--dsw-alias-border-l1, rgba(20, 30, 41, .10));
  --wa-border2: var(--dsw-alias-border-l2, rgba(20, 30, 41, .16));
  --wa-brand: var(--dsw-alias-brand-primary, #4d6bfe);
  --wa-brand-soft: color-mix(in srgb, var(--wa-brand) 12%, transparent);
  --wa-danger: var(--dsw-alias-state-error-primary, #d64545);
  --wa-success: var(--dsw-alias-state-success-primary, #1f9d63);
  --wa-warn: var(--dsw-alias-state-warn-primary, #b7791f);
  box-sizing: border-box;
  height: 100%;
  min-height: 100%;
  overflow-y: auto;
  padding: 24px 28px 48px;
  color: var(--wa-text);
  font-size: 13px;
  line-height: 1.55;
  background: var(--wa-bg);
}
.wa-root * { box-sizing: border-box; }
.wa-root button, .wa-root input, .wa-root textarea, .wa-root select { font: inherit; color: inherit; }
.wa-inner { width: 100%; max-width: 1060px; margin: 0 auto; }
.wa-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
.wa-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.wa-logo {
  width: 40px; height: 40px; border-radius: 12px; flex: 0 0 auto;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--wa-brand), color-mix(in srgb, var(--wa-brand) 55%, #8a5cff));
  color: #fff; font-size: 19px; font-weight: 700; letter-spacing: -1px;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--wa-brand) 28%, transparent);
}
.wa-title { font-size: 17px; font-weight: 650; letter-spacing: .2px; }
.wa-sub { color: var(--wa-muted); font-size: 12px; margin-top: 1px; }
.wa-head-actions { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.wa-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border-radius: 999px; font-size: 11.5px; font-weight: 600;
  border: 1px solid var(--wa-border); background: var(--wa-layer); color: var(--wa-muted);
}
.wa-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .8; }
.wa-pill.is-on { color: var(--wa-success); border-color: color-mix(in srgb, var(--wa-success) 28%, var(--wa-border)); background: color-mix(in srgb, var(--wa-success) 8%, transparent); }
.wa-pill.is-off { color: var(--wa-faint); }
.wa-tabs {
  display: inline-flex; gap: 4px; padding: 4px; margin-bottom: 16px;
  background: var(--wa-layer); border: 1px solid var(--wa-border); border-radius: 12px;
}
.wa-tab {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  padding: 7px 18px; border-radius: 9px; color: var(--wa-muted);
  font-size: 13px; font-weight: 550; transition: background .16s, color .16s, box-shadow .16s;
}
.wa-tab:hover { color: var(--wa-text); }
.wa-tab.is-active { background: var(--wa-overlay); color: var(--wa-text); box-shadow: 0 1px 4px rgba(20,30,41,.10); }
.wa-count { margin-left: 6px; font-size: 11px; color: var(--wa-faint); }
.wa-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 14px; align-items: start; }
.wa-stack { display: grid; gap: 14px; }
.wa-span2 { grid-column: 1 / -1; }
.wa-card {
  background: var(--wa-layer); border: 1px solid var(--wa-border);
  border-radius: 14px; padding: 16px 17px;
  animation: wa-in .22s ease both;
}
@keyframes wa-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
.wa-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.wa-card-head h3 { margin: 0; font-size: 14px; font-weight: 650; letter-spacing: .1px; }
.wa-muted { color: var(--wa-muted); font-size: 12px; }
.wa-hint { color: var(--wa-faint); font-size: 11.5px; line-height: 1.6; margin-top: 10px; }
.wa-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.wa-grow { flex: 1 1 auto; }
.wa-btn {
  appearance: none; border: 1px solid transparent; cursor: pointer;
  padding: 7px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 600;
  transition: filter .15s, background .15s, border-color .15s, opacity .15s;
  white-space: nowrap;
}
.wa-btn:disabled { opacity: .48; cursor: not-allowed; }
.wa-btn-primary { background: var(--wa-brand); color: #fff; box-shadow: 0 4px 12px color-mix(in srgb, var(--wa-brand) 22%, transparent); }
.wa-btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.wa-btn-ghost { background: var(--wa-overlay); border-color: var(--wa-border); color: var(--wa-text); }
.wa-btn-ghost:hover:not(:disabled) { border-color: var(--wa-border2); background: var(--wa-layer2); }
.wa-btn-danger { background: var(--wa-danger); color: #fff; }
.wa-btn-danger-ghost { background: transparent; border-color: color-mix(in srgb, var(--wa-danger) 32%, var(--wa-border)); color: var(--wa-danger); }
.wa-link {
  appearance: none; border: 0; background: none; padding: 0; cursor: pointer;
  color: var(--wa-brand); font-size: 12px; font-weight: 550;
}
.wa-link:hover { text-decoration: underline; }
.wa-field { display: grid; gap: 6px; margin-bottom: 11px; }
.wa-field > span { color: var(--wa-muted); font-size: 11.5px; font-weight: 550; }
.wa-field.inline { grid-template-columns: auto 132px; align-items: center; margin-bottom: 10px; }
.wa-input, .wa-textarea, .wa-select {
  width: 100%; background: var(--wa-overlay); border: 1px solid var(--wa-border);
  border-radius: 9px; padding: 8px 10px; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.wa-input:focus, .wa-textarea:focus, .wa-select:focus {
  border-color: color-mix(in srgb, var(--wa-brand) 55%, var(--wa-border));
  box-shadow: 0 0 0 3px var(--wa-brand-soft);
}
.wa-textarea { resize: vertical; min-height: 68px; line-height: 1.55; }
.wa-check { display: flex; align-items: flex-start; gap: 8px; margin: 2px 0 13px; color: var(--wa-text); font-size: 12.5px; cursor: pointer; }
.wa-check input { margin-top: 2px; accent-color: var(--wa-brand); }
.wa-check em { font-style: normal; color: var(--wa-brand); font-weight: 600; }
.wa-work-list { display: grid; gap: 7px; max-height: 390px; overflow-y: auto; padding-right: 2px; }
.wa-work {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  background: var(--wa-overlay); border: 1px solid var(--wa-border);
  border-radius: 10px; padding: 8px; cursor: pointer;
  transition: border-color .15s, transform .15s, box-shadow .15s;
}
.wa-work:hover { border-color: color-mix(in srgb, var(--wa-brand) 40%, var(--wa-border)); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(20,30,41,.06); }
.wa-cover { width: 36px; height: 48px; border-radius: 5px; object-fit: cover; background: var(--wa-layer2); flex: 0 0 auto; }
.wa-work-info { min-width: 0; }
.wa-work-title { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wa-empty {
  padding: 26px 12px; text-align: center; color: var(--wa-faint);
  border: 1px dashed var(--wa-border); border-radius: 10px; font-size: 12px;
}
.wa-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
  padding: 13px 15px; margin-bottom: 15px;
  border: 1px solid color-mix(in srgb, var(--wa-warn) 28%, var(--wa-border));
  background: color-mix(in srgb, var(--wa-warn) 7%, var(--wa-layer));
  border-radius: 12px;
}
.wa-banner.is-danger { border-color: color-mix(in srgb, var(--wa-danger) 30%, var(--wa-border)); background: color-mix(in srgb, var(--wa-danger) 6%, var(--wa-layer)); }
.wa-banner b { font-size: 12.5px; }
.wa-confirm {
  margin-top: 10px; padding: 10px 12px; border-radius: 9px;
  background: color-mix(in srgb, var(--wa-danger) 7%, var(--wa-overlay));
  border: 1px solid color-mix(in srgb, var(--wa-danger) 26%, var(--wa-border));
}
.wa-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.wa-chip {
  appearance: none; border: 1px solid var(--wa-border); background: var(--wa-overlay);
  color: var(--wa-muted); border-radius: 999px; padding: 4px 10px;
  font-size: 11.5px; cursor: pointer; transition: all .15s;
}
.wa-chip:hover { color: var(--wa-text); border-color: var(--wa-border2); }
.wa-chip.is-active { background: var(--wa-brand-soft); border-color: color-mix(in srgb, var(--wa-brand) 42%, var(--wa-border)); color: var(--wa-brand); font-weight: 600; }
.wa-tips { display: grid; gap: 9px; max-height: 560px; overflow-y: auto; padding-right: 2px; }
.wa-tip {
  display: flex; gap: 10px; padding: 11px 12px;
  background: var(--wa-overlay); border: 1px solid var(--wa-border); border-radius: 10px;
}
.wa-tip-no { color: var(--wa-faint); font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; padding-top: 1px; }
.wa-tip-body { min-width: 0; }
.wa-tip-body h4 { margin: 0 0 4px; font-size: 12.8px; font-weight: 650; line-height: 1.5; }
.wa-tip-body p { margin: 0 0 7px; color: var(--wa-muted); font-size: 11.8px; line-height: 1.65; }
.wa-idea { background: linear-gradient(135deg, color-mix(in srgb, var(--wa-brand) 9%, var(--wa-layer)), var(--wa-layer)); }
.wa-idea-text { font-size: 14px; line-height: 1.75; font-weight: 550; margin: 4px 0 8px; }
.wa-top-outline { position: relative; overflow: hidden; border-color: color-mix(in srgb, var(--wa-brand) 32%, var(--wa-border)); background: linear-gradient(135deg, color-mix(in srgb, var(--wa-brand) 10%, var(--wa-layer)), var(--wa-layer) 68%); }
.wa-top-outline h3 { margin: 8px 0 2px; font-size: 20px; letter-spacing: .3px; }
.wa-top-outline p { margin: 8px 0 14px; color: var(--wa-muted); font-size: 12.5px; }
.wa-top-badge {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px;
  border-radius: 999px; background: var(--wa-brand); color: #fff;
  font-size: 10.5px; font-weight: 700; letter-spacing: .4px;
}
.wa-usage { color: var(--wa-brand); font-size: 12.5px; font-weight: 700; }
.wa-outline-list { display: grid; gap: 6px; }
.wa-outline {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; background: var(--wa-overlay); border: 1px solid var(--wa-border); border-radius: 9px;
}
.wa-outline-rank { width: 20px; color: var(--wa-faint); font-size: 11px; font-weight: 700; text-align: center; flex: 0 0 auto; }
.wa-outline-main { min-width: 0; flex: 1 1 auto; }
.wa-outline-title { font-size: 12.5px; font-weight: 600; }
.wa-outline-usage { color: var(--wa-brand); font-size: 12px; font-weight: 650; flex: 0 0 auto; }
.wa-profile { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.wa-avatar {
  width: 46px; height: 46px; border-radius: 14px; flex: 0 0 auto;
  display: grid; place-items: center; color: #fff; font-size: 20px; font-weight: 700;
  background: linear-gradient(135deg, var(--wa-brand), color-mix(in srgb, var(--wa-brand) 50%, #8a5cff));
}
.wa-profile-name { font-size: 15px; font-weight: 650; }
.wa-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
.wa-stat { background: var(--wa-overlay); border: 1px solid var(--wa-border); border-radius: 10px; padding: 9px 10px; }
.wa-stat b { display: block; font-size: 14px; font-weight: 700; }
.wa-stat span { color: var(--wa-muted); font-size: 11px; }
.wa-switch { display: flex; align-items: center; gap: 8px; font-size: 12.5px; margin-bottom: 12px; cursor: pointer; }
.wa-switch input { accent-color: var(--wa-brand); }
.wa-features { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 7px; }
.wa-feature {
  appearance: none; border: 1px solid var(--wa-border); background: var(--wa-overlay);
  border-radius: 9px; padding: 9px 10px; cursor: pointer; text-align: left;
  font-size: 12px; transition: all .15s;
}
.wa-feature:hover:not(:disabled) { border-color: color-mix(in srgb, var(--wa-brand) 38%, var(--wa-border)); background: var(--wa-brand-soft); color: var(--wa-brand); }
.wa-feature:disabled { opacity: .45; cursor: not-allowed; }
.wa-kv { display: grid; gap: 5px; margin-bottom: 12px; }
.wa-kv-row { display: flex; gap: 10px; font-size: 11.8px; }
.wa-kv-row span:first-child { color: var(--wa-muted); width: 72px; flex: 0 0 auto; }
.wa-kv-row span:last-child { color: var(--wa-text); word-break: break-all; }
.wa-toast {
  position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
  z-index: 2147483000; max-width: min(560px, 86vw);
  padding: 9px 14px; border-radius: 10px; color: #fff; font-size: 12.5px;
  background: rgba(20, 30, 41, .92); box-shadow: 0 8px 28px rgba(0,0,0,.22);
  animation: wa-toast .18s ease both;
}
.wa-toast.is-success { background: color-mix(in srgb, var(--wa-success) 88%, #000); }
.wa-toast.is-error { background: color-mix(in srgb, var(--wa-danger) 88%, #000); }
.wa-toast.is-warn { background: color-mix(in srgb, var(--wa-warn) 88%, #000); }
@keyframes wa-toast { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
.wa-center { display: grid; place-items: center; gap: 10px; height: 100%; }
.wa-spinner {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--wa-border2); border-top-color: var(--wa-brand);
  animation: wa-spin .7s linear infinite;
}
@keyframes wa-spin { to { transform: rotate(360deg); } }
@media (max-width: 820px) {
  .wa-root { padding: 18px 16px 36px; }
  .wa-grid { grid-template-columns: 1fr; }
  .wa-span2 { grid-column: auto; }
  .wa-head { align-items: flex-start; }
  .wa-tabs { display: flex; width: 100%; }
  .wa-tab { flex: 1 1 0; padding: 7px 6px; }
  .wa-banner { align-items: flex-start; flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .wa-card, .wa-toast, .wa-spinner { animation: none; }
}
`

    /* 只注入一次样式；HMR 重载时不会堆叠。 */
    try {
      if (typeof document !== 'undefined' && !document.getElementById('dsh-writer-assistant-css')) {
        var style = document.createElement('style')
        style.id = 'dsh-writer-assistant-css'
        style.textContent = CSS
        document.head.appendChild(style)
      }
    } catch (error) {
      /* 样式失败不影响功能 */
    }

    var TABS = [
      { id: 'create', label: '创作' },
      { id: 'inspiration', label: '灵感' },
      { id: 'outline', label: '大纲' },
      { id: 'mine', label: '我的' }
    ]

    var TIP_CATEGORIES = ['写作技巧', '剧情设计', '人物设定', '开篇创作', '写作雷区', '作品包装', '世界观', '题材指南', '全部']
    var FEATURES = ['任务中心', '墨水商店', '消息通知', '码字统计', '码字好友', '神助社区', '邀请卡', '装扮中心', '阅创学堂', '模板中心']

    var IDEA_GENRES = ['都市异能', '玄幻修仙', '科幻末世', '悬疑推理', '古代权谋', '校园青春', '无限流', '克苏鲁']
    var IDEA_HOOKS = [
      '主角每天醒来都会忘记一个人，直到忘记的人开始反过来找他',
      '全城只有主角能听见动物说话，而动物们正在策划一场逃亡',
      '主角得到一本写谁谁就倒霉的日记，却发现最后一页写着自己的名字',
      '主角靠直播修复古物，却总收到来自古人的打赏和感谢',
      '反派每次都在主角必死时出手相救，直到主角发现反派才是真正的受害者',
      '主角能看见别人的“剩余寿命”，却看见自己的寿命是无限',
      '主角穿越成书里第一章就死的炮灰，唯一金手指是知道所有配角的心声'
    ]
    var IDEA_TWISTS = [
      '但每次使用能力，都会有一个陌生人替他承担代价。',
      '而真相是，这个世界已经循环了很多次，只有主角记得。',
      '直到某天，他发现一直帮助自己的系统，其实是上一个自己的残念。',
      '可越接近真相，他越不确定自己到底是不是“主角”。',
      '代价是，他每改变一次命运，就会失去一段最重要的记忆。'
    ]

    function pick(list) {
      return list[Math.floor(Math.random() * list.length)]
    }

    function randomIdea() {
      return '一个' + pick(IDEA_GENRES) + '故事：' + pick(IDEA_HOOKS) + '。' + pick(IDEA_TWISTS)
    }

    function monthDay() {
      var d = new Date()
      return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
    }

    async function callApi(action, payload) {
      var body = Object.assign({}, payload || {}, { action: action })
      var res = await fetch('/writer-assistant/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      var json = null
      try {
        json = await res.json()
      } catch (error) {
        throw new Error('作家助手返回了无法解析的内容（HTTP ' + res.status + '）')
      }
      if (!json || json.ok !== true) {
        var message = (json && (json.error || json.message)) || ('请求失败（HTTP ' + res.status + '）')
        var err = new Error(message)
        err.payload = json
        throw err
      }
      return json.data
    }

    function Btn(props) {
      var variant = props.variant || 'ghost'
      return h('button', {
        type: 'button',
        className: 'wa-btn wa-btn-' + variant,
        disabled: props.disabled,
        onClick: props.onClick
      }, props.children)
    }

    function Icon(props) {
      var size = (props && props.size) || 20
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true'
      },
        h('path', {
          d: 'M4.5 19.5c3.6-.7 6.4-2.2 8.4-4.2l4.8-4.8a2.6 2.6 0 0 0-3.7-3.7l-4.8 4.8c-2 2-3.5 4.8-4.7 7.9Z',
          stroke: 'currentColor',
          strokeWidth: '1.6',
          strokeLinejoin: 'round'
        }),
        h('path', {
          d: 'M13.5 6.5l4 4',
          stroke: 'currentColor',
          strokeWidth: '1.6',
          strokeLinecap: 'round'
        })
      )
    }

    function Panel() {
      var tabState = useState('create')
      var tab = tabState[0]
      var setTab = tabState[1]

      var statusState = useState(null)
      var status = statusState[0]
      var setStatus = statusState[1]

      var worksState = useState([])
      var works = worksState[0]
      var setWorks = worksState[1]

      var outlinesState = useState({ ok: false, top: null, items: [] })
      var outlines = outlinesState[0]
      var setOutlines = outlinesState[1]

      var tipsState = useState([])
      var tips = tipsState[0]
      var setTips = tipsState[1]

      var tipCategoryState = useState('写作技巧')
      var tipCategory = tipCategoryState[0]
      var setTipCategory = tipCategoryState[1]

      var loadedState = useState({ works: false, outlines: false, tips: false })
      var loaded = loadedState[0]
      var setLoaded = loadedState[1]

      var busyState = useState('')
      var busy = busyState[0]
      var setBusy = busyState[1]
      var busyRef = useRef(false)

      var toastState = useState(null)
      var toast = toastState[0]
      var setToast = toastState[1]
      var toastTimer = useRef(null)

      var draftTitleState = useState('')
      var draftTitle = draftTitleState[0]
      var setDraftTitle = draftTitleState[1]

      var draftSynopsisState = useState('')
      var draftSynopsis = draftSynopsisState[0]
      var setDraftSynopsis = draftSynopsisState[1]

      var useOutlineState = useState(true)
      var useOutline = useOutlineState[0]
      var setUseOutline = useOutlineState[1]

      var confirmRestartState = useState(false)
      var confirmRestart = confirmRestartState[0]
      var setConfirmRestart = confirmRestartState[1]

      var ideaState = useState(randomIdea())
      var idea = ideaState[0]
      var setIdea = ideaState[1]

      function showToast(message, kind) {
        setToast({ message: message, kind: kind || 'info' })
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(function () { setToast(null) }, 4600)
      }

      async function run(key, fn) {
        if (busyRef.current) {
          showToast('正在处理上一个操作，请稍等…', 'warn')
          return
        }
        busyRef.current = true
        setBusy(key)
        try {
          await fn()
        } catch (error) {
          showToast(String((error && error.message) || error || '操作失败'), 'error')
        } finally {
          busyRef.current = false
          setBusy('')
        }
      }

      async function refreshStatus() {
        var next = await callApi('status')
        setStatus(next)
        return next
      }

      async function loadWorks() {
        var result = await callApi('listWorks')
        setWorks((result && result.items) || [])
        setLoaded(function (prev) { return Object.assign({}, prev, { works: true }) })
      }

      async function loadOutlines() {
        var result = await callApi('topOutlines')
        setOutlines(result || { ok: false, top: null, items: [] })
        setLoaded(function (prev) { return Object.assign({}, prev, { outlines: true }) })
      }

      async function loadTips(category) {
        var result = await callApi('listTips', { category: category || tipCategory })
        setTips((result && result.items) || [])
        setTipCategory((result && result.category) || category || tipCategory)
        setLoaded(function (prev) { return Object.assign({}, prev, { tips: true }) })
      }

      useEffect(function () {
        var alive = true
        ;(async function () {
          try {
            var next = await callApi('status')
            if (!alive) return
            setStatus(next)
            if (next && next.connected) {
              loadWorks().catch(function () {})
            }
          } catch (error) {
            if (alive) {
              setStatus({
                connected: false,
                appRunning: false,
                message: String((error && error.message) || error)
              })
            }
          }
        })()
        return function () { alive = false }
      }, [])

      useEffect(function () {
        var timer = setInterval(function () {
          callApi('status').then(function (next) { setStatus(next) }).catch(function () {})
        }, 60000)
        return function () { clearInterval(timer) }
      }, [])

      useEffect(function () {
        return function () {
          if (toastTimer.current) clearTimeout(toastTimer.current)
        }
      }, [])

      var connected = Boolean(status && status.connected)

      function selectTab(id) {
        setTab(id)
        if (!connected) return
        if (id === 'create' && !loaded.works) {
          run('works', loadWorks)
        } else if (id === 'inspiration' && !loaded.tips) {
          run('tips', function () { return loadTips(tipCategory) })
        } else if (id === 'outline' && !loaded.outlines) {
          run('outlines', loadOutlines)
        }
      }

      function handleConnect() {
        run('connect', async function () {
          var next = await callApi('connect')
          if (next && next.connected) {
            setStatus(next)
            showToast('已连接作家助手', 'success')
            try { await loadWorks() } catch (error) { /* 列表失败不影响连接 */ }
            return
          }
          if (next && next.needsRestart) {
            setStatus(next)
            showToast(next.message || '需要重启作家助手才能连接', 'warn')
            return
          }
          setStatus(next || { connected: false })
          showToast((next && next.message) || '还没有连接上，请再试一次', 'warn')
        })
      }

      function handleRestart() {
        setConfirmRestart(false)
        run('restart', async function () {
          var result = await callApi('restart')
          if (!result || !result.ok) {
            showToast((result && result.message) || '重启失败，请手动关闭作家助手后再试', 'error')
            return
          }
          showToast('已重启并连接', 'success')
          var next = await callApi('status')
          setStatus(next)
          try { await loadWorks() } catch (error) { /* noop */ }
        })
      }

      function handleCheckin() {
        run('checkin', async function () {
          var result = await callApi('checkin')
          if (result && result.already) {
            showToast('今天已经签到过了，无需重复签到', 'info')
          } else if (result && result.ok) {
            var extra = result.progressAfter ? ' · 任务进度 ' + result.progressAfter : ''
            showToast('签到成功' + extra, 'success')
          } else {
            showToast((result && result.message) || '签到没有生效，请打开作家助手确认', 'error')
          }
          var next = await callApi('status')
          setStatus(next)
        })
      }

      function handleCreate() {
        run('create', async function () {
          var result = await callApi('createDraft', {
            title: draftTitle.trim(),
            synopsis: draftSynopsis.trim(),
            useOutline: useOutline
          })
          if (!result) throw new Error('创建草稿没有返回结果')
          showToast(
            '已创建《' + result.title + '》' + (result.outline ? ' · 大纲「' + result.outline + '」' : ''),
            'success'
          )
          setDraftTitle('')
          setDraftSynopsis('')
          try { await loadWorks() } catch (error) { /* noop */ }
        })
      }

      function handleCreateWithOutline(outlineTitle) {
        run('create', async function () {
          var title = draftTitle.trim() || ('大纲草稿' + monthDay())
          var result = await callApi('createDraft', {
            title: title,
            synopsis: draftSynopsis.trim(),
            useOutline: true,
            outlineTitle: outlineTitle
          })
          if (!result) throw new Error('创建草稿没有返回结果')
          showToast(
            '已创建《' + result.title + '》 · 大纲「' + (result.outline || outlineTitle) + '」',
            'success'
          )
          setDraftTitle('')
          setDraftSynopsis('')
          setTab('create')
          try { await loadWorks() } catch (error) { /* noop */ }
        })
      }

      function handleOpenTip(url) {
        run('tip', async function () {
          var result = await callApi('openTip', { url: url })
          if (result && result.ok) showToast('已在作家助手中打开文章', 'success')
          else showToast('打开文章失败', 'error')
        })
      }

      function handleOpenFeature(label) {
        run('feature:' + label, async function () {
          var result = await callApi('openFeature', { label: label })
          if (result && result.ok) showToast('已打开「' + label + '」', 'success')
          else showToast('没有找到「' + label + '」入口', 'error')
        })
      }

      function handleOpenWork(title) {
        run('work', async function () {
          var result = await callApi('openWork', { title: title })
          if (result && result.ok) showToast('正在打开《' + title + '》', 'success')
          else showToast('没有找到《' + title + '》', 'error')
        })
      }

      function handleFocus() {
        callApi('focus').catch(function () {})
      }

      function handleToggleAuto(event) {
        var next = Boolean(event.target.checked)
        run('config', async function () {
          var result = await callApi('setConfig', { patch: { autoCheckin: next } })
          setStatus(function (prev) {
            return Object.assign({}, prev, { config: (result && result.config) || (prev && prev.config) })
          })
          showToast(next ? '已开启每日自动签到' : '已关闭每日自动签到', 'success')
        })
      }

      function handleHour(event) {
        var hour = Number(event.target.value)
        run('config', async function () {
          var result = await callApi('setConfig', { patch: { checkinHour: hour } })
          setStatus(function (prev) {
            return Object.assign({}, prev, { config: (result && result.config) || (prev && prev.config) })
          })
          showToast('自动签到时间已改为 ' + String(hour).padStart(2, '0') + ':00', 'success')
        })
      }

      if (!status) {
        return h('div', { className: 'wa-root' },
          h('div', { className: 'wa-center' },
            h('div', { className: 'wa-spinner' }),
            h('div', { className: 'wa-muted' }, '正在读取作家助手状态…')
          )
        )
      }

      var connectionBanner = !connected ? h('div', { className: 'wa-banner' + (status.needsRestart ? ' is-danger' : '') },
        h('div', {},
          h('b', {}, status.needsRestart ? '需要重启才能连接' : '还没有连接作家助手'),
          h('div', { className: 'wa-muted' }, status.message || '启动本机作家助手后，就能在这里签到、建草稿、看大纲和写作技巧。')
        ),
        h('div', { className: 'wa-row' },
          h(Btn, { variant: 'primary', onClick: handleConnect, disabled: busy === 'connect' }, busy === 'connect' ? '正在启动…' : '启动并连接'),
          status.needsRestart ? h(Btn, { variant: 'danger', onClick: function () { setConfirmRestart(true) } }, '重启并连接') : null
        )
      ) : null

      var restartConfirm = confirmRestart ? h('div', { className: 'wa-confirm' },
        h('div', { className: 'wa-muted' }, '重启会关闭作家助手。如果正文/大纲还没保存，请先回作家助手保存。确认现在重启吗？'),
        h('div', { className: 'wa-row', style: { marginTop: '9px' } },
          h(Btn, { variant: 'danger', onClick: handleRestart, disabled: busy === 'restart' }, busy === 'restart' ? '正在重启…' : '确认重启'),
          h(Btn, { variant: 'ghost', onClick: function () { setConfirmRestart(false) } }, '取消')
        )
      ) : null

      var createTab = h('div', { className: 'wa-grid' },
        h('section', { className: 'wa-card' },
          h('div', { className: 'wa-card-head' },
            h('h3', {}, '新建草稿'),
            h('span', { className: 'wa-muted' }, '直接写进作家助手')
          ),
          h('label', { className: 'wa-field' },
            h('span', {}, '作品名'),
            h('input', {
              className: 'wa-input',
              value: draftTitle,
              maxLength: 20,
              placeholder: '不填则自动命名',
              onChange: function (event) { setDraftTitle(event.target.value) }
            })
          ),
          h('label', { className: 'wa-field' },
            h('span', {}, '作品简介'),
            h('textarea', {
              className: 'wa-textarea',
              value: draftSynopsis,
              maxLength: 500,
              rows: 3,
              placeholder: '选填',
              onChange: function (event) { setDraftSynopsis(event.target.value) }
            })
          ),
          h('label', { className: 'wa-check' },
            h('input', {
              type: 'checkbox',
              checked: useOutline,
              onChange: function (event) { setUseOutline(event.target.checked) }
            }),
            h('span', {},
              '使用目前使用量最高的大纲',
              outlines.top
                ? h('em', {}, '「' + outlines.top.title + '」' + (outlines.top.usageText ? ' · ' + outlines.top.usageText + ' 使用' : ''))
                : h('em', {}, '（点「大纲」标签读取）')
            )
          ),
          h('div', { className: 'wa-row' },
            h(Btn, { variant: 'primary', onClick: handleCreate, disabled: Boolean(busy) }, busy === 'create' ? '正在创建…' : '创建草稿'),
            h(Btn, { variant: 'ghost', onClick: handleFocus }, '打开作家助手')
          ),
          h('div', { className: 'wa-hint' }, '勾选大纲会打开模板中心，自动挑使用量最高的总纲，再新建私密作品；不勾选则创建空白私密作品。')
        ),
        h('section', { className: 'wa-card' },
          h('div', { className: 'wa-card-head' },
            h('h3', {}, '我的作品'),
            h('button', { className: 'wa-link', onClick: function () { run('works', loadWorks) } }, '刷新')
          ),
          works.length
            ? h('div', { className: 'wa-work-list' }, works.map(function (work, index) {
                return h('button', {
                  key: work.title + index,
                  className: 'wa-work',
                  onClick: function () { handleOpenWork(work.title) }
                },
                  h('img', { className: 'wa-cover', src: work.cover, alt: '' }),
                  h('div', { className: 'wa-work-info' },
                    h('div', { className: 'wa-work-title' }, work.title),
                    h('div', { className: 'wa-muted' }, [work.status, work.words].filter(Boolean).join(' · ') || '私密作品')
                  )
                )
              }))
            : h('div', { className: 'wa-empty' }, connected ? '还没有作品，或列表尚未加载。' : '连接后显示作品列表。')
        )
      )

      var inspirationTab = h('div', { className: 'wa-stack' },
        h('section', { className: 'wa-card wa-idea' },
          h('div', { className: 'wa-card-head' },
            h('h3', {}, '灵感抽签'),
            h('button', { className: 'wa-link', onClick: function () { setIdea(randomIdea()) } }, '换一个')
          ),
          h('div', { className: 'wa-idea-text' }, idea),
          h('div', { className: 'wa-muted' }, '从题材、钩子、反转里随机组合，先写起来再打磨。')
        ),
        h('section', { className: 'wa-card' },
          h('div', { className: 'wa-card-head' },
            h('h3', {}, '写作技巧'),
            h('button', { className: 'wa-link', onClick: function () { run('tips', function () { return loadTips(tipCategory) }) } }, '刷新')
          ),
          h('div', { className: 'wa-chips' }, TIP_CATEGORIES.map(function (category) {
            return h('button', {
              key: category,
              className: 'wa-chip' + (tipCategory === category ? ' is-active' : ''),
              onClick: function () { run('tips', function () { return loadTips(category) }) }
            }, category)
          })),
          tips.length
            ? h('div', { className: 'wa-tips' }, tips.map(function (tip, index) {
                return h('article', { className: 'wa-tip', key: tip.url + index },
                  h('div', { className: 'wa-tip-no' }, String(index + 1).padStart(2, '0')),
                  h('div', { className: 'wa-tip-body' },
                    h('h4', {}, tip.title),
                    h('p', {}, tip.summary || '打开文章查看全文。'),
                    h('button', { className: 'wa-link', onClick: function () { handleOpenTip(tip.url) } }, '在作家助手中阅读 →')
                  )
                )
              }))
            : h('div', { className: 'wa-empty' }, busy === 'tips' ? '正在读取阅创学堂…' : connected ? '还没有读取到文章，点「刷新」试试。' : '连接后读取写作技巧。')
        )
      )

      var outlineTab = h('div', { className: 'wa-stack' },
        outlines.top
          ? h('section', { className: 'wa-card wa-top-outline' },
              h('div', { className: 'wa-top-badge' }, '#1 使用量最高'),
              h('h3', {}, outlines.top.title),
              h('div', { className: 'wa-usage' }, (outlines.top.usageText || '—') + ' 使用'),
              h('p', {}, outlines.top.desc || '模板中心当前使用量最高的总纲。'),
              h('div', { className: 'wa-row' },
                h(Btn, { variant: 'primary', onClick: function () { handleCreateWithOutline(outlines.top.title) }, disabled: Boolean(busy) }, busy === 'create' ? '正在创建…' : '用此大纲新建草稿'),
                h(Btn, { variant: 'ghost', onClick: function () { handleOpenFeature('模板中心') } }, '打开模板中心')
              ),
              h('div', { className: 'wa-hint' }, '会使用「' + outlines.top.title + '」新建一本私密作品；作品名默认用「大纲草稿' + monthDay() + '」，也可以先在「创作」里填好名字。')
            )
          : h('section', { className: 'wa-card' },
              h('div', { className: 'wa-card-head' },
                h('h3', {}, '最高使用大纲'),
                h('button', { className: 'wa-link', onClick: function () { run('outlines', loadOutlines) } }, '读取')
              ),
              h('div', { className: 'wa-empty' }, busy === 'outlines' ? '正在读取模板中心…' : '连接后读取模板中心的使用量排行。')
            ),
        h('section', { className: 'wa-card' },
          h('div', { className: 'wa-card-head' },
            h('h3', {}, '总纲使用量排行'),
            h('button', { className: 'wa-link', onClick: function () { run('outlines', loadOutlines) } }, '刷新')
          ),
          outlines.items && outlines.items.length
            ? h('div', { className: 'wa-outline-list' }, outlines.items.map(function (outline, index) {
                return h('div', { className: 'wa-outline', key: outline.title + index },
                  h('div', { className: 'wa-outline-rank' }, index + 1),
                  h('div', { className: 'wa-outline-main' },
                    h('div', { className: 'wa-outline-title' }, outline.title),
                    h('div', { className: 'wa-muted' }, outline.desc || '')
                  ),
                  h('div', { className: 'wa-outline-usage' }, outline.usageText || '—'),
                  h('button', { className: 'wa-link', onClick: function () { handleCreateWithOutline(outline.title) } }, '用此新建')
                )
              }))
            : h('div', { className: 'wa-empty' }, '暂无数据。')
        )
      )

      var mineTab = h('div', { className: 'wa-grid' },
        h('section', { className: 'wa-card' },
          h('div', { className: 'wa-profile' },
            h('div', { className: 'wa-avatar' }, (status.account || '作').slice(0, 1)),
            h('div', {},
              h('div', { className: 'wa-profile-name' }, status.account || '未连接'),
              h('div', { className: 'wa-muted' }, status.version ? '作家助手 ' + status.version : '本机客户端')
            )
          ),
          h('div', { className: 'wa-stats' },
            h('div', { className: 'wa-stat' },
              h('b', {}, status.signedToday ? '已签到' : (status.onBooks === false ? '—' : '未签到')),
              h('span', {}, '今日签到')
            ),
            h('div', { className: 'wa-stat' },
              h('b', {}, status.taskDone == null ? '—' : status.taskDone + '/' + status.taskTotal),
              h('span', {}, '任务进度')
            ),
            h('div', { className: 'wa-stat' },
              h('b', {}, status.config && status.config.autoCheckin ? '开' : '关'),
              h('span', {}, '每日自动')
            )
          ),
          h('div', { className: 'wa-row' },
            h(Btn, { variant: 'primary', onClick: handleCheckin, disabled: Boolean(busy) || !connected }, busy === 'checkin' ? '签到中…' : '立即签到'),
            h(Btn, { variant: 'ghost', onClick: handleFocus, disabled: !connected }, '打开作家助手')
          )
        ),
        h('section', { className: 'wa-card' },
          h('div', { className: 'wa-card-head' }, h('h3', {}, '每日自动签到')),
          h('label', { className: 'wa-switch' },
            h('input', {
              type: 'checkbox',
              checked: Boolean(status.config && status.config.autoCheckin),
              onChange: handleToggleAuto,
              disabled: !connected
            }),
            h('span', {}, '开启（DSH 运行时生效）')
          ),
          h('label', { className: 'wa-field inline' },
            h('span', {}, '执行时间'),
            h('select', {
              className: 'wa-select',
              value: status.config ? status.config.checkinHour : 9,
              onChange: handleHour,
              disabled: !connected
            }, [8, 9, 10, 12, 20].map(function (hour) {
              return h('option', { key: hour, value: hour }, String(hour).padStart(2, '0') + ':00')
            }))
          ),
          h('div', { className: 'wa-hint' }, '到点后如果作家助手没开，会自动启动它；今天已签到则跳过。签到只点「签到」，不会点「补签」。')
        ),
        h('section', { className: 'wa-card wa-span2' },
          h('div', { className: 'wa-card-head' }, h('h3', {}, '全部功能')),
          h('div', { className: 'wa-features' }, FEATURES.map(function (label) {
            return h('button', {
              key: label,
              className: 'wa-feature',
              onClick: function () { handleOpenFeature(label) },
              disabled: !connected
            }, label)
          }))
        ),
        h('section', { className: 'wa-card wa-span2' },
          h('div', { className: 'wa-card-head' }, h('h3', {}, '连接信息')),
          h('div', { className: 'wa-kv' },
            h('div', { className: 'wa-kv-row' }, h('span', {}, '状态'), h('span', {}, connected ? '已连接' : '未连接')),
            h('div', { className: 'wa-kv-row' }, h('span', {}, '调试端口'), h('span', {}, '127.0.0.1:' + (status.port || 9222))),
            h('div', { className: 'wa-kv-row' }, h('span', {}, '客户端'), h('span', {}, status.appPath || 'D:\\作家助手\\yuewenedit\\program\\yuewenedit.exe')),
            h('div', { className: 'wa-kv-row' }, h('span', {}, '当前页面'), h('span', {}, status.route || '—'))
          ),
          h('div', { className: 'wa-row' },
            h(Btn, { variant: 'ghost', onClick: function () { run('status', refreshStatus) } }, '刷新状态'),
            h(Btn, { variant: 'danger-ghost', onClick: function () { setConfirmRestart(true) }, disabled: !connected }, '重启并连接')
          ),
          restartConfirm
        )
      )

      var content = tab === 'create' ? createTab : tab === 'inspiration' ? inspirationTab : tab === 'outline' ? outlineTab : mineTab

      return h('div', { className: 'wa-root' },
        h('div', { className: 'wa-inner' },
          h('div', { className: 'wa-head' },
            h('div', { className: 'wa-brand' },
              h('div', { className: 'wa-logo' }, '作'),
              h('div', {},
                h('div', { className: 'wa-title' }, '作家助手'),
                h('div', { className: 'wa-sub' }, connected ? '已连接 · ' + (status.account || '本机账号') : '连接你的本地作家助手')
              )
            ),
            h('div', { className: 'wa-head-actions' },
              h('span', { className: 'wa-pill ' + (connected ? 'is-on' : 'is-off') }, connected ? '已连接' : '未连接'),
              h('button', { className: 'wa-btn wa-btn-ghost', onClick: function () { run('status', refreshStatus) }, disabled: busy === 'status' }, busy === 'status' ? '刷新中…' : '刷新')
            )
          ),
          connectionBanner,
          h('div', { className: 'wa-tabs' }, TABS.map(function (item) {
            return h('button', {
              key: item.id,
              className: 'wa-tab' + (tab === item.id ? ' is-active' : ''),
              onClick: function () { selectTab(item.id) }
            }, item.label, item.id === 'create' && works.length
              ? h('span', { className: 'wa-count' }, works.length)
              : null)
          })),
          content,
          toast ? h('div', { className: 'wa-toast is-' + toast.kind }, toast.message) : null
        )
      )
    }

    function apply(ctx) {
      ctx.slots.inject('main', function () {
        return ctx.slots.register({
          name: 'main',
          key: 'writer-assistant'
        }, function () {
          return h(Panel)
        })
      })

      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'writer-assistant',
          order: 21,
          label: '作家助手'
        }, function (props) {
          return h(Icon, { size: props && props.size })
        })
      })
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  }
})
