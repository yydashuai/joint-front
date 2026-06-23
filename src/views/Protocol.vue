<template>
  <div class="page proto">
    <div class="page__header">
      <div>
        <h2>接口协议管理</h2>
        <div class="page__desc">统一管理协议模板与接口定义 · 字段类型 ≥5 种</div>
      </div>
      <el-radio-group v-model="tab" size="default">
        <el-radio-button value="protocol">协议模板</el-radio-button>
        <el-radio-button value="interface">接口定义</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ============ 协议模板 ============ -->
    <div v-show="tab === 'protocol'" class="split">
      <!-- 协议列表 -->
      <el-card class="side" shadow="never" :body-style="listBody">
        <template #header>
          <div class="card-head">
            <span>协议模板</span>
            <el-button size="small" :icon="Plus" @click="store.addProtocol()">新建</el-button>
          </div>
        </template>
        <el-scrollbar>
          <div
            v-for="p in store.protocols"
            :key="p.id"
            class="li"
            :class="{ 'is-active': p.id === store.selectedProtocolId }"
            @click="store.selectedProtocolId = p.id"
          >
            <div class="li__main">
              <div class="li__name">{{ p.name }}</div>
              <div class="li__sub">{{ p.fields.length }} 字段</div>
            </div>
            <el-tag size="small" effect="plain">{{ p.endian === 'big' ? '大端' : '小端' }}</el-tag>
          </div>
          <el-empty v-if="!store.protocols.length" description="暂无协议" :image-size="70" />
        </el-scrollbar>
      </el-card>

      <!-- 字段矩阵 -->
      <el-card v-if="curProto" class="main" shadow="never" :body-style="mainBody">
        <template #header>
          <div class="proto-head">
            <el-input v-model="curProto.name" class="proto-name" placeholder="协议名称" />
            <div class="proto-head__right">
              <span class="lbl">字节序</span>
              <el-select v-model="curProto.endian" style="width: 120px">
                <el-option v-for="e in ENDIANS" :key="e.value" :label="e.label" :value="e.value" />
              </el-select>
              <el-button :icon="Upload" @click="triggerImport">导入</el-button>
              <el-button :icon="Download" @click="exportProto">导出</el-button>
              <el-popconfirm title="删除该协议？" @confirm="store.removeProtocol(curProto.id)">
                <template #reference><el-button :icon="Delete" plain>删除</el-button></template>
              </el-popconfirm>
            </div>
          </div>
        </template>

        <el-input v-model="curProto.desc" placeholder="协议说明（可选）" class="proto-desc" />

        <el-alert v-if="overlapIds.size" type="error" :closable="false" show-icon class="overlap-tip">
          检测到字节段重叠（{{ overlapIds.size }} 个字段），已标红，请检查偏移 / 长度
        </el-alert>

        <el-table
          ref="tableRef"
          :data="curProto.fields"
          row-key="id"
          :tree-props="{ children: 'children' }"
          border
          size="small"
          class="matrix"
        >
          <el-table-column label="字段名" min-width="150" class-name="tree-cell">
            <template #default="{ row }"><el-input v-model="row.name" size="small" /></template>
          </el-table-column>
          <el-table-column label="数据类型" width="130">
            <template #default="{ row }">
              <el-select v-model="row.type" size="small" @change="onTypeChange(row)">
                <el-option v-for="t in FIELD_TYPES" :key="t" :label="t" :value="t" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="子类型 / 绑定" width="150">
            <template #default="{ row }">
              <el-select v-if="row.type === '常量'" v-model="row.dataType" size="small">
                <el-option v-for="d in CONST_SUBTYPES" :key="d" :label="d" :value="d" />
              </el-select>
              <el-select v-else-if="row.type === '位组序流'" v-model="row.protocolRef" size="small" placeholder="选择协议" clearable>
                <el-option v-for="o in otherProtocols" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
              <span v-else class="muted">{{ row.type === '共识体' ? '嵌套结构' : (row.type === '流文件' ? '文本文件' : '表格文件') }}</span>
            </template>
          </el-table-column>
          <el-table-column label="起始字节" width="100">
            <template #default="{ row }"><el-input-number v-model="row.start" :min="0" size="small" controls-position="right" style="width: 88px" :class="{ 'num-warn': overlapIds.has(row.id) }" /></template>
          </el-table-column>
          <el-table-column label="结束字节" width="100">
            <template #default="{ row }"><el-input-number v-model="row.end" :min="0" size="small" controls-position="right" style="width: 88px" :class="{ 'num-warn': overlapIds.has(row.id) }" /></template>
          </el-table-column>
          <el-table-column label="长度" width="72" align="center">
            <template #default="{ row }">
              <span :class="{ 'len-bad': byteLen(row) <= 0 }">{{ byteLen(row) > 0 ? byteLen(row) : '非法' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="140">
            <template #default="{ row }"><el-input v-model="row.desc" size="small" placeholder="—" /></template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button v-if="row.type === '共识体'" text size="small" :icon="Plus" title="加子字段" @click="addChild(row)" />
              <el-button text size="small" :icon="Delete" title="删除" @click="removeProtoField(row.id)" />
            </template>
          </el-table-column>
        </el-table>

        <el-button class="add-row" :icon="Plus" @click="store.addField(curProto)">添加字段</el-button>
      </el-card>
      <el-empty v-else class="main" description="请选择 / 新建协议" />
    </div>

    <!-- ============ 接口定义 ============ -->
    <div v-show="tab === 'interface'" class="split">
      <el-card class="side" shadow="never" :body-style="listBody">
        <template #header>
          <div class="card-head">
            <span>接口列表</span>
            <el-button size="small" :icon="Plus" @click="store.addInterface()">新建</el-button>
          </div>
        </template>
        <el-scrollbar>
          <div
            v-for="it in store.interfaces"
            :key="it.id"
            class="li"
            :class="{ 'is-active': it.id === store.selectedInterfaceId }"
            @click="store.selectedInterfaceId = it.id"
          >
            <div class="li__main">
              <div class="li__name">{{ it.name }}</div>
              <div class="li__sub">入参 {{ it.request.length }} · 出参 {{ it.response.length }}</div>
            </div>
          </div>
          <el-empty v-if="!store.interfaces.length" description="暂无接口" :image-size="70" />
        </el-scrollbar>
      </el-card>

      <el-card v-if="curIf" class="main" shadow="never" :body-style="mainBody">
        <template #header>
          <div class="proto-head">
            <el-input v-model="curIf.name" class="proto-name" placeholder="接口名称" />
            <el-popconfirm title="删除该接口？" @confirm="store.removeInterface(curIf.id)">
              <template #reference><el-button :icon="Delete" plain>删除接口</el-button></template>
            </el-popconfirm>
          </div>
        </template>

        <el-input v-model="curIf.desc" placeholder="接口说明（可选）" class="proto-desc" />

        <div class="sig">签名预览：<code>{{ signature }}</code></div>

        <el-scrollbar class="tree-scroll">
          <div class="struct">
            <div class="struct__head">
              <span class="struct__title">请求结构</span>
              <el-button size="small" :icon="Plus" @click="addRootParam(curIf.request)">添加参数</el-button>
            </div>
            <div class="struct__tree">
              <div v-for="p in curIf.request" :key="p.id" class="struct__row"><FieldNode :node="p" /></div>
              <el-empty v-if="!curIf.request.length" description="无参数" :image-size="60" />
            </div>
          </div>

          <div class="struct">
            <div class="struct__head">
              <span class="struct__title">响应结构</span>
              <el-button size="small" :icon="Plus" @click="addRootParam(curIf.response)">添加字段</el-button>
            </div>
            <div class="struct__tree">
              <div v-for="p in curIf.response" :key="p.id" class="struct__row"><FieldNode :node="p" /></div>
              <el-empty v-if="!curIf.response.length" description="无返回字段" :image-size="60" />
            </div>
          </div>
        </el-scrollbar>
      </el-card>
      <el-empty v-else class="main" description="请选择 / 新建接口" />
    </div>

    <!-- 字段编辑弹窗（接口树用） -->
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
            <el-option v-for="o in store.protocolOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="editing.type === '共识体'" label="提示">
          <span class="muted">可在树上用 ＋ 为其添加子字段</span>
        </el-form-item>
        <el-form-item label="说明"><el-input v-model="editing.desc" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button type="primary" @click="nodeDlg = false">完成</el-button></template>
    </el-dialog>

    <input ref="fileInput" type="file" accept="application/json" hidden @change="onImportFile" />
  </div>
</template>

<script setup>
import { ref, computed, provide, watch, nextTick, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Upload, Download } from '@element-plus/icons-vue'
import { useProtocolStore, FIELD_TYPES, CONST_SUBTYPES, ENDIANS, makeParam } from '@/stores/protocol'
import FieldNode from '@/components/FieldNode.vue'

const store = useProtocolStore()
const tab = ref('protocol')

const listBody = { padding: '0', flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }
const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }

// 默认选中
if (!store.selectedProtocolId) store.selectedProtocolId = store.protocols[0]?.id ?? null
if (!store.selectedInterfaceId) store.selectedInterfaceId = store.interfaces[0]?.id ?? null

const curProto = computed(() => store.selectedProtocol)
const curIf = computed(() => store.selectedInterface)
const otherProtocols = computed(() => store.protocolOptions.filter((o) => o.value !== curProto.value?.id))

/* 类型切换时清理无关字段 */
const onTypeChange = (row) => {
  if (row.type !== '共识体') row.children = []
  if (row.type !== '位组序流') row.protocolRef = null
}

/* 长度（闭区间 [start,end]） */
const byteLen = (row) => row.end - row.start + 1

/* 字节段重叠检测（同层级两两比较，含嵌套各自层级；[start,end] 闭区间） */
const rangeValid = (f) => f.end >= f.start
const rangesOverlap = (a, b) =>
  rangeValid(a) && rangeValid(b) && a.start <= b.end && b.start <= a.end
const collectOverlaps = (list, set) => {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (rangesOverlap(list[i], list[j])) { set.add(list[i].id); set.add(list[j].id) }
    }
  }
  list.forEach((f) => f.children?.length && collectOverlaps(f.children, set))
}
const overlapIds = computed(() => {
  const s = new Set()
  if (curProto.value) collectOverlaps(curProto.value.fields, s)
  return s
})

