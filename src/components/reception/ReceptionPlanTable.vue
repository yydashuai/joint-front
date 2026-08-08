<template>
  <div class="plan-stack">
    <el-card
      shadow="never"
      class="exec-card plan-table-card"
      :class="{ 'plan-table-card--dragover': dragOver }"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <template #header>
        <div class="card-head">
          <div class="card-head__left">
            <span class="card-title">接收接口列表</span>
            <span v-if="items.length" class="plan-count">{{ items.length }} 个接口</span>
          </div>
          <div class="plan-actions">
            <el-button v-if="items.length" link size="small" :disabled="running" @click="userCollapsed = !userCollapsed">
              {{ collapsed ? '展开计划' : '收起计划' }}
            </el-button>
            <el-tooltip content="将选中的接口添加到接收编排">
              <el-button
                type="primary"
                plain
                :icon="Plus"
                :disabled="!selectedIface || selectedInPlan"
                @click="$emit('add-selected')"
              >
                {{ selectedInPlan ? '已在编排中' : '添加选中接口' }}
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>

      <div v-if="items.length && collapsed" class="plan-summary">
        <div class="plan-summary__names">
          <el-tag v-for="item in items.slice(0, 3)" :key="item.id" size="small" effect="plain">
            {{ item.iface?.name }}
          </el-tag>
          <span v-if="items.length > 3">等 {{ items.length }} 个接口</span>
        </div>
        <span>开始后监听计划内全部接口</span>
      </div>

      <el-table
        v-else-if="items.length"
        ref="tableRef"
        :data="items"
        row-key="id"
        size="small"
        empty-text="暂无接收编排"
      >
        <el-table-column width="44" align="center">
          <template #default>
            <el-icon class="drag-handle"><Rank /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="接口名" min-width="220">
          <template #default="{ row }">
            <div class="strong">
              {{ row.iface?.name }}
              <el-tag v-if="row.isCustom" size="small" type="primary" effect="plain" class="src-tag">自定义</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.isCustom">监听 {{ row.iface.listenConfig?.ip || '—' }} / {{ row.iface.listenConfig?.protocol || row.iface.transportType || '—' }} / {{ row.iface.listenConfig?.messageId || '全部消息' }}</span>
            <span v-else>{{ row.iface?.desc || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-popconfirm title="确认从编排中移除？" @confirm="store.removeFromPlan(row.id)">
              <template #reference><el-button link type="danger" size="small" :disabled="['listening', 'paused'].includes(store.status)">移除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else class="plan-empty" :image-size="72" description="从左侧接口树拖入或选中添加接收接口；自定义接口需先配置监听（IP/协议/消息号）" />
    </el-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { Plus, Rank } from '@element-plus/icons-vue'
import { useReceptionStore } from '@/stores/reception'

defineProps({
  selectedIface: { type: Object, default: null },
  selectedInPlan: { type: Boolean, default: false },
})
const emit = defineEmits(['add-selected', 'drop-iface', 'drop-custom', 'drop-scheme', 'reset-run'])

const store = useReceptionStore()
const tableRef = ref()
const items = computed(() => store.planItems)
const dragOver = ref(false)
const userCollapsed = ref(false)
const running = computed(() => ['listening', 'paused'].includes(store.status))
const collapsed = computed(() => running.value || userCollapsed.value)
let sortable = null

const onDragOver = (event) => {
  event.dataTransfer.dropEffect = 'copy'
  dragOver.value = true
}
const onDragLeave = (event) => {
  if (!event.currentTarget.contains(event.relatedTarget)) dragOver.value = false
}
const onDrop = (event) => {
  dragOver.value = false
  const raw = event.dataTransfer.getData('application/json')
  let payload = null
  try { payload = raw ? JSON.parse(raw) : null } catch { payload = null }
  // 接口方案拖入：拖到接收列表时按接收方向加入
  if (payload?.kind === 'scheme' && payload.id) {
    emit('drop-scheme', payload.id)
    return
  }
  // 系统接口叶子拖入
  if (payload?.kind === 'iface' && payload.id) {
    emit('drop-iface', payload.id)
    return
  }
  // 自定义接口叶子拖入
  if (payload?.kind === 'custom' && payload.id) {
    emit('drop-custom', payload.id)
  }
}

const setupSortable = () => {
  sortable?.destroy()
  sortable = null
  nextTick(() => {
    const tbody = tableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody')
    if (!tbody || items.value.length < 2) return
    sortable = Sortable.create(tbody, {
      handle: '.drag-handle',
      animation: 150,
      onEnd: ({ oldIndex, newIndex }) => store.reorder(oldIndex, newIndex),
    })
  })
}

watch(() => items.value.length, (length, oldLength) => {
  if (!length) userCollapsed.value = false
  else if (!oldLength || length > oldLength) userCollapsed.value = true
}, { immediate: true })
watch([() => items.value.length, collapsed], setupSortable, { immediate: true })
onBeforeUnmount(() => sortable?.destroy())
</script>

<style scoped lang="scss">
.plan-stack { display: flex; flex: 0 0 auto; flex-direction: column; gap: 14px; }
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-head__left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
.plan-count { color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; }
.card-sub { color: var(--el-text-color-secondary); font-size: 12px; }
.plan-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.plan-table-card {
  border: 1px solid var(--el-border-color-lighter);
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
  :deep(.el-card__body) {
    box-sizing: border-box;
  }
  :deep(.el-table__header-wrapper th.el-table__cell),
  :deep(.el-table__body-wrapper td.el-table__cell) {
    height: 40px;
  }
  :deep(.el-table__body-wrapper .cell) {
    white-space: nowrap;
  }
}
.plan-summary {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.plan-summary__names { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; }
.plan-table-card--dragover {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-9);
  background: linear-gradient(0deg, rgba(47, 111, 235, .04), rgba(47, 111, 235, .04)), var(--el-bg-color);
}
.strong { font-weight: 600; }
.src-tag { margin-left: 6px; transform: translateY(-1px); }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.text-danger { color: var(--el-color-danger); }
.drag-handle { cursor: grab; color: var(--el-text-color-secondary); }
.plan-empty { height: 152px; padding: 0; }
</style>
