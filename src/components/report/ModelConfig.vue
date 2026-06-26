<template>
  <el-card class="mc" shadow="never" :body-style="{ padding: '24px', flex: '1', minHeight: '0', overflow: 'auto' }">
    <template #header><div class="card-head"><span>模型配置</span><span class="muted">大模型 + 嵌入模型，用于报告生成与知识向量化</span></div></template>

    <div class="mc__wrap">
      <div class="mc__grid">
        <section class="mc-panel">
          <div class="mc-panel__title">服务接入</div>
          <el-form :model="cfg" label-width="110px" class="mc__form">
            <el-form-item label="模型服务">
              <el-radio-group v-model="cfg.provider" @change="onProvider">
                <el-radio-button value="api">在线 API</el-radio-button>
                <el-radio-button value="local">本地部署</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="接口地址">
              <el-input v-model="cfg.baseUrl" placeholder="如 https://api.example.com/v1" />
            </el-form-item>
            <el-form-item v-if="cfg.provider === 'api'" label="API Key">
              <el-input v-model="cfg.apiKey" type="password" show-password placeholder="sk-..." />
            </el-form-item>
            <el-form-item label="生成模型">
              <el-input v-model="cfg.modelName" placeholder="填写生成模型名称" />
            </el-form-item>
            <el-form-item label="嵌入模型">
              <el-input v-model="cfg.embeddingModel" placeholder="填写嵌入模型名称">
                <template #append>知识向量化用</template>
              </el-input>
            </el-form-item>
            <el-form-item label="连接状态">
              <div class="conn">
                <el-button :icon="Connection" :loading="cfg.connection === 'testing'" @click="test">连接测试</el-button>
                <el-tag v-if="cfg.connection === 'ok'" type="success" effect="light"><el-icon><CircleCheck /></el-icon> 连接正常</el-tag>
                <el-tag v-else-if="cfg.connection === 'fail'" type="danger" effect="light"><el-icon><CircleClose /></el-icon> 连接失败</el-tag>
                <span v-else class="muted">未测试</span>
              </div>
            </el-form-item>
          </el-form>
        </section>
      </div>

      <el-alert type="info" :closable="false" show-icon class="mc__note">
        <template #title>静态设计说明</template>
        报告生成调用在线 / 本地大模型接口，知识向量化使用嵌入模型。当前为前端静态演示，真实生成对接后端报告服务。
      </el-alert>
    </div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const store = useReportStore()
const cfg = computed(() => store.modelConfig)

const onProvider = (p) => {
  cfg.value.baseUrl = p === 'api' ? 'https://api.example.com/v1' : 'http://localhost:11434'
  cfg.value.connection = null
}
const test = async () => {
  const ok = await store.testConnection()
  ok ? ElMessage.success('连接正常') : ElMessage.error('连接失败：请检查模型名 / 接口地址')
}
</script>

<style scoped lang="scss">
.mc { flex: 1; min-height: 0; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 400; }
.mc__wrap { max-width: 680px; }
.mc__grid {
  display: grid;
  grid-template-columns: minmax(320px, 1fr);
  gap: 14px;
}
.mc-panel {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}
.mc-panel__title {
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
  font-weight: 650;
}
.conn { display: flex; align-items: center; gap: 12px; }
.conn .el-tag { display: inline-flex; align-items: center; gap: 4px; }
.mc__note { margin-top: 14px; code { color: var(--el-color-primary); } }
</style>
