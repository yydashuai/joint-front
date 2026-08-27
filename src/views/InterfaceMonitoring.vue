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
        <MonitorTree
          v-model="selectedKey"
          title="接口监控树"
          :search="ifaceSearch"
          :iface-badge="ifaceBadge"
          :scheme-badge="schemeBadge"
          :custom-badge="customBadge"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @delete-leaf="onDeleteLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <div class="main-panel">
        <el-card shadow="never" class="workspace-context">
          <div class="workspace-context__row">
            <div class="iface-context">
              <template v-if="detailIface">
                <div class="iface-context__identity">
                  <span class="iface-context__icon"><el-icon><Link /></el-icon></span>
                  <div class="iface-context__copy">
                    <span class="iface-context__eyebrow">当前接口 · {{ (detailIface.messageIds || []).length }} 个报文</span>
                    <strong>{{ detailIface.name }}</strong>
                  </div>
                </div>
                <div class="iface-context__actions">
                  <el-button link type="primary" size="small" @click="openIfaceConfig(detailIface.id)">编辑接口</el-button>
                  <el-button link type="primary" size="small" @click="ifaceDetailExpanded = !ifaceDetailExpanded">
                    {{ ifaceDetailExpanded ? '收起报文' : '查看报文' }}
                  </el-button>
                </div>
              </template>
              <template v-else-if="selectedCustom">
                <div class="iface-context__identity">
                  <span class="iface-context__icon"><el-icon><Link /></el-icon></span>
                  <div class="iface-context__copy">
                    <span class="iface-context__eyebrow">当前接口 · 自定义接口</span>
                    <strong>{{ selectedCustom.name }}</strong>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="iface-context__identity iface-context__identity--empty">
                  <span class="iface-context__icon"><el-icon><Link /></el-icon></span>
                  <div class="iface-context__copy">
                    <span class="iface-context__eyebrow">接口收发监控</span>
                    <strong>从左侧选择接口</strong>
                  </div>
                </div>
              </template>
            </div>

            <el-segmented
              v-model="activeMode"
              class="mode-switch mode-segmented"
              :options="monitorModeOptions"
              block
              aria-label="选择发送或接收监控"
              @change="selectMode"
            />
          </div>

          <div v-if="detailIface" v-show="ifaceDetailExpanded" class="workspace-context__messages">
            <table class="workspace-context__table">
              <thead>
                <tr>
                  <th>报文名称</th><th>传输类型</th><th>字段数</th><th>关联数据</th><th class="ta-r">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in ifaceMessages(detailIface)" :key="m.id">
                  <td class="m-name">{{ m.name }}</td>
                  <td>{{ m.transportType || '—' }}</td>
                  <td>{{ messageFieldCount(m) }}</td>
                  <td>{{ (m.datasetIds || []).length }}</td>
                  <td class="ta-r m-ops">
                    <el-button link type="primary" size="small" @click="goEditMessage(m)">配置</el-button>
                    <el-button link type="success" size="small" @click="addSendInterface(detailIface.id)">发送</el-button>
                    <el-button link type="info" size="small" @click="addReceiveInterface(detailIface.id)">接收</el-button>
                  </td>
                </tr>
                <tr v-if="!ifaceMessages(detailIface).length">
                  <td colspan="5" class="m-empty">该接口未配置报文，点击右上角「编辑接口」添加</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>

        <el-card shadow="never" class="monitoring-wizard">
          <div class="wizard-shell">
            <div class="wizard-body">
              <div v-show="activeMode === 'send'" class="monitor-panel">
                <PlanTable
                  :selected-iface="selectedIface || selectedCustom"
                  :selected-in-plan="isSelectedInSendPlan"
                  :total-estimated-requests="totalEstimatedRequests"
                  @add-selected="addSelectedIface"
                  @drop-scheme="addSendScheme"
                  @drop-iface="addInterfaceFromDrop"
                  @drop-custom="addCustomFromDrop"
                  @reset-run="execution.reset()"
                  @open-transport-config="transportConfigVisible = true"
                />
                <LiveConsole />
              </div>

              <div v-show="activeMode === 'receive'" class="monitor-panel">
                <ReceptionPlanTable
                  :selected-iface="selectedIface || selectedCustom"
                  :selected-in-plan="isSelectedInReceivePlan"
                  @add-selected="addSelectedIface"
                  @drop-iface="addInterfaceFromDrop"
                  @drop-custom="addCustomFromDrop"
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

    <!-- 接口方案 新建/编辑 -->
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
            placeholder="选择要纳入方案的接口（含系统接口与自定义接口）"
            style="width: 100%"
          >
            <el-option-group label="系统接口">
              <el-option
                v-for="iface in sysIfaceOptions"
                :key="iface.id"
                :label="iface.name"
                :value="iface.id"
              />
            </el-option-group>
            <el-option-group label="自定义接口">
              <el-option
                v-for="iface in customIfaceOptions"
                :key="iface.id"
                :label="`${iface.name}（自定义）`"
                :value="iface.id"
              />
            </el-option-group>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="schemeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmScheme">确定</el-button>
      </template>
    </el-dialog>

    <!-- 自定义接口 新建/编辑 -->
    <CustomIfaceDialog v-model="customDialogVisible" :interface-id="customDialogId" @saved="onCustomSaved" />

    <!-- 自定义监听配置 -->
    <ListenConfigDialog v-model="listenDialogVisible" :iface-id="listenDialogId" />

    <!-- 传输配置两步弹窗（①传输配置 → ②报文头配置） -->
    <TransportConfigDialog
      v-model="transportConfigVisible"
      :interfaces="sendPlanInterfaces"
    />

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
import { Download, Link, Plus, Promotion, RefreshRight, Search, SwitchButton, Tickets, VideoPause, VideoPlay } from '@element-plus/icons-vue'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import CustomIfaceDialog from '@/components/execution/CustomIfaceDialog.vue'
import ListenConfigDialog from '@/components/execution/ListenConfigDialog.vue'
import PlanTable from '@/components/execution/PlanTable.vue'
import LiveConsole from '@/components/execution/LiveConsole.vue'
import ReceptionPlanTable from '@/components/reception/ReceptionPlanTable.vue'
import ReceiveMonitor from '@/components/reception/ReceiveMonitor.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import TransportConfigDialog from '@/components/execution/TransportConfigDialog.vue'
import { useExecutionStore } from '@/stores/execution'
import { useReceptionStore } from '@/stores/reception'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useCustomIfaceStore } from '@/stores/customIface'
import { useTestDataStore } from '@/stores/testData'
import { useTestTaskStore } from '@/stores/testTask'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useRunBatchStore } from '@/stores/runBatch'
import { useSystemStore } from '@/stores/system'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const route = useRoute()
const router = useRouter()
const execution = useExecutionStore()
const recvStore = useReceptionStore()
const protocolStore = useProtocolStore()
const customStore = useCustomIfaceStore()
const testDataStore = useTestDataStore()
const taskStore = useTestTaskStore()
const schemeStore = usePlanSchemeStore()
const batchStore = useRunBatchStore()
const systemStore = useSystemStore()
const { nextUniqueName, validateName } = useEntityNameGuard()

