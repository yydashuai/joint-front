<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>接口协议管理</h2>
        <div class="page__desc">系统 → 模块 → 协议 / 接口 · 字段类型 ≥5 种</div>
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
                  <el-button link type="primary" size="small" @click.stop="newProto(data)">+协议</el-button>
                  <el-button link type="success" size="small" @click.stop="newIface(data)">+接口</el-button>
                </span>
              </div>
            </template>
          </el-tree>
          <el-empty v-if="!treeData.length" description="暂无系统/模块，请先在链路连接管理添加" :image-size="70" />
        </el-scrollbar>
      </el-card>

      <!-- 右：协议字段矩阵编辑 -->
      <el-card v-if="selectedKind === 'protocol' && curProto" class="main" shadow="never" :body-style="mainBody">
        <template #header>
          <div class="proto-head">
            <el-input v-model="curProto.name" class="proto-name" placeholder="协议名称" />
            <div class="proto-head__right">
              <span class="lbl">字节序</span>
              <el-select v-model="curProto.endian" style="width: 120px">
                <el-option v-for="e in ENDIANS" :key="e.value" :label="e.label" :value="e.value" />
              </el-select>
              <el-button :icon="Upload" @click="triggerImport">导入</el-button>
              <el-button :icon="Download" @click="exportProto">导出</el-button>
              <el-popconfirm title="删除该协议？" @confirm="store.removeProtocol(curProto.id)">
                <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
              </el-popconfirm>
            </div>
          </div>
        </template>

        <el-input v-model="curProto.desc" placeholder="协议说明（可选）" class="proto-desc" />

        <div class="meta-row">
          <span class="meta-row__label req">所属系统</span>
          <el-select v-model="curProto.systemId" placeholder="选择系统" class="meta-sel" @change="onProtoSystemChange">
            <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <span class="meta-row__label req">模块</span>
          <el-select v-model="curProto.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!curProto.systemId">
            <el-option v-for="m in moduleOptions(curProto.systemId)" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </div>

        <el-alert v-if="overlapIds.size" type="error" :closable="false" show-icon class="overlap-tip">
          检测到位段重叠（{{ overlapIds.size }} 个字段），已标红，请检查起始位 / 结束位
        </el-alert>

        <el-table ref="tableRef" :data="curProto.fields" row-key="id" border size="small" class="matrix">
          <el-table-column width="40" align="center" class-name="drag-col">
            <template #default>
              <el-icon class="drag-handle" title="拖拽换位"><Rank /></el-icon>
            </template>
          </el-table-column>
          <el-table-column label="字段名（语义）" min-width="130">
            <template #default="{ row }"><el-input v-model="row.name" size="small" placeholder="如 加密标志" /></template>
          </el-table-column>
          <el-table-column label="起始位" width="92">
            <template #default="{ row }"><el-input-number v-model="row.startBit" :min="0" size="small" controls-position="right" style="width: 80px" :class="{ 'num-warn': overlapIds.has(row.id) }" /></template>
          </el-table-column>
          <el-table-column label="结束位" width="92">
            <template #default="{ row }"><el-input-number v-model="row.endBit" :min="0" size="small" controls-position="right" style="width: 80px" :class="{ 'num-warn': overlapIds.has(row.id) }" /></template>
          </el-table-column>
          <el-table-column label="长度(位)" width="76" align="center">
            <template #default="{ row }">
              <span :class="{ 'len-bad': bitLen(row) <= 0 }">{{ bitLen(row) > 0 ? bitLen(row) : '非法' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="取值约束" width="244">
            <template #default="{ row }">
              <div class="constraint">
                <el-select v-model="row.constraint.mode" size="small" class="c-mode">
                  <el-option label="范围" value="range" />
                  <el-option label="固定值" value="fixed" />
                </el-select>
                <template v-if="row.constraint.mode === 'range'">
                  <el-input-number v-model="row.constraint.min" :controls="false" size="small" class="c-num" />
                  <span class="c-sep">~</span>
                  <el-input-number v-model="row.constraint.max" :controls="false" size="small" class="c-num" />
                </template>
                <el-input-number v-else v-model="row.constraint.value" :controls="false" size="small" class="c-num c-num--fixed" />
              </div>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="150">
            <template #default="{ row }"><el-input v-model="row.desc" size="small" placeholder="如 1=加密，0=明文" /></template>
          </el-table-column>
          <el-table-column label="操作" width="64" align="center">
            <template #default="{ row }">
              <el-button text size="small" :icon="Delete" title="删除" @click="removeProtoField(row.id)" />
            </template>
          </el-table-column>
        </el-table>

        <el-button class="add-row" :icon="Plus" @click="store.addField(curProto)">添加字段</el-button>
      </el-card>

      <!-- 右：接口结构编辑 -->
      <el-card v-else-if="selectedKind === 'interface' && curIf" class="main" shadow="never" :body-style="mainBody">
        <template #header>
          <div class="proto-head">
            <el-input v-model="curIf.name" class="proto-name" placeholder="接口名称" />
            <el-popconfirm title="删除该接口？" @confirm="store.removeInterface(curIf.id)">
              <template #reference><el-button :icon="Delete" plain>删除接口</el-button></template>
            </el-popconfirm>
          </div>
        </template>

        <el-input v-model="curIf.desc" placeholder="接口说明（可选）" class="proto-desc" />

        <div class="meta-row">
          <el-input v-model="curIf.path" class="meta-path" placeholder="接口路径，如 /device/status">
            <template #prepend>路径</template>
          </el-input>
        </div>
        <div class="meta-row">
          <span class="meta-row__label req">所属系统</span>
          <el-select v-model="curIf.systemId" placeholder="选择系统" class="meta-sel" @change="onIfSystemChange">
            <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
          <span class="meta-row__label req">模块</span>
          <el-select v-model="curIf.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!curIf.systemId">
            <el-option v-for="m in moduleOptions(curIf.systemId)" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
        </div>

        <div class="sig">签名预览：<code>{{ signature }}</code></div>

        <el-scrollbar class="tree-scroll">
          <div class="struct">
            <div class="struct__head">
              <span class="struct__title">请求结构</span>
              <el-button size="small" :icon="Plus" @click="addRootParam(curIf.request)">添加参数</el-button>
            </div>
            <div class="struct__tree">
              <div v-for="p in curIf.request" :key="p.id" class="struct__row"><FieldNode :node="p" /></div>
              <el-empty v-if="!curIf.request.length" description="无参数" :image-size="60" />
            </div>
          </div>

          <div class="struct">
            <div class="struct__head">
              <span class="struct__title">响应结构</span>
              <el-button size="small" :icon="Plus" @click="addRootParam(curIf.response)">添加字段</el-button>
            </div>
            <div class="struct__tree">
              <div v-for="p in curIf.response" :key="p.id" class="struct__row"><FieldNode :node="p" /></div>
              <el-empty v-if="!curIf.response.length" description="无返回字段" :image-size="60" />
            </div>
          </div>
        </el-scrollbar>
      </el-card>

      <el-empty v-else class="main main--empty" description="从左侧选择一个协议或接口进行编辑" />
    </div>

    <!-- 字段编辑弹窗（接口树用） -->
    <el-dialog v-model="nodeDlg" title="编辑字段" width="460px">
      <el-form v-if="editing" label-width="88px">
        <el-form-item label="字段名"><el-input v-model="editing.name" /></el-form-item>
        <el-form-item label="数据类型">
          <el-select v-model="editing.type" class="w-full" @change="onTypeChange(editing)">
            <el-option v-for="t in FIELD_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '常量'" label="子类型">
          <el-select v-model="editing.dataType" class="w-full">
            <el-option v-for="d in CONST_SUBTYPES" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '位组序流'" label="绑定协议">
          <el-select v-model="editing.protocolRef" class="w-full" placeholder="选择解析协议" clearable>
            <el-option v-for="o in store.protocolOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '共识体'" label="提示">
          <span class="muted">可在树上用 ＋ 为其添加子字段</span>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="editing.desc" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" @click="nodeDlg = false">完成</el-button></template>
    </el-dialog>

    <input ref="fileInput" type="file" accept="application/json" hidden @change="onImportFile" />

    <!-- 右键菜单 -->
    <teleport to="body">
      <div v-if="ctx.visible" class="ctx-mask" @click="closeCtx" @contextmenu.prevent="closeCtx">
        <ul class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
          <li @click="ctxRename">重命名</li>
          <template v-if="ctx.data?.kind === 'system'">
            <li @click="ctxNewModule">新建模块</li>
            <li @click="ctxEdit">在链路连接管理中编辑</li>
            <li class="danger" @click="ctxDelete">删除系统</li>
          </template>
          <template v-else-if="ctx.data?.kind === 'module'">
            <li @click="ctxNewProto">新建协议</li>
            <li @click="ctxNewIface">新建接口</li>
            <li @click="ctxEdit">在链路连接管理中编辑</li>
            <li class="danger" @click="ctxDelete">删除模块</li>
          </template>
          <template v-else>
            <li class="danger" @click="ctxDelete">删除</li>
          </template>
        </ul>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, provide, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { Plus, Delete, Upload, Download, Rank, Back } from '@element-plus/icons-vue'
import { useProtocolStore, FIELD_TYPES, CONST_SUBTYPES, ENDIANS, makeParam } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import FieldNode from '@/components/FieldNode.vue'

const store = useProtocolStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const router = useRouter()

const listBody = { padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }
const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

// 当前在右侧编辑的对象类型：protocol | interface | null
const selectedKind = ref('protocol')
if (!store.selectedProtocolId) store.selectedProtocolId = store.protocols[0]?.id ?? null
if (!store.selectedInterfaceId) store.selectedInterfaceId = store.interfaces[0]?.id ?? null

const curProto = computed(() => store.selectedProtocol)
const curIf = computed(() => store.selectedInterface)

/* ---- 系统/模块 选项（编辑器用） ---- */
const systemOptions = computed(() => systemStore.systems.map((s) => ({ label: s.name, value: s.id })))
const moduleOptions = (systemId) => connStore.nodes.filter((n) => n.systemId === systemId).map((m) => ({ label: m.name, value: m.id }))
const onProtoSystemChange = () => { if (curProto.value) curProto.value.moduleId = null }
const onIfSystemChange = () => { if (curIf.value) curIf.value.moduleId = null }
const clearFilter = () => systemStore.setCurrent(null)

/* ---- 层级树：系统 → 模块 → 协议组/接口组 → 项 ---- */
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
        return {
          key: `mod-${mod.id}`,
          kind: 'module',
          icon: 'Connection',
          label: mod.name,
          ref: mod,
          sys,
          children: [
            {
              key: `pg-${mod.id}`, kind: 'protoGroup', icon: 'Files', label: '协议', count: protos.length,
              children: protos.map((p) => ({ key: `p-${p.id}`, kind: 'protocol', icon: 'Document', label: p.name, ref: p }))
            },
            {
              key: `ig-${mod.id}`, kind: 'ifGroup', icon: 'Operation', label: '接口', count: ifaces.length,
              children: ifaces.map((i) => ({ key: `i-${i.id}`, kind: 'interface', icon: 'Link', label: i.name, ref: i }))
            }
          ]
        }
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

/* ---- 命名（弹窗输入，留空用默认名；IDE 式：新建后立即可命名） ---- */
const DEFAULT_NAME = { system: '新建系统', module: '新建模块', protocol: '新建协议', interface: '新建接口' }
const promptName = (obj, kind, title) => {
  ElMessageBox.prompt(title, '命名', {
    inputValue: obj.name || '',
    inputPlaceholder: `留空默认「${DEFAULT_NAME[kind]}」`,
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => { obj.name = (value || '').trim() || DEFAULT_NAME[kind] })
    .catch(() => { if (!obj.name) obj.name = DEFAULT_NAME[kind] }) // 取消时若仍空白则用默认
}
// 重命名（右键菜单 / 双击）
const startRename = (data) => {
  if (data?.ref) promptName(data.ref, data.kind, '重命名')
}

/* ---- 新建：默认名创建（随后可右键/双击重命名） ---- */
const newSystem = () => { systemStore.add({ name: DEFAULT_NAME.system }) }
const newModule = (sysNode) => { connStore.add({ name: DEFAULT_NAME.module, systemId: sysNode.ref.id, ip: '192.168.1.1', port: 8080 }) }
const newProto = (modNode) => {
  store.addProtocol({ name: DEFAULT_NAME.protocol, systemId: modNode.sys.id, moduleId: modNode.ref.id })
  selectedKind.value = 'protocol'
}
const newIface = (modNode) => {
  store.addInterface({ name: DEFAULT_NAME.interface, systemId: modNode.sys.id, moduleId: modNode.ref.id })
  selectedKind.value = 'interface'
}

/* ---- 右键菜单 ---- */
const ctx = reactive({ visible: false, x: 0, y: 0, data: null })
const onContextMenu = (event, data) => {
  if (!data || !['system', 'module', 'protocol', 'interface'].includes(data.kind)) return
  event.preventDefault()
  Object.assign(ctx, { visible: true, x: event.clientX, y: event.clientY, data })
}
const closeCtx = () => { ctx.visible = false }
const ctxRename = () => { startRename(ctx.data); closeCtx() }
const ctxNewModule = () => { newModule(ctx.data); closeCtx() }
const ctxNewProto = () => { newProto(ctx.data); closeCtx() }
const ctxNewIface = () => { newIface(ctx.data); closeCtx() }
// 编辑 = 跳转到对应页面（系统/模块都在链路连接管理维护）
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

/* 接口字段编辑：类型切换时清理无关字段 */
const onTypeChange = (row) => {
  if (row.type !== '共识体') row.children = []
  if (row.type !== '位组序流') row.protocolRef = null
}

/* 位段长度（闭区间 [startBit, endBit]，单位：位） */
const bitLen = (row) => row.endBit - row.startBit + 1

/* 位段重叠检测（[startBit, endBit] 闭区间） */
const rangeValid = (f) => f.endBit >= f.startBit
const rangesOverlap = (a, b) =>
  rangeValid(a) && rangeValid(b) && a.startBit <= b.endBit && b.startBit <= a.endBit
const overlapIds = computed(() => {
  const s = new Set()
  const fields = curProto.value?.fields || []
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      if (rangesOverlap(fields[i], fields[j])) { s.add(fields[i].id); s.add(fields[j].id) }
    }
  }
  return s
})

/* 协议字段矩阵操作 */
const removeProtoField = (id) => removeById([curProto.value.fields], id)

/* 拖拽换位：sortablejs 绑定表格 tbody，拖拽手柄调整字段顺序 */
const tableRef = ref()
let sortable = null
const initSortable = () => {
  const tbody = tableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return
  sortable?.destroy()
  sortable = Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'drag-ghost',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex === newIndex || oldIndex == null || newIndex == null) return
      const fields = curProto.value?.fields
      if (!fields) return
      const [moved] = fields.splice(oldIndex, 1)
      fields.splice(newIndex, 0, moved)
    }
  })
}
onMounted(() => nextTick(initSortable))
watch([() => store.selectedProtocolId, selectedKind], () => nextTick(initSortable))

