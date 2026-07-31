<template>
  <div class="page interface-monitoring">
    <div class="page__header">
      <div>
        <h2>接口收发监测</h2>
      </div>
      <div class="header-actions">
        <el-button type="success" :icon="Plus" @click="openHeaderIfaceDialog">新增接口</el-button>
        <el-button type="primary" :icon="Plus" @click="openHeaderSchemeDialog">
          新建接口方案
        </el-button>
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
        <el-card shadow="never" class="monitoring-wizard">
          <div class="wizard-shell">
            <div class="wizard-steps" aria-label="接口收发监控">
              <button
                v-for="(step, index) in monitorSteps"
                :key="step.name"
                type="button"
                class="wizard-step"
                :class="{ 'wizard-step--active': activeMode === step.name }"
                @click="selectMode(step.name)"
              >
                <span class="wizard-step__index">{{ index + 1 }}</span>
                <span class="wizard-step__copy"><strong>{{ step.title }}</strong></span>
              </button>
            </div>

            <div class="wizard-body">
              <div v-show="activeMode === 'send'" class="monitor-panel">
                <PlanTable
                  :selected-iface="selectedIface"
                  :selected-in-plan="isSelectedInSendPlan"
                  :total-estimated-requests="totalEstimatedRequests"
                  @add-selected="addSelectedIface"
                  @drop-scheme="addSendScheme"
                  @drop-iface="addInterfaceFromDrop"
                  @reset-run="execution.reset()"
                />
                <LiveConsole />
              </div>

              <div v-show="activeMode === 'receive'" class="monitor-panel">
                <ReceptionPlanTable
                  :selected-iface="selectedIface"
                  :selected-in-plan="isSelectedInReceivePlan"
                  @add-selected="addSelectedIface"
                  @drop-iface="addInterfaceFromDrop"
                  @drop-scheme="addReceiveScheme"
                  @reset-run="recvStore.reset()"
                />
                <ReceiveMonitor />
              </div>
            </div>

            <div class="wizard-footer">
              <div class="wizard-footer__meta">
                <strong>{{ activeMode === 'send' ? '发送监控' : '接收监控' }}</strong>
                <span>{{ activeFooterText }}</span>
              </div>
              <div class="wizard-actions">
                <template v-if="activeMode === 'send'">
                  <el-button
                    type="primary"
                    :icon="sendPrimaryIcon"
                    :disabled="sendPrimaryDisabled"
                    @click="startSend"
                  >
                    {{ sendPrimaryText }}
                  </el-button>
                  <template v-if="['running', 'paused'].includes(execution.status)">
                    <el-button
                      v-if="execution.status !== 'paused'"
                      :icon="VideoPause"
                      @click="execution.pause()"
                    >
                      暂停
                    </el-button>
                    <el-button v-else type="success" :icon="VideoPlay" @click="execution.resume()">继续</el-button>
                  </template>
                  <el-button
                    v-if="['running', 'paused'].includes(execution.status)"
                    type="danger"
                    plain
                    :icon="SwitchButton"
                    @click="stopSend"
                  >
                    终止
                  </el-button>
                  <el-button
                    v-else-if="['done', 'stopped'].includes(execution.status) && execution.currentRunId"
                    type="primary"
                    :icon="Tickets"
                    @click="openBatchReport(execution.currentRunId)"
                  >
                    生成报告
                  </el-button>
                </template>

                <template v-else>
                  <el-button
                    type="primary"
                    :icon="receivePrimaryIcon"
                    :disabled="receivePrimaryDisabled"
                    @click="startReceive"
                  >
                    {{ receivePrimaryText }}
                  </el-button>
                  <template v-if="['listening', 'paused'].includes(recvStore.status)">
                    <el-button
                      v-if="recvStore.status !== 'paused'"
                      :icon="VideoPause"
                      @click="recvStore.pause()"
                    >
                      暂停
                    </el-button>
                    <el-button v-else type="success" :icon="VideoPlay" @click="recvStore.resume()">继续</el-button>
                  </template>
                  <el-button
                    v-if="['listening', 'paused'].includes(recvStore.status)"
                    type="danger"
                    plain
                    :icon="SwitchButton"
                    @click="stopReceive"
                  >
                    终止
                  </el-button>
                  <el-button
                    v-else-if="['done', 'stopped'].includes(recvStore.status) && recvStore.currentBatchId"
                    type="primary"
                    :icon="Tickets"
                    @click="openBatchReport(recvStore.currentBatchId)"
                  >
                    生成报告
                  </el-button>
                </template>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <el-dialog
      v-model="schemeDialogVisible"
      :title="editingSchemeId ? `编辑${schemeTypeLabel}` : `新建${schemeTypeLabel}`"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="80px" label-position="left">
        <el-form-item label="方案名称">
          <el-input v-model="schemeForm.name" :placeholder="`留空默认「新建${schemeTypeLabel}」`" clearable />
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

    <InterfaceQuickConfig
      v-model="ifaceConfigVisible"
      :interface-id="ifaceConfigId"
      :context="ifaceConfigContext"
      :hide-plan-actions="activeMode === 'receive'"
      @plan="(id) => addSendInterface(id)"
      @test="testConfiguredInterface"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, RefreshRight, Search, SwitchButton, Tickets, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import PlanTable from '@/components/execution/PlanTable.vue'
