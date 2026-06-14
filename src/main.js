import './style.css'
import * as echarts from 'echarts'
import { CHINESE_COMPANIES } from './chinese-companies.js'

const DATA_FILE = '/data/all_kernel_contribute_data_20260614.csv'

// ===== Tab 状态 =====
let currentTab = 'all'  // 'all' | 'cn'
let currentVersion = ''  // 当前选中的版本

// ===== 状态 =====
let rawData = []        // 原始 CSV 行
let versions = new Map() // version -> [{contributor, value, percentage}]
let chart = null

// ===== DOM 引用 =====
const $ = (sel) => document.querySelector(sel)
const versionSelect = $('#version-bar')  // 横向标签栏
const topNInput = $('#top-n')
const chartDom = $('#chart')
const tableBody = $('#table-body')
const statTotal = $('#stat-total')
const statCompanies = $('#stat-companies')

// ===== 数据加载 (Web Worker 解析 CSV，主线程不卡) =====
async function loadData() {
  const t0 = performance.now()
  // 1. fetch CSV 到主线程
  const resp = await fetch(DATA_FILE)
  const text = await resp.text()
  const fetchMs = (performance.now() - t0).toFixed(0)

  // 2. 转给 Worker 解析
  const parsed = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./csv-parser.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = (e) => reject(new Error(e.message))
    worker.postMessage({ text })
  })

  // 3. 接收到结果，填充到 versions Map
  for (const [ver, rows] of parsed.versions) {
    versions.set(ver, rows)
  }

  const totalMs = (performance.now() - t0).toFixed(0)
  console.log(`[Data] fetch: ${fetchMs}ms, parse: ${parsed.parseMs}ms, total: ${totalMs}ms`)

  // 4. 填充版本标签栏 (代替下拉框)
  const sortedVersions = [...versions.keys()].sort((a, b) => {
    if (a.startsWith('From')) return -1
    if (b.startsWith('From')) return 1
    return b.localeCompare(a)
  })

  versionSelect.innerHTML = ''
  // 用 documentFragment 一次性插入
  const frag = document.createDocumentFragment()
  for (const v of sortedVersions) {
    const tag = document.createElement('button')
    tag.className = 'version-tag' + (v.startsWith('From') ? ' cumulative' : '')
    tag.dataset.ver = v
    tag.textContent = v
    frag.appendChild(tag)
  }
  versionSelect.appendChild(frag)

  // 5. 默认选中最新已发布的稳定版 (过滤掉 'on-going' 开发和累计版本)
  // 策略: 排除 'From ...' 累计 + '(on-going)' 开发版, 按版本号 (逆字典序, 7.0 > 6.x) 取第一个
  const releaseVersions = sortedVersions.filter(v =>
    !v.startsWith('From') && !v.includes('(on-going)')
  )
  // 按版本号逆序: 7.0 > 6.19 > 6.18 ... 字典序正好匹配
  const defaultVer = releaseVersions[0] || sortedVersions[0]
  if (defaultVer) {
    currentVersion = defaultVer
    setActiveVersion(defaultVer)
    renderVersion(defaultVer)
    // 隐藏 loading
    const loading = document.querySelector('#chart-loading')
    if (loading) loading.classList.add('hidden')
  }

  // 6. 标签点击事件 (事件代理)
  versionSelect.addEventListener('click', (e) => {
    const tag = e.target.closest('.version-tag')
    if (!tag) return
    const ver = tag.dataset.ver
    if (ver && ver !== currentVersion) {
      currentVersion = ver
      setActiveVersion(ver)
      renderVersion(ver)
    }
  })
}

// ===== 设置当前激活的版本标签 =====
function setActiveVersion(ver) {
  document.querySelectorAll('.version-tag').forEach(t => {
    if (t.dataset.ver === ver) {
      t.classList.add('active')
      // 滚动到可视区域
      t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    } else {
      t.classList.remove('active')
    }
  })
}

// ===== CSV 行解析 =====
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

// ===== 判断是否中国企业 =====
// 关键: 名单按长度倒序匹配, 避免短关键词("Tech")误中长名("Science Fiction Technologies")
const SORTED_COMPANIES = [...CHINESE_COMPANIES].sort((a, b) => b.length - a.length)

