<template>
  <el-dialog v-model="visible" title="手动录入异常" width="620px">
    <el-form label-width="92px">
      <el-form-item label="所属系统">
        <el-select v-model="form.systemId" filterable style="width: 100%;" @change="onSystemChange">
          <el-option v-for="sys in systemStore.systems" :key="sys.id" :label="sys.name" :value="sys.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="所属模块">
        <el-select v-model="form.moduleId" filterable style="width: 100%;" @change="onModuleChange">
          <el-option v-for="mod in modules" :key="mod.id" :label="mod.name" :value="mod.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="接口">
        <el-select v-model="form.interfaceId" filterable clearable placeholder="可选" style="width: 100%;" @change="onInterfaceChange">
          <el-option v-for="iface in interfaces" :key="iface.id" :label="iface.name" :value="iface.id">
            <span>{{ iface.name }}</span>
            <span class="option-path">{{ iface.path }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="异常类型">
        <el-select v-model="form.type" filterable style="width: 100%;" @change="applyTypeDefault">
          <el-option v-for="type in store.types" :key="type.id" :label="type.name" :value="type.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="级别">
        <el-radio-group v-model="form.level">
          <el-radio-button value="高">高</el-radio-button>
          <el-radio-button value="中">中</el-radio-button>
          <el-radio-button value="低">低</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="现场说明">
        <el-input v-model="form.remark" type="textarea" :rows="4" placeholder="描述现象、复现步骤或现场处置线索" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!form.systemId || !form.moduleId || !form.type" @click="save">录入异常</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useConnectionStore } from '@/stores/connection'
import { useExceptionStore } from '@/stores/exception'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  systemId: { type: String, default: '' },
  moduleId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue'])

const store = useExceptionStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const protoStore = useProtocolStore()
const form = reactive(blank())

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const modules = computed(() => connStore.nodes.filter((item) => item.systemId === form.systemId))
const interfaces = computed(() => protoStore.interfaces.filter((item) => item.moduleId === form.moduleId))

watch(() => props.modelValue, (open) => {
  if (!open) return
  Object.assign(form, blank(), {
    systemId: props.systemId || systemStore.currentId || systemStore.systems[0]?.id || '',
    moduleId: props.moduleId || '',
  })
  if (!form.moduleId) form.moduleId = modules.value[0]?.id || ''
  onModuleChange(form.moduleId)
})

function blank() {
  return {
    systemId: '',
    moduleId: '',
    interfaceId: '',
    iface: '',
    type: '人工登记',
    level: '中',
    remark: '',
  }
}
function onSystemChange() {
  form.moduleId = modules.value[0]?.id || ''
  onModuleChange(form.moduleId)
}
function onModuleChange(id) {
  form.moduleId = id || ''
  form.interfaceId = interfaces.value[0]?.id || ''
  onInterfaceChange(form.interfaceId)
}
function onInterfaceChange(id) {
  const iface = protoStore.interfaces.find((item) => item.id === id)
  form.iface = iface?.name || connStore.nodes.find((item) => item.id === form.moduleId)?.name || '手动登记'
}
function applyTypeDefault(name) {
  const type = store.typeByName(name)
  if (type?.defaultLevel) form.level = type.defaultLevel
}
function save() {
  store.addManual({
    ...form,
    iface: form.iface || '手动登记',
    detail: { ruleMessage: form.remark },
  })
  visible.value = false
  ElMessage.success('异常已录入台账')
}
</script>

<style scoped>
.option-path { float: right; color: var(--el-text-color-secondary); font: 12px Consolas, Monaco, monospace; }
</style>
