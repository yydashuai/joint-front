<template>
  <div class="page dashboard">
    <header class="dashboard-head">
      <div>
        <h2>{{ isAll ? '联试系统首页' : currentSystem?.name }}</h2>
      </div>
      <el-button
        v-if="!isAll"
        :icon="Back"
        plain
        @click="clearSystemFilter"
      >
        返回全部系统
      </el-button>
    </header>

    <section class="system-section">
      <div class="section-head">
        <div>
          <h3>系统联试状态</h3>
        </div>

      </div>

      <el-scrollbar
        ref="systemScrollRef"
        class="system-scroll"
        @wheel.prevent="onSystemWheel"
      >
        <div class="system-track">
          <button
            v-for="card in systemCards"
            :key="card.id"
            type="button"
            class="system-card"
            :class="{
              'is-active': activeCardId === card.id,
              'is-unavailable': card.onlineModules === 0,
            }"
            @click="selectSystem(card.id)"
          >
            <div class="system-card__top">
              <span class="system-card__indicator" :class="{ 'is-online': card.onlineModules > 0 }" />
              <strong>{{ card.name }}</strong>
              <el-tag
                :type="card.readyInterfaces > 0 ? 'success' : 'info'"
                effect="plain"
                size="small"
              >
                {{ card.readyInterfaces > 0 ? '可联试' : '待配置' }}
              </el-tag>
            </div>
            <p>{{ card.owner || '未设置负责人' }}</p>
            <div class="system-card__metrics">
              <span>
                <b>{{ card.onlineModules }}/{{ card.moduleCount }}</b>
                <em>在线模块</em>
              </span>
              <span>
                <b>{{ card.readyInterfaces }}/{{ card.interfaceCount }}</b>
                <em>可测接口</em>
              </span>
              <span :class="{ 'has-alert': card.exceptionCount > 0 }">
                <b>{{ card.exceptionCount }}</b>
                <em>异常</em>
              </span>
            </div>
          </button>
        </div>
      </el-scrollbar>
    </section>

    <div class="dashboard-workspace">
      <aside class="tree-panel">
        <el-input
          v-model="targetSearch"
          :prefix-icon="Search"
          placeholder="搜索接口或方案..."
          size="small"
          clearable
        />
        <SystemModuleTree
          v-model="selectedKey"
          title="系统 · 模块 · 接口 / 方案"
          readonly
          :leaf-groups="leafGroups"
          :extra-system-children="extraSystemChildren"
          empty-text="暂无可选择的系统、模块或接口"
          @select="selectTarget"
          @clear="clearTarget"
        />
      </aside>

      <main class="quick-panel">
        <el-card shadow="never" class="quick-card">
          <template #header>
            <div class="quick-card__head">
              <div>

                <h3>快捷收发测试</h3>
              </div>
              <el-button text type="primary" @click="$router.push('/execution')">
                打开完整监测台
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>

          <div v-if="selectedTarget" class="quick-card__body">
            <div class="target-head">
              <span class="target-head__icon" :class="`is-${selectedTarget.kind}`">
                <el-icon><Collection v-if="selectedTarget.kind === 'scheme'" /><Link v-else /></el-icon>
              </span>
              <div class="target-head__copy">
                <div>
                  <el-tag
                    :type="selectedTarget.kind === 'scheme' ? 'warning' : 'primary'"
                    effect="plain"
                    size="small"
                  >
                    {{ selectedTarget.kind === 'scheme' ? '接口方案' : '测试接口' }}
                  </el-tag>
                  <span>{{ targetSystem?.name || '未归属系统' }}</span>
                </div>
                <h4>{{ selectedTarget.name }}</h4>
                <p>{{ selectedTarget.desc || '暂无说明' }}</p>
              </div>
            </div>

          

            <div v-if="selectedTarget.kind === 'scheme'" class="scheme-interfaces">
              <div class="scheme-interfaces__head">
                <h4>方案包含接口</h4>
                <span>共 {{ targetInterfaces.length }} 个</span>
              </div>
              <div class="scheme-interfaces__list">
                <span v-for="iface in targetInterfaces" :key="iface.id">
                  <i :class="{ 'is-online': moduleOf(iface)?.status === 'online' }" />
                  {{ iface.name }}
                </span>
              </div>
            </div>

            <div v-else class="interface-meta">
              <span><small>传输类型</small><strong>{{ selectedTransport }}</strong></span>
              <span><small>数据集</small><strong>{{ selectedDatasets.length }} 个</strong></span>
              <span><small>发送字段</small><strong>{{ selectedSendFields.length }}</strong></span>
              <span><small>接收字段</small><strong>{{ selectedReceiveFields.length }}</strong></span>
            </div>

            <div class="quick-actions">
              <el-button
                class="quick-action quick-action--send"
                type="primary"
                :disabled="!canEnterSend"
                @click="enterMonitor('send')"
              >
                <el-icon><TopRight /></el-icon>
                <span>
                  <strong>进入发送测试</strong>
                </span>
              </el-button>
              <el-button
                class="quick-action quick-action--receive"
                :disabled="!canEnterReceive"
                @click="enterMonitor('receive')"
              >
                <el-icon><BottomLeft /></el-icon>
                <span>
                  <strong>进入接收测试</strong>
                </span>
              </el-button>
            </div>

            <button
              v-if="!targetFullyReady"
              type="button"
              class="fix-link"
              @click="openTargetConfiguration"
            >
              <el-icon><Tools /></el-icon>
              查看并完善当前目标配置
              <el-icon><ArrowRight /></el-icon>
            </button>
          </div>

          <div v-else class="quick-empty">
            <div class="quick-empty__diagram" aria-hidden="true">
              <span><el-icon><Cpu /></el-icon></span>
              <i />
              <span><el-icon><Connection /></el-icon></span>
              <i />
              <span><el-icon><Link /></el-icon></span>
            </div>
            <h4>从左侧选择接口或方案</h4>
            <p>选择后将在这里检查链路与数据是否就绪，并快速进入发送或接收监测。</p>
          </div>
        </el-card>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Back,
  BottomLeft,
  CircleCheck,
  Collection,
  Connection,
  Cpu,
  Link,
  Search,
  Tools,
  TopRight,
  Warning,
} from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useExceptionStore } from '@/stores/exception'

