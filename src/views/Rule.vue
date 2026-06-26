<template>
  <div class="page rule-page">
    <div class="page__header">
      <div>
        <h2>校验规则管理</h2>
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

          <el-card shadow="never" class="rule-list-card">
            <RuleList :rule-set="currentRuleSet" @generate="showGenerate = true" @edit="openEdit" @jump-protocol="jumpToProtocol" />
          </el-card>
        </template>

        <el-card v-else shadow="never" class="empty-state">
          <el-empty description="从左侧选择规则集，或在模块下新建规则集" :image-size="100" />
        </el-card>
      </div>
    </div>

    <GenerateRulesDialog v-model="showGenerate" :rule-set="currentRuleSet" :initial-interface-id="targetInterfaceId" />
    <RuleEditDialog v-model="showEdit" :rule-set="currentRuleSet" :rule="editingRule" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument, Delete, Download, Search } from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import RuleList from '@/components/rule/RuleList.vue'
import GenerateRulesDialog from '@/components/rule/GenerateRulesDialog.vue'
import RuleEditDialog from '@/components/rule/RuleEditDialog.vue'
import { useRuleStore } from '@/stores/rule'
import { useSystemStore } from '@/stores/system'
import { useProtocolStore } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'

const ruleStore = useRuleStore()
const systemStore = useSystemStore()
const protoStore = useProtocolStore()
const connStore = useConnectionStore()
const router = useRouter()
const route = useRoute()

const selectedKey = ref('')
const keyword = ref('')
const editName = ref('')
const editDesc = ref('')
const showGenerate = ref(false)
const showEdit = ref(false)
const editingRule = ref(null)
const targetInterfaceId = ref(null)

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

/* ---- 协议 ↔ 规则 双向跳转 ---- */
const jumpToProtocol = (interfaceId) => {
  const iface = protoStore.interfaces.find((item) => item.id === interfaceId)
  if (!iface) return
  systemStore.setCurrent(iface.systemId)
  protoStore.selectedInterfaceId = iface.id
  protoStore.selectedProtocolId = protoStore.protocols.find((p) => p.moduleId === iface.moduleId)?.id ?? null
  router.push({ path: '/protocol', query: { interfaceId: String(iface.id) } })
}

// 从协议页跳转过来时，自动选中同模块规则集并弹出规则生成对话框
watch(() => route.query.interfaceId, (ifaceId) => {
  if (!ifaceId) {
    targetInterfaceId.value = null
    return
  }
  targetInterfaceId.value = ifaceId
  const iface = protoStore.interfaces.find((item) => String(item.id) === String(ifaceId))
  if (!iface) return
  // 定位到同模块的规则集（优先已有的，否则新建）
  systemStore.setCurrent(iface.systemId)
  const existing = ruleStore.ruleSetsOfModule(iface.moduleId)
  if (existing.length) {
    ruleStore.select(existing[0].id)
  } else {
    ruleStore.addRuleSet({
      name: `${iface.name}规则集`,
      systemId: iface.systemId,
      moduleId: iface.moduleId,
      desc: '从接口字段自动生成后，可按现场需要微调阈值。',
    })
  }
  if (route.query.action === 'generate') {
    showGenerate.value = true
  }
}, { immediate: true })
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
.rule-list-card {
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
    padding: 14px 18px 16px;
  }
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
}
</style>
