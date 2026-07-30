<template>
  <div class="scheme-detail">
    <div class="sd-head">
      <div>
        <h3 class="sd-title">{{ scheme.name }}</h3>
        <div class="sd-meta">
          <el-tag size="small" type="info" effect="plain">{{ systemLabel }}</el-tag>
          <el-tag size="small" type="success" effect="plain">{{ scheme.datasetIds.length }} 个数据集</el-tag>
          <span v-if="scheme.remark" class="sd-remark">{{ scheme.remark }}</span>
        </div>
      </div>
      <div class="sd-ops">
        <el-button size="small" :icon="Edit" @click="emit('edit', scheme)">编辑方案</el-button>
        <el-popconfirm title="确认删除该数据集方案？" @confirm="emit('remove', scheme)">
          <template #reference>
            <el-button size="small" type="danger" :icon="Delete">删除</el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <el-divider content-position="left">方案内数据集</el-divider>

    <el-table :data="resolvedDatasets" size="small" border empty-text="方案内暂未包含数据集" class="sd-table">
      <el-table-column prop="name" label="数据集名称" min-width="160" show-overflow-tooltip />
      <el-table-column label="所属模块" width="140" show-overflow-tooltip>
        <template #default="{ row }"><span class="text-secondary">{{ row.moduleName }}</span></template>
      </el-table-column>
      <el-table-column label="数据行" width="90" align="center">
        <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.rows.length }}</el-tag></template>
      </el-table-column>
      <el-table-column label="关联报文" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.linkedInterface" class="text-secondary">{{ row.linkedInterface }}</span>
          <span v-else-if="row.linkedProtocol" class="text-secondary">{{ row.linkedProtocol }}</span>
          <span v-else class="text-ph">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button text type="primary" size="small" :icon="View" @click="emit('open-dataset', row.id)">打开</el-button>
          <el-button text type="danger" size="small" :icon="Delete" @click="emit('remove-dataset', row.id)">移出</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Edit, Delete, View } from '@element-plus/icons-vue'
import { useTestDataStore } from '@/stores/testData'
import { useSystemStore } from '@/stores/system'

const props = defineProps({ scheme: { type: Object, required: true } })
const emit = defineEmits(['edit', 'remove', 'open-dataset', 'remove-dataset'])

const tdStore = useTestDataStore()
const systemStore = useSystemStore()

const resolvedDatasets = computed(() =>
  props.scheme.datasetIds
    .map((id) => tdStore.datasets.find((d) => d.id === id))
    .filter(Boolean)
)

const systemLabel = computed(() => {
  if (!props.scheme.systemId) return '全部系统（通用）'
  return systemStore.systems.find((s) => s.id === props.scheme.systemId)?.name || String(props.scheme.systemId)
})
</script>

<style scoped lang="scss">
.scheme-detail { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; overflow: auto; }
.sd-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.sd-title { margin: 0; font-size: 16px; font-weight: 600; }
.sd-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.sd-remark { font-size: 12px; color: var(--el-text-color-secondary); }
.sd-ops { display: flex; gap: 8px; flex-shrink: 0; }
.sd-table { width: 100%; }
.text-secondary { color: var(--el-text-color-secondary); font-size: 12px; }
.text-ph { color: var(--el-text-color-placeholder); }
</style>