/* 展开状态：移除 default-expand-all（编辑后会强制展开），改用 toggleRowExpansion 控制初始展开；
   之后 el-table 按 row-key 保留用户的展开/折叠状态，编辑数据不再自动展开 */
const tableRef = ref()
const collectParentRows = (list, rows = []) => {
  list.forEach((f) => { if (f.children?.length) { rows.push(f); collectParentRows(f.children, rows) } })
  return rows
}
const expandParents = async () => {
  await nextTick()
  collectParentRows(curProto.value?.fields || []).forEach((r) => tableRef.value?.toggleRowExpansion(r, true))
}
onMounted(expandParents)
watch(() => store.selectedProtocolId, expandParents)

/* 协议字段矩阵操作 */
const addChild = (row) => {
  store.addField(curProto.value, row)
  nextTick(() => tableRef.value?.toggleRowExpansion(row, true)) // 加子字段时展开父节点
}
const removeProtoField = (id) => removeById([curProto.value.fields], id)

/* 接口树操作 */
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
  onRemove: (node) => removeById([curIf.value.request, curIf.value.response], node.id)
})

// 接口签名预览
const typeShort = (p) => (p.type === '常量' ? p.dataType : p.type)
const signature = computed(() => {
  const it = curIf.value
  if (!it) return ''
  const ret = it.response.map(typeShort).join(', ') || 'void'
  const args = it.request.map((p) => `${typeShort(p)} ${p.name}`).join(', ')
  return `(${ret}) ${it.name}(${args})`
})

