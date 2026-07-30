<template>
  <div class="page execution-page">
    <div class="page__header">
      <div>
        <h2>接口收发监测</h2>
      </div>
      <div class="header-actions">
        <el-button type="success" :icon="Plus" @click="openHeaderIfaceDialog">新增接口</el-button>
        <el-button type="primary" :icon="Plus" @click="openHeaderSchemeDialog">新建方案</el-button>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="taskSearch"
            placeholder="搜索接口..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <SystemModuleTree
          v-model="selectedKey"
          title="测试接口"
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
        <el-card shadow="never" class="execution-wizard">
          <div class="wizard-shell">
            <div class="wizard-steps" aria-label="执行编排步骤">
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
                <div class="plan-strategy-bar">
                  <StrategyBar />
                </div>
                <PlanTable
                  :selected-iface="selectedIface"
                  :selected-in-plan="!!isSelectedInPlan"
                  :total-estimated-requests="totalEstimatedRequests"
                  @add-selected="addSelectedIface"
                  @drop-scheme="addScheme"
                  @drop-iface="addInterfaceFromDrop"
                  @reset-run="execution.reset()"
                />
              </div>
              <div v-show="activeTab === 'monitor'" class="step-panel">
                <LiveConsole />
              </div>
            </div>

            <div class="wizard-footer">
              <div class="wizard-actions">
                <el-button :icon="ArrowLeft" :disabled="prevDisabled" @click="prevStep">上一步</el-button>
                <template v-if="activeTab === 'monitor'">
                  <el-button
                    v-if="execution.status !== 'paused'"
                    :icon="VideoPause"
                    :disabled="execution.status !== 'running'"
                    @click="execution.pause()"
                  >
                    暂停
                  </el-button>
                  <el-button v-else type="success" :icon="VideoPlay" @click="resumeRun">继续</el-button>
                  <el-button
                    type="danger"
                    plain
                    :icon="SwitchButton"
                    :disabled="!['running', 'paused'].includes(execution.status)"
                    @click="execution.stop()"
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

    <!-- 接口方案编辑对话框 -->
    <el-dialog
      v-model="schemeDialogVisible"
      :title="editingSchemeId ? '编辑接口方案' : '新建接口方案'"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="80px" label-position="left">
        <el-form-item label="方案名称">
          <el-input v-model="schemeForm.name" placeholder="留空默认「新建接口方案」" clearable />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="schemeForm.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
        <el-form-item label="选择接口">
          <el-select
            v-model="schemeForm.interfaceIds"
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
        <el-button @click="schemeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmScheme">确定</el-button>
      </template>
    </el-dialog>

    <!-- 接口快捷配置弹窗（模块层「+接口」/ 双击接口叶子 / 拖入被拒后自动弹出） -->
    <InterfaceQuickConfig
      v-model="ifaceConfigVisible"
      :interface-id="ifaceConfigId"
      :context="ifaceConfigContext"
      @plan="(id) => addInterfaceToPlan(id)"
      @test="(id) => addInterfaceToPlan(id, { test: true })"
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
import PlanTable from '@/components/execution/PlanTable.vue'
import StrategyBar from '@/components/execution/StrategyBar.vue'
import LiveConsole from '@/components/execution/LiveConsole.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import { useConnectionStore } from '@/stores/connection'
import { useExecutionStore } from '@/stores/execution'
import { useRunBatchStore } from '@/stores/runBatch'
import { useSystemStore } from '@/stores/system'
import { useTestTaskStore } from '@/stores/testTask'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const route = useRoute()
const router = useRouter()
const taskStore = useTestTaskStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const execution = useExecutionStore()
const batchStore = useRunBatchStore()
const schemeStore = usePlanSchemeStore()
const protocolStore = useProtocolStore()
const testDataStore = useTestDataStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
protocolStore.migrateAllFromV1()
schemeStore.removeLegacyDefaults()

const selectedKey = ref('')
const taskSearch = ref('')
const activeTab = ref('plan')
const wizardSteps = [
  { name: 'plan', title: '编排计划' },
  { name: 'monitor', title: '实时监控' },
]

