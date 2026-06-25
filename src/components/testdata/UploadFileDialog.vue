<template>
  <el-dialog v-model="visible" title="导入测试资源文件" width="520px" destroy-on-close @close="onClose">
    <el-form :model="form" label-width="100px">
      <!-- 真实文件选择器 (优化点 13) -->
      <el-form-item label="选择文件" required>
        <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="onDrop">
          <input
            ref="fileInputRef"
            type="file"
            accept=".csv,.json,.bin,.xml,.txt"
            style="display: none;"
            @change="onFileChange"
          />
          <div v-if="!selectedFile" class="upload-placeholder">
            <el-icon :size="28" color="var(--el-text-color-placeholder)"><UploadFilled /></el-icon>
            <span class="upload-hint">点击选择或拖拽文件到此处</span>
            <span class="upload-formats">支持 CSV / JSON / BIN / XML</span>
          </div>
          <div v-else class="upload-selected">
            <el-icon :size="20" :color="formatColor"><Document /></el-icon>
            <div class="upload-file-info">
              <span class="upload-filename">{{ selectedFile.name }}</span>
              <span class="upload-filesize">{{ formatSize(selectedFile.size) }} · {{ selectedFormat.toUpperCase() }}</span>
            </div>
            <el-button text type="danger" size="small" @click.stop="clearFile">移除</el-button>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="文件格式">
        <el-select v-model="form.format" style="width: 100%;">
          <el-option label="CSV" value="csv" />
          <el-option label="JSON" value="json" />
          <el-option label="二进制" value="bin" />
          <el-option label="XML" value="xml" />
        </el-select>
      </el-form-item>
      <el-form-item label="关联系统">
        <el-select v-model="form.systemId" placeholder="选择系统" clearable style="width: 100%;">
          <el-option v-for="sys in systemStore.systems" :key="sys.id" :label="sys.name" :value="sys.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="关联模块">
        <el-select v-model="form.moduleName" placeholder="选择模块" style="width: 100%;" :disabled="!form.systemId">
          <el-option v-for="mod in uploadModules" :key="mod.id" :label="mod.name" :value="mod.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!selectedFile" @click="onSubmit">确认导入</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { UploadFilled, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { formatFileSize, inferFileFormat } from '@/services/testDataService'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'submitted'])

const systemStore = useSystemStore()
const connStore = useConnectionStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const fileInputRef = ref(null)
const selectedFile = ref(null)

const form = reactive({
  name: '',
  format: 'csv',
  systemId: '',
  moduleName: '',
  desc: ''
})

const uploadModules = computed(() => {
  if (!form.systemId) return []
  return connStore.nodes.filter(n => n.systemId === form.systemId)
})

const selectedFormat = computed(() => {
  if (!selectedFile.value) return 'csv'
  return inferFileFormat(selectedFile.value.name)
})

const formatColor = computed(() => {
  const map = { csv: '#52c41a', json: '#faad14', bin: '#8b9dc3', xml: '#2f6feb' }
  return map[form.format] || '#999'
})

const formatSize = (bytes) => formatFileSize(bytes)

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const onFileChange = (e) => {
  const file = e.target.files?.[0]
  if (file) {
    selectedFile.value = file
    form.name = file.name
    form.format = inferFileFormat(file.name)
  }
}

const onDrop = (e) => {
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    selectedFile.value = file
    form.name = file.name
    form.format = inferFileFormat(file.name)
  }
}

const clearFile = () => {
  selectedFile.value = null
  form.name = ''
  if (fileInputRef.value) fileInputRef.value.value = ''
}

watch(() => props.modelValue, (v) => {
  if (v) {
    clearFile()
    form.systemId = ''
    form.moduleName = ''
    form.desc = ''
  }
})

const onClose = () => {
  emit('update:modelValue', false)
}

const onSubmit = () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  emit('submitted', {
    name: form.name || selectedFile.value.name,
    format: form.format,
    size: selectedFile.value.size,
    systemId: form.systemId,
    moduleName: form.moduleName,
    desc: form.desc,
    file: selectedFile.value,
    rowCount: form.format === 'bin' ? 0 : Math.floor(Math.random() * 200) + 10
  })
  visible.value = false
}
</script>

<style scoped lang="scss">
.upload-area {
  width: 100%;
  min-height: 100px;
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--el-color-primary);
  }
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
}

.upload-hint {
  font-size: 14px;
  color: var(--el-text-color-regular);
}

.upload-formats {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.upload-selected {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  width: 100%;
}

.upload-file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.upload-filename {
  font-size: 14px;
  font-weight: 500;
}

.upload-filesize {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>
