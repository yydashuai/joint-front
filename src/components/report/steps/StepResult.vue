<template>
  <div class="step step-result">
    <div class="result-toolbar">
      <div class="result-title"><el-icon><Document /></el-icon> {{ cur ? cur.title : '联试报告' }}</div>
      <div class="result-actions">
        <el-button size="small" :icon="ArrowLeft" @click="$emit('back')">上一步</el-button>
        <el-button v-if="cur" size="small" :type="editMode ? 'primary' : ''" :icon="EditPen" @click="editMode = !editMode">
          {{ editMode ? '完成编辑' : '编辑' }}
        </el-button>
        <div v-if="cur" ref="exportMenuRef" class="export-menu">
          <el-button size="small" type="primary" plain :icon="Download" @click="toggleExportMenu">
            导出<el-icon class="export-menu__chevron"><ArrowDown /></el-icon>
          </el-button>
          <div v-show="exportOpen" class="export-menu__panel">
            <button class="export-menu__item" type="button" @click="handleExportMd">
              <el-icon><Download /></el-icon><span>Markdown</span>
            </button>
            <button class="export-menu__item" type="button" @click="handleExportDoc">
              <el-icon><Document /></el-icon><span>DOCX</span>
            </button>
            <div class="export-menu__item export-menu__item--submenu" tabindex="0">
              <span class="export-menu__item-main"><el-icon><Printer /></el-icon><span>PDF</span></span>
              <span class="export-menu__arrow">›</span>
              <div class="export-menu__sub">
                <button type="button" @click="handleExportPdf('text')">文字型 PDF</button>
                <button type="button" @click="handleExportPdf('image')">图片型 PDF</button>
              </div>
            </div>
          </div>
        </div>
        <el-button v-if="cur" size="small" :icon="RefreshLeft" @click="$emit('restart')">重新开始</el-button>
      </div>
    </div>

    <el-scrollbar v-if="cur" class="paper-scroll">
      <div class="paper">
        <h1 class="paper__title">{{ cur.title }}</h1>
        <div class="paper__meta">
          <span>{{ sysName }}</span><span>·</span><span>{{ cur.runName }}</span><span>·</span><span>{{ cur.createdAt }}</span>
        </div>
        <div class="paper-info">
          <div><span>测试任务创建者</span><strong>{{ cur.taskCreator || '—' }}</strong></div>
          <div><span>报告生成者</span><strong>{{ cur.generatorName || '—' }}</strong></div>
        </div>
        <section v-for="sec in cur.sections" :key="sec.key" class="sec">
          <div class="sec__head">
            <span class="sec__title">{{ sec.title }}</span>
            <span class="sec__spacer" />
            <el-button
              v-if="sec.kind === 'gen'" size="small" text type="primary" :icon="Refresh"
              @click="store.regenerateSection(cur, sec.key)"
            >重新生成</el-button>
          </div>
          <el-input v-if="editMode" v-model="sec.content" type="textarea" :autosize="{ minRows: 3 }" class="sec__edit" />
          <div v-else class="md" v-html="render(sec.content)" />
        </section>
      </div>
    </el-scrollbar>
    <el-empty v-else description="尚未生成报告，请返回上一步生成" :image-size="100" />
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { Document, EditPen, Download, RefreshLeft, Refresh, ArrowLeft, Printer, ArrowDown } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'
import { useSystemStore } from '@/stores/system'
import { mdToHtml, downloadFile } from '@/utils/markdown'

defineEmits(['back', 'restart'])

const store = useReportStore()
const systemStore = useSystemStore()

const cur = computed(() => store.currentReport)
const editMode = ref(false)
const exportOpen = ref(false)
const exportMenuRef = ref(null)
const sysName = computed(() => systemStore.systems.find((s) => s.id === cur.value?.systemId)?.name || '—')
const render = (md) => mdToHtml(md)

const closeExportMenu = () => {
  exportOpen.value = false
}
const toggleExportMenu = () => {
  exportOpen.value = !exportOpen.value
}
const handleDocumentClick = (event) => {
  if (!exportMenuRef.value?.contains(event.target)) closeExportMenu()
}
onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))

