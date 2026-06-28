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
  },
  // ── MQ 消息队列测试数据集 ──
  {
    id: dsId(),
    name: '挂载变更-多场景覆盖',
    systemId: 'sys-weapon',
    moduleName: '挂载检测模块',
    linkedProtocol: null,
    linkedInterface: '挂载变更通知',
    desc: '覆盖挂载/卸载/更换操作在不同挂点和载荷类型下的消息投递验证',
    createdAt: '2026-06-24',
    rows: [
      row('标准挂载-导弹', { 'aircraftId': 'AC-001', 'pylonNo': 1, 'changeType': 'mount', 'loadType': 'missile', 'weight': 320 }),
      row('标准卸载', { 'aircraftId': 'AC-001', 'pylonNo': 1, 'changeType': 'unmount', 'loadType': 'missile', 'weight': 0 }),
      row('更换吊舱', { 'aircraftId': 'AC-002', 'pylonNo': 5, 'changeType': 'swap', 'loadType': 'pod', 'weight': 180 }),
      row('副油箱挂载', { 'aircraftId': 'AC-003', 'pylonNo': 7, 'changeType': 'mount', 'loadType': 'tank', 'weight': 1200 }),
      row('边界-12号挂点', { 'aircraftId': 'AC-001', 'pylonNo': 12, 'changeType': 'mount', 'loadType': 'rocket', 'weight': 85 }),
      row('边界-空载', { 'aircraftId': 'AC-004', 'pylonNo': 3, 'changeType': 'mount', 'loadType': 'empty', 'weight': 0 }),
    ]
  },
  {
    id: dsId(),
    name: '告警事件-消费组配置',
    systemId: 'sys-cmd',
    moduleName: '日志审计模块',
    linkedProtocol: null,
    linkedInterface: '告警事件订阅',
    desc: '不同消费组和偏移重置策略的告警事件订阅测试',
    createdAt: '2026-06-24',
    rows: [
      row('默认消费组-最早偏移', { 'consumerGroup': 'cmd-audit-group', 'autoOffsetReset': 'earliest' }),
      row('独立消费组', { 'consumerGroup': 'cmd-alert-monitor', 'autoOffsetReset': 'earliest' }),
      row('最新偏移', { 'consumerGroup': 'cmd-audit-group', 'autoOffsetReset': 'latest' }),
      row('临时消费组', { 'consumerGroup': 'cmd-debug-session', 'autoOffsetReset': 'earliest' }),
    ]
  },
  {
    id: dsId(),
    name: '航迹分发-多目标场景',
    systemId: 'sys-fire',
    moduleName: '目标跟踪模块',
    linkedProtocol: null,
    linkedInterface: '航迹数据分发',
    desc: '模拟不同目标类型和距离的航迹数据发布到 Kafka',
    createdAt: '2026-06-25',
    rows: [
      row('近距离战斗机', { 'trackId': 1001, 'azimuth': 45.2, 'elevation': 12.5, 'distance': 15000, 'velocity': 340, 'confidence': 0.95 }),
      row('远距离运输机', { 'trackId': 1002, 'azimuth': 180.0, 'elevation': 5.0, 'distance': 280000, 'velocity': 220, 'confidence': 0.82 }),
      row('低空无人机', { 'trackId': 1003, 'azimuth': 90.7, 'elevation': -2.3, 'distance': 3500, 'velocity': 45, 'confidence': 0.91 }),
      row('高速导弹', { 'trackId': 1004, 'azimuth': 270.0, 'elevation': 35.0, 'distance': 120000, 'velocity': 1200, 'confidence': 0.88 }),
      row('边界-最大距离', { 'trackId': 1005, 'azimuth': 0.0, 'elevation': 0.0, 'distance': 500000, 'velocity': 0, 'confidence': 0.5 }),
      row('边界-零距离', { 'trackId': 1006, 'azimuth': 359.9, 'elevation': 89.9, 'distance': 10, 'velocity': 5, 'confidence': 0.99 }),
    ]
  },
  {
    id: dsId(),
    name: '态势广播-实体变更场景',
    systemId: 'sys-cmd',
    moduleName: '态势感知模块',
    linkedProtocol: null,
    linkedInterface: '态势更新广播',
    desc: '模拟新增/更新/移除目标的态势变更广播消息',
    createdAt: '2026-06-25',
    rows: [
      row('新增敌方目标', { 'areaId': 'ZONE-A1', 'changeType': 'add', 'entityId': 2001, 'type': 'hostile', 'lat': 39.9042, 'lon': 116.4074 }),
      row('更新友军位置', { 'areaId': 'ZONE-A1', 'changeType': 'update', 'entityId': 1001, 'type': 'friendly', 'lat': 39.9100, 'lon': 116.4200 }),
      row('移除中性目标', { 'areaId': 'ZONE-B2', 'changeType': 'remove', 'entityId': 3001, 'type': 'neutral', 'lat': 40.0000, 'lon': 116.3000 }),
      row('批量新增', { 'areaId': 'ZONE-C3', 'changeType': 'add', 'entityId': 2002, 'type': 'hostile', 'lat': 38.5000, 'lon': 117.2000 }),
      row('边界-极地坐标', { 'areaId': 'ZONE-D4', 'changeType': 'update', 'entityId': 1002, 'type': 'friendly', 'lat': 89.9999, 'lon': -179.9999 }),
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