protocolStore.migrateAllFromV1()
schemeStore.removeLegacyDefaults()

const monitorModeOptions = [
  { label: '发送监控', value: 'send', icon: Promotion },
  { label: '接收监控', value: 'receive', icon: Download },
]
const activeMode = ref(route.query.mode === 'receive' ? 'receive' : 'send')
const selectedKey = ref('')
const ifaceSearch = ref('')
const ifaceDetailExpanded = ref(false)

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

/* ---- 选中：系统接口 / 报文 / 自定义接口（方案内接口 sin- 同样视为接口） ---- */
const selectedIface = computed(() => {
  const match = selectedKey.value.match(/^(?:iface|sin)-(.+)$/)
  if (!match) return null
  return protocolStore.testInterfaces.find((iface) => String(iface.id) === String(match[1])) || null
})
const selectedMessage = computed(() => {
  const match = selectedKey.value.match(/^msg-(.+)$/)
  if (!match) return null
  return protocolStore.interfaces.find((m) => String(m.id) === String(match[1])) || null
})
const selectedCustom = computed(() => {
  const match = selectedKey.value.match(/^custom-(.+)$/)
  if (!match) return null
  return customStore.byId(match[1])
})
/** 报文所属接口（排他归属） */
const ownerIfaceOf = (message) => {
  if (!message?.ownerIfaceId) return null
  return protocolStore.testInterfaces.find((i) => String(i.id) === String(message.ownerIfaceId)) || null
}
/** 右侧详情卡片的接口：选中接口本体，或选中其名下报文时取所属接口 */
const detailIface = computed(() => selectedIface.value || ownerIfaceOf(selectedMessage.value))
watch(() => detailIface.value?.id, () => {
  ifaceDetailExpanded.value = false
})
watch(
  () => [execution.status, recvStore.status],
  ([sendStatus, receiveStatus]) => {
    if (['running', 'paused'].includes(sendStatus) || ['listening', 'paused'].includes(receiveStatus)) {
      ifaceDetailExpanded.value = false
    }
  }
)
/** 接口名下报文（1:N） */
const ifaceMessages = (iface) => (iface?.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)
const messageFieldCount = (message) => (message?.protocolRefs || []).length

