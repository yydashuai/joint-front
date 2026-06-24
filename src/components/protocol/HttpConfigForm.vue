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

    <el-divider content-position="left">HTTP 配置</el-divider>

    <div class="form-grid">
      <div class="form-row">
        <span class="form-label req">请求方法</span>
        <el-select v-model="cfg.method" style="width: 140px">
          <el-option v-for="m in methods" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="form-label req">路径</span>
        <el-input v-model="cfg.path" placeholder="/api/v1/resource" style="max-width: 400px" />
      </div>
      <div class="form-row">
        <span class="form-label">Content-Type</span>
        <el-select v-model="cfg.contentType" style="width: 240px">
          <el-option v-for="ct in contentTypes" :key="ct" :label="ct" :value="ct" />
        </el-select>
      </div>
    </div>

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
          <el-button text size="small" :icon="Delete" @click="cfg.headers.splice($index, 1)" />
        </template>
      </el-table-column>
    </el-table>
    <el-button size="small" :icon="Plus" @click="cfg.headers.push({ key: '', value: '' })">添加 Header</el-button>

    <el-divider content-position="left">认证 (Auth)</el-divider>
    <div class="form-grid">
      <div class="form-row">
        <span class="form-label">认证方式</span>
        <el-select v-model="cfg.auth.type" style="width: 160px">
          <el-option label="无" value="none" />
          <el-option label="Basic" value="basic" />
          <el-option label="Bearer Token" value="bearer" />
          <el-option label="API Key" value="apiKey" />
        </el-select>
      </div>
      <div class="form-row" v-if="cfg.auth.type !== 'none'">
        <span class="form-label">Token / Key</span>
        <el-input v-model="cfg.auth.token" placeholder="认证令牌" style="max-width: 400px" show-password />
      </div>
    </div>
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
const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
const contentTypes = ['application/json', 'application/xml', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']
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

.kv-table { margin-bottom: 8px; }
</style>
