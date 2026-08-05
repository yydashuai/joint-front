<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>报文字段管理</h2>
      </div>
      <div class="header-actions">
        <el-button type="success" :icon="Plus" @click="openIfaceConfig()">新增接口</el-button>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="ifaceSearch"
            placeholder="搜索接口 / 报文..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <MonitorTree
          v-model="selectedKey"
          title="报文监控树"
          editor-mode
          :search="ifaceSearch"
          :iface-badge="ifaceBadge"
          :scheme-badge="schemeBadge"
          :custom-badge="customBadge"
          :extra-context-actions="leafContextActions"
          empty-text="暂无接口，请先在接口配置中定义"
          @select="onTreeSelect"
          @add-leaf="onTreeAddLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <div class="proto-detail">
        <!-- 接口详情：选中接口时显示名下报文列表（1:N） -->
        <el-card v-if="detailIface" shadow="never" class="iface-detail">
          <div class="iface-detail__head">
            <div class="iface-detail__title">
              <el-icon class="iface-detail__icon"><Link /></el-icon>
              <span class="iface-detail__name">{{ detailIface.name }}</span>
              <el-tag size="small" type="info" effect="plain">{{ ifaceTransportType(detailIface) }}</el-tag>
              <el-tag size="small" effect="plain">{{ (detailIface.messageIds || []).length }} 报文</el-tag>
            </div>
            <div class="iface-detail__ops">
              <el-button link type="primary" size="small" @click="openIfaceConfig(detailIface.id)">编辑接口</el-button>
            </div>
          </div>
          <div class="iface-detail__meta">
            {{ ifaceSystemName(detailIface) }} / {{ ifaceModuleName(detailIface) }}
            <span v-if="detailIface.desc">· {{ detailIface.desc }}</span>
          </div>
          <div class="iface-detail__list">
            <table class="iface-detail__table">
              <thead>
                <tr>
                  <th>报文名称</th><th>传输类型</th><th>字段数</th><th class="ta-r">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in ifaceMessages(detailIface)" :key="m.id">
                  <td class="m-name">{{ m.name }}</td>
                  <td>{{ m.transportType || '—' }}</td>
                  <td>{{ messageFieldCount(m) }}</td>
                  <td class="ta-r m-ops">
                    <el-button link type="primary" size="small" @click="editMessage(m)">编辑</el-button>
                  </td>
                </tr>
                <tr v-if="!ifaceMessages(detailIface).length">
                  <td colspan="4" class="m-empty">该接口未配置报文，点击右上角「编辑接口」添加</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>

        <!-- 报文编辑 -->
        <InterfaceEditor
          v-else-if="curIf"
          :iface="curIf"
          @delete="onDeleteMessage(curIf)"
        />

        <el-empty v-else class="main main--empty" description="从左侧选择一个报文进行编辑" />
      </div>
    </div>

    <!-- 接口配置弹窗（新增/编辑接口 + 管理名下报文） -->
    <InterfaceQuickConfig v-model="ifaceConfigVisible" :interface-id="ifaceConfigId" @saved="onIfaceSaved" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Link, Plus, Search } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useCustomIfaceStore } from '@/stores/customIface'
import MonitorTree from '@/components/execution/MonitorTree.vue'
import InterfaceEditor from '@/components/protocol/InterfaceEditor.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'

const store = useProtocolStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const customStore = useCustomIfaceStore()
const router = useRouter()
const route = useRoute()

// 进入报文页时, 自动跑一次 v1→v2 数据迁移(幂等)
onMounted(() => store.migrateAllFromV1())

/* ---- 选中状态 ---- */
const selectedKey = ref('')
const ifaceSearch = ref('')

const selectedIfaceId = computed(() => {
  const m = selectedKey.value.match(/^iface-(.+)$/)
  return m ? m[1] : null
})
const detailIface = computed(() => {
  if (!selectedIfaceId.value) return null
  return store.testInterfaces.find((i) => String(i.id) === String(selectedIfaceId.value)) || null
})
const selectedMessage = computed(() => {
  const m = selectedKey.value.match(/^msg-(.+)$/)
  if (!m) return null
  return store.interfaces.find((i) => String(i.id) === String(m[1])) || null
})
const curIf = computed(() => selectedMessage.value || store.selectedInterface)

// 从数据集管理「报文」按钮跳转过来时，按 query 选中对应报文
if (route.query.kind === 'interface' && route.query.iface) {
  store.selectedInterfaceId = route.query.iface
  selectedKey.value = `msg-${route.query.iface}`
}

// 从规则页跳转过来时，自动选中对应报文
watch(() => route.query.interfaceId, (ifaceId) => {
  if (!ifaceId) return
  const iface = store.interfaces.find((i) => String(i.id) === String(ifaceId))
  if (iface) {
    store.selectedInterfaceId = iface.id
    selectedKey.value = `msg-${iface.id}`
  }
}, { immediate: true })

/* ---- 接口/报文解析辅助（排他归属 1:N） ---- */
const ifaceMessages = (iface) => (iface?.messageIds || [])
  .map((id) => store.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean)
const ifaceTransportType = (iface) => ifaceMessages(iface)[0]?.transportType || '—'
const messageFieldCount = (message) => (message?.protocolRefs || []).length
const ifaceSystemName = (iface) => systemStore.systems.find((s) => s.id === iface?.systemId)?.name || '—'
const ifaceModuleName = (iface) => connStore.nodes.find((n) => n.id === iface?.moduleId)?.name || '—'

