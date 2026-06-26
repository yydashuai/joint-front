<template>
  <div class="page test-task">
    <!-- ======== 页面头部 ======== -->
    <div class="page__header">
      <div>
        <h2>测试任务管理</h2>
        <div class="page__desc">组建联试任务：绑定协议 / 接口 / 数据集，配置执行策略</div>
      </div>
      <div class="header-actions">
        <el-button :icon="Share" @click="goExecution" :disabled="!currentTask">执行调度</el-button>
      </div>
    </div>

    <div class="split">
      <!-- ======== 左侧树 ======== -->
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
          title="测试任务"
          :leaf-groups="leafGroups"
          :leaf-context-actions="leafContextActions"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @delete-leaf="onDeleteLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <!-- ======== 右侧内容区 ======== -->
      <div class="main-panel">
        <template v-if="currentTask">
          <!-- 任务详情头 -->
          <el-card shadow="never" class="task-head">
            <div class="task-head__row">
              <div class="task-head__left">
                <el-input
                  v-model="editName"
                  class="task-head__name"
                  size="large"
                  borderless
                  @blur="onNameBlur"
                  @keyup.enter="$event.target.blur()"
                />
                <el-tag :type="statusTag(currentTask.status)" size="small" effect="dark">
                  {{ statusLabel(currentTask.status) }}
                </el-tag>
                <el-tag :type="priorityTag(currentTask.priority)" size="small" effect="plain">
                  {{ priorityLabel(currentTask.priority) }}
                </el-tag>
              </div>
              <div class="task-head__right">
                <el-button
                  type="primary"
                  :icon="CaretRight"
                  :disabled="!canSubmit"
                  @click="onSubmitExecution"
                >
                  提交执行
                </el-button>
                <el-button :icon="CopyDocument" @click="onDuplicate">复制</el-button>
                <el-button :icon="Delete" type="danger" plain @click="onDelete">删除</el-button>
              </div>
            </div>
            <div class="task-head__meta">
              <span class="meta-item">
                <el-icon><Connection /></el-icon>
                {{ moduleName }}
              </span>
              <span class="meta-item">
                <el-icon><Clock /></el-icon>
                创建于 {{ currentTask.createdAt }}<template v-if="currentTask.updatedAt"> · 更新于 {{ currentTask.updatedAt }}</template>
              </span>
            </div>
          </el-card>

          <!-- Tab 详情区 -->
          <el-card shadow="never" class="task-tabs">
            <el-tabs v-model="activeTab">
              <!-- 基本信息 -->
              <el-tab-pane label="基本信息" name="info">
                <el-form label-width="90px" class="info-form">
                  <el-form-item label="任务名称">
                    <el-input v-model="editName" @blur="onNameBlur" />
                  </el-form-item>
                  <el-form-item label="所属系统">
                    <el-input :model-value="systemName" disabled />
                  </el-form-item>
                  <el-form-item label="所属模块">
                    <el-input :model-value="moduleName" disabled />
                  </el-form-item>
                  <el-form-item label="优先级">
                    <el-radio-group v-model="localPriority" @change="onPriorityChange">
                      <el-radio-button value="high">高</el-radio-button>
                      <el-radio-button value="medium">中</el-radio-button>
                      <el-radio-button value="low">低</el-radio-button>
                    </el-radio-group>
                  </el-form-item>
                  <el-form-item label="描述 / 备注">
                    <el-input
                      v-model="editRemark"
                      type="textarea"
                      :rows="3"
                      maxlength="500"
                      show-word-limit
                      placeholder="输入任务描述..."
                      @blur="onRemarkBlur"
                    />
                  </el-form-item>
                </el-form>
              </el-tab-pane>

              <!-- 资源绑定 -->
              <el-tab-pane label="资源绑定" name="bindings">
                <TaskBindings
                  :task="currentTask"
                  @change="onBindingsChange"
                />
              </el-tab-pane>

              <!-- 执行记录 -->
              <el-tab-pane label="执行记录" name="runs">
                <el-table
                  :data="currentTask.runs"
                  size="small"
                  empty-text="暂无执行记录"
                  :border="false"
                >
                  <el-table-column label="序号" type="index" width="60" align="center" />
                  <el-table-column label="开始时间" prop="startedAt" min-width="160" />
                  <el-table-column label="结束时间" prop="finishedAt" min-width="160">
                    <template #default="{ row }">
                      <span v-if="row.finishedAt">{{ row.finishedAt }}</span>
                      <span v-else class="text-ph">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="结果" prop="result" width="100" align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.result" :type="row.result === '通过' ? 'success' : 'danger'" size="small">{{ row.result }}</el-tag>
                      <span v-else class="text-ph">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="耗时" prop="duration" width="100" align="center">
                    <template #default="{ row }">
                      <span v-if="row.duration" class="mono">{{ row.duration }}</span>
                      <span v-else class="text-ph">—</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="80" align="center">
                    <template #default>
                      <el-button link type="primary" size="small" disabled>日志</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </template>

        <!-- 空状态 -->
        <el-card v-else shadow="never" class="empty-state">
          <el-empty description="从左侧选择一个测试任务，或在模块下新建任务" :image-size="100" />
        </el-card>
      </div>
    </div>

    <!-- ======== 新建任务对话框 ======== -->
    <CreateTaskDialog
      v-model="showCreateDialog"
      :module="createModule"
      @created="onCreateTask"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Share, CaretRight, CopyDocument, Delete,
  Connection, Clock
} from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import TaskBindings from '@/components/testtask/TaskBindings.vue'
import CreateTaskDialog from '@/components/testtask/CreateTaskDialog.vue'
import { useTestTaskStore, TASK_STATUS, PRIORITY_OPTIONS } from '@/stores/testTask'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'

