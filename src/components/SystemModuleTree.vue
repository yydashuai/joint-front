<template>
  <el-card class="smt" shadow="never" :body-style="bodyStyle">
    <template #header>
      <div class="smt__head">
        <span class="smt__title">
          <span v-for="line in titleLines" :key="line" class="smt__title-line">{{ line }}</span>
        </span>
        <div class="smt__head-actions">
          <el-button-group v-if="!systemStore.isAll" class="smt__view-group">
            <el-tooltip content="返回全部系统" placement="top" :show-after="300">
              <el-button size="small" :icon="Back" @click="clearFilter" />
            </el-tooltip>
            <el-tooltip :content="treeFullyExpanded ? '全部收起' : '全部展开'" placement="top" :show-after="300">
              <el-button size="small" :icon="treeFullyExpanded ? Fold : Expand" @click="toggleAll" />
            </el-tooltip>
          </el-button-group>
          <el-button v-else link type="info" size="small" :icon="treeFullyExpanded ? Fold : Expand" @click="toggleAll">
            {{ treeFullyExpanded ? '全部收起' : '全部展开' }}
          </el-button>
          <el-button link type="primary" size="small" :icon="Plus" @click="newSystem">新建系统</el-button>
        </div>
      </div>
    </template>

    <el-scrollbar class="smt__scroll">
      <el-tree
        ref="treeRef"
        :data="treeData"
        node-key="key"
        :default-expanded-keys="expandedKeys"
        highlight-current
        :current-node-key="visibleCurrentNodeKey"
        :expand-on-click-node="true"
        :auto-expand-parent="false"
        @node-expand="onNodeExpand"
        @node-collapse="onNodeCollapse"
        @node-click="onNodeClick"
        @node-contextmenu="onContextMenu"
      >
        <template #default="{ data }">
          <div
            class="tnode"
            :class="[`tnode--${data.kind}`, { 'tnode--draggable': draggableLeaves && isSelectableLeaf(data) }]"
            :draggable="draggableLeaves && isSelectableLeaf(data)"
            @dragstart="onDragStart($event, data)"
            @dblclick="startRename(data)"
          >
            <el-icon class="tnode__icon"><component :is="data.icon" /></el-icon>
            <span class="tnode__label">{{ data.label }}</span>
            <span v-if="data.badge" class="tnode__badge">{{ data.badge }}</span>
            <span v-if="data.count !== undefined" class="tnode__count">{{ data.count }}</span>
            <span v-if="data.kind === 'system'" class="tnode__ops">
              <el-button link type="primary" size="small" @click.stop="newModule(data)">+模块</el-button>
            </span>
            <span v-else-if="data.kind === 'module' && data.addActions.length" class="tnode__ops">
              <el-button
                v-for="a in data.addActions"
                :key="a.groupKind"
                link
                :type="a.type || 'primary'"
                size="small"
                @click.stop="addLeaf(a.groupKind, data)"
              >{{ a.label }}</el-button>
            </span>
          </div>
        </template>
      </el-tree>
      <el-empty v-if="!treeData.length" :description="emptyText" :image-size="70" />
    </el-scrollbar>

    <!-- 右键菜单 -->
    <teleport to="body">
      <div v-if="ctx.visible" class="ctx-mask" @click="closeCtx" @contextmenu.prevent="closeCtx">
        <ul class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
          <li @click="ctxRename">重命名</li>
          <template v-if="ctx.data?.kind === 'system'">
            <li @click="ctxNewModule">新建模块</li>
            <li v-if="showEditJump" @click="ctxEdit">在链路连接管理中编辑</li>
            <li class="danger" @click="ctxDelete">删除系统</li>
          </template>
          <template v-else-if="ctx.data?.kind === 'module'">
            <li v-for="a in ctx.data.addActions" :key="a.groupKind" @click="ctxAddLeaf(a.groupKind)">{{ a.label }}</li>
            <template v-if="moduleContextActions">
              <li v-if="(ctx.data.addActions?.length)" class="ctx-sep"></li>
              <template v-for="act in moduleContextActions(ctx.data)" :key="act.action">
                <li :class="{ danger: act.danger }" @click="emitModuleAction(act.action)">{{ act.label }}</li>
              </template>
            </template>
            <li v-if="showEditJump" @click="ctxEdit">在链路连接管理中编辑</li>
            <li class="danger" @click="ctxDelete">删除模块</li>
          </template>
          <template v-else>
            <template v-if="leafContextActions">
              <template v-for="act in leafContextActions(ctx.data)" :key="act.action">
                <li :class="{ danger: act.danger }" @click="emitLeafAction(act.action)">{{ act.label }}</li>
              </template>
              <li v-if="leafContextActions(ctx.data).length" class="ctx-sep"></li>
            </template>
            <li class="danger" @click="ctxDelete">删除</li>
          </template>
        </ul>
      </div>
    </teleport>
  </el-card>
