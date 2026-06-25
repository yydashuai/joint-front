<template>
  <div class="barchart" :class="{ 'barchart--h': horizontal }">
    <template v-if="!hasData">
      <div class="bc-empty">暂无数据</div>
    </template>

    <!-- 横向条 -->
    <template v-else-if="horizontal">
      <div v-for="(d, i) in normalized" :key="i" class="bc-row">
        <span class="bc-row__label" :title="d.label">{{ d.label }}</span>
        <div class="bc-row__track">
          <div class="bc-row__bar" :style="{ width: pctOf(d.value) + '%', background: d.color || color }" />
        </div>
        <span class="bc-row__val">{{ d.value.toLocaleString('en-US') }}{{ unit }}</span>
      </div>
    </template>

    <!-- 竖向条（支持堆叠 parts） -->
    <template v-else>
      <div class="bc-cols">
        <div v-for="(d, i) in normalized" :key="i" class="bc-col">
          <div class="bc-col__stack" :title="tooltipOf(d)">
            <template v-if="d.parts">
              <div
                v-for="(p, pi) in d.parts"
                :key="pi"
                class="bc-col__seg"
                :style="{ height: hOf(p.value) + '%', background: p.color }"
              />
            </template>
            <div v-else class="bc-col__seg" :style="{ height: hOf(d.value) + '%', background: d.color || color }" />
          </div>
          <span class="bc-col__label">{{ d.label }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: { type: Array, default: () => [] }, // [{label,value,color}] 或 [{label,parts:[{value,color}]}]
  horizontal: { type: Boolean, default: false },
  color: { type: String, default: 'var(--el-color-primary)' },
  unit: { type: String, default: '' },
})

const normalized = computed(() => props.data.map((d) => ({
  ...d,
  value: d.parts ? d.parts.reduce((a, b) => a + (b.value || 0), 0) : (d.value || 0),
})))

const hasData = computed(() => normalized.value.some((d) => d.value > 0))
const max = computed(() => Math.max(1, ...normalized.value.map((d) => d.value)))
const pctOf = (v) => Math.round((v / max.value) * 100)
const hOf = (v) => (v / max.value) * 100
const tooltipOf = (d) => {
  if (d.parts) return `${d.label}: ` + d.parts.map((p) => `${p.name || ''} ${p.value}`).join(' / ')
  return `${d.label}: ${d.value}`
}
</script>

<style scoped lang="scss">
.barchart { width: 100%; }
.bc-empty {
  height: 120px;
  display: flex; align-items: center; justify-content: center;
  color: var(--el-text-color-placeholder); font-size: 12px;
}

/* 横向 */
.bc-row {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
}
.bc-row__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--el-text-color-regular); }
.bc-row__track { background: var(--el-fill-color-light); border-radius: 4px; height: 14px; overflow: hidden; }
.bc-row__bar { height: 100%; border-radius: 4px; transition: width .3s; min-width: 2px; }
.bc-row__val { font-variant-numeric: tabular-nums; color: var(--el-text-color-secondary); min-width: 40px; text-align: right; }

/* 竖向 */
.bc-cols {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 180px;
  padding-top: 8px;
}
.bc-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.bc-col__stack {
  width: 70%;
  max-width: 34px;
  flex: 1;
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
  background: var(--el-fill-color-lighter);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}
.bc-col__seg { width: 100%; transition: height .3s; }
.bc-col__label {
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
</style>
