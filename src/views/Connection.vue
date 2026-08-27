<template>
  <div class="page conn">
    <div class="page__header">
      <div>
        <h2>链路连接管理</h2>
      </div>
      <div class="header-actions">
        <el-tooltip content="管理联试对象（链路节点的归属）"><el-button :icon="Setting" @click="systemManagerVisible = true">管理对象</el-button></el-tooltip>
        <el-tooltip content="创建一条不属于任何接口的物理链路节点（可后续关联到接口）"><el-button :icon="Plus" @click="openCreate">新建链路节点</el-button></el-tooltip>
      </div>
    </div>

    <!-- 左：业务视角树（方案 → 接口） ｜ 右：拓扑图 + 链路参数配置 -->
    <div class="conn-layout">
      <MonitorTree
        class="conn-tree"
        v-model="selectedKey"
        title="接口方案"
        :search="search"
        :visible-groups="['system', 'scheme']"
        :iface-badge="ifaceBadge"
        :scheme-badge="schemeBadge"
        :custom-badge="() => ''"
        :expand-messages="false"
        empty-text="暂无接口或方案，请先在「报文字段管理」中定义接口"
        @select="onTreeSelect"
        @add-leaf="onAddLeaf"
      />

      <div class="conn-main">
        <!-- 链路拓扑（接口维度，保留原风格） -->
        <el-card class="topo-card" shadow="never" :body-style="{ padding: '0' }">
          <template #header>
            <div class="card-head">
              <span>链路拓扑</span>
              <span class="topo-hint">按联试对象 · 接口展示链路状态</span>
            </div>
          </template>
          <PanZoomCanvas :height="320" title="链路拓扑">
            <ConnectionTopology
              :modules="topoIfaces"
              :groups="topoGroups"
              :grouped="true"
              :hub-label="hubLabel"
              :selected-id="highlightNodeId"
              @select="onTopoSelect"
              @ping="pingModule"
            />
          </PanZoomCanvas>
        </el-card>

        <!-- 右侧详情面板 -->
        <el-card shadow="never" class="cfg-card" :body-style="{ flex: '1', minHeight: '0', overflow: 'auto' }">
          <div v-if="!selIface && !selScheme" class="detail-empty">
            <el-empty description="从左侧选择接口或方案" :image-size="100" />
          </div>

          <!-- 选中接口：显示该接口的关联链路参数 -->
          <div v-else-if="selIface">
            <div class="card-head">
              <div class="head-left">
                <el-icon class="head-icon"><Link /></el-icon>
                <div class="head-copy">
                  <span class="head-eyebrow">当前接口</span>
                  <strong>{{ selIface.name }}</strong>
                    <span class="head-meta">
                      报文：{{ (selIface.messageIds || []).length }} 个
                    </span>
                </div>
              </div>
              <el-button link type="primary" size="small" @click="goEditIface(selIface)">编辑接口</el-button>
            </div>

            <div v-if="linkNode" class="cfg-form">
              <el-form ref="formRef" :model="linkNode" :rules="rules" label-width="120px">
                <el-row :gutter="20">
                  <el-col :span="12">
                    <el-form-item label="链路节点名称" prop="name">
                      <el-input
                        v-model="linkNode.name"
                        placeholder="如 武器管理链路"
                        @focus="linkNodeNameBeforeEdit = linkNode.name"
                        @change="commitLinkNodeName"
                      />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="所属联试对象" prop="systemId">
                      <el-select v-model="linkNodeSystemKey" class="w-full" placeholder="选择所属联试对象">
                        <el-option v-for="option in moduleSystemOptions" :key="option.value ?? 'none'" :label="option.label" :value="option.value" />
                      </el-select>
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="目标 IP" prop="ip">
                      <el-input v-model="linkNode.ip" placeholder="192.168.1.x" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="12">
                    <el-form-item label="端口" prop="port">
                      <el-input-number v-model="linkNode.port" :min="1" :max="65535" controls-position="right" class="w-full" />
                    </el-form-item>
                  </el-col>
                  <el-col :span="24">
                    <el-form-item label="说明信息" prop="desc">
                      <el-input v-model="linkNode.desc" type="textarea" :rows="2" maxlength="120" show-word-limit placeholder="描述该链路节点的物理链路用途" />
                    </el-form-item>
                  </el-col>
                </el-row>
              </el-form>

              <div class="ping-bar">
                <div class="ping-bar__btns">
                  <el-tooltip content="发送探测包检测该链路节点是否通畅"><el-button type="primary" :icon="Pointer" :loading="linkNode.status === 'pinging'" @click="handlePing">检测连通性</el-button></el-tooltip>
                  <el-tooltip content="保存当前链路节点参数"><el-button @click="saveParams">保存参数</el-button></el-tooltip>
                  <el-popconfirm title="确认删除该链路节点？该接口将不再关联物理链路。" @confirm="handleRemove">
                    <template #reference>
                      <el-button :icon="Delete" plain>删除链路节点</el-button>
                    </template>
                  </el-popconfirm>
                </div>
              </div>

              <div class="ping-out">
                <div class="ping-out__head">
                  <span class="ping-out__title">连通性检测输出</span>
                  <el-tag :type="statusMeta[linkNode.status].tag" size="small" effect="light">{{ statusMeta[linkNode.status].text }}</el-tag>
                  <span v-if="linkNode.status === 'online' && linkNode.latency" class="ping-out__latency">平均时延 {{ linkNode.latency }}ms</span>
                  <span class="ping-out__spacer" />
                  <el-tooltip content="清空检测输出日志"><el-button v-if="linkNode.pingLog.length" link size="small" @click="linkNode.pingLog = []">清空</el-button></el-tooltip>
                </div>
                <pre v-if="linkNode.pingLog.length" class="ping-out__body">{{ linkNode.pingLog.join('\n') }}</pre>
                <el-empty v-if="!linkNode.pingLog.length" description="点击「检测连通性」查看链路探测结果" :image-size="56" />
              </div>
            </div>

            <div v-if="!linkNode" class="link-empty">
              <el-empty :image-size="80" description="该接口尚未关联物理链路节点">
                <el-button type="primary" :icon="Plus" @click="createLinkNodeForIface">新建链路节点并关联</el-button>
              </el-empty>
            </div>
          </div>

          <!-- 选中方案：显示方案信息 + 内含接口列表 -->
          <div v-else-if="selScheme">
            <div class="card-head">
              <div class="head-left">
                <el-icon class="head-icon" style="color: var(--el-color-warning)"><Notebook /></el-icon>
                <div class="head-copy">
                  <span class="head-eyebrow">当前方案</span>
                  <strong>{{ selScheme.name }}</strong>
                    <span class="head-meta">
                      包含接口：{{ (selScheme.interfaceIds || []).length }} 个
                    </span>
                </div>
              </div>
              <el-button link type="primary" size="small" @click="goEditScheme(selScheme)">编辑方案</el-button>
            </div>
            <div class="scheme-list">
              <div
                v-for="iface in schemeInterfaces"
                :key="iface.id"
                class="scheme-list__item"
                :class="{ 'is-active': iface.id === selectedIfaceId }"
                @click="selectedKey = `iface-${iface.id}`"
              >
                <el-icon><Link /></el-icon>
                <span class="iface-name">{{ iface.name }}</span>
                <el-tag size="small" effect="plain">{{ ifaceBadge(iface) }}</el-tag>
                <el-tag v-if="ifaceLinkNode(iface)" size="small" :type="statusMeta[ifaceLinkNode(iface).status].tag" effect="light">
                  {{ statusMeta[ifaceLinkNode(iface).status].text }}
                </el-tag>
                <el-tag v-if="!ifaceLinkNode(iface)" size="small" effect="plain" type="info">未关联</el-tag>
              </div>
              <el-empty v-if="!schemeInterfaces.length" description="该方案暂无接口" :image-size="64" />
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 新建链路节点（无接口上下文场景） -->
    <el-dialog v-model="dialogVisible" title="新建链路节点" width="540px">
      <el-form ref="createRef" :model="draft" :rules="rules" label-width="92px">
        <el-form-item label="链路节点名称" prop="name">
          <el-input v-model="draft.name" placeholder="如 结算服务" />
        </el-form-item>
        <el-form-item label="所属联试对象" prop="systemId">
          <el-select v-model="draftSystemKey" class="w-full" placeholder="选择所属联试对象">
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
          <el-input v-model="draft.desc" type="textarea" :rows="2" maxlength="120" show-word-limit placeholder="描述该链路节点的物理链路用途" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">创建</el-button>
      </template>
    </el-dialog>

    <SystemManager v-model="systemManagerVisible" />

    <!-- 新建接口弹窗（走 InterfaceQuickConfig） -->
    <InterfaceQuickConfig
      v-model="ifaceConfigVisible"
      :interface-id="ifaceConfigId"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Pointer, Delete, Setting, Link, Notebook, FolderOpened } from '@element-plus/icons-vue'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import SystemManager from '@/components/SystemManager.vue'
