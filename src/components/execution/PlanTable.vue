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
            <span class="card-title">执行计划</span>
            <span class="card-sub">按顺序调度任务，拖动手柄可调整发送次序；也可从左侧任务树拖入</span>
          </div>
          <div class="plan-actions">
            <el-tag type="info" effect="plain">{{ items.length }} 项 · {{ totalEstimatedRequests }} 请求</el-tag>
            <el-tooltip content="将选中的测试任务添加到执行计划">
              <el-button
                type="primary"
                plain
                :icon="Plus"
                :disabled="!selectedTask || selectedInPlan"
                @click="$emit('add-selected')"
              >
                {{ selectedInPlan ? '已在计划中' : '添加测试任务' }}
              </el-button>
            </el-tooltip>
            <el-popconfirm title="确认重置本次运行？所有运行状态将被清除" @confirm="$emit('reset-run')">
              <template #reference><el-button :icon="RefreshRight">重置本次运行</el-button></template>
            </el-popconfirm>
          </div>
        </div>
      </template>

      <el-table
        ref="tableRef"
        :data="items"
        row-key="id"
        size="small"
        empty-text="暂无执行计划"
      >
        <el-table-column width="44" align="center">
          <template #default>
            <el-icon class="drag-handle"><Rank /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="序号" type="index" width="58" align="center" />
        <el-table-column label="任务名称" min-width="170">
          <template #default="{ row }">
            <div class="strong">{{ row.task.name }}</div>
            <div class="muted ellipsis">{{ row.task.remark || '无备注' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="系统 / 模块" min-width="180">
          <template #default="{ row }">
            <div>{{ row.system?.name || '未归属系统' }}</div>
            <div class="muted">
              <span class="status-dot" :class="`status-dot--${row.module?.status || 'offline'}`" />
              {{ row.module?.name || '未知模块' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="目标报文" min-width="150">
          <template #default="{ row }">
            <span v-if="row.iface">{{ row.iface.name }}</span>
            <span v-else class="text-danger">未配置</span>
            <div v-if="row.iface?.path" class="muted mono">{{ row.iface.path }}</div>
          </template>
        </el-table-column>
        <el-table-column label="数据来源" min-width="145">
          <template #default="{ row }">
            <span v-if="row.rowCount">{{ row.datasets.length }} 个数据集</span>
            <span v-else>默认样例</span>
            <div class="muted">{{ row.rowCount || 8 }} 行 → {{ row.estimatedRequests }} 请求</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-popconfirm title="确认从计划中移除？" @confirm="store.removeFromPlan(row.id)">
              <template #reference><el-button link type="danger" size="small">移除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!items.length" class="plan-empty" :image-size="88" description="从左侧系统树拖入接口，或新建方案后添加多个接口到执行计划" />
    </el-card>

  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { Plus, Rank, RefreshRight } from '@element-plus/icons-vue'
import { useExecutionStore } from '@/stores/execution'

defineProps({
  selectedTask: { type: Object, default: null },
  selectedInPlan: { type: Boolean, default: false },
  totalEstimatedRequests: { type: Number, default: 0 },
})
const emit = defineEmits(['add-selected', 'drop-task', 'reset-run'])

const store = useExecutionStore()
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
  const fallback = event.dataTransfer.getData('text/plain')
  let payload = null
  try { payload = raw ? JSON.parse(raw) : null } catch { payload = null }
  const taskId = payload?.kind === 'task' ? payload.id : fallback
  if (taskId) emit('drop-task', taskId)
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
}
.plan-table-card--dragover {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-9);
  background: linear-gradient(0deg, rgba(47, 111, 235, .04), rgba(47, 111, 235, .04)), var(--el-bg-color);
}
.strong { font-weight: 600; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.mono { font-family: Consolas, Monaco, monospace; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.text-danger { color: var(--el-color-danger); }
.drag-handle { cursor: grab; color: var(--el-text-color-secondary); }
.plan-empty { padding: 18px 0 4px; }
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
