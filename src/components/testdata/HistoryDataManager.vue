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
        <el-select v-model="activeViewId" clearable placeholder="筛选视图" style="width: 126px" @change="onLoadView">
          <el-option v-for="v in modeViews" :key="v.id" :label="v.name" :value="v.id" />
        </el-select>
        <el-button size="small" @click="saveView">存视图</el-button>
        <el-button v-if="activeViewId" size="small" text type="danger" @click="removeView">删除</el-button>
        <el-select v-model="sourceFilter" clearable placeholder="来源" style="width: 130px">
          <el-option v-for="item in sources" :key="item" :label="item" :value="item" />
        </el-select>
        <el-select v-if="mode === 'history'" v-model="excellentFilter" clearable placeholder="是否优秀" style="width: 120px">
          <el-option label="优秀" value="yes" /><el-option label="非优秀" value="no" />
        </el-select>
        <el-select v-if="mode === 'excellent'" v-model="scenarioFilter" clearable placeholder="认证场景" style="width: 150px">
          <el-option v-for="s in scenarioOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="abnormalFilter" clearable placeholder="异常状态" style="width: 120px">
          <el-option label="异常" value="yes" /><el-option label="正常" value="no" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width: 238px" />
        <el-select v-if="mode === 'excellent'" v-model="sortMode" style="width: 160px">
          <el-option label="按结构匹配度排序" value="match" />
          <el-option label="按引用热度排序" value="rate" />
          <el-option label="按创建时间排序" value="created" />
        </el-select>
        <el-select v-model="tagFilter" multiple collapse-tags collapse-tags-tooltip clearable placeholder="标签筛选" style="width: 190px">
          <el-option v-for="tag in allTags" :key="tag" :label="tag" :value="tag" />
        </el-select>
        <el-input v-model="keyword" :prefix-icon="Search" clearable placeholder="检索报文名、备注、标签" class="filters__search" />
        <el-button v-if="selectedMessageId || selectedInterfaceId" size="small" type="primary" plain @click="clearTreeFilter">查看全部</el-button>
      </div>

      <div class="quick-tags">
        <span>快捷标签</span>
        <button v-for="tag in allTags.slice(0, 8)" :key="tag" type="button" :class="{ active: tagFilter.includes(tag) }" @click="toggleFilterTag(tag)">
          {{ tag }}
        </button>
      </div>

      <!-- E1：认证复审提醒 -->
      <div v-if="mode === 'excellent' && overdueRows.length" class="review-banner">
        <el-icon><WarningFilled /></el-icon>
        <span>{{ overdueRows.length }} 条优秀报文认证已过期，建议复审</span>
        <el-button link type="primary" size="small" @click="openDetail(overdueRows[0])">前往复审</el-button>
      </div>

      <div v-if="mode === 'excellent' && recommendRows.length" class="reco-bar">
        <span class="reco-bar__title">{{ hasRecommendContext ? '相似推荐' : '热门推荐' }}</span>
        <button v-for="row in recommendRows" :key="row._rowKey" type="button" class="reco-card" @click="openDetail(row)">
          <strong>{{ row.messageName }}</strong>
          <span class="reco-card__score">{{ hasRecommendContext ? `结构匹配度 ${matchScore(row)}%` : `引用热度 ${matchScore(row)}%` }}</span>
          <span v-if="hasRecommendContext && recommendMatchedFields(row).length" class="reco-card__matched">匹配字段：{{ recommendMatchedFields(row).join('、') }}</span>
          <span class="reco-card__meta">引用 {{ row.usageCount || 0 }} 次 · 最近复用 {{ row.lastUsedAt || '—' }}</span>
        </button>
      </div>

      <div class="asset-table">
        <el-table ref="historyTableRef" :data="filteredRows" height="100%" row-key="_rowKey" @selection-change="onSelectionChange" @row-dblclick="openDetail" @scroll="onTableScroll">
          <el-table-column type="selection" width="44" class-name="selection-cell" label-class-name="selection-cell" />
          <el-table-column label="报文名" min-width="145" show-overflow-tooltip>
            <template #default="{ row }"><button class="message-link" type="button" @click="openDetail(row)">{{ row.messageName }}</button></template>
          </el-table-column>
          <el-table-column prop="source" label="来源" width="94" align="center">
            <template #default="{ row }">
              <el-tag size="small" effect="plain" :type="sourceType(row.source)">{{ normalizeSource(row.source) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="mode === 'history'" label="是否优秀" width="82" align="center">
            <template #default="{ row }">
              <el-switch :model-value="row.excellent" inline-prompt active-text="是" inactive-text="否" @change="(v) => onExcellentSwitch(row, v)" />
            </template>
          </el-table-column>
          <el-table-column label="标签" min-width="142">
            <template #default="{ row }">
              <div class="tag-cell tag-cell--table" :title="[...(row.abnormal ? ['异常'] : []), ...(row.customTags || [])].join('、')">
                <el-tag v-if="row.abnormal" size="small" type="danger" effect="dark"><el-icon><WarningFilled /></el-icon>异常</el-tag>
                <el-tag v-if="mode === 'excellent' && row.certification" size="small" :type="isOverdue(row) ? 'warning' : 'success'" effect="dark"><el-icon><Stamp /></el-icon>{{ isOverdue(row) ? '待复审' : '已认证' }}</el-tag>
                <el-tag v-for="tag in row.customTags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
                <span v-if="!row.abnormal && !row.certification && !row.customTags?.length" class="muted">—</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注信息" min-width="116" show-overflow-tooltip>
            <template #default="{ row }"><span :class="{ muted: !row.remark }">{{ row.remark || '暂无备注' }}</span></template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建日期" width="104" />
          <el-table-column v-if="mode === 'excellent'" label="认证" width="86" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.certification" size="small" :type="isOverdue(row) ? 'warning' : 'success'" effect="plain">{{ isOverdue(row) ? '待复审' : '已认证' }}</el-tag>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column v-if="mode === 'excellent'" label="引用" width="64" align="center">
            <template #default="{ row }"><span class="muted-num">{{ row.usageCount || 0 }}</span></template>
          </el-table-column>
          <el-table-column v-if="mode === 'excellent'" label="最近复用" width="104" prop="lastUsedAt" />
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
        <el-button v-if="mode === 'history'" size="small" type="warning" plain :disabled="!selectedRows.length" @click="openBatchCertify">标记优秀</el-button>
        <el-button size="small" type="success" plain :disabled="!selectedRows.length" @click="saveAsDataset">另存为数据集</el-button>
        <el-button size="small" type="primary" plain :disabled="!selectedRows.length" @click="sendSelected">直接发送</el-button>
        <el-dropdown trigger="click" @command="onExportCommand">
          <el-button size="small" :disabled="!selectedRows.length && !filteredRows.length">导出<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="selected-json" :disabled="!selectedRows.length">选中行（JSON）</el-dropdown-item>
              <el-dropdown-item command="selected-csv" :disabled="!selectedRows.length">选中行（CSV）</el-dropdown-item>
              <el-dropdown-item command="filtered-json" :disabled="!filteredRows.length">当前筛选全部（JSON）</el-dropdown-item>
              <el-dropdown-item command="filtered-csv" :disabled="!filteredRows.length">当前筛选全部（CSV）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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
          <el-descriptions-item v-if="detailRow.updatedAt" label="最近修改">{{ detailRow.updatedAt }}（{{ detailRow.updatedBy || '—' }}）</el-descriptions-item>
          <el-descriptions-item label="来源">{{ detailRow.source }}</el-descriptions-item>
          <el-descriptions-item label="实时结果"><el-tag :type="detailIsAbnormal ? 'danger' : 'success'" size="small">{{ detailIsAbnormal ? '异常' : '通过' }}</el-tag></el-descriptions-item>
          <el-descriptions-item v-if="detailRow.fileName" label="来源文件" :span="2">
            <el-button link type="primary" @click="openSourceFile(detailRow)">{{ detailRow.fileName }}</el-button>
          </el-descriptions-item>
        </el-descriptions>

        <h4>备注信息</h4>
        <el-input v-model="detailRemark" type="textarea" :rows="2" placeholder="补充报文用途、现场条件或复现说明" />

        <h4>优秀认证</h4>
        <div v-if="detailRow.certification" class="cert-box">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="认证人">{{ detailRow.certification.certifier }}</el-descriptions-item>
            <el-descriptions-item label="认证时间">{{ detailRow.certification.certTime }}</el-descriptions-item>
            <el-descriptions-item label="复审截止">{{ detailRow.reviewDueAt || '—' }}</el-descriptions-item>
            <el-descriptions-item label="达标指标">{{ detailRow.certification.criteria }}</el-descriptions-item>
            <el-descriptions-item label="适用场景">{{ detailRow.certification.scenario }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ detailRow.certification.remark || '—' }}</el-descriptions-item>
          </el-descriptions>
          <div class="cert-actions">
            <el-button link type="primary" size="small" @click="openCertify(detailRow)">编辑认证</el-button>
            <el-button link type="success" size="small" @click="reviewCurrent">复审通过</el-button>
          </div>
        </div>
        <el-empty v-else description="尚未认证为优秀" :image-size="48" />

        <h4>复用足迹</h4>
        <div class="reuse-foot">
          <div class="reuse-foot__item"><span>被引用</span><b>{{ detailRow.usageCount || 0 }}</b><small>次</small></div>
          <div class="reuse-foot__item"><span>最近复用</span><b class="reuse-foot__time">{{ detailRow.lastUsedAt || '—' }}</b></div>
          <div class="reuse-foot__item"><span>知识沉淀</span><b class="reuse-foot__kb" @click="openKnowledgeCase(detailRow)">{{ detailRow.caseDocId ? '查看案例卡' : '生成案例卡' }}</b></div>
        </div>

        <template v-if="mode === 'excellent'">
          <h4>相似推荐</h4>
          <div class="drawer-reco">
            <template v-if="drawerRecommendRows.length">
              <button v-for="row in drawerRecommendRows" :key="row._rowKey" type="button" class="reco-card reco-card--drawer" @click="openDetail(row)">
                <strong>{{ row.messageName }}</strong>
                <span class="reco-card__score">结构匹配度 {{ drawerMatchScore(row) }}%</span>
                <span v-if="drawerMatchedFields(row).length" class="reco-card__matched">匹配字段：{{ drawerMatchedFields(row).join('、') }}</span>
                <span class="reco-card__meta">引用 {{ row.usageCount || 0 }} 次 · 最近复用 {{ row.lastUsedAt || '—' }}</span>
              </button>
            </template>
            <p v-else class="drawer-reco__empty">暂无结构相近的优秀样本</p>
          </div>
        </template>

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

    <!-- A1：优秀认证表单 -->
    <el-dialog v-model="certVisible" :title="certIsBatch ? '批量认证为优秀' : '认证为优秀报文'" width="480px">
      <el-form label-width="84px">
        <el-form-item label="认证人" required>
          <el-input v-model="certForm.certifier" placeholder="如：张工" />
        </el-form-item>
        <el-form-item label="达标指标">
          <el-input v-model="certForm.criteria" type="textarea" :rows="2" placeholder="如：字段完整率100%，联试通过率≥95%" />
        </el-form-item>
        <el-form-item label="适用场景">
          <el-input v-model="certForm.scenario" placeholder="如：联试系统回归基线" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="certForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="certVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCertify">确认认证</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, WarningFilled, Stamp, ArrowDown } from '@element-plus/icons-vue'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import { useTestDataStore } from '@/stores/testData'
import { useExecutionStore } from '@/stores/execution'
import { useSystemStore } from '@/stores/system'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { useReportStore } from '@/stores/report'
import { downloadBlob } from '@/services/testDataService'
import { checkFieldConstraints } from '@/utils/receiveValidator'

const props = defineProps({ mode: { type: String, default: 'history' } })
const emit = defineEmits(['use-for-generation', 'open-file'])
const store = useTestDataStore()
const executionStore = useExecutionStore()
const systemStore = useSystemStore()
const protoStore = useProtocolStore()
const reportStore = useReportStore()
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
// H1：筛选视图
const activeViewId = ref('')
// E4：认证场景分组筛选
const scenarioFilter = ref('')
// A-1：优秀视图排序模式（'match' 结构匹配度 / 'rate' 引用热度 / 'created' 创建时间）
const sortMode = ref('match')
// A1：优秀认证表单状态
const certVisible = ref(false)
const certIsBatch = ref(false)
const certTarget = ref(null)
const certForm = ref({ certifier: '', criteria: '', scenario: '', remark: '' })
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

const filteredRows = computed(() => {
  const rows = baseRows.value.filter((row) => {
    if (selectedInterfaceId.value && String(row.interfaceId) !== String(selectedInterfaceId.value)) return false
    if (selectedMessageId.value && String(row.messageId) !== String(selectedMessageId.value)) return false
    if (sourceFilter.value && row.source !== sourceFilter.value) return false
    if (excellentFilter.value === 'yes' && !row.excellent) return false
    if (excellentFilter.value === 'no' && row.excellent) return false
    if (abnormalFilter.value === 'yes' && !row.abnormal) return false
    if (abnormalFilter.value === 'no' && row.abnormal) return false
    if (dateRange.value?.length === 2 && (row.createdAt < dateRange.value[0] || row.createdAt > dateRange.value[1])) return false
    if (tagFilter.value.length && !tagFilter.value.every((tag) => [...(row.customTags || []), ...(row.autoTags || [])].includes(tag))) return false
    if (props.mode === 'excellent' && scenarioFilter.value && row.certification?.scenario !== scenarioFilter.value) return false
    const kw = keyword.value.trim().toLowerCase()
    if (kw && ![row.messageName, row.remark, ...(row.customTags || [])].some((value) => String(value || '').toLowerCase().includes(kw))) return false
    return true
  })
  // A-1：优秀视图按所选维度排序（结构匹配度 / 引用热度 / 创建时间）
  if (props.mode === 'excellent') {
    if (sortMode.value === 'created') rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    else rows.sort((a, b) => sortValue(b) - sortValue(a))
  }
  return rows
})

// A-1：字段结构相似度推荐（纯客观：字段名 Jaccard + 约束模式匹配；不含任何收发结果指标）
const fieldProfileOf = (row) => {
  if (row._fieldProfile) return row._fieldProfile
  const profile = store.fieldDefsOfDataset(row._datasetId).map((f) => ({
    name: f.name,
    mode: f.constraint?.mode || 'none',
  }))
  row._fieldProfile = profile
  return profile
}
const structureSimilarity = (leftProfile, rightProfile) => {
  const union = new Set([...leftProfile.map((f) => f.name), ...rightProfile.map((f) => f.name)])
  if (!union.size) return 0
  let inter = 0
  leftProfile.forEach((f) => {
    const rb = rightProfile.find((x) => x.name === f.name)
    if (rb) inter += rb.mode === f.mode ? 1.5 : 1
  })
  return Math.min(100, Math.round((inter / union.size) * 100))
}
const matchScore = (row) => {
  const targetProfile = currentTargetProfile()
  if (!targetProfile) {
    // 无上下文：按引用热度（相对全局最大引用次数的归一化，0~100%）
    return hotScore(row)
  }
  return structureSimilarity(fieldProfileOf(row), targetProfile)
}
// 引用热度：相对全局最大引用次数的百分比，避免固定折算导致大量 100%
const hotScore = (row) => {
  const all = baseRows.value.map((r) => Number(r.usageCount || 0))
  const maxUsage = all.length ? Math.max(...all) : 0
  if (!maxUsage) return 0
  return Math.min(100, Math.round((Number(row.usageCount || 0) / maxUsage) * 100))
}
const sortValue = (row) => {
  if (sortMode.value === 'rate') return Number(row.usageCount || 0)
  return matchScore(row)
}
// A-1：是否有推荐上下文（树选中或正在查看的报文/接口）→ 无上下文按引用热度推荐（标题「热门推荐」），有上下文按结构匹配（标题「相似推荐」）
const hasRecommendContext = computed(() => !!recommendContext.value)

// A-1：相似推荐 Top3
// 基于全量优秀样本（baseRows，不受主表格报文/筛选影响——点击报文后表格只剩该报文，推荐仍显示其他报文）；
// 上下文 = recommendContext（树选中 > 详情行，"查看谁推荐与谁相似的"）；
// 排除上下文所在报文（树选中报文集合 + 详情行所在报文，不推荐自己）；同一报文仅推荐一条（避免重复）。
const recommendRows = computed(() => {
  const excludeMessageIds = new Set()
  if (selectedMessageId.value) excludeMessageIds.add(String(selectedMessageId.value))
  if (selectedInterfaceId.value) {
    protoStore.interfaces
      .filter((m) => String(m.ownerIfaceId) === String(selectedInterfaceId.value))
      .forEach((m) => excludeMessageIds.add(String(m.id)))
  }
  if (detailRow.value) excludeMessageIds.add(String(detailRow.value.messageId))
  const seenMessages = new Set()
  return baseRows.value
    .filter((row) => !excludeMessageIds.has(String(row.messageId)))
    .filter((row) => {
      const key = String(row.messageId ?? row.messageName)
      if (seenMessages.has(key)) return false
      seenMessages.add(key)
      return true
    })
    .sort((a, b) => matchScore(b) - matchScore(a))
    .slice(0, 3)
})

// A-1：详情抽屉内的相似推荐（独立基于当前详情报文计算，不受树选中/筛选影响；排除详情行所在报文）
const drawerRecommendRows = computed(() => {
  if (props.mode !== 'excellent' || !detailRow.value) return []
  const target = protoStore.interfaces.find((m) => String(m.id) === String(detailRow.value.messageId))
  if (!target) return []
  const targetProfile = collectInterfaceDatasetFields(target, protoStore.protocols).map((f) => ({
    name: f.name,
    mode: f.constraint?.mode || 'none',
  }))
  const seenMessages = new Set()
  const list = store.allHistoryData
    .filter((row) => row.excellent)
    .filter((row) => String(row.messageId) !== String(detailRow.value.messageId))
    .filter((row) => {
      const key = String(row.messageId ?? row.messageName)
      if (seenMessages.has(key)) return false
      seenMessages.add(key)
      return true
    })
    .map((row) => ({ ...row, _rowKey: `${row._datasetId}-${row.id}`, source: normalizeSource(row.source) }))
    .sort((a, b) => drawerMatchScore(b) - drawerMatchScore(a))
    .slice(0, 3)
  return list
})
const drawerMatchScore = (row) => {
  if (!detailRow.value) return 0
  const target = protoStore.interfaces.find((m) => String(m.id) === String(detailRow.value.messageId))
  if (!target) return 0
  const targetProfile = collectInterfaceDatasetFields(target, protoStore.protocols).map((f) => ({
    name: f.name,
    mode: f.constraint?.mode || 'none',
  }))
  return structureSimilarity(fieldProfileOf(row), targetProfile)
}
const drawerMatchedFields = (row) => {
  if (!detailRow.value) return []
  const target = protoStore.interfaces.find((m) => String(m.id) === String(detailRow.value.messageId))
  if (!target) return []
  const targetNames = new Set(collectInterfaceDatasetFields(target, protoStore.protocols).map((f) => f.name))
  return fieldProfileOf(row).filter((f) => targetNames.has(f.name)).map((f) => f.name).slice(0, 4)
}

const customTagLibrary = computed(() => [...new Set([...(store.customTagLibrary || []), ...baseRows.value.flatMap((row) => row.customTags || [])])].sort())
const allTags = computed(() => [...customTagLibrary.value, ...(baseRows.value.some((row) => row.abnormal) ? ['异常'] : [])])
const ifaceBadge = (iface) => `${baseRows.value.filter((row) => String(row.interfaceId) === String(iface.id)).length} 条`
const messageBadge = (message) => `${baseRows.value.filter((row) => String(row.messageId) === String(message.id)).length} 条`
const onTreeSelect = (node) => {
  const kind = node.kind
  const id = node.ref?.id != null ? String(node.ref.id) : ''
  if (kind === 'message') {
    // 再次点击已选报文 → 取消选择，回到查看全部
    if (selectedMessageId.value === id) {
      selectedMessageId.value = null
      selectedInterfaceId.value = null
      treeKey.value = ''
      return
    }
    selectedMessageId.value = id
    selectedInterfaceId.value = node.ref.ownerIfaceId != null ? String(node.ref.ownerIfaceId) : null
    return
  }
  if (kind === 'iface') {
    // 再次点击已选接口 → 取消选择
    if (selectedInterfaceId.value === id) {
      selectedInterfaceId.value = null
      selectedMessageId.value = null
      treeKey.value = ''
      return
    }
    selectedInterfaceId.value = id
    selectedMessageId.value = null
    return
  }
  // 其他节点（方案/自定义接口）→ 清空报文/接口筛选
  selectedInterfaceId.value = null
  selectedMessageId.value = null
}
/** 清除树筛选，查看全部报文 */
const clearTreeFilter = () => {
  selectedInterfaceId.value = null
  selectedMessageId.value = null
  treeKey.value = ''
}
const toggleFilterTag = (tag) => { tagFilter.value = tagFilter.value.includes(tag) ? tagFilter.value.filter((item) => item !== tag) : [...tagFilter.value, tag] }

/* ---------- H1：筛选视图保存 ---------- */
const modeViews = computed(() => store.historyViews.filter((view) => view.mode === props.mode))
const saveView = async () => {
  try {
    const { value } = await ElMessageBox.prompt('为当前筛选组合命名', '保存筛选视图', { inputValue: `${props.mode === 'excellent' ? '优秀' : '历史'}筛选 ${modeViews.value.length + 1}` })
    if (!String(value || '').trim()) return
    store.saveHistoryView({
      mode: props.mode,
      name: String(value).trim(),
      filters: {
        sourceFilter: sourceFilter.value,
        excellentFilter: excellentFilter.value,
        abnormalFilter: abnormalFilter.value,
        dateRange: dateRange.value,
        tagFilter: tagFilter.value,
        keyword: keyword.value,
      },
    })
    ElMessage.success('筛选视图已保存')
  } catch {}
}
const removeView = () => {
  if (!activeViewId.value) return
  store.removeHistoryView(activeViewId.value)
  activeViewId.value = ''
  ElMessage.success('筛选视图已删除')
}
const onLoadView = (id) => {
  const view = store.historyViews.find((v) => v.id === id)
  if (!view) return
  const f = view.filters || {}
  sourceFilter.value = f.sourceFilter || ''
  excellentFilter.value = f.excellentFilter || ''
  abnormalFilter.value = f.abnormalFilter || ''
  dateRange.value = f.dateRange || []
  tagFilter.value = f.tagFilter || []
  keyword.value = f.keyword || ''
  ElMessage.success(`已载入视图「${view.name}」`)
}

/* ---------- E1：认证复审 ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10)
const isOverdue = (row) => !!(row.certification && row.reviewDueAt && row.reviewDueAt < todayStr())
const overdueRows = computed(() => baseRows.value.filter(isOverdue))
const reviewCurrent = () => {
  if (!detailRow.value) return
  store.reviewCertification(detailRow.value._datasetId, detailRow.value.id)
  ElMessage.success('复审通过，认证有效期已刷新（90 天）')
}

/* ---------- E4：认证场景分组 ---------- */
const scenarioOptions = computed(() => [...new Set(
  baseRows.value
    .filter((row) => row.excellent && row.certification?.scenario)
    .map((row) => row.certification.scenario),
)].sort())

/* ---------- E2：推荐可解释（匹配字段） ---------- */
// 推荐上下文：左侧树选中报文/接口 > 当前打开的详情行报文（"正在查看谁，就推荐与谁相似的"）；
// 都没有则为空 → 「热门推荐」（按引用热度），有上下文 → 「相似推荐」（按结构匹配度）
const recommendContext = computed(() => {
  const target = selectedMessageId.value
    ? protoStore.interfaces.find((m) => String(m.id) === String(selectedMessageId.value))
    : selectedInterfaceId.value
      ? protoStore.interfaces.find((m) => String(m.ownerIfaceId) === String(selectedInterfaceId.value))
      : detailRow.value
        ? protoStore.interfaces.find((m) => String(m.id) === String(detailRow.value.messageId))
        : null
  return target || null
})
const currentTargetProfile = () => {
  const target = recommendContext.value
  if (!target) return null
  return collectInterfaceDatasetFields(target, protoStore.protocols).map((f) => ({
    name: f.name,
    mode: f.constraint?.mode || 'none',
  }))
}
const recommendMatchedFields = (row) => {
  const targetProfile = currentTargetProfile()
  if (!targetProfile) return []
  const leftNames = new Set(fieldProfileOf(row).map((f) => f.name))
  return targetProfile.filter((f) => leftNames.has(f.name)).map((f) => f.name).slice(0, 4)
}

const toggleExcellent = (row) => {
  store.toggleExcellent(row._datasetId, row.id)
  ElMessage.success(row.excellent ? '已移出优秀数据库' : '已加入优秀数据库')
}
const removeRow = (row) => store.removeHistoryRow(row._datasetId, row.id)

// A1：打开认证表单（单条）
const openCertify = (row) => {
  certIsBatch.value = false
  certTarget.value = { _datasetId: row._datasetId, id: row.id }
  const c = row.certification || {}
  certForm.value = { certifier: c.certifier || '', criteria: c.criteria || '', scenario: c.scenario || '', remark: c.remark || '' }
  certVisible.value = true
}
// A1：批量打开认证表单
const openBatchCertify = () => {
  if (!selectedRows.value.length) return
  certIsBatch.value = true
  certTarget.value = selectedRows.value
  certForm.value = { certifier: '', criteria: '', scenario: '', remark: '' }
  certVisible.value = true
}
const confirmCertify = () => {
  if (!certForm.value.certifier.trim()) {
    ElMessage.warning('请填写认证人')
    return
  }
  if (certIsBatch.value) {
    store.setExcellentBatch(certTarget.value, true, { ...certForm.value })
    certTarget.value.forEach((row) => materializeCase(row, { ...certForm.value }))
    ElMessage.success(`已将 ${certTarget.value.length} 条报文认证为优秀`)
  } else {
    const t = certTarget.value
    store.certifyExcellent(t._datasetId, t.id, { ...certForm.value })
    materializeCase(t, { ...certForm.value })
    ElMessage.success('已认证为优秀报文')
  }
  certVisible.value = false
}
// A-2：认证后自动将优秀报文沉淀为知识库「案例卡」（幂等，已存在则更新）
const materializeCase = (row, cert) => {
  const current = baseRows.value.find((r) => r._rowKey === `${row._datasetId}-${row.id}`) || row
  const doc = reportStore.addExcellentCase({
    rowKey: `${row._datasetId}-${row.id}`,
    messageName: current.messageName,
    certifier: cert.certifier,
    criteria: cert.criteria,
    scenario: cert.scenario,
    remark: cert.remark,
    interfaceId: current.interfaceId,
    messageId: current.messageId,
    tags: current.customTags,
  })
  const ds = store.datasets.find((d) => d.id === row._datasetId)
  const hr = ds?.historyRows?.find((r) => r.id === row.id)
  if (hr) hr.caseDocId = doc.id
}
const openKnowledgeCase = (row) => {
  if (!row.caseDocId) {
    const c = row.certification || {}
    materializeCase(row, c)
    ElMessage.success('已生成案例卡并沉淀至知识库')
    return
  }
  router.push('/knowledge-model')
}
// A1：优秀开关联动认证（开启时弹窗认证，关闭时直接移出）
const onExcellentSwitch = (row, val) => {
  if (val) openCertify(row)
  else {
    store.toggleExcellent(row._datasetId, row.id)
    ElMessage.success('已移出优秀数据库')
  }
}

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
  if (!selectedRows.value.length) return
  const sample = selectedRows.value[0]
  // H3：另存前字段覆盖确认——对比选中行字段与报文字段定义
  const defs = store.fieldDefsOfDataset(sample._datasetId)
  const rowKeys = Object.keys(sample.values || {})
  const defNames = defs.map((f) => f.name)
  const missing = defNames.filter((name) => !rowKeys.includes(name))
  const extra = rowKeys.filter((name) => !defNames.includes(name))
  if (defs.length) {
    const lines = [
      `选中 ${selectedRows.value.length} 条，行字段 ${rowKeys.length} 个；报文定义字段 ${defs.length} 个。`,
    ]
    if (missing.length) lines.push(`\n缺失字段（${missing.length}）：${missing.slice(0, 10).join('、')}${missing.length > 10 ? ' 等' : ''}`)
    if (extra.length) lines.push(`\n多余字段（${extra.length}）：${extra.slice(0, 10).join('、')}${extra.length > 10 ? ' 等' : ''}`)
    try {
      await ElMessageBox.confirm(lines.join('\n'), '另存为数据集前确认', {
        type: missing.length ? 'warning' : 'info',
        confirmButtonText: '继续创建',
        cancelButtonText: '取消',
      })
    } catch { return }
  }
  try {
    const { value } = await ElMessageBox.prompt('输入新数据集名称', '另存为数据集', { inputValue: `${selectedRows.value[0]?.messageName || '历史报文'}复用集` })
    const sourceDs = store.datasets.find((d) => d.id === sample._datasetId)
    const ds = store.addDataset({ name: value, systemId: sample._systemId, moduleName: sample._moduleName, linkedInterface: sample.messageName, messageId: sample.messageId, linkedProtocol: sourceDs?.linkedProtocol })
    ds.rows = selectedRows.value.map((row, index) => ({
      id: Date.now() + index,
      label: row.label,
      values: JSON.parse(JSON.stringify(row.values)),
      source: '历史复用',
      createdAt: row.createdAt || '',
      remark: row.remark || '',
      customTags: [...(row.customTags || [])],
    }))
    store.registerCustomTags(selectedRows.value.flatMap((row) => row.customTags || []))
    // A4：复用闭环——另存为数据集即视为一次成功复用
    selectedRows.value.forEach((row) => store.updateReuseStats(row._datasetId, row.id))
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
  // A4：复用闭环——发送清单创建成功即视为一次成功复用
  selectedRows.value.forEach((row) => store.updateReuseStats(row._datasetId, row.id, true))
  router.push({ path: '/execution', query: { mode: 'send', draftId: result.draft.id } })
}
/* ---------- H2：导出增强（JSON / CSV，选中或按筛选全部） ---------- */
const stripMeta = (row) => {
  const { _rowKey, _fieldProfile, ...rest } = row
  return rest
}
const csvEscape = (value) => {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const exportAsCsv = (rows) => {
  const clean = rows.map(stripMeta)
  const fieldKeys = [...new Set(clean.flatMap((row) => Object.keys(row.values || {})))]
  const isExc = props.mode === 'excellent'
  const base = ['报文名', '创建日期', '来源', '备注', '标签']
  // E3：优秀库导出附认证信息与客观引用统计
  const excCols = isExc ? ['认证人', '认证时间', '复审截止', '引用次数', '最近复用'] : []
  const head = [...base, ...excCols, ...fieldKeys]
  const lines = [head.map(csvEscape).join(',')]
  clean.forEach((row) => {
    const cells = [
      row.messageName || '',
      row.createdAt || '',
      normalizeSource(row.source),
      row.remark || '',
      (row.customTags || []).join('、'),
      ...(isExc ? [
        row.certification?.certifier || '',
        row.certification?.certTime || '',
        row.reviewDueAt || '',
        Number(row.usageCount || 0),
        row.lastUsedAt || '',
      ] : []),
      ...fieldKeys.map((key) => row.values?.[key] ?? ''),
    ]
    lines.push(cells.map(csvEscape).join(','))
  })
  downloadBlob(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }), `${props.mode === 'excellent' ? '优秀' : '历史'}报文.csv`)
}
const onExportCommand = (command) => {
  const [scope, kind] = String(command).split('-')
  const rows = scope === 'selected' ? selectedRows.value : filteredRows.value
  if (!rows.length) return
  const name = props.mode === 'excellent' ? '优秀' : '历史'
  if (kind === 'json') {
    downloadBlob(new Blob([JSON.stringify(rows.map(stripMeta), null, 2)], { type: 'application/json;charset=utf-8' }), `${name}报文.json`)
  } else {
    exportAsCsv(rows)
  }
  ElMessage.success(`已导出 ${rows.length} 条${scope === 'selected' ? '选中' : '筛选'}数据`)
}
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
.reco-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 9px 12px; border: 1px dashed var(--el-border-color); border-radius: 8px; background: var(--el-fill-color-light); }
.review-banner { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid #f5d8a8; border-radius: 8px; background: #fdf6ec; color: #a15c07; font-size: 12px; }
.review-banner .el-icon { font-size: 14px; }
.cert-actions { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.reco-bar__title { font-size: 12px; font-weight: 700; color: var(--asset); }
.reco-card { display: flex; flex-direction: column; gap: 2px; padding: 7px 12px; border: 1px solid var(--el-border-color); border-radius: 8px; background: #fff; cursor: pointer; text-align: left; min-width: 160px; }
.reco-card:hover { border-color: var(--asset); background: color-mix(in srgb, var(--asset) 6%, white); }
.reco-card strong { font-size: 13px; color: var(--el-text-color-primary); }
.reco-card__score { font-size: 11px; color: var(--asset); font-weight: 700; }
.reco-card__matched { font-size: 11px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.reco-card__meta { font-size: 11px; color: var(--el-text-color-secondary); }
.reco-card--drawer { width: 100%; min-width: 0; margin-bottom: 8px; }
.drawer-reco { display: flex; flex-direction: column; gap: 4px; padding: 10px; border: 1px dashed var(--el-border-color); border-radius: 8px; background: var(--el-fill-color-extra-light); }
.drawer-reco__empty { margin: 0; font-size: 12px; color: var(--el-text-color-placeholder); }
.muted-num { color: var(--el-text-color-secondary); }
.cert-box { margin-bottom: 12px; }
.cert-box .el-button { margin-top: 8px; }
.reuse-foot { display: flex; gap: 10px; flex-wrap: wrap; }
.reuse-foot__item { flex: 1; min-width: 110px; display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 8px; background: var(--el-fill-color-light); border: 1px solid var(--el-border-color-lighter); }
.reuse-foot__item span { font-size: 11px; color: var(--el-text-color-secondary); }
.reuse-foot__item b { font-size: 18px; color: var(--el-text-color-primary); }
.reuse-foot__item b.is-good { color: var(--el-color-success); }
.reuse-foot__item b.is-mid { color: var(--el-color-warning); }
.reuse-foot__item b.is-bad { color: var(--el-color-danger); }
.reuse-foot__item small { color: var(--el-text-color-secondary); font-size: 11px; }
.reuse-foot__time { font-size: 13px !important; line-height: 22px; }
</style>
