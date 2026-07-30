<template>
  <div class="strategy-bar" :class="{ 'strategy-bar--disabled': disabled }">
    <span class="strategy-bar__label">发送间隔</span>
    <el-input-number
      :model-value="store.config.sendInterval"
      @update:model-value="(v) => setCfg('sendInterval', v)"
      :min="100" :max="5000" :step="100"
      size="small" controls-position="right"
      :disabled="disabled"
    />
    <span class="strategy-bar__unit">ms</span>
    <span class="strategy-bar__divider" />
    <span class="strategy-bar__label">执行策略</span>
    <el-select
      :model-value="store.config.trigger"
      @update:model-value="(v) => setCfg('trigger', v)"
      size="small" style="width: 88px;"
      :disabled="disabled"
    >
      <el-option label="手动" value="manual" />
      <el-option label="定时" value="scheduled" />
      <el-option label="周期" value="periodic" />
    </el-select>
    <template v-if="store.config.trigger === 'scheduled'">
      <el-date-picker
        :model-value="store.config.scheduleAt"
        @update:model-value="(v) => setCfg('scheduleAt', v)"
        type="datetime" size="small" style="width: 180px;"
        placeholder="选择执行时间"
        format="YYYY-MM-DD HH:mm:ss"
        value-format="YYYY-MM-DD HH:mm:ss"
        :disabled="disabled"
      />
    </template>
    <template v-if="store.config.trigger === 'periodic'">
      <el-input-number
        :model-value="store.config.periodicInterval"
        @update:model-value="(v) => setCfg('periodicInterval', v)"
        :min="1" :max="9999"
        size="small" controls-position="right"
        :disabled="disabled"
      />
      <el-select
        :model-value="store.config.periodicUnit"
        @update:model-value="(v) => setCfg('periodicUnit', v)"
        size="small" style="width: 68px;"
        :disabled="disabled"
      >
        <el-option label="秒" value="s" />
        <el-option label="分" value="m" />
        <el-option label="时" value="h" />
        <el-option label="天" value="d" />
      </el-select>
      <span class="strategy-bar__label">次数</span>
      <el-input-number
        :model-value="store.config.periodicCount"
        @update:model-value="(v) => setCfg('periodicCount', v)"
        :min="1" :max="9999"
        size="small" controls-position="right"
        placeholder="永久"
        :disabled="disabled"
      />
    </template>
  </div>
</template>

<script setup>
import { useExecutionStore } from '@/stores/execution'

defineProps({
  disabled: { type: Boolean, default: false },
})

const store = useExecutionStore()
const setCfg = (key, v) => store.setConfig({ [key]: v })
</script>

<style scoped lang="scss">
.strategy-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  &__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__unit {
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }

  &__divider {
    width: 1px;
    height: 18px;
    background: var(--el-border-color);
    margin: 0 4px;
  }

  &--disabled {
    opacity: 0.6;
  }
}
</style>
