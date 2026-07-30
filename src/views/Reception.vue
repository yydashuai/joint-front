<template>
  <div class="page reception-page">
    <div class="page__header">
      <div>
        <h2>接收接口编排</h2>
        <div class="page__desc">编排监听接口、实时接收数据流、两层校验（结构层 / 字段层）并沉淀异常台账</div>
      </div>
      <div class="header-actions">
        <el-select v-model="systemSelectValue" class="system-select" placeholder="系统上下文">
          <el-option
            v-for="item in systemOptions"
            :key="item.selectValue"
            :label="item.label"
            :value="item.selectValue"
          />
        </el-select>
      </div>
    </div>

    <div class="split">
      <div class="tree-panel">
        <div class="tree-search">
          <el-input
            v-model="ifaceSearch"
            placeholder="搜索接口..."
            :prefix-icon="Search"
            size="small"
            clearable
          />
        </div>
        <SystemModuleTree
          v-model="selectedKey"
          title="接收接口"
          draggable-leaves
          :leaf-groups="leafGroups"
          :leaf-context-actions="leafContextActions"
          @select="onTreeSelect"
          @add-leaf="onAddLeaf"
          @delete-leaf="onDeleteLeaf"
          @leaf-action="onLeafAction"
        />
      </div>

      <div class="main-panel">
        <el-card shadow="never" class="reception-wizard">
          <div class="wizard-shell">
            <div class="wizard-steps" aria-label="接收编排步骤">
              <button
                v-for="(step, index) in wizardSteps"
                :key="step.name"
                type="button"
                class="wizard-step"
                :class="{
                  'wizard-step--active': activeTab === step.name,
                  'wizard-step--done': index < activeStepIndex,
                }"
                :disabled="!canOpenStep(index)"
                @click="goWizardStep(step.name, index)"
              >
                <span class="wizard-step__index">{{ index + 1 }}</span>
                <span class="wizard-step__copy">
                  <strong>{{ step.title }}</strong>
                  <small>{{ step.desc }}</small>
                </span>
              </button>
            </div>

            <div class="wizard-body">
              <div v-show="activeTab === 'plan'" class="step-panel plan-layout">
                <ReceptionPlanTable
                  :selected-iface="selectedIface"
                  :selected-in-plan="!!isSelectedInPlan"
                  @add-selected="addSelectedIface"
                  @drop-iface="addInterfaceFromDrop"
                  @reset-run="recvStore.reset()"
                />
              </div>
              <div v-show="activeTab === 'monitor'" class="step-panel">
                <ReceiveMonitor />
              </div>
            </div>

            <div class="wizard-footer">
              <div class="wizard-footer__meta">
                <strong>{{ currentStep.title }}</strong>
                <span>{{ currentStep.helper }}</span>
              </div>
              <div class="wizard-actions">
                <el-button :icon="ArrowLeft" :disabled="prevDisabled" @click="prevStep">上一步</el-button>
                <template v-if="activeTab === 'monitor'">
                  <el-button
                    v-if="recvStore.status !== 'paused'"
                    :icon="VideoPause"
                    :disabled="recvStore.status !== 'listening'"
                    @click="recvStore.pause()"
                  >
                    暂停
                  </el-button>
                  <el-button v-else type="success" :icon="VideoPlay" @click="resumeRun">继续</el-button>
                  <el-button
                    type="danger"
                    plain
                    :icon="SwitchButton"
                    :disabled="!['listening', 'paused'].includes(recvStore.status)"
                    @click="recvStore.stop()"
                  >
                    终止
                  </el-button>
                </template>
                <el-tooltip :content="primaryTip" :disabled="!primaryDisabled" placement="top">
                  <span>
                    <el-button
                      type="primary"
                      :icon="primaryIcon"
                      :disabled="primaryDisabled"
                      @click="nextStep"
                    >
                      {{ primaryButtonText }}
                    </el-button>
                  </span>
                </el-tooltip>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 接口快捷配置弹窗（模块层「+接口」/ 右键「配置接口」；接收侧不要求数据集，隐藏加入计划/发送测试） -->
    <InterfaceQuickConfig
      v-model="ifaceConfigVisible"
      :interface-id="ifaceConfigId"
      :context="ifaceConfigContext"
      :hide-plan-actions="true"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, ArrowRight, RefreshRight, Search, SwitchButton, VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import ReceptionPlanTable from '@/components/reception/ReceptionPlanTable.vue'
import ReceiveMonitor from '@/components/reception/ReceiveMonitor.vue'
import InterfaceQuickConfig from '@/components/execution/InterfaceQuickConfig.vue'
import { useConnectionStore } from '@/stores/connection'
import { useReceptionStore } from '@/stores/reception'
import { useSystemStore } from '@/stores/system'
import { useProtocolStore } from '@/stores/protocol'

const route = useRoute()
const router = useRouter()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const protocolStore = useProtocolStore()
const recvStore = useReceptionStore()

