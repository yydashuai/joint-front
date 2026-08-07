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
            <span class="card-title">发送接口列表</span>
            <el-tooltip content="配置计划内各接口的传输参数与报文头">
              <el-button
                size="small"
                :icon="Setting"
                :disabled="!items.length"
                @click="$emit('open-transport-config')"
              >传输配置</el-button>
            </el-tooltip>
          </div>
          <div class="plan-actions">
            <el-tooltip content="将选中的接口添加到编排计划">
              <el-button
                type="primary"
                plain
                :icon="Plus"
                :disabled="!selectedIface || selectedInPlan"
                @click="$emit('add-selected')"
              >
                {{ selectedInPlan ? '已在计划中' : '添加选中接口' }}
              </el-button>
            </el-tooltip>
            <el-popconfirm title="确认重置本次运行？所有运行状态将被清除" @confirm="$emit('reset-run')">
              <template #reference><el-button :icon="RefreshRight" :disabled="['running', 'paused'].includes(store.status)">重置本次运行</el-button></template>
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
        empty-text="暂无编排计划"
      >
        <el-table-column width="44" align="center">
          <template #default>
            <el-icon class="drag-handle"><Rank /></el-icon>
          </template>
        </el-table-column>
        <el-table-column label="接口名" min-width="200">
          <template #default="{ row }">
            <div class="strong">
              {{ row.iface?.name || row.task?.name }}
              <el-tag v-if="row.isCustom" size="small" type="primary" effect="plain" class="src-tag">自定义</el-tag>
              <el-tag v-if="row.isDirect" size="small" type="warning" effect="plain" class="src-tag">
                历史选择·{{ row.rowCount }} 条
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="时间间隔" width="190" align="center">
          <template #header>
            <div class="interval-head">
              <span>时间间隔(ms)</span>
              <el-input-number
                v-model="batchInterval"
                :min="200"
                :max="60000"
                :step="100"
                size="small"
                controls-position="right"
                class="interval-batch"
                placeholder="批量"
                @change="onBatchIntervalChange"
              />
            </div>
          </template>
          <template #default="{ row }">
            <el-input-number
              :model-value="row.interval"
              :min="200"
              :max="60000"
              :step="100"
              size="small"
              controls-position="right"
              :disabled="['running', 'paused'].includes(store.status)"
              @change="(val) => onRowIntervalChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.isDirect">临时发送清单，不生成正式数据集</span>
            <span v-else>{{ row.iface?.remark || row.iface?.desc || row.task?.remark || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-popconfirm title="确认从计划中移除？" @confirm="store.removeFromPlan(row.id)">
              <template #reference><el-button link type="danger" size="small" :disabled="['running', 'paused'].includes(store.status)">移除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else class="plan-empty" :image-size="72" description="从左侧系统树拖入接口/方案，或新建自定义接口后添加" />
    </el-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Sortable from 'sortablejs'
import { ElMessage } from 'element-plus'
import { Plus, Rank, RefreshRight, Setting } from '@element-plus/icons-vue'
import { useExecutionStore } from '@/stores/execution'

defineProps({
  selectedIface: { type: Object, default: null },
  selectedInPlan: { type: Boolean, default: false },
  totalEstimatedRequests: { type: Number, default: 0 },
})
const emit = defineEmits(['add-selected', 'drop-scheme', 'drop-iface', 'drop-custom', 'reset-run', 'open-transport-config'])

const store = useExecutionStore()
const tableRef = ref()
const items = computed(() => store.planItems)
const dragOver = ref(false)
const batchInterval = ref(null)
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
  // 接口方案：展开为方案内全部接口加入计划
  if (payload?.kind === 'scheme' && payload.id) {
    emit('drop-scheme', payload.id)
    return
  }
  // 系统接口叶子：交由父级做完整性校验
  if (payload?.kind === 'iface' && payload.id) {
    emit('drop-iface', payload.id)
    return
  }
  // 自定义接口叶子：报文体透传加入
  if (payload?.kind === 'custom' && payload.id) {
    emit('drop-custom', payload.id)
    return
  }
  // 无 JSON 负载时按 text/plain 兜底（按 id 前缀区分方案）
  const fallback = event.dataTransfer.getData('text/plain')
  if (!fallback) return
  if (fallback.startsWith('scheme-')) emit('drop-scheme', fallback)
}

/* ---- 时间间隔：行内编辑 + 表头批量同步 ---- */
const onRowIntervalChange = (row, val) => {
  if (val == null) return
  store.setPlanInterval(row.id, val)
}
const onBatchIntervalChange = (val) => {
  if (val == null) return
  store.applyIntervalToAll(val)
  ElMessage.success('已同步到全部接口')
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
.card-head__left { display: flex; align-items: center; gap: 10px; min-width: 0; }
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
.interval-head { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.interval-head span { font-size: 12px; white-space: nowrap; }
.interval-batch { width: 110px; }
.interval-batch :deep(.el-input__inner) { text-align: center; }
.strong { font-weight: 600; }
.src-tag { margin-left: 6px; transform: translateY(-1px); }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
.text-danger { color: var(--el-color-danger); }
.drag-handle { cursor: grab; color: var(--el-text-color-secondary); }
.plan-empty { height: 152px; padding: 0; }
</style>
