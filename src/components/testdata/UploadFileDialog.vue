<template>
  <el-dialog v-model="visible" title="导入数据文件" width="560px" destroy-on-close @close="onClose">
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
            <el-tooltip content="移除已选文件"><el-button text type="danger" size="small" @click.stop="clearFile">移除</el-button></el-tooltip>
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
      <el-form-item label="关联接口">
        <div class="interface-picker">
          <el-select
            v-model="form.interfaceId"
            filterable
            clearable
            placeholder="可选：选择文件归属接口"
            style="width: 100%;"
          >
            <el-option v-for="item in interfaceOptions" :key="item.id" :label="item.name" :value="item.id" />
            <template #footer>
              <button class="interface-add" type="button" @click="emit('add-interface')">＋ 添加接口</button>
            </template>
          </el-select>
          <span class="form-hint">可以暂不选择，上传后仍可在数据文件管理中配置。</span>
        </div>
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
import { formatFileSize, inferFileFormat, readFileAsText } from '@/services/testDataService'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'
import { useProtocolStore } from '@/stores/protocol'

const props = defineProps({
  modelValue: Boolean,
  createdInterfaceId: { type: [String, Number], default: null }
})
const emit = defineEmits(['update:modelValue', 'submitted', 'add-interface'])

const { validateName } = useEntityNameGuard()
const protocolStore = useProtocolStore()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const fileInputRef = ref(null)
const selectedFile = ref(null)

const form = reactive({
  name: '',
  format: 'csv',
  desc: '',
  interfaceId: ''
})

const interfaceOptions = computed(() => [...protocolStore.testInterfaces].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')))

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
    form.desc = ''
    form.interfaceId = ''
  }
})

watch(() => props.createdInterfaceId, (id) => {
  if (id != null && props.modelValue) form.interfaceId = id
})

const onClose = () => {
  emit('update:modelValue', false)
}

const onSubmit = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  const validName = validateName(form.name || selectedFile.value.name, null, '数据文件')
  if (!validName) return
  // 文本类文件（≤1MB）读取内容保留，便于数据文件管理中「解析」为数据链
  let content = ''
  if (selectedFile.value.size <= 1024 * 1024) {
    try { content = await readFileAsText(selectedFile.value) } catch { content = '' }
  }
  emit('submitted', {
    name: validName,
    format: form.format,
    size: selectedFile.value.size,
    desc: form.desc,
    file: selectedFile.value,
    content,
    interfaceIds: form.interfaceId ? [form.interfaceId] : [],
    interfaceNames: form.interfaceId
      ? [protocolStore.testInterfaces.find((item) => String(item.id) === String(form.interfaceId))?.name].filter(Boolean)
      : [],
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

.interface-picker { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.form-hint { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
.interface-add { width: 100%; border: 0; padding: 7px 10px; background: transparent; color: var(--el-color-primary); cursor: pointer; font: inherit; text-align: left; }
.interface-add:hover { background: var(--el-fill-color-light); }
</style>
