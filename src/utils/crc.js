/**
 * CRC 与校验计算工具
 *
 * 内置常用 CRC 预设，支持自定义多项式/初始值/反转/异或。
 * 同时提供和校验（sum8/sum16）函数。
 */

// ─── CRC 预设 ───
export const CRC_PRESETS = [
  {
    name: 'CRC-16/CCITT',
    poly: 0x1021, init: 0xFFFF, refIn: false, refOut: false, xorOut: 0x0000,
    width: 16, desc: '常用于通信协议'
  },
  {
    name: 'CRC-16/MODBUS',
    poly: 0x8005, init: 0xFFFF, refIn: true, refOut: true, xorOut: 0x0000,
    width: 16, desc: 'Modbus RTU 协议标准'
  },
  {
    name: 'CRC-16/X25',
    poly: 0x1021, init: 0xFFFF, refIn: true, refOut: true, xorOut: 0xFFFF,
    width: 16, desc: 'X.25 / PPP 协议'
  },
  {
    name: 'CRC-16/USB',
    poly: 0x8005, init: 0xFFFF, refIn: true, refOut: true, xorOut: 0xFFFF,
    width: 16, desc: 'USB 协议'
  },
  {
    name: 'CRC-32',
    poly: 0x04C11DB7, init: 0xFFFFFFFF, refIn: true, refOut: true, xorOut: 0xFFFFFFFF,
    width: 32, desc: '以太网 / ZIP / PNG 标准'
  },
  {
    name: 'CRC-32/MPEG-2',
    poly: 0x04C11DB7, init: 0xFFFFFFFF, refIn: false, refOut: false, xorOut: 0x00000000,
    width: 32, desc: 'MPEG-2 传输流'
  },
]

/**
 * 按名称获取 CRC 预设
 */
export const crcPresetByName = (name) => CRC_PRESETS.find(p => p.name === name) || null

// ─── 辅助：位反转 ───
const reflect8 = (byte) => {
  let r = 0
  for (let i = 0; i < 8; i++) {
    if (byte & (1 << i)) r |= 1 << (7 - i)
  }
  return r
}

const reflect16 = (val) => {
  let r = 0
  for (let i = 0; i < 16; i++) {
    if (val & (1 << i)) r |= 1 << (15 - i)
  }
  return r
}

const reflect32 = (val) => {
  let r = 0
  for (let i = 0; i < 32; i++) {
    if (val & (1 << i)) r |= 1 << (31 - i)
  }
  return r >>> 0
}

const reflect = (val, width) => {
  if (width <= 8) return reflect8(val & 0xFF)
  if (width <= 16) return reflect16(val & 0xFFFF)
  return reflect32(val >>> 0)
}

// ─── CRC 查表加速 ───
const buildTable = (poly, width) => {
  const table = new Uint32Array(256)
  const topBit = 1 << (width - 1)
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1

  for (let i = 0; i < 256; i++) {
    let crc = i << (width - 8)
    for (let j = 0; j < 8; j++) {
      if (crc & topBit) {
        crc = ((crc << 1) ^ poly) & mask
      } else {
        crc = (crc << 1) & mask
      }
    }
    table[i] = crc >>> 0
  }
  return table
}

// 缓存查找表
const tableCache = new Map()
const getTable = (poly, width) => {
  const key = `${poly}:${width}`
  if (!tableCache.has(key)) tableCache.set(key, buildTable(poly, width))
  return tableCache.get(key)
}

/**
 * 通用 CRC 计算
 * @param {Uint8Array|number[]} data - 数据字节数组
 * @param {number} start - 起始索引（含）
 * @param {number} end - 结束索引（含）
 * @param {Object} opts - { poly, init, refIn, refOut, xorOut, width }
 * @returns {number} CRC 值
 */
export const calcCRC = (data, start, end, opts = {}) => {
  const {
    poly = 0x1021,
    init = 0xFFFF,
    refIn = false,
    refOut = false,
    xorOut = 0x0000,
    width = 16
  } = opts

  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1
  const table = getTable(poly, width)
  let crc = init

  for (let i = start; i <= end && i < data.length; i++) {
    let byte = data[i] & 0xFF
    if (refIn) byte = reflect8(byte)
    const idx = ((crc >>> (width - 8)) ^ byte) & 0xFF
    crc = ((crc << 8) ^ table[idx]) & mask
  }

  if (refOut) crc = reflect(crc, width)
  return (crc ^ xorOut) & mask
}

/**
 * 8 位和校验
 * @param {Uint8Array|number[]} data
 * @param {number} start
 * @param {number} end
 * @returns {number} 8 位校验和
 */
export const calcSum8 = (data, start, end) => {
  let sum = 0
  for (let i = start; i <= end && i < data.length; i++) {
    sum = (sum + (data[i] & 0xFF)) & 0xFF
  }
  return sum
}

/**
 * 16 位和校验（大端累加）
 * @param {Uint8Array|number[]} data
 * @param {number} start
 * @param {number} end
 * @returns {number} 16 位校验和
 */
export const calcSum16 = (data, start, end) => {
  let sum = 0
  for (let i = start; i <= end && i < data.length; i += 2) {
    const hi = data[i] & 0xFF
    const lo = (i + 1 <= end && i + 1 < data.length) ? (data[i + 1] & 0xFF) : 0
    sum = (sum + ((hi << 8) | lo)) & 0xFFFF
  }
  return sum
}

/**
 * 根据 checksum config 对象执行校验计算
 * @param {Uint8Array} data
 * @param {Object} checksumConfig - 来自 protocol.config.checksum
 * @returns {number} 校验值
 */
export const calcByConfig = (data, checksumConfig) => {
  const { type, rangeStart, rangeEnd } = checksumConfig
  const start = rangeStart || 0
  const end = rangeEnd || data.length - 1

  switch (type) {
    case 'sum8':  return calcSum8(data, start, end)
    case 'sum16': return calcSum16(data, start, end)
    case 'crc16':
    case 'crc32': {
      const width = type === 'crc32' ? 32 : 16
      const poly = parseInt(checksumConfig.polynomial, 16) || 0x1021
      const init = parseInt(checksumConfig.initValue, 16) || 0xFFFF
      const xorOut = parseInt(checksumConfig.xorOut, 16) || 0x0000
      return calcCRC(data, start, end, {
        poly, init,
        refIn: checksumConfig.reflectIn,
        refOut: checksumConfig.reflectOut,
        xorOut, width
      })
    }
    default: return 0
  }
}
