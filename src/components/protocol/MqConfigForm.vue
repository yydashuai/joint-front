<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <el-input v-model="protocol.name" class="proto-name" placeholder="协议名称" />
        <div class="proto-head__right">
          <span class="lbl">当前类型</span>
          <el-select :model-value="protocol.type" style="width: 100px" @change="(v) => $emit('switchType', v)">
            <el-option v-for="t in PROTOCOL_TYPES" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-tooltip content="保存当前协议配置"><el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button></el-tooltip>
          <el-popconfirm title="删除该协议？" @confirm="$emit('delete')">
            <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
          </el-popconfirm>
        </div>
      </div>
    </template>

    <el-scrollbar class="mq-scroll">
      <div class="field-label">备注说明</div>
      <el-input v-model="protocol.desc" placeholder="可选，描述该协议的用途" class="proto-desc" />

      <div class="meta-row">
        <span class="meta-row__label req">所属系统</span>
        <el-select v-model="protocol.systemId" placeholder="选择系统" class="meta-sel" @change="$emit('systemChange')">
          <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <span class="meta-row__label req">模块</span>
        <el-select v-model="protocol.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!protocol.systemId">
          <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
        </el-select>
      </div>

      <el-divider content-position="left">消息中间件配置</el-divider>

      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">中间件类型</span>
          <el-select v-model="cfg.brokerType" style="width: 180px">
            <el-option v-for="b in brokerTypes" :key="b" :label="b" :value="b" />
          </el-select>
        </div>
      </div>
      <div class="broker-hint">
        <el-icon><InfoFilled /></el-icon>
        Broker 连接信息（地址、端口、认证）请在
        <el-link type="primary" :underline="false" @click="$router.push('/connection')">链路连接管理</el-link>
        中配置
      </div>

      <!-- RabbitMQ 专属 -->
      <template v-if="cfg.brokerType === 'RabbitMQ'">
        <el-divider content-position="left">RabbitMQ 路由配置</el-divider>
        <div class="form-grid">
          <div class="form-row">
            <span class="form-label">Exchange</span>
            <el-input v-model="cfg.exchangeName" placeholder="交换机名称" style="max-width: 300px" />
          </div>
          <div class="form-row">
            <span class="form-label">Routing Key</span>
            <el-input v-model="cfg.routingKey" placeholder="路由键" style="max-width: 300px" />
          </div>
          <div class="form-row">
            <span class="form-label req">Queue</span>
            <el-input v-model="cfg.queueName" placeholder="队列名称" style="max-width: 300px" />
          </div>
        </div>
      </template>

      <!-- Kafka 专属 -->
      <template v-else-if="cfg.brokerType === 'Kafka'">
        <el-divider content-position="left">Kafka 配置</el-divider>
        <div class="form-grid">
          <div class="form-row">
            <span class="form-label req">Topic</span>
            <el-input v-model="cfg.topic" placeholder="主题名称" style="max-width: 300px" />
          </div>
          <div class="form-row">
            <span class="form-label">Consumer Group</span>
            <el-input v-model="cfg.consumerGroup" placeholder="消费者组" style="max-width: 300px" />
          </div>
        </div>
      </template>

      <!-- RocketMQ 专属 -->
      <template v-else-if="cfg.brokerType === 'RocketMQ'">
        <el-divider content-position="left">RocketMQ 配置</el-divider>
        <div class="form-grid">
          <div class="form-row">
            <span class="form-label req">Topic</span>
            <el-input v-model="cfg.topic" placeholder="主题名称" style="max-width: 300px" />
          </div>
          <div class="form-row">
            <span class="form-label">Consumer Group</span>
            <el-input v-model="cfg.consumerGroup" placeholder="消费者组" style="max-width: 300px" />
          </div>
          <div class="form-row">
            <span class="form-label">Tag</span>
            <el-input v-model="cfg.routingKey" placeholder="消息 Tag（可选）" style="max-width: 300px" />
          </div>
        </div>
      </template>

      <!-- ActiveMQ 专属 -->
      <template v-else-if="cfg.brokerType === 'ActiveMQ'">
        <el-divider content-position="left">ActiveMQ 配置</el-divider>
        <div class="form-grid">
          <div class="form-row">
            <span class="form-label req">Destination</span>
            <el-input v-model="cfg.topic" placeholder="队列/主题名称" style="max-width: 300px" />
          </div>
          <div class="form-row">
            <span class="form-label">类型</span>
            <el-radio-group v-model="cfg.queueName">
              <el-radio value="queue">Queue（点对点）</el-radio>
              <el-radio value="topic">Topic（发布/订阅）</el-radio>
            </el-radio-group>
          </div>
        </div>
      </template>

      <el-divider content-position="left">通用配置</el-divider>
      <div class="form-grid">
        <div class="form-row">
          <span class="form-label">QoS</span>
          <el-input-number v-model="cfg.qos" :min="0" :max="2" style="width: 120px" />
          <span class="form-hint">0=至多一次 1=至少一次 2=恰好一次</span>
        </div>
        <div class="form-row">
          <span class="form-label">ACK 模式</span>
          <el-select v-model="cfg.ackMode" style="width: 160px">
            <el-option label="自动确认" value="auto" />
            <el-option label="手动确认" value="manual" />
            <el-option label="不确认" value="none" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label">消息格式</span>
          <el-select v-model="cfg.messageFormat" style="width: 160px">
            <el-option label="JSON" value="JSON" />
            <el-option label="Protobuf" value="Protobuf" />
            <el-option label="Raw" value="Raw" />
            <el-option label="XML" value="XML" />
          </el-select>
        </div>
      </div>

      <!-- ═══ 消息体 Schema ═══ -->
      <el-divider content-position="left">消息体结构</el-divider>
      <div class="section-hint">
        定义消息体的字段结构，用于测试数据生成与校验规则绑定。
        <span v-if="cfg.messageFormat === 'Raw'" class="hint-warn">Raw 格式下消息体为纯字节流，无需定义字段。</span>
      </div>

      <template v-if="cfg.messageFormat !== 'Raw'">
        <div class="body-toolbar">
          <el-button size="small" :icon="Plus" @click="addBodyRoot">添加字段</el-button>
          <el-tag size="small" type="info">{{ bodyFieldCount }} 个字段</el-tag>
        </div>

        <el-table
          v-if="cfg.messageBody?.length"
          :data="flatBodyFields"
          row-key="flatId"
          size="small"
          :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
          default-expand-all
          class="body-table"
        >
          <el-table-column label="字段名" min-width="140">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="字段名" size="small" class="cell-input" />
            </template>
          </el-table-column>
          <el-table-column label="数据类型" width="140">
            <template #default="{ row }">
              <el-select v-model="row.dataType" size="small" class="cell-select" @change="onBodyTypeChange(row)">
                <el-option-group v-for="g in bodyTypeGroups" :key="g.label" :label="g.label">
                  <el-option v-for="t in g.items" :key="t.value" :label="t.label" :value="t.value" />
                </el-option-group>
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="必填" width="70" align="center">
            <template #default="{ row }">
              <el-checkbox v-model="row.required" />
            </template>
          </el-table-column>
          <el-table-column label="约束" width="150">
            <template #default="{ row }">
              <template v-if="row.constraint?.mode === 'range'">
                <el-input-number v-model="row.constraint.min" size="small" controls-position="right" :precision="0" class="cell-num" placeholder="min" />
                <span class="range-sep">~</span>
                <el-input-number v-model="row.constraint.max" size="small" controls-position="right" :precision="0" class="cell-num" placeholder="max" />
              </template>
              <template v-else-if="row.constraint?.mode === 'enum'">
                <el-input v-model="row._enumText" size="small" placeholder="值1:标签1, 值2:标签2" class="cell-input" @change="parseEnum(row)" />
              </template>
              <template v-else-if="row.constraint?.mode === 'length'">
                <el-input-number v-model="row.constraint.minLen" size="small" controls-position="right" :min="0" class="cell-num" />
                <span class="range-sep">~</span>
                <el-input-number v-model="row.constraint.maxLen" size="small" controls-position="right" :min="0" class="cell-num" />
              </template>
              <el-button v-else size="small" text @click="openConstraint(row)">设置</el-button>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.desc" placeholder="说明" size="small" class="cell-input" />
            </template>
          </el-table-column>
          <el-table-column label="" width="90" align="center">
            <template #default="{ row }">
              <el-button v-if="row.dataType === '共识体'" :icon="Plus" size="small" text @click="addBodyChild(row)" />
              <el-popconfirm title="删除该字段？" @confirm="removeBodyField(row)">
                <template #reference><el-button :icon="Delete" size="small" text type="danger" /></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无消息体字段，点击上方按钮添加" :image-size="40" />
      </template>

      <!-- ═══ 消息头属性 ═══ -->
      <el-divider content-position="left">消息头属性</el-divider>
      <div class="section-hint">
        定义消息的元数据头字段（如 correlation_id、priority、expiration 等）。
      </div>
      <div class="body-toolbar">
        <el-button size="small" :icon="Plus" @click="addHeader">添加消息头</el-button>
        <el-tag size="small" type="info">{{ (cfg.messageHeaders || []).length }} 个</el-tag>
      </div>

      <el-table
        v-if="cfg.messageHeaders?.length"
        :data="cfg.messageHeaders"
        row-key="id"
        size="small"
        class="header-table"
      >
        <el-table-column label="Key" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.key" placeholder="header key" size="small" class="cell-input" />
          </template>
        </el-table-column>
        <el-table-column label="数据类型" width="130">
          <template #default="{ row }">
            <el-select v-model="row.dataType" size="small" class="cell-select">
              <el-option v-for="t in headerDataTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="必填" width="70" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.required" />
          </template>
        </el-table-column>
        <el-table-column label="默认值" width="140">
          <template #default="{ row }">
            <el-input v-model="row.defaultValue" placeholder="默认值" size="small" class="cell-input" />
          </template>
        </el-table-column>
        <el-table-column label="说明" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.desc" placeholder="说明" size="small" class="cell-input" />
          </template>
        </el-table-column>
        <el-table-column label="" width="50" align="center">
          <template #default="{ row }">
            <el-popconfirm title="删除该消息头？" @confirm="removeHeader(row)">
              <template #reference><el-button :icon="Delete" size="small" text type="danger" /></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无消息头属性" :image-size="30" />

      <!-- ═══ 消息键（Kafka / RocketMQ） ═══ -->
      <template v-if="cfg.brokerType === 'Kafka' || cfg.brokerType === 'RocketMQ'">
        <el-divider content-position="left">消息键 (Message Key)</el-divider>
        <div class="section-hint">
          消息键决定 Kafka 分区路由或 RocketMQ 顺序消息分组，是重要的测试维度。
        </div>
        <div class="form-grid">
          <div class="form-row">
            <span class="form-label">键数据类型</span>
            <el-select v-model="cfg.messageKey.dataType" style="width: 160px">
              <el-option v-for="t in keyDataTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </div>
          <div class="form-row">
            <span class="form-label">生成模式</span>
            <el-input v-model="cfg.messageKey.pattern" placeholder="如 {deviceId}-{timestamp} 或留空随机" style="max-width: 360px" />
          </div>
          <div class="form-row">
            <span class="form-label">说明</span>
            <el-input v-model="cfg.messageKey.desc" placeholder="消息键用途说明" style="max-width: 360px" />
          </div>
        </div>
      </template>
    </el-scrollbar>
  </el-card>

  <!-- 约束设置弹窗 -->
  <el-dialog v-model="constraintDlg" title="字段约束" width="420px" append-to-body>
    <el-form v-if="editingField" label-width="80px">
      <el-form-item label="约束类型">
        <el-select v-model="editingField._constraintMode" @change="applyConstraintMode(editingField)">
          <el-option label="无约束" value="none" />
          <el-option label="取值范围" value="range" />
          <el-option label="枚举值" value="enum" />
          <el-option label="长度限制" value="length" />
          <el-option label="正则表达式" value="regex" />
        </el-select>
      </el-form-item>
      <template v-if="editingField._constraintMode === 'range'">
        <el-form-item label="最小值"><el-input-number v-model="editingField.constraint.min" controls-position="right" /></el-form-item>
        <el-form-item label="最大值"><el-input-number v-model="editingField.constraint.max" controls-position="right" /></el-form-item>
      </template>
      <template v-if="editingField._constraintMode === 'enum'">
        <el-form-item label="枚举值">
          <el-input v-model="editingField._enumText" type="textarea" :rows="3" placeholder="每行一个，格式：值:标签&#10;如：&#10;0:未知&#10;1:战斗机" @change="parseEnum(editingField)" />
        </el-form-item>
      </template>
      <template v-if="editingField._constraintMode === 'length'">
        <el-form-item label="最小长度"><el-input-number v-model="editingField.constraint.minLen" :min="0" controls-position="right" /></el-form-item>
        <el-form-item label="最大长度"><el-input-number v-model="editingField.constraint.maxLen" :min="0" controls-position="right" /></el-form-item>
      </template>
      <template v-if="editingField._constraintMode === 'regex'">
        <el-form-item label="正则表达式"><el-input v-model="editingField.constraint.pattern" placeholder="如 ^[A-Z]{3}-\d{4}$" /></el-form-item>
      </template>
    </el-form>
    <template #footer><el-button type="primary" @click="constraintDlg = false">完成</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Check, Plus, InfoFilled } from '@element-plus/icons-vue'
