import { defineStore } from 'pinia'
import { makeUniqueName } from '@/utils/entityName'
import { testInterfaces as seedTestInterfaces } from '@/mock/seed-data'

let seq = 5003
const uid = () => `scheme-${++seq}`
const demoInterfaceIds = ['查询设备状态接口', '武器装订指令接口']
  .map((name) => seedTestInterfaces.find((iface) => iface.name === name)?.id)
  .filter(Boolean)

export const usePlanSchemeStore = defineStore('planScheme', {
  state: () => ({
    schemes: [
      {
        id: 'scheme-5002',
        name: '武器联试综合方案',
        systemId: 'sys-weapon',
        interfaceIds: demoInterfaceIds,
        remark: '演示用接口方案（含 2 个武器管理接口）',
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
      return (systemId, type) => state.schemes.filter((s) => (!s.systemId || s.systemId === systemId) && (!type || s.type === type))
    },
  },

  actions: {
    select(id) {
      this.selectedId = id
    },

    removeLegacyDefaults() {
      const legacyIds = new Set(['scheme-5001', 'scheme-5003'])
      const legacyNames = new Set(['默认接口方案', '默认监听方案'])
      const removedSelected = this.schemes.some((scheme) =>
        scheme.id === this.selectedId &&
        (legacyIds.has(String(scheme.id)) || legacyNames.has(String(scheme.name).trim()))
      )
      this.schemes = this.schemes.filter((scheme) =>
        !legacyIds.has(String(scheme.id)) &&
        !legacyNames.has(String(scheme.name).trim())
      )
      const demoScheme = this.schemes.find((scheme) => scheme.id === 'scheme-5002')
      if (demoScheme && demoInterfaceIds.length === 2) {
        demoScheme.interfaceIds = [...demoInterfaceIds]
        demoScheme.remark = '演示用接口方案（含 2 个武器管理接口）'
      }
      if (removedSelected) this.selectedId = null
    },

    add({ name, systemId, interfaceIds, remark }) {
      const scheme = {
        id: uid(),
        name: makeUniqueName(this.schemes, name || '新建接口方案'),
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
      if (scheme) {
        const next = { ...patch }
        if (Object.prototype.hasOwnProperty.call(next, 'name')) {
          next.name = makeUniqueName(this.schemes, next.name, scheme)
        }
        Object.assign(scheme, next)
      }
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
