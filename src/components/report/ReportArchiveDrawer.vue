<template>
  <el-drawer v-model="visible" title="报告归档" size="480px">
    <div v-if="groups.length" class="archive">
      <section v-for="group in groups" :key="group.date" class="archive__group">
        <header>{{ group.date }} · {{ group.items.length }} 份</header>
        <div v-for="report in group.items" :key="report.id" class="archive__item">
          <div class="archive__main">
            <strong>{{ report.title }}</strong>
            <span>{{ report.runName || report.batchId }} · {{ report.createdAt }}</span>
            <div class="archive__meta">
              <el-tag v-if="report.chapterPresetId" size="small" effect="plain">{{ presetName(report.chapterPresetId) }}</el-tag>
              <el-tag size="small" type="info" effect="plain">v{{ report.version || 1 }}</el-tag>
              <el-tag v-if="report.excellentCaseCitations?.length" size="small" type="warning" effect="plain">溯源 {{ report.excellentCaseCitations.length }}</el-tag>
            </div>
          </div>
          <div class="archive__ops">
            <el-button link type="primary" size="small" @click="viewReport(report)">查看</el-button>
            <el-button link type="danger" size="small" @click="removeReport(report)">删除</el-button>
          </div>
        </div>
      </section>
    </div>
    <el-empty v-else description="暂无报告归档" :image-size="80" />
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useReportStore } from '@/stores/report'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'view'])
const store = useReportStore()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const presetName = (id) => store.chapterPresets.find((p) => p.id === id)?.name || '—'

const groups = computed(() => {
  const map = new Map()
  store.reports.forEach((report) => {
    const date = String(report.createdAt || '').slice(0, 10) || '未记录日期'
    if (!map.has(date)) map.set(date, [])
    map.get(date).push(report)
  })
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items }))
})

const viewReport = (report) => {
  store.selectReport(report.id)
  emit('view', report)
}
const removeReport = async (report) => {
  try {
    await ElMessageBox.confirm(`删除报告「${report.title}」？`, '删除报告', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
    store.removeReport(report.id)
    ElMessage.success('报告已删除')
  } catch {}
}
</script>

<style scoped>
.archive { display: flex; flex-direction: column; gap: 14px; }
.archive__group { display: flex; flex-direction: column; gap: 8px; }
.archive__group header { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 600; }
.archive__item { display: flex; justify-content: space-between; gap: 10px; padding: 11px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }
.archive__main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.archive__main strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.archive__main > span { color: var(--el-text-color-secondary); font-size: 11px; }
.archive__meta { display: flex; flex-wrap: wrap; gap: 5px; }
.archive__ops { display: flex; flex-direction: column; justify-content: center; gap: 2px; flex-shrink: 0; }
</style>
