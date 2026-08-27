<template>
  <el-dialog
    v-model="visible"
    :title="isCreate ? '新建接口' : `配置接口 · ${form.name || '未命名'}`"
    width="640px"
    destroy-on-close
    class="iface-quick-config"
  >
    <!-- 未配置报文警告 -->
    <el-alert
      v-if="messageMissing"
      type="warning"
      :closable="false"
      show-icon
      class="iqc-alert"
    >
      <template #title>
        当前接口尚未配置报文，请在下方「报文」区添加，或
        <el-button link type="primary" size="small" @click="goConfigureMessage">
          去报文管理配置
        </el-button>
      </template>
    </el-alert>

    <!-- 已配置报文，但报文没有当前方向可用字段 -->
    <el-alert
      v-else-if="fieldsMissing"
      type="warning"
      :closable="false"
      show-icon
      class="iqc-alert"
    >
      <template #title>
        接口名下报文没有可用的{{ fieldDirectionLabel }}字段，请检查报文字段配置。
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
      <el-form-item v-if="!isCreate && form.moduleId" label="链路节点">
        <span class="iqc-owner">{{ moduleName }}（可在「链路连接管理」中修改）</span>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.desc" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>

      <!-- 报文（排他归属，1:N） -->
      <div class="iqc-section">报文</div>
      <el-form-item label="名下报文">
        <div class="iqc-msgs">
          <div v-for="m in formMessages" :key="m.id" class="iqc-msg">
            <span class="iqc-msg__name">{{ m.name }}</span>
            <el-tag size="small" effect="plain">{{ m.transportType || '—' }}</el-tag>
            <span class="iqc-msg__fields">{{ messageFieldCount(m) }} 字段</span>
            <span class="iqc-msg__ops">
              <el-button link type="primary" size="small" @click="goConfigureMessage(m)">编辑</el-button>
              <el-button link type="danger" size="small" @click="removeMessage(m.id)">移除</el-button>
            </span>
          </div>
          <div v-if="!formMessages.length" class="iqc-empty-hint">尚未配置报文，添加后接口才能加入发送/接收监控</div>
          <div class="iqc-add-msg">
            <el-input
              v-model="newMessage.name"
              placeholder="报文名称（留空默认「新建报文」）"
              size="small"
              clearable
              style="width: 220px"
            />
            <el-select v-model="newMessage.transportType" size="small" style="width: 110px">
              <el-option
                v-for="t in TRANSPORT_TYPES"
                :key="t.value"
                :label="t.label"
                :value="t.value"
                :disabled="!!t.placeholder"
              />
            </el-select>
            <el-button type="success" size="small" :disabled="!editingIface" @click="addMessage">添加报文</el-button>
          </div>
        </div>
      </el-form-item>

      <!-- 数据集 -->
      <div class="iqc-section">测试数据集</div>
      <el-form-item label="关联数据集">
        <template v-if="datasetOptions.length">
          <el-select v-model="form.datasetIds" multiple filterable style="width: 100%" placeholder="选择关联数据集">
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
            暂无可用数据集
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
  TRANSPORT_TYPES,
} from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useConnectionStore } from '@/stores/connection'
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
  messageIds: [], // 排他归属报文（1:N）
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
  form.messageIds = [...(src?.messageIds || [])]
  form.strategy = { ...defaultIfaceStrategy(), ...(src?.strategy || {}) }
  form.sendInterval = src?.sendInterval || 500
}, { immediate: true })

/* ---- 链路节点信息（可选关联，用于只读展示） ---- */
const moduleName = computed(() => connStore.nodes.find((n) => n.id === form.moduleId)?.name || '—')

/* ---- 数据集选项：按接口名下报文关联 ---- */
const datasetOptions = computed(() => {
  const msgIds = new Set(form.messageIds.map(String))
  const msgNames = new Set(formMessages.value.map((m) => m.name))
  return testDataStore.datasets.filter((d) => msgIds.has(String(d.messageId)) || msgNames.has(d.linkedInterface))
})

