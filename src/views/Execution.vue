<template>
  <div class="page execution-page">
    <div class="page__header">
      <div>
        <h2>测试执行编排</h2>
        <div class="page__desc">生成执行计划、调度收发数据流、汇总本次联试结果</div>
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
        <el-tooltip :content="startTip" :disabled="execution.canStart || execution.status === 'running'" placement="bottom">
          <span>
            <el-button
              type="primary"
              :icon="CaretRight"
              :disabled="!canStartButton"
              @click="startRun"
            >
              开始执行
            </el-button>
          </span>
        </el-tooltip>
        <el-button v-if="execution.status !== 'paused'" :icon="VideoPause" :disabled="execution.status !== 'running'" @click="execution.pause()">暂停</el-button>
        <el-button v-else type="success" :icon="VideoPlay" @click="resumeRun">继续</el-button>
        <el-button :icon="SwitchButton" :disabled="!['running', 'paused'].includes(execution.status)" @click="execution.stop()">停止</el-button>
        <el-tag :type="statusType" effect="dark">{{ statusText }}</el-tag>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="taskSearch"
            placeholder="搜索任务..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <SystemModuleTree
          v-model="selectedKey"
          title="执行任务"
          :leaf-groups="leafGroups"
          :leaf-context-actions="leafContextActions"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <div class="main-panel">
        <el-card shadow="never" class="runner-head">
          <div class="runner-head__left">
            <div class="runner-kicker">Runner</div>
            <h3>{{ selectedTask?.name || '选择左侧任务加入执行计划' }}</h3>
            <p>
              当前计划 {{ execution.planItems.length }} 项，
              预计 {{ totalEstimatedRequests }} 次请求；
              {{ execution.canStart ? '关键检查已通过。' : '开始前还有关键项需要处理。' }}
            </p>
          </div>
          <div class="runner-head__right">
            <el-button
              type="primary"
              plain
              :icon="Plus"
              :disabled="!selectedTask || isSelectedInPlan"
              @click="addSelectedTask"
            >
              {{ isSelectedInPlan ? '已加入计划' : '加入计划' }}
            </el-button>
            <el-button :icon="RefreshRight" @click="execution.reset()">重置本次运行</el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="execution-tabs">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="① 编排计划" name="plan">
              <div class="plan-layout">
                <PlanTable />
                <RunStrategy />
                <TimelinePreview />
              </div>
            </el-tab-pane>
            <el-tab-pane label="② 实时监控" name="monitor">
              <LiveConsole />
            </el-tab-pane>
            <el-tab-pane label="③ 结果统计" name="summary">
              <RunSummary @rerun="rerun" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  CaretRight, Plus, RefreshRight, Search, SwitchButton, VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import PlanTable from '@/components/execution/PlanTable.vue'
import RunStrategy from '@/components/execution/RunStrategy.vue'
import TimelinePreview from '@/components/execution/TimelinePreview.vue'
import LiveConsole from '@/components/execution/LiveConsole.vue'
import RunSummary from '@/components/execution/RunSummary.vue'
import { useConnectionStore } from '@/stores/connection'
import { useExecutionStore } from '@/stores/execution'
import { useSystemStore } from '@/stores/system'
import { useTestTaskStore, TASK_STATUS } from '@/stores/testTask'

const route = useRoute()
const taskStore = useTestTaskStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const execution = useExecutionStore()

const selectedKey = ref('')
const taskSearch = ref('')
const activeTab = ref('plan')

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
const canStartButton = computed(() => execution.canStart && !['running'].includes(execution.status))
const startTip = computed(() => {
  if (!execution.planItems.length) return '请先从左侧任务树加入执行计划'
  return execution.blockingReasons.join('；') || '可以开始执行'
})

const statusText = computed(() => ({
  idle: '待执行',
  running: '执行中',
  paused: '已暂停',
  done: '已完成',
  stopped: '已停止',
}[execution.status]))
const statusType = computed(() => ({
  idle: 'info',
  running: 'primary',
  paused: 'warning',
  done: 'success',
  stopped: 'info',
}[execution.status]))

const statusLabel = (val) => TASK_STATUS.find((s) => s.value === val)?.label || '待配置'

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
  if (!nodeData?.ref || nodeData.kind !== 'task') return []
  const inPlan = execution.plan.some((item) => item.taskId === nodeData.ref.id)
  return [
    { label: inPlan ? '已在执行计划' : '加入执行计划', action: 'add-to-plan' },
  ]
}

const onTreeSelect = (data) => {
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
}

const onAddLeaf = ({ module }) => {
  const count = execution.addModuleTasks(module.id)
  if (count) ElMessage.success(`已加入 ${count} 个任务`)
  else ElMessage.info('该模块任务均已在执行计划中')
}

const startRun = () => {
  if (!execution.start()) {
    ElMessage.warning(startTip.value)
    return
  }
  activeTab.value = 'monitor'
}

const resumeRun = () => {
  execution.resume()
  activeTab.value = 'monitor'
}

const rerun = () => {
  execution.reset()
  activeTab.value = 'plan'
}

watch(() => execution.status, (status) => {
  if (status === 'running') activeTab.value = 'monitor'
  if (status === 'done' || status === 'stopped') activeTab.value = 'summary'
})

onMounted(() => {
  const taskId = route.query.taskId || route.query.id
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
.tree-search { flex-shrink: 0; }
:deep(.smt) {
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
.runner-head {
  flex-shrink: 0;
  border-radius: 8px;
  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 18px;
  }
}
.runner-kicker {
  font: 700 11px Consolas, Monaco, monospace;
  text-transform: uppercase;
  color: #2f6feb;
  letter-spacing: .08em;
}
.runner-head h3 {
  margin: 2px 0 4px;
  font-size: 17px;
}
.runner-head p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.runner-head__right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.execution-tabs {
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
.plan-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
@media (max-width: 1180px) {
  .execution-page { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .runner-head :deep(.el-card__body) { align-items: flex-start; flex-direction: column; }
}
</style>
