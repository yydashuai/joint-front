import { defineStore } from 'pinia'
import { datasets as seedDatasets, files as seedFiles } from '@/mock/testData'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { checkFieldConstraints } from '@/utils/receiveValidator'
import { makeUniqueName } from '@/utils/entityName'
import { coverageOf, sampleByDistribution } from '@/utils/dataGen'

let _dsSeq = 100
let _rowSeq = 1000
let _historyRowSeq = 5000
let _fileSeq = 100

const clone = (data) => JSON.parse(JSON.stringify(data))
const today = () => new Date().toISOString().slice(0, 10)

const normalizeHistoryRow = (row = {}, dataset = {}, index = 0) => {
  const abnormal = !!row.abnormal
  const customTags = Array.isArray(row.customTags)
    ? [...new Set(row.customTags.map(String).map((v) => v.trim()).filter(Boolean))]
    : []
  return {
    ...row,
    id: row.id ?? ++_historyRowSeq,
    label: row.label || `历史报文 ${index + 1}`,
    messageId: row.messageId ?? dataset.messageId ?? null,
    messageName: row.messageName || dataset.linkedInterface || dataset.name || '未命名报文',
    interfaceId: row.interfaceId ?? null,
    fileId: row.fileId ?? dataset.sourceFileId ?? null,
    fileName: row.fileName || dataset.sourceFileName || '',
    createdAt: row.createdAt || row.savedAt || dataset.createdAt || today(),
    savedAt: row.savedAt || row.createdAt || dataset.createdAt || today(),
    source: row.source || '手动创建',
    remark: row.remark || '',
    abnormal,
    excellent: !!row.excellent,
    customTags,
    autoTags: abnormal ? ['异常'] : [],
    validationResult: row.validationResult || (abnormal ? '存在字段约束异常' : '校验通过'),
    datasetId: row.datasetId ?? dataset.id ?? null,
    usageCount: Number(row.usageCount || 0),
    lastUsedAt: row.lastUsedAt || '',
    // A1：优秀认证信息（certifier / certTime / criteria / scenario / remark）
    certification: row.certification || null,
    values: clone(row.values || {}),
  }
}

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
  return (dataset.rows || []).map((row, index) => normalizeHistoryRow({
    ...row,
    source: '手动创建',
  }, dataset, index))
}

/**
 * 解析数据集关联的报文实体（1 报文 : N 数据集）：
 * 优先按 messageId（报文实体 id），回退按 linkedInterface（报文名，兼容旧数据）。
 */
const resolveLinkedIface = (ds, protocolStore) => {
  if (ds?.messageId != null && ds.messageId !== '') {
    const m = protocolStore.interfaces.find((i) => String(i.id) === String(ds.messageId))
    if (m) return m
  }
  if (ds?.linkedInterface) {
    return protocolStore.interfaces.find(
      (i) => i.name === ds.linkedInterface || String(i.id) === String(ds.linkedInterface)
    ) || null
  }
  return null
}

