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
          <el-tooltip content="保存当前协议配置"><el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button></el-tooltip>
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

    <!-- ====== 区块1: 流式模式 ====== -->
    <el-divider content-position="left">gRPC 传输配置</el-divider>
    <div class="section-hint">
      协议只定义传输层规范（流模式、地址、超时）。具体的服务名、方法名、消息结构由引用此协议的接口定义。
    </div>

    <el-radio-group v-model="cfg.streamingMode" class="stream-modes">
      <el-radio-button value="unary">Unary（一元）</el-radio-button>
      <el-radio-button value="server-stream">Server Stream</el-radio-button>
      <el-radio-button value="client-stream">Client Stream</el-radio-button>
      <el-radio-button value="bidirectional">Bidirectional</el-radio-button>
    </el-radio-group>
    <div class="mode-hint">{{ streamHint }}</div>

    <!-- ====== 区块2: 运行时配置 ====== -->
    <el-divider content-position="left">运行时配置</el-divider>
    <div class="form-grid">
      <div class="form-row">
        <span class="form-label req">默认访问地址</span>
        <el-input v-model="cfg.serverAddress" placeholder="host:port" style="max-width: 300px" />
      </div>
      <div class="form-row">
        <span class="form-label">超时时间 (s)</span>
        <el-input-number v-model="cfg.timeout" :min="1" :max="3600" size="small" style="width: 140px" />
      </div>
      <div class="form-row">
        <span class="form-label">压缩方式</span>
        <el-select v-model="cfg.compression" style="width: 160px">
          <el-option label="无" value="none" />
          <el-option label="gzip" value="gzip" />
          <el-option label="deflate" value="deflate" />
        </el-select>
      </div>
    </div>

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
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Check } from '@element-plus/icons-vue'
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

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'auto' }
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

.section-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 12px; line-height: 1.6; padding-left: 4px; border-left: 3px solid var(--el-color-primary-light-5); }
</style>
