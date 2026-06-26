<template>
  <div class="page rule-page">
    <div class="page__header">
      <div>
        <h2>规则管理</h2>
        <div class="page__desc">从接口字段生成黑盒校验规则，绑定到任务后用于执行时实时判定</div>
      </div>
      <div class="header-actions">
        <el-select v-model="systemSelectValue" class="system-select">
          <el-option v-for="item in systemOptions" :key="item.selectValue" :label="item.label" :value="item.selectValue" />
        </el-select>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input v-model="keyword" placeholder="搜索规则集..." :prefix-icon="Search" size="small" clearable />
        </div>
        <SystemModuleTree
          v-model="selectedKey"
          title="规则集"
          :leaf-groups="leafGroups"
          :leaf-context-actions="leafContextActions"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @delete-leaf="onDeleteLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <div class="main-panel">
        <template v-if="currentRuleSet">
          <el-card shadow="never" class="rule-head">
            <div class="rule-head__row">
              <div class="rule-head__left">
                <el-input
                  v-model="editName"
                  class="rule-head__name"
                  size="large"
                  borderless
                  @blur="commitName"
                  @keyup.enter="$event.target.blur()"
                />
                <el-switch
                  v-model="enabled"
                  active-text="启用"
                  inactive-text="草稿"
                  @change="ruleStore.updateRuleSet(currentRuleSet.id, { status: $event ? 'enabled' : 'draft' })"
                />
                <el-tag type="info" effect="plain">被 {{ ruleStore.refCountOf(currentRuleSet.id) }} 个任务引用</el-tag>
              </div>
              <div class="rule-head__right">
                <el-button :icon="CopyDocument" @click="duplicate">复制</el-button>
                <el-button :icon="Download" @click="exportJson">导出 JSON</el-button>
                <el-button type="danger" plain :icon="Delete" @click="removeCurrent">删除</el-button>
              </div>
            </div>
            <div class="rule-head__desc">
              <el-input v-model="editDesc" type="textarea" :rows="2" placeholder="规则集说明" @blur="commitDesc" />
            </div>
          </el-card>

          <div class="metrics">
            <div class="metric metric--total">
              <span>{{ stats.total }}</span>
              <small>规则总数</small>
            </div>
            <div v-for="type in visibleTypes" :key="type.value" class="metric">
              <span>{{ stats.byType[type.value] || 0 }}</span>
              <small>{{ type.label }}</small>
            </div>
            <div class="metric metric--enabled">
              <span>{{ stats.enabled }}</span>
              <small>启用</small>
            </div>
          </div>

          <el-card shadow="never" class="rule-tabs">
            <el-tabs v-model="activeTab">
              <el-tab-pane label="规则清单" name="list">
                <RuleList :rule-set="currentRuleSet" @generate="showGenerate = true" @edit="openEdit" />
              </el-tab-pane>
              <el-tab-pane label="试判定" name="check">
                <RuleCheckPanel :rule-set="currentRuleSet" />
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </template>

        <el-card v-else shadow="never" class="empty-state">
          <el-empty description="从左侧选择规则集，或在模块下新建规则集" :image-size="100" />
        </el-card>
      </div>
    </div>

    <GenerateRulesDialog v-model="showGenerate" :rule-set="currentRuleSet" />
    <RuleEditDialog v-model="showEdit" :rule-set="currentRuleSet" :rule="editingRule" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Delete, Download, Search } from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import RuleList from '@/components/rule/RuleList.vue'
import GenerateRulesDialog from '@/components/rule/GenerateRulesDialog.vue'
import RuleEditDialog from '@/components/rule/RuleEditDialog.vue'
import RuleCheckPanel from '@/components/rule/RuleCheckPanel.vue'
import { RULE_TYPES, useRuleStore } from '@/stores/rule'
import { useSystemStore } from '@/stores/system'

const ruleStore = useRuleStore()
const systemStore = useSystemStore()

const selectedKey = ref('')
const keyword = ref('')
const activeTab = ref('list')
const editName = ref('')
const editDesc = ref('')
const showGenerate = ref(false)
const showEdit = ref(false)
const editingRule = ref(null)

const ALL_SYSTEM_VALUE = '__all__'
const systemOptions = computed(() => systemStore.options.map((item) => ({
  ...item,
  selectValue: item.value == null ? ALL_SYSTEM_VALUE : item.value,
})))
const systemSelectValue = computed({
  get: () => systemStore.currentId ?? ALL_SYSTEM_VALUE,
  set: (value) => systemStore.setCurrent(value === ALL_SYSTEM_VALUE ? null : value),
})
const currentRuleSet = computed(() => ruleStore.selectedRuleSet)
const stats = computed(() => ruleStore.statsByType(currentRuleSet.value))
const visibleTypes = computed(() => RULE_TYPES.slice(0, 6))
const enabled = computed({
  get: () => currentRuleSet.value?.status === 'enabled',
  set: () => {},
})

