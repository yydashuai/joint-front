<template>
  <div class="histogram">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="hg-svg">
      <g v-if="bins.length">
        <line :x1="padL" :y1="baseY" :x2="W - padR" :y2="baseY" class="hg-axis-line" />
        <g v-for="(b, i) in bins" :key="i">
          <rect
            :x="xOf(i) + 1" :y="yOf(b.count)"
            :width="barW - 2" :height="baseY - yOf(b.count)"
            class="hg-bar"
          >
            <title>{{ b.from }}~{{ b.to }}ms: {{ b.count }} 次</title>
          </rect>
        </g>
        <!-- X 刻度（首/中/尾） -->
        <text v-for="t in xTicks" :key="t.i" :x="xOf(t.i) + barW / 2" :y="H - 4" text-anchor="middle" class="hg-axis">{{ t.label }}</text>
      </g>
    </svg>
    <div v-if="!bins.length" class="hg-empty">暂无数据</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  values: { type: Array, default: () => [] },
  binCount: { type: Number, default: 12 },
})

const W = 520
const H = 190
const padL = 8
const padR = 8
const padT = 10
const baseY = H - 20

const bins = computed(() => {
  const vals = props.values.filter((v) => typeof v === 'number')
  if (!vals.length) return []
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  if (max === min) return [{ from: min, to: max, count: vals.length }]
  const n = props.binCount
  const width = (max - min) / n
  const arr = Array.from({ length: n }, (_, i) => ({
    from: Math.round(min + i * width),
    to: Math.round(min + (i + 1) * width),
    count: 0,
  }))
  vals.forEach((v) => {
    let idx = Math.floor((v - min) / width)
    if (idx >= n) idx = n - 1
    arr[idx].count += 1
  })
  return arr
})

const maxCount = computed(() => Math.max(1, ...bins.value.map((b) => b.count)))
const barW = computed(() => (W - padL - padR) / Math.max(1, bins.value.length))
const xOf = (i) => padL + i * barW.value
const yOf = (c) => padT + (1 - c / maxCount.value) * (baseY - padT)

const xTicks = computed(() => {
  if (!bins.value.length) return []
  const last = bins.value.length - 1
  const mid = Math.floor(last / 2)
  return [
    { i: 0, label: `${bins.value[0].from}ms` },
    { i: mid, label: `${bins.value[mid].from}ms` },
    { i: last, label: `${bins.value[last].to}ms` },
  ]
})
</script>

<style scoped lang="scss">
.histogram { width: 100%; position: relative; }
.hg-svg { width: 100%; height: auto; }
.hg-bar { fill: var(--el-color-primary); opacity: 0.78; }
.hg-bar:hover { opacity: 1; }
.hg-axis-line { stroke: var(--el-border-color-light); stroke-width: 1; }
.hg-axis { font-size: 9px; fill: var(--el-text-color-secondary); }
.hg-empty {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--el-text-color-placeholder); font-size: 12px;
}
</style>
