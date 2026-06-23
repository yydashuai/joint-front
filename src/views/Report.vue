<template>
  <ModulePlaceholder
    title="联试报告管理"
    desc="借助大模型生成联试报告 · 模版 / 素材 / 模型 / 生成"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '模版管理', desc: '报告模版的维护' },
  { name: '素材管理', desc: '上传数据 / 图表 / 表格等素材' },
  { name: '模型配置', desc: '大模型（LLM）配置，用于报告生成' },
  { name: '报告生成', desc: '生成 / 预览 / 下载联试报告' }
]
</script>