import ConnectionTopology from '@/components/ConnectionTopology.vue'
import PanZoomCanvas from '@/components/PanZoomCanvas.vue'
import { useConnectionStore } from '@/stores/connection'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const store = useConnectionStore()
const protocolStore = useProtocolStore()
const systemStore = useSystemStore()
const schemeStore = usePlanSchemeStore()
const router = useRouter()
const { nextUniqueName, validateName } = useEntityNameGuard()
const UNASSIGNED_KEY = '__unassigned__'

// 链路节点状态（内网"通/不通"二态 + pinging 过渡）
const statusMeta = {
  online: { text: '在线', tag: 'success' },
  offline: { text: '离线', tag: 'info' },
  pinging: { text: '检测中', tag: 'warning' }
}

const search = ref('')
const selectedKey = ref('')

/* ========== 选中态联动 ========== */
// 接口选中（来自 MonitorTree：iface- 系统接口 / sin- 方案内接口）
const selectedIfaceId = computed(() => {
  const ifaceMatch = selectedKey.value.match(/^iface-(.+)$/)
  if (ifaceMatch) {
    const sys = protocolStore.testInterfaces.find((i) => String(i.id) === String(ifaceMatch[1]))
    if (sys) return sys.id
  }
  const sin = selectedKey.value.match(/^sin-(.+)$/)
  if (sin) return sin[1]
  return null
})
const selIface = computed(() => {
  if (!selectedIfaceId.value) return null
  return protocolStore.testInterfaces.find((i) => String(i.id) === String(selectedIfaceId.value)) || null
})
// 方案选中
const selectedSchemeId = computed(() => {
  const m = selectedKey.value.match(/^scheme-(.+)$/)
  return m ? m[1] : null
})
const selScheme = computed(() => {
  if (!selectedSchemeId.value) return null
  return schemeStore.schemes.find((s) => String(s.id) === String(selectedSchemeId.value)) || null
})
const schemeInterfaces = computed(() => {
  if (!selScheme.value) return []
  const ids = new Set((selScheme.value.interfaceIds || []).map(String))
  return protocolStore.testInterfaces.filter((i) => ids.has(String(i.id)))
})