/* ---- 树徽标 ---- */
const ifaceBadge = (iface) => {
  const count = (iface.messageIds || []).length
  return count ? `${count} 报文` : '未配置报文'
}
const schemeBadge = (scheme) => `${(scheme.interfaceIds || []).length} 接口`
const customBadge = (custom) =>
  `${custom.transportType || '—'}·${custom.bodyHex || custom.transportConfig?.targetAddress ? '已配置' : '待配置'}`

/* ---- 树事件 ---- */
const onTreeSelect = (data) => {
  if (!data?.ref) return
  selectedKey.value = data.key
  if (data.kind === 'message') {
    store.selectedInterfaceId = data.ref.id
    return
  }
  // 接口：显示详情卡片；方案 / 密文接口：报文管理页不打开任何编辑界面
  store.selectedInterfaceId = null
}

const onTreeAddLeaf = ({ groupKind }) => {
  if (groupKind === 'iface') openIfaceConfig()
}

/* ---- 报文右键：生成校验规则（附加项） ---- */
const leafContextActions = (nodeData) => {
  if (nodeData?.kind !== 'message') return []
  return [{ label: '生成校验规则', action: 'generateRules' }]
}

const onLeafAction = ({ action, data }) => {
  if (!data?.ref) return
  if (action === 'generateRules') {
    router.push({ path: '/rule', query: { interfaceId: String(data.ref.id), action: 'generate' } })
  }
  if (action === 'config-message') editMessage(data.ref)
  if (action === 'config-iface') openIfaceConfig(data.ref.id)
  if (action === 'add-message') openIfaceConfig(data.ref.id)
  if (action === 'delete-message') onDeleteMessage(data.ref)
  if (action === 'delete-iface') onDeleteIface(data.ref)
  if (action === 'delete-custom') {
    customStore.remove(data.ref.id)
    selectedKey.value = ''
    ElMessage.success('自定义接口已删除')
  }
}

const editMessage = (message) => {
  if (!message) return
  store.selectedInterfaceId = message.id
  selectedKey.value = `msg-${message.id}`
}

const onDeleteMessage = (message) => {
  if (!message) return
  ElMessageBox.confirm(`确定删除报文「${message.name}」吗？删除后不可恢复。`, '删除报文', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
  }).then(() => {
    store.removeMessageFromInterface(message.ownerIfaceId, message.id)
    store.selectedInterfaceId = null
    selectedKey.value = ''
    ElMessage.success('报文已删除')
  }).catch(() => {})
}

const onDeleteIface = (iface) => {
  if (!iface) return
  const count = (iface.messageIds || []).length
  const tip = count ? `接口名下 ${count} 个报文将一并删除，此操作不可撤销。` : ''
  ElMessageBox.confirm(`${tip}确定删除接口「${iface.name}」吗？`, '删除接口', {
    type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
  }).then(() => {
    store.removeTestInterface(iface.id)
    store.selectedInterfaceId = null
    selectedKey.value = ''
    ElMessage.success('接口已删除')
  }).catch(() => {})
}

/* ---- 接口配置弹窗（新增/编辑 + 管理报文） ---- */
const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)
const openIfaceConfig = (id = null) => {
  ifaceConfigId.value = id
  ifaceConfigVisible.value = true
}
const onIfaceSaved = (id) => {
  if (!id) return
  selectedKey.value = `iface-${id}`
  store.selectedInterfaceId = null
}
</script>

<style scoped lang="scss">
.page { height: 100%; min-height: 0; }
.proto { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.page__header { flex-shrink: 0; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.split { flex: 1; min-height: 0; display: flex; gap: 16px; overflow: hidden; }
.tree-panel {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.tree-search { width: 100%; min-width: 0; flex-shrink: 0; }
:deep(.mtree) {
  width: 100%;
  min-width: 0;
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.mtree > .el-card__body) { min-height: 0; overflow: hidden; }
.proto-detail { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; flex: 1; min-height: 0; overflow: hidden; }
.proto-detail > :deep(.el-card.main) { flex: 1; min-height: 0; overflow: hidden; }
.main--empty {
  flex: 1;
  min-width: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.iface-detail {
  flex-shrink: 0;
  border-radius: 8px;
  :deep(.el-card__body) { padding: 12px 16px; }
  &__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  &__title { display: flex; align-items: center; gap: 8px; min-width: 0; }
  &__icon { color: var(--el-color-success); font-size: 15px; }
  &__name { font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__meta { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__list { margin-top: 10px; max-height: 240px; overflow: auto; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; }
  &__table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 12px;
    th, td { padding: 6px 10px; text-align: left; }
    thead th { color: var(--el-text-color-secondary); background: var(--el-fill-color-light); font-weight: 500; position: sticky; top: 0; }
    tbody tr { border-top: 1px solid var(--el-border-color-lighter); }
    tbody tr:hover { background: var(--el-fill-color-extra-light); }
    .m-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .m-empty { color: var(--el-text-color-placeholder); text-align: center; padding: 12px 0; }
    .m-ops { white-space: nowrap; }
  }
}
.ta-r { text-align: right !important; }
</style>