const normalizeDatasets = () => {
  const list = clone(seedDatasets).map(dataset => {
    const rawHistory = Array.isArray(dataset.historyRows) && dataset.historyRows.length
      ? dataset.historyRows
      : historyRowsFromDataset(dataset)
    return {
      ...dataset,
      historyRows: rawHistory.map((row, index) => normalizeHistoryRow(row, dataset, index)),
    }
  })
  // 演示标注：首条历史数据标记为「优秀历史」，便于展示优秀标签与筛选
  if (list[0]?.historyRows?.length) list[0].historyRows[0].excellent = true
  // 演示数据区分度：为「按创建时间排序」与日期筛选提供多样化的创建日期（按数据集 × 行号递增，日期错开）
  list.forEach((dataset, di) => {
    (dataset.historyRows || []).forEach((row, ri) => {
      const d = new Date(2026, 5, 20 + di * 3 + ri)
      row.createdAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      row.savedAt = row.savedAt || row.createdAt
    })
  })
  // A1：为演示数据中已有的优秀行预置认证台账与客观复用统计
  list.forEach((dataset, di) => {
    (dataset.historyRows || []).forEach((row, ri) => {
      if (!row.excellent) return
      if (!row.certification) {
        row.certification = {
          certifier: '张工',
          certTime: `${row.createdAt || today()} 10:00`,
          criteria: '字段完整率100%，约束符合度100%，可作回归基线',
          scenario: '某系统联试回归基线',
          remark: '可作为回归基线复用',
        }
      }
      // 引用次数与最近复用：提供有区分度的演示热度数据
      if (!row.usageCount) row.usageCount = 5 + ((di * 7 + ri * 5) % 40)
      if (!row.lastUsedAt) {
        const usedAt = new Date()
        usedAt.setDate(usedAt.getDate() - (di * 17 + ri * 29) % 150)
        row.lastUsedAt = `${usedAt.getFullYear()}-${String(usedAt.getMonth() + 1).padStart(2, '0')}-${String(usedAt.getDate()).padStart(2, '0')} 14:22`
      }
    })
  })
  return list
}

