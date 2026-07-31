/**
 * 接收报文校验引擎
 *
 * 结构校验：
 *   - 无法解析：报文无法按任何已知协议头（OSE / 4908A / MDS）解析；
 *   - 语义不一致：报文头声明信息与实际不符（如声明长度 20、实际 21，校验和不匹配）。
 * 字段与规则校验：
 *   - 字段越界：解析出的字段值违反字段定义约束（固定值 / 枚举 / 范围）；
 *   - 规则校验失败：违反「校验规则管理」中绑定到接口的规则（范围 / 边界等）。
 *
 * 头解析遵循「自动轮询三协议」策略：收到无法按接口定义解析的报文时，
 * 自动依次尝试 OSE → 4908A → MDS 头解析；全部失败才标记为「解析失败」，
 * 交由用户决定转发（修改寻址字段）或保存为原始样本。
 */

/* ================= 字节工具 ================= */

export const bytesFromHex = (hex = '') => {
  const compact = String(hex).replace(/[^0-9a-fA-F]/g, '')
  const out = []
  for (let i = 0; i + 1 < compact.length; i += 2) out.push(parseInt(compact.slice(i, i + 2), 16))
  return out
}

export const hexFromBytes = (bytes = []) =>
  bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0').toUpperCase()).join(' ')

const readU16 = (bytes, off) => ((bytes[off] ?? 0) << 8) | (bytes[off + 1] ?? 0)
const readU32 = (bytes, off) =>
  (((bytes[off] ?? 0) << 24) | ((bytes[off + 1] ?? 0) << 16) | ((bytes[off + 2] ?? 0) << 8) | (bytes[off + 3] ?? 0)) >>> 0
const writeU16 = (bytes, off, v) => { bytes[off] = (v >> 8) & 0xff; bytes[off + 1] = v & 0xff }
const writeU32 = (bytes, off, v) => {
  bytes[off] = (v >>> 24) & 0xff; bytes[off + 1] = (v >>> 16) & 0xff
  bytes[off + 2] = (v >>> 8) & 0xff; bytes[off + 3] = v & 0xff
}
const readIp = (bytes, off) => [0, 1, 2, 3].map((i) => bytes[off + i] ?? 0).join('.')
const writeIp = (bytes, off, ip) => {
  String(ip).split('.').slice(0, 4).forEach((seg, i) => { bytes[off + i] = Number(seg) & 0xff })
}

/** 简易校验和：全帧字节和（不含校验和字段本身）& 0xFFFF */
export const computeChecksum = (bytes, skipOff, skipLen = 2) => {
  let sum = 0
  bytes.forEach((b, i) => {
    if (i >= skipOff && i < skipOff + skipLen) return
    sum = (sum + (b & 0xff)) & 0xffff
  })
  return sum
}

/* ================= 协议头定义 ================= */

// 每个头字段：key / name / offset / len / codec / addressable(寻址类可编辑) / auto(完整性字段，合并时自动重算)
export const HEADER_DEFS = {
  OSE: {
    label: 'OSE 消息头（UDP，14 字节）',
    size: 14,
    fields: [
      { key: 'srcPort', name: '源端口', offset: 0, len: 2, codec: 'u16' },
      { key: 'dstPort', name: '目的端口', offset: 2, len: 2, codec: 'u16', addressable: true },
      { key: 'totalLength', name: '总长度', offset: 4, len: 2, codec: 'u16', auto: true },
      { key: 'checksum', name: '校验和', offset: 6, len: 2, codec: 'u16', auto: true },
      { key: 'targetIp', name: '目标 IP', offset: 8, len: 4, codec: 'ip', addressable: true },
      { key: 'messageType', name: '消息类型', offset: 12, len: 2, codec: 'u16', addressable: true },
    ],
  },
  '4908A': {
    label: '4908A 首部（TCP/IP，20 字节）',
    size: 20,
    fields: [
      { key: 'srcPort', name: '源端口', offset: 0, len: 2, codec: 'u16', addressable: true },
      { key: 'dstPort', name: '目的端口', offset: 2, len: 2, codec: 'u16', addressable: true },
      { key: 'seq', name: '序号 SEQ', offset: 4, len: 4, codec: 'u32' },
      { key: 'ack', name: '确认号 ACK', offset: 8, len: 4, codec: 'u32' },
      { key: 'offsetFlags', name: '偏移/标志', offset: 12, len: 2, codec: 'u16' },
      { key: 'window', name: '窗口', offset: 14, len: 2, codec: 'u16' },
      { key: 'checksum', name: '校验和', offset: 16, len: 2, codec: 'u16', auto: true },
      { key: 'urgentPointer', name: '紧急指针', offset: 18, len: 2, codec: 'u16' },
    ],
  },
  MDS: {
    label: 'MDS（传输配置待确认）',
    size: 0,
    fields: [],
    unavailable: 'MDS 传输配置待确认，暂不支持头解析',
  },
}

