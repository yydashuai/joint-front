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
          <el-button size="small" text @click="clearCurrentSelection">取消勾选</el-button>
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

    <!-- ======== 数据列表（精简：一行一条，点击进入行编辑抽屉） ======== -->
    <div v-else class="ds-matrix">
      <div class="matrix-table-shell">
        <TableRangeSelection
          ref="matrixRangeRef"
          :rows="displayRows"
          row-key="id"
          @selection-change="onSelectionChange"
        >
          <template #default="{ setTableRef, handleSelectionChange, handleScroll }">
        <el-table
          :ref="(instance) => bindMatrixTable(instance, setTableRef)"
          class="matrix-table"
          :data="displayRows"
          size="small"
          border
          row-key="id"
          :row-class-name="rowClassName"
          @selection-change="handleSelectionChange"
          @scroll="handleScroll"
          @row-contextmenu="onRowContextMenu"
          style="width: 100%;"
          height="100%"
        >
        <!-- 选择列 -->
        <el-table-column type="selection" width="40" fixed="left" align="center" />
        <!-- 拖拽手柄列（排序） -->
        <el-table-column width="36" align="center" fixed="left" class-name="drag-col">
          <template #default>
            <span class="drag-handle" title="拖拽排序">⠿</span>
          </template>
        </el-table-column>
        <!-- 序号列 -->
        <el-table-column type="index" width="48" align="center" label="#" fixed="left" />
        <!-- 数据摘要列（前 4 个字段值，悬浮看完整） -->
        <el-table-column label="数据摘要" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="readonly-cell summary-cell">{{ summaryOf(row) }}</span>
          </template>
        </el-table-column>
        <!-- 状态列（超限标记） -->
        <el-table-column label="状态" width="92" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="rowOutOfRange(row) > 0" content="该行存在超出约束范围的字段值">
              <el-tag size="small" type="danger" effect="plain">超限 {{ rowOutOfRange(row) }}</el-tag>
            </el-tooltip>
            <el-tag v-else size="small" type="success" effect="plain">正常</el-tag>
          </template>
        </el-table-column>
        <!-- 标签列（只读展示，点击编辑按钮在抽屉中配置） -->
        <el-table-column label="标签" min-width="160">
          <template #default="{ row }">
            <div class="tag-cell tag-cell--table" :title="(row.customTags || []).join('、')">
              <el-tag v-for="tag in row.customTags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
              <span v-if="!(row.customTags || []).length" class="muted">—</span>
            </div>
          </template>
        </el-table-column>
        <!-- 备注列（只读展示，点击编辑按钮在抽屉中配置） -->
        <el-table-column label="备注" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span :class="{ muted: !row.remark }" class="readonly-cell">{{ row.remark || '暂无备注' }}</span>
          </template>
        </el-table-column>
        <!-- 创建日期列 -->
        <el-table-column label="创建日期" width="110">
          <template #default="{ row }">
            <span class="readonly-cell">{{ row.createdAt || '—' }}</span>
          </template>
        </el-table-column>
        <!-- 操作列 -->
        <el-table-column label="操作" width="118" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="openRowEditor(row)">编辑</el-button>
            <el-popconfirm title="确认删除该行？" @confirm="tdStore.removeRow(ds.id, row.id)">
              <template #reference><el-button class="row-delete-btn" type="danger" text size="small" :icon="Delete" /></template>
            </el-popconfirm>
          </template>
        </el-table-column>

        <template #append>
          <button class="matrix-add-row" type="button" @click="openAddRowDialog">
            <el-icon><Plus /></el-icon>
            <span>添加测试行</span>
          </button>
        </template>
        </el-table>
          </template>
        </TableRangeSelection>
      </div>

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
            <el-button size="small" text @click="clearHistorySelection">取消勾选</el-button>
          </template>
        </div>
      </div>

      <div class="history-table-shell">
        <TableRangeSelection
          ref="historyRangeRef"
          :rows="historyRows"
          row-key="_rowKey"
          @selection-change="onHistorySelectionChange"
        >
          <template #default="{ setTableRef, handleSelectionChange, handleScroll }">
        <el-table
          :ref="(instance) => bindHistoryTable(instance, setTableRef)"
          class="matrix-table history-table"
          :data="historyRows"
          size="small"
          border
          row-key="_rowKey"
          empty-text="暂无历史数据"
          style="width: 100%;"
          height="100%"
          @selection-change="handleSelectionChange"
          @scroll="handleScroll"
        >
          <el-table-column type="selection" width="40" fixed="left" align="center" />
          <el-table-column type="index" width="48" align="center" label="#" fixed="left" />
          <el-table-column label="行标签" width="190" fixed="left" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="readonly-cell">{{ row.label }}</span>
            </template>
          </el-table-column>
          <el-table-column label="数据摘要" min-width="300" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="readonly-cell summary-cell">{{ summaryOf(row) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建日期" width="110" />
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
          </template>
        </TableRangeSelection>
      </div>
    </div>

    <!-- ======== 添加测试行弹窗（配置报文数据后再添加） ======== -->
    <el-dialog v-model="addRowVisible" title="添加测试行" width="520px" append-to-body>
      <template v-if="addRowForm">
        <div v-for="field in matrixFields" :key="field.name" class="row-edit-field">
          <div class="row-edit-field__label">
            <span>{{ field.name }}</span>
            <small :title="fieldTooltipText(field)">{{ fieldHint(field) }}</small>
          </div>
          <!-- 枚举字段 → Select -->
          <template v-if="isFieldEnum(field)">
            <el-select
              v-model="addRowForm.values[field.name]"
              size="small"
              style="width: 100%;"
            >
              <el-option v-for="entry in field.constraint.entries" :key="entry.value ?? entry" :label="entry.label || String(entry)" :value="entry.value ?? entry" />
            </el-select>
          </template>
          <!-- 数值字段 → InputNumber（约束校验） -->
          <template v-else-if="isFieldNumeric(field)">
            <el-input-number
              v-model="addRowForm.values[field.name]"
              :min="field.constraint?.min"
              :max="field.constraint?.max"
              size="small"
              controls-position="right"
              style="width: 100%;"
              :class="{ 'cell-invalid': isAddCellInvalid(field) }"
            />
          </template>
          <!-- 文本字段 → Input -->
          <template v-else>
            <el-input v-model="addRowForm.values[field.name]" size="small" />
          </template>
          <el-tag v-if="isAddCellInvalid(field)" size="small" type="danger" effect="plain" style="margin-top: 4px">超出约束范围</el-tag>
        </div>
        <el-empty v-if="!matrixFields.length" description="无编辑字段（均为固定值或无字段定义）" :image-size="48" />
        <!-- 备注 -->
        <div class="row-edit-meta">
          <span>备注</span>
          <el-input v-model="addRowForm.remark" type="textarea" :rows="2" size="small" placeholder="补充行用途、现场条件或复现说明" />
        </div>
        <!-- 标签（与历史数据方案一致：标签库快捷选择 + 自定义） -->
        <div class="row-edit-meta">
          <span>标签</span>
          <div class="tag-editor">
            <div class="tag-cell tag-cell--detail">
              <el-tag v-for="tag in addRowTags" :key="tag" closable @close="removeAddRowTag(tag)">{{ tag }}</el-tag>
              <span v-if="!addRowTags.length" class="muted">暂无标签</span>
            </div>
            <div class="tag-library">
              <span>标签库</span>
              <button v-for="tag in customTagLibrary" :key="tag" type="button" :class="{ selected: addRowTags.includes(tag) }" @click="toggleAddRowTag(tag)">{{ tag }}</button>
              <em v-if="!customTagLibrary.length">暂无历史标签</em>
            </div>
            <div class="tag-editor__input">
              <el-input v-model="addRowTagInput" size="small" placeholder="输入自定义标签后回车" @keyup.enter="addAddRowTag" />
              <el-button size="small" type="primary" plain @click="addAddRowTag">添加</el-button>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button size="small" @click="addRowVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmAddRow">添加</el-button>
      </template>
    </el-dialog>

    <!-- ======== 行编辑抽屉（点击列表行打开，聚焦单条数据的字段编辑） ======== -->
    <el-drawer v-model="rowEditorVisible" :title="`编辑行：${activeEditRow?.label || ''}`" size="480px">
      <template v-if="activeEditRow">
        <div class="row-edit-label">
          <span>行标签</span>
          <el-input v-model="activeEditRow.label" size="small" @change="(v) => tdStore.updateRowLabel(ds.id, activeEditRow.id, v)" />
        </div>
        <!-- 备注（与历史数据方案一致） -->
        <div class="row-edit-meta">
          <span>备注</span>
          <el-input
            v-model="activeEditRow.remark"
            type="textarea"
            :rows="2"
            size="small"
            placeholder="补充行用途、现场条件或复现说明"
            @change="(v) => tdStore.updateRowRemark(ds.id, activeEditRow.id, v)"
          />
        </div>
        <!-- 标签（与历史数据方案一致：标签库快捷选择 + 自定义） -->
        <div class="row-edit-meta">
          <span>标签</span>
          <div class="tag-editor">
            <div class="tag-cell tag-cell--detail">
              <el-tag v-for="tag in drawerTags" :key="tag" closable @close="removeDrawerTag(tag)">{{ tag }}</el-tag>
              <span v-if="!drawerTags.length" class="muted">暂无标签</span>
            </div>
            <div class="tag-library">
              <span>标签库</span>
              <button v-for="tag in customTagLibrary" :key="tag" type="button" :class="{ selected: drawerTags.includes(tag) }" @click="toggleDrawerTag(tag)">{{ tag }}</button>
              <em v-if="!customTagLibrary.length">暂无历史标签</em>
            </div>
            <div class="tag-editor__input">
              <el-input v-model="drawerTagInput" size="small" placeholder="输入自定义标签后回车" @keyup.enter="addDrawerTag" />
              <el-button size="small" type="primary" plain @click="addDrawerTag">添加</el-button>
            </div>
          </div>
        </div>
        <div v-for="field in matrixFields" :key="field.name" class="row-edit-field">
          <div class="row-edit-field__label">
            <span>{{ field.name }}</span>
            <small :title="fieldTooltipText(field)">{{ fieldHint(field) }}</small>
          </div>
          <!-- 枚举字段 → Select -->
          <template v-if="isFieldEnum(field)">
            <el-select
              :model-value="activeEditRow.values[field.name]"
              @update:model-value="(v) => onValueChange(activeEditRow, field.name, v)"
              size="small"
              style="width: 100%;"
            >
              <el-option v-for="entry in field.constraint.entries" :key="entry.value ?? entry" :label="entry.label || String(entry)" :value="entry.value ?? entry" />
            </el-select>
          </template>
          <!-- 数值字段 → InputNumber（约束校验） -->
          <template v-else-if="isFieldNumeric(field)">
            <el-input-number
              :model-value="activeEditRow.values[field.name]"
              @update:model-value="(v) => onValueChange(activeEditRow, field.name, v)"
              :min="field.constraint?.min"
              :max="field.constraint?.max"
              size="small"
              controls-position="right"
              style="width: 100%;"
              :class="{ 'cell-invalid': isCellInvalid(activeEditRow, field) }"
            />
          </template>
          <!-- 文本字段 → Input -->
          <template v-else>
            <el-input
              :model-value="activeEditRow.values[field.name]"
              @update:model-value="(v) => onValueChange(activeEditRow, field.name, v)"
              size="small"
            />
          </template>
          <el-tag v-if="isCellInvalid(activeEditRow, field)" size="small" type="danger" effect="plain" style="margin-top: 4px">超出约束范围</el-tag>
        </div>
        <el-empty v-if="!matrixFields.length" description="无编辑字段（均为固定值或无字段定义）" :image-size="48" />
        <div class="row-edit-footer">
          <el-button type="danger" size="small" @click="deleteActiveRow">删除此行</el-button>
          <el-button type="primary" size="small" @click="rowEditorVisible = false">完成</el-button>
        </div>
      </template>
    </el-drawer>

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
  Download, Delete, Plus, Lock, Search, Link, Promotion, VideoPlay
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { useTestDataStore } from '@/stores/testData'
import { useProtocolStore, collectInterfaceDatasetFields } from '@/stores/protocol'
import { useConnectionStore } from '@/stores/connection'
import { exportCsvFile, exportJsonFile } from '@/services/testDataService'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'
import TableRangeSelection from '@/components/common/TableRangeSelection.vue'

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

/* ========== 精简列表：摘要 / 超限 / 行编辑抽屉 ========== */
const summaryOf = (row) => matrixFields.value.slice(0, 4).map((f) => {
  const v = row.values?.[f.name]
  return `${f.name}: ${v === '' || v == null ? '—' : v}`
}).join('　')

const rowOutOfRange = (row) => {
  let count = 0
  matrixFields.value.forEach((f) => {
    const c = f.constraint
    if (!c) return
    const v = Number(row.values?.[f.name])
    if (Number.isNaN(v)) return
    if (c.mode === 'range' && (v < c.min || v > c.max)) count++
    else if (c.mode === 'enum' && !(c.entries || []).some((e) => String(e.value ?? e) === String(v))) count++
  })
  return count
}

const rowEditorVisible = ref(false)
const activeEditRow = ref(null)
const drawerTags = ref([])
const drawerTagInput = ref('')
const openRowEditor = (row) => {
  activeEditRow.value = row
  drawerTags.value = [...(row.customTags || [])]
  drawerTagInput.value = ''
  rowEditorVisible.value = true
}
const commitDrawerTags = () => {
  if (activeEditRow.value) onRowTagsChange(activeEditRow.value, drawerTags.value)
}
const removeDrawerTag = (tag) => {
  drawerTags.value = drawerTags.value.filter(t => t !== tag)
  commitDrawerTags()
}
const toggleDrawerTag = (tag) => {
  drawerTags.value = drawerTags.value.includes(tag)
    ? drawerTags.value.filter(t => t !== tag)
    : [...drawerTags.value, tag]
  commitDrawerTags()
}
const addDrawerTag = () => {
  const value = drawerTagInput.value
  if (value && !drawerTags.value.includes(value)) {
    drawerTags.value = [...drawerTags.value, value]
    commitDrawerTags()
  }
  drawerTagInput.value = ''
}
const deleteActiveRow = () => {
  if (!activeEditRow.value) return
  tdStore.removeRow(ds.value.id, activeEditRow.value.id)
  activeEditRow.value = null
  rowEditorVisible.value = false
}

/* ========== 添加测试行弹窗（配置报文数据后再添加） ========== */
const addRowVisible = ref(false)
const addRowForm = ref(null) // { values, remark }
const addRowTags = ref([])
const addRowTagInput = ref('')

const defaultFieldValue = (f) => {
  const c = f.constraint
  if (!c) return ''
  if (c.mode === 'fixed') return c.value
  if (c.mode === 'enum') { const e = (c.entries || [])[0]; return e?.value ?? e ?? '' }
  if (c.mode === 'range') return c.min
  return ''
}

const openAddRowDialog = () => {
  const values = {}
  dynamicFields.value.forEach((f) => { values[f.name] = defaultFieldValue(f) })
  // 补充现有行中未出现在字段定义里的键（兼容泛型 KV 数据集）
  if (ds.value.rows.length) {
    Object.keys(ds.value.rows[0].values).forEach((k) => { if (values[k] === undefined) values[k] = '' })
  }
  addRowForm.value = { values, remark: '' }
  addRowTags.value = []
  addRowTagInput.value = ''
  addRowVisible.value = true
}

const isAddCellInvalid = (field) => {
  if (!addRowForm.value) return false
  if (!field.constraint || field.constraint.mode !== 'range') return false
  const val = addRowForm.value.values[field.name]
  if (val == null || val === '') return false
  const num = Number(val)
  if (isNaN(num)) return true
  return num < field.constraint.min || num > field.constraint.max
}

const confirmAddRow = () => {
  if (!addRowForm.value) return
  tdStore.addRow(ds.value.id, {
    values: addRowForm.value.values,
    remark: addRowForm.value.remark,
    customTags: addRowTags.value,
  })
  addRowVisible.value = false
  addRowForm.value = null
  nextTick(() => takeSnapshot())
  ElMessage.success('已添加测试行')
}

const removeAddRowTag = (tag) => {
  addRowTags.value = addRowTags.value.filter(t => t !== tag)
}
const toggleAddRowTag = (tag) => {
  addRowTags.value = addRowTags.value.includes(tag)
    ? addRowTags.value.filter(t => t !== tag)
    : [...addRowTags.value, tag]
}
const addAddRowTag = () => {
  const value = addRowTagInput.value
  if (value && !addRowTags.value.includes(value)) addRowTags.value = [...addRowTags.value, value]
  addRowTagInput.value = ''
}
// 抽屉内编辑实时刷新脏标记
watch(() => activeEditRow.value?.values, () => {
  if (activeEditRow.value) checkDirty(activeEditRow.value)
}, { deep: true })

/* ========== 行标签编辑（与历史数据库标签方案一致：自定义 + 标签库快捷选择） ========== */
// 标签库 = 全局标签库 + 本数据集已有行标签，排序后展示
const customTagLibrary = computed(() => [...new Set([
  ...(tdStore.customTagLibrary || []),
  ...ds.value.rows.flatMap((r) => r.customTags || []),
])].sort())

const onRowTagsChange = (row, tags) => {
  tdStore.updateRowTags(ds.value.id, row.id, tags)
  checkDirty(row)
}

/* ========== 行搜索 (优化点 12) ========== */
const rowSearch = ref('')
const displayRows = computed(() => {
  if (!rowSearch.value) return ds.value.rows
  const kw = rowSearch.value.toLowerCase()
  return ds.value.rows.filter(r => {
    if (r.label?.toLowerCase().includes(kw)) return true
    if ((r.remark || '').toLowerCase().includes(kw)) return true
    if ((r.customTags || []).some(t => t.toLowerCase().includes(kw))) return true
    return Object.values(r.values).some(v => String(v).toLowerCase().includes(kw))
  })
})

/* ========== 批量选择 (优化点 2) ========== */
const selectedRows = ref([])
const matrixRangeRef = ref(null)
const onSelectionChange = (rows) => { selectedRows.value = rows }
const clearCurrentSelection = () => matrixRangeRef.value?.clearSelection?.()
const onBatchDelete = () => {
  tdStore.removeRowsBatch(ds.value.id, selectedRows.value.map(r => r.id))
  clearCurrentSelection()
  ElMessage.success('已删除选中行')
}

const historyTableRef = ref(null)
const historyRangeRef = ref(null)
const selectedHistoryRows = ref([])
const historyRows = computed(() => {
  const messageId = ds.value.messageId
  if (messageId != null && messageId !== '') {
    return tdStore.allHistoryData
      .filter((row) => String(row.messageId) === String(messageId))
      .map((row) => ({ ...row, _rowKey: `${row._datasetId}-${row.id}` }))
  }
  if (ds.value.linkedInterface) {
    return tdStore.allHistoryData
      .filter((row) => row.messageName === ds.value.linkedInterface)
      .map((row) => ({ ...row, _rowKey: `${row._datasetId}-${row.id}` }))
  }
  return tdStore.allHistoryData
    .filter((row) => row._datasetId === ds.value.id)
    .map((row) => ({ ...row, _rowKey: `${row._datasetId}-${row.id}` }))
})
const onHistorySelectionChange = (rows) => { selectedHistoryRows.value = rows }
const clearHistorySelection = () => historyRangeRef.value?.clearSelection?.()
const bindHistoryTable = (instance, setRangeTable) => {
  historyTableRef.value = instance
  setRangeTable(instance)
}

const onUseHistoryRows = () => {
  if (selectedHistoryRows.value.length === 0) return
  const count = selectedHistoryRows.value.length
  const lastSelected = selectedRows.value[selectedRows.value.length - 1]
  tdStore.insertRowsAfter(ds.value.id, lastSelected?.id ?? null, selectedHistoryRows.value)
  clearHistorySelection()
  nextTick(() => takeSnapshot())
  ElMessage.success(`已带入 ${count} 行历史数据`)
}

const onDeleteHistoryRow = (row) => {
  tdStore.removeHistoryRow(row._datasetId ?? ds.value.id, row.id)
  selectedHistoryRows.value = selectedHistoryRows.value.filter(item => item._rowKey !== row._rowKey)
  ElMessage.success('历史数据已删除')
}

const onDeleteSelectedHistoryRows = () => {
  const count = selectedHistoryRows.value.length
  if (!count) return
  const rowsByDataset = new Map()
  selectedHistoryRows.value.forEach((row) => {
    const datasetId = row._datasetId ?? ds.value.id
    if (!rowsByDataset.has(datasetId)) rowsByDataset.set(datasetId, [])
    rowsByDataset.get(datasetId).push(row.id)
  })
  rowsByDataset.forEach((rowIds, datasetId) => tdStore.removeHistoryRowsBatch(datasetId, rowIds))
  clearHistorySelection()
  ElMessage.success(`已删除 ${count} 条历史数据`)
}

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
  clearCurrentSelection()
  clearHistorySelection()
}, { immediate: true })