const csvCell = (value) => {
  const text = value == null ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 为演示数据补齐“导入文件 → 报文 → 表头 → 数据行”的可追溯关系。 */
const createInitialData = () => {
  const datasets = normalizeDatasets()
  const files = clone(seedFiles)

  datasets.forEach((dataset) => {
    const importedRows = (dataset.historyRows || []).filter((row) => row.source === '文件导入')
    if (!importedRows.length) return

    let file = files.find((item) =>
      (dataset.sourceFileId != null && String(item.id) === String(dataset.sourceFileId)) ||
      (dataset.sourceFileName && item.name === dataset.sourceFileName)
    )
    if (!file) {
      const fieldNames = Object.keys(importedRows[0]?.values || {})
      const content = [
        dataset.linkedInterface || dataset.name,
        fieldNames.map(csvCell).join(','),
        ...importedRows.map((row) => fieldNames.map((name) => csvCell(row.values?.[name])).join(',')),
      ].join('\n')
      file = {
        id: ++_fileSeq,
        name: `${dataset.name}.csv`,
        format: 'csv',
        size: new Blob([content]).size,
        systemId: dataset.systemId,
        moduleId: null,
        moduleName: dataset.moduleName || '',
        desc: `包含“${dataset.linkedInterface || dataset.name}”及 ${importedRows.length} 行测试数据`,
        uploadedAt: `${dataset.createdAt || today()} 09:00`,
        rowCount: importedRows.length,
        messageIds: dataset.messageId != null ? [dataset.messageId] : [],
        messageNames: [dataset.linkedInterface || dataset.name],
        content,
      }
      files.push(file)
    }

    dataset.sourceFileId = file.id
    dataset.sourceFileName = file.name
    importedRows.forEach((row) => {
      row.fileId = file.id
      row.fileName = file.name
    })
  })

  return { datasets, files }
}

export const useTestDataStore = defineStore('testData', {
  state: () => {
    const initial = createInitialData()
    return {
      datasets: initial.datasets,
      files: initial.files,
      customTagLibrary: ['边界值', '回归样本', '稳定样本', '典型异常'],
      selectedDatasetId: null,
      // D-1：生成策略（可保存复用）
      generationStrategies: [
        { id: 'gs-default-mixed', name: '默认综合策略', count: 10, mode: 'mixed', method: 'constraint', coverage: { enumAll: true } },
        { id: 'gs-excellent-dist', name: '优秀样本分布策略', count: 8, mode: 'mixed', method: 'distribution', coverage: { enumAll: false } },
      ],
      // H1：历史/优秀库筛选视图（保存常用筛选组合）
      historyViews: [],
    }
  },

  getters: {
    selectedDataset: (state) =>
      state.datasets.find(d => d.id === state.selectedDatasetId) || null,

    datasetsOfModule: (state) => (moduleName, systemId) =>
      state.datasets.filter(d => d.systemId === systemId && d.moduleName === moduleName),

    /** 按报文实体 id 取数据集（1 报文 : N 数据集） */
    datasetsOfMessage: (state) => (messageId) =>
      state.datasets.filter(d => String(d.messageId) === String(messageId)),

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
          const protocolStore = useProtocolStore()
          const message = protocolStore.interfaces.find((m) => String(m.id) === String(hr.messageId ?? ds.messageId))
          const owner = protocolStore.testInterfaces.find((i) => String(i.id) === String(message?.ownerIfaceId))
          result.push({
            ...hr,
            messageId: hr.messageId ?? message?.id ?? ds.messageId ?? null,
            messageName: hr.messageName || message?.name || ds.linkedInterface || ds.name,
            interfaceId: hr.interfaceId ?? owner?.id ?? message?.ownerIfaceId ?? null,
            fileId: hr.fileId ?? ds.sourceFileId ?? null,
            fileName: hr.fileName || ds.sourceFileName || '',
            createdAt: hr.createdAt || hr.savedAt,
            customTags: hr.customTags || [],
            autoTags: hr.abnormal ? ['异常'] : [],
            datasetId: hr.datasetId ?? ds.id,
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
     * 解析优先级：messageId（报文实体）> linkedInterface（报文名）> linkedProtocol（协议字段）。
     * 字段名去重，返回 [{ name, constraint, desc }]。
     */
    fieldDefsOfDataset: (state) => (datasetId) => {
      const ds = state.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      const protocolStore = useProtocolStore()
      let fields = []
      const iface = resolveLinkedIface(ds, protocolStore)
      if (iface) fields = collectInterfaceDatasetFields(iface, protocolStore.protocols)
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
      const protocolStore = useProtocolStore()
      // messageId 优先：新建数据集绑定报文（1 报文 : N 数据集）；顺带回填 linkedInterface 兼容旧逻辑
      let linkedInterface = data.linkedInterface || null
      if (data.messageId && !linkedInterface) {
        const m = protocolStore.interfaces.find((i) => String(i.id) === String(data.messageId))
        if (m) linkedInterface = m.name
      }
      const ds = {
        id: ++_dsSeq,
        name: makeUniqueName(this.datasets, data.name || '新建数据集'),
        systemId: data.systemId,
        moduleName: data.moduleName,
        linkedProtocol: data.linkedProtocol || null,
        linkedInterface,
        messageId: data.messageId || null,
        sourceFileId: data.sourceFileId || null,
        sourceFileName: data.sourceFileName || '',
        desc: data.desc || '',
        createdAt: new Date().toISOString().slice(0, 10),
        rows: [],
        historyRows: []
      }
      this.datasets.unshift(ds)
      this.selectedDatasetId = ds.id
      return ds
    },

    /** 报文归属迁移：从 linkedInterface（报文名）反查报文实体 id 回填 messageId（幂等） */
    migrateMessageLink() {
      const protocolStore = useProtocolStore()
      this.datasets.forEach((ds) => {
        const message = ds.messageId != null && ds.messageId !== ''
          ? protocolStore.interfaces.find((item) => String(item.id) === String(ds.messageId))
          : ds.linkedInterface
          ? protocolStore.interfaces.find(
            (i) => i.name === ds.linkedInterface || String(i.id) === String(ds.linkedInterface)
          )
          : null
        ds.messageId = message ? message.id : null
        if (ds.sourceFileId && message) this.linkFileToMessage(ds.sourceFileId, message)
      })
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
      if (ds) {
        const next = { ...patch }
        if (Object.prototype.hasOwnProperty.call(next, 'name')) {
          next.name = makeUniqueName(this.datasets, next.name, ds)
        }
        Object.assign(ds, next)
      }
    },

    /** 复制数据集（深拷贝行数据） */
    duplicateDataset(id) {
      const src = this.datasets.find(d => d.id === id)
      if (!src) return null
      const dup = {
        ...JSON.parse(JSON.stringify(src)),
        id: ++_dsSeq,
        name: makeUniqueName(this.datasets, `${src.name} (副本)`),
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
    /**
     * 添加测试行。可通过 init 传入初始值：{ label, values, remark, customTags }
     * 空值按现有行字段键补齐（与旧行为一致）。
     */
    addRow(datasetId, init = {}) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const values = init.values ? { ...init.values } : {}
      const newRow = {
        id: ++_rowSeq,
        label: init.label || `测试行 ${ds.rows.length + 1}`,
        values,
        createdAt: today(),
        remark: init.remark || '',
        customTags: Array.isArray(init.customTags) ? [...init.customTags] : []
      }
      // 用现有行的 keys 初始化空值
      if (ds.rows.length > 0) {
        const keys = Object.keys(ds.rows[0].values)
        keys.forEach(k => { if (newRow.values[k] === undefined) newRow.values[k] = '' })
      }
      ds.rows.push(newRow)
      if (newRow.customTags.length) this.registerCustomTags(newRow.customTags)
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

    /** 更新矩阵行备注（与历史数据备注方案一致） */
    updateRowRemark(datasetId, rowId, remark) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const row = ds.rows.find(r => r.id === rowId)
      if (row) row.remark = remark
    },

    /** 更新矩阵行标签（去重 + 同步进标签库，与历史数据标签方案一致） */
    updateRowTags(datasetId, rowId, tags = []) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return
      const row = ds.rows.find(r => r.id === rowId)
      if (row) {
        row.customTags = [...new Set(tags.map(String).map((v) => v.trim()).filter(Boolean))]
        this.registerCustomTags(row.customTags)
      }
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
      const newRows = rowsData.map(r => ({
        ...JSON.parse(JSON.stringify(r)),
        id: ++_rowSeq,
        createdAt: r.createdAt || today(),
        remark: r.remark || '',
        customTags: Array.isArray(r.customTags) ? [...r.customTags] : [],
      }))
      if (afterRowId == null) {
        ds.rows.push(...newRows)
      } else {
        const idx = ds.rows.findIndex(r => r.id === afterRowId)
        if (idx < 0) { ds.rows.push(...newRows); return }
        ds.rows.splice(idx + 1, 0, ...newRows)
      }
      this.registerCustomTags(newRows.flatMap((row) => row.customTags || []))
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
        ...normalizeHistoryRow({
          ...r,
          id: ++_historyRowSeq,
          label: r.label || `智能生成行 ${ds.historyRows.length + 1}`,
          abnormal: r.abnormal ?? this.computeAbnormal(r.values || {}, datasetId),
          source: r.source || '智能生成',
        }, ds, ds.historyRows.length),
      }))
      ds.historyRows.push(...newRows)
      this.registerCustomTags(newRows.flatMap((row) => row.customTags || []))
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
      // 1) 优先按报文解析字段（messageId → linkedInterface 兼容）
      const iface = resolveLinkedIface(ds, protocolStore)
      if (iface) fields = collectInterfaceDatasetFields(iface, protocolStore.protocols)
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
      if (row) {
        const next = { ...patch }
        if (next.values) {
          next.abnormal = this.computeAbnormal(next.values, datasetId)
          next.autoTags = next.abnormal ? ['异常'] : []
          next.validationResult = next.abnormal ? '存在字段约束异常' : '校验通过'
        }
        if (next.customTags) {
          next.customTags = [...new Set(next.customTags.map(String).map((v) => v.trim()).filter(Boolean))]
          this.registerCustomTags(next.customTags)
        }
        // H4：行级编辑留痕（客观记录最近修改时间与操作人）
        next.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
        next.updatedBy = next.updatedBy || '张工'
        Object.assign(row, next)
      }
    },

    addTagsToHistory(rows, tags = []) {
      const clean = [...new Set(tags.map(String).map((v) => v.trim()).filter(Boolean))]
      this.registerCustomTags(clean)
      rows.forEach(({ _datasetId, id }) => {
        const ds = this.datasets.find((d) => d.id === _datasetId)
        const row = ds?.historyRows?.find((item) => item.id === id)
        if (row) row.customTags = [...new Set([...(row.customTags || []), ...clean])]
      })
    },

    /**
     * 批量设置优秀标记，可选携带认证信息（A1）。
     * @param {{_datasetId:any,id:any}[]} rows
     * @param {boolean} excellent
     * @param {object|null} cert 认证信息 {certifier,criteria,scenario,remark}，certTime 自动取当前时间
     */
    setExcellentBatch(rows, excellent = true, cert = null) {
      const certPayload = cert
        ? { ...cert, certTime: new Date().toLocaleString('zh-CN', { hour12: false }) }
        : null
      rows.forEach(({ _datasetId, id }) => {
        const ds = this.datasets.find((d) => d.id === _datasetId)
        const row = ds?.historyRows?.find((item) => item.id === id)
        if (!row) return
        row.excellent = excellent
        if (excellent && certPayload) {
          row.certification = certPayload
        }
      })
    },

    /**
     * A1：单条认证为优秀（设置优秀标记 + 写入认证台账）。
     * @param {any} datasetId
     * @param {any} rowId
     * @param {object} cert 认证信息 {certifier,criteria,scenario,remark}
     */
    certifyExcellent(datasetId, rowId, cert) {
      const ds = this.datasets.find((d) => d.id === datasetId)
      const row = ds?.historyRows?.find((r) => r.id === rowId)
      if (!row) return
      row.excellent = true
      row.certification = {
        ...(cert || {}),
        certTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      }
    },

    /**
     * A4：复用闭环反馈——累加引用次数、更新最近复用时间（仅客观计数）。
     * @param {any} datasetId
     * @param {any} rowId
     */
    updateReuseStats(datasetId, rowId) {
      const ds = this.datasets.find((d) => d.id === datasetId)
      const row = ds?.historyRows?.find((r) => r.id === rowId)
      if (!row) return
      // 仅维护客观计数：引用次数 + 最近引用时间（不引入任何结果性指标）
      row.usageCount = Number(row.usageCount || 0) + 1
      row.lastUsedAt = new Date().toLocaleString('zh-CN', { hour12: false })
    },

    registerCustomTags(tags = []) {
      const clean = tags.map(String).map((value) => value.trim()).filter((value) => value && value !== '异常')
      this.customTagLibrary = [...new Set([...(this.customTagLibrary || []), ...clean])]
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
    generateTestData(datasetId, count = 5, mode = 'normal', options = {}) {
      const ds = this.datasets.find(d => d.id === datasetId)
      if (!ds) return []
      const selectedReferences = Array.isArray(options.referenceRows) ? options.referenceRows : []
      const fieldOverrides = options.fieldOverrides || {}
      const recipe = options.recipe || null
      const sourceRows = selectedReferences.length
        ? [...ds.rows, ...selectedReferences]
        : [...ds.rows, ...(ds.historyRows || [])]

      // 解析字段定义（含约束），用于生成合规 / 违规数据
      const protocolStore = useProtocolStore()
      let defs = []
      const iface = resolveLinkedIface(ds, protocolStore)
      if (iface) defs = collectInterfaceDatasetFields(iface, protocolStore.protocols)
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

      // 既有值分析（无样本时直接依据字段定义构造生成基线）
      const fieldNames = sourceRows.length ? Object.keys(sourceRows[0].values) : defs.map((field) => field.name)
      if (!fieldNames.length) return []
      const analysisRows = sourceRows.length ? sourceRows : [{
        values: Object.fromEntries(fieldNames.map((name) => {
          const constraint = defMap[name]?.constraint
          if (constraint?.mode === 'fixed') return [name, constraint.value]
          if (constraint?.mode === 'enum') {
            const first = (constraint.entries || [])[0]
            return [name, first?.value ?? first ?? '']
          }
          if (constraint?.mode === 'range') return [name, constraint.min]
          return [name, '']
        }))
      }]
      const analysis = {}
      fieldNames.forEach((field) => {
        const rawValues = analysisRows.map(r => r.values[field]).filter(v => v !== undefined && v !== null && v !== '')
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
      const makeBoundary = (c, info, index) => {
        if (c.mode === 'fixed') return c.value
        if (c.mode === 'enum') {
          const entries = c.entries || []
          const entry = entries[index % Math.max(entries.length, 1)]
          return entry?.value ?? entry ?? ''
        }
        if (c.mode === 'range') return index % 2 === 0 ? c.min : c.max
        return makeNormal(c, info)
      }
      // 格式异常：向有约束字段注入类型错配值（数值字段填字符串 / 枚举字段填数字），触发字段校验不通过
      const makeFormatError = (c) => {
        if (c.mode === 'range') return 'αβ格式异常'
        if (c.mode === 'fixed') return typeof c.value === 'number' ? 'FMT_ERR' : 77777
        if (c.mode === 'enum') return 12345
        return 'format_err'
      }

      const generated = []
      const existingValueSets = sourceRows.map(r => JSON.stringify(r.values))
      const violatable = defs.filter(
        f => f.constraint && ['fixed', 'enum', 'range'].includes(f.constraint.mode) && fieldNames.includes(f.name)
      )

      for (let i = 0; i < count; i++) {
        const wantAbnormal = mode === 'abnormal' ? true : mode === 'mixed' ? (i % 3 === 2) : false
        const wantBoundary = mode === 'boundary' || (mode === 'mixed' && i % 3 === 1)
        const values = {}
        let abnormalDone = false
        let abnormalField = null
        let abnormalType = null
        const recipeTags = []
        if (wantAbnormal && violatable.length) {
          const vf = violatable[Math.floor(Math.random() * violatable.length)]
          abnormalField = vf.name
          const en = recipe || { exceedRange: true, illegalEnum: true, formatError: false }
          const choices = []
          if (en.exceedRange && (vf.constraint.mode === 'range' || vf.constraint.mode === 'fixed')) choices.push('exceedRange')
          if (en.illegalEnum && vf.constraint.mode === 'enum') choices.push('illegalEnum')
          if (en.formatError) choices.push('formatError')
          if (choices.length) abnormalType = choices[Math.floor(Math.random() * choices.length)]
        }
        const variationStrategy = i % 4

        fieldNames.forEach((field) => {
          const def = defMap[field]
          const c = def?.constraint
          // D-1：字段级策略覆盖（boundary / fixed / enum / min / max）
          const override = fieldOverrides[field]
          if (override) {
            if (override === 'boundary') { values[field] = makeBoundary(c, analysis[field], i); return }
            if (override === 'fixed') {
              if (c?.mode === 'fixed') values[field] = c.value
              else if (c?.mode === 'enum') values[field] = c.entries?.[0]?.value ?? c.entries?.[0] ?? ''
              else values[field] = analysis[field]?.uniqueValues?.[0] ?? ''
              return
            }
            if (override === 'enum') { const e = (c?.entries || [])[0]; values[field] = e?.value ?? e ?? values[field]; return }
            if (override === 'min') { values[field] = c?.min ?? values[field]; return }
            if (override === 'max') { values[field] = c?.max ?? values[field]; return }
          }
          if (c && ['fixed', 'enum', 'range'].includes(c.mode)) {
            if (field === abnormalField && abnormalType) {
              if (abnormalType === 'exceedRange') values[field] = makeAbnormal(c, analysis[field])
              else if (abnormalType === 'illegalEnum') {
                const vals = new Set((c.entries || []).map((e) => String(e.value ?? e)))
                let cand = 9000
                while (vals.has(String(cand))) cand += 1
                values[field] = cand
              } else if (abnormalType === 'formatError') {
                values[field] = makeFormatError(c)
              }
              abnormalDone = true
              recipeTags.push({ exceedRange: '数值越界', illegalEnum: '非法枚举', formatError: '格式异常' }[abnormalType])
            } else if (wantBoundary) values[field] = makeBoundary(c, analysis[field], i)
            else { values[field] = makeNormal(c, analysis[field]) }
            return
          }
          // 无约束字段：沿用既有值模式的随机 / 交叉变异
          const info = analysis[field]
          if (!info || info.type === 'unknown') { values[field] = ''; return }
          if (info.type === 'numeric') {
            const { min, max, range, isInteger, allValues } = info
            const jitter = range > 0 ? range * 0.05 : 1
            if (variationStrategy === 0) {
              const extendLow = isInteger ? Math.max(min - Math.ceil(jitter), min - 1) : min - jitter
              values[field] = i % 2 === 0 ? extendLow : (isInteger ? max + Math.ceil(jitter) : max + jitter)
            } else if (variationStrategy === 1) {
              const raw = min + Math.random() * range
              values[field] = isInteger ? Math.round(raw) : Math.round(raw * 100) / 100
            } else if (variationStrategy === 2) {
              const rowA = analysisRows[Math.floor(Math.random() * analysisRows.length)]
              values[field] = rowA.values[field] ?? 0
            } else {
              const nearBoundary = i % 2 === 0 ? min : max
              values[field] = isInteger
                ? Math.round(nearBoundary + (Math.random() - 0.5) * jitter * 2)
                : Math.round((nearBoundary + (Math.random() - 0.5) * jitter * 2) * 100) / 100
            }
          } else if (info.type === 'string') {
            if (variationStrategy === 2) {
              const rowA = analysisRows[Math.floor(Math.random() * analysisRows.length)]
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
          const strategy = wantAbnormal ? '异常变异' : wantBoundary ? '边界覆盖' : options.preferExcellent ? '优秀样本模板' : '历史分布拟合'
          generated.push({
            label: `智能生成 #${i + 1}`,
            values,
            source: '智能生成',
            strategy,
            referenceIds: options.referenceIds || [],
            coverageTags: [wantAbnormal ? '异常路径' : wantBoundary ? '边界值' : '正常路径'],
            recipeTags,
            expectedResult: wantAbnormal ? '预期校验不通过' : '预期校验通过',
          })
        }
      }

      return generated
    },

    /* ========== 生成策略（D-1） ========== */
    saveGenerationStrategy(data = {}) {
      const id = data.id || `gs-${Date.now()}`
      const strategy = { ...data, id }
      const idx = this.generationStrategies.findIndex((s) => s.id === id)
      if (idx >= 0) this.generationStrategies.splice(idx, 1, strategy)
      else this.generationStrategies.unshift(strategy)
      return strategy
    },
    removeGenerationStrategy(id) {
      const idx = this.generationStrategies.findIndex((s) => s.id === id)
      if (idx >= 0) this.generationStrategies.splice(idx, 1)
    },

    /* ========== 筛选视图（H1） ========== */
    saveHistoryView({ mode, name, filters }) {
      const view = { id: `hv-${Date.now()}`, mode, name, filters: JSON.parse(JSON.stringify(filters || {})) }
      this.historyViews.unshift(view)
      return view
    },
    removeHistoryView(id) {
      const idx = this.historyViews.findIndex((v) => v.id === id)
      if (idx >= 0) this.historyViews.splice(idx, 1)
    },

    /**
     * D-1/D-2：按策略执行一次生成（含覆盖率统计）。
     * @param {any} datasetId
     * @param {{count:number, mode:string, method:'constraint'|'distribution', referenceRows?:any[], fieldOverrides?:object}} opts
     * @returns {{ok:boolean, rows:any[], coverage:object, reason?:string}}
     */
    runGeneration(datasetId, opts = {}) {
      const ds = this.datasets.find((d) => d.id === datasetId)
      if (!ds) return { ok: false, reason: '数据集不存在', rows: [], coverage: null }
      const { count = 8, mode = 'mixed', method = 'constraint', referenceRows = [], fieldOverrides = {}, recipe = null } = opts
      let rows = []
      if (method === 'distribution') {
        const samples = referenceRows.length
          ? referenceRows
          : [...ds.rows, ...(ds.historyRows || [])]
        rows = sampleByDistribution(samples, count)
        rows.forEach((row) => {
          row.abnormal = this.computeAbnormal(row.values, datasetId)
          row.autoTags = row.abnormal ? ['异常'] : []
        })
      } else {
        rows = this.generateTestData(datasetId, count, mode, {
          referenceRows,
          referenceIds: referenceRows.map((row) => `${row._datasetId}-${row.id}`),
          preferExcellent: referenceRows.some((row) => row.excellent),
          fieldOverrides,
          recipe,
        })
      }
      const protocolStore = useProtocolStore()
      let defs = []
      const iface = resolveLinkedIface(ds, protocolStore)
      if (iface) defs = collectInterfaceDatasetFields(iface, protocolStore.protocols)
      const coverage = coverageOf(defs, rows)
      return { ok: true, rows, coverage, ds }
    },

    /* ========== 资源文件 ========== */
    addFile(data) {
      const file = {
        id: ++_fileSeq,
        name: makeUniqueName(this.files, data.name || '新建数据文件'),
        format: data.format || 'csv',
        size: data.size || 0,
        systemId: data.systemId,
        moduleId: data.moduleId || null,
        moduleName: data.moduleName || '',
        desc: data.desc || '',
        uploadedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        rowCount: data.rowCount || 0,
        messageIds: [...new Set(data.messageIds || [])],
        messageNames: [...new Set(data.messageNames || [])],
        interfaceIds: [...new Set(data.interfaceIds || [])],
        interfaceNames: [...new Set(data.interfaceNames || [])],
        // 数据链等文本类文件保留原文，供「解析」再次导入
        content: data.content || ''
      }
      this.files.unshift(file)
      return file
    },

    linkFileToMessage(fileId, message = {}) {
      const file = this.files.find((item) => String(item.id) === String(fileId))
      if (!file) return
      if (!Array.isArray(file.messageIds)) file.messageIds = []
      if (!Array.isArray(file.messageNames)) file.messageNames = []
      if (!Array.isArray(file.interfaceIds)) file.interfaceIds = []
      if (!Array.isArray(file.interfaceNames)) file.interfaceNames = []
      if (message.id != null && !file.messageIds.some((id) => String(id) === String(message.id))) file.messageIds.push(message.id)
      if (message.name && !file.messageNames.includes(message.name)) file.messageNames.push(message.name)
      const protocolStore = useProtocolStore()
      const iface = protocolStore.testInterfaces.find((item) => String(item.id) === String(message.ownerIfaceId))
      if (iface?.id != null && !file.interfaceIds.some((id) => String(id) === String(iface.id))) file.interfaceIds.push(iface.id)
      if (iface?.name && !file.interfaceNames.includes(iface.name)) file.interfaceNames.push(iface.name)
    },

    setFileInterfaces(fileId, interfaceIds = []) {
      const file = this.files.find((item) => String(item.id) === String(fileId))
      if (!file) return
      const protocolStore = useProtocolStore()
      const cleanIds = [...new Set(interfaceIds)].filter((id) =>
        protocolStore.testInterfaces.some((item) => String(item.id) === String(id))
      )
      file.interfaceIds = cleanIds
      file.interfaceNames = cleanIds
        .map((id) => protocolStore.testInterfaces.find((item) => String(item.id) === String(id))?.name)
        .filter(Boolean)
    },

    removeFile(id) {
      const idx = this.files.findIndex(f => f.id === id)
      if (idx >= 0) this.files.splice(idx, 1)
    }
  }
})