import { PROTOCOL_TYPES, MQ_BODY_DATA_TYPES, MQ_HEADER_DATA_TYPES, MQ_KEY_DATA_TYPES, makeMqBodyField, makeMqHeader, useProtocolStore } from '@/stores/protocol'

const props = defineProps({
  protocol: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
})
defineEmits(['delete', 'save', 'systemChange', 'switchType'])

// ---- 脏数据追踪 ----
const dirty = ref(false)
const snapshot = ref(JSON.stringify(props.protocol))
watch(() => props.protocol, () => {
  dirty.value = JSON.stringify(props.protocol) !== snapshot.value
}, { deep: true })
watch(() => props.protocol.id, () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
}, { immediate: true })
const markClean = () => { snapshot.value = JSON.stringify(props.protocol); dirty.value = false }
defineExpose({ markClean })

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'auto' }
const cfg = computed(() => {
  const c = props.protocol.config
  if (!c.messageBody) c.messageBody = []
  if (!c.messageHeaders) c.messageHeaders = []
  if (!c.messageKey) c.messageKey = { dataType: 'utf8', pattern: '', desc: '' }
  return c
})
const brokerTypes = ['RabbitMQ', 'Kafka', 'RocketMQ', 'ActiveMQ']

const store = useProtocolStore()

