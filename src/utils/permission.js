/**
 * 权限判断工具函数
 * 集中管理权限逻辑，避免散落在各组件中
 */

import { useAuthStore } from '@/stores/auth'

/**
 * 判断当前用户是否为管理员
 */
export const isAdmin = () => {
  const auth = useAuthStore()
  return auth.currentUser?.role === 'admin'
}

/**
 * 获取当前用户可见的系统 ID 列表
 * - admin 返回 null（表示全部可见）
 * - tester 返回被授权的 systemId 数组
 */
export const getVisibleSystemIds = () => {
  const auth = useAuthStore()
  const user = auth.currentUser
  if (!user) return []
  if (user.role === 'admin') return null
  return auth.getSystemIds(user.id)
}

/**
 * 判断当前用户是否有权访问指定系统
 */
export const canAccessSystem = (systemId) => {
  const ids = getVisibleSystemIds()
  if (ids === null) return true
  return ids.includes(systemId)
}
