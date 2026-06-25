<template>
  <div class="linechart">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="lc-svg">
      <!-- 网格 + Y 轴刻度 -->
      <g>
        <line
          v-for="(g, i) in gridY" :key="'g' + i"
          :x1="padL" :y1="g.y" :x2="W - padR" :y2="g.y"
          class="lc-grid"
        />
        <text v-for="(g, i) in gridY" :key="'t' + i" :x="padL - 6" :y="g.y + 3" text-anchor="end" class="lc-axis">{{ g.label }}</text>
      </g>
      <!-- X 轴标签 -->
      <text
        v-for="(c, i) in categories" :key="'x' + i"
        :x="xOf(i)" :y="H - 6" text-anchor="middle" class="lc-axis"
      >{{ c }}</text>
      <!-- 系列 -->
      <g v-for="(s, si) in series" :key="'s' + si">
        <polygon v-if="area && s.points.length > 1" :points="areaPoints(s)" :fill="s.color" opacity="0.12" />
        <polyline :points="linePoints(s)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" />
        <g v-for="(p, pi) in s.points" :key="pi">
          <circle :cx="xOf(pi)" :cy="yOf(p.y)" r="3" :fill="s.color">
            <title>{{ p.x }} · {{ s.name }}: {{ p.y }}{{ unit }}</title>
          </circle>
        </g>
      </g>
    </svg>
    <div v-if="series.length > 1" class="lc-legend">
      <span v-for="(s, i) in series" :key="i" class="lc-leg">
        <span class="dot" :style="{ background: s.color }" /> {{ s.name }}
      </span>
    </div>
    <div v-if="!hasData" class="lc-empty">暂无数据</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{name,color,points:[{x,y}]}]
  unit: { type: String, default: '' },
  area: { type: Boolean, default: true },
  yMax: { type: Number, default: 0 }, // 0 = auto
})

const W = 520
const H = 200
const padL = 38
const padR = 12
const padT = 12
const padB = 24

const categories = computed(() => props.series[0]?.points.map((p) => p.x) || [])
const hasData = computed(() => props.series.some((s) => s.points.some((p) => p.y > 0)))

const maxY = computed(() => {
  if (props.yMax) return props.yMax
  const m = Math.max(1, ...props.series.flatMap((s) => s.points.map((p) => p.y)))
  return Math.ceil(m / 5) * 5 || 5
})

const xOf = (i) => {
  const n = categories.value.length
  if (n <= 1) return (W - padL - padR) / 2 + padL
  return padL + (i / (n - 1)) * (W - padL - padR)
}
const yOf = (v) => padT + (1 - v / maxY.value) * (H - padT - padB)

const gridY = computed(() => {
  const steps = 4
  return Array.from({ length: steps + 1 }, (_, i) => {
    const val = (maxY.value / steps) * i
    return { y: yOf(val), label: Math.round(val) }
  })
})

const linePoints = (s) => s.points.map((p, i) => `${xOf(i)},${yOf(p.y)}`).join(' ')
const areaPoints = (s) => {
  const pts = s.points.map((p, i) => `${xOf(i)},${yOf(p.y)}`)
  const x0 = xOf(0)
  const xN = xOf(s.points.length - 1)
  const baseline = yOf(0)
  return `${x0},${baseline} ${pts.join(' ')} ${xN},${baseline}`
}
</script>

<style scoped lang="scss">
.linechart { width: 100%; position: relative; }
.lc-svg { width: 100%; height: auto; }
.lc-grid { stroke: var(--el-border-color-lighter); stroke-width: 1; }
.lc-axis { font-size: 9px; fill: var(--el-text-color-secondary); }
.lc-legend {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.lc-leg { display: inline-flex; align-items: center; gap: 5px; }
.dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.lc-empty {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: var(--el-text-color-placeholder); font-size: 12px;
  pointer-events: none;
}
</style>