</template>

<script setup>
/**
 * 通用「系统 → 模块 →（可选叶子）」IDE 式层级树。
 * - 系统、模块为通用层：内部直接读 systemStore / connStore，自带 新建/重命名/删除/+模块/编辑跳转。
 * - 叶子层由各页面通过 leafGroups(module) 注入（如 协议/接口、数据集、规则集…）；
 *   不传 leafGroups 时，「模块」本身即可选叶子（连接管理就是这种用法）。
 *
 * leafGroups(module) => [
 *   { key, kind, icon, label, count, addLabel, addType, items: [{ key, kind, icon, label, ref }] }
 * ]
 */
import { reactive, computed, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Plus, Back, Expand, Fold } from '@element-plus/icons-vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  modelValue: { type: String, default: '' }, // 当前选中节点 key
  title: { type: String, default: '系统 · 模块' },
  leafGroups: { type: Function, default: null }, // (module) => groups[]
  showEditJump: { type: Boolean, default: false }, // 右键是否含「在链路连接管理中编辑」
  emptyText: { type: String, default: '暂无系统/模块，请先在链路连接管理添加' },
  leafContextActions: { type: Function, default: null }, // (leafData) => [{ label, action, danger? }]
  moduleContextActions: { type: Function, default: null }, // (moduleData) => [{ label, action, danger? }]
  draggableLeaves: { type: Boolean, default: false },
  bodyStyle: {
    type: Object,
    default: () => ({ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' })
  }
})
const emit = defineEmits(['update:modelValue', 'select', 'add-leaf', 'delete-leaf', 'leaf-action', 'module-action', 'node-drag-start'])

const systemStore = useSystemStore()
const connStore = useConnectionStore()
const router = useRouter()

const modulesAreLeaves = computed(() => !props.leafGroups)
const treeRef = ref()
const expandedKeys = ref([])
const collapsedKeys = ref(new Set())
const knownExpandableKeys = ref(new Set())
const expansionReady = ref(false)
const treeFullyExpanded = computed(() => {
  const keys = collectExpandableKeys(treeData.value)
  return keys.length > 0 && keys.every((key) => expandedKeys.value.includes(key))
})
const titleLines = computed(() => {
  const parts = props.title.split(' · ')
  if (parts.length <= 2) return [props.title]
  return [parts.slice(0, -1).join(' · '), parts.at(-1)]
})

/* ---- 层级树：系统 → 模块 → (叶子组 → 叶子) ---- */
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
        const groups = props.leafGroups ? (props.leafGroups(mod) || []) : []
        return {
          key: `mod-${mod.id}`,
          kind: 'module',
          icon: 'Connection',
          label: mod.name,
          ref: mod,
          sys,
          addActions: groups.map((g) => ({ groupKind: g.kind, label: g.addLabel, type: g.addType })),
          children: groups.flatMap((g) =>
            g.flat
              ? (g.items || []).map((item) => ({ ...item, module: mod }))
              : [{
                  key: g.key,
                  kind: g.kind,
                  icon: g.icon,
                  label: g.label,
                  count: g.count,
                  module: mod,
                  children: (g.items || []).map((item) => ({ ...item }))
                }]
          )
        }
      })
  }))
})

