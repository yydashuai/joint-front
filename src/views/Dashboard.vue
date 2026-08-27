<template>
  <div class="page dashboard">
    <header class="dashboard-head">
      <div>
        <h2>联试系统首页</h2>
      </div>
    </header>

    <section class="system-section">
      <div class="section-head">
        <div>
          <h3>接口与方案</h3>
        </div>
        <span class="section-head__summary">点击卡片快速进入收发测试</span>
      </div>

      <el-scrollbar
        ref="systemScrollRef"
        class="system-scroll"
        @wheel.prevent="onSystemWheel"
      >
        <div class="system-track">
          <button
            v-for="card in overviewCards"
            :key="card.id"
            type="button"
            class="system-card"
            :class="{
              'is-active': selectedKey === card.key,
              'is-unavailable': !card.ready,
              'is-scheme-card': card.kind === 'scheme',
            }"
            @click="onCardSelect(card)"
          >
            <div class="system-card__top">
              <span class="system-card__indicator" :class="{ 'is-online': card.ok }" />
              <strong>{{ card.name }}</strong>
              <el-tag
                :type="card.ready ? 'success' : 'info'"
                effect="plain"
                size="small"
              >
                {{ card.ready ? '可联试' : '待配置' }}
              </el-tag>
            </div>
            <p>{{ card.desc || '—' }}</p>
            <div class="system-card__metrics">
              <span>
                <b>{{ card.metric1 }}</b>
                <em>{{ card.metric1Label }}</em>
              </span>
              <span>
                <b>{{ card.metric2 }}</b>
                <em>{{ card.metric2Label }}</em>
              </span>
              <span :class="{ 'has-alert': card.alert }">
                <b>{{ card.metric3 }}</b>
                <em>{{ card.metric3Label }}</em>
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
        <MonitorTree
          v-model="selectedKey"
          title="接口 · 方案"
          readonly
          :search="targetSearch"
          :iface-badge="ifaceBadge"
          :scheme-badge="schemeBadge"
          :custom-badge="() => ''"
          :expand-messages="false"
          empty-text="暂无可选择的接口或方案"
          @select="selectTarget"
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
                <span
                  v-for="iface in targetInterfaces"
                  :key="iface.id"
                  :class="{ 'is-selected': selectedKey === `iface-${iface.id}` }"
                  @click="selectTarget({ kind: 'iface', key: `iface-${iface.id}`, ref: iface })"
                >
                  <i :class="{ 'is-online': ifaceReady(iface) }" />
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
import MonitorTree from '@/components/execution/MonitorTree.vue'
import { useProtocolStore, collectTestInterfaceFields } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useExceptionStore } from '@/stores/exception'

const router = useRouter()
const protocolStore = useProtocolStore()
const testDataStore = useTestDataStore()
const schemeStore = usePlanSchemeStore()
const exceptionStore = useExceptionStore()

schemeStore.removeLegacyDefaults()

const selectedKey = ref('')
const selectedNode = ref(null)
const targetSearch = ref('')
const systemScrollRef = ref(null)

/* ---- 接口就绪判断（接口 → 报文 → 字段，不依赖链路节点状态） ---- */
const ifaceMessages = (iface) => (iface?.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)

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

/** 接口就绪：名下至少一个报文，且报文有可用字段（或为文件报文） */
const ifaceReady = (iface) => {
  const messages = ifaceMessages(iface)
  if (!messages.length) return false
  return messages.some((m) => m.fileId || fieldsOf(iface, null).length > 0)
}
const roleReady = (iface, role) => {
  if (!ifaceMessages(iface).length) return false
  return fieldsOf(iface, role).length > 0
}
const interfaceReady = (iface) => roleReady(iface, 'send') || roleReady(iface, 'receive')

/** 接口名下报文的异常样本数（异常按接口/报文名匹配） */
const exceptionsOfIface = (iface) => {
  const names = new Set(ifaceMessages(iface).map((m) => m.name))
  return exceptionStore.exceptions.filter((item) =>
    String(item.interfaceId) === String(iface.id) || names.has(item.iface)
  )
}

