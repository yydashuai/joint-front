<template>
  <el-dialog
    v-model="visible"
    title="导入数据链文件"
    width="860px"
    top="5vh"
    destroy-on-close
    @close="onClose"
  >
    <div v-if="!parsed.length" class="dci-empty">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".txt,.csv,.dat,.bin"
        :on-change="onFileChange"
        class="dci-upload"
      >
        <el-icon :size="40" color="var(--el-text-color-placeholder)"><UploadFilled /></el-icon>
        <div class="el-upload__text">点击或拖拽数据链文件到此处</div>
        <div class="dci-hint">支持 .txt / .csv / .dat / .bin，段落以「一、名称 / 二、名称」分隔，首行为字段名，其后为数据行</div>
      </el-upload>
      <div v-if="parseError" class="dci-parse-error">{{ parseError }}</div>
    </div>

    <div v-else class="dci-body">
      <div class="dci-view-toggle">
        <span class="dci-view-toggle__label">查看：</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="fields">字段定义</el-radio-button>
          <el-radio-button value="matrix">数据矩阵</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 保存目标（可选、不互斥） -->
      <div class="dci-targets">
        <span class="dci-targets__label">保存到：</span>
        <el-checkbox v-model="saveFields">报文字段管理（生成字段 + 报文定义）</el-checkbox>
        <el-checkbox v-model="saveDatasets">测试数据管理（生成数据集 + 历史数据）</el-checkbox>
        <el-tooltip content="两项均不勾选时，仅将文件登记到数据文件管理，可稍后在文件列表中重新解析" placement="top">
          <el-icon class="dci-targets__help"><QuestionFilled /></el-icon>
        </el-tooltip>
      </div>

      <!-- 每个报文的字段类型编辑 -->
      <el-scrollbar v-if="viewMode === 'fields'" class="dci-scroll" max-height="42vh">
        <div v-for="(para, pi) in parsed" :key="pi" class="dci-para">
          <div class="dci-para__head">
            <el-tag size="small" type="primary" effect="plain">{{ pi + 1 }}</el-tag>
            <span class="dci-para__name">{{ para.name }}</span>
            <span class="dci-para__meta">{{ para.fieldNames.length }} 字段 · {{ para.rows.length }} 行</span>
          </div>
          <el-table :data="para.fields" size="small" border class="dci-field-table">
            <el-table-column prop="name" label="字段名" min-width="160" show-overflow-tooltip />
            <el-table-column label="取值约束" min-width="230">
              <template #default="{ row }">
                <div v-if="row.kind === 'numeric'" class="dci-constraint">
                  <el-input-number v-model="row.constraint.min" :controls="false" size="small" class="dci-cnum" />
                  <span class="dci-tilde">~</span>
                  <el-input-number v-model="row.constraint.max" :controls="false" size="small" class="dci-cnum" />
                </div>
                <el-input
                  v-else
                  v-model="row.constraint.enumText"
                  size="small"
                  placeholder="枚举值用 / 分隔，留空为自由文本"
                />
              </template>
            </el-table-column>
            <el-table-column label="字段类型" width="180">
              <template #default="{ row }">
                <el-select v-model="row.type" size="small" style="width: 100%;" @change="(v) => onTypeChange(para, row, v)">
                  <el-option-group v-for="grp in typeGroups" :key="grp.label" :label="grp.label">
                    <el-option v-for="t in grp.options" :key="t.value" :label="t.label" :value="t.value" />
                  </el-option-group>
                </el-select>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-scrollbar>

      <!-- 数据矩阵（可编辑） -->
      <el-scrollbar v-else class="dci-scroll" max-height="42vh">
        <div v-for="(para, pi) in parsed" :key="pi" class="dci-para">
          <div class="dci-para__head">
            <el-tag size="small" type="primary" effect="plain">{{ pi + 1 }}</el-tag>
            <span class="dci-para__name">{{ para.name }}</span>
            <span class="dci-para__meta">{{ para.fieldNames.length }} 字段 · {{ para.rows.length }} 行</span>
          </div>
          <el-table :data="para.rows" size="small" border class="dci-matrix-table" :fit="false" style="width: 100%;">
            <el-table-column type="index" label="#" width="48" align="center" fixed="left" />
            <el-table-column
              v-for="fn in para.fieldNames"
              :key="fn"
              :prop="fn"
              :label="fn"
              :width="130"
            >
              <template #default="{ row }">
                <el-input v-model="row[fn]" size="small" />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-scrollbar>
    </div>

    <template #footer>
      <el-button v-if="parsed.length" text type="info" @click="resetAll">重新选择文件</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button v-if="parsed.length" type="primary" :disabled="!canImport" @click="openAssignmentDialog">
        {{ confirmLabel }}
      </el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="assignmentVisible"
    title="选择导入位置"
    width="480px"
    append-to-body
    destroy-on-close
  >
    <el-alert
      title="选择本次导入数据的所属系统和模块"
      :description="`将导入 ${parsed.length} 个报文、${totalRows} 条数据，可选择任意系统及其模块。`"
      type="info"
      :closable="false"
      show-icon
      class="dci-assignment-hint"
    />
    <el-form :model="form" label-width="82px" class="dci-assignment-form">
      <el-form-item label="所属系统" required>
        <el-select
          v-model="form.systemId"
          placeholder="选择系统"
          clearable
          filterable
          style="width: 100%;"
          @change="onSystemChange"
        >
          <el-option v-for="sys in systemStore.systems" :key="sys.id" :label="sys.name" :value="sys.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="所属模块" required>
        <el-select
          v-model="form.moduleId"
          placeholder="选择模块"
          clearable
          filterable
          style="width: 100%;"
          :disabled="!form.systemId"
        >
          <el-option v-for="mod in moduleOptions" :key="mod.id" :label="mod.name" :value="mod.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="assignmentVisible = false">返回检查</el-button>
      <el-button type="primary" :disabled="!canAssign" @click="performImport">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { UploadFilled, QuestionFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useProtocolStore, SCALAR_ENCODINGS, uid } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { parseDataChain } from '@/utils/dataChainImport'
