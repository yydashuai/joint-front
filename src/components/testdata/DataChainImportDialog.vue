<template>
  <el-dialog
    v-model="visible"
    title="文件解析"
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
        <span class="dci-view-toggle__hint">解析结果默认折叠，点击报文卡片展开查看 / 编辑</span>
      </div>

      <!-- 解析结果：报文卡片，默认折叠 -->
      <div class="dci-paras">
        <div
          v-for="(para, pi) in parsed"
          :key="pi"
          class="dci-para-card"
          :class="{ 'dci-para-card--open': expandedSet.has(pi) }"
        >
          <div class="dci-para-card__head" @click="togglePara(pi)">
            <el-tag size="small" type="primary" effect="plain">{{ pi + 1 }}</el-tag>
            <span class="dci-para-card__name">{{ para.name }}</span>
            <span class="dci-para-card__meta">{{ para.fieldNames.length }} 字段 · {{ para.rows.length }} 行</span>
            <span class="dci-para-card__arrow">{{ expandedSet.has(pi) ? '收起 ▴' : '展开 ▾' }}</span>
          </div>

          <div v-if="expandedSet.has(pi)" class="dci-para-card__body">
            <!-- 字段定义 -->
            <template v-if="viewMode === 'fields'">
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
                    <el-select v-model="row.type" size="small" style="width: 100%;">
                      <el-option-group v-for="grp in typeGroups" :key="grp.label" :label="grp.label">
                        <el-option v-for="t in grp.options" :key="t.value" :label="t.label" :value="t.value" />
                      </el-option-group>
                    </el-select>
                  </template>
                </el-table-column>
              </el-table>
            </template>
            <!-- 数据矩阵 -->
            <template v-else>
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
            </template>
          </div>
        </div>
      </div>

      <!-- 保存目标（不关联系统/模块） -->
      <div class="dci-targets">
        <span class="dci-targets__label">保存到：</span>
        <el-checkbox v-model="attachIface">生成报文并挂到接口</el-checkbox>
        <template v-if="attachIface">
          <span class="dci-targets__sub">目标接口：</span>
          <el-select v-model="targetIfaceId" size="small" style="width: 190px">
            <el-option v-for="i in protoStore.testInterfaces" :key="i.id" :label="i.name" :value="i.id" />
            <el-option label="＋ 新建接口" value="__new__" />
          </el-select>
          <el-input
            v-if="targetIfaceId === '__new__'"
            v-model="newIfaceName"
            size="small"
            placeholder="新接口名称"
            style="width: 160px"
          />
        </template>
        <el-checkbox v-model="saveDatasets">生成数据集</el-checkbox>
      </div>
      <div class="dci-targets__tip">
        报文将记录文件数据源（fileId），发送测试时文件内容原样直发，不修改不校验。
      </div>
    </div>

    <template #footer>
      <el-button v-if="parsed.length" text type="info" @click="resetAll">重新选择文件</el-button>
      <el-button @click="visible = false">取消</el-button>
      <el-button v-if="parsed.length" type="primary" :disabled="!canImport" @click="performImport">
        {{ confirmLabel }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useConnectionStore } from '@/stores/connection'
import { useProtocolStore, SCALAR_ENCODINGS, uid } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { parseDataChain } from '@/utils/dataChainImport'
import { readFileAsText, inferFileFormat } from '@/services/testDataService'

const props = defineProps({
  modelValue: Boolean,
  currentSystemId: { type: [String, Number], default: '' },
  currentModuleName: { type: String, default: '' },
  /** 预载文件（从数据文件管理「解析」进入）：{ name, content } */
  presetFile: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'imported'])

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

// 保存目标（不关联系统/模块）
const attachIface = ref(true)
const saveDatasets = ref(false)
const targetIfaceId = ref('')
const newIfaceName = ref('')
// 文件数据源 id（文件列表中的文件）
const currentFileId = ref(null)

// 查看模式：字段定义 / 数据矩阵（可编辑）
const viewMode = ref('fields')
// 解析结果默认折叠：expandedSet 存展开的段落序号
const expandedSet = ref(new Set())

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

const confirmLabel = computed(() => {
  const parts = []
  if (attachIface.value) parts.push('挂到接口')
  if (saveDatasets.value) parts.push('生成数据集')
  if (!parts.length) return '仅保存报文定义'
  return `确认解析并${parts.join('+')}（${parsed.value.length} 个报文）`
})

const togglePara = (pi) => {
  const next = new Set(expandedSet.value)
  if (next.has(pi)) next.delete(pi)
  else next.add(pi)
  expandedSet.value = next
}

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
        f.constraint = { kind: 'range', min: f.min, max: f.max }
      } else {
        const uniq = [...new Set(p.rows.map(r => r[f.name]))].filter(v => v !== '' && v != null)
        f.constraint = { kind: (uniq.length && uniq.length <= 12) ? 'enum' : 'none', enumText: uniq.join('/') }
      }
    })
  })
  parsed.value = result
  expandedSet.value = new Set() // 默认全部折叠
  return true
}

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
    attachIface.value = true
    saveDatasets.value = false
    viewMode.value = 'fields'
    // 从数据文件管理「解析」进入：预载文件内容
    if (props.presetFile?.content) {
      fromPreset.value = true
      if (!applyText(props.presetFile.name || '数据链文件', props.presetFile.content)) {
        ElMessage.warning('该文件内容无法解析为数据链格式')
      } else {
        // 定位文件列表中的 fileId（文件数据源）
        const f = tdStore.allFiles.find((x) => x.name === (props.presetFile.name || ''))
        currentFileId.value = f?.id ?? null
      }
    }
  }
})

