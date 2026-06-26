import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import { useAuthStore } from '@/stores/auth'

// 导航元信息：short = 左侧图标条单字，title = 顶部菜单 / 页头标题
export const navRoutes = [
  { path: '/', name: 'dashboard', short: '首', title: '联试系统首页', icon: 'Odometer', component: () => import('@/views/Dashboard.vue') },
  { path: '/connection', name: 'connection', short: '连', title: '链路连接管理', icon: 'Connection', component: () => import('@/views/Connection.vue') },
  { path: '/protocol', name: 'protocol', short: '协', title: '接口协议管理', icon: 'Document', component: () => import('@/views/Protocol.vue') },
  { path: '/test-data', name: 'test-data', short: '数', title: '测试数据管理', icon: 'Coin', component: () => import('@/views/TestData.vue') },
  { path: '/task', name: 'task', short: '务', title: '测试任务管理', icon: 'Files', component: () => import('@/views/TestTask.vue') },
  { path: '/execution', name: 'execution', short: '执', title: '测试执行编排', icon: 'VideoPlay', component: () => import('@/views/Execution.vue') },
  { path: '/rule', name: 'rule', short: '则', title: '校验规则管理', icon: 'SetUp', component: () => import('@/views/Rule.vue') },
  { path: '/exception', name: 'exception', short: '异', title: '故障异常管理', icon: 'Warning', component: () => import('@/views/Exception.vue') },
  { path: '/statistics', name: 'statistics', short: '计', title: '统计与可视化', icon: 'TrendCharts', component: () => import('@/views/Statistics.vue') },
  { path: '/knowledge-model', name: 'knowledge-model', short: '知', title: '知识模型管理', icon: 'Collection', component: () => import('@/views/KnowledgeModel.vue') },
  { path: '/report', name: 'report', short: '报', title: '联试报告管理', icon: 'Tickets', component: () => import('@/views/Report.vue') }
]

const router = createRouter({
  // 打包产物用 hash 模式，保证 file:// 双击打开可正常路由；开发仍用 history 模式
  history: import.meta.env.PROD ? createWebHashHistory() : createWebHistory(),
  routes: [
    // 登录页（不在 MainLayout 内，无需认证）
    {
      path: '/login',
      name: 'login',
      meta: { public: true },
      component: () => import('@/views/Login.vue')
    },
    // 需要认证的主界面
    {
      path: '/',
      component: MainLayout,
      children: [
        ...navRoutes.map(({ path, name, title, component }) => ({
          path,
          name,
          meta: { title },
          component
        })),
        // 设置页（所有角色可见）
        {
          path: '/settings',
          name: 'settings',
          meta: { title: '设置' },
          component: () => import('@/views/Settings.vue')
        },
        // 管理员页面
        {
          path: '/admin/users',
          name: 'admin-users',
          meta: { title: '用户管理', role: 'admin', hidden: true },
          component: () => import('@/views/admin/Users.vue')
        },
        {
          path: '/admin/permissions',
          name: 'admin-permissions',
          meta: { title: '权限管理', role: 'admin', hidden: true },
          component: () => import('@/views/admin/Permissions.vue')
        },
        {
          path: '/admin/system-settings',
          name: 'admin-system-settings',
          meta: { title: '系统配置', role: 'admin', hidden: true },
          component: () => import('@/views/SystemSettings.vue')
        }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

/* ========== 路由守卫 ========== */
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // 公开页面（登录页）直接放行
  if (to.meta.public) {
    // 已登录用户访问登录页，跳转到首页
    if (authStore.isLoggedIn) return next('/')
    return next()
  }

  // 未登录 → 重定向到登录页，携带原始路径
  if (!authStore.isLoggedIn) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }

  // 角色权限检查：管理员专属页面
  if (to.meta.role === 'admin' && authStore.currentUser?.role !== 'admin') {
    return next('/')
  }

  next()
})

export default router
