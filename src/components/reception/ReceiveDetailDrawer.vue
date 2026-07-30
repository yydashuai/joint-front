<template>
  <el-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="620px"
    destroy-on-close
    @update:model-value="(v) => $emit('update:modelValue', v)"
  >
    <template v-if="entry">
      <!-- ===== 元信息 ===== -->
      <div class="meta">
        <el-tag size="small" effect="plain" class="mono">#{{ entry.seq }}</el-tag>
        <el-tag size="small" type="info" effect="plain">{{ entry.time }}</el-tag>
        <el-tag size="small" effect="plain">{{ entry.iface }}</el-tag>
        <el-tag size="small" effect="plain">{{ entry.transport }}</el-tag>
        <el-tag size="small" type="info" effect="plain">{{ entry.byteLength }} 字节</el-tag>
        <el-tag size="small" :type="verdictTagType" effect="dark">{{ entry.verdict.tag }}</el-tag>
        <el-tag v-if="entry.savedToDataset" size="small" type="success" effect="plain">已保存数据集</el-tag>
      </div>

      <!-- ===== 异常原因 ===== -->
      <div v-if="entry.verdict.issues.length" class="issues">
        <div class="issues__title">异常原因（{{ entry.verdict.issues.length }} 项）</div>
        <div v-for="(issue, i) in entry.verdict.issues" :key="i" class="issues__item">
          <el-tag size="small" type="danger" effect="plain">{{ issue.layer }}</el-tag>
          <span v-if="issue.field" class="issues__field mono">{{ issue.field }}</span>
          <span>{{ issue.message }}</span>
        </div>
      </div>

      <!-- ===== 转发记录 ===== -->
      <el-alert
        v-if="entry.kind === 'forward'"
        type="success"
        :closable="false"
        class="fw-alert"
        title="这是一条转发报文"
        :description="`目标：${entry.forwardTarget || '未指定'}；完整性字段（长度/校验和）已按修改后的报文头自动重算。`"
      />

      <!-- ===== 原始报文 hex ===== -->
      <div class="section-title">原始报文（hex）</div>
      <div class="hexdump mono">
        <span
          v-for="(byte, i) in hexBytes"
          :key="i"
          class="hexdump__byte"
          :class="{ 'hexdump__byte--bad': badByteSet.has(i), 'hexdump__byte--header': i < headerSize }"
        >{{ byte }}</span>
      </div>
      <div class="hex-legend">
        <span><i class="lg lg--header" />报文头</span>
        <span><i class="lg lg--body" />报文体</span>
        <span v-if="badByteSet.size"><i class="lg lg--bad" />异常字节</span>
      </div>

      <!-- ===== 已解析：字段对照表 ===== -->
      <template v-if="entry.verdict.status !== 'unparsed' && entry.fields.length">
        <div class="section-title">字段对照（实际值 vs 字段定义）</div>
        <el-table :data="fieldRows" size="small" border max-height="320">
          <el-table-column prop="name" label="字段" min-width="110">
            <template #default="{ row }">
              <span class="mono" :class="{ 'text-danger': row.bad }">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="hint" label="定义约束" min-width="130" show-overflow-tooltip />
          <el-table-column prop="value" label="实际值" min-width="90">
            <template #default="{ row }">
              <span class="mono" :class="{ 'text-danger': row.bad }">{{ row.value }}</span>
            </template>
          </el-table-column>
          <el-table-column label="判定" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.bad" size="small" type="danger" effect="plain">{{ row.badTag }}</el-tag>
              <el-tag v-else size="small" type="success" effect="plain">正常</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- ===== 无法解析：三协议自动解析结果 + 转发 ===== -->
      <template v-if="entry.verdict.status === 'unparsed'">
        <div class="section-title">自动头解析（依次尝试 OSE → 4908A → MDS）</div>
        <div class="attempts">
          <div v-for="a in entry.parseAttempts" :key="a.transport" class="attempts__item">
            <el-tag size="small" :type="a.ok ? 'success' : 'info'" :effect="a.ok ? 'dark' : 'plain'">{{ a.transport }}</el-tag>
            <span v-if="a.ok" class="attempts__ok">头解析成功（{{ a.size }} 字节头）</span>
            <span v-else class="attempts__fail">{{ a.reason }}</span>
          </div>
        </div>

        <!-- 全部失败：交用户处置 -->
        <el-alert
          v-if="!entry.headerParse"
          type="error"
          :closable="false"
          class="fw-alert"
          title="三个协议头解析均失败，已标记为解析失败"
          description="该报文不允许直接发送。可将原始 hex 保存为数据样本留档，供后续离线分析。"
        />

        <!-- 解析出头：可改寻址字段后合并转发 -->
        <template v-else>
          <div class="section-title">
            修改报文头并转发
            <span class="section-sub">按 {{ entry.headerParse.transport }} 头解析；仅寻址类字段可修改，完整性字段自动重算，原报文体原样合并</span>
          </div>
          <el-table :data="headerRows" size="small" border>
            <el-table-column prop="name" label="头字段" width="110">
              <template #default="{ row }"><span class="mono">{{ row.name }}</span></template>
            </el-table-column>
            <el-table-column label="原值" width="130">
              <template #default="{ row }"><span class="mono muted">{{ row.value }}</span></template>
            </el-table-column>
            <el-table-column label="修改为" min-width="150">
              <template #default="{ row }">
                <el-input
                  v-if="row.addressable"
                  v-model="editHeader[row.key]"
                  size="small"
                  class="mono"
                />
                <el-tag v-else-if="row.auto" size="small" type="warning" effect="plain">转发时自动重算</el-tag>
                <span v-else class="muted">不可修改</span>
              </template>
            </el-table-column>
          </el-table>

          <div class="fw-target">
            <span class="fw-target__label">转发目标链路</span>
            <el-select v-model="forwardNodeId" placeholder="选择目标模块节点" size="small" style="flex: 1;">
              <el-option
                v-for="n in connStore.nodes"
                :key="n.id"
                :label="`${n.name}（${n.ip}:${n.port}）`"
                :value="n.id"
              />
            </el-select>
            <el-button type="primary" size="small" :icon="Promotion" @click="doForward">合并转发</el-button>
          </div>
        </template>
      </template>

      <!-- ===== 底部操作 ===== -->
      <div class="drawer-actions">
        <el-button
          v-if="entry.kind === 'recv'"
          type="success"
          plain
          :icon="FolderAdd"
          :disabled="entry.savedToDataset"
          @click="$emit('save-entry', entry.id)"
        >
          {{ entry.savedToDataset ? '已保存为数据' : '保存为数据' }}
        </el-button>
        <el-button type="primary" plain :icon="Edit" @click="pedVisible = true">编辑报文</el-button>
        <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
      </div>

      <!-- ===== 报文编辑（改字段 / 保存 / 转发 / 发送） ===== -->
      <PacketEditor v-model="pedVisible" mode="edit" :entry-id="entry.id" @done="onPedDone" />
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderAdd, Promotion, Edit } from '@element-plus/icons-vue'
import { useReceptionStore } from '@/stores/reception'
import { useConnectionStore } from '@/stores/connection'
import { HEADER_DEFS } from '@/utils/receiveValidator'
import PacketEditor from '@/components/reception/PacketEditor.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  entryId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'save-entry'])

