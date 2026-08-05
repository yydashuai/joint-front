<template>
  <div class="page reception-page">
    <div class="page__header">
      <div>
        <h2>接口收发监测</h2>
      </div>
      <div class="header-actions">
        <el-button type="success" :icon="Plus" @click="openHeaderIfaceDialog">新增接口</el-button>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="ifaceSearch"
            placeholder="搜索接口..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <SystemModuleTree
          v-model="selectedKey"
          title="接收接口"
          draggable-leaves
          :leaf-groups="leafGroups"
          :extra-system-children="extraSystemChildren"
          :leaf-context-actions="leafContextActions"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @delete-leaf="onDeleteLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <div class="main-panel">
        <el-card shadow="never" class="reception-wizard">
          <div class="wizard-shell">
            <div class="wizard-steps" aria-label="接收编排步骤">
              <button
                v-for="(step, index) in wizardSteps"
                :key="step.name"
                type="button"
                class="wizard-step"
                :class="{
                  'wizard-step--active': activeTab === step.name,
                  'wizard-step--done': index < activeStepIndex,
                }"
                :disabled="!canOpenStep(index)"
                @click="goWizardStep(step.name, index)"
              >
                <span class="wizard-step__index">{{ index + 1 }}</span>
                <span class="wizard-step__copy">
                  <strong>{{ step.title }}</strong>
                </span>
              </button>
            </div>

            <div class="wizard-body">
              <div v-show="activeTab === 'plan'" class="step-panel plan-layout">
                <ReceptionPlanTable
                  :selected-iface="selectedIface"
                  :selected-in-plan="!!isSelectedInPlan"
                  @add-selected="addSelectedIface"
                  @drop-iface="addInterfaceFromDrop"
                  @drop-scheme="addRecvScheme"
                  @reset-run="recvStore.reset()"
                />
              </div>
              <div v-show="activeTab === 'monitor'" class="step-panel">
                <ReceiveMonitor />
              </div>
              <div v-show="activeTab === 'history'" class="step-panel" style="display:flex;flex-direction:column;height:100%;">
                <ReceptionHistory />
              </div>
            </div>

            <div class="wizard-footer">
              <div class="wizard-footer__meta">
                <strong>{{ currentStep.title }}</strong>
              </div>
              <div class="wizard-actions">
                <el-button :icon="ArrowLeft" :disabled="prevDisabled" @click="prevStep">上一步</el-button>
                <template v-if="activeTab === 'monitor'">
                  <el-button
                    v-if="recvStore.status !== 'paused'"
                    :icon="VideoPause"
                    :disabled="recvStore.status !== 'listening'"
                    @click="recvStore.pause()"
                  >
                    暂停
                  </el-button>
                  <el-button v-else type="success" :icon="VideoPlay" @click="resumeRun">继续</el-button>
                  <el-button
                    type="danger"
                    plain
                    :icon="SwitchButton"
                    :disabled="!['listening', 'paused'].includes(recvStore.status)"
                    @click="recvStore.stop()"
                  >
                    终止
                  </el-button>
                </template>
                <el-tooltip :content="primaryTip" :disabled="!primaryDisabled" placement="top">
                  <span>
                    <el-button
                      type="primary"
                      :icon="primaryIcon"
                      :disabled="primaryDisabled"
                      @click="nextStep"
                    >
                      {{ primaryButtonText }}
                    </el-button>
                  </span>
                </el-tooltip>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 监听方案编辑对话框 -->
    <el-dialog
      v-model="recvSchemeDialogVisible"
      :title="editingRecvSchemeId ? '编辑监听方案' : '新建监听方案'"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="80px" label-position="left">
        <el-form-item label="方案名称">
          <el-input v-model="recvSchemeForm.name" placeholder="留空默认「新建监听方案」" clearable />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="recvSchemeForm.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="选择接口">
          <el-select
            v-model="recvSchemeForm.interfaceIds"
            multiple
            filterable
            placeholder="选择要纳入方案的接口"
            style="width: 100%"
          >
            <el-option
              v-for="iface in availableInterfaces"
              :key="iface.id"
              :label="iface.name"
              :value="iface.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="recvSchemeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRecvScheme">确定</el-button>
      </template>
    </el-dialog>

    <!-- 接口快捷配置弹窗（模块层「+接口」/ 右键「配置接口」；接收侧不要求数据集，隐藏加入计划/发送测试） -->
    <InterfaceQuickConfig
      v-model="ifaceConfigVisible"
      :interface-id="ifaceConfigId"
      :context="ifaceConfigContext"
      :hide-plan-actions="true"
      @test="testInterface"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowRight, Plus, RefreshRight, Search, SwitchButton, VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ReceptionPlanTable from '@/components/reception/ReceptionPlanTable.vue'
