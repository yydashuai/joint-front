<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <el-input v-model="iface.name" class="proto-name" placeholder="接口名称" />
        <el-popconfirm title="删除该接口？" @confirm="$emit('delete')">
          <template #reference><el-button :icon="Delete" plain>删除接口</el-button></template>
        </el-popconfirm>
      </div>
    </template>

    <div class="field-label">备注说明</div>
    <el-input v-model="iface.desc" placeholder="可选，描述该接口的用途" class="proto-desc" />

    <div class="meta-row">
      <el-input v-model="iface.path" class="meta-path" placeholder="接口路径，如 /device/status">
        <template #prepend>路径</template>
      </el-input>
    </div>

    <!-- MQ 接口操作类型 -->
    <div class="meta-row" v-if="hasMqProtocol">
      <span class="meta-row__label">操作类型</span>
      <el-select v-model="iface.operationType" placeholder="选择 MQ 操作类型" style="width: 200px" clearable>
        <el-option v-for="op in MQ_OPERATION_TYPES" :key="op.value" :label="op.label" :value="op.value">
          <span>{{ op.label }}</span>
          <span style="float: right; color: var(--el-text-color-secondary); font-size: 12px">{{ op.desc }}</span>
        </el-option>
      </el-select>
    </div>

    <div class="meta-row">
      <span class="meta-row__label req">所属系统</span>
      <el-select v-model="iface.systemId" placeholder="选择系统" class="meta-sel" @change="$emit('systemChange')">
        <el-option v-for="s in systemOptions" :key="s.value" :label="s.label" :value="s.value" />
      </el-select>
      <span class="meta-row__label req">模块</span>
      <el-select v-model="iface.moduleId" placeholder="选择模块" class="meta-sel" :disabled="!iface.systemId">
        <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
      </el-select>
    </div>

    <!-- 签名预览（带分隔线 + 可点击标签） -->
    <SignaturePreview :iface="iface" @navigate="scrollToField" />

    <el-scrollbar class="tree-scroll">
      <div class="struct">
        <div class="struct__head">
          <span class="struct__title">接口参数</span>
          <el-tooltip content="添加一个接口请求参数"><el-button size="small" :icon="Plus" @click="addRootParam(iface.request)">添加参数</el-button></el-tooltip>
        </div>
        <div class="struct__tree">
          <div v-for="p in iface.request" :key="p.id" class="struct__row" :data-field-id="p.id">
            <FieldNode :node="p" />
          </div>
          <el-empty v-if="!iface.request.length" description="无参数" :image-size="60" />
        </div>
      </div>

      <div class="struct">
        <div class="struct__head">
          <span class="struct__title">接口响应</span>
          <el-tooltip content="添加一个接口响应字段"><el-button size="small" :icon="Plus" @click="addRootParam(iface.response)">添加字段</el-button></el-tooltip>
        </div>
        <div class="struct__tree">
          <div v-for="p in iface.response" :key="p.id" class="struct__row" :data-field-id="p.id">
            <FieldNode :node="p" />
          </div>
          <el-empty v-if="!iface.response.length" description="无返回字段" :image-size="60" />
        </div>
      </div>
    </el-scrollbar>

    <!-- 字段编辑弹窗 -->
    <el-dialog v-model="nodeDlg" title="编辑字段" width="460px">
      <el-form v-if="editing" label-width="88px">
        <el-form-item label="字段名"><el-input v-model="editing.name" /></el-form-item>
        <el-form-item label="数据类型">
          <el-select v-model="editing.type" class="w-full" @change="onTypeChange(editing)">
            <el-option v-for="t in FIELD_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '常量'" label="子类型">
          <el-select v-model="editing.dataType" class="w-full">
            <el-option v-for="d in CONST_SUBTYPES" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '位组序流'" label="绑定协议">
          <el-select v-model="editing.protocolRef" class="w-full" placeholder="选择解析协议" clearable>
            <el-option v-for="o in protocolOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '共识体'" label="提示">
          <span class="muted">可在树上用 ＋ 为其添加子字段</span>
        </el-form-item>
        <el-form-item label="备注说明"><el-input v-model="editing.desc" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" @click="nodeDlg = false">完成</el-button></template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, provide, computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { FIELD_TYPES, CONST_SUBTYPES, MQ_OPERATION_TYPES, makeParam, useProtocolStore } from '@/stores/protocol'
import FieldNode from '@/components/FieldNode.vue'
import SignaturePreview from './SignaturePreview.vue'

const props = defineProps({
  iface: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
  protocolOptions: { type: Array, default: () => [] },
})
defineEmits(['delete', 'systemChange'])

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

const protoStore = useProtocolStore()

// 检查当前模块是否有 MQ 协议，决定是否显示操作类型选择器
const hasMqProtocol = computed(() => {
  if (!props.iface.moduleId) return false
  return protoStore.protocols.some(p => p.moduleId === props.iface.moduleId && p.type === 'MQ')
})

const addRootParam = (list) => list.push(makeParam({ name: `field${list.length + 1}` }))

const removeById = (lists, id) => {
  for (const list of lists) {
    const i = list.findIndex((n) => n.id === id)
    if (i >= 0) { list.splice(i, 1); return true }
    for (const n of list) {
      if (n.children?.length && removeById([n.children], id)) return true
    }
  }
  return false
}

// 树节点编辑弹窗
const nodeDlg = ref(false)
const editing = ref(null)
provide('treeActions', {
  onEdit: (node) => { editing.value = node; nodeDlg.value = true },
  onAddChild: (node) => node.children.push(makeParam({ name: `field${node.children.length + 1}` })),
  onRemove: (node) => removeById([props.iface.request, props.iface.response], node.id)
})

const onTypeChange = (row) => {
  if (row.type !== '共识体') row.children = []
  if (row.type !== '位组序流') row.protocolRef = null
}

// 签名标签点击导航
const scrollToField = (paramId) => {
  const el = document.querySelector(`[data-field-id="${paramId}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('field-highlight')
    setTimeout(() => el.classList.remove('field-highlight'), 1500)
  }
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }
.meta-path { max-width: 440px; }

.tree-scroll { flex: 1; min-height: 0; }
.struct {
  & + & { margin-top: 8px; }
  &__head { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
  &__title { font-size: 14px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary); }
  &__tree { display: flex; flex-direction: column; gap: 14px; padding: 8px 4px; }
  &__row { display: flex; transition: background 0.3s; border-radius: 6px; }
}

.field-highlight {
  background: var(--el-color-warning-light-8) !important;
  animation: highlightFade 1.5s ease-out forwards;
}
@keyframes highlightFade {
  0% { background: var(--el-color-warning-light-7); }
  100% { background: transparent; }
}

.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.w-full { width: 100%; }
</style>
