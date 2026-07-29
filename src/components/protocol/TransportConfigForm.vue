<template>
  <div class="transport-config" v-if="transportType">
    <el-divider content-position="left">{{ typeLabel }} 传输配置</el-divider>

    <!-- OSE：基于 UDP 的报文传输（消息头 + 消息体） -->
    <template v-if="transportType === 'OSE'">
      <div class="section-hint">
        底层传输：<el-tag size="small" type="info">UDP</el-tag>　OSE 报文由「消息头 + 消息体」组成。消息头含嵌套结构体与常量，其中
        <b>OSE 总长</b> 等由 OSE 自动生成，<b>目标地址 / 消息类型</b> 等由用户填写；消息体由下方发送 / 接收字段以 uint16 等基础类型组合定义。
      </div>

      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">源端口</span>
          <el-input-number v-model="cfg.srcPort" :min="0" :max="65535" style="width: 150px" />
          <span class="form-hint">{{ hexOf(cfg.srcPort) }}</span>
        </div>
        <div class="form-row">
          <span class="form-label req">目的端口</span>
          <el-input-number v-model="cfg.dstPort" :min="0" :max="65535" style="width: 150px" />
          <span class="form-hint">{{ hexOf(cfg.dstPort) }}</span>
        </div>
        <div class="form-row">
          <span class="form-label">OSE 总长</span>
          <el-input-number v-model="cfg.totalLength" :min="0" :max="65535" style="width: 150px" disabled />
          <span class="form-hint">自动生成（OSE 计算），当前 {{ cfg.totalLength }} = {{ hexOf(cfg.totalLength) }}</span>
        </div>
        <div class="form-row">
          <span class="form-label">校验和</span>
          <el-input v-model="cfg.checksum" style="width: 160px" placeholder="0x2A71" />
        </div>
        <div class="form-row">
          <span class="form-label req">目标地址</span>
          <el-input v-model="cfg.targetAddress" placeholder="用户填写，如 192.168.x.x" style="max-width: 320px" />
        </div>
        <div class="form-row">
          <span class="form-label req">消息类型</span>
          <el-input v-model="cfg.messageType" placeholder="用户填写，如 CMD / STATUS" style="max-width: 320px" />
        </div>
        <div class="form-row form-row--block">
          <span class="form-label">消息体说明</span>
          <el-input v-model="cfg.bodyDesc" type="textarea" :rows="3"
            placeholder="描述 OSE 消息体的嵌套结构体与常量（以 uint16 等基础类型组合）" style="max-width: 520px" />
        </div>
      </div>
    </template>

    <!-- 4908A：基于 TCP/IP（UDP + TCP） -->
    <template v-if="transportType === '4908A'">
      <div class="section-hint">
        底层传输：<el-tag size="small" type="info">TCP/IP</el-tag>　同时支持 UDP 与 TCP。UDP 承载实时数据传输 / 实时数据控制传输，TCP 承载可靠数据控制传输。
        报文首部字段按位 / 按字节定义后组装，形如 TCP 首部。
      </div>

      <div class="form-grid">
        <div class="form-row">
          <span class="form-label req">通道模式</span>
          <el-select v-model="cfg.channelMode" style="width: 230px">
            <el-option label="UDP · 实时数据传输" value="UDP-REALTIME" />
            <el-option label="UDP · 实时数据控制传输" value="UDP-CTRL" />
            <el-option label="TCP · 可靠数据控制传输" value="TCP-RELIABLE" />
          </el-select>
        </div>
        <div class="form-row">
          <span class="form-label req">源端口</span>
          <el-input-number v-model="cfg.srcPort" :min="0" :max="65535" style="width: 150px" />
          <span class="form-hint">{{ hexOf(cfg.srcPort) }}</span>
        </div>
        <div class="form-row">
          <span class="form-label req">目的端口</span>
          <el-input-number v-model="cfg.dstPort" :min="0" :max="65535" style="width: 150px" />
          <span class="form-hint">{{ hexOf(cfg.dstPort) }}</span>
        </div>
        <div class="form-row">
          <span class="form-label req">序号 SEQ</span>
          <el-input-number v-model="cfg.seq" :min="0" :max="4294967295" style="width: 180px" />
        </div>
        <div class="form-row">
          <span class="form-label req">确认号 ACK</span>
          <el-input-number v-model="cfg.ack" :min="0" :max="4294967295" style="width: 180px" />
        </div>
        <div class="form-row">
          <span class="form-label">数据偏移(4bit)</span>
          <el-input-number v-model="cfg.dataOffset" :min="0" :max="15" style="width: 120px" />
          <span class="form-label" style="min-width:auto">保留(6bit)</span>
          <el-input-number v-model="cfg.reserved" :min="0" :max="63" style="width: 120px" />
        </div>
        <div class="form-row">
          <span class="form-label">标志位</span>
          <div class="flag-group">
            <el-checkbox v-model="cfg.flags.URG">URG</el-checkbox>
            <el-checkbox v-model="cfg.flags.ACK">ACK</el-checkbox>
            <el-checkbox v-model="cfg.flags.PSH">PSH</el-checkbox>
            <el-checkbox v-model="cfg.flags.RST">RST</el-checkbox>
            <el-checkbox v-model="cfg.flags.SYN">SYN</el-checkbox>
            <el-checkbox v-model="cfg.flags.FIN">FIN</el-checkbox>
          </div>
        </div>
        <div class="form-row">
          <span class="form-label">窗口(16bit)</span>
          <el-input-number v-model="cfg.window" :min="0" :max="65535" style="width: 150px" />
          <span class="form-hint">{{ hexOf(cfg.window) }}</span>
        </div>
        <div class="form-row">
          <span class="form-label">检验和</span>
          <el-input v-model="cfg.checksum" style="width: 160px" placeholder="0x482C" />
        </div>
        <div class="form-row">
          <span class="form-label">紧急指针(16bit)</span>
          <el-input-number v-model="cfg.urgentPointer" :min="0" :max="65535" style="width: 150px" />
        </div>
        <div class="form-row form-row--block">
          <span class="form-label">选项(可变)</span>
          <el-input v-model="cfg.options" type="textarea" :rows="2" placeholder="可选，无则留空" style="max-width: 460px" />
        </div>
        <div class="form-row form-row--block">
          <span class="form-label">填充</span>
          <el-input v-model="cfg.padding" type="textarea" :rows="2" placeholder="可选，无则留空" style="max-width: 460px" />
        </div>
      </div>

      <el-divider content-position="left">实时传输策略</el-divider>
      <div class="section-hint">
        实时数据传输根据数据长短决定是否分组及是否启用应答：<b>有可靠需求时不分组并启用应答</b>；
        无可靠需求时（分组或不分组）<b>均不设置应答</b>。
      </div>
      <div class="form-grid">
        <div class="form-row">
          <span class="form-label">是否分组</span>
          <el-switch v-model="cfg.groupEnabled" />
          <span class="form-hint">长报文需分组传输时开启</span>
        </div>
        <div class="form-row">
          <span class="form-label">应答机制</span>
          <el-switch v-model="cfg.ackEnabled" />
          <span class="form-hint">有可靠需求时开启（配合不分组）</span>
        </div>
      </div>
    </template>

    <!-- MDS：传输类型待确认，配置暂留空 -->
    <template v-if="transportType === 'MDS'">
      <el-alert type="info" :closable="false" show-icon
        title="MDS 传输类型待确认"
        description="MDS 的传输配置暂未完善，待确认后再补充。当前可创建 MDS 报文，配置区保持留空。" />
    </template>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TRANSPORT_TYPES } from '@/stores/protocol'

