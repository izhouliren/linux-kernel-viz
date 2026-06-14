import './style.css'
import * as echarts from 'echarts'

const DATA_FILE = '/data/all_kernel_contribute_data_20260614.csv'

// ===== 状态 =====
let rawData = []        // 原始 CSV 行
let versions = new Map() // version -> [{contributor, value, percentage}]
let chart = null

// ===== DOM 引用 =====
const $ = (sel) => document.querySelector(sel)
const versionSelect = $('#version-select')
const topNInput = $('#top-n')
const chartDom = $('#chart')
const tableBody = $('#table-body')
const statTotal = $('#stat-total')
const statCompanies = $('#stat-companies')
const statTop1 = $('#stat-top1')

// ===== 数据加载 =====
async function loadData() {
  const resp = await fetch(DATA_FILE)
  const text = await resp.text()
  const lines = text.trim().split('\n')

  // 跳过表头
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < 4) continue
    const [ver, contributor, value, pct] = cols
    rawData.push({
      version: ver,
      contributor,
      value: parseInt(value, 10),
      percentage: parseFloat(pct),
    })
  }

  // 按版本分组
  for (const row of rawData) {
    if (!versions.has(row.version)) {
      versions.set(row.version, [])
    }
    versions.get(row.version).push(row)
  }

  // 填充下拉框
  const sortedVersions = [...versions.keys()].sort((a, b) => {
    // 特殊处理 "From Apr. 16 2005" 放最前
    if (a.startsWith('From')) return -1
    if (b.startsWith('From')) return 1
    return b.localeCompare(a)
  })

  versionSelect.innerHTML = ''
  for (const v of sortedVersions) {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    versionSelect.appendChild(opt)
  }

  // 默认选中第一个
  if (sortedVersions.length > 0) {
    versionSelect.value = sortedVersions[0]
    renderVersion(sortedVersions[0])
  }
}

// ===== CSV 行解析（处理引号内的逗号） =====
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

// ===== 渲染指定版本 =====
function renderVersion(version) {
  const data = versions.get(version)
  if (!data) return

  // 按 value 降序排列
  data.sort((a, b) => b.value - a.value)

  const total = data.reduce((sum, r) => sum + r.value, 0)
  const topN = parseInt(topNInput.value, 10) || 15
  const topData = data.slice(0, topN)
  const top1 = data[0]

  // 更新统计
  statTotal.textContent = total.toLocaleString()
  statCompanies.textContent = data.length
  statTop1.textContent = top1 ? `${top1.contributor} (${top1.value})` : '-'

  // 渲染图表
  renderChart(version, topData, total)

  // 渲染表格
  renderTable(data)
}

// ===== ECharts 图表 =====
function renderChart(version, data, total) {
  if (!chart) {
    chart = echarts.init(chartDom)
    window.addEventListener('resize', () => chart.resize())
  }

  const names = data.map(d => d.contributor)
  const values = data.map(d => d.value)
  const percentages = data.map(d => ((d.value / total) * 100).toFixed(2))

  const option = {
    title: {
      text: version,
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 600 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(params) {
        const p = params[0]
        const idx = p.dataIndex
        return `<strong>${names[idx]}</strong><br/>` +
               `Commit 数: <strong>${values[idx].toLocaleString()}</strong><br/>` +
               `占比: <strong>${percentages[idx]}%</strong>`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'Commit 数',
      nameTextStyle: { fontSize: 12 },
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: names.reverse(),
      axisLabel: { fontSize: 12, fontWeight: 500 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: 'bar',
      data: values.reverse(),
      barMaxWidth: 36,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#4a90d9' },
          { offset: 1, color: '#357abd' },
        ]),
      },
      label: {
        show: true,
        position: 'right',
        formatter: (p) => `${p.value.toLocaleString()} (${percentages[p.dataIndex]}%)`,
        fontSize: 11,
      },
    }],
  }

  chart.setOption(option, true)
}

// ===== 数据表格 =====
function renderTable(data) {
  tableBody.innerHTML = ''
  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><strong>${d.contributor}</strong></td>
      <td>${d.value.toLocaleString()}</td>
      <td>${d.percentage}%</td>
    `
    tableBody.appendChild(tr)
  }
}

// ===== 事件绑定 =====
versionSelect.addEventListener('change', () => {
  renderVersion(versionSelect.value)
})

topNInput.addEventListener('change', () => {
  renderVersion(versionSelect.value)
})

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
