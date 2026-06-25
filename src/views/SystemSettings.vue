<template>
  <div class="page system-settings-page">
    <!-- ======== 页面头 ======== -->
    <div class="page__header">
      <div>
        <h2>系统设置</h2>
        <div class="page__desc">网络、日志与通知等系统级参数配置</div>
      </div>
    </div>

    <div class="settings-section">
      <!-- 网络配置 -->
      <el-card shadow="never" class="settings-card">
        <template #header>
          <span class="card-title">网络配置</span>
        </template>
        <el-form :model="netConfig" label-width="140px" class="settings-form">
          <el-form-item label="默认 Ping 间隔">
            <el-input-number v-model="netConfig.pingInterval" :min="1000" :max="60000" :step="1000" />
            <span class="form-unit">ms</span>
          </el-form-item>
          <el-form-item label="Ping 超时阈值">
            <el-input-number v-model="netConfig.pingTimeout" :min="500" :max="10000" :step="500" />
            <span class="form-unit">ms</span>
          </el-form-item>
          <el-form-item label="自动重连次数">
            <el-input-number v-model="netConfig.autoReconnect" :min="0" :max="10" />
            <span class="form-unit">次</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSaveConfig('network')">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 日志配置 -->
      <el-card shadow="never" class="settings-card">
        <template #header>
          <span class="card-title">日志配置</span>
        </template>
        <el-form :model="logConfig" label-width="140px" class="settings-form">
          <el-form-item label="日志保留天数">
            <el-input-number v-model="logConfig.retentionDays" :min="1" :max="365" />
            <span class="form-unit">天</span>
          </el-form-item>
          <el-form-item label="日志级别">
            <el-select v-model="logConfig.level" style="width: 160px;">
              <el-option label="全部" value="all" />
              <el-option label="仅警告及以上" value="warning" />
              <el-option label="仅错误" value="error" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSaveConfig('log')">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 通知配置 -->
      <el-card shadow="never" class="settings-card">
        <template #header>
          <span class="card-title">通知配置</span>
        </template>
        <el-form :model="notifConfig" label-width="140px" class="settings-form">
          <el-form-item label="异常告警通知">
            <el-switch v-model="notifConfig.alertNotify" />
            <span class="form-hint">当出现异常告警时发送通知</span>
          </el-form-item>
          <el-form-item label="离线告警通知">
            <el-switch v-model="notifConfig.offlineNotify" />
            <span class="form-hint">当模块离线时发送通知</span>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSaveConfig('notification')">保存</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { systemConfig as seedConfig } from '@/mock/users'

const netConfig = reactive({ ...seedConfig.network })
const logConfig = reactive({ ...seedConfig.log })
const notifConfig = reactive({ ...seedConfig.notification })

const onSaveConfig = (group) => {
  if (group === 'network') Object.assign(seedConfig.network, netConfig)
  if (group === 'log') Object.assign(seedConfig.log, logConfig)
  if (group === 'notification') Object.assign(seedConfig.notification, notifConfig)
  ElMessage.success('配置已保存')
}
</script>

<style scoped lang="scss">
.system-settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-card {
  max-width: 640px;

  :deep(.el-card__header) {
    padding: 12px 20px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}

.card-title {
  font-size: 14px;
  font-weight: 600;
}

.settings-form {
  padding: 4px 0;
}

.form-unit {
  margin-left: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.form-hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
