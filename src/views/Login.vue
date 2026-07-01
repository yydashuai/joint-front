<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <div class="login-brand">
      <div class="login-brand__content">
        <div class="login-brand__icon">
          <img src="/favicon.svg" alt="便携式智能联试工具" />
        </div>
        <h1 class="login-brand__title">便携式智能联试工具</h1>
        <p class="login-brand__desc">
          多系统联合测试 · 链路监控 · 协议管理 · 智能诊断
        </p>
        <div class="login-brand__features">
          <div class="login-brand__feat">
            <span class="feat-dot" />实时链路状态监控
          </div>
          <div class="login-brand__feat">
            <span class="feat-dot" />接口协议可视化管理
          </div>
          <div class="login-brand__feat">
            <span class="feat-dot" />测试任务全流程追踪
          </div>
        </div>
      </div>
      <div class="login-brand__footer">
        v3.0 Demo &middot; 装备联试技术中心
      </div>
    </div>

    <!-- 右侧登录表单 -->
    <div class="login-form-wrap">
      <div class="login-form-card">
        <h2 class="login-form-card__title">用户登录</h2>
        <p class="login-form-card__subtitle">Portable Joint Test Tool</p>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          @keyup.enter="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="User"
              clearable
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              show-password
              clearable
            />
          </el-form-item>

          <el-form-item>
            <div class="login-options">
              <el-checkbox v-model="form.remember">记住我</el-checkbox>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              class="login-btn"
              @click="handleLogin"
            >
              {{ loading ? '登录中...' : '登 录' }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-demo">
          <div class="login-demo__title">
            <el-icon><Avatar /></el-icon>
            <span>演示账号（点击自动填充）</span>
          </div>
          <div class="login-demo__list">
            <div
              v-for="acc in demoAccounts"
              :key="acc.username"
              class="login-demo__item"
              :class="{ 'is-disabled': acc.disabled }"
              :title="acc.disabled ? '该账号已被禁用' : `使用 ${acc.realName} 登录`"
              @click="acc.disabled ? null : fillDemo(acc)"
            >
              <div class="login-demo__role" :class="`is-${acc.role}`">
                {{ acc.roleLabel }}
              </div>
              <div class="login-demo__info">
                <div class="login-demo__name">{{ acc.realName }}</div>
                <div class="login-demo__cred">
                  {{ acc.username }} / {{ acc.password }}
                </div>
              </div>
              <el-icon v-if="acc.disabled" class="login-demo__lock"><Lock /></el-icon>
            </div>
          </div>
        </div>

        <div class="login-hint">
          <el-icon><InfoFilled /></el-icon>
          如需账号请联系系统管理员
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { User, Lock, InfoFilled, Avatar } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  remember: false
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const demoAccounts = [
  { username: 'admin',    password: 'admin123', realName: '张管理', role: 'admin',  roleLabel: '管理员', disabled: false },
  { username: 'tester01', password: 'test123',  realName: '李测试', role: 'tester', roleLabel: '测试员', disabled: false },
  { username: 'tester02', password: 'test123',  realName: '王测试', role: 'tester', roleLabel: '测试员', disabled: true  },
  { username: 'tester03', password: 'test123',  realName: '赵联试', role: 'tester', roleLabel: '测试员', disabled: false }
]

const fillDemo = (acc) => {
  form.username = acc.username
  form.password = acc.password
  form.remember = true
  ElMessage.info(`已填入 ${acc.realName} 的账号，点击登录`)
}

const handleLogin = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  // 模拟网络延迟，提升真实感
  await new Promise(r => setTimeout(r, 500))

  const result = authStore.login(form.username, form.password, form.remember)
  loading.value = false

  if (result.ok) {
    ElMessage.success(`欢迎回来，${authStore.currentUser.realName}`)
    const redirect = route.query.redirect || '/'
    router.push(redirect)
  } else {
    ElMessage.error(result.message)
  }
}
</script>

<style scoped lang="scss">
.login-page {
  display: flex;
  height: 100vh;
  background: #fff;
}

