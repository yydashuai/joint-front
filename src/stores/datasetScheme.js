import { defineStore } from 'pinia'

let seq = 6000
const uid = () => `dsScheme-${++seq}`

/**
 * 数据集方案 store —— 与接口方案（planScheme）同级，
 * 用于把多个「数据集」组织成一个可复用方案，方案下管理多个数据集。
 */
export const useDatasetSchemeStore = defineStore('datasetScheme', {
  state: () => ({
    schemes: [
      {
        id: 'dsScheme-6001',
        name: '默认数据集方案',
        systemId: null,
        datasetIds: [],
        remark: '系统预置数据集方案',
        createdAt: '2026-07-01 09:00:00',
      },
      {
        id: 'dsScheme-6002',
        name: '武器状态数据集方案',
        systemId: 'sys-weapon',
        datasetIds: [],
        remark: '演示用数据集方案（含 3 个武器管理数据集）',
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

    add({ name, systemId, datasetIds, remark }) {
      const scheme = {
        id: uid(),
        name: name || '新建数据集方案',
        systemId: systemId || null,
        datasetIds: datasetIds || [],
        remark: remark || '',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      }
      this.schemes.push(scheme)
      this.selectedId = scheme.id
      return scheme
    },

    update(id, patch) {
      const scheme = this.schemes.find((s) => s.id === id)
      if (scheme) Object.assign(scheme, patch)
    },

    remove(id) {
      const idx = this.schemes.findIndex((s) => s.id === id)
      if (idx < 0) return
      this.schemes.splice(idx, 1)
      if (this.selectedId === id) this.selectedId = this.schemes[0]?.id || null
    },

    /** 向方案追加数据集（去重） */
    addDatasets(schemeId, datasetIds) {
      const scheme = this.schemes.find((s) => s.id === schemeId)
      if (!scheme) return
      const existing = new Set(scheme.datasetIds)
      datasetIds.forEach((id) => existing.add(id))
      scheme.datasetIds = [...existing]
    },

    /** 从方案移除某个数据集 */
    removeDataset(schemeId, datasetId) {
      const scheme = this.schemes.find((s) => s.id === schemeId)
      if (!scheme) return
      scheme.datasetIds = scheme.datasetIds.filter((id) => id !== datasetId)
    },
  },
})