/* ========== 链路节点联动 ========== */
const linkNode = ref(null)  // 选中接口的关联链路节点（响应式代理）
const linkNodeNameBeforeEdit = ref('')
const ifaceLinkNode = (iface) => {
  if (!iface?.moduleId) return null
  return store.nodes.find((n) => String(n.id) === String(iface.moduleId)) || null
}
// 当选中接口变更时，绑定 linkNode
watch([selIface], () => {
  if (selIface.value) {
    linkNode.value = ifaceLinkNode(selIface.value)
  } else {
    linkNode.value = null
  }
}, { immediate: true })

const linkNodeSystemKey = computed({
  get: () => linkNode.value?.systemId ?? UNASSIGNED_KEY,
  set: (id) => {
    if (linkNode.value) linkNode.value.systemId = id === UNASSIGNED_KEY ? null : id
  }
})

/* ========== 树徽标 / 系统名 ========== */
const ifaceBadge = (iface) => `${(iface?.messageIds || []).length} 报文`
const schemeBadge = (scheme) => `${(scheme?.interfaceIds || []).length} 接口`
const moduleSystemOptions = computed(() => [
  ...systemStore.systems.map((system) => ({ label: system.name, value: system.id })),
  { label: '未分配', value: UNASSIGNED_KEY }
])

