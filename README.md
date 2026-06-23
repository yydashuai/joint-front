# 便携式智能联试工具 — 前端

在一台电脑上通过网口接入被测系统，对接口进行联试：接入连接 → 定义接口协议 → 准备测试数据 → 制定规则 → 组建任务 → 编排执行 → 异常捕捉 → 统计可视化 → 生成报告。本仓库为**前端静态界面**。

## 技术栈

Vue 3 + Vite + Element Plus + Pinia + Vue Router（JavaScript）。

## 本地开发

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器（默认 http://localhost:5173）
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## 目录结构

```
src/
├── main.js                # 入口（Pinia / Router / Element Plus）
├── router/index.js        # 路由：首页 + 9 模块
├── layouts/MainLayout.vue # 左侧图标条 + 顶部菜单
├── stores/                # Pinia 状态（connection / protocol …）
├── components/            # 通用组件（FieldNode 横向树节点等）
└── views/                 # 各模块页面
```

## 模块进度

- ✅ 系统首页 / 工作台
- ✅ 连接管理（节点 / 参数 / 心跳监控）
- ✅ 接口协议管理（协议字段矩阵 + 接口横向树）
- ⏳ 测试数据管理 / 测试任务管理 / 测试执行编排 / 规则管理 / 异常管理 / 统计与可视化 / 联试报告管理（占位，逐步完善）