const selectedIface = computed(() => {
  const m = selectedKey.value.match(/^iface-(.+)$/)
  if (!m) return null
  return protocolStore.testInterfaces.find((i) => String(i.id) === String(m[1])) || null
})
const isSelectedInPlan = computed(() => {
  if (!selectedIface.value) return false
  const task = taskStore.tasks.find((t) => t.bindings?.interfaceId != null && String(t.bindings.interfaceId) === String(selectedIface.value.id))
  return task ? execution.plan.some((item) => item.taskId === task.id) : false
})
const totalEstimatedRequests = computed(() => execution.planItems.reduce((sum, item) => sum + item.estimatedRequests, 0))
const activeStepIndex = computed(() => Math.max(0, wizardSteps.findIndex((step) => step.name === activeTab.value)))
const maxReachableStepIndex = computed(() => {
  if (['done', 'stopped', 'running', 'paused'].includes(execution.status)) return 1
  if (execution.planItems.length) return 1
  return 0
})
const canOpenStep = (index) => index <= maxReachableStepIndex.value
const prevDisabled = computed(() => activeStepIndex.value === 0 || ['running', 'paused'].includes(execution.status))
const startTip = computed(() => {
  if (!execution.planItems.length) return '请先从左侧接口树加入编排计划'
  return '可以开始执行'
})
const primaryButtonText = computed(() => {
  if (activeTab.value === 'plan') return '开始执行并监控'
  if (['done', 'stopped'].includes(execution.status)) return '重新执行'
  return '进入实时监控'
})
const primaryIcon = computed(() => (['done', 'stopped'].includes(execution.status) && activeTab.value === 'monitor') ? RefreshRight : ArrowRight)
const primaryDisabled = computed(() => {
  if (activeTab.value === 'plan') return !execution.planItems.length
  if (activeTab.value === 'monitor') return !['done', 'stopped'].includes(execution.status)
  return false
})
const primaryTip = computed(() => {
  if (activeTab.value === 'plan') return '请先加入至少一个测试接口'
  if (activeTab.value === 'monitor') return '执行完成后可重新执行'
  return ''
})

/* ---- 接口方案：与模块同级的树节点 ---- */
const extraSystemChildren = (sys) => {
  const schemes = schemeStore.schemesOfSystem(sys.id, 'exec')
  return [{
    key: `schemes-${sys.id}`,
    kind: 'schemeGroup',
    icon: 'FolderOpened',
    label: '接口方案',
    ref: { id: `schemes-${sys.id}`, systemId: sys.id },
    addActions: [{ groupKind: 'scheme', label: '+方案', type: 'warning' }],
    children: schemes.map((s) => ({
      key: `scheme-${s.id}`,
      kind: 'scheme',
      icon: 'Notebook',
      label: s.name,
      badge: `${s.interfaceIds.length} 接口`,
      ref: s,
    })),
  }]
}

const schemeDialogVisible = ref(false)
const schemeForm = ref({ name: '', interfaceIds: [], remark: '' })
const editingSchemeId = ref(null)
const currentSchemeSystemId = ref(null)

const availableInterfaces = computed(() => protocolStore.testInterfaces.filter((i) => {
  if (!currentSchemeSystemId.value) return true
  return i.systemId === currentSchemeSystemId.value
}))

const openSchemeDialog = (systemId, scheme) => {
  currentSchemeSystemId.value = systemId
  if (scheme) {
    editingSchemeId.value = scheme.id
    schemeForm.value = { name: scheme.name, interfaceIds: [...scheme.interfaceIds], remark: scheme.remark || '' }
  } else {
    editingSchemeId.value = null
    schemeForm.value = { name: '', interfaceIds: [], remark: '' }
  }
  schemeDialogVisible.value = true
}

const openHeaderSchemeDialog = () => {
  const selectedSchemeSystemId = selectedKey.value.startsWith('scheme-')
    ? schemeStore.selected?.systemId
    : null
  const systemId = selectedIface.value?.systemId
    || selectedSchemeSystemId
    || systemStore.currentId
    || systemStore.visibleSystems[0]?.id
    || null
  openSchemeDialog(systemId, null)
}