const selectedKey = ref('')
const ifaceSearch = ref('')
const activeTab = ref('plan')
const wizardSteps = [
  { name: 'plan', title: '编排监听计划', desc: '选择接口并确认顺序', helper: '先把要监听的接收接口按顺序加入编排，确认字段定义（解析依据）已就绪。' },
  { name: 'monitor', title: '实时接收监控', desc: '启动监听并观察数据流', helper: '监听过程中关注接收、两层校验判定、异常台账与（无法解析报文的）转发 / 保存。' },
]

const ALL_SYSTEM_VALUE = '__all__'
const systemOptions = computed(() => systemStore.options.map((item) => ({
  ...item,
  selectValue: item.value == null ? ALL_SYSTEM_VALUE : item.value,
})))
const systemSelectValue = computed({
  get: () => systemStore.currentId ?? ALL_SYSTEM_VALUE,
  set: (value) => systemStore.setCurrent(value === ALL_SYSTEM_VALUE ? null : value),
})

const selectedIface = computed(() => {
  const m = selectedKey.value.match(/^iface-(.+)$/)
  if (!m) return null
  return protocolStore.interfaces.find((i) => String(i.id) === String(m[1])) || null
})
const isSelectedInPlan = computed(() => {
  if (!selectedIface.value) return false
  return recvStore.plan.some((p) => String(p.interfaceId) === String(selectedIface.value.id))
})

const activeStepIndex = computed(() => Math.max(0, wizardSteps.findIndex((step) => step.name === activeTab.value)))
const currentStep = computed(() => wizardSteps[activeStepIndex.value] || wizardSteps[0])
const maxReachableStepIndex = computed(() => {
  if (['listening', 'paused', 'stopped', 'done'].includes(recvStore.status)) return 1
  if (recvStore.planItems.length) return 1
  return 0
})
const canOpenStep = (index) => index <= maxReachableStepIndex.value
const prevDisabled = computed(() => activeStepIndex.value === 0 || ['listening', 'paused'].includes(recvStore.status))

const startTip = computed(() => {
  if (!recvStore.planItems.length) return '请先从左侧接口树加入监听计划'
  return '可以开始监听'
})
const primaryButtonText = computed(() => {
  if (activeTab.value === 'plan') return '开始监听并监控'
  if (['done', 'stopped'].includes(recvStore.status)) return '重新监听'
  return '进入实时监控'
})
const primaryIcon = computed(() => (['done', 'stopped'].includes(recvStore.status) && activeTab.value === 'monitor') ? RefreshRight : ArrowRight)
const primaryDisabled = computed(() => {
  if (activeTab.value === 'plan') return !recvStore.planItems.length
  if (activeTab.value === 'monitor') return !['done', 'stopped'].includes(recvStore.status)
  return false
})
const primaryTip = computed(() => {
  if (activeTab.value === 'plan') return '请先加入至少一个接收接口'
  if (activeTab.value === 'monitor') return '监听完成后可重新监听'
  return ''
})

/* ---- 接口配置状态徽标：未配置字段 → 「未配置字段」；已配置 → N字段（未绑规则时提示） ---- */
const recvIfaceBadge = (iface) => {
  if (!(iface.protocolRefs || []).length) return '未配置字段'
  const fieldCount = (iface.protocolRefs || []).length
  return `${fieldCount} 字段`
}

const leafGroups = (module) => {
  const kw = ifaceSearch.value.toLowerCase()
  let ifaces = protocolStore.interfaces.filter((i) => i.moduleId === module.id)
  if (kw) {
    ifaces = ifaces.filter((i) =>
      i.name.toLowerCase().includes(kw) ||
      (i.desc || '').toLowerCase().includes(kw)
    )
  }
  return [{
    flat: true,
    kind: 'iface',
    addLabel: '+接口',
    addType: 'success',
    items: ifaces.map((iface) => ({
      key: `iface-${iface.id}`,
      kind: 'iface',
      icon: 'Link',
      label: iface.name,
      badge: recvIfaceBadge(iface),
      ref: iface,
      module,
    })),
  }]
}

const leafContextActions = (nodeData) => {
  if (nodeData?.kind === 'iface' && nodeData.ref) {
    return [
      { label: '配置接口', action: 'config-iface' },
      { label: '加入监听计划', action: 'iface-to-plan' },
    ]
  }
  return []
}

const onTreeSelect = (data) => {
  if (data.kind === 'iface' && data.ref) {
    selectedKey.value = data.key
  }
}

/* ---- 接口快捷配置弹窗（接收侧仅作字段/归属配置，不要求数据集） ---- */
const ifaceConfigVisible = ref(false)
const ifaceConfigId = ref(null)
const ifaceConfigContext = ref(null)
const openIfaceConfig = (interfaceId = null, module = null) => {
  ifaceConfigId.value = interfaceId
  ifaceConfigContext.value = module ? { systemId: module.systemId, moduleId: module.id } : null
  ifaceConfigVisible.value = true
}

/* ---- 接收侧就绪：必须已配置字段定义（解析依据）；规则可选，不强制要求数据集 ---- */
const interfaceReadiness = (iface) => {
  const reasons = []
  if (!(iface.protocolRefs || []).length) {
    reasons.push('未引用任何协议字段（报文为空帧，无法解析与校验）')
  }
  return { ok: !reasons.length, reasons }
}

