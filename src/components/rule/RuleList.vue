<template>
  <div class="rule-list">
    <div class="rule-toolbar">
      <div class="rule-toolbar__left">
        <el-tooltip content="根据接口字段定义自动生成校验规则"><el-button type="primary" :icon="Lightning" @click="$emit('generate')">从接口自动生成</el-button></el-tooltip>
        <el-tooltip content="手动创建一条自定义校验规则"><el-button :icon="Plus" @click="$emit('edit', null)">手动添加规则</el-button></el-tooltip>
        <el-tag type="info" effect="plain" size="small">共 {{ filteredRules.length }} 条规则</el-tag>
      </div>
      <div class="rule-toolbar__right">
        <el-select v-model="typeFilter" size="small" class="type-filter">
          <el-option label="全部类型" value="all" />
          <el-option v-for="type in RULE_TYPES" :key="type.value" :label="type.label" :value="type.value" />
        </el-select>
        <el-select v-model="fieldFilter" size="small" class="field-filter">
          <el-option label="全部字段" value="all" />
          <el-option v-for="f in fieldOptions" :key="f.value" :label="f.label" :value="f.value" />
        </el-select>
        <el-input v-model="keyword" size="small" placeholder="搜索目标 / 描述" clearable class="search-input" />
      </div>
    </div>

    <template v-if="groupedRules.length">
      <div v-for="group in groupedRules" :key="group.key" class="rule-group">
        <div class="rule-group__header">
          <span class="rule-group__label">{{ group.label }}</span>
          <el-tag size="small" :type="group.isInterface ? 'warning' : 'info'" effect="plain">
            {{ group.rules.length }} 条
          </el-tag>
        </div>
        <el-table :data="group.rules" size="small" :show-header="group === groupedRules[0]">
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
          <el-table-column label="操作" width="148" align="center">
            <template #default="{ row }">
              <el-tooltip content="编辑该规则"><el-button link type="primary" size="small" @click="$emit('edit', row)">编辑</el-button></el-tooltip>
              <el-tooltip content="跳转到关联的协议配置"><el-button v-if="row.target?.interfaceId" link type="primary" size="small" @click="$emit('jump-protocol', row.target.interfaceId)">协议</el-button></el-tooltip>
              <el-popconfirm title="确认删除该规则？" @confirm="store.removeRule(ruleSet.id, row.id)">
                <template #reference><el-button link type="danger" size="small">删除</el-button></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <el-empty v-else description="暂无规则，建议先从接口自动生成" :image-size="80" />
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
defineEmits(['generate', 'edit', 'jump-protocol'])

const store = useRuleStore()
const typeFilter = ref('all')
const fieldFilter = ref('all')
const keyword = ref('')

const fieldOptions = computed(() => {
  const rules = props.ruleSet.rules || []
  const fieldSet = new Map()
  rules.forEach((rule) => {
    const fp = rule.target?.fieldPath
    if (!fp || rule.type === 'timeout' || rule.type === 'format') return
    if (!fieldSet.has(fp)) fieldSet.set(fp, fp)
  })
  const options = [...fieldSet.values()].map((fp) => ({ label: fp, value: fp }))
  // Add interface-level option if any interface-level rules exist
  const hasInterfaceLevel = rules.some((r) => !r.target?.fieldPath || r.type === 'timeout' || r.type === 'format')
  if (hasInterfaceLevel) options.push({ label: '接口级校验', value: '__interface__' })
  return options
})

const filteredRules = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return (props.ruleSet.rules || []).filter((rule) => {
    const typeOk = typeFilter.value === 'all' || rule.type === typeFilter.value
    const fieldOk = fieldFilter.value === 'all'
      || (fieldFilter.value === '__interface__' && (!rule.target?.fieldPath || rule.type === 'timeout' || rule.type === 'format'))
      || rule.target?.fieldPath === fieldFilter.value
    const text = `${rule.target?.interfaceName || ''} ${rule.target?.fieldPath || ''} ${rule.desc || ''}`.toLowerCase()
    return typeOk && fieldOk && (!kw || text.includes(kw))
  })
})

const groupedRules = computed(() => {
  const fieldGroups = new Map()
  const interfaceRules = []

  filteredRules.value.forEach((rule) => {
    const fieldPath = rule.target?.fieldPath
    if (!fieldPath || rule.type === 'timeout' || rule.type === 'format') {
      interfaceRules.push(rule)
    } else {
      if (!fieldGroups.has(fieldPath)) {
        fieldGroups.set(fieldPath, {
          key: `field-${fieldPath}`,
          label: fieldPath,
          fieldPath,
          isInterface: false,
          rules: [],
        })
      }
      fieldGroups.get(fieldPath).rules.push(rule)
    }
  })

  const groups = [...fieldGroups.values()]
  if (interfaceRules.length) {
    groups.push({
      key: 'interface-level',
      label: '接口级校验',
      fieldPath: '',
      isInterface: true,
      rules: interfaceRules,
    })
  }
  return groups
})

const typeMeta = (type) => RULE_TYPE_MAP[type] || { label: type, tag: 'info' }

const ruleText = (rule) => {
  const p = rule.params || {}
  if (rule.type === 'type') {
    if (p.enumValues?.length) return `枚举成员：${p.enumValues.map((i) => i.label ?? i.value ?? i).join(' / ')}`
    if (p.dataType === '共识体' && p.structFields?.length) {
      return `共识体结构（${p.structFields.length} 个子字段：${p.structFields.map((f) => f.name).filter(Boolean).join(', ')}）`
    }
    return `类型必须为 ${p.dataType || '已声明类型'}`
  }
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
.field-filter { width: 168px; }
.search-input { width: 220px; }
.rule-group { display: flex; flex-direction: column; gap: 4px; }
.rule-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0 2px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.rule-group__label {
  font-weight: 600;
  font-size: 13px;
  font-family: Consolas, Monaco, monospace;
  color: var(--el-text-color-primary);
}
.strong { font-weight: 600; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.mono { font-family: Consolas, Monaco, monospace; }
</style>
