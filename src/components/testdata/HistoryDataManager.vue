<template>
  <div class="asset-library" :class="`asset-library--${mode}`">
    <aside class="asset-tree">
      <el-input v-model="treeSearch" :prefix-icon="Search" clearable placeholder="搜索接口 / 报文" />
      <MonitorTree
        v-model="treeKey"
        :title="mode === 'excellent' ? '优秀报文接口树' : '历史报文接口树'"
        :search="treeSearch"
        :visible-groups="['system']"
        :iface-badge="ifaceBadge"
        :message-badge="messageBadge"
        readonly
        @select="onTreeSelect"
      />
    </aside>

    <section class="asset-main">
      <div class="filters">
        <el-select v-model="sourceFilter" clearable placeholder="来源" style="width: 130px">
          <el-option v-for="item in sources" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-if="mode === 'history'" v-model="excellentFilter" clearable placeholder="是否优秀" style="width: 120px">
          <el-option label="优秀" value="yes" /><el-option label="非优秀" value="no" />
        </el-select>
        <el-select v-model="abnormalFilter" clearable placeholder="异常状态" style="width: 120px">
          <el-option label="异常" value="yes" /><el-option label="正常" value="no" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 238px" />
        <el-select v-model="tagFilter" multiple collapse-tags collapse-tags-tooltip clearable placeholder="标签筛选" style="width: 190px">
          <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
        </el-select>
        <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="检索报文名、备注、标签" class="filters__search" />
      </div>

      <div class="quick-tags">
        <span>快捷标签</span>
        <button v-for="tag in allTags.slice(0, 8)" :key="tag" type="button" :class="{ active: tagFilter.includes(tag) }" @click="toggleFilterTag(tag)">
          {{ tag }}
        </button>
      </div>

      <div class="asset-table">
        <el-table ref="historyTableRef" :data="filteredRows" height="100%" row-key="_rowKey" @selection-change="onSelectionChange" @row-dblclick="openDetail" @scroll="onTableScroll">
          <el-table-column type="selection" width="44" class-name="selection-cell" label-class-name="selection-cell" />
          <el-table-column label="报文名" min-width="145" show-overflow-tooltip>
            <template #default="{ row }"><button class="message-link" type="button" @click="openDetail(row)">{{ row.messageName }}</button></template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建日期" width="104" />
          <el-table-column v-if="mode === 'history'" label="是否优秀" width="82" align="center">
            <template #default="{ row }">
              <el-switch :model-value="row.excellent" inline-prompt active-text="是" inactive-text="否" @change="toggleExcellent(row)" />
            </template>
          </el-table-column>
          <el-table-column prop="source" label="来源" width="94" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain" :type="sourceType(row.source)">{{ normalizeSource(row.source) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注信息" min-width="116" show-overflow-tooltip>
            <template #default="{ row }"><span :class="{ muted: !row.remark }">{{ row.remark || '暂无备注' }}</span></template>
          </el-table-column>
          <el-table-column label="标签" min-width="142">
            <template #default="{ row }">
              <div class="tag-cell tag-cell--table" :title="[...(row.abnormal ? ['异常'] : []), ...(row.customTags || [])].join('、')">
                <el-tag v-if="row.abnormal" size="small" type="danger" effect="dark"><el-icon><WarningFilled /></el-icon>异常</el-tag>
                <el-tag v-for="tag in row.customTags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
                <span v-if="!row.abnormal && !row.customTags?.length" class="muted">—</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" :width="mode === 'excellent' ? 132 : 104" fixed="right" align="center">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button link type="primary" @click="openDetail(row)">编辑</el-button>
                <el-button v-if="mode === 'excellent'" link type="warning" @click="toggleExcellent(row)">移出优秀</el-button>
                <el-popconfirm v-else title="确认删除该历史报文？" @confirm="removeRow(row)">
                  <template #reference><el-button link type="danger">删除</el-button></template>
                </el-popconfirm>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <button
          v-if="selectionAnchorKey && selectionRangeVisible"
          class="select-to-here"
          :class="`select-to-here--${selectionDirection}`"
          type="button"
          @click="selectToViewportEdge"
        >{{ selectionDirection === 'up' ? '↓' : '↑' }} 选择到这里</button>
      </div>

      <div class="batch-bar" :class="{ visible: selectedRows.length }">
        <span>已选 <b>{{ selectedRows.length }}</b> 条</span>
        <el-button size="small" :disabled="!selectedRows.length" @click="openBatchTags">批量加标签</el-button>
        <el-button v-if="mode === 'history'" size="small" type="warning" plain :disabled="!selectedRows.length" @click="markSelectedExcellent">标记优秀</el-button>
        <el-button size="small" type="success" plain :disabled="!selectedRows.length" @click="saveAsDataset">另存为数据集</el-button>
        <el-button size="small" type="primary" plain :disabled="!selectedRows.length" @click="sendSelected">直接发送</el-button>
        <el-button size="small" :disabled="!selectedRows.length" @click="exportSelected">导出</el-button>
        <el-button v-if="mode === 'excellent'" size="small" type="primary" :disabled="!selectedRows.length" @click="$emit('use-for-generation', selectedRows)">用于智能生成</el-button>
        <el-button size="small" :disabled="!selectedRows.length" @click="clearSelection">取消勾选</el-button>
      </div>
    </section>

    <el-drawer v-model="detailVisible" :title="detailRow?.messageName || '报文详情'" size="620px">
      <template v-if="detailRow">
        <div class="lineage">
          <span>来源</span><i /><span>{{ detailRow.source }}</span><i /><span>{{ detailRow._datasetName }}</span><i /><strong>{{ detailRow.messageName }}</strong>
        </div>
        <el-descriptions :column="2" border size="small" class="detail-meta">
          <el-descriptions-item label="创建日期">{{ detailRow.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="是否优秀">{{ detailRow.excellent ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ detailRow.source }}</el-descriptions-item>
          <el-descriptions-item label="实时结果"><el-tag :type="detailIsAbnormal ? 'danger' : 'success'" size="small">{{ detailIsAbnormal ? '异常' : '通过' }}</el-tag></el-descriptions-item>
          <el-descriptions-item v-if="detailRow.fileName" label="来源文件" :span="2">
            <el-button link type="primary" @click="openSourceFile(detailRow)">{{ detailRow.fileName }}</el-button>
          </el-descriptions-item>
        </el-descriptions>

        <h4>备注信息</h4>
        <el-input v-model="detailRemark" type="textarea" :rows="2" placeholder="补充报文用途、现场条件或复现说明" />

        <div class="detail-section-head">
          <h4>报文数据</h4>
          <el-tag :type="detailIsAbnormal ? 'danger' : 'success'" effect="plain">{{ detailIsAbnormal ? '字段校验异常' : '字段校验通过' }}</el-tag>
        </div>
        <el-table :data="detailFields" border size="small">
          <el-table-column prop="name" label="字段" min-width="130" />
          <el-table-column label="值" min-width="150">
            <template #default="{ row }"><el-input v-model="detailDraftValues[row.name]" size="small" /></template>
          </el-table-column>
          <el-table-column prop="constraint" label="约束" min-width="140" show-overflow-tooltip />
          <el-table-column label="结果" width="88">
            <template #default="{ row }">
              <el-tooltip v-if="row.issue" :content="row.issue.message" placement="top">
                <el-tag type="danger" size="small">异常</el-tag>
              </el-tooltip>
              <el-tag v-else type="success" size="small">通过</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <h4>标签</h4>
        <div class="tag-editor tag-editor--drawer">
          <div class="tag-cell tag-cell--detail">
            <el-tag v-if="detailIsAbnormal" type="danger" effect="dark">异常（系统）</el-tag>
            <el-tag v-for="tag in detailTags" :key="tag" closable @close="detailTags = detailTags.filter((item) => item !== tag)">{{ tag }}</el-tag>
          </div>
          <div class="tag-library">
            <span>标签库</span>
            <button v-for="tag in customTagLibrary" :key="tag" type="button" :class="{ selected: detailTags.includes(tag) }" @click="detailTags = appendTag(detailTags, tag)">{{ tag }}</button>
          </div>
          <div class="tag-editor__input">
            <el-input v-model="detailTagInput" placeholder="输入自定义标签" @keyup.enter="addDetailTag" />
            <el-button type="primary" plain @click="addDetailTag">添加</el-button>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDetail">保存修改</el-button>
      </template>
    </el-drawer>

    <el-dialog v-model="batchTagVisible" title="批量添加标签" width="460px">
      <div class="tag-editor">
        <div v-if="batchTags.length" class="tag-cell">
          <el-tag v-for="tag in batchTags" :key="tag" closable @close="batchTags = batchTags.filter((item) => item !== tag)">{{ tag }}</el-tag>
        </div>
        <div class="tag-library">
          <span>标签库</span>
          <button v-for="tag in customTagLibrary" :key="tag" type="button" :class="{ selected: batchTags.includes(tag) }" @click="batchTags = appendTag(batchTags, tag)">{{ tag }}</button>
          <em v-if="!customTagLibrary.length">暂无历史标签</em>
        </div>
        <div class="tag-editor__input">
          <el-input v-model="batchTagInput" placeholder="输入标签后按回车或点击添加" @keyup.enter="addBatchTag" />
          <el-button type="primary" plain @click="addBatchTag">添加</el-button>
        </div>
      </div>
      <template #footer><el-button @click="batchTagVisible = false">取消</el-button><el-button type="primary" :disabled="!batchTags.length && !batchTagInput.trim()" @click="confirmBatchTags">添加标签</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, WarningFilled } from '@element-plus/icons-vue'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import { useTestDataStore } from '@/stores/testData'
import { useExecutionStore } from '@/stores/execution'
import { useSystemStore } from '@/stores/system'
import { downloadBlob } from '@/services/testDataService'
import { checkFieldConstraints } from '@/utils/receiveValidator'

const props = defineProps({ mode: { type: String, default: 'history' } })
const emit = defineEmits(['use-for-generation', 'open-file'])
const store = useTestDataStore()
const executionStore = useExecutionStore()
const systemStore = useSystemStore()
const router = useRouter()

const sources = ['手动创建', '文件导入', '智能生成', '接收报文']
const legacySources = { 手动录入: '手动创建', 历史优秀案例: '手动创建' }
const normalizeSource = (value) => legacySources[value] || value || '手动创建'
const sourceType = (value) => ({ 手动创建: 'info', 文件导入: 'warning', 智能生成: 'success', 接收报文: 'primary' }[normalizeSource(value)] || 'info')
const openSourceFile = (row) => emit('open-file', { fileId: row.fileId, fileName: row.fileName })

const treeSearch = ref('')
const treeKey = ref('')
const selectedInterfaceId = ref(null)
const selectedMessageId = ref(null)
const sourceFilter = ref('')
const excellentFilter = ref('')
const abnormalFilter = ref('')
const dateRange = ref([])
const tagFilter = ref([])
const keyword = ref('')
const selectedRows = ref([])
const historyTableRef = ref(null)
const selectionAnchorKey = ref('')
const selectionRangeVisible = ref(false)
const selectionViewportTarget = ref(-1)
const viewportStart = ref(0)
const viewportEnd = ref(-1)
const selectionAnchorIndex = computed(() => filteredRows.value.findIndex((row) => row._rowKey === selectionAnchorKey.value))
const selectionDirection = computed(() => selectionAnchorIndex.value > viewportEnd.value && viewportEnd.value >= 0 ? 'up' : 'down')
const currentViewportTarget = computed(() => selectionDirection.value === 'up' ? viewportStart.value : viewportEnd.value)
const onSelectionChange = (rows) => {
  const previousKeys = new Set(selectedRows.value.map((row) => row._rowKey))
  selectedRows.value = rows
  if (!rows.length) {
    selectionAnchorKey.value = ''
    selectionRangeVisible.value = false
    selectionViewportTarget.value = -1
    return
  }
  if (selectionAnchorKey.value && rows.some((row) => row._rowKey === selectionAnchorKey.value)) return
  const newlySelected = rows.find((row) => !previousKeys.has(row._rowKey))
  selectionAnchorKey.value = (newlySelected || rows[0])._rowKey
  updateViewportRange()
  selectionRangeVisible.value = true
  selectionViewportTarget.value = currentViewportTarget.value
}
const updateViewportRange = () => {
  const root = historyTableRef.value?.$el
  const scrollWrap = root?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') || root?.querySelector('.el-scrollbar__wrap')
  const tbody = root?.querySelector('.el-table__body tbody')
  if (!scrollWrap || !tbody) {
    viewportStart.value = 0
    viewportEnd.value = filteredRows.value.length - 1
    return
  }
  const viewport = scrollWrap.getBoundingClientRect()
  const domRows = [...tbody.children].filter((item) => item.classList.contains('el-table__row'))
  let firstVisible = -1
  let lastVisible = -1
  domRows.forEach((row, index) => {
    const rect = row.getBoundingClientRect()
    if (rect.top < viewport.bottom && rect.bottom > viewport.top) {
      if (firstVisible < 0) firstVisible = index
      lastVisible = index
    }
  })
  viewportStart.value = firstVisible >= 0 ? firstVisible : 0
  viewportEnd.value = lastVisible >= 0 ? lastVisible : filteredRows.value.length - 1
}
const onTableScroll = () => {
  updateViewportRange()
  if (selectionAnchorKey.value && currentViewportTarget.value !== selectionViewportTarget.value) {
    selectionRangeVisible.value = true
  }
}
const selectToViewportEdge = () => {
  const anchorIndex = filteredRows.value.findIndex((row) => row._rowKey === selectionAnchorKey.value)
  updateViewportRange()
  const targetIndex = currentViewportTarget.value
  const direction = selectionDirection.value
  if (anchorIndex < 0 || targetIndex < 0) return
  const from = Math.min(anchorIndex, targetIndex)
  const to = Math.max(anchorIndex, targetIndex)
  filteredRows.value.slice(from, to + 1).forEach((row) => historyTableRef.value?.toggleRowSelection?.(row, true))
  selectionViewportTarget.value = targetIndex
  selectionRangeVisible.value = false
  ElMessage.success(`已选择到当前视口${direction === 'up' ? '首行' : '末行'}，共 ${to - from + 1} 条`)
}
const clearSelection = () => historyTableRef.value?.clearSelection?.()

const baseRows = computed(() => store.allHistoryData
  .map((row) => ({ ...row, _rowKey: `${row._datasetId}-${row.id}`, source: normalizeSource(row.source) }))
  .filter((row) => systemStore.currentId == null || row._systemId === systemStore.currentId)
  .filter((row) => props.mode !== 'excellent' || row.excellent))

const filteredRows = computed(() => baseRows.value.filter((row) => {
  if (selectedInterfaceId.value && String(row.interfaceId) !== String(selectedInterfaceId.value)) return false
  if (selectedMessageId.value && String(row.messageId) !== String(selectedMessageId.value)) return false
  if (sourceFilter.value && row.source !== sourceFilter.value) return false
  if (excellentFilter.value === 'yes' && !row.excellent) return false
  if (excellentFilter.value === 'no' && row.excellent) return false
  if (abnormalFilter.value === 'yes' && !row.abnormal) return false
  if (abnormalFilter.value === 'no' && row.abnormal) return false
  if (dateRange.value?.length === 2 && (row.createdAt < dateRange.value[0] || row.createdAt > dateRange.value[1])) return false
  if (tagFilter.value.length && !tagFilter.value.every((tag) => [...(row.customTags || []), ...(row.autoTags || [])].includes(tag))) return false
  const kw = keyword.value.trim().toLowerCase()
  if (kw && ![row.messageName, row.remark, ...(row.customTags || [])].some((value) => String(value || '').toLowerCase().includes(kw))) return false
  return true
}))

const customTagLibrary = computed(() => [...new Set([...(store.customTagLibrary || []), ...baseRows.value.flatMap((row) => row.customTags || [])])].sort())
const allTags = computed(() => [...customTagLibrary.value, ...(baseRows.value.some((row) => row.abnormal) ? ['异常'] : [])])
const ifaceBadge = (iface) => `${baseRows.value.filter((row) => String(row.interfaceId) === String(iface.id)).length} 条`
const messageBadge = (message) => `${baseRows.value.filter((row) => String(row.messageId) === String(message.id)).length} 条`
const onTreeSelect = (node) => {
  selectedInterfaceId.value = node.kind === 'iface' ? node.ref.id : null
  selectedMessageId.value = node.kind === 'message' ? node.ref.id : null
  if (node.kind === 'message') selectedInterfaceId.value = node.ref.ownerIfaceId || null
}
const toggleFilterTag = (tag) => { tagFilter.value = tagFilter.value.includes(tag) ? tagFilter.value.filter((item) => item !== tag) : [...tagFilter.value, tag] }

const toggleExcellent = (row) => {
  store.toggleExcellent(row._datasetId, row.id)
  ElMessage.success(row.excellent ? '已移出优秀数据库' : '已加入优秀数据库')
}
const removeRow = (row) => store.removeHistoryRow(row._datasetId, row.id)
const markSelectedExcellent = () => { store.setExcellentBatch(selectedRows.value, true); ElMessage.success(`已将 ${selectedRows.value.length} 条报文标记为优秀`) }

const appendTag = (list, value) => {
  const tag = String(value || '').trim()
  return tag && !list.includes(tag) ? [...list, tag] : list
}

const batchTagVisible = ref(false)
const batchTags = ref([])
const batchTagInput = ref('')
const addBatchTag = () => {
  const value = batchTagInput.value
  batchTags.value = appendTag(batchTags.value, value)
  store.registerCustomTags([value])
  batchTagInput.value = ''
}
const openBatchTags = () => { batchTags.value = []; batchTagInput.value = ''; batchTagVisible.value = true }
const confirmBatchTags = () => {
  batchTags.value = appendTag(batchTags.value, batchTagInput.value)
  if (!batchTags.value.length) return
  store.addTagsToHistory(selectedRows.value, batchTags.value)
  batchTagInput.value = ''
  batchTagVisible.value = false
  ElMessage.success('标签已添加')
}

const detailVisible = ref(false)
const detailRowKey = ref('')
const detailRow = computed(() => baseRows.value.find((row) => row._rowKey === detailRowKey.value) || null)
const detailDraftValues = ref({})
const detailOriginalValues = ref({})
const detailRemark = ref('')
const detailTags = ref([])
const detailTagInput = ref('')
const openDetail = (row) => {
  detailRowKey.value = row._rowKey
  detailDraftValues.value = JSON.parse(JSON.stringify(row.values || {}))
  detailOriginalValues.value = JSON.parse(JSON.stringify(row.values || {}))
  detailRemark.value = row.remark || ''
  detailTags.value = [...(row.customTags || [])]
  detailTagInput.value = ''
  detailVisible.value = true
}
const normalizedDetailValues = computed(() => Object.fromEntries(Object.entries(detailDraftValues.value).map(([key, value]) => {
  const original = detailOriginalValues.value[key]
  if (typeof original === 'number' && value !== '' && Number.isFinite(Number(value))) return [key, Number(value)]
  return [key, value]
})))
const detailFieldDefs = computed(() => detailRow.value ? store.fieldDefsOfDataset(detailRow.value._datasetId) : [])
const detailValidationIssues = computed(() => checkFieldConstraints(detailFieldDefs.value, normalizedDetailValues.value))
const detailIsAbnormal = computed(() => detailValidationIssues.value.length > 0)
const addDetailTag = () => {
  const value = detailTagInput.value
  detailTags.value = appendTag(detailTags.value, value)
  store.registerCustomTags([value])
  detailTagInput.value = ''
}
const saveDetail = () => {
  if (!detailRow.value) return
  detailTags.value = appendTag(detailTags.value, detailTagInput.value)
  store.updateHistoryRow(detailRow.value._datasetId, detailRow.value.id, {
    values: normalizedDetailValues.value,
    remark: detailRemark.value,
    customTags: detailTags.value,
  })
  detailTagInput.value = ''
  detailVisible.value = false
  ElMessage.success('报文数据、校验结果和标签已更新')
}
const constraintText = (constraint) => {
  if (!constraint?.mode) return '—'
  if (constraint.mode === 'range') return `${constraint.min ?? '—'} ~ ${constraint.max ?? '—'}`
  if (constraint.mode === 'fixed') return `固定 ${constraint.value}`
  if (constraint.mode === 'enum') return `枚举 ${(constraint.entries || []).map((item) => item.value ?? item).join('/')}`
  return constraint.mode
}
const detailFields = computed(() => {
  if (!detailRow.value) return []
  const defMap = Object.fromEntries(detailFieldDefs.value.map((item) => [item.name, item]))
  const issueMap = new Map(detailValidationIssues.value.map((issue) => [issue.field, issue]))
  return Object.entries(detailDraftValues.value).map(([name]) => ({
    name,
    constraint: constraintText(defMap[name]?.constraint),
    issue: issueMap.get(name) || null,
  }))
})

const saveAsDataset = async () => {
  try {
    const { value } = await ElMessageBox.prompt('输入新数据集名称', '另存为数据集', { inputValue: `${selectedRows.value[0]?.messageName || '历史报文'}复用集` })
    const sample = selectedRows.value[0]
    const sourceDs = store.datasets.find((d) => d.id === sample._datasetId)
    const ds = store.addDataset({ name: value, systemId: sample._systemId, moduleName: sample._moduleName, linkedInterface: sample.messageName, messageId: sample.messageId, linkedProtocol: sourceDs?.linkedProtocol })
    ds.rows = selectedRows.value.map((row, index) => ({ id: Date.now() + index, label: row.label, values: JSON.parse(JSON.stringify(row.values)), source: '历史复用' }))
    selectedRows.value.forEach((row) => store.updateHistoryRow(row._datasetId, row.id, { usageCount: Number(row.usageCount || 0) + 1, lastUsedAt: new Date().toLocaleString('zh-CN', { hour12: false }) }))
    ElMessage.success(`已创建数据集“${ds.name}”`)
  } catch {}
}
const sendSelected = async () => {
  const result = executionStore.prepareHistoryDirectSend(selectedRows.value)
  if (!result.ok) {
    const details = (result.rejected || [])
      .slice(0, 6)
      .map((item) => `• ${item.label}：${item.reason}`)
      .join('\n')
    await ElMessageBox.alert(
      [result.reason, details].filter(Boolean).join('\n\n'),
      '无法创建发送清单',
      { type: 'warning', confirmButtonText: '知道了' },
    )
    return
  }
  router.push({ path: '/execution', query: { mode: 'send', draftId: result.draft.id } })
}
const exportSelected = () => { const data = selectedRows.value.map(({ _rowKey, ...row }) => row); downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), `${props.mode === 'excellent' ? '优秀' : '历史'}报文.json`) }
</script>

