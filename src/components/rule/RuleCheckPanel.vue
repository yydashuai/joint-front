<template>
  <div class="check-panel">
    <el-card shadow="never" class="check-card">
      <template #header>
        <div class="card-head">
          <span class="card-title">试判定</span>
          <el-tag :type="summaryTag" effect="plain">{{ summaryText }}</el-tag>
        </div>
      </template>
      <el-form label-width="110px">
        <el-form-item label="目标接口">
          <el-select v-model="interfaceId" filterable style="width: 100%;">
            <el-option v-for="iface in coveredInterfaces" :key="iface.id" :label="iface.name" :value="iface.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="响应时延">
          <el-input-number v-model="recvMs" :min="0" :max="10000" />
          <span class="unit">ms</span>
        </el-form-item>
        <el-form-item label="样本输入">
          <el-input v-model="sampleText" type="textarea" :rows="12" class="sample-input" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="DataAnalysis" @click="runCheck">检测</el-button>
          <el-button @click="fillSample('valid')">生成样例</el-button>
          <el-button @click="fillSample('bad')">生成越界样例</el-button>
          <el-button @click="sampleText = ''">清空</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="check-card">
      <template #header><span class="card-title">检测结果</span></template>
      <div v-if="!results.length" class="muted">点击检测后显示逐条命中结果。</div>
      <div v-else class="result-list">
        <div v-for="(item, idx) in results" :key="idx" class="result-row" :class="`result-row--${item.level}`">
          <span class="result-dot" />
          <div class="result-row__body">
            <strong>{{ item.path }}</strong>
            <span>{{ item.message }}</span>
          </div>
          <el-tag :type="tagOf(item.level)" size="small">{{ item.ruleLabel }}</el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { DataAnalysis } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { evaluate, makeSample } from '@/utils/ruleEngine'

const props = defineProps({
  ruleSet: { type: Object, required: true },
})

const protoStore = useProtocolStore()
const interfaceId = ref(null)
const sampleText = ref('')
const recvMs = ref(120)
const results = ref([])

const coveredInterfaces = computed(() => {
  const ids = [...new Set((props.ruleSet.rules || []).map((rule) => rule.target?.interfaceId).filter(Boolean))]
  const matched = protoStore.interfaces.filter((iface) => ids.includes(iface.id))
  return matched.length ? matched : protoStore.interfaces.filter((iface) => iface.moduleId === props.ruleSet.moduleId)
})
const currentInterface = computed(() => protoStore.interfaces.find((iface) => iface.id === interfaceId.value))
const summaryText = computed(() => {
  if (!results.value.length) return '未检测'
  if (results.value.some((item) => item.level === 'error')) return '未通过'
  if (results.value.some((item) => item.level === 'warning')) return '通过有提醒'
  return '通过'
})
const summaryTag = computed(() => summaryText.value === '通过' ? 'success' : (summaryText.value === '未通过' ? 'danger' : 'warning'))

watch(() => props.ruleSet.id, () => {
  interfaceId.value = coveredInterfaces.value[0]?.id || null
  fillSample('valid')
  results.value = []
}, { immediate: true })

function fillSample(variant) {
  const sample = makeSample(currentInterface.value, variant)
  sampleText.value = JSON.stringify(sample, null, 2)
}
function runCheck() {
  results.value = evaluate(props.ruleSet, sampleText.value, currentInterface.value, { recvMs: recvMs.value })
}
const tagOf = (level) => level === 'success' ? 'success' : (level === 'warning' ? 'warning' : 'danger')
</script>

<style scoped lang="scss">
.check-panel { display: grid; grid-template-columns: minmax(420px, .9fr) minmax(360px, 1fr); gap: 14px; }
.check-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 14px; }
  :deep(.el-card__body) { padding: 14px; }
}
.card-head { display: flex; align-items: center; justify-content: space-between; }
.card-title { font-weight: 650; font-size: 14px; }
.unit, .muted { margin-left: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.sample-input { font-family: Consolas, Monaco, monospace; }
.result-list { display: flex; flex-direction: column; gap: 8px; }
.result-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) 92px; gap: 10px; align-items: center; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--el-border-color-lighter); }
.result-row--success { background: var(--el-color-success-light-9); }
.result-row--warning { background: var(--el-color-warning-light-9); }
.result-row--error { background: var(--el-color-danger-light-9); }
.result-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--el-color-success); }
.result-row--warning .result-dot { background: var(--el-color-warning); }
.result-row--error .result-dot { background: var(--el-color-danger); }
.result-row__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.result-row__body strong { font-family: Consolas, Monaco, monospace; font-size: 12px; }
.result-row__body span { color: var(--el-text-color-secondary); font-size: 12px; }
@media (max-width: 1180px) { .check-panel { grid-template-columns: 1fr; } }
</style>