/* 导入导出 */
const exportProto = () => {
  const blob = new Blob([JSON.stringify(curProto.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${curProto.value.name || 'protocol'}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出协议模板 JSON')
}
const fileInput = ref()
const triggerImport = () => fileInput.value.click()
const onImportFile = (e) => {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result)
      store.addProtocol({ name: (obj.name || '导入协议') + '(导入)', endian: obj.endian || 'big', desc: obj.desc || '', fields: obj.fields || [] })
      ElMessage.success('协议模板已导入')
    } catch {
      ElMessage.error('文件解析失败，请确认为协议 JSON')
    }
    e.target.value = ''
  }
  reader.readAsText(file)
}
</script>

<style scoped lang="scss">
.proto { height: 100%; }

.split { flex: 1; min-height: 0; display: flex; gap: 16px; }

.card-head { display: flex; align-items: center; justify-content: space-between; }

/* 左列表 */
.side { width: 260px; flex-shrink: 0; display: flex; flex-direction: column; }
.li {
  display: flex; align-items: center; gap: 8px; padding: 11px 14px; cursor: pointer;
  border-left: 3px solid transparent;
  &:hover { background: var(--el-fill-color-light); }
  &.is-active { background: var(--el-color-primary-light-9); border-left-color: var(--el-color-primary); }
  &__main { flex: 1; min-width: 0; }
  &__name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &__sub { font-size: 12px; color: var(--el-text-color-secondary); }
}

/* 右主区 */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; .lbl { font-size: 13px; color: var(--el-text-color-secondary); } }
.proto-desc { margin-bottom: 12px; }
.matrix { flex: 1; }
/* 树形展开符与字段名输入框同行、垂直居中 */
.matrix :deep(.tree-cell .cell) {
  display: flex;
  align-items: center;
  gap: 2px;
}
.matrix :deep(.tree-cell .el-table__expand-icon) { margin: 0; flex-shrink: 0; }
.matrix :deep(.tree-cell .el-table__indent) { flex-shrink: 0; }
.overlap-tip { margin-bottom: 12px; }
.num-warn :deep(.el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
.num-warn :deep(.el-input__inner) { color: var(--el-color-danger); font-weight: 600; }
.len-bad { color: var(--el-color-danger); font-weight: 600; }
.add-row { margin-top: 12px; width: 100%; border-style: dashed; }
.muted { color: var(--el-text-color-secondary); font-size: 13px; }
.w-full { width: 100%; }

/* 接口签名 */
.sig {
  font-size: 13px; color: var(--el-text-color-secondary); margin-bottom: 12px;
  code { color: var(--el-color-primary); background: var(--el-fill-color-light); padding: 2px 8px; border-radius: 4px; }
}

/* 接口结构树 */
.tree-scroll { flex: 1; min-height: 0; }
.struct {
  & + & { margin-top: 8px; }
  &__head { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
  &__title { font-size: 14px; font-weight: 600; padding-left: 8px; border-left: 3px solid var(--el-color-primary); }
  &__tree { display: flex; flex-direction: column; gap: 14px; padding: 8px 4px; }
  &__row { display: flex; }
}
</style>
