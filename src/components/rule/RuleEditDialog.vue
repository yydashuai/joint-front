<template>
  <el-dialog v-model="visible" :title="form.id ? '编辑规则' : '手动添加规则'" width="620px">
    <el-form label-width="92px" :model="form">
      <el-form-item label="规则类型">
        <el-select v-model="form.type" style="width: 100%;" @change="applyTypeDefaults">
          <el-option v-for="type in RULE_TYPES" :key="type.value" :label="type.label" :value="type.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标接口">
        <el-select v-model="form.target.interfaceId" filterable style="width: 100%;" @change="onInterfaceChange">
          <el-option v-for="iface in moduleInterfaces" :key="iface.id" :label="iface.name" :value="iface.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="!isInterfaceRule" label="目标字段">
        <el-select v-model="form.target.fieldPath" filterable style="width: 100%;" @change="onFieldChange">
          <el-option v-for="field in fields" :key="field.fieldPath" :label="field.fieldPath" :value="field.fieldPath" />
        </el-select>
      </el-form-item>
      <el-form-item label="级别">
        <el-radio-group v-model="form.level">
          <el-radio-button value="error">错误</el-radio-button>
          <el-radio-button value="warning">提醒</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <template v-if="form.type === 'type'">
        <el-form-item label="数据类型">
          <el-cascader
            v-model="form.params.dataType"
            :options="dataTypeOptions"
            :props="dataTypeCascaderProps"
            :show-all-levels="false"
            filterable
            style="width: 100%;"
            @change="onDataTypeChange"
          />
        </el-form-item>
        <el-form-item v-if="isStructType" label="子字段结构">
          <div class="struct-fields">
            <el-table v-if="flattenedStructRows.length" :data="flattenedStructRows" size="small" class="struct-table" row-key="__uid">
              <el-table-column label="字段名" min-width="130">
                <template #default="{ row }">
                  <span v-if="row.__nested" class="struct-indent">└</span>
                  <el-input v-model="row.name" size="small" placeholder="字段名" class="struct-name-input" />
                </template>
              </el-table-column>
              <el-table-column label="数据类型" width="136">
                <template #default="{ row }">
                  <el-select v-model="row.dataType" size="small" @change="(val) => onStructDataTypeChange(row, val)">
                    <el-option-group label="标量">
                      <el-option v-for="dt in BYTE_DATA_TYPES" :key="dt.value" :label="dt.label" :value="dt.value" />
                    </el-option-group>
                    <el-option v-if="!row.__nested" label="共识体" value="struct" />
                    <el-option label="位组序流" value="bitstream" />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="必填" width="56" align="center">
                <template #default="{ row }">
                  <el-checkbox v-model="row.required" />
                </template>
              </el-table-column>
              <el-table-column label="" width="100" align="center">
                <template #default="{ row }">
                  <el-button v-if="(row.dataType === 'struct' || row.dataType === '共识体') && !row.__nested" link type="primary" size="small" @click="addStructField(row.children)">+子</el-button>
                  <el-button link type="danger" size="small" @click="removeStructField(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="struct-actions">
              <el-button size="small" type="primary" plain @click="addStructField(form.params.structFields)">添加子字段</el-button>
              <el-button v-if="(currentField?.type === 'struct' || currentField?.type === '共识体') && currentField?.children?.length" size="small" plain @click="autoFillStructFromInterface">
                从接口定义导入
              </el-button>
            </div>
          </div>
        </el-form-item>
      </template>
      <template v-if="form.type === 'range' || form.type === 'boundary'">
        <el-form-item v-if="protoRange" label="协议范围">
          <el-alert
            :title="`协议定义范围：${protoRange.min} ~ ${protoRange.max}，规则范围不得超过此区间`"
            type="info"
            :closable="false"
            show-icon
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="最小值">
          <el-input-number v-model="form.params.min" :min="protoRange?.min" :max="protoRange?.max" style="width: 180px;" />
        </el-form-item>
        <el-form-item label="最大值">
          <el-input-number v-model="form.params.max" :min="protoRange?.min" :max="protoRange?.max" style="width: 180px;" />
        </el-form-item>
      </template>
      <template v-if="form.type === 'overflow'">
        <el-form-item label="最大长度"><el-input-number v-model="form.params.maxLength" :min="1" style="width: 180px;" /></el-form-item>
      </template>
      <template v-if="form.type === 'timeout'">
        <el-form-item label="超时阈值"><el-input-number v-model="form.params.timeoutMs" :min="1" style="width: 180px;" /><span class="unit">ms</span></el-form-item>
      </template>
      <template v-if="form.type === 'format'">
        <el-form-item label="样本格式">
          <el-radio-group v-model="form.params.sampleType">
            <el-radio-button value="json">JSON</el-radio-button>
            <el-radio-button value="hex">HEX</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </template>
      <el-form-item label="说明">
        <el-input v-model="form.desc" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!form.target.interfaceId" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { RULE_TYPES, useRuleStore } from '@/stores/rule'