const onFileChange = async (file) => {
  parseError.value = ''
  const raw = file?.raw || file
  if (!raw) return
  try {
    const text = await readFileAsText(raw)
    fromPreset.value = false
    if (applyText(raw.name, text)) {
      // 弹窗内新上传：登记到文件列表（不关联系统/模块），拿 fileId
      const f = tdStore.addFile({
        name: raw.name,
        format: inferFileFormat(raw.name),
        size: raw.size || new Blob([text]).size,
        desc: '',
        rowCount: totalRows.value,
        content: text
      })
      currentFileId.value = f.id
    }
  } catch (e) {
    parseError.value = '文件读取失败：' + (e?.message || e)
  }
}

const resetAll = () => {
  parsed.value = []
  parseError.value = ''
  fileName.value = ''
  rawText.value = ''
  fromPreset.value = false
  viewMode.value = 'fields'
  expandedSet.value = new Set()
  targetIfaceId.value = ''
  newIfaceName.value = ''
  currentFileId.value = null
}

const onClose = () => {
  emit('update:modelValue', false)
}

/* ============ 构建并写入 stores ============ */
const resolveTargetIface = () => {
  if (targetIfaceId.value === '__new__') {
    const name = (newIfaceName.value || '').trim()
    if (!name) {
      ElMessage.warning('请输入新接口名称')
      return null
    }
    return protoStore.addTestInterface({ name }).id
  }
  if (targetIfaceId.value) return targetIfaceId.value
  ElMessage.warning('请选择目标接口')
  return null
}

const performImport = () => {
  const createdIds = []

  parsed.value.forEach((para) => {
    let iface = null

    // 1) 生成报文并挂到接口（文件数据源，内容直发）
    if (attachIface.value) {
      const targetId = resolveTargetIface()
      if (!targetId) return
      iface = protoStore.attachFileMessageToInterface(targetId, {
        name: `${para.name}报文`,
        fileId: currentFileId.value || null,
        transportType: 'OSE',
      })
      // 生成字段定义（供结构查看 / 数据集列）
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
      const proto = protoStore.addProtocol({
        name: `${para.name}字段`,
        systemId: iface.systemId,
        moduleId: iface.moduleId,
        desc: `文件解析自动生成（${para.fieldNames.length} 字段）`,
        fields: byteFields
      })
      proto.config = { fields: byteFields }
      iface.protocolRefs = [{ protocolId: proto.id, role: 'send' }]
    }

    // 2) 可选：生成数据集（挂到该报文下）
    if (saveDatasets.value) {
      const ds = tdStore.addDataset({
        name: `${para.name}数据集`,
        systemId: iface?.systemId || null,
        moduleName: iface?.moduleId
          ? connStore.nodes.find((n) => String(n.id) === String(iface.moduleId))?.name || ''
          : '',
        linkedInterface: iface?.name || '',
        messageId: iface?.id || null,
        desc: `文件「${fileName.value}」解析生成（${para.rows.length} 行）`
      })

      let rowSeq = 90000
      ds.rows = para.rows.map((r, i) => ({
        id: ++rowSeq,
        label: `行 ${i + 1}`,
        values: { ...r }
      }))

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

  const doneParts = []
  if (attachIface.value) doneParts.push(`${parsed.value.length} 个报文已挂到接口`)
  if (saveDatasets.value) doneParts.push(`${createdIds.length} 个数据集`)
  if (!doneParts.length) doneParts.push('已保存报文定义')
  ElMessage.success(`解析完成：${doneParts.join('，')}（文件内容直发测试，不修改）`)
  emit('imported', createdIds)
  visible.value = false
}
</script>

<style scoped lang="scss">
.dci-empty { padding: 8px 0; }
.dci-upload { width: 100%; }
.dci-hint { font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 6px; }
.dci-parse-error { margin-top: 10px; color: var(--el-color-danger); font-size: 13px; }

.dci-body { display: flex; flex-direction: column; gap: 12px; }

/* 报文卡片（默认折叠） */
.dci-paras {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 46vh;
  overflow: auto;
}
.dci-para-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  &--open { border-color: var(--el-color-primary-light-5); }
  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    cursor: pointer;
    user-select: none;
    &:hover { background: var(--el-fill-color-light); }
  }
  &__name { font-weight: 600; font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__meta { font-size: 12px; color: var(--el-text-color-secondary); flex-shrink: 0; }
  &__arrow { margin-left: auto; font-size: 12px; color: var(--el-text-color-secondary); flex-shrink: 0; }
  &__body { padding: 6px 10px 10px; border-top: 1px solid var(--el-border-color-lighter); }
}
.dci-field-table, .dci-matrix-table { margin-bottom: 2px; }

.dci-view-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  &__label { font-size: 13px; color: var(--el-text-color-regular); font-weight: 600; }
  &__hint { font-size: 12px; color: var(--el-text-color-placeholder); }
}

.dci-targets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  &__label { font-size: 13px; color: var(--el-text-color-regular); font-weight: 600; }
  &__sub { font-size: 12px; color: var(--el-text-color-secondary); }
  &__tip {
    font-size: 12px;
    color: var(--el-color-warning);
    padding: 0 2px;
  }
}

.dci-constraint { display: flex; align-items: center; gap: 4px; }
.dci-cnum { width: 92px; }
.dci-tilde { color: var(--el-text-color-placeholder); }
</style>
