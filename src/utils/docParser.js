/**
 * 文档结构化解析与智能分块（B-1）
 *
 * 将导入文档按结构切分为语义块：
 * - 标题层级（Markdown #~######）单独成块并作为后续块的 heading 上下文
 * - 表格（连续 | 行）、列表（- / 数字.）、代码块（```）类型感知
 * - 普通段落按空行分段，过短段落并入前块，超长段落按句切分
 * 每块输出 { idx, text, heading, type, keywords }，块级摘要由前若干块合成。
 */

const TYPES = { heading: '标题', table: '表格', list: '列表', code: '代码', paragraph: '段落' }

function isHeading(line) {
  const m = String(line).match(/^(#{1,6})\s+(.+)$/)
  return m ? { level: m[1].length, text: m[2].trim() } : null
}

function isTableStart(line) {
  return /^\s*\|.*\|/.test(line) && line.includes('|')
}

function isListLine(line) {
  return /^\s*[-*]\s+/.test(line) || /^\s*\d+[.、)]\s+/.test(line)
}

function isCodeStart(line) {
  return /^\s*```/.test(line)
}

/** 简单关键词：2-4 字中文词滑动窗口频次 + 英文 token 频次 */
function extractKeywords(text, limit = 3) {
  const freq = new Map()
  const count = (word) => {
    if (!word || word.length < 2) return
    freq.set(word, (freq.get(word) || 0) + 1)
  }
  // 英文/数字 token
  String(text).match(/[A-Za-z][A-Za-z0-9_-]{1,20}|[0-9]+[A-Za-z_-]*[0-9A-Za-z_-]*/g)?.forEach(count)
  // 中文 2-4 字滑动窗口
  const zh = String(text).replace(/[^\u4e00-\u9fa5]/g, '')
  for (let i = 0; i < zh.length - 1; i += 1) {
    for (let len = 2; len <= 4 && i + len <= zh.length; len += 1) count(zh.slice(i, i + len))
  }
  return [...freq.entries()]
    .filter(([word]) => !/^(接口|报文|数据|系统|测试|异常|进行|以及|可以|需要|用于|通过|存在|相关|内容|信息)$/.test(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

const splitLong = (text, max = 360) => {
  if (text.length <= max) return [text]
  const sentences = text.split(/(?<=[。；!?！？\n])/)
  const parts = []
  let cur = ''
  sentences.forEach((s) => {
    if ((cur + s).length > max && cur) {
      parts.push(cur)
      cur = s
    } else {
      cur += s
    }
  })
  if (cur) parts.push(cur)
  return parts
}

/**
 * 解析文档内容为结构化块。
 * @param {string} content 文档文本
 * @returns {{summary:string, chunks:Array<{idx:number,text:string,heading:string,type:string,keywords:string[]}>}}
 */
export function parseDoc(content = '') {
  const lines = String(content).replace(/\r\n/g, '\n').split('\n')
  const rawBlocks = [] // { heading, type, text, level }
  let currentHeading = ''
  let currentLevel = 0
  let tableBuf = []
  let listBuf = []
  let codeBuf = null

  const flushTable = () => {
    if (!tableBuf.length) return
    rawBlocks.push({ heading: currentHeading, type: 'table', text: tableBuf.join('\n') })
    tableBuf = []
  }
  const flushList = () => {
    if (!listBuf.length) return
    rawBlocks.push({ heading: currentHeading, type: 'list', text: listBuf.join('\n') })
    listBuf = []
  }
  const flushParagraph = (buf) => {
    const text = buf.join(' ').trim()
    if (text) rawBlocks.push({ heading: currentHeading, type: 'paragraph', text })
  }

  let paraBuf = []
  lines.forEach((rawLine) => {
    const line = rawLine.trim()
    if (!line) {
      flushTable()
      flushList()
      flushParagraph(paraBuf)
      paraBuf = []
      return
    }
    if (codeBuf !== null) {
      codeBuf.push(line)
      if (isCodeStart(line)) {
        rawBlocks.push({ heading: currentHeading, type: 'code', text: codeBuf.join('\n') })
        codeBuf = null
      }
      return
    }
    if (isCodeStart(line)) {
      flushTable(); flushList(); flushParagraph(paraBuf); paraBuf = []
      codeBuf = [line]
      return
    }
    const head = isHeading(line)
    if (head) {
      flushTable(); flushList(); flushParagraph(paraBuf); paraBuf = []
      rawBlocks.push({ heading: currentHeading, type: 'heading', text: head.text, level: head.level })
      if (head.level <= (currentLevel || 6)) currentHeading = head.text
      currentLevel = head.level
      return
    }
    if (isTableStart(line)) {
      flushList(); flushParagraph(paraBuf); paraBuf = []
      tableBuf.push(line)
      return
    }
    if (isListLine(line)) {
      flushTable(); flushParagraph(paraBuf); paraBuf = []
      listBuf.push(line)
      return
    }
    if (tableBuf.length || listBuf.length) {
      flushTable(); flushList()
    }
    paraBuf.push(line)
  })
  flushTable(); flushList(); flushParagraph(paraBuf)

  // 组装块（合并过短段落）
  const merged = []
  rawBlocks.forEach((block) => {
    if (block.type === 'paragraph' && block.text.length < 24 && merged.length) {
      const last = merged[merged.length - 1]
      if (last.type === 'paragraph') {
        last.text += ` ${block.text}`
        return
      }
    }
    merged.push({ ...block })
  })

  // 拆分超长块
  const chunks = []
  merged.forEach((block) => {
    if (block.text.length > 360 && block.type === 'paragraph') {
      splitLong(block.text).forEach((part, i) => {
        chunks.push({ ...block, text: part, part: i + 1 })
      })
    } else {
      chunks.push(block)
    }
  })

  const result = chunks.map((block, index) => ({
    idx: index + 1,
    text: block.text,
    heading: block.heading || '',
    type: TYPES[block.type] || block.type,
    keywords: extractKeywords(block.text),
  }))

  // 块级摘要：前 3 个有效块文本（标题块优先）
  const summaryParts = result
    .filter((c) => c.type === '标题' || c.text.length > 8)
    .slice(0, 3)
    .map((c) => (c.type === '标题' ? c.text : c.text.slice(0, 60)))
  const summary = summaryParts.join(' / ').slice(0, 160)

  return { summary, chunks: result }
}
