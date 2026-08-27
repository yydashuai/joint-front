<template>
  <div class="page rule-page">
    <div class="page__header">
      <div>
        <h2>校验规则管理</h2>
      </div>
      <el-button type="primary" :icon="Plus" @click="createRuleSetFromCurrent">创建规则集</el-button>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input v-model="keyword" placeholder="搜索接口 / 报文 / 规则集..." :prefix-icon="Search" size="small" clearable />
        </div>
        <MonitorTree
          v-model="selectedKey"
          title="规则集"
          :search="keyword"
          :iface-badge="ifaceBadge"
          :scheme-badge="schemeBadge"
          :custom-badge="customBadge"
          :message-leaf-groups="messageLeafGroups"
          :extra-context-actions="leafContextActions"
          empty-text="暂无接口，请先在报文字段管理中定义"
          @select="onTreeSelect"
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
                <el-tag v-if="ownerMessage" size="small" type="info" effect="plain">{{ ownerMessage.name }}</el-tag>
              </div>
              <div class="rule-head__right">
                <el-button type="danger" plain :icon="Delete" @click="removeCurrent">删除</el-button>
              </div>
            </div>
            <div class="rule-head__desc">
              <el-input v-model="editDesc" type="textarea" :rows="1" placeholder="规则集说明" @blur="commitDesc" />
            </div>
          </el-card>

          <el-card shadow="never" class="rule-list-card">
            <RuleList :rule-set="currentRuleSet" @generate="showGenerate = true" @edit="openEdit" @jump-protocol="jumpToProtocol" />
          </el-card>
        </template>

        <el-card v-else shadow="never" class="empty-state">
          <el-empty description="从左侧选择规则集，或在报文上右键「生成校验规则」" :image-size="100" />
        </el-card>
      </div>
    </div>

    <GenerateRulesDialog v-model="showGenerate" :rule-set="currentRuleSet" :initial-interface-id="targetInterfaceId" />
    <RuleEditDialog v-model="showEdit" :rule-set="currentRuleSet" :rule="editingRule" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Search } from '@element-plus/icons-vue'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import RuleList from '@/components/rule/RuleList.vue'
import GenerateRulesDialog from '@/components/rule/GenerateRulesDialog.vue'
import RuleEditDialog from '@/components/rule/RuleEditDialog.vue'
import { useRuleStore } from '@/stores/rule'
import { useProtocolStore } from '@/stores/protocol'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const ruleStore = useRuleStore()
const protoStore = useProtocolStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
const router = useRouter()
const route = useRoute()

ruleStore.normalizeRuleScope()
// 一次性补全种子规则中缺失的 target.interfaceId
onMounted(() => ruleStore.resolveInterfaceIds())

const selectedKey = ref('')
const keyword = ref('')
const editName = ref('')
const editDesc = ref('')
const showGenerate = ref(false)
const showEdit = ref(false)
const editingRule = ref(null)
const targetInterfaceId = ref(null)

const currentRuleSet = computed(() => ruleStore.selectedRuleSet)
/** 当前规则集归属的报文（用于头部标识与同报文新建） */
const ownerMessage = computed(() => {
  if (!currentRuleSet.value) return null
  const messageId = ruleStore.messageIdOf(currentRuleSet.value)
  if (!messageId) return null
  return protoStore.interfaces.find((m) => String(m.id) === String(messageId)) || null
})

watch(currentRuleSet, (ruleSet) => {
  if (!ruleSet) return
  selectedKey.value = `rule-${ruleSet.id}`
  editName.value = ruleSet.name
  editDesc.value = ruleSet.desc || ''
}, { immediate: true })

/* ---- 接口-报文-规则集 树 ---- */
const ifaceBadge = (iface) => `${(iface?.messageIds || []).length} 报文`
const schemeBadge = (scheme) => `${(scheme.interfaceIds || []).length} 接口`
const customBadge = () => ''
const ruleSetBadge = (ruleSet) => `${ruleSet.status === 'enabled' ? '启用' : '草稿'} · ${(ruleSet.rules || []).length}`

