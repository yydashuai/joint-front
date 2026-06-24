<template>
  <div class="page conn">
    <div class="page__header">
      <div>
        <h2>链路连接管理</h2>
        <div class="page__desc">
          内网链路探测 · 先选择被测系统，再检测其下各模块链路是否通畅
        </div>
      </div>
      <div class="header-actions">
        <el-tag type="info" effect="plain" round>角色：管理员 / 测试员</el-tag>
        <el-button :icon="Setting" @click="systemManagerVisible = true">管理系统</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建模块</el-button>
      </div>
    </div>

    <!-- 系统选择 + 链路拓扑图 -->
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
            <span class="sys-bar__chip"><b>在线</b>{{ store.onlineCount }} / {{ visibleModules.length }}</span>
            <span class="sys-bar__desc">{{ systemStore.current.desc }}</span>
          </template>
          <template v-else>
            <span class="sys-bar__chip"><b>全部系统</b>跨系统总览</span>
            <span class="sys-bar__chip"><b>模块</b>{{ visibleModules.length }}</span>
            <span class="sys-bar__chip"><b>在线</b>{{ store.onlineCount }} / {{ visibleModules.length }}</span>
          </template>
          <span class="sys-bar__auto is-on">
            <span class="sys-bar__auto-dot" />
            自动检测连通性（每 5 秒）
          </span>
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
          @ping="pingModule"
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
              <div class="node-item__desc">{{ n.desc || '暂无说明' }}</div>
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
            <span>链路参数配置 · {{ sel.name }}</span>
            <el-tag :type="statusMeta[sel.status].tag" effect="light">{{ statusMeta[sel.status].text }}</el-tag>
          </div>
        </template>

        <el-form ref="formRef" :model="sel" :rules="rules" label-width="104px" class="cfg-form">
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
            <el-col :span="24">
              <el-form-item label="说明信息" prop="desc">
                <el-input v-model="sel.desc" type="textarea" :rows="2" maxlength="120" show-word-limit placeholder="描述该模块链路用途，如 火控解算与目标分配数据链路" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <!-- 连通性检测 -->
        <div class="ping-bar">
          <span class="ping-bar__note">系统每 5 秒自动检测一次链路；手动检测将发送 4 个探测包确认链路是否通畅</span>
          <div class="ping-bar__btns">
            <el-button type="primary" :icon="Pointer" :loading="sel.status === 'pinging'" @click="handlePing">检测连通性</el-button>
            <el-button @click="saveParams">保存参数</el-button>
            <el-popconfirm title="确认删除该模块？" @confirm="handleRemove">
              <template #reference>
                <el-button :icon="Delete" plain>删除模块</el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>

        <!-- 连通性检测输出 -->
        <div class="ping-out">
          <div class="ping-out__head">
            <span class="ping-out__title">连通性检测输出</span>
            <el-tag :type="statusMeta[sel.status].tag" size="small" effect="light">{{ statusMeta[sel.status].text }}</el-tag>
            <span v-if="sel.status === 'online' && sel.latency" class="ping-out__latency">平均时延 {{ sel.latency }}ms</span>
            <span class="ping-out__spacer" />
            <el-button v-if="sel.pingLog.length" link size="small" @click="sel.pingLog = []">清空</el-button>
          </div>
          <pre v-if="sel.pingLog.length" class="ping-out__body">{{ sel.pingLog.join('\n') }}</pre>
          <el-empty v-else description="点击「检测连通性」查看链路探测结果" :image-size="56" />
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
        <el-form-item label="说明信息" prop="desc">
          <el-input v-model="draft.desc" type="textarea" :rows="2" maxlength="120" show-word-limit placeholder="描述该模块链路用途" />
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
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Search, Pointer, Delete, Setting } from '@element-plus/icons-vue'
import SystemManager from '@/components/SystemManager.vue'
import ConnectionTopology from '@/components/ConnectionTopology.vue'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'

const store = useConnectionStore()
const systemStore = useSystemStore()
const UNASSIGNED_KEY = '__unassigned__'
const ALL_KEY = '__all__'

