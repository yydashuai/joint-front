// 轻量 Markdown → HTML（支持标题、表格、列表、粗体、斜体、行内代码、引用、段落）
// 用于联试报告预览，无需引入第三方依赖。
export function mdToHtml(md) {
  const lines = (md || '').split('\n')
  let html = ''
  let inTable = false
  let inList = false

  const closeList = () => { if (inList) { html += '</ul>'; inList = false } }
  const closeTable = () => { if (inTable) { html += '</tbody></table>'; inTable = false } }

  const inline = (s) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map((c) => c.trim())
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue // 分隔行
      if (!inTable) {
        closeList()
        html += '<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
        inTable = true
      } else {
        html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>'
      }
      continue
    } else if (inTable) {
      closeTable()
    }

    if (!line) { closeList(); continue }

    if (line.startsWith('### ')) { closeList(); html += `<h3>${inline(line.slice(4))}</h3>` }
    else if (line.startsWith('## ')) { closeList(); html += `<h2>${inline(line.slice(3))}</h2>` }
    else if (line.startsWith('# ')) { closeList(); html += `<h1>${inline(line.slice(2))}</h1>` }
    else if (line.startsWith('> ')) { closeList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>` }
    else if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`
    } else if (/^\d+\.\s+/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true }
      html += `<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`
    } else { closeList(); html += `<p>${inline(line)}</p>` }
  }
  closeList()
  closeTable()
  return html
}

// 触发浏览器下载（纯前端）
export function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
