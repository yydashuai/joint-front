<template>
  <el-card class="dtree" shadow="never" :body-style="bodyStyle">
    <template #header>
      <div class="dtree__head">
        <span class="dtree__title">{{ title }}</span>
        <el-button link type="info" size="small" :icon="treeFullyExpanded ? Fold : Expand" @click="toggleAll">
          {{ treeFullyExpanded ? '全部收起' : '全部展开' }}
        </el-button>
      </div>
    </template>

    <el-scrollbar class="dtree__scroll">
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
          <div class="tnode" :class="`tnode--${data.kind}`">
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
      <div v-if="ctx.visible" class="ctx-mask" @click="closeCtx" @contextmenu.prevent="closeCtx">
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
 * 测试数据集树：三个固定顶级分组。
 * - 系统接口：接口 → 报文 → 数据集（接口直挂报文 1:N，报文直挂数据集 1:N）。
 * - 数据集方案：方案 → 数据集成员。
 * - 未关联报文：游离数据集（messageId 未指向有效报文的旧数据兼容）。
 * 密文接口（自定义接口）无报文/字段，不在此树展示。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Fold, Expand } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useDatasetSchemeStore } from '@/stores/datasetScheme'

const props = defineProps({
  modelValue: { type: String, default: '' },
  title: { type: String, default: '测试数据集' },
  search: { type: String, default: '' },
  emptyText: { type: String, default: '暂无数据集，请先配置报文并新建数据集' },
  datasetBadge: { type: Function, default: null }, // 缺省按「N 行」计算
  bodyStyle: {
    type: Object,
    default: () => ({ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }),
  },
})
const emit = defineEmits(['update:modelValue', 'select', 'add-leaf', 'leaf-action'])

const protocolStore = useProtocolStore()
const tdStore = useTestDataStore()
const schemeStore = useDatasetSchemeStore()

const treeRef = ref()
const expandedKeys = ref([])
const collapsedKeys = ref(new Set())
const expansionReady = ref(false)

/* ---- 数据解析 ---- */
const matches = (name, desc = '') => {
  const kw = props.search.trim().toLowerCase()
  if (!kw) return true
  return name.toLowerCase().includes(kw) || desc.toLowerCase().includes(kw)
}
const rowCountOf = (ds) => (ds.rows || []).length
const datasetBadgeOf = (ds) => (props.datasetBadge ? props.datasetBadge(ds) : `${rowCountOf(ds)} 行`)
const ifaceMessages = (iface) => (iface?.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)
const messageDatasets = (message) => tdStore.datasets.filter((d) => String(d.messageId) === String(message.id))

const datasetNode = (ds) => ({
  key: `ds-${ds.id}`,
  kind: 'dataset',
  icon: 'Grid',
  label: ds.name,
  badge: datasetBadgeOf(ds),
  ref: ds,
})
const messageNode = (m) => ({
  key: `msg-${m.id}`,
  kind: 'message',
  icon: 'Document',
  label: m.name,
  badge: `${messageDatasets(m).length} 数据集`,
  ref: m,
  children: messageDatasets(m).map(datasetNode),
})
const ifaceNode = (i) => ({
  key: `iface-${i.id}`,
  kind: 'iface',
  icon: 'Link',
  label: i.name,
  badge: `${ifaceMessages(i).length} 报文`,
  ref: i,
  children: ifaceMessages(i).map(messageNode),
})

