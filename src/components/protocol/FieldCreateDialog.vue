<template>
  <el-dialog
    :model-value="modelValue"
    :title="step === 1 ? '新增字段 · 选择数据大类' : '新增字段 · 配置字段'"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <!-- 第一步：五大数据类型卡片 -->
    <div v-if="step === 1" class="type-grid">
      <div
        v-for="t in CATEGORIES"
        :key="t.value"
        class="type-card"
        :class="{ 'is-active': category === t.value }"
        @click="category = t.value"
      >
        <div class="type-card__icon"><el-icon :size="24"><component :is="t.icon" /></el-icon></div>
        <div class="type-card__body">
          <div class="type-card__name">{{ t.label }}</div>
          <div class="type-card__desc">{{ t.desc }}</div>
        </div>
      </div>
    </div>

    <!-- 第二步：按大类配置 -->
    <div v-else class="cfg-form">
      <el-form label-width="92px" label-position="left">
        <el-form-item label="字段名">
          <el-input v-model="form.name" placeholder="字段名称" />
        </el-form-item>

        <template v-if="category === 'scalar'">
          <el-form-item label="数据类型">
            <el-select v-model="form.encoding" filterable style="width: 100%">
              <el-option-group v-for="g in encodingGroups" :key="g.label" :label="g.label">
                <el-option v-for="o in g.items" :key="o.value" :label="o.label" :value="o.value" />
              </el-option-group>
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="category === 'bitstream'">
          <el-form-item label="数据类型">
            <el-select v-model="form.dataType" style="width: 220px">
              <el-option v-for="o in BYTE_DATA_TYPES" :key="o.value" :label="`${o.label}（${o.bytes} 字节）`" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="说明" class="hint-item">
            <span class="hint">位组序流按字节定义，不支持比特/位段，字节数由数据类型决定，行序即字节顺序。</span>
          </el-form-item>
        </template>

        <template v-else-if="category === 'struct'">
          <el-form-item label="嵌套定义">
            <StructNestedEditor :fields="form.children" />
          </el-form-item>
        </template>

        <template v-else-if="category === 'file'">
          <el-form-item label="文件类型">
            <el-select v-model="form.fileType" style="width: 200px">
              <el-option label="BIN" value="bin" />
              <el-option label="TXT" value="txt" />
            </el-select>
          </el-form-item>
          <el-form-item label="分块大小">
            <el-input-number v-model="form.chunkSizeKb" :min="1" :max="102400" /> <span class="unit">KB</span>
          </el-form-item>
          <el-form-item label="完整性校验">
            <el-select v-model="form.checksum" style="width: 200px">
              <el-option label="无" value="none" />
              <el-option label="CRC32" value="crc32" />
              <el-option label="MD5" value="md5" />
              <el-option label="SHA-256" value="sha256" />
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="category === 'matrix'">
          <el-form-item label="文件类型">
            <el-select v-model="form.matrixFileType" style="width: 220px">
              <el-option label="CSV" value="csv" />
              <el-option label="XLSX" value="xlsx" />
              <el-option label="PNG" value="png" />
              <el-option label="JPEG" value="jpeg" />
            </el-select>
          </el-form-item>
        </template>

        <el-form-item label="取值约束">
          <el-select v-model="form.constraint.mode" style="width: 120px" @change="onConstraintChange">
            <el-option label="无" value="none" />
            <el-option label="范围" value="range" />
            <el-option label="固定值" value="fixed" />
            <el-option label="枚举" value="enum" />
            <el-option label="正则" value="regex" />
          </el-select>
          <el-input
            v-if="form.constraint.mode === 'fixed' || form.constraint.mode === 'range'"
            v-model="form.constraint.value" placeholder="值" style="width: 140px; margin-left: 8px"
          />
          <el-input
            v-else-if="form.constraint.mode === 'enum'"
            v-model="enumText" placeholder="逗号分隔值" style="width: 220px; margin-left: 8px"
            @blur="applyEnum"
          />
          <el-input
            v-else-if="form.constraint.mode === 'regex'"
            v-model="form.constraint.pattern" placeholder="正则" style="width: 200px; margin-left: 8px"
          />
        </el-form-item>

        <el-form-item label="备注说明">
          <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <template v-if="step === 1">
        <el-button type="primary" :disabled="!category" @click="step = 2">下一步</el-button>
      </template>
      <template v-else>
        <el-button @click="step = 1">上一步</el-button>
        <el-button type="primary" @click="confirm">确定创建</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Connection, DataAnalysis, Document, Grid, Operation } from '@element-plus/icons-vue'
