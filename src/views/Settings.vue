<template>
  <div class="page settings-page">
    <!-- ======== 页面头 ======== -->
    <div class="page__header">
      <div>
        <h2>设置</h2>
        <div class="page__desc">个人账号设置{{ isAdmin ? '与系统参数配置' : '' }}</div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <!-- ======== Tab 1：个人设置 ======== -->
      <el-tab-pane label="个人设置" name="profile">
        <div class="settings-section">
          <!-- 基本信息卡片 -->
          <el-card shadow="never" class="settings-card">
            <template #header>
              <span class="card-title">基本信息</span>
            </template>
            <el-form :model="profileForm" label-width="90px" class="settings-form">
              <el-form-item label="用户名">
                <el-input :model-value="authStore.currentUser?.username" disabled>
                  <template #suffix>
                    <el-tag size="small" type="info" effect="plain">不可修改</el-tag>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="角色">
                <el-input disabled>
                  <template #default>
                    <el-tag :type="isAdmin ? '' : 'info'" size="small" effect="plain">
                      {{ isAdmin ? '管理员' : '测试员' }}
                    </el-tag>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item label="姓名">
                <el-input v-model="profileForm.realName" placeholder="显示名称" />
              </el-form-item>
              <el-form-item label="手机号">
                <el-input v-model="profileForm.phone" placeholder="可选" />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input v-model="profileForm.email" placeholder="可选" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="onSaveProfile">保存修改</el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <!-- 修改密码卡片 -->
          <el-card shadow="never" class="settings-card">
            <template #header>
              <span class="card-title">修改密码</span>
            </template>
            <el-form
              ref="pwdFormRef"
              :model="pwdForm"
              :rules="pwdRules"
              label-width="90px"
              class="settings-form"
            >
              <el-form-item label="原密码" prop="oldPwd">
                <el-input v-model="pwdForm.oldPwd" type="password" show-password placeholder="请输入当前密码" />
              </el-form-item>
              <el-form-item label="新密码" prop="newPwd">
                <el-input v-model="pwdForm.newPwd" type="password" show-password placeholder="至少4位" />
                <div class="pwd-strength" v-if="pwdForm.newPwd">
                  <span class="pwd-strength__label">密码强度：</span>
                  <div class="pwd-strength__bar">
                    <div class="pwd-strength__fill" :style="{ width: pwdStrength.percent + '%' }" :class="`pwd-strength--${pwdStrength.level}`" />
                  </div>
                  <span class="pwd-strength__text" :class="`pwd-strength--${pwdStrength.level}`">{{ pwdStrength.text }}</span>
                </div>
              </el-form-item>
              <el-form-item label="确认密码" prop="confirmPwd">
                <el-input v-model="pwdForm.confirmPwd" type="password" show-password placeholder="再次输入新密码" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="onChangePassword">修改密码</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ======== Tab 2：系统配置（仅管理员） ======== -->
      <el-tab-pane v-if="isAdmin" label="系统配置" name="system">
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
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { systemConfig as seedConfig } from '@/mock/users'

const router = useRouter()
const authStore = useAuthStore()

const isAdmin = computed(() => authStore.currentUser?.role === 'admin')
const activeTab = ref('profile')

/* ========== 个人基本信息 ========== */
const profileForm = reactive({
  realName: authStore.currentUser?.realName || '',
  phone: authStore.currentUser?.phone || '',
  email: authStore.currentUser?.email || ''
})

const onSaveProfile = () => {
  authStore.updateProfile({
    realName: profileForm.realName,
    phone: profileForm.phone,
    email: profileForm.email
  })
  ElMessage.success('个人信息已保存')
}

/* ========== 修改密码 ========== */
const pwdFormRef = ref(null)
const pwdForm = reactive({
  oldPwd: '',
  newPwd: '',
  confirmPwd: ''
})

const validatePwdConfirm = (rule, value, callback) => {
  if (value !== pwdForm.newPwd) callback(new Error('两次输入的密码不一致'))
  else callback()
}

const pwdRules = {
  oldPwd: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPwd: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' }
  ],
  confirmPwd: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validatePwdConfirm, trigger: 'blur' }
  ]
}

const pwdStrength = computed(() => {
  const pwd = pwdForm.newPwd
  if (!pwd) return { percent: 0, level: 'none', text: '' }
  let score = 0
  if (pwd.length >= 4) score++
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  if (score <= 1) return { percent: 20, level: 'weak', text: '弱' }
  if (score <= 3) return { percent: 60, level: 'medium', text: '中' }
  return { percent: 100, level: 'strong', text: '强' }
})

const onChangePassword = async () => {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const result = authStore.changePassword(pwdForm.oldPwd, pwdForm.newPwd)
  if (result.ok) {
    ElMessage.success('密码修改成功，请重新登录')
    authStore.logout()
    router.push('/login')
  } else {
    ElMessage.error(result.message)
  }
}

/* ========== 系统配置（管理员） ========== */
const netConfig = reactive({ ...seedConfig.network })
const logConfig = reactive({ ...seedConfig.log })
const notifConfig = reactive({ ...seedConfig.notification })

const onSaveConfig = (group) => {
  // Demo 环境直接保存到 seedConfig（内存中）
  if (group === 'network') Object.assign(seedConfig.network, netConfig)
  if (group === 'log') Object.assign(seedConfig.log, logConfig)
  if (group === 'notification') Object.assign(seedConfig.notification, notifConfig)
  ElMessage.success('配置已保存')
}
</script>

<style scoped lang="scss">
.settings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 0;
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

/* 密码强度条 */
.pwd-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  width: 100%;

  &__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }

  &__bar {
    flex: 1;
    height: 4px;
    background: var(--el-fill-color);
    border-radius: 2px;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s, background 0.3s;
  }

  &__text {
    font-size: 12px;
    font-weight: 500;
    flex-shrink: 0;
    width: 24px;
  }

  &--weak { background: var(--el-color-danger); color: var(--el-color-danger); }
  &--medium { background: var(--el-color-warning); color: var(--el-color-warning); }
  &--strong { background: var(--el-color-success); color: var(--el-color-success); }
}
</style>
