<template>
  <div class="page dashboard">
    <!-- ======== 页面头部 ======== -->
    <div class="page__header">
      <div>
        <h2>{{ isAll ? '系统首页 / 工作台' : `${current.name} / 工作台` }}</h2>
        <div class="page__desc">
          {{ isAll ? '便携式智能联试工具 · 联试全流程概览' : (current.desc || `负责人：${current.owner}`) }}
        </div>
        <el-tag
          v-if="!isAll"
          class="system-context"
          size="small"
          effect="plain"
          @click="systemStore.setCurrent(null)"
          style="cursor: pointer;"
        >
          <el-icon style="margin-right: 2px;"><Back /></el-icon>
          返回全部系统
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="Plus" @click="$router.push('/task')">创建测试任务</el-button>
        <el-button :icon="Upload" @click="$router.push('/protocol')">导入协议模板</el-button>
        <el-button
          :icon="WarningFilled"
          @click="$router.push('/exception')"
          :type="totalPending > 0 ? 'danger' : ''"
          plain
        >
          异常详情
          <el-badge v-if="totalPending > 0" :value="totalPending" class="btn-badge" />
        </el-button>
        <el-button :icon="Tickets" @click="$router.push('/report')">生成报告</el-button>
      </div>
    </div>

    <!-- ======== 全部系统：系统健康概览（水平滚动） ======== -->
    <div v-if="isAll" class="health-section">
      <div class="section-head">
        <h3 class="section-title">系统健康概览</h3>
        <span class="section-hint">点击系统卡片可快速切换查看</span>
      </div>
      <el-scrollbar class="health-scroll">
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
      <el-table :data="moduleList" size="default" highlight-current-row @row-click="onModuleClick" style="cursor: pointer;">
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

    <!-- ======== 异常告警（树形表格） ======== -->
    <el-card shadow="never" class="tree-card">
      <template #header>
        <div class="panel-head">
          <span class="panel-title">异常告警</span>
          <el-button size="small" text type="primary" @click="$router.push('/exception')">全部异常 →</el-button>
        </div>
      </template>
      <el-scrollbar class="tree-scroll">
        <el-tree
          :data="alertTree"
          node-key="key"
          default-expand-all
          :expand-on-click-node="false"
          @node-click="(d) => onLeafClick(d, '/exception')"
        >
          <template #default="{ data }">
            <div class="trow">
              <div class="trow__main">
                <el-icon class="trow__icon" :class="`ticon--${data.kind}`"><component :is="data.icon" /></el-icon>
                <span class="trow__label">{{ data.label }}</span>
                <el-tag v-if="data.level" :type="data.level === '高' ? 'danger' : 'warning'" size="small" effect="dark">{{ data.level }}</el-tag>
                <el-tag v-if="data.state" :type="stateTag(data.state)" size="small">{{ data.state }}</el-tag>
              </div>
              <div v-if="data.kind === 'item'" class="trow__aside" @click.stop>
                <RemarkCell v-model="data.ref.remark" />
              </div>
            </div>
          </template>
        </el-tree>
        <el-empty v-if="!alertTree.length" description="暂无异常告警" :image-size="60" />
      </el-scrollbar>
    </el-card>

    <!-- ======== 最近联试任务（树形表格） ======== -->
    <el-card shadow="never" class="tree-card">
      <template #header>
        <div class="panel-head">
          <span class="panel-title">最近联试任务</span>
          <el-button size="small" text type="primary" @click="$router.push('/task')">全部任务 →</el-button>
        </div>
      </template>
      <el-scrollbar class="tree-scroll">
        <el-tree
          :data="taskTree"
          node-key="key"
          default-expand-all
          :expand-on-click-node="false"
          @node-click="(d) => onLeafClick(d, '/task')"
        >
          <template #default="{ data }">
            <div class="trow">
              <div class="trow__main">
                <el-icon class="trow__icon" :class="`ticon--${data.kind}`"><component :is="data.icon" /></el-icon>
                <span class="trow__label">{{ data.label }}</span>
                <el-tag v-if="data.status" :type="taskTag(data.status)" size="small">{{ data.status }}</el-tag>
                <span v-if="data.time" class="trow__time">{{ data.time }}</span>
              </div>
              <div v-if="data.kind === 'item'" class="trow__aside" @click.stop>
                <RemarkCell v-model="data.ref.remark" />
              </div>
            </div>
          </template>
        </el-tree>
        <el-empty v-if="!taskTree.length" description="暂无联试任务" :image-size="60" />
      </el-scrollbar>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Upload, WarningFilled, Tickets, Back, Cpu, Connection, Document, Warning } from '@element-plus/icons-vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import RemarkCell from '@/components/RemarkCell.vue'

