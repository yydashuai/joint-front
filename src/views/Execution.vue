<template>
  <div class="page execution-page">
    <div class="page__header">
      <div>
        <h2>测试接口编排</h2>
        <div class="page__desc">编排测试接口、调度收发数据流、实时监控联试过程</div>
      </div>
      <div class="header-actions">
        <el-select v-model="systemSelectValue" class="system-select" placeholder="系统上下文">
          <el-option
            v-for="item in systemOptions"
            :key="item.selectValue"
            :label="item.label"
            :value="item.selectValue"
          />
        </el-select>
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
                  <small>{{ step.desc }}</small>
                </span>
              </button>
            </div>

            <div class="wizard-body">
              <div v-show="activeTab === 'plan'" class="step-panel plan-layout">
                <PlanTable
                  :selected-task="selectedTask"
                  :selected-in-plan="!!isSelectedInPlan"
                  :total-estimated-requests="totalEstimatedRequests"
                  @add-selected="addSelectedTask"
                  @drop-task="addTask"
                  @reset-run="execution.reset()"
                />
              </div>
              <div v-show="activeTab === 'monitor'" class="step-panel">
                <LiveConsole />
              </div>
            </div>

            <div class="wizard-footer">
              <div class="wizard-footer__meta">
                <strong>{{ currentStep.title }}</strong>
                <span>{{ currentStep.helper }}</span>
              </div>
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
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowRight, RefreshRight, Search, SwitchButton, VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import PlanTable from '@/components/execution/PlanTable.vue'
import LiveConsole from '@/components/execution/LiveConsole.vue'
import { useConnectionStore } from '@/stores/connection'
import { useExecutionStore } from '@/stores/execution'
import { useRunBatchStore } from '@/stores/runBatch'
import { useSystemStore } from '@/stores/system'
import { useTestTaskStore, TASK_STATUS } from '@/stores/testTask'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useProtocolStore } from '@/stores/protocol'

const route = useRoute()
const taskStore = useTestTaskStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const execution = useExecutionStore()
const batchStore = useRunBatchStore()
const schemeStore = usePlanSchemeStore()
const protocolStore = useProtocolStore()

const selectedKey = ref('')
const taskSearch = ref('')
const activeTab = ref('plan')
const wizardSteps = [
  { name: 'plan', title: '编排计划', desc: '选择接口并确认顺序', helper: '先把要执行的测试接口加入计划，并检查模块、数据是否就绪。' },
  { name: 'monitor', title: '实时监控', desc: '启动联试并观察收发', helper: '执行过程中关注发送、接收、规则判定与异常捕捉。' },
]

const ALL_SYSTEM_VALUE = '__all__'
const systemOptions = computed(() => systemStore.options.map((item) => ({
  ...item,
  selectValue: item.value == null ? ALL_SYSTEM_VALUE : item.value,
})))
const systemSelectValue = computed({
  get: () => systemStore.currentId ?? ALL_SYSTEM_VALUE,
  set: (value) => systemStore.setCurrent(value === ALL_SYSTEM_VALUE ? null : value),
})

