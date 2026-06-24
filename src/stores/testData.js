import { defineStore } from 'pinia'
import { datasets as seedDatasets, files as seedFiles } from '@/mock/testData'

let _dsSeq = 100
let _rowSeq = 1000
let _fileSeq = 100

export const useTestDataStore = defineStore('testData', {
  state: () => ({
    datasets: JSON.parse(JSON.stringify(seedDatasets)),
    files: JSON.parse(JSON.stringify(seedFiles)),
    selectedDatasetId: null
  }),

  getters: {
    selectedDataset: (state) =>
      state.datasets.find(d => d.id === state.selectedDatasetId) || null,

    datasetsOfModule: (state) => (moduleName, systemId) =>
      state.datasets.filter(d => d.systemId === systemId && d.moduleName === moduleName),

    filesOfModule: (state) => (moduleName, systemId) =>
      state.files.filter(f => f.systemId === systemId && f.moduleName === moduleName),

    allFiles: (state) => state.files
  },

  actions: {
    select(id) {
      this.selectedDatasetId = id
    },

    /* ========== 数据集 CRUD ========== */
    addDataset(data) {
      const ds = {
        id: ++_dsSeq,
        name: data.name || '新建数据集',
        systemId: data.systemId,
        moduleName: data.moduleName,
        linkedProtocol: data.linkedProtocol || null,
        linkedInterface: data.linkedInterface || null,
        desc: data.desc || '',
        createdAt: new Date().toISOString().slice(0, 10),
        rows: []
      }
      this.datasets.unshift(ds)
      this.selectedDatasetId = ds.id
      return ds
    },

    removeDataset(id) {
      const idx = this.datasets.findIndex(d => d.id === id)
      if (idx < 0) return
      this.datasets.splice(idx, 1)
      if (this.selectedDatasetId === id) {
        this.selectedDatasetId = this.datasets[0]?.id || null
      }
    },

    updateDataset(id, patch) {
      const ds = this.datasets.find(d => d.id === id)
      if (ds) Object.assign(ds, patch)
    },

    /* ========== 数据行操作 ========== */
    addRow(datasetId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const newRow = {
        id: ++_rowSeq,
        label: `测试行 ${ds.rows.length + 1}`,
        values: {}
      }
      // 用现有行的 keys 初始化空值
      if (ds.rows.length > 0) {
        const keys = Object.keys(ds.rows[0].values)
        keys.forEach(k => { newRow.values[k] = '' })
      }
      ds.rows.push(newRow)
    },

    removeRow(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const idx = ds.rows.findIndex(r => r.id === rowId)
      if (idx >= 0) ds.rows.splice(idx, 1)
    },

    updateRowValue(datasetId, rowId, fieldName, value) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const row = ds.rows.find(r => r.id === rowId)
      if (row) row.values[fieldName] = value
    },

    updateRowLabel(datasetId, rowId, label) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const row = ds.rows.find(r => r.id === rowId)
      if (row) row.label = label
    },

    /* ========== 资源文件 ========== */
    addFile(data) {
      const file = {
        id: ++_fileSeq,
        name: data.name,
        format: data.format || 'csv',
        size: data.size || 0,
        systemId: data.systemId,
        moduleId: data.moduleId || null,
        moduleName: data.moduleName || '',
        desc: data.desc || '',
        uploadedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        rowCount: data.rowCount || 0
      }
      this.files.unshift(file)
      return file
    },

    removeFile(id) {
      const idx = this.files.findIndex(f => f.id === id)
      if (idx >= 0) this.files.splice(idx, 1)
    }
  }
})
