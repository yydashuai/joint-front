<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>接口协议管理</h2>
        <div class="page__desc">系统 → 模块 → 协议 / 接口 · 支持 TCP/UDP/HTTP/gRPC/消息队列</div>
      </div>
    </div>

    <div class="split">
      <!-- 左：系统 / 模块 / 协议·接口 层级树 -->
      <el-card class="side" shadow="never" :body-style="listBody">
        <template #header>
          <div class="card-head">
            <span>系统 · 模块 · 协议/接口</span>
            <div class="head-actions">
              <el-button v-if="!systemStore.isAll" link type="info" size="small" :icon="Back" @click="clearFilter">全部系统</el-button>
              <el-button link type="primary" size="small" :icon="Plus" @click="newSystem">新建系统</el-button>
            </div>
          </div>
        </template>
        <el-scrollbar class="tree-wrap">
          <el-tree
            :data="treeData"
            node-key="key"
            default-expand-all
            highlight-current
            :current-node-key="currentKey"
            :expand-on-click-node="false"
            @node-click="onNodeClick"
            @node-contextmenu="onContextMenu"
          >
            <template #default="{ data }">
              <div class="tnode" :class="`tnode--${data.kind}`" @dblclick="startRename(data)">
                <el-icon class="tnode__icon"><component :is="data.icon" /></el-icon>
                <span class="tnode__label">{{ data.label }}</span>
                <span v-if="data.count !== undefined" class="tnode__count">{{ data.count }}</span>
                <span v-if="data.kind === 'system'" class="tnode__ops">
                  <el-button link type="primary" size="small" @click.stop="newModule(data)">+模块</el-button>
                </span>
                <span v-else-if="data.kind === 'module'" class="tnode__ops">
                  <el-button link type="primary" size="small" @click.stop="openTypeDialog(data)">+协议</el-button>
                  <el-button link type="success" size="small" @click.stop="newIface(data)">+接口</el-button>
                </span>
                <span v-else-if="data.kind === 'protoGroup'" class="tnode__ops">
                  <el-button link type="primary" size="small" @click.stop="addGroupProto(data)">+新建协议</el-button>
                </span>
                <span v-else-if="data.kind === 'ifGroup'" class="tnode__ops">
                  <el-button link type="success" size="small" @click.stop="addGroupIface(data)">+新建接口</el-button>
                </span>
              </div>
            </template>
          </el-tree>
          <el-empty v-if="!treeData.length" description="暂无系统/模块，请先在链路连接管理添加" :image-size="70" />
        </el-scrollbar>
      </el-card>

      <!-- 右：协议编辑 - TCP/UDP -->
      <ByteFieldTree
        ref="byteTreeRef"
        v-if="selectedKind === 'protocol' && curProto && isByteStream(curProto.type)"
        :protocol="curProto"
        :systemOptions="systemOptions"
        :moduleOptions="moduleOptions(curProto.systemId)"
        @import="triggerImport"
        @export="exportProto"
        @save="onSave"
        @delete="store.removeProtocol(curProto.id)"
        @systemChange="onProtoSystemChange"
        @switchType="onTypeDropdown"
      />

      <!-- 右：协议编辑 - HTTP -->
      <HttpConfigForm
        ref="httpFormRef"
        v-else-if="selectedKind === 'protocol' && curProto && curProto.type === 'HTTP'"
        :protocol="curProto"
        :systemOptions="systemOptions"
        :moduleOptions="moduleOptions(curProto.systemId)"
        @save="onSave"
        @delete="store.removeProtocol(curProto.id)"
        @systemChange="onProtoSystemChange"
        @switchType="onTypeDropdown"
      />

      <!-- 右：协议编辑 - gRPC -->
      <GrpcConfigForm
        ref="grpcFormRef"
        v-else-if="selectedKind === 'protocol' && curProto && curProto.type === 'gRPC'"
        :protocol="curProto"
        :systemOptions="systemOptions"
        :moduleOptions="moduleOptions(curProto.systemId)"
        @save="onSave"
        @delete="store.removeProtocol(curProto.id)"
        @systemChange="onProtoSystemChange"
        @switchType="onTypeDropdown"
      />

      <!-- 右：协议编辑 - MQ -->
      <MqConfigForm
        ref="mqFormRef"
        v-else-if="selectedKind === 'protocol' && curProto && curProto.type === 'MQ'"
        :protocol="curProto"
        :systemOptions="systemOptions"
        :moduleOptions="moduleOptions(curProto.systemId)"
        @save="onSave"
        @delete="store.removeProtocol(curProto.id)"
        @systemChange="onProtoSystemChange"
        @switchType="onTypeDropdown"
      />

      <!-- 右：接口编辑 -->
      <InterfaceEditor
        v-else-if="selectedKind === 'interface' && curIf"
        :iface="curIf"
        :systemOptions="systemOptions"
        :moduleOptions="moduleOptions(curIf.systemId)"
        :protocolOptions="store.protocolOptions"
        @delete="store.removeInterface(curIf.id)"
        @systemChange="onIfSystemChange"
      />

      <el-empty v-else class="main main--empty" description="从左侧选择一个协议或接口进行编辑" />
    </div>

    <!-- 协议类型选择弹窗 -->
    <ProtocolTypeDialog v-model="typeDialogVisible" @select="onTypeSelected" />

    <input ref="fileInput" type="file" accept="application/json" hidden @change="onImportFile" />

    <!-- 右键菜单 -->
    <teleport to="body">
      <div v-if="ctx.visible" class="ctx-mask" @click="closeCtx" @contextmenu.prevent="closeCtx">
        <ul class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
          <!-- 系统节点 -->
          <template v-if="ctx.data?.kind === 'system'">
            <li @click="ctxRename">重命名</li>
            <li @click="ctxNewModule">新建模块</li>
            <li @click="ctxEdit">在链路连接中编辑</li>
            <li class="danger" @click="ctxDelete">删除系统</li>
          </template>
          <!-- 模块节点 -->
          <template v-else-if="ctx.data?.kind === 'module'">
            <li @click="openTypeDialog(ctx.data); closeCtx()">新建协议</li>
            <li @click="ctxNewIface">新建接口</li>
            <li @click="ctxEdit">在链路连接中编辑</li>
            <li class="danger" @click="ctxDelete">删除模块</li>
          </template>
          <!-- 协议分组节点 -->
          <template v-else-if="ctx.data?.kind === 'protoGroup'">
            <li @click="addGroupProto(ctx.data); closeCtx()">新建协议</li>
            <li class="danger" @click="ctxClearGroup('protocol')">清空协议</li>
          </template>
          <!-- 接口分组节点 -->
          <template v-else-if="ctx.data?.kind === 'ifGroup'">
            <li @click="addGroupIface(ctx.data); closeCtx()">新建接口</li>
            <li class="danger" @click="ctxClearGroup('interface')">清空接口</li>
          </template>
          <!-- 协议叶子节点 -->
          <template v-else-if="ctx.data?.kind === 'protocol'">
            <li @click="ctxRename">重命名</li>
            <li @click="ctxCopyProto">复制协议</li>
            <li @click="ctxPasteProto">粘贴协议</li>
            <li class="danger" @click="ctxDelete">删除协议</li>
          </template>
          <!-- 接口叶子节点 -->
          <template v-else-if="ctx.data?.kind === 'interface'">
            <li @click="ctxRename">重命名</li>
            <li @click="ctxCopyIface">复制接口</li>
            <li class="danger" @click="ctxDelete">删除接口</li>
          </template>
        </ul>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Back } from '@element-plus/icons-vue'
