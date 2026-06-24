<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <div class="login-brand">
      <div class="login-brand__content">
        <div class="login-brand__icon">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none">
            <rect width="64" height="64" rx="14" fill="rgba(255,255,255,0.15)" />
            <path d="M20 32h24M32 20v24" stroke="#fff" stroke-width="3" stroke-linecap="round" />
            <circle cx="32" cy="32" r="18" stroke="rgba(255,255,255,0.4)" stroke-width="2" fill="none" />
          </svg>
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
import { User, Lock, InfoFilled } from '@element-plus/icons-vue'
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
  background: linear-gradient(135deg, #2f6feb 0%, #1a4fc4 60%, #153da0 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
  padding: 48px;

  /* 装饰性几何背景 */
  &::before {
    content: '';
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    top: -120px;
    right: -100px;
  }
  &::after {
    content: '';
    position: absolute;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.03);
    bottom: -60px;
    left: -40px;
  }

  &__content {
    position: relative;
    z-index: 1;
    text-align: center;
  }

  &__icon {
    margin-bottom: 24px;
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
  background: rgba(255, 255, 255, 0.6);
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
</style>
