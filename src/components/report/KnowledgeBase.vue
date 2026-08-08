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
      <div class="document-table">
        <el-table :data="filteredDocs" height="100%" row-key="id" highlight-current-row @current-change="selectDoc">
          <el-table-column label="文档" min-width="150">
            <template #default="{ row }"><div class="doc-title"><el-icon :class="{ image: row.kind === 'image' }"><Picture v-if="row.kind === 'image'" /><Document v-else /></el-icon><span><strong>{{ row.title }}</strong><small>v{{ row.version || 1 }} · {{ row.type?.toUpperCase() }}</small></span></div></template>
          </el-table-column>
          <el-table-column label="知识集合" width="110" show-overflow-tooltip><template #default="{ row }">{{ collectionName(row.collectionId) }}</template></el-table-column>
          <el-table-column label="内容片段" width="82" align="center"><template #default="{ row }">{{ row.chunks?.length || 0 }}</template></el-table-column>
          <el-table-column prop="importedAt" label="更新时间" width="112" show-overflow-tooltip />
          <el-table-column label="状态" width="76"><template #default="{ row }"><el-tag size="small" :type="row.active ? 'success' : 'info'">{{ row.active ? '可引用' : '已停用' }}</el-tag></template></el-table-column>
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
      </el-tabs>
      <template v-if="inspectorTab === 'detail'">
        <div v-if="selectedDoc" class="doc-inspector">
          <div class="inspector-title"><span><el-icon><Document /></el-icon></span><div><strong>{{ selectedDoc.title }}</strong><small>{{ collectionName(selectedDoc.collectionId) }} · v{{ selectedDoc.version || 1 }}</small></div></div>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="知识集合">{{ collectionName(selectedDoc.collectionId) }}</el-descriptions-item>
            <el-descriptions-item label="文件类型">{{ selectedDoc.type?.toUpperCase() || '—' }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ selectedDoc.importedAt }}</el-descriptions-item>
          </el-descriptions>
          <div class="chunk-head"><strong>内容片段</strong><span>点击片段快速搜索相关内容</span></div>
          <el-scrollbar class="chunk-list">
            <button v-for="chunk in selectedDoc.chunks" :key="chunk.idx" type="button" class="chunk-card" @click="query = chunk.text.slice(0, 18); inspectorTab = 'search'; runSearch()"><b>#{{ String(chunk.idx).padStart(2, '0') }}</b><span>{{ chunk.text }}</span></button>
          </el-scrollbar>
        </div>
        <el-empty v-else description="选择文档查看内容" :image-size="76" />
      </template>
      <template v-else>
        <div class="retrieval-panel">
          <el-input v-model="query" type="textarea" :rows="3" placeholder="输入想查找的内容，例如：接口响应超时如何处置？" />
          <div class="search-options"><span>在当前知识范围内查找</span><el-button type="primary" :icon="Search" @click="runSearch">搜索知识</el-button></div>
          <el-scrollbar class="hit-list">
            <div v-for="(hit, index) in hits" :key="`${hit.docId}-${hit.idx}`" class="hit-card">
              <div class="hit-rank">{{ index + 1 }}</div>
              <div><p>{{ hit.text }}</p><footer><span>{{ hit.docTitle }} #{{ hit.idx }}</span><b>{{ Math.round(hit.score * 100) }}%</b></footer><el-progress :percentage="Math.round(hit.score * 100)" :stroke-width="4" :show-text="false" /></div>
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
import { Collection, Plus, Upload, Search, Picture, Document, MoreFilled, UploadFilled } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const store = useReportStore()
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
const confirmImport = () => {
  pendingFiles.value.forEach((file) => store.addKnowledgeDoc({ title: file.name, type: file.name.split('.').pop(), kind: kindOf(file.name), collectionId: importCollectionId.value, chunks: [{ idx: 1, text: `“${file.name}”的内容将在此展示，可用于知识搜索与报告引用。` }] }))
  importVisible.value = false
  ElMessage.success(`已添加 ${pendingFiles.value.length} 个文档`)
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
.doc-title { display: flex; align-items: center; gap: 8px; }.doc-title > .el-icon { color: #0f8b8d; font-size: 17px; }.doc-title > .el-icon.image { color: #c98212; }.doc-title span { min-width: 0; display: flex; flex-direction: column; }.doc-title strong, .doc-title small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.doc-title small { color: var(--el-text-color-secondary); font-size: 10px; }
.inspector-panel { padding: 0 13px 12px; display: flex; flex-direction: column; }.inspector-tabs { flex-shrink: 0; }.inspector-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }.inspector-tabs :deep(.el-tabs__content) { display: none; }
.doc-inspector, .retrieval-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; }.inspector-title { margin-bottom: 12px; display: flex; gap: 10px; align-items: center; }.inspector-title > span { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 7px; background: #e8f6f3; color: #0f8b8d; }.inspector-title div { min-width: 0; display: flex; flex-direction: column; }.inspector-title strong, .inspector-title small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.inspector-title small { color: var(--el-text-color-secondary); }
.chunk-head { margin: 15px 0 7px; display: flex; justify-content: space-between; }.chunk-head span { color: var(--el-text-color-secondary); font-size: 10px; }.chunk-list { flex: 1; min-height: 0; }.chunk-card { width: 100%; padding: 9px; display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 7px; border: 0; border-bottom: 1px solid var(--el-border-color-lighter); background: transparent; cursor: pointer; text-align: left; }.chunk-card:hover { background: #effafa; }.chunk-card b { color: #0f8b8d; font-size: 10px; }.chunk-card span { display: -webkit-box; overflow: hidden; color: var(--el-text-color-regular); font-size: 11px; line-height: 1.6; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.search-options { margin: 10px 0; display: flex; align-items: center; justify-content: space-between; }.search-options span { color: var(--el-text-color-secondary); font-size: 11px; }.hit-list { flex: 1; min-height: 0; margin-top: 2px; }.hit-card { padding: 9px 0; display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; border-bottom: 1px solid var(--el-border-color-lighter); }.hit-rank { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: #eef4ff; color: #2f6feb; font-size: 10px; font-weight: 700; }.hit-card p { margin: 0 0 5px; font-size: 11px; line-height: 1.55; }.hit-card footer { display: flex; justify-content: space-between; color: var(--el-text-color-secondary); font-size: 10px; }.hit-card footer b { color: #2f6feb; }
.hidden-input { display: none; }.file-picker { width: 100%; min-height: 88px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; border: 1px dashed #8ec6c7; border-radius: 8px; background: #f4fbfb; color: #0f8b8d; cursor: pointer; }.file-picker .el-icon { font-size: 24px; }.pending-files { max-height: 180px; overflow: auto; }.pending-files div { padding: 7px 9px; display: flex; justify-content: space-between; border-bottom: 1px solid var(--el-border-color-lighter); }
@media (max-width: 1280px) { .knowledge-studio { grid-template-columns: 200px minmax(360px, 1fr) 310px; } }
</style>