export const HEADER_TRANSPORTS = ['OSE', '4908A', 'MDS']

const readHeaderValue = (bytes, f) => {
  if (f.codec === 'u16') return readU16(bytes, f.offset)
  if (f.codec === 'u32') return readU32(bytes, f.offset)
  if (f.codec === 'ip') return readIp(bytes, f.offset)
  return 0
}

const writeHeaderValue = (bytes, f, value) => {
  if (f.codec === 'u16') writeU16(bytes, f.offset, Number(value) || 0)
  else if (f.codec === 'u32') writeU32(bytes, f.offset, Number(value) || 0)
  else if (f.codec === 'ip') writeIp(bytes, f.offset, value)
}

/* ================= 头解析（单协议 / 三协议轮询） ================= */

/**
 * 按指定协议解析报文头。
 * 判定标准（演示实现）：
 *   OSE   → 长度 >= 14 且头部 totalLength === 实际字节数；
 *   4908A → 长度 >= 20 且数据偏移半字节 === 5；
 *   MDS   → 配置待确认，恒返回失败。
 */
export const parseHeaderAs = (transport, bytes = []) => {
  const def = HEADER_DEFS[transport]
  if (!def) return { transport, ok: false, reason: '未知协议' }
  if (def.unavailable) return { transport, ok: false, reason: def.unavailable }
  if (bytes.length < def.size) return { transport, ok: false, reason: `报文长度 ${bytes.length} 字节，不足 ${def.label} 所需 ${def.size} 字节` }

  if (transport === 'OSE') {
    const totalLength = readU16(bytes, 4)
    if (totalLength !== bytes.length) {
      return { transport, ok: false, reason: `OSE 头声明总长 ${totalLength}，实际 ${bytes.length}，头结构不匹配` }
    }
  }
  if (transport === '4908A') {
    const dataOffset = (bytes[12] >> 4) & 0x0f
    if (dataOffset !== 5) {
      return { transport, ok: false, reason: `4908A 数据偏移 ${dataOffset} 非法（应为 5），头结构不匹配` }
    }
  }

  const fields = def.fields.map((f) => ({
    key: f.key,
    name: f.name,
    codec: f.codec,
    offset: f.offset,
    len: f.len,
    addressable: !!f.addressable,
    auto: !!f.auto,
    value: readHeaderValue(bytes, f),
  }))
  return { transport, ok: true, size: def.size, fields }
}

/** 自动轮询三协议解析报文头，返回全部尝试结果（顺序 OSE → 4908A → MDS） */
export const tryParseHeaders = (bytes = []) =>
  HEADER_TRANSPORTS.map((t) => parseHeaderAs(t, bytes))

/* ================= 结构校验 ================= */

/**
 * 结构层校验（针对可按接口定义解析的报文）：
 * 前后语义一致性 —— 声明长度 vs 实际长度、校验和。
 * @returns issues: [{ layer:'结构', tag, field, message }]
 */
