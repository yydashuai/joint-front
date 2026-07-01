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

    <!-- ====== 区块1: 基础传输配置 ====== -->
    <el-divider content-position="left">HTTP 传输配置</el-divider>
    <div class="section-hint">
      协议只定义传输层规范（方法、编码、认证）。具体的请求路径、参数、响应由引用此协议的接口定义。
    </div>
    <div class="form-grid">
      <div class="form-row">
        <span class="form-label req">请求方法</span>
        <el-select v-model="cfg.method" style="width: 140px">
          <el-option v-for="m in HTTP_METHODS" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="form-label">Content-Type</span>
        <el-select v-model="cfg.contentType" style="width: 280px" filterable allow-create>
          <el-option v-for="ct in HTTP_CONTENT_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-select>
      </div>
    </div>

    <!-- ====== 区块2: 请求头 ====== -->
    <el-divider content-position="left">请求头 (Headers)</el-divider>
    <el-table :data="cfg.headers" border size="small" class="kv-table">
      <el-table-column label="Key" min-width="160">
        <template #default="{ row }"><el-input v-model="row.key" size="small" placeholder="Header Name" /></template>
      </el-table-column>
      <el-table-column label="Value" min-width="200">
        <template #default="{ row }"><el-input v-model="row.value" size="small" placeholder="Header Value" /></template>
      </el-table-column>
      <el-table-column label="操作" width="64" align="center">
        <template #default="{ $index }">
          <el-popconfirm title="删除该请求头？" @confirm="cfg.headers.splice($index, 1)">
            <template #reference><el-button text size="small" :icon="Delete" /></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <div class="header-actions">
      <el-tooltip content="添加自定义请求头"><el-button size="small" :icon="Plus" @click="cfg.headers.push({ key: '', value: '' })">自定义 Header</el-button></el-tooltip>
      <el-dropdown @command="addCommonHeader" trigger="click">
        <el-button size="small" plain>快捷添加常用 Header</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="h in COMMON_HEADERS" :key="h" :command="h"
              :disabled="cfg.headers.some(x => x.key === h)">{{ h }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- ====== 区块3: 认证配置 ====== -->
    <el-divider content-position="left">认证 (Auth)</el-divider>
    <div class="form-grid">
      <div class="form-row">
        <span class="form-label">认证方式</span>
        <el-select v-model="cfg.auth.type" style="width: 180px">
          <el-option label="无" value="none" />
          <el-option label="Basic Auth" value="basic" />
          <el-option label="Bearer Token" value="bearer" />
          <el-option label="API Key" value="apiKey" />
          <el-option label="自定义签名" value="custom" />
        </el-select>
      </div>

      <!-- Basic Auth -->
      <template v-if="cfg.auth.type === 'basic'">
        <div class="form-row">
          <span class="form-label req">用户名</span>
          <el-input v-model="cfg.auth.username" placeholder="用户名" style="max-width: 300px" />
        </div>
        <div class="form-row">
          <span class="form-label req">密码</span>
          <el-input v-model="cfg.auth.password" placeholder="密码" style="max-width: 300px" show-password />
        </div>
      </template>

      <!-- Bearer Token -->
      <div class="form-row" v-if="cfg.auth.type === 'bearer'">
        <span class="form-label req">Token</span>
        <el-input v-model="cfg.auth.token" placeholder="Bearer Token" style="max-width: 480px" show-password />
      </div>

      <!-- API Key -->
      <template v-if="cfg.auth.type === 'apiKey'">
        <div class="form-row">
          <span class="form-label req">Key 名称</span>
          <el-input v-model="cfg.auth.keyName" placeholder="如 X-Api-Key" style="max-width: 300px" />
        </div>
        <div class="form-row">
          <span class="form-label">传递位置</span>
          <el-select v-model="cfg.auth.keyLocation" style="width: 160px">
            <el-option label="请求头 (Header)" value="header" />
            <el-option label="查询参数 (Query)" value="query" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label req">Key 值</span>
          <el-input v-model="cfg.auth.keyValue" placeholder="API Key 值" style="max-width: 400px" show-password />
        </div>
      </template>

      <!-- 自定义签名 -->
      <div class="form-row" v-if="cfg.auth.type === 'custom'">
        <span class="form-label">签名说明</span>
        <el-input v-model="cfg.auth.token" placeholder="描述签名算法，如 HMAC-SHA256 + timestamp" style="max-width: 480px" />
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Plus, Check } from '@element-plus/icons-vue'
import {
  PROTOCOL_TYPES, HTTP_METHODS, HTTP_CONTENT_TYPES,
  COMMON_HEADERS,
} from '@/stores/protocol'

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

// ---- Header 快捷添加 ----
const addCommonHeader = (name) => {
  if (!cfg.value.headers.some(h => h.key === name)) {
    cfg.value.headers.push({ key: name, value: '' })
  }
}
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

.section-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 12px; line-height: 1.6; padding-left: 4px; border-left: 3px solid var(--el-color-primary-light-5); }

.kv-table { margin-bottom: 8px; }
.header-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
</style>
