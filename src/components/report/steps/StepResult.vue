<template>
  <div class="step step-result">
    <div class="result-toolbar">
      <div class="result-title"><el-icon><Document /></el-icon> {{ cur ? cur.title : '联试报告' }}</div>
      <div v-if="cur" class="result-actions">
        <el-button size="small" :type="editMode ? 'primary' : ''" :icon="EditPen" @click="editMode = !editMode">
          {{ editMode ? '完成编辑' : '编辑' }}
        </el-button>
        <el-button size="small" :icon="Download" @click="exportMd">Markdown</el-button>
        <el-button size="small" :icon="Document" @click="exportDoc">DOCX</el-button>
        <el-button size="small" :icon="RefreshLeft" @click="$emit('restart')">重新开始</el-button>
      </div>
    </div>

    <el-scrollbar v-if="cur" class="paper-scroll">
      <div class="paper">
        <h1 class="paper__title">{{ cur.title }}</h1>
        <div class="paper__meta">
          <span>{{ sysName }}</span><span>·</span><span>{{ cur.runName }}</span><span>·</span><span>{{ cur.createdAt }}</span>
        </div>
        <section v-for="sec in cur.sections" :key="sec.key" class="sec">
          <div class="sec__head">
            <span class="sec__title">{{ sec.title }}</span>
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
    <el-empty v-else description="尚未生成报告，请返回上一步生成" :image-size="100" />

    <div class="step__foot">
      <el-button :icon="ArrowLeft" @click="$emit('back')">上一步</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Document, EditPen, Download, RefreshLeft, Refresh, ArrowLeft } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'
import { useSystemStore } from '@/stores/system'
import { mdToHtml, downloadFile } from '@/utils/markdown'

defineEmits(['back', 'restart'])

const store = useReportStore()
const systemStore = useSystemStore()

const cur = computed(() => store.currentReport)
const editMode = ref(false)
const sysName = computed(() => systemStore.systems.find((s) => s.id === cur.value?.systemId)?.name || '—')
const render = (md) => mdToHtml(md)

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
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.result-toolbar {
  flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  flex-wrap: wrap; margin-bottom: 12px;
}
.result-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; .el-icon { color: var(--el-color-primary); } }
.result-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.paper-scroll { flex: 1; min-height: 0; }
.paper {
  max-width: 820px; margin: 0 auto 48px; padding: 36px 44px; background: #fff;
  border-radius: 12px; box-shadow: 0 8px 28px rgba(0, 0, 0, .08); color: #1f2937;
}
.paper__title { text-align: center; font-size: 24px; margin: 0 0 8px; padding-bottom: 12px; border-bottom: 3px solid var(--el-color-primary); }
.paper__meta { display: flex; justify-content: center; gap: 8px; color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 24px; }
.sec { margin-bottom: 22px; }
.sec__head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-left: 10px; border-left: 3px solid var(--el-color-primary); }
.sec__title { font-size: 17px; font-weight: 600; color: #1e3a8a; }
.sec__spacer { flex: 1; }
.sec__edit :deep(textarea) { font-family: 'Consolas', monospace; font-size: 13px; }

.md { font-size: 14px; line-height: 1.8; }
.md :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
.md :deep(th) { background: #eff6ff; color: #1e3a8a; border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
.md :deep(td) { border: 1px solid #e5e7eb; padding: 8px 12px; }
.md :deep(tr:nth-child(even) td) { background: #f9fafb; }
.md :deep(blockquote) { border-left: 4px solid var(--el-color-primary); background: #eef2ff; margin: 12px 0; padding: 10px 16px; border-radius: 0 6px 6px 0; }
.md :deep(ul) { padding-left: 24px; margin: 8px 0; }
.md :deep(strong) { color: #1f2937; font-weight: 700; }

.step__foot { position: absolute; right: 6px; bottom: 6px; z-index: 5; display: flex; align-items: center; gap: 12px; }
</style>
