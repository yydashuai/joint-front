<template>
  <div class="table-range-selection">
    <slot
      :set-table-ref="setTableRef"
      :handle-selection-change="handleSelectionChange"
      :handle-scroll="handleScroll"
    />
    <button
      v-if="anchorKey !== null && rangeVisible"
      class="table-range-selection__action"
      :class="`table-range-selection__action--${direction}`"
      type="button"
      @click="selectToViewportEdge"
    >
      {{ direction === 'up' ? '↓' : '↑' }} 选择到这里
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  rowKey: { type: [String, Function], default: 'id' },
})
const emit = defineEmits(['selection-change'])

const tableRef = ref(null)
const selectedRows = ref([])
const anchorKey = ref(null)
const rangeVisible = ref(false)
const lastViewportTarget = ref(-1)
const viewportStart = ref(0)
const viewportEnd = ref(-1)

const rowIdentity = (row) => typeof props.rowKey === 'function'
  ? props.rowKey(row)
  : row?.[props.rowKey]

const anchorIndex = computed(() => props.rows.findIndex((row) => rowIdentity(row) === anchorKey.value))
const direction = computed(() => anchorIndex.value > viewportEnd.value && viewportEnd.value >= 0 ? 'up' : 'down')
const viewportTarget = computed(() => direction.value === 'up' ? viewportStart.value : viewportEnd.value)

const setTableRef = (instance) => { tableRef.value = instance }

const updateViewportRange = () => {
  const root = tableRef.value?.$el
  const scrollWrap = root?.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
    || root?.querySelector('.el-scrollbar__wrap')
  const tbody = root?.querySelector('.el-table__body tbody')
  if (!scrollWrap || !tbody) {
    viewportStart.value = 0
    viewportEnd.value = props.rows.length - 1
    return
  }

  const viewport = scrollWrap.getBoundingClientRect()
  const domRows = [...tbody.children].filter((item) => item.classList.contains('el-table__row'))
  let firstVisible = -1
  let lastVisible = -1
  domRows.forEach((row, index) => {
    const rect = row.getBoundingClientRect()
    if (rect.top < viewport.bottom && rect.bottom > viewport.top) {
      if (firstVisible < 0) firstVisible = index
      lastVisible = index
    }
  })
  viewportStart.value = firstVisible >= 0 ? firstVisible : 0
  viewportEnd.value = lastVisible >= 0 ? lastVisible : props.rows.length - 1
}

const handleSelectionChange = (rows) => {
  const previousKeys = new Set(selectedRows.value.map(rowIdentity))
  selectedRows.value = rows
  emit('selection-change', rows)

  if (!rows.length) {
    anchorKey.value = null
    rangeVisible.value = false
    lastViewportTarget.value = -1
    return
  }
  if (anchorKey.value !== null && rows.some((row) => rowIdentity(row) === anchorKey.value)) return

  const newlySelected = rows.find((row) => !previousKeys.has(rowIdentity(row)))
  anchorKey.value = rowIdentity(newlySelected || rows[0])
  nextTick(() => {
    updateViewportRange()
    rangeVisible.value = true
    lastViewportTarget.value = viewportTarget.value
  })
}

const handleScroll = () => {
  updateViewportRange()
  if (anchorKey.value !== null && viewportTarget.value !== lastViewportTarget.value) {
    rangeVisible.value = true
  }
}

const selectToViewportEdge = () => {
  updateViewportRange()
  const fromIndex = anchorIndex.value
  const toIndex = viewportTarget.value
  if (fromIndex < 0 || toIndex < 0) return
  const from = Math.min(fromIndex, toIndex)
  const to = Math.max(fromIndex, toIndex)
  props.rows.slice(from, to + 1).forEach((row) => tableRef.value?.toggleRowSelection?.(row, true))
  lastViewportTarget.value = toIndex
  rangeVisible.value = false
}

const clearSelection = () => tableRef.value?.clearSelection?.()
const selectAll = () => props.rows.forEach((row) => tableRef.value?.toggleRowSelection?.(row, true))

watch(() => props.rows, (rows) => {
  if (anchorKey.value !== null && !rows.some((row) => rowIdentity(row) === anchorKey.value)) {
    anchorKey.value = null
    rangeVisible.value = false
    lastViewportTarget.value = -1
  }
}, { deep: false })

defineExpose({ clearSelection, selectAll, tableRef })
</script>

<style scoped>
.table-range-selection {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.table-range-selection__action {
  position: absolute;
  z-index: 12;
  left: 10px;
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--el-bg-color) 94%, transparent);
  box-shadow: var(--el-box-shadow-light);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  font-size: 13px;
  backdrop-filter: blur(6px);
}

.table-range-selection__action:hover {
  border-color: var(--el-color-primary-light-5);
  color: var(--el-color-primary);
}

.table-range-selection__action:focus-visible {
  outline: 2px solid var(--el-color-primary-light-3);
  outline-offset: 2px;
}

.table-range-selection__action--down { bottom: 10px; }
.table-range-selection__action--up { top: 46px; }
</style>
