<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>接口协议管理</h2>
        <div class="page__desc">系统 → 模块 → 协议 / 接口</div>
      </div>
    </div>

    <div class="split">
      <SystemModuleTree
        class="proto-tree"
        :model-value="currentKey"
        title="系统 · 模块 · 协议"
        :leaf-groups="protocolLeafGroups"
        :leaf-context-actions="leafContextActions"
        show-edit-jump
        empty-text="暂无系统/模块，请先在链路连接管理添加"
        @select="onTreeSelect"
        @add-leaf="onTreeAddLeaf"
        @delete-leaf="onTreeDeleteLeaf"
        @leaf-action="onLeafAction"
      />

      <div class="proto-detail">
        <!-- v2 协议摘要: 传输/编码/消息数 -->
        <div v-if="selectedKind === 'protocol' && curProto && protoSummary.transport" class="proto-summary">
          <span class="proto-summary__chip">
            <el-icon><Promotion /></el-icon>
            <b>{{ protoSummary.transport.host || '—' }}</b>
            <em v-if="protoSummary.transport.port">:{{ protoSummary.transport.port }}</em>
          </span>
          <span class="proto-summary__chip" :class="`is-${protoSummary.encoding}`">
            <el-icon><Coin /></el-icon>
            {{ protoSummary.encoding }}
          </span>
          <span v-if="protoSummary.transport.tls" class="proto-summary__chip is-secure">
            <el-icon><Lock /></el-icon>
            TLS
          </span>
          <span class="proto-summary__msg">
            <el-icon><List /></el-icon>
            {{ protoSummary.messageCount }} 个消息
          </span>
        </div>

        <!-- v2 消息集合: 替代 v1 「切到 Interface 才能看」的模式 -->
        <details v-if="selectedKind === 'protocol' && curProto && protoMessages.length" class="proto-messages" open>
          <summary>
            <el-icon><Tickets /></el-icon>
            <span>消息集合</span>
            <el-tag size="small" effect="plain">{{ protoMessages.length }}</el-tag>
            <span class="proto-messages__hint">v2 概念: 协议下的操作/命令/事件</span>
          </summary>
          <div class="proto-messages__list">
            <div v-for="m in protoMessages" :key="m.id" class="proto-msg" :class="`proto-msg--${m.direction}`">
              <el-tag :type="msgTagType(m.direction)" size="small" effect="dark">{{ msgDirLabel(m.direction) }}</el-tag>
              <span class="proto-msg__name">{{ m.name }}</span>
              <span v-if="m.code !== null && m.code !== undefined" class="proto-msg__code">code={{ m.code }}</span>
              <span v-if="m.http" class="proto-msg__http">{{ m.http.method }} <code>{{ m.http.path }}</code></span>
              <span v-if="m.grpc" class="proto-msg__grpc">{{ m.grpc.serviceName }}.{{ m.grpc.methodName }} <em>({{ m.grpc.streaming }})</em></span>
              <span v-if="m.mqtt" class="proto-msg__mqtt">topic <code>{{ m.mqtt.topic }}</code></span>
              <span class="proto-msg__fields">字段 {{ m.fields?.length || 0 }}</span>
            </div>
          </div>
        </details>

        <ByteFieldTree
          ref="byteTreeRef"
          v-if="selectedKind === 'protocol' && curProto && isByteStream(curProto.type)"
          :protocol="curProto"
          :system-options="systemOptions"
          :module-options="moduleOptions(curProto.systemId)"
          @import="triggerImport"
          @export="exportProto"
          @save="onSave"
          @delete="store.removeProtocol(curProto.id)"
          @system-change="onProtoSystemChange"
          @switch-type="onTypeDropdown"
        />

        <HttpConfigForm
          ref="httpFormRef"
          v-else-if="selectedKind === 'protocol' && curProto && curProto.type === 'HTTP'"
          :protocol="curProto"
          :system-options="systemOptions"
          :module-options="moduleOptions(curProto.systemId)"
          @save="onSave"
          @delete="store.removeProtocol(curProto.id)"
          @system-change="onProtoSystemChange"
          @switch-type="onTypeDropdown"
        />

        <GrpcConfigForm
          ref="grpcFormRef"
          v-else-if="selectedKind === 'protocol' && curProto && curProto.type === 'gRPC'"
          :protocol="curProto"
          :system-options="systemOptions"
          :module-options="moduleOptions(curProto.systemId)"
          @save="onSave"
          @delete="store.removeProtocol(curProto.id)"
          @system-change="onProtoSystemChange"
          @switch-type="onTypeDropdown"
        />

        <MqConfigForm
          ref="mqFormRef"
          v-else-if="selectedKind === 'protocol' && curProto && curProto.type === 'MQ'"
          :protocol="curProto"
          :system-options="systemOptions"
          :module-options="moduleOptions(curProto.systemId)"
          @save="onSave"
          @delete="store.removeProtocol(curProto.id)"
          @system-change="onProtoSystemChange"
          @switch-type="onTypeDropdown"
        />

        <InterfaceEditor
          v-if="selectedKind === 'interface' && curIf"
          :iface="curIf"
          :system-options="systemOptions"
          :module-options="moduleOptions(curIf.systemId)"
          :protocol-options="store.protocolOptions"
          @delete="store.removeInterface(curIf.id)"
          @system-change="onIfSystemChange"
        />

        <el-empty v-if="!curProto && !curIf" class="main main--empty" description="从左侧选择一个协议或接口进行编辑" />
      </div>
    </div>

    <ProtocolTypeDialog v-model="typeDialogVisible" @select="onTypeSelected" />
    <input ref="fileInput" type="file" accept="application/json" hidden @change="onImportFile" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Promotion, Coin, Lock, List, Tickets, InfoFilled } from '@element-plus/icons-vue'
