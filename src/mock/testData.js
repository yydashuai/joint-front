/**
 * Mock 测试数据种子文件
 * 测试数据集 + 测试资源文件
 */

let _dsSeq = 0
const dsId = () => ++_dsSeq
let _fileSeq = 0
const fileId = () => ++_fileSeq
let _rowSeq = 0
const rowId = () => ++_rowSeq

/* ========== 辅助：数据行 ========== */
const row = (label, values) => ({ id: rowId(), label, values })

/* ========== 测试数据集 ========== */
export const datasets = [
  {
    id: dsId(),
    name: '帧控制字节-全场景',
    systemId: 'sys-weapon',
    moduleName: '武器管理模块',
    linkedProtocol: '帧控制字节协议',
    linkedInterface: null,
    desc: '覆盖帧控制字节协议的所有字段组合场景',
    createdAt: '2026-06-18',
    rows: [
      row('明文+未压缩', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 0 }),
      row('加密+压缩+分片', { '加密标志': 1, '压缩标志': 1, '分片标志': 1, '应答标志': 0, '保留位': 0, '数据类型': 1 }),
      row('应答包-XML', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 3 }),
      row('边界值-全1', { '加密标志': 1, '压缩标志': 1, '分片标志': 1, '应答标志': 1, '保留位': 0, '数据类型': 3 }),
    ]
  },
  {
    id: dsId(),
    name: '设备状态查询-正常与异常',
    systemId: 'sys-weapon',
    moduleName: '武器管理模块',
    linkedProtocol: null,
    linkedInterface: '查询设备状态',
    desc: '模拟设备在线/离线/超时等场景的查询请求',
    createdAt: '2026-06-20',
    rows: [
      row('正常查询', { 'deviceId': 1, 'verbose': 1, 'timeoutMs': 3000 }),
      row('静默查询', { 'deviceId': 1, 'verbose': 0, 'timeoutMs': 5000 }),
      row('超时场景', { 'deviceId': 255, 'verbose': 1, 'timeoutMs': 100 }),
    ]
  },
  {
    id: dsId(),
    name: '遥测帧-温度范围测试',
    systemId: 'sys-fire',
    moduleName: '火控解算模块',
    linkedProtocol: '遥测帧协议',
    linkedInterface: null,
    desc: '验证遥测帧在不同温度区间的解析正确性',
    createdAt: '2026-06-22',
    rows: [
      row('常温 25°C', { '帧头': 60304, '设备ID': 1, '温度': 2500 }),
      row('极寒 -40°C', { '帧头': 60304, '设备ID': 1, '温度': -4000 }),
      row('高温 120°C', { '帧头': 60304, '设备ID': 2, '温度': 12000 }),
      row('边界-最低', { '帧头': 60304, '设备ID': 0, '温度': -5000 }),
      row('边界-最高', { '帧头': 60304, '设备ID': 255, '温度': 15000 }),
    ]
  },
  {
    id: dsId(),
    name: '武器装订-多参数组合',
    systemId: 'sys-weapon',
    moduleName: '武器管理模块',
    linkedProtocol: null,
    linkedInterface: '武器装订指令',
    desc: '覆盖不同武器编号、引信模式和射程的装订场景',
    createdAt: '2026-06-23',
    rows: [
      row('标准装订', { 'weaponId': 1001, 'fuseMode': 0, 'range': 5000, 'angle': 45.0 }),
      row('近距离', { 'weaponId': 1001, 'fuseMode': 1, 'range': 800, 'angle': 12.5 }),
      row('最大射程', { 'weaponId': 2003, 'fuseMode': 2, 'range': 15000, 'angle': 78.3 }),
    ]
  }
]

/* ========== 测试资源文件 ========== */
export const files = [
  {
    id: fileId(),
    name: '武器模块-历史联试数据.csv',
    format: 'csv',
    size: 24576,
    systemId: 'sys-weapon',
    moduleId: null,
    moduleName: '武器管理模块',
    desc: '2026年5月联试录制的原始数据',
    uploadedAt: '2026-05-28 14:30',
    rowCount: 128
  },
  {
    id: fileId(),
    name: '火控遥测基准数据.json',
    format: 'json',
    size: 8192,
    systemId: 'sys-fire',
    moduleId: null,
    moduleName: '火控解算模块',
    desc: '遥测帧协议基准测试集（含期望值）',
    uploadedAt: '2026-06-10 09:15',
    rowCount: 64
  },
  {
    id: fileId(),
    name: '雷达回波原始采样.bin',
    format: 'bin',
    size: 1048576,
    systemId: 'sys-radar',
    moduleId: null,
    moduleName: '信号处理模块',
    desc: '雷达信号处理模块的原始回波采样数据',
    uploadedAt: '2026-06-15 16:45',
    rowCount: 0
  }
]
