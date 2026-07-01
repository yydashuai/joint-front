<template>
  <div class="transport-config" v-if="transportType">
    <el-divider content-position="left">{{ typeLabel }} 传输配置</el-divider>

    <!-- TCP / UDP -->
    <template v-if="transportType === 'TCP' || transportType === 'UDP'">
      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">端口</span>
          <el-input-number v-model="cfg.port" :min="0" :max="65535" style="width: 160px" />
        </div>
        <div class="form-row">
          <span class="form-label">超时 (ms)</span>
          <el-input-number v-model="cfg.timeout" :min="0" :step="1000" style="width: 160px" />
        </div>
      </div>
    </template>

    <!-- HTTP -->
    <template v-if="transportType === 'HTTP'">
      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">请求方法</span>
          <el-select v-model="cfg.method" style="width: 140px">
            <el-option v-for="m in HTTP_METHODS" :key="m" :label="m" :value="m" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label req">路径</span>
          <el-input v-model="cfg.path" placeholder="/api/v1/endpoint" style="max-width: 360px" />
        </div>
        <div class="form-row">
          <span class="form-label">Content-Type</span>
          <el-select v-model="cfg.contentType" style="width: 260px" filterable allow-create>
            <el-option v-for="ct in HTTP_CONTENT_TYPES" :key="ct" :label="ct" :value="ct" />
          </el-select>
        </div>
      </div>

      <!-- Headers -->
      <div class="sub-section">
        <div class="sub-section__head">
          <span class="sub-section__title">请求头 (Headers)</span>
          <div class="sub-section__actions">
            <el-dropdown @command="addCommonHeader" trigger="click">
              <el-button size="small" plain>快捷添加</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="h in COMMON_HEADERS" :key="h" :command="h"
                    :disabled="cfg.headers.some(x => x.key === h)">{{ h }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button size="small" :icon="Plus" @click="cfg.headers.push({ key: '', value: '' })">自定义</el-button>
          </div>
        </div>
        <el-table v-if="cfg.headers.length" :data="cfg.headers" border size="small" class="kv-table">
          <el-table-column label="Key" min-width="160">
            <template #default="{ row }"><el-input v-model="row.key" size="small" placeholder="Header Name" /></template>
          </el-table-column>
          <el-table-column label="Value" min-width="200">
            <template #default="{ row }"><el-input v-model="row.value" size="small" placeholder="Header Value" /></template>
          </el-table-column>
          <el-table-column label="操作" width="60" align="center">
            <template #default="{ $index }">
              <el-button text size="small" :icon="Delete" @click="cfg.headers.splice($index, 1)" />
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="无自定义请求头" :image-size="40" />
      </div>

      <!-- Auth -->
      <div class="sub-section">
        <span class="sub-section__title">认证 (Auth)</span>
        <div class="form-grid" style="margin-top: 8px">
          <div class="form-row">
            <span class="form-label">认证方式</span>
            <el-select v-model="cfg.auth.type" style="width: 160px">
              <el-option label="无" value="none" />
              <el-option label="Basic Auth" value="basic" />
              <el-option label="Bearer Token" value="bearer" />
              <el-option label="API Key" value="apiKey" />
            </el-select>
          </div>
          <template v-if="cfg.auth.type === 'basic'">
            <div class="form-row">
              <span class="form-label req">用户名</span>
              <el-input v-model="cfg.auth.username" placeholder="用户名" style="max-width: 240px" />
            </div>
            <div class="form-row">
              <span class="form-label req">密码</span>
              <el-input v-model="cfg.auth.password" placeholder="密码" style="max-width: 240px" show-password />
            </div>
          </template>
          <div class="form-row" v-if="cfg.auth.type === 'bearer'">
            <span class="form-label req">Token</span>
            <el-input v-model="cfg.auth.token" placeholder="Bearer Token" style="max-width: 360px" show-password />
          </div>
          <template v-if="cfg.auth.type === 'apiKey'">
            <div class="form-row">
              <span class="form-label req">Key 名称</span>
              <el-input v-model="cfg.auth.keyName" placeholder="如 X-Api-Key" style="max-width: 240px" />
            </div>
            <div class="form-row">
              <span class="form-label">传递位置</span>
              <el-select v-model="cfg.auth.keyLocation" style="width: 160px">
                <el-option label="Header" value="header" />
                <el-option label="Query" value="query" />
              </el-select>
            </div>
            <div class="form-row">
              <span class="form-label req">Key 值</span>
              <el-input v-model="cfg.auth.keyValue" placeholder="API Key 值" style="max-width: 300px" show-password />
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- gRPC -->
    <template v-if="transportType === 'gRPC'">
      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">流模式</span>
          <el-radio-group v-model="cfg.streamingMode">
            <el-radio-button value="unary">Unary</el-radio-button>
            <el-radio-button value="server-stream">Server Stream</el-radio-button>
            <el-radio-button value="client-stream">Client Stream</el-radio-button>
            <el-radio-button value="bidirectional">Bidirectional</el-radio-button>
          </el-radio-group>
        </div>
        <div class="form-row">
          <span class="form-label req">服务名</span>
          <el-input v-model="cfg.serviceName" placeholder="TrackService" style="max-width: 200px" />
        </div>
        <div class="form-row">
          <span class="form-label req">方法名</span>
          <el-input v-model="cfg.methodName" placeholder="SubscribeTracks" style="max-width: 200px" />
        </div>
        <div class="form-row">
          <span class="form-label req">服务地址</span>
          <el-input v-model="cfg.serverAddress" placeholder="host:port" style="max-width: 260px" />
        </div>
        <div class="form-row">
          <span class="form-label">超时 (s)</span>
          <el-input-number v-model="cfg.timeout" :min="1" :max="3600" style="width: 130px" />
        </div>
        <div class="form-row">
          <span class="form-label">压缩</span>
          <el-select v-model="cfg.compression" style="width: 130px">
            <el-option label="无" value="none" />
            <el-option label="gzip" value="gzip" />
            <el-option label="deflate" value="deflate" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label">TLS</span>
          <el-switch v-model="cfg.tls.enabled" />
          <el-input v-if="cfg.tls.enabled" v-model="cfg.tls.certPath" placeholder="证书路径" style="max-width: 260px; margin-left: 8px" />
        </div>
      </div>
    </template>

    <!-- MQ -->
    <template v-if="transportType === 'MQ'">
      <div class="section-hint">
        Broker 连接信息请在
        <el-link type="primary" :underline="false" @click="$router.push('/connection')">链路连接管理</el-link>
        中配置。
      </div>
      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">主题</span>
          <el-input v-model="cfg.topic" placeholder="mount.change" style="max-width: 300px" />
        </div>
        <div class="form-row">
          <span class="form-label req">中间件类型</span>
          <el-select v-model="cfg.brokerType" style="width: 160px">
            <el-option v-for="b in MQ_BROKER_TYPES" :key="b" :label="b" :value="b" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label">QoS</span>
          <el-input-number v-model="cfg.qos" :min="0" :max="2" style="width: 120px" />
          <span class="form-hint">0=至多一次 1=至少一次 2=恰好一次</span>
        </div>
        <div class="form-row">
          <span class="form-label">ACK 模式</span>
          <el-select v-model="cfg.ackMode" style="width: 140px">
            <el-option label="自动确认" value="auto" />
            <el-option label="手动确认" value="manual" />
            <el-option label="不确认" value="none" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label">消息格式</span>
          <el-select v-model="cfg.messageFormat" style="width: 140px">
            <el-option label="JSON" value="JSON" />
            <el-option label="Protobuf" value="Protobuf" />
            <el-option label="Raw" value="Raw" />
            <el-option label="XML" value="XML" />
          </el-select>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import {
  HTTP_METHODS, HTTP_CONTENT_TYPES, COMMON_HEADERS, MQ_BROKER_TYPES,
  TRANSPORT_TYPES,
} from '@/stores/protocol'

const props = defineProps({
  transportConfig: { type: Object, required: true },
  transportType: { type: String, default: '' },
})

const cfg = computed(() => props.transportConfig)

const typeLabel = computed(() => {
  const t = TRANSPORT_TYPES.find(x => x.value === props.transportType)
  return t?.label || props.transportType
})

const addCommonHeader = (name) => {
  if (!cfg.value.headers.some(h => h.key === name)) {
    cfg.value.headers.push({ key: name, value: '' })
  }
}
</script>

<style scoped lang="scss">
.transport-config { margin-bottom: 4px; }
.form-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-label { font-size: 13px; color: var(--el-text-color-regular); min-width: 90px; flex-shrink: 0; }
.form-label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.form-hint { font-size: 12px; color: var(--el-text-color-placeholder); }

.section-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 10px; line-height: 1.6; padding-left: 4px; border-left: 3px solid var(--el-color-primary-light-5); }

.sub-section { margin-bottom: 10px; }
.sub-section__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.sub-section__title { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); }
.sub-section__actions { display: flex; gap: 6px; }

.kv-table { margin-bottom: 4px; }
</style>
