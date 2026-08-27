<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? `编辑自定义接口 · ${form.name}` : '新建自定义接口'"
    width="560px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form label-width="90px" label-position="left" class="cf-form">
      <el-form-item label="接口名称">
        <el-input v-model="form.name" placeholder="如：外部密文接口A" clearable />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
      <el-form-item label="传输类型">
        <el-select v-model="form.transportType" style="width: 100%" @change="onTypeChange">
          <el-option v-for="t in TRANSPORT_TYPES" :key="t.value" :label="t.label" :value="t.value">
            <span>{{ t.label }}</span>
            <span style="float:right;color:var(--el-text-color-secondary);font-size:12px">{{ t.desc }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="报文体(hex)">
        <el-input
          v-model="form.bodyHex"
          type="textarea"
          :rows="4"
          class="mono"
          placeholder="粘贴原始报文数据（可为加密后的数据），系统不解析，发送时原样透传"
        />
      </el-form-item>
      <el-divider content-position="left">接收监听配置</el-divider>
      <el-form-item label="监听 IP">
        <el-input v-model="form.listenConfig.ip" placeholder="如 0.0.0.0 或具体地址" />
      </el-form-item>
      <el-form-item label="协议">
        <el-select v-model="form.listenConfig.protocol" style="width: 100%">
          <el-option label="OSE" value="OSE" />
          <el-option label="4908A" value="4908A" />
          <el-option label="MDS" value="MDS" />
        </el-select>
      </el-form-item>
      <el-form-item label="消息号">
        <el-input v-model="form.listenConfig.messageId" placeholder="如 0x02；留空=监听全部消息" class="mono" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { TRANSPORT_TYPES } from '@/stores/protocol'
import { useCustomIfaceStore, makeHeaderConfig, makeListenConfig } from '@/stores/customIface'

const props = defineProps({
  modelValue: Boolean,
  interfaceId: { type: String, default: null }, // null=新建
})
const emit = defineEmits(['update:modelValue', 'saved'])

const store = useCustomIfaceStore()
const editing = computed(() => !!props.interfaceId)

const form = reactive({
  name: '',
  remark: '',
  transportType: 'OSE',
  bodyHex: '',
  listenConfig: makeListenConfig('OSE'),
})

watch(() => props.modelValue, (v) => {
  if (!v) return
  const current = props.interfaceId ? store.byId(props.interfaceId) : null
  if (current) {
    form.name = current.name
    form.remark = current.remark || ''
    form.transportType = current.transportType || 'OSE'
    form.bodyHex = current.bodyHex || ''
    form.listenConfig = { ...(current.listenConfig || makeListenConfig(form.transportType)) }
  } else {
    form.name = ''
    form.remark = ''
    form.transportType = 'OSE'
    form.bodyHex = ''
    form.listenConfig = makeListenConfig('OSE')
  }
})

const onTypeChange = (type) => {
  // 切换传输类型后重置传输配置与报文头模板
  form.bodyHex = form.bodyHex || ''
  form.listenConfig.protocol = type
}

const save = () => {
  const name = form.name.trim()
  if (!name) {
    ElMessage.warning('请输入接口名称')
    return
  }
  if (editing.value) {
    store.update(props.interfaceId, {
      name,
      remark: form.remark,
      transportType: form.transportType,
      bodyHex: form.bodyHex,
      listenConfig: { ...form.listenConfig },
    })
    ElMessage.success('自定义接口已更新')
  } else {
    const created = store.add({
      name,
      remark: form.remark,
      transportType: form.transportType,
      bodyHex: form.bodyHex,
      listenConfig: { ...form.listenConfig },
    })
    ElMessage.success(`自定义接口「${created.name}」已创建`)
    emit('saved', created.id)
  }
  emit('update:modelValue', false)
}

/* 供外部引用（编辑时确保模板存在） */
const ensureTemplate = () => makeHeaderConfig(form.transportType)
defineExpose({ ensureTemplate })
</script>

<style scoped lang="scss">
.tip { margin-bottom: 14px; }
.cf-form :deep(.el-form-item) { margin-bottom: 14px; }
.mono input, .mono textarea, .mono { font-family: Consolas, Monaco, monospace; }
</style>
