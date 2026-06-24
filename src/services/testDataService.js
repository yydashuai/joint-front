/**
 * testDataService.js — 测试数据导入/导出服务层
 * 将序列化、文件下载等逻辑从组件中抽离，方便后续接入真实 API
 */

/* ========== CSV 工具 ========== */

/**
 * 转义单个 CSV 值：含逗号/引号/换行时用双引号包裹，内部引号双写
 */
const escapeCsvValue = (val) => {
  if (val == null) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * 将数据集行序列化为 CSV 字符串（含 BOM，Excel 友好）
 * @param {Array} rows - 数据行 [{ label, values: {...} }]
 * @param {Array<string>} fieldNames - 字段名列表
 * @returns {string}
 */
export function serializeCsv(rows, fieldNames) {
  const header = ['label', ...fieldNames].map(escapeCsvValue).join(',')
  const body = rows.map(r =>
    [r.label, ...fieldNames.map(k => r.values[k])].map(escapeCsvValue).join(',')
  )
  return [header, ...body].join('\r\n')
}

/**
 * 解析 CSV 字符串为行数组
 * @param {string} csvText
 * @returns {{ headers: string[], rows: Array<Object> }}
 */
export function parseCsv(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseLine = (line) => {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { result.push(current); current = '' }
        else current += ch
      }
    }
    result.push(current)
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line)
    const obj = {}
    headers.forEach((h, i) => {
      const v = vals[i] ?? ''
      const num = Number(v)
      obj[h] = v !== '' && !isNaN(num) ? num : v
    })
    return obj
  })
  return { headers, rows }
}

/* ========== 文件下载 ========== */

/**
 * 触发浏览器文件下载
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 导出数据集为 CSV 文件
 */
export function exportCsvFile(rows, fieldNames, filename) {
  const csv = serializeCsv(rows, fieldNames)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}

/**
 * 导出数据集为 JSON 文件
 */
export function exportJsonFile(data, filename) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  downloadBlob(blob, filename)
}

/* ========== 文件读取 ========== */

/**
 * 读取 File 对象为文本
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

/**
 * 从 File 对象推断格式
 */
export function inferFileFormat(filename) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map = { csv: 'csv', json: 'json', bin: 'bin', xml: 'xml', txt: 'csv' }
  return map[ext] || 'csv'
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
