<template>
  <el-dialog v-model="visible" title="新建测试任务" width="520px" destroy-on-close @close="onClose">
    <el-form :model="form" label-width="100px">
      <el-form-item label="任务名称" required>
        <el-input v-model="form.name" placeholder="如：武器状态接口连通性测试" @keyup.enter="onSubmit" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
      <el-form-item label="所属模块">
        <el-input :model-value="`${moduleName}（${form.systemId}）`" disabled />
      </el-form-item>
      <el-form-item label="优先级">
        <el-radio-group v-model="form.priority">
          <el-radio-button value="high">高</el-radio-button>
          <el-radio-button value="medium">中</el-radio-button>
          <el-radio-button value="low">低</el-radio-button>
        </el-radio-group>
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
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  modelValue: Boolean,
  module: { type: Object, default: null } // { systemId, name }
})
const emit = defineEmits(['update:modelValue', 'created'])

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
  moduleId: null,
  priority: 'medium',
})

const moduleName = computed(() => form.moduleName)

watch(() => props.modelValue, (v) => {
  if (v && props.module) {
    form.name = ''
    form.desc = ''
    form.systemId = props.module.systemId
    form.moduleName = props.module.name
    // 查找模块 ID
    const mod = connStore.nodes.find(n => n.name === props.module.name && n.systemId === props.module.systemId)
    form.moduleId = mod?.id || null
    form.priority = 'medium'
  }
})

const onClose = () => {
  emit('update:modelValue', false)
}

const onSubmit = () => {
  if (!form.name) {
    ElMessage.warning('请输入任务名称')
    return
  }
  emit('created', { ...form })
  visible.value = false
}
</script>
