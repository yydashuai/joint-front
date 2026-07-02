<template>
  <div class="page report-wizard">
    <!-- 顶部中央步骤导航：已完成步骤变绿、当前步蓝 -->
    <div class="rw-steps">
      <el-steps :active="step - 1" align-center finish-status="success" process-status="process">
        <el-step title="数据源" />
        <el-step title="报告设置" />
        <el-step title="素材" />
        <el-step title="生成报告" />
        <el-step title="查看结果" />
      </el-steps>
    </div>

    <!-- 步骤面板（v-show 保活，切换不丢状态） -->
    <div class="rw-body">
      <StepDataSource v-show="step === 1" :form="form" @next="step = 2" />
      <StepSettings v-show="step === 2" :form="form" @back="step = 1" @next="step = 3" />
      <StepMaterials v-show="step === 3" :materials="materials" @back="step = 2" @next="step = 4" />
      <StepGenerate
        v-show="step === 4"
        :form="form"
        :materials="materials"
        :regenerate-from-id="regenerateFromId"
        :auto-generate-tick="autoGenerateTick"
        @back="step = 3"
        @done="onGenerated"
      />
      <StepResult v-show="step === 5" @restart="restart" @regenerate="regenerateReport" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick } from 'vue'
import StepDataSource from '@/components/report/steps/StepDataSource.vue'
import StepSettings from '@/components/report/steps/StepSettings.vue'
import StepMaterials from '@/components/report/steps/StepMaterials.vue'
import StepGenerate from '@/components/report/steps/StepGenerate.vue'
import StepResult from '@/components/report/steps/StepResult.vue'

const step = ref(1)
const form = reactive({ runId: null, title: '', templateId: null })
const materials = reactive([])
const regenerateFromId = ref(null)
const autoGenerateTick = ref(0)

const restart = () => {
  regenerateFromId.value = null
  step.value = 1
}

const onGenerated = () => {
  regenerateFromId.value = null
  step.value = 5
}

const regenerateReport = async (report) => {
  if (!report) return
  form.runId = report.runId
  form.title = report.title
  form.templateId = report.templateId
  materials.splice(0, materials.length, ...(report.materials || []).map((m) => ({ ...m })))
  regenerateFromId.value = report.id
  step.value = 4
  await nextTick()
  autoGenerateTick.value += 1
}
</script>

<style scoped lang="scss">
.report-wizard { height: 100%; display: flex; flex-direction: column; min-height: 0; }

.rw-steps {
  flex-shrink: 0;
  max-width: 860px;
  margin: 4px auto 18px;
  width: 100%;
}

.rw-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
