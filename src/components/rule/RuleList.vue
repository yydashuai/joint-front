<template>
  <div class="rule-list">
    <div class="rule-toolbar">
      <div class="rule-toolbar__left">
        <el-button type="primary" :icon="Lightning" @click="$emit('generate')">从接口自动生成</el-button>
        <el-button :icon="Plus" @click="$emit('edit', null)">手动添加规则</el-button>
      </div>
      <div class="rule-toolbar__right">
        <el-select v-model="typeFilter" size="small" class="type-filter">
          <el-option label="全部类型" value="all" />
          <el-option v-for="type in RULE_TYPES" :key="type.value" :label="type.label" :value="type.value" />
        </el-select>
        <el-input v-model="keyword" size="small" placeholder="搜索目标 / 描述" clearable class="search-input" />
      </div>
    </div>

    <el-table :data="filteredRules" size="small" empty-text="暂无规则，建议先从接口自动生成">
      <el-table-column label="启用" width="72" align="center">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" size="small" @change="store.toggleRule(ruleSet.id, row.id, $event)" />
        </template>
      </el-table-column>
      <el-table-column label="类型" width="118">
        <template #default="{ row }">
          <el-tag :type="typeMeta(row.type).tag" size="small" effect="plain">{{ typeMeta(row.type).label }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="目标" min-width="210">
        <template #default="{ row }">
          <div class="strong">{{ row.target?.interfaceName || '接口级' }}</div>
          <div class="muted mono">{{ row.target?.fieldPath || 'interface' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="校验内容" min-width="240">
        <template #default="{ row }">
          {{ ruleText(row) }}
          <div v-if="row.desc" class="muted">{{ row.desc }}</div>
        </template>
      </el-table-column>
      <el-table-column label="级别" width="92" align="center">
        <template #default="{ row }">
          <el-tag :type="row.level === 'error' ? 'danger' : 'warning'" size="small">
            {{ row.level === 'error' ? '错误' : '提醒' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="来源" width="84" align="center">
        <template #default="{ row }">
          <el-tag :type="row.source === 'auto' ? 'success' : 'info'" size="small" effect="plain">
            {{ row.source === 'auto' ? '自动' : '手动' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="104" align="center">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="$emit('edit', row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="store.removeRule(ruleSet.id, row.id)">删</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Lightning, Plus } from '@element-plus/icons-vue'
import { RULE_TYPES, useRuleStore } from '@/stores/rule'
import { RULE_TYPE_MAP } from '@/utils/ruleEngine'

const props = defineProps({
  ruleSet: { type: Object, required: true },
})
defineEmits(['generate', 'edit'])

const store = useRuleStore()
const typeFilter = ref('all')
const keyword = ref('')

const filteredRules = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return (props.ruleSet.rules || []).filter((rule) => {
    const typeOk = typeFilter.value === 'all' || rule.type === typeFilter.value
    const text = `${rule.target?.interfaceName || ''} ${rule.target?.fieldPath || ''} ${rule.desc || ''}`.toLowerCase()
    return typeOk && (!kw || text.includes(kw))
  })
})

const typeMeta = (type) => RULE_TYPE_MAP[type] || { label: type, tag: 'info' }

const ruleText = (rule) => {
  const p = rule.params || {}
  if (rule.type === 'type') return p.enumValues?.length ? `枚举成员：${p.enumValues.map((i) => i.label ?? i.value ?? i).join(' / ')}` : `类型必须为 ${p.dataType || '已声明类型'}`
  if (rule.type === 'range') return `${p.min} ~ ${p.max}`
  if (rule.type === 'boundary') return `边界提醒：${p.min} / ${p.max}`
  if (rule.type === 'overflow') return `必填 ${p.required ? '是' : '否'}，最大长度 ${p.maxLength || '不限'}`
  if (rule.type === 'timeout') return `< ${p.timeoutMs || 500}ms`
  if (rule.type === 'format') return p.sampleType === 'hex' ? '合法十六进制帧' : '合法 JSON / 结构体'
  return '自定义校验'
}
</script>

<style scoped lang="scss">
.rule-list { display: flex; flex-direction: column; gap: 12px; }
.rule-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.rule-toolbar__left, .rule-toolbar__right { display: flex; align-items: center; gap: 8px; }
.type-filter { width: 132px; }
.search-input { width: 220px; }
.strong { font-weight: 600; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.mono { font-family: Consolas, Monaco, monospace; }
</style>
