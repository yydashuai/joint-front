<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <el-input v-model="protocol.name" class="proto-name" placeholder="协议名称" />
        <div class="proto-head__right">
          <el-tooltip content="保存当前协议配置"><el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button></el-tooltip>
          <el-popconfirm title="删除该协议？" @confirm="$emit('delete')">
            <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
          </el-popconfirm>
        </div>
      </div>
    </template>

    <div class="field-label">备注说明</div>
    <el-input v-model="protocol.desc" placeholder="可选，描述该协议的用途" class="proto-desc" />

    <div class="meta-row">
      <span class="meta-row__label req">所属系统</span>
      <el-select v-model="protocol.systemId" placeholder="选择系统" class="meta-sel" @change="$emit('systemChange')">
        <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <span class="meta-row__label req">模块</span>
      <el-select v-model="protocol.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!protocol.systemId">
        <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
      </el-select>
    </div>

    <el-divider content-position="left">字段定义</el-divider>
    <div class="section-hint">
      定义协议的数据结构字段。每个字段使用五类数据规则（标量/位组序流/共识体/结构矩阵/流文件）。
      此协议可被多个接口复用。
    </div>

    <el-scrollbar class="tree-scroll">
      <div class="struct">
        <div class="struct__head">
          <span class="struct__title">协议字段</span>
          <el-tooltip content="添加一个协议字段"><el-button size="small" :icon="Plus" @click="addField">添加字段</el-button></el-tooltip>
        </div>
        <div class="struct__tree">
          <div v-for="p in protocol.fields" :key="p.id" class="struct__row" :data-field-id="p.id">
            <FieldNode :node="p" />
          </div>
          <el-empty v-if="!protocol.fields?.length" description="暂无字段，点击上方按钮添加" :image-size="60" />
        </div>
      </div>
    </el-scrollbar>

    <!-- 字段编辑弹窗 -->
    <el-dialog v-model="nodeDlg" title="编辑字段" width="500px">
      <el-form v-if="editing" label-width="100px">
        <el-form-item label="字段名"><el-input v-model="editing.name" placeholder="如 deviceId" /></el-form-item>
        <el-form-item label="数据规则类别">
          <el-select v-model="editing.type" class="w-full" @change="onTypeChange(editing)">
            <el-option v-for="t in DATA_RULE_CATEGORIES" :key="t.value" :value="t.value">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-icon :style="{ color: t.color }"><component :is="t.icon" /></el-icon>
                <span style="font-weight: 500;">{{ t.label }}</span>
                <span style="color: var(--el-text-color-secondary); font-size: 12px; margin-left: auto;">{{ t.desc }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === 'scalar'" label="数据类型">
          <el-select v-model="editing.encoding" class="w-full" filterable>
            <el-option-group
              v-for="grp in groupedScalarEncodings"
              :key="grp.group"
              :label="grp.group"
            >
              <el-option v-for="s in grp.items" :key="s.value" :label="s.label" :value="s.value" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === 'bitstream'" label="绑定协议">
          <el-select v-model="editing.protocolRef" class="w-full" placeholder="选择解析协议" clearable>
            <el-option v-for="o in protocolOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === 'struct'" label="提示">
          <span class="muted">共识体：多字段结构化数据块，保存后通过树上的「+」添加子字段</span>
        </el-form-item>
        <el-form-item v-if="editing.type === 'matrix'" label="提示">
          <span class="muted">结构矩阵：二维表格数据，保存后通过树上的「+」添加列定义</span>
        </el-form-item>
        <el-form-item v-if="editing.type === 'file'" label="文件名">
          <el-input v-model="editing.fileName" placeholder="上传后自动填充" />
        </el-form-item>
        <el-form-item label="必填">
          <el-switch v-model="editing.required" />
        </el-form-item>
        <el-form-item label="单位">
          <el-input v-model="editing.unit" placeholder="如 kg / m/s / °" />
        </el-form-item>
        <el-form-item label="备注说明"><el-input v-model="editing.desc" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" @click="nodeDlg = false">完成</el-button></template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, provide, computed, watch } from 'vue'
import { Plus, Delete, Check } from '@element-plus/icons-vue'
import {
  DATA_RULE_CATEGORIES, SCALAR_ENCODINGS,
  makeParam, useProtocolStore
} from '@/stores/protocol'
import FieldNode from '@/components/FieldNode.vue'

const props = defineProps({
  protocol: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
})
defineEmits(['delete', 'save', 'systemChange'])

const protoStore = useProtocolStore()
const protocolOptions = computed(() => protoStore.protocols.map((p) => ({ label: p.name, value: p.id })))

// ---- 脏数据追踪 ----
const dirty = ref(false)
const snapshot = ref(JSON.stringify(props.protocol))
watch(() => props.protocol, () => {
  dirty.value = JSON.stringify(props.protocol) !== snapshot.value
}, { deep: true })
watch(() => props.protocol.id, () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
}, { immediate: true })
const markClean = () => { snapshot.value = JSON.stringify(props.protocol); dirty.value = false }
defineExpose({ markClean })

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'auto' }

// scalar 编码方式按 group 聚合
const groupedScalarEncodings = computed(() => {
  const groups = {}
  for (const s of SCALAR_ENCODINGS) {
    if (!groups[s.group]) groups[s.group] = []
    groups[s.group].push(s)
  }
  return Object.entries(groups).map(([group, items]) => ({ group, items }))
})

const addField = () => {
  if (!props.protocol.fields) props.protocol.fields = []
  props.protocol.fields.push(makeParam({ name: `field${props.protocol.fields.length + 1}` }))
}

const removeById = (list, id) => {
  const i = list.findIndex((n) => n.id === id)
  if (i >= 0) { list.splice(i, 1); return true }
  for (const n of list) {
    if (n.children?.length && removeById(n.children, id)) return true
  }
  return false
}

// 树节点编辑弹窗
const nodeDlg = ref(false)
const editing = ref(null)
provide('treeActions', {
  onEdit: (node) => { editing.value = node; nodeDlg.value = true },
  onAddChild: (node) => {
    if (!node.children) node.children = []
    node.children.push(makeParam({ name: `field${node.children.length + 1}` }))
  },
  onRemove: (node) => removeById(props.protocol.fields, node.id)
})

const onTypeChange = (row) => {
  if (row.type !== 'struct' && row.type !== 'matrix') row.children = []
  if (row.type !== 'bitstream') row.protocolRef = null
  if (row.type === 'scalar' && !row.encoding) row.encoding = 'uint8'
  if (row.type !== 'file') { row.fileName = ''; row.fileSize = 0 }
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }

.section-hint { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 12px; line-height: 1.6; padding-left: 4px; border-left: 3px solid var(--el-color-primary-light-5); }

.tree-scroll { flex: 1; min-height: 0; }
.struct {
  & + & { margin-top: 8px; }
  &__head { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
  &__title { font-size: 14px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary); }
  &__tree { display: flex; flex-direction: column; gap: 14px; padding: 8px 4px; }
  &__row { display: flex; transition: background 0.3s; border-radius: 6px; }
}

.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.form-tip { font-size: 12px; color: var(--el-text-color-placeholder); margin-top: 4px; line-height: 1.4; }
.w-full { width: 100%; }
</style>