import ReceiveMonitor from '@/components/reception/ReceiveMonitor.vue'
import ReceptionHistory from '@/components/reception/ReceptionHistory.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import { useConnectionStore } from '@/stores/connection'
import { useReceptionStore } from '@/stores/reception'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const route = useRoute()
const router = useRouter()
const connStore = useConnectionStore()
const protocolStore = useProtocolStore()
const testDataStore = useTestDataStore()
const recvStore = useReceptionStore()
const schemeStore = usePlanSchemeStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
protocolStore.migrateAllFromV1()

const selectedKey = ref('')
const ifaceSearch = ref('')
const activeTab = ref('plan')
const wizardSteps = [
  { name: 'plan', title: '编排监听计划' },
  { name: 'monitor', title: '实时接收监控' },
  { name: 'history', title: '历史统计' },
]

const selectedIface = computed(() => {
  const m = selectedKey.value.match(/^iface-(.+)$/)
  if (!m) return null
  return protocolStore.testInterfaces.find((i) => String(i.id) === String(m[1])) || null
})
const isSelectedInPlan = computed(() => {
  if (!selectedIface.value) return false
  return recvStore.plan.some((p) => String(p.interfaceId) === String(selectedIface.value.id))
})

const activeStepIndex = computed(() => Math.max(0, wizardSteps.findIndex((step) => step.name === activeTab.value)))
const currentStep = computed(() => wizardSteps[activeStepIndex.value] || wizardSteps[0])
const maxReachableStepIndex = computed(() => {
  if (['listening', 'paused', 'stopped', 'done'].includes(recvStore.status)) return 2
  if (recvStore.planItems.length) return 1
  return 0
})
const canOpenStep = (index) => index <= maxReachableStepIndex.value
const prevDisabled = computed(() => activeStepIndex.value === 0 || ['listening', 'paused'].includes(recvStore.status))

const startTip = computed(() => {
  if (!recvStore.planItems.length) return '请先从左侧接口树加入监听计划'
  return '可以开始监听'
})
const primaryButtonText = computed(() => {
  if (activeTab.value === 'plan') return '开始监听并监控'
  if (['done', 'stopped'].includes(recvStore.status)) return '重新监听'
  if (activeTab.value === 'history') return '重新监听'
  return '进入实时监控'
})
const primaryIcon = computed(() => {
  if ((['done', 'stopped'].includes(recvStore.status) && activeTab.value === 'monitor') || activeTab.value === 'history') return RefreshRight
  return ArrowRight
})
const primaryDisabled = computed(() => {
  if (activeTab.value === 'plan') return !recvStore.planItems.length
  if (activeTab.value === 'history') return false
  if (activeTab.value === 'monitor') return !['done', 'stopped'].includes(recvStore.status)
  return false
})
const primaryTip = computed(() => {
  if (activeTab.value === 'plan') return '请先加入至少一个接收接口'
  if (activeTab.value === 'monitor') return '监听完成后可重新监听'
  return ''
})

