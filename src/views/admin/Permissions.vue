<template>
  <div class="page permissions-page">
    <!-- ======== 页面头 ======== -->
    <div class="page__header">
      <div>
        <h2>权限管理</h2>
        <div class="page__desc">管理测试员对各系统的访问权限，勾选即授权</div>
      </div>
    </div>

    <!-- ======== 统计栏 ======== -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-num">{{ allUsers.length }}</span>
        <span class="stat-label">总用户</span>
      </div>
      <div class="stat-item">
        <span class="stat-num stat-num--primary">{{ adminCount }}</span>
        <span class="stat-label">管理员</span>
      </div>
      <div class="stat-item">
        <span class="stat-num stat-num--info">{{ testerCount }}</span>
        <span class="stat-label">测试员</span>
      </div>
      <div class="stat-item">
        <span class="stat-num" :class="{ 'stat-num--warn': unassignedCount > 0 }">{{ unassignedCount }}</span>
        <span class="stat-label">未分配系统</span>
      </div>
    </div>

    <!-- ======== 权限矩阵 ======== -->
    <el-card shadow="never" class="matrix-card">
      <template #header>
        <div class="panel-head">
          <span class="panel-title">权限分配矩阵</span>
          <span class="panel-hint">管理员默认拥有全部系统权限，勾选/取消勾选即时生效</span>
        </div>
      </template>

      <div class="matrix-wrapper">
        <el-table :data="matrixData" size="small" border style="width: 100%;">
          <!-- 用户名列 -->
          <el-table-column label="用户" min-width="160" fixed>
            <template #default="{ row }">
              <div class="user-cell">
                <span class="user-cell__avatar">{{ row.realName.charAt(row.realName.length - 1) }}</span>
                <div class="user-cell__info">
                  <span class="user-cell__name">{{ row.realName }}</span>
                  <span class="user-cell__username mono">{{ row.username }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <!-- 角色列 -->
          <el-table-column label="角色" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.role === 'admin' ? '' : 'info'" size="small" effect="plain">
                {{ row.role === 'admin' ? '管理员' : '测试员' }}
              </el-tag>
            </template>
          </el-table-column>

          <!-- 每个系统一列 -->
          <el-table-column
            v-for="sys in systemStore.systems"
            :key="sys.id"
            :label="sys.name"
            width="150"
            align="center"
          >
            <template #header>
              <el-tooltip :content="sys.name" placement="top">
                <span class="sys-col-header">{{ truncate(sys.name, 8) }}</span>
              </el-tooltip>
            </template>
            <template #default="{ row }">
              <template v-if="row.role === 'admin'">
                <el-icon class="lock-icon" color="#52c41a"><Check /></el-icon>
                <span class="lock-text">全权限</span>
              </template>
              <template v-else>
                <el-checkbox
                  :model-value="hasPermission(row.id, sys.id)"
                  @change="(val) => togglePermission(row.id, sys.id, val)"
                />
              </template>
            </template>
          </el-table-column>

          <!-- 统计列 -->
          <el-table-column label="已授权" width="90" align="center" fixed="right">
            <template #default="{ row }">
              <span class="count-badge">
                {{ row.role === 'admin' ? systemStore.systems.length : getPermissionCount(row.id) }}
                <em>/{{ systemStore.systems.length }}</em>
              </span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 列底部统计 -->
      <div v-if="testerUsers.length > 0" class="matrix-footer">
        <div class="footer-label">已授权人数</div>
        <div
          v-for="sys in systemStore.systems"
          :key="sys.id"
          class="footer-cell"
        >
          {{ getSystemUserCount(sys.id) }} / {{ testerUsers.length }} 人
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSystemStore } from '@/stores/system'

const authStore = useAuthStore()
const systemStore = useSystemStore()

/* ========== 计算属性 ========== */
const allUsers = computed(() => authStore.users)
const adminCount = computed(() => authStore.adminUsers.length)
const testerUsers = computed(() => authStore.testerUsers)
const testerCount = computed(() => testerUsers.value.length)

const unassignedCount = computed(() => {
  return testerUsers.value.filter(u => {
    const ids = authStore.getSystemIds(u.id)
    return ids.length === 0
  }).length
})

/** 矩阵表格数据（所有用户） */
const matrixData = computed(() => allUsers.value)

/* ========== 权限操作 ========== */
const hasPermission = (userId, systemId) => {
  const ids = authStore.getSystemIds(userId)
  return ids.includes(systemId)
}

const getPermissionCount = (userId) => {
  return authStore.getSystemIds(userId).length
}

const getSystemUserCount = (systemId) => {
  return testerUsers.value.filter(u => {
    const ids = authStore.getSystemIds(u.id)
    return ids.includes(systemId)
  }).length
}

const togglePermission = (userId, systemId, checked) => {
  const currentIds = authStore.getSystemIds(userId)
  let newIds
  if (checked) {
    newIds = [...currentIds, systemId]
  } else {
    newIds = currentIds.filter(id => id !== systemId)
  }
  authStore.setPermission(userId, newIds)

  const user = authStore.users.find(u => u.id === userId)
  const sys = systemStore.systems.find(s => s.id === systemId)

  if (checked) {
    ElMessage.success(`已授予 ${user?.realName} 对 ${sys?.name} 的访问权限`)
  } else {
    ElMessage.warning(`已撤销 ${user?.realName} 对 ${sys?.name} 的访问权限`)
  }

  // 如果取消了所有系统权限，给出提示
  if (!checked && newIds.length === 0) {
    ElMessage.warning(`${user?.realName} 当前没有任何系统权限，登录后将无法看到任何系统`)
  }
}

/* ========== 工具 ========== */
const truncate = (value, length) => {
  if (!value) return ''
  return value.length > length ? value.slice(0, length) + '...' : value
}
</script>

<style scoped lang="scss">
.permissions-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 12px 20px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  flex: 1;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  &--primary { color: var(--el-color-primary); }
  &--info { color: #8b9dc3; }
  &--warn { color: var(--el-color-warning); }
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

/* 矩阵卡片 */
.matrix-card {
  :deep(.el-card__header) {
    padding: 12px 16px;
  }
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-title { font-weight: 600; font-size: 14px; }
.panel-hint { font-size: 12px; color: var(--el-text-color-placeholder); }

.matrix-wrapper {
  overflow-x: auto;
}

/* 用户单元格 */
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;

  &__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--el-color-primary-light-7);
    color: var(--el-color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }

  &__info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__username {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.mono {
  font-family: 'Consolas', 'Monaco', monospace;
}

.sys-col-header {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lock-icon {
  margin-right: 2px;
}
.lock-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.count-badge {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  em {
    font-style: normal;
    font-size: 12px;
    font-weight: 400;
    color: var(--el-text-color-secondary);
  }
}

/* 底部统计 */
.matrix-footer {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
  margin-top: 8px;
}

.footer-label {
  min-width: 160px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding-left: 8px;
}

.footer-cell {
  width: 150px;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}
</style>
