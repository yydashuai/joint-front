<template>
  <div class="kb">
    <!-- 左：知识文档 -->
    <el-card class="kb__docs" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header>
        <div class="card-head">
          <span>知识文档 <span class="muted">· 全工具统一</span></span>
          <div class="head-stat">
            <el-tag size="small" effect="plain">{{ docs.length }} 篇</el-tag>
            <el-tag size="small" effect="plain" type="success">已向量化 {{ vectorizedCount }}</el-tag>
            <el-tag size="small" effect="plain" type="info">{{ chunkCount }} 片段</el-tag>
            <el-tooltip content="导入知识文档到知识库"><el-button type="primary" size="small" :icon="Upload" @click="openImport">导入文档</el-button></el-tooltip>
          </div>
        </div>
      </template>

      <el-scrollbar class="kb__scroll">
        <el-table
          :data="docs"
          size="small"
          row-key="id"
          :expand-row-keys="expanded"
          @expand-change="onExpand"
          @row-click="onRowClick"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="chunks">
                <div v-for="c in row.chunks" :key="c.idx" class="chunk">
                  <span class="chunk__idx">#{{ c.idx }}</span>
                  <span class="chunk__text">{{ c.text }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="文档" min-width="220">
            <template #default="{ row }">
              <el-icon class="doc-icon" :class="{ 'is-image': row.kind === 'image' }">
                <Picture v-if="row.kind === 'image'" /><Document v-else />
              </el-icon>
              <span class="doc-name">{{ row.title }}</span>
              <el-tag size="small" effect="plain" :type="row.kind === 'image' ? 'warning' : 'info'" class="kind-tag">
                {{ row.kind === 'image' ? '图片型' : '文件型' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="片段" width="64" align="center">
            <template #default="{ row }">{{ row.chunks.length }}</template>
          </el-table-column>
          <el-table-column label="向量化状态" width="130" align="center">
            <template #default="{ row }">
              <el-tag :type="vecMeta(row.vectorized).type" size="small" effect="light">
                <el-icon v-if="row.vectorized === 'processing'" class="is-loading"><Loading /></el-icon>
                {{ vecMeta(row.vectorized).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="导入时间" width="140" align="center">
            <template #default="{ row }"><span class="muted">{{ row.importedAt }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-tooltip content="对该文档进行向量化处理">
                <el-button
                  v-if="row.vectorized !== 'done' && row.vectorized !== 'processing'"
                  size="small" text type="primary" :icon="Refresh" @click.stop="vectorize(row)"
                >向量化</el-button>
              </el-tooltip>
              <el-popconfirm title="删除该文档？" @confirm="store.removeKnowledgeDoc(row.id)">
                <template #reference><el-button size="small" text :icon="Delete" @click.stop /></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!docs.length" description="暂无知识文档，所有用户均可导入" :image-size="70" />
      </el-scrollbar>
    </el-card>

    <!-- 右：混合检索测试（统一知识库内） -->
    <el-card class="kb__search" shadow="never" :body-style="{ padding: '14px 16px', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header><div class="card-head"><span>混合检索测试</span><span class="muted">统一知识库 · 关键词 + 向量融合</span></div></template>
      <el-input v-model="query" placeholder="输入查询，如 武器载荷 超时" :prefix-icon="Search" clearable @input="onSearch" @keyup.enter="onSearch" />
      <el-scrollbar class="kb__hits">
        <div v-if="hits.length" class="hits">
          <div v-for="(h, i) in hits" :key="h.docId + '-' + h.idx" class="hit">
            <div class="hit__rank">{{ i + 1 }}</div>
            <div class="hit__main">
              <div class="hit__text">{{ h.text }}</div>
              <div class="hit__meta">
                <span class="hit__src">{{ h.docTitle }} #{{ h.idx }}</span>
                <span>关键词 {{ h.kw }}</span><span>向量 {{ h.vec }}</span>
                <span class="hit__score">融合 <b>{{ h.score }}</b></span>
              </div>
              <el-progress :percentage="Math.round(h.score * 100)" :stroke-width="4" :show-text="false" />
            </div>
          </div>
        </div>
        <el-empty v-else :description="query ? '无命中片段' : '输入查询测试检索效果'" :image-size="56" />
      </el-scrollbar>
    </el-card>

    <!-- 导入文档对话框（支持批量） -->
    <el-dialog v-model="importVisible" title="导入知识文档" width="600px" @closed="resetImport">
      <!-- 隐藏的原生文件选择器（呼出资源管理器，多选） -->
      <input
        ref="fileInput" type="file" multiple class="kb-hidden-input"
        accept=".pdf,.doc,.docx,.md,.markdown,.csv,.txt,.png,.jpg,.jpeg,.bmp,.tiff"
        @change="onFileChange"
      />

      <!-- 空态：拾取区 -->
      <div v-if="!files.length" class="picker" @click="openFilePicker">
        <el-icon class="picker__icon"><UploadFilled /></el-icon>
        <div class="picker__title">点击此处选择文件（可多选）</div>
        <div class="picker__hint">支持 PDF / Word / Markdown / CSV / TXT / 图片</div>
        <el-button type="primary" :icon="FolderOpened" @click.stop="openFilePicker">浏览文件…</el-button>
      </div>

      <!-- 已选文件：逐个设置导入类型 -->
      <template v-else>
        <div class="import-bar">
          <span>已选 <b>{{ files.length }}</b> 个文件</span>
          <div class="import-bar__right">
            <template v-if="pdfCount > 1">
              <span class="muted">PDF 批量设为</span>
              <el-button-group>
                <el-button size="small" @click="bulkSetPdf('file')">文件型</el-button>
                <el-button size="small" @click="bulkSetPdf('image')">图片型</el-button>
              </el-button-group>
            </template>
            <el-button size="small" :icon="FolderOpened" @click="openFilePicker">继续添加</el-button>
            <el-popconfirm title="确认清空所有已选文件？" @confirm="clearFiles">
              <template #reference><el-button size="small" text type="danger">清空</el-button></template>
            </el-popconfirm>
          </div>
        </div>

        <el-scrollbar max-height="320px">
          <div class="file-list">
            <div v-for="(f, i) in files" :key="f.uid" class="file-row">
              <el-icon class="file-row__icon" :class="{ 'is-image': f.kind === 'image' }">
                <component :is="f.kind === 'image' ? Picture : Document" />
              </el-icon>
              <div class="file-row__info">
                <div class="file-row__name" :title="f.name">{{ f.name }}</div>
                <div class="file-row__sub">{{ prettySize(f.size) }} · {{ f.ext.toUpperCase() || '未知' }}</div>
              </div>
              <el-radio-group v-model="f.kind" size="small" class="file-row__kind">
                <el-radio-button value="file" :disabled="f.locked && f.kind !== 'file'">文件型</el-radio-button>
                <el-radio-button value="image" :disabled="f.locked && f.kind !== 'image'">图片型</el-radio-button>
              </el-radio-group>
              <el-popconfirm title="移除该文件？" @confirm="removeFile(i)">
                <template #reference><el-button class="file-row__del" text :icon="Delete" /></template>
              </el-popconfirm>
            </div>
          </div>
        </el-scrollbar>

        <div class="kind-hint">
          <el-icon><InfoFilled /></el-icon>
          <span>文件型：提取文字后分块向量化；图片型：先 OCR 识别再向量化。PDF 默认文件型，扫描件请改为图片型。</span>
        </div>
      </template>

      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!files.length" @click="confirmImport">
          导入{{ files.length ? `（${files.length}）` : '' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Upload, Document, Refresh, Delete, Search, Loading,
  Picture, UploadFilled, FolderOpened, InfoFilled
} from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const store = useReportStore()

const docs = computed(() => store.knowledgeDocs)
const vectorizedCount = computed(() => docs.value.filter((d) => d.vectorized === 'done').length)
const chunkCount = computed(() => docs.value.reduce((n, d) => n + d.chunks.length, 0))

const expanded = ref([])
const onExpand = (row, rows) => { expanded.value = rows.map((r) => r.id) }
const onRowClick = (row, column) => {
  if (column?.type === 'expand') return
  const i = expanded.value.indexOf(row.id)
  if (i >= 0) expanded.value.splice(i, 1)
  else expanded.value.push(row.id)
}

const vecMeta = (s) => ({
  done: { text: '已向量化', type: 'success' },
  pending: { text: '待处理', type: 'warning' },
  processing: { text: '处理中', type: 'primary' },
  failed: { text: '失败可重试', type: 'danger' }
}[s] || { text: '未知', type: 'info' })

const vectorize = async (row) => {
  const ok = await store.vectorize(row.id)
  ok ? ElMessage.success(`「${row.title}」向量化完成`) : ElMessage.error('向量化失败，请重试')
}

/* —— 导入文档（支持批量，逐文件设类型） —— */
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'tiff']
const TEXT_EXTS = ['md', 'markdown', 'csv', 'txt', 'doc', 'docx']

const importVisible = ref(false)
const fileInput = ref(null)
const files = ref([])
let fileSeq = 0

const extOf = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '')
const prettySize = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
// 纯图片 / 纯文本格式可直接判定并锁定；PDF 需用户确认（可能是文本，也可能是扫描件）
const wrapFile = (raw) => {
  const ext = extOf(raw.name)
  const locked = IMAGE_EXTS.includes(ext) || TEXT_EXTS.includes(ext)
  return { uid: ++fileSeq, name: raw.name, size: raw.size, ext, locked, kind: IMAGE_EXTS.includes(ext) ? 'image' : 'file' }
}
const pdfCount = computed(() => files.value.filter((f) => f.ext === 'pdf').length)

const openImport = () => { importVisible.value = true }
const openFilePicker = () => fileInput.value?.click()

const onFileChange = (e) => {
  const picked = Array.from(e.target.files || [])
  if (picked.length) files.value.push(...picked.map(wrapFile))
  if (fileInput.value) fileInput.value.value = '' // 允许再次选择同名文件
}
const removeFile = (i) => files.value.splice(i, 1)
const clearFiles = () => { files.value = [] }
// PDF 批量设置类型（仅作用于未锁定的 PDF）
const bulkSetPdf = (kind) => files.value.forEach((f) => { if (f.ext === 'pdf') f.kind = kind })

const buildChunks = (isImage) => isImage
  ? [
      { idx: 1, text: '（OCR 识别后自动分块）已从图片 / 扫描件提取的第 1 个知识片段。' },
      { idx: 2, text: '（OCR 识别后自动分块）已从图片 / 扫描件提取的第 2 个知识片段。' }
    ]
  : [
      { idx: 1, text: '（提取文字后自动分块）该文档第 1 个知识片段示例内容。' },
      { idx: 2, text: '（提取文字后自动分块）该文档第 2 个知识片段示例内容。' }
    ]

const confirmImport = () => {
  if (!files.value.length) return
  const imageCount = files.value.filter((f) => f.kind === 'image').length
  files.value.forEach((f) => {
    store.addKnowledgeDoc({ title: f.name, type: f.ext, kind: f.kind, chunks: buildChunks(f.kind === 'image') })
  })
  ElMessage.success(`已导入 ${files.value.length} 个文档（文件型 ${files.value.length - imageCount} · 图片型 ${imageCount}）`)
  importVisible.value = false
}

const resetImport = () => {
  files.value = []
  if (fileInput.value) fileInput.value.value = ''
}

const query = ref('')
const hits = ref([])
let timer = null
const onSearch = () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    hits.value = query.value.trim() ? store.searchKnowledge(query.value, null, 8) : []
  }, 200)
}
</script>

<style scoped lang="scss">
.kb { display: flex; gap: 16px; height: 100%; min-height: 0; }
.kb__docs { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.kb__search { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.head-stat { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.kb__scroll { flex: 1; min-height: 0; }
.doc-icon { color: var(--el-color-primary); vertical-align: middle; margin-right: 6px; }
.doc-icon.is-image { color: var(--el-color-warning); }
.doc-name { vertical-align: middle; }
.kind-tag { margin-left: 8px; vertical-align: middle; }

/* 导入对话框 */
.kb-hidden-input { display: none; }
.picker {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 26px 16px; border: 1px dashed var(--el-border-color);
  border-radius: 10px; cursor: pointer; text-align: center;
  background: var(--el-fill-color-blank);
  transition: border-color .2s, background .2s;
}
.picker:hover { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.picker.is-picked { border-style: solid; }
.picker__icon { font-size: 36px; color: var(--el-color-primary); }
.picker__icon.picked { color: var(--el-color-success); }
.picker__title { font-size: 14px; font-weight: 600; }
.picker__file { max-width: 100%; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker__hint { font-size: 12px; color: var(--el-text-color-secondary); }

.import-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-bottom: 10px; font-size: 13px;
}
.import-bar b { color: var(--el-color-primary); }
.import-bar__right { display: flex; align-items: center; gap: 8px; }

.file-list { display: flex; flex-direction: column; gap: 8px; }
.file-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px; background: var(--el-fill-color-blank);
}
.file-row__icon { font-size: 20px; color: var(--el-color-primary); flex-shrink: 0; }
.file-row__icon.is-image { color: var(--el-color-warning); }
.file-row__info { flex: 1; min-width: 0; }
.file-row__name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-row__sub { font-size: 11px; color: var(--el-text-color-secondary); }
.file-row__kind { flex-shrink: 0; }
.file-row__del { flex-shrink: 0; }

.kind-hint {
  display: flex; align-items: center; gap: 6px; margin-top: 10px;
  font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5;
}
.kind-hint .el-icon { color: var(--el-color-primary); flex-shrink: 0; }

.chunks { padding: 6px 12px; display: flex; flex-direction: column; gap: 6px; }
.chunk { display: flex; gap: 8px; font-size: 12.5px; line-height: 1.6; }
.chunk__idx { color: var(--el-color-primary); flex-shrink: 0; }
.chunk__text { color: var(--el-text-color-regular); }

.kb__hits { flex: 1; min-height: 0; margin-top: 12px; }
.hits { display: flex; flex-direction: column; gap: 10px; }
.hit { display: flex; gap: 10px; padding: 10px; background: var(--el-fill-color-lighter); border-radius: 8px; }
.hit__rank {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  background: var(--el-color-primary); color: #fff; font-size: 12px;
  display: flex; align-items: center; justify-content: center; font-weight: 600;
}
.hit__main { min-width: 0; flex: 1; }
.hit__text { font-size: 13px; line-height: 1.6; }
.hit__meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 6px; font-size: 11px; color: var(--el-text-color-placeholder); }
.hit__src { color: var(--el-color-primary); }
.hit__score b { color: var(--el-color-danger); }
</style>
