<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>报文字段管理</h2>
      </div>
      <div class="header-actions">
        <el-button type="success" :icon="Plus" @click="addHeaderInterface">新增报文</el-button>
      </div>
    </div>

    <div class="split">
      <SystemModuleTree
        class="proto-tree"
        :model-value="currentKey"
        title="系统 · 模块 · 报文"
        :leaf-groups="ifaceLeafGroups"
        :leaf-context-actions="leafContextActions"
        empty-text="暂无系统/模块，请先在链路连接管理添加"
        @select="onTreeSelect"
        @add-leaf="onTreeAddLeaf"
        @delete-leaf="onTreeDeleteLeaf"
        @leaf-action="onLeafAction"
      />

      <div class="proto-detail">
        <InterfaceEditor
          v-if="curIf"
          :iface="curIf"
          @delete="store.removeInterface(curIf.id)"
        />

        <el-empty v-if="!curIf" class="main main--empty" description="从左侧选择一个报文进行编辑" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import InterfaceEditor from '@/components/protocol/InterfaceEditor.vue'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const store = useProtocolStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const { nextUniqueName } = useEntityNameGuard()
const router = useRouter()
const route = useRoute()

// 进入报文页时, 自动跑一次 v1→v2 数据迁移(幂等)
onMounted(() => store.migrateAllFromV1())

if (!store.selectedInterfaceId) store.selectedInterfaceId = store.interfaces[0]?.id ?? null
// 从数据集管理「报文」按钮跳转过来时，按 query 选中对应报文
if (route.query.kind === 'interface') {
  if (route.query.iface) store.selectedInterfaceId = Number(route.query.iface)
}

const curIf = computed(() => store.selectedInterface)

// 模块下直接是报文叶子节点（不再有「字段」组；字段在报文内联定义）
const ifaceLeafGroups = (module) => {
  const ifaces = store.interfaces.filter((i) => i.moduleId === module.id)
  return [
    {
      key: `ig-${module.id}`,
      kind: 'ifGroup',
      icon: 'Operation',
      label: '报文',
      count: ifaces.length,
      addLabel: '+报文',
      addType: 'success',
      items: ifaces.map((i) => ({ key: `i-${i.id}`, kind: 'interface', icon: 'Link', label: i.name, ref: i, module }))
    }
  ]
}

const currentKey = computed(() =>
  store.selectedInterfaceId ? `i-${store.selectedInterfaceId}` : ''
)

const onTreeSelect = (data) => {
  if (data.kind === 'interface') store.selectedInterfaceId = data.ref.id
}

const addInterfaceLeaf = (module) => {
  store.addInterface({ name: nextUniqueName('新建报文'), systemId: module.systemId, moduleId: module.id })
}

const headerTargetModule = computed(() => {
  const selectedModule = connStore.nodes.find((module) => module.id === curIf.value?.moduleId)
  if (selectedModule && (!systemStore.currentId || selectedModule.systemId === systemStore.currentId)) {
    return selectedModule
  }
  return connStore.nodes.find((module) => !systemStore.currentId || module.systemId === systemStore.currentId) || null
})

const addHeaderInterface = () => {
  if (!headerTargetModule.value) {
    ElMessage.warning('请先在链路连接管理中添加模块')
    return
  }
  addInterfaceLeaf(headerTargetModule.value)
}

const onTreeAddLeaf = ({ module }) => addInterfaceLeaf(module)

const onTreeDeleteLeaf = (node) => {
  if (node.kind === 'interface') store.removeInterface(node.ref.id)
}

/* ---- 报文右键菜单：跳转到规则管理 ---- */
const leafContextActions = (nodeData) => {
  if (nodeData?.kind !== 'interface') return []
  return [{ label: '生成校验规则', action: 'generateRules' }]
}
const onLeafAction = ({ action, data }) => {
  if (action === 'generateRules' && data?.ref) {
    router.push({ path: '/rule', query: { interfaceId: String(data.ref.id), action: 'generate' } })
  }
}

// 从规则页跳转过来时，自动选中对应报文
watch(() => route.query.interfaceId, (ifaceId) => {
  if (!ifaceId) return
  const iface = store.interfaces.find((i) => String(i.id) === String(ifaceId))
  if (iface) store.selectedInterfaceId = iface.id
}, { immediate: true })
</script>

<style scoped lang="scss">
.page { height: 100%; min-height: 0; }
.proto { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.page__header { flex-shrink: 0; }
.header-actions { display: flex; align-items: center; gap: 10px; }
.split { flex: 1; min-height: 0; display: flex; gap: 16px; overflow: hidden; }
.proto-tree { width: 300px; flex-shrink: 0; min-height: 0; overflow: auto; }
.proto-detail { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; flex: 1; min-height: 0; overflow: hidden; }
.proto-detail > :deep(.el-card.main) { flex: 1; min-height: 0; overflow: hidden; }
.main--empty {
  flex: 1;
  min-width: 0;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
}
</style>
