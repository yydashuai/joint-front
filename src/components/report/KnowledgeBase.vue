<template>
  <div class="kb">
    <!-- 左：知识文档 -->
    <el-card class="kb__docs" shadow="never" :body-style="{ padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header>
        <div class="card-head">
          <span>知识文档 <span class="muted">· 全工具统一</span></span>
          <div class="head-stat">
            <el-tag size="small" effect="plain">{{ docs.length }} 篇</el-tag>
            <el-tag size="small" effect="plain" type="success">已向量化 {{ vectorizedCount }}</el-tag>
            <el-tag size="small" effect="plain" type="info">{{ chunkCount }} 片段</el-tag>
            <el-button type="primary" size="small" :icon="Upload" @click="importDoc">导入文档</el-button>
          </div>
        </div>
      </template>

      <el-scrollbar class="kb__scroll">
        <el-table :data="docs" size="small" row-key="id" :expand-row-keys="expanded" @expand-change="onExpand">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div class="chunks">
                <div v-for="c in row.chunks" :key="c.idx" class="chunk">
                  <span class="chunk__idx">#{{ c.idx }}</span>
                  <span class="chunk__text">{{ c.text }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="文档" min-width="200">
            <template #default="{ row }">
              <el-icon class="doc-icon"><Document /></el-icon>
              <span class="doc-name">{{ row.title }}</span>
            </template>
          </el-table-column>
          <el-table-column label="片段" width="64" align="center">
            <template #default="{ row }">{{ row.chunks.length }}</template>
          </el-table-column>
          <el-table-column label="向量化状态" width="130" align="center">
            <template #default="{ row }">
              <el-tag :type="vecMeta(row.vectorized).type" size="small" effect="light">
                <el-icon v-if="row.vectorized === 'processing'" class="is-loading"><Loading /></el-icon>
                {{ vecMeta(row.vectorized).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="导入时间" width="140" align="center">
            <template #default="{ row }"><span class="muted">{{ row.importedAt }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center">
            <template #default="{ row }">
              <el-button
                v-if="row.vectorized !== 'done' && row.vectorized !== 'processing'"
                size="small" text type="primary" :icon="Refresh" @click="vectorize(row)"
              >向量化</el-button>
              <el-popconfirm title="删除该文档？" @confirm="store.removeKnowledgeDoc(row.id)">
                <template #reference><el-button size="small" text :icon="Delete" /></template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!docs.length" description="暂无知识文档，所有用户均可导入" :image-size="70" />
      </el-scrollbar>
    </el-card>

    <!-- 右：混合检索测试（统一知识库内） -->
    <el-card class="kb__search" shadow="never" :body-style="{ padding: '14px 16px', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }">
      <template #header><div class="card-head"><span>混合检索测试</span><span class="muted">统一知识库 · 关键词 + 向量融合</span></div></template>
      <el-input v-model="query" placeholder="输入查询，如 武器载荷 超时" :prefix-icon="Search" clearable @input="onSearch" @keyup.enter="onSearch" />
      <el-scrollbar class="kb__hits">
        <div v-if="hits.length" class="hits">
          <div v-for="(h, i) in hits" :key="h.docId + '-' + h.idx" class="hit">
            <div class="hit__rank">{{ i + 1 }}</div>
            <div class="hit__main">
              <div class="hit__text">{{ h.text }}</div>
              <div class="hit__meta">
                <span class="hit__src">{{ h.docTitle }} #{{ h.idx }}</span>
                <span>关键词 {{ h.kw }}</span><span>向量 {{ h.vec }}</span>
                <span class="hit__score">融合 <b>{{ h.score }}</b></span>
              </div>
              <el-progress :percentage="Math.round(h.score * 100)" :stroke-width="4" :show-text="false" />
            </div>
          </div>
        </div>
        <el-empty v-else :description="query ? '无命中片段' : '输入查询测试检索效果'" :image-size="56" />
      </el-scrollbar>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Document, Refresh, Delete, Search, Loading } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'

const store = useReportStore()

const docs = computed(() => store.knowledgeDocs)
const vectorizedCount = computed(() => docs.value.filter((d) => d.vectorized === 'done').length)
const chunkCount = computed(() => docs.value.reduce((n, d) => n + d.chunks.length, 0))

const expanded = ref([])
const onExpand = (row, rows) => { expanded.value = rows.map((r) => r.id) }

const vecMeta = (s) => ({
  done: { text: '已向量化', type: 'success' },
  pending: { text: '待处理', type: 'warning' },
  processing: { text: '处理中', type: 'primary' },
  failed: { text: '失败可重试', type: 'danger' }
}[s] || { text: '未知', type: 'info' })

const vectorize = async (row) => {
  const ok = await store.vectorize(row.id)
  ok ? ElMessage.success(`「${row.title}」向量化完成`) : ElMessage.error('向量化失败，请重试')
}

const importDoc = () => {
  ElMessageBox.prompt('导入到统一知识库（演示用，实际为上传 MD/CSV/TXT）', '导入知识文档', {
    inputValue: '新知识文档.md', confirmButtonText: '导入', cancelButtonText: '取消'
  }).then(({ value }) => {
    const name = (value || '').trim() || '新知识文档.md'
    const type = name.split('.').pop().toLowerCase()
    store.addKnowledgeDoc({
      title: name, type,
      chunks: [
        { idx: 1, text: '（导入后自动分块）该文档第 1 个知识片段示例内容。' },
        { idx: 2, text: '（导入后自动分块）该文档第 2 个知识片段示例内容。' }
      ]
    })
    ElMessage.success(`已导入「${name}」，待向量化`)
  }).catch(() => {})
}

const query = ref('')
const hits = ref([])
let timer = null
const onSearch = () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    hits.value = query.value.trim() ? store.searchKnowledge(query.value, null, 8) : []
  }, 200)
}
</script>

<style scoped lang="scss">
.kb { display: flex; gap: 16px; height: 100%; min-height: 0; }
.kb__docs { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.kb__search { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.head-stat { display: flex; align-items: center; gap: 8px; }
.muted { color: var(--el-text-color-secondary); font-size: 12px; }
.kb__scroll { flex: 1; min-height: 0; }
.doc-icon { color: var(--el-color-primary); vertical-align: middle; margin-right: 6px; }
.doc-name { vertical-align: middle; }

.chunks { padding: 6px 12px; display: flex; flex-direction: column; gap: 6px; }
.chunk { display: flex; gap: 8px; font-size: 12.5px; line-height: 1.6; }
.chunk__idx { color: var(--el-color-primary); flex-shrink: 0; }
.chunk__text { color: var(--el-text-color-regular); }

.kb__hits { flex: 1; min-height: 0; margin-top: 12px; }
.hits { display: flex; flex-direction: column; gap: 10px; }
.hit { display: flex; gap: 10px; padding: 10px; background: var(--el-fill-color-lighter); border-radius: 8px; }
.hit__rank {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  background: var(--el-color-primary); color: #fff; font-size: 12px;
  display: flex; align-items: center; justify-content: center; font-weight: 600;
}
.hit__main { min-width: 0; flex: 1; }
.hit__text { font-size: 13px; line-height: 1.6; }
.hit__meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 6px; font-size: 11px; color: var(--el-text-color-placeholder); }
.hit__src { color: var(--el-color-primary); }
.hit__score b { color: var(--el-color-danger); }
</style>