const router = useRouter()
const systemStore = useSystemStore()
const connectionStore = useConnectionStore()
const protocolStore = useProtocolStore()
const testDataStore = useTestDataStore()
const schemeStore = usePlanSchemeStore()
const exceptionStore = useExceptionStore()

schemeStore.removeLegacyDefaults()

const selectedKey = ref('')
const selectedNode = ref(null)
const targetSearch = ref('')
const systemScrollRef = ref(null)

const isAll = computed(() => systemStore.isAll)
const currentSystem = computed(() => systemStore.current)
const totalOnlineModules = computed(() =>
  connectionStore.nodes.filter((item) => item.status === 'online').length
)
const activeCardId = computed(() =>
  systemStore.currentId || selectedTarget.value?.systemId || null
)

const moduleOf = (iface) =>
  connectionStore.nodes.find((item) => item.id === iface?.moduleId) || null

const datasetsOf = (iface) => {
  const ids = new Set((iface?.datasetIds || []).map(String))
  return testDataStore.datasets.filter((item) => ids.has(String(item.id)))
}

const fieldsOf = (iface, role = null) =>
  collectTestInterfaceFields(
    iface,
    testDataStore.datasets,
    protocolStore.interfaces,
    protocolStore.protocols,
    role,
  )

const roleReady = (iface, role) =>
  moduleOf(iface)?.status === 'online' &&
  datasetsOf(iface).length > 0 &&
  fieldsOf(iface, role).length > 0

const interfaceReady = (iface) => roleReady(iface, 'send') || roleReady(iface, 'receive')