const store = useReceptionStore()
const connStore = useConnectionStore()

const pedVisible = ref(false)
const onPedDone = () => {
  pedVisible.value = false
  emit('update:modelValue', false)
}

const entry = computed(() => store.recvQueue.find((e) => e.id === props.entryId) || null)

const drawerTitle = computed(() => {
  if (!entry.value) return '报文详情'
  return entry.value.kind === 'forward' ? `转发报文 #${entry.value.seq}` : `接收报文 #${entry.value.seq} · ${entry.value.iface}`
})

const verdictTagType = computed(() => {
  const s = entry.value?.verdict.status
  if (s === 'ok') return 'success'
  if (s === 'unparsed') return 'warning'
  if (s === 'forwarded') return 'primary'
  return 'danger'
})

/* ===== hex dump 与异常字节高亮 ===== */
const hexBytes = computed(() => (entry.value?.hex || '').split(' ').filter(Boolean))
const headerSize = computed(() => {
  if (!entry.value) return 0
  if (entry.value.verdict.status === 'unparsed') return entry.value.headerParse?.size || 0
  return HEADER_DEFS[entry.value.transport]?.size || 0
})
// 语义不一致等 L1 异常：按 issue.field 匹配头字段定义，高亮对应字节区间
const badByteSet = computed(() => {
  const set = new Set()
  if (!entry.value) return set
  const def = HEADER_DEFS[entry.value.transport]
  if (!def) return set
  entry.value.verdict.issues
    .filter((i) => i.layer === 'L1' && i.field)
    .forEach((i) => {
      const f = def.fields.find((x) => x.key === i.field)
      if (f) for (let k = f.offset; k < f.offset + f.len; k += 1) set.add(k)
    })
  return set
})

