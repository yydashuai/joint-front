<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <el-input v-model="protocol.name" class="proto-name" placeholder="协议名称" />
        <div class="proto-head__right">
          <span class="lbl">当前类型</span>
          <el-select :model-value="protocol.type" style="width: 100px" @change="(v) => $emit('switchType', v)">
            <el-option v-for="t in PROTOCOL_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button>
          <el-popconfirm title="删除该协议？" @confirm="$emit('delete')">
            <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
          </el-popconfirm>
        </div>
      </div>
    </template>

    <div class="field-label">备注说明</div>
    <el-input v-model="protocol.desc" placeholder="可选，描述该协议的用途" class="proto-desc" />

    <div class="meta-row">
      <span class="meta-row__label req">所属系统</span>
      <el-select v-model="protocol.systemId" placeholder="选择系统" class="meta-sel" @change="$emit('systemChange')">
        <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <span class="meta-row__label req">模块</span>
      <el-select v-model="protocol.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!protocol.systemId">
        <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
      </el-select>
    </div>

    <el-divider content-position="left">gRPC 服务配置</el-divider>

    <div class="form-grid">
      <div class="form-row">
        <span class="form-label req">服务名</span>
        <el-input v-model="cfg.serviceName" placeholder="如 TrackService" style="max-width: 300px" />
      </div>
      <div class="form-row">
        <span class="form-label req">方法名</span>
        <el-input v-model="cfg.methodName" placeholder="如 SubscribeTrack" style="max-width: 300px" />
      </div>
      <div class="form-row">
        <span class="form-label">Proto 文件</span>
        <el-input v-model="cfg.protoRef" placeholder="proto 文件路径引用" style="max-width: 400px" />
      </div>
      <div class="form-row">
        <span class="form-label req">服务端地址</span>
        <el-input v-model="cfg.serverAddress" placeholder="host:port" style="max-width: 300px" />
      </div>
    </div>

    <el-divider content-position="left">流式模式</el-divider>
    <el-radio-group v-model="cfg.streamingMode" class="stream-modes">
      <el-radio-button value="unary">Unary（一元）</el-radio-button>
      <el-radio-button value="server-stream">Server Stream（服务端流）</el-radio-button>
      <el-radio-button value="client-stream">Client Stream（客户端流）</el-radio-button>
      <el-radio-button value="bidirectional">Bidirectional（双向流）</el-radio-button>
    </el-radio-group>
    <div class="mode-hint">{{ streamHint }}</div>

    <el-divider content-position="left">TLS / SSL</el-divider>
    <div class="form-grid">
      <div class="form-row">
        <span class="form-label">启用 TLS</span>
        <el-switch v-model="cfg.tls.enabled" />
      </div>
      <div class="form-row" v-if="cfg.tls.enabled">
        <span class="form-label">证书路径</span>
        <el-input v-model="cfg.tls.certPath" placeholder="TLS 证书文件路径" style="max-width: 400px" />
      </div>
    </div>

    <el-divider content-position="left">Metadata（元数据）</el-divider>
    <el-table :data="cfg.metadata" border size="small" class="kv-table">
      <el-table-column label="Key" min-width="160">
        <template #default="{ row }"><el-input v-model="row.key" size="small" placeholder="Metadata Key" /></template>
      </el-table-column>
      <el-table-column label="Value" min-width="200">
        <template #default="{ row }"><el-input v-model="row.value" size="small" placeholder="Metadata Value" /></template>
      </el-table-column>
      <el-table-column label="操作" width="64" align="center">
        <template #default="{ $index }">
          <el-button text size="small" :icon="Delete" @click="cfg.metadata.splice($index, 1)" />
        </template>
      </el-table-column>
    </el-table>
    <el-button size="small" :icon="Plus" @click="cfg.metadata.push({ key: '', value: '' })">添加 Metadata</el-button>
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Plus, Check } from '@element-plus/icons-vue'
import { PROTOCOL_TYPES } from '@/stores/protocol'

const props = defineProps({
  protocol: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
})
defineEmits(['delete', 'save', 'systemChange', 'switchType'])

// ---- 脏数据追踪 ----
const dirty = ref(false)
const snapshot = ref(JSON.stringify(props.protocol))
watch(() => props.protocol, () => {
  dirty.value = JSON.stringify(props.protocol) !== snapshot.value
}, { deep: true })
watch(() => props.protocol.id, () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
}, { immediate: true })
const markClean = () => { snapshot.value = JSON.stringify(props.protocol); dirty.value = false }
defineExpose({ markClean })

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
const cfg = computed(() => props.protocol.config)

const streamHint = computed(() => {
  const hints = {
    'unary': '客户端发送一个请求，服务端返回一个响应。适用于普通的请求/响应场景。',
    'server-stream': '客户端发送一个请求，服务端返回一个响应流。适用于实时数据推送（如航迹、遥测）。',
    'client-stream': '客户端发送一个请求流，服务端返回一个响应。适用于批量数据上传。',
    'bidirectional': '客户端和服务端互相发送流。适用于实时双向通信（如语音、协作编辑）。'
  }
  return hints[cfg.value.streamingMode] || ''
})
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; .lbl { font-size: 13px; color: var(--el-text-color-secondary); } }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }

.form-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-label { font-size: 13px; color: var(--el-text-color-regular); min-width: 100px; flex-shrink: 0; }
.form-label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }

.stream-modes { margin-bottom: 8px; }
.mode-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; padding-left: 4px; }

.kv-table { margin-bottom: 8px; }
</style>