const treeData = computed(() => {
  // 分组① 系统接口：接口 → 报文 → 数据集
  const ifaces = protocolStore.testInterfaces
    .filter((i) => matches(i.name, i.desc))
    .map(ifaceNode)
  // 分组② 数据集方案
  const schemes = schemeStore.schemes
    .filter((s) => matches(s.name, s.remark || ''))
    .map((s) => ({
      key: `dsScheme-${s.id}`,
      kind: 'scheme',
      icon: 'Notebook',
      label: s.name,
      badge: `${(s.datasetIds || []).length} 数据集`,
      ref: s,
      children: (s.datasetIds || [])
        .map((id) => tdStore.datasets.find((d) => String(d.id) === String(id)))
        .filter(Boolean)
        .map(datasetNode),
    }))
  // 分组③ 未关联报文：游离数据集（无 messageId 或指向不存在报文）
  const validMessageIds = new Set(protocolStore.interfaces.map((m) => String(m.id)))
  const orphans = tdStore.datasets.filter((d) => {
    if (!matches(d.name, d.desc)) return false
    if (d.messageId == null || d.messageId === '') return true
    return !validMessageIds.has(String(d.messageId))
  })
  return [
    {
      key: 'grp-iface',
      kind: 'groupIface',
      icon: 'FolderOpened',
      label: '系统接口',
      count: ifaces.length,
      addActions: [{ groupKind: 'iface', label: '+接口', type: 'success' }],
      children: ifaces,
    },
    {
      key: 'grp-scheme',
      kind: 'groupScheme',
      icon: 'FolderOpened',
      label: '数据集方案',
      count: schemes.length,
      addActions: [{ groupKind: 'scheme', label: '+方案', type: 'warning' }],
      children: schemes,
    },
    {
      key: 'grp-orphan',
      kind: 'groupOrphan',
      icon: 'FolderOpened',
      label: '未关联报文',
      count: orphans.length,
      children: orphans.map(datasetNode),
    },
  ].filter((g) => g.children.length || !props.search)
})

/* ---- 展开/收起状态（同接口监控树） ---- */
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

/* ---- 选中与事件 ---- */
const visibleCurrentNodeKey = computed(() => props.modelValue || null)
const selectableKinds = ['dataset', 'message', 'iface', 'scheme']
const onNodeClick = (d) => {
  if (!selectableKinds.includes(d.kind) || !d.ref) return
  // 接口节点仅展开（右侧无接口详情需求），其余节点触发选中
  if (d.kind === 'iface') return
  emit('update:modelValue', d.key)
  emit('select', d)
}
const emitAdd = (groupKind) => emit('add-leaf', { groupKind })

/* ---- 右键菜单 ---- */
const ctx = ref({ visible: false, x: 0, y: 0, data: null })
const onContextMenu = (event, data) => {
  if (!data?.ref || !selectableKinds.includes(data.kind)) return
  event.preventDefault()
  ctx.value = { visible: true, x: event.clientX, y: event.clientY, data }
}
const closeCtx = () => { ctx.value.visible = false }

const ctxActions = computed(() => {
  const d = ctx.value.data
  if (!d) return []
  if (d.kind === 'dataset') return [
    { label: '编辑', action: 'edit-dataset' },
    { label: '复制数据集', action: 'copy-dataset' },
    { label: '粘贴到该报文', action: 'paste-dataset' },
    { label: '删除', action: 'delete-dataset', danger: true },
  ]
  if (d.kind === 'message') return [
    { label: '新建数据集', action: 'new-dataset' },
    { label: '配置报文', action: 'config-message' },
  ]
  if (d.kind === 'iface') return [
    { label: '配置接口', action: 'config-iface' },
    { label: '新建报文', action: 'add-message' },
  ]
  return [
    { label: '编辑方案', action: 'edit-scheme' },
    { label: '删除', action: 'delete-scheme', danger: true },
  ]
})
const emitAction = (action) => {
  emit('leaf-action', { action, data: ctx.value.data })
  closeCtx()
}
</script>

<style scoped lang="scss">
.dtree {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.dtree__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dtree__title { font-size: 14px; font-weight: 600; line-height: 1.35; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dtree__scroll { flex: 1; min-height: 0; padding: 6px 4px; }

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
  &--groupIface, &--groupScheme, &--groupOrphan { font-weight: 600; }
  &--groupIface .tnode__icon { color: var(--el-color-success); }
  &--groupScheme .tnode__icon { color: var(--el-color-warning); }
  &--groupOrphan .tnode__icon { color: var(--el-text-color-placeholder); }
  &--iface .tnode__icon { color: var(--el-color-success); }
  &--message .tnode__icon { color: var(--el-text-color-secondary); }
  &--dataset .tnode__icon { color: var(--el-color-primary); }
  &--scheme .tnode__icon { color: #e6a23c; }
  &--message, &--dataset { font-size: 12px; }
  &--message .tnode__badge, &--dataset .tnode__badge { font-size: 10px; }
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
