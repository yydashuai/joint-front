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

    allFiles: (state) => state.files,

    /** 按关键字搜索数据集 */
    searchDatasets: (state) => (keyword) => {
      if (!keyword) return state.datasets
      const kw = keyword.toLowerCase()
      return state.datasets.filter(d =>
        d.name.toLowerCase().includes(kw) ||
        (d.desc && d.desc.toLowerCase().includes(kw)) ||
        (d.moduleName && d.moduleName.toLowerCase().includes(kw))
      )
    }
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

    /** 复制数据集（深拷贝行数据） */
    duplicateDataset(id) {
      const src = this.datasets.find(d => d.id === id)
      if (!src) return null
      const dup = {
        ...JSON.parse(JSON.stringify(src)),
        id: ++_dsSeq,
        name: `${src.name} (副本)`,
        createdAt: new Date().toISOString().slice(0, 10)
      }
      // 重新分配行 ID
      dup.rows = dup.rows.map(r => ({ ...r, id: ++_rowSeq }))
      // 插入到源数据集后面
      const idx = this.datasets.findIndex(d => d.id === id)
      this.datasets.splice(idx + 1, 0, dup)
      this.selectedDatasetId = dup.id
      return dup
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
      return newRow
    },

    removeRow(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const idx = ds.rows.findIndex(r => r.id === rowId)
      if (idx >= 0) ds.rows.splice(idx, 1)
    },

    /** 批量删除行 */
    removeRowsBatch(datasetId, rowIds) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const idSet = new Set(rowIds)
      ds.rows = ds.rows.filter(r => !idSet.has(r.id))
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

    /** 重排行（拖拽排序后用） */
    reorderRows(datasetId, newRows) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      ds.rows = newRows
    },

    /** 复制单行（插入到原行之后） */
    duplicateRow(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return null
      const idx = ds.rows.findIndex(r => r.id === rowId)
      if (idx < 0) return null
      const copy = { ...JSON.parse(JSON.stringify(ds.rows[idx])), id: ++_rowSeq, label: ds.rows[idx].label + ' (副本)' }
      ds.rows.splice(idx + 1, 0, copy)
      return copy
    },

    /** 批量复制行（插入到最后一行之后） */
    duplicateRows(datasetId, rowIds) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      const copies = rowIds.map(id => {
        const src = ds.rows.find(r => r.id === id)
        if (!src) return null
        return { ...JSON.parse(JSON.stringify(src)), id: ++_rowSeq }
      }).filter(Boolean)
      ds.rows.push(...copies)
      return copies
    },

    /** 在指定位置后插入行（粘贴用） */
    insertRowsAfter(datasetId, afterRowId, rowsData) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const newRows = rowsData.map(r => ({ ...JSON.parse(JSON.stringify(r)), id: ++_rowSeq }))
      if (afterRowId == null) {
        ds.rows.push(...newRows)
      } else {
        const idx = ds.rows.findIndex(r => r.id === afterRowId)
        if (idx < 0) { ds.rows.push(...newRows); return }
        ds.rows.splice(idx + 1, 0, ...newRows)
      }
    },

    /** 上移行 */
    moveRowUp(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const idx = ds.rows.findIndex(r => r.id === rowId)
      if (idx <= 0) return
      const tmp = ds.rows[idx]
      ds.rows[idx] = ds.rows[idx - 1]
      ds.rows[idx - 1] = tmp
    },

    /** 下移行 */
    moveRowDown(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const idx = ds.rows.findIndex(r => r.id === rowId)
      if (idx < 0 || idx >= ds.rows.length - 1) return
      const tmp = ds.rows[idx]
      ds.rows[idx] = ds.rows[idx + 1]
      ds.rows[idx + 1] = tmp
    },

    /** 清空所有行 */
    clearRows(datasetId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (ds) ds.rows = []
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