const confirmScheme = () => {
  const currentScheme = editingSchemeId.value
    ? schemeStore.schemes.find((scheme) => scheme.id === editingSchemeId.value)
    : null
  const candidateName = schemeForm.value.name.trim() || currentScheme?.name || nextUniqueName('新建接口方案')
  const validName = validateName(candidateName, currentScheme, '方案')
  if (!validName) return
  schemeForm.value.name = validName
  if (editingSchemeId.value) {
    schemeStore.update(editingSchemeId.value, { ...schemeForm.value })
    ElMessage.success('接口方案已更新')
  } else {
    schemeStore.add({ ...schemeForm.value, systemId: currentSchemeSystemId.value, type: 'exec' })
    ElMessage.success('接口方案已创建')
  }
  schemeDialogVisible.value = false
}

const onSchemeAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'scheme') {
    openSchemeDialog(module.systemId || module.id, null)
  }
}

/* 接口配置状态徽标：接口只展示数据集关联与触发方式。 */
const TRIGGER_LABEL = { manual: '手动', scheduled: '定时', periodic: '周期' }
const ifaceBadge = (iface) => {
  const dsCount = (iface.datasetIds || []).length
  if (!dsCount) return '未关联数据'
  const trigger = TRIGGER_LABEL[iface.strategy?.trigger] || '手动'
  return `${dsCount}数据集·${trigger}`
}

const leafGroups = (module) => {
  const kw = taskSearch.value.toLowerCase()
  let ifaces = protocolStore.testInterfaces.filter((i) => i.moduleId === module.id)
  if (kw) {
    ifaces = ifaces.filter((i) =>
      i.name.toLowerCase().includes(kw) ||
      (i.desc || '').toLowerCase().includes(kw)
    )
  }
  // 模块下直接展开接口（扁平化，不再有「接口」中间节点）；「+接口」按钮落在模块行上
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
      badge: ifaceBadge(iface),
      ref: iface,
      module,
    })),
  }]
}

const leafContextActions = (nodeData) => {
  if (nodeData?.kind === 'scheme' && nodeData.ref) {
    return [{ label: '编辑方案', action: 'edit-scheme' }]
  }
  if (nodeData?.kind === 'iface' && nodeData.ref) {
    return [
      { label: '配置接口', action: 'config-iface' },
      { label: '加入编排计划', action: 'iface-to-plan' },
      { label: '发送测试', action: 'iface-test' },
    ]
  }
  return []
}

const onTreeSelect = (data) => {
  if (data.kind === 'scheme' && data.ref) {
    selectedKey.value = data.key
    schemeStore.select(data.ref.id)
    openSchemeDialog(data.ref.systemId || currentSchemeSystemId.value, data.ref)
    return
  }
  if (data.kind === 'iface' && data.ref) {
    selectedKey.value = data.key
    return
  }
}

const addSelectedIface = () => {
  if (!selectedIface.value) return
  addInterfaceToPlan(selectedIface.value.id)
}

/* ---- 接口快捷配置弹窗 ---- */
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

/* ---- 接口完整性校验：接口只需显式关联数据集；报文与字段由数据集向下解析。 ---- */
const interfaceReadiness = (iface) => {
  const reasons = []
  if (!(iface.datasetIds || []).length) {
    reasons.push('未关联测试数据集（请在接口配置中绑定至少一个数据集）')
  } else if (!collectTestInterfaceFields(
    iface,
    testDataStore.datasets,
    protocolStore.interfaces,
    protocolStore.protocols,
    'send',
  ).length) {
    reasons.push('关联的数据集没有可用报文或字段')
  }
  return { ok: !reasons.length, reasons }
}

/**
 * 接口 → 编排计划统一入口（拖拽 / 右键 / 弹窗按钮 / 路由跳转共用）。
 * B 方案：未配置完全 → 拒绝加入 + 错误提示 + 自动弹出配置弹窗。
 * @returns {boolean} 是否成功加入
 */
