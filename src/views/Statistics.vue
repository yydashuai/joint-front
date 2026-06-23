<template>
  <ModulePlaceholder
    title="统计与可视化"
    desc="联试信息统计与可视化展示"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '执行指标', desc: '任务执行情况统计' },
  { name: '请求指标', desc: '请求量 / 成功率等' },
  { name: '性能指标', desc: '时延 / 吞吐等性能维度' },
  { name: '异常指标', desc: '异常分布与趋势' },
  { name: '接口指标', desc: '按接口维度统计' },
  { name: '结果导出', desc: '指标维度筛选与结果导出' }
]
</script>
