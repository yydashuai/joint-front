<template>
  <div class="page conn">
    <div class="page__header">
      <div>
        <h2>连接管理</h2>
        <div class="page__desc">网口接入被测系统 · 当前已连接 {{ store.connectedCount }} / {{ store.nodes.length }} 个节点</div>
      </div>
      <div class="header-actions">
        <el-tag type="info" effect="plain" round>角色：管理员 / 测试员</el-tag>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建连接</el-button>
      </div>
    </div>

    <div class="conn-body">
      <!-- 左：被测节点 / 会话列表 -->
      <el-card class="node-list" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
        <template #header>
          <div class="card-head">
            <span>被测节点 / 会话</span>
            <el-input v-model="keyword" :prefix-icon="Search" size="small" placeholder="搜索名称 / IP" clearable class="search" />
          </div>
        </template>

        <el-scrollbar class="node-scroll">
          <div
            v-for="n in filteredNodes"
            :key="n.id"
            class="node-item"
            :class="{ 'is-active': n.id === store.selectedId }"
            @click="store.select(n.id)"
          >
            <span class="dot" :class="`dot--${n.status}`" />
            <div class="node-item__main">
              <div class="node-item__name">{{ n.name }}</div>
              <div class="node-item__sub">{{ n.ip }}:{{ n.port }}</div>
            </div>
            <el-tag size="small" effect="plain" class="proto-tag">{{ n.protocol }}</el-tag>
            <el-tag size="small" :type="statusMeta[n.status].tag" effect="light">{{ statusMeta[n.status].text }}</el-tag>
          </div>
          <el-empty v-if="!filteredNodes.length" description="无匹配节点" :image-size="80" />
        </el-scrollbar>
      </el-card>

      <!-- 右：详情（参数配置 + 心跳监控） -->
      <div class="detail" v-if="sel">
        <!-- 参数配置 -->
        <el-card shadow="never" class="cfg-card">
          <template #header>
            <div class="card-head">
              <span>连接参数配置 · {{ sel.name }}</span>
              <el-tag :type="statusMeta[sel.status].tag" effect="light">{{ statusMeta[sel.status].text }}</el-tag>
            </div>
          </template>

          <el-form ref="formRef" :model="sel" :rules="rules" label-width="104px" :disabled="isLocked" class="cfg-form">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="节点名称" prop="name">
                  <el-input v-model="sel.name" placeholder="如 分系统A-主控" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="协议类型" prop="protocol">
                  <el-select v-model="sel.protocol" class="w-full">
                    <el-option v-for="p in protocols" :key="p" :label="p" :value="p" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="目标 IP" prop="ip">
                  <el-input v-model="sel.ip" placeholder="192.168.1.x" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="端口" prop="port">
                  <el-input-number v-model="sel.port" :min="1" :max="65535" controls-position="right" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="超时(ms)" prop="timeout">
                  <el-input-number v-model="sel.timeout" :min="100" :max="60000" :step="500" controls-position="right" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="自动重连">
                  <el-switch v-model="sel.reconnect.enabled" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="重连次数">
                  <el-input-number v-model="sel.reconnect.retries" :min="0" :max="20" :disabled="!sel.reconnect.enabled" controls-position="right" class="w-full" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="重连间隔(ms)">
                  <el-input-number v-model="sel.reconnect.interval" :min="200" :max="30000" :step="500" :disabled="!sel.reconnect.enabled" controls-position="right" class="w-full" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <div class="cfg-actions">
            <el-alert v-if="isLocked" type="warning" :closable="false" show-icon class="lock-tip">
              连接进行中，如需修改参数请先断开连接
            </el-alert>
            <div class="cfg-actions__btns">
              <el-button :disabled="isLocked" @click="saveParams">保存参数</el-button>
              <el-button
                v-if="sel.status !== 'connected'"
                type="success"
                :icon="VideoPlay"
                :loading="sel.status === 'connecting'"
                @click="handleConnect"
              >建立连接</el-button>
              <el-button v-else type="danger" :icon="SwitchButton" @click="handleDisconnect">断开连接</el-button>
              <el-popconfirm title="确认删除该节点？" @confirm="handleRemove">
                <template #reference>
                  <el-button :icon="Delete" plain>删除节点</el-button>
                </template>
              </el-popconfirm>
            </div>
          </div>
        </el-card>

        <!-- 心跳监控 -->
        <el-card shadow="never" class="hb-card" :body-style="{ flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
          <template #header>连接状态与心跳监控（每 1s）</template>

          <div class="hb-stats">
            <div class="hb-stat">
              <span class="hb-stat__label">连接状态</span>
              <span class="hb-stat__value"><span class="dot" :class="`dot--${sel.status}`" /> {{ statusMeta[sel.status].text }}</span>
            </div>
            <div class="hb-stat">
              <span class="hb-stat__label">当前时延</span>
              <span class="hb-stat__value">{{ sel.status === 'connected' ? sel.latency + ' ms' : '—' }}</span>
            </div>
            <div class="hb-stat">
              <span class="hb-stat__label">发送 / 接收</span>
              <span class="hb-stat__value">{{ sel.sendCount }} / {{ sel.recvCount }}</span>
            </div>
            <div class="hb-stat">
              <span class="hb-stat__label">异常计数</span>
              <span class="hb-stat__value" :class="{ 'is-error': sel.errorCount > 0 }">{{ sel.errorCount }}</span>
            </div>
          </div>

          <div class="hb-wave">
            <svg viewBox="0 0 600 140" preserveAspectRatio="none" class="hb-wave__svg">
              <defs>
                <linearGradient id="hbFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--el-color-primary)" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="var(--el-color-primary)" stop-opacity="0" />
                </linearGradient>
              </defs>
              <template v-if="wavePoints">
                <polygon :points="`8,132 ${wavePoints} 592,132`" fill="url(#hbFill)" />
                <polyline :points="wavePoints" fill="none" stroke="var(--el-color-primary)" stroke-width="2" />
              </template>
              <text v-else x="300" y="74" text-anchor="middle" class="hb-wave__empty">未连接 · 无心跳数据</text>
            </svg>
          </div>
        </el-card>
      </div>

      <el-empty v-else class="detail-empty" description="请选择左侧节点，或新建连接" />
    </div>

    <!-- 新建连接 -->
    <el-dialog v-model="dialogVisible" title="新建连接" width="520px">
      <el-form ref="createRef" :model="draft" :rules="rules" label-width="92px">
        <el-form-item label="节点名称" prop="name">
          <el-input v-model="draft.name" placeholder="如 分系统D-指控" />
        </el-form-item>
        <el-form-item label="协议类型" prop="protocol">
          <el-select v-model="draft.protocol" class="w-full">
            <el-option v-for="p in protocols" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="14">
            <el-form-item label="目标 IP" prop="ip">
              <el-input v-model="draft.ip" placeholder="192.168.1.x" />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="端口" prop="port" label-width="56px">
              <el-input-number v-model="draft.port" :min="1" :max="65535" controls-position="right" class="w-full" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="超时(ms)" prop="timeout">
          <el-input-number v-model="draft.timeout" :min="100" :max="60000" :step="500" controls-position="right" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, VideoPlay, SwitchButton, Delete } from '@element-plus/icons-vue'
