<template>
  <el-dialog
    v-model="visible"
    :title="isCreate ? '新建接口' : `配置接口 · ${form.name || '未命名'}`"
    width="640px"
    destroy-on-close
    class="iface-quick-config"
  >
    <!-- 未关联数据集警告 -->
    <el-alert
      v-if="datasetMissing"
      type="warning"
      :closable="false"
      show-icon
      class="iqc-alert"
    >
      <template #title>
        当前接口尚未关联测试数据集，请在下面选择数据集，或
        <el-button link type="primary" size="small" @click="goTestData">
          去创建测试数据集
        </el-button>
      </template>
    </el-alert>

    <!-- 已关联数据集，但数据集 → 报文 → 当前方向字段链路不完整 -->
    <el-alert
      v-else-if="fieldsMissing"
      type="warning"
      :closable="false"
      show-icon
      class="iqc-alert"
    >
      <template #title>
        数据集已关联，但其关联报文没有可用的{{ fieldDirectionLabel }}字段，请检查数据集关联报文及报文字段配置。
        <el-button link type="primary" size="small" @click="goConfigureMessage">
          去配置
        </el-button>
      </template>
    </el-alert>

    <el-form label-width="88px" label-position="left">
      <!-- 基本信息 -->
      <div class="iqc-section">基本信息</div>
      <el-form-item label="接口名称">
        <el-input v-model="form.name" placeholder="留空默认「新建接口」" clearable />
      </el-form-item>
      <el-form-item v-if="ownerEditable" label="所属">
        <div class="iqc-owner-selects">
          <el-select v-model="form.systemId" placeholder="选择系统" @change="onOwnerSystemChange">
            <el-option v-for="system in systemStore.visibleSystems" :key="system.id" :label="system.name" :value="system.id" />
          </el-select>
          <span>/</span>
          <el-select v-model="form.moduleId" placeholder="选择模块" :disabled="!form.systemId" @change="form.datasetIds = []">
            <el-option v-for="module in ownerModuleOptions" :key="module.id" :label="module.name" :value="module.id" />
          </el-select>
        </div>
      </el-form-item>
      <el-form-item v-else label="所属">
        <span class="iqc-owner">{{ systemName }} / {{ moduleName }}</span>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>

      <!-- 数据集 -->
      <div class="iqc-section">测试数据集</div>
      <el-form-item label="关联数据集">
        <template v-if="datasetOptions.length">
          <el-select v-model="form.datasetIds" multiple filterable style="width: 100%" placeholder="选择本模块的数据集">
            <el-option
              v-for="ds in datasetOptions"
              :key="ds.id"
              :label="`${ds.name}（${(ds.rows || []).length} 行）`"
              :value="ds.id"
            />
          </el-select>
        </template>
        <template v-else>
          <span class="iqc-empty-hint">
            本模块暂无数据集
            <el-button link type="primary" size="small" @click="goTestData">去创建数据集</el-button>
          </span>
        </template>
      </el-form-item>

      <!-- 执行策略 -->
      <div class="iqc-section">执行策略</div>
      <el-form-item label="触发方式">
        <el-radio-group v-model="form.strategy.trigger">
          <el-radio-button value="manual">手动</el-radio-button>
          <el-radio-button value="scheduled">定时</el-radio-button>
          <el-radio-button value="periodic">周期</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.strategy.trigger === 'scheduled'" label="执行时间">
        <el-date-picker
          v-model="form.strategy.scheduleAt"
          type="datetime"
          placeholder="选择定时执行时间"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item v-if="form.strategy.trigger === 'periodic'" label="周期设置">
        <div class="iqc-periodic">
          <span>每</span>
          <el-input-number v-model="form.strategy.periodicInterval" :min="1" :max="9999" size="small" controls-position="right" style="width: 110px" />
          <el-select v-model="form.strategy.periodicUnit" size="small" style="width: 80px">
            <el-option label="秒" value="s" />
            <el-option label="分" value="m" />
            <el-option label="时" value="h" />
            <el-option label="天" value="d" />
          </el-select>
          <span>执行，共</span>
          <el-input-number v-model="form.strategy.periodicCount" :min="1" :max="9999" size="small" controls-position="right" style="width: 110px" placeholder="不限" />
          <span>次（留空不限）</span>
        </div>
      </el-form-item>
      <el-form-item label="发送间隔">
        <el-input-number v-model="form.sendInterval" :min="50" :max="60000" :step="50" controls-position="right" style="width: 160px" />
        <span class="iqc-unit">ms / 条</span>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button @click="save()">仅保存</el-button>
      <el-tooltip :content="testBlockTip" :disabled="!blockTest" placement="top">
        <span class="iqc-btn-wrap">
          <el-button type="primary" :disabled="blockTest" @click="saveAnd('test')">保存并测试</el-button>
        </span>
      </el-tooltip>
      <template v-if="!hidePlanActions">
        <el-tooltip :content="blockTip" :disabled="!blockPlan" placement="top">
          <span class="iqc-btn-wrap">
            <el-button type="primary" plain :disabled="blockPlan" @click="saveAnd('plan')">保存并加入计划</el-button>
          </span>
        </el-tooltip>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 接口快捷配置弹窗（编排页）：
 * - 新建模式：从系统树模块层「+接口」进入，context 提供 systemId/moduleId；
 * - 编辑模式：传入 interfaceId，读写独立的测试接口对象。
 * 接口按“接口 → 数据集 → 报文 → 字段”链路获取测试内容，不直接引用字段或报文。
 */
