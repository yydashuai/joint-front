/**
 * 偏移量计算引擎 — 支持字节/比特混合编排 + 重复组
 *
 * 核心算法：
 *   按从上到下遍历 fields，维护 { bytePos, bitPos } 状态。
 *   - 字节字段：对齐到字节边界，分配 byteLength 字节。
 *   - 比特子段：在当前字节的剩余位中分配，不够则跨字节。
 *   - 重复组：递归计算组内大小，乘以有效重复次数。
 */

/**
 * 计算 fields 的总字节数（不展开 repeat）
 * @param {Array} fields
 * @returns {number}
 */
export const computeTotalBytes = (fields) => {
  let total = 0
  for (const f of fields) {
    if (!f) continue
    if (f.kind === 'repeat') {
      const groupSize = computeTotalBytes(f.children || [])
      const count = effectiveRepeatCount(f)
      total += groupSize * count
    } else {
      total += f.byteLength || 0
    }
  }
  return total
}

/**
 * 获取重复组的有效重复次数
 */
export const effectiveRepeatCount = (group) => {
  if (group.repeatMode === 'fixed') return Math.max(1, group.repeatCount || 1)
  // dynamic: 尝试从 countField 取值，但这里无法访问 fields 上下文
  // 由调用方（ByteFieldTree）传入或使用默认 1
  return group._dynamicCount ?? 1
}

/**
 * 主计算函数：遍历 fields 并写入 byteOffset / displayOffset
 * @param {Array} fields - 顶层字段数组
 * @param {Function} resolveDynamicCount - (fieldId) => number 用于动态重复次数
 */
export const computeOffsets = (fields, resolveDynamicCount = null) => {
  let bytePos = 0

  for (const f of fields) {
    if (!f) continue
    if (f.kind === 'repeat') {
      // 重复组
      f.byteOffset = bytePos
      const groupSize = computeTotalBytes(f.children || [])
      f.groupByteSize = groupSize
      const count = f.repeatMode === 'dynamic' && resolveDynamicCount
        ? resolveDynamicCount(f.countFieldId)
        : Math.max(1, f.repeatCount || 1)
      f._effectiveCount = count
      // 递归计算子字段偏移
      computeOffsets(f.children || [], resolveDynamicCount)
      bytePos += groupSize * count
    } else {
      // 字节字段
      f.byteOffset = bytePos
      bytePos += f.byteLength || 0

      // 处理 bit children
      if (f.children?.length) {
        computeBitOffsets(f)
      }
    }
  }

  return bytePos
}

/**
 * 为字节字段的 bit children 计算偏移显示
 * @param {Object} byteField - 父字节字段
 */
export const computeBitOffsets = (byteField) => {
  const children = byteField.children || []
  if (!children.length) return

  const totalBits = byteField.byteLength * 8
  // 按 bitStart 降序排列（高位在前）进行校验
  const sorted = [...children].sort((a, b) => b.bitStart - a.bitStart)

  // 为每个 bit child 生成显示用的 offset 标注
  for (const c of children) {
    const startByte = byteField.byteOffset + Math.floor((totalBits - 1 - c.bitStart) / 8)
    const endByte = byteField.byteOffset + Math.floor((totalBits - 1 - c.bitEnd) / 8)

    if (startByte === endByte) {
      // 单字节内
      c._displayOffset = `0x${startByte.toString(16).toUpperCase().padStart(2, '0')} bit[${c.bitStart}:${c.bitEnd}]`
    } else {
      // 跨字节
      const startBitInByte = c.bitStart % 8
      const endBitInByte = c.bitEnd % 8
      c._displayOffset =
        `0x${startByte.toString(16).toUpperCase().padStart(2, '0')} bit${startBitInByte}` +
        ` ~ ` +
        `0x${endByte.toString(16).toUpperCase().padStart(2, '0')} bit${endBitInByte}`
    }
  }

  // 校验：总使用位数不超过总位数
  const usedBits = children.reduce((sum, c) => sum + Math.abs(c.bitStart - c.bitEnd) + 1, 0)
  byteField._bitsOverflow = usedBits > totalBits
  byteField._bitsUsed = usedBits
}

/**
 * 格式化字节偏移为十六进制显示
 * @param {number} offset
 * @returns {string}
 */
export const formatHexOffset = (offset) => {
  return '0x' + offset.toString(16).toUpperCase().padStart(2, '0')
}