function isChineseCompany(name) {
  if (!name) return false
  const lower = name.toLowerCase()
  return SORTED_COMPANIES.some(c => lower.includes(c.toLowerCase()))
}

// ===== 渲染指定版本 =====
function renderVersion(version) {
  let data = versions.get(version)
  if (!data) return

  // Tab 过滤: 中国企业 tab 只显示中文公司
  if (currentTab === 'cn') {
    data = data.filter(d => isChineseCompany(d.contributor))
  }

  data.sort((a, b) => b.value - a.value)

  // total 始终是整个版本的全部提交 (不被 tab 影响, 表示"所有企业总提交数")
  const fullData = versions.get(version)
  const total = fullData.reduce((sum, r) => sum + r.value, 0)
  const maxN = data.length

  // input 的 max 随版本动态变化 (避免可以输入超限值)
  topNInput.max = maxN || 1

  // 越界校验: input 数字必须在 [5, maxN] 范围内
  let inputVal = parseInt(topNInput.value, 10) || 30
  if (inputVal > maxN) {
    // 超过企业数: 夹到 maxN (等同于“显示全部”)
    topNInput.value = maxN
    inputVal = maxN
  } else if (inputVal < 5) {
    // 小于 5 (用户输 1/0/负数): 夹到 5
    topNInput.value = Math.min(5, maxN)
    inputVal = Math.min(5, maxN)
  } else if (currentTab === 'cn') {
    // CN tab: 默认保证 input 至少能显示全部中国企业
    // 如果 input < 16 但当前有 16 家中国企业, 提示用户已自动夾住
    // (不会改 input, 避免吃掉用户的输入意图)
  }

  const topN = inputVal
  const topData = data.slice(0, topN)
  console.log('[render]', currentTab, 'data.length:', data.length, 'maxN:', maxN, 'inputVal:', inputVal, 'topN:', topN)
  const top1 = data[0]

  statTotal.textContent = total.toLocaleString()
  statCompanies.textContent = maxN

  // CN tab 时: 计算并显示中国企业提交数
  const cnRow = document.querySelector('#stat-cn-row')
  const cnTotalEl = document.querySelector('#stat-cn-total')
  if (currentTab === 'cn') {
    const cnTotal = data.reduce((s, d) => s + d.value, 0)
    if (cnTotalEl) cnTotalEl.textContent = cnTotal.toLocaleString()
    if (cnRow) cnRow.style.display = 'flex'
  } else {
    if (cnRow) cnRow.style.display = 'none'
  }

  // CN tab 且无企业时: 在图表区显示提示
  const emptyHint = document.querySelector('#chart-empty')
  if (emptyHint) {
    emptyHint.style.display = (currentTab === 'cn' && maxN === 0) ? 'flex' : 'none'
  }

  // CN tab 时: 统计只显示数字
  if (currentTab === 'cn') {
    const statCompaniesEl = document.querySelector('#stat-companies')
    if (statCompaniesEl) statCompaniesEl.textContent = maxN
  } else {
    const statCompaniesEl = document.querySelector('#stat-companies')
    if (statCompaniesEl) {
      statCompaniesEl.textContent = maxN
    }
  }

  renderChart(version, topData, total)
  renderTable(data)
}

