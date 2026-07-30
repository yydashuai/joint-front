<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>报文字段管理</h2>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="addHeaderProtocol">新增字段</el-button>
        <el-button type="success" :icon="Plus" @click="addHeaderInterface">新增报文</el-button>
      </div>
    </div>

    <div class="split">
      <SystemModuleTree
        class="proto-tree"
        :model-value="currentKey"
        title="系统 · 模块 · 字段"
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
        <ByteFieldTree
          ref="byteTreeRef"
          v-if="selectedKind === 'protocol' && curProto && isByteStreamProtocol(curProto)"
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
          ref="structuredEditorRef"
          v-else-if="selectedKind === 'protocol' && curProto"
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

        <el-empty v-if="!curProto && !curIf" class="main main--empty" description="从左侧选择一个字段或报文进行编辑" />
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
import { Plus } from '@element-plus/icons-vue'
import { makeParam, useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ProtocolTypeDialog from '@/components/protocol/ProtocolTypeDialog.vue'
import ByteFieldTree from '@/components/protocol/ByteFieldTree.vue'
import StructFieldEditor from '@/components/protocol/StructFieldEditor.vue'
import InterfaceEditor from '@/components/protocol/InterfaceEditor.vue'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const store = useProtocolStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
const router = useRouter()
const route = useRoute()

// 进入字段页时, 自动跑一次 v1→v2 数据迁移(幂等)
// 未来 v2 概念完全接管后, 可删除此调用
onMounted(() => store.migrateAllFromV1())

const selectedKind = ref('protocol')
if (!store.selectedProtocolId) store.selectedProtocolId = store.protocols[0]?.id ?? null
if (!store.selectedInterfaceId) store.selectedInterfaceId = store.interfaces[0]?.id ?? null
// 从数据集管理「报文」按钮跳转过来时，按 query 切换到报文视图并选中对应报文
if (route.query.kind === 'interface') {
  selectedKind.value = 'interface'
  if (route.query.iface) store.selectedInterfaceId = Number(route.query.iface)
}

const curProto = computed(() => store.selectedProtocol)
const curIf = computed(() => store.selectedInterface)

const hasByteFields = (p) => (p.fields || []).some(f => f.kind === 'byte' || f.kind === 'bit' || f.kind === 'repeat')
const isByteStreamProtocol = (p) =>
  p?.category === 'bitstream' ||
  p?.type === 'TCP' ||
  !!p?.framing ||
  hasByteFields(p)

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
      label: '字段',
      count: protos.length,
      addLabel: '+字段',
      addType: 'primary',
      items: protos.map((p) => ({ key: `p-${p.id}`, kind: 'protocol', icon: 'Document', label: p.name, ref: p, module }))
    },
    {
      key: `ig-${module.id}`,
      kind: 'ifGroup',
      icon: 'Operation',
      label: '报文',
      count: ifaces.length,
      addLabel: '+报文',
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

const DEFAULT_NAME = { protocol: '新建字段', interface: '新建报文' }
const typeDialogVisible = ref(false)
const pendingModule = ref(null)

const openTypeDialog = (module) => {
  pendingModule.value = module
  typeDialogVisible.value = true
}

const onTypeSelected = (category) => {
  const mod = pendingModule.value
  if (!mod) return
  const isByteStream = category === 'bitstream'
  store.addProtocol({
    name: nextUniqueName(DEFAULT_NAME.protocol),
    systemId: mod.systemId,
    moduleId: mod.id,
    category,
    endian: isByteStream ? 'big' : undefined,
    fields: category === 'scalar'
      ? [makeParam({ name: '变量1', type: 'scalar', encoding: 'uint8' })]
      : [],
    framing: isByteStream ? { mode: 'fixed', fixedLength: 0, lengthFieldId: null, lengthIncludesHeader: true, lengthIncludesSelf: true, headerBytes: '', footerBytes: '' } : null,
    checksum: isByteStream ? { type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0, polynomial: '0x1021', initValue: '0xFFFF', reflectIn: false, reflectOut: false, xorOut: '0x0000' } : null,
    fileConfig: category === 'file'
      ? { mediaType: 'application/octet-stream', extension: '.bin', maxSizeMb: 100, checksum: 'sha256', chunkSizeKb: 64 }
      : null,
    matrixConfig: category === 'matrix'
      ? { fileType: 'binary-matrix', scalarType: 'float32', rows: 0, columns: 0, rowMajor: true, headerBytes: 0 }
      : null,
  })
  selectedKind.value = 'protocol'
}

const addProtocolLeaf = (module) => openTypeDialog(module)
const addInterfaceLeaf = (module) => {
  store.addInterface({ name: nextUniqueName(DEFAULT_NAME.interface), systemId: module.systemId, moduleId: module.id })
  selectedKind.value = 'interface'
}

const headerTargetModule = computed(() => {
  const selected = selectedKind.value === 'protocol' ? curProto.value : curIf.value
  const selectedModule = connStore.nodes.find((module) => module.id === selected?.moduleId)
  if (selectedModule && (!systemStore.currentId || selectedModule.systemId === systemStore.currentId)) {
    return selectedModule
  }
  return connStore.nodes.find((module) => !systemStore.currentId || module.systemId === systemStore.currentId) || null
})

const withHeaderTargetModule = (action) => {
  if (!headerTargetModule.value) {
    ElMessage.warning('请先在链路连接管理中添加模块')
    return
  }
  action(headerTargetModule.value)
}

const addHeaderProtocol = () => withHeaderTargetModule(addProtocolLeaf)
const addHeaderInterface = () => withHeaderTargetModule(addInterfaceLeaf)

const onTreeAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'protoGroup') addProtocolLeaf(module)
  if (groupKind === 'ifGroup') addInterfaceLeaf(module)
}