export const checkStructure = (transport, bytes = []) => {
  const issues = []
  if (transport === 'OSE') {
    if (bytes.length < 14) {
      issues.push({ layer: '结构', tag: '语义不一致', field: 'totalLength', message: `报文仅 ${bytes.length} 字节，不足 OSE 头 14 字节` })
      return issues
    }
    const declared = readU16(bytes, 4)
    if (declared !== bytes.length) {
      issues.push({ layer: '结构', tag: '语义不一致', field: 'totalLength', message: `头部声明数据长度 ${declared}，实际解析出 ${bytes.length}，前后语义不一致` })
    }
    const declaredSum = readU16(bytes, 6)
    const actualSum = computeChecksum(bytes, 6)
    if (declared === bytes.length && declaredSum !== actualSum) {
      issues.push({ layer: '结构', tag: '语义不一致', field: 'checksum', message: `校验和不符：声明 0x${declaredSum.toString(16).toUpperCase()}，重算 0x${actualSum.toString(16).toUpperCase()}` })
    }
  }
  if (transport === '4908A') {
    if (bytes.length < 20) {
      issues.push({ layer: '结构', tag: '语义不一致', field: 'header', message: `报文仅 ${bytes.length} 字节，不足 4908A 首部 20 字节` })
      return issues
    }
    const declaredSum = readU16(bytes, 16)
    const actualSum = computeChecksum(bytes, 16)
    if (declaredSum !== actualSum) {
      issues.push({ layer: '结构', tag: '语义不一致', field: 'checksum', message: `检验和不符：声明 0x${declaredSum.toString(16).toUpperCase()}，重算 0x${actualSum.toString(16).toUpperCase()}` })
    }
  }
  // MDS：传输配置待确认，跳过结构校验
  return issues
}

/* ================= 字段约束校验 ================= */

/** 字段定义约束校验（固定值 / 枚举 / 范围） */
export const checkFieldConstraints = (fields = [], values = {}) => {
  const issues = []
  for (const f of fields) {
    const c = f.constraint
    if (!c || !c.mode || c.mode === 'none') continue
    const v = values[f.name]
    if (v === undefined || v === null || v === '') {
      issues.push({ layer: '字段', tag: '字段越界', field: f.name, message: '字段值缺失' })
      continue
    }
    if (c.mode === 'fixed' && String(v) !== String(c.value)) {
      issues.push({ layer: '字段', tag: '字段越界', field: f.name, message: `应为固定值 ${c.value}，实际 ${v}` })
    } else if (c.mode === 'enum') {
      const ok = (c.entries || []).some((e) => String(e?.value ?? e) === String(v))
      if (!ok) issues.push({ layer: '字段', tag: '字段越界', field: f.name, message: `值 ${v} 不在枚举范围（${(c.entries || []).map((e) => e?.label ?? e?.value ?? e).join('/')}）` })
    } else if (c.mode === 'range') {
      const num = Number(v)
      if (!Number.isFinite(num)) {
        issues.push({ layer: '字段', tag: '字段越界', field: f.name, message: `应为 ${c.min}~${c.max} 内数值，实际 ${v}` })
      } else if ((Number.isFinite(c.min) && num < c.min) || (Number.isFinite(c.max) && num > c.max)) {
        issues.push({ layer: '字段', tag: '字段越界', field: f.name, message: `值 ${num} 超出范围 ${c.min}~${c.max}` })
      }
    }
  }
  return issues
}

/**
 * 应用「校验规则管理」中绑定到接口的规则（range / boundary / fixed 等按字段名匹配）。
 * @param rules 规则数组（rule.target.fieldName / rule.params）
 */
