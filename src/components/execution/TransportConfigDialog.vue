<template>
  <!-- ===== 第 1 步：传输配置 ===== -->
  <el-dialog
    :model-value="modelValue"
    title="传输配置（1/2）"
    width="820px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="onDialogClose"
  >
    <el-empty v-if="!interfaces.length" description="请先在「发送接口列表」中添加接口，再配置传输参数" />
    <div v-else class="tc-layout">
      <div class="tc-list">
        <div class="tc-list__title">计划中接口</div>
        <div
          v-for="itf in interfaces"
          :key="itf.id"
          class="tc-item"
          :class="{ 'is-active': itf.id === selectedId }"
          @click="selectedId = itf.id"
        >
          <el-icon><Link /></el-icon>
          <span class="tc-item__name">{{ itf.name }}</span>
          <el-tag size="small" effect="plain" type="info">{{ itf.transportType || '未配置' }}</el-tag>
        </div>
      </div>

      <div class="tc-form" v-if="selected">
        <div class="tc-form__head">
          <span class="tc-form__name">{{ selected.name }}</span>
          <span class="req-label">传输类型</span>
          <el-select v-model="selected.transportType" size="small" style="width: 160px" @change="onTypeChange">
            <el-option v-for="t in TRANSPORT_TYPES" :key="t.value" :label="t.label" :value="t.value">
              <span>{{ t.label }}</span>
              <span style="float:right;color:var(--el-text-color-secondary);font-size:12px">{{ t.desc }}</span>
            </el-option>
          </el-select>
        </div>
        <TransportConfigForm
          :transport-config="selected.transportConfig"
          :transport-type="selected.transportType"
        />
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="step-tip"
          title="第 2 步将根据所选传输类型/协议配置报文头"
        />
      </div>
    </div>
    <template #footer>
      <el-button @click="onDialogClose(false)">取消</el-button>
      <el-button type="primary" plain @click="openStep2">下一步 → 报文头配置</el-button>
    </template>
  </el-dialog>

  <!-- ===== 第 2 步：报文头配置（独立弹窗） ===== -->
  <el-dialog
    :model-value="step2Visible"
    title="报文头配置（2/2）"
    width="620px"
    :close-on-click-modal="false"
    append-to-body
    @update:model-value="step2Visible = $event"
  >
    <template v-if="selected">
      <div class="s2-head">
        <span class="tc-form__name">{{ selected.name }}</span>
        <el-tag size="small" effect="plain" type="info">{{ selected.transportType || '—' }}</el-tag>
        <span class="s2-head__hint">报文头按协议与传输配置定义</span>
      </div>

      <div class="hc-form">
        <div class="form-row">
          <span class="form-label req">帧头标志</span>
          <el-input v-model="headerConfig.headFlag" class="mono" style="width: 200px" placeholder="如 EB 90" />
        </div>
        <div class="form-row">
          <span class="form-label req">消息号</span>
          <el-input v-model="headerConfig.messageId" class="mono" style="width: 200px" placeholder="如 0x01" />
        </div>
        <div class="form-row">
          <span class="form-label">数据长度</span>
          <el-select v-model="headerConfig.lengthField" style="width: 200px">
            <el-option label="自动计算" value="auto" />
            <el-option label="手动指定" value="manual" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label">校验方式</span>
          <el-select v-model="headerConfig.checksum" style="width: 200px">
            <el-option label="无" value="none" />
            <el-option label="累加和" value="sum" />
            <el-option label="CRC16" value="crc16" />
          </el-select>
        </div>
        <div class="form-row form-row--block">
          <span class="form-label">备注</span>
          <el-input v-model="headerConfig.remark" type="textarea" :rows="2" placeholder="可选" style="max-width: 420px" />
        </div>
      </div>

      <!-- 自定义接口：报文体数据（可为加密，系统不解析） -->
      <template v-if="hasBodyHex">
        <el-divider content-position="left">报文体数据</el-divider>
        <div class="form-row form-row--block">
          <span class="form-label req">报文体（hex）</span>
          <el-input
            v-model="selected.bodyHex"
            type="textarea"
            :rows="4"
            class="mono"
            placeholder="粘贴原始报文数据（可为加密后的数据），系统不解析"
            style="max-width: 460px"
          />
          <span class="form-hint">数据将被原样透传发送</span>
        </div>
      </template>
    </template>
    <template #footer>
      <el-button @click="backToStep1">上一步</el-button>
      <el-button type="primary" @click="finishStep2">完成</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Link } from '@element-plus/icons-vue'