import { readFileAsText, inferFileFormat } from '@/services/testDataService'

const props = defineProps({
  modelValue: Boolean,
  currentSystemId: { type: [String, Number], default: '' },
  currentModuleName: { type: String, default: '' },
  /** 预载文件（从数据文件管理「解析」进入）：{ name, content, systemId?, moduleName? } */
  presetFile: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'imported'])

const systemStore = useSystemStore()
const connStore = useConnectionStore()
const protoStore = useProtocolStore()
const tdStore = useTestDataStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const parsed = ref([])
const parseError = ref('')
const fileName = ref('')
const rawText = ref('')
const fromPreset = ref(false)

// 保存目标（可选、不互斥）
const saveFields = ref(true)
const saveDatasets = ref(true)

// 查看模式：字段定义 / 数据矩阵（可编辑）
const viewMode = ref('fields')

const assignmentVisible = ref(false)
const form = reactive({ systemId: '', moduleId: '' })

const moduleOptions = computed(() => {
  if (!form.systemId) return []
  return connStore.nodes.filter((module) => String(module.systemId) === String(form.systemId))
})
const selectedModule = computed(() =>
  connStore.nodes.find((module) =>
    String(module.id) === String(form.moduleId) &&
    String(module.systemId) === String(form.systemId)
  ) || null
)

const typeGroups = computed(() => {
  const groups = {}
  SCALAR_ENCODINGS.forEach((e) => {
    const g = e.group || '其他'
    if (!groups[g]) groups[g] = { label: g, options: [] }
    groups[g].options.push(e)
  })
  return Object.values(groups)
})

const totalRows = computed(() => parsed.value.reduce((s, p) => s + p.rows.length, 0))

const canImport = computed(() => parsed.value.length > 0)
const canAssign = computed(() => !!(form.systemId && form.moduleId && selectedModule.value))

const confirmLabel = computed(() => {
  const targets = []
  if (saveFields.value) targets.push('字段/报文')
  if (saveDatasets.value) targets.push('数据集')
  if (!targets.length) return `仅登记文件（${parsed.value.length} 个报文）`
  return `确认导入 ${targets.join(' + ')}（${parsed.value.length} 个报文）`
})