/* ---- 接口配置状态徽标：字段与报文由数据集向下关联。 ---- */
const recvIfaceBadge = (iface) => {
  const datasetCount = (iface.datasetIds || []).length
  return datasetCount ? `${datasetCount} 数据集` : '未关联数据'
}

const leafGroups = (module) => {
  const kw = ifaceSearch.value.toLowerCase()
  let ifaces = protocolStore.testInterfaces.filter((i) => i.moduleId === module.id)
  if (kw) {
    ifaces = ifaces.filter((i) =>
      i.name.toLowerCase().includes(kw) ||
      (i.desc || '').toLowerCase().includes(kw)
    )
  }
  return [{
    flat: true,
    kind: 'iface',
    addLabel: '+接口',
    addType: 'success',
    items: ifaces.map((iface) => ({
      key: `iface-${iface.id}`,
      kind: 'iface',
      icon: 'Link',
      label: iface.name,
      badge: recvIfaceBadge(iface),
      ref: iface,
      module,
    })),
  }]
}

/* ---- 接收方案：与模块同级的树节点 ---- */
const extraSystemChildren = (sys) => {
  const schemes = schemeStore.schemesOfSystem(sys.id, 'recv')
  return [{
    key: `recv-schemes-${sys.id}`,
    kind: 'recvSchemeGroup',
    icon: 'FolderOpened',
    label: '监听方案',
    ref: { id: `recv-schemes-${sys.id}`, systemId: sys.id },
    addActions: [{ groupKind: 'recvScheme', label: '+方案', type: 'warning' }],
    children: schemes.map((s) => ({
      key: `recv-scheme-${s.id}`,
      kind: 'recvScheme',
      icon: 'Notebook',
      label: s.name,
      badge: `${s.interfaceIds.length} 接口`,
      ref: s,
    })),
  }]
}

const leafContextActions = (nodeData) => {
  if (nodeData?.kind === 'iface' && nodeData.ref) {
    return [
      { label: '配置接口', action: 'config-iface' },
      { label: '加入监听计划', action: 'iface-to-plan' },
    ]
  }
  if (nodeData?.kind === 'recvScheme' && nodeData.ref) {
    return [{ label: '编辑方案', action: 'edit-scheme' }]
  }
  return []
}

const onTreeSelect = (data) => {
  if (data.kind === 'iface' && data.ref) {
    selectedKey.value = data.key
  }
}

/* ---- 接口快捷配置弹窗（接收侧仅作字段/归属配置，不要求数据集） ---- */
const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)
const ifaceConfigContext = ref(null)
const openIfaceConfig = (interfaceId = null, module = null) => {
  ifaceConfigId.value = interfaceId
  ifaceConfigContext.value = module ? { systemId: module.systemId, moduleId: module.id } : null
  ifaceConfigVisible.value = true
}

const openHeaderIfaceDialog = () => {
  openIfaceConfig(null, null)
}

/* ---- 接收侧就绪：接口需配置报文；报文再解析字段。 ---- */
const interfaceReadiness = (iface) => {
  const reasons = []
  if (!(iface.messageIds || []).length) {
    reasons.push('未配置报文')
  } else if (!collectTestInterfaceFields(
    iface,
    testDataStore.datasets,
    protocolStore.interfaces,
    protocolStore.protocols,
    'receive',
  ).length) {
    reasons.push('接口名下报文没有可用字段')
  }
  return { ok: !reasons.length, reasons }
}

const addInterfaceToPlan = (interfaceId) => {
  const iface = protocolStore.testInterfaces.find((i) => String(i.id) === String(interfaceId))
  if (!iface) {
    ElMessage.warning('未找到对应接口')
    return false
  }
  const readiness = interfaceReadiness(iface)
  if (!readiness.ok) {
    ElMessage.error(`接口「${iface.name}」未配置字段，无法加入监听计划：${readiness.reasons.join('；')}`)
    openIfaceConfig(iface.id)
    return false
  }
  const added = recvStore.addToPlan(iface.id)
  selectedKey.value = `iface-${iface.id}`
  if (added) ElMessage.success(`接口「${iface.name}」已加入监听计划`)
  else ElMessage.info(`接口「${iface.name}」已在监听计划中`)
  return true
}

