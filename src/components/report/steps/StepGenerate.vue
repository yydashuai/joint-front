<template>
  <div class="step step-generate">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="step-head">
          <div>
            <div class="blk__title"><el-icon><FolderOpened /></el-icon> 生成确认</div>
          </div>
          <div class="step-actions">
            <el-button :icon="ArrowLeft" @click="$emit('back')">上一步</el-button>
            <el-button type="primary" :icon="MagicStick" :loading="store.generating" :disabled="!run" @click="onGenerate">
              {{ store.generating ? stageText : generateLabel }}
            </el-button>
          </div>
        </div>
        <el-card shadow="never" class="prev">
          <template #header><div class="card-title">待生成内容</div></template>
          <div class="prev__row"><span class="prev__k">数据批次</span><span>{{ run ? batchLabel : '未选择批次' }}</span></div>
          <div class="prev__row"><span class="prev__k">报告标题</span><span>{{ form.title || reportTitle || '—' }}</span></div>
          <div class="prev__row"><span class="prev__k">报告模板</span><span>{{ templateName }}</span></div>
          <div class="prev__row"><span class="prev__k">批次类型</span><span>{{ run?.batchType === 'receive' ? '接收批次' : '发送批次' }}</span></div>
          <div class="prev__row"><span class="prev__k">报告生成者</span><span>{{ generatorName }}</span></div>
          <div class="prev__row">
            <span class="prev__k">素材</span>
            <span class="prev__mats">
              <template v-if="materials.length">
                <el-tag v-for="(m, i) in materials" :key="i" size="small" effect="plain">{{ m.name }}</el-tag>
              </template>
              <span v-else class="muted">无</span>
            </span>
          </div>
        </el-card>

        <el-card shadow="never" class="knowledge-select">
          <template #header><div class="card-title">报告知识检索范围 <el-tag size="small" type="success" effect="plain">仅用于 RAG</el-tag></div></template>
          <el-checkbox-group v-model="store.selectedKnowledgeCollectionIds">
            <el-checkbox-button v-for="item in store.knowledgeCollections" :key="item.id" :value="item.id">{{ item.name }}</el-checkbox-button>
          </el-checkbox-group>
          <p>报告生成会从所选集合检索规范、方法、历史报告与优秀案例，并保留命中片段来源。</p>
        </el-card>

        <div class="gen-zone">
          <el-button type="success" size="large" :icon="MagicStick" :loading="store.generating" :disabled="!run" @click="onGenerate">
            {{ store.generating ? stageText : generateLabel }}
          </el-button>
          <el-progress v-if="store.generating" :percentage="pct" :stroke-width="8" status="success" class="gen-zone__bar" />
        </div>
      </div>
    </el-scrollbar>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { FolderOpened, MagicStick, ArrowLeft } from '@element-plus/icons-vue'
import { useReportStore, REPORT_STAGES } from '@/stores/report'
import { useRunBatchStore } from '@/stores/runBatch'
import { useSystemStore } from '@/stores/system'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  form: { type: Object, required: true },
  materials: { type: Array, required: true },
  regenerateFromId: { type: String, default: '' },
  autoGenerateTick: { type: Number, default: 0 }
})
const emit = defineEmits(['back', 'done'])

const store = useReportStore()
const batchStore = useRunBatchStore()
const systemStore = useSystemStore()
const authStore = useAuthStore()

const run = computed(() => batchStore.byId(props.form.batchId))
const sysName = computed(() => systemStore.systems.find((s) => s.id === run.value?.systemId)?.name || '')
const templateName = computed(() => store.templates.find((t) => t.id === props.form.templateId)?.name || '默认结构')
const generatorName = computed(() => authStore.currentUser?.realName || authStore.currentUser?.username || '当前用户')
const stageText = computed(() => (store.genStage >= 0 ? REPORT_STAGES[store.genStage] : '生成中…'))
const pct = computed(() => Math.round(((store.genStage + 1) / REPORT_STAGES.length) * 100))
const generateLabel = computed(() => (props.regenerateFromId ? '重新生成报告' : '生成最终报告'))

const pad = (value) => String(value || '').padStart(2, '0')
const formatDateTime = (text = '') => {
  const [rawDate = '', rawTime = ''] = String(text).trim().replace(/\//g, '-').split(' ')
  const [y = '', m = '', d = ''] = rawDate.split('-')
  const [hh = '', mm = ''] = rawTime.split(':')
  if (!y || !m || !d) return text || '未记录时间'
  return `${y}-${pad(m)}-${pad(d)} ${pad(hh || '00')}:${pad(mm || '00')}`
}
const batchLabel = computed(() => run.value
  ? `${run.value.scope?.displayName || '未命名接口范围'} · ${run.value.batchType === 'receive' ? '接收批次' : '发送批次'} · ${formatDateTime(run.value.startedAt || run.value.time)}`
  : '')
const reportTitle = computed(() => run.value
  ? `${run.value.scope?.displayName || '接口联试'} ${run.value.batchType === 'receive' ? '接收' : '发送'}联试报告`
  : '')

const onGenerate = async () => {
  if (!run.value) return
  const rep = await store.generateReport({
    systemId: run.value.systemId,
    batchId: props.form.batchId,
    title: props.form.title.trim() || reportTitle.value,
    templateId: props.form.templateId,
    materials: props.materials,
    sysName: sysName.value,
    generatorName: generatorName.value,
    knowledgeCollectionIds: store.selectedKnowledgeCollectionIds,
    regenerateFromId: props.regenerateFromId
  })
  if (rep) { ElMessage.success('报告已生成'); emit('done') }
}

watch(() => props.autoGenerateTick, (tick, oldTick) => {
  if (!tick || tick === oldTick) return
  onGenerate()
})
</script>

<style scoped lang="scss">
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.step__scroll { flex: 1; min-height: 0; }
.step__inner { max-width: 820px; margin: 0 auto; padding: 4px 4px 48px; }

.blk__title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; .el-icon { color: var(--el-color-primary); } }
.step-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px;
}
.step-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.card-title { font-size: 14px; font-weight: 600; color: var(--el-text-color-primary); }
.prev__row { display: flex; gap: 12px; font-size: 13px; line-height: 2; align-items: baseline; }
.prev__k { color: var(--el-text-color-secondary); width: 76px; flex-shrink: 0; }
.prev__mats { display: flex; flex-wrap: wrap; gap: 6px; }
.muted { color: var(--el-text-color-placeholder); }
.knowledge-select { margin-top: 12px; }
.knowledge-select :deep(.el-card__header) { padding: 11px 14px; }
.knowledge-select :deep(.el-card__body) { padding: 12px 14px; }
.knowledge-select .card-title { display: flex; align-items: center; justify-content: space-between; }
.knowledge-select p { margin: 9px 0 0; color: var(--el-text-color-secondary); font-size: 11px; }

.gen-zone {
  margin-top: 18px; text-align: center; padding: 28px;
  border: 2px dashed var(--el-color-success-light-5); border-radius: 14px;
  background: var(--el-color-success-light-9);
}
.gen-zone__bar { margin-top: 16px; }

@media (max-width: 720px) {
  .step-head { flex-direction: column; }
  .step-actions { width: 100%; justify-content: flex-end; }
}
</style>