// 内网链路只有“通 / 不通”两态（绿灯 / 灰灯），pinging 为探测中的过渡态
const statusMeta = {
  online: { text: '在线', tag: 'success' },
  offline: { text: '离线', tag: 'info' },
  pinging: { text: '检测中', tag: 'warning' }
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
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }]
}

// 列表先按被测系统过滤，再叠加关键字搜索。
const keyword = ref('')
const filteredModules = computed(() => {
  const k = keyword.value.trim().toLowerCase()
  if (!k) return visibleModules.value
  return visibleModules.value.filter((n) => n.name.toLowerCase().includes(k) || n.ip.includes(k))
})

// 手动检测连通性（4 次）：拓扑图与配置区共用
const pingModule = (module) => {
  if (module) store.ping(module.id, 4)
}
const handlePing = () => pingModule(sel.value)

// 自动检测：系统每 5 秒静默探测当前可见模块，刷新灯色（绿/灰），不可由用户开关
let autoTimer = null
const AUTO_INTERVAL = 5000
onMounted(() => {
  autoTimer = setInterval(() => {
    visibleModules.value.forEach((m) => store.autoPing(m.id))
  }, AUTO_INTERVAL)
})
onBeforeUnmount(() => clearInterval(autoTimer))

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
  desc: ''
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
/* 用 min-height 而非固定 100%：内容变高时整页（工作区）出现滚动条 */
.conn { min-height: 100%; }

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
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;
  }
  &__auto {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--el-text-color-secondary);
    .sys-bar__auto-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--el-text-color-placeholder);
    }
    &.is-on .sys-bar__auto-dot {
      background: var(--el-color-success);
      box-shadow: 0 0 0 3px var(--el-color-success-light-7);
      animation: pulse 1.4s infinite;
    }
  }
}
/* 拓扑图封顶 + 内部滚动：拓扑再大也不会把下方列表/配置挤掉 */
.topo-wrap { max-height: min(400px, 48vh); overflow: auto; }

/* 模块列表 + 配置 */
.conn-body {
  /* 行高由配置卡片内容决定（列表滚动区绝对定位、不撑高行高）；列表与配置等高，超出内部滚动 */
  flex-shrink: 0;
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
  width: 420px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
/* 列表滚动区绝对填充卡片正文，不参与撑高，使列表高度跟随配置卡片 */
.node-list :deep(.el-card__body) { position: relative; }
.node-scroll { position: absolute; inset: 0; }
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
  &__sub { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
  &__desc {
    font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .system-tag { flex-shrink: 0; }
}

/* 链路只有绿灯（通）和灰灯（不通），pinging 时灰灯脉冲 */
.dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0;
  &--online { background: var(--el-color-success); box-shadow: 0 0 0 3px var(--el-color-success-light-7); }
  &--offline { background: var(--el-text-color-placeholder); }
  &--pinging { background: var(--el-text-color-placeholder); animation: pulse 1s infinite; }
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

.cfg-card { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.detail-empty { flex: 1; }
.w-full { width: 100%; }
.cfg-form :deep(.el-form-item) { margin-bottom: 16px; }

/* 连通性检测操作条 */
.ping-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
  padding: 10px 12px; margin-bottom: 12px;
  background: var(--el-fill-color-lighter); border-radius: 8px;
  &__note { font-size: 12px; color: var(--el-text-color-secondary); flex: 1; min-width: 200px; }
  &__btns { display: flex; gap: 10px; flex-shrink: 0; }
}

/* Ping 输出 */
.ping-out {
  &__head {
    display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
  }
  &__title { font-size: 14px; font-weight: 600; }
  &__latency { font-size: 12px; color: var(--el-text-color-secondary); }
  &__spacer { flex: 1; }
  &__body {
    margin: 0; padding: 12px 14px;
    background: #1e1e1e; color: #d4d4d4;
    border-radius: 8px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 12.5px; line-height: 1.7;
    white-space: pre-wrap; word-break: break-all;
    /* 固定高度 149 + 上下内边距 12×2 = 173px（box-sizing: border-box），输出超出时内部滚动 */
    height: 173px; overflow: auto;
  }
  /* 空态与输出框同高，避免检测前后列表高度跳动 */
  :deep(.el-empty) { height: 173px; padding: 0; box-sizing: border-box; }
}
</style>