/** 报文下挂规则集（接口 → 报文 → 规则集） */
const messageLeafGroups = (message) =>
  ruleStore.ruleSetsOfMessage(message.id).map((ruleSet) => ({
    key: `rule-${ruleSet.id}`,
    kind: 'rule-set',
    icon: 'SetUp',
    label: ruleSet.name,
    badge: ruleSetBadge(ruleSet),
    ref: ruleSet,
  }))

const leafContextActions = (nodeData) => {
  if (nodeData?.kind === 'message') return [{ label: '生成校验规则', action: 'generateRules' }]
  if (nodeData?.kind === 'rule-set') return [
    { label: '复制规则集', action: 'duplicate' },
    { label: '导出 JSON', action: 'export' },
  ]
  return []
}

const onTreeSelect = (data) => {
  if (data.kind === 'rule-set' && data.ref) ruleStore.select(data.ref.id)
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  if (action === 'generateRules' && data.kind === 'message') openGenerateForMessage(data.ref)
  if (action === 'duplicate' && data.kind === 'rule-set') {
    ruleStore.select(data.ref.id)
    duplicate()
  }
  if (action === 'export' && data.kind === 'rule-set') {
    ruleStore.select(data.ref.id)
    exportJson()
  }
  if (action === 'delete-rule-set' && data.kind === 'rule-set') {
    ruleStore.select(data.ref.id)
    removeCurrent()
  }
}

/* ---- 规则集创建（归属报文） ---- */
const createRuleSetForMessage = (message, name) => {
  const owner = message?.ownerIfaceId
    ? protoStore.testInterfaces.find((i) => String(i.id) === String(message.ownerIfaceId))
    : null
  const ruleSet = ruleStore.addRuleSet({
    name: name || nextUniqueName(`${message.name}规则集`),
    systemId: owner?.systemId || message.systemId || null,
    moduleId: owner?.moduleId || message.moduleId || null,
    messageId: message.id,
    desc: '从报文字段自动生成后，可按现场需要微调阈值。',
  })
  ElMessage.success('规则集已创建')
  return ruleSet
}

const openGenerateForMessage = (message) => {
  targetInterfaceId.value = message.id
  const existing = ruleStore.ruleSetsOfMessage(message.id)
  if (existing.length) {
    ruleStore.select(existing[0].id)
  } else {
    createRuleSetForMessage(message, `${message.name}规则集`)
  }
  showGenerate.value = true
}

const createRuleSetFromCurrent = () => {
  // 在当前规则集同报文下新建；未选中报文时提示先选报文
  const message = ownerMessage.value
  if (!message) {
    ElMessage.warning('请先在左侧选择报文，右键「生成校验规则」创建规则集')
    return
  }
  createRuleSetForMessage(message, `${message.name}规则集`)
}

/* ---- 编辑字段（本地状态，blur 时提交） ---- */
const commitName = () => {
  if (!currentRuleSet.value) return
  const name = validateName(editName.value, currentRuleSet.value, '规则集')
  if (!name) {
    editName.value = currentRuleSet.value.name
    return
  }
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
  if (!currentRuleSet.value) return
  ElMessageBox.confirm(`确定删除规则集「${currentRuleSet.value.name}」？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    ruleStore.removeRuleSet(currentRuleSet.value.id)
    selectedKey.value = ''
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

/* ---- 报文 ↔ 规则 双向跳转 ---- */
const jumpToProtocol = (interfaceId) => {
  router.push({ path: '/protocol', query: { interfaceId: String(interfaceId) } })
}

// 从报文字段页跳转过来时，定位同报文规则集并（可选）弹出规则生成对话框
watch(() => route.query.interfaceId, (ifaceId) => {
  if (!ifaceId) {
    targetInterfaceId.value = null
    return
  }
  targetInterfaceId.value = ifaceId
  const message = protoStore.interfaces.find((item) => String(item.id) === String(ifaceId))
  if (!message) return
  const existing = ruleStore.ruleSetsOfMessage(message.id)
  if (existing.length) {
    ruleStore.select(existing[0].id)
  } else {
    createRuleSetForMessage(message, `${message.name}规则集`)
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
:deep(.mtree) {
  width: 100%;
  min-width: 0;
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.mtree > .el-card__body) {
  min-height: 0;
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
