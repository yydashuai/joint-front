<template>
  <div class="donut">
    <svg :viewBox="`0 0 ${size} ${size}`" class="donut__svg" :style="{ width: size + 'px', height: size + 'px' }">
      <g v-if="total > 0">
        <circle
          v-for="(seg, i) in segments"
          :key="i"
          :cx="c" :cy="c" :r="r"
          fill="none"
          :stroke="seg.color"
          :stroke-width="thickness"
          :stroke-dasharray="`${seg.len} ${circ - seg.len}`"
          :stroke-dashoffset="seg.offset"
          :transform="`rotate(-90 ${c} ${c})`"
        >
          <title>{{ seg.label }}: {{ seg.value }} ({{ seg.pct }}%)</title>
        </circle>
      </g>
      <circle v-else :cx="c" :cy="c" :r="r" fill="none" stroke="var(--el-fill-color)" :stroke-width="thickness" />
      <text :x="c" :y="c - 4" text-anchor="middle" class="donut__total">{{ total.toLocaleString('en-US') }}</text>
      <text :x="c" :y="c + 14" text-anchor="middle" class="donut__cap">{{ centerLabel }}</text>
    </svg>
    <div class="donut__legend">
      <div v-for="(seg, i) in segments" :key="i" class="legend-row">
        <span class="dot" :style="{ background: seg.color }" />
        <span class="legend-label">{{ seg.label }}</span>
        <span class="legend-val">{{ seg.value }}</span>
        <span class="legend-pct">{{ seg.pct }}%</span>
      </div>
      <div v-if="!total" class="legend-empty">暂无数据</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }, // [{label,value,color}]
  size: { type: Number, default: 150 },
  centerLabel: { type: String, default: '总计' },
})

const thickness = 18
const c = computed(() => props.size / 2)
const r = computed(() => props.size / 2 - thickness / 2 - 2)
const circ = computed(() => 2 * Math.PI * r.value)
const total = computed(() => props.data.reduce((a, b) => a + (b.value || 0), 0))

const segments = computed(() => {
  let acc = 0
  return props.data.map((d) => {
    const frac = total.value ? d.value / total.value : 0
    const len = frac * circ.value
    const seg = {
      ...d,
      len,
      offset: -acc,
      pct: Math.round(frac * 100),
    }
    acc += len
    return seg
  })
})
</script>

<style scoped lang="scss">
.donut {
  display: flex;
  align-items: center;
  gap: 16px;
}
.donut__svg { flex-shrink: 0; }
.donut__total { font-size: 18px; font-weight: 700; fill: var(--el-text-color-primary); }
.donut__cap { font-size: 10px; fill: var(--el-text-color-secondary); }
.donut__legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  min-width: 0;
}
.dot { width: 10px; height: 10px; border-radius: 3px; }
.legend-label {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 120px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.legend-val { font-variant-numeric: tabular-nums; font-weight: 600; }
.legend-pct { color: var(--el-text-color-secondary); font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
.legend-empty { color: var(--el-text-color-placeholder); font-size: 12px; }
</style>
