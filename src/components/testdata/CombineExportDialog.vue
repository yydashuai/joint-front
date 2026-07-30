<template>
  <el-dialog
    v-model="visible"
    title="组合导出 / 存为方案"
    width="620px"
    destroy-on-close
    @close="onClose"
  >
    <el-alert
      :closable="false"
      type="info"
      class="ce-alert"
      title="选择多个数据集（每个对应一个导入的报文/接口）"
      description="可一并导出为单个 JSON 文件，或保存为一个数据集方案以便后续复用。"
    />

    <div class="ce-toolbar">
      <el-select
        v-model="selectedIds"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        placeholder="勾选要组合的数据集"
        style="flex: 1;"
      >
        <el-option
          v-for="ds in datasetOptions"
          :key="ds.id"
          :label="`${ds.name}（${ds.moduleName || '通用'}）`"
          :value="ds.id"
        />
      </el-select>
      <el-button text type="info" @click="selectedIds = datasetOptions.map(d => d.id)">全选</el-button>
      <el-button text type="info" @click="selectedIds = []">清空</el-button>
    </div>

    <el-form :model="form" label-width="92px" size="default" class="ce-form">
      <el-form-item label="方案名称">
        <el-input v-model="form.name" placeholder="如：武器状态综合数据集方案" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button :disabled="!selectedIds.length" :icon="Document" @click="onExportFile">导出为 JSON 文件</el-button>
      <el-button type="primary" :disabled="!selectedIds.length" :icon="FolderChecked" @click="onSaveScheme">保存为数据方案</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Document, FolderChecked } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useTestDataStore } from '@/stores/testData'
import { useDatasetSchemeStore } from '@/stores/datasetScheme'
import { useSystemStore } from '@/stores/system'
import { exportJsonFile } from '@/services/testDataService'

const props = defineProps({ modelValue: Boolean, systemId: { type: [String, Number], default: '' } })
const emit = defineEmits(['update:modelValue', 'saved'])

const tdStore = useTestDataStore()
const schemeStore = useDatasetSchemeStore()
const systemStore = useSystemStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const selectedIds = ref([])
const form = reactive({ name: '', remark: '' })

const datasetOptions = computed(() => {
  if (!props.systemId) return tdStore.datasets
  return tdStore.datasets.filter((d) => d.systemId === props.systemId)
})

const onClose = () => emit('update:modelValue', false)

const buildBundle = () => {
  const list = selectedIds.value
    .map((id) => tdStore.datasets.find((d) => d.id === id))
    .filter(Boolean)
  return {
    exportedAt: new Date().toISOString(),
    systemId: props.systemId || null,
    systemName: props.systemId ? (systemStore.systems.find((s) => s.id === props.systemId)?.name || '') : '',
    datasets: list.map((d) => ({
      name: d.name,
      systemId: d.systemId,
      moduleName: d.moduleName,
      linkedProtocol: d.linkedProtocol,
      linkedInterface: d.linkedInterface,
      desc: d.desc,
      rows: d.rows,
    })),
  }
}

const onExportFile = () => {
  if (!selectedIds.value.length) return
  const bundle = buildBundle()
  const sysName = bundle.systemName || '组合'
  exportJsonFile(bundle, `数据组合_${sysName}_${bundle.datasets.length}个.json`)
  ElMessage.success(`已导出 ${bundle.datasets.length} 个数据集为 JSON 文件`)
}

const onSaveScheme = () => {
  if (!selectedIds.value.length) return
  if (!form.name.trim()) {
    ElMessage.warning('请输入方案名称')
    return
  }
  const scheme = schemeStore.add({
    name: form.name.trim(),
    systemId: props.systemId || null,
    datasetIds: [...selectedIds.value],
    remark: form.remark,
  })
  ElMessage.success(`已保存为数据集方案「${scheme.name}」（${selectedIds.value.length} 个数据集）`)
  emit('saved', scheme)
  visible.value = false
}
</script>

<style scoped lang="scss">
.ce-alert { margin-bottom: 12px; }
.ce-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.ce-form { margin-top: 4px; }
</style>