/* ========== 树事件 ========== */
const onTreeSelect = (data) => {
  if (!data?.ref) return
  if (data.kind === 'iface' || data.kind === 'schemeItem') {
    selectedKey.value = data.key
  }
  if (data.kind === 'scheme') {
    selectedKey.value = data.key
  }
}
const onAddLeaf = ({ groupKind }) => {
  if (groupKind === 'iface') {
    ifaceConfigId.value = null
    ifaceConfigVisible.value = true
  } else if (groupKind === 'scheme') {
    ElMessage.info('请到「接口收发监测」页面创建方案')
  } else {
    openCreate()
  }
}

/* ========== 新建接口（InterfaceQuickConfig） ========== */
const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)

/* ========== 拓扑（样式保留，二级节点 = 系统接口 / 方案，与业务树一致） ========== */
const hubLabel = computed(() => '联试工具')
/** 接口 → 拓扑节点包装：展示接口名 + 关联链路状态 */
const ifaceNodeOf = (iface) => {
  const node = ifaceLinkNode(iface)
  return {
    id: `iface-${iface.id}`,
    kind: 'iface',
    name: iface.name,
    ip: node?.ip ?? '',
    port: node?.port ?? '',
    status: node?.status ?? 'unlinked',
    latency: node?.latency,
    desc: node?.desc || iface.desc || '',
    ifaceId: iface.id,
    linkNode: node || null,
  }
}
const topoGroups = computed(() => {
  const ifaces = protocolStore.testInterfaces
  const schemes = schemeStore.schemes
  const onlineCount = ifaces.filter((i) => ifaceLinkNode(i)?.status === 'online').length
  const groups = [
    {
      id: 'grp-iface',
      selectId: null,
      name: '系统接口',
      icon: FolderOpened,
      sub: ifaces.length ? `在线 ${onlineCount}/${ifaces.length}` : '',
      modules: ifaces.map(ifaceNodeOf),
    },
  ]
  schemes.forEach((s) => {
    const ids = new Set((s.interfaceIds || []).map(String))
    groups.push({
      id: `grp-scheme-${s.id}`,
      selectId: `scheme-${s.id}`,
      name: s.name,
      icon: Notebook,
      sub: `${ids.size} 接口`,
      modules: ifaces.filter((i) => ids.has(String(i.id))).map(ifaceNodeOf),
    })
  })
  return groups
})
const topoIfaces = computed(() => protocolStore.testInterfaces.map(ifaceNodeOf))
// 拓扑图选中节点：二级节点（系统接口/方案）或叶子接口 → 与业务树联动
const onTopoSelect = (id) => {
  if (id == null) return
  const key = String(id)
  if (key.startsWith('iface-') || key.startsWith('scheme-')) {
    selectedKey.value = key
    return
  }
  // 兼容旧数据：可能是链路节点 id，反查接口
  const node = store.nodes.find((n) => String(n.id) === String(id))
  if (!node) return
  const iface = protocolStore.testInterfaces.find((i) => String(i.moduleId) === String(node.id))
  if (iface) selectedKey.value = `iface-${iface.id}`
}
const highlightNodeId = computed(() => {
  // 拓扑图高亮：当前选中的接口 / 方案节点
  return selectedKey.value.startsWith('iface-') || selectedKey.value.startsWith('scheme-')
    ? selectedKey.value
    : null
})

/* ========== 链路参数编辑 / ping / 删除 ========== */
const ipRule = (rule, value, cb) => {
  const ok = /^(\d{1,3})(\.\d{1,3}){3}$/.test(value) && value.split('.').every((s) => +s <= 255)
  ok ? cb() : cb(new Error('请输入合法 IP 地址'))
}
const rules = {
  name: [{ required: true, message: '请输入链路节点名称', trigger: 'blur' }],
  ip: [{ required: true, validator: ipRule, trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'blur' }]
}

const pingModule = (ifaceNode) => {
  if (ifaceNode?.linkNode) store.ping(ifaceNode.linkNode.id, 4)
  else ElMessage.info('该接口尚未配置链路节点，无法检测连通性')
}
const handlePing = () => pingModule(linkNode.value)

let autoTimer = null
const AUTO_INTERVAL = 5000
onMounted(() => {
  autoTimer = setInterval(() => {
    protocolStore.testInterfaces.forEach((iface) => {
      const node = ifaceLinkNode(iface)
      if (node) store.autoPing(node.id)
    })
  }, AUTO_INTERVAL)
})
onBeforeUnmount(() => clearInterval(autoTimer))

