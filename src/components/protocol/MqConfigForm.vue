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
      <div class="form-row">
        <span class="form-label req">Broker 地址</span>
        <el-input v-model="cfg.brokerAddress" placeholder="host:port" style="max-width: 300px" />
      </div>
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
  </el-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Delete, Check } from '@element-plus/icons-vue'
import { PROTOCOL_TYPES } from '@/stores/protocol'

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

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
const cfg = computed(() => props.protocol.config)
const brokerTypes = ['RabbitMQ', 'Kafka', 'RocketMQ', 'ActiveMQ']
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
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
</style>