// ─── 消息体字段分组 ───
const bodyTypeGroups = computed(() => {
  const groups = {}
  MQ_BODY_DATA_TYPES.forEach(t => {
    if (!groups[t.group]) groups[t.group] = { label: t.group, items: [] }
    groups[t.group].items.push(t)
  })
  return Object.values(groups)
})

const headerDataTypes = MQ_HEADER_DATA_TYPES
const keyDataTypes = MQ_KEY_DATA_TYPES

// ─── 展平消息体字段（含嵌套标记） ───
const flatBodyFields = computed(() => {
  const walk = (fields, depth = 0) => {
    return fields.map(f => ({
      ...f,
      flatId: `bf-${f.id}`,
      hasChildren: f.dataType === '共识体' && (!f.children || !f.children.length),
      children: f.children?.length ? walk(f.children, depth + 1) : undefined,
    }))
  }
  return walk(cfg.value.messageBody || [])
})

const bodyFieldCount = computed(() => {
  const count = (fields) => fields.reduce((n, f) => n + 1 + (f.children?.length ? count(f.children) : 0), 0)
  return count(cfg.value.messageBody || [])
})

// ─── 消息体字段操作 ───
const addBodyRoot = () => {
  store.addMqBodyField(props.protocol)
}

const addBodyChild = (row) => {
  store.addMqBodyField(props.protocol, row.id)
}

