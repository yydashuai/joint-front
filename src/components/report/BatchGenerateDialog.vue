<template>
  <el-dialog v-model="visible" title="批量生成报告" width="760px" :close-on-click-modal="false">
    <el-form label-width="84px">
      <el-form-item label="选择批次">
        <el-table :data="batchStore.batches" height="220" size="small" border @selection-change="onSelectionChange">
          <el-table-column type="selection" width="40" />
          <el-table-column prop="name" label="批次" min-width="180" show-overflow-tooltip />
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.batchType === 'receive' ? 'success' : 'primary'" effect="plain">{{ row.batchType === 'receive' ? '接收' : '发送' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="范围" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.scope?.displayName || '—' }}</template>
          </el-table-column>
          <el-table-column prop="startedAt" label="时间" width="150" show-overflow-tooltip />
        </el-table>
      </el-form-item>
      <el-form-item label="章节方案">
        <el-radio-group v-model="chapterPresetId">
          <el-radio-button v-for="p in store.chapterPresets" :key="p.id" :value="p.id">{{ p.name }}</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="标题前缀">
        <el-input v-model="titlePrefix" placeholder="可选，如：2026-Q3 交付（支持 {{batchName}} {{scopeName}} 变量）" />
      </el-form-item>
    </el-form>

    <div v-if="store.generating" class="batch-progress">
      <el-progress :percentage="pct" :stroke-width="10" status="success" />
      <span>正在生成第 {{ currentIndex }} / {{ totalCount }} 份报告…</span>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="store.generating" :disabled="!selectedIds.length" @click="runBatch">
        批量生成 {{ selectedIds.length }} 份
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useReportStore } from '@/stores/report'
import { useRunBatchStore } from '@/stores/runBatch'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'done'])
const store = useReportStore()
const batchStore = useRunBatchStore()
const authStore = useAuthStore()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})
const chapterPresetId = ref('cp-standard')
const titlePrefix = ref('')
const selectedIds = ref([])
const currentIndex = ref(0)
const totalCount = ref(0)

const onSelectionChange = (rows) => { selectedIds.value = rows.map((r) => r.id) }
const pct = computed(() => {
  if (!totalCount.value) return 0
  return Math.round(((store.genStage + 1) / Math.max(totalCount.value, 1)) * 100)
})

const runBatch = async () => {
  const ids = selectedIds.value
  totalCount.value = ids.length
  const results = await store.generateBatch({
    batchIds: ids,
    chapterPresetId: chapterPresetId.value,
    titlePrefix: titlePrefix.value,
    generatorName: authStore.currentUser?.realName || authStore.currentUser?.username || '当前用户',
  })
  currentIndex.value = results.length
  if (results.length) {
    ElMessage.success(`已生成 ${results.length} 份报告，可在「报告归档」中查看`)
    emit('done', results)
    selectedIds.value = []
    titlePrefix.value = ''
  }
}
</script>

<style scoped>
.batch-progress { margin-top: 10px; padding: 12px; border-radius: 8px; background: var(--el-fill-color-light); }
.batch-progress span { display: block; margin-top: 6px; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
