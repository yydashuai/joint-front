<template>
  <el-card class="smt" shadow="never" :body-style="bodyStyle">
    <template #header>
      <div class="smt__head">
        <span class="smt__title">{{ title }}</span>
        <div class="smt__head-actions">
          <el-button v-if="!systemStore.isAll" link type="info" size="small" :icon="Back" @click="clearFilter">全部系统</el-button>
          <el-button link type="primary" size="small" :icon="Plus" @click="newSystem">新建系统</el-button>
        </div>
      </div>
    </template>

    <el-scrollbar class="smt__scroll">
      <el-tree
        :data="treeData"
        node-key="key"
        default-expand-all
        highlight-current
        :current-node-key="modelValue"
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
            <li v-if="showEditJump" @click="ctxEdit">在链路连接管理中编辑</li>
            <li class="danger" @click="ctxDelete">删除模块</li>
          </template>
          <template v-else>
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
import { reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Plus, Back } from '@element-plus/icons-vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'

const props = defineProps({
  modelValue: { type: String, default: '' }, // 当前选中节点 key
  title: { type: String, default: '系统 · 模块' },
  leafGroups: { type: Function, default: null }, // (module) => groups[]
  showEditJump: { type: Boolean, default: false }, // 右键是否含「在链路连接管理中编辑」
  emptyText: { type: String, default: '暂无系统/模块，请先在链路连接管理添加' },
  bodyStyle: {
    type: Object,
    default: () => ({ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' })
  }
})
const emit = defineEmits(['update:modelValue', 'select', 'add-leaf', 'delete-leaf'])

const systemStore = useSystemStore()
const connStore = useConnectionStore()
const router = useRouter()

const modulesAreLeaves = computed(() => !props.leafGroups)

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
          children: groups.map((g) => ({
            key: g.key,
            kind: g.kind,
            icon: g.icon,
            label: g.label,
            count: g.count,
            module: mod,
            children: g.items || []
          }))
        }
      })
  }))
})

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
.smt { display: flex; flex-direction: column; min-height: 0; }
.smt__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.smt__title { font-size: 14px; font-weight: 600; }
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
  &__ops { display: none; gap: 2px; }
  &:hover &__ops { display: inline-flex; }

  &--system { font-weight: 600; }
  &--system .tnode__icon { color: var(--el-color-primary); }
  &--module { font-weight: 500; }
  &--protocol .tnode__icon { color: var(--el-color-warning); }
  &--interface .tnode__icon { color: var(--el-color-success); }
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