const addSelectedIface = () => {
  if (!selectedIface.value) return
  addInterfaceToPlan(selectedIface.value.id)
}
const addInterfaceFromDrop = (interfaceId) => addInterfaceToPlan(interfaceId)

const testInterface = (interfaceId) => {
  if (!addInterfaceToPlan(interfaceId)) return
  startRun()
}

/* ---- 方案管理（复用 planScheme store，type='recv'） ---- */
const recvSchemeDialogVisible = ref(false)
const recvSchemeForm = ref({ name: '', interfaceIds: [], remark: '' })
const editingRecvSchemeId = ref(null)
const currentRecvSchemeSystemId = ref(null)

const availableInterfaces = computed(() => {
  if (!currentRecvSchemeSystemId.value) return protocolStore.testInterfaces
  return protocolStore.testInterfaces.filter(i => i.systemId === currentRecvSchemeSystemId.value)
})

const openRecvSchemeDialog = (systemId, scheme) => {
  currentRecvSchemeSystemId.value = systemId
  if (scheme) {
    editingRecvSchemeId.value = scheme.id
    recvSchemeForm.value = { name: scheme.name, interfaceIds: [...scheme.interfaceIds], remark: scheme.remark || '' }
  } else {
    editingRecvSchemeId.value = null
    recvSchemeForm.value = { name: '', interfaceIds: [], remark: '' }
  }
  recvSchemeDialogVisible.value = true
}

const confirmRecvScheme = () => {
  const currentScheme = editingRecvSchemeId.value
    ? schemeStore.schemes.find((scheme) => scheme.id === editingRecvSchemeId.value)
    : null
  const candidateName = recvSchemeForm.value.name.trim() || currentScheme?.name || nextUniqueName('新建监听方案')
  const validName = validateName(candidateName, currentScheme, '方案')
  if (!validName) return
  recvSchemeForm.value.name = validName
  if (editingRecvSchemeId.value) {
    schemeStore.update(editingRecvSchemeId.value, { ...recvSchemeForm.value })
    ElMessage.success('监听方案已更新')
  } else {
    schemeStore.add({ ...recvSchemeForm.value, systemId: currentRecvSchemeSystemId.value, type: 'recv' })
    ElMessage.success('监听方案已创建')
  }
  recvSchemeDialogVisible.value = false
}

// 监听方案拖入编排计划：把方案内全部接口展开为任务逐个加入
const addRecvScheme = (schemeId) => {
  const scheme = schemeStore.schemes.find((s) => s.id === schemeId)
  if (!scheme) { ElMessage.warning('未找到对应的监听方案'); return }
  if (!scheme.interfaceIds.length) { ElMessage.info(`方案「${scheme.name}」还没有配置接口，请先编辑方案并勾选接口`); return }
  let added = 0; let skipped = 0; let missing = 0
  scheme.interfaceIds.forEach((interfaceId) => {
    const iface = protocolStore.testInterfaces.find((i) => String(i.id) === String(interfaceId))
    if (!iface) { missing += 1; return }
    if (recvStore.addToPlan(iface.id)) added += 1
    else skipped += 1
  })
  const extra = [skipped ? `${skipped} 个已在计划中` : '', missing ? `${missing} 个接口已不存在` : ''].filter(Boolean).join('，')
  if (added) ElMessage.success(`方案「${scheme.name}」已加入 ${added} 个接口${extra ? `（${extra}）` : ''}`)
  else ElMessage.info(`方案「${scheme.name}」的接口均已在监听计划中`)
}

