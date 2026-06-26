<template>
  <el-dialog v-model="visible" title="从接口自动生成规则" width="760px">
    <el-form label-width="92px">
      <el-form-item label="目标接口">
        <el-select v-model="interfaceId" filterable placeholder="选择当前模块下的接口" style="width: 100%;">
          <el-option v-for="iface in moduleInterfaces" :key="iface.id" :label="iface.name" :value="iface.id">
            <span>{{ iface.name }}</span>
            <span class="option-path">{{ iface.path }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="规则类型">
        <el-checkbox-group v-model="selectedTypes">
          <el-checkbox-button v-for="type in RULE_TYPES" :key="type.value" :value="type.value">
            {{ type.label }}
          </el-checkbox-button>
        </el-checkbox-group>
      </el-form-item>
    </el-form>

    <div class="preview-head">
      <span>预览生成 {{ preview.length }} 条规则</span>
      <el-button link type="primary" @click="checkedIds = preview.map((rule) => rule.id)">全选</el-button>
    </div>
    <el-scrollbar class="preview-box">
      <el-checkbox-group v-model="checkedIds">
        <label v-for="rule in preview" :key="rule.id" class="preview-row">
          <el-checkbox :value="rule.id" />
          <el-tag :type="typeMeta(rule.type).tag" size="small" effect="plain">{{ typeMeta(rule.type).label }}</el-tag>
          <span class="preview-target">{{ rule.target.fieldPath || rule.target.interfaceName }}</span>
          <span class="preview-desc">
            {{ rule.desc }}
            <template v-if="getProtoRange(rule)">
              <span class="proto-range">（协议范围：{{ getProtoRange(rule) }}）</span>
            </template>
          </span>
        </label>
      </el-checkbox-group>
      <el-empty v-if="!preview.length" :image-size="80" description="请选择接口与规则类型" />
    </el-scrollbar>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!checkedRules.length" @click="confirm">生成规则</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { RULE_TYPES, useRuleStore } from '@/stores/rule'
import { useProtocolStore } from '@/stores/protocol'
import { RULE_TYPE_MAP, flattenInterfaceFields, inferConstraint } from '@/utils/ruleEngine'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  ruleSet: { type: Object, default: null },
  initialInterfaceId: { type: [String, Number], default: null },
})
const emit = defineEmits(['update:modelValue'])

const store = useRuleStore()
const protoStore = useProtocolStore()
const interfaceId = ref(null)
const selectedTypes = ref(['type', 'range', 'overflow', 'boundary', 'timeout', 'format'])
const checkedIds = ref([])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const moduleInterfaces = computed(() => protoStore.interfaces.filter((iface) => iface.moduleId === props.ruleSet?.moduleId))
const preview = computed(() => store.generatePreview(interfaceId.value, selectedTypes.value))
const checkedRules = computed(() => preview.value.filter((rule) => checkedIds.value.includes(rule.id)))

watch(preview, (items) => { checkedIds.value = items.map((rule) => rule.id) })
watch(() => props.modelValue, (open) => {
  if (open) {
    const preselect = props.initialInterfaceId
      ? moduleInterfaces.value.find((i) => String(i.id) === String(props.initialInterfaceId))
      : null
    interfaceId.value = preselect?.id || moduleInterfaces.value[0]?.id || null
  }
})

const typeMeta = (type) => RULE_TYPE_MAP[type] || { label: type, tag: 'info' }
const getProtoRange = (rule) => {
  if (rule.type !== 'range' || !rule.target?.fieldPath) return null
  const iface = protoStore.interfaces.find((i) => i.id === rule.target.interfaceId)
  if (!iface) return null
  const field = flattenInterfaceFields(iface).find((f) => f.fieldPath === rule.target.fieldPath)
  if (!field) return null
  const c = inferConstraint(field)
  return c ? `${c.min} ~ ${c.max}` : null
}
const confirm = () => {
  const result = store.mergeGeneratedRules(props.ruleSet.id, checkedRules.value)
  ElMessage.success(`已生成 ${result.added} 条规则，跳过 ${result.skipped} 条重复`)
  visible.value = false
}
</script>

<style scoped lang="scss">
.option-path { float: right; color: var(--el-text-color-secondary); font: 12px Consolas, Monaco, monospace; }
.preview-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-weight: 600; }
.preview-box { height: 300px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; padding: 8px; }
.preview-row { display: grid; grid-template-columns: 28px 100px minmax(150px, 1fr) minmax(180px, 1.2fr); gap: 8px; align-items: center; min-height: 38px; padding: 6px; border-radius: 6px; }
.preview-row:hover { background: var(--el-fill-color-light); }
.preview-target { font-family: Consolas, Monaco, monospace; font-size: 12px; }
.preview-desc { color: var(--el-text-color-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proto-range { color: var(--el-color-primary); font-weight: 500; }
</style>