import { useProtocolStore, BYTE_DATA_TYPES, DATA_RULE_CATEGORIES } from '@/stores/protocol'
import { flattenInterfaceFields, inferConstraint, extractStructFields } from '@/utils/ruleEngine'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  ruleSet: { type: Object, default: null },
  rule: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const store = useRuleStore()
const protoStore = useProtocolStore()
const form = reactive(blank())

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const moduleInterfaces = computed(() => protoStore.interfaces.filter((iface) => iface.moduleId === props.ruleSet?.moduleId))
const currentInterface = computed(() => protoStore.interfaces.find((iface) => iface.id === form.target.interfaceId))
const fields = computed(() => flattenInterfaceFields(currentInterface.value).filter((field) => field.fieldPath.startsWith('response.')))
const isInterfaceRule = computed(() => form.type === 'timeout' || form.type === 'format')
const currentField = computed(() => {
  if (isInterfaceRule.value || !form.target.fieldPath) return null
  return fields.value.find((f) => f.fieldPath === form.target.fieldPath) || null
})
const protoRange = computed(() => {
  if (!currentField.value) return null
  const constraint = inferConstraint(currentField.value)
  if (!constraint || constraint.min == null || constraint.max == null) return null
  return { min: constraint.min, max: constraint.max }
})

// 数据类型二级菜单：顶层为五类数据规则，「标量」展开为全部字节数据类型
const dataTypeCascaderProps = { emitPath: false, expandTrigger: 'hover' }
const dataTypeOptions = computed(() => DATA_RULE_CATEGORIES.map((cat) => (
  cat.value === 'scalar'
    ? { value: 'scalar', label: '标量', children: BYTE_DATA_TYPES.map((b) => ({ value: b.value, label: b.label })) }
    : { value: cat.value, label: cat.label }
)))

// ─── 共识体子字段管理 ───
let structSeq = 0
// 支持新名称 struct 和旧名称 共识体
const isStructType = computed(() => form.params?.dataType === 'struct' || form.params?.dataType === '共识体')

// 将嵌套的 structFields 展平为一维数组（顶层 + 一级子字段）
const flattenedStructRows = computed(() => {
  const rows = []
  const fields = form.params?.structFields || []
  fields.forEach((field) => {
    if (!field.__uid) field.__uid = `sf-${++structSeq}`
    rows.push(field)
    // 支持新名称 struct 和旧名称 共识体
    if ((field.dataType === 'struct' || field.dataType === '共识体') && field.children?.length) {
      field.children.forEach((child) => {
        if (!child.__uid) child.__uid = `sf-${++structSeq}`
        child.__nested = true
        rows.push(child)
      })
    }
  })
  return rows
})

const addStructField = (list) => {
  if (!Array.isArray(list)) return
  list.push({
    name: '',
    dataType: 'uint8',
    required: true,
    __uid: `sf-${++structSeq}`,
  })
}

const removeStructField = (row) => {
  const topList = form.params.structFields
  // 尝试从顶层删除
  let idx = topList.findIndex((f) => f === row)
  if (idx >= 0) {
    topList.splice(idx, 1)
    return
  }
  // 尝试从嵌套 children 中删除
  for (const field of topList) {
    if (field.children?.length) {
      idx = field.children.findIndex((c) => c === row)
      if (idx >= 0) {
        field.children.splice(idx, 1)
        return
      }
    }
  }
}

const onStructDataTypeChange = (row, val) => {
  // 支持新名称 struct 和旧名称 共识体
  if (val === 'struct' || val === '共识体') {
    if (!row.children) row.children = []
  } else {
    delete row.children
  }
}

const onDataTypeChange = (val) => {
  // 支持新名称 struct 和旧名称 共识体
  if (val === 'struct' || val === '共识体') {
    if (!form.params.structFields) form.params.structFields = []
    // 如果当前目标字段是共识体，自动填充
    if ((currentField.value?.type === 'struct' || currentField.value?.type === '共识体') && currentField.value?.children?.length) {
      form.params.structFields = extractStructFields(currentField.value.children)
    }
  } else {
    delete form.params.structFields
  }
}

const autoFillStructFromInterface = () => {
  if ((currentField.value?.type === 'struct' || currentField.value?.type === '共识体') && currentField.value?.children?.length) {
    form.params.structFields = extractStructFields(currentField.value.children)
  }
}

