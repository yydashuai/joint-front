<template>
  <div class="gen-workbench">
    <!-- 顶部工具栏 -->
    <div class="gen-toolbar">
      <el-select v-model="strategyId" placeholder="载入生成策略" clearable filterable style="width: 180px" @change="onLoadStrategy">
        <el-option v-for="s in store.generationStrategies" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-button size="small" type="primary" plain @click="newStrategy">新建策略</el-button>
      <el-button size="small" :disabled="!strategyId || !selectedDs" @click="saveStrategy">保存策略</el-button>
      <el-button size="small" text type="danger" :disabled="!strategyId" @click="removeStrategy">删除</el-button>
      <span class="gen-toolbar__sep" />
      <el-input-number v-model="count" :min="1" :max="200" size="small" controls-position="right" />
      <el-select v-model="method" style="width: 140px" size="small">
        <el-option label="约束驱动生成" value="constraint" />
        <el-option label="分布学习生成" value="distribution" />
      </el-select>
      <el-select v-if="method === 'constraint'" v-model="mode" style="width: 120px" size="small">
        <el-option label="常规" value="normal" />
        <el-option label="边界" value="boundary" />
        <el-option label="异常" value="abnormal" />
        <el-option label="综合" value="mixed" />
      </el-select>
      <div class="gen-toolbar__right">
        <el-button type="primary" :loading="generating" :disabled="!selectedDs" @click="generate">生成预览</el-button>
      </div>
    </div>

    <div class="gen-body">
      <!-- 左配置栏 -->
      <!-- 左导航栏：仅保留数据源选择，重内容已迁至右主区「生成配置」面板 -->
      <aside class="gen-rail">
        <section class="cfg-card">
          <header>数据源</header>
          <el-form label-position="top" size="small">
            <el-form-item label="报文">
              <el-select v-model="messageId" filterable clearable placeholder="全部报文" style="width: 100%" @change="onMessageChange">
                <el-option v-for="m in messages" :key="m.id" :label="m.name" :value="m.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="目标数据集">
              <el-select v-model="datasetId" filterable placeholder="选择数据集" style="width: 100%">
                <el-option v-for="d in dsOptions" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </el-form-item>
          </el-form>
          <div v-if="selectedDs" class="ds-facts">
            <span>可生成字段 <b>{{ fields.length }}</b></span>
            <span>当前数据 <b>{{ selectedDs.rows?.length || 0 }} 条</b></span>
            <span>约束构成 <b>{{ constraintSummary }}</b></span>
          </div>
          <el-alert v-else type="info" :closable="false" show-icon title="请选择目标数据集" />
        </section>
      </aside>

      <!-- 右主区 -->
      <section class="gen-main">
        <!-- 生成配置（从左侧迁入，全宽不再拥挤；大屏三列并排，可折叠让出表格高度） -->
        <section class="gen-config-panel" :class="{ collapsed: !configOpen }">
          <header class="cfg-panel__head" @click="configOpen = !configOpen">
            <span class="cfg-panel__title">生成配置</span>
            <span class="cfg-panel__summary">{{ configSummary }}</span>
            <span class="cfg-panel__toggle">{{ configOpen ? '▾' : '▸' }}</span>
          </header>
          <div v-show="configOpen" class="cfg-panel__body">
            <!-- 参考样本仅在「分布学习生成」时使用；约束驱动下不显示，避免混淆 -->
            <section v-if="method === 'distribution' && selectedDs" class="cfg-card cfg-inline">
              <header>参考样本</header>
              <div class="sample-counts">
                <span><b>{{ refExcellent.length }}</b> 条优秀</span>
                <span><b>{{ refHistory.length }}</b> 条历史</span>
              </div>
              <el-switch v-model="useExcellent" active-text="优先优秀样本" inline-prompt size="small" style="margin: 6px 0 8px" />
              <div v-if="distPreview.length" class="dist-preview">
                <div v-for="d in distPreview" :key="d.name">
                  <span>{{ d.name }}</span>
                  <small>{{ d.text }}</small>
                </div>
              </div>
              <small v-else class="muted">暂无样本，将仅依据字段约束生成。</small>
            </section>

            <section v-if="method === 'constraint' && selectedDs" class="cfg-card cfg-inline">
              <header>字段规则与覆盖率</header>
              <el-checkbox v-model="enumAll" size="small" style="margin-bottom: 6px">枚举值全覆盖</el-checkbox>
              <el-table :data="overrideRows" size="small" max-height="200" empty-text="无带约束字段">
                <el-table-column prop="name" label="字段" min-width="90" show-overflow-tooltip />
                <el-table-column label="规则" width="120">
                  <template #default="{ row }">
                    <el-select v-model="row.override" size="small" style="width: 100%">
                      <el-option label="默认" value="default" />
                      <el-option label="强制边界" value="boundary" />
                      <el-option label="固定值" value="fixed" />
                      <el-option label="枚举首值" value="enum" />
                    </el-select>
                  </template>
                </el-table-column>
              </el-table>
            </section>

            <!-- F1：异常测试配方向导（约束驱动 + 异常 / 综合模式时展开） -->
            <section v-if="method === 'constraint' && (mode === 'abnormal' || mode === 'mixed') && selectedDs" class="cfg-card cfg-inline">
              <header>异常测试配方</header>
              <el-checkbox-group v-model="recipeList" size="small">
                <el-checkbox label="exceedRange">数值越界</el-checkbox>
                <el-checkbox label="illegalEnum">非法枚举</el-checkbox>
                <el-checkbox label="formatError">格式异常</el-checkbox>
              </el-checkbox-group>
            </section>
          </div>
        </section>

        <div class="gen-table">
          <el-table :data="resultRows" height="100%" highlight-current-row @row-click="openDetail" @current-change="activeRow = $event">
            <el-table-column prop="label" label="生成数据" min-width="120" show-overflow-tooltip />
            <el-table-column label="类型" width="86">
              <template #default="{ row }">
                <el-tag size="small" :type="candidateType(row).type" effect="plain">{{ candidateType(row).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="配方" width="96">
              <template #default="{ row }"><span class="muted">{{ (row.recipeTags && row.recipeTags[0]) || '—' }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="186" align="center">
              <template #default="{ row, $index }">
                <el-button link type="primary" size="small" @click.stop="openDetail(row)">查看</el-button>
                <el-button link size="small" @click.stop="regenerateRow($index)">重生成</el-button>
                <el-button link type="danger" size="small" @click.stop="removeRow($index)">剔除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!resultRows.length && !generating" description="配置左侧参数后点击「生成预览」" :image-size="72" />
        </div>

        <div class="gen-batch-bar" :class="{ visible: resultRows.length }">
          <div class="batch-row">
            <span>常规 <b class="ok">{{ normalCount }}</b></span>
            <span>边界 <b class="warn">{{ boundaryCount }}</b></span>
            <span>字段异常 <b class="bad">{{ abnormalCount }}</b></span>
          </div>
          <div class="batch-row">
            <div class="batch-cov">
              <div class="batch-cov__item">
                <span>枚举覆盖</span>
                <el-progress :percentage="enumCov ?? 0" :stroke-width="4" :show-text="false" />
                <b>{{ enumCov != null ? enumCov + '%' : '—' }}</b>
              </div>
              <div class="batch-cov__item">
                <span>边界覆盖</span>
                <el-progress :percentage="boundaryCov ?? 0" :stroke-width="4" :show-text="false" />
                <b>{{ boundaryCov != null ? boundaryCov + '%' : '—' }}</b>
              </div>
              <div class="batch-cov__item">
                <span>异常类型</span>
                <el-progress :percentage="recipeCov ?? 0" :stroke-width="4" :show-text="false" />
                <b>{{ recipeCov != null ? recipeCov + '%' : '—' }}</b>
              </div>
            </div>
            <span class="batch-count">已生成 <b>{{ resultRows.length }}</b> 条</span>
            <el-button size="small" :disabled="!resultRows.length" @click="clearResult">清空</el-button>
            <!-- F4：多格式导出 -->
            <el-dropdown trigger="click" @command="exportFormat">
              <el-button size="small" :disabled="!resultRows.length">导出 ▾</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="json">JSON</el-dropdown-item>
                  <el-dropdown-item command="csv">CSV</el-dropdown-item>
                  <el-dropdown-item command="excel">Excel</el-dropdown-item>
                  <el-dropdown-item command="hex">Hex</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" type="success" :disabled="!resultRows.length" @click="confirmImport">确认入库 {{ resultRows.length }} 条</el-button>
          </div>
        </div>
      </section>
    </div>

    <!-- F5：生成→实测闭环联动 -->
    <div v-if="closedLoop" class="gen-closedloop">
      <span>已入库「{{ closedLoop.ifaceName }}」相关测试数据，可一键联动实测：</span>
      <el-button size="small" type="primary" @click="joinSendPlan">加入发送计划</el-button>
      <el-button size="small" @click="joinMonitor">加入接收监控</el-button>
      <el-button size="small" text type="info" @click="closedLoop = null">关闭</el-button>
    </div>

    <!-- 单条数据详情抽屉 -->
    <el-drawer v-model="editVisible" :title="activeRow?.label || '数据详情'" size="440px">
      <template v-if="activeRow">
        <div class="row-editor">
          <div v-for="(value, key) in activeRow.values" :key="key" class="row-editor__field">
            <div class="row-editor__label">
              <span>{{ key }}</span>
              <small :title="constraintOf(key).full">{{ constraintOf(key).text }}</small>
            </div>
            <el-input v-model="activeRow.values[key]" size="small" />
          </div>
        </div>
        <div class="row-editor__meta">
          <el-tag size="small" :type="isAbnormal(activeRow) ? 'danger' : 'success'">{{ isAbnormal(activeRow) ? '字段校验异常' : '字段校验通过' }}</el-tag>
          <span class="muted">修改后实时重新校验</span>
          <el-button link type="primary" size="small" @click="regenerateActive">重新生成该条</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { useAnalysisStore } from '@/stores/analysis'
import { useReceptionStore } from '@/stores/reception'
import { useExecutionStore } from '@/stores/execution'
import { useTestTaskStore } from '@/stores/testTask'
import { analyzeDistribution, coverageOf } from '@/utils/dataGen'
import { downloadBlob } from '@/services/testDataService'

const store = useTestDataStore()
const protoStore = useProtocolStore()
const analysisStore = useAnalysisStore()
const receptionStore = useReceptionStore()
const executionStore = useExecutionStore()
const testTaskStore = useTestTaskStore()

const messageId = ref('')
const datasetId = ref(null)
const count = ref(10)
const method = ref('constraint')
const mode = ref('mixed')
const enumAll = ref(true)
const useExcellent = ref(true)
const strategyId = ref('')
const strategyName = ref('')
const generating = ref(false)
const resultRows = ref([])
const activeRow = ref(null)
const editVisible = ref(false)
// F1：异常测试配方（勾选项）
const recipeList = ref(['exceedRange', 'illegalEnum', 'formatError'])
// F5：闭环联动目标
const closedLoop = ref(null)
// 生成配置面板折叠状态（默认展开，便于配置；可折叠让出表格高度）
const configOpen = ref(true)

const messages = computed(() => protoStore.interfaces)
const dsOptions = computed(() => {
  const list = messageId.value
    ? store.datasets.filter((d) => String(d.messageId) === String(messageId.value))
    : store.datasets
  return list
})
const selectedDs = computed(() => store.datasets.find((d) => d.id === datasetId.value) || null)

const fields = computed(() => {
  if (!selectedDs.value) return []
  const iface = messages.value.find((m) => String(m.id) === String(selectedDs.value.messageId))
  if (iface) return collectInterfaceDatasetFields(iface, protoStore.protocols)
  return store.fieldDefsOfDataset(selectedDs.value.id)
})
const constraintSummary = computed(() => {
  const countMap = { fixed: 0, enum: 0, range: 0, none: 0 }
  fields.value.forEach((f) => {
    const modeKey = f.constraint?.mode
    if (modeKey && modeKey in countMap) countMap[modeKey] += 1
    else countMap.none += 1
  })
  const parts = []
  if (countMap.enum) parts.push(`枚举 ${countMap.enum}`)
  if (countMap.range) parts.push(`范围 ${countMap.range}`)
  if (countMap.fixed) parts.push(`固定 ${countMap.fixed}`)
  if (countMap.none) parts.push(`自由 ${countMap.none}`)
  return parts.join(' / ') || '无'
})

const relatedHistory = computed(() => store.allHistoryData.filter((row) =>
  String(row.messageId) === String(messageId.value) || row._datasetId === datasetId.value
))
const refExcellent = computed(() => relatedHistory.value.filter((row) => row.excellent))
const refHistory = computed(() => relatedHistory.value.filter((row) => !row.excellent))
const refSamples = computed(() => {
  const excellent = useExcellent.value ? refExcellent.value : []
  const keys = new Set(excellent.map((row) => `${row._datasetId}-${row.id}`))
  return [...excellent, ...refHistory.value.filter((row) => !keys.has(`${row._datasetId}-${row.id}`))].slice(0, 20)
})
const distPreview = computed(() => {
  const dist = analyzeDistribution(refSamples.value)
  return Object.entries(dist).slice(0, 4).map(([name, info]) => ({
    name,
    text: info.type === 'numeric'
      ? `${info.min} ~ ${info.max}${info.isInteger ? '' : '（浮点）'}`
      : `取值 ${Object.keys(info.freq).length} 种`,
  }))
})

const overrideRows = computed(() => fields.value
  .filter((f) => f.constraint && ['enum', 'range', 'fixed'].includes(f.constraint.mode))
  .map((f) => ({ name: f.name, override: 'default' })))
const fieldOverrides = computed(() => {
  const map = {}
  overrideRows.value.forEach((row) => {
    if (row.override && row.override !== 'default') map[row.name] = row.override
  })
  return map
})

const coverage = computed(() => coverageOf(fields.value, resultRows.value))
// F2：三维覆盖率
const enumCov = computed(() => coverage.value?.enumPct ?? null)
const boundaryCov = computed(() => coverage.value?.boundaryPct ?? null)
// 异常配方仅在约束驱动 + 异常 / 综合模式下启用
const recipeEnabledCount = computed(() => {
  if (method.value !== 'constraint') return 0
  if (mode.value !== 'abnormal' && mode.value !== 'mixed') return 0
  return recipeList.value.length
})
const recipeCoveredCount = computed(() => {
  const set = new Set()
  resultRows.value.forEach((r) => (r.recipeTags || []).forEach((t) => set.add(t)))
  return set.size
})
const recipeCov = computed(() => (recipeEnabledCount.value ? Math.round((recipeCoveredCount.value / recipeEnabledCount.value) * 100) : null))

// 生成配置面板折叠时的概要（反映当前配置状态）
const configSummary = computed(() => {
  if (!selectedDs.value) return '请选择数据集'
  const parts = [method.value === 'distribution' ? `参考样本 ${refSamples.value.length} 条` : '约束驱动']
  if (method.value === 'constraint') parts.push(`字段规则 ${overrideRows.value.length} 项`)
  if (method.value === 'constraint' && (mode.value === 'abnormal' || mode.value === 'mixed')) parts.push(`异常配方 ${recipeList.value.length} 项`)
  return parts.join(' · ')
})

const normalCount = computed(() => resultRows.value.filter((row) => !isAbnormal(row) && !row.coverageTags?.includes('边界值')).length)
const boundaryCount = computed(() => resultRows.value.filter((row) => row.coverageTags?.includes('边界值')).length)
const abnormalCount = computed(() => resultRows.value.filter(isAbnormal).length)

const isAbnormal = (row) => {
  const ds = selectedDs.value
  return ds ? store.computeAbnormal(row.values, ds.id) : false
}
const candidateType = (row) => {
  if (isAbnormal(row)) return { label: '异常', type: 'danger' }
  if (row.coverageTags?.includes('边界值')) return { label: '边界', type: 'warning' }
  return { label: '常规', type: 'success' }
}

watch(messageId, (id) => {
  if (id && !dsOptions.value.some((d) => d.id === datasetId.value)) {
    datasetId.value = dsOptions.value[0]?.id || null
  }
})

const buildRecipe = () => ({
  exceedRange: recipeList.value.includes('exceedRange'),
  illegalEnum: recipeList.value.includes('illegalEnum'),
  formatError: recipeList.value.includes('formatError'),
})

const generate = async () => {
  if (!selectedDs.value) {
    ElMessage.warning('请先选择目标数据集')
    return
  }
  generating.value = true
  await new Promise((resolve) => setTimeout(resolve, 120))
  const result = store.runGeneration(selectedDs.value.id, {
    count: count.value,
    mode: mode.value,
    method: method.value,
    referenceRows: refSamples.value,
    fieldOverrides: fieldOverrides.value,
    recipe: buildRecipe(),
  })
  generating.value = false
  if (!result.ok || !result.rows.length) {
    ElMessage.warning(result.reason || '未生成可用数据，请检查字段约束或样本')
    return
  }
  resultRows.value = result.rows.map((row, index) => ({ ...row, label: `生成数据 ${index + 1}` }))
  activeRow.value = resultRows.value[0]
  editVisible.value = false
}

const regenerateRow = (index) => {
  const ds = selectedDs.value
  if (!ds) return
  const [replacement] = store.runGeneration(ds.id, {
    count: 1,
    mode: mode.value,
    method: method.value,
    referenceRows: refSamples.value,
    fieldOverrides: fieldOverrides.value,
    recipe: buildRecipe(),
  }).rows
  if (replacement) {
    replacement.label = resultRows.value[index].label
    resultRows.value.splice(index, 1, replacement)
    activeRow.value = replacement
  } else {
    ElMessage.warning('未能生成新结果')
  }
}
const removeRow = (index) => {
  const removed = resultRows.value[index]
  resultRows.value.splice(index, 1)
  if (removed === activeRow.value) activeRow.value = resultRows.value[index] || resultRows.value[index - 1] || null
}
const clearResult = () => {
  resultRows.value = []
  activeRow.value = null
}

/* ---------- 单条详情 ---------- */
const openDetail = (row) => {
  activeRow.value = row
  editVisible.value = true
}
const constraintOf = (key) => {
  const def = fields.value.find((f) => f.name === key)
  const c = def?.constraint
  if (!c?.mode) return { text: '无约束', full: '无约束' }
  if (c.mode === 'range') return { text: `${c.min} ~ ${c.max}`, full: `范围约束：${c.min} ~ ${c.max}` }
  if (c.mode === 'fixed') return { text: `固定 ${c.value}`, full: `固定值：${c.value}` }
  if (c.mode === 'enum') {
    const entries = (c.entries || []).map((e) => e.value ?? e)
    return { text: `枚举 ${entries.length} 项`, full: `枚举：${entries.join(' / ')}` }
  }
  return { text: c.mode, full: c.mode }
}
const regenerateActive = () => {
  const index = resultRows.value.indexOf(activeRow.value)
  if (index >= 0) regenerateRow(index)
}

const confirmImport = () => {
  const ds = selectedDs.value
  if (!ds) return
  const rows = resultRows.value.map((row, index) => ({
    id: Date.now() + index,
    label: row.label,
    values: { ...row.values },
    source: '智能生成',
    generationMeta: {
      strategy: row.strategy,
      coverageTags: row.coverageTags || [],
      recipeTags: row.recipeTags || [],
      method: method.value,
    },
  }))
  store.insertRowsAfter(ds.id, null, rows)
  store.addHistoryRows(ds.id, rows.map((row) => ({
    ...row,
    abnormal: store.computeAbnormal(row.values, ds.id),
    customTags: [...(row.generationMeta.recipeTags || []), ...(row.generationMeta.coverageTags || [])],
    validationResult: store.computeAbnormal(row.values, ds.id) ? '存在字段约束异常' : '校验通过',
  })))
  analysisStore.recordAction({ type: '智能生成', target: ds.name })
  // F5：记录闭环联动目标（父接口）
  const iface = messages.value.find((m) => String(m.id) === String(ds.messageId))
  closedLoop.value = iface ? { interfaceId: iface.ownerIfaceId, ifaceName: iface.name } : null
  clearResult()
  ElMessage.success(`已将 ${rows.length} 条数据写入「${ds.name}」并同步历史数据库`)
}

/* ---------- F4：多格式导出 ---------- */
const exportFormat = (fmt) => {
  const ds = selectedDs.value
  if (!ds || !resultRows.value.length) return
  const rows = resultRows.value
  const fieldList = fields.value.map((f) => f.name)
  if (fmt === 'json') {
    const data = rows.map(({ label, values, strategy, coverageTags, recipeTags }) => ({
      dataset: ds.name,
      label,
      values,
      strategy: strategy || method.value,
      coverageTags: coverageTags || [],
      recipeTags: recipeTags || [],
    }))
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), '智能生成结果.json')
  } else if (fmt === 'csv') {
    const header = ['label', ...fieldList].join(',')
    const lines = rows.map((r) => [r.label, ...fieldList.map((f) => JSON.stringify(r.values?.[f] ?? ''))].join(','))
    downloadBlob(new Blob(['\uFEFF' + [header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }), '智能生成结果.csv')
  } else if (fmt === 'excel') {
    const header = ['label', ...fieldList].map((h) => `<th>${h}</th>`).join('')
    const body = rows.map((r) => `<tr><td>${r.label}</td>${fieldList.map((f) => `<td>${String(r.values?.[f] ?? '').replace(/</g, '&lt;')}</td>`).join('')}</tr>`).join('')
    const html = `<html><head><meta charset="utf-8"></head><body><table border="1">${header}${body}</table></body></html>`
    downloadBlob(new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel' }), '智能生成结果.xls')
  } else if (fmt === 'hex') {
    const textToHex = (s) => [...s].map((ch) => (ch.charCodeAt(0) & 0xff).toString(16).padStart(2, '0')).join('')
    const payload = rows.map((r) => JSON.stringify(r.values)).join('\n')
    downloadBlob(new Blob([textToHex(payload)], { type: 'text/plain;charset=utf-8' }), '智能生成结果.hex')
  }
  ElMessage.success(`已导出 ${rows.length} 条（${fmt.toUpperCase()}）`)
}

/* ---------- F5：生成→实测闭环联动 ---------- */
const joinMonitor = () => {
  const target = closedLoop.value
  if (!target?.interfaceId) return
  const ok = receptionStore.addToPlan(target.interfaceId)
  if (ok) ElMessage.success(`已加入接收监控（接口 ${target.ifaceName}）`)
  else ElMessage.info('该接口已在接收计划中')
}
const joinSendPlan = () => {
  const target = closedLoop.value
  if (!target?.interfaceId) return
  const iface = protoStore.testInterfaces.find((i) => String(i.id) === String(target.interfaceId))
  let task = testTaskStore.tasks.find((t) => String(t.bindings?.interfaceId) === String(target.interfaceId))
  if (!task) {
    task = testTaskStore.addTask({
      name: `${target.ifaceName || selectedDs.value?.name} 临时发送`,
      systemId: iface?.systemId || '',
      moduleId: iface?.moduleId || '',
    })
  }
  testTaskStore.updateBindings(task.id, { interfaceId: target.interfaceId })
  const ok = executionStore.addToPlan(task.id)
  if (ok) ElMessage.success(`已加入发送计划（接口 ${target.ifaceName}）`)
  else ElMessage.info('该接口已在发送计划中')
}

/* ---------- 策略 ---------- */
const newStrategy = () => {
  strategyId.value = ''
  strategyName.value = ''
  saveStrategy()
}
const saveStrategy = async () => {
  if (!selectedDs.value) {
    ElMessage.warning('请先选择数据集再保存策略')
    return
  }
  const name = strategyId.value
    ? (await ElMessageBox.prompt('策略名称', '更新策略', { inputValue: store.generationStrategies.find((s) => s.id === strategyId.value)?.name || strategyName.value || '未命名策略' })).value
    : (await ElMessageBox.prompt('输入策略名称', '保存生成策略', { inputValue: strategyName.value || `${selectedDs.value.name}策略` })).value
  const strategy = store.saveGenerationStrategy({
    id: strategyId.value || undefined,
    name: String(name || '').trim() || '未命名策略',
    count: count.value,
    mode: mode.value,
    method: method.value,
    fieldOverrides: fieldOverrides.value,
    coverage: { enumAll: enumAll.value },
    recipe: buildRecipe(),
  })
  strategyId.value = strategy.id
  strategyName.value = strategy.name
  ElMessage.success(`策略「${strategy.name}」已保存`)
}
const removeStrategy = () => {
  if (!strategyId.value) return
  store.removeGenerationStrategy(strategyId.value)
  strategyId.value = ''
  strategyName.value = ''
  ElMessage.success('策略已删除')
}
const onLoadStrategy = (id) => {
  const s = store.generationStrategies.find((item) => item.id === id)
  if (!s) return
  count.value = s.count || 10
  mode.value = s.mode || 'mixed'
  method.value = s.method || 'constraint'
  enumAll.value = !!s.coverage?.enumAll
  if (s.recipe) recipeList.value = ['exceedRange', 'illegalEnum', 'formatError'].filter((k) => s.recipe[k])
  strategyName.value = s.name
  overrideRows.value.forEach((row) => {
    if (s.fieldOverrides && row.name in s.fieldOverrides) row.override = s.fieldOverrides[row.name]
  })
  ElMessage.success(`已载入策略「${s.name}」`)
}
</script>

<style scoped lang="scss">
.gen-workbench {
  --asset: #2f6feb;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gen-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}
.gen-toolbar__sep { width: 1px; height: 20px; background: var(--el-border-color); }
.gen-toolbar__right { margin-left: auto; }
.gen-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 12px; }
.gen-rail { min-height: 0; overflow: auto; }
.cfg-card {
  flex-shrink: 0;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.cfg-card header { margin-bottom: 8px; font-size: 13px; font-weight: 600; }
.cfg-card :deep(.el-form-item) { margin-bottom: 10px; }
.cfg-card :deep(.el-form-item__label) { padding-bottom: 2px; font-size: 12px; }
.cfg-card :deep(.el-checkbox-group) { display: flex; flex-direction: column; gap: 4px; }
/* 生成配置面板（从左侧迁入，全宽不再拥挤） */
.gen-config-panel { flex-shrink: 0; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-bg-color); overflow: hidden; }
.gen-config-panel.collapsed .cfg-panel__body { display: none; }
.cfg-panel__head { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; user-select: none; }
.cfg-panel__title { font-size: 13px; font-weight: 600; }
.cfg-panel__summary { min-width: 0; color: var(--el-text-color-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfg-panel__toggle { margin-left: auto; color: var(--el-text-color-secondary); font-size: 13px; }
.cfg-panel__body { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px; }
.cfg-inline { flex: 1; min-width: 240px; margin: 0; }
.ds-facts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-top: 8px; font-size: 12px; color: var(--el-text-color-secondary); }
.ds-facts b { color: var(--el-text-color-primary); font-size: 13px; }
.sample-counts { display: flex; gap: 14px; margin-bottom: 6px; font-size: 12px; }
.sample-counts b { margin-right: 2px; font-size: 16px; color: var(--asset); }
.dist-preview { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.dist-preview div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 6px; background: var(--el-fill-color-extra-light); }
.dist-preview span { font-size: 12px; }
.dist-preview small { color: var(--el-text-color-secondary); font-size: 11px; }
.gen-main { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.batch-row .ok { color: var(--el-color-success); }
.batch-row .warn { color: var(--el-color-warning); }
.batch-row .bad { color: var(--el-color-danger); }
.gen-table { position: relative; flex: 1; min-height: 0; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: hidden; }
.gen-batch-bar {
  flex-shrink: 0;
  min-height: 42px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
  opacity: .55;
}
.gen-batch-bar.visible { opacity: 1; border-color: color-mix(in srgb, var(--asset) 25%, #dfe5ec); }
.batch-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; font-size: 12px; color: var(--el-text-color-secondary); }
.batch-row > span { display: flex; align-items: center; gap: 4px; }
.batch-row b { color: var(--el-text-color-primary); font-size: 13px; }
.batch-row .batch-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--asset); }
.batch-sep { width: 1px; height: 14px; background: var(--el-border-color); }
.batch-cov { display: flex; flex-wrap: wrap; gap: 12px; flex: 1; min-width: 0; }
.batch-cov__item { display: flex; align-items: center; gap: 6px; min-width: 110px; font-size: 11px; color: var(--el-text-color-secondary); }
.batch-cov__item :deep(.el-progress) { width: 80px; }
.batch-cov__item b { font-size: 11px; color: var(--el-text-color-primary); }
.batch-count { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); }
.batch-count b { color: var(--el-text-color-primary); font-size: 13px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.gen-closedloop {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 12px;
  border: 1px dashed color-mix(in srgb, var(--asset) 45%, #dfe5ec);
  border-radius: 8px;
  background: color-mix(in srgb, var(--asset) 6%, var(--el-bg-color));
  font-size: 12px;
}
.row-editor { display: flex; flex-direction: column; gap: 8px; }
.row-editor__field { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 8px; align-items: center; }
.row-editor__label { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.row-editor__label span { overflow: hidden; color: var(--el-text-color-regular); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.row-editor__label small { overflow: hidden; color: var(--el-text-color-secondary); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.row-editor__meta { margin-top: 12px; display: flex; align-items: center; gap: 8px; }
@media (max-width: 1100px) {
  .gen-body { grid-template-columns: 1fr; }
  .gen-rail { max-height: 260px; }
  .cfg-card { flex: 1; min-width: 220px; }
}
</style>
