<template>
  <div v-if="!props.module" class="empty-pick">
    <el-empty description="请在左侧选择一个模块，为其生成联试报告" :image-size="90" />
  </div>
  <div v-else class="wb">
    <!-- 左：生成配置 -->
    <el-card class="wb__cfg" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header><div class="card-head"><span>生成配置</span></div></template>
      <el-scrollbar class="wb__cfg-scroll">
        <div class="wb__cfg-body">
          <!-- 数据来源 -->
          <div class="grp">
            <div class="grp__title"><el-icon><Coin /></el-icon> 数据来源（硬数据由此确定性生成）</div>
            <div class="ctx-box">
              <div class="ctx-row"><span class="ctx-k">被测系统</span><span>{{ systemName }}</span></div>
              <div class="ctx-row"><span class="ctx-k">所属模块</span><span>{{ props.module.name }}</span></div>
            </div>
            <el-form label-width="78px" label-position="left" class="mt8">
              <el-form-item label="联试任务">
                <el-select v-model="form.taskId" placeholder="选择联试任务（数据源）" class="w-full">
                  <el-option v-for="t in taskOptions" :key="t.id" :label="t.name" :value="t.id" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>

          <!-- 生成设置 -->
          <div class="grp">
            <div class="grp__title"><el-icon><Setting /></el-icon> 生成设置</div>
            <el-form label-width="78px" label-position="left">
              <el-form-item label="报告标题">
                <el-input v-model="form.title" placeholder="留空自动命名" />
              </el-form-item>
              <el-form-item label="报告模板">
                <el-select v-model="form.templateId" placeholder="选择本模块章节骨架" class="w-full">
                  <el-option v-for="t in templateOptions" :key="t.id" :label="t.name" :value="t.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="关键词">
                <el-input v-model="form.keywords" placeholder="可选 · 留空按报告主题自动检索" />
              </el-form-item>
            </el-form>
          </div>

          <!-- 知识增强（RAG · 系统自动检索，用户无需手选） -->
          <div class="grp">
            <div class="grp__title"><el-icon><MagicStick /></el-icon> 知识增强（RAG · 自动）</div>
            <div class="rag-auto" @click="showHits = !showHits">
              <el-icon class="rag-auto__icon"><Search /></el-icon>
              <span class="rag-auto__text">已自动从「{{ props.module.name }}」知识库检索到 <b>{{ hits.length }}</b> 条相关知识</span>
              <el-icon class="rag-auto__caret" :class="{ 'is-open': showHits }"><ArrowRight /></el-icon>
            </div>
            <div v-show="showHits" class="rag-list">
              <div v-for="h in hits" :key="h.docId + '-' + h.idx" class="rag-ro">
                <div class="rag-ro__text">{{ h.text }}</div>
                <div class="rag-ro__meta">
                  <span class="rag-src">{{ h.docTitle }} #{{ h.idx }}</span>
                  <span>融合相关度 <b>{{ h.score }}</b></span>
                </div>
              </div>
              <div v-if="!hits.length" class="rag-empty">本模块知识库暂无可用知识，将仅依据联试数据生成。</div>
            </div>
          </div>
        </div>
      </el-scrollbar>

      <div class="wb__gen">
        <el-button type="primary" size="large" :icon="MagicStick" :loading="store.generating" class="w-full" @click="onGenerate">
          {{ store.generating ? stageText : '生成报告' }}
        </el-button>
        <el-progress
          v-if="store.generating"
          :percentage="Math.round((store.genStage + 1) / REPORT_STAGES.length * 100)"
          :stroke-width="6" status="success" class="wb__gen-bar"
        />
      </div>
    </el-card>

    <!-- 右：当前报告 / 历史报告 -->
    <el-card class="wb__main" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header>
        <div class="card-head">
          <span>{{ cur ? cur.title : '报告预览' }}</span>
          <div v-if="cur" class="head-tools">
            <el-button size="small" :type="editMode ? 'primary' : ''" :icon="EditPen" @click="editMode = !editMode">
              {{ editMode ? '完成编辑' : '编辑' }}
            </el-button>
            <el-button size="small" :icon="Download" @click="exportMd">Markdown</el-button>
            <el-button size="small" :icon="Document" @click="exportDoc">DOCX</el-button>
            <el-button size="small" :icon="Back" @click="store.currentReportId = null">历史报告</el-button>
          </div>
        </div>
      </template>

      <el-scrollbar v-if="cur" class="paper-scroll">
        <div class="paper">
          <h1 class="paper__title">{{ cur.title }}</h1>
          <div class="paper__meta">
            <span>{{ systemName }}</span><span>·</span><span>{{ moduleName(cur.moduleId) }}</span><span>·</span><span>{{ cur.createdAt }}</span>
          </div>
          <section v-for="sec in cur.sections" :key="sec.key" class="sec">
            <div class="sec__head">
              <span class="sec__title">{{ sec.title }}</span>
              <el-tag size="small" :type="sec.kind === 'data' ? 'info' : 'success'" effect="plain">
                {{ sec.kind === 'data' ? '硬数据·确定性' : 'RAG 生成' }}
              </el-tag>
              <span class="sec__spacer" />
              <el-button
                v-if="sec.kind === 'gen'" size="small" text type="primary" :icon="Refresh"
                @click="store.regenerateSection(cur, sec.key)"
              >重新生成</el-button>
            </div>
            <el-input v-if="editMode" v-model="sec.content" type="textarea" :autosize="{ minRows: 3 }" class="sec__edit" />
            <div v-else class="md" v-html="render(sec.content)" />
          </section>
        </div>
      </el-scrollbar>

      <el-scrollbar v-else class="hist-scroll">
        <div class="hist">
          <div class="hist__title">历史报告（{{ historyReports.length }}）<span class="muted">· {{ props.module.name }}</span></div>
          <div v-for="r in historyReports" :key="r.id" class="hist__item" @click="store.selectReport(r.id)">
            <el-icon class="hist__icon"><Document /></el-icon>
            <div class="hist__main">
              <div class="hist__name">{{ r.title }}</div>
              <div class="hist__sub">{{ r.createdAt }} · {{ r.sections.length }} 章</div>
            </div>
            <el-popconfirm title="删除该报告？" @confirm="store.removeReport(r.id)">
              <template #reference>
                <el-button size="small" text :icon="Delete" @click.stop />
              </template>
            </el-popconfirm>
          </div>
          <el-empty v-if="!historyReports.length" description="该模块暂无报告，左侧配置后点「生成报告」" :image-size="70" />
        </div>
      </el-scrollbar>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Coin, Setting, Search, MagicStick, EditPen, Download, Document, Back, Refresh, Delete, ArrowRight } from '@element-plus/icons-vue'