const removeBodyField = (row) => {
  store.removeMqBodyField(props.protocol, row.id)
}

const onBodyTypeChange = (row) => {
  if (row.dataType !== '共识体') {
    row.children = []
  }
}

// ─── 消息头操作 ───
const addHeader = () => {
  store.addMqHeader(props.protocol)
}

const removeHeader = (row) => {
  store.removeMqHeader(props.protocol, row.id)
}

// ─── 约束弹窗 ───
const constraintDlg = ref(false)
const editingField = ref(null)

const openConstraint = (row) => {
  editingField.value = row
  row._constraintMode = row.constraint?.mode || 'none'
  if (row.constraint?.mode === 'enum') {
    row._enumText = (row.constraint.entries || []).map(e => `${e.value}:${e.label}`).join('\n')
  }
  constraintDlg.value = true
}

const applyConstraintMode = (row) => {
  const mode = row._constraintMode
  if (mode === 'none') row.constraint = { mode: 'none' }
  else if (mode === 'range') row.constraint = { mode: 'range', min: 0, max: 100, value: 0 }
  else if (mode === 'enum') { row.constraint = { mode: 'enum', entries: [] }; row._enumText = '' }
  else if (mode === 'length') row.constraint = { mode: 'length', minLen: 0, maxLen: 256 }
  else if (mode === 'regex') row.constraint = { mode: 'regex', pattern: '' }
}

const parseEnum = (row) => {
  const text = row._enumText || ''
  row.constraint.entries = text.split('\n').filter(Boolean).map(line => {
    const [v, l] = line.split(':')
    return { value: v?.trim() || '', label: l?.trim() || v?.trim() || '' }
  })
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mq-scroll { flex: 1; min-height: 0; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; .lbl { font-size: 13px; color: var(--el-text-color-secondary); } }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }

.form-grid { display: flex; flex-direction: column; gap: 12px; margin-bottom: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-label { font-size: 13px; color: var(--el-text-color-regular); min-width: 100px; flex-shrink: 0; }
.form-label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.form-hint { font-size: 12px; color: var(--el-text-color-placeholder); }

.section-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 10px; line-height: 1.6; }
.hint-warn { color: var(--el-color-warning); }

.broker-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.body-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.body-table, .header-table { margin-bottom: 12px; }
.cell-input { width: 100%; }
.cell-select { width: 100%; }
.cell-num { width: 80px; }
.range-sep { color: var(--el-text-color-secondary); margin: 0 2px; }
</style>