const selectedTask = computed(() => {
  const id = selectedKey.value.startsWith('task-') ? selectedKey.value.slice(5) : ''
  return taskStore.tasks.find((task) => task.id === id) || null
})
const isSelectedInPlan = computed(() => selectedTask.value && execution.plan.some((item) => item.taskId === selectedTask.value.id))
const totalEstimatedRequests = computed(() => execution.planItems.reduce((sum, item) => sum + item.estimatedRequests, 0))
const activeStepIndex = computed(() => Math.max(0, wizardSteps.findIndex((step) => step.name === activeTab.value)))
const currentStep = computed(() => wizardSteps[activeStepIndex.value] || wizardSteps[0])
const maxReachableStepIndex = computed(() => {
  if (['done', 'stopped', 'running', 'paused'].includes(execution.status)) return 1
  if (execution.planItems.length) return 1
  return 0
})
const canOpenStep = (index) => index <= maxReachableStepIndex.value
const prevDisabled = computed(() => activeStepIndex.value === 0 || ['running', 'paused'].includes(execution.status))
const startTip = computed(() => {
  if (!execution.planItems.length) return '请先从左侧接口树加入执行计划'
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

const statusLabel = (val) => TASK_STATUS.find((s) => s.value === val)?.label || '待配置'

/* ---- 接口方案：与模块同级的树节点 ---- */
const extraSystemChildren = (sys) => {
  const schemes = schemeStore.schemesOfSystem(sys.id)
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

const availableInterfaces = computed(() => protocolStore.interfaces.filter((i) => {
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

const confirmScheme = () => {
  if (editingSchemeId.value) {
    schemeStore.update(editingSchemeId.value, { ...schemeForm.value })
    ElMessage.success('接口方案已更新')
  } else {
    schemeStore.add({ ...schemeForm.value, systemId: currentSchemeSystemId.value })
    ElMessage.success('接口方案已创建')
  }
  schemeDialogVisible.value = false
}

const onSchemeAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'scheme') {
    openSchemeDialog(module.systemId || module.id, null)
  }
}

const leafGroups = (module) => {
  let tasks = taskStore.tasksOfModule(module.id)
  if (taskSearch.value) {
    const kw = taskSearch.value.toLowerCase()
    tasks = tasks.filter((task) =>
      task.name.toLowerCase().includes(kw) ||
      (task.remark || '').toLowerCase().includes(kw)
    )
  }
  return [{
    flat: true,
    kind: 'task',
    addLabel: '+全加',
    addType: 'primary',
    items: tasks.map((task) => ({
      key: `task-${task.id}`,
      kind: 'task',
      icon: 'Document',
      label: `${execution.plan.some((item) => item.taskId === task.id) ? '● ' : ''}${task.name}`,
      badge: statusLabel(task.status),
      ref: task,
    })),
  }]
}

const leafContextActions = (nodeData) => {
  if (nodeData?.kind === 'scheme' && nodeData.ref) {
    return [{ label: '编辑方案', action: 'edit-scheme' }]
  }
  if (!nodeData?.ref || nodeData.kind !== 'task') return []
  const inPlan = execution.plan.some((item) => item.taskId === nodeData.ref.id)
  return [
    { label: inPlan ? '已在执行计划' : '加入执行计划', action: 'add-to-plan' },
  ]
}

const onTreeSelect = (data) => {
  if (data.kind === 'scheme' && data.ref) {
    selectedKey.value = data.key
    schemeStore.select(data.ref.id)
    openSchemeDialog(data.ref.systemId || currentSchemeSystemId.value, data.ref)
    return
  }
  if (data.kind !== 'task' || !data.ref) return
  selectedKey.value = data.key
  taskStore.select(data.ref.id)
}

const addTask = (taskId) => {
  const ok = execution.addToPlan(taskId)
  if (ok) ElMessage.success('已加入执行计划')
  else ElMessage.info('任务已在执行计划中')
  activeTab.value = 'plan'
}

const addSelectedTask = () => {
  if (!selectedTask.value) return
  addTask(selectedTask.value.id)
}

const onLeafAction = ({ action, data }) => {
  if (action === 'add-to-plan' && data?.ref) addTask(data.ref.id)
  if (action === 'edit-scheme' && data?.ref) {
    openSchemeDialog(data.ref.systemId || currentSchemeSystemId.value, data.ref)
  }
}

const onAddLeaf = ({ groupKind, module }) => {
  if (groupKind === 'scheme') {
    openSchemeDialog(module.systemId || module.id, null)
    return
  }
  const count = execution.addModuleTasks(module.id)
  if (count) ElMessage.success(`已加入 ${count} 个任务`)
  else ElMessage.info('该模块任务均已在执行计划中')
}

const onDeleteLeaf = (node) => {
  if (node.kind === 'scheme' && node.ref) {
    schemeStore.remove(node.ref.id)
    ElMessage.success('接口方案已删除')
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

const firstQueryValue = (value) => Array.isArray(value) ? value[0] : value

watch(() => execution.status, (status) => {
  if (status === 'running') activeTab.value = 'monitor'
})

onMounted(() => {
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
      ElMessage.success('已从任务页带入执行计划')
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
  flex-wrap: wrap;
  justify-content: flex-end;
}
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
.wizard-step__copy small {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  .execution-page { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .wizard-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wizard-footer { align-items: flex-start; flex-direction: column; }
  .wizard-actions { width: 100%; justify-content: flex-end; }
}
</style>
