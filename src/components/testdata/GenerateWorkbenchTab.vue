<template>
  <div class="gen-workbench">
    <!-- 顶部工具栏 -->
    <div class="gen-toolbar">
      <el-select v-model="strategyId" placeholder="载入生成策略" clearable filterable style="width: 180px" @change="onLoadStrategy">
        <el-option v-for="s in store.generationStrategies" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-button size="small" :disabled="!strategyId" @click="saveStrategy">保存策略</el-button>
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
      <aside class="gen-config">
        <section class="cfg-card">
          <header>数据源</header>
          <el-form label-position="top" size="small">
            <el-form-item label="报文（按接口筛选）">
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
            <div><span>可生成字段</span><b>{{ fields.length }}</b></div>
            <div><span>当前数据</span><b>{{ selectedDs.rows?.length || 0 }} 条</b></div>
            <div><span>约束构成</span><b>{{ constraintSummary }}</b></div>
          </div>
          <el-alert v-else type="info" :closable="false" show-icon title="请选择目标数据集" />
        </section>

        <section v-if="selectedDs" class="cfg-card">
          <header>参考样本（分布学习）</header>
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

        <section v-if="method === 'constraint' && selectedDs" class="cfg-card">
          <header>字段规则与覆盖率</header>
          <el-checkbox v-model="enumAll" size="small" style="margin-bottom: 6px">枚举值全覆盖</el-checkbox>
          <el-table :data="overrideRows" size="small" max-height="150" empty-text="无带约束字段">
            <el-table-column prop="name" label="字段" min-width="70" show-overflow-tooltip />
            <el-table-column label="规则" width="104">
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
      </aside>

      <!-- 右主区 -->
      <section class="gen-main">
        <div class="gen-stats">
          <div><span>生成结果</span><b>{{ resultRows.length }}</b><small>条候选</small></div>
          <div><span>常规</span><b class="ok">{{ normalCount }}</b></div>
          <div><span>边界</span><b class="warn">{{ boundaryCount }}</b></div>
          <div><span>字段异常</span><b class="bad">{{ abnormalCount }}</b></div>
          <div class="gen-stats__cov">
            <span>枚举覆盖</span>
            <el-progress :percentage="coverage.enumPct ?? 0" :stroke-width="6" :show-text="false" style="width: 90px" />
            <b v-if="coverage.enumPct != null">{{ coverage.enumPct }}%</b>
            <b v-else class="muted">—</b>
          </div>
        </div>

        <div class="gen-table">
          <el-table :data="resultRows" height="100%" highlight-current-row @row-click="openDetail" @current-change="activeRow = $event">
            <el-table-column prop="label" label="生成数据" min-width="120" show-overflow-tooltip />
            <el-table-column label="类型" width="86">
              <template #default="{ row }">
                <el-tag size="small" :type="candidateType(row).type" effect="plain">{{ candidateType(row).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="策略" width="96">
              <template #default="{ row }"><span class="muted">{{ row.strategy || '—' }}</span></template>
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
          <span>已生成 <b>{{ resultRows.length }}</b> 条</span>
          <el-button size="small" :disabled="!resultRows.length" @click="clearResult">清空</el-button>
          <el-button size="small" :disabled="!resultRows.length" @click="exportJson">导出 JSON</el-button>
          <el-button size="small" type="success" :disabled="!resultRows.length" @click="confirmImport">确认入库 {{ resultRows.length }} 条</el-button>
        </div>
      </section>
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
import { analyzeDistribution, coverageOf } from '@/utils/dataGen'
import { downloadBlob } from '@/services/testDataService'

const store = useTestDataStore()
const protoStore = useProtocolStore()
const analysisStore = useAnalysisStore()

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
    generationMeta: { strategy: row.strategy, coverageTags: row.coverageTags || [], method: method.value },
  }))
  store.insertRowsAfter(ds.id, null, rows)
  store.addHistoryRows(ds.id, rows.map((row) => ({
    ...row,
    abnormal: store.computeAbnormal(row.values, ds.id),
    customTags: row.generationMeta.coverageTags,
    validationResult: store.computeAbnormal(row.values, ds.id) ? '存在字段约束异常' : '校验通过',
  })))
  analysisStore.recordAction({ type: '智能生成', target: ds.name })
  clearResult()
  ElMessage.success(`已将 ${rows.length} 条数据写入「${ds.name}」并同步历史数据库`)
}

const exportJson = () => {
  const ds = selectedDs.value
  const data = resultRows.value.map(({ label, values, strategy, coverageTags }) => ({
    dataset: ds?.name || '',
    label, values, strategy: strategy || method.value, coverageTags: coverageTags || [],
  }))
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), '智能生成结果.json')
}

/* ---------- 策略 ---------- */
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
.gen-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 12px; }
.gen-config { min-height: 0; display: flex; flex-direction: column; gap: 10px; overflow: auto; }
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
.ds-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
.ds-facts div { padding: 7px 8px; border-radius: 7px; background: var(--el-fill-color-extra-light); }
.ds-facts span { display: block; color: var(--el-text-color-secondary); font-size: 11px; }
.ds-facts b { font-size: 16px; }
.sample-counts { display: flex; gap: 14px; margin-bottom: 6px; font-size: 12px; }
.sample-counts b { margin-right: 2px; font-size: 16px; color: var(--asset); }
.dist-preview { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; }
.dist-preview div { display: flex; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 6px; background: var(--el-fill-color-extra-light); }
.dist-preview span { font-size: 12px; }
.dist-preview small { color: var(--el-text-color-secondary); font-size: 11px; }
.gen-main { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.gen-stats {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}
.gen-stats > div { min-width: 0; padding-right: 10px; border-right: 1px solid var(--el-border-color); }
.gen-stats > div:last-child { border-right: 0; }
.gen-stats span { color: var(--el-text-color-secondary); font-size: 11px; margin-right: 4px; }
.gen-stats b { font-size: 18px; }
.gen-stats .ok { color: var(--el-color-success); }
.gen-stats .warn { color: var(--el-color-warning); }
.gen-stats .bad { color: var(--el-color-danger); }
.gen-stats__cov { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.gen-table { position: relative; flex: 1; min-height: 0; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow: hidden; }
.gen-batch-bar {
  flex-shrink: 0;
  min-height: 42px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
  opacity: .55;
}
.gen-batch-bar.visible { opacity: 1; border-color: color-mix(in srgb, var(--asset) 25%, #dfe5ec); }
.gen-batch-bar > span { margin-right: auto; font-size: 12px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.row-editor { display: flex; flex-direction: column; gap: 8px; }
.row-editor__field { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 8px; align-items: center; }
.row-editor__label { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.row-editor__label span { overflow: hidden; color: var(--el-text-color-regular); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.row-editor__label small { overflow: hidden; color: var(--el-text-color-secondary); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.row-editor__meta { margin-top: 12px; display: flex; align-items: center; gap: 8px; }
@media (max-width: 1100px) { .gen-body { grid-template-columns: 1fr; } .gen-config { flex-direction: row; flex-wrap: wrap; } .cfg-card { flex: 1; min-width: 220px; } }
</style>
