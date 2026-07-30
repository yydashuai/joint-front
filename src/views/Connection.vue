<template>
  <div class="page conn">
    <div class="page__header">
      <div>
        <h2>链路连接管理</h2>
      </div>
      <div class="header-actions">
        <el-tooltip content="打开被测系统管理对话框"><el-button :icon="Setting" @click="systemManagerVisible = true">管理系统</el-button></el-tooltip>
        <el-tooltip content="创建一个新的链路模块"><el-button type="primary" :icon="Plus" @click="openCreate">新建模块</el-button></el-tooltip>
      </div>
    </div>

    <!-- 左：IDE 层级树 ｜ 右：拓扑图 + 参数配置 -->
    <div class="conn-layout">
      <SystemModuleTree
        class="conn-tree"
        :model-value="`mod-${store.selectedId}`"
        title="系统 · 模块"
        empty-text="暂无系统/模块，请新建系统或新建模块"
        @select="onTreeSelect"
      />

      <div class="conn-main">
        <!-- 链路拓扑 -->
        <el-card class="topo-card" shadow="never" :body-style="{ padding: '0' }">
          <template #header>
            <div class="card-head">
              <span>链路拓扑</span>
            </div>
          </template>
          <PanZoomCanvas :height="360" title="链路拓扑">
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
          </PanZoomCanvas>
        </el-card>

        <!-- 参数配置（模块节点） -->
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
                <el-input
                  v-model="sel.name"
                  placeholder="如 主控服务"
                  @focus="moduleNameBeforeEdit = sel.name"
                  @change="commitSelectedModuleName"
                />
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
          <div class="ping-bar__btns">
            <el-tooltip content="发送探测包检测该模块的链路是否通畅"><el-button type="primary" :icon="Pointer" :loading="sel.status === 'pinging'" @click="handlePing">检测连通性</el-button></el-tooltip>
            <el-tooltip content="保存当前模块的链路参数"><el-button @click="saveParams">保存参数</el-button></el-tooltip>
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
            <el-tooltip content="清空检测输出日志"><el-button v-if="sel.pingLog.length" link size="small" @click="sel.pingLog = []">清空</el-button></el-tooltip>
          </div>
          <pre v-if="sel.pingLog.length" class="ping-out__body">{{ sel.pingLog.join('\n') }}</pre>
          <el-empty v-else description="点击「检测连通性」查看链路探测结果" :image-size="56" />
        </div>
      </el-card>

        <el-empty v-if="!sel" class="detail-empty" description="当前系统下暂无模块，请新建模块或切换被测系统" />
      </div>
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
import { Plus, Pointer, Delete, Setting } from '@element-plus/icons-vue'
import SystemManager from '@/components/SystemManager.vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ConnectionTopology from '@/components/ConnectionTopology.vue'
import PanZoomCanvas from '@/components/PanZoomCanvas.vue'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const store = useConnectionStore()
const systemStore = useSystemStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
const UNASSIGNED_KEY = '__unassigned__'

// 内网链路只有“通 / 不通”两态（绿灯 / 灰灯），pinging 为探测中的过渡态
const statusMeta = {
  online: { text: '在线', tag: 'success' },
  offline: { text: '离线', tag: 'info' },
  pinging: { text: '检测中', tag: 'warning' }
}

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
const moduleNameBeforeEdit = ref('')
const commitSelectedModuleName = () => {
  if (!sel.value) return false
  const validName = validateName(sel.value.name, sel.value, '模块')
  if (!validName) {
    sel.value.name = moduleNameBeforeEdit.value || nextUniqueName('新建模块', sel.value)
    return false
  }
  sel.value.name = validName
  moduleNameBeforeEdit.value = validName
  return true
}

// 层级树选中模块 → 同步到当前选中
const onTreeSelect = (node) => {
  if (node.kind === 'module' && node.ref) store.select(node.ref.id)
}
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
    if (valid && commitSelectedModuleName()) ElMessage.success('参数已保存')
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
    const validName = validateName(draft.name, null, '模块')
    if (!validName) return
    const created = store.add({ ...draft, name: validName })
    store.select(created.id)
    dialogVisible.value = false
    ElMessage.success(`已新建模块 ${draft.name}`)
  })
}

</script>

<style scoped lang="scss">
/* 用 min-height 而非固定 100%：内容变高时整页（工作区）出现滚动条 */
.conn {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.header-actions { display: flex; align-items: center; gap: 12px; }

/* 左树 ｜ 右（拓扑 + 配置） */
.conn-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 16px;
  overflow: hidden;
}
.conn-tree { width: 300px; flex-shrink: 0; }
.conn-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
/* 拓扑图封顶 + 内部滚动：拓扑再大也不会把下方配置挤掉 */
.topo-card { flex-shrink: 0; }

.cfg-card {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-empty { flex: 1; padding: 40px 0; }
.w-full { width: 100%; }
.cfg-form :deep(.el-form-item) { margin-bottom: 16px; }

/* 连通性检测操作条 */
.ping-bar {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 12px; flex-wrap: wrap;
  padding: 10px 12px; margin-bottom: 12px;
  background: var(--el-fill-color-lighter); border-radius: 8px;
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
