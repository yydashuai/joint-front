<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑数据集方案' : '新建数据集方案'"
    width="560px"
    destroy-on-close
    @close="onClose"
  >
    <el-form :model="form" label-width="96px" size="default">
      <el-form-item label="方案名称" required>
        <el-input v-model="form.name" placeholder="如：武器状态全场景数据集方案" />
      </el-form-item>
      <el-form-item label="关联系统">
        <el-input :model-value="systemLabel" disabled />
      </el-form-item>
      <el-form-item label="包含数据集">
        <el-select
          v-model="form.datasetIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="选择本系统下的数据集"
          style="width: 100%;"
        >
          <el-option
            v-for="ds in datasetsOfSystem"
            :key="ds.id"
            :label="ds.name"
            :value="ds.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="onConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useTestDataStore } from '@/stores/testData'
import { useSystemStore } from '@/stores/system'

const props = defineProps({
  modelValue: Boolean,
  systemId: { type: [String, Number], default: '' },
  scheme: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const tdStore = useTestDataStore()
const systemStore = useSystemStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const form = reactive({ name: '', datasetIds: [], remark: '' })
const isEdit = computed(() => !!props.scheme)

const systemLabel = computed(() => {
  if (!props.systemId) return '全部系统（通用）'
  return systemStore.systems.find(s => s.id === props.systemId)?.name || String(props.systemId)
})

const datasetsOfSystem = computed(() => {
  if (!props.systemId) return tdStore.datasets
  return tdStore.datasets.filter(d => d.systemId === props.systemId)
})

watch(() => props.modelValue, (v) => {
  if (!v) return
  if (props.scheme) {
    form.name = props.scheme.name
    form.datasetIds = [...props.scheme.datasetIds]
    form.remark = props.scheme.remark || ''
  } else {
    form.name = ''
    form.datasetIds = []
    form.remark = ''
  }
})

const onClose = () => emit('update:modelValue', false)

const onConfirm = () => {
  if (!form.name.trim()) {
    ElMessage.warning('请输入方案名称')
    return
  }
  emit('confirm', {
    name: form.name.trim(),
    systemId: props.systemId || null,
    datasetIds: form.datasetIds,
    remark: form.remark
  })
  visible.value = false
}
</script>