const systemCards = computed(() =>
  systemStore.visibleSystems.map((system) => {
    const modules = connectionStore.nodes.filter((item) => item.systemId === system.id)
    const interfaces = protocolStore.testInterfaces.filter((item) => item.systemId === system.id)
    return {
      ...system,
      moduleCount: modules.length,
      onlineModules: modules.filter((item) => item.status === 'online').length,
      interfaceCount: interfaces.length,
      readyInterfaces: interfaces.filter(interfaceReady).length,
      exceptionCount: exceptionStore.exceptions.filter((item) => item.systemId === system.id).length,
    }
  })
)

const interfaceBadge = (iface) => {
  const send = roleReady(iface, 'send')
  const receive = roleReady(iface, 'receive')
  if (send && receive) return '收发就绪'
  if (send) return '发送就绪'
  if (receive) return '接收就绪'
  return '待配置'
}

const leafGroups = (module) => {
  const keyword = targetSearch.value.trim().toLowerCase()
  let interfaces = protocolStore.testInterfaces.filter((iface) => iface.moduleId === module.id)
  if (keyword) {
    interfaces = interfaces.filter((iface) =>
      iface.name.toLowerCase().includes(keyword) ||
      (iface.desc || '').toLowerCase().includes(keyword)
    )
  }
  return [{
    flat: true,
    kind: 'iface',
    items: interfaces.map((iface) => ({
      key: `iface-${iface.id}`,
      kind: 'iface',
      icon: 'Link',
      label: iface.name,
      badge: interfaceBadge(iface),
      ref: iface,
    })),
  }]
}

const extraSystemChildren = (system) => {
  const keyword = targetSearch.value.trim().toLowerCase()
  const schemes = schemeStore.schemesOfSystem(system.id).filter((scheme) =>
    !keyword ||
    scheme.name.toLowerCase().includes(keyword) ||
    (scheme.remark || '').toLowerCase().includes(keyword)
  )
  return [{
    key: `schemes-${system.id}`,
    kind: 'schemeGroup',
    icon: 'FolderOpened',
    label: '接口方案',
    children: schemes.map((scheme) => ({
      key: `scheme-${scheme.id}`,
      kind: 'scheme',
      icon: 'Collection',
      label: scheme.name,
      badge: `${scheme.interfaceIds.length} 接口`,
      ref: scheme,
    })),
  }]
}

const selectTarget = (node) => {
  if (!['iface', 'scheme'].includes(node.kind)) return
  selectedNode.value = node
  if (node.kind === 'scheme') schemeStore.select(node.ref.id)
}

const clearTarget = () => {
  selectedKey.value = ''
  selectedNode.value = null
}

const selectSystem = (systemId) => {
  systemStore.setCurrent(systemId)
  clearTarget()
}

const clearSystemFilter = () => {
  systemStore.setCurrent(null)
  clearTarget()
}

const onSystemWheel = (event) => {
  const wrap = systemScrollRef.value?.wrapRef
  if (wrap) wrap.scrollLeft += event.deltaY || event.deltaX
}

const selectedTarget = computed(() => {
  const node = selectedNode.value
  if (!node?.ref) return null
  if (node.kind === 'scheme') {
    return {
      kind: 'scheme',
      id: node.ref.id,
      name: node.ref.name,
      desc: node.ref.remark,
      systemId: node.ref.systemId,
      ref: node.ref,
    }
  }
  return {
    kind: 'iface',
    id: node.ref.id,
    name: node.ref.name,
    desc: node.ref.desc,
    systemId: node.ref.systemId,
    ref: node.ref,
  }
})

const targetInterfaces = computed(() => {
  if (!selectedTarget.value) return []
  if (selectedTarget.value.kind === 'iface') return [selectedTarget.value.ref]
  const ids = new Set((selectedTarget.value.ref.interfaceIds || []).map(String))
  return protocolStore.testInterfaces.filter((iface) => ids.has(String(iface.id)))
})