export const checkInterfaceRules = (rules = [], values = {}) => {
  const issues = []
  for (const rule of rules) {
    if (rule.enabled === false) continue
    const fieldName = rule.target?.fieldName
    if (!fieldName || !(fieldName in values)) continue
    const v = Number(values[fieldName])
    if (rule.type === 'range') {
      const { min, max } = rule.params || {}
      if (!Number.isFinite(v)) {
        issues.push({ layer: '规则', tag: '规则校验失败', field: fieldName, rule: rule.desc || '取值范围', message: `${fieldName} 不是可比较数值` })
      } else if ((Number.isFinite(Number(min)) && v < Number(min)) || (Number.isFinite(Number(max)) && v > Number(max))) {
        issues.push({ layer: '规则', tag: '规则校验失败', field: fieldName, rule: rule.desc || '取值范围', message: `${fieldName}=${v} 违反规则「${rule.desc || `范围 ${min}~${max}`}」` })
      }
    }
    if (rule.type === 'boundary') {
      const { min, max } = rule.params || {}
      if (Number.isFinite(v) && (v === Number(min) || v === Number(max))) {
        issues.push({ layer: '规则', tag: '规则校验失败', field: fieldName, rule: rule.desc || '边界值检测', message: `${fieldName}=${v} 命中边界值（规则「${rule.desc || '边界值检测'}」）` })
      }
    }
  }
  return issues
}

/* ================= 综合裁决 ================= */

/**
 * 对一条接收报文执行结构、字段约束和规则校验。
 * @returns { status: 'ok'|'error'|'unparsed', tag, issues }
 */
export const validateMessage = ({ transport, bytes = [], fields = [], values = {}, rules = [], unparsed = false }) => {
  if (unparsed) {
    return {
      status: 'unparsed',
      tag: '无法解析',
      issues: [{ layer: '结构', tag: '无法解析', field: '', message: '报文无法按接口字段定义解析（帧结构与定义不匹配）' }],
    }
  }
  const structureIssues = checkStructure(transport, bytes)
  if (structureIssues.length) return { status: 'error', tag: '语义不一致', issues: structureIssues }

  const constraintIssues = checkFieldConstraints(fields, values)
  const ruleIssues = checkInterfaceRules(rules, values)
  const issues = [...constraintIssues, ...ruleIssues]
  if (!issues.length) return { status: 'ok', tag: '正常', issues: [] }
  return { status: 'error', tag: constraintIssues.length ? '字段越界' : '规则校验失败', issues }
}

/* ================= 帧构造 / 合并转发 ================= */

const rnd = (min, max) => Math.round(min + Math.random() * (max - min))

/**
 * 构造模拟接收帧：协议头 + 报文体。
 * @param opts.corruptLength  语义不一致：声明长度 = 实际 + 1
 * @param opts.garbage        无法解析：纯乱码（不满足任何头判定）
 */
export const buildMockFrame = (transport, bodyLen = 8, opts = {}) => {
  if (opts.garbage) {
    const n = rnd(6, 18)
    const bytes = Array.from({ length: n }, () => rnd(0, 255))
    // 破坏 OSE 判定（totalLength 不等实长）与 4908A 判定（偏移非 5）
    if (bytes.length >= 6) writeU16(bytes, 4, bytes.length + rnd(3, 9))
    if (bytes.length >= 13) bytes[12] = (bytes[12] & 0x0f) | 0x30
    return bytes
  }

  const body = Array.from({ length: bodyLen }, () => rnd(0, 255))

  if (transport === '4908A') {
    const bytes = new Array(20).fill(0)
    writeU16(bytes, 0, rnd(1024, 65000))
    writeU16(bytes, 2, rnd(1024, 65000))
    writeU32(bytes, 4, rnd(1, 99999))
    writeU32(bytes, 8, rnd(1, 99999))
    bytes[12] = 0x50           // 数据偏移 5
    bytes[13] = 0x18           // ACK+PSH
    writeU16(bytes, 14, 65535)
    writeU16(bytes, 18, 0)
    const frame = [...bytes, ...body]
    writeU16(frame, 16, opts.corruptChecksum ? 0xdead : computeChecksum(frame, 16))
    return frame
  }

  // OSE（MDS 借用 OSE 帧格式承载演示数据，corrupt 时同样制造声明/实际不一致）
  const bytes = new Array(14).fill(0)
  writeU16(bytes, 0, rnd(50000, 50100))
  writeU16(bytes, 2, rnd(9000, 9999))
  writeIp(bytes, 8, `192.168.${rnd(0, 8)}.${rnd(2, 254)}`)
  writeU16(bytes, 12, rnd(1, 24))
  const frame = [...bytes, ...body]
  writeU16(frame, 4, opts.corruptLength ? frame.length + 1 : frame.length)
  writeU16(frame, 6, computeChecksum(frame, 6))
  return frame
}

