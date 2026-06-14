// CSV 解析 Worker — 后台线程跑 18k 行解析
// 主线程不会卡
// 处理引号包裹的字段（含逗号）

self.onmessage = (e) => {
  const { text } = e.data
  const t0 = performance.now()
  const lines = text.trim().split('\n')

  const versions = new Map()
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i])
    if (!cols || cols.length < 4) continue
    const [ver, contributor, valueStr, pctStr] = cols
    const value = parseInt(valueStr, 10)
    const percentage = parseFloat(pctStr)
    if (isNaN(value)) continue  // 跳过异常行

    if (!versions.has(ver)) versions.set(ver, [])
    versions.get(ver).push({ contributor, value, percentage })
  }

  const result = []
  for (const [k, v] of versions) {
    result.push([k, v])
  }

  const t1 = performance.now()
  self.postMessage({ versions: result, parseMs: (t1 - t0).toFixed(1) })
}

// CSV 行解析: 处理双引号包裹的字段
function parseLine(line) {
  const out = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
    } else if (ch === ',' && !inQ) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}
