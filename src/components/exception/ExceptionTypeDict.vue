<template>
  <div class="type-dict">
    <div class="type-head">
      <div>
        <strong>异常类型字典</strong>
        <span>关闭捕捉后，该类型仍会在执行页表现为失败，但不会进入异常台账。</span>
      </div>
      <el-button type="primary" :icon="Plus" @click="adding = true">新增类型</el-button>
    </div>

    <el-table :data="store.types" size="small" row-key="id">
      <el-table-column label="名称" prop="name" min-width="150" />
      <el-table-column label="来源" width="110">
        <template #default="{ row }">{{ sourceLabel(row.source) }}</template>
      </el-table-column>
      <el-table-column label="默认级别" width="110" align="center">
        <template #default="{ row }">
          <el-select v-model="row.defaultLevel" size="small" @change="store.updateType(row.id, { defaultLevel: row.defaultLevel })">
            <el-option label="高" value="高" />
            <el-option label="中" value="中" />
            <el-option label="低" value="低" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="捕捉" width="86" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.captureEnabled" @change="store.toggleType(row.id, row.captureEnabled)" />
        </template>
      </el-table-column>
      <el-table-column label="处置建议" min-width="320">
        <template #default="{ row }">
          <el-input v-model="row.suggestion" size="small" @blur="store.updateType(row.id, { suggestion: row.suggestion })" />
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="adding" title="新增异常类型" width="520px">
      <el-form label-width="92px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="来源">
          <el-select v-model="form.source" style="width: 100%;">
            <el-option v-for="item in EXC_SOURCES" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认级别">
          <el-radio-group v-model="form.defaultLevel">
            <el-radio-button value="高">高</el-radio-button>
            <el-radio-button value="中">中</el-radio-button>
            <el-radio-button value="低">低</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处置建议"><el-input v-model="form.suggestion" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adding = false">取消</el-button>
        <el-button type="primary" @click="confirm">保存类型</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { EXC_SOURCES, useExceptionStore } from '@/stores/exception'

const store = useExceptionStore()
const adding = ref(false)
const form = reactive({ name: '', source: 'execution', defaultLevel: '中', suggestion: '' })

const sourceLabel = (source) => EXC_SOURCES.find((item) => item.value === source)?.label || source
const confirm = () => {
  const item = store.addType(form)
  if (!item) {
    ElMessage.warning('请填写类型名称')
    return
  }
  Object.assign(form, { name: '', source: 'execution', defaultLevel: '中', suggestion: '' })
  adding.value = false
  ElMessage.success('异常类型已新增')
}
</script>

<style scoped lang="scss">
.type-dict { display: flex; flex-direction: column; gap: 12px; }
.type-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.type-head div { display: flex; flex-direction: column; gap: 3px; }
.type-head span { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