const targetSystem = computed(() =>
  systemStore.systems.find((item) => item.id === selectedTarget.value?.systemId) || null
)
const targetModules = computed(() => {
  const ids = new Set(targetInterfaces.value.map((item) => item.moduleId))
  return connectionStore.nodes.filter((item) => ids.has(item.id))
})
const targetModuleText = computed(() => {
  const names = targetModules.value.map((item) => item.name)
  if (!names.length) return '未归属模块'
  if (names.length === 1) return names[0]
  return `${names[0]}等 ${names.length} 个`
})
const targetTypeText = computed(() => selectedTarget.value?.kind === 'scheme' ? '方案' : '接口')

const onlineTargetModules = computed(() =>
  targetModules.value.filter((item) => item.status === 'online').length
)
const datasetReadyCount = computed(() =>
  targetInterfaces.value.filter((iface) => datasetsOf(iface).length > 0).length
)
const sendReadyCount = computed(() =>
  targetInterfaces.value.filter((iface) => roleReady(iface, 'send')).length
)
const receiveReadyCount = computed(() =>
  targetInterfaces.value.filter((iface) => roleReady(iface, 'receive')).length
)
const canEnterSend = computed(() =>
  targetInterfaces.value.length > 0 && sendReadyCount.value === targetInterfaces.value.length
)
const canEnterReceive = computed(() =>
  targetInterfaces.value.length > 0 && receiveReadyCount.value === targetInterfaces.value.length
)
const targetFullyReady = computed(() => canEnterSend.value && canEnterReceive.value)

const readinessItems = computed(() => {
  const interfaceCount = targetInterfaces.value.length
  const moduleCount = targetModules.value.length
  return [
    {
      label: '目标链路',
      value: `${onlineTargetModules.value}/${moduleCount} 模块在线`,
      ok: moduleCount > 0 && onlineTargetModules.value === moduleCount,
    },
    {
      label: '测试数据',
      value: `${datasetReadyCount.value}/${interfaceCount} 接口已绑定`,
      ok: interfaceCount > 0 && datasetReadyCount.value === interfaceCount,
    },
    {
      label: '发送准备',
      value: `${sendReadyCount.value}/${interfaceCount} 接口就绪`,
      ok: canEnterSend.value,
    },
    {
      label: '接收准备',
      value: `${receiveReadyCount.value}/${interfaceCount} 接口就绪`,
      ok: canEnterReceive.value,
    },
  ]
})

const selectedDatasets = computed(() => datasetsOf(targetInterfaces.value[0]))
const selectedSendFields = computed(() =>
  targetInterfaces.value[0] ? fieldsOf(targetInterfaces.value[0], 'send') : []
)
const selectedReceiveFields = computed(() =>
  targetInterfaces.value[0] ? fieldsOf(targetInterfaces.value[0], 'receive') : []
)
const selectedMessage = computed(() => {
  const messageRef = selectedDatasets.value.find((item) => item.linkedInterface)?.linkedInterface
  return protocolStore.interfaces.find((item) =>
    String(item.id) === String(messageRef) || item.name === messageRef
  ) || null
})
const selectedTransport = computed(() => selectedMessage.value?.transportType || '未标注')

const enterMonitor = (mode) => {
  if (!selectedTarget.value) return
  systemStore.setCurrent(selectedTarget.value.systemId || null)
  router.push({
    path: '/execution',
    query: {
      interfaceId: selectedTarget.value.kind === 'iface' ? selectedTarget.value.id : undefined,
      schemeId: selectedTarget.value.kind === 'scheme' ? selectedTarget.value.id : undefined,
      mode: mode === 'receive' ? 'receive' : undefined,
    },
  })
}

