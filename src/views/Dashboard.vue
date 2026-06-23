<template>
  <div class="page dashboard">
    <!-- 页面头部 -->
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
          :type="totalExceptions > 0 ? 'danger' : ''"
          plain
        >
          异常详情
          <el-badge v-if="totalExceptions > 0" :value="totalExceptions" class="btn-badge" />
        </el-button>
        <el-button :icon="Tickets" @click="$router.push('/report')">生成报告</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-grid" :class="{ 'stat-grid--5': isAll }">
      <el-card v-for="s in statCards" :key="s.label" shadow="hover" class="stat-card">
        <div class="stat-card__value" :style="{ color: s.color }">{{ s.value }}</div>
        <div class="stat-card__label">{{ s.label }}</div>
      </el-card>
    </div>

    <!-- ========= 全部系统视图 ========= -->
    <template v-if="isAll">
      <!-- 系统健康概览 -->
      <div class="section-header">
        <h3 class="section-title">系统健康概览</h3>
        <span class="section-subtitle">点击系统卡片可快速切换查看</span>
      </div>
      <div class="sys-grid">
        <div
          v-for="sc in systemCards"
          :key="sc.id"
          class="sys-card"
          :class="{ 'sys-card--offline': sc.connectedCount === 0 }"
          @click="systemStore.setCurrent(sc.id)"
        >
          <div class="sys-card__head">
            <div class="sys-card__title">{{ sc.name }}</div>
            <el-tag :type="sc.connectedCount > 0 ? 'success' : 'info'" size="small" effect="plain">
              <span class="status-dot" :class="sc.connectedCount > 0 ? 'status-dot--on' : 'status-dot--off'" />
              {{ sc.connectedCount > 0 ? '在线' : '离线' }}
            </el-tag>
          </div>
          <div class="sys-card__meta">{{ sc.owner }}</div>
          <div class="sys-card__stats">
            <div class="sys-card__stat">
              <span class="sys-card__sv">{{ sc.connectedCount }}<em>/{{ sc.moduleCount }}</em></span>
              <span class="sys-card__sl">模块连接</span>
            </div>
            <div class="sys-card__stat">
              <span class="sys-card__sv">{{ sc.taskCount }}</span>
              <span class="sys-card__sl">联试任务</span>
            </div>
            <div class="sys-card__stat">
              <span class="sys-card__sv" :class="{ 'text-danger': sc.exceptionCount > 0 }">{{ sc.exceptionCount }}</span>
              <span class="sys-card__sl">异常</span>
            </div>
          </div>
          <el-progress
            :percentage="sc.moduleCount > 0 ? Math.round(sc.connectedCount / sc.moduleCount * 100) : 0"
            :color="sc.connectedCount === sc.moduleCount && sc.moduleCount > 0 ? '#52c41a' : '#faad14'"
            :stroke-width="5"
            :show-text="false"
          />
        </div>
      </div>
    </template>

    <!-- ========= 单系统视图：模块连接状态 ========= -->
    <template v-else>
      <el-card shadow="never" class="module-card" :body-style="{ padding: '0' }">
        <template #header>
          <div class="card-header">
            <span class="card-title">模块连接状态</span>
            <el-button size="small" text type="primary" @click="$router.push('/connection')">
              管理连接 →
            </el-button>
          </div>
        </template>
        <el-table :data="currentModules" size="default" :show-header="true">
          <el-table-column label="模块名称" min-width="160">
            <template #default="{ row }">
              <span class="dot" :class="`dot--${row.status}`" />
              <span style="margin-left: 6px;">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="地址" min-width="180" align="center">
            <template #default="{ row }">
              <span class="mono-text">{{ row.ip }}:{{ row.port }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="moduleTag(row.status)" size="small">{{ moduleText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="延迟" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.status === 'connected'" class="latency-text">{{ row.latency }}ms</span>
              <span v-else class="text-placeholder">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- ========= 下方双列面板 ========= -->
    <el-row :gutter="16" class="panel-row">
      <el-col :span="14" class="panel-col">
        <el-card shadow="never" class="panel-card" :body-style="cardBody">
          <template #header>
            <div class="card-header">
              <span class="card-title">{{ isAll ? '最近联试任务' : '本系统任务' }}</span>
              <el-button size="small" text type="primary" @click="$router.push('/task')">全部任务 →</el-button>
            </div>
          </template>
          <el-table :data="filteredTasks" height="100%" size="default" stripe>
            <el-table-column prop="name" label="任务名称" min-width="200" show-overflow-tooltip />
            <el-table-column v-if="isAll" label="被测系统" min-width="130" align="center">
              <template #default="{ row }">
                {{ getSystemName(row.systemId) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="taskType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="更新时间" width="100" align="center" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10" class="panel-col">
        <el-card shadow="never" class="panel-card" :body-style="cardBody">
          <template #header>
            <div class="card-header">
              <span class="card-title">异常告警</span>
              <el-button size="small" text type="primary" @click="$router.push('/exception')">全部异常 →</el-button>
            </div>
          </template>
          <el-table :data="filteredAlerts" height="100%" size="default" stripe>
            <el-table-column prop="type" label="异常类型" min-width="110" />
            <el-table-column prop="iface" label="关联接口" min-width="100" align="center" />
            <el-table-column prop="level" label="级别" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="row.level === '高' ? 'danger' : 'warning'" size="small" effect="dark">
                  {{ row.level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="state" label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="exceptionTag(row.state)" size="small">{{ row.state }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Plus, Upload, WarningFilled, Tickets, Back } from '@element-plus/icons-vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useProtocolStore } from '@/stores/protocol'

const systemStore = useSystemStore()
const connectionStore = useConnectionStore()
const protocolStore = useProtocolStore()

const cardBody = { flex: '1', minHeight: '0', padding: '0' }

/* ========== 核心状态 ========== */
const isAll = computed(() => systemStore.isAll)
const current = computed(() => systemStore.current)
const currentId = computed(() => systemStore.currentId)

/* ========== 模块辅助 ========== */
const currentModules = computed(() => {
  if (isAll.value) return []
  return connectionStore.modulesOf(currentId.value)
})

const currentModuleCount = computed(() => currentModules.value.length)
const currentConnected = computed(() => currentModules.value.filter(m => m.status === 'connected').length)

/* ========== 统计卡片 ========== */
const statCards = computed(() => {
  if (isAll.value) {
    return [
      { label: '被测系统', value: systemStore.systems.length, color: '#2f6feb' },
      { label: '模块总数', value: connectionStore.nodes.length, color: '#722ed1' },
      { label: '已连接模块', value: connectionStore.connectedCount, color: '#52c41a' },
      { label: '协议 / 接口', value: `${protocolStore.protocols.length} / ${protocolStore.interfaces.length}`, color: '#13c2c2' },
      { label: '今日异常', value: totalExceptions.value, color: totalExceptions.value > 0 ? '#fa541c' : '#52c41a' }
    ]
  }
  return [
    { label: '本系统模块', value: currentModuleCount.value, color: '#2f6feb' },
    { label: '已连接', value: currentConnected.value, color: '#52c41a' },
    { label: '协议 / 接口', value: `${protocolStore.protocols.length} / ${protocolStore.interfaces.length}`, color: '#13c2c2' },
    { label: '本系统任务', value: filteredTasks.value.length, color: '#722ed1' },
    { label: '本系统异常', value: filteredAlerts.value.length, color: filteredAlerts.value.length > 0 ? '#fa541c' : '#52c41a' }
  ]
})

/* ========== 系统健康卡片（仅全局视图） ========== */
const systemCards = computed(() =>
  systemStore.systems.map(sys => {
    const modules = connectionStore.modulesOf(sys.id)
    return {
      id: sys.id,
      name: sys.name,
      owner: sys.owner,
      moduleCount: modules.length,
      connectedCount: modules.filter(m => m.status === 'connected').length,
      taskCount: tasks.filter(t => t.systemId === sys.id).length,
      exceptionCount: alerts.filter(a => a.systemId === sys.id).length
    }
  })
)

/* ========== 异常总数 ========== */
const totalExceptions = computed(() => {
  if (isAll.value) return alerts.filter(a => a.state === '待处理').length
  return alerts.filter(a => a.systemId === currentId.value && a.state === '待处理').length
})

/* ========== Mock 数据 ========== */
const tasks = [
  { name: '武器状态接口连通性测试', systemId: 'sys-weapon', status: '执行中', time: '10:31' },
  { name: '弹药余量边界值检测', systemId: 'sys-weapon', status: '已完成', time: '09:45' },
  { name: '武器挂载自检流程验证', systemId: 'sys-weapon', status: '已完成', time: '09:10' },
  { name: '火控解算异常回放', systemId: 'sys-fire-control', status: '异常', time: '09:20' },
  { name: '指挥链路报告生成任务', systemId: 'sys-fire-control', status: '待确认', time: '08:50' },
  { name: '目标分配协议一致性检测', systemId: 'sys-fire-control', status: '执行中', time: '10:15' }
]

const alerts = [
  { type: '字段越界', iface: 'WM-003', level: '高', state: '待处理', systemId: 'sys-weapon' },
  { type: '响应超时', iface: 'FC-017', level: '中', state: '已记录', systemId: 'sys-fire-control' },
  { type: '格式错误', iface: 'WM-006', level: '高', state: '待处理', systemId: 'sys-weapon' },
  { type: '心跳丢失', iface: '指挥链路模块', level: '中', state: '自动恢复', systemId: 'sys-fire-control' },
  { type: '帧头校验失败', iface: 'FC-021', level: '高', state: '待处理', systemId: 'sys-fire-control' }
]

/* ========== 过滤后数据 ========== */
const filteredTasks = computed(() =>
  isAll.value ? tasks : tasks.filter(t => t.systemId === currentId.value)
)

const filteredAlerts = computed(() =>
  isAll.value ? alerts : alerts.filter(a => a.systemId === currentId.value)
)

/* ========== 辅助函数 ========== */
const getSystemName = (id) => systemStore.systems.find(s => s.id === id)?.name || '—'

const taskType = (s) => ({ '执行中': '', '已完成': 'success', '异常': 'danger', '待确认': 'warning' }[s] || 'info')

const moduleTag = (s) => ({ connected: 'success', connecting: 'warning', disconnected: 'info', error: 'danger' }[s] || 'info')
const moduleText = (s) => ({ connected: '已连接', connecting: '连接中', disconnected: '未连接', error: '异常' }[s] || '未知')

const exceptionTag = (s) => ({ '待处理': 'danger', '已记录': 'warning', '自动恢复': 'success', '已忽略': 'info' }[s] || 'info')
</script>

<style scoped lang="scss">
.dashboard {
  height: 100%;
}

.system-context {
  margin-top: 6px;
}

/* ========== 统计卡片 ========== */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;

  &--5 {
    grid-template-columns: repeat(5, 1fr);
  }
}

.stat-card {
  text-align: center;
  transition: transform 0.15s;

  &:hover { transform: translateY(-2px); }

  &__value {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  &__label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
    margin-top: 4px;
  }
}

/* ========== 系统健康卡片网格 ========== */
.section-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.section-subtitle {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.sys-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.sys-card {
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--el-color-primary-light-3);
    box-shadow: 0 4px 12px rgba(47, 111, 235, 0.1);
  }

  &--offline {
    opacity: 0.72;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  &__title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 10px;
  }

  &__stats {
    display: flex;
    gap: 20px;
    margin-bottom: 10px;
  }

  &__stat {
    display: flex;
    flex-direction: column;
  }

  &__sv {
    font-size: 18px;
    font-weight: 700;
    color: var(--el-text-color-primary);
    font-variant-numeric: tabular-nums;

    em {
      font-style: normal;
      font-size: 13px;
      font-weight: 400;
      color: var(--el-text-color-secondary);
    }
  }

  &__sl {
    font-size: 11px;
    color: var(--el-text-color-secondary);
    margin-top: 1px;
  }
}

/* ========== 模块连接表（单系统视图） ========== */
.module-card {
  :deep(.el-card__header) {
    padding: 12px 16px;
  }
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &--connected { background: var(--el-color-success); box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.15); }
  &--connecting { background: var(--el-color-warning); animation: pulse 1s infinite; }
  &--disconnected { background: var(--el-text-color-placeholder); }
  &--error { background: var(--el-color-danger); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.mono-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.latency-text {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  color: var(--el-color-success);
}

/* ========== 通用面板 ========== */
.panel-row {
  flex: 1;
  min-height: 0;
}

.panel-col {
  height: 100%;
}

.panel-card {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-weight: 600;
  font-size: 14px;
}

/* ========== 状态指示点 ========== */
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;

  &--on {
    background: var(--el-color-success);
    box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.2);
  }

  &--off {
    background: var(--el-text-color-placeholder);
  }
}

/* ========== 文字辅助 ========== */
.text-danger {
  color: var(--el-color-danger) !important;
}

.text-placeholder {
  color: var(--el-text-color-placeholder);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0;
}

.btn-badge {
  margin-left: 4px;
}
</style>
