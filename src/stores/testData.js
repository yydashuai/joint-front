import { defineStore } from 'pinia'
import { datasets as seedDatasets, files as seedFiles } from '@/mock/testData'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { checkFieldConstraints } from '@/utils/receiveValidator'

let _dsSeq = 100
let _rowSeq = 1000
let _historyRowSeq = 5000
let _fileSeq = 100

const clone = (data) => JSON.parse(JSON.stringify(data))

/**
 * 将协议（protocol）的字段树扁平化为 { name, constraint } 列表，供异常判定使用。
 * - byte 容器字段：取其位段子字段（如帧控制字节的按位定义），无子字段时按普通字段处理
 * - bit 字段：直接取用（带约束）
 * - repeat / 嵌套 struct：递归展开
 */
const flattenProtocolFields = (fields = [], out = []) => {
  for (const f of fields || []) {
    if (f.kind === 'byte') {
      if (f.children?.length) flattenProtocolFields(f.children, out)
      else out.push({ name: f.name, constraint: f.constraint || null, desc: f.desc || f.remark || '' })
    } else if (f.kind === 'bit') {
      out.push({ name: f.name, constraint: f.constraint || null, desc: f.desc || f.remark || '' })
    } else if (f.kind === 'repeat') {
      if (f.children?.length) flattenProtocolFields(f.children, out)
    } else if (f.children?.length) {
      flattenProtocolFields(f.children, out)
    } else {
      out.push({ name: f.name, constraint: f.constraint || null, desc: f.desc || f.remark || '' })
    }
  }
  return out
}

/**
 * 按数据集行键过滤字段：protocolRefs 可能含报文引用的「接收帧」等不相关字段，
 * 不在数据集行内 → 过滤掉，避免产生多余列 / 误判「字段值缺失」异常。
 * 无行数据（新建数据集）时返回全部。
 */
const filterByDatasetKeys = (fields, dataset) => {
  const keys = dataset.rows?.length ? Object.keys(dataset.rows[0].values)
    : dataset.historyRows?.length ? Object.keys(dataset.historyRows[0].values)
    : null
  if (!keys) return fields
  const keySet = new Set(keys)
  return fields.filter(f => keySet.has(f.name))
}

const historyRowsFromDataset = (dataset) => {
  return (dataset.rows || []).map((row, index) => ({
    id: ++_historyRowSeq,
    label: row.label || `历史行 ${index + 1}`,
    values: clone(row.values || {}),
    source: '手动创建',
    savedAt: dataset.createdAt || '2026-06-25',
    remark: '',
    abnormal: false,   // 是否异常（自动判定，默认正常）
    excellent: false,  // 是否加入优秀历史数据库（可选）
  }))
}

