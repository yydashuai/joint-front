<template>
  <el-dialog
    :model-value="modelValue"
    :title="mode === 'edit' ? '编辑报文（修改字段 / 保存 / 转发 / 发送）' : '报文构造（粘贴解析 / 改头 / 发送测试）'"
    width="760px"
    top="5vh"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <div class="ped">
      <!-- ===== 基础配置 ===== -->
      <div class="ped-block">
        <div class="ped-block__title">基础配置</div>
        <div class="ped-cfg">
          <div class="ped-cfg__item">
            <span class="ped-cfg__label">传输类型</span>
            <el-select v-model="transport" size="small" style="width: 160px;">
              <el-option v-for="t in HEADER_TRANSPORTS" :key="t" :label="t" :value="t" />
            </el-select>
          </div>
          <div class="ped-cfg__item">
            <span class="ped-cfg__label">绑定接口（可选）</span>
            <el-select
              v-model="boundInterfaceId"
              size="small"
              clearable
              filterable
              placeholder="选择接口以编辑报文体字段"
              style="width: 260px;"
            >
              <el-option v-for="i in protocolStore.interfaces" :key="i.id" :label="`${i.name}`" :value="i.id" />
            </el-select>
          </div>
          <el-checkbox v-model="recalc" size="small" class="ped-cfg__rec">自动重算完整性字段（长度/校验和）</el-checkbox>
        </div>
        <el-alert
          v-if="isMDS"
          type="warning"
          :closable="false"
          class="ped-alert"
          title="MDS 传输配置待确认"
          description="暂不支持头解析，仅能以原始字节保存/发送；报文头字段需手写 hex 填入报文体。"
        />
      </div>

      <!-- ===== 粘贴整帧解析 ===== -->
      <div class="ped-block">
        <div class="ped-block__title">
          粘贴报文（整帧 hex，可含报文头）
          <span class="ped-block__sub">自动轮询 OSE → 4908A 识别协议头并拆分头/体</span>
        </div>
        <el-input
          v-model="rawHex"
          type="textarea"
          :rows="2"
          class="mono"
          placeholder="例如：C350 23 28 00 0E 00 00 00 C0 A8 01 0A 01 00 3C 5A ...（空格或连续均可）"
        />
        <div class="ped-row">
          <el-button size="small" :icon="MagicStick" @click="parseFrame">解析报文头与报文体</el-button>
          <span v-if="parseMsg" class="ped-parse-msg" :class="parseErr ? 'is-err' : 'is-ok'">{{ parseMsg }}</span>
        </div>
      </div>

      <!-- ===== 报文头（可编辑） ===== -->
      <div class="ped-block">
        <div class="ped-block__title">
          报文头字段
          <span class="ped-block__sub">{{ headerDef?.label || '—' }}，仅寻址类字段（蓝）可改，完整性字段（黄）发送时自动重算</span>
        </div>
        <el-table :data="headerFieldList" size="small" border max-height="220">
          <el-table-column prop="name" label="头字段" width="120">
            <template #default="{ row }"><span class="mono">{{ row.name }}</span></template>
          </el-table-column>
          <el-table-column prop="codec" label="类型" width="70" align="center" />
          <el-table-column label="值" min-width="150">
            <template #default="{ row }">
              <el-input
                v-if="!row.auto"
                v-model="headerEdit[row.key]"
                size="small"
                class="mono"
                :class="{ 'is-addr': row.addressable }"
                :placeholder="row.addressable ? '可修改（寻址字段）' : '值'"
              />
              <el-tag v-else size="small" type="warning" effect="plain">自动重算</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="角色" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.addressable" size="small" type="primary" effect="plain">寻址</el-tag>
              <el-tag v-else-if="row.auto" size="small" type="warning" effect="plain">完整性</el-tag>
              <span v-else class="muted">固定</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- ===== 报文体 ===== -->
      <div class="ped-block">
        <div class="ped-block__title">
          报文体
          <span class="ped-block__sub">{{ boundFields.length ? `按接口「${boundInterface?.name}」字段编辑` : '以原始 hex 编辑（未绑定接口）' }}</span>
        </div>

        <el-table v-if="boundFields.length" :data="bodyFieldRows" size="small" border max-height="240">
          <el-table-column prop="name" label="字段" min-width="120">
            <template #default="{ row }"><span class="mono">{{ row.name }}</span></template>
          </el-table-column>
          <el-table-column prop="hint" label="定义约束" min-width="140" show-overflow-tooltip />
          <el-table-column label="值" min-width="130">
            <template #default="{ row }">
              <el-input v-model="bodyValues[row.name]" size="small" class="mono" />
            </template>
          </el-table-column>
        </el-table>

        <template v-else>
          <el-input
            v-model="bodyHex"
            type="textarea"
            :rows="2"
            class="mono"
            placeholder="报文体 hex（未绑定接口时直接编辑原始字节）"
          />
          <div class="ped-bytecount">报文体 {{ bodyByteLen }} 字节</div>
        </template>
      </div>

      <!-- ===== 实时结果预览 ===== -->
      <div class="ped-block">
        <div class="ped-block__title">
          构造结果（实时）
          <span class="ped-block__sub">以下帧将用于保存 / 转发 / 发送</span>
        </div>
        <div class="ped-result mono">{{ currentHex || '—' }}</div>
        <div class="ped-row">
          <el-tag v-if="previewVerdict" :type="previewVerdict.status === 'ok' ? 'success' : 'danger'" effect="plain" size="small">
            校验预览：{{ previewVerdict.tag }}
          </el-tag>
          <el-button size="small" text type="primary" :icon="DocumentCopy" :disabled="!currentHex" @click="copyHex">复制结果 hex</el-button>
        </div>
      </div>
    </div>

    <!-- ===== 操作 ===== -->
    <template #footer>
      <div class="ped-footer">
        <div class="ped-footer__left">
          <el-select
            v-if="mode === 'edit'"
            v-model="forwardNodeId"
            placeholder="转发目标链路"
            size="small"
            clearable
            style="width: 200px;"
          >
            <el-option v-for="n in connStore.nodes" :key="n.id" :label="`${n.name}（${n.ip}:${n.port}）`" :value="n.id" />
          </el-select>
        </div>
        <div class="ped-footer__right">
          <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
          <el-button :icon="FolderAdd" @click="openSave">保存为数据</el-button>
          <el-button v-if="mode === 'edit'" type="warning" :icon="Promotion" :disabled="!forwardNodeId" @click="doForward">转发</el-button>
          <el-button type="primary" :icon="Top" @click="doSend">直接发送</el-button>
        </div>
      </div>
    </template>

    <!-- ===== 保存对话框 ===== -->
    <el-dialog v-model="saveVisible" title="保存报文为数据集" width="480px" append-to-body destroy-on-close>
      <el-form label-width="84px">
        <el-form-item label="保存方式">
          <el-radio-group v-model="saveMode">
            <el-radio value="exist">写入已有数据集</el-radio>
            <el-radio value="new">新建数据集</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="saveMode === 'exist'" label="目标数据集">
          <el-select v-model="saveDatasetId" placeholder="选择数据集" style="width: 100%;">
            <el-option v-for="ds in tdStore.datasets" :key="ds.id" :label="ds.name" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-else label="数据集名称">
          <el-input v-model="saveNewName" placeholder="如：手工构造 接收样本 0730" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSave">保存</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderAdd, Promotion, Top, DocumentCopy, MagicStick } from '@element-plus/icons-vue'