import { useConnectionStore } from '@/stores/connection'

const store = useConnectionStore()
const sel = computed(() => store.selected)

const protocols = ['TCP', 'UDP', 'HTTP', 'gRPC']
const statusMeta = {
  disconnected: { text: '未连接', tag: 'info' },
  connecting: { text: '连接中', tag: 'warning' },
  connected: { text: '已连接', tag: 'success' },
  error: { text: '异常', tag: 'danger' }
}

const isLocked = computed(() => sel.value && sel.value.status !== 'disconnected')

const ipRule = (rule, value, cb) => {
  const ok = /^(\d{1,3})(\.\d{1,3}){3}$/.test(value) && value.split('.').every((s) => +s <= 255)
  ok ? cb() : cb(new Error('请输入合法 IP 地址'))
}
const rules = {
  name: [{ required: true, message: '请输入节点名称', trigger: 'blur' }],
  protocol: [{ required: true, message: '请选择协议类型', trigger: 'change' }],
  ip: [{ required: true, validator: ipRule, trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  timeout: [{ required: true, message: '请输入超时时间', trigger: 'blur' }]
}

// 列表搜索
const keyword = ref('')
const filteredNodes = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return store.nodes
  return store.nodes.filter((n) => n.name.toLowerCase().includes(k) || n.ip.includes(k))
})

