<template>
  <div class="page dashboard">
    <!-- ======== 页面头部 ======== -->
    <div class="page__header">
      <div>
        <h2>{{ isAll ? '联试系统首页 / 工作台' : `${current.name} / 工作台` }}</h2>
        <div class="page__desc">
          {{ isAll ? '便携式智能联试工具 · 联试全流程概览' : (current.desc || `负责人：${current.owner}`) }}
        </div>
      </div>
      <div class="header-middle">
        <el-button
          v-if="!isAll"
          :icon="Back"
          plain
          @click="systemStore.setCurrent(null)"
        >
          返回全部系统
        </el-button>
      </div>
      <div class="header-actions">
        <el-tooltip content="创建一个新的测试任务"><el-button type="primary" :icon="Plus" @click="$router.push('/task')">创建测试任务</el-button></el-tooltip>
        <el-tooltip content="导入或管理协议模板"><el-button :icon="Upload" @click="$router.push('/protocol')">导入协议模板</el-button></el-tooltip>
        <el-tooltip content="查看异常告警详情">
          <el-button
            :icon="WarningFilled"
            @click="$router.push('/exception')"
            :type="totalPending > 0 ? 'danger' : ''"
            plain
          >
          异常详情
          <el-badge v-if="totalPending > 0" :value="totalPending" :max="99" class="btn-badge" />
        </el-button></el-tooltip>
        <el-tooltip content="进入报告生成流程"><el-button :icon="Tickets" @click="$router.push('/report')">生成报告</el-button></el-tooltip>
      </div>
    </div>

    <!-- ======== 全部系统：系统健康概览（水平滚动） ======== -->
    <div v-if="isAll" class="health-section">
      <div class="section-head">
        <h3 class="section-title">系统健康概览</h3>
        <span class="section-hint">点击系统卡片可快速切换查看</span>
      </div>
      <el-scrollbar ref="healthScrollRef" class="health-scroll" @wheel.prevent="onHealthWheel">
        <div class="health-track">
          <div
            v-for="sc in systemCards"
            :key="sc.id"
            class="hcard"
            :class="{ 'hcard--off': sc.onlineCount === 0 }"
            @click="systemStore.setCurrent(sc.id)"
          >
            <div class="hcard__row">
              <span class="hcard__name">{{ sc.name }}</span>
              <el-tag :type="sc.onlineCount > 0 ? 'success' : 'info'" size="small" effect="plain">
                <span class="sdot" :class="sc.onlineCount > 0 ? 'sdot--on' : 'sdot--off'" />
                {{ sc.onlineCount > 0 ? '在线' : '离线' }}
              </el-tag>
            </div>
            <div class="hcard__owner">{{ sc.owner }}</div>
            <div class="hcard__metrics">
              <div class="hcard__m">
                <b>{{ sc.onlineCount }}<em>/{{ sc.moduleCount }}</em></b>
                <span>模块</span>
              </div>
              <div class="hcard__m" v-if="sc.brokerCount > 0">
                <b :class="{ 'text-warning': sc.brokerHealthy < sc.brokerCount }">{{ sc.brokerHealthy }}<em>/{{ sc.brokerCount }}</em></b>
                <span>MQ</span>
              </div>
              <div class="hcard__m">
                <b>{{ sc.taskCount }}</b>
                <span>任务</span>
              </div>
              <div class="hcard__m">
                <b :class="{ 'text-danger': sc.alertCount > 0 }">{{ sc.alertCount }}</b>
                <span>异常</span>
              </div>
            </div>
            <el-progress
              :percentage="sc.moduleCount ? Math.round(sc.onlineCount / sc.moduleCount * 100) : 0"
              :color="sc.onlineCount === sc.moduleCount && sc.moduleCount ? '#52c41a' : '#faad14'"
              :stroke-width="4"
              :show-text="false"
            />
          </div>
        </div>
      </el-scrollbar>
    </div>

    <!-- ======== 单系统：模块链路状态列表 ======== -->
    <el-card v-else shadow="never" class="mod-card" :body-style="{ padding: '0' }">
      <template #header>
        <div class="panel-head">
          <span class="panel-title">模块链路状态</span>
          <el-button size="small" text type="primary" @click="$router.push('/connection')">管理链路 →</el-button>
        </div>
      </template>
      <el-table :data="moduleList" size="small" highlight-current-row @row-click="onModuleClick" style="cursor: pointer;" :height="154">
        <el-table-column label="类型" width="70" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.nodeType === 'broker'" type="warning" size="small" effect="plain">MQ</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">模块</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="模块名称" min-width="160">
          <template #default="{ row }">
            <span class="dot" :class="`dot--${row.status}`" />
            <span style="margin-left: 6px;">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="地址" min-width="170" align="center">
          <template #default="{ row }">
            <span class="mono">{{ row.ip }}:{{ row.port }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="modTag(row.status)" size="small">{{ modText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="延迟" width="90" align="center">
          <template #default="{ row }">
            <span v-if="row.status === 'online'" class="latency">{{ row.latency }}ms</span>
            <span v-else class="text-ph">—</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="220">
          <template #default="{ row }">
            <RemarkCell v-model="row.desc" @click.stop />
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- ======== 联试任务 / 异常告警联动区 ======== -->
    <div class="dashboard-workspace">
      <el-card shadow="never" class="scope-tree-card" :body-style="{ padding: '0' }">
        <template #header>
          <div class="panel-head">
            <span class="panel-title">任务 / 异常导航</span>
            <el-button size="small" text type="primary" @click="clearScope">全部</el-button>
          </div>
        </template>
        <el-scrollbar class="scope-tree-scroll">
          <el-tree
            :data="scopeTree"
            node-key="key"
            default-expand-all
            highlight-current
            :current-node-key="selectedScopeKey"
            :expand-on-click-node="true"
            @node-click="onScopeSelect"
          >
            <template #default="{ data }">
              <div class="scope-node" :class="`scope-node--${data.kind}`">
                <el-icon class="scope-node__icon"><component :is="data.icon" /></el-icon>
                <span class="scope-node__label">{{ data.label }}</span>
                <span v-if="data.count !== undefined" class="scope-node__count">{{ data.count }}</span>
              </div>
            </template>
          </el-tree>
          <el-empty v-if="!scopeTree.length" description="暂无系统/模块数据" :image-size="70" />
        </el-scrollbar>
      </el-card>

      <div class="linked-lists">
        <el-card
          shadow="never"
          class="list-card"
          :class="{ 'list-card--muted': activeDomain === 'task' }"
          :body-style="{ padding: '0' }"
        >
          <template #header>
            <div class="panel-head">
              <div>
                <span class="panel-title">异常告警</span>
                <span class="panel-subtitle">{{ scopeTitle }}</span>
              </div>
              <el-button size="small" text type="primary" @click="$router.push('/exception')">全部异常 →</el-button>
            </div>
          </template>
          <el-table :data="scopedAlerts" size="small" height="100%" empty-text="当前范围暂无异常告警">
            <el-table-column label="异常名称" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="name-cell">
                  <el-icon><Warning /></el-icon>
                  <span>{{ row.type }} · {{ row.iface }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="模块" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">{{ moduleName(row.moduleId) }}</template>
            </el-table-column>
            <el-table-column label="级别" width="78" align="center">
              <template #default="{ row }">
                <el-tag :type="row.level === '高' ? 'danger' : row.level === '中' ? 'warning' : 'info'" size="small" effect="dark">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="处理状态" width="106" align="center">
              <template #default="{ row }">
                <el-tag :type="stateTag(row.state)" size="small">{{ row.state }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="220">
              <template #default="{ row }">
                <RemarkCell v-model="row.remark" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="76" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openAlert(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card
          shadow="never"
          class="list-card"
          :class="{ 'list-card--muted': activeDomain === 'alert' }"
          :body-style="{ padding: '0' }"
        >
          <template #header>
            <div class="panel-head">
              <div>
                <span class="panel-title">最近联试任务</span>
                <span class="panel-subtitle">{{ scopeTitle }}</span>
              </div>
              <el-button size="small" text type="primary" @click="$router.push('/task')">全部任务 →</el-button>
            </div>
          </template>
          <el-table :data="scopedTasks" size="small" height="100%" empty-text="当前范围暂无联试任务">
            <el-table-column label="任务名称" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="name-cell">
                  <el-icon><Document /></el-icon>
                  <span>{{ row.name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="模块" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">{{ moduleName(row.moduleId) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="92" align="center">
              <template #default="{ row }">
                <el-tag :type="taskTag(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="150" prop="time" />
            <el-table-column label="备注" min-width="190">
              <template #default="{ row }">
                <RemarkCell v-model="row.remark" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="76" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openTask(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, markRaw, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Upload, WarningFilled, Tickets, Back, Cpu, Connection, Document, Warning, FolderOpened } from '@element-plus/icons-vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useExceptionStore } from '@/stores/exception'
import { tasks } from '@/mock/seed-data'
import RemarkCell from '@/components/RemarkCell.vue'

const router = useRouter()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const exceptionStore = useExceptionStore()
const treeIcons = {
  cpu: markRaw(Cpu),
  connection: markRaw(Connection),
  document: markRaw(Document),
  warning: markRaw(Warning),
  folder: markRaw(FolderOpened),
}

/* ========== 核心状态 ========== */
const isAll = computed(() => systemStore.isAll)
const current = computed(() => systemStore.current)
const currentId = computed(() => systemStore.currentId)

/* ========== 健康概览横向滚动：鼠标滚轮 ========== */
const healthScrollRef = ref(null)
const onHealthWheel = (e) => {
  const wrap = healthScrollRef.value?.wrapRef
  if (!wrap) return
  wrap.scrollLeft += e.deltaY || e.deltaX
}

/* ========== 过滤 ========== */
const visibleTasks = computed(() =>
  isAll.value ? tasks : tasks.filter(t => t.systemId === currentId.value)
)
const visibleAlerts = computed(() =>
  isAll.value ? exceptionStore.exceptions : exceptionStore.exceptions.filter(a => a.systemId === currentId.value)
)

const totalPending = computed(() => {
  const pool = isAll.value ? exceptionStore.exceptions : exceptionStore.exceptions.filter(a => a.systemId === currentId.value)
  return pool.filter(a => a.state === '待处理' || a.state === '处理中').length
})

/* ========== 统一树：系统 → 模块 → 任务目录 / 异常目录 → 条目 ========== */
const selectedScopeKey = ref('')
const selectedScope = ref({ kind: 'all', label: '全部范围' })

const scopeTree = computed(() => {
  const systems = isAll.value
    ? systemStore.visibleSystems
    : systemStore.systems.filter(s => s.id === currentId.value)
  return systems.map(sys => {
    const modules = connStore.nodes.filter(m => m.systemId === sys.id)
    return {
      key: `s-${sys.id}`,
      kind: 'system',
      icon: treeIcons.cpu,
      label: sys.name,
      systemId: sys.id,
      count: modules.length,
      children: modules.map(mod => {
        const modTasks = visibleTasks.value.filter(t => t.moduleId === mod.id)
        const modAlerts = visibleAlerts.value.filter(a => a.moduleId === mod.id)
        return {
          key: `m-${mod.id}`,
          kind: 'module',
          icon: treeIcons.connection,
          label: mod.name,
          systemId: sys.id,
          moduleId: mod.id,
          count: modTasks.length + modAlerts.length,
          children: [
            {
              key: `ag-${mod.id}`,
              kind: 'alertGroup',
              icon: treeIcons.folder,
              label: '异常',
              systemId: sys.id,
              moduleId: mod.id,
              domain: 'alert',
              count: modAlerts.length,
              children: modAlerts.map(a => ({
                key: `a-${a.id}`,
                kind: 'alert',
                icon: treeIcons.warning,
                label: `${a.type} · ${a.iface}`,
                systemId: a.systemId,
                moduleId: a.moduleId,
                domain: 'alert',
                itemId: a.id,
                ref: a
              }))
            },
            {
              key: `tg-${mod.id}`,
              kind: 'taskGroup',
              icon: treeIcons.folder,
              label: '任务',
              systemId: sys.id,
              moduleId: mod.id,
              domain: 'task',
              count: modTasks.length,
              children: modTasks.map(t => ({
                key: `t-${t.id}`,
                kind: 'task',
                icon: treeIcons.document,
                label: t.name,
                systemId: t.systemId,
                moduleId: t.moduleId,
                domain: 'task',
                itemId: t.id,
                ref: t
              }))
            }
          ]
        }
      })
    }
  })
})

const onScopeSelect = (data) => {
  selectedScopeKey.value = data.key
  selectedScope.value = data
}

const clearScope = () => {
  selectedScopeKey.value = ''
  selectedScope.value = { kind: 'all', label: '全部范围' }
}

watch(currentId, clearScope)

const activeDomain = computed(() => selectedScope.value.domain || 'all')
const scopeTitle = computed(() => {
  const scope = selectedScope.value
  if (!scope || scope.kind === 'all') return isAll.value ? '全部范围' : `系统：${current.value?.name || ''}`
  if (scope.moduleId) return `模块：${moduleName(scope.moduleId)}`
  if (scope.systemId) return `系统：${scope.label}`
  return scope.label
})

const scopedTasks = computed(() => {
  const scope = selectedScope.value
  let list = visibleTasks.value
  if (scope.systemId) list = list.filter(t => t.systemId === scope.systemId)
  if (scope.moduleId) list = list.filter(t => t.moduleId === scope.moduleId)
  if (scope.kind === 'task' && scope.itemId) list = list.filter(t => t.id === scope.itemId)
  return [...list].sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''), 'zh-CN')).slice(0, 20)
})

const scopedAlerts = computed(() => {
  const scope = selectedScope.value
  let list = visibleAlerts.value
  if (scope.systemId) list = list.filter(a => a.systemId === scope.systemId)
  if (scope.moduleId) list = list.filter(a => a.moduleId === scope.moduleId)
  if (scope.kind === 'alert' && scope.itemId) list = list.filter(a => a.id === scope.itemId)
  return [...list].sort((a, b) => {
    const pa = a.state === '待处理' || a.state === '处理中' ? 1 : 0
    const pb = b.state === '待处理' || b.state === '处理中' ? 1 : 0
    if (pa !== pb) return pb - pa
    return String(b.capturedTime || '').localeCompare(String(a.capturedTime || ''), 'zh-CN')
  }).slice(0, 20)
})

/* ========== 系统健康卡片（全局视图） ========== */
const systemCards = computed(() =>
  systemStore.visibleSystems.map(sys => {
    const mods = connStore.modulesOf(sys.id)
    const brokers = connStore.brokers.filter(b => b.systemId === sys.id)
    const brokerHealthy = brokers.filter(b => b.healthCheck?.overall === 'healthy' || b.healthCheck?.overall === 'unknown').length
    return {
      id: sys.id,
      name: sys.name,
      owner: sys.owner,
      moduleCount: mods.length,
      onlineCount: mods.filter(m => m.status === 'online').length,
      taskCount: tasks.filter(t => t.systemId === sys.id).length,
      alertCount: exceptionStore.exceptions.filter(a => a.systemId === sys.id).length,
      brokerCount: brokers.length,
      brokerHealthy,
    }
  })
)

/* ========== 模块列表（单系统视图） ========== */
const moduleList = computed(() =>
  isAll.value ? [] : connStore.modulesOf(currentId.value)
)

const onModuleClick = (row) => {
  if (!row) return
  connStore.select(row.id)
  router.push('/connection')
}

const moduleName = (moduleId) => connStore.nodes.find(m => m.id === moduleId)?.name || '未归属模块'
const openTask = (row) => router.push({ path: '/task', query: { id: row.id } })
const openAlert = (row) => router.push({
  path: '/exception',
  query: { id: row.id, systemId: row.systemId, moduleId: row.moduleId }
})

/* ========== 状态映射 ========== */
const modTag = s => ({ online: 'success', pinging: 'warning', offline: 'info' }[s] || 'info')
const modText = s => ({ online: '在线', pinging: '检测中', offline: '离线' }[s] || '离线')
const taskTag = s => ({ '执行中': '', '已完成': 'success', '异常': 'danger', '待确认': 'warning' }[s] || 'info')
const stateTag = s => ({ '待处理': 'danger', '已处理': 'success', '已修复': 'success', '自动恢复': '', '已转派': 'warning', '已记录': 'info', '已忽略': 'info' }[s] || 'info')
</script>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}

.header-middle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 0;
  :deep(.el-button) { white-space: nowrap; }
  :deep(.el-button:nth-child(3)) {
    min-width: 128px;
    overflow: visible;
  }
  :deep(.el-badge) { overflow: visible; }
}
.btn-badge { margin-left: 4px; }

/* ============ 系统健康概览（水平滚动） ============ */
.health-section {
  flex-shrink: 0;
}
.section-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 10px;
}
.section-title { margin: 0; font-size: 15px; font-weight: 600; }
.section-hint { font-size: 12px; color: var(--el-text-color-placeholder); }

.health-scroll {
  :deep(.el-scrollbar__wrap) { overflow-y: hidden; }
}
.health-track {
  display: flex;
  gap: 14px;
  padding-bottom: 4px;
  min-width: min-content;
}

.hcard {
  flex-shrink: 0;
  width: 290px;
  padding: 20px 16px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.18s;

  &:hover {
    border-color: var(--el-color-primary-light-3);
    box-shadow: 0 4px 12px rgba(47, 111, 235, 0.1);
  }
  &--off { opacity: 0.65; }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  &__name {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &__owner {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 8px;
  }
  &__metrics {
    display: flex;
    gap: 18px;
    margin-bottom: 8px;
  }
  &__m {
    display: flex;
    flex-direction: column;
    b {
      font-size: 17px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      em { font-style: normal; font-size: 12px; font-weight: 400; color: var(--el-text-color-secondary); }
    }
    span { font-size: 11px; color: var(--el-text-color-secondary); }
  }
}

.sdot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
  &--on { background: var(--el-color-success); box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.2); }
  &--off { background: var(--el-text-color-placeholder); }
}

/* ============ 模块链路状态表（单系统视图） ============ */
.mod-card {
  flex-shrink: 0;

  :deep(.el-card__header) {
    padding: 10px 16px;
  }
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  &--online { background: var(--el-color-success); box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.15); }
  &--pinging { background: var(--el-color-warning); animation: pulse 1s infinite; }
  &--offline { background: var(--el-text-color-placeholder); }
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.mono {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}
.latency {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: var(--el-color-success);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title { font-weight: 600; font-size: 14px; }
.panel-subtitle {
  margin-left: 8px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  font-weight: 400;
}

/* ============ 任务 / 异常联动工作区 ============ */
.dashboard-workspace {
  flex: 0 0 734px;
  height: 734px;
  min-height: 0;
  display: flex;
  gap: 14px;
}

.scope-tree-card {
  width: 320px;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;

  :deep(.el-card__header) {
    padding: 10px 14px;
  }

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.scope-tree-scroll {
  flex: 1;
  min-height: 0;
  padding: 8px 6px;

  :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
  }
}

.scope-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding-right: 6px;
  font-size: 13px;

  &__icon {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__count {
    min-width: 22px;
    padding: 0 6px;
    border-radius: 8px;
    background: var(--el-fill-color);
    color: var(--el-text-color-secondary);
    font-size: 11px;
    line-height: 18px;
    text-align: center;
  }

  &--system {
    font-weight: 600;
    .scope-node__icon { color: var(--el-color-primary); }
  }

  &--module {
    font-weight: 500;
    .scope-node__icon { color: #722ed1; }
  }

  &--taskGroup .scope-node__icon,
  &--task .scope-node__icon {
    color: var(--el-color-success);
  }

  &--alertGroup .scope-node__icon,
  &--alert .scope-node__icon {
    color: var(--el-color-danger);
  }
}

.linked-lists {
  height: 100%;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.list-card {
  flex: 0 0 360px;
  height: 360px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition: opacity 0.16s, border-color 0.16s;

  :deep(.el-card__header) {
    padding: 10px 14px;
  }

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &--muted {
    opacity: 0.72;
  }
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  .el-icon {
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* ============ 通用 ============ */
.text-danger { color: var(--el-color-danger) !important; }
.text-warning { color: var(--el-color-warning) !important; }
.text-ph { color: var(--el-text-color-placeholder); }

@media (max-width: 1100px) {
  .dashboard-workspace {
    flex-direction: column;
    min-height: 0;
  }

  .scope-tree-card {
    width: 100%;
    height: 300px;
  }

  .linked-lists {
    height: auto;
    min-height: 620px;
  }
}
</style>