const escapeHtml = (text = '') => String(text)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

const reportBodyHtml = () => {
  if (!cur.value) return ''
  const meta = `
    <div class="export-meta">
      <span>${escapeHtml(sysName.value)}</span>
      <span>${escapeHtml(cur.value.runName)}</span>
      <span>${escapeHtml(cur.value.createdAt)}</span>
    </div>
    <table class="export-info">
      <tr><th>测试任务创建者</th><td>${escapeHtml(cur.value.taskCreator || '—')}</td><th>报告生成者</th><td>${escapeHtml(cur.value.generatorName || '—')}</td></tr>
    </table>`
  return `<h1>${escapeHtml(cur.value.title)}</h1>${meta}${mdToHtml(store.reportMarkdown(cur.value, { includeTitle: false, includeMeta: false }))}`
}

const exportHtml = (mode = 'text') => {
  const isImageMode = mode === 'image'
  const body = isImageMode
    ? `<div class="pdf-shot"><div class="pdf-shot__badge">图片型 PDF</div>${reportBodyHtml()}</div>`
    : reportBodyHtml()
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(cur.value.title)}</title>
<style>
body{font-family:'Microsoft YaHei',sans-serif;line-height:1.8;color:#1f2937;padding:24px;}
h1{font-size:24px;text-align:center;border-bottom:3px solid #4a6bdf;padding-bottom:12px;}
h2{font-size:18px;color:#1e3a8a;border-left:4px solid #4a6bdf;padding-left:10px;}
table{border-collapse:collapse;width:100%;margin:12px 0;}th{background:#eff6ff;border:1px solid #d1d5db;padding:8px;text-align:left;}
td{border:1px solid #e5e7eb;padding:8px;}blockquote{border-left:4px solid #4a6bdf;background:#eef2ff;padding:10px 16px;}
.export-meta{display:flex;gap:8px;justify-content:center;color:#64748b;font-size:13px;margin:10px 0 16px;}
.export-info th{width:18%;}.export-info td{width:32%;}
.pdf-shot{background:#fff;border:1px solid #cbd5e1;box-shadow:0 10px 32px rgba(15,23,42,.12);padding:26px;}
.pdf-shot__badge{display:inline-block;margin-bottom:10px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:4px;padding:3px 8px;font-size:12px;}
@media print{body{padding:0;}button{display:none;}}
</style></head><body>${body}</body></html>`
}

const textEncoder = new TextEncoder()
const byteLength = (part) => (typeof part === 'string' ? textEncoder.encode(part).length : part.length)
const pdfBlob = (objects) => {
  const chunks = ['%PDF-1.4\n']
  const offsets = [0]
  let pos = byteLength(chunks[0])
  const push = (part) => {
    chunks.push(part)
    pos += byteLength(part)
  }
  objects.forEach((content, index) => {
    offsets[index + 1] = pos
    push(`${index + 1} 0 obj\n`)
    ;(Array.isArray(content) ? content : [content]).forEach(push)
    push('\nendobj\n')
  })
  const xrefAt = pos
  push(`xref\n0 ${objects.length + 1}\n`)
  push('0000000000 65535 f \n')
  for (let i = 1; i <= objects.length; i += 1) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`)
  return new Blob(chunks, { type: 'application/pdf' })
}
const downloadBlob = (fileName, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 800)
}
const displayWidth = (text) => Array.from(text).reduce((n, ch) => n + (/[\u0000-\u00ff]/.test(ch) ? 1 : 2), 0)
const wrapPlainLine = (text, maxWidth) => {
  const out = []
  let line = ''
  Array.from(text || '').forEach((ch) => {
    if (displayWidth(line + ch) > maxWidth && line) {
      out.push(line)
      line = ch
    } else {
      line += ch
    }
  })
  out.push(line)
  return out
}
const cleanMarkdownLine = (line) => line
  .replace(/^#+\s*/, '')
  .replace(/\*\*/g, '')
  .replace(/`/g, '')
  .replace(/\|/g, '  ')
  .replace(/---/g, '')
  .trim()
const reportTextLines = () => store.reportMarkdown(cur.value)
  .split('\n')
  .flatMap((line) => {
    const cleaned = cleanMarkdownLine(line)
    if (!cleaned) return ['']
    return wrapPlainLine(cleaned, 64)
  })
const utf16Hex = (text) => {
  let hex = ''
  for (let i = 0; i < text.length; i += 1) {
    hex += text.charCodeAt(i).toString(16).padStart(4, '0')
  }
  return hex.toUpperCase()
}
const textPdfBlob = () => {
  const pageW = 595
  const pageH = 842
  const marginX = 48
  const topY = 792
  const lineH = 17
  const bottomY = 50
  const pages = []
  let y = topY
  let commands = []
  reportTextLines().forEach((line, index) => {
    const isTitle = index === 0
    if (y < bottomY || (isTitle && commands.length)) {
      pages.push(commands.join('\n'))
      commands = []
      y = topY
    }
    const size = isTitle ? 18 : 11
    if (line) commands.push(`BT /F1 ${size} Tf 1 0 0 1 ${marginX} ${y} Tm <${utf16Hex(line)}> Tj ET`)
    y -= isTitle ? 26 : lineH
  })
  if (commands.length) pages.push(commands.join('\n'))

  const objects = [
    '',
    '',
    '<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [4 0 R] >>',
    '<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 2 >> /FontDescriptor 5 0 R /DW 1000 >>',
    '<< /Type /FontDescriptor /FontName /STSong-Light /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>'
  ]
  const pageIds = []
  pages.forEach((content) => {
    const contentBytes = textEncoder.encode(content)
    const pageId = objects.length + 1
    const contentId = objects.length + 2
    pageIds.push(pageId)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`)
    objects.push([`<< /Length ${contentBytes.length} >>\nstream\n`, content, '\nendstream'])
  })
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  return pdfBlob(objects)
}
const jpegBytes = (dataUrl) => {
  const binary = atob(dataUrl.split(',')[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}
const imagePdfBlob = () => {
  const pageW = 595
  const pageH = 842
  const canvasW = 1190
  const canvasH = 1684
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  const lines = reportTextLines().flatMap((line) => (line ? wrapPlainLine(line, 58) : ['']))
  const pages = []
  let index = 0
  while (index < lines.length) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasW, canvasH)
    ctx.fillStyle = '#1f2937'
    ctx.font = '24px Microsoft YaHei, sans-serif'
    let y = 84
    if (pages.length === 0) {
      ctx.font = '36px Microsoft YaHei, sans-serif'
      ctx.fillText(lines[index] || cur.value.title, 88, y)
      y += 44
      index += 1
      ctx.font = '24px Microsoft YaHei, sans-serif'
    }
    while (index < lines.length && y < canvasH - 80) {
      const line = lines[index]
      if (line) ctx.fillText(line, 88, y)
      y += 34
      index += 1
    }
    pages.push({ bytes: jpegBytes(canvas.toDataURL('image/jpeg', 0.92)), width: canvasW, height: canvasH })
  }

  const objects = ['', '']
  const pageIds = []
  pages.forEach((page) => {
    const pageId = objects.length + 1
    const contentId = objects.length + 2
    const imageId = objects.length + 3
    pageIds.push(pageId)
    const content = `q\n${pageW} 0 0 ${pageH} 0 0 cm\n/Im1 Do\nQ`
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    objects.push(`<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`)
    objects.push([`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`, page.bytes, '\nendstream'])
  })
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`
  return pdfBlob(objects)
}

const exportMd = () => {
  if (!cur.value) return
  downloadFile(`${cur.value.title}.md`, store.reportMarkdown(cur.value), 'text/markdown;charset=utf-8')
}
const exportDoc = () => {
  if (!cur.value) return
  downloadFile(`${cur.value.title}.doc`, exportHtml('text'), 'application/msword;charset=utf-8')
}
const exportPdf = (mode = 'text') => {
  if (!cur.value) return
  const suffix = mode === 'image' ? '图片型' : '文字型'
  downloadBlob(`${cur.value.title}-${suffix}.pdf`, mode === 'image' ? imagePdfBlob() : textPdfBlob())
}
const handleExportMd = () => {
  exportMd()
  closeExportMenu()
}
const handleExportDoc = () => {
  exportDoc()
  closeExportMenu()
}
const handleExportPdf = (mode) => {
  exportPdf(mode)
  closeExportMenu()
}
</script>

<style scoped lang="scss">
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.result-toolbar {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 12px;
}
.result-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; .el-icon { color: var(--el-color-primary); } }
.result-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.export-menu { position: relative; display: inline-flex; }
.export-menu__chevron { margin-left: 4px; font-size: 12px; }
.export-menu__panel {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 30;
  min-width: 150px; padding: 6px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
  background: var(--el-bg-color); box-shadow: 0 10px 28px rgba(15, 23, 42, .14);
}
.export-menu__item,
.export-menu__sub button {
  width: 100%; height: 32px; border: 0; border-radius: 6px; background: transparent; color: var(--el-text-color-regular);
  display: flex; align-items: center; gap: 8px; padding: 0 10px; font-size: 13px; text-align: left; cursor: pointer; white-space: nowrap;
}
.export-menu__item:hover,
.export-menu__sub button:hover { background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.export-menu__item--submenu { position: relative; justify-content: space-between; }
.export-menu__item--submenu::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 100%;
  bottom: -6px;
  width: 12px;
}
.export-menu__item-main { display: inline-flex; align-items: center; gap: 8px; }
.export-menu__arrow { margin-left: auto; color: var(--el-text-color-placeholder); font-size: 16px; line-height: 1; }
.export-menu__sub {
  display: none;
  position: absolute;
  right: 100%;
  top: -6px;
  z-index: 31;
  min-width: 132px;
  padding: 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: 0 10px 28px rgba(15, 23, 42, .14);
}
.export-menu__item--submenu:hover .export-menu__sub,
.export-menu__item--submenu:focus-within .export-menu__sub { display: block; }

.paper-scroll { flex: 1; min-height: 0; }
.paper {
  max-width: 820px; margin: 0 auto 48px; padding: 36px 44px; background: #fff;
  border-radius: 12px; box-shadow: 0 8px 28px rgba(0, 0, 0, .08); color: #1f2937;
}
.paper__title { text-align: center; font-size: 24px; margin: 0 0 8px; padding-bottom: 12px; border-bottom: 3px solid var(--el-color-primary); }
.paper__meta { display: flex; justify-content: center; gap: 8px; color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 24px; }
.paper-info {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 24px;
  div { border: 1px solid #dbeafe; background: #eff6ff; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; gap: 12px; }
  span { color: #2563eb; font-size: 12px; font-weight: 700; }
  strong { color: #111827; font-size: 13px; }
}
.sec { margin-bottom: 22px; }
.sec__head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-left: 10px; border-left: 3px solid var(--el-color-primary); }
.sec__title { font-size: 17px; font-weight: 600; color: #1e3a8a; }
.sec__spacer { flex: 1; }
.sec__edit :deep(textarea) { font-family: 'Consolas', monospace; font-size: 13px; }

.md { font-size: 14px; line-height: 1.8; }
.md :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.md :deep(th) { background: #eff6ff; color: #1e3a8a; border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
.md :deep(td) { border: 1px solid #e5e7eb; padding: 8px 12px; }
.md :deep(tr:nth-child(even) td) { background: #f9fafb; }
.md :deep(blockquote) { border-left: 4px solid var(--el-color-primary); background: #eef2ff; margin: 12px 0; padding: 10px 16px; border-radius: 0 6px 6px 0; }
.md :deep(ul) { padding-left: 24px; margin: 8px 0; }
.md :deep(strong) { color: #1f2937; font-weight: 700; }

@media (max-width: 720px) {
  .paper { padding: 28px 22px; }
  .paper-info { grid-template-columns: 1fr; }
}
</style>