const route = useRoute()
const router = useRouter()
const taskStore = useTestTaskStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()

/* ========== 树选择 + 搜索 ========== */
const selectedKey = ref('')
const taskSearch = ref('')
const activeTab = ref('info')

const leafGroups = (module) => {
  let tasks = taskStore.tasksOfModule(module.id)

  if (taskSearch.value) {
    const kw = taskSearch.value.toLowerCase()
    tasks = tasks.filter(t =>
      t.name.toLowerCase().includes(kw) ||
      (t.remark && t.remark.toLowerCase().includes(kw))
    )
  }

  return [{
    flat: true,
    kind: 'task',
    addLabel: '+任务',
    addType: 'primary',
    items: tasks.map(t => ({
      key: `task-${t.id}`,
      kind: 'task',
      icon: 'Document',
      label: t.name,
      badge: statusLabel(t.status),
      ref: t,
    }))
  }]
}

const onTreeSelect = (data) => {
  if (data.kind === 'task' && data.ref) {
    taskStore.select(data.ref.id)
    activeTab.value = 'info'
  }
}

const onDeleteLeaf = (data) => {
  if (data.kind === 'task' && data.ref) {
    taskStore.removeTask(data.ref.id)
    selectedKey.value = ''
    ElMessage.success('任务已删除')
  }
}

/* ========== 任务剪贴板 ========== */
const taskClipboard = ref(null)

const leafContextActions = (nodeData) => {
  if (!nodeData?.ref || nodeData.kind !== 'task') return []
  return [
    { label: '复制任务', action: 'copy-task' },
  ]
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  const t = data.ref

  if (action === 'copy-task') {
    taskClipboard.value = { data: JSON.parse(JSON.stringify(t)) }
    ElMessage.success(`已复制「${t.name}」`)
  }
}

/* ========== 新建任务 ========== */
const showCreateDialog = ref(false)
const createModule = ref(null)

const onAddLeaf = ({ module }) => {
  createModule.value = { systemId: module.systemId, name: module.name }
  showCreateDialog.value = true
}

const onCreateTask = (data) => {
  const task = taskStore.addTask(data)
  selectedKey.value = `task-${task.id}`
  ElMessage.success('任务已创建')
}

/* ========== 当前任务 ========== */
const currentTask = computed(() => taskStore.selectedTask)

const systemName = computed(() => {
  if (!currentTask.value) return ''
  return systemStore.systems.find(s => s.id === currentTask.value.systemId)?.name || ''
})

const moduleName = computed(() => {
  if (!currentTask.value) return ''
  return connStore.nodes.find(n => n.id === currentTask.value.moduleId)?.name || ''
})

/* ========== 编辑字段（本地状态，blur 时提交） ========== */
const editName = ref('')
const editRemark = ref('')
const localPriority = ref('medium')

watch(currentTask, (t) => {
  if (t) {
    editName.value = t.name
    editRemark.value = t.remark || ''
    localPriority.value = t.priority || 'medium'
  }
}, { immediate: true })

