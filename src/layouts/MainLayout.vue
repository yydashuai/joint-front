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
          <el-tooltip content="通知中心">
            <el-badge :value="notificationCount" :hidden="!notificationCount" :max="99" class="topbar__notify">
              <el-button circle size="small" :icon="Bell" @click="notifyDrawerVisible = true" />
            </el-badge>
          </el-tooltip>
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
    <el-drawer v-model="notifyDrawerVisible" title="通知中心" size="420px" @open="activeNotifyTab = 'alert'">
      <div class="notify-panel">
        <el-tabs v-model="activeNotifyTab" class="notify-tabs">
          <el-tab-pane name="alert">
            <template #label>
              <span class="notify-tab-label">异常告警 <b>{{ alertNotificationItems.length }}</b></span>
            </template>
          </el-tab-pane>
          <el-tab-pane name="offline">
            <template #label>
              <span class="notify-tab-label">离线告警 <b>{{ offlineNotificationItems.length }}</b></span>
            </template>
          </el-tab-pane>
        </el-tabs>

        <div v-if="visibleNotificationItems.length" class="notify-list">
          <button
            v-for="item in visibleNotificationItems"
            :key="item.id"
            type="button"
            class="notify-item"
            :class="`notify-item--${item.tone}`"
            @click="jumpNotification(item)"
          >
            <span class="notify-item__dot" />
            <span class="notify-item__main">
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
              <em>{{ item.time }}</em>
            </span>
          </button>
        </div>

        <el-empty v-else :description="notifyEmptyText" :image-size="72" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, Setting, User, Lock, SwitchButton } from '@element-plus/icons-vue'
import SystemManager from '@/components/SystemManager.vue'
import { navRoutes } from '@/router'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'
import { useConnectionStore } from '@/stores/connection'
import { useExceptionStore } from '@/stores/exception'
import { useConfigStore } from '@/stores/config'

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()
const authStore = useAuthStore()
const connStore = useConnectionStore()
const exceptionStore = useExceptionStore()
const configStore = useConfigStore()
const systemManagerVisible = ref(false)
const notifyDrawerVisible = ref(false)
const activeNotifyTab = ref('alert')
const ALL_SYSTEM_KEY = '__all__'

const isActive = (item) => route.path === item.path
const isAdmin = computed(() => authStore.currentUser?.role === 'admin')

/** 用户头像首字母 */
const avatarText = computed(() => {
  const name = authStore.currentUser?.realName || ''
  return name.charAt(name.length - 1) || '?'
})

const currentSystemKey = computed({
  get: () => systemStore.currentId ?? ALL_SYSTEM_KEY,
  set: (id) => systemStore.setCurrent(id === ALL_SYSTEM_KEY ? null : id)
})

const systemName = (id) => systemStore.systems.find((item) => item.id === id)?.name || '未归属系统'
const moduleName = (id) => connStore.nodes.find((item) => item.id === id)?.name || '未归属模块'
const inCurrentScope = (systemId) => systemStore.currentId == null || systemId === systemStore.currentId

const alertNotificationItems = computed(() => {
  if (!configStore.notification.alertNotify) return []
  return exceptionStore.exceptions
    .filter((item) => inCurrentScope(item.systemId))
    .filter((item) => item.state === '待处理')
    .map((item) => ({
      id: `alert-${item.id}`,
      kind: 'alert',
      tone: item.level === '高' ? 'danger' : 'warning',
      title: `${item.level}级 ${item.type}`,
      desc: `${systemName(item.systemId)} / ${moduleName(item.moduleId)} / ${item.iface}`,
      time: item.capturedTime || '待记录',
      target: item,
    }))
})

const offlineNotificationItems = computed(() => {
  if (!configStore.notification.offlineNotify) return []
  return connStore.nodes
    .filter((item) => inCurrentScope(item.systemId))
    .filter((item) => item.status === 'offline')
    .map((item) => ({
      id: `offline-${item.id}`,
      kind: 'offline',
      tone: 'offline',
      title: `${item.name} 链路不通`,
      desc: `${systemName(item.systemId)} / ${item.ip}:${item.port}`,
      time: '自动检测',
      target: item,
    }))
})

const visibleNotificationItems = computed(() =>
  activeNotifyTab.value === 'alert' ? alertNotificationItems.value : offlineNotificationItems.value
)

const notifyEmptyText = computed(() => {
  if (activeNotifyTab.value === 'alert') {
    return configStore.notification.alertNotify ? '当前范围暂无异常告警' : '异常告警通知已关闭'
  }
  return configStore.notification.offlineNotify ? '当前范围暂无离线告警' : '离线告警通知已关闭'
})

const notificationCount = computed(() => alertNotificationItems.value.length + offlineNotificationItems.value.length)

const jumpNotification = (item) => {
  notifyDrawerVisible.value = false
  if (item.kind === 'alert') {
    router.push({ path: '/exception', query: { id: item.target.id } })
    return
  }
  systemStore.setCurrent(item.target.systemId || null)
  router.push('/connection')
}

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
  &__notify {
    :deep(.el-badge__content) {
      font-size: 10px;
      height: 16px;
      min-width: 16px;
      line-height: 16px;
    }
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

.notify-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.notify-tabs {
  flex-shrink: 0;
  :deep(.el-tabs__header) {
    margin: 0;
  }
  :deep(.el-tabs__content) {
    display: none;
  }
}
.notify-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.notify-tab-label b {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.notify-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.notify-item {
  width: 100%;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr);
  gap: 10px;
  padding: 11px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  text-align: left;
  transition: border-color .16s, background .16s;
}
.notify-item:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-extra-light);
}
.notify-item__dot {
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--el-color-warning);
}
.notify-item--danger .notify-item__dot { background: var(--el-color-danger); }
.notify-item--offline .notify-item__dot { background: var(--el-text-color-placeholder); }
.notify-item__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.notify-item__main strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}
.notify-item__main span {
  overflow: hidden;
  color: var(--el-text-color-regular);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notify-item__main em {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-style: normal;
}
</style>
