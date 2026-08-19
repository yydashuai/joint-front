<template>
  <div class="page knowledge-model">
    <div class="page__header">
      <div>
        <h2>知识模型管理</h2>
      </div>
      <div class="header-actions">
        <!-- K4：模型配置入口（演示仅保存参数，不真实调用） -->
        <el-button :icon="Setting" @click="configVisible = true">模型配置</el-button>
      </div>
    </div>

    <div class="km-body">
      <KnowledgeBase />
    </div>

    <el-dialog v-model="configVisible" title="知识模型配置" width="560px">
      <el-form label-width="120px" size="small">
        <el-form-item label="接入方式">
          <el-radio-group v-model="store.modelConfig.provider">
            <el-radio value="api">API 服务</el-radio>
            <el-radio value="ollama">本地 Ollama</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="服务地址">
          <el-input v-model="store.modelConfig.baseUrl" placeholder="https://api.example.com/v1" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="store.modelConfig.apiKey" type="password" show-password placeholder="sk-..." />
        </el-form-item>
        <el-form-item label="对话模型">
          <el-input v-model="store.modelConfig.modelName" placeholder="your-chat-model" />
        </el-form-item>
        <el-form-item label="向量模型">
          <el-input v-model="store.modelConfig.embeddingModel" placeholder="your-embed-model" />
        </el-form-item>
        <el-form-item label="温度">
          <el-slider v-model="store.modelConfig.temperature" :min="0" :max="1" :step="0.1" show-input style="width: 240px" />
        </el-form-item>
        <el-form-item label="最大输出 Token">
          <el-input-number v-model="store.modelConfig.maxTokens" :min="256" :max="16384" :step="256" controls-position="right" />
        </el-form-item>
        <el-form-item label="检索 TopK">
          <el-input-number v-model="store.modelConfig.retrievalTopK" :min="1" :max="20" controls-position="right" />
        </el-form-item>
        <el-form-item label="检索权重">
          <div class="weight-row">
            <span>关键词</span><el-input-number v-model="store.modelConfig.keywordWeight" :min="0" :max="1" :step="0.1" controls-position="right" size="small" />
            <span>向量</span><el-input-number v-model="store.modelConfig.vectorWeight" :min="0" :max="1" :step="0.1" controls-position="right" size="small" />
          </div>
        </el-form-item>
        <el-form-item label="连接状态">
          <el-tag v-if="store.modelConfig.connection === 'ok'" type="success" size="small">连接正常</el-tag>
          <el-tag v-else-if="store.modelConfig.connection === 'fail'" type="danger" size="small">连接失败</el-tag>
          <el-tag v-else-if="store.modelConfig.connection === 'testing'" type="warning" size="small">测试中…</el-tag>
          <span v-else class="muted">未测试</span>
          <el-button link type="primary" size="small" @click="testConnection">测试连接</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configVisible = false">关闭</el-button>
        <el-button type="primary" @click="configVisible = false">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Setting } from '@element-plus/icons-vue'
import KnowledgeBase from '@/components/report/KnowledgeBase.vue'
import { useReportStore } from '@/stores/report'

const store = useReportStore()
const configVisible = ref(false)

const testConnection = async () => {
  const ok = await store.testConnection()
  ElMessage[ok ? 'success' : 'error'](ok ? '连接测试通过' : '连接失败，请检查服务地址与模型名称')
}
</script>

<style scoped lang="scss">
.knowledge-model {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.header-actions { display: flex; gap: 8px; }
.km-body {
  flex: 1;
  min-height: 0;
}
.weight-row { display: flex; align-items: center; gap: 8px; color: var(--el-text-color-secondary); font-size: 12px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