import LiveConsole from '@/components/execution/LiveConsole.vue'
import ReceptionPlanTable from '@/components/reception/ReceptionPlanTable.vue'
import ReceiveMonitor from '@/components/reception/ReceiveMonitor.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import { useExecutionStore } from '@/stores/execution'
import { useReceptionStore } from '@/stores/reception'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useTestTaskStore } from '@/stores/testTask'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useSystemStore } from '@/stores/system'
import { useRunBatchStore } from '@/stores/runBatch'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const route = useRoute()
const router = useRouter()
const execution = useExecutionStore()
const recvStore = useReceptionStore()
const protocolStore = useProtocolStore()
const testDataStore = useTestDataStore()
const taskStore = useTestTaskStore()
const schemeStore = usePlanSchemeStore()
const systemStore = useSystemStore()
const batchStore = useRunBatchStore()
const { nextUniqueName, validateName } = useEntityNameGuard()

protocolStore.migrateAllFromV1()
schemeStore.removeLegacyDefaults()

const monitorSteps = [
  { name: 'send', title: '发送监控' },
  { name: 'receive', title: '接收监控' },
]
const activeMode = ref(route.query.mode === 'receive' ? 'receive' : 'send')
const selectedKey = ref('')
const ifaceSearch = ref('')

const selectMode = (mode) => {
  activeMode.value = mode
  router.replace({
    path: '/execution',
    query: { ...route.query, mode: mode === 'receive' ? 'receive' : undefined },
  })
}

watch(() => route.query.mode, (mode) => {
  activeMode.value = mode === 'receive' ? 'receive' : 'send'
})

const selectedIface = computed(() => {
  const match = selectedKey.value.match(/^iface-(.+)$/)
  if (!match) return null
  return protocolStore.testInterfaces.find((iface) => String(iface.id) === String(match[1])) || null
})
const isSelectedInSendPlan = computed(() => {
  if (!selectedIface.value) return false
  const task = taskStore.tasks.find((item) =>
    String(item.bindings?.interfaceId ?? '') === String(selectedIface.value.id)
  )
  return !!task && execution.plan.some((item) => item.taskId === task.id)
})
const isSelectedInReceivePlan = computed(() =>
  !!selectedIface.value &&
  recvStore.plan.some((item) => String(item.interfaceId) === String(selectedIface.value.id))
)
const totalEstimatedRequests = computed(() =>
  execution.planItems.reduce((sum, item) => sum + item.estimatedRequests, 0)
)

const ifaceBadge = (iface) => {
  const datasetCount = (iface.datasetIds || []).length
  return datasetCount ? `${datasetCount} 数据集` : '未关联数据'
}