watch(currentRuleSet, (ruleSet) => {
  if (!ruleSet) return
  selectedKey.value = `rule-${ruleSet.id}`
  editName.value = ruleSet.name
  editDesc.value = ruleSet.desc || ''
}, { immediate: true })

const leafGroups = (module) => {
  let items = ruleStore.ruleSetsOfModule(module.id)
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    items = items.filter((ruleSet) => ruleSet.name.toLowerCase().includes(kw) || (ruleSet.desc || '').toLowerCase().includes(kw))
  }
  return [{
    flat: true,
    kind: 'rule-set',
    addLabel: '+规则集',
    addType: 'primary',
    items: items.map((ruleSet) => ({
      key: `rule-${ruleSet.id}`,
      kind: 'rule-set',
      icon: 'SetUp',
      label: ruleSet.name,
      badge: `${ruleSet.status === 'enabled' ? '启用' : '草稿'} · ${ruleSet.rules.length}`,
      ref: ruleSet,
    })),
  }]
}

const leafContextActions = (nodeData) => {
  if (nodeData?.kind !== 'rule-set') return []
  return [
    { label: '复制规则集', action: 'duplicate' },
    { label: '导出 JSON', action: 'export' },
  ]
}

const onTreeSelect = (data) => {
  if (data.kind === 'rule-set' && data.ref) {
    ruleStore.select(data.ref.id)
    activeTab.value = 'list'
  }
}
const onAddLeaf = ({ module }) => {
  const ruleSet = ruleStore.addRuleSet({
    name: `${module.name}规则集`,
    systemId: module.systemId,
    moduleId: module.id,
    desc: '从接口字段自动生成后，可按现场需要微调阈值。',
  })
  selectedKey.value = `rule-${ruleSet.id}`
  ElMessage.success('规则集已创建')
}
const onDeleteLeaf = (data) => {
  if (data.kind === 'rule-set' && data.ref) ruleStore.removeRuleSet(data.ref.id)
}
const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  ruleStore.select(data.ref.id)
  if (action === 'duplicate') duplicate()
  if (action === 'export') exportJson()
}

const commitName = () => {
  if (!currentRuleSet.value) return
  const name = editName.value.trim()
  if (name && name !== currentRuleSet.value.name) ruleStore.updateRuleSet(currentRuleSet.value.id, { name })
  else editName.value = currentRuleSet.value.name
}
const commitDesc = () => {
  if (!currentRuleSet.value || editDesc.value === currentRuleSet.value.desc) return
  ruleStore.updateRuleSet(currentRuleSet.value.id, { desc: editDesc.value })
}
const openEdit = (rule) => {
  editingRule.value = rule
  showEdit.value = true
}
const duplicate = () => {
  const copy = ruleStore.duplicateRuleSet(currentRuleSet.value.id)
  if (copy) ElMessage.success('规则集已复制')
}
const removeCurrent = () => {
  ElMessageBox.confirm(`确定删除规则集「${currentRuleSet.value.name}」？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    ruleStore.removeRuleSet(currentRuleSet.value.id)
    ElMessage.success('规则集已删除')
  }).catch(() => {})
}
const exportJson = () => {
  const blob = new Blob([JSON.stringify(currentRuleSet.value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${currentRuleSet.value.name}.json`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.rule-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions { display: flex; align-items: center; gap: 8px; }
.system-select { width: 220px; }
.split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.tree-panel {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.tree-search {
  width: 100%;
  min-width: 0;
  flex-shrink: 0;
  :deep(.el-input) { width: 100%; }
}
:deep(.smt) {
  width: 100%;
  min-width: 0;
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}
.rule-head {
  border-radius: 8px;
  flex-shrink: 0;
  :deep(.el-card__body) { padding: 14px 18px; }
}
.rule-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.rule-head__left, .rule-head__right { display: flex; align-items: center; gap: 10px; }
.rule-head__left { flex: 1; min-width: 0; }
.rule-head__name {
  max-width: 360px;
  :deep(.el-input__wrapper) { box-shadow: none !important; padding-left: 0; }
  :deep(input) { font-size: 17px; font-weight: 650; }
}
.rule-head__desc { margin-top: 10px; }
.metrics {
  display: grid;
  grid-template-columns: repeat(8, minmax(92px, 1fr));
  gap: 10px;
}
.metric {
  min-height: 72px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background: #f8fafc;
}
.metric span {
  display: block;
  font: 700 22px Consolas, Monaco, monospace;
}
.metric small { color: var(--el-text-color-secondary); }
.metric--total { background: #eef5ff; }
.metric--enabled { background: #eff8f2; }
.rule-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding: 4px 18px 16px;
  }
}
:deep(.el-tabs) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
:deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-top: 10px;
}
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
@media (max-width: 1180px) {
  .rule-page { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .metrics { grid-template-columns: repeat(4, minmax(92px, 1fr)); }
}
</style>