const router = useRouter()
const systemStore = useSystemStore()
const connStore = useConnectionStore()

/* ========== 核心状态 ========== */
const isAll = computed(() => systemStore.isAll)
const current = computed(() => systemStore.current)
const currentId = computed(() => systemStore.currentId)

/* ========== Mock 数据：任务（含 moduleId + remark） ========== */
const tasks = [
  { id: 't1', name: '武器状态接口连通性测试', systemId: 'sys-weapon', moduleId: 101, status: '执行中', time: '10:31', remark: '验证 WM-001 接口在标准帧格式下的握手与应答流程' },
  { id: 't2', name: '弹药余量边界值检测', systemId: 'sys-weapon', moduleId: 102, status: '已完成', time: '09:45', remark: '覆盖 0%/100% 边界值，已生成测试报告' },
  { id: 't3', name: '武器挂载自检流程验证', systemId: 'sys-weapon', moduleId: 101, status: '已完成', time: '09:10', remark: '' },
  { id: 't4', name: '火控解算异常回放', systemId: 'sys-fire-control', moduleId: 103, status: '异常', time: '09:20', remark: '回放 08:55 采集的异常帧数据，解算结果偏差超限' },
  { id: 't5', name: '指挥链路报告生成任务', systemId: 'sys-fire-control', moduleId: 104, status: '待确认', time: '08:50', remark: '链路当前不通，待恢复后自动执行' },
  { id: 't6', name: '目标分配协议一致性检测', systemId: 'sys-fire-control', moduleId: 103, status: '执行中', time: '10:15', remark: '对比协议 v2.1 与 v2.2 的字段差异' }
]

/* ========== Mock 数据：异常告警（含 moduleId + remark） ========== */
const alerts = [
  { id: 'a1', type: '字段越界', iface: 'WM-003', level: '高', state: '待处理', systemId: 'sys-weapon', moduleId: 101, remark: '温度字段值 256 超出 uint8 范围，疑似传感器标定错误' },
  { id: 'a2', type: '响应超时', iface: 'FC-017', level: '中', state: '已记录', systemId: 'sys-fire-control', moduleId: 103, remark: '连续 3 次超时 > 500ms，已自动记录' },
  { id: 'a3', type: '格式错误', iface: 'WM-006', level: '高', state: '待处理', systemId: 'sys-weapon', moduleId: 102, remark: '帧头校验码不匹配，疑似固件版本不一致' },
  { id: 'a4', type: '心跳丢失', iface: '指挥链路模块', level: '中', state: '自动恢复', systemId: 'sys-fire-control', moduleId: 104, remark: '心跳恢复，原因待排查' },
  { id: 'a5', type: '帧头校验失败', iface: 'FC-021', level: '高', state: '待处理', systemId: 'sys-fire-control', moduleId: 103, remark: '' }
]

/* ========== 过滤 ========== */
const visibleTasks = computed(() =>
  isAll.value ? tasks : tasks.filter(t => t.systemId === currentId.value)
)
const visibleAlerts = computed(() =>
  isAll.value ? alerts : alerts.filter(a => a.systemId === currentId.value)
)

const totalPending = computed(() => {
  const pool = isAll.value ? alerts : alerts.filter(a => a.systemId === currentId.value)
  return pool.filter(a => a.state === '待处理').length
})

