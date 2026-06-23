<template>
  <div class="page dashboard">
    <div class="page__header">
      <div>
        <h2>系统首页 / 工作台</h2>
        <div class="page__desc">便携式智能联试工具 · 联试全流程概览</div>
      </div>
      <el-button-group>
        <el-button type="primary" :icon="Plus" @click="$router.push('/task')">创建测试任务</el-button>
        <el-button :icon="Upload" @click="$router.push('/protocol')">导入协议模板</el-button>
        <el-button :icon="Warning" @click="$router.push('/exception')">查看异常详情</el-button>
        <el-button :icon="Tickets" @click="$router.push('/report')">生成联试报告</el-button>
      </el-button-group>
    </div>

    <!-- 概览卡片 -->
    <div class="stat-grid">
      <el-card v-for="s in stats" :key="s.label" shadow="hover" class="stat-card">
        <div class="stat-card__value" :style="{ color: s.color }">{{ s.value }}</div>
        <div class="stat-card__label">{{ s.label }}</div>
      </el-card>
    </div>

    <el-row :gutter="16" class="panel-row">
      <el-col :span="14" class="panel-col">
        <el-card shadow="never" class="panel-card" :body-style="cardBody">
          <template #header>最近联试任务</template>
          <el-table :data="recentTasks" height="100%" size="default" stripe>
            <el-table-column prop="name" label="任务名称" min-width="200" show-overflow-tooltip />
            <el-table-column prop="system" label="被测系统" min-width="120" align="center" />
            <el-table-column prop="status" label="状态" min-width="110" align="center">
              <template #default="{ row }">
                <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="time" label="更新时间" min-width="120" align="center" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10" class="panel-col">
        <el-card shadow="never" class="panel-card" :body-style="cardBody">
          <template #header>异常告警与规则命中</template>
          <el-table :data="alerts" height="100%" size="default" stripe>
            <el-table-column prop="type" label="异常类型" min-width="120" />
            <el-table-column prop="iface" label="关联接口" min-width="120" align="center" />
            <el-table-column prop="level" label="级别" min-width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.level === '高' ? 'danger' : 'warning'" size="small">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="state" label="处理状态" min-width="120" align="center" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { Plus, Upload, Warning, Tickets } from '@element-plus/icons-vue'

// 让卡片 body 成为可伸缩的 flex 容器，表格才能填满高度
const cardBody = { flex: '1', minHeight: '0', padding: '0' }

const stats = [
  { label: '当前连接数', value: 12, color: '#2f6feb' },
  { label: '接口模板数', value: 86, color: '#13c2c2' },
  { label: '执行中任务', value: 5, color: '#52c41a' },
  { label: '今日异常数', value: 9, color: '#fa541c' }
]

const recentTasks = [
  { name: '接口连通性测试', system: '分系统A', status: '执行中', time: '10:31' },
  { name: '边界值规则检测', system: '分系统B', status: '已完成', time: '09:45' },
  { name: '异常接口回放', system: '分系统C', status: '异常', time: '09:20' },
  { name: '报告生成任务', system: '分系统A', status: '待确认', time: '08:50' }
]

const alerts = [
  { type: '字段越界', iface: 'IF-003', level: '高', state: '待处理' },
  { type: '响应超时', iface: 'IF-017', level: '中', state: '已记录' },
  { type: '格式错误', iface: 'IF-006', level: '高', state: '待处理' },
  { type: '心跳丢失', iface: '会话-02', level: '中', state: '自动恢复' }
]

const statusType = (s) => ({ 执行中: 'primary', 已完成: 'success', 异常: 'danger', 待确认: 'info' }[s] || 'info')
</script>

<style scoped lang="scss">
.dashboard {
  height: 100%;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.stat-card {
  text-align: center;
  &__value { font-size: 30px; font-weight: 700; line-height: 1.2; }
  &__label { color: var(--el-text-color-secondary); font-size: 13px; margin-top: 6px; }
}

/* 下方面板填满剩余高度 */
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
</style>