const formRef = ref()
const linkNodeNameBeforeEditLocal = ref('')
const commitLinkNodeName = () => {
  if (!linkNode.value) return false
  const validName = validateName(linkNode.value.name, linkNode.value, '链路节点')
  if (!validName) {
    linkNode.value.name = linkNodeNameBeforeEditLocal.value || nextUniqueName('新建链路节点', linkNode.value)
    return false
  }
  linkNode.value.name = validName
  linkNodeNameBeforeEditLocal.value = validName
  return true
}
const saveParams = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (valid && commitLinkNodeName()) ElMessage.success('参数已保存')
  })
}
const handleRemove = () => {
  if (!linkNode.value) return
  const name = linkNode.value.name
  // 解除接口的 moduleId 关联
  if (selIface.value) selIface.value.moduleId = null
  store.remove(linkNode.value.id)
  linkNode.value = null
  ElMessage.success(`已删除链路节点 ${name}`)
}

/* ========== 新建链路节点（无接口上下文） ========== */
const dialogVisible = ref(false)
const systemManagerVisible = ref(false)
const createRef = ref()
const defaultSystemId = () => systemStore.systems[0]?.id ?? null
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
/* 新建链路节点并关联到当前选中接口 */
const createLinkNodeForIface = () => {
  if (!selIface.value) return
  const created = store.add({
    systemId: selIface.value.systemId ?? defaultSystemId(),
    name: nextUniqueName('新建链路节点'),
    ip: '192.168.1.',
    port: 8080,
    desc: ''
  })
  // 关联到接口
  selIface.value.moduleId = created.id
  linkNode.value = created
  ElMessage.success('已创建链路节点并关联到当前接口')
}
const confirmCreate = async () => {
  await createRef.value.validate((valid) => {
    if (!valid) return
    const validName = validateName(draft.name, null, '链路节点')
    if (!validName) return
    const created = store.add({ ...draft, name: validName })
    store.select(created.id)
    dialogVisible.value = false
    ElMessage.success(`已新建链路节点 ${draft.name}`)
  })
}

/* ========== 跳转 ========== */
const goEditIface = (iface) => {
  router.push({ path: '/protocol', query: { iface: String(iface.id), kind: 'interface' } })
}
const goEditScheme = (scheme) => {
  router.push({ path: '/execution', query: { schemeId: String(scheme.id) } })
}
</script>

<style scoped lang="scss">
.conn {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions { display: flex; align-items: center; gap: 12px; }

.conn-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 16px;
  overflow: hidden;
}
.conn-tree { width: 320px; flex-shrink: 0; }
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
  &__left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  .head-icon {
    width: 36px; height: 36px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 8px; background: #eaf2ff; color: #2f6feb; font-size: 18px; flex-shrink: 0;
  }
  .head-copy { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .head-eyebrow { color: #6f8298; font-size: 10px; font-weight: 700; letter-spacing: .12em; }
  strong { font-size: 15px; }
  .head-meta { color: var(--el-text-color-secondary); font-size: 12px; }
}

.topo-card { flex-shrink: 0; }
.topo-hint { color: var(--el-text-color-secondary); font-size: 11px; font-weight: 400; }

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

.link-empty { padding: 24px 0; }

.scheme-list {
  display: flex; flex-direction: column; gap: 8px;
  &__item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
    cursor: pointer; transition: border-color .15s, background .15s;
    &:hover { border-color: var(--el-color-primary-light-5); }
    &.is-active { border-color: var(--el-color-primary); background: #f0f6ff; }
    .iface-name { flex: 1; min-width: 0; font-weight: 500; }
  }
}

.ping-bar {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 12px; flex-wrap: wrap;
  padding: 10px 12px; margin-bottom: 12px;
  background: var(--el-fill-color-lighter); border-radius: 8px;
  &__btns { display: flex; gap: 10px; flex-shrink: 0; }
}

.ping-out {
  &__head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
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
    height: 173px; overflow: auto;
  }
  :deep(.el-empty) { height: 173px; padding: 0; box-sizing: border-box; }
}
</style>
