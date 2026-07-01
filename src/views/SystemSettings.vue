<template>
  <div class="page system-settings-page">
    <!-- ======== 页面头 ======== -->
    <div class="page__header">
      <div>
        <h2>系统配置</h2>
        <div class="page__desc">系统参数、模型服务与知识向量化等管理员配置</div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="系统参数" name="system">
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
                <el-tooltip content="保存网络配置参数"><el-button type="primary" @click="onSaveConfig('network')">保存</el-button></el-tooltip>
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
                <el-tooltip content="保存日志配置参数"><el-button type="primary" @click="onSaveConfig('log')">保存</el-button></el-tooltip>
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
                <el-tooltip content="保存通知配置参数"><el-button type="primary" @click="onSaveConfig('notification')">保存</el-button></el-tooltip>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="模型配置" name="model">
        <ModelConfig />
      </el-tab-pane>

      <el-tab-pane label="异常设置" name="exception">
        <div class="settings-section">
          <el-card shadow="never" class="settings-card">
            <template #header>
              <span class="card-title">达标率指标</span>
            </template>
            <el-form :model="exceptionConfig" label-width="150px" class="settings-form">
              <el-form-item label="异常达标率目标">
                <el-input-number v-model="exceptionConfig.targetSlaRate" :min="0" :max="100" :step="1" />
                <span class="form-unit">%</span>
              </el-form-item>
              <el-form-item label="高级别 SLA">
                <el-input-number v-model="exceptionConfig.highSlaHours" :min="1" :max="168" />
                <span class="form-unit">h</span>
              </el-form-item>
              <el-form-item label="中级别 SLA">
                <el-input-number v-model="exceptionConfig.mediumSlaHours" :min="1" :max="168" />
                <span class="form-unit">h</span>
              </el-form-item>
              <el-form-item label="低级别 SLA">
                <el-input-number v-model="exceptionConfig.lowSlaHours" :min="1" :max="168" />
                <span class="form-unit">h</span>
              </el-form-item>
              <el-form-item label="临期提醒提前量">
                <el-input-number v-model="exceptionConfig.warningLeadHours" :min="0" :max="72" />
                <span class="form-unit">h</span>
              </el-form-item>
              <el-form-item>
                <el-tooltip content="保存异常达标率配置"><el-button type="primary" @click="onSaveConfig('exception')">保存</el-button></el-tooltip>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ModelConfig from '@/components/report/ModelConfig.vue'
import { useExceptionStore } from '@/stores/exception'
import { useConfigStore } from '@/stores/config'

const activeTab = ref('system')
const exceptionStore = useExceptionStore()
const configStore = useConfigStore()
const netConfig = reactive({ ...configStore.network })
const logConfig = reactive({ ...configStore.log })
const notifConfig = reactive(configStore.notification)
const exceptionConfig = reactive({ ...exceptionStore.settings })

const onSaveConfig = (group) => {
  if (group === 'network') configStore.saveGroup('network', netConfig)
  if (group === 'log') configStore.saveGroup('log', logConfig)
  if (group === 'notification') configStore.saveGroup('notification', notifConfig)
  if (group === 'exception') exceptionStore.updateExceptionSettings(exceptionConfig)
  ElMessage.success('配置已保存')
}
</script>

<style scoped lang="scss">
.system-settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.settings-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
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
