import { defineStore } from 'pinia'
import { datasets as seedDatasets, files as seedFiles } from '@/mock/testData'

let _dsSeq = 100
let _rowSeq = 1000
let _historyRowSeq = 5000
let _fileSeq = 100

const clone = (data) => JSON.parse(JSON.stringify(data))

const historyRowsFromDataset = (dataset) => {
  return (dataset.rows || []).map((row, index) => ({
    id: ++_historyRowSeq,
    label: row.label || `历史行 ${index + 1}`,
    values: clone(row.values || {}),
    source: '历史优秀案例',
    savedAt: dataset.createdAt || '2026-06-25'
  }))
}

const normalizeDatasets = () => {
  return clone(seedDatasets).map(dataset => ({
    ...dataset,
    historyRows: Array.isArray(dataset.historyRows) && dataset.historyRows.length
      ? dataset.historyRows
      : historyRowsFromDataset(dataset)
  }))
}

export const useTestDataStore = defineStore('testData', {
  state: () => ({
    datasets: normalizeDatasets(),
    files: clone(seedFiles),
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
    },

    /** 聚合所有数据集的历史数据，附带数据集元信息 */
    allHistoryData: (state) => {
      const result = []
      state.datasets.forEach(ds => {
        if (!ds.historyRows?.length) return
        ds.historyRows.forEach(hr => {
          result.push({
            ...hr,
            _datasetId: ds.id,
            _datasetName: ds.name,
            _systemId: ds.systemId,
            _moduleName: ds.moduleName,
            _linkedProtocol: ds.linkedProtocol,
            _linkedInterface: ds.linkedInterface
          })
        })
      })
      return result
    },

    /** 按数据集ID获取历史数据 */
    historyOfDataset: (state) => (datasetId) => {
      const ds = state.datasets.find(d => d.id === datasetId)
      return ds?.historyRows || []
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
        rows: [],
        historyRows: []
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
      dup.historyRows = (dup.historyRows || []).map(r => ({ ...r, id: ++_historyRowSeq }))
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

    ensureHistoryRows(datasetId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      if (!Array.isArray(ds.historyRows)) {
        ds.historyRows = historyRowsFromDataset(ds)
      }
      return ds.historyRows
    },

    removeHistoryRow(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds?.historyRows) return
      const idx = ds.historyRows.findIndex(r => r.id === rowId)
      if (idx >= 0) ds.historyRows.splice(idx, 1)
    },

    removeHistoryRowsBatch(datasetId, rowIds) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds?.historyRows) return
      const idSet = new Set(rowIds)
      ds.historyRows = ds.historyRows.filter(r => !idSet.has(r.id))
    },

    /** 添加历史数据行 */
    addHistoryRows(datasetId, rowsData) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      if (!Array.isArray(ds.historyRows)) ds.historyRows = []
      const newRows = rowsData.map(r => ({
        id: ++_historyRowSeq,
        label: r.label || `智能生成行 ${ds.historyRows.length + 1}`,
        values: clone(r.values || {}),
        source: r.source || '智能生成',
        savedAt: new Date().toISOString().slice(0, 10)
      }))
      ds.historyRows.push(...newRows)
      return newRows
    },

    /**
     * 智能生成测试数据：分析现有数据模式，生成新的测试行
     * 策略：边界值扩展 + 随机组合 + 交叉变异
     */
    generateTestData(datasetId, count = 5) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      const sourceRows = [...ds.rows, ...(ds.historyRows || [])]
      if (sourceRows.length === 0) return []

      // 分析每个字段的值模式
      const fieldNames = Object.keys(sourceRows[0].values)
      const analysis = {}

      fieldNames.forEach(field => {
        const rawValues = sourceRows.map(r => r.values[field]).filter(v => v !== undefined && v !== null && v !== '')
        const numericVals = rawValues.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b)
        const stringVals = rawValues.filter(v => typeof v === 'string')

        if (numericVals.length >= 1) {
          const min = numericVals[0]
          const max = numericVals[numericVals.length - 1]
          const range = max - min
          const uniqueSet = new Set(numericVals)
          analysis[field] = {
            type: 'numeric',
            min, max, range,
            mean: numericVals.reduce((a, b) => a + b, 0) / numericVals.length,
            uniqueCount: uniqueSet.size,
            allValues: numericVals,
            isInteger: numericVals.every(v => Number.isInteger(v))
          }
        } else if (stringVals.length >= 1) {
          const unique = [...new Set(stringVals)]
          analysis[field] = {
            type: 'string',
            uniqueValues: unique,
            count: unique.length
          }
        } else {
          analysis[field] = { type: 'unknown' }
        }
      })

      const generated = []
      const existingValueSets = sourceRows.map(r => JSON.stringify(r.values))

      for (let i = 0; i < count; i++) {
        const values = {}
        const strategy = i % 4 // 轮换策略

        fieldNames.forEach(field => {
          const info = analysis[field]
          if (!info || info.type === 'unknown') {
            values[field] = ''
            return
          }

          if (info.type === 'numeric') {
            const { min, max, range, isInteger, allValues } = info
            const jitter = range > 0 ? range * 0.05 : 1

            if (strategy === 0) {
              // 边界值扩展：略超出现有范围
              const extendLow = isInteger ? Math.max(min - Math.ceil(jitter), min - 1) : min - jitter
              values[field] = i % 2 === 0 ? extendLow : (isInteger ? max + Math.ceil(jitter) : max + jitter)
            } else if (strategy === 1) {
              // 范围内随机值
              const raw = min + Math.random() * range
              values[field] = isInteger ? Math.round(raw) : Math.round(raw * 100) / 100
            } else if (strategy === 2) {
              // 交叉变异：从两个不同行取不同字段组合
              const rowA = sourceRows[Math.floor(Math.random() * sourceRows.length)]
              values[field] = rowA.values[field] ?? 0
            } else {
              // 边界 + 均值附近
              const nearBoundary = i % 2 === 0 ? min : max
              values[field] = isInteger ? Math.round(nearBoundary + (Math.random() - 0.5) * jitter * 2) : Math.round((nearBoundary + (Math.random() - 0.5) * jitter * 2) * 100) / 100
            }
          } else if (info.type === 'string') {
            if (strategy === 2) {
              // 交叉变异
              const rowA = sourceRows[Math.floor(Math.random() * sourceRows.length)]
              values[field] = rowA.values[field] ?? info.uniqueValues[0]
            } else {
              // 随机选择已知值
              values[field] = info.uniqueValues[Math.floor(Math.random() * info.uniqueValues.length)]
            }
          }
        })

        // 避免完全重复
        const valueKey = JSON.stringify(values)
        if (!existingValueSets.includes(valueKey)) {
          existingValueSets.push(valueKey)
          generated.push({
            label: `智能生成 #${i + 1}`,
            values
          })
        }
      }

      return generated
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