import { useReportStore, REPORT_STAGES } from '@/stores/report'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import { useTestTaskStore } from '@/stores/testTask'
import { mdToHtml, downloadFile } from '@/utils/markdown'

const props = defineProps({ module: { type: Object, default: null } })
const store = useReportStore()
const systemStore = useSystemStore()
const connStore = useConnectionStore()
const taskStore = useTestTaskStore()

const moduleId = computed(() => props.module?.id ?? null)
const systemId = computed(() => props.module?.systemId ?? null)
const systemName = computed(() => systemStore.systems.find((s) => s.id === systemId.value)?.name || '未分配')
const moduleName = (id) => connStore.nodes.find((m) => m.id === id)?.name || '—'

const cur = computed(() => store.currentReport)
const editMode = ref(false)

const form = reactive({ taskId: null, title: '', templateId: null, keywords: '' })
const taskOptions = computed(() => (systemId.value ? taskStore.tasksOfSystem(systemId.value) : []))
const templateOptions = computed(() => store.templatesOfModule(moduleId.value))
const historyReports = computed(() => store.reportsOfModule(moduleId.value))
const render = (md) => mdToHtml(md)
const stageText = computed(() => (store.genStage >= 0 ? REPORT_STAGES[store.genStage] : '生成中…'))

/* —— 知识增强：系统按「报告主题」自动检索本模块知识库（用户不手选片段） —— */
const showHits = ref(false)
const hits = ref([])
// 检索主题：关键词优先，留空则用报告标题，再退到模块名 —— 即使用户什么都不填也能自动检索
const retrievalQuery = computed(() => form.keywords.trim() || form.title.trim() || props.module?.name || '')
const runSearch = () => { hits.value = store.searchKnowledge(retrievalQuery.value, moduleId.value, 6) }
let kwTimer = null
watch(retrievalQuery, () => { clearTimeout(kwTimer); kwTimer = setTimeout(runSearch, 250) })

// 切换模块：重置配置、默认模板、刷新检索
watch(moduleId, () => {
  form.taskId = null; form.title = ''; form.keywords = ''
  form.templateId = templateOptions.value[0]?.id ?? null
  runSearch()
}, { immediate: true })

/* —— 生成 —— */
const onGenerate = async () => {
  if (!props.module) return
  const taskName = taskOptions.value.find((t) => t.id === form.taskId)?.name
  const rep = await store.generateReport({
    systemId: systemId.value,
    moduleId: moduleId.value,
    taskName: taskName || props.module.name,
    title: form.title.trim(),
    templateId: form.templateId
  })
  if (rep) { editMode.value = false; ElMessage.success('报告已生成') }
}