// 参数配置操作
const formRef = ref()
const saveParams = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (valid) ElMessage.success('参数已保存')
  })
}
const handleConnect = async () => {
  await formRef.value.validate((valid) => {
    if (!valid) return
    store.connect(sel.value.id)
    ElMessage.success(`正在建立 ${sel.value.protocol} 连接 ${sel.value.ip}:${sel.value.port}`)
  })
}
const handleDisconnect = () => {
  store.disconnect(sel.value.id)
  ElMessage.info('连接已断开')
}
const handleRemove = () => {
  const name = sel.value.name
  store.remove(sel.value.id)
  ElMessage.success(`已删除节点 ${name}`)
}

// 新建连接
const dialogVisible = ref(false)
const createRef = ref()
const blankDraft = () => ({ name: '', protocol: 'TCP', ip: '192.168.1.', port: 8080, timeout: 3000 })
const draft = reactive(blankDraft())
const openCreate = () => {
  Object.assign(draft, blankDraft())
  dialogVisible.value = true
}
const confirmCreate = async () => {
  await createRef.value.validate((valid) => {
    if (!valid) return
    store.add({ ...draft })
    dialogVisible.value = false
    ElMessage.success(`已新建节点 ${draft.name}`)
  })
}

// 心跳波形
const wavePoints = computed(() => {
  const w = sel.value?.wave || []
  if (w.length < 2) return ''
  const W = 600, H = 140, pad = 8, slots = 40, max = 60
  const step = (W - pad * 2) / (slots - 1)
  return w
    .map((v, i) => {
      const x = pad + i * step
      const y = H - pad - (v / max) * (H - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

// 1s 心跳定时器
let timer = null
onMounted(() => {
  timer = setInterval(() => store.tick(), 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.conn { height: 100%; }

.header-actions { display: flex; align-items: center; gap: 12px; }

.conn-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  .search { width: 160px; }
}

/* 节点列表 */
.node-list {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.node-scroll { height: 100%; }
.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.15s;

  &:hover { background: var(--el-fill-color-light); }
  &.is-active { background: var(--el-color-primary-light-9); border-left-color: var(--el-color-primary); }

  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__sub { font-size: 12px; color: var(--el-text-color-secondary); }
  .proto-tag { flex-shrink: 0; }
}

/* 状态点 */
.dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0;
  &--connected { background: var(--el-color-success); box-shadow: 0 0 0 3px var(--el-color-success-light-7); }
  &--connecting { background: var(--el-color-warning); animation: pulse 1s infinite; }
  &--disconnected { background: var(--el-text-color-placeholder); }
  &--error { background: var(--el-color-danger); }
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* 详情区 */
.detail { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.detail-empty { flex: 1; }
.cfg-card { flex-shrink: 0; }
.w-full { width: 100%; }
.cfg-form :deep(.el-form-item) { margin-bottom: 16px; }

.cfg-actions {
  display: flex; flex-direction: column; gap: 12px;
  .lock-tip { padding: 6px 10px; }
  &__btns { display: flex; gap: 10px; }
}

/* 心跳监控 */
.hb-card { flex: 1; display: flex; flex-direction: column; }
.hb-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;
}
.hb-stat {
  background: var(--el-fill-color-light); border-radius: 8px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 6px;
  &__label { font-size: 12px; color: var(--el-text-color-secondary); }
  &__value { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
  &__value.is-error { color: var(--el-color-danger); }
}
.hb-wave {
  flex: 1; min-height: 120px;
  border: 1px dashed var(--el-border-color); border-radius: 8px;
  background: var(--el-fill-color-blank); overflow: hidden;
  &__svg { width: 100%; height: 100%; display: block; }
  &__empty { fill: var(--el-text-color-placeholder); font-size: 13px; }
}
</style>
