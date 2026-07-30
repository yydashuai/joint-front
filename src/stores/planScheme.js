import { defineStore } from 'pinia'

let seq = 5000
const uid = () => `scheme-${++seq}`

export const usePlanSchemeStore = defineStore('planScheme', {
  state: () => ({
    schemes: [
      {
        id: 'scheme-5001',
        name: '默认接口方案',
        systemId: null,
        interfaceIds: [],
        remark: '系统预置接口方案',
        createdAt: '2026-07-01 09:00:00',
      },
      {
        id: 'scheme-5002',
        name: '武器联试综合方案',
        systemId: 'sys-weapon',
        interfaceIds: [],
        remark: '演示用接口方案（含 3 个武器管理接口）',
        createdAt: '2026-07-30 09:00:00',
      },
    ],
    selectedId: null,
  }),

  getters: {
    selected(state) {
      return state.schemes.find((s) => s.id === state.selectedId) || null
    },
    schemesOfSystem(state) {
      return (systemId) => state.schemes.filter((s) => !s.systemId || s.systemId === systemId)
    },
  },

  actions: {
    select(id) {
      this.selectedId = id
    },

    add({ name, systemId, interfaceIds, remark }) {
      const scheme = {
        id: uid(),
        name: name || '新建接口方案',
        systemId: systemId || null,
        interfaceIds: interfaceIds || [],
        remark: remark || '',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      }
      this.schemes.push(scheme)
      this.selectedId = scheme.id
      return scheme
    },

    remove(id) {
      const idx = this.schemes.findIndex((s) => s.id === id)
      if (idx >= 0) this.schemes.splice(idx, 1)
      if (this.selectedId === id) this.selectedId = this.schemes[0]?.id || null
    },

    update(id, patch) {
      const scheme = this.schemes.find((s) => s.id === id)
      if (scheme) Object.assign(scheme, patch)
    },

    addInterfaces(schemeId, interfaceIds) {
      const scheme = this.schemes.find((s) => s.id === schemeId)
      if (!scheme) return
      const existing = new Set(scheme.interfaceIds)
      interfaceIds.forEach((id) => existing.add(id))
      scheme.interfaceIds = [...existing]
    },

    removeInterface(schemeId, interfaceId) {
      const scheme = this.schemes.find((s) => s.id === schemeId)
      if (!scheme) return
      scheme.interfaceIds = scheme.interfaceIds.filter((id) => id !== interfaceId)
    },
  },
})