const normalizeDatasets = () => {
  const list = clone(seedDatasets).map(dataset => ({
    ...dataset,
    historyRows: Array.isArray(dataset.historyRows) && dataset.historyRows.length
      ? dataset.historyRows
      : historyRowsFromDataset(dataset)
  }))
  // 演示标注：首条历史数据标记为「优秀历史」，便于展示优秀标签与筛选
  if (list[0]?.historyRows?.length) list[0].historyRows[0].excellent = true
  return list
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
    },

    /**
     * 按数据集解析其关联字段定义（含约束与说明），供编辑弹窗预填与悬浮提示使用。
     * 解析优先级：linkedInterface（报文 → protocolRefs 字段）> linkedProtocol（协议字段）。
     * 字段名去重，返回 [{ name, constraint, desc }]。
     */
    fieldDefsOfDataset: (state) => (datasetId) => {
      const ds = state.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      const protocolStore = useProtocolStore()
      let fields = []
      if (ds.linkedInterface) {
        const iface = protocolStore.interfaces.find(
          (i) => i.name === ds.linkedInterface || String(i.id) === String(ds.linkedInterface)
        )
        if (iface) fields = collectInterfaceDatasetFields(iface, protocolStore.protocols)
      }
      if (!fields.length && ds.linkedProtocol) {
        const proto = protocolStore.protocols.find(
          (p) => p.name === ds.linkedProtocol || String(p.id) === String(ds.linkedProtocol)
        )
        if (proto) fields = flattenProtocolFields(proto.fields?.length ? proto.fields : proto.config?.fields)
      }
      if (!fields.length) return []
      fields = filterByDatasetKeys(fields, ds)
      const seen = new Set()
      return fields.filter((f) => {
        if (seen.has(f.name)) return false
        seen.add(f.name)
        return true
      }).map((f) => ({
        name: f.name,
        constraint: f.constraint || null,
        desc: f.desc || f.remark || ''
      }))
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
        savedAt: new Date().toISOString().slice(0, 10),
        remark: r.remark || '',
        abnormal: r.abnormal ?? false,     // 异常标签（调用方按字段定义校验后传入）
        excellent: r.excellent ?? false,   // 优秀历史标签（可选）
      }))
      ds.historyRows.push(...newRows)
      return newRows
    },

    /**
     * 按数据集绑定的字段定义，实时判定一行数据是否异常。
     * 解析优先级：linkedInterface（报文 → protocolRefs 字段）> linkedProtocol（协议字段）。
     * 字段名去重，避免协议内重复字段名（如双「保留位」）误报「字段缺失」。
     * 仅在字段名存在交集时校验，避免泛型 KV 数据被误判。
     * @returns {boolean} 是否异常
     */
    computeAbnormal(values = {}, datasetId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return false
      const protocolStore = useProtocolStore()
      let fields = []
      // 1) 优先按接口（报文）解析字段
      if (ds.linkedInterface) {
        const iface = protocolStore.interfaces.find(
          (i) => i.name === ds.linkedInterface || String(i.id) === String(ds.linkedInterface)
        )
        if (iface) fields = collectInterfaceDatasetFields(iface, protocolStore.protocols)
      }
      // 2) 退化：按协议（字段）解析
      if (!fields.length && ds.linkedProtocol) {
        const proto = protocolStore.protocols.find(
          (p) => p.name === ds.linkedProtocol || String(p.id) === String(ds.linkedProtocol)
        )
        if (proto) fields = flattenProtocolFields(proto.fields?.length ? proto.fields : proto.config?.fields)
      }
      if (!fields.length) return false
      // 按数据集行键过滤，避免 protocolRefs 中不相关字段误判「字段值缺失」
      fields = filterByDatasetKeys(fields, ds)
      // 按字段名去重
      const seen = new Set()
      fields = fields.filter(f => {
        if (seen.has(f.name)) return false
        seen.add(f.name)
        return true
      })
      const overlap = fields.some(f => f.name in (values || {}))
      if (!overlap) return false
      return checkFieldConstraints(fields, values || {}).length > 0
    },

    /** 更新历史数据行（编辑备注、标签、值等） */
    updateHistoryRow(datasetId, rowId, patch) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds?.historyRows) return
      const row = ds.historyRows.find(r => r.id === rowId)
      if (row) Object.assign(row, patch)
    },

    /** 切换「优秀历史数据库」标签 */
    toggleExcellent(datasetId, rowId) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds?.historyRows) return
      const row = ds.historyRows.find(r => r.id === rowId)
      if (row) row.excellent = !row.excellent
    },

    /**
     * 智能生成测试数据：依据字段定义约束，生成新的测试行。
     * @param {string|number} datasetId 目标数据集
     * @param {number} count 生成数量
     * @param {'normal'|'abnormal'|'mixed'} mode 生成类型
     *   - normal：全部字段符合约束（正向功能测试）
     *   - abnormal：每行至少一处字段违规（鲁棒性 / 排错测试）
     *   - mixed：正常 / 异常交替（默认各半）
     * 生成的行标记 source = '智能生成'，便于在历史数据管理中按来源筛选。
     */
    generateTestData(datasetId, count = 5, mode = 'normal') {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      const sourceRows = [...ds.rows, ...(ds.historyRows || [])]
      if (sourceRows.length === 0) return []

      // 解析字段定义（含约束），用于生成合规 / 违规数据
      const protocolStore = useProtocolStore()
      let defs = []
      if (ds.linkedInterface) {
        const iface = protocolStore.interfaces.find(
          (i) => i.name === ds.linkedInterface || String(i.id) === String(ds.linkedInterface)
        )
        if (iface) defs = collectInterfaceDatasetFields(iface, protocolStore.protocols)
      }
      if (!defs.length && ds.linkedProtocol) {
        const proto = protocolStore.protocols.find(
          (p) => p.name === ds.linkedProtocol || String(p.id) === String(ds.linkedProtocol)
        )
        if (proto) defs = flattenProtocolFields(proto.fields?.length ? proto.fields : proto.config?.fields)
      }
      defs = filterByDatasetKeys(defs, ds)
      const seen = new Set()
      defs = defs.filter((f) => {
        if (seen.has(f.name)) return false
        seen.add(f.name)
        return true
      })
      const defMap = {}
      defs.forEach((f) => { defMap[f.name] = f })

      // 既有值分析（无约束字段 / 兜底使用）
      const fieldNames = Object.keys(sourceRows[0].values)
      const analysis = {}
      fieldNames.forEach((field) => {
        const rawValues = sourceRows.map(r => r.values[field]).filter(v => v !== undefined && v !== null && v !== '')
        const numericVals = rawValues.filter(v => typeof v === 'number' && !isNaN(v)).sort((a, b) => a - b)
        const stringVals = rawValues.filter(v => typeof v === 'string')
        if (numericVals.length >= 1) {
          const min = numericVals[0]
          const max = numericVals[numericVals.length - 1]
          const range = max - min
          analysis[field] = {
            type: 'numeric',
            min, max, range,
            isInteger: numericVals.every(v => Number.isInteger(v)),
            allValues: numericVals
          }
        } else if (stringVals.length >= 1) {
          analysis[field] = { type: 'string', uniqueValues: [...new Set(stringVals)] }
        } else {
          analysis[field] = { type: 'unknown' }
        }
      })

      // 合规正常值
      const makeNormal = (c, info) => {
        if (c.mode === 'fixed') return c.value
        if (c.mode === 'enum') { const e = (c.entries || [])[0]; return e?.value ?? e ?? '' }
        if (c.mode === 'range') {
          const { min, max } = c
          if (info?.isInteger) return Math.round(min + Math.random() * (max - min))
          return Math.round((min + Math.random() * (max - min)) * 100) / 100
        }
        return ''
      }
      // 违规异常值
      const makeAbnormal = (c, info) => {
        if (c.mode === 'fixed') {
          const v = c.value
          return typeof v === 'number' ? v + 1 : (String(v) + '_x')
        }
        if (c.mode === 'enum') {
          const vals = new Set((c.entries || []).map(e => String(e.value ?? e)))
          let cand = 9000
          while (vals.has(String(cand))) cand++
          return cand
        }
        if (c.mode === 'range') {
          const { min, max } = c
          const step = info?.isInteger ? (1 + Math.floor(Math.random() * 5)) : 1
          return Math.random() < 0.5 ? min - step : max + step
        }
        return ''
      }

      const generated = []
      const existingValueSets = sourceRows.map(r => JSON.stringify(r.values))
      const violatable = defs.filter(
        f => f.constraint && ['fixed', 'enum', 'range'].includes(f.constraint.mode) && fieldNames.includes(f.name)
      )

      for (let i = 0; i < count; i++) {
        const wantAbnormal = mode === 'abnormal' ? true : mode === 'mixed' ? (i % 2 === 1) : false
        const values = {}
        const violIdx = violatable.length ? Math.floor(Math.random() * violatable.length) : -1
        let abnormalDone = false
        const strategy = i % 4

        fieldNames.forEach((field) => {
          const def = defMap[field]
          const c = def?.constraint
          if (c && ['fixed', 'enum', 'range'].includes(c.mode)) {
            const isViol = wantAbnormal && !abnormalDone && violatable[violIdx] === def
            if (isViol) { values[field] = makeAbnormal(c, analysis[field]); abnormalDone = true }
            else { values[field] = makeNormal(c, analysis[field]) }
            return
          }
          // 无约束字段：沿用既有值模式的随机 / 交叉变异
          const info = analysis[field]
          if (!info || info.type === 'unknown') { values[field] = ''; return }
          if (info.type === 'numeric') {
            const { min, max, range, isInteger, allValues } = info
            const jitter = range > 0 ? range * 0.05 : 1
            if (strategy === 0) {
              const extendLow = isInteger ? Math.max(min - Math.ceil(jitter), min - 1) : min - jitter
              values[field] = i % 2 === 0 ? extendLow : (isInteger ? max + Math.ceil(jitter) : max + jitter)
            } else if (strategy === 1) {
              const raw = min + Math.random() * range
              values[field] = isInteger ? Math.round(raw) : Math.round(raw * 100) / 100
            } else if (strategy === 2) {
              const rowA = sourceRows[Math.floor(Math.random() * sourceRows.length)]
              values[field] = rowA.values[field] ?? 0
            } else {
              const nearBoundary = i % 2 === 0 ? min : max
              values[field] = isInteger
                ? Math.round(nearBoundary + (Math.random() - 0.5) * jitter * 2)
                : Math.round((nearBoundary + (Math.random() - 0.5) * jitter * 2) * 100) / 100
            }
          } else if (info.type === 'string') {
            if (strategy === 2) {
              const rowA = sourceRows[Math.floor(Math.random() * sourceRows.length)]
              values[field] = rowA.values[field] ?? info.uniqueValues[0]
            } else {
              values[field] = info.uniqueValues[Math.floor(Math.random() * info.uniqueValues.length)]
            }
          }
        })

        // 避免完全重复
        const valueKey = JSON.stringify(values)
        if (!existingValueSets.includes(valueKey)) {
          existingValueSets.push(valueKey)
          generated.push({ label: `智能生成 #${i + 1}`, values, source: '智能生成' })
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
        rowCount: data.rowCount || 0,
        // 数据链等文本类文件保留原文，供「解析」再次导入
        content: data.content || ''
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