/* ============ 左侧品牌区 ============ */
.login-brand {
  width: 46%;
  flex-shrink: 0;
  background:
    radial-gradient(circle at 24% 28%, rgba(47, 111, 235, 0.32), transparent 30%),
    radial-gradient(circle at 80% 50%, rgba(84, 132, 226, 0.2), transparent 34%),
    linear-gradient(rgba(218, 232, 252, 0.075) 1px, transparent 1px),
    linear-gradient(90deg, rgba(218, 232, 252, 0.075) 1px, transparent 1px),
    linear-gradient(135deg, #1f2933 0%, #1a345f 48%, #153da0 100%);
  background-size: auto, auto, 42px 42px, 42px 42px, auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: 48px;

  /* 军事态势屏背景：雷达环 + 坐标扫描线 */
  &::before {
    content: '';
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    background:
      conic-gradient(from 230deg, rgba(47, 111, 235, 0), rgba(47, 111, 235, 0.26), rgba(47, 111, 235, 0) 28%),
      radial-gradient(circle, transparent 0 20%, rgba(218, 232, 252, 0.18) 20.2% 20.6%, transparent 21% 39%, rgba(218, 232, 252, 0.14) 39.2% 39.6%, transparent 40% 58%, rgba(218, 232, 252, 0.12) 58.2% 58.6%, transparent 59%);
    top: -110px;
    right: -130px;
    opacity: 0.95;
  }
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(140deg, transparent 0 18%, rgba(218, 232, 252, 0.12) 18.2% 18.6%, transparent 18.8% 34%, rgba(218, 232, 252, 0.08) 34.2% 34.6%, transparent 34.8%),
      linear-gradient(28deg, transparent 0 52%, rgba(47, 111, 235, 0.18) 52.2% 52.6%, transparent 52.8%),
      linear-gradient(180deg, rgba(31, 41, 51, 0) 0%, rgba(31, 41, 51, 0.42) 100%);
    opacity: 0.9;
  }

  &__content {
    position: relative;
    z-index: 1;
    text-align: center;
  }

  &__icon {
    margin-bottom: 24px;

    img {
      display: block;
      width: 56px;
      height: 56px;
      margin: 0 auto;
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(10, 26, 62, 0.32);
    }
  }

  &__title {
    color: #fff;
    font-size: 28px;
    font-weight: 700;
    margin: 0 0 12px;
    letter-spacing: 1px;
  }

  &__desc {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    margin: 0 0 36px;
    letter-spacing: 2px;
  }

  &__features {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: flex-start;
    margin: 0 auto;
    width: fit-content;
  }

  &__feat {
    color: rgba(255, 255, 255, 0.85);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__footer {
    position: absolute;
    bottom: 24px;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
    z-index: 1;
  }
}

.feat-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(218, 232, 252, 0.78);
  box-shadow: 0 0 10px rgba(47, 111, 235, 0.8);
  flex-shrink: 0;
}

/* ============ 右侧登录表单 ============ */
.login-form-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.login-form-card {
  width: 380px;

  &__title {
    font-size: 24px;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--el-text-color-primary);
  }

  &__subtitle {
    font-size: 13px;
    color: var(--el-text-color-placeholder);
    margin: 0 0 36px;
    letter-spacing: 1px;
  }
}

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  letter-spacing: 4px;
}

.login-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 24px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* ============ 演示账号 ============ */
.login-demo {
  margin-top: 20px;
  padding: 14px 14px 12px;
  border: 1px dashed var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);

  &__title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 10px;

    .el-icon {
      font-size: 14px;
    }
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--el-bg-color);
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    border: 1px solid transparent;

    &:hover:not(.is-disabled) {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
    }

    &.is-disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
  }

  &__role {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: #fff;

    &.is-admin {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      box-shadow: 0 2px 6px rgba(217, 119, 6, 0.3);
    }

    &.is-tester {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    line-height: 1.3;
  }

  &__cred {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    line-height: 1.3;
    margin-top: 2px;
  }

  &__lock {
    color: var(--el-text-color-placeholder);
    font-size: 14px;
  }
}
</style>
