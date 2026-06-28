<template>
  <div class="bindings">
    <!-- 绑定摘要 -->
    <div class="bindings__summary">
      <div class="summary-item" :class="{ 'summary-item--empty': !hasInterface }">
        <el-icon class="summary-item__icon"><Connection /></el-icon>
        <div class="summary-item__body">
          <span class="summary-item__count">{{ hasInterface ? 1 : 0 }}</span>
          <span class="summary-item__label">接口</span>
        </div>
      </div>
      <div class="summary-item" :class="{ 'summary-item--empty': localBindings.datasetIds.length === 0 }">
        <el-icon class="summary-item__icon"><Document /></el-icon>
        <div class="summary-item__body">
          <span class="summary-item__count">{{ localBindings.datasetIds.length }}</span>
          <span class="summary-item__label">数据集</span>
        </div>
      </div>
      <div class="summary-item" :class="{ 'summary-item--empty': localBindings.fileIds.length === 0 }">
        <el-icon class="summary-item__icon"><Files /></el-icon>
        <div class="summary-item__body">
          <span class="summary-item__count">{{ localBindings.fileIds.length }}</span>
          <span class="summary-item__label">文件</span>
        </div>
      </div>
      <div class="summary-item" :class="{ 'summary-item--empty': !localBindings.ruleSetId }">
        <el-icon class="summary-item__icon"><SetUp /></el-icon>
        <div class="summary-item__body">
          <span class="summary-item__count">{{ localBindings.ruleSetId ? 1 : 0 }}</span>
          <span class="summary-item__label">规则集</span>
        </div>
      </div>
    </div>

    <!-- 目标接口 -->
    <el-card shadow="never" class="bind-card">
      <template #header>
        <div class="bind-card__head">
          <span class="bind-card__title">目标接口</span>
          <el-tag v-if="hasInterface" type="success" size="small" effect="plain">{{ selectedInterfaceName }}</el-tag>
          <el-tag v-else type="warning" size="small" effect="plain">未选择</el-tag>
        </div>
      </template>
      <el-select
        v-model="localBindings.interfaceId"
        filterable
        clearable
        placeholder="选择当前模块下的接口"
        style="width: 100%;"
        @change="onInterfaceChange"
      >
        <el-option
          v-for="i in moduleInterfaces"
          :key="i.id"
          :label="i.name"
          :value="i.id"
        >
          <span style="float: left;">{{ i.name }}</span>
          <span class="iface-path">{{ i.path }}</span>
        </el-option>
      </el-select>
      <div v-if="moduleInterfaces.length === 0" class="bind-hint">
        当前模块暂无接口，请先在
        <el-link type="primary" :underline="false" @click="$router.push('/protocol')">协议管理</el-link>
        中定义
      </div>
    </el-card>

    <!-- 关联数据集（按所选接口自动过滤） -->
    <el-card shadow="never" class="bind-card">
      <template #header>
        <div class="bind-card__head">
          <span class="bind-card__title">测试数据集</span>
          <el-tag v-if="localBindings.datasetIds.length > 0" type="success" size="small" effect="plain">{{ localBindings.datasetIds.length }} 个</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">未选择</el-tag>
        </div>
      </template>
      <el-select
        v-model="localBindings.datasetIds"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        :placeholder="hasInterface ? '选择测试数据集（可多选）' : '请先选择接口'"
        :disabled="!hasInterface"
        style="width: 100%;"
        @change="emitChange"
      >
        <el-option
          v-for="d in filteredDatasets"
          :key="d.id"
          :label="`${d.name}${d.rows.length ? '（' + d.rows.length + '行）' : ''}`"
          :value="d.id"
        />
      </el-select>
      <div v-if="hasInterface && filteredDatasets.length === 0" class="bind-hint">
        暂无关联「{{ selectedInterfaceName }}」的数据集，请先在
        <el-link type="primary" :underline="false" @click="$router.push('/test-data')">测试数据</el-link>
        中创建并关联该接口
      </div>
      <div v-if="!hasInterface" class="bind-hint">
        请先选择目标接口，数据集将自动按关联过滤
      </div>
    </el-card>

    <!-- 关联资源文件 -->
    <el-card shadow="never" class="bind-card">
      <template #header>
        <div class="bind-card__head">
          <span class="bind-card__title">资源文件</span>
          <el-tag v-if="localBindings.fileIds.length > 0" type="success" size="small" effect="plain">{{ localBindings.fileIds.length }} 个</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">未选择</el-tag>
        </div>
      </template>
      <el-select
        v-model="localBindings.fileIds"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        placeholder="选择资源文件（可多选）"
        style="width: 100%;"
        @change="emitChange"
      >
        <el-option
          v-for="f in moduleFiles"
          :key="f.id"
          :label="`${f.name}（${f.format.toUpperCase()}）`"
          :value="f.id"
        />
      </el-select>
      <div v-if="moduleFiles.length === 0" class="bind-hint">
        当前模块暂无资源文件，请先在
        <el-link type="primary" :underline="false" @click="$router.push('/test-data')">测试数据</el-link>
        中上传
      </div>
    </el-card>

    <!-- 关联规则集 -->
    <el-card shadow="never" class="bind-card">
      <template #header>
        <div class="bind-card__head">
          <span class="bind-card__title">校验规则集</span>
          <el-tag v-if="localBindings.ruleSetId" type="success" size="small" effect="plain">已关联</el-tag>
          <el-tag v-else type="info" size="small" effect="plain">未选择</el-tag>
        </div>
      </template>
      <el-select
        v-model="localBindings.ruleSetId"
        clearable
        filterable
        placeholder="选择当前模块下的规则集"
        style="width: 100%;"
        @change="emitChange"
      >
        <el-option
          v-for="ruleSet in moduleRuleSets"
          :key="ruleSet.id"
          :label="`${ruleSet.name}（${ruleSet.rules.filter(r => r.enabled).length}条启用）`"
          :value="ruleSet.id"
        />
      </el-select>
      <div v-if="!moduleRuleSets.length" class="bind-hint">
        当前模块暂无规则集，可先到
        <el-link type="primary" :underline="false" @click="$router.push('/rule')">校验规则管理</el-link>
        中从接口自动生成
      </div>
    </el-card>

    <!-- MQ 专项测试配置（仅当模块关联 MQ 协议时显示） -->
    <el-card v-if="hasMqProtocol && localBindings.mqTest" shadow="never" class="bind-card">
      <template #header>
        <div class="bind-card__head">
          <span class="bind-card__title">MQ 专项测试配置</span>
        </div>
      </template>
      <MqTestConfig :mq-test="localBindings.mqTest" />
    </el-card>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { Connection, Document, Files, SetUp } from '@element-plus/icons-vue'