import { useReceptionStore } from '@/stores/reception'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore, collectInterfaceFields } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { useRuleStore } from '@/stores/rule'
import {
  bytesFromHex, hexFromBytes, HEADER_DEFS, HEADER_TRANSPORTS,
  tryParseHeaders, parseHeaderAs, buildFrame, rebuildFrame, validateMessage,
} from '@/utils/receiveValidator'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  mode: { type: String, default: 'construct' }, // 'construct' | 'edit'
  entryId: { type: String, default: '' },         // edit 模式：原接收报文 id
})
const emit = defineEmits(['update:modelValue', 'saved', 'done'])

const store = useReceptionStore()
const tdStore = useTestDataStore()
const protocolStore = useProtocolStore()
const connStore = useConnectionStore()
const ruleStore = useRuleStore()

/* ===== 状态 ===== */
const transport = ref('OSE')
const rawHex = ref('')
const parseMsg = ref('')
const parseErr = ref(false)
const recalc = ref(true)
const boundInterfaceId = ref(null)
const headerEdit = ref({})
const bodyHex = ref('')
const bodyValues = ref({})
const forwardNodeId = ref(null)

const isMDS = computed(() => transport.value === 'MDS')
const headerDef = computed(() => HEADER_DEFS[transport.value])
const headerFieldList = computed(() => headerDef.value?.fields || [])

const boundInterface = computed(() =>
  protocolStore.interfaces.find((i) => String(i.id) === String(boundInterfaceId.value)) || null
)
const boundFields = computed(() =>
  boundInterface.value ? collectInterfaceFields(boundInterface.value, protocolStore.protocols, 'receive') : []
)
const bodyFieldRows = computed(() => boundFields.value.map((f) => ({
  name: f.name,
  hint: constraintHint(f),
})))
const bodyByteLen = computed(() => bytesFromHex(bodyHex.value).length)