/**
 * 合并转发帧：把修改后的头字段写回原报文头，与原报文体合并。
 * @param recalc true 时自动重算完整性字段（totalLength / checksum）
 */
export const rebuildFrame = (transport, originalBytes = [], headerValues = {}, recalc = true) => {
  const def = HEADER_DEFS[transport]
  if (!def || def.unavailable) return null
  const bytes = [...originalBytes]
  def.fields.forEach((f) => {
    if (f.auto) return                       // 完整性字段稍后重算
    if (headerValues[f.key] !== undefined) writeHeaderValue(bytes, f, headerValues[f.key])
  })
  if (recalc) {
    if (transport === 'OSE') {
      writeU16(bytes, 4, bytes.length)
      writeU16(bytes, 6, computeChecksum(bytes, 6))
    }
    if (transport === '4908A') {
      writeU16(bytes, 16, computeChecksum(bytes, 16))
    }
  }
  return bytes
}

/**
 * 从零构造完整帧：协议头（默认全 0）+ 报文体 + 可选头字段覆盖 + 自动重算完整性字段。
 * 用于「仅粘贴报文体 + 手动配置报文头」的构造场景。
 * @returns 完整帧字节数组，或 transport 不可用时返回 null
 */
export const buildFrame = (transport, bodyBytes = [], headerValues = {}, recalc = true) => {
  const def = HEADER_DEFS[transport]
  if (!def || def.unavailable) return null
  const bytes = [...new Array(def.size).fill(0), ...bodyBytes]
  def.fields.forEach((f) => {
    if (f.auto) return
    if (headerValues[f.key] !== undefined) writeHeaderValue(bytes, f, headerValues[f.key])
  })
  if (recalc) {
    if (transport === 'OSE') {
      writeU16(bytes, 4, bytes.length)
      writeU16(bytes, 6, computeChecksum(bytes, 6))
    }
    if (transport === '4908A') {
      writeU16(bytes, 16, computeChecksum(bytes, 16))
    }
  }
  return bytes
}

/**
 * 将字段值序列化为字节数组（供「从字段值直接发送」重建报文体）。
 * 头结构由 buildFrame / 自动重算处理，这里只生成报文体字节；
 * 内容不影响字段层校验（校验只看 values + 字段定义），因此采用确定性的近似编码。
 */
export const valuesToBytes = (fields = [], values = {}) => {
  const bytes = []
  for (const f of fields) {
    const v = values[f.name]
    if (v === undefined || v === null || v === '') { bytes.push(0, 0); continue }
    const type = String(f.type || f.encoding || f.kind || '').toLowerCase()
    if (type.includes('bit')) { bytes.push(Number(v) & 0xff); continue }
    if (type.includes('32') || type.includes('u32') || type.includes('float')) {
      const num = Number(v)
      bytes.push((num >>> 24) & 0xff, (num >>> 16) & 0xff, (num >>> 8) & 0xff, num & 0xff)
    } else if (type.includes('string') || typeof v === 'string') {
      for (const ch of String(v)) bytes.push(ch.charCodeAt(0) & 0xff)
    } else {
      const num = Number(v)
      if (Number.isFinite(num)) bytes.push((num >> 8) & 0xff, num & 0xff)
      else bytes.push(0, 0)
    }
  }
  return bytes
}