const props = defineProps({
  transportConfig: { type: Object, required: true },
  transportType: { type: String, default: '' },
})

const cfg = computed(() => props.transportConfig)

const typeLabel = computed(() => {
  const t = TRANSPORT_TYPES.find(x => x.value === props.transportType)
  return t?.label || props.transportType
})

// 十进制 → 十六进制预览（如 50001 → 0xC331）
const hexOf = (val) => {
  const n = Number(val)
  if (!Number.isFinite(n)) return '—'
  return '0x' + (n >>> 0).toString(16).toUpperCase()
}
</script>

<style scoped lang="scss">
.transport-config { margin-bottom: 4px; }
.form-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 8px; }
.form-row { display: flex; align-items: center; gap: 12px; }
.form-label { font-size: 13px; color: var(--el-text-color-regular); min-width: 90px; flex-shrink: 0; }
.form-label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.form-hint { font-size: 12px; color: var(--el-text-color-placeholder); }
.form-row--block { flex-direction: column; align-items: flex-start; }
.flag-group { display: flex; flex-wrap: wrap; gap: 2px 18px; }
.flag-group :deep(.el-checkbox) { margin-right: 0; }

.section-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 10px; line-height: 1.6; padding-left: 4px; border-left: 3px solid var(--el-color-primary-light-5); }

.sub-section { margin-bottom: 10px; }
.sub-section__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.sub-section__title { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); }
.sub-section__actions { display: flex; gap: 6px; }

.kv-table { margin-bottom: 4px; }
</style>
