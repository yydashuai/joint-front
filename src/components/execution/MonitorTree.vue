<template>
  <el-card class="mtree" shadow="never" :body-style="bodyStyle">
    <template #header>
      <div class="mtree__head">
        <span class="mtree__title">{{ title }}</span>
        <el-button link type="info" size="small" :icon="treeFullyExpanded ? Fold : Expand" @click="toggleAll">
          {{ treeFullyExpanded ? '全部收起' : '全部展开' }}
        </el-button>
      </div>
    </template>

    <el-scrollbar class="mtree__scroll">
      <el-tree
        ref="treeRef"
        :data="treeData"
        node-key="key"
        :default-expanded-keys="expandedKeys"
        highlight-current
        :current-node-key="visibleCurrentNodeKey"
        :expand-on-click-node="true"
        @node-expand="onNodeExpand"
        @node-collapse="onNodeCollapse"
        @node-click="onNodeClick"
        @node-contextmenu="onContextMenu"
      >
        <template #default="{ data }">
          <div
            class="tnode"
            :class="[`tnode--${data.kind}`, { 'tnode--draggable': isDraggableLeaf(data) }]"
            :draggable="isDraggableLeaf(data)"
            @dragstart="onDragStart($event, data)"
          >
            <el-icon class="tnode__icon"><component :is="data.icon" /></el-icon>
            <span class="tnode__label">{{ data.label }}</span>
            <span v-if="data.badge" class="tnode__badge">{{ data.badge }}</span>
            <span v-if="data.count !== undefined" class="tnode__count">{{ data.count }}</span>
            <span v-if="data.addActions?.length" class="tnode__ops">
              <el-button
                v-for="a in data.addActions"
                :key="a.groupKind"
                link
                :type="a.type || 'primary'"
                size="small"
                @click.stop="emitAdd(a.groupKind)"
              >{{ a.label }}</el-button>
            </span>
          </div>
        </template>
      </el-tree>
      <el-empty v-if="!treeData.length" :description="emptyText" :image-size="70" />
    </el-scrollbar>

    <!-- 右键菜单 -->
    <teleport to="body">
      <div v-if="!readonly && ctx.visible" class="ctx-mask" @click="closeCtx" @contextmenu.prevent="closeCtx">
        <ul class="ctx-menu" :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }" @click.stop>
          <li v-for="act in ctxActions" :key="act.action" :class="{ danger: act.danger }" @click="emitAction(act.action)">
            {{ act.label }}
          </li>
        </ul>
      </div>
    </teleport>
  </el-card>
</template>

<script setup>
/**
 * 接口收发监控专用树：三个固定顶级分组（系统接口 / 方案 / 自定义接口）。
 * - 不再展示与管理系统、模块层级。
 * - 系统接口：接口直挂报文（1:N，排他归属）；接口展开显示其报文，报文徽标 = 传输类型·字段数。
 * - 方案：叶子 = 接口方案，展开显示方案内接口（系统接口可继续展开报文；自定义接口为密文叶子）。
 * - 自定义接口：密文接口为叶子，无报文/字段（点击不打开界面，仅右键/拖拽可用）。
 * 徽标由页面通过 badge 函数注入，避免组件耦合具体 store 计算。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Fold, Expand } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useCustomIfaceStore } from '@/stores/customIface'

const props = defineProps({
  modelValue: { type: String, default: '' },
  title: { type: String, default: '接口监控树' },
  search: { type: String, default: '' },
  emptyText: { type: String, default: '暂无接口，请先在报文/数据管理中定义' },
  ifaceBadge: { type: Function, default: () => '' },
  schemeBadge: { type: Function, default: () => '' },
  customBadge: { type: Function, default: () => '' },
  messageBadge: { type: Function, default: null }, // 缺省按「传输类型·N字段」计算
  editorMode: { type: Boolean, default: false },    // 编辑器模式（报文字段管理页）：精简右键菜单、仅系统接口分组显示添加按钮
  readonly: { type: Boolean, default: false },      // 资产筛选模式：禁用拖拽、右键菜单和新增入口
  visibleGroups: { type: Array, default: () => ['system', 'scheme', 'custom'] },
  extraContextActions: { type: Function, default: () => [] }, // 节点额外右键项，如 [{label, action}]
  bodyStyle: {
    type: Object,
    default: () => ({ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }),
  },
})
const emit = defineEmits(['update:modelValue', 'select', 'add-leaf', 'delete-leaf', 'leaf-action'])

const protocolStore = useProtocolStore()
const schemeStore = usePlanSchemeStore()
const customStore = useCustomIfaceStore()

const treeRef = ref()
const expandedKeys = ref([])
const collapsedKeys = ref(new Set())
const expansionReady = ref(false)

const matches = (name, desc = '') => {
  const kw = props.search.trim().toLowerCase()
  if (!kw) return true
  return name.toLowerCase().includes(kw) || desc.toLowerCase().includes(kw)
}

/* ---- 报文节点（排他归属：接口直挂报文 1:N） ---- */
const ifaceMessages = (iface) => (iface?.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)
const defaultMessageBadge = (m) => m.fileId
  ? `文件·${m.transportType || '—'}`
  : `${m.transportType || '—'}·${(m.protocolRefs || []).length} 字段`