import { useProtocolStore, isByteStream } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
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

const listBody = { padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }

// 当前在右侧编辑的对象类型
const selectedKind = ref('protocol')
if (!store.selectedProtocolId) store.selectedProtocolId = store.protocols[0]?.id ?? null
if (!store.selectedInterfaceId) store.selectedInterfaceId = store.interfaces[0]?.id ?? null

const curProto = computed(() => store.selectedProtocol)
const curIf = computed(() => store.selectedInterface)

/* ---- 系统/模块 选项 ---- */
const systemOptions = computed(() => systemStore.systems.map((s) => ({ label: s.name, value: s.id })))
const moduleOptions = (systemId) => connStore.nodes.filter((n) => n.systemId === systemId).map((m) => ({ label: m.name, value: m.id }))
const onProtoSystemChange = () => { if (curProto.value) curProto.value.moduleId = null }
const onIfSystemChange = () => { if (curIf.value) curIf.value.moduleId = null }
const clearFilter = () => systemStore.setCurrent(null)

/* ---- 层级树 ---- */
const treeData = computed(() => {
  const cur = systemStore.currentId
  const systems = cur ? systemStore.systems.filter((s) => s.id === cur) : systemStore.systems
  return systems.map((sys) => ({
    key: `sys-${sys.id}`,
    kind: 'system',
    icon: 'Cpu',
    label: sys.name,
    ref: sys,
    children: connStore.nodes
      .filter((m) => m.systemId === sys.id)
      .map((mod) => {
        const protos = store.protocols.filter((p) => p.moduleId === mod.id)
        const ifaces = store.interfaces.filter((i) => i.moduleId === mod.id)
        const modNode = {
          key: `mod-${mod.id}`,
          kind: 'module',
          icon: 'Connection',
          label: mod.name,
          ref: mod,
          sys,
        }
        modNode.children = [
          {
            key: `pg-${mod.id}`, kind: 'protoGroup', icon: 'Files', label: '协议', count: protos.length,
            parent: modNode,
            children: protos.map((p) => ({ key: `p-${p.id}`, kind: 'protocol', icon: 'Document', label: p.name, ref: p, parent: modNode }))
          },
          {
            key: `ig-${mod.id}`, kind: 'ifGroup', icon: 'Operation', label: '接口', count: ifaces.length,
            parent: modNode,
            children: ifaces.map((i) => ({ key: `i-${i.id}`, kind: 'interface', icon: 'Link', label: i.name, ref: i, parent: modNode }))
          }
        ]
        return modNode
      })
  }))
})