watch(() => props.modelValue, (open) => {
  if (!open) return
  Object.assign(form, props.rule ? JSON.parse(JSON.stringify(props.rule)) : blank())

  // 补全缺失的 interfaceId：优先按 interfaceName 匹配正确接口
  if (!form.target.interfaceId && form.target.interfaceName) {
    const matched = protoStore.interfaces.find((i) => i.name === form.target.interfaceName)
    if (matched) {
      form.target.interfaceId = matched.id
    }
  }

  // 仅在完全没有接口时才回退到第一个接口（新建规则或无法匹配时）
  if (!form.target.interfaceId) {
    onInterfaceChange(moduleInterfaces.value[0]?.id)
  }

  // 仅对新建规则应用默认值；编辑时保留已有 params
  if (!form.id) {
    applyTypeDefaults()
  } else if (isInterfaceRule.value) {
    form.target.fieldPath = ''
    form.target.fieldName = ''
  }
})

function blank() {
  return {
    id: null,
    type: 'type',
    enabled: true,
    level: 'error',
    source: 'manual',
    target: { interfaceId: null, interfaceName: '', fieldPath: '', fieldName: '' },
    params: { dataType: 'int32' },
    desc: '',
  }
}

const onInterfaceChange = (id) => {
  const iface = protoStore.interfaces.find((item) => item.id === id)
  form.target.interfaceId = id || null
  form.target.interfaceName = iface?.name || ''
  if (!isInterfaceRule.value) {
    const field = flattenInterfaceFields(iface).find((item) => item.fieldPath.startsWith('response.'))
    if (field) {
      form.target.fieldPath = field.fieldPath
      form.target.fieldName = field.fieldName
      fillParamsFromField(field)
    }
  } else {
    form.target.fieldPath = ''
    form.target.fieldName = ''
  }
}

const onFieldChange = (path) => {
  const field = fields.value.find((item) => item.fieldPath === path)
  if (!field) return
  form.target.fieldName = field.fieldName
  fillParamsFromField(field)
}

const fillParamsFromField = (field) => {
  const constraint = inferConstraint(field)
  if (form.type === 'type') {
    // 兼容旧类型名：'常量' → 使用 field.dataType，其他保持 field.type
    form.params = { dataType: field.type === '常量' ? field.dataType : field.type }
    // 共识体：自动提取子结构（支持新名称 struct 和旧名称 共识体）
    if ((field.type === 'struct' || field.type === '共识体') && field.children?.length) {
      form.params.structFields = extractStructFields(field.children)
    }
  }
  if ((form.type === 'range' || form.type === 'boundary') && constraint) form.params = { min: constraint.min, max: constraint.max, dataType: field.dataType || field.type }
  // 位组序流(bitstream)的最大长度默认为 256
  if (form.type === 'overflow') {
    const isBitstream = field.type === 'bitstream' || field.type === '位组序流'
    form.params = { required: true, maxLength: isBitstream ? 256 : 64 }
  }
}

const applyTypeDefaults = () => {
  form.level = form.type === 'boundary' ? 'warning' : 'error'
  if (isInterfaceRule.value) {
    form.target.fieldPath = ''
    form.target.fieldName = ''
  }
  if (form.type === 'timeout') form.params = { timeoutMs: form.params.timeoutMs || 500 }
  else if (form.type === 'format') form.params = { sampleType: form.params.sampleType || 'json' }
  else if (form.target.fieldPath) onFieldChange(form.target.fieldPath)
}

// 递归清除 structFields 中的 UI 临时属性
const cleanStructFields = (fields) => {
  if (!fields?.length) return fields
  return fields.map(({ __uid, __nested, children, ...rest }) => {
    const cleaned = { ...rest }
    if (children?.length) cleaned.children = cleanStructFields(children)
    return cleaned
  })
}

const save = () => {
  // Validate range/boundary rules are within protocol-defined range
  if ((form.type === 'range' || form.type === 'boundary') && protoRange.value) {
    const { min: ruleMin, max: ruleMax } = form.params
    const { min: pMin, max: pMax } = protoRange.value
    if (ruleMin < pMin || ruleMax > pMax) {
      ElMessage.warning(`规则范围 [${ruleMin}, ${ruleMax}] 超出协议定义范围 [${pMin}, ${pMax}]，请调整`)
      return
    }
  }
  // 清除 structFields 的 UI 临时属性
  if (form.params?.structFields) {
    form.params.structFields = cleanStructFields(form.params.structFields)
  }
  if (form.id) store.updateRule(props.ruleSet.id, form.id, JSON.parse(JSON.stringify(form)))
  else store.addRule(props.ruleSet.id, JSON.parse(JSON.stringify({ ...form, id: undefined })))
  visible.value = false
}
</script>

<style scoped>
.unit { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.struct-fields {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.struct-table {
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
}
.struct-nested {
  background: var(--el-fill-color-lighter);
}
.struct-indent {
  color: var(--el-text-color-secondary);
  margin-right: 4px;
  font-size: 12px;
}
.struct-name-input {
  width: 100%;
}
.struct-actions {
  display: flex;
  gap: 8px;
}
</style>