import { TRANSPORT_TYPES, makeTransportConfig } from '@/stores/protocol'
import { makeHeaderConfig } from '@/stores/customIface'
import TransportConfigForm from '@/components/protocol/TransportConfigForm.vue'

const props = defineProps({
  modelValue: Boolean,
  interfaces: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const selectedId = ref(null)
const step2Visible = ref(false)
const selected = computed(() => props.interfaces.find((i) => i.id === selectedId.value) || null)
/* 自定义接口特征：拥有 bodyHex 字段（系统接口无该字段） */
const hasBodyHex = computed(() => !!selected.value && Object.prototype.hasOwnProperty.call(selected.value, 'bodyHex'))

/* 第二步打开的 headerConfig：直接挂在接口对象上（系统接口与自定义接口统一） */
const headerConfig = computed(() => {
  if (!selected.value) return null
  if (!selected.value.headerConfig) {
    selected.value.headerConfig = makeHeaderConfig(selected.value.transportType || 'OSE')
  }
  return selected.value.headerConfig
})

watch(() => props.modelValue, (v) => {
  if (v && props.interfaces.length) {
    step2Visible.value = false
    selectedId.value = selectedId.value && props.interfaces.some((i) => i.id === selectedId.value)
      ? selectedId.value
      : props.interfaces[0].id
  }
})

const onTypeChange = (type) => {
  if (!selected.value) return
  selected.value.transportConfig = type ? makeTransportConfig(type) : {}
  // 切换类型后报文头模板随协议更新
  selected.value.headerConfig = makeHeaderConfig(type)
}

const openStep2 = () => {
  if (!selected.value) return
  // 确保 headerConfig 初始化
  headerConfig.value
  step2Visible.value = true
}
const backToStep1 = () => { step2Visible.value = false }
const finishStep2 = () => {
  step2Visible.value = false
  emit('update:modelValue', false)
}
const onDialogClose = (val) => {
  emit('update:modelValue', val)
}
</script>

<style scoped lang="scss">
.tc-layout { display: flex; gap: 16px; min-height: 380px; }
.tc-list { width: 240px; flex-shrink: 0; border-right: 1px solid var(--el-border-color-lighter); padding-right: 12px; overflow: auto; }
.tc-list__title { font-size: 13px; font-weight: 600; color: var(--el-text-color-regular); margin-bottom: 8px; }
.tc-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid transparent; margin-bottom: 4px;
  &:hover { background: var(--el-fill-color-light); }
  &.is-active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
  &__name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
}
.tc-form { flex: 1; min-width: 0; overflow: auto; }
.tc-form__head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.tc-form__name { font-weight: 600; font-size: 14px; }
.req-label { font-size: 13px; color: var(--el-text-color-regular); margin-left: 8px; }
.req-label::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.step-tip { margin-top: 8px; }

/* 第 2 步 */
.s2-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.s2-head__hint { font-size: 12px; color: var(--el-text-color-secondary); }
.hc-form { display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-row--block { flex-direction: column; align-items: flex-start; }
.form-label { font-size: 13px; color: var(--el-text-color-regular); min-width: 90px; flex-shrink: 0; }
.form-label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.form-hint { font-size: 12px; color: var(--el-text-color-placeholder); }
.mono input, .mono textarea, .mono { font-family: Consolas, Monaco, monospace; }
</style>
