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
          <div>
            <span class="card-title">接收接口列表</span>
          </div>
          <div class="plan-actions">
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
            <el-popconfirm title="确认重置本次监听？接收数据流将被清空" @confirm="$emit('reset-run')">
              <template #reference><el-button :icon="RefreshRight">重置本次监听</el-button></template>
            </el-popconfirm>
          </div>
        </div>
      </template>

      <el-table
        v-if="items.length"
        ref="tableRef"
        :data="items"
        :height="152"
        row-key="id"
        size="small"
        empty-text="暂无接收编排"
      >
        <el-table-column width="44" align="center">
          <template #default>
            <el-icon class="drag-handle"><Rank /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="序号" type="index" width="58" align="center" />
        <el-table-column label="接口名称" min-width="170">
          <template #default="{ row }">
            <div class="strong">{{ row.iface?.name }}</div>
          </template>
        </el-table-column>
        <el-table-column label="系统" min-width="180">
          <template #default="{ row }">
            {{ row.system?.name || '未归属系统' }}
          </template>
        </el-table-column>
        <el-table-column label="模块" min-width="160">
          <template #default="{ row }">
            <span class="status-dot" :class="`status-dot--${row.module?.status || 'offline'}`" />
            {{ row.module?.name || '未知模块' }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.iface?.desc || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-popconfirm title="确认从编排中移除？" @confirm="store.removeFromPlan(row.id)">
              <template #reference><el-button link type="danger" size="small">移除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else class="plan-empty" :image-size="72" description="从左侧接口树拖入或选中添加接收接口；接口需已配置字段定义（解析依据）" />
    </el-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { Plus, Rank, RefreshRight } from '@element-plus/icons-vue'
import { useReceptionStore } from '@/stores/reception'

defineProps({
  selectedIface: { type: Object, default: null },
  selectedInPlan: { type: Boolean, default: false },
})
const emit = defineEmits(['add-selected', 'drop-iface', 'drop-scheme', 'reset-run'])

const store = useReceptionStore()
const tableRef = ref()
const items = computed(() => store.planItems)
const dragOver = ref(false)
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
  // 接口叶子拖入
  if (payload?.kind === 'iface' && payload.id) {
    emit('drop-iface', payload.id)
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

watch(() => items.value.length, setupSortable, { immediate: true })
onBeforeUnmount(() => sortable?.destroy())
</script>

<style scoped lang="scss">
.plan-stack { display: flex; flex-direction: column; gap: 14px; }
.exec-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.card-title { font-weight: 650; font-size: 14px; margin-right: 8px; }
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
    height: 180px;
    overflow: hidden;
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
.plan-table-card--dragover {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-9);
  background: linear-gradient(0deg, rgba(47, 111, 235, .04), rgba(47, 111, 235, .04)), var(--el-bg-color);
}
.strong { font-weight: 600; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.text-danger { color: var(--el-color-danger); }
.drag-handle { cursor: grab; color: var(--el-text-color-secondary); }
.plan-empty { height: 152px; padding: 0; }
.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  border-radius: 50%;
  background: var(--el-color-info);
}
.status-dot--online { background: var(--el-color-success); }
.status-dot--pinging { background: var(--el-color-warning); }
</style>
