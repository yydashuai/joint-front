<template>
  <el-dialog
    :model-value="modelValue"
    :title="`自定义监听配置 · ${iface?.name || ''}`"
    width="480px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="tip"
      title="按监听配置解析报文"
      description="仅匹配监听 IP、协议、消息号的报文进入接收数据流；系统不解析报文体内容。"
    />
    <el-form label-width="90px" label-position="left">
      <el-form-item label="监听 IP">
        <el-input v-model="form.ip" placeholder="如 0.0.0.0 或具体地址" />
      </el-form-item>
      <el-form-item label="协议">
        <el-select v-model="form.protocol" style="width: 100%">
          <el-option label="OSE" value="OSE" />
          <el-option label="4908A" value="4908A" />
          <el-option label="MDS" value="MDS" />
        </el-select>
      </el-form-item>
      <el-form-item label="消息号">
        <el-input v-model="form.messageId" placeholder="如 0x02；留空=监听全部消息" class="mono" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useCustomIfaceStore, makeListenConfig } from '@/stores/customIface'

const props = defineProps({
  modelValue: Boolean,
  ifaceId: { type: String, default: null },
})
const emit = defineEmits(['update:modelValue'])

const store = useCustomIfaceStore()
const form = reactive({ ip: '', protocol: 'OSE', messageId: '' })

watch(() => props.modelValue, (v) => {
  if (!v) return
  const current = props.ifaceId ? store.byId(props.ifaceId) : null
  const base = current?.listenConfig || makeListenConfig(current?.transportType || 'OSE')
  form.ip = base.ip || ''
  form.protocol = base.protocol || current?.transportType || 'OSE'
  form.messageId = base.messageId || ''
})

const save = () => {
  if (!props.ifaceId) return
  store.update(props.ifaceId, { listenConfig: { ...form } })
  ElMessage.success('监听配置已保存')
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.tip { margin-bottom: 14px; }
.mono input, .mono { font-family: Consolas, Monaco, monospace; }
</style>