// ===== ECharts 图表 =====
function renderChart(version, data, total) {
  if (!chart) {
    chart = echarts.init(chartDom)
    window.addEventListener('resize', () => chart.resize())
  }

  // ---- 性能优化: 把 value < 2 的所有厂商合并为 "Other" ----
  // 原则: 只展示贡献 >= 2 的厂商, 其余合并成 "Other (N 家)"
  // 理由: 贡献为 1 的厂商在图上几乎看不见, 也没价值, 合并不影响信息量
  // 例外: CN tab 时不合并, 即使贡献为 1 也要展示 (中国企业在老版本可能只有 1 家)
  let displayData = data
  let showHint = false
  let minorCount = 0
  if (currentTab !== 'cn') {
    const main = data.filter(d => d.value >= 2)
    const minor = data.filter(d => d.value < 2)
    if (minor.length > 0) {
      const minorSum = minor.reduce((s, d) => s + d.value, 0)
      const otherPct = ((minorSum / total) * 100).toFixed(2) * 1
      displayData = [...main, {
        contributor: `Other (${minor.length} 家贡献为 1)`,
        value: minorSum,
        percentage: otherPct,
      }]
      showHint = true
      minorCount = minor.length
    }
  }

  // 重要: ECharts yAxis 类目轴默认从下往上加, 第一个类目在底部
  // 所以 yAxis.data 必须是 reverse 后的, 顶部 bar (displayData[0]) 才是第一名
  // 同样 series.data 也 reverse
  // 接下来 tooltip 用 dataIndex, 要用 reverse 后的数组作为查表依据
  const visNames = displayData.map(d => d.contributor).reverse()  // yAxis 顺序
  const visValues = displayData.map(d => d.value).reverse()       // yAxis 顺序
  const visPcts = displayData.map(d => ((d.value / total) * 100).toFixed(2)).reverse()

  // ---- 行间距固定: 类别间距为 30%, 加上 barWidth 14px, 每行约 30-35px ----
  // 原本不固定, 不同类别数下 ECharts 自适应间距, 看起来不一
  // 改用 barGap + 动态高度, 令间距体感一致
  const perItemHeight = 30  // 每行总高 (含间距)
  // 高度 = 标题区 60px + N 行 × 30px, 不设最小阈值, 完全随 N 变化
  const dynamicHeight = 60 + displayData.length * perItemHeight

  const labelFontSize = displayData.length > 100 ? 10 : displayData.length > 50 ? 11 : 12

  // 颜色: "Other" 用暗绿, 主营用亮绿渐变
  // colors 也需与 visValues 顺序一致 (reverse 后, 顶部 = 原第一名)
  const colors = displayData.map((d) => {
    if (d.contributor.startsWith('Other')) {
      return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: '#0a3a1a' },
        { offset: 1, color: '#062a12' },
      ])
    }
    return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
      { offset: 0, color: '#00ff41' },
      { offset: 1, color: '#00aa30' },
    ])
  }).reverse()

  const titleText = showHint
    ? `${version} (Top ${data.length}, ${minorCount} 家贡献为 1 的厂商合并为 Other)`
    : `${version} (Top ${data.length})`

  const option = {
    backgroundColor: 'transparent',
    title: {
      text: titleText,
      left: 'center',
      textStyle: {
        color: '#00ff41',
        fontSize: 15,
        fontWeight: 600,
        textShadowColor: 'rgba(0, 255, 65, 0.5)',
        textShadowBlur: 8,
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: 'rgba(0, 255, 65, 0.08)' },
      },
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      borderColor: '#00ff41',
      borderWidth: 1,
      textStyle: { color: '#00ff41', fontFamily: 'monospace', fontSize: 12 },
      formatter(params) {
        const p = params[0]
        const idx = p.dataIndex
        // 用 visNames/visValues 查表, idx 是 yAxis 顺序的索引
        return `> <strong style="color:#00ff41">${visNames[idx]}</strong><br/>` +
               `  commits: <strong>${visValues[idx].toLocaleString()}</strong><br/>` +
               `  share: <strong>${visPcts[idx]}%</strong>`
      },
    },
    grid: {
      left: '3%',
      right: '15%',
      bottom: '3%',
      top: '40px',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'commits',
      nameTextStyle: { color: '#5a8a5a', fontSize: 11 },
      axisLabel: { color: '#5a8a5a', fontSize: 11 },
      axisLine: { lineStyle: { color: '#0d3d1f' } },
      splitLine: { lineStyle: { color: '#0d3d1f', type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: visNames,  // 已 reverse, 第一个名字在 y 轴底部
      axisLabel: {
        fontSize: labelFontSize,
        fontWeight: 500,
        color: '#00ff41',
        formatter: (val) => val.length > 22 ? val.slice(0, 21) + '…' : val,
      },
      axisLine: { lineStyle: { color: '#0d3d1f' } },
      axisTick: { show: false },
    },
    // 大数据量关闭动画, 提升响应速度
    animation: displayData.length > 80 ? false : true,
    animationDuration: 300,
    series: [{
      type: 'bar',
      data: visValues.map((v, i) => ({
        value: v,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: colors[i],
        },
      })),
      barMaxWidth: 18,
      barWidth: 14,  // 显式固定 bar 宽度像素,避免随类别数变化
      barCategoryGap: '20%',  // 类别间距百分比, 100条 500条都一样
      label: {
        show: true,
        position: 'right',
        distance: 8,
        formatter: (p) => `${p.value.toLocaleString()} (${visPcts[p.dataIndex]}%)`,
        fontSize: labelFontSize,
        color: '#00ff41',
        textShadowColor: 'rgba(0, 255, 65, 0.5)',
        textShadowBlur: 4,
      },
    }],
  }

  // 关键: 先重置为 auto 让 ECharts 重排, 再设新高度
  // 不然从 500 切回 30 时, 画布还是 13000px, 30 条 bar 会撑得超开
  chartDom.style.height = 'auto'
  chart.resize()
  chartDom.style.height = `${dynamicHeight}px`
  chart.resize()
  chart.setOption(option, true)
}

