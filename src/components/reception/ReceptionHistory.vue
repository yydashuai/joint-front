<template>
  <div class="recv-history">
    <!-- 统计概览 -->
    <el-card shadow="never" class="exec-card recv-card">
      <div class="history-metrics">
        <div class="metric"><span class="metric__value">{{ store.totalCount }}</span><span class="metric__label">总接收</span></div>
        <div class="metric"><span class="metric__value metric--ok">{{ store.okCount }}</span><span class="metric__label">正常</span></div>
        <div class="metric"><span class="metric__value metric--bad">{{ store.errorCount }}</span><span class="metric__label">异常</span></div>
        <div class="metric"><span class="metric__value metric--warn">{{ store.unparsedCount }}</span><span class="metric__label">无法解析</span></div>
        <div class="metric"><span class="metric__value">{{ store.forwardCount }}</span><span class="metric__label">已转发</span></div>
        <div class="metric"><span class="metric__value">{{ store.recvRate.toFixed(1) }}</span><span class="metric__label">速率(条/秒)</span></div>
      </div>
    </el-card>

    <!-- 操作栏 -->
    <div class="recv-toolbar">
      <div class="recv-toolbar__left">
        <el-select v-model="filterStatus" placeholder="筛选状态" clearable size="small" style="width: 130px;">
          <el-option label="全部" value="" />
          <el-option label="正常" value="ok" />
          <el-option label="异常" value="error" />
          <el-option label="无法解析" value="unparsed" />
          <el-option label="已转发" value="forwarded" />
        </el-select>
        <el-select v-model="filterInterface" placeholder="筛选接口" clearable size="small" style="width: 180px;">
          <el-option v-for="i in interfaces" :key="i" :label="i" :value="i" />
        </el-select>
        <el-button size="small" text :icon="Refresh" @click="selectAll">全选</el-button>
        <el-button size="small" text @click="selectedIds = []">清空</el-button>
      </div>
      <div class="recv-toolbar__right">
        <el-button size="small" :icon="Coin" :disabled="!selectedIds.length" @click="saveToDataset">保存勾选到数据集</el-button>
      </div>
    </div>

    <!-- 数据表 -->
    <el-table :data="filteredData" size="small" border height="100%" style="width: 100%;" @selection-change="onSelectionChange">
      <el-table-column type="selection" width="42" align="center" />
      <el-table-column type="index" width="50" align="center" label="#" />
      <el-table-column prop="time" label="时间" width="80" align="center" />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.verdict?.status === 'ok'" size="small" type="success" effect="plain">正常</el-tag>
          <el-tag v-else-if="row.verdict?.status === 'error'" size="small" type="danger" effect="plain">异常</el-tag>
          <el-tag v-else-if="row.verdict?.status === 'unparsed'" size="small" type="warning" effect="plain">未解析</el-tag>
          <el-tag v-else size="small" type="info" effect="plain">{{ row.kind }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="iface" label="接口" min-width="140" show-overflow-tooltip />
      <el-table-column prop="transport" label="传输类型" width="80" align="center" />
      <el-table-column label="报文摘要" min-width="200">
        <template #default="{ row }">
          <span class="mono hex-preview">{{ row.hex?.slice(0, 40) || '—' }}{{ row.hex?.length > 40 ? '…' : '' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="已保存" width="70" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.savedToDataset" size="small" type="success" effect="plain">是</el-tag>
          <span v-else class="text-ph">否</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 保存到数据集弹窗 -->
    <el-dialog v-model="saveDialogVisible" title="保存接收报文到数据集" width="540px" destroy-on-close>
      <el-alert :closable="false" type="info" :title="`将 ${selectedIds.length} 条报文保存到数据集`" class="save-alert" />
      <el-form label-width="120px" size="default">
        <el-form-item label="保存方式">
          <el-radio-group v-model="saveMode">
            <el-radio value="existing">已有数据集</el-radio>
            <el-radio value="new">新建数据集</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="saveMode === 'existing'" label="选择数据集">
          <el-select v-model="saveTargetId" filterable placeholder="选择数据集" style="width: 100%;">
            <el-option v-for="ds in tdStore.datasets" :key="ds.id" :label="ds.name" :value="ds.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="saveMode === 'new'" label="新数据集名称">
          <el-input v-model="newDatasetName" placeholder="如：接收异常报文数据集" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canSave" @click="confirmSave">确定保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Coin, Refresh } from '@element-plus/icons-vue'
import { useReceptionStore } from '@/stores/reception'
import { useTestDataStore } from '@/stores/testData'

const store = useReceptionStore()
const tdStore = useTestDataStore()

const filterStatus = ref('')
const filterInterface = ref('')
const selectedIds = ref([])

const interfaces = computed(() => [...new Set(store.recvQueue.filter(e => e.kind === 'recv').map(e => e.iface))])

const filteredData = computed(() => {
  let data = store.recvQueue.filter(e => e.kind === 'recv')
  if (filterStatus.value) data = data.filter(e => e.verdict?.status === filterStatus.value)
  if (filterInterface.value) data = data.filter(e => e.iface === filterInterface.value)
  return data
})

const onSelectionChange = (rows) => {
  selectedIds.value = rows.map(r => r.id)
}

const selectAll = () => {
  selectedIds.value = filteredData.value.map(r => r.id)
}

/* ---- 保存到数据集 ---- */
const saveDialogVisible = ref(false)
const saveMode = ref('existing')
const saveTargetId = ref(null)
const newDatasetName = ref('')

const canSave = computed(() => {
  if (!selectedIds.value.length) return false
  if (saveMode.value === 'existing') return !!saveTargetId.value
  return newDatasetName.value.trim().length > 0
})

const saveToDataset = () => {
  saveMode.value = 'existing'
  saveTargetId.value = tdStore.datasets[0]?.id || null
  newDatasetName.value = ''
  saveDialogVisible.value = true
}

const confirmSave = () => {
  const target = saveMode.value === 'existing'
    ? { datasetId: saveTargetId.value }
    : { newName: newDatasetName.value.trim() }
  const result = store.saveToDataset(selectedIds.value, target)
  if (!result) { ElMessage.warning('保存失败，请重试'); return }
  ElMessage.success(`已保存 ${result.saved} 条��文到数据集「${result.dataset.name}」`)
  saveDialogVisible.value = false
  selectedIds.value = []
}
</script>

<style scoped lang="scss">
.recv-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}
.recv-card { flex-shrink: 0; }
.history-metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}
.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 0;
  &__value {
    font-size: 22px;
    font-weight: 700;
    font-family: 'Consolas', 'Monaco', monospace;
  }
  &__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
.metric--ok { color: var(--el-color-success); }
.metric--bad { color: var(--el-color-danger); }
.metric--warn { color: var(--el-color-warning); }
.recv-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  &__left { display: flex; align-items: center; gap: 8px; }
  &__right { display: flex; align-items: center; gap: 8px; }
}
.text-ph { color: var(--el-text-color-placeholder); font-size: 12px; }
.mono { font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; }
.hex-preview { color: var(--el-text-color-secondary); }
.save-alert { margin-bottom: 12px; }
</style>
