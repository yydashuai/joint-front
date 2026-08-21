<template>
  <div class="knowledge-studio">
    <aside class="collection-rail">
      <div class="collection-head">
        <div><span>知识集合</span><small>{{ store.knowledgeDocs.length }} 篇文档</small></div>
        <el-button circle size="small" :icon="Plus" @click="createCollection" />
      </div>
      <button type="button" class="collection-item" :class="{ active: !collectionId }" @click="collectionId = null">
        <span class="collection-dot collection-dot--all"><el-icon><Collection /></el-icon></span>
        <span><strong>全部知识</strong><small>跨集合统一检索</small></span><b>{{ store.knowledgeDocs.length }}</b>
      </button>
      <button v-for="item in store.knowledgeCollections" :key="item.id" type="button" class="collection-item" :class="{ active: collectionId === item.id }" @click="collectionId = item.id">
        <span class="collection-dot" :style="{ '--dot': item.color }" />
        <span><strong>{{ item.name }}</strong><small>{{ item.desc }}</small></span><b>{{ docCount(item.id) }}</b>
      </button>
    </aside>

    <section class="document-panel">
      <header class="document-head">
        <div><strong>{{ activeCollection?.name || '全部知识' }}</strong><span>{{ activeCollection?.desc || '统一管理实验规范、测试方法、历史报告和优秀案例' }}</span></div>
        <el-button type="primary" :icon="Upload" @click="openImport">添加资料</el-button>
      </header>
      <div class="document-tools">
        <el-input v-model="docKeyword" clearable :prefix-icon="Search" placeholder="搜索文档名称" />
        <el-select v-model="statusFilter" clearable placeholder="使用状态" style="width: 128px"><el-option label="可引用" value="active" /><el-option label="已停用" value="inactive" /></el-select>
      </div>
      <div v-if="refStats.length" class="ref-hotbar">
        <span>知识引用热榜</span>
        <button v-for="item in refStats.slice(0, 4)" :key="item.docId" type="button" @click="selectDocById(item.docId)">
          {{ item.docTitle }}<b>{{ item.count }}</b>
        </button>
        <small>按报告引用次数统计</small>
      </div>
      <div v-if="selectedDocs.length" class="doc-batchbar">
        <span>已选 <b>{{ selectedDocs.length }}</b> 篇</span>
        <el-button size="small" @click="batchToggle(true)">停止引用</el-button>
        <el-button size="small" @click="batchToggle(false)">恢复引用</el-button>
        <el-button size="small" type="danger" @click="batchRemove">删除</el-button>
        <el-button size="small" @click="clearDocSelection">取消选择</el-button>
      </div>
      <div class="document-table">
        <el-table :data="filteredDocs" height="100%" row-key="id" highlight-current-row @current-change="selectDoc" @selection-change="onDocSelection">
          <el-table-column type="selection" width="40" />
          <el-table-column label="文档" min-width="150">
            <template #default="{ row }"><div class="doc-title" :title="row.summary || row.title"><el-icon :class="{ image: row.kind === 'image', case: row.kind === 'case' }"><Picture v-if="row.kind === 'image'" /><Star v-else-if="row.kind === 'case'" /><Document v-else /></el-icon><span><strong>{{ row.title }}</strong><small>v{{ row.version || 1 }} · {{ docTypeLabel(row) }}</small></span></div></template>
          </el-table-column>
          <el-table-column label="知识集合" width="104" show-overflow-tooltip><template #default="{ row }">{{ collectionName(row.collectionId) }}</template></el-table-column>
          <el-table-column label="自动质量分" width="92" align="center">
            <template #default="{ row }">
              <el-tooltip :content="qualityHint(row)" placement="top">
                <span class="quality-score" :class="`quality-score--${qualityTone(row)}`">{{ qualityMeta(row).qualityScore }}</span>
              </el-tooltip>
            </template>
          </el-table-column>
          <el-table-column label="被引用" width="72" align="center">
            <template #default="{ row }">
              <el-tag v-if="docRefCount(row.id)" size="small" type="warning" effect="plain">{{ docRefCount(row.id) }}</el-tag>
              <span v-else class="muted">0</span>
            </template>
          </el-table-column>
          <el-table-column label="内容片段" width="78" align="center"><template #default="{ row }">{{ row.chunks?.length || 0 }}</template></el-table-column>
          <el-table-column prop="importedAt" label="更新时间" width="150" show-overflow-tooltip />
          <el-table-column label="状态" width="96"><template #default="{ row }"><el-tag size="small" :type="row.active ? 'success' : 'info'">{{ row.active ? '可引用' : '已停用' }}</el-tag></template></el-table-column>
          <el-table-column label="操作" width="52" align="center">
            <template #default="{ row }">
              <el-dropdown trigger="click" @command="(command) => handleDocCommand(command, row)">
                <el-button link :icon="MoreFilled" />
                <template #dropdown><el-dropdown-menu><el-dropdown-item command="replace">更新文件</el-dropdown-item><el-dropdown-item command="toggle">{{ row.active ? '停止引用' : '恢复引用' }}</el-dropdown-item><el-dropdown-item command="delete" divided>删除</el-dropdown-item></el-dropdown-menu></template>
              </el-dropdown>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <aside class="inspector-panel">
      <el-tabs v-model="inspectorTab" class="inspector-tabs">
        <el-tab-pane label="内容预览" name="detail" />
        <el-tab-pane label="搜索验证" name="search" />
        <el-tab-pane label="关联图谱" name="graph" />
      </el-tabs>
      <template v-if="inspectorTab === 'detail'">
        <div v-if="selectedDoc" class="doc-inspector">
          <div class="inspector-title"><span><el-icon><Document /></el-icon></span><div><strong>{{ selectedDoc.title }}</strong><small>{{ collectionName(selectedDoc.collectionId) }} · v{{ selectedDoc.version || 1 }}</small></div></div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="知识集合">{{ collectionName(selectedDoc.collectionId) }}</el-descriptions-item>
            <el-descriptions-item label="文件类型">{{ selectedDoc.type?.toUpperCase() || '—' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ selectedDoc.importedAt }}</el-descriptions-item>
            <el-descriptions-item label="自动质量分"><span class="quality-inline"><b>{{ qualityMeta(selectedDoc).qualityScore }}</b> · {{ qualityMeta(selectedDoc).status }}</span></el-descriptions-item>
            <el-descriptions-item label="自动引用率">{{ qualityMeta(selectedDoc).citationCount }} / {{ qualityMeta(selectedDoc).candidateCount }}（{{ qualityMeta(selectedDoc).citationRate }}%）</el-descriptions-item>
            <el-descriptions-item label="最近引用">{{ qualityMeta(selectedDoc).lastCitationAt || '尚未引用' }}</el-descriptions-item>
          </el-descriptions>
          <div v-if="selectedDoc.summary" class="summary-card">
            <span class="summary-card__label">内容摘要</span>
            <p>{{ selectedDoc.summary }}</p>
          </div>
          <div class="chunk-head"><strong>内容片段</strong><span>点击片段快速搜索相关内容</span></div>
          <el-scrollbar class="chunk-list">
            <button v-for="chunk in selectedDoc.chunks" :key="chunk.idx" type="button" class="chunk-card" @click="query = chunk.text.slice(0, 18); inspectorTab = 'search'; runSearch()">
              <b class="chunk-card__idx">#{{ String(chunk.idx).padStart(2, '0') }}</b>
              <span class="chunk-card__body">
                <span v-if="chunk.heading" class="chunk-card__heading">{{ chunk.heading }}</span>
                <span class="chunk-card__text">{{ chunk.text }}</span>
              </span>
              <em class="chunk-card__type">{{ chunk.type || '段落' }}</em>
            </button>
          </el-scrollbar>
        </div>
        <el-empty v-else description="选择文档查看内容" :image-size="76" />
      </template>
      <template v-else-if="inspectorTab === 'graph'">
        <div v-if="selectedDoc" class="graph-panel">
          <div class="graph-panel__title"><strong>知识关联图谱</strong><small>与接口 / 报文 / 报告 / 数据集的关系</small></div>
          <svg viewBox="0 0 320 268" class="graph-svg" role="img" aria-label="知识关联图谱">
            <line v-for="n in graph.nodes" :key="`l-${n.id}`" :x1="160" :y1="134" :x2="n.x" :y2="n.y" stroke="#c9d8ec" stroke-width="1" />
            <g v-for="n in graph.nodes" :key="n.id" class="graph-node" @click="jumpTo(n)">
              <circle :cx="n.x" :cy="n.y" r="17" :fill="n.color" />
              <text :x="n.x" :y="n.y + 4" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">{{ n.short }}</text>
              <text :x="n.x" :y="n.y + 34" text-anchor="middle" fill="#64748b" font-size="10">{{ n.kindLabel }}</text>
            </g>
            <circle cx="160" cy="134" r="30" fill="#0f8b8d" />
            <text x="160" y="130" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">{{ graph.docShort }}</text>
            <text x="160" y="144" text-anchor="middle" fill="#d8f3ef" font-size="9">知识文档</text>
          </svg>
          <div v-if="!graph.nodes.length" class="graph-empty">暂未匹配到关联对象，可在文档正文中提及接口 / 报文名以建立关联</div>
          <div class="graph-meta">
            <span>被报告引用 <b>{{ graph.refCount }}</b> 篇</span>
            <span>关联对象 <b>{{ graph.nodes.length }}</b> 个</span>
            <el-button v-if="graph.nodes.length" link type="primary" size="small" @click="exportGraph">导出关联清单</el-button>
          </div>
        </div>
        <el-empty v-else description="选择文档查看关联" :image-size="60" />
      </template>
      <template v-else>
        <div class="retrieval-panel">
          <el-input v-model="query" type="textarea" :rows="3" placeholder="输入想查找的内容，例如：接口响应超时如何处置？" />
          <div class="search-options"><span>在当前知识范围内查找</span><el-button type="primary" :icon="Search" @click="runSearch">搜索知识</el-button></div>
          <el-scrollbar class="hit-list">
            <div v-for="(hit, index) in hits" :key="`${hit.docId}-${hit.idx}`" class="hit-card">
              <div class="hit-rank">{{ index + 1 }}</div>
              <div>
                <p>{{ hit.text }}</p>
                <footer><span>{{ hit.docTitle }} #{{ hit.idx }}</span><b>{{ Math.round(hit.score * 100) }}%</b></footer>
                <el-progress :percentage="Math.round(hit.score * 100)" :stroke-width="4" :show-text="false" />
              </div>
            </div>
            <el-empty v-if="!hits.length" :description="query ? '暂无命中片段' : '输入问题验证检索效果'" :image-size="58" />
          </el-scrollbar>
        </div>
      </template>
    </aside>

    <el-dialog v-model="importVisible" title="添加知识资料" width="620px">
      <input ref="fileInput" class="hidden-input" type="file" multiple accept=".pdf,.doc,.docx,.md,.csv,.txt,.png,.jpg,.jpeg" @change="onFiles" />
      <el-form label-width="90px">
        <el-form-item label="知识集合"><el-select v-model="importCollectionId" style="width: 100%"><el-option v-for="item in store.knowledgeCollections" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
        <el-form-item label="选择文件"><div class="file-picker" @click="fileInput?.click()"><el-icon><UploadFilled /></el-icon><span>{{ pendingFiles.length ? `已选择 ${pendingFiles.length} 个文件` : '点击选择 PDF、Word、Markdown、文本或图片' }}</span></div></el-form-item>
      </el-form>
      <div v-if="pendingFiles.length" class="pending-files"><div v-for="file in pendingFiles" :key="file.name"><span>{{ file.name }}</span><el-tag size="small" effect="plain">{{ file.name.split('.').pop()?.toUpperCase() }}</el-tag></div></div>
      <template #footer><el-button @click="importVisible = false">取消</el-button><el-button type="primary" :disabled="!pendingFiles.length" @click="confirmImport">添加到知识库</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Collection, Plus, Upload, Search, Picture, Document, Star, MoreFilled, UploadFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '@/stores/report'
