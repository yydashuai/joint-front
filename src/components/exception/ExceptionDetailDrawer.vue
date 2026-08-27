<template>
  <el-drawer v-model="visible" size="620px" title="异常样本详情">
    <template v-if="exception">
      <div class="drawer-body">
        <section class="summary-card">
          <div class="summary-card__top">
            <el-tag :type="typeMeta.tone" effect="dark">{{ exception.type }}</el-tag>
            <span>{{ exception.capturedTime }}</span>
          </div>
          <h3>{{ exception.iface }}</h3>
          <p>{{ primaryIssue.message || exception.detail?.ruleMessage || '接收数据未通过解析或校验。' }}</p>
          <div class="summary-actions">
            <el-button type="primary" @click="$emit('create-variant', exception)">修改副本并保存</el-button>
            <el-button @click="$emit('save-dataset', [exception])">直接存入数据集</el-button>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">
            <span>异常判定</span>
            <small>{{ exception.issues?.length || 1 }} 项</small>
          </div>
          <div class="issue-list">
            <div v-for="(issue, index) in issueRows" :key="`${issue.field}-${index}`" class="issue-item">
              <div>
                <strong>{{ issue.field || '报文整体' }}</strong>
                <el-tag size="small" effect="plain">{{ issue.layer || typeMeta.layer }}</el-tag>
              </div>
              <p>{{ issue.message }}</p>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">
            <span>解析字段</span>
            <small>{{ valueRows.length }} 个字段</small>
          </div>
          <el-table v-if="valueRows.length" :data="valueRows" size="small" border>
            <el-table-column label="字段标签" min-width="150">
              <template #default="{ row }">
                <strong>{{ row.label }}</strong>
                <small v-if="row.name !== row.label" class="field-name">{{ row.name }}</small>
              </template>
            </el-table-column>
            <el-table-column label="接收值" min-width="170">
              <template #default="{ row }"><code>{{ displayValue(row.value) }}</code></template>
            </el-table-column>
            <el-table-column label="判定" width="92" align="center">
              <template #default="{ row }">
                <el-tag v-if="issueFields.has(row.name)" type="danger" size="small">异常</el-tag>
                <span v-else class="normal-value">—</span>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="该样本未能解析出字段，可保留原始报文用于复现" :image-size="58" />
        </section>

        <section class="panel">
          <div class="panel-title"><span>原始接收数据</span></div>
          <div class="raw-meta">
            <span>格式</span><strong>{{ exception.transport || 'bin' }}</strong>
            <span>长度</span><strong>{{ byteLength }} Bytes</strong>
          </div>
          <pre class="raw-data">{{ exception.rawHex || exception.detail?.reqHex || '未记录原始数据' }}</pre>
        </section>

        <section class="panel">
          <div class="panel-title"><span>样本信息</span></div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="来源">{{ sourceLabel }}</el-descriptions-item>
            <el-descriptions-item label="所属报文">{{ exception.iface }}</el-descriptions-item>
            <el-descriptions-item v-if="exception.batchId || exception.runId" label="关联批次">{{ exception.batchId || exception.runId }}</el-descriptions-item>
            <el-descriptions-item label="数据集复用">
              <el-tag v-if="exception.savedDatasetIds?.length" type="success" size="small">
                已存入 {{ exception.savedDatasetIds.length }} 个数据集
              </el-tag>
              <span v-else>尚未入库</span>
              <span v-if="exception.variantCount" class="variant-count"> · 已创建 {{ exception.variantCount }} 个变体</span>
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="panel">
          <div class="panel-title"><span>样本标签</span></div>
          <el-select
            v-model="tagDraft"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签"
            class="tag-select"
            @change="saveTags"
          >
            <el-option v-for="tag in store.tagOptions" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </section>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useExceptionStore, EXC_SOURCES } from '@/stores/exception'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  exception: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'save-dataset', 'create-variant'])

const store = useExceptionStore()
const tagDraft = ref([])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const typeMeta = computed(() => store.typeMeta(props.exception?.type))
const primaryIssue = computed(() => issueRows.value[0] || {})
const issueRows = computed(() => {
  if (props.exception?.issues?.length) return props.exception.issues
  return [{
    field: props.exception?.detail?.fieldPath || '',
    layer: typeMeta.value.layer,
    message: props.exception?.detail?.ruleMessage || props.exception?.remark || '',
  }]
})
const fieldLabelMap = computed(() => new Map((props.exception?.fields || []).map((field) => [
  field.name,
  field.label || field.desc || field.name,
])))
const valueRows = computed(() => Object.entries(props.exception?.values || {}).map(([name, value]) => ({
  name,
  label: fieldLabelMap.value.get(name) || name,
  value,
})))
const issueFields = computed(() => new Set(issueRows.value.map((issue) => issue.field).filter(Boolean)))
const byteLength = computed(() => {
  const compact = String(props.exception?.rawHex || props.exception?.detail?.reqHex || '').replace(/[^0-9a-f]/gi, '')
  return Math.floor(compact.length / 2)
})
const sourceLabel = computed(() => EXC_SOURCES.find((item) => item.value === props.exception?.source)?.label || '接收数据自动捕获')

watch(() => props.exception?.id, () => {
  tagDraft.value = [...(props.exception?.tags || [])]
}, { immediate: true })

const displayValue = (value) => {
  if (value === null) return 'null'
  if (value === undefined || value === '') return '空值'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
const saveTags = (tags) => {
  if (props.exception) store.setTags(props.exception.id, tags)
}
</script>

<style scoped lang="scss">
.drawer-body { display: flex; flex-direction: column; gap: 14px; }
.summary-card,
.panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
}
.summary-card {
  padding: 16px;
  background:
    linear-gradient(135deg, rgba(245, 108, 108, .11), transparent 55%),
    var(--el-bg-color);
}
.summary-card__top,
.panel-title,
.issue-item > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.summary-card__top span { color: var(--el-text-color-secondary); font-size: 12px; }
.summary-card h3 { margin: 14px 0 6px; font-size: 20px; }
.summary-card p { margin: 0; color: var(--el-text-color-regular); line-height: 1.6; }
.summary-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.immutable-note {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.panel { padding: 14px; }
.panel-title { margin-bottom: 12px; font-weight: 700; }
.panel-title small { color: var(--el-text-color-secondary); font-weight: 400; }
.issue-list { display: flex; flex-direction: column; gap: 8px; }
.issue-item {
  padding: 10px;
  border-left: 3px solid var(--el-color-danger);
  border-radius: 4px 8px 8px 4px;
  background: var(--el-fill-color-extra-light);
}
.issue-item p { margin: 6px 0 0; color: var(--el-text-color-regular); font-size: 13px; line-height: 1.5; }
.field-name { display: block; margin-top: 2px; color: var(--el-text-color-secondary); font-family: Consolas, monospace; }
.normal-value { color: var(--el-text-color-placeholder); }
.raw-meta {
  display: grid;
  grid-template-columns: 50px 1fr 50px 1fr;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
}
.raw-meta span { color: var(--el-text-color-secondary); }
.raw-data {
  max-height: 180px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  border-radius: 7px;
  background: #111827;
  color: #d1fae5;
  font: 12px/1.7 Consolas, Monaco, monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
.variant-count { color: var(--el-text-color-secondary); }
.tag-select { width: 100%; }
.tag-hint { margin: 8px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
code { font-family: Consolas, Monaco, monospace; }
</style>
