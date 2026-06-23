<template>
  <ModulePlaceholder
    title="测试执行编排"
    desc="编排并执行联试（引擎参照师兄 JMeter 实现）"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '计划生成', desc: '编排发送时序、生成执行计划' },
  { name: '任务调度', desc: '调度执行、收发数据流、执行控制（开始 / 暂停 / 停止）' },
  { name: '结果统计', desc: '执行结果汇总' }
]
</script>