import { useProtocolStore, isByteStream } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ProtocolTypeDialog from '@/components/protocol/ProtocolTypeDialog.vue'
import ByteFieldTree from '@/components/protocol/ByteFieldTree.vue'
import HttpConfigForm from '@/components/protocol/HttpConfigForm.vue'
import GrpcConfigForm from '@/components/protocol/GrpcConfigForm.vue'
import MqConfigForm from '@/components/protocol/MqConfigForm.vue'
import InterfaceEditor from '@/components/protocol/InterfaceEditor.vue'

const store = useProtocolStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const router = useRouter()
const route = useRoute()

// 进入协议页时, 自动跑一次 v1→v2 数据迁移(幂等)
// 未来 v2 概念完全接管后, 可删除此调用
onMounted(() => store.migrateAllFromV1())

const selectedKind = ref('protocol')
if (!store.selectedProtocolId) store.selectedProtocolId = store.protocols[0]?.id ?? null
if (!store.selectedInterfaceId) store.selectedInterfaceId = store.interfaces[0]?.id ?? null

const curProto = computed(() => store.selectedProtocol)
const curIf = computed(() => store.selectedInterface)

// v2: 摘要 + 消息集合 (带防御默认值, 避免访问 undefined.transport)
const EMPTY_SUMMARY = { transport: { host: '', port: '', tls: false }, encoding: 'unknown', messageCount: 0 }
const protoSummary = computed(() => {
  if (!curProto.value) return EMPTY_SUMMARY
  return store.protocolSummary(curProto.value.id) || EMPTY_SUMMARY
})
const protoMessages = computed(() => {
  if (!curProto.value) return []
  return store.protocolMessages(curProto.value.id) || []
})

const msgDirLabel = (d) => ({ request: '请求', response: '响应', event: '事件', cmd: '命令' }[d] || d)
const msgTagType = (d) => ({ request: 'primary', response: 'success', event: 'warning', cmd: 'info' }[d] || 'info')

const systemOptions = computed(() => systemStore.systems.map((s) => ({ label: s.name, value: s.id })))
const moduleOptions = (systemId) => connStore.nodes.filter((n) => n.systemId === systemId).map((m) => ({ label: m.name, value: m.id }))
const onProtoSystemChange = () => { if (curProto.value) curProto.value.moduleId = null }
const onIfSystemChange = () => { if (curIf.value) curIf.value.moduleId = null }

