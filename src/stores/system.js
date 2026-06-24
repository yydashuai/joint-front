import { defineStore } from 'pinia'
import { systems as seedSystems } from '@/mock/seed-data'
import { useAuthStore } from '@/stores/auth'

let seq = 100

export const useSystemStore = defineStore('system', {
  state: () => ({
    systems: JSON.parse(JSON.stringify(seedSystems)),
    currentId: null
  }),

  getters: {
    current: (state) => state.systems.find((system) => system.id === state.currentId) || null,
    isAll: (state) => state.currentId === null,

    /** 当前用户可见的系统列表（admin 看全部，tester 看授权列表） */
    visibleSystems(state) {
      const auth = useAuthStore()
      if (!auth.currentUser) return state.systems
      if (auth.currentUser.role === 'admin') return state.systems
      const allowed = auth.getSystemIds(auth.currentUser.id)
      return state.systems.filter(s => allowed.includes(s.id))
    },

    /** 下拉选项（受权限过滤） */
    options(state) {
      const visible = this.visibleSystems
      return [
        { label: `全部系统（${visible.length}）`, value: null },
        ...visible.map((system) => ({ label: system.name, value: system.id }))
      ]
    }
  },

  actions: {
    setCurrent(id) {
      this.currentId = id ?? null
    },
    add(system) {
      const next = {
        id: system.id || `sys-${++seq}`,
        name: '',
        desc: '',
        owner: '',
        ...system
      }
      this.systems.push(next)
      return next
    },
    update(id, patch) {
      const system = this.systems.find((item) => item.id === id)
      if (!system) return
      Object.assign(system, patch)
    },
    remove(id) {
      const index = this.systems.findIndex((item) => item.id === id)
      if (index < 0) return
      this.systems.splice(index, 1)
      if (this.currentId === id) this.currentId = null
    }
  }
})
