<template>
  <el-dialog v-model="visible" title="新建测试数据集" width="520px" destroy-on-close @close="onClose">
    <el-form :model="form" label-width="100px">
      <el-form-item label="数据集名称" required>
        <el-input v-model="form.name" placeholder="如：设备状态查询-正常场景" @keyup.enter="onSubmit" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
      <el-form-item label="所属模块">
        <el-input :model-value="`${form.moduleName}（${form.systemId}）`" disabled />
      </el-form-item>

      <!-- 关联类型：互斥切换 (优化点 18) -->
      <el-form-item label="关联类型">
        <el-radio-group v-model="linkType" @change="onLinkTypeChange">
          <el-radio-button value="none">不关联</el-radio-button>
          <el-radio-button value="protocol" :disabled="moduleProtocols.length === 0">协议</el-radio-button>
          <el-radio-button value="interface" :disabled="moduleInterfaces.length === 0">接口</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item v-if="linkType === 'protocol'" label="关联协议">
        <el-select v-model="form.linkedProtocol" placeholder="选择协议" style="width: 100%;">
          <el-option v-for="p in moduleProtocols" :key="p.id" :label="p.name" :value="p.name" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="linkType === 'interface'" label="关联接口">
        <el-select v-model="form.linkedInterface" placeholder="选择接口" style="width: 100%;">
          <el-option v-for="i in moduleInterfaces" :key="i.id" :label="i.name" :value="i.name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useProtocolStore } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  modelValue: Boolean,
  module: { type: Object, default: null } // { systemId, name }
})
const emit = defineEmits(['update:modelValue', 'created'])

const protoStore = useProtocolStore()
const connStore = useConnectionStore()

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

const linkType = ref('none')

const moduleProtocols = computed(() => {
  if (!form.systemId || !form.moduleName) return []
  const mod = connStore.nodes.find(n => n.name === form.moduleName && n.systemId === form.systemId)
  if (!mod) return []
  return protoStore.protocols.filter(p => p.moduleId === mod.id)
})

const moduleInterfaces = computed(() => {
  if (!form.systemId || !form.moduleName) return []
  const mod = connStore.nodes.find(n => n.name === form.moduleName && n.systemId === form.systemId)
  if (!mod) return []
  return protoStore.interfaces.filter(i => i.moduleId === mod.id)
})

const onLinkTypeChange = (val) => {
  form.linkedProtocol = null
  form.linkedInterface = null
}

// 打开时初始化
watch(() => props.modelValue, (v) => {
  if (v && props.module) {
    form.name = ''
    form.desc = ''
    form.systemId = props.module.systemId
    form.moduleName = props.module.name
    form.linkedProtocol = null
    form.linkedInterface = null
    linkType.value = 'none'
  }
})

const onClose = () => {
  emit('update:modelValue', false)
}

const onSubmit = () => {
  if (!form.name) {
    ElMessage.warning('请输入数据集名称')
    return
  }
  emit('created', {
    name: form.name,
    desc: form.desc,
    systemId: form.systemId,
    moduleName: form.moduleName,
    linkedProtocol: form.linkedProtocol,
    linkedInterface: form.linkedInterface
  })
  visible.value = false
}
</script>