const protocolLeafGroups = (module) => {
  const protos = store.protocols.filter((p) => p.moduleId === module.id)
  const ifaces = store.interfaces.filter((i) => i.moduleId === module.id)
  return [
    {
      key: `pg-${module.id}`,
      kind: 'protoGroup',
      icon: 'Files',
      label: '协议',
      count: protos.length,
      addLabel: '+协议',
      addType: 'primary',
      items: protos.map((p) => ({ key: `p-${p.id}`, kind: 'protocol', icon: 'Document', label: p.name, ref: p, module }))
    },
    {
      key: `ig-${module.id}`,
      kind: 'ifGroup',
      icon: 'Operation',
      label: '接口',
      count: ifaces.length,
      addLabel: '+接口',
      addType: 'success',
      items: ifaces.map((i) => ({ key: `i-${i.id}`, kind: 'interface', icon: 'Link', label: i.name, ref: i, module }))
    }
  ]
}

const currentKey = computed(() => {
  if (selectedKind.value === 'protocol' && store.selectedProtocolId) return `p-${store.selectedProtocolId}`
  if (selectedKind.value === 'interface' && store.selectedInterfaceId) return `i-${store.selectedInterfaceId}`
  return ''
})

const onTreeSelect = (data) => {
  if (data.kind === 'protocol') {
    selectedKind.value = 'protocol'
    store.selectedProtocolId = data.ref.id
  } else if (data.kind === 'interface') {
    selectedKind.value = 'interface'
    store.selectedInterfaceId = data.ref.id
  }
}

const DEFAULT_NAME = { protocol: '新建协议', interface: '新建接口' }
const typeDialogVisible = ref(false)
const pendingModule = ref(null)

const openTypeDialog = (module) => {
  pendingModule.value = module
  typeDialogVisible.value = true
}

const onTypeSelected = (type) => {
  const mod = pendingModule.value
  if (!mod) return
  store.addProtocol({ name: DEFAULT_NAME.protocol, type, systemId: mod.systemId, moduleId: mod.id })
  selectedKind.value = 'protocol'
}

const addProtocolLeaf = (module) => openTypeDialog(module)
const addInterfaceLeaf = (module) => {
  store.addInterface({ name: DEFAULT_NAME.interface, systemId: module.systemId, moduleId: module.id })
  selectedKind.value = 'interface'
}

const onTreeAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'protoGroup') addProtocolLeaf(module)
  if (groupKind === 'ifGroup') addInterfaceLeaf(module)
}

const onTreeDeleteLeaf = (node) => {
  if (node.kind === 'protocol') store.removeProtocol(node.ref.id)
  if (node.kind === 'interface') store.removeInterface(node.ref.id)
}

/* ---- 接口右键菜单：跳转到规则管理 ---- */
const leafContextActions = (nodeData) => {
  if (nodeData?.kind !== 'interface') return []
  return [{ label: '生成校验规则', action: 'generateRules' }]
}
const onLeafAction = ({ action, data }) => {
  if (action === 'generateRules' && data?.ref) {
    router.push({ path: '/rule', query: { interfaceId: String(data.ref.id), action: 'generate' } })
  }
}

// 从规则页跳转过来时，自动选中对应接口
watch(() => route.query.interfaceId, (ifaceId) => {
  if (!ifaceId) return
  const iface = store.interfaces.find((i) => String(i.id) === String(ifaceId))
  if (iface) {
    selectedKind.value = 'interface'
    store.selectedInterfaceId = iface.id
  }
}, { immediate: true })

const onTypeDropdown = (newType) => {
  if (!curProto.value || newType === curProto.value.type) return
  ElMessageBox.confirm(
    `从「${curProto.value.type}」切换到「${newType}」将清空当前配置，是否继续？`,
    '切换协议类型',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    store.switchProtocolType(curProto.value, newType)
    ElMessage.success(`已切换到 ${newType}`)
  }).catch(() => {})
}

