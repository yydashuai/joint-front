<template>
  <el-drawer v-model="visible" size="520px" title="异常详情">
    <template v-if="exception">
      <div class="drawer-body">
        <section class="panel">
          <div class="panel-title">处置</div>
          <el-input v-model="note" type="textarea" :rows="3" placeholder="填写处置说明或复核结论" />
          <div class="actions">
            <el-button @click="setState('处理中')">开始处理</el-button>
            <el-button type="success" plain @click="setState('已修复')">已修复</el-button>
            <el-button type="success" @click="setState('已处理')">已处理</el-button>
            <el-button type="warning" plain @click="setState('已转派')">转派</el-button>
            <el-button type="info" plain @click="setState('已忽略')">忽略</el-button>
            <el-button :disabled="!note.trim()" @click="addTrace">添加处理记录</el-button>
          </div>
        </section>

        <section class="panel tag-panel">
          <div class="panel-title">标签分类</div>
          <el-popover
            v-model:visible="tagPickerVisible"
            trigger="click"
            placement="bottom-start"
            width="430"
            popper-class="exception-tag-popover"
            @show="resetTagDraft"
          >
            <template #reference>
              <button type="button" class="tag-summary" :title="tagSummary">
                {{ tagSummary }}
              </button>
            </template>

            <div class="tag-sheet">
              <div class="tag-sheet__header">
                <el-button text @click="cancelTagEdit">取消</el-button>
                <strong>选择异常标签</strong>
                <el-button type="primary" @click="saveTags">保存</el-button>
              </div>

              <el-input v-model="tagSearch" :prefix-icon="Search" clearable placeholder="搜索标签" class="tag-search" />

              <div class="tag-section">
                <div class="tag-section__title">推荐标签</div>
                <div class="tag-chip-row">
                  <button
                    v-for="tag in suggestedTags"
                    :key="tag"
                    type="button"
                    class="tag-chip"
                    :class="{ 'is-selected': isTagSelected(tag) }"
                    @click="toggleTag(tag)"
                  >
                    {{ tag }}
                  </button>
                </div>
              </div>

              <div class="tag-section">
                <div class="tag-section__bar">
                  <span>历史标签</span>
                  <el-button text type="primary" @click="manageTags = !manageTags">{{ manageTags ? '完成整理' : '整理标签' }}</el-button>
                </div>
                <div class="tag-chip-row">
                  <button
                    v-for="tag in filteredTagOptions"
                    :key="tag"
                    type="button"
                    class="tag-chip tag-chip--editable"
                    :class="{ 'is-selected': isTagSelected(tag), 'is-managing': manageTags }"
                    @click="manageTags ? null : toggleTag(tag)"
                  >
                    <span>{{ tag }}</span>
                    <el-icon v-if="manageTags" class="tag-chip__delete" @click.stop="deleteTag(tag)"><Close /></el-icon>
                  </button>
                  <button v-if="!creatingTag" type="button" class="tag-chip tag-chip--new" @click="startCreateTag">
                    <el-icon><Plus /></el-icon>
                    <span>添加标签</span>
                  </button>
                </div>
                <div v-if="creatingTag" class="new-tag-row">
                  <el-input
                    ref="newTagInput"
                    v-model="newTagName"
                    clearable
                    placeholder="输入新标签"
                    class="new-tag-input"
                    @clear="cancelCreateTag"
                    @blur="cancelCreateTag"
                    @keyup.enter="createTag"
                  />
                  <el-button type="primary" class="new-tag-confirm" @mousedown.prevent @click="createTag">确定</el-button>
                </div>
              </div>
            </div>
          </el-popover>
          <div class="tag-hint">多个标签会用逗号展示；标签过长时自动省略。</div>
        </section>

        <section class="panel">
          <div class="panel-title">基本信息</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="异常类型">{{ exception.type }}</el-descriptions-item>
            <el-descriptions-item label="级别">
              <el-tag :type="store.levelMeta(exception.level).tag" size="small">{{ exception.level }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="store.stateMeta(exception.state).tag" size="small">{{ exception.state }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="来源">{{ sourceLabel(exception.source) }}</el-descriptions-item>
            <el-descriptions-item label="接口">{{ exception.iface }}</el-descriptions-item>
            <el-descriptions-item label="捕捉时间">{{ exception.capturedTime }}</el-descriptions-item>
            <el-descriptions-item v-if="exception.runId" label="执行批次">
              <el-button link type="primary" @click="router.push({ path: '/execution', query: { runId: exception.runId } })">{{ exception.runId }}</el-button>
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="panel">
          <div class="panel-title">证据</div>
          <div class="evidence">
            <label>命中规则 / 现场说明</label>
            <p>{{ exception.detail?.ruleMessage || exception.remark || '暂无说明' }}</p>
            <label>字段路径</label>
            <p class="mono">{{ exception.detail?.fieldPath || 'interface' }}</p>
            <label>响应时延</label>
            <p>{{ exception.detail?.recvMs == null ? '未记录' : `${exception.detail.recvMs}ms` }}</p>
            <label>请求帧</label>
            <pre>{{ exception.detail?.reqHex || '未记录' }}</pre>
            <label>响应帧</label>
            <pre>{{ exception.detail?.respHex || '未记录' }}</pre>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">处理记录</div>
          <el-timeline>
            <el-timeline-item
              v-for="(item, index) in exception.trace"
              :key="index"
              :timestamp="item.time"
              placement="top"
            >
              <strong>{{ item.action }}</strong>
              <p>{{ item.user }}：{{ item.note }}</p>
            </el-timeline-item>
          </el-timeline>
        </section>
      </div>
    </template>
  </el-drawer>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Plus, Search } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { EXC_SOURCES, useExceptionStore } from '@/stores/exception'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  exception: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

const router = useRouter()
const store = useExceptionStore()
const note = ref('')
const tagDraft = ref([])
const tagPickerVisible = ref(false)
const tagSearch = ref('')
const manageTags = ref(false)
const creatingTag = ref(false)
const newTagName = ref('')
const newTagInput = ref(null)

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

watch(() => props.exception?.id, () => {
  note.value = ''
  tagDraft.value = [...(props.exception?.tags || [])]
}, { immediate: true })

watch(() => props.exception?.tags, (tags) => {
  tagDraft.value = [...(tags || [])]
}, { deep: true })

const sourceLabel = (source) => EXC_SOURCES.find((item) => item.value === source)?.label || source
const tagSummary = computed(() => props.exception?.tags?.length ? props.exception.tags.join(', ') : '未设置标签')
const filteredTagOptions = computed(() => {
  const keyword = tagSearch.value.trim().toLowerCase()
  if (!keyword) return store.tagOptions
  return store.tagOptions.filter((tag) => tag.toLowerCase().includes(keyword))
})
const suggestedTags = computed(() => {
  return store.tagOptions.slice(0, 5)
})
const setState = (state) => {
  if (!props.exception) return
  store.updateState(props.exception.id, state, note.value || '状态快速流转')
  ElMessage.success(`已更新为${state}`)
  note.value = ''
}
const addTrace = () => {
  if (!props.exception || !note.value.trim()) return
  store.addTrace(props.exception.id, note.value.trim())
  ElMessage.success('处理记录已添加')
  note.value = ''
}
const saveTags = () => {
  if (!props.exception) return
  store.setTags(props.exception.id, tagDraft.value)
  tagPickerVisible.value = false
  manageTags.value = false
  ElMessage.success('标签已更新')
}
const resetTagDraft = () => {
  tagDraft.value = [...(props.exception?.tags || [])]
  tagSearch.value = ''
  newTagName.value = ''
  creatingTag.value = false
}
const cancelTagEdit = () => {
  resetTagDraft()
  manageTags.value = false
  tagPickerVisible.value = false
}
const isTagSelected = (tag) => tagDraft.value.includes(tag)
const toggleTag = (tag) => {
  tagDraft.value = isTagSelected(tag)
    ? tagDraft.value.filter((item) => item !== tag)
    : [...tagDraft.value, tag]
}
const startCreateTag = () => {
  creatingTag.value = true
  nextTick(() => newTagInput.value?.focus?.())
}
const createTag = () => {
  const name = newTagName.value.trim()
  if (!name || !props.exception) {
    cancelCreateTag()
    return
  }
  const nextTags = tagDraft.value.includes(name) ? tagDraft.value : [...tagDraft.value, name]
  tagDraft.value = nextTags
  store.setTags(props.exception.id, nextTags)
  newTagName.value = ''
  creatingTag.value = false
  ElMessage.success('标签已添加')
}
const cancelCreateTag = () => {
  newTagName.value = ''
  creatingTag.value = false
}
const deleteTag = (tag) => {
  store.deleteTag(tag)
  tagDraft.value = tagDraft.value.filter((item) => item !== tag)
  ElMessage.success('标签已删除')
}
</script>

<style scoped lang="scss">
.drawer-body { display: flex; flex-direction: column; gap: 14px; }
.panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color);
}
.panel-title {
  margin-bottom: 10px;
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.evidence {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.evidence label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.evidence p,
.evidence pre {
  margin: 0 0 6px;
  padding: 8px;
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
  font-size: 14px;
  line-height: 1.5;
}
.evidence pre {
  white-space: pre-wrap;
  word-break: break-all;
}
.mono,
.evidence pre { font-family: Consolas, Monaco, monospace; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.tag-panel { background: linear-gradient(90deg, rgba(64, 158, 255, .06), transparent 52%), var(--el-bg-color); }
.tag-summary {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-primary);
  cursor: pointer;
  line-height: 32px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-summary:hover { border-color: var(--el-color-primary); }
.tag-hint { margin-top: 8px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.5; }
:deep(.el-timeline) { padding-left: 2px; }
:deep(.el-timeline-item__content p) { margin: 4px 0 0; color: var(--el-text-color-secondary); }

:global(.exception-tag-popover) {
  padding: 0 !important;
  border-radius: 14px !important;
}
.tag-sheet { padding: 14px; }
.tag-sheet__header {
  display: grid;
  grid-template-columns: 72px 1fr 72px;
  align-items: center;
  margin-bottom: 12px;
  text-align: center;
}
.tag-sheet__header strong { font-size: 16px; font-weight: 700; }
.tag-search { margin-bottom: 14px; }
.tag-section { margin-top: 14px; }
.tag-section__title,
.tag-section__bar {
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.tag-section__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tag-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  max-width: 150px;
  min-height: 32px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
  cursor: pointer;
  font-size: 13px;
  gap: 6px;
}
.tag-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag-chip.is-selected {
  border-color: rgba(103, 194, 58, .28);
  background: rgba(103, 194, 58, .12);
  color: var(--el-color-success);
  font-weight: 650;
}
.tag-chip.is-managing { padding-right: 8px; cursor: default; }
.tag-chip__delete {
  flex-shrink: 0;
  color: var(--el-color-danger);
  cursor: pointer;
}
.tag-chip--new {
  border-color: var(--el-border-color);
  background: var(--el-bg-color);
}
.new-tag-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 68px;
  gap: 8px;
  margin-top: 10px;
  width: 100%;
}
.new-tag-input {
  width: 100%;
  :deep(.el-input__wrapper) { min-height: 32px; }
}
.new-tag-confirm {
  height: 32px;
  padding: 0 14px;
}
</style>