/* ===== 当前构造帧 ===== */
const buildCurrentBytes = () => {
  if (props.mode === 'edit' && props.entryId) {
    const e = store.recvQueue.find((x) => x.id === props.entryId)
    if (e) return rebuildFrame(transport.value, bytesFromHex(e.hex), headerEdit.value, recalc.value)
  }
  return buildFrame(transport.value, bytesFromHex(bodyHex.value), headerEdit.value, recalc.value)
}
const currentHex = computed(() => {
  const b = buildCurrentBytes()
  return b ? hexFromBytes(b) : ''
})
const previewVerdict = computed(() => {
  const b = buildCurrentBytes()
  if (!b) return null
  return validateMessage({
    transport: transport.value,
    bytes: b,
    fields: boundFields.value,
    values: bodyValues.value,
    rules: rulesOf(boundInterfaceId.value),
    unparsed: false,
  })
})

const rulesOf = (interfaceId) => ruleStore.ruleSets.flatMap((rs) => (rs.rules || []).filter(
  (r) => r.enabled !== false && String(r.target?.interfaceId ?? '') === String(interfaceId)
))

const constraintHint = (f) => {
  const c = f.constraint
  if (c?.mode === 'fixed') return `固定值 ${c.value}`
  if (c?.mode === 'enum') return `枚举 ${(c.entries || []).map((e) => e?.label ?? e?.value ?? e).join('/')}`
  if (c?.mode === 'range') return `范围 ${c.min} ~ ${c.max}`
  return f.type || '无约束'
}

/* ===== 解析粘贴帧 ===== */
const parseFrame = () => {
  const bytes = bytesFromHex(rawHex.value)
  if (!bytes.length) { parseErr.value = true; parseMsg.value = '请输入报文 hex'; return }
  const ok = tryParseHeaders(bytes).find((a) => a.ok)
  if (!ok) {
    parseErr.value = true
    parseMsg.value = '无法自动识别协议头（OSE/4908A 均不匹配），已按原始字节载入；可手动选择传输类型并配置报文头。'
    headerEdit.value = {}
    bodyHex.value = hexFromBytes(bytes)
    return
  }
  transport.value = ok.transport
  const next = {}
  ok.fields.forEach((f) => { if (!f.auto) next[f.key] = String(f.value) })
  headerEdit.value = next
  bodyHex.value = hexFromBytes(bytes.slice(ok.size))
  parseErr.value = false
  parseMsg.value = `已按 ${ok.transport} 解析：头 ${ok.size} 字节，报文体 ${bytes.length - ok.size} 字节。`
}

/* ===== 从接收报文预填（edit 模式） ===== */
const seedFromEntry = () => {
  const e = props.entryId ? store.recvQueue.find((x) => x.id === props.entryId) : null
  transport.value = e?.transport || 'OSE'
  rawHex.value = e?.hex || ''
  forwardNodeId.value = null
  parseMsg.value = ''
  const bytes = e ? bytesFromHex(e.hex) : []
  const hp = (e && e.verdict.status === 'unparsed' && e.headerParse) ? e.headerParse : parseHeaderAs(transport.value, bytes)
  const next = {}
  if (hp && hp.ok) {
    transport.value = hp.transport
    hp.fields.forEach((f) => { if (!f.auto) next[f.key] = String(f.value) })
  }
  headerEdit.value = next
  const size = HEADER_DEFS[transport.value]?.size || 0
  bodyHex.value = hexFromBytes(bytes.slice(size))
  boundInterfaceId.value = e?.interfaceId || null
  bodyValues.value = e?.values ? { ...e.values } : {}
}

watch(() => [props.modelValue, props.entryId], () => {
  if (props.modelValue) {
    if (props.mode === 'edit') seedFromEntry()
    else { headerEdit.value = {}; bodyHex.value = ''; bodyValues.value = {}; rawHex.value = ''; parseMsg.value = ''; boundInterfaceId.value = null; transport.value = 'OSE' }
  }
}, { immediate: true })

/* ===== 复制结果 ===== */
const copyHex = () => {
  if (!currentHex.value) return
  navigator.clipboard?.writeText(currentHex.value).then(
    () => ElMessage.success('已复制结果 hex'),
    () => ElMessage.warning('复制失败，请手动选择复制')
  )
}