const applyText = (name, text) => {
  parseError.value = ''
  fileName.value = name
  rawText.value = text
  const result = parseDataChain(text)
  if (!result.length) {
    parseError.value = '未能解析出任何报文定义，请检查文件格式（段落标题需以「序号、名称」开头，如「一、MonitoringStatus」）。'
    parsed.value = []
    return false
  }
  result.forEach((p) => {
    p.fields.forEach((f) => {
      f.type = f.inferredType
      if (f.kind === 'numeric') {
        // 默认取值约束：依据数据范围生成
        f.constraint = { kind: 'range', min: f.min, max: f.max }
      } else {
        const uniq = [...new Set(p.rows.map(r => r[f.name]))].filter(v => v !== '' && v != null)
        f.constraint = { kind: (uniq.length && uniq.length <= 12) ? 'enum' : 'none', enumText: uniq.join('/') }
      }
    })
  })
  parsed.value = result
  return true
}

// 由用户编辑后的「取值约束」构建字段约束对象
const buildConstraint = (f) => {
  if (f.kind === 'numeric') {
    return { mode: 'range', min: Number(f.constraint?.min ?? 0), max: Number(f.constraint?.max ?? 0) }
  }
  const txt = (f.constraint?.enumText || '').trim()
  if (!txt) return { mode: 'none' }
  const entries = txt.split('/').map(s => s.trim()).filter(Boolean).map(v => ({ value: v, label: v }))
  return { mode: 'enum', entries }
}

watch(() => props.modelValue, (v) => {
  if (v) {
    resetAll()
    saveFields.value = true
    saveDatasets.value = true
    viewMode.value = 'fields'
    // 从数据文件管理「解析」进入：预载文件内容
    if (props.presetFile?.content) {
      fromPreset.value = true
      if (!applyText(props.presetFile.name || '数据链文件', props.presetFile.content)) {
        ElMessage.warning('该文件内容无法解析为数据链格式')
      }
    }
  }
})

const onSystemChange = () => { form.moduleId = '' }

const onFileChange = async (file) => {
  parseError.value = ''
  const raw = file?.raw || file
  if (!raw) return
  try {
    const text = await readFileAsText(raw)
    fromPreset.value = false
    applyText(raw.name, text)
  } catch (e) {
    parseError.value = '文件读取失败：' + (e?.message || e)
  }
}

// 用户切换类型后，若该列被改为数值但样例含字符串，重新推断提示（不强制）
const onTypeChange = () => {}

const resetAll = () => {
  parsed.value = []
  parseError.value = ''
  fileName.value = ''
  rawText.value = ''
  fromPreset.value = false
  viewMode.value = 'fields'
  assignmentVisible.value = false
  form.systemId = ''
  form.moduleId = ''
}

const onClose = () => {
  assignmentVisible.value = false
  emit('update:modelValue', false)
}

/* ============ 构建并写入 stores ============ */
const openAssignmentDialog = () => {
  if (!canImport.value) return
  const preferredSystemId = props.presetFile?.systemId || props.currentSystemId || ''
  const preferredModuleName = props.presetFile?.moduleName || props.currentModuleName || ''
  form.systemId = preferredSystemId
  form.moduleId = connStore.nodes.find(
    (module) =>
      String(module.systemId) === String(preferredSystemId) &&
      module.name === preferredModuleName
  )?.id || ''
  assignmentVisible.value = true
}