import { computed, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  useProtocolStore,
  defaultIfaceStrategy,
  collectTestInterfaceFields,
} from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  interfaceId: { type: [String, Number], default: null }, // 非空 = 编辑模式
  context: { type: Object, default: null },               // 新建模式：{ systemId, moduleId }
  hidePlanActions: { type: Boolean, default: false },      // 接收编排等场景：不要求数据集、隐藏「加入计划/发送测试」
})
const emit = defineEmits(['update:modelValue', 'saved', 'plan', 'test'])

const router = useRouter()
const protocolStore = useProtocolStore()
const testDataStore = useTestDataStore()
const connStore = useConnectionStore()
const systemStore = useSystemStore()
const { nextUniqueName, validateName } = useEntityNameGuard()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isCreate = computed(() => !props.interfaceId)
const editingIface = computed(() =>
  props.interfaceId
    ? protocolStore.testInterfaces.find((i) => String(i.id) === String(props.interfaceId)) || null
    : null
)

const form = reactive({
  name: '',
  desc: '',
  systemId: null,
  moduleId: null,
  datasetIds: [],
  strategy: defaultIfaceStrategy(),
  sendInterval: 500,
})

watch(visible, (open) => {
  if (!open) return
  const src = editingIface.value
  form.name = src?.name || ''
  form.desc = src?.desc || ''
  form.systemId = src?.systemId ?? props.context?.systemId ?? null
  form.moduleId = src?.moduleId ?? props.context?.moduleId ?? null
  form.datasetIds = [...(src?.datasetIds || [])]
  form.strategy = { ...defaultIfaceStrategy(), ...(src?.strategy || {}) }
  form.sendInterval = src?.sendInterval || 500
}, { immediate: true })

/* ---- 归属信息 ---- */
const ownerEditable = computed(() => isCreate.value && !props.context)
const ownerSystemId = computed(() => editingIface.value?.systemId ?? props.context?.systemId ?? form.systemId ?? null)
const ownerModuleId = computed(() => editingIface.value?.moduleId ?? props.context?.moduleId ?? form.moduleId ?? null)
const systemName = computed(() => systemStore.systems.find((s) => s.id === ownerSystemId.value)?.name || '—')
const moduleName = computed(() => connStore.nodes.find((n) => n.id === ownerModuleId.value)?.name || '—')
const ownerModuleOptions = computed(() => connStore.nodes.filter((module) => module.systemId === form.systemId))

const onOwnerSystemChange = () => {
  form.moduleId = null
  form.datasetIds = []
}