/* ---- 接口 → 报文 → 字段链路不完整时禁止测试 ---- */
const linkedFields = computed(() => collectTestInterfaceFields(
  { messageIds: form.messageIds },
  testDataStore.datasets,
  protocolStore.interfaces,
  protocolStore.protocols,
  props.hidePlanActions ? 'receive' : 'send',
))
const fieldsMissing = computed(() => !linkedFields.value.length)
const messageMissing = computed(() => !form.messageIds.length)
const fieldDirectionLabel = computed(() => props.hidePlanActions ? '接收' : '发送')
const blockPlan = computed(() => messageMissing.value || fieldsMissing.value)
const blockTest = computed(() => messageMissing.value || fieldsMissing.value)
const blockTip = computed(() => messageMissing.value
  ? '请先在接口配置中添加至少一个报文'
  : `接口名下报文没有可用${fieldDirectionLabel.value}字段`)
const testBlockTip = computed(() => {
  if (messageMissing.value) return '请先添加至少一个报文'
  if (fieldsMissing.value) return `接口名下报文没有可用${fieldDirectionLabel.value}字段`
  return ''
})

/* ---- 报文管理（排他归属，1:N） ---- */
const formMessages = computed(() => (form.messageIds || [])
  .map((id) => protocolStore.interfaces.find((m) => String(m.id) === String(id)))
  .filter(Boolean))
const messageFieldCount = (message) => (message?.protocolRefs || []).length
const newMessage = reactive({ name: '', transportType: 'OSE' })
const addMessage = () => {
  if (!editingIface.value) {
    ElMessage.warning('请先保存接口，再添加报文')
    return
  }
  const message = protocolStore.addMessageToInterface(editingIface.value.id, {
    name: newMessage.name.trim() || nextUniqueName('新建报文'),
    transportType: newMessage.transportType,
    desc: '',
  })
  form.messageIds = [...form.messageIds, message.id]
  newMessage.name = ''
  ElMessage.success(`报文「${message.name}」已添加，可点击「编辑」配置字段`)
}
const removeMessage = (messageId) => {
  if (!editingIface.value) return
  protocolStore.removeMessageFromInterface(editingIface.value.id, messageId)
  form.messageIds = form.messageIds.filter((id) => String(id) !== String(messageId))
  ElMessage.success('报文已移除')
}
const goConfigureMessage = (message = null) => {
  const target = message || (form.messageIds.length
    ? protocolStore.interfaces.find((m) => String(m.id) === String(form.messageIds[0]))
    : null)
  visible.value = false
  if (!target) {
    ElMessage.warning('请先添加报文')
    return
  }
  protocolStore.selectedInterfaceId = target.id
  router.push({ path: '/protocol', query: { kind: 'interface', iface: String(target.id) } })
}

/* ---- 保存（归属链路节点可选，不再强制） ---- */
const save = (silent = false) => {
  let iface = editingIface.value
  const candidateName = form.name.trim() || iface?.name || nextUniqueName('新建接口')
  const validName = validateName(candidateName, iface, '接口')
  if (!validName) return null
  if (iface) {
    iface.name = validName
    iface.desc = form.desc
    iface.datasetIds = [...form.datasetIds]
    iface.messageIds = [...form.messageIds]
    iface.strategy = { ...form.strategy }
    iface.sendInterval = form.sendInterval || 500
  } else {
    iface = protocolStore.addTestInterface({
      name: validName,
      desc: form.desc,
      systemId: form.systemId ?? null,
      moduleId: form.moduleId ?? null,
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
.iqc-empty-hint { color: var(--el-text-color-secondary); font-size: 13px; }
.iqc-msgs { width: 100%; display: flex; flex-direction: column; gap: 6px; }
.iqc-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  font-size: 13px;
  &__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__fields { color: var(--el-text-color-secondary); font-size: 12px; flex-shrink: 0; }
  &__ops { margin-left: auto; flex-shrink: 0; white-space: nowrap; }
}
.iqc-add-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
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
