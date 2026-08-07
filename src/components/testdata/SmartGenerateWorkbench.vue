<template>
  <el-dialog v-model="visible" class="smart-workbench-dialog" width="980px" :close-on-click-modal="false" destroy-on-close>
    <template #header>
      <div class="workbench-title">
        <span class="workbench-title__icon"><el-icon><MagicStick /></el-icon></span>
        <div><strong>智能生成测试数据</strong><small>自动依据字段约束和已有样本生成</small></div>
        <el-tag type="success" effect="plain">{{ dataset.name }}</el-tag>
      </div>
    </template>

    <el-steps :active="step" finish-status="success" simple class="workbench-steps">
      <el-step title="生成设置" />
      <el-step title="预览并入库" />
    </el-steps>

    <div class="workbench-body">
      <section v-if="step === 0" class="settings-layout">
        <div class="target-card">
          <span class="eyebrow">生成对象</span>
          <h3>{{ message?.name || dataset.linkedInterface || '未关联报文' }}</h3>
          <p>{{ ownerInterface?.name || '未关联接口' }}</p>

          <div class="target-facts">
            <div><span>写入数据集</span><strong>{{ dataset.name }}</strong></div>
            <div><span>可生成字段</span><strong>{{ fields.length }} 个</strong></div>
            <div><span>当前数据</span><strong>{{ dataset.rows?.length || 0 }} 条</strong></div>
          </div>

          <div class="sample-box">
            <div class="sample-box__head"><strong>系统已自动匹配参考数据</strong><el-icon><CircleCheckFilled /></el-icon></div>
            <div class="sample-counts">
              <span><b>{{ autoExcellentCount }}</b> 条优秀样本</span>
              <span><b>{{ autoHistoryCount }}</b> 条历史样本</span>
            </div>
            <small v-if="autoReferences.length">优先使用同一报文的优秀样本，并结合近期历史数据生成。</small>
            <small v-else>暂无可用样本，将仅依据报文字段约束生成。</small>
          </div>
        </div>

        <div class="settings-panel">
          <div class="section-title"><div><strong>选择生成范围</strong><span>只需设置数量和数据类型，其余过程由系统完成</span></div></div>
          <el-form label-position="top">
            <el-form-item label="生成数量">
              <el-input-number v-model="count" :min="1" :max="50" controls-position="right" />
              <span class="form-note">最多一次生成 50 条</span>
            </el-form-item>
            <el-form-item label="数据类型">
              <el-radio-group v-model="mode" class="mode-grid">
                <el-radio value="normal" border><span><b>常规数据</b><small>全部满足字段约束</small></span></el-radio>
                <el-radio value="boundary" border><span><b>边界数据</b><small>覆盖最小值、最大值和枚举</small></span></el-radio>
                <el-radio value="abnormal" border><span><b>异常数据</b><small>每条包含一项违规字段</small></span></el-radio>
                <el-radio value="mixed" border><span><b>综合数据</b><small>组合常规、边界和异常场景</small></span></el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>

          <div class="auto-process">
            <span>系统自动完成</span>
            <div><i>1</i>匹配同报文样本</div><b>→</b><div><i>2</i>组合字段约束</div><b>→</b><div><i>3</i>校验并去重</div>
          </div>
          <el-alert v-if="!fields.length" type="warning" :closable="false" show-icon title="当前报文没有可生成的字段，请先完成报文字段配置。" />
        </div>
      </section>

      <section v-else class="preview-step">
        <div class="preview-summary">
          <div><span>生成结果</span><b>{{ candidates.length }}</b><small>条候选数据</small></div>
          <div><span>校验通过</span><b class="ok">{{ normalCount }}</b><small>可直接使用</small></div>
          <div><span>预期异常</span><b class="bad">{{ abnormalCount }}</b><small>用于异常测试</small></div>
        </div>

        <el-alert
          v-if="skippedCount > 0"
          class="dedupe-alert"
          type="info"
          :closable="false"
          show-icon
          :title="`已自动排除 ${skippedCount} 条与现有数据重复的结果。`"
        />

        <div class="preview-layout">
          <el-table :data="candidates" height="318" highlight-current-row @current-change="activeCandidate = $event">
            <el-table-column prop="label" label="生成数据" min-width="135" />
            <el-table-column label="数据类型" width="105">
              <template #default="{ row }"><el-tag :type="candidateType(row).type" size="small" effect="plain">{{ candidateType(row).label }}</el-tag></template>
            </el-table-column>
            <el-table-column label="校验结果" width="110">
              <template #default="{ row }"><el-tag :type="isAbnormal(row) ? 'danger' : 'success'" size="small">{{ isAbnormal(row) ? '预期异常' : '校验通过' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="72" align="center">
              <template #default="{ $index }"><el-button link type="danger" @click="removeCandidate($index)">剔除</el-button></template>
            </el-table-column>
          </el-table>

          <div class="candidate-editor">
            <template v-if="activeCandidate">
              <header>
                <div><strong>数据详情</strong><small>修改字段后实时重新校验</small></div>
                <el-button link type="primary" @click="regenerateCandidate">重新生成本条</el-button>
              </header>
              <el-scrollbar height="270px">
                <div v-for="(value, key) in activeCandidate.values" :key="key" class="candidate-field">
                  <span>{{ key }}</span><el-input v-model="activeCandidate.values[key]" size="small" />
                </div>
              </el-scrollbar>
            </template>
            <el-empty v-else description="选择一条数据查看详情" :image-size="64" />
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="workbench-footer">
        <el-button @click="visible = false">取消</el-button>
        <span />
        <el-button v-if="step === 1" @click="step = 0">调整设置</el-button>
        <el-button v-if="step === 0" type="primary" :loading="generating" :disabled="!fields.length" @click="generateCandidates">生成预览</el-button>
        <el-button v-else type="success" :disabled="!candidates.length" @click="confirmCandidates">确认入库 {{ candidates.length }} 条</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, MagicStick } from '@element-plus/icons-vue'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'