/* ---- 数据集选项：按系统 + 模块过滤 ---- */
const datasetOptions = computed(() =>
  testDataStore.datasets.filter((d) => d.systemId === ownerSystemId.value && d.moduleName === moduleName.value)
)

/* ---- 接口 → 数据集 → 报文 → 字段链路不完整时禁止测试 ---- */
const linkedFields = computed(() => collectTestInterfaceFields(
  { datasetIds: form.datasetIds },
  testDataStore.datasets,
  protocolStore.interfaces,
  protocolStore.protocols,
  props.hidePlanActions ? 'receive' : 'send',
))
const fieldsMissing = computed(() => !linkedFields.value.length)
const datasetMissing = computed(() => !form.datasetIds.length)
const fieldDirectionLabel = computed(() => props.hidePlanActions ? '接收' : '发送')
const blockPlan = computed(() => fieldsMissing.value || datasetMissing.value)
const blockTest = computed(() => fieldsMissing.value || datasetMissing.value)
const blockTip = computed(() => datasetMissing.value
  ? '请先在接口配置中关联至少一个测试数据集'
  : `所选数据集关联的报文没有可用${fieldDirectionLabel.value}字段`)
const testBlockTip = computed(() => {
  if (datasetMissing.value) return '请先关联至少一个测试数据集'
  if (fieldsMissing.value) return `所选数据集关联的报文没有可用${fieldDirectionLabel.value}字段`
  return ''
})

const goConfigureMessage = () => {
  const datasetIds = new Set(form.datasetIds.map((id) => String(id)))
  const linkedMessageNames = testDataStore.datasets
    .filter((dataset) => datasetIds.has(String(dataset.id)))
    .map((dataset) => dataset.linkedInterface || dataset.linkedMessage)
    .filter(Boolean)
  const message = protocolStore.interfaces.find((item) =>
    linkedMessageNames.some((name) => item.name === name || String(item.id) === String(name))
  )

  visible.value = false
  if (!message) {
    ElMessage.warning('未找到数据集关联的报文，请先在数据集管理中重新关联')
    router.push('/test-data')
    return
  }

  protocolStore.selectedInterfaceId = message.id
  if (message.systemId) systemStore.setCurrent(message.systemId)
  router.push({ path: '/protocol', query: { kind: 'interface', iface: String(message.id) } })
}

/* ---- 保存 ---- */
const save = (silent = false) => {
  if (!ownerSystemId.value || !ownerModuleId.value) {
    ElMessage.warning('请选择所属系统和模块')
    return null
  }
  let iface = editingIface.value
  const candidateName = form.name.trim() || iface?.name || nextUniqueName('新建接口')
  const validName = validateName(candidateName, iface, '接口')
  if (!validName) return null
  if (iface) {
    iface.name = validName
    iface.desc = form.desc
    iface.datasetIds = [...form.datasetIds]
    iface.strategy = { ...form.strategy }
    iface.sendInterval = form.sendInterval || 500
  } else {
    iface = protocolStore.addTestInterface({
      name: validName,
      desc: form.desc,
      systemId: ownerSystemId.value,
      moduleId: ownerModuleId.value,
      datasetIds: [...form.datasetIds],
      strategy: { ...form.strategy },
      sendInterval: form.sendInterval || 500,
    })
  }
  if (!silent) ElMessage.success(`接口「${iface.name}」已保存`)
  emit('saved', iface.id)
  visible.value = false
  return iface
}

const saveAnd = (action) => {
  const iface = save(true)
  if (!iface) return
  if (action === 'plan') emit('plan', iface.id)
  else if (action === 'test') emit('test', iface.id)
}

const goTestData = () => {
  visible.value = false
  router.push('/test-data')
}
</script>

<style scoped lang="scss">
.iqc-alert { margin-bottom: 14px; }
.iqc-section {
  margin: 6px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.iqc-owner { color: var(--el-text-color-secondary); font-size: 13px; }
.iqc-owner-selects {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.iqc-empty-hint { color: var(--el-text-color-secondary); font-size: 13px; }
.iqc-periodic {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.iqc-unit { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.iqc-btn-wrap { display: inline-block; margin-left: 12px; }
</style>
