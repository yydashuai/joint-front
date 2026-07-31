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

/* ========== 辅助：历史数据行 ========== */
const hr = (label, values, abnormal = false, source = '文件导入', remark = '', excellent = false) => ({
  id: rowId(), label, values, source, savedAt: '2026-06-25', remark, abnormal, excellent
})

/* ========== 测试数据集 ========== */
export const datasets = [
  {
    id: dsId(),
    name: '帧控制位组合示例',
    systemId: 'sys-weapon',
    moduleName: '武器管理模块',
    linkedProtocol: null,
    linkedInterface: '帧控制指令报文',
    desc: '一行生成一个 1 字节帧控制字，演示明文、加密压缩、分片和应答四种发送方式。',
    createdAt: '2026-06-18',
    rows: [
      row('普通 JSON 业务包', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 0 }),
      row('加密压缩二进制包', { '加密标志': 1, '压缩标志': 1, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 1 }),
      row('大载荷分片包', { '加密标志': 1, '压缩标志': 0, '分片标志': 1, '应答标志': 0, '保留位': 0, '数据类型': 1 }),
      row('XML 应答包', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 3 }),
    ],
    historyRows: [
      hr('普通 JSON 业务包', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 0 }),
      hr('加密压缩二进制包', { '加密标志': 1, '压缩标志': 1, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 1 }),
      hr('大载荷分片包', { '加密标志': 1, '压缩标志': 0, '分片标志': 1, '应答标志': 0, '保留位': 0, '数据类型': 1 }),
      hr('XML 应答包', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 3 }),
      hr('保留位越界(异常)', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 0, '保留位': 1, '数据类型': 0 }, true),
      hr('数据类型越界(异常)', { '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 9 }, true),
      hr('加密标志越界(异常)', { '加密标志': 5, '压缩标志': 0, '分片标志': 0, '应答标志': 0, '保留位': 0, '数据类型': 0 }, true),
    ],
  },
  {
    id: dsId(),
    name: '设备遥测与状态附件示例',
    systemId: 'sys-weapon',
    moduleName: '武器管理模块',
    linkedProtocol: null,
    linkedInterface: '查询设备状态报文',
    desc: '接收遥测帧并关联一份文本状态附件，展示位组序流解析结果与流文件在同一报文中的组合使用。',
    createdAt: '2026-06-20',
    rows: [
      row('设备 01 单挂点在线', {
        '设备编号': 1, '遥测计数': 42, '数据长度': 128, '各挂点状态': 1, '校验和': 174,
        'statusPayloadFile': 'fixtures/status/device-01-online.txt',
      }),
      row('设备 07 多挂点在线', {
        '设备编号': 7, '遥测计数': 126, '数据长度': 384, '各挂点状态': 3903, '校验和': 93,
        'statusPayloadFile': 'fixtures/status/device-07-pylons.txt',
      }),
      row('计数回卷前一帧', {
        '设备编号': 32, '遥测计数': 255, '数据长度': 64, '各挂点状态': 0, '校验和': 211,
        'statusPayloadFile': 'fixtures/status/device-32-empty.txt',
      }),
    ],
    historyRows: [
      hr('设备 01 单挂点在线', {
        '设备编号': 1, '遥测计数': 42, '数据长度': 128, '各挂点状态': 1, '校验和': 174,
        'statusPayloadFile': 'fixtures/status/device-01-online.txt',
      }),
      hr('设备 07 多挂点在线', {
        '设备编号': 7, '遥测计数': 126, '数据长度': 384, '各挂点状态': 3903, '校验和': 93,
        'statusPayloadFile': 'fixtures/status/device-07-pylons.txt',
      }),
      hr('设备编号越界(异常)', {
        '设备编号': 33, '遥测计数': 10, '数据长度': 64, '各挂点状态': 0, '校验和': 21,
        'statusPayloadFile': 'fixtures/status/device-33.txt',
      }, true),
      hr('附件缺失(异常)', {
        '设备编号': 3, '遥测计数': 8, '数据长度': 128, '各挂点状态': 5, '校验和': 65,
        'statusPayloadFile': '',
      }, true),
    ],
  },
  {
    id: dsId(),
    name: '解算结果码上报示例',
    systemId: 'sys-fire',
    moduleName: '火控解算模块',
    linkedProtocol: null,
    linkedInterface: '遥测帧上报报文',
    desc: '将标量字段作为完整报文载荷上报，覆盖成功、降级、无解和协议允许的最大结果码。',
    createdAt: '2026-06-22',
    rows: [
      row('解算成功', { 'solutionCode': 0 }),
      row('降级方案可用', { 'solutionCode': 1 }),
      row('目标条件无解', { 'solutionCode': 32 }),
      row('最大结果码', { 'solutionCode': 255 }),
    ],
    historyRows: [
      hr('解算成功', { 'solutionCode': 0 }),
      hr('降级方案可用', { 'solutionCode': 1 }),
      hr('目标条件无解', { 'solutionCode': 32 }),
      hr('最大结果码', { 'solutionCode': 255 }),
      hr('结果码负值(异常)', { 'solutionCode': -1 }, true),
      hr('结果码越界(异常)', { 'solutionCode': 256 }, true),
    ],
  },
  {
    id: dsId(),
    name: '装订参数与矩阵文件示例',
    systemId: 'sys-weapon',
    moduleName: '武器管理模块',
    linkedProtocol: null,
    linkedInterface: '武器装订指令报文',
    desc: '在一条装订报文中组合共识体参数、帧控制位和 CSV/XLSX 结构矩阵文件。',
    createdAt: '2026-06-23',
    rows: [
      row('标准装订·CSV', {
        'fuseMode': 0, 'range': 5000, 'angle': 45,
        '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 0,
        'bindingMatrix': 'fixtures/binding/standard.csv',
      }),
      row('远程装订·XLSX', {
        'fuseMode': 1, 'range': 12000, 'angle': 72.5,
        '加密标志': 1, '压缩标志': 1, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 1,
        'bindingMatrix': 'fixtures/binding/long-range.xlsx',
      }),
      row('分片批量装订·CSV', {
        'fuseMode': 2, 'range': 15000, 'angle': 78.3,
        '加密标志': 1, '压缩标志': 0, '分片标志': 1, '应答标志': 0, '保留位': 0, '数据类型': 1,
        'bindingMatrix': 'fixtures/binding/batch-16x4.csv',
      }),
    ],
    historyRows: [
      hr('标准装订·CSV', {
        'fuseMode': 0, 'range': 5000, 'angle': 45,
        '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 0,
        'bindingMatrix': 'fixtures/binding/standard.csv',
      }),
      hr('远程装订·XLSX', {
        'fuseMode': 1, 'range': 12000, 'angle': 72.5,
        '加密标志': 1, '压缩标志': 1, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 1,
        'bindingMatrix': 'fixtures/binding/long-range.xlsx',
      }),
      hr('结构矩阵类型错误(异常)', {
        'fuseMode': 0, 'range': 5000, 'angle': 45,
        '加密标志': 0, '压缩标志': 0, '分片标志': 0, '应答标志': 1, '保留位': 0, '数据类型': 0,
        'bindingMatrix': 'fixtures/binding/legacy.bin',
      }, true),
    ],
  },
  {
    id: dsId(),
    name: '挂点识别响应示例',
    systemId: 'sys-weapon',
    moduleName: '挂载检测模块',
    linkedProtocol: null,
    linkedInterface: '挂载状态查询报文',
    desc: '按飞机编号发起查询，并展示空挂点、导弹、吊舱和副油箱四类识别帧的解析结果。',
    createdAt: '2026-06-24',
    rows: [
      row('01 号挂点为空', { 'aircraftId': 1001, '挂点编号': 1, '载荷类型': 0, '载荷重量': 0, '锁定状态': 0 }),
      row('02 号挂点导弹锁定', { 'aircraftId': 1001, '挂点编号': 2, '载荷类型': 1, '载荷重量': 185, '锁定状态': 1 }),
      row('06 号挂点吊舱锁定', { 'aircraftId': 1001, '挂点编号': 6, '载荷类型': 3, '载荷重量': 420, '锁定状态': 1 }),
      row('12 号挂点副油箱锁定', { 'aircraftId': 1001, '挂点编号': 12, '载荷类型': 4, '载荷重量': 980, '锁定状态': 1 }),
    ],
  },
  {
    id: dsId(),
    name: '嵌套指挥指令示例',
    systemId: 'sys-fire',
    moduleName: '指挥链路模块',
    linkedProtocol: null,
    linkedInterface: '指挥指令下发报文',
    desc: '演示报文中“指令内容”共识体的展开使用：目标、动作和截止时间与指令类型共同组成发送数据。',
    createdAt: '2026-06-24',
    rows: [
      row('目标跟踪指令', { 'cmdType': 1, 'targetId': 203, 'action': 1, 'deadline': 1785463200, 'solutionCode': 0 }),
      row('火力分配指令', { 'cmdType': 2, 'targetId': 317, 'action': 4, 'deadline': 1785463500, 'solutionCode': 1 }),
      row('任务撤销指令', { 'cmdType': 9, 'targetId': 203, 'action': 0, 'deadline': 1785463800, 'solutionCode': 32 }),
    ],
  },
]