const byteTreeRef = ref()
const httpFormRef = ref()
const grpcFormRef = ref()
const mqFormRef = ref()

const onSave = () => {
  byteTreeRef.value?.fillAllGaps?.()
  nextTick(() => {
    byteTreeRef.value?.markClean?.()
    httpFormRef.value?.markClean?.()
    grpcFormRef.value?.markClean?.()
    mqFormRef.value?.markClean?.()
    ElMessage.success('协议已保存')
  })
}

const exportProto = () => {
  if (!curProto.value) return
  byteTreeRef.value?.fillAllGaps?.()
  const blob = new Blob([JSON.stringify(curProto.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${curProto.value.name || 'protocol'}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出协议模板 JSON')
}

const fileInput = ref()
const triggerImport = () => fileInput.value?.click()
const onImportFile = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result)
      store.addProtocol({
        name: (obj.name || '导入协议') + '(导入)',
        type: obj.type || 'TCP',
        desc: obj.desc || '',
        systemId: curProto.value?.systemId ?? null,
        moduleId: curProto.value?.moduleId ?? null,
        config: obj.config || { endian: 'big', fields: [] }
      })
      selectedKind.value = 'protocol'
      ElMessage.success('协议模板已导入')
    } catch {
      ElMessage.error('文件解析失败，请确认为协议 JSON')
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<style scoped lang="scss">
.proto { height: 100%; }
.split { flex: 1; min-height: 0; display: flex; gap: 16px; }
.proto-tree { width: 300px; flex-shrink: 0; }
.main--empty {
  flex: 1;
  min-width: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

/* ============ v2 协议摘要条 ============ */
.proto-detail { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; flex: 1; }
.proto-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 14px;
  background: linear-gradient(90deg, var(--el-color-primary-light-9), var(--el-fill-color-light));
  border: 1px solid var(--el-color-primary-light-6);
  border-radius: 6px;
  font-size: 12px;

  &__chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    border-radius: 10px;
    background: var(--el-bg-color);
    color: var(--el-text-color-secondary);
    b { color: var(--el-text-color-primary); font-family: ui-monospace, monospace; }
    em { font-style: normal; color: var(--el-text-color-placeholder); }
    .el-icon { font-size: 12px; }

    &.is-binary { color: #b45309; background: #fef3c7; }
    &.is-json   { color: #1e40af; background: #dbeafe; }
    &.is-protobuf { color: #6d28d9; background: #ede9fe; }
    &.is-secure { color: #166534; background: #dcfce7; }
  }
  &__msg {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    font-size: 12px;
    color: var(--el-color-primary);
    font-weight: 500;
    .el-icon { font-size: 12px; }
  }
}

/* ============ v2 消息集合 ============ */
.proto-messages {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;

  > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
    user-select: none;
    &::-webkit-details-marker { display: none; }
    .el-icon { color: var(--el-color-primary); }
  }
  &__hint {
    font-size: 11px;
    font-weight: 400;
    color: var(--el-text-color-placeholder);
    margin-left: 4px;
  }
  &__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 14px 12px;
  }
}
.proto-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  font-size: 12px;
  border-left: 3px solid var(--el-color-info);

  &--request  { border-left-color: var(--el-color-primary); }
  &--response { border-left-color: var(--el-color-success); }
  &--event    { border-left-color: var(--el-color-warning); }
  &--cmd      { border-left-color: var(--el-color-info); }

  &__name { font-weight: 600; color: var(--el-text-color-primary); }
  &__code { font-family: ui-monospace, monospace; color: var(--el-color-warning); }
  &__http, &__grpc, &__mqtt {
    code { font-family: ui-monospace, monospace; color: var(--el-color-primary); background: var(--el-color-primary-light-9); padding: 0 4px; border-radius: 3px; }
    em { font-style: normal; color: var(--el-text-color-secondary); font-size: 11px; }
  }
  &__fields {
    margin-left: auto;
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    padding: 1px 8px;
    background: var(--el-fill-color);
    border-radius: 8px;
  }
}
</style>
