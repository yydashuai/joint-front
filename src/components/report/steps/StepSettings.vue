<template>
  <div class="step">
    <el-scrollbar class="step__scroll">
      <div class="step__inner">
        <div class="step-head">
          <div>
            <div class="blk__title"><el-icon><Setting /></el-icon> 报告设置</div>
          </div>
          <div class="step-actions">
            <el-button :icon="ArrowLeft" @click="$emit('back')">上一步</el-button>
            <el-button type="primary" :icon="ArrowRight" @click="$emit('next')">下一步</el-button>
          </div>
        </div>
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
          <div v-if="tpl" class="tplp__paper" :class="`tplp__paper--${templatePreview.tone}`">
            <div class="tplp__doc-title">{{ tpl.name }}</div>
            <div class="tplp__doc-sub">{{ templatePreview.desc }}</div>
            <div class="tplp__meta">
              <span v-for="item in templatePreview.meta" :key="item">{{ item }}</span>
            </div>
            <div v-for="s in templatePreview.sections" :key="s.title" class="tplp__sec">
              <div class="tplp__h2">{{ s.title }}</div>
              <div class="tplp__ph" :class="{ 'is-data': s.data, 'is-media': s.media }">{{ s.ph }}</div>
            </div>
          </div>
          <el-empty v-else description="请选择或上传一个 DOCX 模板以预览结构" :image-size="80" />
        </el-card>
      </div>
    </el-scrollbar>

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

const PREVIEWS = {
  standard: {
    tone: 'standard',
    desc: '面向一次独立发送或接收批次，强调数据来源、规模、接口明细与归档说明。',
    meta: ['适用：批次归档', '占位符：方案 / 接口', '素材：拓扑图、数据表'],
    sections: [
      { title: '一、批次概述', ph: '说明方案或接口范围、批次类型、时间窗口与完成方式。' },
      { title: '二、批次规模', ph: '[ 数据表 · 发送或接收数量 / 接口覆盖 / 数据留存 ]', data: true },
      { title: '三、接口明细', ph: '[ 接口记录表 · 由所选批次数据自动填充 ]', data: true },
      { title: '四、数据说明', ph: '发送批次说明未发送数据；接收批次说明异常数据样本。' },
      { title: '五、归档与复用', ph: '说明批次归档结果与后续数据复用建议。' }
    ]
  },
  anomaly: {
    tone: 'anomaly',
    desc: '面向接收异常数据归档，呈现样本分布、原始数据和可复用情况。',
    meta: ['适用：异常数据归档', '占位符：异常接口 / 数据样本', '素材：原始报文、异常表'],
    sections: [
      { title: '一、异常数据摘要', ph: '汇总异常数量、类型、集中接口与首次捕获时间。' },
      { title: '二、异常接口清单', ph: '[ 异常明细表 · 接口 / 时间 / 类型 / 规则命中 ]', data: true },
      { title: '三、样本内容说明', ph: '说明原始报文、异常字段和解析结果。' },
      { title: '四、数据保存情况', ph: '记录已保存的数据集和可继续修改的样本。', media: true },
      { title: '五、复用建议', ph: '说明哪些样本可用于后续独立发送测试。' }
    ]
  },
  archive: {
    tone: 'archive',
    desc: '面向归档交付，强化签署信息、素材索引、数据来源和版本留痕。',
    meta: ['适用：归档移交', '占位符：签署人 / 版本号', '素材：附件目录、图表索引'],
    sections: [
      { title: '封面与签署页', ph: '项目名称、批次来源、报告生成者、版本与签署日期。' },
      { title: '一、数据来源说明', ph: '列出联试批次、方案或接口范围、测试窗口和完成方式。' },
      { title: '二、结果汇总', ph: '[ 归档汇总表 · 指标 / 接口 / 异常 / 附件编号 ]', data: true },
      { title: '三、素材与附件索引', ph: '[table: 素材用途清单]，并回填图片、表格与日志附件位置。', media: true },
      { title: '四、交付结论', ph: '归档结论、遗留问题、后续责任人与跟踪节点。' }
    ]
  }
}

const templatePreview = computed(() => {
  const name = tpl.value?.name || ''
  if (name.includes('异常')) return PREVIEWS.anomaly
  if (name.includes('归档') || name.includes('交付')) return PREVIEWS.archive
  return PREVIEWS.standard
})

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
.step__inner { max-width: 820px; margin: 0 auto; padding: 4px 4px 48px; }
.w-full { width: 100%; }

.step-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px;
}
.step-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.blk__title {
  display: flex; align-items: center; gap: 6px; margin-bottom: 4px;
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
.tplp__paper--anomaly { background: linear-gradient(180deg, #fff, #fff7ed); border-color: #fed7aa; }
.tplp__paper--archive { background: linear-gradient(180deg, #fff, #f8fafc); border-color: #cbd5e1; }
.tplp__doc-title { text-align: center; font-size: 20px; font-weight: 700; padding-bottom: 8px; border-bottom: 2px solid var(--el-color-primary); }
.tplp__doc-sub { text-align: center; font-size: 12px; color: var(--el-text-color-secondary); margin: 6px 0 18px; }
.tplp__meta {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 18px;
  span { font-size: 12px; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px; padding: 3px 10px; }
}
.tplp__sec { margin-bottom: 14px; }
.tplp__h2 { font-size: 15px; font-weight: 600; color: #1e3a8a; border-left: 3px solid var(--el-color-primary); padding-left: 8px; margin-bottom: 6px; }
.tplp__ph {
  font-size: 13px; color: var(--el-text-color-secondary); line-height: 1.7; padding-left: 11px;
  &.is-data { color: var(--el-color-primary); background: var(--el-color-primary-light-9); border-radius: 4px; padding: 4px 11px; display: inline-block; }
  &.is-media { color: #b45309; background: #fffbeb; border-radius: 4px; padding: 4px 11px; display: inline-block; }
}

@media (max-width: 720px) {
  .step-head { flex-direction: column; }
  .step-actions { width: 100%; justify-content: flex-end; }
  .tpl-row { flex-direction: column; }
}
</style>