const transportConfigVisible = ref(false)
const sendPlanInterfaces = computed(() => execution.planItems.map((item) => item.iface).filter(Boolean))
const isSelectedInSendPlan = computed(() => {
  if (selectedCustom.value) return execution.plan.some((item) => String(item.customId) === String(selectedCustom.value.id))
  if (!selectedIface.value) return false
  const task = taskStore.tasks.find((item) =>
    String(item.bindings?.interfaceId ?? '') === String(selectedIface.value.id)
  )
  return !!task && execution.plan.some((item) => item.taskId === task.id)
})
const isSelectedInReceivePlan = computed(() => {
  if (selectedCustom.value) return recvStore.plan.some((item) => String(item.customId) === String(selectedCustom.value.id))
  return !!selectedIface.value &&
    recvStore.plan.some((item) => String(item.interfaceId) === String(selectedIface.value.id))
})
const totalEstimatedRequests = computed(() =>
  execution.planItems.reduce((sum, item) => sum + item.estimatedRequests, 0)
)

/* ---- 树徽标 ---- */
const ifaceBadge = (iface) => {
  const count = (iface.messageIds || []).length
  return count ? `${count} 报文` : '未配置报文'
}
const schemeBadge = (scheme) => `${(scheme.interfaceIds || []).length} 接口`
const customBadge = (custom) =>
  `${custom.transportType || '—'}·${custom.bodyHex || custom.transportConfig?.targetAddress ? '已配置' : '待配置'}`

/* ---- 树事件 ---- */
const onTreeSelect = (data) => {
  if (['iface', 'custom', 'message', 'schemeItem'].includes(data.kind) && data.ref) {
    selectedKey.value = data.key
    return
  }
  if (data.kind === 'scheme' && data.ref) {
    schemeStore.select(data.ref.id)
    openSchemeDialog(data.ref)
  }
}

