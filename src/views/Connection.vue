<template>
  <div class="page conn">
    <div class="page__header">
      <div>
        <h2>连接管理</h2>
        <div class="page__desc">
          网口接入被测系统 · 先选择被测系统，再配置其下模块
        </div>
      </div>
      <div class="header-actions">
        <el-tag type="info" effect="plain" round>角色：管理员 / 测试员</el-tag>
        <el-button :icon="Setting" @click="systemManagerVisible = true">管理系统</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建模块</el-button>
      </div>
    </div>

    <!-- 系统选择 + 连接拓扑图 -->
    <el-card class="sys-card" shadow="never" :body-style="{ padding: '14px 16px' }">
      <div class="sys-bar">
        <div class="sys-bar__pick">
          <span class="sys-bar__label">被测系统</span>
          <el-select v-model="pageSystemKey" class="sys-bar__select" placeholder="选择被测系统">
            <el-option
              v-for="option in systemStore.options"
              :key="option.value ?? 'all'"
              :label="option.label"
              :value="option.value ?? ALL_KEY"
            />
          </el-select>
        </div>
        <div class="sys-bar__info">
          <template v-if="systemStore.current">
            <span class="sys-bar__chip"><b>负责人</b>{{ systemStore.current.owner || '—' }}</span>
            <span class="sys-bar__chip"><b>模块</b>{{ visibleModules.length }}</span>
            <span class="sys-bar__chip"><b>已连接</b>{{ store.connectedCount }} / {{ visibleModules.length }}</span>
            <span class="sys-bar__desc">{{ systemStore.current.desc }}</span>
          </template>
          <template v-else>
            <span class="sys-bar__chip"><b>全部系统</b>跨系统总览</span>
            <span class="sys-bar__chip"><b>模块</b>{{ visibleModules.length }}</span>
            <span class="sys-bar__chip"><b>已连接</b>{{ store.connectedCount }} / {{ visibleModules.length }}</span>
          </template>
        </div>
      </div>

      <el-divider class="sys-card__divider" />

      <div class="topo-wrap">
        <ConnectionTopology
          :modules="visibleModules"
          :groups="topoGroups"
          :grouped="systemStore.isAll"
          :hub-label="hubLabel"
          :selected-id="store.selectedId"
          @select="store.select"
          @select-system="onSelectSystem"
          @connect="connectModule"
          @disconnect="disconnectModule"
        />
      </div>
    </el-card>

    <!-- 模块列表 + 参数配置 -->
    <div class="conn-body">
      <el-card class="node-list" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
        <template #header>
          <div class="card-head">
            <span>模块列表</span>
            <el-input v-model="keyword" :prefix-icon="Search" size="small" placeholder="搜索名称 / IP" clearable class="search" />
          </div>
        </template>

        <el-scrollbar class="node-scroll">
          <div
            v-for="n in filteredModules"
            :key="n.id"
            class="node-item"
            :class="{ 'is-active': n.id === store.selectedId }"
            @click="store.select(n.id)"
          >
            <span class="dot" :class="`dot--${n.status}`" />
            <div class="node-item__main">
              <div class="node-item__name">
                <span>{{ n.name }}</span>
                <el-tag v-if="systemStore.isAll" size="small" effect="plain" class="system-tag">{{ moduleSystemName(n) }}</el-tag>
              </div>
              <div class="node-item__sub">{{ n.ip }}:{{ n.port }}</div>
            </div>
            <el-tag size="small" :type="statusMeta[n.status].tag" effect="light">{{ statusMeta[n.status].text }}</el-tag>
          </div>
          <el-empty v-if="!filteredModules.length" description="无匹配模块" :image-size="80" />
        </el-scrollbar>
      </el-card>

      <!-- 参数配置 -->
      <el-card v-if="sel" shadow="never" class="cfg-card" :body-style="{ flex: '1', minHeight: '0', overflow: 'auto' }">
        <template #header>
          <div class="card-head">
            <span>连接参数配置 · {{ sel.name }}</span>
            <el-tag :type="statusMeta[sel.status].tag" effect="light">{{ statusMeta[sel.status].text }}</el-tag>
          </div>
        </template>

        <el-form ref="formRef" :model="sel" :rules="rules" label-width="104px" :disabled="isLocked" class="cfg-form">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="模块名称" prop="name">
                <el-input v-model="sel.name" placeholder="如 主控服务" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="所属系统" prop="systemId">
                <el-select v-model="selectedModuleSystemKey" class="w-full" placeholder="选择所属系统">
                  <el-option v-for="option in moduleSystemOptions" :key="option.value ?? 'none'" :label="option.label" :value="option.value" />
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
            <el-button v-else type="danger" :icon="SwitchButton" @click="disconnectModule(sel)">断开连接</el-button>
            <el-popconfirm title="确认删除该模块？" @confirm="handleRemove">
              <template #reference>
                <el-button :icon="Delete" plain>删除模块</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </el-card>

      <el-empty v-else class="detail-empty" description="当前系统下暂无模块，请新建模块或切换被测系统" />
    </div>

    <!-- 新建模块 -->
    <el-dialog v-model="dialogVisible" title="新建模块" width="540px">
      <el-form ref="createRef" :model="draft" :rules="rules" label-width="92px">
        <el-form-item label="模块名称" prop="name">
          <el-input v-model="draft.name" placeholder="如 结算服务" />
        </el-form-item>
        <el-form-item label="所属系统" prop="systemId">
          <el-select v-model="draftSystemKey" class="w-full" placeholder="选择所属系统">
            <el-option v-for="option in moduleSystemOptions" :key="option.value ?? 'none'" :label="option.label" :value="option.value" />
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

    <SystemManager v-model="systemManagerVisible" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, VideoPlay, SwitchButton, Delete, Setting } from '@element-plus/icons-vue'