const collectExpandableKeys = (nodes) => {
  const keys = []
  const walk = (items) => {
    items.forEach((item) => {
      if (item.children?.length) {
        keys.push(item.key)
        walk(item.children)
      }
    })
  }
  walk(nodes)
  return keys
}
const isKeyVisible = (targetKey, nodes, ancestors = []) => {
  if (!targetKey) return false
  for (const item of nodes) {
    const hiddenByCollapsedParent = ancestors.some((key) => collapsedKeys.value.has(key))
    if (item.key === targetKey) return !hiddenByCollapsedParent
    if (item.children?.length) {
      const visible = isKeyVisible(targetKey, item.children, [...ancestors, item.key])
      if (visible) return true
    }
  }
  return false
}
const visibleCurrentNodeKey = computed(() => (
  isKeyVisible(props.modelValue, treeData.value) ? props.modelValue : null
))

const applyCollapsedKeys = () => {
  nextTick(() => {
    collapsedKeys.value.forEach((key) => {
      treeRef.value?.getNode?.(key)?.collapse()
    })
  })
}
const applyExpandedKeys = () => {
  nextTick(() => {
    expandedKeys.value.forEach((key) => {
      treeRef.value?.getNode?.(key)?.expand(null, false)
    })
  })
}

watch(
  treeData,
  (nodes) => {
    const expandableKeys = collectExpandableKeys(nodes)
    const currentKeySet = new Set(expandableKeys)

    if (!expansionReady.value) {
      expandedKeys.value = expandableKeys
      knownExpandableKeys.value = currentKeySet
      expansionReady.value = true
      return
    }

    const previousKeys = knownExpandableKeys.value
    const newlyAddedKeys = expandableKeys.filter((key) => !previousKeys.has(key))
    collapsedKeys.value = new Set([...collapsedKeys.value].filter((key) => currentKeySet.has(key)))
    expandedKeys.value = [
      ...expandedKeys.value.filter((key) => currentKeySet.has(key)),
      ...newlyAddedKeys
    ]
    knownExpandableKeys.value = currentKeySet
    applyCollapsedKeys()
  },
  { immediate: true, deep: true, flush: 'post' }
)

const onNodeExpand = (data) => {
  const next = new Set(collapsedKeys.value)
  next.delete(data.key)
  collapsedKeys.value = next
  if (!expandedKeys.value.includes(data.key)) expandedKeys.value = [...expandedKeys.value, data.key]
}
const onNodeCollapse = (data) => {
  collapsedKeys.value = new Set([...collapsedKeys.value, data.key])
  expandedKeys.value = expandedKeys.value.filter((key) => key !== data.key)
}

const expandAll = () => {
  expandedKeys.value = collectExpandableKeys(treeData.value)
  collapsedKeys.value = new Set()
  applyExpandedKeys()
}
const collapseAll = () => {
  const keys = collectExpandableKeys(treeData.value)
  expandedKeys.value = []
  collapsedKeys.value = new Set(keys)
  applyCollapsedKeys()
}
const toggleAll = () => {
  if (treeFullyExpanded.value) collapseAll()
  else expandAll()
}

/* ---- 选择：叶子（无 leafGroups 时为模块；否则为叶子项） ---- */
const isSelectableLeaf = (d) =>
  (d.kind === 'module' && modulesAreLeaves.value) ||
  (!!d.ref && d.kind !== 'system' && d.kind !== 'module')
const onNodeClick = (d) => {
  if (isSelectableLeaf(d)) {
    emit('update:modelValue', d.key)
    emit('select', d)
  }
}
const onDragStart = (event, data) => {
  if (!props.draggableLeaves || !isSelectableLeaf(data)) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify({
    key: data.key,
    kind: data.kind,
    id: data.ref?.id || '',
  }))
  event.dataTransfer.setData('text/plain', data.ref?.id || data.key)
  emit('node-drag-start', data)
}

