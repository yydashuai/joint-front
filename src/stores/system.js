import { defineStore } from 'pinia'
import { systems as seedSystems } from '@/mock/seed-data'

let seq = 100

export const useSystemStore = defineStore('system', {
  state: () => ({
    systems: JSON.parse(JSON.stringify(seedSystems)),
    currentId: null
  }),

  getters: {
    current: (state) => state.systems.find((system) => system.id === state.currentId) || null,
    isAll: (state) => state.currentId === null,
    options: (state) => [
      { label: '全部系统（总体）', value: null },
      ...state.systems.map((system) => ({ label: system.name, value: system.id }))
    ]
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
