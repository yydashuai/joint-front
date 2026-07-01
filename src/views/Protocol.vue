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
        <!-- 协议摘要: 数据结构信息 -->
        <div v-if="selectedKind === 'protocol' && curProto" class="proto-summary">
          <span class="proto-summary__chip">
            <el-icon><Grid /></el-icon>
            <b>{{ curProto.fields?.length || 0 }}</b> 个字段
          </span>
          <span v-if="curProto.endian" class="proto-summary__chip">
            <el-icon><Setting /></el-icon>
            {{ curProto.endian === 'big' ? '大端' : '小端' }}
          </span>
          <span v-if="curProto.framing" class="proto-summary__chip is-framing">
            <el-icon><Box /></el-icon>
            帧结构
          </span>
          <span v-if="curProto.checksum" class="proto-summary__chip is-checksum">
            <el-icon><Document /></el-icon>
            校验
          </span>
          <span v-if="store.interfacesByProtocol(curProto.id).length" class="proto-summary__msg">
            <el-icon><List /></el-icon>
            {{ store.interfacesByProtocol(curProto.id).length }} 个接口引用
          </span>
        </div>

        <ByteFieldTree
          ref="byteTreeRef"
          v-if="selectedKind === 'protocol' && curProto && hasByteFields(curProto)"
          :protocol="curProto"
          :system-options="systemOptions"
          :module-options="moduleOptions(curProto.systemId)"
          @import="triggerImport"
          @export="exportProto"
          @save="onSave"
          @delete="store.removeProtocol(curProto.id)"
          @system-change="onProtoSystemChange"
        />

        <StructFieldEditor
          v-else-if="selectedKind === 'protocol' && curProto && !hasByteFields(curProto)"
          :protocol="curProto"
          :system-options="systemOptions"
          :module-options="moduleOptions(curProto.systemId)"
          @save="onSave"
          @delete="store.removeProtocol(curProto.id)"
          @system-change="onProtoSystemChange"
        />

        <InterfaceEditor
          v-if="selectedKind === 'interface' && curIf"
          :iface="curIf"
          :system-options="systemOptions"
          :module-options="moduleOptions(curIf.systemId)"
          :protocol-options="store.protocolOptions"
          @delete="store.removeInterface(curIf.id)"
          @system-change="onIfSystemChange"
          @navigate-protocol="onNavigateProtocol"
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
import { Grid, Setting, Box, Document, List, InfoFilled } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ProtocolTypeDialog from '@/components/protocol/ProtocolTypeDialog.vue'
import ByteFieldTree from '@/components/protocol/ByteFieldTree.vue'
import StructFieldEditor from '@/components/protocol/StructFieldEditor.vue'
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

// v2: 摘要 (带防御默认值)
const EMPTY_SUMMARY = { fieldCount: 0, hasFraming: false, hasChecksum: false, endian: 'big', isStruct: false }
const protoSummary = computed(() => {
  if (!curProto.value) return EMPTY_SUMMARY
  return store.protocolSummary(curProto.value.id) || EMPTY_SUMMARY
})

const hasByteFields = (p) => (p.fields || []).some(f => f.kind === 'byte' || f.kind === 'bit' || f.kind === 'repeat')

const systemOptions = computed(() => systemStore.systems.map((s) => ({ label: s.name, value: s.id })))
const moduleOptions = (systemId) => connStore.nodes.filter((n) => n.systemId === systemId).map((m) => ({ label: m.name, value: m.id }))
const onProtoSystemChange = () => { if (curProto.value) curProto.value.moduleId = null }
const onIfSystemChange = () => { if (curIf.value) curIf.value.moduleId = null }
const onNavigateProtocol = (protocolId) => {
  selectedKind.value = 'protocol'
  store.selectedProtocolId = protocolId
}

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
  const isByteStream = type === 'TCP'
  store.addProtocol({
    name: DEFAULT_NAME.protocol,
    systemId: mod.systemId,
    moduleId: mod.id,
    endian: isByteStream ? 'big' : undefined,
    fields: [],
    framing: isByteStream ? { mode: 'fixed', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: '', footerBytes: '' } : null,
    checksum: isByteStream ? { type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' } : null,
  })
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

const byteTreeRef = ref()

const onSave = () => {
  byteTreeRef.value?.fillAllGaps?.()
  nextTick(() => {
    byteTreeRef.value?.markClean?.()
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
.page { height: 100%; min-height: 0; }
.proto { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.page__header { flex-shrink: 0; margin-bottom: 12px; }
.split { flex: 1; min-height: 0; display: flex; gap: 16px; overflow: hidden; }
.proto-tree { width: 300px; flex-shrink: 0; min-height: 0; overflow: auto; }
.proto-detail { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; flex: 1; min-height: 0; overflow: hidden; }
.proto-detail > :deep(.proto-summary) { flex-shrink: 0; }
.proto-detail > :deep(.el-card.main) { flex: 1; min-height: 0; overflow: hidden; }
.main--empty {
  flex: 1;
  min-width: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

/* ============ v2 协议摘要条 ============ */
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
</style>
