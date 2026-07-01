<template>
  <div class="app-shell">
    <!-- 左侧图标导航条（草图：首 连 协 数 务 执 则 异 计 报） -->
    <aside class="rail">
      <div class="rail__logo">联试</div>
      <nav class="rail__nav">
        <el-tooltip
          v-for="item in navRoutes"
          :key="item.name"
          :content="item.title"
          placement="right"
        >
          <router-link
            :to="item.path"
            class="rail__item"
            :class="{ 'is-active': isActive(item) }"
          >
            <span class="rail__label">{{ item.short }}</span>
          </router-link>
        </el-tooltip>
      </nav>
      <div v-if="isAdmin" class="rail__admin">
        <el-tooltip content="系统配置" placement="right">
          <router-link
            to="/admin/system-settings"
            class="rail__item rail__item--icon rail__item--admin"
            :class="{ 'is-active': route.path === '/admin/system-settings' }"
          >
            <el-icon><Setting /></el-icon>
          </router-link>
        </el-tooltip>
      </div>
    </aside>

    <div class="app-main">
      <!-- 顶部菜单栏 -->
      <header class="topbar">
        <div class="topbar__brand">
          <span class="topbar__logo">●</span>
          <span class="topbar__name">便携式智能联试工具</span>
        </div>
        <div class="topbar__system">
          <span class="topbar__system-label">被测系统：</span>
          <el-select v-model="currentSystemKey" class="topbar__system-select" size="small">
            <el-option
              v-for="option in systemStore.options"
              :key="option.value ?? 'all'"
              :label="option.label"
              :value="option.value ?? ALL_SYSTEM_KEY"
            />
          </el-select>
          <el-button v-if="isAdmin" :icon="Setting" size="small" @click="systemManagerVisible = true">管理</el-button>
        </div>
        <el-menu
          class="topbar__menu"
          mode="horizontal"
          :ellipsis="true"
          :default-active="$route.path"
          router
        >
          <el-menu-item v-for="item in navRoutes" :key="item.name" :index="item.path">
            {{ item.title }}
          </el-menu-item>
        </el-menu>
        <div class="topbar__user">
          <el-tag size="small" type="success" effect="plain">在线</el-tag>
          <el-dropdown @command="onUserCommand">
            <span class="topbar__avatar">
              <span class="topbar__avatar-circle">{{ avatarText }}</span>
              {{ authStore.currentUser?.realName || '未知' }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="settings" :icon="Setting">个人设置</el-dropdown-item>
                <template v-if="isAdmin">
                  <el-dropdown-item divided command="admin-users" :icon="User">用户管理</el-dropdown-item>
                  <el-dropdown-item command="admin-permissions" :icon="Lock">权限管理</el-dropdown-item>
                </template>
                <el-dropdown-item divided command="logout" :icon="SwitchButton">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 工作区 -->
      <main class="workspace">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>

    <SystemManager v-model="systemManagerVisible" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Setting, User, Lock, SwitchButton } from '@element-plus/icons-vue'
import SystemManager from '@/components/SystemManager.vue'
import { navRoutes } from '@/router'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()
const authStore = useAuthStore()
const systemManagerVisible = ref(false)
const ALL_SYSTEM_KEY = '__all__'

const isActive = (item) => route.path === item.path
const isAdmin = computed(() => authStore.currentUser?.role === 'admin')

/** 用户头像首字符（取姓名第一个字，与国内多数 OA 习惯一致） */
const avatarText = computed(() => {
  const name = authStore.currentUser?.realName || ''
  return name.charAt(0) || '?'
})

const currentSystemKey = computed({
  get: () => systemStore.currentId ?? ALL_SYSTEM_KEY,
  set: (id) => systemStore.setCurrent(id === ALL_SYSTEM_KEY ? null : id)
})

/** 用户下拉菜单命令处理 */
const onUserCommand = (cmd) => {
  switch (cmd) {
    case 'settings':
      router.push('/settings')
      break
    case 'admin-users':
      router.push('/admin/users')
      break
    case 'admin-permissions':
      router.push('/admin/permissions')
      break
    case 'logout':
      authStore.logout()
      router.push('/login')
      break
  }
}
</script>

<style scoped lang="scss">
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* 左侧图标条 */
.rail {
  width: 64px;
  flex-shrink: 0;
  background: var(--jt-rail-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12px;

  &__logo {
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 1px;
    margin-bottom: 16px;
    writing-mode: vertical-rl;
  }

  &__nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    align-items: center;
  }

  &__admin {
    margin-top: auto;
    width: 100%;
    padding: 8px 0 12px;
    display: flex;
    justify-content: center;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__item {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--jt-rail-fg);
    text-decoration: none;
    transition: all 0.18s;

    &:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
    &.is-active { background: var(--el-color-primary); color: #fff; }
  }

  &__label { font-size: 16px; font-weight: 600; line-height: 1; }
  &__item--icon {
    font-size: 20px;
  }

  &__item--admin {
    &:hover,
    &.is-active {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }
  }
}

/* 主区 */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: var(--jt-topbar-bg);
  border-bottom: 1px solid var(--el-border-color-light);

  &__brand { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  &__logo { color: var(--el-color-primary); font-size: 18px; }
  &__name { font-weight: 600; font-size: 15px; white-space: nowrap; }
  &__system {
    width: 326px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
    background: var(--el-fill-color-blank);
  }
  &__system-label {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
  &__system-select { width: 190px; }
  &__menu {
    flex: 1;
    min-width: 0;
    border-bottom: none !important;
    overflow: hidden;
  }
  &__user { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  &__avatar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 14px;
  }
  &__avatar-circle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--el-color-primary);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
  }
}

.workspace {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: var(--jt-workspace-bg);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