import SystemManager from '@/components/SystemManager.vue'
import ConnectionTopology from '@/components/ConnectionTopology.vue'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'

const store = useConnectionStore()
const systemStore = useSystemStore()
const UNASSIGNED_KEY = '__unassigned__'
const ALL_KEY = '__all__'

const statusMeta = {
  disconnected: { text: '未连接', tag: 'info' },
  connecting: { text: '连接中', tag: 'warning' },
  connected: { text: '已连接', tag: 'success' },
  error: { text: '异常', tag: 'danger' }
}

// 页面内被测系统选择（与顶部栏同源，冗余便于操作）
const pageSystemKey = computed({
  get: () => systemStore.currentId ?? ALL_KEY,
  set: (v) => systemStore.setCurrent(v === ALL_KEY ? null : v)
})
const hubLabel = computed(() => systemStore.current?.name ?? '全部系统')

const moduleSystemOptions = computed(() => [
  ...systemStore.systems.map((system) => ({ label: system.name, value: system.id })),
  { label: '未分配', value: UNASSIGNED_KEY }
])
const visibleModules = computed(() => store.modulesOf(systemStore.currentId))

// 全部系统模式：按系统分组（含"未分配"组）供拓扑图展示
const topoGroups = computed(() => {
  const groups = systemStore.systems.map((s) => ({
    id: s.id,
    name: s.name,
    modules: store.nodes.filter((n) => n.systemId === s.id)
  }))
  const unassigned = store.nodes.filter((n) => n.systemId == null)
  if (unassigned.length) groups.push({ id: UNASSIGNED_KEY, name: '未分配', modules: unassigned })
  return groups
})
const onSelectSystem = (id) => {
  if (systemStore.systems.some((s) => s.id === id)) systemStore.setCurrent(id)
}
const sel = computed(() => visibleModules.value.find((module) => module.id === store.selectedId) || null)
const isLocked = computed(() => sel.value && sel.value.status !== 'disconnected')

const moduleSystemName = (module) => systemStore.systems.find((system) => system.id === module.systemId)?.name || '未分配'
const selectedModuleSystemKey = computed({
  get: () => sel.value?.systemId ?? UNASSIGNED_KEY,
  set: (id) => {
    if (sel.value) sel.value.systemId = id === UNASSIGNED_KEY ? null : id
  }
})

watch(
  () => visibleModules.value.map((module) => module.id).join(','),
  () => {
    if (!visibleModules.value.some((module) => module.id === store.selectedId)) {
      store.select(visibleModules.value[0]?.id ?? null)
    }
  },
  { immediate: true }
)

