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
          />
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
import { RULE_TYPES, useRuleStore } from '@/stores/rule'
import { useProtocolStore, BYTE_DATA_TYPES, FIELD_TYPES } from '@/stores/protocol'
import { flattenInterfaceFields, inferConstraint } from '@/utils/ruleEngine'

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

// 数据类型二级菜单：顶层为接口参数类型，「常量」展开为全部字节数据类型
const dataTypeCascaderProps = { emitPath: false, expandTrigger: 'hover' }
const dataTypeOptions = computed(() => FIELD_TYPES.map((t) => (
  t === '常量'
    ? { value: '常量', label: '常量', children: BYTE_DATA_TYPES.map((b) => ({ value: b.value, label: b.label })) }
    : { value: t, label: t }
)))

watch(() => props.modelValue, (open) => {
  if (!open) return
  Object.assign(form, props.rule ? JSON.parse(JSON.stringify(props.rule)) : blank())
  if (!form.target.interfaceId) onInterfaceChange(moduleInterfaces.value[0]?.id)
  applyTypeDefaults()
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
  if (form.type === 'type') form.params = { dataType: field.type === '常量' ? field.dataType : field.type }
  if ((form.type === 'range' || form.type === 'boundary') && constraint) form.params = { min: constraint.min, max: constraint.max, dataType: field.dataType || field.type }
  if (form.type === 'overflow') form.params = { required: true, maxLength: field.type === '位组序流' ? 256 : 64 }
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
  if (form.id) store.updateRule(props.ruleSet.id, form.id, JSON.parse(JSON.stringify(form)))
  else store.addRule(props.ruleSet.id, JSON.parse(JSON.stringify({ ...form, id: undefined })))
  visible.value = false
}
</script>

<style scoped>
.unit { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
