<template>
  <div v-if="!props.module" class="empty-pick">
    <el-empty description="请在左侧选择一个模块，管理该模块的报告模板" :image-size="90" />
  </div>
  <div v-else class="tpl">
    <!-- 左：模板列表 -->
    <el-card class="tpl__list" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header>
        <div class="card-head">
          <span>报告模板 <span class="muted">· {{ props.module.name }}</span></span>
          <el-button type="primary" size="small" :icon="Plus" @click="newTemplate">新建</el-button>
        </div>
      </template>
      <el-scrollbar class="tpl__scroll">
        <div
          v-for="t in tpls" :key="t.id"
          class="tpl__item" :class="{ 'is-active': t.id === selectedId }"
          @click="selectedId = t.id"
        >
          <div class="tpl__item-main">
            <div class="tpl__item-name">{{ t.name }}</div>
            <div class="tpl__item-desc">{{ t.desc || '—' }}</div>
            <div class="tpl__item-tags">
              <el-tag size="small" effect="plain">{{ t.sections.length }} 章</el-tag>
              <el-tag size="small" effect="plain" type="info">硬数据 {{ t.sections.filter(s => s.kind === 'data').length }}</el-tag>
              <el-tag size="small" effect="plain" type="success">生成 {{ t.sections.filter(s => s.kind === 'gen').length }}</el-tag>
            </div>
          </div>
          <el-popconfirm title="删除该模板？" @confirm="removeTpl(t.id)">
            <template #reference><el-button size="small" text :icon="Delete" @click.stop /></template>
          </el-popconfirm>
        </div>
        <el-empty v-if="!tpls.length" description="该模块暂无模板，点「新建」" :image-size="60" />
      </el-scrollbar>
    </el-card>

    <!-- 右：章节骨架编辑 -->
    <el-card v-if="cur" class="tpl__detail" shadow="never" :body-style="{ padding: '16px', flex: '1', minHeight: '0', overflow: 'auto' }">
      <template #header>
        <div class="card-head">
          <el-input v-model="cur.name" class="tpl-name" placeholder="模板名称" />
          <el-button size="small" :icon="Plus" @click="addSection">添加章节</el-button>
        </div>
      </template>
      <el-input v-model="cur.desc" placeholder="模板说明（可选）" class="tpl-desc" />
      <div class="hint-row">每个章节标记为「硬数据」（由联试数据确定性生成）或「生成」（RAG + 模型生成）。</div>

      <div v-for="(s, i) in cur.sections" :key="s.key" class="sec-row">
        <span class="sec-row__no">{{ i + 1 }}</span>
        <el-input v-model="s.title" size="small" placeholder="章节标题" class="sec-row__title" />
        <el-select v-model="s.kind" size="small" class="sec-row__kind">
          <el-option label="硬数据" value="data" />
          <el-option label="生成" value="gen" />
        </el-select>
        <el-input v-model="s.hint" size="small" placeholder="提示/数据来源说明" class="sec-row__hint" />
        <el-button size="small" text :icon="Delete" @click="cur.sections.splice(i, 1)" />
      </div>
      <el-empty v-if="!cur.sections.length" description="点「添加章节」搭建骨架" :image-size="56" />
    </el-card>
    <el-empty v-else class="tpl__detail" description="从左侧选择一个模板编辑" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const props = defineProps({ module: { type: Object, default: null } })
const store = useReportStore()
const moduleId = computed(() => props.module?.id ?? null)
const tpls = computed(() => (props.module ? store.templatesOfModule(moduleId.value) : []))

const selectedId = ref(tpls.value[0]?.id ?? null)
const cur = computed(() => tpls.value.find((t) => t.id === selectedId.value) || null)

let segSeq = 0
const addSection = () => cur.value.sections.push({ key: `nsec-${Date.now()}-${segSeq++}`, title: '新章节', kind: 'gen', hint: '' })
const newTemplate = () => {
  const t = store.addTemplate({
    name: '新建模板', desc: '', moduleId: moduleId.value,
    sections: [{ key: `nsec-${Date.now()}`, title: '概述', kind: 'gen', hint: '' }]
  })
  selectedId.value = t.id
}
const removeTpl = (id) => {
  store.removeTemplate(id)
  if (selectedId.value === id) selectedId.value = tpls.value[0]?.id ?? null
}
// 切模块或列表变化时，确保选中项有效
watch([moduleId, () => tpls.value.length], () => {
  if (!cur.value) selectedId.value = tpls.value[0]?.id ?? null
})
</script>

<style scoped lang="scss">
.empty-pick { height: 100%; display: flex; align-items: center; justify-content: center; }
.tpl { display: flex; gap: 16px; height: 100%; min-height: 0; }
.tpl__list { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; }
.tpl__detail { flex: 1; min-width: 0; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; font-weight: 400; }
.tpl__scroll { flex: 1; min-height: 0; }
.tpl__item {
  display: flex; align-items: flex-start; gap: 8px; padding: 12px 14px; cursor: pointer;
  border-left: 3px solid transparent; transition: background .15s;
  &:hover { background: var(--el-fill-color-light); }
  &.is-active { background: var(--el-color-primary-light-9); border-left-color: var(--el-color-primary); }
}
.tpl__item-main { flex: 1; min-width: 0; }
.tpl__item-name { font-weight: 600; }
.tpl__item-desc { font-size: 12px; color: var(--el-text-color-secondary); margin: 2px 0 6px; }
.tpl__item-tags { display: flex; gap: 6px; }

.tpl-name { max-width: 240px; :deep(.el-input__wrapper) { font-weight: 600; } }
.tpl-desc { margin-bottom: 10px; }
.hint-row { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 14px; }
.sec-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.sec-row__no {
  flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; font-size: 12px;
  background: var(--el-fill-color); color: var(--el-text-color-secondary);
  display: flex; align-items: center; justify-content: center;
}
.sec-row__title { width: 200px; }
.sec-row__kind { width: 96px; flex-shrink: 0; }
.sec-row__hint { flex: 1; }
</style>
