<template>
  <ModulePlaceholder
    title="测试数据管理"
    desc="数据输入 ≥2 种：人工录入 / 案例复用 / 智能生成"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '人工录入', desc: '按字段手动录入 / 编辑' },
  { name: '格式转换', desc: '按协议将数据转换为目标协议字节流' },
  { name: '智能生成', desc: '按统计分布 / 历史数据自动生成（按需自动生成）' },
  { name: '案例复用', desc: '复用历史保存的优秀案例数据' },
  { name: '数据维护', desc: '数据集列表与管理' }
]
</script>