const currentKey = computed(() => {
  if (selectedKind.value === 'protocol') return `p-${store.selectedProtocolId}`
  if (selectedKind.value === 'interface') return `i-${store.selectedInterfaceId}`
  return ''
})

const onNodeClick = (data) => {
  if (data.kind === 'protocol') {
    selectedKind.value = 'protocol'
    store.selectedProtocolId = data.ref.id
  } else if (data.kind === 'interface') {
    selectedKind.value = 'interface'
    store.selectedInterfaceId = data.ref.id
  }
}

/* ---- 命名 ---- */
const DEFAULT_NAME = { system: '新建系统', module: '新建模块', protocol: '新建协议', interface: '新建接口' }
const promptName = (obj, kind, title) => {
  ElMessageBox.prompt(title, '命名', {
    inputValue: obj.name || '',
    inputPlaceholder: `留空默认「${DEFAULT_NAME[kind]}」`,
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => { obj.name = (value || '').trim() || DEFAULT_NAME[kind] })
    .catch(() => { if (!obj.name) obj.name = DEFAULT_NAME[kind] })
}
const startRename = (data) => {
  if (data?.ref) promptName(data.ref, data.kind, '重命名')
}

/* ---- 新建 ---- */
const newSystem = () => { systemStore.add({ name: DEFAULT_NAME.system }) }
const newModule = (sysNode) => { connStore.add({ name: DEFAULT_NAME.module, systemId: sysNode.ref.id, ip: '192.168.1.1', port: 8080 }) }

// 协议类型弹窗
const typeDialogVisible = ref(false)
const pendingModule = ref(null)
const switchMode = ref(false)

const openTypeDialog = (modNode) => {
  pendingModule.value = modNode
  switchMode.value = false
  typeDialogVisible.value = true
}

const onTypeSelected = (type) => {
  if (switchMode.value && curProto.value) {
    // 切换已有协议类型
    store.switchProtocolType(curProto.value, type)
    return
  }
  const mod = pendingModule.value
  if (!mod) return
  store.addProtocol({ name: DEFAULT_NAME.protocol, type, systemId: mod.sys.id, moduleId: mod.ref.id })
  selectedKind.value = 'protocol'
}

const newIface = (modNode) => {
  store.addInterface({ name: DEFAULT_NAME.interface, systemId: modNode.sys.id, moduleId: modNode.ref.id })
  selectedKind.value = 'interface'
}

// 从协议分组节点添加协议
const addGroupProto = (groupNode) => {
  const mod = groupNode.parent
  openTypeDialog(mod)
}
// 从接口分组节点添加接口
const addGroupIface = (groupNode) => {
  const mod = groupNode.parent
  store.addInterface({ name: DEFAULT_NAME.interface, systemId: mod.sys.id, moduleId: mod.ref.id })
  selectedKind.value = 'interface'
}

// 下拉切换协议类型
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

// 保存
const onSave = () => {
  byteTreeRef.value?.fillAllGaps()
  nextTick(() => {
    byteTreeRef.value?.markClean()
    httpFormRef.value?.markClean()
    grpcFormRef.value?.markClean()
    mqFormRef.value?.markClean()
    ElMessage.success('协议已保存')
  })
}

/* ---- 右键菜单 ---- */
const ctx = reactive({ visible: false, x: 0, y: 0, data: null })
const onContextMenu = (event, data) => {
  if (!data || !['system', 'module', 'protoGroup', 'ifGroup', 'protocol', 'interface'].includes(data.kind)) return
  event.preventDefault()
  Object.assign(ctx, { visible: true, x: event.clientX, y: event.clientY, data })
}
const closeCtx = () => { ctx.visible = false }
const ctxRename = () => { startRename(ctx.data); closeCtx() }
const ctxNewModule = () => { newModule(ctx.data); closeCtx() }
const ctxNewIface = () => { newIface(ctx.data); closeCtx() }
const ctxEdit = () => {
  const d = ctx.data
  if (d.kind === 'system') systemStore.setCurrent(d.ref.id)
  else if (d.kind === 'module') { systemStore.setCurrent(d.ref.systemId); connStore.select(d.ref.id) }
  router.push('/connection')
  closeCtx()
}
const ctxDelete = () => {
  const d = ctx.data
  if (d.kind === 'system') { connStore.unassignSystem(d.ref.id); systemStore.remove(d.ref.id) }
  else if (d.kind === 'module') connStore.remove(d.ref.id)
  else if (d.kind === 'protocol') store.removeProtocol(d.ref.id)
  else if (d.kind === 'interface') store.removeInterface(d.ref.id)
  closeCtx()
}

// 清空分组
const ctxClearGroup = (kind) => {
  const mod = ctx.data?.parent
  if (!mod) return
  const items = kind === 'protocol'
    ? store.protocols.filter((p) => p.moduleId === mod.ref.id)
    : store.interfaces.filter((i) => i.moduleId === mod.ref.id)
  if (!items.length) { closeCtx(); return }
  ElMessageBox.confirm(
    `确定清空该模块下的 ${items.length} 个${kind === 'protocol' ? '协议' : '接口'}？`,
    '确认清空',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    items.forEach((it) => kind === 'protocol' ? store.removeProtocol(it.id) : store.removeInterface(it.id))
  }).catch(() => {})
  closeCtx()
}

