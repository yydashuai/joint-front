<template>
  <el-dialog
    v-model="visible"
    :title="mode === 'variant' ? '修改副本并保存' : '存入数据集'"
    width="680px"
    destroy-on-close
  >
    <div class="dialog-body">
      <div class="source-note">
        <strong>{{ mode === 'variant' ? '修改只作用于新副本，异常库中的原始接收数据不会改变。' : `已选择 ${samples.length} 条异常样本` }}</strong>
      </div>

      <section v-if="mode === 'variant' && samples[0]" class="edit-section">
        <div class="section-title">
          <span>副本数据</span>
          <small>{{ samples[0].iface }}</small>
        </div>
        <div class="field-editor">
          <div v-for="field in draftFields" :key="field.name" class="field-row">
            <label>
              <strong>{{ field.label }}</strong>
              <small>{{ field.name }}</small>
            </label>
            <el-input
              v-if="field.name !== '原始报文'"
              v-model="field.value"
              placeholder="输入新的测试值"
            />
            <el-input
              v-else
              v-model="field.value"
              type="textarea"
              :rows="4"
              placeholder="输入原始十六进制数据"
              class="mono-input"
            />
          </div>
        </div>
      </section>

      <section class="target-section">
        <div class="section-title"><span>保存位置</span></div>
        <el-radio-group v-model="targetMode">
          <el-radio-button value="existing">已有数据集</el-radio-button>
          <el-radio-button value="new">新建数据集</el-radio-button>
        </el-radio-group>

        <div v-if="targetMode === 'existing'" class="target-form">
          <el-select v-model="datasetId" filterable placeholder="选择目标数据集">
            <el-option
              v-for="dataset in candidateDatasets"
              :key="dataset.id"
              :label="datasetLabel(dataset)"
              :value="dataset.id"
            />
          </el-select>
          <p v-if="!candidateDatasets.length">当前还没有可用数据集，请选择“新建数据集”。</p>
        </div>

        <div v-else class="target-form">
          <el-input v-model="newName" maxlength="50" show-word-limit placeholder="输入数据集名称" />
          <div class="scope-preview">
            <span>所属系统</span><strong>{{ systemName }}</strong>
            <span>所属模块</span><strong>{{ moduleName }}</strong>
            <span>关联报文</span><strong>{{ samples[0]?.iface || '未关联' }}</strong>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!canSubmit" @click="submit">
        {{ mode === 'variant' ? '保存数据变体' : '确认入库' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useExceptionStore } from '@/stores/exception'
import { useTestDataStore } from '@/stores/testData'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  samples: { type: Array, default: () => [] },
  mode: { type: String, default: 'save' },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const exceptionStore = useExceptionStore()
const dataStore = useTestDataStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const targetMode = ref('existing')
const datasetId = ref(null)
const newName = ref('')
const draftFields = ref([])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const firstSample = computed(() => props.samples[0] || null)
const candidateDatasets = computed(() => {
  const systemId = firstSample.value?.systemId
  return dataStore.datasets.filter((dataset) => !systemId || dataset.systemId === systemId)
})
const systemName = computed(() => systemStore.systems.find((item) => item.id === firstSample.value?.systemId)?.name || '未归属系统')
const moduleName = computed(() => connStore.nodes.find((item) => item.id === firstSample.value?.moduleId)?.name || '未归属模块')
const canSubmit = computed(() => props.samples.length > 0 && (
  targetMode.value === 'existing' ? datasetId.value != null : newName.value.trim()
))

watch(() => [props.modelValue, props.mode, props.samples.map((item) => item.id).join(',')], ([opened]) => {
  if (!opened) return
  targetMode.value = candidateDatasets.value.length ? 'existing' : 'new'
  datasetId.value = candidateDatasets.value[0]?.id ?? null
  newName.value = `${firstSample.value?.iface || '异常报文'}异常样本`
  const sample = firstSample.value
  const labels = new Map((sample?.fields || []).map((field) => [field.name, field.label || field.desc || field.name]))
  const entries = Object.entries(sample?.values || {})
  draftFields.value = (entries.length ? entries : [['原始报文', sample?.rawHex || sample?.detail?.reqHex || '']])
    .map(([name, value]) => ({
      name,
      label: labels.get(name) || name,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
    }))
}, { immediate: true })

const datasetLabel = (dataset) => {
  const suffix = dataset.linkedInterface ? ` · ${dataset.linkedInterface}` : ''
  return `${dataset.name}${suffix}`
}
const originalValues = (sample) => {
  const values = sample.values || {}
  if (Object.keys(values).length) return { ...values }
  return { 原始报文: sample.rawHex || sample.detail?.reqHex || '' }
}
const variantValues = () => Object.fromEntries(draftFields.value.map((field) => [field.name, field.value]))

const submit = () => {
  if (!canSubmit.value) return
  let dataset = dataStore.datasets.find((item) => String(item.id) === String(datasetId.value))
  if (targetMode.value === 'new') {
    dataset = dataStore.addDataset({
      name: newName.value.trim(),
      systemId: firstSample.value?.systemId || null,
      moduleName: moduleName.value === '未归属模块' ? '' : moduleName.value,
      linkedInterface: firstSample.value?.iface || '',
      desc: '由异常数据管理保存，用于复现异常或构造对端测试数据。',
    })
  }
  if (!dataset) return

  const isVariant = props.mode === 'variant'
  const rows = props.samples.map((sample, index) => ({
    label: isVariant ? `${sample.iface} · 异常变体` : `${sample.iface} · 捕获样本 ${index + 1}`,
    values: isVariant ? variantValues() : originalValues(sample),
    source: isVariant ? '异常样本变体' : '异常数据捕获',
    abnormal: true,
    excellent: false,
    remark: isVariant
      ? `基于 ${sample.capturedTime} 捕获的${sample.type}样本修改`
      : (sample.issues?.map((issue) => issue.message).join('；') || sample.detail?.ruleMessage || sample.type),
  }))
  const savedRows = dataStore.addHistoryRows(dataset.id, rows)
  exceptionStore.markSaved(props.samples.map((item) => item.id), dataset.id, { variant: isVariant })
  ElMessage.success(isVariant ? '数据变体已保存到数据集' : `已保存 ${savedRows.length} 条异常样本`)
  emit('saved', { dataset, rows: savedRows, variant: isVariant })
  visible.value = false
}
</script>

<style scoped lang="scss">
.dialog-body { display: flex; flex-direction: column; gap: 16px; }
.source-note {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgba(64, 158, 255, .18);
  border-radius: 8px;
  background: rgba(64, 158, 255, .07);
}
.source-note span { color: var(--el-text-color-secondary); font-size: 13px; }
.edit-section,
.target-section {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 700;
}
.section-title small { color: var(--el-text-color-secondary); font-weight: 400; }
.field-editor { display: flex; max-height: 300px; flex-direction: column; gap: 10px; overflow: auto; }
.field-row {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}
.field-row label { display: flex; min-width: 0; flex-direction: column; padding-top: 7px; }
.field-row label small {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-family: Consolas, Monaco, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.target-form { margin-top: 12px; }
.target-form > .el-select,
.target-form > .el-input { width: 100%; }
.target-form p { margin: 8px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
.scope-preview {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 8px 12px;
  margin-top: 12px;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  font-size: 13px;
}
.scope-preview span { color: var(--el-text-color-secondary); }
.scope-preview strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mono-input :deep(textarea) { font-family: Consolas, Monaco, monospace; }
</style>
