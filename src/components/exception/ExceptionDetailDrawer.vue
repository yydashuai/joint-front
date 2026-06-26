<template>
  <el-drawer v-model="visible" size="520px" title="异常详情">
    <template v-if="exception">
      <div class="drawer-body">
        <section class="panel">
          <div class="panel-title">基本信息</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="异常类型">{{ exception.type }}</el-descriptions-item>
            <el-descriptions-item label="级别">
              <el-tag :type="store.levelMeta(exception.level).tag" size="small">{{ exception.level }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="store.stateMeta(exception.state).tag" size="small">{{ exception.state }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="来源">{{ sourceLabel(exception.source) }}</el-descriptions-item>
            <el-descriptions-item label="接口">{{ exception.iface }}</el-descriptions-item>
            <el-descriptions-item label="捕捉时间">{{ exception.capturedTime }}</el-descriptions-item>
            <el-descriptions-item v-if="exception.runId" label="执行批次">
              <el-button link type="primary" @click="router.push({ path: '/execution', query: { runId: exception.runId } })">{{ exception.runId }}</el-button>
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="panel">
          <div class="panel-title">证据</div>
          <div class="evidence">
            <label>命中规则 / 现场说明</label>
            <p>{{ exception.detail?.ruleMessage || exception.remark || '暂无说明' }}</p>
            <label>字段路径</label>
            <p class="mono">{{ exception.detail?.fieldPath || 'interface' }}</p>
            <label>响应时延</label>
            <p>{{ exception.detail?.recvMs == null ? '未记录' : `${exception.detail.recvMs}ms` }}</p>
            <label>请求帧</label>
            <pre>{{ exception.detail?.reqHex || '未记录' }}</pre>
            <label>响应帧</label>
            <pre>{{ exception.detail?.respHex || '未记录' }}</pre>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">处置</div>
          <el-input v-model="note" type="textarea" :rows="3" placeholder="填写处置说明或复核结论" />
          <div class="actions">
            <el-button @click="setState('处理中')">开始处理</el-button>
            <el-button type="success" plain @click="setState('已修复')">已修复</el-button>
            <el-button type="success" @click="setState('已处理')">已处理</el-button>
            <el-button type="warning" plain @click="setState('已转派')">转派</el-button>
            <el-button type="info" plain @click="setState('已忽略')">忽略</el-button>
            <el-button :disabled="!note.trim()" @click="addTrace">追加留痕</el-button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">留痕时间线</div>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in exception.trace"
              :key="index"
              :timestamp="item.time"
              placement="top"
            >
              <strong>{{ item.action }}</strong>
              <p>{{ item.user }}：{{ item.note }}</p>
            </el-timeline-item>
          </el-timeline>
        </section>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { EXC_SOURCES, useExceptionStore } from '@/stores/exception'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  exception: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const store = useExceptionStore()
const note = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

watch(() => props.exception?.id, () => { note.value = '' })

const sourceLabel = (source) => EXC_SOURCES.find((item) => item.value === source)?.label || source
const setState = (state) => {
  if (!props.exception) return
  store.updateState(props.exception.id, state, note.value || '状态快速流转')
  ElMessage.success(`已更新为${state}`)
  note.value = ''
}
const addTrace = () => {
  if (!props.exception || !note.value.trim()) return
  store.addTrace(props.exception.id, note.value.trim())
  ElMessage.success('留痕已追加')
  note.value = ''
}
</script>

<style scoped lang="scss">
.drawer-body { display: flex; flex-direction: column; gap: 14px; }
.panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color);
}
.panel-title {
  margin-bottom: 10px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.evidence {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.evidence label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.evidence p,
.evidence pre {
  margin: 0 0 6px;
  padding: 8px;
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  font-size: 14px;
  line-height: 1.5;
}
.evidence pre {
  white-space: pre-wrap;
  word-break: break-all;
}
.mono,
.evidence pre { font-family: Consolas, Monaco, monospace; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
:deep(.el-timeline) { padding-left: 2px; }
:deep(.el-timeline-item__content p) { margin: 4px 0 0; color: var(--el-text-color-secondary); }
</style>