// 剪贴板
const clipboard = ref(null)

const ctxCopyProto = () => {
  if (ctx.data?.ref) {
    clipboard.value = { type: 'protocol', data: JSON.parse(JSON.stringify(ctx.data.ref)) }
    ElMessage.success('协议已复制到剪贴板')
  }
  closeCtx()
}
const ctxPasteProto = () => {
  if (!clipboard.value || clipboard.value.type !== 'protocol') {
    ElMessage.warning('剪贴板中没有协议数据')
    closeCtx()
    return
  }
  const src = clipboard.value.data
  const proto = ctx.data?.ref
  // 粘贴到同一模块：创建副本
  store.addProtocol({
    name: src.name + '(副本)',
    type: src.type || 'TCP',
    desc: src.desc || '',
    systemId: proto?.systemId ?? ctx.data?.parent?.sys?.id ?? null,
    moduleId: proto?.moduleId ?? ctx.data?.parent?.ref?.id ?? null,
    config: JSON.parse(JSON.stringify(src.config || {}))
  })
  selectedKind.value = 'protocol'
  ElMessage.success('协议已粘贴')
  closeCtx()
}
const ctxCopyIface = () => {
  if (ctx.data?.ref) {
    clipboard.value = { type: 'interface', data: JSON.parse(JSON.stringify(ctx.data.ref)) }
    ElMessage.success('接口已复制到剪贴板')
  }
  closeCtx()
}

/* 导入导出 */
const exportProto = () => {
  if (!curProto.value) return
  // 导出前补全所有空缺位（防呆）
  byteTreeRef.value?.fillAllGaps()
  const blob = new Blob([JSON.stringify(curProto.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${curProto.value.name || 'protocol'}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出协议模板 JSON')
}
const fileInput = ref()
const byteTreeRef = ref()
const httpFormRef = ref()
const grpcFormRef = ref()
const mqFormRef = ref()
const triggerImport = () => fileInput.value?.click()
const onImportFile = (e) => {
  const file = e.target.files[0]
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

.card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.head-actions { display: flex; align-items: center; gap: 4px; }

/* 左侧层级树 */
.side { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; }
.tree-wrap { flex: 1; min-height: 0; padding: 6px 4px; }
.tnode {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-right: 6px;
  font-size: 13px;
  &__icon { color: var(--el-text-color-secondary); }
  &__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__count {
    font-size: 11px; color: var(--el-text-color-placeholder);
    background: var(--el-fill-color); border-radius: 8px; padding: 0 6px;
  }
  &__ops { display: none; gap: 2px; }
  &:hover &__ops { display: inline-flex; }

  &--system { font-weight: 600; }
  &--system .tnode__icon { color: var(--el-color-primary); }
  &--module { font-weight: 500; }
  &--protocol .tnode__icon { color: var(--el-color-warning); }
  &--interface .tnode__icon { color: var(--el-color-success); }
  &--protoGroup .tnode__icon { color: var(--el-color-warning); }
  &--ifGroup .tnode__icon { color: var(--el-color-success); }
  &--protoGroup, &--ifGroup { font-weight: 500; }
}

/* 右主区 */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.main--empty { align-items: center; justify-content: center; }

/* 右键菜单 */
.ctx-mask { position: fixed; inset: 0; z-index: 3000; }
.ctx-menu {
  position: fixed;
  min-width: 150px;
  padding: 4px 0;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
  font-size: 13px;
  li {
    list-style: none;
    padding: 7px 16px;
    cursor: pointer;
    color: var(--el-text-color-primary);
    &:hover { background: var(--el-fill-color-light); }
    &.danger { color: var(--el-color-danger); }
  }
}
</style>