import { useProtocolStore } from '@/stores/protocol'
import { useTestDataStore } from '@/stores/testData'
import { useConnectionStore } from '@/stores/connection'
import { useRuleStore } from '@/stores/rule'
import MqTestConfig from '@/components/testtask/MqTestConfig.vue'
import { defaultMqTest } from '@/stores/testTask'

const props = defineProps({
  task: { type: Object, required: true },
})
const emit = defineEmits(['change'])

const protoStore = useProtocolStore()
const tdStore = useTestDataStore()
const connStore = useConnectionStore()
const ruleStore = useRuleStore()

/** 本地副本 */
const localBindings = reactive({
  interfaceId: null,
  datasetIds: [],
  fileIds: [],
  ruleSetId: null,
  mqTest: null,
})

/** 检测当前模块是否关联 MQ 协议 */
const hasMqProtocol = computed(() => {
  return protoStore.protocols.some(
    p => p.moduleId === props.task.moduleId && p.type === 'MQ'
  )
})

/** 同步 props.task.bindings → localBindings */
watch(() => props.task, (t) => {
  if (t?.bindings) {
    localBindings.interfaceId = t.bindings.interfaceId ?? null
    localBindings.datasetIds = [...(t.bindings.datasetIds || [])]
    localBindings.fileIds = [...(t.bindings.fileIds || [])]
    localBindings.ruleSetId = t.bindings.ruleSetId ?? null
    localBindings.mqTest = t.bindings.mqTest ? JSON.parse(JSON.stringify(t.bindings.mqTest)) : defaultMqTest()
  }
}, { immediate: true })

/* ========== 当前模块下的可选资源 ========== */
const moduleName = computed(() =>
  connStore.nodes.find(n => n.id === props.task.moduleId)?.name
)

const moduleInterfaces = computed(() =>
  protoStore.interfaces.filter(i => i.moduleId === props.task.moduleId)
)

const moduleFiles = computed(() =>
  tdStore.files.filter(f => f.systemId === props.task.systemId && f.moduleName === moduleName.value)
)

/* ========== 按所选接口过滤数据集 ========== */
const selectedInterfaceName = computed(() => {
  if (localBindings.interfaceId == null) return ''
  return protoStore.interfaces.find(i => i.id === localBindings.interfaceId)?.name || ''
})

const filteredDatasets = computed(() => {
  if (!selectedInterfaceName.value) return []
  return tdStore.datasets.filter(d =>
    d.systemId === props.task.systemId &&
    d.moduleName === moduleName.value &&
    d.linkedInterface === selectedInterfaceName.value
  )
})

/* ========== 状态 ========== */
const hasInterface = computed(() => localBindings.interfaceId != null)

const onInterfaceChange = () => {
  // 切换接口时清空已选数据集（可能不再匹配）
  localBindings.datasetIds = []
  emitChange()
}

const moduleRuleSets = computed(() => ruleStore.ruleSetsOfModule(props.task.moduleId))

const emitChange = () => {
  emit('change', {
    interfaceId: localBindings.interfaceId,
    datasetIds: [...localBindings.datasetIds],
    fileIds: [...localBindings.fileIds],
    ruleSetId: localBindings.ruleSetId,
    mqTest: hasMqProtocol.value ? (localBindings.mqTest || defaultMqTest()) : undefined,
  })
}
</script>

<style scoped lang="scss">
.bindings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 绑定摘要 */
.bindings__summary {
  display: flex;
  gap: 12px;
}
.summary-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);

  &--empty { opacity: 0.55; }

  &__icon {
    font-size: 20px;
    color: var(--el-color-primary);
    flex-shrink: 0;
  }
  &__body {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  &__count {
    font-size: 18px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  &__label {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}

/* 绑定卡片 */
.bind-card {
  :deep(.el-card__header) { padding: 8px 14px; }
  :deep(.el-card__body) { padding: 12px 14px; }
}
.bind-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.bind-card__title {
  font-weight: 600;
  font-size: 14px;
}

.iface-path {
  float: right;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.bind-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-top: 6px;
}
</style>
