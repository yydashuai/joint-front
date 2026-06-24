import { defineStore } from 'pinia'
import { users as seedUsers, permissions as seedPermissions, nextUserId } from '@/mock/users'

const STORAGE_KEY = 'jt_auth'

/** 从 storage 恢复登录态 */
const restoreSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** 持久化登录态 */
const saveSession = (user, remember) => {
  const data = JSON.stringify({ userId: user.id, remember })
  if (remember) {
    localStorage.setItem(STORAGE_KEY, data)
    sessionStorage.removeItem(STORAGE_KEY)
  } else {
    sessionStorage.setItem(STORAGE_KEY, data)
    localStorage.removeItem(STORAGE_KEY)
  }
}

/** 清除登录态 */
const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    users: JSON.parse(JSON.stringify(seedUsers)),
    permissions: JSON.parse(JSON.stringify(seedPermissions)),
    currentUser: null
  }),

  getters: {
    isLoggedIn: (state) => !!state.currentUser,

    /** 获取指定用户被授权的系统 ID 列表 */
    getSystemIds: (state) => (userId) => {
      const perm = state.permissions.find(p => p.userId === userId)
      return perm ? [...perm.systemIds] : []
    },

    /** 获取所有管理员用户 */
    adminUsers: (state) => state.users.filter(u => u.role === 'admin'),

    /** 获取所有测试员用户 */
    testerUsers: (state) => state.users.filter(u => u.role === 'tester')
  },

  actions: {
    /** 初始化：尝试从 storage 恢复登录态 */
    init() {
      const session = restoreSession()
      if (session) {
        const user = this.users.find(u => u.id === session.userId)
        if (user && user.status === 'active') {
          this.currentUser = { ...user }
        }
      }
    },

    /** 登录 */
    login(username, password, remember = false) {
      const user = this.users.find(u => u.username === username)
      if (!user) return { ok: false, message: '用户名或密码错误' }
      if (user.password !== password) return { ok: false, message: '用户名或密码错误' }
      if (user.status === 'disabled') return { ok: false, message: '该账号已被禁用，请联系管理员' }

      // 更新最后登录时间
      const now = new Date()
      user.lastLogin = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      this.currentUser = { ...user }
      saveSession(user, remember)
      return { ok: true }
    },

    /** 退出登录 */
    logout() {
      this.currentUser = null
      clearSession()
    },

    /** 修改密码 */
    changePassword(oldPassword, newPassword) {
      if (!this.currentUser) return { ok: false, message: '未登录' }
      const user = this.users.find(u => u.id === this.currentUser.id)
      if (!user) return { ok: false, message: '用户不存在' }
      if (user.password !== oldPassword) return { ok: false, message: '原密码错误' }
      user.password = newPassword
      this.currentUser = { ...user }
      return { ok: true }
    },

    /** 更新个人信息 */
    updateProfile(patch) {
      if (!this.currentUser) return
      const user = this.users.find(u => u.id === this.currentUser.id)
      if (user) {
        Object.assign(user, patch)
        this.currentUser = { ...user }
      }
    },

    /* ========== 用户管理（管理员操作） ========== */

    addUser(data) {
      const exists = this.users.find(u => u.username === data.username)
      if (exists) return { ok: false, message: '用户名已存在' }

      const user = {
        id: nextUserId(),
        username: data.username,
        password: data.password,
        realName: data.realName || '',
        role: data.role || 'tester',
        phone: data.phone || '',
        email: data.email || '',
        avatar: '',
        status: 'active',
        lastLogin: '',
        createdAt: new Date().toISOString().slice(0, 10)
      }
      this.users.push(user)

      // 如果是测试员且有分配系统，创建权限记录
      if (user.role === 'tester' && data.systemIds?.length) {
        this.permissions.push({ userId: user.id, systemIds: [...data.systemIds] })
      }

      return { ok: true, user }
    },

    updateUser(id, patch) {
      const user = this.users.find(u => u.id === id)
      if (!user) return { ok: false, message: '用户不存在' }

      // 用户名唯一性检查
      if (patch.username && patch.username !== user.username) {
        const exists = this.users.find(u => u.username === patch.username)
        if (exists) return { ok: false, message: '用户名已存在' }
      }

      Object.assign(user, patch)

      // 如果角色从 tester 变为 admin，删除其权限记录
      if (patch.role === 'admin') {
        const idx = this.permissions.findIndex(p => p.userId === id)
        if (idx >= 0) this.permissions.splice(idx, 1)
      }

      return { ok: true }
    },

    removeUser(id) {
      if (id === this.currentUser?.id) return { ok: false, message: '不能删除自己' }
      const idx = this.users.findIndex(u => u.id === id)
      if (idx < 0) return { ok: false, message: '用户不存在' }
      this.users.splice(idx, 1)
      // 清除权限记录
      const pIdx = this.permissions.findIndex(p => p.userId === id)
      if (pIdx >= 0) this.permissions.splice(pIdx, 1)
      return { ok: true }
    },

    resetPassword(id, newPassword) {
      const user = this.users.find(u => u.id === id)
      if (!user) return { ok: false, message: '用户不存在' }
      user.password = newPassword
      return { ok: true }
    },

    toggleStatus(id) {
      const user = this.users.find(u => u.id === id)
      if (!user) return
      user.status = user.status === 'active' ? 'disabled' : 'active'
    },

    /* ========== 权限管理 ========== */

    setPermission(userId, systemIds) {
      const perm = this.permissions.find(p => p.userId === userId)
      if (perm) {
        perm.systemIds = [...systemIds]
      } else {
        this.permissions.push({ userId, systemIds: [...systemIds] })
      }
    },

    getPermission(userId) {
      const perm = this.permissions.find(p => p.userId === userId)
      return perm ? [...perm.systemIds] : []
    }
  }
})
