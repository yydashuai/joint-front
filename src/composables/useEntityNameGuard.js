import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useProtocolStore } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { usePlanSchemeStore } from '@/stores/planScheme'
import { useDatasetSchemeStore } from '@/stores/datasetScheme'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useTestTaskStore } from '@/stores/testTask'
import { useRuleStore } from '@/stores/rule'
import { normalizeEntityName } from '@/utils/entityName'

export { normalizeEntityName } from '@/utils/entityName'

export const useEntityNameGuard = () => {
  const protocolStore = useProtocolStore()
  const testDataStore = useTestDataStore()
  const planSchemeStore = usePlanSchemeStore()
  const datasetSchemeStore = useDatasetSchemeStore()
  const systemStore = useSystemStore()
  const connectionStore = useConnectionStore()
  const testTaskStore = useTestTaskStore()
  const ruleStore = useRuleStore()

  const namedEntities = computed(() => [
    ...systemStore.systems.map((item) => ({ item, type: '联试对象' })),
    ...connectionStore.nodes.map((item) => ({ item, type: '链路节点' })),
    ...protocolStore.protocols.map((item) => ({ item, type: '字段' })),
    ...protocolStore.interfaces.map((item) => ({ item, type: '报文' })),
    ...protocolStore.testInterfaces.map((item) => ({ item, type: '接口' })),
    ...testDataStore.datasets.map((item) => ({ item, type: '数据集' })),
    ...testDataStore.files.map((item) => ({ item, type: '数据文件' })),
    ...planSchemeStore.schemes.map((item) => ({ item, type: '方案' })),
    ...datasetSchemeStore.schemes.map((item) => ({ item, type: '方案' })),
    ...testTaskStore.tasks.map((item) => ({ item, type: '任务' })),
    ...ruleStore.ruleSets.map((item) => ({ item, type: '规则集' })),
  ])

  const findDuplicate = (name, current = null) => {
    const normalized = normalizeEntityName(name)
    if (!normalized) return null
    return namedEntities.value.find(({ item }) =>
      item !== current && normalizeEntityName(item.name) === normalized
    ) || null
  }

  const nextUniqueName = (baseName, current = null) => {
    const base = String(baseName ?? '').trim() || '新建名称'
    if (!findDuplicate(base, current)) return base
    let index = 2
    while (findDuplicate(`${base}${index}`, current)) index += 1
    return `${base}${index}`
  }

  const validateName = (name, current = null, type = '名称') => {
    const trimmed = String(name ?? '').trim()
    if (!trimmed) {
      ElMessage.warning(`请输入${type}名称`)
      return null
    }
    if (type === '字段' && /(请求|响应|发送|接收)/.test(trimmed)) {
      ElMessage.warning('字段名称不能包含请求、响应、发送或接收等方向词，字段本身不设置方向')
      return null
    }
    const duplicate = findDuplicate(trimmed, current)
    if (duplicate) {
      ElMessage.warning(`名称“${trimmed}”已被${duplicate.type}使用，请更换名称`)
      return null
    }
    return trimmed
  }

  return {
    findDuplicate,
    nextUniqueName,
    validateName,
  }
}