const performImport = () => {
  if (!canAssign.value) {
    ElMessage.warning('请选择所属系统和模块')
    return
  }
  const systemId = form.systemId
  const moduleId = form.moduleId
  const moduleName = selectedModule.value.name
  const createdIds = []

  parsed.value.forEach((para) => {
    let proto = null
    let iface = null

    // 1) 可选：报文字段管理（字段 protocol + 报文 interface）
    if (saveFields.value) {
      const byteFields = para.fields.map((f) => {
        const dataType = f.type
        return {
          id: uid(),
          kind: 'byte',
          name: f.name,
          byteOffset: 0,
          byteLength: SCALAR_ENCODINGS.find((e) => e.value === dataType)?.bytes ?? 0,
          bitMode: false,
          dataType,
          constraint: buildConstraint(f),
          desc: '',
          remark: '',
          children: []
        }
      })

      proto = protoStore.addProtocol({
        name: `${para.name}字段`,
        systemId,
        moduleId,
        desc: `数据链导入自动生成（${para.fieldNames.length} 字段，${para.rows.length} 行）`,
        fields: byteFields
      })
      // 兼容 DatasetEditor 读取路径
      proto.config = { fields: byteFields }

      iface = protoStore.addInterface({
        name: `${para.name}报文`,
        transportType: 'OSE',
        systemId,
        moduleId,
        protocolRefs: [{ protocolId: proto.id, role: 'send' }],
        desc: '数据链文件导入自动生成报文'
      })
    }

    // 2) 可选：测试数据管理（数据集 + 历史数据）
    if (saveDatasets.value) {
      const ds = tdStore.addDataset({
        name: `${para.name}数据集`,
        systemId,
        moduleName,
        linkedProtocol: proto?.name || '',
        linkedInterface: iface?.name || '',
        desc: `数据链文件「${fileName.value}」导入（${para.rows.length} 行）`
      })

      let rowSeq = 90000
      ds.rows = para.rows.map((r, i) => ({
        id: ++rowSeq,
        label: `行 ${i + 1}`,
        values: { ...r }
      }))

      // 同时写入历史数据（来源=文件导入，默认正常）
      tdStore.addHistoryRows(ds.id, para.rows.map((r, i) => ({
        label: `行 ${i + 1}`,
        values: { ...r },
        source: '文件导入',
        abnormal: false,
        excellent: false
      })))

      createdIds.push(ds.id)
    }
  })

  // 3) 始终：登记到数据文件管理（保留原文内容，可再次解析；预载自文件列表时不重复登记）
  if (!fromPreset.value && rawText.value) {
    tdStore.addFile({
      name: fileName.value || '数据链文件.dat',
      format: inferFileFormat(fileName.value || '.dat'),
      size: new Blob([rawText.value]).size,
      systemId,
      moduleName,
      desc: `数据链文件（${parsed.value.length} 个报文 / ${totalRows.value} 条数据）`,
      rowCount: totalRows.value,
      content: rawText.value
    })
  }

  const doneParts = []
  if (saveFields.value) doneParts.push(`${parsed.value.length} 组字段/报文`)
  if (saveDatasets.value) doneParts.push(`${createdIds.length} 个数据集（${totalRows.value} 条数据）`)
  if (!doneParts.length) doneParts.push('文件已登记到数据文件管理')
  ElMessage.success(`导入完成：${doneParts.join('，')}`)
  emit('imported', createdIds)
  assignmentVisible.value = false
  visible.value = false
}
</script>

<style scoped lang="scss">
.dci-empty { padding: 8px 0; }
.dci-upload { width: 100%; }
.dci-hint { font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 6px; }
.dci-parse-error { margin-top: 10px; color: var(--el-color-danger); font-size: 13px; }

.dci-body { display: flex; flex-direction: column; gap: 12px; }
.dci-targets {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  &__label { font-size: 13px; color: var(--el-text-color-regular); font-weight: 600; }
  &__help { color: var(--el-text-color-placeholder); cursor: help; }
}
.dci-scroll { border: 1px solid var(--el-border-color-lighter); border-radius: 6px; padding: 4px; }
.dci-para { padding: 6px 4px; }
.dci-para + .dci-para { border-top: 1px dashed var(--el-border-color-lighter); }
.dci-para__head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.dci-para__name { font-weight: 600; font-size: 14px; }
.dci-para__meta { font-size: 12px; color: var(--el-text-color-secondary); }
.dci-field-table { margin-bottom: 4px; }
.dci-matrix-table { margin-bottom: 4px; }

.dci-view-toggle {
  display: flex;
  align-items: center;
  gap: 10px;

  &__label { font-size: 13px; color: var(--el-text-color-regular); font-weight: 600; }
  &__hint { font-size: 12px; color: var(--el-text-color-placeholder); }
}

.dci-constraint { display: flex; align-items: center; gap: 4px; }
.dci-cnum { width: 92px; }
.dci-tilde { color: var(--el-text-color-placeholder); }

.mono { font-family: 'Consolas', 'Monaco', monospace; }
.text-secondary { color: var(--el-text-color-secondary); }

.dci-assignment-hint { margin-bottom: 18px; }
.dci-assignment-form {
  padding-right: 12px;
  :deep(.el-form-item:last-child) { margin-bottom: 0; }
}
</style>
