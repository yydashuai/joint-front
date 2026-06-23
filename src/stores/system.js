import { defineStore } from 'pinia'

let seq = 2

export const useSystemStore = defineStore('system', {
  state: () => ({
    systems: [
      {
        id: 'sys-weapon',
        name: '综合武器管理系统',
        desc: '覆盖武器挂载、状态监测与装控指令接口的被测系统',
        owner: '装备联试组'
      },
      {
        id: 'sys-fire-control',
        name: '火控指挥联试系统',
        desc: '覆盖目标分配、火控解算与指挥链路接口的被测系统',
        owner: '火控联试组'
      }
    ],
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