/* —— 导出 —— */
const exportMd = () => {
  if (!cur.value) return
  downloadFile(`${cur.value.title}.md`, store.reportMarkdown(cur.value), 'text/markdown;charset=utf-8')
}
const exportDoc = () => {
  if (!cur.value) return
  const body = mdToHtml(store.reportMarkdown(cur.value))
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${cur.value.title}</title>
<style>body{font-family:'Microsoft YaHei',sans-serif;line-height:1.8;color:#1f2937;padding:24px;}
h1{font-size:24px;text-align:center;border-bottom:3px solid #4a6bdf;padding-bottom:12px;}
h2{font-size:18px;color:#1e3a8a;border-left:4px solid #4a6bdf;padding-left:10px;}
table{border-collapse:collapse;width:100%;margin:12px 0;}th{background:#eff6ff;border:1px solid #d1d5db;padding:8px;}
td{border:1px solid #e5e7eb;padding:8px;}blockquote{border-left:4px solid #4a6bdf;background:#eef2ff;padding:10px 16px;}</style>
</head><body>${body}</body></html>`
  downloadFile(`${cur.value.title}.doc`, html, 'application/msword;charset=utf-8')
}
</script>

<style scoped lang="scss">
.empty-pick { height: 100%; display: flex; align-items: center; justify-content: center; }
.wb { display: flex; gap: 16px; height: 100%; min-height: 0; }
.wb__cfg { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; }
.wb__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.head-tools { display: flex; gap: 8px; }
.w-full { width: 100%; }
.mt8 { margin-top: 8px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 400; margin-left: 6px; }

.wb__cfg-scroll { flex: 1; min-height: 0; }
.wb__cfg-body { padding: 14px 16px; }
.grp { & + & { margin-top: 18px; } }
.grp__title {
  display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
  font-size: 13px; font-weight: 600; color: var(--el-text-color-primary);
}
.grp :deep(.el-form-item) { margin-bottom: 12px; }

.ctx-box { background: var(--el-fill-color-lighter); border-radius: 6px; padding: 8px 12px; }
.ctx-row { display: flex; gap: 10px; font-size: 13px; line-height: 1.9; }
.ctx-k { color: var(--el-text-color-secondary); width: 56px; flex-shrink: 0; }

.rag-auto {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 9px 10px; border-radius: 6px; font-size: 12.5px;
  background: var(--el-color-primary-light-9); color: var(--el-text-color-regular);
  &__icon { color: var(--el-color-primary); flex-shrink: 0; }
  &__text { flex: 1; b { color: var(--el-color-primary); } }
  &__caret { color: var(--el-text-color-secondary); transition: transform .15s; &.is-open { transform: rotate(90deg); } }
}
.rag-list { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.rag-ro {
  padding: 8px 10px; background: var(--el-fill-color-lighter); border-radius: 6px;
  &__text { font-size: 12.5px; line-height: 1.6; color: var(--el-text-color-regular); }
  &__meta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; font-size: 11px; color: var(--el-text-color-placeholder); }
  .rag-src { color: var(--el-color-primary); }
}
.rag-empty { font-size: 12px; color: var(--el-text-color-placeholder); padding: 6px 2px; }

.wb__gen { padding: 12px 16px; border-top: 1px solid var(--el-border-color-lighter); }
.wb__gen-bar { margin-top: 10px; }

.paper-scroll, .hist-scroll { flex: 1; min-height: 0; }
.paper { max-width: 860px; margin: 0 auto; padding: 24px 28px; }
.paper__title { text-align: center; font-size: 22px; margin: 0 0 6px; }
.paper__meta { display: flex; justify-content: center; gap: 8px; color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 20px; }
.sec { margin-bottom: 20px; }
.sec__head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-left: 10px; border-left: 3px solid var(--el-color-primary); }
.sec__title { font-size: 16px; font-weight: 600; }
.sec__spacer { flex: 1; }
.sec__edit :deep(textarea) { font-family: 'Consolas', monospace; font-size: 13px; }

.md { font-size: 14px; line-height: 1.8; color: var(--el-text-color-primary); }
.md :deep(table) { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
.md :deep(th) { background: var(--el-fill-color-light); border: 1px solid var(--el-border-color); padding: 6px 10px; }
.md :deep(td) { border: 1px solid var(--el-border-color-lighter); padding: 6px 10px; }
.md :deep(blockquote) { border-left: 3px solid var(--el-color-primary); background: var(--el-color-primary-light-9); margin: 8px 0; padding: 8px 14px; color: var(--el-text-color-regular); }
.md :deep(ul) { padding-left: 22px; margin: 6px 0; }
.md :deep(strong) { color: var(--el-color-primary); }

.hist { padding: 16px; }
.hist__title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.hist__item {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; cursor: pointer;
  border: 1px solid var(--el-border-color-lighter); border-radius: 8px; margin-bottom: 10px;
  transition: all .15s;
  &:hover { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
}
.hist__icon { font-size: 22px; color: var(--el-color-primary); }
.hist__main { flex: 1; min-width: 0; }
.hist__name { font-weight: 600; }
.hist__sub { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 2px; }
</style>
