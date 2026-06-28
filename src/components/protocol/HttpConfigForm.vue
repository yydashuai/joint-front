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

    <!-- ====== 区块1: 基础配置 ====== -->
    <el-divider content-position="left">HTTP 基础配置</el-divider>
    <div class="form-grid">
      <div class="form-row">
        <span class="form-label req">请求方法</span>
        <el-select v-model="cfg.method" style="width: 140px">
          <el-option v-for="m in HTTP_METHODS" :key="m" :label="m" :value="m" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="form-label req">请求路径</span>
        <el-input v-model="cfg.path" placeholder="/api/v1/users/{userId}/orders" style="max-width: 480px" />
      </div>
      <div class="form-row" v-if="extractedPathParams.length">
        <span class="form-label">路径参数</span>
        <el-tag v-for="p in extractedPathParams" :key="p" size="small" type="warning" class="path-tag">{{ '{' + p + '}' }}</el-tag>
      </div>
      <div class="form-row">
        <span class="form-label">Content-Type</span>
        <el-select v-model="cfg.contentType" style="width: 280px" filterable allow-create>
          <el-option v-for="ct in HTTP_CONTENT_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-select>
      </div>
    </div>

    <!-- ====== 区块2: 请求参数 ====== -->
    <el-divider content-position="left">请求参数</el-divider>
    <el-tabs v-model="paramTab" class="param-tabs">
      <!-- Tab 1: 路径参数 -->
      <el-tab-pane :label="`路径参数 (${cfg.pathParams.length})`" name="path">
        <el-table :data="cfg.pathParams" border size="small" class="kv-table" v-if="cfg.pathParams.length">
          <el-table-column label="参数名" width="160">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" disabled />
            </template>
          </el-table-column>
          <el-table-column label="数据类型" width="130">
            <template #default="{ row }">
              <el-select v-model="row.dataType" size="small" style="width: 110px">
                <el-option label="string" value="string" />
                <el-option label="integer" value="integer" />
                <el-option label="number" value="number" />
                <el-option label="boolean" value="boolean" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="默认值" min-width="140">
            <template #default="{ row }">
              <el-input v-model="row.defaultValue" size="small" placeholder="可选默认值" />
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.desc" size="small" placeholder="参数说明" />
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="在路径中使用 {paramName} 格式自动提取参数" :image-size="48" />
      </el-tab-pane>

      <!-- Tab 2: 查询参数 -->
      <el-tab-pane :label="`查询参数 (${cfg.queryParams.length})`" name="query">
        <el-table :data="cfg.queryParams" border size="small" class="kv-table">
          <el-table-column label="参数名" width="160">
            <template #default="{ row }">
              <el-input v-model="row.name" size="small" placeholder="参数名" />
            </template>
          </el-table-column>
          <el-table-column label="数据类型" width="130">
            <template #default="{ row }">
              <el-select v-model="row.dataType" size="small" style="width: 110px">
                <el-option label="string" value="string" />
                <el-option label="integer" value="integer" />
                <el-option label="number" value="number" />
                <el-option label="boolean" value="boolean" />
                <el-option label="array" value="array" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="必填" width="64" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.required" />
            </template>
          </el-table-column>
          <el-table-column label="默认值" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.defaultValue" size="small" placeholder="默认值" />
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.desc" size="small" placeholder="参数说明" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="64" align="center">
            <template #default="{ $index }">
              <el-popconfirm title="删除该查询参数？" @confirm="cfg.queryParams.splice($index, 1)">
                <template #reference><el-button text size="small" :icon="Delete" /></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
        <el-tooltip content="添加一个查询参数"><el-button size="small" :icon="Plus" @click="cfg.queryParams.push(makeHttpParam())">添加查询参数</el-button></el-tooltip>
      </el-tab-pane>

      <!-- Tab 3: 请求体 -->
      <el-tab-pane label="请求体" name="body">
        <div class="body-mode-row">
          <span class="form-label">内容格式</span>
          <el-radio-group v-model="bodyMode" size="small">
            <el-radio-button value="json">JSON 字段</el-radio-button>
            <el-radio-button value="form">Form 表单</el-radio-button>
            <el-radio-button value="file">文件上传</el-radio-button>
          </el-radio-group>
        </div>

        <!-- JSON / Form 模式 -->
        <template v-if="bodyMode !== 'file'">
          <el-table :data="cfg.requestBody.fields" border size="small" class="kv-table" row-key="id" :tree-props="{ children: 'children' }">
            <el-table-column label="字段名" min-width="160" prop="name">
              <template #default="{ row }">
                <el-input v-model="row.name" size="small" placeholder="字段名" />
              </template>
            </el-table-column>
            <el-table-column label="数据类型" width="130">
              <template #default="{ row }">
                <el-select v-model="row.dataType" size="small" style="width: 110px">
                  <el-option label="string" value="string" />
                  <el-option label="integer" value="integer" />
                  <el-option label="number" value="number" />
                  <el-option label="boolean" value="boolean" />
                  <el-option label="object" value="object" />
                  <el-option label="array" value="array" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="必填" width="64" align="center">
              <template #default="{ row }">
                <el-checkbox v-model="row.required" />
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="180">
              <template #default="{ row }">
                <el-input v-model="row.desc" size="small" placeholder="字段说明" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row, $index }">
                <el-tooltip content="添加子字段"><el-button v-if="row.dataType === 'object'" text size="small" :icon="Plus" @click="row.children.push(makeBodyField({ name: 'subField' }))" /></el-tooltip>
                <el-popconfirm title="删除该字段？" @confirm="removeBodyField($index)">
                  <template #reference><el-button text size="small" :icon="Delete" /></template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
          <el-tooltip content="添加一个请求体字段"><el-button size="small" :icon="Plus" @click="cfg.requestBody.fields.push(makeBodyField())">添加字段</el-button></el-tooltip>
        </template>

        <!-- 文件上传模式 -->
        <template v-else>
          <div class="form-grid" style="margin-top: 8px">
            <div class="form-row">
              <span class="form-label">文件字段名</span>
              <el-input v-model="cfg.requestBody.fieldName" placeholder="如 file / attachment" style="max-width: 300px" />
            </div>
            <div class="form-row">
              <span class="form-label">文件类型</span>
              <el-input v-model="cfg.requestBody.fileType" placeholder="如 image/png, application/pdf" style="max-width: 300px" />
            </div>
          </div>
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- ====== 区块3: 请求头 ====== -->
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

    <!-- ====== 区块4: 认证配置 ====== -->
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

    <!-- ====== 区块5: 响应配置 ====== -->
    <el-divider content-position="left">响应配置</el-divider>
    <el-collapse v-model="activeResponses" class="resp-collapse">
      <el-collapse-item v-for="(resp, ri) in cfg.responses" :key="resp.id" :name="resp.id">
        <template #title>
          <div class="resp-title">
            <el-tag :type="statusColor(resp.statusCode)" size="small">{{ resp.statusCode }}</el-tag>
            <span class="resp-desc">{{ resp.desc || '未描述' }}</span>
          </div>
        </template>
        <div class="form-grid">
          <div class="form-row">
            <span class="form-label">状态码</span>
            <el-input-number v-model="resp.statusCode" :min="100" :max="599" size="small" style="width: 140px" />
          </div>
          <div class="form-row">
            <span class="form-label">描述</span>
            <el-input v-model="resp.desc" placeholder="响应描述" size="small" style="max-width: 400px" />
          </div>
        </div>

        <div class="sub-section">
          <div class="sub-section__head">响应头</div>
          <el-table :data="resp.headers" border size="small" class="kv-table" v-if="resp.headers.length">
            <el-table-column label="Key" min-width="160">
              <template #default="{ row }"><el-input v-model="row.key" size="small" placeholder="Header Name" /></template>
            </el-table-column>
            <el-table-column label="Value" min-width="200">
              <template #default="{ row }"><el-input v-model="row.value" size="small" placeholder="示例值" /></template>
            </el-table-column>
            <el-table-column label="操作" width="64" align="center">
              <template #default="{ $index }">
                <el-popconfirm title="删除该响应头？" @confirm="resp.headers.splice($index, 1)">
                  <template #reference><el-button text size="small" :icon="Delete" /></template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
          <el-tooltip content="添加一个响应头"><el-button size="small" :icon="Plus" text @click="resp.headers.push({ key: '', value: '' })">添加响应头</el-button></el-tooltip>
        </div>

        <div class="sub-section">
          <div class="sub-section__head">响应体字段</div>
          <el-table :data="resp.bodyFields" border size="small" class="kv-table" row-key="id" :tree-props="{ children: 'children' }" v-if="resp.bodyFields.length">
            <el-table-column label="字段名" min-width="160">
              <template #default="{ row }"><el-input v-model="row.name" size="small" placeholder="字段名" /></template>
            </el-table-column>
            <el-table-column label="数据类型" width="130">
              <template #default="{ row }">
                <el-select v-model="row.dataType" size="small" style="width: 110px">
                  <el-option label="string" value="string" />
                  <el-option label="integer" value="integer" />
                  <el-option label="number" value="number" />
                  <el-option label="boolean" value="boolean" />
                  <el-option label="object" value="object" />
                  <el-option label="array" value="array" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="180">
              <template #default="{ row }"><el-input v-model="row.desc" size="small" placeholder="字段说明" /></template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row, $index }">
                <el-tooltip content="添加子字段"><el-button v-if="row.dataType === 'object'" text size="small" :icon="Plus" @click="row.children.push(makeBodyField({ name: 'subField' }))" /></el-tooltip>
                <el-popconfirm title="删除该字段？" @confirm="resp.bodyFields.splice($index, 1)">
                  <template #reference><el-button text size="small" :icon="Delete" /></template>
                </el-popconfirm>
              </template>
            </el-table-column>
          </el-table>
          <el-tooltip content="添加一个响应体字段"><el-button size="small" :icon="Plus" text @click="resp.bodyFields.push(makeBodyField())">添加字段</el-button></el-tooltip>
        </div>

        <div class="resp-actions">
          <el-popconfirm title="删除该响应？" @confirm="cfg.responses.splice(ri, 1)">
            <template #reference>
              <el-button size="small" :icon="Delete" text type="danger">删除此响应</el-button>
            </template>
          </el-popconfirm>
        </div>
      </el-collapse-item>
    </el-collapse>
    <el-tooltip content="添加一个响应状态码"><el-button size="small" :icon="Plus" @click="addResponse">添加响应状态码</el-button></el-tooltip>
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Plus, Check } from '@element-plus/icons-vue'
import {
  PROTOCOL_TYPES, HTTP_METHODS, HTTP_CONTENT_TYPES,
  COMMON_HEADERS, makeHttpParam, makeBodyField, makeHttpResponse,
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

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
const cfg = computed(() => props.protocol.config)

// ---- Tab & Collapse state ----
const paramTab = ref('path')
const bodyMode = ref('json')
const activeResponses = ref([])

// ---- 路径参数自动提取 ----
const extractedPathParams = computed(() => {
  const matches = (cfg.value.path || '').match(/\{(\w+)\}/g)
  return matches ? matches.map(m => m.slice(1, -1)) : []
})

// 路径变化时同步 pathParams 数组
watch(extractedPathParams, (params) => {
  const current = cfg.value.pathParams
  // 保留已有参数的 desc / dataType / defaultValue，新增缺少的，删除多余的
  const existing = new Map(current.map(p => [p.name, p]))
  const next = params.map(name => {
    if (existing.has(name)) return existing.get(name)
    return makeHttpParam({ name })
  })
  cfg.value.pathParams.splice(0, cfg.value.pathParams.length, ...next)
})

// ---- Body 字段操作 ----
const removeBodyField = (index) => {
  cfg.value.requestBody.fields.splice(index, 1)
}

// ---- Header 快捷添加 ----
const addCommonHeader = (name) => {
  if (!cfg.value.headers.some(h => h.key === name)) {
    cfg.value.headers.push({ key: name, value: '' })
  }
}

// ---- 响应管理 ----
const statusColor = (code) => {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'warning'
  if (code >= 400) return 'danger'
  return 'info'
}

const addResponse = () => {
  const r = makeHttpResponse({ statusCode: 400, desc: '' })
  cfg.value.responses.push(r)
  activeResponses.value.push(r.id)
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

.path-tag { margin-right: 6px; }

.param-tabs { margin-bottom: 4px; }
.body-mode-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }

.kv-table { margin-bottom: 8px; }
.header-actions { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }

/* 响应配置 */
.resp-collapse { margin-bottom: 8px; }
.resp-title { display: flex; align-items: center; gap: 8px; }
.resp-desc { font-size: 13px; color: var(--el-text-color-regular); }
.sub-section { margin-top: 12px; padding-left: 4px; }
.sub-section__head { font-size: 13px; font-weight: 500; color: var(--el-text-color-secondary); margin-bottom: 6px; }
.resp-actions { margin-top: 8px; text-align: right; }
</style>