/* ========== 数据文件（历史数据链文件等） ========== */
const DATA_CHAIN_DEMO_CONTENT = `一、MonitoringStatus
任务ID，测控站点编码，信号强度，多普勒频移，链路状态，数据帧计数
1001，21，87，1250，1，45820
1003，22，62，2140，0，12034
1005，23，91，180，1，98230

二、TelemetryFrames
帧序号，任务ID，帧类型编码，温度，电压，电流，姿态角X，姿态角Y，姿态角Z，校验和，帧状态
1，1001，1，23.5，28.4，1.25，0.12，-0.34，1.05，43521，1
2，1001，1，24.1，28.3，1.28，0.15，-0.31，1.02，43987，1
3，1001，2，25.8，28.1，1.42，0.22，-0.28，0.98，44210，1
4，1002，1，22.9，27.9，1.19，-0.08，0.41，2.13，42876，1
5，1002，2，26.3，27.6，1.55，-0.12，0.45，2.20，45032，0
6，1003，1，21.4，28.6，1.08，0.31，0.18，-1.44，41955，1
7，1003，1，21.8，28.5，1.11，0.29，0.21，-1.40，42107，1
8，1004，3，30.2，26.8，1.87，0.55，-0.62，3.08，46844，0
9，1004，1，23.0，28.2，1.22，0.51，-0.58，3.01，43390，1
10，1005，1，19.6，29.1，0.95，0.02，0.05，0.11，40788，1
11，1005，2，20.3，29.0，1.02，0.04，0.03，0.09，41246，1
12，1006，1，24.7，28.0，1.31，-0.25，0.37，1.88，44573，1`

export const files = [
  {
    id: fileId(),
    name: '数据链演示文件.dat',
    format: 'bin',
    size: 1200,
    systemId: 'sys-weapon',
    moduleId: null,
    moduleName: '武器管理模块',
    desc: '数据链文件（2 个报文 / 15 条数据），可点击「解析」重新导入',
    uploadedAt: '2026-07-30 09:00',
    rowCount: 15,
    content: DATA_CHAIN_DEMO_CONTENT
  }
]