const messageBadgeOf = (m) => (props.messageBadge ? props.messageBadge(m) : defaultMessageBadge(m))
const messageNode = (m) => ({
  key: `msg-${m.id}`,
  kind: 'message',
  icon: 'Document',
  label: m.name,
  badge: messageBadgeOf(m),
  ref: m,
})

const schemeChildren = (scheme) => (scheme.interfaceIds || [])
  .map((id) => {
    const sys = protocolStore.testInterfaces.find((i) => String(i.id) === String(id))
    if (sys) return {
      key: `sin-${id}`,
      kind: 'schemeItem',
      icon: 'Link',
      label: sys.name,
      badge: props.ifaceBadge(sys) || '系统',
      ref: sys,
      children: ifaceMessages(sys).map(messageNode),
    }
    const custom = customStore.byId(id)
    if (custom) return { key: `cin-${id}`, kind: 'schemeItem', icon: 'Lock', label: custom.name, badge: '自定义', ref: custom }
    return null
  })
  .filter(Boolean)

const treeData = computed(() => {
  const sysIfaces = protocolStore.testInterfaces.filter((i) => matches(i.name, i.desc))
  const schemes = schemeStore.schemes
    .filter((s) => matches(s.name, s.remark))
    .map((s) => ({
      key: `scheme-${s.id}`,
      kind: 'scheme',
      icon: 'Notebook',
      label: s.name,
      badge: props.schemeBadge(s),
      ref: s,
      children: schemeChildren(s),
    }))
  const customs = customStore.customIfaces
    .filter((i) => matches(i.name, i.remark))
    .map((i) => ({
      key: `custom-${i.id}`,
      kind: 'custom',
      icon: 'Lock',
      label: i.name,
      badge: props.customBadge(i),
      ref: i,
    }))
  return [
    {
      key: 'grp-sys',
      kind: 'groupSys',
      icon: 'FolderOpened',
      label: '系统接口',
      count: sysIfaces.length,
      groupName: 'system',
      addActions: props.readonly ? [] : [{ groupKind: 'iface', label: '+接口', type: 'success' }],
      children: sysIfaces.map((i) => ({
        key: `iface-${i.id}`,
        kind: 'iface',
        icon: 'Link',
        label: i.name,
        badge: props.ifaceBadge(i),
        ref: i,
        children: ifaceMessages(i).map(messageNode),
      })),
    },
    {
      key: 'grp-scheme',
      kind: 'groupScheme',
      icon: 'FolderOpened',
      label: '方案',
      count: schemes.length,
      groupName: 'scheme',
      addActions: props.editorMode || props.readonly ? [] : [{ groupKind: 'scheme', label: '+方案', type: 'warning' }],
      children: schemes,
    },
    {
      key: 'grp-custom',
      kind: 'groupCustom',
      icon: 'FolderOpened',
      label: '自定义接口',
      count: customs.length,
      groupName: 'custom',
      addActions: props.editorMode || props.readonly ? [] : [{ groupKind: 'custom', label: '+自定义', type: 'primary' }],
      children: customs,
    },
  ].filter((g) => props.visibleGroups.includes(g.groupName))
    .filter((g) => g.children.length || !props.search)
})

/* ---- 展开/收起状态 ---- */
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
const treeFullyExpanded = computed(() => {
  const keys = collectExpandableKeys(treeData.value)
  return keys.length > 0 && keys.every((k) => expandedKeys.value.includes(k))
})

watch(treeData, (nodes) => {
  const expandable = collectExpandableKeys(nodes)
  const current = new Set(expandable)
  if (!expansionReady.value) {
    expandedKeys.value = expandable
    expansionReady.value = true
    return
  }
  const newly = expandable.filter((k) => !expandedKeys.value.includes(k))
  collapsedKeys.value = new Set([...collapsedKeys.value].filter((k) => current.has(k)))
  expandedKeys.value = [...expandedKeys.value.filter((k) => current.has(k)), ...newly]
  nextTick(() => collapsedKeys.value.forEach((k) => treeRef.value?.getNode?.(k)?.collapse()))
}, { immediate: true, deep: true, flush: 'post' })

const onNodeExpand = (data) => {
  collapsedKeys.value = new Set([...collapsedKeys.value].filter((k) => k !== data.key))
  if (!expandedKeys.value.includes(data.key)) expandedKeys.value = [...expandedKeys.value, data.key]
}
const onNodeCollapse = (data) => {
  collapsedKeys.value = new Set([...collapsedKeys.value, data.key])
  expandedKeys.value = expandedKeys.value.filter((k) => k !== data.key)
}
const expandAll = () => {
  expandedKeys.value = collectExpandableKeys(treeData.value)
  collapsedKeys.value = new Set()
  nextTick(() => expandedKeys.value.forEach((k) => treeRef.value?.getNode?.(k)?.expand(null, false)))
}
const collapseAll = () => {
  expandedKeys.value = []
  collapsedKeys.value = new Set(collectExpandableKeys(treeData.value))
  nextTick(() => collapsedKeys.value.forEach((k) => treeRef.value?.getNode?.(k)?.collapse()))
}
const toggleAll = () => (treeFullyExpanded.value ? collapseAll() : expandAll())