const leafGroups = (module) => {
  const keyword = ifaceSearch.value.trim().toLowerCase()
  let interfaces = protocolStore.testInterfaces.filter((iface) => iface.moduleId === module.id)
  if (keyword) {
    interfaces = interfaces.filter((iface) =>
      iface.name.toLowerCase().includes(keyword) ||
      (iface.desc || '').toLowerCase().includes(keyword)
    )
  }
  return [{
    flat: true,
    kind: 'iface',
    addLabel: '+接口',
    addType: 'success',
    items: interfaces.map((iface) => ({
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

const schemeTypeLabel = computed(() => '接口方案')
const extraSystemChildren = (system) => {
  const schemes = schemeStore.schemesOfSystem(system.id)
  return [{
    key: `schemes-${system.id}`,
    kind: 'schemeGroup',
    icon: 'FolderOpened',
    label: '接口方案',
    ref: { id: `schemes-${system.id}`, systemId: system.id },
    addActions: [{
      groupKind: 'scheme',
      label: '+方案',
      type: 'warning',
    }],
    children: schemes.map((scheme) => ({
      key: `scheme-${scheme.id}`,
      kind: 'scheme',
      icon: 'Notebook',
      label: scheme.name,
      badge: `${scheme.interfaceIds.length} 接口`,
      ref: scheme,
    })),
  }]
}

const leafContextActions = (node) => {
  if (node?.kind === 'scheme' && node.ref) {
    return [{ label: '编辑方案', action: 'edit-scheme' }]
  }
  if (node?.kind !== 'iface' || !node.ref) return []
  const actions = [
    { label: '配置接口', action: 'config-iface' },
    { label: activeMode.value === 'send' ? '加入发送监控' : '加入接收监控', action: 'iface-to-monitor' },
  ]
  if (activeMode.value === 'send') actions.push({ label: '立即发送', action: 'iface-test' })
  return actions
}

const onTreeSelect = (data) => {
  if (data.kind === 'iface' && data.ref) {
    selectedKey.value = data.key
    return
  }
  if (data.kind === 'scheme' && data.ref) {
    schemeStore.select(data.ref.id)
    openSchemeDialog(data.ref.systemId, data.ref)
  }
}

const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)
const ifaceConfigContext = ref(null)
const openIfaceConfig = (interfaceId = null, module = null) => {
  ifaceConfigId.value = interfaceId
  ifaceConfigContext.value = module ? { systemId: module.systemId, moduleId: module.id } : null
  ifaceConfigVisible.value = true
}
const openHeaderIfaceDialog = () => openIfaceConfig()

const interfaceReadiness = (iface, role) => {
  const reasons = []
  if (!(iface.datasetIds || []).length) {
    reasons.push('未关联测试数据集')
  } else if (!collectTestInterfaceFields(
    iface,
    testDataStore.datasets,
    protocolStore.interfaces,
    protocolStore.protocols,
    role,
  ).length) {
    reasons.push(`关联的数据集没有可用${role === 'send' ? '发送' : '接收'}字段`)
  }
  return { ok: reasons.length === 0, reasons }
}

const ensureTaskForInterface = (iface) => {
  let task = taskStore.tasks.find((item) =>
    String(item.bindings?.interfaceId ?? '') === String(iface.id)
  )
  if (!task) {
    task = taskStore.addTask({
      name: `${iface.name} 联试`,
      systemId: iface.systemId,
      moduleId: iface.moduleId,
    })
    taskStore.updateBindings(task.id, { interfaceId: iface.id })
  }
  taskStore.updateBindings(task.id, { datasetIds: iface.datasetIds || [] })
  taskStore.updateStrategy(task.id, { ...(iface.strategy || {}) })
  return task
}

const addSendInterface = (interfaceId, { test = false, silent = false } = {}) => {
  const iface = protocolStore.testInterfaces.find((item) => String(item.id) === String(interfaceId))
  if (!iface) return false
  const readiness = interfaceReadiness(iface, 'send')
  if (!readiness.ok) {
    ElMessage.error(`接口「${iface.name}」无法加入发送监控：${readiness.reasons.join('；')}`)
    openIfaceConfig(iface.id)
    return false
  }
  const task = ensureTaskForInterface(iface)
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
    startSend()
    return true
  }
  if (!silent) {
    if (added) ElMessage.success(`接口「${iface.name}」已加入发送监控`)
    else ElMessage.info(`接口「${iface.name}」已在发送监控中`)
  }
  return true
}

const addReceiveInterface = (interfaceId, { silent = false } = {}) => {
  const iface = protocolStore.testInterfaces.find((item) => String(item.id) === String(interfaceId))
  if (!iface) return false
  const readiness = interfaceReadiness(iface, 'receive')
  if (!readiness.ok) {
    ElMessage.error(`接口「${iface.name}」无法加入接收监控：${readiness.reasons.join('；')}`)
    openIfaceConfig(iface.id)
    return false
  }
  const added = recvStore.addToPlan(iface.id)
  selectedKey.value = `iface-${iface.id}`
  if (!silent) {
    if (added) ElMessage.success(`接口「${iface.name}」已加入接收监控`)
    else ElMessage.info(`接口「${iface.name}」已在接收监控中`)
  }
  return true
}

const addSelectedIface = () => {
  if (!selectedIface.value) return
  if (activeMode.value === 'send') addSendInterface(selectedIface.value.id)
  else addReceiveInterface(selectedIface.value.id)
}
const addInterfaceFromDrop = (interfaceId) => {
  if (activeMode.value === 'send') addSendInterface(interfaceId)
  else addReceiveInterface(interfaceId)
}
const testConfiguredInterface = (interfaceId) => {
  if (activeMode.value === 'send') addSendInterface(interfaceId, { test: true })
  else if (addReceiveInterface(interfaceId)) startReceive()
}

const schemeDialogVisible = ref(false)
const schemeForm = ref({ name: '', interfaceIds: [], remark: '' })
const editingSchemeId = ref(null)
const schemeSystemId = ref(null)
const availableInterfaces = computed(() =>
  protocolStore.testInterfaces.filter((iface) =>
    !schemeSystemId.value || iface.systemId === schemeSystemId.value
  )
)

const openSchemeDialog = (systemId, scheme = null) => {
  schemeSystemId.value = systemId || systemStore.currentId || systemStore.visibleSystems[0]?.id || null
  editingSchemeId.value = scheme?.id || null
  schemeForm.value = scheme
    ? { name: scheme.name, interfaceIds: [...scheme.interfaceIds], remark: scheme.remark || '' }
    : { name: '', interfaceIds: [], remark: '' }
  schemeDialogVisible.value = true
}
const openHeaderSchemeDialog = () => {
  openSchemeDialog(selectedIface.value?.systemId || systemStore.currentId || null)
}
const confirmScheme = () => {
  const current = editingSchemeId.value
    ? schemeStore.schemes.find((scheme) => scheme.id === editingSchemeId.value)
    : null
  const fallback = '新建接口方案'
  const candidate = schemeForm.value.name.trim() || current?.name || nextUniqueName(fallback)
  const validName = validateName(candidate, current, '方案')
  if (!validName) return
  const payload = { ...schemeForm.value, name: validName }
  if (current) {
    schemeStore.update(current.id, payload)
    ElMessage.success(`${schemeTypeLabel.value}已更新`)
  } else {
    schemeStore.add({
      ...payload,
      systemId: schemeSystemId.value,
    })
    ElMessage.success(`${schemeTypeLabel.value}已创建`)
  }
  schemeDialogVisible.value = false
}

const addSendScheme = (schemeId) => {
  const scheme = schemeStore.schemes.find((item) => item.id === schemeId)
  if (!scheme) return
  let added = 0
  scheme.interfaceIds.forEach((interfaceId) => {
    const before = execution.plan.length
    if (addSendInterface(interfaceId, { silent: true }) && execution.plan.length > before) added += 1
  })
  execution.setPlanScheme(scheme)
  ElMessage.success(`方案「${scheme.name}」已加入 ${added} 个发送接口`)
}
const addReceiveScheme = (schemeId) => {
  const scheme = schemeStore.schemes.find((item) => item.id === schemeId)
  if (!scheme) return
  let added = 0
  scheme.interfaceIds.forEach((interfaceId) => {
    const before = recvStore.plan.length
    if (addReceiveInterface(interfaceId, { silent: true }) && recvStore.plan.length > before) added += 1
  })
  recvStore.setPlanScheme(scheme)
  ElMessage.success(`方案「${scheme.name}」已加入 ${added} 个接收接口`)
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  if (action === 'edit-scheme') openSchemeDialog(data.ref.systemId, data.ref)
  if (action === 'config-iface') openIfaceConfig(data.ref.id)
  if (action === 'iface-to-monitor') addInterfaceFromDrop(data.ref.id)
  if (action === 'iface-test') addSendInterface(data.ref.id, { test: true })
}
const onAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'scheme') openSchemeDialog(module.systemId || module.id)
  else openIfaceConfig(null, module)
}
const onDeleteLeaf = (node) => {
  if (node.kind === 'scheme' && node.ref) {
    schemeStore.remove(node.ref.id)
    ElMessage.success('方案已删除')
  }
  if (node.kind === 'iface' && node.ref) {
    protocolStore.removeTestInterface(node.ref.id)
    ElMessage.success('接口已删除')
  }
}

const sendPrimaryText = computed(() => {
  if (execution.status === 'running') return '发送中'
  if (execution.status === 'paused') return '发送已暂停'
  if (['done', 'stopped'].includes(execution.status)) return '重新发送'
  return '开始发送'
})
const sendPrimaryIcon = computed(() =>
  ['done', 'stopped'].includes(execution.status) ? RefreshRight : VideoPlay
)
const sendPrimaryDisabled = computed(() =>
  ['running', 'paused'].includes(execution.status) || !execution.planItems.length
)
const receivePrimaryText = computed(() => {
  if (recvStore.status === 'listening') return '监听中'
  if (recvStore.status === 'paused') return '监听已暂停'
  if (['done', 'stopped'].includes(recvStore.status)) return '重新监听'
  return '开始监听'
})
const receivePrimaryIcon = computed(() =>
  ['done', 'stopped'].includes(recvStore.status) ? RefreshRight : VideoPlay
)
const receivePrimaryDisabled = computed(() =>
  ['listening', 'paused'].includes(recvStore.status) || !recvStore.planItems.length
)
const activeFooterText = computed(() => {
  if (activeMode.value === 'send') {
    return execution.planItems.length
      ? `${execution.planItems.length} 个接口，${totalEstimatedRequests.value} 次发送`
      : '从左侧拖入接口后开始发送'
  }
  return recvStore.planItems.length
    ? `${recvStore.planItems.length} 个接口正在等待监听`
    : '从左侧拖入接口后开始监听'
})

const startSend = () => {
  if (execution.status === 'running') return
  if (execution.status === 'paused') {
    execution.resume()
    return
  }
  if (['done', 'stopped'].includes(execution.status)) execution.reset()
  if (!execution.start()) ElMessage.warning('请先加入至少一个发送接口')
}
const startReceive = () => {
  if (recvStore.status === 'listening') return
  if (recvStore.status === 'paused') {
    recvStore.resume()
    return
  }
  if (['done', 'stopped'].includes(recvStore.status)) recvStore.reset()
  if (!recvStore.start()) ElMessage.warning('请先加入至少一个接收接口')
}

const stopSend = async () => {
  try {
    await ElMessageBox.confirm(
      '终止后将完成并归档当前批次，剩余数据不再发送。',
      '终止发送批次',
      { type: 'warning', confirmButtonText: '终止并归档', cancelButtonText: '取消' },
    )
    execution.stop()
    ElMessage.success('发送批次已完成并归档')
  } catch {
    // 用户取消
  }
}

const stopReceive = async () => {
  try {
    await ElMessageBox.confirm(
      '终止后将完成并归档当前接收批次。',
      '终止接收批次',
      { type: 'warning', confirmButtonText: '终止并归档', cancelButtonText: '取消' },
    )
    recvStore.stop()
    ElMessage.success('接收批次已完成并归档')
  } catch {
    // 用户取消
  }
}

const openBatchReport = (batchId) => {
  if (!batchId) return
  router.push({ path: '/report', query: { batchId } })
}

const firstQueryValue = (value) => Array.isArray(value) ? value[0] : value
onMounted(() => {
  const interfaceId = firstQueryValue(route.query.interfaceId)
  if (interfaceId) {
    if (activeMode.value === 'receive') addReceiveInterface(interfaceId)
    else addSendInterface(interfaceId, { test: route.query.test === '1' })
    router.replace({
      path: '/execution',
      query: activeMode.value === 'receive' ? { mode: 'receive' } : {},
    })
    return
  }

  const runId = firstQueryValue(route.query.runId)
  if (runId) {
    const batch = batchStore.byId(String(runId))
    if (batch && execution.loadBatchSnapshot(batch)) {
      activeMode.value = 'send'
      if (batch.systemId) systemStore.setCurrent(batch.systemId)
      ElMessage.success('已打开执行批次摘要')
      return
    }
  }

  const taskId = firstQueryValue(route.query.taskId || route.query.id)
  if (taskId) {
    const task = taskStore.tasks.find((item) => item.id === taskId)
    const interfaceIdFromTask = task?.bindings?.interfaceId
    if (interfaceIdFromTask) addSendInterface(interfaceIdFromTask)
  }
})

onBeforeUnmount(() => {
  if (execution.status === 'running') execution.pause()
  if (recvStore.status === 'listening') recvStore.pause()
})
</script>

<style scoped lang="scss">
.interface-monitoring {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
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
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.monitoring-wizard {
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
.wizard-step--active {
  border-color: var(--el-color-primary);
  background: linear-gradient(180deg, #fff, #f0f6ff);
  box-shadow: inset 0 -2px 0 var(--el-color-primary);
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
.monitor-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  justify-content: flex-end;
  gap: 8px;
}
@media (max-width: 1180px) {
  .interface-monitoring { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .wizard-footer { align-items: flex-start; flex-direction: column; }
  .wizard-actions { width: 100%; }
}
</style>