const addInterfaceToPlan = (interfaceId, { test = false, silent = false } = {}) => {
  const iface = protocolStore.testInterfaces.find((i) => String(i.id) === String(interfaceId))
  if (!iface) {
    ElMessage.warning('未找到对应接口')
    return false
  }
  const readiness = interfaceReadiness(iface)
  if (!readiness.ok) {
    ElMessage.error(`接口「${iface.name}」未配置完全，无法加入编排计划：${readiness.reasons.join('；')}`)
    openIfaceConfig(iface.id)
    return false
  }
  const task = ensureTaskForInterface(iface)
  // 把接口配置同步到执行配置（发送间隔 / 触发策略）
  execution.setConfig({
    sendInterval: iface.sendInterval || 500,
    trigger: iface.strategy?.trigger || 'manual',
    scheduleAt: iface.strategy?.scheduleAt || null,
    periodicInterval: iface.strategy?.periodicInterval || 60,
    periodicUnit: iface.strategy?.periodicUnit || 's',
    periodicCount: iface.strategy?.periodicCount ?? null,
  })
  const added = execution.addToPlan(task.id)
  if (added) execution.appendTaskToActiveQueue(task.id)
  selectedKey.value = `iface-${iface.id}`
  if (test) {
    if (execution.start()) {
      activeTab.value = 'monitor'
      ElMessage.success('已进入发送测试（实时监控）')
    } else {
      ElMessage.warning('无法开始发送测试，请检查接口配置')
    }
    return true
  }
  activeTab.value = 'plan'
  if (!silent) {
    if (added) ElMessage.success(`接口「${iface.name}」已加入编排计划`)
    else ElMessage.info(`接口「${iface.name}」已在编排计划中`)
  }
  return true
}

// 接口叶子拖入编排计划（PlanTable drop-iface）
const addInterfaceFromDrop = (interfaceId) => {
  addInterfaceToPlan(interfaceId)
}

// 找到（或创建）绑定指定接口的执行条目，并同步接口上的数据集/执行策略
const ensureTaskForInterface = (iface) => {
  let task = taskStore.tasks.find((t) => t.bindings.interfaceId != null && String(t.bindings.interfaceId) === String(iface.id))
  if (!task) {
    task = taskStore.addTask({ name: `${iface.name} 联试`, systemId: iface.systemId, moduleId: iface.moduleId })
    taskStore.updateBindings(task.id, { interfaceId: iface.id })
  }
  taskStore.updateBindings(task.id, { datasetIds: iface.datasetIds || [] })
  taskStore.updateStrategy(task.id, { ...(iface.strategy || {}) })
  return task
}

// 接口方案拖入编排计划：把方案内全部接口展开为任务逐个加入
const addScheme = (schemeId) => {
  const scheme = schemeStore.schemes.find((s) => s.id === schemeId)
  if (!scheme) {
    ElMessage.warning('未找到对应的接口方案')
    return
  }
  if (!scheme.interfaceIds.length) {
    ElMessage.info(`方案「${scheme.name}」还没有配置接口，请先编辑方案并勾选接口`)
    return
  }
  let added = 0
  let skipped = 0
  let missing = 0
  let unready = 0
  scheme.interfaceIds.forEach((interfaceId) => {
    const iface = protocolStore.testInterfaces.find((i) => String(i.id) === String(interfaceId))
    if (!iface) { missing += 1; return }
    // 方案拖入：全部接口均加入计划（未配置完全的仅计入提示，不拒绝），确保方案内接口完整可见
    if (!interfaceReadiness(iface).ok) unready += 1
    const task = ensureTaskForInterface(iface)
    if (execution.addToPlan(task.id)) {
      execution.appendTaskToActiveQueue(task.id)
      added += 1
    } else skipped += 1
  })
  const extra = [
    skipped ? `${skipped} 个已在计划中` : '',
    unready ? `${unready} 个未配置完全（需补全字段/数据集）` : '',
    missing ? `${missing} 个接口已不存在` : '',
  ].filter(Boolean).join('，')
  if (added) {
    ElMessage.success(`方案「${scheme.name}」已加入 ${added} 个接口${extra ? `（${extra}）` : ''}`)
  } else if (skipped) {
    ElMessage.info(`方案「${scheme.name}」的接口均已在编排计划中`)
  } else {
    ElMessage.warning(`方案「${scheme.name}」内的接口均已不存在，请重新编辑方案`)
  }
  activeTab.value = 'plan'
}