<style scoped lang="scss">
.asset-library { --asset: #2f6feb; height: 100%; min-height: 0; display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 14px; }
.asset-library--excellent { --asset: #c98212; }
.asset-tree { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.asset-tree :deep(.mtree) { flex: 1; min-height: 0; }
.asset-main { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filters__search { flex: 1; min-width: 220px; }
.quick-tags { min-height: 28px; display: flex; align-items: center; gap: 7px; color: var(--el-text-color-secondary); font-size: 12px; }
.quick-tags button { padding: 3px 9px; border: 1px solid var(--el-border-color); border-radius: 12px; background: #fff; color: var(--el-text-color-regular); cursor: pointer; }
.quick-tags button:hover, .quick-tags button.active { border-color: var(--asset); color: var(--asset); background: color-mix(in srgb, var(--asset) 7%, white); }
.asset-table { position: relative; flex: 1; min-height: 0; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; overflow: hidden; }
.asset-table :deep(.selection-cell) { padding: 0 !important; }
.asset-table :deep(.selection-cell .cell) { width: 100%; height: 100%; min-height: 40px; padding: 0 !important; }
.asset-table :deep(.selection-cell .el-checkbox) { width: 100%; height: 100%; margin: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.select-to-here { position: absolute; z-index: 5; left: 12px; padding: 6px 11px; border: 1px solid var(--el-border-color); border-radius: 16px; background: rgba(255,255,255,.96); box-shadow: 0 2px 8px rgba(31,45,61,.12); color: var(--el-text-color-regular); cursor: pointer; font-size: 12px; }
.select-to-here--down { bottom: 14px; }
.select-to-here--up { top: 48px; }
.select-to-here:hover { border-color: var(--asset); color: var(--asset); background: #fff; }
.message-link { border: 0; padding: 0; background: none; color: var(--el-color-primary); cursor: pointer; font: inherit; font-weight: 600; }
.row-actions { display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }
.tag-cell { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.tag-cell :deep(.el-tag .el-icon) { margin-right: 3px; }
.tag-cell--table { display: block; width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tag-cell--table :deep(.el-tag) { margin-right: 5px; vertical-align: middle; }
.tag-cell--detail { padding: 10px; border: 1px dashed var(--el-border-color); border-radius: 7px; }
.muted { color: var(--el-text-color-placeholder); }
.batch-bar { min-height: 42px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; background: var(--el-fill-color-extra-light); opacity: .55; }
.batch-bar.visible { opacity: 1; border-color: color-mix(in srgb, var(--asset) 25%, #dfe5ec); }
.batch-bar > span { margin-right: auto; font-size: 12px; }
.lineage { margin-bottom: 16px; display: flex; align-items: center; gap: 7px; padding: 10px 12px; border-radius: 7px; background: var(--el-fill-color-light); color: var(--el-text-color-secondary); font-size: 12px; }
.lineage i { width: 18px; height: 1px; background: var(--el-border-color); }
.lineage strong { color: var(--asset); }
.detail-meta { margin-bottom: 20px; }
h4 { margin: 18px 0 10px; font-size: 14px; }
.detail-section-head { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; }
.detail-section-head h4 { margin: 0 0 10px; }
.form-hint { margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; }
.tag-editor { width: 100%; display: flex; flex-direction: column; gap: 9px; }
.tag-editor--drawer { padding-bottom: 8px; }
.tag-editor__input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.tag-library { padding: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; background: var(--el-fill-color-extra-light); }
.tag-library > span { margin-right: 2px; color: var(--el-text-color-secondary); font-size: 12px; }
.tag-library button { padding: 3px 8px; border: 1px solid var(--el-border-color); border-radius: 12px; background: #fff; color: var(--el-text-color-regular); cursor: pointer; font-size: 12px; }
.tag-library button:hover, .tag-library button.selected { border-color: var(--asset); background: color-mix(in srgb, var(--asset) 7%, white); color: var(--asset); }
.tag-library em { color: var(--el-text-color-placeholder); font-size: 12px; font-style: normal; }
@media (max-width: 1180px) { .asset-library { grid-template-columns: 226px minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .quick-tags button { transition: none; } }
</style>