/* ===== 字段对照表 ===== */
const constraintHint = (f) => {
  const c = f.constraint
  if (c?.mode === 'fixed') return `固定值 ${c.value}`
  if (c?.mode === 'enum') return `枚举 ${(c.entries || []).map((e) => e?.label ?? e?.value ?? e).join('/')}`
  if (c?.mode === 'range') return `范围 ${c.min} ~ ${c.max}`
  return f.type || '无约束'
}
const fieldRows = computed(() => {
  if (!entry.value) return []
  const issues = entry.value.verdict.issues.filter((i) => i.layer === 'L2')
  return entry.value.fields.map((f) => {
    const hit = issues.find((i) => i.field === f.name)
    return {
      name: f.name,
      hint: constraintHint(f),
      value: entry.value.values[f.name] ?? '—',
      bad: !!hit,
      badTag: hit?.tag || '',
    }
  })
})

/* ===== 无法解析：头字段编辑与转发 ===== */
const editHeader = ref({})
const forwardNodeId = ref(null)

watch(() => [props.entryId, props.modelValue], () => {
  const hp = entry.value?.headerParse
  editHeader.value = {}
  if (hp) {
    hp.fields.forEach((f) => { if (f.addressable) editHeader.value[f.key] = String(f.value) })
  }
  forwardNodeId.value = null
}, { immediate: true })

const headerRows = computed(() => entry.value?.headerParse?.fields || [])

const doForward = () => {
  if (!entry.value?.headerParse) return
  if (!forwardNodeId.value) {
    ElMessage.warning('请先选择转发目标链路')
    return
  }
  const fwd = store.forward(entry.value.id, {
    transport: entry.value.headerParse.transport,
    headerValues: { ...editHeader.value },
    targetNodeId: forwardNodeId.value,
    recalc: true,
  })
  if (fwd) {
    ElMessage.success(`已合并转发到 ${fwd.forwardTarget}（长度/校验和已重算）`)
    emit('update:modelValue', false)
  } else {
    ElMessage.error('转发失败：无法按所选协议重建报文头')
  }
}
</script>

<style scoped lang="scss">
.meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.mono { font-family: Consolas, Monaco, monospace; }
.muted { color: var(--el-text-color-secondary); }
.text-danger { color: var(--el-color-danger); }

.issues {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-7);
  &__title { font-size: 12px; font-weight: 600; color: var(--el-color-danger); margin-bottom: 6px; }
  &__item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--el-color-danger); padding: 2px 0; }
  &__field { font-weight: 600; }
}

.section-title {
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 650;
}
.section-sub { margin-left: 8px; font-size: 12px; font-weight: 400; color: var(--el-text-color-secondary); }

.hexdump {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px;
  border-radius: 6px;
  background: #101923;
  font-size: 12px;
  max-height: 130px;
  overflow: auto;
}
.hexdump__byte { color: #8fa3b7; }
.hexdump__byte--header { color: #7ec8ff; }
.hexdump__byte--bad {
  color: #fff;
  background: rgba(245, 108, 108, .75);
  border-radius: 3px;
  padding: 0 2px;
}
.hex-legend {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  .lg { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
  .lg--header { background: #7ec8ff; }
  .lg--body { background: #8fa3b7; }
  .lg--bad { background: var(--el-color-danger); }
}

.attempts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  &__item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
  &__ok { color: var(--el-color-success); }
  &__fail { color: var(--el-text-color-secondary); }
}

.fw-alert { margin: 12px 0; }
.fw-target {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  &__label { flex-shrink: 0; font-size: 12px; color: var(--el-text-color-regular); }
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