/* ===== 保存为数据 ===== */
const saveVisible = ref(false)
const saveMode = ref('exist')
const saveDatasetId = ref(null)
const saveNewName = ref('')
const openSave = () => {
  saveMode.value = tdStore.datasets.length ? 'exist' : 'new'
  saveDatasetId.value = tdStore.datasets[0]?.id || null
  saveNewName.value = `${transport.value} 手工报文`
  saveVisible.value = true
}
const confirmSave = () => {
  const values = boundFields.value.length ? { ...bodyValues.value } : { 原始报文: currentHex.value }
  const source = props.mode === 'edit' ? '接收报文' : '手动创建'
  const remark = props.mode === 'edit' ? '由接收报文编辑后保存（报文编辑工具）' : '手工报文构造（报文编辑工具）'
  const now = new Date().toLocaleString('zh-CN', { hour12: false })
  let ds
  if (saveMode.value === 'exist') {
    ds = tdStore.datasets.find((d) => d.id === saveDatasetId.value)
    if (!ds) { ElMessage.warning('请选择目标数据集'); return }
  } else {
    if (!saveNewName.value.trim()) { ElMessage.warning('请输入数据集名称'); return }
    const iface = boundInterface.value
    const module = iface ? connStore.nodes.find((n) => n.id === iface.moduleId) : null
    ds = tdStore.addDataset({
      name: saveNewName.value.trim(),
      systemId: iface?.systemId ?? null,
      moduleName: module?.name || '',
      linkedInterface: iface?.name || null,
      desc: `报文编辑工具保存（${now}）`,
    })
  }
  const saved = tdStore.addHistoryRows(ds.id, [{
    label: `手工报文 ${transport.value}`,
    values,
    source,
    remark,
    abnormal: previewVerdict.value?.status !== 'ok', // 异常依据字段定义自动判定
    excellent: false,
  }])
  if (saved?.length) {
    ElMessage.success(`已保存 ${saved.length} 条到「${ds.name}」（来源：${source}）`)
    saveVisible.value = false
    emit('saved')
  } else {
    ElMessage.error('保存失败：目标数据集不存在')
  }
}

/* ===== 转发（仅 edit 模式） ===== */
const doForward = () => {
  if (!props.entryId) return
  if (!forwardNodeId.value) { ElMessage.warning('请先选择转发目标链路'); return }
  const fwd = store.forward(props.entryId, {
    transport: transport.value,
    headerValues: { ...headerEdit.value },
    targetNodeId: forwardNodeId.value,
    recalc: recalc.value,
  })
  if (fwd) {
    ElMessage.success(`已合并转发到 ${fwd.forwardTarget}（长度/校验和已重算）`)
    emit('done', fwd.id)
    emit('update:modelValue', false)
  } else {
    ElMessage.error('转发失败：无法按所选协议重建报文头')
  }
}

/* ===== 直接发送（异常由校验引擎自动判定，无需单独按钮） ===== */
const doSend = () => {
  const bytes = buildCurrentBytes()
  if (!bytes) { ElMessage.error('无法构造报文：请检查传输类型与报文体'); return }
  const iface = boundInterface.value
  const module = iface ? connStore.nodes.find((n) => n.id === iface.moduleId) : null
  const entry = store.injectReceived({
    transport: transport.value,
    bytes,
    fields: boundFields.value,
    values: { ...bodyValues.value },
    interfaceId: iface?.id || null,
    iface: iface?.name || `${transport.value} 手工报文`,
    moduleId: module?.id || '',
    systemId: iface?.systemId || '',
    sentTest: true,
  })
  if (!entry) { ElMessage.error('发送失败'); return }
  ElMessage.success(
    `已发送：校验结果「${entry.verdict.tag}」，可在「接口收发监测 → 接收监控」数据流查看` +
    (entry.verdict.status !== 'ok' ? '（该报文被判定为异常，已标红并同步异常台账）' : '')
  )
  emit('done', entry.id)
}
</script>

<style scoped lang="scss">
.ped { display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow: auto; }
.mono { font-family: Consolas, Monaco, monospace; }
.muted { color: var(--el-text-color-secondary); }
.ped-block { &__title { font-size: 13px; font-weight: 650; margin-bottom: 8px; } }
.ped-block__sub { margin-left: 8px; font-size: 12px; font-weight: 400; color: var(--el-text-color-secondary); }
.ped-cfg { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.ped-cfg__item { display: flex; align-items: center; gap: 8px; }
.ped-cfg__label { font-size: 12px; color: var(--el-text-color-regular); }
.ped-cfg__rec { margin-left: auto; }
.ped-alert { margin-top: 8px; }
.ped-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.ped-parse-msg { font-size: 12px; }
.ped-parse-msg.is-ok { color: var(--el-color-success); }
.ped-parse-msg.is-err { color: var(--el-color-warning); }
.ped-bytecount { margin-top: 6px; font-size: 12px; color: var(--el-text-color-secondary); }
.ped-result {
  padding: 10px;
  border-radius: 6px;
  background: #101923;
  color: #d7e1ea;
  font-size: 12px;
  word-break: break-all;
  max-height: 90px;
  overflow: auto;
}
:deep(.is-addr .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-primary) inset; }
.ped-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ped-footer__right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
