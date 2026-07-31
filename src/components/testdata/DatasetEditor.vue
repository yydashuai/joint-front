<template>
  <div class="dataset-editor" tabindex="0" @keydown="onKeydown">
    <!-- ======== 元信息条 (优化点 19: flex-wrap) ======== -->
    <div class="ds-header">
      <div class="ds-header__left">
        <el-input
          v-model="ds.name"
          class="ds-name-input"
          size="large"
          @focus="nameBeforeEdit = ds.name"
          @change="onDatasetNameChange"
        />
      </div>
      <div class="ds-header__right">
        <el-tag v-if="ds.linkedProtocol" type="success" effect="plain" size="small">
          字段：{{ ds.linkedProtocol }}
        </el-tag>
        <el-button
          v-if="ds.linkedInterface"
          type="warning"
          effect="plain"
          size="small"
          class="iface-jump"
          @click="goInterfaceDef(ds.linkedInterface)"
        >
          <el-icon><Link /></el-icon>
          <span>报文：{{ ds.linkedInterface }}</span>
        </el-button>
        <el-tooltip content="基于现有数据模式智能生成新的测试行"><el-button size="small" :icon="MagicStick" @click="showGenDialog = true">智能生成</el-button></el-tooltip>
        <el-tooltip content="跳转到编排计划，快速配置与发送"><el-button v-if="ds.linkedInterface" size="small" type="primary" plain :icon="Promotion" @click="jumpToPlan">跳转到计划</el-button></el-tooltip>
        <el-tooltip content="进入发送测试（实时监控）"><el-button v-if="ds.linkedInterface" size="small" type="success" plain :icon="VideoPlay" @click="sendTest">发送测试</el-button></el-tooltip>
        <el-popconfirm title="确认删除此数据集？" @confirm="onDelete">
          <template #reference>
            <el-button size="small" type="danger" :icon="Delete">删除</el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <!-- ======== 字段参考区 (优化点 20: 视觉区分) ======== -->
    <el-collapse v-if="linkedFields.length" v-model="fieldsRefOpen" class="fields-ref">
      <el-collapse-item name="ref">
        <template #title>
          <span class="fields-ref__title">
            关联{{ ds.linkedProtocol ? '字段' : '报文' }}字段定义
            <el-tag size="small" type="info" effect="plain">{{ linkedFields.length }} 个字段</el-tag>
          </span>
        </template>
        <el-table :data="linkedFields" size="small" max-height="200" border class="fields-ref-table">
          <el-table-column prop="name" label="字段名" min-width="120" />
          <el-table-column label="位范围 / 类型" width="140" align="center">
            <template #default="{ row }">
              <span v-if="row.startBit !== undefined" class="mono">{{ row.startBit }}-{{ row.endBit }}</span>
              <span v-else>{{ row.dataType || row.type }}</span>
            </template>
          </el-table-column>
          <el-table-column label="约束" width="140" align="center">
            <template #default="{ row }">
              <template v-if="row.constraint">
                <span v-if="row.constraint.mode === 'fixed'" class="text-ph">固定 {{ row.constraint.value }}</span>
                <span v-else-if="row.constraint.mode === 'enum'" class="text-enum">
                  {{ (row.constraint.entries || []).map(e => e.label || e).join(' / ') }}
                </span>
                <span v-else class="mono">{{ row.constraint.min }}~{{ row.constraint.max }}</span>
              </template>
              <span v-else class="text-ph">—</span>
            </template>
          </el-table-column>
          <el-table-column prop="desc" label="说明" min-width="160" />
        </el-table>
      </el-collapse-item>
    </el-collapse>

    <!-- ======== 数据矩阵工具栏 ======== -->
    <div class="matrix-toolbar">
      <div class="matrix-toolbar__left">
        <span class="matrix-title">本次数据矩阵</span>
        <el-tooltip v-if="outOfRangeCount > 0" content="超出约束范围的单元格数">
          <el-tag size="small" type="danger" effect="dark">超限 {{ outOfRangeCount }}</el-tag>
        </el-tooltip>
      </div>
      <div class="matrix-toolbar__right">
        <!-- 批量操作 -->
        <template v-if="selectedRows.length > 0">
          <el-tag size="small" type="warning" effect="plain">已选 {{ selectedRows.length }} 行</el-tag>
          <el-popconfirm :title="`确认删除 ${selectedRows.length} 行？`" @confirm="onBatchDelete">
            <template #reference>
              <el-button size="small" type="danger" text :icon="Delete">批量删除</el-button>
            </template>
          </el-popconfirm>
        </template>
        <el-popconfirm v-if="ds.rows.length > 0" title="确认清空所有行？" @confirm="onClearRows">
          <template #reference>
            <el-button size="small" text type="warning">清空</el-button>
          </template>
        </el-popconfirm>
        <el-input
          v-model="rowSearch"
          placeholder="搜索行..."
          :prefix-icon="Search"
          size="small"
          clearable
          style="width: 180px;"
        />
      </div>
    </div>

    <!-- ======== 空数据集引导 (优化点 23) ======== -->
    <div v-if="dynamicFields.length === 0" class="empty-guide">
      <el-empty :image-size="60" description="此数据集尚未关联字段或报文，暂无数据列">
        <template #description>
          <p>请删除后重新创建并关联字段/报文，或手动添加列。</p>
        </template>
      </el-empty>
    </div>

    <!-- ======== 数据矩阵表格 (核心) ======== -->
    <div v-else class="ds-matrix">
      <div class="matrix-table-shell">
        <el-table
          ref="tableRef"
          class="matrix-table"
          :data="displayRows"
          size="small"
          border
          row-key="id"
          :row-class-name="rowClassName"
          @selection-change="onSelectionChange"
          @row-contextmenu="onRowContextMenu"
          style="width: 100%;"
          height="100%"
        >
        <!-- 选择列 (优化点 2) -->
        <el-table-column type="selection" width="40" fixed="left" align="center" />
        <!-- 拖拽手柄列 (优化点 3) -->
        <el-table-column width="36" align="center" fixed="left" class-name="drag-col">
          <template #default>
            <span class="drag-handle" title="拖拽排序">⠿</span>
          </template>
        </el-table-column>
        <!-- 序号列 (优化点 1: fixed) -->
        <el-table-column type="index" width="48" align="center" label="#" fixed="left" />
        <!-- 行标签列 (优化点 1: fixed) -->
        <el-table-column label="行标签" width="150" fixed="left">
          <template #default="{ row }">
            <div class="label-cell">
              <span v-if="dirtyRowIds.has(row.id)" class="dirty-dot" title="已修改"></span>
              <el-input
                v-model="row.label"
                size="small"
                @change="(v) => tdStore.updateRowLabel(ds.id, row.id, v)"
              />
            </div>
          </template>
        </el-table-column>

        <!-- 动态字段列 -->
        <el-table-column
          v-for="field in matrixFields"
          :key="field.name"
          :min-width="fieldColWidth(field)"
          :class-name="isFieldFixed(field) ? 'fixed-col' : ''"
        >
          <template #header>
            <el-tooltip placement="top" :show-after="150">
              <template #content>
                <div class="field-tip">{{ fieldTooltipText(field) }}</div>
              </template>
              <div class="field-col-header">
                <div class="field-col-header__name">
                  <el-icon v-if="isFieldFixed(field)" class="lock-icon"><Lock /></el-icon>
                  {{ field.name }}
                </div>
                <div class="field-col-header__type">{{ fieldHint(field) }}</div>
              </div>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <!-- 固定值 (优化点 4: 更紧凑) -->
            <template v-if="isFieldFixed(field)">
              <span class="fixed-value">{{ field.constraint.value }}</span>
            </template>
            <!-- 枚举字段 → Select (优化点 5) -->
            <template v-else-if="isFieldEnum(field)">
              <el-select
                :model-value="row.values[field.name]"
                @update:model-value="(v) => onValueChange(row, field.name, v)"
                size="small"
                style="width: 100%;"
              >
                <el-option
                  v-for="entry in field.constraint.entries"
                  :key="entry.value ?? entry"
                  :label="entry.label || String(entry)"
                  :value="entry.value ?? entry"
                />
              </el-select>
            </template>
            <!-- 数值字段 → InputNumber (优化点 6: 校验) -->
            <template v-else-if="isFieldNumeric(field)">
              <el-input-number
                :model-value="row.values[field.name]"
                @update:model-value="(v) => onValueChange(row, field.name, v)"
                :min="field.constraint?.min"
                :max="field.constraint?.max"
                size="small"
                controls-position="right"
                :class="{ 'cell-invalid': isCellInvalid(row, field) }"
                style="width: 100%;"
              />
            </template>
            <!-- 文本字段 → Input -->
            <template v-else>
              <el-input
                :model-value="row.values[field.name]"
                @update:model-value="(v) => onValueChange(row, field.name, v)"
                size="small"
              />
            </template>
          </template>
        </el-table-column>

        <!-- 删除行 -->
        <el-table-column label="" width="50" align="center" fixed="right">
          <template #default="{ row }">
            <el-popconfirm title="确认删除该行？" @confirm="tdStore.removeRow(ds.id, row.id)">
              <template #reference><el-button class="row-delete-btn" type="danger" text size="small" :icon="Delete" /></template>
            </el-popconfirm>
          </template>
        </el-table-column>
        </el-table>
      </div>

      <el-tooltip content="添加一行新的测试数据 (Ctrl+N)"><el-button class="add-row-btn" text type="primary" :icon="Plus" @click="onAddRow">
        添加测试行
        <span class="shortcut-hint">Ctrl+N</span>
      </el-button></el-tooltip>
    </div>

    <div v-if="dynamicFields.length" class="history-section">
      <div class="history-toolbar">
        <div class="history-toolbar__left">
          <span class="matrix-title">历史数据</span>
        </div>
        <div class="history-toolbar__right">
          <template v-if="selectedHistoryRows.length > 0">
            <el-tag size="small" type="warning" effect="plain">已选 {{ selectedHistoryRows.length }} 行</el-tag>
            <el-button size="small" type="primary" @click="onUseHistoryRows">带入本次数据</el-button>
            <el-popconfirm :title="`确认删除 ${selectedHistoryRows.length} 条历史数据？`" @confirm="onDeleteSelectedHistoryRows">
              <template #reference>
                <el-button size="small" text type="danger" :icon="Delete">删除选中</el-button>
              </template>
            </el-popconfirm>
          </template>
        </div>
      </div>

      <div class="history-table-shell">
        <el-table
          ref="historyTableRef"
          class="matrix-table history-table"
          :data="historyRows"
          size="small"
          border
          row-key="id"
          empty-text="暂无历史数据"
          style="width: 100%;"
          height="100%"
          @selection-change="onHistorySelectionChange"
        >
          <el-table-column type="selection" width="40" fixed="left" align="center" />
          <el-table-column type="index" width="48" align="center" label="#" fixed="left" />
          <el-table-column label="行标签" width="170" fixed="left" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="readonly-cell">{{ row.label }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-for="field in matrixFields"
            :key="`history-${field.name}`"
            :min-width="fieldColWidth(field)"
            :class-name="isFieldFixed(field) ? 'fixed-col' : ''"
            show-overflow-tooltip
          >
            <template #header>
              <el-tooltip placement="top" :show-after="150">
                <template #content>
                  <div class="field-tip">{{ fieldTooltipText(field) }}</div>
                </template>
                <div class="field-col-header">
                  <div class="field-col-header__name">
                    <el-icon v-if="isFieldFixed(field)" class="lock-icon"><Lock /></el-icon>
                    {{ field.name }}
                  </div>
                  <div class="field-col-header__type">{{ fieldHint(field) }}</div>
                </div>
              </el-tooltip>
            </template>
            <template #default="{ row }">
              <span class="readonly-cell">{{ readonlyCellValue(row, field) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="56" align="center" fixed="right">
            <template #default="{ row }">
              <el-popconfirm title="确认删除该历史数据？" @confirm="onDeleteHistoryRow(row)">
                <template #reference>
                  <el-button class="row-delete-btn" type="danger" text size="small" :icon="Delete" />
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- ======== 数据预览 (优化点 24: 复制按钮) ======== -->
    <el-collapse v-model="previewOpen" class="ds-preview">
      <el-collapse-item name="preview">
        <template #title>
          <span class="fields-ref__title">
            数据预览（JSON）
          </span>
        </template>
        <div class="preview-toolbar">
          <el-button size="small" text type="primary" @click="copyJson">复制到剪贴板</el-button>
        </div>
        <pre class="preview-json">{{ previewJson }}</pre>
      </el-collapse-item>
    </el-collapse>

    <!-- ======== 智能生成对话框 ======== -->
    <el-dialog
      v-model="showGenDialog"
      title="智能生成测试数据"
      width="640px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div class="gen-dialog">
        <div class="gen-form__row">
          <label class="gen-label">目标数据集</label>
          <el-tag type="success" effect="plain">{{ ds.name }}</el-tag>
        </div>
        <div class="gen-form__row">
          <label class="gen-label">生成数量</label>
          <el-input-number v-model="genCount" :min="1" :max="20" :step="1" style="width: 140px;" />
        </div>
        <div class="gen-form__row">
          <label class="gen-label">生成类型</label>
          <el-radio-group v-model="genMode">
            <el-radio value="normal">正常数据</el-radio>
            <el-radio value="abnormal">异常数据</el-radio>
            <el-radio value="mixed">混合数据</el-radio>
          </el-radio-group>
        </div>

        <div v-if="genPreview.length > 0" class="gen-preview">
          <div class="gen-preview__header">
            <span>生成预览</span>
            <el-tag size="small" type="success" effect="plain">{{ genPreview.length }} 条</el-tag>
          </div>
          <el-table :data="genPreview" size="small" border max-height="220" style="width: 100%;" :row-class-name="genPreviewRowClass">
            <el-table-column prop="label" label="标签" width="120" fixed="left" />
            <el-table-column
              v-for="field in genPreviewFields"
              :key="`gen-${field.name}`"
              :label="field.name"
              :min-width="fieldColWidth(field)"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="mono gen-value">{{ formatGenValue(row.values?.[field.name]) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="showGenDialog = false">取消</el-button>
        <el-button type="primary" @click="onGenerate">生成并预览</el-button>
        <el-button type="success" :disabled="genPreview.length === 0" @click="onConfirmGenerate">确认添加到本次数据</el-button>
      </template>
    </el-dialog>

    <!-- 行右键菜单 -->
    <teleport to="body">
      <div v-if="rowCtx.visible" class="row-ctx-mask" @click="closeRowCtx" @contextmenu.prevent="closeRowCtx">
        <ul class="row-ctx-menu" :style="{ left: rowCtx.x + 'px', top: rowCtx.y + 'px' }" @click.stop>
          <li class="danger" @click="confirmCtxDelete">删除此行</li>
        </ul>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  Download, Delete, Plus, Lock, Search, MagicStick, Link, Promotion, VideoPlay
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { exportCsvFile, exportJsonFile } from '@/services/testDataService'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

const props = defineProps({
  dataset: { type: Object, required: true }
})

const emit = defineEmits(['delete', 'duplicate'])

const tdStore = useTestDataStore()
const protoStore = useProtocolStore()
const connStore = useConnectionStore()
const { nextUniqueName, validateName } = useEntityNameGuard()
const router = useRouter()

const ds = computed(() => props.dataset)
const nameBeforeEdit = ref('')
const onDatasetNameChange = () => {
  const validName = validateName(ds.value.name, ds.value, '数据集')
  if (!validName) {
    ds.value.name = nameBeforeEdit.value || nextUniqueName('新建数据集', ds.value)
    return
  }
  tdStore.updateDataset(ds.value.id, { name: validName })
}

/* ========== 报文定义跳转（数据集针对报文，而非字段） ========== */
const goInterfaceDef = (ifaceName) => {
  const iface = protoStore.interfaces.find(i => i.name === ifaceName)
  if (!iface) {
    ElMessage.warning('未找到对应的报文定义')
    return
  }
  protoStore.selectedInterfaceId = iface.id
  // 带 query 跳转，Protocol.vue 据此切换到报文视图并选中
  router.push({ path: '/protocol', query: { kind: 'interface', iface: String(iface.id) } })
}

/* ========== 跳转到计划 / 发送测试（操作于数据集关联的报文） ========== */
const jumpToPlan = () => {
  const iface = protoStore.interfaces.find(i => i.name === ds.value.linkedInterface)
  if (!iface) { ElMessage.warning('未找到关联的报文定义'); return }
  router.push({ path: '/execution', query: { interfaceId: String(iface.id) } })
  ElMessage.success('已跳转到编排计划，可快速配置与发送')
}
const sendTest = () => {
  const message = protoStore.interfaces.find(i => i.name === ds.value.linkedInterface)
  if (!message) {
    ElMessage.warning('未找到关联的报文定义')
    return
  }
  const systemId = ds.value.systemId || message.systemId
  const module = connStore.nodes.find(item =>
    String(item.systemId) === String(systemId) &&
    item.name === ds.value.moduleName
  )
  const moduleId = module?.id || message.moduleId
  if (!systemId || !moduleId) {
    ElMessage.warning('当前数据集缺少所属系统或模块，无法创建发送接口')
    return
  }
  const testInterface = protoStore.addTestInterface({
    name: `${ds.value.name}发送接口`,
    systemId,
    moduleId,
    datasetIds: [ds.value.id],
    desc: `由数据集「${ds.value.name}」快捷发送测试自动创建`,
    sendInterval: 500,
  })
  ElMessage.success(`已创建接口「${testInterface.name}」，正在加入发送监控`)
  router.push({
    path: '/execution',
    query: { interfaceId: String(testInterface.id), test: '1' },
  })
}

/* ========== 字段解析 ========== */
// 展平字段字段树（byte/bit/repeat 嵌套 → 平面列表）
const flattenProtoFields = (fields) => {
  const result = []
  fields.forEach(f => {
    if (f.kind === 'byte') {
      if (f.bitMode && f.children?.length) {
        f.children.forEach(bit => {
          if (bit.name) result.push({ name: bit.name, dataType: bit.dataType, constraint: bit.constraint, desc: bit.desc, startBit: bit.bitStart, endBit: bit.bitEnd })
        })
      } else if (f.name) {
        result.push({ name: f.name, dataType: f.dataType, constraint: f.constraint, desc: f.desc, byteLength: f.byteLength })
      }
    } else if (f.kind === 'bit' && f.name) {
      result.push({ name: f.name, dataType: f.dataType, constraint: f.constraint, desc: f.desc, startBit: f.bitStart, endBit: f.bitEnd })
    } else if (f.kind === 'repeat' && f.children?.length) {
      result.push(...flattenProtoFields(f.children))
    }
  })
  return result
}

const linkedFields = computed(() => {
  const d = ds.value
  if (!d) return []
  if (d.linkedInterface) {
    // 数据集针对报文（interface）：收集 request 参数 + protocolRefs 引用字段，
    // 兼容 migrateAllFromV1 前后（迁移后 request 被清空，字段由 protocolRefs 内联协议提供）。
    const iface = protoStore.interfaces.find(i => i.name === d.linkedInterface)
    if (!iface) return []
    const fields = collectInterfaceDatasetFields(iface, protoStore.protocols)
    // 过滤到数据集行键，避免 protocolRefs 中不相关字段产生多余列
    const keys = d.rows?.length ? Object.keys(d.rows[0].values)
      : d.historyRows?.length ? Object.keys(d.historyRows[0].values) : null
    if (!keys) return fields
    const keySet = new Set(keys)
    return fields.filter(f => keySet.has(f.name))
  }
  if (d.linkedProtocol) {
    // 退化：直接关联字段协议
    const proto = protoStore.protocols.find(p => p.name === d.linkedProtocol)
    if (!proto) return []
    const fields = proto.fields?.length ? proto.fields : proto.config?.fields
    if (!fields?.length) return []
    return flattenProtoFields(fields)
  }
  return []
})

const dynamicFields = computed(() => {
  if (linkedFields.value.length) return linkedFields.value
  const d = ds.value
  if (d.rows.length) {
    return Object.keys(d.rows[0].values).map(k => ({ name: k, constraint: null }))
  }
  if (d.historyRows?.length) {
    return Object.keys(d.historyRows[0].values).map(k => ({ name: k, constraint: null }))
  }
  return []
})
// 数据矩阵仅展示可编辑字段：固定值（constraint.mode === 'fixed'）由系统锁定，不在矩阵中显示
const matrixFields = computed(() => dynamicFields.value.filter(f => !isFieldFixed(f)))
/* ========== 数据集统计 ========== */
const outOfRangeCount = computed(() => {
  const d = ds.value
  let count = 0
  for (const row of d.rows) {
    for (const f of matrixFields.value) {
      const c = f.constraint
      if (!c) continue
      const v = Number(row.values?.[f.name])
      if (Number.isNaN(v)) continue
      if (c.mode === 'range' && (v < c.min || v > c.max)) count++
      else if (c.mode === 'enum' && !(c.entries || []).some(e => String(e.value ?? e) === String(v))) count++
    }
  }
  return count
})

/* ========== 字段类型判断 ========== */
const isFieldFixed = (f) => f.constraint?.mode === 'fixed'
const isFieldEnum = (f) => f.constraint?.mode === 'enum' && f.constraint.entries?.length
const isFieldNumeric = (f) => f.constraint?.mode === 'range'

const fieldColWidth = (f) => {
  if (isFieldFixed(f)) return 80
  if (isFieldEnum(f)) return 140
  if (['流文件', '结构矩阵', 'file', 'matrix'].includes(f.dataType || f.type)) return 240
  return isFieldNumeric(f) ? 150 : 130
}

const fieldHint = (f) => {
  if (f.constraint?.mode === 'fixed') return `固定 ${f.constraint.value}`
  if (f.constraint?.mode === 'enum') return (f.constraint.entries || []).map(e => e.label || e).join('/')
  if (f.constraint?.mode === 'range') return `${f.constraint.min}~${f.constraint.max}`
  if (f.dataType) return f.dataType
  if (f.type) return f.type
  return ''
}

// 字段列头悬浮提示：字段名 + 说明 + 约束范围，方便测试人员核对
const fieldTooltipText = (field) => {
  const lines = [`字段：${field.name}`]
  if (field.desc) lines.push('说明：' + field.desc)
  const c = field.constraint
  if (c?.mode === 'fixed') lines.push('约束：固定值 ' + c.value)
  else if (c?.mode === 'enum') lines.push('约束：枚举 ' + (c.entries || []).map(e => e.label || e).join(' / '))
  else if (c?.mode === 'range') lines.push('约束：范围 ' + c.min + ' ~ ' + c.max)
  else lines.push('约束：无（自由值）')
  return lines.join('\n')
}

const readonlyCellValue = (row, field) => {
  const value = row.values?.[field.name]
  if (value !== undefined && value !== null && value !== '') return value
  if (isFieldFixed(field)) return field.constraint.value
  return '—'
}

/* ========== 单元格校验 (优化点 6) ========== */
const isCellInvalid = (row, field) => {
  if (!field.constraint || field.constraint.mode !== 'range') return false
  const val = row.values[field.name]
  if (val == null || val === '') return false
  const num = Number(val)
  if (isNaN(num)) return true
  return num < field.constraint.min || num > field.constraint.max
}

/* ========== 脏数据标记 (优化点 7) ========== */
const originalSnapshot = ref(new Map()) // rowId → JSON string
const dirtyRowIds = ref(new Set())

const takeSnapshot = () => {
  const snap = new Map()
  ds.value.rows.forEach(r => snap.set(r.id, JSON.stringify(r)))
  originalSnapshot.value = snap
  dirtyRowIds.value = new Set()
}

const checkDirty = (row) => {
  const orig = originalSnapshot.value.get(row.id)
  if (!orig) { dirtyRowIds.value.add(row.id); return }
  if (JSON.stringify(row) !== orig) dirtyRowIds.value.add(row.id)
  else dirtyRowIds.value.delete(row.id)
}

const onValueChange = (row, fieldName, value) => {
  tdStore.updateRowValue(ds.value.id, row.id, fieldName, value)
  checkDirty(row)
}

/* ========== 行搜索 (优化点 12) ========== */
const rowSearch = ref('')
const displayRows = computed(() => {
  if (!rowSearch.value) return ds.value.rows
  const kw = rowSearch.value.toLowerCase()
  return ds.value.rows.filter(r => {
    if (r.label?.toLowerCase().includes(kw)) return true
    return Object.values(r.values).some(v => String(v).toLowerCase().includes(kw))
  })
})

/* ========== 批量选择 (优化点 2) ========== */
const selectedRows = ref([])
const onSelectionChange = (rows) => { selectedRows.value = rows }
const onBatchDelete = () => {
  tdStore.removeRowsBatch(ds.value.id, selectedRows.value.map(r => r.id))
  selectedRows.value = []
  ElMessage.success('已删除选中行')
}

const historyTableRef = ref(null)
const selectedHistoryRows = ref([])
const historyRows = computed(() => ds.value.historyRows || [])
const onHistorySelectionChange = (rows) => { selectedHistoryRows.value = rows }

const onUseHistoryRows = () => {
  if (selectedHistoryRows.value.length === 0) return
  const count = selectedHistoryRows.value.length
  const lastSelected = selectedRows.value[selectedRows.value.length - 1]
  tdStore.insertRowsAfter(ds.value.id, lastSelected?.id ?? null, selectedHistoryRows.value)
  selectedHistoryRows.value = []
  historyTableRef.value?.clearSelection?.()
  nextTick(() => takeSnapshot())
  ElMessage.success(`已带入 ${count} 行历史数据`)
}

const onDeleteHistoryRow = (row) => {
  tdStore.removeHistoryRow(ds.value.id, row.id)
  selectedHistoryRows.value = selectedHistoryRows.value.filter(item => item.id !== row.id)
  ElMessage.success('历史数据已删除')
}

const onDeleteSelectedHistoryRows = () => {
  const count = selectedHistoryRows.value.length
  if (!count) return
  tdStore.removeHistoryRowsBatch(ds.value.id, selectedHistoryRows.value.map(r => r.id))
  selectedHistoryRows.value = []
  historyTableRef.value?.clearSelection?.()
  ElMessage.success(`已删除 ${count} 条历史数据`)
}

/* ========== 智能生成 ========== */
const showGenDialog = ref(false)
const genCount = ref(5)
const genMode = ref('normal') // normal | abnormal | mixed
const genPreview = ref([])
const genPreviewFields = computed(() => {
  const keys = Object.keys(genPreview.value[0]?.values || {})
  const keySet = new Set(keys)
  const ordered = dynamicFields.value.filter(field => keySet.has(field.name))
  const known = new Set(ordered.map(field => field.name))
  return [
    ...ordered,
    ...keys.filter(name => !known.has(name)).map(name => ({ name, constraint: null })),
  ]
})

const onGenerate = () => {
  const result = tdStore.generateTestData(ds.value.id, genCount.value, genMode.value)
  genPreview.value = result
  if (result.length === 0) {
    ElMessage.warning('未能生成新数据，请检查数据集是否包含有效数据行')
  } else {
    const labelMap = { normal: '正常', abnormal: '异常', mixed: '混合' }
    ElMessage.success(`已生成 ${result.length} 条${labelMap[genMode.value]}测试数据，请预览确认`)
  }
}

const onConfirmGenerate = () => {
  if (genPreview.value.length === 0) return
  // 添加到本次数据矩阵（rows），供编辑 / 发送
  const newRows = genPreview.value.map(r => ({
    id: Date.now() + Math.random() * 1000,
    label: r.label,
    values: { ...r.values },
    source: r.source || '智能生成'
  }))
  tdStore.insertRowsAfter(ds.value.id, null, newRows)
  // 同步写入历史数据：来源标记为「智能生成」，异常状态按字段定义实时判定，
  // 以便后续在历史数据管理中按来源筛选、并按正常 / 异常分类查看
  const historyPayload = newRows.map(r => ({
    label: r.label,
    values: r.values,
    source: '智能生成',
    abnormal: tdStore.computeAbnormal(r.values, ds.value.id)
  }))
  tdStore.addHistoryRows(ds.value.id, historyPayload)
  nextTick(() => takeSnapshot())
  ElMessage.success(`已将 ${genPreview.value.length} 条智能生成数据添加到本次数据矩阵，并同步至历史数据（来源：智能生成）`)
  genPreview.value = []
  showGenDialog.value = false
}

const formatGenValue = (value) => {
  if (value === undefined || value === null || value === '') return '—'
  return typeof value === 'object' ? JSON.stringify(value) : value
}

// 生成预览中异常行标红（按字段定义实时判定）
const genPreviewRowClass = ({ row }) => tdStore.computeAbnormal(row.values, ds.value.id) ? 'gen-abnormal-row' : ''

/* ========== 行右键菜单 ========== */
const rowCtx = reactive({ visible: false, x: 0, y: 0, row: null })

const onRowContextMenu = (row, _column, event) => {
  event.preventDefault()
  Object.assign(rowCtx, {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    row
  })
}
const closeRowCtx = () => { rowCtx.visible = false }

const onCtxDeleteRow = () => {
  if (!rowCtx.row) return
  tdStore.removeRow(ds.value.id, rowCtx.row.id)
  closeRowCtx()
}

const confirmCtxDelete = () => {
  if (!rowCtx.row) return
  const rowId = rowCtx.row.id
  closeRowCtx()
  ElMessageBox.confirm('确认删除该行？', '确认', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  }).then(() => {
    tdStore.removeRow(ds.value.id, rowId)
  }).catch(() => {})
}

const onClearRows = () => {
  tdStore.clearRows(ds.value.id)
  nextTick(() => takeSnapshot())
  ElMessage.success('已清空所有行')
}

watch(() => ds.value.id, () => {
  tdStore.ensureHistoryRows(ds.value.id)
  nextTick(() => takeSnapshot())
  rowSearch.value = ''
  selectedRows.value = []
  selectedHistoryRows.value = []
  historyTableRef.value?.clearSelection?.()
}, { immediate: true })

/* ========== 拖拽排序 (优化点 3) ========== */
const tableRef = ref(null)
let sortableInstance = null

const initSortable = () => {
  if (sortableInstance) { sortableInstance.destroy(); sortableInstance = null }
  const el = tableRef.value?.$el
  if (!el) return
  const tbody = el.querySelector('.el-table__body-wrapper tbody')
  if (!tbody) return
  // 搜索过滤时禁用拖拽，避免索引错位 (Bug fix)
  if (rowSearch.value) return
  sortableInstance = Sortable.create(tbody, {
    handle: '.drag-handle',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex === newIndex) return
      const rows = [...ds.value.rows]
      const [moved] = rows.splice(oldIndex, 1)
      rows.splice(newIndex, 0, moved)
      tdStore.reorderRows(ds.value.id, rows)
      // 重排后重置脏标记快照
      nextTick(() => takeSnapshot())
    }
  })
}

onMounted(() => { nextTick(initSortable) })
onBeforeUnmount(() => { sortableInstance?.destroy() })

watch(() => ds.value.rows.length, () => { nextTick(initSortable) })
watch(rowSearch, () => { nextTick(initSortable) })

/* ========== 行样式 (优化点 7) ========== */
const rowClassName = ({ row }) => {
  return dirtyRowIds.value.has(row.id) ? 'dirty-row' : ''
}

/* ========== 操作 ========== */
const onAddRow = () => {
  tdStore.addRow(ds.value.id)
  nextTick(() => takeSnapshot())
}

const onDelete = () => {
  emit('delete', ds.value.id)
}

const onDuplicate = () => {
  const dup = tdStore.duplicateDataset(ds.value.id)
  if (dup) {
    emit('duplicate', dup)
    ElMessage.success('数据集已复制')
  }
}

/* ========== 导出 (优化点 9, 10, 11) ========== */
const validateBeforeExport = () => {
  const d = ds.value
  if (!d.rows.length) {
    ElMessage.warning('数据集为空，无法导出')
    return false
  }
  // 检查是否有无效值
  let invalidCount = 0
  d.rows.forEach(row => {
    dynamicFields.value.forEach(field => {
      if (isCellInvalid(row, field)) invalidCount++
    })
  })
  if (invalidCount > 0) {
    ElMessage.warning(`有 ${invalidCount} 个单元格值超出约束范围，导出后可能不准确`)
  }
  return true
}

const onExportCsv = () => {
  if (!validateBeforeExport()) return
  const fieldNames = dynamicFields.value.map(f => f.name)
  exportCsvFile(ds.value.rows, fieldNames, `${ds.value.name}.csv`)
  ElMessage.success('CSV 导出成功')
}

const onExportJson = () => {
  if (!validateBeforeExport()) return
  const data = ds.value.rows.map(r => ({
    label: r.label,
    ...r.values
  }))
  exportJsonFile(data, `${ds.value.name}.json`)
  ElMessage.success('JSON 导出成功')
}

/* ========== JSON 预览 ========== */
const fieldsRefOpen = ref([]) // 默认折叠，不展开
const previewOpen = ref([])

const previewJson = computed(() => {
  const d = ds.value
  if (!d || !d.rows.length) return '[]'
  return JSON.stringify(d.rows.map(r => ({ label: r.label, ...r.values })), null, 2)
})

const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(previewJson.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选中复制')
  }
}

/* ========== 快捷键 (优化点 21) ========== */
const onKeydown = (e) => {
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault()
    onAddRow()
  }
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    onExportCsv()
  }
  if (e.key === 'Delete' && selectedRows.value.length > 0) {
    e.preventDefault()
    const count = selectedRows.value.length
    ElMessageBox.confirm(`确认删除 ${count} 行？`, '删除确认', {
      confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning'
    }).then(() => {
      onBatchDelete()
    }).catch(() => {})
  }
}
</script>

