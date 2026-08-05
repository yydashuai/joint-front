<template>
  <el-dialog v-model="visible" title="新建测试数据集" width="520px" destroy-on-close @close="onClose">
    <el-form :model="form" label-width="100px">
      <el-form-item label="数据集名称" required>
        <el-input v-model="form.name" placeholder="如：设备状态查询正常场景数据集" @keyup.enter="onSubmit" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
      <el-form-item label="所属模块">
        <el-input :model-value="`${form.moduleName}（${form.systemId}）`" disabled />
      </el-form-item>

      <el-form-item label="关联报文" required>
        <el-select
          v-model="form.linkedInterface"
          placeholder="请选择报文"
          style="width: 100%;"
          :disabled="moduleInterfaces.length === 0"
        >
          <el-option v-for="i in moduleInterfaces" :key="i.id" :label="i.name" :value="i.name" />
        </el-select>
        <span v-if="moduleInterfaces.length === 0" class="form-hint">当前模块暂无报文，请先在报文字段管理中创建报文</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useProtocolStore } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const props = defineProps({
  modelValue: Boolean,
  module: { type: Object, default: null }, // { systemId, name }（按模块创建）
  message: { type: Object, default: null } // 报文实体（从报文创建，预选关联）
})
const emit = defineEmits(['update:modelValue', 'created'])

const protoStore = useProtocolStore()
const connStore = useConnectionStore()
const { validateName } = useEntityNameGuard()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const form = reactive({
  name: '',
  desc: '',
  systemId: '',
  moduleName: '',
  linkedProtocol: null,
  linkedInterface: null
})

const moduleInterfaces = computed(() => {
  if (!form.systemId || !form.moduleName) return []
  const mod = connStore.nodes.find(n => n.name === form.moduleName && n.systemId === form.systemId)
  if (!mod) return []
  return protoStore.interfaces.filter(i => i.moduleId === mod.id)
})

// 打开时初始化：优先按「从报文创建」预选关联
watch(() => props.modelValue, (v) => {
  if (!v) return
  form.name = ''
  form.desc = ''
  form.linkedProtocol = null
  form.linkedInterface = null
  if (props.message) {
    const msg = props.message
    const mod = connStore.nodes.find(n => String(n.id) === String(msg.moduleId))
    form.systemId = msg.systemId || mod?.systemId || ''
    form.moduleName = mod?.name || ''
    form.linkedInterface = msg.name
  } else if (props.module) {
    form.systemId = props.module.systemId
    form.moduleName = props.module.name
  }
})

const onClose = () => {
  emit('update:modelValue', false)
}

const onSubmit = () => {
  const validName = validateName(form.name, null, '数据集')
  if (!validName) return
  if (!form.linkedInterface) {
    ElMessage.warning('请选择关联报文')
    return
  }
  // 报文实体 id（1 报文 : N 数据集）
  const message = protoStore.interfaces.find(
    (i) => i.name === form.linkedInterface || String(i.id) === String(form.linkedInterface)
  )
  emit('created', {
    name: validName,
    desc: form.desc,
    systemId: form.systemId,
    moduleName: form.moduleName,
    linkedProtocol: form.linkedProtocol,
    linkedInterface: form.linkedInterface,
    messageId: message ? message.id : null
  })
  visible.value = false
}
</script>

<style scoped>
.form-hint {
  display: block;
  width: 100%;
  margin-top: 4px;
  color: var(--el-color-warning);
  font-size: 12px;
  line-height: 1.4;
}
</style>
