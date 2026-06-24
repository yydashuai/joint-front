<template>
  <teleport to="body" :disabled="!isFullscreen">
    <div
      ref="viewportRef"
      class="pzc"
      :class="{ 'pzc--full': isFullscreen, 'pzc--grabbing': dragging }"
      :style="viewportStyle"
      @mousedown="onMouseDown"
      @wheel.prevent="onWheel"
      @click.capture="onClickCapture"
    >
      <!-- 画布网格背景（随平移/缩放移动，类似 draw.io） -->
      <div class="pzc__grid" :style="gridStyle" />

      <!-- 内容层：平移 + 缩放 -->
      <div ref="contentRef" class="pzc__content" :style="contentStyle">
        <slot />
      </div>

      <!-- 全屏（右上角） -->
      <div class="pzc__bar pzc__bar--top" @mousedown.stop>
        <span v-if="isFullscreen && title" class="pzc__title">{{ title }}</span>
        <el-button size="small" :icon="isFullscreen ? Close : FullScreen" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>

      <!-- 缩放（右下角） -->
      <div class="pzc__bar pzc__bar--bottom" @mousedown.stop>
        <el-button-group size="small">
          <el-button :icon="ZoomOut" @click="zoomAtCenter(1 / 1.2)" />
          <el-button class="pzc__pct" @click="resetView">{{ Math.round(scale * 100) }}%</el-button>
          <el-button :icon="ZoomIn" @click="zoomAtCenter(1.2)" />
        </el-button-group>
        <el-button size="small" :icon="Aim" @click="fitView">适应</el-button>
      </div>

      <div class="pzc__hint">滚轮缩放 · 拖拽平移</div>
    </div>
  </teleport>
</template>

<script setup>
/**
 * 通用平移/缩放画布（draw.io 风格）：固定高度视口 + 可拖拽平移 + 滚轮/按钮缩放 + 全屏查看。
 * 把需要展示的内容放进默认插槽即可，内容按自然尺寸布局，超出部分通过平移/缩放查看。
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ZoomIn, ZoomOut, FullScreen, Close, Aim } from '@element-plus/icons-vue'

const props = defineProps({
  height: { type: Number, default: 360 }, // 非全屏时视口高度
  title: { type: String, default: '' }, // 全屏标题
  minScale: { type: Number, default: 0.1 },
  maxScale: { type: Number, default: 2.5 },
  padding: { type: Number, default: 24 } // fit 时的内边距
})

const viewportRef = ref()
const contentRef = ref()

const tx = ref(0)
const ty = ref(0)
const scale = ref(1)
const isFullscreen = ref(false)
const dragging = ref(false)

const GRID = 22
const clampScale = (s) => Math.min(props.maxScale, Math.max(props.minScale, s))

const viewportStyle = computed(() => (isFullscreen.value ? {} : { height: `${props.height}px` }))
const contentStyle = computed(() => ({
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value})`,
  transformOrigin: '0 0'
}))
const gridStyle = computed(() => ({
  backgroundSize: `${GRID * scale.value}px ${GRID * scale.value}px`,
  backgroundPosition: `${tx.value}px ${ty.value}px`
}))

/* ---- 缩放 ---- */
const zoomAt = (cx, cy, factor) => {
  const ns = clampScale(scale.value * factor)
  if (ns === scale.value) return
  const wx = (cx - tx.value) / scale.value
  const wy = (cy - ty.value) / scale.value
  tx.value = cx - wx * ns
  ty.value = cy - wy * ns
  scale.value = ns
}
const onWheel = (e) => {
  const rect = viewportRef.value.getBoundingClientRect()
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12)
}
const zoomAtCenter = (factor) => {
  const rect = viewportRef.value.getBoundingClientRect()
  zoomAt(rect.width / 2, rect.height / 2, factor)
}

/* ---- 适应 / 复位 ---- */
const fitView = () => {
  const vp = viewportRef.value?.getBoundingClientRect()
  const content = contentRef.value
  if (!vp || !content) return
  const cw = content.scrollWidth
  const ch = content.scrollHeight
  if (!cw || !ch) return
  const s = clampScale(Math.min((vp.width - props.padding * 2) / cw, (vp.height - props.padding * 2) / ch, 1))
  scale.value = s
  tx.value = (vp.width - cw * s) / 2
  ty.value = (vp.height - ch * s) / 2
}
// 默认视图：100% 缩放，根节点（左侧 hub）靠左留白、垂直居中可见
const resetView = () => {
  const vp = viewportRef.value?.getBoundingClientRect()
  const content = contentRef.value
  if (!vp || !content) return
  scale.value = 1
  tx.value = props.padding
  ty.value = (vp.height - content.scrollHeight) / 2
}

/* ---- 拖拽平移 ---- */
let startX = 0
let startY = 0
let originTx = 0
let originTy = 0
let moved = false
let suppressClick = false
const onMouseMove = (e) => {
  tx.value = originTx + (e.clientX - startX)
  ty.value = originTy + (e.clientY - startY)
  if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) > 4) moved = true
}
const onMouseUp = () => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  dragging.value = false
  if (moved) suppressClick = true // 拖拽后吞掉一次 click，避免误触发节点选中
}
const onMouseDown = (e) => {
  if (e.button !== 0) return
  startX = e.clientX
  startY = e.clientY
  originTx = tx.value
  originTy = ty.value
  moved = false
  dragging.value = true
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
const onClickCapture = (e) => {
  if (suppressClick) {
    e.stopPropagation()
    e.preventDefault()
    suppressClick = false
  }
}

/* ---- 全屏 ---- */
const onKey = (e) => { if (e.key === 'Escape' && isFullscreen.value) toggleFullscreen() }
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  nextTick(() => resetView())
}

onMounted(() => {
  nextTick(() => resetView())
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

defineExpose({ fitView, resetView })
</script>

<style scoped lang="scss">
.pzc {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: var(--el-fill-color-blank);
  border-radius: 6px;
  cursor: grab;
  user-select: none;

  &--grabbing { cursor: grabbing; }
  &--full {
    position: fixed;
    inset: 0;
    z-index: 2000;
    height: 100vh !important;
    border-radius: 0;
  }
}

/* 点阵网格 */
.pzc__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, var(--el-border-color) 1px, transparent 1px);
  opacity: 0.5;
}

.pzc__content {
  position: absolute;
  top: 0;
  left: 0;
  width: max-content;
  will-change: transform;
}

/* 工具条：全屏在右上，缩放在右下 */
.pzc__bar {
  position: absolute;
  right: 10px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-lighter);
  cursor: default;

  &--top { top: 10px; }
  &--bottom { bottom: 10px; }
}
.pzc__title { font-size: 13px; font-weight: 600; margin-right: 4px; }
.pzc__pct { width: 56px; font-variant-numeric: tabular-nums; }

.pzc__hint {
  position: absolute;
  left: 10px;
  bottom: 8px;
  z-index: 2;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  pointer-events: none;
}
</style>