// ===== 数据表格 =====
function renderTable(data) {
  tableBody.innerHTML = ''
  if (data.length === 0) return  // 空状态由概览区的 empty-hint 提示
  // 大表格: 一次性 innerHTML 比逐行 appendChild 快 10x
  const rows = []
  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const isCn = currentTab === 'cn' || isChineseCompany(d.contributor)
    const cnStyle = isCn ? 'border-left: 2px solid #ff4136; background: rgba(255, 65, 54, 0.05);' : ''
    rows.push(
      `<tr style="${cnStyle}">` +
      `<td>${i + 1}</td>` +
      `<td style="color:#00ff41"><strong>${escapeHtml(d.contributor)}</strong></td>` +
      `<td style="color:#00ff41">${d.value.toLocaleString()}</td>` +
      `<td style="color:#00ff41">${d.percentage}%</td>` +
      `</tr>`
    )
  }
  tableBody.innerHTML = rows.join('')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ===== 事件绑定 =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentTab = btn.dataset.tab

    // 切 tab 时, 重置 input 为该 tab 的默认展示数
    // ALL tab 默认 30, CN tab 默认 10
    const defaultN = currentTab === 'cn' ? 10 : 30
    let data = versions.get(currentVersion) || []
    if (currentTab === 'cn') {
      data = data.filter(d => isChineseCompany(d.contributor))
    }
    // 夹在 [5, data.length] 范围内
    const newVal = Math.min(defaultN, Math.max(5, data.length || defaultN))
    topNInput.value = newVal

    renderVersion(currentVersion)
  })
})

versionSelect.addEventListener('change', () => {
  renderVersion(currentVersion)
})

topNInput.addEventListener('change', () => {
  // 校验: 不超过当前版本的企业总数
  const data = versions.get(currentVersion)
  if (data) {
    const max = data.length
    let val = parseInt(topNInput.value, 10)
    if (val > max) {
      topNInput.value = max
      showHint(`输入超过当前版本企业总数 (${max}),已自动夹到最大值`)
    }
  }
  renderVersion(currentVersion)
})

// 顶部提示信息 (黑底绿边)
function showHint(msg) {
  let hint = document.querySelector('#top-n-hint')
  if (!hint) {
    hint = document.createElement('div')
    hint.id = 'top-n-hint'
    hint.className = 'toast-hint'
    document.body.appendChild(hint)
  }
  hint.textContent = msg
  hint.classList.add('show')
  clearTimeout(hint._timer)
  hint._timer = setTimeout(() => hint.classList.remove('show'), 3000)
}

// ===== 启动 =====
loadData().catch(err => {
  console.error('数据加载失败:', err)
  document.querySelector('#app').innerHTML = `
    <div class="loading">
      <h2>❌ 数据加载失败</h2>
      <p>${err.message}</p>
    </div>
  `
})
