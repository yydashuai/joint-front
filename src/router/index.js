import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

// 导航元信息：short = 左侧图标条单字，title = 顶部菜单 / 页头标题
export const navRoutes = [
  { path: '/', name: 'dashboard', short: '首', title: '系统首页', icon: 'Odometer', component: () => import('@/views/Dashboard.vue') },
  { path: '/connection', name: 'connection', short: '连', title: '链路连接管理', icon: 'Connection', component: () => import('@/views/Connection.vue') },
  { path: '/protocol', name: 'protocol', short: '协', title: '接口协议管理', icon: 'Document', component: () => import('@/views/Protocol.vue') },
  { path: '/test-data', name: 'test-data', short: '数', title: '测试数据管理', icon: 'Coin', component: () => import('@/views/TestData.vue') },
  { path: '/task', name: 'task', short: '务', title: '测试任务管理', icon: 'Files', component: () => import('@/views/TestTask.vue') },
  { path: '/execution', name: 'execution', short: '执', title: '测试执行编排', icon: 'VideoPlay', component: () => import('@/views/Execution.vue') },
  { path: '/rule', name: 'rule', short: '则', title: '规则管理', icon: 'SetUp', component: () => import('@/views/Rule.vue') },
  { path: '/exception', name: 'exception', short: '异', title: '异常管理', icon: 'Warning', component: () => import('@/views/Exception.vue') },
  { path: '/statistics', name: 'statistics', short: '计', title: '统计与可视化', icon: 'TrendCharts', component: () => import('@/views/Statistics.vue') },
  { path: '/report', name: 'report', short: '报', title: '联试报告管理', icon: 'Tickets', component: () => import('@/views/Report.vue') }
]

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: navRoutes.map(({ path, name, title, component }) => ({
        path,
        name,
        meta: { title },
        component
      }))
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

export default router
