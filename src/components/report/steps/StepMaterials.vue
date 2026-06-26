<template>
  <div class="step">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="blk__title">
          <span class="blk__title-l"><el-icon><PictureFilled /></el-icon> 素材（可选 · 生成时回填到报告）</span>
          <el-upload :auto-upload="false" :show-file-list="false" accept="image/*,.xlsx,.xls,.csv" multiple :on-change="onPick">
            <el-button type="primary" plain :icon="Upload">上传图片 / 表格</el-button>
          </el-upload>
        </div>

        <el-form v-if="materials.length" label-position="left" label-width="72px" class="mat-form">
          <div v-for="(m, i) in materials" :key="i" class="mat-card">
            <div class="mat-card__preview">
              <img v-if="m.type === 'image' && m.url" :src="m.url" alt="" class="mat-card__img" />
              <div v-else-if="m.type === 'table' && m.rows" class="mat-card__table">
                <table>
                  <tr v-for="(row, ri) in m.rows" :key="ri">
                    <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                  </tr>
                </table>
              </div>
              <div v-else class="mat-card__thumb" :class="`mat-card__thumb--${m.type}`">
                <el-icon><component :is="m.type === 'image' ? 'Picture' : 'Grid'" /></el-icon>
              </div>
            </div>
            <div class="mat-card__fields">
              <el-form-item label="素材名称"><el-input v-model="m.name" /></el-form-item>
              <el-form-item label="用途说明"><el-input v-model="m.note" placeholder="例如：插入到「联试概述」章节" /></el-form-item>
            </div>
            <el-button class="mat-card__del" text :icon="Delete" @click="materials.splice(i, 1)" />
          </div>
        </el-form>
        <el-empty v-else description="暂无素材，可上传拓扑图 / 截图 / 统计表等需人工提供的内容" :image-size="90" />
      </div>
    </el-scrollbar>

    <div class="step__foot">
      <el-button :icon="ArrowLeft" @click="$emit('back')">上一步</el-button>
      <el-button type="primary" :icon="ArrowRight" @click="$emit('next')">下一步：生成报告</el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { PictureFilled, Upload, Delete, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = defineProps({ materials: { type: Array, required: true } })
defineEmits(['back', 'next'])

const IMG = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']

const onPick = (file) => {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const type = IMG.includes(ext) ? 'image' : 'table'
  const url = type === 'image' && file.raw ? URL.createObjectURL(file.raw) : ''
  props.materials.push({ name: file.name, type, note: '', url })
}

// 默认数据填充：两条图片示例 + 一条表格示例（含示例数据，便于查看预览）
onMounted(() => {
  if (!props.materials.length) {
    props.materials.push(
      { name: '系统拓扑图.png', type: 'image', note: '插入到「联试概述」章节', url: '' },
      { name: '延迟分布图.png', type: 'image', note: '插入到「关键指标」章节', url: '' },
      {
        name: '服务成功率统计表.xlsx', type: 'table', note: '插入到「接口测试结果」章节', url: '',
        rows: [
          ['服务', '成功率', '平均延迟'],
          ['任务分配服务', '99.8%', '98 ms'],
          ['武器载荷服务', '93.9%', '187 ms'],
          ['情报融合服务', '99.8%', '203 ms']
        ]
      }
    )
  }
})
</script>

<style scoped lang="scss">
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.step__scroll { flex: 1; min-height: 0; }
.step__inner { max-width: 720px; margin: 0 auto; padding: 4px 4px 48px; }

.blk__title {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px;
  font-size: 14px; font-weight: 600;
}
.blk__title-l { display: flex; align-items: center; gap: 6px; .el-icon { color: var(--el-color-primary); } }

.mat-form { display: flex; flex-direction: column; gap: 12px; }
.mat-card {
  display: flex; gap: 16px; align-items: center; padding: 14px;
  border: 1px solid var(--el-border-color-lighter); border-radius: 10px; background: var(--el-bg-color);
}
.mat-card__preview {
  flex-shrink: 0; width: 160px; min-height: 92px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.mat-card__img { width: 120px; height: 92px; object-fit: cover; border-radius: 8px; }
.mat-card__thumb {
  width: 120px; height: 92px; border-radius: 8px; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 34px;
  &--image { background: linear-gradient(135deg, #4a6bdf, #8b5cf6); }
  &--table { background: linear-gradient(135deg, #10b981, #059669); }
}
.mat-card__table {
  width: 100%; max-width: 160px;
  table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11px; }
  td {
    border: 1px solid var(--el-border-color-lighter); padding: 3px 5px; color: var(--el-text-color-regular);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  tr:first-child td { background: var(--el-color-primary-light-9); color: var(--el-color-primary); font-weight: 600; }
}
.mat-card__fields { flex: 1; min-width: 0; }
.mat-card__fields :deep(.el-form-item) { margin-bottom: 8px; &:last-child { margin-bottom: 0; } }
.mat-card__del { flex-shrink: 0; align-self: flex-start; margin-left: auto; color: var(--el-text-color-placeholder); &:hover { color: var(--el-color-danger); } }

.step__foot {
  position: absolute; right: 6px; bottom: 6px; z-index: 5;
  display: flex; align-items: center; gap: 12px;
}
</style>