const props = defineProps({ modelValue: Boolean, dataset: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue', 'confirmed'])
const store = useTestDataStore()
const protocolStore = useProtocolStore()
const visible = computed({ get: () => props.modelValue, set: (value) => emit('update:modelValue', value) })

const step = ref(0)
const count = ref(8)
const mode = ref('mixed')
const candidates = ref([])
const activeCandidate = ref(null)
const generating = ref(false)

const message = computed(() => protocolStore.interfaces.find((item) => String(item.id) === String(props.dataset.messageId)) || protocolStore.interfaces.find((item) => item.name === props.dataset.linkedInterface))
const ownerInterface = computed(() => protocolStore.testInterfaces.find((item) => String(item.id) === String(message.value?.ownerIfaceId)))
const fields = computed(() => message.value ? collectInterfaceDatasetFields(message.value, protocolStore.protocols) : store.fieldDefsOfDataset(props.dataset.id))
const relatedHistory = computed(() => store.allHistoryData
  .filter((row) => String(row.messageId) === String(message.value?.id || props.dataset.messageId) || row._datasetId === props.dataset.id)
  .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))))
const autoReferences = computed(() => {
  const excellent = relatedHistory.value.filter((row) => row.excellent).slice(0, 8)
  const excellentKeys = new Set(excellent.map((row) => `${row._datasetId}-${row.id}`))
  const history = relatedHistory.value.filter((row) => !excellentKeys.has(`${row._datasetId}-${row.id}`)).slice(0, 12)
  return [...excellent, ...history]
})
const autoExcellentCount = computed(() => autoReferences.value.filter((row) => row.excellent).length)
const autoHistoryCount = computed(() => autoReferences.value.filter((row) => !row.excellent).length)
const normalCount = computed(() => candidates.value.filter((item) => !isAbnormal(item)).length)
const abnormalCount = computed(() => candidates.value.filter(isAbnormal).length)
const skippedCount = computed(() => Math.max(0, count.value - candidates.value.length))