import { BYTE_DATA_TYPES, SCALAR_NUMERIC_ENCODINGS, makeParam } from '@/stores/protocol'
import StructNestedEditor from './StructNestedEditor.vue'

const props = defineProps({
  modelValue: Boolean,
})
const emit = defineEmits(['update:modelValue', 'create'])

const step = ref(1)
const category = ref('scalar')
const CATEGORIES = [
  { value: 'scalar', label: '标量', desc: '单一数值（整数/实数），如 uint8、float32', icon: DataAnalysis },
  { value: 'struct', label: '共识体', desc: '多字段结构化数据块，可嵌套其他共识体', icon: Grid },
  { value: 'bitstream', label: '位组序流', desc: '连续二进制字节序列，按字节定义', icon: Connection },
  { value: 'file', label: '流文件', desc: '二进制/文本文件，以整体为操作单元', icon: Document },
  { value: 'matrix', label: '结构矩阵', desc: '二维表格数据，行列有明确语义', icon: Operation },
]
const encodingGroups = computed(() => {
  const groups = new Map()
  SCALAR_NUMERIC_ENCODINGS.forEach((item) => {
    if (!groups.has(item.group)) groups.set(item.group, [])
    groups.get(item.group).push(item)
  })
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
})

const form = reactive({
  name: '',
  encoding: 'uint8',
  dataType: 'uint8',
  fileType: 'bin',
  chunkSizeKb: 64,
  checksum: 'sha256',
  matrixFileType: 'csv',
  children: [makeParam({ name: '子字段1', type: 'scalar', encoding: 'uint8' })],
  constraint: { mode: 'none' },
  desc: '',
})
const enumText = ref('')

const onConstraintChange = (m) => {
  if (m === 'range') form.constraint = { mode: 'range', min: 0, max: 255, value: 0 }
  else if (m === 'fixed') form.constraint = { mode: 'fixed', min: 0, max: 0, value: '' }
  else if (m === 'enum') { enumText.value = ''; form.constraint = { mode: 'enum', entries: [] } }
  else if (m === 'regex') form.constraint = { mode: 'regex', pattern: '' }
  else form.constraint = { mode: 'none' }
}
const applyEnum = () => {
  if (form.constraint.mode !== 'enum') return
  form.constraint.entries = (enumText.value || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean)
    .map((v) => ({ value: v, label: v }))
}

const resetForm = () => {
  step.value = 1
  category.value = 'scalar'
  form.name = ''
  form.encoding = 'uint8'
  form.dataType = 'uint8'
  form.fileType = 'bin'
  form.chunkSizeKb = 64
  form.checksum = 'sha256'
  form.matrixFileType = 'csv'
  form.children = [makeParam({ name: '子字段1', type: 'scalar', encoding: 'uint8' })]
  form.constraint = { mode: 'none' }
  form.desc = ''
  enumText.value = ''
}
watch(() => props.modelValue, (v) => { if (v) resetForm() })

const close = () => emit('update:modelValue', false)
const onClosed = () => resetForm()

const confirm = () => {
  emit('create', {
    name: form.name || '新建字段',
    category: category.value,
    encoding: form.encoding,
    dataType: form.dataType,
    fileType: form.fileType,
    chunkSizeKb: form.chunkSizeKb,
    checksum: form.checksum,
    matrixFileType: form.matrixFileType,
    children: category.value === 'struct' ? JSON.parse(JSON.stringify(form.children)) : [],
    constraint: { ...form.constraint },
    desc: form.desc,
  })
  close()
}
</script>

<style scoped lang="scss">
.type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.type-card {
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  border: 1px solid var(--el-border-color); border-radius: 8px; cursor: pointer; transition: all .2s;
  &:hover { border-color: var(--el-color-primary-light-3); background: var(--el-fill-color-light); }
  &.is-active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
  &__icon { color: var(--el-text-color-secondary); flex-shrink: 0; }
  &.is-active &__icon { color: var(--el-color-primary); }
  &__name { font-size: 14px; font-weight: 600; }
  &__desc { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
}
.cfg-form { :deep(.el-input-number) { width: 160px; } }
.unit { margin-left: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); }
.hint-item :deep(.el-form-item__content) { display: block; }
</style>