const onNameBlur = () => {
  if (!currentTask.value) return
  const name = editName.value.trim()
  if (name && name !== currentTask.value.name) {
    taskStore.updateTask(currentTask.value.id, { name })
    ElMessage.success('任务名称已更新')
  } else {
    editName.value = currentTask.value.name
  }
}

const onRemarkBlur = () => {
  if (!currentTask.value) return
  if (editRemark.value !== currentTask.value.remark) {
    taskStore.updateTask(currentTask.value.id, { remark: editRemark.value })
  }
}

const onPriorityChange = (val) => {
  if (!currentTask.value) return
  taskStore.updateTask(currentTask.value.id, { priority: val })
}

/* ========== 资源绑定变更 ========== */
const onBindingsChange = (bindings) => {
  if (!currentTask.value) return
  taskStore.updateBindings(currentTask.value.id, bindings)
}

/* ========== 提交执行 ========== */
const canSubmit = computed(() => {
  if (!currentTask.value) return false
  return taskStore.isReady(currentTask.value.id)
})

const onSubmitExecution = () => {
  if (!currentTask.value) return
  if (!canSubmit.value) {
    ElMessage.warning('请先在「资源绑定」中选择一个接口')
    activeTab.value = 'bindings'
    return
  }
  taskStore.submitForExecution(currentTask.value.id)
  ElMessage.success('任务已提交执行')
  router.push({ path: '/execution', query: { taskId: currentTask.value.id } })
}

/* ========== 复制 / 删除 ========== */
const onDuplicate = () => {
  if (!currentTask.value) return
  const dup = taskStore.duplicateTask(currentTask.value.id)
  selectedKey.value = `task-${dup.id}`
  ElMessage.success(`已复制为「${dup.name}」`)
}

const onDelete = () => {
  if (!currentTask.value) return
  ElMessageBox.confirm(`确定删除任务「${currentTask.value.name}」？`, '删除确认', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    taskStore.removeTask(currentTask.value.id)
    selectedKey.value = ''
    ElMessage.success('任务已删除')
  }).catch(() => {})
}

/* ========== 跳转执行调度 ========== */
const goExecution = () => {
  router.push({
    path: '/execution',
    query: currentTask.value ? { taskId: currentTask.value.id } : {}
  })
}

/* ========== 状态 / 优先级映射 ========== */
const statusLabel = (val) => TASK_STATUS.find(s => s.value === val)?.label || '待配置'
const statusTag = (val) => TASK_STATUS.find(s => s.value === val)?.tag || 'info'
const priorityLabel = (val) => PRIORITY_OPTIONS.find(p => p.value === val)?.label || '中'
const priorityTag = (val) => PRIORITY_OPTIONS.find(p => p.value === val)?.tag || 'info'

/* ========== Dashboard 联动：从 query 选中任务 ========== */
onMounted(() => {
  const taskId = route.query.id
  if (taskId) {
    const task = taskStore.tasks.find(t => t.id === taskId)
    if (task) {
      taskStore.select(taskId)
      selectedKey.value = `task-${taskId}`
    }
  }
})

// 选中任务变化时同步 selectedKey
watch(currentTask, (t) => {
  if (t && !selectedKey.value.startsWith(`task-${t.id}`)) {
    selectedKey.value = `task-${t.id}`
  }
})
</script>

<style scoped lang="scss">
.test-task {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

/* 左侧树面板 */
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

/* 右侧主区 */
.main-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}

/* 任务详情头 */
.task-head {
  flex-shrink: 0;
  :deep(.el-card__body) { padding: 14px 18px; }
}
.task-head__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.task-head__left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.task-head__name {
  :deep(.el-input__wrapper) {
    box-shadow: none !important;
    padding-left: 0;
  }
  :deep(input) {
    font-size: 16px;
    font-weight: 600;
  }
}
.task-head__right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.task-head__meta {
  display: flex;
  gap: 18px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Tab 区 */
.task-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding: 4px 18px 14px;
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
  padding-top: 8px;
}

/* 基本信息 */
.info-form {
  max-width: 560px;
  padding-top: 8px;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  :deep(.el-card__body) {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
  }
}

/* 通用 */
.text-ph { color: var(--el-text-color-placeholder); }
.mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
</style>
