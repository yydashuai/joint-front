<template>
  <div class="step">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="blk__title"><el-icon><Setting /></el-icon> 报告设置</div>
        <el-form label-width="76px" label-position="left">
          <el-form-item label="报告标题"><el-input v-model="form.title" placeholder="留空自动命名" /></el-form-item>
          <el-form-item label="报告模板">
            <div class="tpl-row">
              <el-select v-model="form.templateId" placeholder="选择 DOCX 模板" class="w-full">
                <el-option v-for="t in templates" :key="t.id" :label="t.name" :value="t.id" />
              </el-select>
              <el-upload :auto-upload="false" :show-file-list="false" accept=".docx" :on-change="onTemplatePick">
                <el-button :icon="Upload">上传新模板</el-button>
              </el-upload>
            </div>
          </el-form-item>
        </el-form>

        <!-- 大卡片：模板预览 -->
        <el-card shadow="never" class="tpl-preview">
          <template #header>
            <div class="tplp__head">
              <span class="tplp__head-l"><el-icon><Document /></el-icon> 模板预览</span>
              <span v-if="tpl" class="muted">{{ tpl.fileName }} · {{ tpl.size }} · {{ tpl.uploadedAt }}</span>
            </div>
          </template>
          <div v-if="tpl" class="tplp__paper">
            <div class="tplp__doc-title">{{ tpl.name }}</div>
            <div class="tplp__doc-sub">DOCX 模板结构预览 · 生成时按所选批次数据回填</div>
            <div v-for="s in SKELETON" :key="s.title" class="tplp__sec">
              <div class="tplp__h2">{{ s.title }}</div>
              <div class="tplp__ph" :class="{ 'is-data': s.data }">{{ s.ph }}</div>
            </div>
          </div>
          <el-empty v-else description="请选择或上传一个 DOCX 模板以预览结构" :image-size="80" />
        </el-card>
      </div>
    </el-scrollbar>

    <div class="step__foot">
      <el-button :icon="ArrowLeft" @click="$emit('back')">上一步</el-button>
      <el-button type="primary" :icon="ArrowRight" @click="$emit('next')">下一步</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { Setting, Upload, Document, ArrowLeft, ArrowRight } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const props = defineProps({ form: { type: Object, required: true } })
defineEmits(['back', 'next'])

const store = useReportStore()
const templates = computed(() => store.templates)
const tpl = computed(() => store.templates.find((t) => t.id === props.form.templateId) || null)

// 模板章节骨架（占位预览，data=由联试数据确定性回填的硬数据章节）
const SKELETON = [
  { title: '一、联试概述', ph: '本次联试针对 XX 系统开展全流程接口联试……（生成时填充概述）' },
  { title: '二、关键指标', ph: '[ 指标统计表 · 由所选批次数据自动填充 ]', data: true },
  { title: '三、接口测试结果', ph: '[ 接口结果表 · 由所选批次数据自动填充 ]', data: true },
  { title: '四、异常分析', ph: '异常成因与影响分析……（生成时填充）' },
  { title: '五、结论与建议', ph: '联试结论与改进建议……（生成时填充）' }
]

const sizeText = (bytes) => (bytes ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '—')
const onTemplatePick = (file) => {
  const t = store.addTemplate({ name: file.name, size: sizeText(file.size) })
  props.form.templateId = t.id
}

onMounted(() => {
  if (!props.form.templateId) props.form.templateId = templates.value[0]?.id || null
})
</script>

<style scoped lang="scss">
.step { position: relative; height: 100%; display: flex; flex-direction: column; min-height: 0; }
.step__scroll { flex: 1; min-height: 0; }
.step__inner { max-width: 720px; margin: 0 auto; padding: 4px 4px 48px; }
.w-full { width: 100%; }

.blk__title {
  display: flex; align-items: center; gap: 6px; margin-bottom: 12px;
  font-size: 14px; font-weight: 600; .el-icon { color: var(--el-color-primary); }
}
.tpl-row { display: flex; gap: 10px; width: 100%; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 400; }

.tpl-preview { margin-top: 6px; }
.tplp__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tplp__head-l { display: flex; align-items: center; gap: 6px; font-weight: 600; .el-icon { color: var(--el-color-primary); } }

.tplp__paper {
  background: #fff; border: 1px solid var(--el-border-color-lighter); border-radius: 8px;
  padding: 28px 32px; color: #1f2937; box-shadow: inset 0 1px 0 rgba(0, 0, 0, .02);
}
.tplp__doc-title { text-align: center; font-size: 20px; font-weight: 700; padding-bottom: 8px; border-bottom: 2px solid var(--el-color-primary); }
.tplp__doc-sub { text-align: center; font-size: 12px; color: var(--el-text-color-secondary); margin: 6px 0 18px; }
.tplp__sec { margin-bottom: 14px; }
.tplp__h2 { font-size: 15px; font-weight: 600; color: #1e3a8a; border-left: 3px solid var(--el-color-primary); padding-left: 8px; margin-bottom: 6px; }
.tplp__ph {
  font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.7; padding-left: 11px;
  &.is-data { color: var(--el-color-primary); background: var(--el-color-primary-light-9); border-radius: 4px; padding: 4px 11px; display: inline-block; }
}

.step__foot {
  position: absolute; right: 6px; bottom: 6px; z-index: 5;
  display: flex; align-items: center; gap: 12px;
}
</style>