const openTargetConfiguration = () => {
  if (!selectedTarget.value) return
  const offline = targetModules.value.find((item) => item.status !== 'online')
  systemStore.setCurrent(selectedTarget.value.systemId || null)
  if (offline) {
    connectionStore.select(offline.id)
    router.push('/connection')
    return
  }
  router.push({
    path: '/execution',
    query: selectedTarget.value.kind === 'iface'
      ? { interfaceId: selectedTarget.value.id }
      : {},
  })
}
</script>

<style scoped lang="scss">
.dashboard {
  height: 100%;
  min-height: 0;
  gap: 14px;
  overflow: hidden;
}

.dashboard-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;

  h2 { margin: 0; font-size: 19px; font-weight: 650; }
  p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
}

.system-section {
  flex-shrink: 0;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;

  > div {
    display: flex;
    align-items: baseline;
    gap: 9px;
  }

  h3 { margin: 0; font-size: 14px; font-weight: 650; }
  span { color: var(--el-text-color-secondary); font-size: 11px; }

  &__summary {
    font-family: Consolas, "Segoe UI", monospace;
  }
}

.system-scroll {
  :deep(.el-scrollbar__wrap) { overflow-y: hidden; }
}

.system-track {
  display: flex;
  gap: 11px;
  min-width: min-content;
  padding-bottom: 4px;
}