const isAbnormal = (item) => store.computeAbnormal(item.values, props.dataset.id)
const candidateType = (item) => {
  if (isAbnormal(item)) return { label: '异常', type: 'danger' }
  if (item.coverageTags?.includes('边界值')) return { label: '边界', type: 'warning' }
  return { label: '常规', type: 'success' }
}
const makeOptions = () => ({
  referenceRows: autoReferences.value,
  referenceIds: autoReferences.value.map((row) => `${row._datasetId}-${row.id}`),
  preferExcellent: autoExcellentCount.value > 0,
})

const generateCandidates = async () => {
  generating.value = true
  await nextTick()
  candidates.value = store.generateTestData(props.dataset.id, count.value, mode.value, makeOptions())
    .map((item, index) => ({ ...item, label: `生成数据 ${index + 1}` }))
  generating.value = false
  if (!candidates.value.length) {
    ElMessage.warning('未生成可用数据，请检查字段约束或现有数据是否已完整覆盖目标值')
    return
  }
  step.value = 1
  await nextTick()
  activeCandidate.value = candidates.value[0]
}
const regenerateCandidate = () => {
  const index = candidates.value.indexOf(activeCandidate.value)
  const [replacement] = store.generateTestData(props.dataset.id, 1, mode.value, makeOptions())
  if (index >= 0 && replacement) {
    replacement.label = activeCandidate.value.label
    candidates.value.splice(index, 1, replacement)
    activeCandidate.value = replacement
  } else {
    ElMessage.warning('没有生成不同于现有数据的新结果')
  }
}
const removeCandidate = (index) => {
  const removed = candidates.value[index]
  candidates.value.splice(index, 1)
  if (removed === activeCandidate.value) activeCandidate.value = candidates.value[index] || candidates.value[index - 1] || null
}
const confirmCandidates = () => {
  const rows = candidates.value.map((item, index) => ({
    id: Date.now() + index,
    label: item.label,
    values: { ...item.values },
    source: '智能生成',
    generationMeta: { strategy: item.strategy, referenceIds: item.referenceIds, coverageTags: item.coverageTags }
  }))
  store.insertRowsAfter(props.dataset.id, null, rows)
  store.addHistoryRows(props.dataset.id, rows.map((row) => ({
    ...row,
    abnormal: store.computeAbnormal(row.values, props.dataset.id),
    customTags: row.generationMeta.coverageTags,
    validationResult: store.computeAbnormal(row.values, props.dataset.id) ? '存在字段约束异常' : '校验通过'
  })))
  autoReferences.value.forEach((row) => store.updateHistoryRow(row._datasetId, row.id, {
    usageCount: Number(row.usageCount || 0) + 1,
    lastUsedAt: new Date().toLocaleString('zh-CN', { hour12: false })
  }))
  emit('confirmed', rows)
  visible.value = false
  ElMessage.success(`已将 ${rows.length} 条数据写入当前数据集，并同步保存到历史数据库`)
}

watch(visible, (open) => {
  if (!open) return
  step.value = 0
  candidates.value = []
  activeCandidate.value = null
})
</script>