/* 接口树操作 */
const addRootParam = (list) => list.push(makeParam({ name: `field${list.length + 1}` }))

const removeById = (lists, id) => {
  for (const list of lists) {
    const i = list.findIndex((n) => n.id === id)
    if (i >= 0) { list.splice(i, 1); return true }
    for (const n of list) {
      if (n.children?.length && removeById([n.children], id)) return true
    }
  }
  return false
}

// 树节点编辑弹窗
const nodeDlg = ref(false)
const editing = ref(null)
provide('treeActions', {
  onEdit: (node) => { editing.value = node; nodeDlg.value = true },
  onAddChild: (node) => node.children.push(makeParam({ name: `field${node.children.length + 1}` })),
  onRemove: (node) => removeById([curIf.value.request, curIf.value.response], node.id)
})

// 接口签名预览
const typeShort = (p) => (p.type === '常量' ? p.dataType : p.type)
const signature = computed(() => {
  const it = curIf.value
  if (!it) return ''
  const ret = it.response.map(typeShort).join(', ') || 'void'
  const args = it.request.map((p) => `${typeShort(p)} ${p.name}`).join(', ')
  return `(${ret}) ${it.name}(${args})`
})

/* 导入导出 */
const exportProto = () => {
  const blob = new Blob([JSON.stringify(curProto.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${curProto.value.name || 'protocol'}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出协议模板 JSON')
}
const fileInput = ref()
const triggerImport = () => fileInput.value.click()
const onImportFile = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result)
      store.addProtocol({ name: (obj.name || '导入协议') + '(导入)', endian: obj.endian || 'big', desc: obj.desc || '', systemId: curProto.value?.systemId ?? null, moduleId: curProto.value?.moduleId ?? null, fields: obj.fields || [] })
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
  &__edit { flex: 1; min-width: 0; }
}

/* 右主区 */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.main--empty { align-items: center; justify-content: center; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; .lbl { font-size: 13px; color: var(--el-text-color-secondary); } }
.proto-desc { margin-bottom: 12px; }

/* 系统/模块 + 接口路径 配置行 */
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }
.meta-path { max-width: 440px; }