/* ---- 选中与拖拽 ---- */
const isSelectableLeaf = (d) => ['iface', 'custom', 'scheme', 'message'].includes(d.kind) && !!d.ref
const isDraggableLeaf = (d) => !props.readonly && ['iface', 'custom', 'scheme', 'message'].includes(d.kind) && !!d.ref

const visibleCurrentNodeKey = computed(() => props.modelValue || null)

const onNodeClick = (d) => {
  if (isSelectableLeaf(d)) {
    emit('update:modelValue', d.key)
    emit('select', d)
  }
}
const onDragStart = (event, data) => {
  if (!isDraggableLeaf(data)) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify({
    key: data.key,
    kind: data.kind,
    id: data.ref?.id || '',
    source: data.kind === 'iface' ? 'sys' : data.kind,
  }))
  event.dataTransfer.setData('text/plain', data.ref?.id || data.key)
}

const emitAdd = (groupKind) => emit('add-leaf', { groupKind })

/* ---- 右键菜单 ---- */
const ctx = ref({ visible: false, x: 0, y: 0, data: null })
const onContextMenu = (event, data) => {
  if (props.readonly) return
  if (!data?.ref || !['iface', 'custom', 'scheme', 'message'].includes(data.kind)) return
  event.preventDefault()
  ctx.value = { visible: true, x: event.clientX, y: event.clientY, data }
}
const closeCtx = () => { ctx.value.visible = false }

const ctxActions = computed(() => {
  const d = ctx.value.data
  if (!d) return []
  const extra = props.extraContextActions ? props.extraContextActions(d) : []
  if (d.kind === 'scheme') return [
    { label: '编辑方案', action: 'edit-scheme' },
    { label: '删除', action: 'delete-scheme', danger: true },
  ]
  if (d.kind === 'custom') {
    // 编辑器模式：密文接口无报文/字段配置，仅保留删除
    if (props.editorMode) return [{ label: '删除', action: 'delete-custom', danger: true }]
    return [
      { label: '配置接口', action: 'config-custom' },
      { label: '监听配置', action: 'listen-custom' },
      { label: '加入发送监控', action: 'custom-to-send' },
      { label: '加入接收监控', action: 'custom-to-receive' },
      { label: '立即发送', action: 'custom-test' },
      { label: '删除', action: 'delete-custom', danger: true },
    ]
  }
  if (d.kind === 'message') {
    const base = props.editorMode
      ? [{ label: '编辑', action: 'config-message' }]
      : [
          { label: '配置报文', action: 'config-message' },
          { label: '加入发送监控', action: 'message-to-send' },
          { label: '加入接收监控', action: 'message-to-receive' },
          { label: '立即发送', action: 'message-test' },
        ]
    return [...base, ...extra, { label: '删除', action: 'delete-message', danger: true }]
  }
  const base = [
    { label: '配置接口', action: 'config-iface' },
    { label: '添加报文', action: 'add-message' },
  ]
  if (!props.editorMode) {
    base.push(
      { label: '加入发送监控', action: 'iface-to-send' },
      { label: '加入接收监控', action: 'iface-to-receive' },
      { label: '立即发送', action: 'iface-test' },
    )
  }
  return [...base, ...extra, { label: '删除', action: 'delete-iface', danger: true }]
})
const emitAction = (action) => {
  emit('leaf-action', { action, data: ctx.value.data })
  closeCtx()
}
</script>

<style scoped lang="scss">
.mtree {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mtree__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.mtree__title { font-size: 14px; font-weight: 600; line-height: 1.35; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mtree__scroll { flex: 1; min-height: 0; padding: 6px 4px; }

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
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    background: var(--el-fill-color);
    border-radius: 8px;
    padding: 0 6px;
    flex-shrink: 0;
  }
  &__badge {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    border-radius: 4px;
    padding: 0 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    flex-shrink: 0;
  }
  &__ops { display: inline-flex; flex-shrink: 0; gap: 2px; white-space: nowrap; }
  &--groupSys, &--groupScheme, &--groupCustom { font-weight: 600; }
  &--groupSys .tnode__icon { color: var(--el-color-success); }
  &--groupScheme .tnode__icon { color: var(--el-color-warning); }
  &--groupCustom .tnode__icon { color: var(--el-color-primary); }
  &--iface .tnode__icon { color: var(--el-color-success); }
  &--scheme .tnode__icon { color: #e6a23c; }
  &--custom .tnode__icon { color: var(--el-color-primary); }
  &--message .tnode__icon { color: var(--el-text-color-secondary); }
  &--message { font-size: 12px; }
  &--message .tnode__badge { font-size: 10px; }
  &--schemeItem .tnode__icon { color: var(--el-text-color-secondary); }
  &--schemeItem { font-size: 12px; }
  &--schemeItem .tnode__badge { font-size: 10px; }
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
  }
}
</style>