const onTreeDeleteLeaf = (node) => {
  if (node.kind === 'protocol') store.removeProtocol(node.ref.id)
  if (node.kind === 'interface') store.removeInterface(node.ref.id)
}

/* ---- 报文右键菜单：跳转到规则管理 ---- */
const leafContextActions = (nodeData) => {
  if (nodeData?.kind !== 'interface') return []
  return [{ label: '生成校验规则', action: 'generateRules' }]
}
const onLeafAction = ({ action, data }) => {
  if (action === 'generateRules' && data?.ref) {
    router.push({ path: '/rule', query: { interfaceId: String(data.ref.id), action: 'generate' } })
  }
}

// 从规则页跳转过来时，自动选中对应报文
watch(() => route.query.interfaceId, (ifaceId) => {
  if (!ifaceId) return
  const iface = store.interfaces.find((i) => String(i.id) === String(ifaceId))
  if (iface) {
    selectedKind.value = 'interface'
    store.selectedInterfaceId = iface.id
  }
}, { immediate: true })

const byteTreeRef = ref()
const structuredEditorRef = ref()

const onSave = () => {
  const validName = validateName(curProto.value?.name, curProto.value, '字段')
  if (!validName) return
  curProto.value.name = validName
  byteTreeRef.value?.fillAllGaps?.()
  nextTick(() => {
    byteTreeRef.value?.markClean?.()
    structuredEditorRef.value?.markClean?.()
    ElMessage.success('字段已保存')
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
  ElMessage.success('已导出字段模板 JSON')
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
        name: nextUniqueName(`${obj.name || '导入字段'}(导入)`),
        type: obj.type || 'TCP',
        desc: obj.desc || '',
        systemId: curProto.value?.systemId ?? null,
        moduleId: curProto.value?.moduleId ?? null,
        config: obj.config || { endian: 'big', fields: [] }
      })
      selectedKind.value = 'protocol'
      ElMessage.success('字段模板已导入')
    } catch {
      ElMessage.error('文件解析失败，请确认为字段 JSON')
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<style scoped lang="scss">
.page { height: 100%; min-height: 0; }
.proto { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.page__header { flex-shrink: 0; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.split { flex: 1; min-height: 0; display: flex; gap: 16px; overflow: hidden; }
.proto-tree { width: 300px; flex-shrink: 0; min-height: 0; overflow: auto; }
.proto-detail { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; flex: 1; min-height: 0; overflow: hidden; }
.proto-detail > :deep(.el-card.main) { flex: 1; min-height: 0; overflow: hidden; }
.main--empty {
  flex: 1;
  min-width: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}

</style>
