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
        <div class="dci-hint">支持 .txt / .csv / .dat / .bin；可使用“报文名、字段表头、数据行”结构，也兼容带序号的多报文段落</div>
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

      <div class="dci-targets">
        <div class="dci-target-item">
          <span>来源文件</span>
          <strong>{{ fileName }}</strong>
        </div>
        <i />
        <div class="dci-target-item">
          <span>归属接口</span>
          <el-tag size="small" type="success" effect="plain">{{ targetInterface?.name || '未配置' }}</el-tag>
        </div>
        <i />
        <div class="dci-target-item">
          <span>自动生成</span>
          <strong>{{ parsed.length }} 个报文 · {{ parsed.length }} 个数据集</strong>
        </div>
      </div>
      <div class="dci-targets__tip">
        数据集按“报文名 + 数据集”自动命名，重名时自动编号；生成后可在数据集管理中改名。
      </div>
    </div>

    <template #footer>
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

const registeredFile = computed(() => tdStore.allFiles.find((file) =>
  String(file.id) === String(currentFileId.value ?? props.presetFile?.id)
) || props.presetFile || null)
const targetInterface = computed(() => {
  const file = registeredFile.value
  const explicitId = file?.interfaceIds?.[0]
  if (explicitId != null) return protoStore.testInterfaces.find((item) => String(item.id) === String(explicitId)) || null
  const explicitName = file?.interfaceNames?.[0]
  return explicitName ? protoStore.testInterfaces.find((item) => item.name === explicitName) || null : null
})
const canImport = computed(() => parsed.value.length > 0 && !!targetInterface.value)
const confirmLabel = computed(() => `生成报文与数据集（${parsed.value.length} 个报文）`)

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
  const defaultName = String(name || 'CSV报文').replace(/\.[^.]+$/, '')
  const result = parseDataChain(text, { defaultName })
  if (!result.length) {
    parseError.value = '未能解析出报文数据。支持两种格式：首行报文名、第二行字段名、后续数据行；或直接以 CSV 字段表头开始。'
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
    viewMode.value = 'fields'
    // 从数据文件管理「解析」进入：预载文件内容
    if (props.presetFile?.content) {
      fromPreset.value = true
      if (!applyText(props.presetFile.name || '数据链文件', props.presetFile.content)) {
        ElMessage.warning('该文件内容无法解析为数据链格式')
      } else {
        // 定位文件列表中的 fileId（文件数据源）
        const f = tdStore.allFiles.find((x) => String(x.id) === String(props.presetFile.id) || x.name === (props.presetFile.name || ''))
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
  currentFileId.value = null
}

const onClose = () => {
  emit('update:modelValue', false)
}

/* ============ 构建并写入 stores ============ */
const performImport = () => {
  const createdIds = []
  const registeredFile = tdStore.allFiles.find((file) => String(file.id) === String(currentFileId.value))
  const registeredFileName = registeredFile?.name || fileName.value || ''
  const targetId = targetInterface.value?.id
  if (!targetId) {
    ElMessage.warning('文件尚未配置关联接口，请返回数据文件管理进行配置')
    return
  }

  parsed.value.forEach((para) => {
    let iface = null

    // 1) 读取文件已配置的接口，生成报文并挂载。
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
    tdStore.linkFileToMessage(currentFileId.value, iface)

    // 2) 默认生成数据集（名称按报文名自动生成，可在数据集管理中修改）。
    const ds = tdStore.addDataset({
      name: `${para.name}数据集`,
      systemId: iface?.systemId || null,
      moduleName: iface?.moduleId
        ? connStore.nodes.find((n) => String(n.id) === String(iface.moduleId))?.name || ''
        : '',
      linkedInterface: iface?.name || '',
      messageId: iface?.id || null,
      sourceFileId: currentFileId.value || null,
      sourceFileName: registeredFileName,
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
      fileId: currentFileId.value || null,
      fileName: registeredFileName,
      abnormal: false,
      excellent: false
    })))

    createdIds.push(ds.id)
  })

  ElMessage.success(`解析完成：${parsed.value.length} 个报文已挂到“${targetInterface.value.name}”，生成 ${createdIds.length} 个数据集`)
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
  overscroll-behavior: contain;
  padding-right: 2px;
}
.dci-para-card {
  flex: 0 0 auto;
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
  &__body { min-height: 0; overflow: hidden; padding: 6px 10px 10px; border-top: 1px solid var(--el-border-color-lighter); }
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
  gap: 14px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  > i { width: 24px; height: 1px; flex: 0 0 auto; background: var(--el-border-color); }
  &__tip {
    font-size: 12px;
    color: var(--el-color-warning);
    padding: 0 2px;
  }
}
.dci-target-item { min-width: 0; display: flex; align-items: center; gap: 8px; }
.dci-target-item > span { flex: 0 0 auto; color: var(--el-text-color-secondary); font-size: 12px; }
.dci-target-item > strong { overflow: hidden; color: var(--el-text-color-primary); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }

.dci-constraint { display: flex; align-items: center; gap: 4px; }
.dci-cnum { width: 92px; }
.dci-tilde { color: var(--el-text-color-placeholder); }
</style>
