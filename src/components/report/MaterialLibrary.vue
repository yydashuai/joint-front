<template>
  <div v-if="!props.module" class="empty-pick">
    <el-empty description="请在左侧选择一个模块，管理该模块的素材" :image-size="90" />
  </div>
  <el-card v-else class="mat" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
    <template #header>
      <div class="card-head">
        <span>素材库 <span class="muted">· {{ props.module.name }} · 图表 / 表格 / 图片</span></span>
        <el-button type="primary" size="small" :icon="Upload" @click="addMaterial">上传素材</el-button>
      </div>
    </template>
    <el-scrollbar class="mat__scroll">
      <div class="mat__grid">
        <div v-for="m in mats" :key="m.id" class="mcard">
          <div class="mcard__thumb" :class="`mcard__thumb--${m.type}`">
            <el-icon><component :is="m.type === 'image' ? 'Picture' : 'Grid'" /></el-icon>
          </div>
          <div class="mcard__name" :title="m.name">{{ m.name }}</div>
          <div class="mcard__meta">{{ m.type === 'image' ? '图片' : '表格' }} · {{ m.size }}</div>
          <div class="mcard__foot">
            <span class="mcard__time">{{ m.addedAt }}</span>
            <el-popconfirm title="删除该素材？" @confirm="store.removeMaterial(m.id)">
              <template #reference><el-button size="small" text :icon="Delete" @click.stop /></template>
            </el-popconfirm>
          </div>
        </div>
        <div class="mcard mcard--add" @click="addMaterial">
          <el-icon class="mcard--add__icon"><Plus /></el-icon>
          <span>上传素材</span>
        </div>
      </div>
      <el-empty v-if="!mats.length" description="该模块暂无素材" :image-size="70" />
    </el-scrollbar>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Delete, Plus } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const props = defineProps({ module: { type: Object, default: null } })
const store = useReportStore()
const moduleId = computed(() => props.module?.id ?? null)
const mats = computed(() => (props.module ? store.materialsOfModule(moduleId.value) : []))

const IMG = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
const addMaterial = () => {
  ElMessageBox.prompt(`上传到「${props.module.name}」（演示用，实际为上传文件）`, '上传素材', {
    inputValue: '统计图.png', confirmButtonText: '上传', cancelButtonText: '取消'
  }).then(({ value }) => {
    const name = (value || '').trim() || '素材.png'
    const ext = name.split('.').pop().toLowerCase()
    const type = IMG.includes(ext) ? 'image' : 'table'
    store.addMaterial({ name, type, moduleId: moduleId.value, size: `${Math.round(20 + Math.random() * 180)} KB` })
    ElMessage.success(`已上传「${name}」`)
  }).catch(() => {})
}
</script>

<style scoped lang="scss">
.empty-pick { height: 100%; display: flex; align-items: center; justify-content: center; }
.mat { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 400; }
.mat__scroll { flex: 1; min-height: 0; }
.mat__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 14px; padding: 16px; }
.mcard {
  border: 1px solid var(--el-border-color-lighter); border-radius: 10px; overflow: hidden;
  display: flex; flex-direction: column; transition: box-shadow .15s;
  &:hover { box-shadow: 0 4px 14px rgba(0, 0, 0, .08); }
}
.mcard__thumb {
  height: 90px; display: flex; align-items: center; justify-content: center; font-size: 34px; color: #fff;
  &--image { background: linear-gradient(135deg, #4a6bdf, #8b5cf6); }
  &--table { background: linear-gradient(135deg, #10b981, #059669); }
}
.mcard__name { font-size: 13px; font-weight: 600; padding: 8px 10px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mcard__meta { font-size: 11px; color: var(--el-text-color-secondary); padding: 2px 10px; }
.mcard__foot { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px 8px 10px; }
.mcard__time { font-size: 11px; color: var(--el-text-color-placeholder); }
.mcard--add {
  border-style: dashed; cursor: pointer; align-items: center; justify-content: center; gap: 6px;
  color: var(--el-text-color-secondary); min-height: 150px;
  &:hover { color: var(--el-color-primary); border-color: var(--el-color-primary); }
  &__icon { font-size: 26px; }
}
</style>