const ipRule = (rule, value, cb) => {
  const ok = /^(\d{1,3})(\.\d{1,3}){3}$/.test(value) && value.split('.').every((s) => +s <= 255)
  ok ? cb() : cb(new Error('请输入合法 IP 地址'))
}
const rules = {
  name: [{ required: true, message: '请输入模块名称', trigger: 'blur' }],
  ip: [{ required: true, validator: ipRule, trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }],
  timeout: [{ required: true, message: '请输入超时时间', trigger: 'blur' }]
}

// 列表先按被测系统过滤，再叠加关键字搜索。
const keyword = ref('')
const filteredModules = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return visibleModules.value
  return visibleModules.value.filter((n) => n.name.toLowerCase().includes(k) || n.ip.includes(k))
})

// 连接 / 断开（成功失败均 toast）
const connectModule = async (module) => {
  if (!module) return
  const ok = await store.connect(module.id)
  if (ok) ElMessage.success(`连接成功：${module.name}（${module.ip}:${module.port}）`)
  else ElMessage.error(`连接失败：${module.name}（${module.ip}:${module.port}）`)
}
const disconnectModule = (module) => {
  if (!module) return
  store.disconnect(module.id)
  ElMessage.info(`已断开连接：${module.name}`)
}
const handleConnect = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  await connectModule(sel.value)
}

// 参数配置操作
const formRef = ref()
const saveParams = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (valid) ElMessage.success('参数已保存')
  })
}
const handleRemove = () => {
  const name = sel.value.name
  store.remove(sel.value.id)
  ElMessage.success(`已删除模块 ${name}`)
}

// 新建模块
const dialogVisible = ref(false)
const systemManagerVisible = ref(false)
const createRef = ref()
const defaultSystemId = () => systemStore.currentId ?? systemStore.systems[0]?.id ?? null
const blankDraft = () => ({
  systemId: defaultSystemId(),
  name: '',
  ip: '192.168.1.',
  port: 8080,
  timeout: 3000
})
const draft = reactive(blankDraft())
const draftSystemKey = computed({
  get: () => draft.systemId ?? UNASSIGNED_KEY,
  set: (id) => {
    draft.systemId = id === UNASSIGNED_KEY ? null : id
  }
})
const openCreate = () => {
  Object.assign(draft, blankDraft())
  createRef.value?.clearValidate()
  dialogVisible.value = true
}
const confirmCreate = async () => {
  await createRef.value.validate((valid) => {
    if (!valid) return
    const created = store.add({ ...draft })
    store.select(created.id)
    dialogVisible.value = false
    ElMessage.success(`已新建模块 ${draft.name}`)
  })
}
</script>

<style scoped lang="scss">
.conn { height: 100%; }

.header-actions { display: flex; align-items: center; gap: 12px; }

/* 系统选择 + 拓扑图 */
.sys-card { flex-shrink: 0; }
.sys-card__divider { margin: 12px 0; }
.sys-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  &__pick { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  &__label { font-size: 14px; font-weight: 600; }
  &__select { width: 240px; }
  &__info { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; min-width: 0; }
  &__chip {
    font-size: 13px; color: var(--el-text-color-regular);
    b { color: var(--el-text-color-secondary); font-weight: 400; margin-right: 6px; }
  }
  &__desc {
    font-size: 12px; color: var(--el-text-color-secondary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px;
  }
}
.topo-wrap { overflow-x: auto; }

/* 模块列表 + 配置 */
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

.node-list {
  width: 360px;
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
  &__name {
    display: flex; align-items: center; gap: 6px;
    font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden;
  }
  &__name > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  &__sub { font-size: 12px; color: var(--el-text-color-secondary); }
  .system-tag { flex-shrink: 0; }
}

.dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0;
  &--connected { background: var(--el-color-success); box-shadow: 0 0 0 3px var(--el-color-success-light-7); }
  &--connecting { background: var(--el-color-warning); animation: pulse 1s infinite; }
  &--disconnected { background: var(--el-text-color-placeholder); }
  &--error { background: var(--el-color-danger); }
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.cfg-card { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.detail-empty { flex: 1; }
.w-full { width: 100%; }
.cfg-form :deep(.el-form-item) { margin-bottom: 16px; }

.cfg-actions {
  display: flex; flex-direction: column; gap: 12px;
  .lock-tip { padding: 6px 10px; }
  &__btns { display: flex; gap: 10px; }
}
</style>