/* ========== 树构建：系统 → 模块 → 条目（复用于任务 / 告警） ========== */
const buildTree = (items, itemMapper) => {
  const systems = isAll.value
    ? systemStore.systems
    : systemStore.systems.filter(s => s.id === currentId.value)
  return systems.map(sys => {
    const modules = connStore.nodes.filter(m => m.systemId === sys.id)
    return {
      key: `s-${sys.id}`,
      kind: 'system',
      icon: Cpu,
      label: sys.name,
      children: modules.map(mod => {
        const leaves = items.filter(it => it.moduleId === mod.id).map(itemMapper)
        if (!leaves.length) return null
        return {
          key: `m-${mod.id}`,
          kind: 'module',
          icon: Connection,
          label: mod.name,
          children: leaves
        }
      }).filter(Boolean)
    }
  }).filter(s => s.children.length)
}

const taskTree = computed(() =>
  buildTree(visibleTasks.value, t => ({
    key: `t-${t.id}`,
    kind: 'item',
    icon: Document,
    label: t.name,
    status: t.status,
    time: t.time,
    ref: t
  }))
)

const alertTree = computed(() =>
  buildTree(visibleAlerts.value, a => ({
    key: `a-${a.id}`,
    kind: 'item',
    icon: Warning,
    label: `${a.type} · ${a.iface}`,
    level: a.level,
    state: a.state,
    ref: a
  }))
)

/* ========== 叶子点击跳转 ========== */
const onLeafClick = (data, route) => {
  if (data.kind !== 'item') return
  router.push(route)
}

/* ========== 系统健康卡片（全局视图） ========== */
const systemCards = computed(() =>
  systemStore.systems.map(sys => {
    const mods = connStore.modulesOf(sys.id)
    return {
      id: sys.id,
      name: sys.name,
      owner: sys.owner,
      moduleCount: mods.length,
      onlineCount: mods.filter(m => m.status === 'online').length,
      taskCount: tasks.filter(t => t.systemId === sys.id).length,
      alertCount: alerts.filter(a => a.systemId === sys.id).length
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

/* ========== 状态映射 ========== */
const modTag = s => ({ online: 'success', pinging: 'warning', offline: 'info' }[s] || 'info')
const modText = s => ({ online: '在线', pinging: '检测中', offline: '离线' }[s] || '离线')
const taskTag = s => ({ '执行中': '', '已完成': 'success', '异常': 'danger', '待确认': 'warning' }[s] || 'info')
const stateTag = s => ({ '待处理': 'danger', '已记录': 'warning', '自动恢复': 'success', '已忽略': 'info' }[s] || 'info')
</script>

<style scoped lang="scss">
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100%;
}

.system-context { margin-top: 6px; }
.header-actions { display: flex; align-items: center; gap: 0; }
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
  padding: 12px 16px;
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

/* ============ 树形卡片（任务 + 告警共用） ============ */
.tree-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 0;
  }
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title { font-weight: 600; font-size: 14px; }

.tree-scroll {
  flex: 1;
  min-height: 0;
  padding: 4px 8px;
}

/* 树节点行：复用 SystemModuleTree 的 tnode 视觉语言 */
.trow {
  display: flex;
  align-items: center;
  width: 100%;
  font-size: 13px;
  padding-right: 8px;

  &__main {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

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

  &__time {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    margin-left: 8px;
  }

  &__aside {
    flex-shrink: 0;
    margin-left: 12px;
    max-width: 280px;
  }
}

/* 节点类型图标色（与 SystemModuleTree 一致） */
.ticon--system { color: var(--el-color-primary); }
.ticon--module { color: #722ed1; }

/* 系统 / 模块层级加粗（与 SystemModuleTree 的 tnode--system / tnode--module 对齐） */
:deep(.el-tree-node--expanded > .el-tree-node__content .trow),
:deep(.el-tree-node:has(> .el-tree-node__children) > .el-tree-node__content .trow) {
  font-weight: 600;
}
:deep(.el-tree-node .el-tree-node .el-tree-node--expanded > .el-tree-node__content .trow),
:deep(.el-tree-node .el-tree-node .el-tree-node:has(> .el-tree-node__children) > .el-tree-node__content .trow) {
  font-weight: 500;
}

/* ============ 通用 ============ */
.text-danger { color: var(--el-color-danger) !important; }
.text-ph { color: var(--el-text-color-placeholder); }
</style>