import { useProtocolStore } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { parseDoc } from '@/utils/docParser'

const store = useReportStore()
const router = useRouter()
const protoStore = useProtocolStore()
const tdStore = useTestDataStore()
const collectionId = ref(null)
const docKeyword = ref('')
const statusFilter = ref('')
const selectedDoc = ref(store.knowledgeDocs[0] || null)
const inspectorTab = ref('detail')
const query = ref('')
const hits = ref([])

const activeCollection = computed(() => store.knowledgeCollections.find((item) => item.id === collectionId.value))
const docCount = (id) => store.knowledgeDocs.filter((doc) => doc.collectionId === id).length
const collectionName = (id) => store.knowledgeCollections.find((item) => item.id === id)?.name || '未分类'
// A-2：优秀案例卡（kind='case'）类型展示
const docTypeLabel = (doc) => doc.kind === 'case' ? '优秀案例' : (doc.type?.toUpperCase() || '—')

/* ---------- K2：知识引用热榜 / K3：批量管理 ---------- */
const refStats = computed(() => store.knowledgeRefStats)
const docRefCount = (id) => refStats.value.find((item) => item.docId === id)?.count || 0
const qualityMeta = (doc) => store.knowledgeQualityOfDoc(doc.id)
const qualityTone = (doc) => {
  const meta = qualityMeta(doc)
  if (meta.status === '低利用') return 'low'
  if (meta.status === '稳定') return 'stable'
  return 'learning'
}
const qualityHint = (doc) => {
  const meta = qualityMeta(doc)
  return `${meta.status} · 报告引用 ${meta.citationCount} / 候选曝光 ${meta.candidateCount} · 最近引用 ${meta.lastCitationAt || '暂无'}`
}
const selectDocById = (docId) => {
  const doc = store.knowledgeDocs.find((item) => item.id === docId)
  if (doc) {
    selectedDoc.value = doc
    inspectorTab.value = 'detail'
  }
}
const selectedDocs = ref([])
const onDocSelection = (rows) => { selectedDocs.value = rows }
const batchToggle = (toInactive) => {
  const target = toInactive ? false : true
  const count = selectedDocs.value.length
  selectedDocs.value.forEach((doc) => { doc.active = target })
  clearDocSelection()
  ElMessage.success(toInactive ? `已停止 ${count} 篇文档引用` : `已恢复 ${count} 篇文档引用`)
}
const batchRemove = async () => {
  const count = selectedDocs.value.length
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${count} 篇文档吗？删除后不可恢复。`, '批量删除文档', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    selectedDocs.value.forEach((doc) => store.removeKnowledgeDoc(doc.id))
    clearDocSelection()
    ElMessage.success(`已删除 ${count} 篇文档`)
  } catch {}
}
const clearDocSelection = () => { selectedDocs.value = [] }

/* ---------- B-2：知识关联图谱 ---------- */
const KIND_LABEL = { message: '报文', iface: '接口', report: '报告', dataset: '数据集' }
const KIND_COLOR = { message: '#2f6bff', iface: '#c98212', report: '#6d5ce7', dataset: '#0f8b8d' }
const graph = computed(() => {
  const doc = selectedDoc.value
  if (!doc) return { nodes: [], refCount: 0, docShort: '' }
  const hay = [doc.title, ...(doc.chunks || []).map((c) => c.text)].join(' ')
  const nodes = []
  const push = (id, label, kind, to) => {
    if (nodes.length >= 6) return
    nodes.push({ id, label, kind, kindLabel: KIND_LABEL[kind], color: KIND_COLOR[kind], to })
  }
  // 1) 报文：名称出现在标题或正文
  protoStore.interfaces.forEach((m) => {
    if (m.name && hay.includes(m.name) && !nodes.some((n) => n.id === `m-${m.id}`)) {
      push(`m-${m.id}`, m.name, 'message', { path: '/protocol', query: { kind: 'interface', iface: String(m.id) } })
    }
  })
  // 2) 优秀案例卡：关联接口
  if (doc.kind === 'case' && doc.interfaceId) {
    const iface = protoStore.testInterfaces.find((i) => String(i.id) === String(doc.interfaceId))
    if (iface) push(`i-${iface.id}`, iface.name, 'iface', { path: '/protocol', query: { kind: 'interface', iface: String(iface.id) } })
  }
  // 3) 报告引用
  const refs = store.reports.filter((r) => (r.knowledgeCitations || []).some((c) => c.docId === doc.id))
  refs.slice(0, 2).forEach((r) => push(`r-${r.id}`, r.title, 'report', { path: '/report' }))
  // 4) 数据集：linkedInterface 与文档标题匹配
  tdStore.datasets.forEach((ds) => {
    if (ds.linkedInterface && ds.linkedInterface === doc.title.replace(/\.\w+$/, '')) {
      push(`d-${ds.id}`, ds.name, 'dataset', { path: '/test-data' })
    }
  })
  // 计算星形坐标
  const cx = 160
  const cy = 134
  const radius = 92
  nodes.forEach((n, i) => {
    const angle = (Math.PI * 2 * i) / nodes.length - Math.PI / 2
    n.x = Math.round(cx + radius * Math.cos(angle))
    n.y = Math.round(cy + radius * Math.sin(angle))
    n.short = n.label.length > 4 ? `${n.label.slice(0, 4)}…` : n.label
  })
  return { nodes, refCount: refs.length, docShort: doc.title.length > 6 ? `${doc.title.slice(0, 6)}…` : doc.title }
})
const jumpTo = (node) => {
  if (node.to) router.push(node.to)
}
const exportGraph = () => {
  const lines = ['关联对象,类型', ...graph.value.nodes.map((n) => `${n.label},${n.kindLabel}`)]
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `关联清单_${selectedDoc.value?.title || '文档'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
const filteredDocs = computed(() => store.knowledgeDocs.filter((doc) => {
  if (collectionId.value && doc.collectionId !== collectionId.value) return false
  if (docKeyword.value && !doc.title.toLowerCase().includes(docKeyword.value.toLowerCase())) return false
  if (statusFilter.value === 'active' && !doc.active) return false
  if (statusFilter.value === 'inactive' && doc.active) return false
  return true
}))
watch(filteredDocs, (docs) => {
  if (!docs.some((doc) => doc.id === selectedDoc.value?.id)) selectedDoc.value = docs[0] || null
}, { immediate: true })
const selectDoc = (doc) => { if (doc) { selectedDoc.value = doc; inspectorTab.value = 'detail' } }
const createCollection = async () => {
  try {
    const { value } = await ElMessageBox.prompt('输入知识集合名称', '新建知识集合')
    if (!value?.trim()) return
    const item = { id: `kc-${Date.now()}`, name: value.trim(), color: '#0f8b8d', desc: '用户创建的知识集合' }
    store.knowledgeCollections.push(item)
    collectionId.value = item.id
  } catch {}
}
const handleDocCommand = async (command, doc) => {
  if (command === 'replace') { store.replaceKnowledgeDoc(doc.id); ElMessage.success(`文件已更新为 v${doc.version}`) }
  if (command === 'toggle') { store.toggleKnowledgeDoc(doc.id); ElMessage.success(doc.active ? '已恢复引用' : '已停止引用') }
  if (command === 'delete') store.removeKnowledgeDoc(doc.id)
}

const runSearch = () => {
  if (!query.value.trim()) {
    ElMessage.warning('请输入要查找的内容')
    return
  }
  const ids = collectionId.value ? [collectionId.value] : null
  hits.value = store.searchKnowledge(query.value, ids, 5)
}
const importVisible = ref(false)
const importCollectionId = ref('kc-standard')
const fileInput = ref(null)
const pendingFiles = ref([])
const openImport = () => { importCollectionId.value = collectionId.value || store.knowledgeCollections[0]?.id; pendingFiles.value = []; importVisible.value = true }
const onFiles = (event) => { pendingFiles.value = [...event.target.files] }
const kindOf = (name) => /\.(png|jpe?g)$/i.test(name) ? 'image' : 'file'
// B1/B4：文本类文件读取原文 → 结构化解析分块（标题/表格/列表感知 + 块级关键词）并生成摘要；非文本给占位说明
const confirmImport = async () => {
  const files = [...pendingFiles.value]
  const count = files.length
  for (const file of files) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    const isText = ['txt', 'md', 'csv', 'json', 'log'].includes(ext)
    let summary = ''
    let chunks = []
    if (isText) {
      try {
        const content = await file.text()
        const parsed = parseDoc(content)
        summary = parsed.summary || file.name
        chunks = parsed.chunks
      } catch (e) { /* 读取失败则走占位分支 */ }
    }
    if (!chunks.length) {
      summary = summary || `本文件为 ${ext ? ext.toUpperCase() : '未知'} 格式，建议在知识模型中补充解析以预览内容。`
      chunks = [{ idx: 1, text: `“${file.name}”已入库，可用于知识检索与报告引用。` }]
    }
    store.addKnowledgeDoc({ title: file.name, type: ext, kind: kindOf(file.name), collectionId: importCollectionId.value, summary, chunks })
  }
  importVisible.value = false
  pendingFiles.value = []
  ElMessage.success(`已添加 ${count} 个文档`)
}
</script>

<style scoped lang="scss">
.knowledge-studio { height: 100%; min-height: 0; display: grid; grid-template-columns: 220px minmax(440px, 1fr) 380px; gap: 12px; }
.collection-rail, .document-panel, .inspector-panel { min-height: 0; border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: #fff; overflow: hidden; }
.collection-rail { padding: 12px 9px; display: flex; flex-direction: column; gap: 6px; }
.collection-head { padding: 0 5px 9px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--el-border-color-lighter); }
.collection-head div { display: flex; flex-direction: column; gap: 2px; }.collection-head small { color: var(--el-text-color-secondary); }
.collection-item { width: 100%; padding: 9px 7px; display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 7px; align-items: center; border: 1px solid transparent; border-radius: 7px; background: transparent; cursor: pointer; text-align: left; }
.collection-item:hover { background: #f5f8fb; }
.collection-item.active { border-color: #bdd0f5; background: #eef4ff; }
.collection-item > span:nth-child(2) { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.collection-item strong, .collection-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.collection-item small { color: var(--el-text-color-secondary); font-size: 10px; }.collection-item b { min-width: 22px; color: #2f6feb; text-align: center; }
.collection-dot { width: 10px; height: 10px; margin-left: 6px; border-radius: 3px; background: var(--dot); }.collection-dot--all { width: 24px; height: 24px; margin: 0; display: grid; place-items: center; background: #e6f5f5; color: #0f8b8d; }
.document-panel { display: flex; flex-direction: column; }
.document-head { padding: 13px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--el-border-color-lighter); }.document-head div { display: flex; flex-direction: column; gap: 3px; }.document-head strong { font-size: 15px; }.document-head span { color: var(--el-text-color-secondary); font-size: 11px; }
.document-tools { padding: 10px 12px; display: grid; grid-template-columns: minmax(0, 1fr) 128px; gap: 8px; }.document-table { flex: 1; min-height: 0; }
.ref-hotbar { padding: 6px 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--el-border-color-lighter); background: #fdf6ec; }
.ref-hotbar > span { color: #a15c07; font-size: 12px; font-weight: 700; }
.ref-hotbar button { padding: 3px 9px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid #f0d9b5; border-radius: 12px; background: #fff; color: var(--el-text-color-regular); cursor: pointer; font-size: 11px; }
.ref-hotbar button b { color: #c98212; }
.ref-hotbar small { color: var(--el-text-color-secondary); font-size: 10px; margin-left: auto; }
.doc-batchbar { padding: 7px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--el-border-color-lighter); background: var(--el-fill-color-extra-light); }
.doc-batchbar > span { margin-right: auto; font-size: 12px; }
.doc-title { display: flex; align-items: center; gap: 8px; }.doc-title > .el-icon { color: #0f8b8d; font-size: 17px; }.doc-title > .el-icon.image { color: #c98212; }.doc-title > .el-icon.case { color: #c98212; }.doc-title span { min-width: 0; display: flex; flex-direction: column; }.doc-title strong, .doc-title small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.doc-title small { color: var(--el-text-color-secondary); font-size: 10px; }
.quality-score { display: inline-grid; min-width: 38px; height: 24px; padding: 0 7px; place-items: center; border: 1px solid #b7d9d5; border-radius: 12px; background: #eef9f7; color: #0f766e; cursor: help; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
.quality-score--stable { border-color: #91d5ad; background: #eefaf3; color: #16794a; }
.quality-score--low { border-color: #efc0b8; background: #fff3f1; color: #b54736; }
.quality-inline b { color: #0f8b8d; font-size: 14px; }
.inspector-panel { padding: 0 13px 12px; display: flex; flex-direction: column; }.inspector-tabs { flex-shrink: 0; }.inspector-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }.inspector-tabs :deep(.el-tabs__content) { display: none; }
.doc-inspector, .retrieval-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }.inspector-title { margin-bottom: 12px; display: flex; gap: 10px; align-items: center; }.inspector-title > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: #e8f6f3; color: #0f8b8d; }.inspector-title div { min-width: 0; display: flex; flex-direction: column; }.inspector-title strong, .inspector-title small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.inspector-title small { color: var(--el-text-color-secondary); }
.chunk-head { margin: 15px 0 7px; display: flex; justify-content: space-between; }.chunk-head span { color: var(--el-text-color-secondary); font-size: 10px; }.chunk-list { flex: 1; min-height: 0; }.chunk-card { width: 100%; padding: 9px; display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 7px; border: 0; border-bottom: 1px solid var(--el-border-color-lighter); background: transparent; cursor: pointer; text-align: left; }.chunk-card:hover { background: #effafa; }.chunk-card__idx { color: #0f8b8d; font-size: 10px; }.chunk-card__body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }.chunk-card__heading { overflow: hidden; color: #0f8b8d; font-size: 11px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }.chunk-card__text { display: -webkit-box; overflow: hidden; color: var(--el-text-color-regular); font-size: 11px; line-height: 1.6; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }.chunk-card__type { color: var(--el-text-color-placeholder); font-size: 10px; white-space: nowrap; }
.search-options { margin: 10px 0; display: flex; align-items: center; justify-content: space-between; }.search-options span { color: var(--el-text-color-secondary); font-size: 11px; }.hit-list { flex: 1; min-height: 0; margin-top: 2px; }.hit-card { padding: 9px 0; display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; border-bottom: 1px solid var(--el-border-color-lighter); }.hit-rank { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: #eef4ff; color: #2f6feb; font-size: 10px; font-weight: 700; }.hit-card p { margin: 0 0 5px; font-size: 11px; line-height: 1.55; }.hit-card footer { display: flex; justify-content: space-between; color: var(--el-text-color-secondary); font-size: 10px; }.hit-card footer b { color: #2f6feb; }
.hidden-input { display: none; }.file-picker { width: 100%; min-height: 88px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; border: 1px dashed #8ec6c7; border-radius: 8px; background: #f4fbfb; color: #0f8b8d; cursor: pointer; }.file-picker .el-icon { font-size: 24px; }.pending-files { max-height: 180px; overflow: auto; }.pending-files div { padding: 7px 9px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--el-border-color-lighter); }
.summary-card { margin-top: 12px; padding: 9px 11px; border: 1px solid #bfe6e0; border-left: 3px solid #0f8b8d; border-radius: 7px; background: #f2fbfa; }
.summary-card__label { display: block; margin-bottom: 4px; color: #0f8b8d; font-size: 11px; font-weight: 700; }
.summary-card p { margin: 0; color: var(--el-text-color-regular); font-size: 12px; line-height: 1.6; }
.graph-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.graph-panel__title { margin-bottom: 4px; display: flex; flex-direction: column; gap: 2px; }.graph-panel__title strong { font-size: 13px; }.graph-panel__title small { color: var(--el-text-color-secondary); font-size: 10px; }
.graph-svg { width: 100%; height: auto; }.graph-node { cursor: pointer; }.graph-node circle { transition: opacity .15s; }.graph-node:hover circle { opacity: .75; }
.graph-empty { padding: 12px 0; color: var(--el-text-color-placeholder); font-size: 11px; text-align: center; }
.graph-meta { margin-top: 2px; padding-top: 8px; display: flex; align-items: center; gap: 14px; border-top: 1px solid var(--el-border-color-lighter); color: var(--el-text-color-secondary); font-size: 11px; }.graph-meta b { color: #0f8b8d; }.graph-meta .el-button { margin-left: auto; }
@media (max-width: 1280px) { .knowledge-studio { grid-template-columns: 200px minmax(360px, 1fr) 310px; } }
</style>