/** 首页卡片：接口卡 + 方案卡（替代原系统卡片） */
const overviewCards = computed(() => {
  const ifaces = protocolStore.testInterfaces
  const schemes = schemeStore.schemes
  const ifaceCards = ifaces.map((iface) => {
    const ready = interfaceReady(iface)
    const exceptions = exceptionsOfIface(iface)
    return {
      kind: 'iface',
      key: `iface-${iface.id}`,
      id: iface.id,
      name: iface.name,
      desc: iface.desc || '测试接口',
      ref: iface,
      ok: ready,
      ready,
      alert: exceptions.length > 0,
      metric1: (iface.messageIds || []).length,
      metric1Label: '报文',
      metric2: fieldsOf(iface, null).length,
      metric2Label: '字段',
      metric3: exceptions.length,
      metric3Label: '异常',
    }
  })
  const schemeCards = schemes.map((scheme) => {
    const ids = new Set((scheme.interfaceIds || []).map(String))
    const items = ifaces.filter((i) => ids.has(String(i.id)))
    const readyCount = items.filter(interfaceReady).length
    const messageCount = items.reduce((sum, i) => sum + (i.messageIds || []).length, 0)
    return {
      kind: 'scheme',
      key: `scheme-${scheme.id}`,
      id: scheme.id,
      name: scheme.name,
      desc: scheme.remark || '接口方案',
      ref: scheme,
      ok: readyCount > 0,
      ready: readyCount > 0,
      alert: false,
      metric1: items.length,
      metric1Label: '接口',
      metric2: readyCount,
      metric2Label: '就绪',
      metric3: messageCount,
      metric3Label: '报文',
    }
  })
  return [...ifaceCards, ...schemeCards]
})

const onCardSelect = (card) => {
  selectedKey.value = card.key
  selectedNode.value = card.ref ? { kind: card.kind, ref: card.ref } : null
  if (card.kind === 'scheme') schemeStore.select(card.id)
}

const ifaceBadge = (iface) => {
  const count = (iface?.messageIds || []).length
  if (!count) return '未配置报文'
  return `${count} 报文`
}
const schemeBadge = (scheme) => `${(scheme.interfaceIds || []).length} 接口`

const selectTarget = (node) => {
  if (!node?.ref) return
  // 方案内接口（schemeItem）按接口处理
  const kind = node.kind === 'schemeItem' ? 'iface' : node.kind
  if (!['iface', 'scheme'].includes(kind)) return
  selectedNode.value = { ...node, kind }
  if (kind === 'scheme') schemeStore.select(node.ref.id)
}

const clearTarget = () => {
  selectedKey.value = ''
  selectedNode.value = null
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

const targetTypeText = computed(() => selectedTarget.value?.kind === 'scheme' ? '方案' : '接口')

const messageReadyCount = computed(() =>
  targetInterfaces.value.filter((iface) => ifaceMessages(iface).length > 0).length
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
  return [
    {
      label: '报文配置',
      value: `${messageReadyCount.value}/${interfaceCount} 接口已配置`,
      ok: interfaceCount > 0 && messageReadyCount.value === interfaceCount,
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
  const iface = targetInterfaces.value[0]
  if (!iface) return null
  return ifaceMessages(iface)[0] || null
})
const selectedTransport = computed(() => selectedMessage.value?.transportType || '未标注')

const enterMonitor = (mode) => {
  if (!selectedTarget.value) return
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
  if (selectedTarget.value.kind === 'iface') {
    // 接口未配置报文/字段：跳转到报文字段管理定位该接口
    router.push({
      path: '/protocol',
      query: { iface: String(selectedTarget.value.id), kind: 'interface' },
    })
    return
  }
  router.push({ path: '/execution', query: { schemeId: String(selectedTarget.value.id) } })
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

  &.is-scheme-card {
    border-left: 3px solid var(--el-color-warning);
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
      border: 1px solid transparent;
      border-radius: 5px;
      background: #f3f5f8;
      color: #516174;
      font-size: 14px;
      cursor: pointer;
      transition: border-color .15s, background .15s, color .15s;

      &:hover { border-color: var(--el-color-primary-light-5); background: #edf4ff; }
      &.is-selected { border-color: var(--el-color-primary); background: #e6f0ff; color: var(--el-color-primary); }
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