const addInterfaceToPlan = (interfaceId) => {
  const iface = protocolStore.interfaces.find((i) => String(i.id) === String(interfaceId))
  if (!iface) {
    ElMessage.warning('未找到对应接口')
    return false
  }
  const readiness = interfaceReadiness(iface)
  if (!readiness.ok) {
    ElMessage.error(`接口「${iface.name}」未配置字段，无法加入监听计划：${readiness.reasons.join('；')}`)
    openIfaceConfig(iface.id)
    return false
  }
  const added = recvStore.addToPlan(iface.id)
  selectedKey.value = `iface-${iface.id}`
  if (added) ElMessage.success(`接口「${iface.name}」已加入监听计划`)
  else ElMessage.info(`接口「${iface.name}」已在监听计划中`)
  return true
}

const addSelectedIface = () => {
  if (!selectedIface.value) return
  addInterfaceToPlan(selectedIface.value.id)
}
const addInterfaceFromDrop = (interfaceId) => addInterfaceToPlan(interfaceId)

const onLeafAction = ({ action, data }) => {
  if (action === 'config-iface' && data?.ref) openIfaceConfig(data.ref.id)
  if (action === 'iface-to-plan' && data?.ref) addInterfaceToPlan(data.ref.id)
}

const onAddLeaf = ({ module }) => {
  if (module) openIfaceConfig(null, module)
}

const onDeleteLeaf = (node) => {
  if (node.kind === 'iface' && node.ref) {
    protocolStore.removeInterface(node.ref.id)
    ElMessage.success('接口已删除')
  }
}

const startRun = () => {
  if (!recvStore.start()) {
    ElMessage.warning(startTip.value)
    return
  }
  activeTab.value = 'monitor'
}

const goWizardStep = (name, index) => {
  if (!canOpenStep(index)) return
  activeTab.value = name
}

const prevStep = () => {
  const prev = wizardSteps[activeStepIndex.value - 1]
  if (prev) activeTab.value = prev.name
}

const nextStep = () => {
  if (activeTab.value === 'plan') {
    startRun()
    return
  }
  if (activeTab.value === 'monitor') {
    rerun()
  }
}

const resumeRun = () => {
  recvStore.resume()
  activeTab.value = 'monitor'
}

const rerun = () => {
  recvStore.reset()
  activeTab.value = 'plan'
}

watch(() => recvStore.status, (status) => {
  if (status === 'listening') activeTab.value = 'monitor'
})

onMounted(() => {
  const jumpInterfaceId = route.query.interfaceId
  if (jumpInterfaceId) {
    addInterfaceToPlan(jumpInterfaceId)
    router.replace({ path: '/reception' })
  }
})

onBeforeUnmount(() => {
  if (recvStore.status === 'listening') recvStore.pause()
})
</script>

<style scoped lang="scss">
.reception-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.system-select { width: 220px; }
.split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.tree-panel {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.tree-search {
  width: 100%;
  min-width: 0;
  flex-shrink: 0;
  :deep(.el-input) { width: 100%; }
}
:deep(.smt) {
  width: 100%;
  min-width: 0;
  flex: 1;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
:deep(.smt > .el-card__body) {
  min-height: 0;
  overflow: hidden;
}
.main-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
}
.reception-wizard {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  :deep(.el-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
  }
}
.wizard-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.wizard-steps {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: linear-gradient(180deg, #fbfdff, #f6f8fb);
}
.wizard-step {
  min-width: 0;
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
}
.wizard-step:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 6px 18px rgba(31, 49, 80, .07);
}
.wizard-step:disabled {
  cursor: not-allowed;
  opacity: .62;
}
.wizard-step:disabled:hover {
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
}
.wizard-step--active {
  border-color: var(--el-color-primary);
  background: linear-gradient(180deg, #ffffff, #f0f6ff);
  box-shadow: inset 0 -2px 0 var(--el-color-primary);
}
.wizard-step--done .wizard-step__index {
  color: #fff;
  background: var(--el-color-success);
  border-color: var(--el-color-success);
}
.wizard-step__index {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid var(--el-border-color);
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-extra-light);
  font: 700 13px Consolas, Monaco, monospace;
}
.wizard-step--active .wizard-step__index {
  color: #fff;
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
}
.wizard-step__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.wizard-step__copy strong {
  font-size: 14px;
  font-weight: 650;
}
.wizard-step__copy small {
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wizard-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 18px;
}
.step-panel {
  min-height: 0;
}
.wizard-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: #fff;
}
.wizard-footer__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.wizard-footer__meta strong {
  font-size: 14px;
  font-weight: 650;
}
.wizard-footer__meta span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.wizard-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.plan-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
@media (max-width: 1180px) {
  .reception-page { overflow: auto; }
  .split { flex-direction: column; }
  .tree-panel { width: 100%; min-height: 320px; }
  .wizard-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wizard-footer { align-items: flex-start; flex-direction: column; }
  .wizard-actions { width: 100%; justify-content: flex-end; }
}
</style>