const deleteRecvScheme = (scheme) => {
  schemeStore.remove(scheme.id)
  ElMessage.success('监听方案已删除')
}

const onLeafAction = ({ action, data }) => {
  if (action === 'edit-scheme' && data?.ref) {
    openRecvSchemeDialog(data.ref.systemId || currentRecvSchemeSystemId.value, data.ref)
  }
  if (action === 'config-iface' && data?.ref) openIfaceConfig(data.ref.id)
  if (action === 'iface-to-plan' && data?.ref) addInterfaceToPlan(data.ref.id)
}

const onAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'recvScheme') {
    openRecvSchemeDialog(module.systemId || module.id, null)
  } else if (module) {
    openIfaceConfig(null, module)
  }
}

const onDeleteLeaf = (node) => {
  if (node.kind === 'iface' && node.ref) {
    protocolStore.removeTestInterface(node.ref.id)
    ElMessage.success('接口已删除')
  }
}

const startRun = () => {
  if (!recvStore.start()) {
    ElMessage.warning(startTip.value)
    return
  }
  activeTab.value = 'monitor'
}

const goWizardStep = (name, index) => {
  if (!canOpenStep(index)) return
  activeTab.value = name
}

const prevStep = () => {
  const prev = wizardSteps[activeStepIndex.value - 1]
  if (prev) activeTab.value = prev.name
}

const nextStep = () => {
  if (activeTab.value === 'plan') {
    startRun()
    return
  }
  if (activeTab.value === 'monitor') {
    rerun()
    return
  }
  // history → 重新监听
  rerun()
}

const resumeRun = () => {
  recvStore.resume()
  activeTab.value = 'monitor'
}

const rerun = () => {
  recvStore.reset()
  activeTab.value = 'plan'
}

watch(() => recvStore.status, (status) => {
  if (status === 'listening') activeTab.value = 'monitor'
})

onMounted(() => {
  const jumpInterfaceId = route.query.interfaceId
  if (jumpInterfaceId) {
    addInterfaceToPlan(jumpInterfaceId)
    router.replace({ path: '/execution', query: { mode: 'receive' } })
  }
})

onBeforeUnmount(() => {
  if (recvStore.status === 'listening') recvStore.pause()
})
</script>

<style scoped lang="scss">
.reception-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
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
:deep(.smt > .el-card__body) {
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
.reception-wizard {
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
    overflow: hidden;
    padding: 0;
  }
}
.wizard-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.wizard-steps {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, #fbfdff, #f6f8fb);
}
.wizard-step {
  min-width: 0;
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}
.wizard-step:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 6px 18px rgba(31, 49, 80, .07);
}
.wizard-step:disabled {
  cursor: not-allowed;
  opacity: .62;
}
.wizard-step:disabled:hover {
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
}
.wizard-step--active {
  border-color: var(--el-color-primary);
  background: linear-gradient(180deg, #ffffff, #f0f6ff);
  box-shadow: inset 0 -2px 0 var(--el-color-primary);
}
.wizard-step--done .wizard-step__index {
  color: #fff;
  background: var(--el-color-success);
  border-color: var(--el-color-success);
}
.wizard-step__index {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
  font: 700 13px Consolas, Monaco, monospace;
}
.wizard-step--active .wizard-step__index {
  color: #fff;
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.wizard-step__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.wizard-step__copy strong {
  font-size: 14px;
  font-weight: 650;
}
.wizard-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 18px;
}
.step-panel {
  min-height: 0;
}
.wizard-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: #fff;
}
.wizard-footer__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.wizard-footer__meta strong {
  font-size: 14px;
  font-weight: 650;
}
.wizard-footer__meta span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.wizard-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.plan-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
@media (max-width: 1180px) {
  .reception-page { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .wizard-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .wizard-footer { align-items: flex-start; flex-direction: column; }
  .wizard-actions { width: 100%; justify-content: flex-end; }
}
</style>
