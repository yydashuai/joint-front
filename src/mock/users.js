/**
 * Mock 用户与权限数据种子文件
 * 仅管理员可创建账号，无开放注册
 */

/* ========== 用户列表 ========== */
export const users = [
  {
    id: 'u-admin',
    username: 'admin',
    password: 'admin123',
    realName: '张管理',
    role: 'admin',
    phone: '138-0000-0001',
    email: 'admin@joint-test.local',
    avatar: '',
    status: 'active',
    lastLogin: '2026-06-24 09:30',
    createdAt: '2026-01-01'
  },
  {
    id: 'u-tester1',
    username: 'tester01',
    password: 'test123',
    realName: '李测试',
    role: 'tester',
    phone: '138-0000-0002',
    email: 'tester01@joint-test.local',
    avatar: '',
    status: 'active',
    lastLogin: '2026-06-23 14:20',
    createdAt: '2026-02-15'
  },
  {
    id: 'u-tester2',
    username: 'tester02',
    password: 'test123',
    realName: '王测试',
    role: 'tester',
    phone: '138-0000-0003',
    email: '',
    avatar: '',
    status: 'disabled',
    lastLogin: '2026-05-10 16:45',
    createdAt: '2026-03-01'
  },
  {
    id: 'u-tester3',
    username: 'tester03',
    password: 'test123',
    realName: '赵联试',
    role: 'tester',
    phone: '138-0000-0004',
    email: '',
    avatar: '',
    status: 'active',
    lastLogin: '2026-06-24 08:15',
    createdAt: '2026-04-10'
  }
]

/* ========== 权限表（仅 tester 需要记录，admin 天然全权限） ========== */
export const permissions = [
  { userId: 'u-tester1', systemIds: ['sys-weapon'] },
  { userId: 'u-tester2', systemIds: ['sys-weapon', 'sys-fire-control'] },
  { userId: 'u-tester3', systemIds: ['sys-weapon', 'sys-fire-control', 'sys-radar', 'sys-comm'] }
]

/* ========== 系统配置默认值（管理员在设置页调整） ========== */
export const systemConfig = {
  network: {
    pingInterval: 5000,
    pingTimeout: 3000,
    autoReconnect: 3
  },
  log: {
    retentionDays: 30,
    level: 'all'
  },
  notification: {
    alertNotify: true,
    offlineNotify: true
  }
}

/* ========== 工具函数 ========== */
let _seq = 100
export const nextUserId = () => `u-${++_seq}`