<style scoped lang="scss">
.dataset-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  outline: none;
}

/* ======== 元信息条 ======== */
.ds-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;

  &__left {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
    max-width: 50%;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}

/* 报文名跳转按钮 */
.iface-jump {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.ds-name-input {
  :deep(.el-input__wrapper) {
    box-shadow: none;
    padding: 0;
  }
  :deep(.el-input__inner) {
    font-size: 17px;
    font-weight: 600;
  }
}

/* ======== 字段参考区 (优化点 20: 背景区分) ======== */
.fields-ref {
  flex-shrink: 0;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  padding: 0 4px;

  :deep(.el-collapse-item__header) {
    height: 36px;
    font-size: 13px;
    background: transparent;
  }
  :deep(.el-collapse-item__wrap) {
    background: transparent;
  }
}

.fields-ref__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.fields-ref-table {
  background: transparent;
}

.text-enum {
  font-size: 12px;
  color: var(--el-color-primary);
}

/* ======== 矩阵工具栏 ======== */
.matrix-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.matrix-title {
  font-size: 14px;
  font-weight: 600;
}

/* ======== 空引导 (优化点 23) ======== */
.empty-guide {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ======== 数据矩阵 ======== */
.ds-matrix {
  flex: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.matrix-table-shell {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
}

.matrix-table {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.ds-matrix :deep(.el-table__inner-wrapper),
.ds-matrix :deep(.el-table__body-wrapper) {
  min-height: 0;
}

.ds-matrix :deep(.el-scrollbar__bar.is-horizontal),
.ds-matrix :deep(.el-scrollbar__bar.is-vertical) {
  opacity: 1;
}

.history-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 280px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}

.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.history-table-shell {
  height: 240px;
  min-height: 220px;
  overflow: hidden;
}

.history-table :deep(.el-table__inner-wrapper),
.history-table :deep(.el-table__body-wrapper) {
  min-height: 0;
}

.readonly-cell {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.4;
}

/* 拖拽手柄 */
.drag-handle {
  cursor: grab;
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  user-select: none;
  &:active { cursor: grabbing; }
}

.drag-col {
  cursor: default;
}

/* 标签单元格 */
.label-cell {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 脏数据标记 (优化点 7) */
.dirty-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-warning);
  flex-shrink: 0;
}

:deep(.dirty-row) {
  background-color: rgba(230, 162, 60, 0.06) !important;
}

/* 固定值列 (优化点 4) */
.fixed-col {
  background: var(--el-fill-color-lighter) !important;
}

.lock-icon {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-right: 2px;
  vertical-align: middle;
}

/* 字段列头 */
.field-col-header {
  display: flex;
  flex-direction: column;
  line-height: 1.3;

  &__name {
    font-size: 13px;
    font-weight: 600;
  }

  &__type {
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    font-family: 'Consolas', 'Monaco', monospace;
  }
}

/* 字段列头悬浮提示（支持多行） */
.field-tip {
  white-space: pre-line;
  line-height: 1.6;
  font-size: 12px;
}

.fixed-value {
  color: var(--el-text-color-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.row-delete-btn {
  min-width: 24px;
  padding-left: 4px;
  padding-right: 4px;
}

.row-delete-btn :deep(.el-icon) {
  margin: 0;
}

/* 单元格无效 (优化点 6) */
.cell-invalid {
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset;
  }
}

/* 添加行按钮 */
.add-row-btn {
  margin-top: 8px;
  align-self: flex-start;
}

.shortcut-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: 6px;
}

/* 拖拽 ghost */
:deep(.sortable-ghost) {
  opacity: 0.4;
  background: var(--el-color-primary-light-9) !important;
}

/* ======== 数据预览 ======== */
.ds-preview {
  flex-shrink: 0;
  :deep(.el-collapse-item__header) {
    height: 36px;
  }
}

.preview-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.preview-json {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 300px;
  overflow: auto;
  white-space: pre;
}

/* 行右键菜单 */
.row-ctx-mask { position: fixed; inset: 0; z-index: 3000; }
.row-ctx-menu {
  position: fixed;
  min-width: 180px;
  padding: 4px 0;
  background: var(--el-bg-color-overlay, #fff);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
  font-size: 13px;
  li {
    list-style: none;
    padding: 7px 16px;
    cursor: pointer;
    color: var(--el-text-color-primary);
    &:hover { background: var(--el-fill-color-light); }
    &.danger { color: var(--el-color-danger); }
    &.disabled { color: var(--el-text-color-placeholder); pointer-events: none; }
    &.ctx-sep { height: 1px; padding: 0; margin: 4px 8px; background: var(--el-border-color-lighter); cursor: default; pointer-events: none; }
  }
}

/* ======== 智能生成对话框 ======== */
.gen-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.gen-form__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gen-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  min-width: 80px;
  flex-shrink: 0;
}

.gen-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.gen-strategies {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.gen-preview {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-fill-color-lighter);

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
  }
}

.gen-preview .mono {
  font-family: 'Consolas', 'Monaco', monospace;
}

.gen-preview .gen-value {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

:deep(.gen-abnormal-row) > td {
  background-color: rgba(245, 108, 108, 0.14) !important;
}

:deep(.gen-abnormal-row:hover) > td {
  background-color: rgba(245, 108, 108, 0.22) !important;
}
</style>
