/**
 * dataChainImport.js — 数据链文件解析与字段/报文/数据集构建辅助
 *
 * 文件格式约定：
 *   段落标题行：如「一、SpaceMissions」「二、MonitoringStatus」
 *               （中文/阿拉伯数字序号 + 顿号/点 + 报文名，整行不含分隔符）
 *   紧随其后的首行：字段名（逗号或中文逗号分隔）
 *   后续行：数据行（逗号或中文逗号分隔，与字段名一一对应）
 *
 * 设计要点（与用户确认）：
 *   - 字段类型：按值自动推断；数值默认 uint16（并可按数据范围自动升级宽度），
 *     字符串默认 utf8；导入对话框中逐字段提供类型下拉，用户可修改。
 *   - 归属：由导入对话框选择系统/模块，默认取当前系统/模块。
 */

/* ============ 分隔符拆分（兼容中英文逗号 + 空白） ============ */
const splitFields = (line) =>
  String(line ?? '')
    .split(/[，,\t]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

/* ============ 值解析：纯数值 → Number，其余 → String ============ */
const NUMERIC_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/
const parseValue = (raw) => {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  if (NUMERIC_RE.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return s
}

/* ============ 标题行识别 ============ */
// 标题行不含分隔符，且以序号前缀开头
const isHeaderLine = (line) => {
  if (/[，,]/.test(line)) return false
  const t = line.trim()
  if (/^[一二三四五六七八九十百千零]+[、．.]\s*/.test(t)) return true
  if (/^\d+[\.、]\s*/.test(t)) return true
  if (/^第.{1,20}[、:：]\s*/.test(t)) return true
  return false
}

const extractHeaderName = (line) => {
  const t = line.trim()
  return t
    .replace(/^[一二三四五六七八九十百千零]+[、．.]\s*/, '')
    .replace(/^\d+[\.、]\s*/, '')
    .replace(/^第(.{1,20})[、:：]\s*/, '$1')
    .replace(/[、．.]+$/g, '')
    .trim()
}

/* ============ 类型推断 ============ */
const INT_RE = /^[+-]?\d+$/

/**
 * 根据样本值推断字段类型。
 * @param {Array} samples 已按 parseValue 解析后的值
 * @returns {{ kind:'numeric'|'string', inferredType:string, min:number, max:number, maxLen:number }}
 */
export const inferFieldType = (samples) => {
  const vals = (samples || []).filter((v) => v !== '' && v != null)
  const numericVals = vals.filter((v) => typeof v === 'number' && Number.isFinite(v))
  const strVals = vals.filter((v) => typeof v === 'string')

  if (numericVals.length >= strVals.length && numericVals.length > 0) {
    const allInt = numericVals.every((v) => Number.isInteger(v))
    const min = Math.min(...numericVals)
    const max = Math.max(...numericVals)
    let type
    if (allInt) {
      if (min >= 0 && max <= 255) type = 'uint8'
      else if (min >= -128 && max <= 127) type = 'int8'
      else if (min >= 0 && max <= 65535) type = 'uint16'
      else if (min >= -32768 && max <= 32767) type = 'int16'
      else if (min >= 0 && max <= 4294967295) type = 'uint32'
      else if (min >= -2147483648 && max <= 2147483647) type = 'int32'
      else if (min >= 0) type = 'uint64'
      else type = 'int64'
    } else {
      // 含小数：默认 float32（若范围极大则 float64）
      type = (max > 3.4e38 || min < -3.4e38) ? 'float64' : 'float32'
    }
    return { kind: 'numeric', inferredType: type, min, max, maxLen: 0 }
  }
  const maxLen = strVals.reduce((m, s) => Math.max(m, s.length), 0)
  return { kind: 'string', inferredType: 'utf8', min: 0, max: 0, maxLen }
}

/**
 * 解析数据链文本。
 * @param {string} text
 * @returns {Array<{ name:string, fieldNames:string[], rows:Object[], fields:Array }>}
 *   fields: [{ name, kind, inferredType, min, max, maxLen }]
 */
export const parseDataChain = (text) => {
  if (!text) return []
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const paragraphs = []
  let current = null
  let expectingFieldLine = false

  for (const line of lines) {
    if (isHeaderLine(line)) {
      current = { name: extractHeaderName(line) || `报文${paragraphs.length + 1}`, fieldNames: [], rows: [], fields: [] }
      paragraphs.push(current)
      expectingFieldLine = true
      continue
    }
    if (!current) {
      // 标题之前的散落内容直接忽略
      continue
    }
    if (expectingFieldLine) {
      current.fieldNames = splitFields(line)
      expectingFieldLine = false
      continue
    }
    // 数据行
    const cells = splitFields(line)
    const row = {}
    current.fieldNames.forEach((fn, i) => {
      row[fn] = parseValue(cells[i])
    })
    current.rows.push(row)
  }

  // 推导字段元信息
  paragraphs.forEach((p) => {
    p.fields = p.fieldNames.map((fn) => {
      const samples = p.rows.map((r) => r[fn])
      const meta = inferFieldType(samples)
      return { name: fn, ...meta }
    })
    // 丢弃无字段名或无数据行的段落
  })

  return paragraphs.filter((p) => p.fieldNames.length > 0 && p.rows.length > 0)
}
