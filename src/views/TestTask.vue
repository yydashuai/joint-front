<template>
  <ModulePlaceholder
    title="测试任务管理"
    desc="组建联试任务：方案 / 资源绑定 / 策略"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '方案管理', desc: '任务方案列表与增删改' },
  { name: '资源绑定', desc: '绑定被测系统 / 连接会话、接口协议、测试数据集、规则集' },
  { name: '策略配置', desc: '触发方式（手动 / 定时）、执行顺序与并发、超时与重试、数据规则关联' }
]
</script>