.matrix { flex: 1; }

/* 拖拽换位手柄 */
.drag-handle { cursor: grab; color: var(--el-text-color-placeholder); }
.drag-handle:active { cursor: grabbing; }
.matrix :deep(.drag-ghost) { background: var(--el-color-primary-light-9); opacity: 0.7; }

/* 取值约束内联编辑 */
.constraint { display: flex; align-items: center; gap: 4px; }
.c-mode { width: 78px; flex-shrink: 0; }
.c-num { width: 56px; }
.c-num--fixed { width: 130px; }
.c-sep { color: var(--el-text-color-secondary); flex-shrink: 0; }

.overlap-tip { margin-bottom: 12px; }
.num-warn :deep(.el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
.num-warn :deep(.el-input__inner) { color: var(--el-color-danger); font-weight: 600; }
.len-bad { color: var(--el-color-danger); font-weight: 600; }
.add-row { margin-top: 12px; width: 100%; border-style: dashed; }
.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.w-full { width: 100%; }

/* 接口签名 */
.sig {
  font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 12px;
  code { color: var(--el-color-primary); background: var(--el-fill-color-light); padding: 2px 8px; border-radius: 4px; }
}

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

/* 接口结构树 */
.tree-scroll { flex: 1; min-height: 0; }
.struct {
  & + & { margin-top: 8px; }
  &__head { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
  &__title { font-size: 14px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary); }
  &__tree { display: flex; flex-direction: column; gap: 14px; padding: 8px 4px; }
  &__row { display: flex; }
}
</style>
