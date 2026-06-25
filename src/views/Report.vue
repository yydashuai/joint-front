<template>
  <div class="page report">
    <div class="page__header">
      <div>
        <h2>联试报告管理</h2>
        <div class="page__desc">RAG 增强的智能报告生成 · 知识库 / 模板 / 素材 按模块分类管理</div>
      </div>
      <div class="header-actions">
        <el-tag type="info" effect="plain" round>
          当前模块：{{ selectedModule ? `${systemName(selectedModule.systemId)} / ${selectedModule.name}` : '未选择' }}
        </el-tag>
      </div>
    </div>

    <div class="split">
      <!-- 左：系统 → 模块 分类树 -->
      <SystemModuleTree
        class="report-tree"
        :model-value="selectedModule ? `mod-${selectedModule.id}` : ''"
        title="系统 · 模块"
        show-edit-jump
        empty-text="暂无系统/模块，请先在链路连接管理添加"
        @select="onTreeSelect"
      />

      <!-- 右：按模块归类的报告资源 -->
      <div class="report-right">
        <el-tabs v-model="tab" class="report-tabs">
          <el-tab-pane name="workbench" label="🪄 生成工作台" lazy>
            <GenerateWorkbench :module="selectedModule" />
          </el-tab-pane>
          <el-tab-pane name="knowledge" label="📚 知识库" lazy>
            <KnowledgeBase :module="selectedModule" />
          </el-tab-pane>
          <el-tab-pane name="template" label="📄 模板库" lazy>
            <TemplateLibrary :module="selectedModule" />
          </el-tab-pane>
          <el-tab-pane name="material" label="🖼 素材库" lazy>
            <MaterialLibrary :module="selectedModule" />
          </el-tab-pane>
          <el-tab-pane name="model" label="⚙ 模型配置" lazy>
            <ModelConfig />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useConnectionStore } from '@/stores/connection'
import SystemModuleTree from '@/components/SystemModuleTree.vue'
import GenerateWorkbench from '@/components/report/GenerateWorkbench.vue'
import KnowledgeBase from '@/components/report/KnowledgeBase.vue'
import TemplateLibrary from '@/components/report/TemplateLibrary.vue'
import MaterialLibrary from '@/components/report/MaterialLibrary.vue'
import ModelConfig from '@/components/report/ModelConfig.vue'

const systemStore = useSystemStore()
const connStore = useConnectionStore()
const tab = ref('workbench')

const systemName = (id) => systemStore.systems.find((s) => s.id === id)?.name || '未分配'

// 当前选中模块（知识库/模板/素材/生成 都以此归类）
const selectedModule = ref(connStore.modulesOf(systemStore.currentId)[0] || null)
const onTreeSelect = (node) => {
  if (node.kind === 'module' && node.ref) selectedModule.value = node.ref
}
// 切换全局被测系统后，若当前模块不在可见范围则重选首个
watch(
  () => systemStore.currentId,
  () => {
    const visible = connStore.modulesOf(systemStore.currentId)
    if (!selectedModule.value || !visible.some((m) => m.id === selectedModule.value.id)) {
      selectedModule.value = visible[0] || null
    }
  }
)
</script>

<style scoped lang="scss">
.report { height: 100%; display: flex; flex-direction: column; }
.header-actions { display: flex; align-items: center; gap: 12px; }

.split { flex: 1; min-height: 0; display: flex; gap: 16px; }
.report-tree {
  width: 280px;
  flex-shrink: 0;

  :deep(.el-card__body) {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
  }
}
.report-right { flex: 1; min-width: 0; display: flex; flex-direction: column; }

.report-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  :deep(.el-tabs__header) { margin-bottom: 12px; }
  :deep(.el-tabs__content) { flex: 1; min-height: 0; }
  :deep(.el-tab-pane) { height: 100%; }
}
</style>