/* ---- 命名（弹窗输入，留空用默认名；IDE 式：新建后立即可命名） ---- */
const DEFAULT_NAME = { system: '新建系统', module: '新建模块' }
const fallbackName = (kind) => DEFAULT_NAME[kind] || '未命名'
const promptName = (obj, kind, title) => {
  const fb = fallbackName(kind)
  ElMessageBox.prompt(title, '命名', {
    inputValue: obj.name || '',
    inputPlaceholder: `留空默认「${fb}」`,
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  })
    .then(({ value }) => { obj.name = (value || '').trim() || fb })
    .catch(() => { if (!obj.name) obj.name = fb })
}
const startRename = (data) => { if (data?.ref) promptName(data.ref, data.kind, '重命名') }

/* ---- 新建（默认名创建，随后可重命名） ---- */
const newSystem = () => { systemStore.add({ name: DEFAULT_NAME.system }) }
const newModule = (sysNode) => { connStore.add({ name: DEFAULT_NAME.module, systemId: sysNode.ref.id, ip: '192.168.1.1', port: 8080 }) }
const addLeaf = (groupKind, modNode) => { emit('add-leaf', { groupKind, module: modNode.ref }) }
const emitLeafAction = (action) => { emit('leaf-action', { action, data: ctx.data }); closeCtx() }
const emitModuleAction = (action) => { emit('module-action', { action, data: ctx.data }); closeCtx() }
const clearFilter = () => systemStore.setCurrent(null)

/* ---- 右键菜单 ---- */
const ctx = reactive({ visible: false, x: 0, y: 0, data: null })
const onContextMenu = (event, data) => {
  if (!data || !data.ref) return // 叶子组（无 ref）不弹菜单
  event.preventDefault()
  Object.assign(ctx, { visible: true, x: event.clientX, y: event.clientY, data })
}
const closeCtx = () => { ctx.visible = false }
const ctxRename = () => { startRename(ctx.data); closeCtx() }
const ctxNewModule = () => { newModule(ctx.data); closeCtx() }
const ctxAddLeaf = (groupKind) => { addLeaf(groupKind, ctx.data); closeCtx() }
const ctxDelete = () => {
  const d = ctx.data
  if (d.kind === 'system') { connStore.unassignSystem(d.ref.id); systemStore.remove(d.ref.id) }
  else if (d.kind === 'module') connStore.remove(d.ref.id)
  else emit('delete-leaf', d)
  closeCtx()
}
// 编辑 = 跳转到链路连接管理定位该系统/模块
const ctxEdit = () => {
  const d = ctx.data
  if (d.kind === 'system') systemStore.setCurrent(d.ref.id)
  else if (d.kind === 'module') { systemStore.setCurrent(d.ref.systemId); connStore.select(d.ref.id) }
  router.push('/connection')
  closeCtx()
}
</script>

<style scoped lang="scss">
/* 不设 height:100%（父高为 auto 时会塌回内容高）；靠父级 align-items:stretch 撑高 */
.smt {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.smt__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.smt__title { display: flex; flex-direction: column; min-width: 0; font-size: 14px; font-weight: 600; line-height: 1.35; }
.smt__title-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.smt__head-actions { display: flex; align-items: center; gap: 4px; }
.smt__scroll { flex: 1; min-height: 0; padding: 6px 4px; }

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
  &__badge {
    font-size: 11px; color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light); border-radius: 4px; padding: 0 4px;
    font-family: 'Consolas', 'Monaco', monospace;
  }
  &__ops { display: none; gap: 2px; }
  &:hover &__ops { display: inline-flex; }

  &--system { font-weight: 600; }
  &--system .tnode__icon { color: var(--el-color-primary); }
  &--module { font-weight: 500; }
  &--protocol .tnode__icon { color: var(--el-color-warning); }
  &--interface .tnode__icon { color: var(--el-color-success); }
  &--draggable { cursor: grab; }
  &--draggable:active { cursor: grabbing; }
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
    &.ctx-sep { height: 1px; padding: 0; margin: 4px 8px; background: var(--el-border-color-lighter); cursor: default; pointer-events: none; }
  }
}
</style>
