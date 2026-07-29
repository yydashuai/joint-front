<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <el-input v-model="iface.name" class="proto-name" placeholder="接口名称" />
        <el-popconfirm title="删除该接口？" @confirm="$emit('delete')">
          <template #reference><el-button :icon="Delete" plain>删除接口</el-button></template>
        </el-popconfirm>
      </div>
    </template>

    <el-scrollbar class="editor-scroll">
      <div class="field-label">备注说明</div>
      <el-input v-model="iface.desc" placeholder="可选，描述该接口的用途" class="proto-desc" />

      <div class="meta-row">
        <span class="meta-row__label req">传输类型</span>
        <el-select v-model="iface.transportType" placeholder="选择传输类型" class="meta-sel" clearable style="width: 160px" @change="onTransportTypeChange">
          <el-option v-for="t in transportTypeOptions" :key="t.value" :label="t.label" :value="t.value">
            <span>{{ t.label }}</span>
            <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px">{{ t.desc }}</span>
          </el-option>
        </el-select>
      </div>

      <div class="meta-row">
        <span class="meta-row__label req">所属系统</span>
        <el-select v-model="iface.systemId" placeholder="选择系统" class="meta-sel" @change="$emit('systemChange')">
          <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <span class="meta-row__label req">模块</span>
        <el-select v-model="iface.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!iface.systemId">
          <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
        </el-select>
      </div>

      <!-- 传输配置（根据传输类型动态渲染） -->
      <TransportConfigForm
        :transport-config="iface.transportConfig"
        :transport-type="iface.transportType"
      />

      <!-- 数据集与执行策略 -->
      <div class="strategy-section">
        <div class="section-head">
          <span class="section-title section-title--strategy">数据集与执行策略</span>
          <div class="section-head__actions">
            <el-button size="small" type="primary" plain :icon="Promotion" @click="jumpToPlan">跳转到计划</el-button>
            <el-button size="small" type="success" plain :icon="VideoPlay" @click="sendTest">发送测试</el-button>
          </div>
        </div>

        <div class="meta-row">
          <span class="meta-row__label">关联数据集</span>
          <el-select
            v-model="iface.datasetIds"
            multiple
            filterable
            collapse-tags
            placeholder="选择该接口对应的测试数据集"
            class="meta-sel-wide"
          >
            <el-option v-for="d in datasetOptions" :key="d.value" :label="d.label" :value="d.value" />
          </el-select>
        </div>

        <div class="meta-row">
          <span class="meta-row__label req">执行策略</span>
          <el-radio-group v-model="iface.strategy.trigger">
            <el-radio value="manual">手动</el-radio>
            <el-radio value="scheduled">定时</el-radio>
            <el-radio value="periodic">周期</el-radio>
          </el-radio-group>
        </div>

        <div v-if="iface.strategy.trigger === 'scheduled'" class="meta-row">
          <span class="meta-row__label req">执行时间</span>
          <el-date-picker
            v-model="iface.strategy.scheduleAt"
            type="datetime"
            placeholder="选择执行时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 220px"
          />
        </div>

        <div v-if="iface.strategy.trigger === 'periodic'" class="meta-row">
          <span class="meta-row__label req">周期间隔</span>
          <el-input-number v-model="iface.strategy.periodicInterval" :min="1" :max="9999" controls-position="right" style="width: 120px" />
          <el-select v-model="iface.strategy.periodicUnit" style="width: 90px">
            <el-option label="秒" value="s" />
            <el-option label="分" value="m" />
            <el-option label="时" value="h" />
            <el-option label="天" value="d" />
          </el-select>
          <span class="meta-row__label">次数</span>
          <el-input-number v-model="iface.strategy.periodicCount" :min="1" :max="9999" controls-position="right" style="width: 120px" placeholder="永久" />
        </div>

        <div class="meta-row">
          <span class="meta-row__label req">发送间隔</span>
          <el-input-number v-model="iface.sendInterval" :min="100" :max="5000" :step="100" controls-position="right" style="width: 150px" />
          <span class="meta-row__hint">毫秒（ms），两帧发送之间的间隔</span>
        </div>
      </div>

      <!-- 发送字段 -->
      <div class="proto-refs-section proto-refs-section--request">
        <div class="section-head">
          <span class="section-title section-title--request">发送字段</span>
          <el-button size="small" type="primary" plain :icon="Plus" @click="openPicker('request')">添加</el-button>
        </div>
        <el-table v-if="requestProtocols.length" :data="requestProtocols" border size="small">
          <el-table-column label="字段" min-width="200">
            <template #default="{ row }">
              <span style="font-weight:500">{{ protocolName(row.protocolId) }}</span>
              <span class="proto-sys-tag" v-if="getProtocolSys(row.protocolId)">{{ getProtocolSys(row.protocolId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="60" align="center">
            <template #default="{ row }">
              <el-button text size="small" :icon="Delete" @click="removeRef(row)" />
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无发送字段" :image-size="40" />
      </div>

      <!-- 接收字段 -->
      <div class="proto-refs-section proto-refs-section--response">
        <div class="section-head">
          <span class="section-title section-title--response">接收字段</span>
          <el-button size="small" type="success" plain :icon="Plus" @click="openPicker('response')">添加</el-button>
        </div>
        <el-table v-if="responseProtocols.length" :data="responseProtocols" border size="small">
          <el-table-column label="字段" min-width="200">
            <template #default="{ row }">
              <span style="font-weight:500">{{ protocolName(row.protocolId) }}</span>
              <span class="proto-sys-tag" v-if="getProtocolSys(row.protocolId)">{{ getProtocolSys(row.protocolId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="60" align="center">
            <template #default="{ row }">
              <el-button text size="small" :icon="Delete" @click="removeRef(row)" />
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无接收字段" :image-size="40" />
      </div>

      <!-- 字段选择弹窗 -->
      <el-dialog v-model="pickerVisible" :title="pickerTitle" width="520px" :append-to-body="true">
        <div class="picker-filter">
          <el-input v-model="pickerSearch" placeholder="搜索字段名称..." clearable size="small" :prefix-icon="Search" style="flex:1" />
          <el-checkbox v-model="showAllProtocols" size="small">显示全部（不限模块）</el-checkbox>
        </div>
        <div class="picker-list">
          <div v-for="p in filteredPickerList" :key="p.value" class="picker-item" @click="onPickProtocol(p.value)">
            <div class="picker-item__info">
              <span class="picker-item__name">{{ p.label }}</span>
              <span class="picker-item__meta">{{ p.fieldCount }} 字段 · {{ p.systemName || '未分配' }}</span>
            </div>
            <el-tag size="small" :type="p.isInline ? 'warning' : 'info'" effect="plain">{{ p.isInline ? '内联' : '通用' }}</el-tag>
          </div>
          <el-empty v-if="!filteredPickerList.length" :description="showAllProtocols ? '无匹配字段' : '当前模块无可引用字段，尝试开启「显示全部」'" :image-size="50" />
        </div>
        <template #footer>
          <el-button @click="pickerVisible = false">关闭</el-button>
        </template>
      </el-dialog>

      <!-- 数据预览（只读，展示引用字段的结构） -->
      <div class="data-preview" v-if="iface.protocolRefs.length">
        <div class="section-head">
          <span class="section-title">数据预览</span>
          <span class="preview-hint">只读 · 点击字段名可跳转编辑</span>
        </div>
        <div v-for="ref in iface.protocolRefs" :key="ref.protocolId" class="preview-block">
          <div class="preview-header" @click="$emit('navigateProtocol', ref.protocolId)">
            <el-tag size="small" :type="roleTagType(ref.role)">{{ roleLabel(ref.role) }}</el-tag>
            <span class="preview-name">{{ protocolName(ref.protocolId) }}</span>
          </div>
          <div class="preview-fields" v-if="getProtocolFields(ref.protocolId).length">
            <div v-for="f in getProtocolFields(ref.protocolId)" :key="f.id" class="preview-field">
              <span class="field-name">{{ f.name }}</span>
              <el-tag size="small" effect="plain" :type="fieldTypeTag(f)">{{ fieldDisplay(f) }}</el-tag>
              <span class="field-desc" v-if="f.desc">{{ f.desc }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </el-card>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Delete, Search, Promotion, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  TRANSPORT_TYPES, PROTOCOL_ROLES,
  makeTransportConfig, useProtocolStore, makeProtocolRef,
} from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useConnectionStore } from '@/stores/connection'
import TransportConfigForm from './TransportConfigForm.vue'

const props = defineProps({
  iface: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
  protocolOptions: { type: Array, default: () => [] },
})
defineEmits(['delete', 'systemChange', 'navigateProtocol'])

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }
const protoStore = useProtocolStore()
const dataStore = useTestDataStore()
const connStore = useConnectionStore()
const router = useRouter()

// 确保接口对象具备新增字段（兼容旧数据）
if (!Array.isArray(props.iface.datasetIds)) props.iface.datasetIds = []
if (!props.iface.strategy) props.iface.strategy = { trigger: 'manual', scheduleAt: null, periodicInterval: 60, periodicUnit: 's', periodicCount: null }
if (!props.iface.sendInterval) props.iface.sendInterval = 500

// 关联数据集下拉（按系统 + 模块过滤）
const datasetOptions = computed(() => {
  const sysId = props.iface.systemId
  const modName = connStore.nodes.find((n) => n.id === props.iface.moduleId)?.name || ''
  let list = dataStore.datasets
  if (sysId) list = list.filter((d) => d.systemId === sysId)
  if (modName) list = list.filter((d) => d.moduleName === modName)
  return list.map((d) => ({ value: d.id, label: `${d.name}（${d.rows?.length || 0} 行）` }))
})

// 跳转到计划 / 发送测试
const jumpToPlan = () => {
  router.push({ path: '/execution', query: { interfaceId: String(props.iface.id) } })
  ElMessage.success('已跳转到编排计划，可快速配置与发送')
}
const sendTest = () => {
  router.push({ path: '/execution', query: { interfaceId: String(props.iface.id), test: '1' } })
}

// Split protocol refs by role
const requestProtocols = computed(() =>
  props.iface.protocolRefs.filter(r => r.role === 'request')
)
const responseProtocols = computed(() =>
  props.iface.protocolRefs.filter(r => r.role === 'response')
)

// 传输类型下拉选项（兼容旧类型 TCP/HTTP/gRPC 数据，避免下拉空白）
const transportTypeOptions = computed(() => {
  const opts = TRANSPORT_TYPES.map(t => ({ ...t }))
  const cur = props.iface.transportType
  if (cur && !opts.some(o => o.value === cur)) {
    opts.push({ value: cur, label: cur, desc: '（旧类型，已不再支持）' })
  }
  return opts
})

// Protocol name lookup
const protocolName = (id) => protoStore.protocols.find(p => p.id === id)?.name || '未知协议'

// Protocol system name (for display in table)
const getProtocolSys = (id) => {
  const p = protoStore.protocols.find(x => x.id === id)
  if (!p || !p.systemId) return ''
  const sys = props.systemOptions.find(s => s.value === p.systemId)
  return sys?.label || ''
}

// Protocol fields for preview
const getProtocolFields = (id) => {
  const p = protoStore.protocols.find(x => x.id === id)
  return p?.fields || []
}

// Remove a protocol ref
const removeRef = (row) => {
  ElMessageBox.confirm('确认移除该协议引用？', '移除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    const idx = props.iface.protocolRefs.indexOf(row)
    if (idx !== -1) props.iface.protocolRefs.splice(idx, 1)
  }).catch(() => {})
}

// ── 协议选择弹窗 ──
const pickerVisible = ref(false)
const pickerSearch = ref('')
const showAllProtocols = ref(false)
const pickerRole = ref('request')

const pickerTitle = computed(() =>
  pickerRole.value === 'request' ? '添加发送字段' : '添加接收字段'
)

const openPicker = (role) => {
  pickerRole.value = role
  pickerSearch.value = ''
  pickerVisible.value = true
}

// Build enriched protocol list with metadata
const enrichedProtocols = computed(() => {
  const usedIds = new Set(props.iface.protocolRefs.map(r => r.protocolId))
  return protoStore.protocols
    .filter(p => !usedIds.has(p.id))
    .map(p => {
      const sysOpt = props.systemOptions.find(s => s.value === p.systemId)
      return {
        value: p.id,
        label: p.name,
        fieldCount: (p.fields || []).length,
        systemId: p.systemId,
        moduleId: p.moduleId,
        systemName: sysOpt?.label || '',
        isInline: !!p.__inline,
      }
    })
})

// Filtered list for picker dialog
const filteredPickerList = computed(() => {
  let list = enrichedProtocols.value
  // 按当前系统/模块过滤（除非开启"全部字段"）
  if (!showAllProtocols.value) {
    const sysId = props.iface.systemId
    const modId = props.iface.moduleId
    if (sysId && modId) {
      list = list.filter(p => p.systemId === sysId && p.moduleId === modId)
    } else if (sysId) {
      list = list.filter(p => p.systemId === sysId)
    }
  }
  // 搜索过滤
  const kw = pickerSearch.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(p => p.label.toLowerCase().includes(kw))
  }
  return list
})

const onPickProtocol = (protocolId) => {
  props.iface.protocolRefs.push(makeProtocolRef(protocolId, pickerRole.value))
  pickerVisible.value = false
  pickerSearch.value = ''
}

// Role display helpers
const roleLabel = (role) => {
  const r = PROTOCOL_ROLES.find(x => x.value === role)
  return r ? r.label : role
}

const roleTagType = (role) => {
  const map = { request: 'warning', response: 'success' }
  return map[role] || 'info'
}

// Field display helpers for preview
const fieldDisplay = (f) => {
  if (f.type === 'scalar') return f.encoding || 'uint8'
  if (f.type === 'bitstream') return '位组序流'
  if (f.type === 'struct') return `共识体 (${(f.children || []).length} 字段)`
  if (f.type === 'matrix') return '结构矩阵'
  if (f.type === 'file') return '流文件'
  // Handle byte fields (from byte-stream protocols)
  if (f.kind === 'byte') return f.dataType || 'uint8'
  if (f.kind === 'bit') return `bit[${f.bitStart}:${f.bitEnd}]`
  if (f.kind === 'repeat') return `重复组 ×${f.repeatCount || '?'}`
  return f.type || f.dataType || '—'
}

const fieldTypeTag = (f) => {
  const t = f.type || f.kind
  const map = { scalar: 'primary', bitstream: 'warning', struct: 'success', matrix: 'danger', file: 'info', byte: 'primary', bit: 'warning', repeat: 'info' }
  return map[t] || 'info'
}

// Transport type change
const onTransportTypeChange = (type) => {
  if (type) {
    props.iface.transportConfig = makeTransportConfig(type)
  } else {
    props.iface.transportConfig = {}
  }
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }
.meta-sel-wide { width: 100%; }
.meta-row__hint { font-size: 12px; color: var(--el-text-color-secondary); margin-left: 4px; }

.strategy-section {
  margin: 4px 0 14px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}
.strategy-section .section-title--strategy { border-left-color: var(--el-color-primary); }
.section-head__actions { display: flex; gap: 8px; }

.editor-scroll { flex: 1; min-height: 0; }

.proto-refs-section { margin-bottom: 12px; }
.proto-refs-section--request {
  .section-title { border-left-color: #E6A23C; }
}
.proto-refs-section--response {
  .section-title { border-left-color: #67C23A; }
}
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.section-title { font-size: 14px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary); }
.section-title--request { border-left-color: #E6A23C; }
.section-title--response { border-left-color: #67C23A; }

.proto-sys-tag {
  display: inline-block; font-size: 11px; color: var(--el-text-color-secondary);
  background: var(--el-fill-color); padding: 1px 6px; border-radius: 3px; margin-left: 6px;
}

// 字段选择弹窗
.picker-filter { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.picker-list { max-height: 360px; overflow-y: auto; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; }
.picker-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--el-border-color-extra-light);
  transition: background 0.15s;
  &:hover { background: var(--el-color-primary-light-9); }
  &:last-child { border-bottom: none; }
}
.picker-item__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.picker-item__name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker-item__meta { font-size: 11px; color: var(--el-text-color-secondary); }

.data-preview { margin-bottom: 8px; }
.preview-hint { font-size: 12px; color: var(--el-text-color-placeholder); }
.preview-block {
  margin-top: 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; overflow: hidden;
}
.preview-header {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: var(--el-fill-color-lighter); cursor: pointer;
  &:hover { background: var(--el-fill-color); }
}
.preview-name { font-size: 13px; font-weight: 500; }
.preview-fields { padding: 6px 12px; }
.preview-field {
  display: flex; align-items: center; gap: 8px; padding: 3px 0;
  font-size: 12px;
}
.field-name { font-family: ui-monospace, monospace; color: var(--el-text-color-primary); min-width: 100px; }
.field-desc { color: var(--el-text-color-secondary); font-size: 11px; }
</style>
