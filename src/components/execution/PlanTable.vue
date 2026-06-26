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
            <el-button
              type="primary"
              plain
              :icon="Plus"
              :disabled="!selectedTask || selectedInPlan"
              @click="$emit('add-selected')"
            >
              {{ selectedInPlan ? '已在计划中' : '添加测试任务' }}
            </el-button>
            <el-button :icon="RefreshRight" @click="$emit('reset-run')">重置本次运行</el-button>
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
        <el-table-column label="目标接口" min-width="150">
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
        <el-table-column label="就绪" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.ready ? 'success' : 'danger'" size="small">
              {{ row.ready ? '就绪' : '缺配置' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="router.push({ path: '/task', query: { id: row.task.id } })">编辑</el-button>
            <el-button link type="danger" size="small" @click="store.removeFromPlan(row.id)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!items.length" class="plan-empty" :image-size="88" description="从左侧任务树拖入或添加到执行计划，也可先去测试任务管理组建任务">
        <el-button type="primary" plain @click="router.push('/task')">去组建任务</el-button>
      </el-empty>
    </el-card>

    <el-card shadow="never" class="exec-card">
      <template #header>
        <div class="card-head">
          <div>
            <span class="card-title">就绪检查</span>
            <span class="card-sub">只拦截会导致无法执行的条件，数据集和规则集会降级提示</span>
          </div>
          <el-tag :type="store.canStart ? 'success' : 'warning'" effect="plain">
            {{ store.canStart ? '可开始' : '待处理' }}
          </el-tag>
        </div>
      </template>

      <div v-if="!items.length" class="muted">加入任务后显示逐项检查。</div>
      <div v-else class="check-list">
        <div v-for="item in items" :key="item.id" class="check-task">
          <div class="check-task__title">
            <span>{{ item.task.name }}</span>
            <el-tag :type="item.ready ? 'success' : 'danger'" size="small" effect="plain">
              {{ item.ready ? '关键项通过' : '关键项未通过' }}
            </el-tag>
          </div>
          <div class="check-grid">
            <div
              v-for="check in item.checks"
              :key="check.key"
              class="check-item"
              :class="{ 'check-item--warn': !check.ok && !check.blocking, 'check-item--bad': !check.ok && check.blocking }"
            >
              <el-icon><component :is="check.ok ? CircleCheck : Warning" /></el-icon>
              <div class="check-item__body">
                <span>{{ check.label }}</span>
                <small>{{ check.detail }}</small>
              </div>
              <el-button v-if="!check.ok" link type="primary" size="small" @click="router.push(check.route)">去修复</el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Sortable from 'sortablejs'
import { CircleCheck, Plus, Rank, RefreshRight, Warning } from '@element-plus/icons-vue'
import { useExecutionStore } from '@/stores/execution'

defineProps({
  selectedTask: { type: Object, default: null },
  selectedInPlan: { type: Boolean, default: false },
  totalEstimatedRequests: { type: Number, default: 0 },
})
const emit = defineEmits(['add-selected', 'drop-task', 'reset-run'])

const store = useExecutionStore()
const router = useRouter()
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
.check-list { display: flex; flex-direction: column; gap: 12px; }
.check-task { padding: 10px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-extra-light); }
.check-task__title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-weight: 600; }
.check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid transparent;
  color: var(--el-color-success);
}
.check-item--warn { color: var(--el-color-warning); border-color: var(--el-color-warning-light-7); }
.check-item--bad { color: var(--el-color-danger); border-color: var(--el-color-danger-light-7); }
.check-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; color: var(--el-text-color-primary); }
.check-item__body small { color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 1100px) {
  .check-grid { grid-template-columns: 1fr; }
}
</style>