const onAddLeaf = ({ groupKind }) => {
  if (groupKind === 'scheme') openSchemeDialog()
  else if (groupKind === 'custom') openCustomDialog()
  else openIfaceConfig()
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
  if (node.kind === 'custom' && node.ref) {
    customStore.remove(node.ref.id)
    ElMessage.success('自定义接口已删除')
  }
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  if (action === 'edit-scheme') openSchemeDialog(data.ref)
  if (action === 'delete-scheme') {
    schemeStore.remove(data.ref.id)
    ElMessage.success('方案已删除')
  }
  if (action === 'config-iface') openIfaceConfig(data.ref.id)
  if (action === 'add-message') openIfaceConfig(data.ref.id)
  if (action === 'iface-to-send') addSendInterface(data.ref.id)
  if (action === 'iface-to-receive') addReceiveInterface(data.ref.id)
  if (action === 'iface-test') addSendInterface(data.ref.id, { test: true })
  if (action === 'delete-iface') {
    const count = (data.ref.messageIds || []).length
    const tip = count ? `接口名下 ${count} 个报文将一并删除，此操作不可撤销。` : ''
    ElMessageBox.confirm(`${tip}确定删除接口「${data.ref.name}」吗？`, '删除接口', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    }).then(() => {
      protocolStore.removeTestInterface(data.ref.id)
      selectedKey.value = ''
      ElMessage.success('接口已删除')
    }).catch(() => {})
  }
  if (action === 'config-message') goEditMessage(data.ref)
  if (action === 'message-to-send') {
    const owner = ownerIfaceOf(data.ref)
    if (owner) addSendInterface(owner.id)
  }
  if (action === 'message-to-receive') {
    const owner = ownerIfaceOf(data.ref)
    if (owner) addReceiveInterface(owner.id)
  }
  if (action === 'message-test') {
    const owner = ownerIfaceOf(data.ref)
    if (owner) addSendInterface(owner.id, { test: true })
  }
  if (action === 'delete-message') {
    const owner = ownerIfaceOf(data.ref)
    ElMessageBox.confirm(`确定从接口「${owner?.name || '—'}」删除报文「${data.ref.name}」吗？`, '删除报文', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    }).then(() => {
      if (owner) protocolStore.removeMessageFromInterface(owner.id, data.ref.id)
      selectedKey.value = ''
      ElMessage.success('报文已删除')
    }).catch(() => {})
  }
  if (action === 'config-custom') openCustomDialog(data.ref.id)
  if (action === 'listen-custom') openListenDialog(data.ref.id)
  if (action === 'custom-to-send') addCustomToSend(data.ref.id)
  if (action === 'custom-to-receive') addCustomToReceive(data.ref.id)
  if (action === 'custom-test') addCustomToSend(data.ref.id, { test: true })
  if (action === 'delete-custom') {
    customStore.remove(data.ref.id)
    ElMessage.success('自定义接口已删除')
  }
}

/** 跳转报文字段管理页编辑指定报文 */
const goEditMessage = (message) => {
  if (!message) return
  protocolStore.selectedInterfaceId = message.id
  if (message.systemId) systemStore.setCurrent(message.systemId)
  router.push({ path: '/protocol', query: { kind: 'interface', iface: String(message.id) } })
}

/* ---- 系统接口配置 ---- */
const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)
const ifaceConfigContext = ref(null)
const openIfaceConfig = (interfaceId = null) => {
  ifaceConfigId.value = interfaceId
  ifaceConfigContext.value = null
  ifaceConfigVisible.value = true
}
const openHeaderIfaceDialog = () => openIfaceConfig()

/* ---- 自定义接口 新建/编辑/监听配置 ---- */
const customDialogVisible = ref(false)
const customDialogId = ref(null)
const openCustomDialog = (id = null) => {
  customDialogId.value = id
  customDialogVisible.value = true
}
const onCustomSaved = () => {
  // 新建后自动选中
}
const listenDialogVisible = ref(false)
const listenDialogId = ref(null)
const openListenDialog = (id) => {
  listenDialogId.value = id
  listenDialogVisible.value = true
}