<style scoped lang="scss">
.workbench-title { display: flex; align-items: center; gap: 12px; padding-right: 28px; }
.workbench-title__icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 10px; background: #eeeafd; color: #6d5ce7; font-size: 19px; }
.workbench-title > div { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.workbench-title strong { font-size: 17px; }
.workbench-title small { color: var(--el-text-color-secondary); }
.workbench-steps { margin: 2px 0 14px; padding: 8px 16px; background: #f7f6fc; }
.workbench-body { height: min(470px, 56vh); min-height: 380px; overflow: hidden; }
.settings-layout { height: 100%; display: grid; grid-template-columns: 350px minmax(0, 1fr); gap: 22px; }
.target-card { position: relative; padding: 22px; border: 1px solid #dcd7fa; border-radius: 11px; background: linear-gradient(145deg, #f5f3ff, #fff 64%); overflow: hidden; }
.target-card::after { position: absolute; right: -55px; top: -55px; width: 145px; height: 145px; border: 23px solid rgba(109,92,231,.07); border-radius: 50%; content: ''; pointer-events: none; }
.eyebrow { color: #6d5ce7; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
.target-card h3 { position: relative; margin: 17px 0 5px; font-size: 20px; }
.target-card > p { margin: 0 0 22px; color: var(--el-text-color-secondary); }
.target-facts { position: relative; border-top: 1px solid #e5e1f8; }
.target-facts > div { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #ece9fa; font-size: 13px; }
.target-facts span { color: var(--el-text-color-secondary); }
.target-facts strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sample-box { position: relative; margin-top: 18px; padding: 13px; border: 1px solid #d9e9df; border-radius: 8px; background: #f5fbf7; }
.sample-box__head { display: flex; justify-content: space-between; color: #277d4e; font-size: 13px; }
.sample-counts { display: flex; gap: 18px; margin: 11px 0 7px; }
.sample-counts span { color: var(--el-text-color-secondary); font-size: 12px; }
.sample-counts b { margin-right: 3px; color: var(--el-text-color-primary); font-size: 18px; }
.sample-box small { color: var(--el-text-color-secondary); line-height: 1.5; }
.settings-panel { min-width: 0; padding: 4px 8px; }
.section-title { margin-bottom: 20px; }
.section-title > div { display: flex; flex-direction: column; gap: 4px; }
.section-title strong { font-size: 16px; }.section-title span { color: var(--el-text-color-secondary); font-size: 12px; }
.form-note { margin-left: 10px; color: var(--el-text-color-secondary); font-size: 12px; }
.mode-grid { width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mode-grid :deep(.el-radio) { width: 100%; height: auto; min-height: 66px; margin: 0; padding: 12px; align-items: flex-start; }
.mode-grid :deep(.el-radio__label) { flex: 1; }
.mode-grid span { display: flex; flex-direction: column; gap: 4px; white-space: normal; }
.mode-grid small { color: var(--el-text-color-secondary); line-height: 1.35; }
.auto-process { margin: 18px 0 14px; padding: 12px; display: flex; align-items: center; gap: 8px; border-radius: 8px; background: var(--el-fill-color-extra-light); color: var(--el-text-color-secondary); font-size: 12px; }
.auto-process > span { margin-right: auto; font-weight: 600; color: var(--el-text-color-regular); }
.auto-process div { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.auto-process i { width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: #e9e5fc; color: #6d5ce7; font-size: 10px; font-style: normal; font-weight: 700; }
.auto-process b { color: var(--el-border-color); }
.preview-step { height: 100%; display: flex; flex-direction: column; gap: 10px; }
.preview-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.preview-summary > div { padding: 10px 13px; display: grid; grid-template-columns: 1fr auto; align-items: center; border-left: 3px solid #6d5ce7; background: var(--el-fill-color-extra-light); }
.preview-summary span, .preview-summary small { color: var(--el-text-color-secondary); font-size: 11px; }
.preview-summary small { grid-column: 1; }.preview-summary b { grid-row: 1 / 3; grid-column: 2; font-size: 23px; }
.preview-summary .ok { color: #2f9e64; }.preview-summary .bad { color: #d94242; }
.dedupe-alert { padding-top: 6px; padding-bottom: 6px; }
.preview-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.2fr .8fr; gap: 14px; }
.candidate-editor { min-height: 0; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; }
.candidate-editor header { margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
.candidate-editor header > div { display: flex; flex-direction: column; gap: 2px; }
.candidate-editor header small { color: var(--el-text-color-secondary); }
.candidate-field { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px; align-items: center; margin-bottom: 7px; }
.candidate-field span { overflow: hidden; color: var(--el-text-color-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.workbench-footer { width: 100%; display: flex; gap: 8px; }.workbench-footer > span { flex: 1; }
@media (max-width: 900px) { .settings-layout { grid-template-columns: 1fr; overflow: auto; }.target-card { min-height: 330px; }.preview-layout { grid-template-columns: 1fr; overflow: auto; } }
</style>

<style lang="scss">
.smart-workbench-dialog { margin-top: 4vh; }
.smart-workbench-dialog .el-dialog__body { padding-top: 8px; padding-bottom: 8px; }
</style>