const onLeafAction = ({ action, data }) => {
  if (action === 'edit-scheme' && data?.ref) {
    openSchemeDialog(data.ref.systemId || currentSchemeSystemId.value, data.ref)
  }
  if (action === 'config-iface' && data?.ref) openIfaceConfig(data.ref.id)
  if (action === 'iface-to-plan' && data?.ref) addInterfaceToPlan(data.ref.id)
  if (action === 'iface-test' && data?.ref) addInterfaceToPlan(data.ref.id, { test: true })
}

const onAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'scheme') {
    openSchemeDialog(module.systemId || module.id, null)
    return
  }
  if (groupKind === 'iface') {
    openIfaceConfig(null, module)
  }
}

const onDeleteLeaf = (node) => {
  if (node.kind === 'scheme' && node.ref) {
    schemeStore.remove(node.ref.id)
    ElMessage.success('接口方案已删除')
  }
  if (node.kind === 'iface' && node.ref) {
    protocolStore.removeTestInterface(node.ref.id)
    ElMessage.success('接口已删除')
  }
}

const startRun = () => {
  if (!execution.start()) {
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
}

const resumeRun = () => {
  execution.resume()
  activeTab.value = 'monitor'
}

const rerun = () => {
  execution.reset()
  activeTab.value = 'plan'
}

// 从报文字段管理页「跳转到计划 / 发送测试」：统一走 addInterfaceToPlan（含 B 方案完整性校验）
const handleInterfaceJump = (interfaceId, isTest = false) => {
  addInterfaceToPlan(interfaceId, { test: isTest })
}

const firstQueryValue = (value) => Array.isArray(value) ? value[0] : value

watch(() => execution.status, (status) => {
  if (status === 'running') activeTab.value = 'monitor'
})

onMounted(() => {
  // 演示接口方案：首次进入时填充 3 个武器管理接口（ID 在种子加载后确定）
  const demoScheme = schemeStore.schemes.find(s => s.id === 'scheme-5002')
  if (demoScheme && !demoScheme.interfaceIds.length) {
    const ifaces = protocolStore.testInterfaces.filter(i => i.systemId === 'sys-weapon').slice(0, 3)
    if (ifaces.length) schemeStore.update(demoScheme.id, { interfaceIds: ifaces.map(i => i.id) })
  }

  // 从接口配置「跳转到计划 / 发送测试」
  const jumpInterfaceId = firstQueryValue(route.query.interfaceId)
  if (jumpInterfaceId) {
    handleInterfaceJump(jumpInterfaceId, route.query.test === '1')
    router.replace({ path: '/execution' })
    return
  }

  const runId = firstQueryValue(route.query.runId)
  if (runId) {
    const batch = batchStore.byId(String(runId))
    if (batch && execution.loadBatchSnapshot(batch)) {
      activeTab.value = 'monitor'
      if (batch.systemId) systemStore.setCurrent(batch.systemId)
      ElMessage.success('已打开执行批次摘要')
      return
    }
  }

  const taskId = firstQueryValue(route.query.taskId || route.query.id)
  if (taskId) {
    const task = taskStore.tasks.find((item) => item.id === taskId)
    if (task) {
      selectedKey.value = `task-${task.id}`
      taskStore.select(task.id)
      execution.addToPlan(task.id)
      activeTab.value = 'plan'
      ElMessage.success('已从接口页带入编排计划')
    }
  }
})

onBeforeUnmount(() => {
  if (execution.status === 'running') execution.pause()
})
</script>

<style scoped lang="scss">
.execution-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
.execution-wizard {
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
.plan-strategy-bar {
  padding: 10px 14px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
}
@media (max-width: 1180px) {
  .execution-page { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .wizard-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wizard-footer { align-items: flex-start; flex-direction: column; }
  .wizard-actions { width: 100%; justify-content: flex-end; }
}
</style>