/* ========== 拖拽排序 (优化点 3) ========== */
const tableRef = ref(null)
const bindMatrixTable = (instance, setRangeTable) => {
  tableRef.value = instance
  setRangeTable(instance)
}
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
    createdAt: r.createdAt || '',
    remark: r.remark || '',
    tags: r.customTags || [],
    ...r.values
  }))
  exportJsonFile(data, `${ds.value.name}.json`)
  ElMessage.success('JSON 导出成功')
}

/* ========== JSON 导出（预览面板已移除，保留导出能力） ========== */
const fieldsRefOpen = ref([]) // 默认折叠，不展开

/* ========== 快捷键 (优化点 21) ========== */
const onKeydown = (e) => {
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault()
    openAddRowDialog()
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

/* 数据摘要列 */
.summary-cell {
  color: var(--el-text-color-regular);
  font-size: 12px;
  white-space: pre;
}

/* ======== 行编辑抽屉 ======== */
.row-edit-label {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.row-edit-label > span { color: var(--el-text-color-secondary); font-size: 12px; }
.row-edit-meta {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  margin-bottom: 14px;
}
.row-edit-meta > span { padding-top: 4px; color: var(--el-text-color-secondary); font-size: 12px; }
.row-edit-meta .el-textarea,
.row-edit-meta .el-select { width: 100%; }
.row-edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}
.row-edit-field__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.row-edit-field__label span { font-size: 13px; font-weight: 600; }
.row-edit-field__label small { overflow: hidden; color: var(--el-text-color-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.row-edit-footer {
  margin-top: 14px;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--el-border-color-lighter);
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

/* ======== 标签展示与编辑（与历史数据库方案一致） ======== */
.row-tags-select { width: 100%; }
.tag-cell { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.tag-cell--table { min-height: 24px; }
.tag-cell--detail { padding: 10px; border: 1px dashed var(--el-border-color); border-radius: 7px; }
.tag-editor { width: 100%; display: flex; flex-direction: column; gap: 9px; }
.tag-editor__input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.tag-library { padding: 8px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; border: 1px solid var(--el-border-color-lighter); border-radius: 7px; background: var(--el-fill-color-extra-light); }
.tag-library > span { margin-right: 2px; color: var(--el-text-color-secondary); font-size: 12px; }
.tag-library button { padding: 3px 8px; border: 1px solid var(--el-border-color); border-radius: 12px; background: #fff; color: var(--el-text-color-regular); cursor: pointer; font-size: 12px; }
.tag-library button:hover,
.tag-library button.selected { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.tag-library em { color: var(--el-text-color-placeholder); font-size: 12px; font-style: normal; }
.muted { color: var(--el-text-color-placeholder); }

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

/* 表格末尾添加行 */
.matrix-add-row {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border: 0;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
  color: var(--el-color-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background .16s ease, color .16s ease;
}
.matrix-add-row:hover { background: var(--el-color-primary-light-9); color: var(--el-color-primary-dark-2); }
.matrix-add-row:focus-visible { outline: 2px solid var(--el-color-primary-light-3); outline-offset: -2px; }

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

/* ======== 行右键菜单 ======== */
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

</style>