const interfaceReadiness = (iface, role) => {
  const reasons = []
  if (!(iface.messageIds || []).length) {
    reasons.push('未配置报文')
  } else if (!ifaceMessages(iface).some((m) => m.fileId) && !collectTestInterfaceFields(
    iface,
    testDataStore.datasets,
    protocolStore.interfaces,
    protocolStore.protocols,
    role,
  ).length) {
    reasons.push('接口名下报文没有可用字段')
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

/* ---- 加入发送监控：系统接口（需 readiness） / 自定义接口（透传） ---- */
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

const addCustomToSend = (customId, { test = false, silent = false } = {}) => {
  const custom = customStore.byId(customId)
  if (!custom) return false
  if (!custom.bodyHex) {
    ElMessage.warning(`自定义接口「${custom.name}」未配置报文体，请先配置`)
    openCustomDialog(custom.id)
    return false
  }
  const added = execution.addCustomToPlan(custom.id)
  selectedKey.value = `custom-${custom.id}`
  if (test) {
    startSend()
    return true
  }
  if (!silent) {
    if (added) ElMessage.success(`自定义接口「${custom.name}」已加入发送监控`)
    else ElMessage.info(`自定义接口「${custom.name}」已在发送监控中`)
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

const addCustomToReceive = (customId, { silent = false } = {}) => {
  const custom = customStore.byId(customId)
  if (!custom) return false
  const lc = custom.listenConfig || {}
  if (!lc.ip) {
    ElMessage.warning(`自定义接口「${custom.name}」未配置监听 IP，请先配置`)
    openListenDialog(custom.id)
    return false
  }
  const added = recvStore.addCustomToPlan(custom.id)
  selectedKey.value = `custom-${custom.id}`
  if (!silent) {
    if (added) ElMessage.success(`自定义接口「${custom.name}」已加入接收监控`)
    else ElMessage.info(`自定义接口「${custom.name}」已在接收监控中`)
  }
  return true
}

const addSelectedIface = () => {
  if (selectedCustom.value) {
    if (activeMode.value === 'send') addCustomToSend(selectedCustom.value.id)
    else addCustomToReceive(selectedCustom.value.id)
    return
  }
  if (!selectedIface.value) return
  if (activeMode.value === 'send') addSendInterface(selectedIface.value.id)
  else addReceiveInterface(selectedIface.value.id)
}
const addInterfaceFromDrop = (interfaceId) => {
  if (activeMode.value === 'send') addSendInterface(interfaceId)
  else addReceiveInterface(interfaceId)
}
const addCustomFromDrop = (customId) => {
  if (activeMode.value === 'send') addCustomToSend(customId)
  else addCustomToReceive(customId)
}
const testConfiguredInterface = (interfaceId) => {
  if (activeMode.value === 'send') addSendInterface(interfaceId, { test: true })
  else if (addReceiveInterface(interfaceId)) startReceive()
}

/* ---- 方案：新建/编辑/加入（方案可组合系统接口与自定义接口） ---- */
const schemeDialogVisible = ref(false)
const schemeForm = ref({ name: '', interfaceIds: [], remark: '' })
const editingSchemeId = ref(null)
const sysIfaceOptions = computed(() => protocolStore.testInterfaces)
const customIfaceOptions = computed(() => customStore.customIfaces)

const openSchemeDialog = (scheme = null) => {
  editingSchemeId.value = scheme?.id || null
  schemeForm.value = scheme
    ? { name: scheme.name, interfaceIds: [...scheme.interfaceIds], remark: scheme.remark || '' }
    : { name: '', interfaceIds: [], remark: '' }
  schemeDialogVisible.value = true
}
const openHeaderSchemeDialog = () => openSchemeDialog()
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
    ElMessage.success('接口方案已更新')
  } else {
    schemeStore.add({ ...payload })
    ElMessage.success('接口方案已创建')
  }
  schemeDialogVisible.value = false
}

const schemeToInterfaces = (scheme) => (scheme.interfaceIds || []).map((id) => {
  const sys = protocolStore.testInterfaces.find((i) => String(i.id) === String(id))
  if (sys) return { type: 'sys', id: sys.id }
  const custom = customStore.byId(id)
  if (custom) return { type: 'custom', id: custom.id }
  return null
}).filter(Boolean)

const addSendScheme = (schemeId) => {
  const scheme = schemeStore.schemes.find((item) => item.id === schemeId)
  if (!scheme) return
  let added = 0
  schemeToInterfaces(scheme).forEach((entry) => {
    const before = execution.plan.length
    if (entry.type === 'sys') {
      if (addSendInterface(entry.id, { silent: true }) && execution.plan.length > before) added += 1
    } else if (addCustomToSend(entry.id, { silent: true }) && execution.plan.length > before) added += 1
  })
  execution.setPlanScheme(scheme)
  ElMessage.success(`方案「${scheme.name}」已加入 ${added} 个发送接口`)
}
const addReceiveScheme = (schemeId) => {
  const scheme = schemeStore.schemes.find((item) => item.id === schemeId)
  if (!scheme) return
  let added = 0
  schemeToInterfaces(scheme).forEach((entry) => {
    const before = recvStore.plan.length
    if (entry.type === 'sys') {
      if (addReceiveInterface(entry.id, { silent: true }) && recvStore.plan.length > before) added += 1
    } else if (addCustomToReceive(entry.id, { silent: true }) && recvStore.plan.length > before) added += 1
  })
  recvStore.setPlanScheme(scheme)
  ElMessage.success(`方案「${scheme.name}」已加入 ${added} 个接收接口`)
}

/* ---- 主按钮状态 ---- */
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
    if (execution.directSendDraft) {
      return `历史选择 ${execution.directSendDraft.total} 条，${execution.directSendDraft.groups.length} 个接口`
    }
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
  const draftId = firstQueryValue(route.query.draftId)
  if (draftId) {
    activeMode.value = 'send'
    if (execution.restoreDirectSendDraft(String(draftId))) {
      const firstInterfaceId = execution.directSendDraft?.groups?.[0]?.interfaceId
      if (firstInterfaceId != null) selectedKey.value = `iface-${firstInterfaceId}`
      ElMessage.success(`已装入 ${execution.directSendDraft.total} 条历史数据，请确认后开始发送`)
    } else {
      ElMessage.warning('临时发送清单已失效，请返回历史数据库重新选择')
    }
    router.replace({ path: '/execution' })
    return
  }

  const interfaceId = firstQueryValue(route.query.interfaceId)
  if (interfaceId) {
    if (activeMode.value === 'receive') {
      const added = addReceiveInterface(interfaceId)
      if (added && route.query.test === '1') startReceive()
    }
    else addSendInterface(interfaceId, { test: route.query.test === '1' })
    router.replace({
      path: '/execution',
      query: activeMode.value === 'receive' ? { mode: 'receive' } : {},
    })
    return
  }

  const schemeId = firstQueryValue(route.query.schemeId)
  if (schemeId) {
    const scheme = schemeStore.schemes.find((item) => String(item.id) === String(schemeId))
    if (scheme) {
      if (activeMode.value === 'receive') addReceiveScheme(scheme.id)
      else addSendScheme(scheme.id)
    }
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
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding-right: 4px;
}
.workspace-context {
  flex-shrink: 0;
  border-radius: 10px;
  :deep(.el-card__body) { padding: 12px 16px; }
  &__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(420px, 1fr);
    align-items: center;
    gap: 20px;
  }
  &__messages {
    margin-top: 12px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 7px;
    overflow: hidden;
  }
  &__table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 12px;
    th, td { padding: 7px 10px; text-align: left; }
    thead th { color: var(--el-text-color-secondary); background: var(--el-fill-color-light); font-weight: 500; }
    tbody tr { border-top: 1px solid var(--el-border-color-lighter); }
    tbody tr:hover { background: var(--el-fill-color-extra-light); }
    .m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .m-empty { color: var(--el-text-color-placeholder); text-align: center; padding: 12px 0; }
    .m-ops { white-space: nowrap; }
  }
}
.iface-context {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding-right: 4px;
  &__identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  &__identity--empty { color: var(--el-text-color-secondary); }
  &__icon {
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    display: inline-grid;
    place-items: center;
    border-radius: 9px;
    color: #2f6feb;
    background: #eef4ff;
    font-size: 17px;
  }
  &__copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  &__eyebrow { color: var(--el-text-color-secondary); font-size: 11px; line-height: 1; }
  &__copy strong {
    max-width: 280px;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 1px;
    flex-shrink: 0;
    margin-left: 24px;
    padding-left: 8px;
    border-left: 1px solid var(--el-border-color-lighter);
    .el-button + .el-button { margin-left: 0; }
  }
}
.mode-switch {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dce4f1;
  border-radius: 10px;
  background: #f3f6fa;
}
.mode-segmented {
  width: 100%;
  padding: 0;
  border-radius: 10px;
  background: transparent;
  --el-segmented-item-selected-bg-color: #2f6feb;
  --el-segmented-item-selected-color: #fff;
  :deep(.el-segmented__group) { gap: 0; }
  :deep(.el-segmented__item) { min-height: 40px; border-radius: 0; font-size: 13px; font-weight: 600; }
  :deep(.el-segmented__item-selected) { box-shadow: 0 4px 12px rgba(47, 111, 235, .2); }
}
.ta-r { text-align: right !important; }
.monitoring-wizard {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}
.wizard-shell {
  display: flex;
  flex-direction: column;
}
.wizard-body {
  overflow: visible;
  padding: 14px 18px;
}
.monitor-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: visible;
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
  .workspace-context__row { grid-template-columns: 1fr; }
  .wizard-footer { align-items: flex-start; flex-direction: column; }
  .wizard-actions { width: 100%; }
}
</style>
