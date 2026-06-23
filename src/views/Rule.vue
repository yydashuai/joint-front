<template>
  <ModulePlaceholder
    title="规则管理"
    desc="黑盒校验规则 ≥5 类：类型 / 取值范围 / 边界值 / 字段越界 等"
    :features="features"
  />
</template>

<script setup>
import ModulePlaceholder from '@/components/ModulePlaceholder.vue'
const features = [
  { name: '规则制定', desc: '制定数据校验规则（≥5 类）：类型校验、取值范围、边界值检测、字段越界、响应超时 / 格式错误等' },
  { name: '规则判定', desc: '对接收数据进行判定（仅客观可判定项，不涉及业务逻辑正确性）' },
  { name: '规则集', desc: '规则集管理，供测试任务绑定' }
]
</script>
