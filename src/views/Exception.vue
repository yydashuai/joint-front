<template>
  <ModulePlaceholder
    title="异常管理"
    desc="异常接口生成 · 异常捕捉 / 处置 / 归类"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '异常定义', desc: '异常类型与捕捉、异常接口列表' },
  { name: '异常处置', desc: '处置操作与留痕' },
  { name: '异常归类', desc: '异常分类与筛选' }
]
</script>