.system-card {
  appearance: none;
  width: 270px;
  min-height: 112px;
  flex-shrink: 0;
  padding: 13px 14px;
  border: 1px solid #e0e6ed;
  border-radius: 9px;
  background: #fff;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color .16s, box-shadow .16s, transform .16s;

  &:hover {
    border-color: #9fc0f3;
    box-shadow: 0 5px 14px rgba(37, 77, 128, .08);
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  &.is-active {
    border-color: #2f6feb;
    background: linear-gradient(150deg, #fff 30%, #f2f7ff);
    box-shadow: inset 0 -2px 0 #2f6feb;
  }

  &.is-unavailable { opacity: .72; }

  &__top {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;

    strong {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__indicator {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #a9b3bf;

    &.is-online {
      background: #35a66f;
      box-shadow: 0 0 0 3px rgba(53, 166, 111, .12);
    }
  }

  > p {
    margin: 5px 0 10px 14px;
    overflow: hidden;
    color: var(--el-text-color-secondary);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding-top: 8px;
    border-top: 1px solid #edf0f3;

    span {
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 0 8px;
      border-right: 1px solid #edf0f3;

      &:first-child { padding-left: 0; }
      &:last-child { padding-right: 0; border-right: 0; }
      &.has-alert b { color: var(--el-color-danger); }
    }

    b { font-size: 14px; font-variant-numeric: tabular-nums; }
    em { margin-top: 1px; color: var(--el-text-color-secondary); font-size: 9px; font-style: normal; }
  }
}

.dashboard-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 14px;
}

.tree-panel {
  width: 300px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 8px;
  overflow: hidden;

  :deep(.smt) {
    flex: 1;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  :deep(.smt > .el-card__body) {
    min-height: 0;
    overflow: hidden;
  }
}

.quick-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex: 1;
}

.quick-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 9px;

  :deep(.el-card__header) {
    padding: 12px 16px;
  }

  :deep(.el-card__body) {
    min-height: 0;
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow: auto;
    padding: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    h3 { margin: 2px 0 0; font-size: 15px; font-weight: 680; }
  }

  &__eyebrow {
    color: #6f8298;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: .12em;
  }

  &__body {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    padding: 18px;
  }
}

.target-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  &__icon {
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 10px;
    background: #eaf2ff;
    color: #2f6feb;
    font-size: 20px;

    &.is-scheme { background: #fff3df; color: #ba741e; }
  }

  &__copy {
    min-width: 0;
    flex: 1;

    > div {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--el-text-color-secondary);
      font-size: 11px;
    }

    h4 { margin: 5px 0 0; font-size: 16px; }
    p {
      margin: 4px 0 0;
      overflow: hidden;
      color: var(--el-text-color-secondary);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.target-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr) 18px minmax(0, .7fr);
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 11px 13px;
  border: 1px solid #e6ebf1;
  border-radius: 8px;
  background: #f8fafc;

  > .el-icon { color: #9aa8b7; }
  > span { min-width: 0; display: flex; flex-direction: column; }
  small { color: var(--el-text-color-secondary); font-size: 9px; }
  strong {
    margin-top: 2px;
    overflow: hidden;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.readiness-section {
  margin-top: 16px;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;

    h4 { margin: 0; font-size: 13px; }
    p { margin: 3px 0 0; color: var(--el-text-color-secondary); font-size: 10px; }
  }
}

.readiness-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.readiness-item {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border: 1px solid #eceff3;
  border-radius: 8px;
  background: #fbfcfd;

  &.is-ready {
    border-color: #d9eee4;
    background: #f5fbf8;
  }

  &__icon {
    width: 25px;
    height: 25px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 7px;
    background: #fff0df;
    color: #c37a24;
  }

  &.is-ready &__icon { background: #e3f5eb; color: #299060; }
  > span:last-child { min-width: 0; display: flex; flex-direction: column; }
  small { color: var(--el-text-color-secondary); font-size: 9px; }
  strong {
    margin-top: 2px;
    overflow: hidden;
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.scheme-interfaces {
  margin-top: 15px;
  padding: 11px 13px;
  border: 1px solid #eceff3;
  border-radius: 8px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    h4 { margin: 0; font-size: 14px; }
    span { color: var(--el-text-color-secondary); font-size: 14px; }
  }

  &__list {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 9px;

    span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 5px;
      background: #f3f5f8;
      color: #516174;
      font-size: 14px;
    }

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #aab4c0;
      &.is-online { background: #35a66f; }
    }
  }
}

.interface-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 15px;
  padding: 11px 0;
  border-top: 1px solid #edf0f3;
  border-bottom: 1px solid #edf0f3;

  span {
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0 12px;
    border-right: 1px solid #edf0f3;
    &:first-child { padding-left: 0; }
    &:last-child { border-right: 0; }
  }

  small { color: var(--el-text-color-secondary); font-size: 9px; }
  strong { margin-top: 3px; overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: auto;
  padding-top: 18px;
}

.quick-action {
  width: 100%;
  height: 58px;
  margin: 0 !important;
  justify-content: flex-start;
  padding: 0 16px;
  border-radius: 8px;

  > .el-icon { margin-right: 10px; font-size: 19px; }
  span { display: flex; flex-direction: column; align-items: flex-start; }
  strong { font-size: 13px; }
  small { margin-top: 3px; opacity: .7; font-size: 9px; font-weight: 400; }

  &--receive {
    border-color: #a9d7c5;
    background: #f1faf6;
    color: #207d58;

    &:hover,
    &:focus { border-color: #5caf8e; background: #e7f6ef; color: #176947; }
  }
}

.fix-link {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  cursor: pointer;
  font-size: 10px;
}

.quick-empty {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-direction: column;
  padding: 30px;
  text-align: center;

  &__diagram {
    display: flex;
    align-items: center;

    span {
      width: 44px;
      height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #cfe0f8;
      border-radius: 10px;
      background: #f4f8ff;
      color: #3b73c5;
      font-size: 19px;
    }

    i { width: 46px; height: 1px; background: #cfdae8; }
  }

  h4 { margin: 16px 0 0; font-size: 14px; }
  p { max-width: 390px; margin: 7px 0 0; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.7; }
}

@media (max-width: 1180px) {
  .dashboard { overflow: auto; }
  .dashboard-workspace { min-height: 720px; flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .quick-panel { min-height: 430px; }
}

@media (max-width: 760px) {
  .readiness-grid,
  .interface-meta,
  .quick-actions { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 520px) {
  .readiness-grid,
  .interface-meta,
  .quick-actions { grid-template-columns: 1fr; }
  .target-route { grid-template-columns: 1fr; }
  .target-route > .el-icon { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .system-card { transition: none; }
}
</style>
