<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <!-- ========== HEADER ========== -->
    <template #header>
      <div class="proto-head">
        <el-input v-model="protocol.name" class="proto-name" placeholder="协议名称" />
        <div class="proto-head__right">
          <el-dropdown trigger="click" @command="onIoCommand">
            <el-button :icon="Operation" plain>导入 / 导出</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="import" :icon="Upload">导入协议 JSON</el-dropdown-item>
                <el-dropdown-item command="export" :icon="Download">导出当前协议</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-tooltip content="切换字节序">
            <el-select v-model="protocol.endian" class="proto-endian-sel">
              <template #prefix><span class="proto-prefix">字节序</span></template>
              <el-option v-for="e in ENDIANS" :key="e.value" :label="e.label" :value="e.value" />
            </el-select>
          </el-tooltip>
          <el-tooltip content="保存当前协议配置">
            <el-button :type="dirty ? 'primary' : ''" :icon="Check" @click="$emit('save')">保存</el-button>
          </el-tooltip>
          <transition name="saved-hint-fade">
            <span v-if="showSavedHint" class="saved-hint">
              <el-icon><Check /></el-icon>已保存
            </span>
          </transition>
          <el-popconfirm title="删除该协议？" @confirm="$emit('delete')">
            <template #reference>
              <el-button :icon="Delete" plain>删除</el-button>
            </template>
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

    <!-- ========== 总长度摘要（实时预览） ========== -->
    <div class="summary-bar">
      <span class="summary-bar__item">
        <span class="summary-bar__lbl">总长度</span>
        <b>{{ totalBytes }}</b>
        <em>字节</em>
      </span>
      <span class="summary-bar__item">
        <span class="summary-bar__lbl">字段</span>
        <b>{{ topLevelFieldCount }}</b>
        <em>个</em>
      </span>
      <span class="summary-bar__item">
        <span class="summary-bar__lbl">最后偏移</span>
        <b>{{ lastOffset }}</b>
      </span>
      <span class="summary-bar__sep" />
      <span class="summary-bar__item">
        <span class="summary-bar__lbl">字节序</span>
        <b>{{ protocol.endian === 'big' ? '大端 BE' : '小端 LE' }}</b>
      </span>
      <span class="summary-bar__progress">
        <el-progress
          :percentage="frameUsagePct"
          :color="frameUsagePct > 90 ? '#fa541c' : frameUsagePct > 60 ? '#faad14' : '#52c41a'"
          :stroke-width="6"
          :show-text="false"
        />
        <span class="summary-bar__progress-text">帧内占用 {{ frameUsagePct }}%</span>
      </span>
    </div>

    <!-- ========== 帧结构 & 拆包规则 ========== -->
    <FramingPanel
      v-if="protocol.framing"
      :protocol="protocol"
      :fields="protocol.fields"
      :highlight-field-id="highlightFieldId"
      @highlight="(id) => highlightFieldId = id"
    />

    <!-- ========== 字段表格 ========== -->
    <el-table
      :key="tableKey"
      ref="tableRef"
      :data="protocol.fields"
      row-key="id"
      border
      size="small"
      class="byte-tree"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      :default-expand-all="false"
      :row-class-name="tableRowClass"
      @row-contextmenu="onRowCtx"
    >
      <!-- ── 列 0: 拖拽手柄 ── -->
      <el-table-column label="" width="36" align="center" class-name="drag-col">
        <template #default="{ row }">
          <el-icon v-if="row.kind !== 'bit'" class="drag-handle"><Rank /></el-icon>
        </template>
      </el-table-column>

      <!-- ── 列 1: 偏移位置（展开箭头由 JS 迁入） ── -->
      <el-table-column label="偏移位置" width="120" align="center" class-name="offset-col">
        <template #default="{ row }">
          <div class="offset-cell">
            <template v-if="row.kind === 'byte'">
              <code class="offset-hex">{{ formatHex(row.byteOffset) }}</code>
            </template>
            <template v-else-if="row.kind === 'bit'">
              <span class="bit-pos">{{ row._displayOffset || bitPosText(row) }}</span>
            </template>
            <template v-else>
              <code class="offset-hex">{{ formatHex(row.byteOffset) }}</code>
              <span class="repeat-badge">×{{ row._effectiveCount || row.repeatCount }}</span>
            </template>
          </div>
        </template>
      </el-table-column>

      <!-- ── 列 2: 单位 ── -->
      <el-table-column label="单位" width="100" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <el-select
              :model-value="row.bitMode ? 'bit' : 'byte'"
              size="small" style="width:64px"
              @change="(v) => toggleUnit(row, v)"
            >
              <el-option label="字节" value="byte" />
              <el-option label="比特" value="bit" />
            </el-select>
          </template>
          <el-tag v-else-if="row.kind === 'bit'" size="small" type="warning" effect="plain">位</el-tag>
          <el-tag v-else size="small" type="info" effect="plain">组</el-tag>
        </template>
      </el-table-column>

      <!-- ── 列 3: 长度 ── -->
      <el-table-column label="长度" width="120" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <span v-if="row.bitMode" class="locked-len">1 字节</span>
            <el-input-number
              v-else v-model="row.byteLength" :min="1" :max="1024"
              size="small" controls-position="right" style="width:74px"
              @change="onFieldChange"
            />
          </template>
          <template v-else-if="row.kind === 'bit'">
            <el-select
              :model-value="Math.abs(row.bitStart - row.bitEnd) + 1"
              size="small" style="width:74px"
              :class="{ 'bit-len-over': isBitsOver(row) }"
              @change="(len) => onBitLenChange(row, len)"
            >
              <el-option v-for="n in getMaxFieldLen(row)" :key="n" :label="n + ' 位'" :value="n" />
            </el-select>
          </template>
          <template v-else>
            <span class="repeat-len">{{ row.groupByteSize || 0 }} 字节/次</span>
          </template>
        </template>
      </el-table-column>

      <!-- ── 列 4: 数据类型（新增） ── -->
      <el-table-column label="数据类型" width="140" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <el-select v-model="row.dataType" size="small" style="width:110px" @change="(dt) => onDataTypeChange(row, dt)">
              <el-option-group v-for="grp in dataTypeGroups" :key="grp.label" :label="grp.label">
                <el-option v-for="t in grp.items" :key="t.value" :label="t.label" :value="t.value" />
              </el-option-group>
            </el-select>
          </template>
          <template v-else-if="row.kind === 'bit'">
            <el-select v-model="row.dataType" size="small" style="width:90px" :disabled="Math.abs(row.bitStart - row.bitEnd) !== 0">
              <el-option v-for="t in BIT_DATA_TYPES" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </template>
          <template v-else>
            <span class="constraint-na">—</span>
          </template>
        </template>
      </el-table-column>

      <!-- ── 列 5: 字段名 ── -->
      <el-table-column label="字段名（语义）" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.name" size="small" :placeholder="row.kind === 'repeat' ? '重复组名称' : '字段名'" />
        </template>
      </el-table-column>

      <!-- ── 列 6: 取值约束 ── -->
      <el-table-column label="取值约束" width="280">
        <template #default="{ row }">
          <template v-if="row.kind === 'bit' && row.bitMode">
            <span class="constraint-na">—</span>
          </template>
          <template v-else-if="row.kind === 'repeat'">
            <!-- 重复次数配置 -->
            <div class="repeat-config">
              <el-select v-model="row.repeatMode" size="small" style="width:70px">
                <el-option label="固定" value="fixed" />
                <el-option label="动态" value="dynamic" />
              </el-select>
              <el-input-number
                v-if="row.repeatMode === 'fixed'"
                v-model="row.repeatCount" :min="1" :max="9999"
                size="small" controls-position="right" style="width:80px"
              />
              <el-select
                v-else v-model="row.countFieldId" size="small" style="width:120px" placeholder="引用字段"
              >
                <el-option v-for="f in numericFieldsBefore(row.id)" :key="f.value" :label="f.label" :value="f.value" />
              </el-select>
            </div>
          </template>
          <template v-else>
            <!-- 枚举约束 -->
            <template v-if="row.constraint.mode === 'enum'">
              <div class="enum-editor">
                <div v-for="(entry, ei) in row.constraint.entries" :key="ei" class="enum-row">
                  <el-input-number v-model="entry.value" :controls="false" size="small" style="width:54px" />
                  <span class="c-sep">=</span>
                  <el-input v-model="entry.label" size="small" style="width:72px" placeholder="标签" />
                  <el-popconfirm title="删除该枚举项？" @confirm="row.constraint.entries.splice(ei, 1)">
                    <template #reference><el-button text size="small" :icon="Delete" /></template>
                  </el-popconfirm>
                </div>
                <el-button link type="primary" size="small" @click="row.constraint.entries.push({ value: 0, label: '' })">+ 枚举项</el-button>
              </div>
            </template>
            <!-- 范围 / 固定 -->
            <template v-else>
              <div class="constraint">
                <el-select v-model="row.constraint.mode" size="small" class="c-mode" @change="onConstraintModeChange(row)">
                  <el-option label="范围" value="range" />
                  <el-option label="固定值" value="fixed" />
                  <el-option v-if="isNumericField(row)" label="枚举" value="enum" />
                  <el-option v-if="isStringField(row)" label="长度" value="length" />
                  <el-option v-if="isStringField(row)" label="正则" value="regex" />
                  <el-option label="无" value="none" />
                </el-select>
                <template v-if="row.constraint.mode === 'range'">
                  <el-input-number v-model="row.constraint.min" :controls="false" size="small" class="c-num" />
                  <span class="c-sep">~</span>
                  <el-input-number v-model="row.constraint.max" :controls="false" size="small" class="c-num" />
                </template>
                <template v-else-if="row.constraint.mode === 'fixed'">
                  <el-input-number v-model="row.constraint.value" :controls="false" size="small" class="c-num c-num--fixed" />
                </template>
                <template v-else-if="row.constraint.mode === 'length'">
                  <el-input-number v-model="row.constraint.minLen" :min="0" :controls="false" size="small" class="c-num" />
                  <span class="c-sep">~</span>
                  <el-input-number v-model="row.constraint.maxLen" :min="0" :controls="false" size="small" class="c-num" />
                </template>
                <template v-else-if="row.constraint.mode === 'regex'">
                  <el-input v-model="row.constraint.pattern" size="small" style="width:120px" placeholder="正则表达式" />
                </template>
              </div>
            </template>
          </template>
        </template>
      </el-table-column>

      <!-- ── 列 7: 备注 ── -->
      <el-table-column label="备注说明" min-width="120">
        <template #default="{ row }">
          <el-input v-model="row.desc" size="small" placeholder="补充说明" />
        </template>
      </el-table-column>

      <!-- ── 列 8: 操作 ── -->
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <template v-if="row.kind === 'byte'">
            <el-tooltip content="上移字段"><el-button text size="small" :icon="Top" :disabled="isFirstField(row)" @click="moveField(row.id, 'up')" /></el-tooltip>
            <el-tooltip content="下移字段"><el-button text size="small" :icon="Bottom" :disabled="isLastField(row)" @click="moveField(row.id, 'down')" /></el-tooltip>
            <el-tooltip v-if="!row.bitMode" content="切换到位模式"><el-button text size="small" :icon="Operation" @click="toggleUnit(row, 'bit')" /></el-tooltip>
            <el-tooltip v-else content="添加位子段"><el-button text size="small" :icon="Plus" :disabled="getBitsUsedInField(row) >= row.byteLength * 8" @click="addBitChild(row)" /></el-tooltip>
            <el-popconfirm title="删除该字段？" @confirm="removeField(row.id)">
              <template #reference><el-button text size="small" :icon="Delete" title="删除" /></template>
            </el-popconfirm>
          </template>
          <template v-else-if="row.kind === 'bit'">
            <el-popconfirm title="删除该位段？" @confirm="removeBitChild(row)">
              <template #reference><el-button text size="small" :icon="Delete" title="删除" /></template>
            </el-popconfirm>
          </template>
          <template v-else>
            <el-tooltip content="上移重复组"><el-button text size="small" :icon="Top" :disabled="isFirstField(row)" @click="moveField(row.id, 'up')" /></el-tooltip>
            <el-tooltip content="下移重复组"><el-button text size="small" :icon="Bottom" :disabled="isLastField(row)" @click="moveField(row.id, 'down')" /></el-tooltip>
            <el-tooltip content="编辑子字段"><el-button text size="small" :icon="Edit" @click="openRepeatEditor(row)" /></el-tooltip>
            <el-popconfirm title="删除该重复组？" @confirm="removeField(row.id)">
              <template #reference><el-button text size="small" :icon="Delete" title="删除" /></template>
            </el-popconfirm>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <!-- ========== 底部操作按钮 ========== -->
    <div class="bottom-actions">
      <el-tooltip content="新增一个字节类型的字段"><el-button class="add-row" :icon="Plus" @click="addByteRow">添加字节字段</el-button></el-tooltip>
      <el-tooltip content="新增一个重复组字段，用于定义可重复的数据结构"><el-button class="add-row" :icon="FolderAdd" @click="addRepeatRow">添加重复组</el-button></el-tooltip>
    </div>

    <!-- ========== 重复组编辑弹窗 ========== -->
    <el-dialog v-model="repeatEditorVisible" :title="'编辑 ' + (editingRepeat?.name || '重复组')" width="720px" append-to-body>
      <el-table v-if="editingRepeat" :data="editingRepeat.children" row-key="id" border size="small">
        <el-table-column label="偏移" width="80" align="center">
          <template #default="{ row }">
            <code class="offset-hex">{{ formatHex(row.byteOffset) }}</code>
          </template>
        </el-table-column>
        <el-table-column label="单位" width="80" align="center">
          <template #default="{ row }">
            <el-select
              v-if="row.kind === 'byte'"
              :model-value="row.bitMode ? 'bit' : 'byte'"
              size="small" style="width:56px"
              @change="(v) => toggleUnit(row, v)"
            >
              <el-option label="字节" value="byte" />
              <el-option label="比特" value="bit" />
            </el-select>
            <el-tag v-else size="small" type="warning" effect="plain">位</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="长度" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.kind === 'byte' && row.bitMode" class="locked-len">1 字节</span>
            <el-input-number
              v-else-if="row.kind === 'byte'"
              v-model="row.byteLength" :min="1" :max="1024"
              size="small" controls-position="right" style="width:70px"
            />
            <span v-else class="bit-pos">{{ Math.abs(row.bitStart - row.bitEnd) + 1 }}位</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="110" align="center">
          <template #default="{ row }">
            <el-select v-if="row.kind === 'byte'" v-model="row.dataType" size="small" style="width:90px" @change="(dt) => onDataTypeChange(row, dt)">
              <el-option v-for="t in flatDataTypes" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
            <el-select v-else v-model="row.dataType" size="small" style="width:80px">
              <el-option v-for="t in BIT_DATA_TYPES" :key="t.value" :label="t.label" :value="t.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="字段名" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.name" size="small" placeholder="字段名" />
          </template>
        </el-table-column>
        <el-table-column label="约束" width="180">
          <template #default="{ row }">
            <div class="constraint">
              <el-select v-model="row.constraint.mode" size="small" class="c-mode">
                <el-option label="范围" value="range" />
                <el-option label="固定值" value="fixed" />
              </el-select>
              <template v-if="row.constraint.mode === 'range'">
                <el-input-number v-model="row.constraint.min" :controls="false" size="small" class="c-num" />
                <span class="c-sep">~</span>
                <el-input-number v-model="row.constraint.max" :controls="false" size="small" class="c-num" />
              </template>
              <el-input-number v-else v-model="row.constraint.value" :controls="false" size="small" class="c-num c-num--fixed" />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <template v-if="row.kind === 'byte'">
              <el-tooltip v-if="!row.bitMode" content="切换到位模式"><el-button text size="small" :icon="Operation" @click="toggleUnit(row, 'bit')" /></el-tooltip>
              <el-tooltip v-else content="添加位子段"><el-button text size="small" :icon="Plus" :disabled="getBitsUsedInField(row) >= row.byteLength * 8" @click="addBitChild(row)" /></el-tooltip>
            </template>
            <el-popconfirm title="删除？" @confirm="removeRepeatChild(editingRepeat, row.id)">
              <template #reference><el-button text size="small" :icon="Delete" /></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-button class="add-row" style="margin-top:12px;width:100%;border-style:dashed" :icon="Plus" @click="addRepeatChildByte">添加字节字段</el-button>
    </el-dialog>

    <!-- ========== 右键菜单 ========== -->
    <teleport to="body">
      <div v-if="rowCtx.visible" class="ctx-mask" @click="rowCtx.visible = false" @contextmenu.prevent="rowCtx.visible = false">
        <ul class="ctx-menu" :style="{ left: rowCtx.x + 'px', top: rowCtx.y + 'px' }" @click.stop>
          <li v-if="rowCtx.row?.kind === 'byte' && !rowCtx.row?.bitMode" @click="toggleUnit(rowCtx.row, 'bit'); rowCtx.visible = false">切换到位模式</li>
          <li v-if="rowCtx.row?.kind === 'byte' && rowCtx.row?.bitMode && getBitsUsedInField(rowCtx.row) < rowCtx.row.byteLength * 8" @click="addBitChild(rowCtx.row); rowCtx.visible = false">添加位子段</li>
          <li v-if="rowCtx.row?.kind === 'byte' && !rowCtx.row?.bitMode" @click="addRepeatAfter(rowCtx.row); rowCtx.visible = false">添加重复组</li>
          <li v-if="rowCtx.row?.kind === 'repeat'" @click="openRepeatEditor(rowCtx.row); rowCtx.visible = false">编辑子字段</li>
          <li @click="duplicateField(rowCtx.row); rowCtx.visible = false">复制字段</li>
          <li class="danger" @click="confirmCtxDelete">删除</li>
        </ul>
      </div>
    </teleport>
  </el-card>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Delete, Upload, Download, Check, Top, Bottom, Operation, Rank, Edit, FolderAdd
} from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import {
  TRANSPORT_TYPES, ENDIANS, BYTE_DATA_TYPES, BIT_DATA_TYPES,
  makeByteField, makeBitField, makeRepeatGroup,
  defaultConstraint, isNumericType, isStringType,
  range, fixed, enumConstraint, noneConstraint,
  getNumericFieldsBefore,
} from '@/stores/protocol'
import { computeOffsets, computeBitOffsets, computeTotalBytes, formatHexOffset } from '@/utils/offsetCalc'
import FramingPanel from './FramingPanel.vue'

const props = defineProps({
  protocol: { type: Object, required: true },
  systemOptions: { type: Array, default: () => [] },
  moduleOptions: { type: Array, default: () => [] },
})
const emit = defineEmits(['import', 'export', 'delete', 'save', 'systemChange'])

const onIoCommand = (cmd) => {
  if (cmd === 'import') emit('import')
  if (cmd === 'export') emit('export')
}

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column', overflow: 'auto' }

// ─── 脏数据追踪 ───
const dirty = ref(false)
const snapshot = ref(JSON.stringify(props.protocol))
watch(() => props.protocol, () => {
  dirty.value = JSON.stringify(props.protocol) !== snapshot.value
}, { deep: true })
watch(() => props.protocol.id, () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
}, { immediate: true })
// ─── 保存提示（2.2 秒后自动消失） ───
const showSavedHint = ref(false)
let savedHintTimer = null
onBeforeUnmount(() => { if (savedHintTimer) clearTimeout(savedHintTimer) })
const markClean = () => {
  snapshot.value = JSON.stringify(props.protocol)
  dirty.value = false
  showSavedHint.value = true
  if (savedHintTimer) clearTimeout(savedHintTimer)
  savedHintTimer = window.setTimeout(() => { showSavedHint.value = false }, 2200)
}

// ─── 数据类型分组 ───
const dataTypeGroups = computed(() => {
  const groups = {}
  for (const t of BYTE_DATA_TYPES) {
    if (!groups[t.group]) groups[t.group] = { label: t.group, items: [] }
    groups[t.group].items.push(t)
  }
  return Object.values(groups)
})
const flatDataTypes = BYTE_DATA_TYPES

// ─── 总字节数 ───
const totalBytes = computed(() => {
  return computeTotalBytes(props.protocol.fields)
})
const topLevelFieldCount = computed(() => props.protocol.fields.length)
// 最后偏移（按协议配置推断帧长度：固定长度模式用 fixedLength，否则用 totalBytes）
const frameMaxBytes = computed(() => {
  const framing = props.protocol.framing || {}
  if (framing.mode === 'fixed' && framing.fixedLength) return Number(framing.fixedLength) || 0
  return Math.max(totalBytes.value, 1024)
})
const lastOffset = computed(() => Math.max(0, totalBytes.value - 1))
const frameUsagePct = computed(() => {
  const max = frameMaxBytes.value
  if (!max) return 0
  return Math.min(100, Math.round((totalBytes.value / max) * 100))
})

// ─── 高亮字段（framing 引用） ───
const highlightFieldId = ref(null)

// ─── 偏移量自动重算 ───
watch(() => props.protocol.fields, () => {
  const fields = props.protocol.fields

  // 解析动态重复次数
  const resolveDynamic = (fieldId) => {
    const f = fields.find(x => x.id === fieldId)
    if (f && f.kind === 'byte' && isNumericType(f.dataType)) {
      const val = f.constraint.mode === 'fixed' ? f.constraint.value : f.constraint.min
      return Math.max(1, val || 1)
    }
    return 1
  }

  computeOffsets(fields, resolveDynamic)

  // 计算 bit children 的偏移显示
  for (const f of fields) {
    if (f.kind === 'byte' && f.children?.length) {
      computeBitOffsets(f)
    }
  }

  // 校验位字段溢出
  for (const f of fields) {
    if (f.kind === 'byte' && f.children?.length && f._bitsOverflow) {
      ElMessage.warning(`字段「${f.name}」的位字段总长度（${f._bitsUsed}）超过字节长度（${f.byteLength * 8} 位）`)
    }
  }
}, { deep: true, immediate: true })

// ─── 位字段辅助 ───
const findParentByteField = (bitRow) => {
  const search = (fields) => {
    for (const f of fields) {
      if (f.children?.some(c => c.id === bitRow.id)) return f
      if (f.kind === 'repeat') {
        const found = search(f.children || [])
        if (found) return found
      }
    }
    return null
  }
  return search(props.protocol.fields)
}

const getBitsUsedInField = (byteField) => {
  if (!byteField.children?.length) return 0
  return byteField.children.reduce((sum, c) => sum + Math.abs(c.bitStart - c.bitEnd) + 1, 0)
}

const getMaxFieldLen = (bitRow) => {
  const parent = findParentByteField(bitRow)
  if (!parent) return 1
  const totalBits = parent.byteLength * 8
  const siblingBits = parent.children
    .filter(c => c.id !== bitRow.id)
    .reduce((sum, c) => sum + Math.abs(c.bitStart - c.bitEnd) + 1, 0)
  return Math.max(1, totalBits - siblingBits)
}

const isBitsOver = (bitRow) => {
  const parent = findParentByteField(bitRow)
  if (!parent) return false
  return getBitsUsedInField(parent) > parent.byteLength * 8
}

// ─── 重排位段：从高位到低位按顺序紧密排列，防止重叠 ───
const repositionBitFields = (byteField) => {
  const totalBits = byteField.byteLength * 8
  const children = byteField.children
  if (!children.length) return

  // 按 bitStart 降序排列（MSB first），保持用户看到的顺序
  children.sort((a, b) => {
    if (b.bitStart !== a.bitStart) return b.bitStart - a.bitStart
    return b.bitEnd - a.bitEnd
  })

  // 从最高位开始逐个紧密排列
  let nextBit = totalBits - 1
  for (const c of children) {
    const len = Math.abs(c.bitStart - c.bitEnd) + 1
    const maxLen = nextBit + 1
    const actualLen = Math.min(len, maxLen)
    if (actualLen <= 0) {
      c.bitStart = 0
      c.bitEnd = 0
      continue
    }
    if (actualLen < len) {
      ElMessage.warning(`位段「${c.name}」长度 ${len} 超出可用空间，已截断为 ${actualLen} 位`)
    }
    c.bitStart = nextBit
    c.bitEnd = nextBit - actualLen + 1
    nextBit -= actualLen
  }
}

const onBitLenChange = (bitRow, newLen) => {
  const parent = findParentByteField(bitRow)
  if (!parent) {
    bitRow.bitEnd = Math.max(0, bitRow.bitStart - newLen + 1)
    return
  }
  // 仅更新当前位段的长度，然后交由 repositionBitFields 统一重排
  bitRow.bitEnd = Math.max(0, bitRow.bitStart - newLen + 1)
  repositionBitFields(parent)
}

const bitPosText = (row) => {
  return `bit[${row.bitStart}${row.bitEnd !== row.bitStart ? ':' + row.bitEnd : ''}]`
}

// ─── 约束类型判断 ───
const isNumericField = (row) => row.kind === 'byte' && isNumericType(row.dataType)
const isStringField = (row) => row.kind === 'byte' && isStringType(row.dataType)

const onConstraintModeChange = (row) => {
  const mode = row.constraint.mode
  if (mode === 'enum' && !row.constraint.entries) {
    row.constraint = enumConstraint([{ value: 0, label: '' }])
  } else if (mode === 'length') {
    row.constraint = { mode: 'length', minLen: 0, maxLen: 256 }
  } else if (mode === 'regex') {
    row.constraint = { mode: 'regex', pattern: '' }
  } else if (mode === 'none') {
    row.constraint = noneConstraint()
  } else if (mode === 'range') {
    row.constraint = range(0, 255)
  } else if (mode === 'fixed') {
    row.constraint = fixed(0)
  }
}

// ─── 数据类型切换 ───
const onDataTypeChange = (row, newType) => {
  row.constraint = defaultConstraint(newType)
  // 数值类型自动推断字节长度
  const dtInfo = BYTE_DATA_TYPES.find(t => t.value === newType)
  if (dtInfo?.bytes > 0 && !row.bitMode) {
    row.byteLength = dtInfo.bytes
  }
}

// ─── 字段操作 ───
const onFieldChange = () => { /* 偏移在 watch 中自动重算 */ }

const formatHex = (offset) => formatHexOffset(offset ?? 0)

const addByteRow = () => {
  const fields = props.protocol.fields
  // 防呆：上一个字节如有位子段，先补全
  if (fields.length > 0) {
    const prev = fields[fields.length - 1]
    if (prev && prev.kind === 'byte' && prev.children?.length) {
      fillRemainingBits(prev)
    }
  }
  fields.push(makeByteField({ name: `字段${fields.length + 1}` }))
}

const addRepeatRow = () => {
  props.protocol.fields.push(makeRepeatGroup({ name: `重复组${props.protocol.fields.filter(f => f.kind === 'repeat').length + 1}` }))
}

const addRepeatAfter = (afterRow) => {
  const fields = props.protocol.fields
  const idx = fields.findIndex(f => f.id === afterRow.id)
  if (idx >= 0) {
    fields.splice(idx + 1, 0, makeRepeatGroup({ name: `重复组${fields.filter(f => f.kind === 'repeat').length + 1}` }))
  }
}

const addBitChild = (byteField) => {
  const totalBits = byteField.byteLength * 8
  const used = getBitsUsedInField(byteField)
  if (used >= totalBits) {
    ElMessage.warning('该字节所有位已分配完毕，无法添加更多位字段')
    return
  }
  const children = byteField.children
  // 新位段默认1位，随后由 repositionBitFields 统一排列
  children.push(makeBitField({
    name: `位段${children.length + 1}`,
    bitStart: 0,
    bitEnd: 0
  }))
  repositionBitFields(byteField)
  // 自动展开父行，让用户立即看到新增的位子段
  nextTick(() => {
    try {
      const td = tableRef.value?.store?.states?.treeData?.value
      if (td && byteField.id && !td[byteField.id]?.expanded) {
        tableRef.value.toggleRowExpansion(byteField, true)
      }
    } catch (_) { /* 兼容不同版本 */ }
  })
}

const toggleUnit = async (byteField, newUnit) => {
  if (newUnit === 'bit') {
    byteField.byteLength = 1
    byteField.bitMode = true
  } else {
    if (byteField.children.length) {
      try {
        await ElMessageBox.confirm('切换回字节模式将清除所有位子段，是否继续？', '确认', {
          confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
        })
      } catch { return }
      byteField.children.splice(0)
    }
    byteField.bitMode = false
  }
}

const fillRemainingBits = (byteField) => {
  const totalBits = byteField.byteLength * 8
  const children = byteField.children
  if (!children.length) {
    children.push(makeBitField({
      name: '保留位', bitStart: totalBits - 1, bitEnd: 0,
      constraint: fixed(0), desc: '未使用位，固定为 0'
    }))
    return
  }
  // 先重排已有位段，消除可能的重叠
  repositionBitFields(byteField)
  // 重排后已按 bitStart 降序，基于此计算空隙
  const sorted = [...children].sort((a, b) => b.bitStart - a.bitStart)
  const gaps = []
  if (sorted[0].bitStart < totalBits - 1) gaps.push({ start: totalBits - 1, end: sorted[0].bitStart + 1 })
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].bitEnd - sorted[i + 1].bitStart > 1) {
      gaps.push({ start: sorted[i].bitEnd - 1, end: sorted[i + 1].bitStart + 1 })
    }
  }
  if (sorted[sorted.length - 1].bitEnd > 0) gaps.push({ start: sorted[sorted.length - 1].bitEnd - 1, end: 0 })
  for (const gap of gaps) {
    children.push(makeBitField({
      name: '保留位', bitStart: gap.start, bitEnd: gap.end,
      constraint: fixed(0), desc: '未使用位，固定为 0'
    }))
  }
  children.sort((a, b) => b.bitStart - a.bitStart)
}

const removeField = (id) => {
  const fields = props.protocol.fields
  const i = fields.findIndex(f => f.id === id)
  if (i >= 0) fields.splice(i, 1)
}

const confirmCtxDelete = () => {
  rowCtx.visible = false
  if (!rowCtx.row) return
  ElMessageBox.confirm('确认删除该字段？', '确认', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  }).then(() => {
    removeField(rowCtx.row.id)
  }).catch(() => {})
}

const removeBitChild = (bitRow) => {
  const parent = findParentByteField(bitRow)
  if (parent) {
    const ci = parent.children.findIndex(c => c.id === bitRow.id)
    if (ci >= 0) parent.children.splice(ci, 1)
  }
}

const duplicateField = (row) => {
  if (!row) return
  const fields = props.protocol.fields
  if (row.kind === 'byte') {
    const copy = makeByteField({
      ...row, name: row.name + '(副本)',
      children: row.children.map(c => makeBitField({ ...c }))
    })
    fields.push(copy)
  } else if (row.kind === 'repeat') {
    const copy = makeRepeatGroup({
      ...row, name: row.name + '(副本)',
      children: row.children.map(c => makeByteField({ ...c, children: c.children?.map(bc => makeBitField({ ...bc })) || [] }))
    })
    fields.push(copy)
  }
}

const isFirstField = (row) => {
  const fields = props.protocol.fields
  return fields.length > 0 && fields[0].id === row.id
}
const isLastField = (row) => {
  const fields = props.protocol.fields
  return fields.length > 0 && fields[fields.length - 1].id === row.id
}

const moveField = (id, direction) => {
  const fields = props.protocol.fields
  const idx = fields.findIndex(f => f.id === id)
  if (idx < 0) return
  const newIdx = direction === 'up' ? idx - 1 : idx + 1
  if (newIdx < 0 || newIdx >= fields.length) return
  const tmp = fields[idx]
  fields[idx] = fields[newIdx]
  fields[newIdx] = tmp
}

// ─── 重复组编辑弹窗 ───
const repeatEditorVisible = ref(false)
const editingRepeat = ref(null)
const openRepeatEditor = (repeatRow) => {
  editingRepeat.value = repeatRow
  repeatEditorVisible.value = true
}
const addRepeatChildByte = () => {
  if (!editingRepeat.value) return
  editingRepeat.value.children.push(makeByteField({ name: `字段${editingRepeat.value.children.length + 1}` }))
}
const removeRepeatChild = (group, childId) => {
  if (!group) return
  const i = group.children.findIndex(c => c.id === childId)
  if (i >= 0) group.children.splice(i, 1)
}

// ─── 数值字段（供动态重复次数引用） ───
const numericFieldsBefore = (targetId) => getNumericFieldsBefore(props.protocol.fields, targetId)

// ─── 表格行样式 ───
const tableRowClass = ({ row }) => {
  const cls = []
  if (row.kind === 'repeat') cls.push('row--repeat')
  else if (row.kind === 'bit') cls.push('row--bit')
  else cls.push('tl-row') // byte → top-level, sortable 可拖拽
  if (highlightFieldId.value && row.id === highlightFieldId.value) cls.push('row--highlight')
  return cls.join(' ')
}

// ─── sortablejs 拖拽排序 ───
const tableRef = ref(null)
const tableKey = ref(0)
let sortableObserver = null

const initSortable = () => {
  // 断开旧 observer（如果有）
  sortableObserver?.disconnect()

  const el = tableRef.value?.$el?.querySelector('.el-table__body-wrapper tbody')
  if (!el) return

  // ── 展开箭头 DOM 迁移：从 drag-col（首列）→ offset-col（第二列） ──
  const moveExpandIcons = () => {
    const tbody = tableRef.value?.$el?.querySelector('.el-table__body tbody')
    if (!tbody) return
    tbody.querySelectorAll('tr').forEach(tr => {
      const cells = tr.querySelectorAll('td')
      if (cells.length < 2) return

      const dragCell = cells[0].querySelector('.cell')
      const offsetCell = cells[1].querySelector('.cell')
      if (!dragCell || !offsetCell) return

      // 1. 迁移展开箭头到偏移列
      const expandIcon = dragCell.querySelector('.el-table__expand-icon')
      if (expandIcon) offsetCell.prepend(expandIcon)

      // 2. 清除 drag-col 中残留的占位符
      dragCell.querySelectorAll('.el-table__expand-icon--placeholder').forEach(el => el.remove())

      // 3. 解包 el-table 树形缩进包裹器，让拖拽手柄直接位于 cell 内
      const treeWrapper = dragCell.querySelector('.el-table__tree')
      if (treeWrapper) {
        while (treeWrapper.firstChild) dragCell.appendChild(treeWrapper.firstChild)
        treeWrapper.remove()
      }

      // 4. 清除可能残留的缩进 span
      dragCell.querySelectorAll('.el-table__indent').forEach(el => el.remove())
    })
  }
  moveExpandIcons()

  Sortable.create(el, {
    handle: '.drag-handle',
    draggable: '.tl-row',
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: ({ oldIndex, newIndex }) => {
      if (oldIndex === newIndex || oldIndex == null) return

      // ── 1. 计算新顺序并替换数组，触发 Vue 响应式更新 ──
      const fields = [...props.protocol.fields]
      const [moved] = fields.splice(oldIndex, 1)
      if (!moved) return
      fields.splice(newIndex, 0, moved)
      props.protocol.fields.splice(0, props.protocol.fields.length, ...fields)

      // ── 2. 显式重算偏移（含 bit children 的显示偏移） ──
      const resolveDynamic = (fieldId) => {
        const f = props.protocol.fields.find(x => x.id === fieldId)
        if (f && f.kind === 'byte' && isNumericType(f.dataType)) {
          const val = f.constraint.mode === 'fixed' ? f.constraint.value : f.constraint.min
          return Math.max(1, val || 1)
        }
        return 1
      }
      computeOffsets(props.protocol.fields, resolveDynamic)
      for (const f of props.protocol.fields) {
        if (f.kind === 'byte' && f.children?.length) computeBitOffsets(f)
      }

      // ── 3. 强制 el-table 销毁重建，彻底清除 treeData 缓存 ──
      //    删除位子段后 parent.children 被 in-place splice 但引用不变，
      //    el-table 内部 treeData 可能仍持有旧 children 快照。
      //    改变 :key 让 Vue 销毁旧 el-table 实例并从当前数据新建，
      //    treeData 从零构建，不存在任何过期引用。
      tableKey.value++
      nextTick(() => initSortable())
    }
  })

  // ── MutationObserver：DOM 变化时自动迁移展开图标 ──
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length || m.type === 'childList') {
        moveExpandIcons()
        return
      }
    }
  })
  const tbody = tableRef.value?.$el?.querySelector('.el-table__body tbody')
  if (tbody) observer.observe(tbody, { childList: true, subtree: true })
  sortableObserver = observer
}

onMounted(() => {
  nextTick(() => initSortable())
})

onBeforeUnmount(() => {
  sortableObserver?.disconnect()
})

// ─── 右键菜单 ───
const rowCtx = reactive({ visible: false, x: 0, y: 0, row: null })
const onRowCtx = (row, col, event) => {
  event.preventDefault()
  Object.assign(rowCtx, { visible: true, x: event.clientX, y: event.clientY, row })
}

// ─── 暴露给父组件 ───
const fillAllGaps = () => {
  const fillRecursive = (fields) => {
    for (const f of fields) {
      if (f.kind === 'byte' && f.children?.length) {
        const totalBits = f.byteLength * 8
        if (getBitsUsedInField(f) < totalBits) fillRemainingBits(f)
      }
      if (f.kind === 'repeat' && f.children?.length) {
        fillRecursive(f.children)
      }
    }
  }
  fillRecursive(props.protocol.fields)
}
defineExpose({ fillAllGaps, markClean })
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.proto-name { max-width: 280px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head__right { display: flex; align-items: center; gap: 8px; .lbl { font-size: 13px; color: var(--el-text-color-secondary); } }
.proto-type-sel { width: 122px; }
.proto-endian-sel { width: 132px; }
.proto-prefix {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
  font-weight: 400;
}
.saved-hint {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  padding: 2px 8px; border-radius: 10px;
  .el-icon { font-size: 12px; }
}
.saved-hint-fade-enter-active, .saved-hint-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.saved-hint-fade-enter-from, .saved-hint-fade-leave-to { opacity: 0; transform: translateX(4px); }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin-bottom: 4px; }
.proto-desc { margin-bottom: 12px; }
.meta-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.meta-row__label { font-size: 13px; color: var(--el-text-color-regular); }
.meta-row__label.req::before { content: '*'; color: var(--el-color-danger); margin-right: 2px; }
.meta-sel { width: 200px; }

.summary-bar {
  display: flex; align-items: center; gap: 18px; padding: 10px 14px; margin-bottom: 12px;
  background: linear-gradient(90deg, var(--el-color-primary-light-9), var(--el-fill-color-light));
  border: 1px solid var(--el-color-primary-light-6);
  border-radius: 6px; font-size: 13px;
  flex-wrap: wrap;
  &__item { display: inline-flex; align-items: baseline; gap: 4px; color: var(--el-text-color-secondary); b { color: var(--el-color-primary); font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; } em { font-style: normal; font-size: 11px; } }
  &__lbl { font-size: 11px; color: var(--el-text-color-placeholder); }
  &__sep { width: 1px; height: 16px; background: var(--el-border-color-lighter); }
  &__progress { display: flex; align-items: center; gap: 8px; margin-left: auto; min-width: 200px; }
  &__progress-text { font-size: 12px; color: var(--el-text-color-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; }
}

.byte-tree {
  flex: 1;
  :deep(.el-select) { .el-input__wrapper { padding: 0 8px; } }
  :deep(.row--repeat) { background: var(--el-fill-color-lighter) !important; }
  :deep(.row--repeat td) { font-weight: 500; }
  :deep(.row--highlight) { background: var(--el-color-warning-light-8) !important; }
  :deep(.sortable-ghost) { opacity: 0.4; background: var(--el-color-primary-light-9) !important; }
}

.offset-hex {
  font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 12px;
  color: var(--el-color-primary); background: var(--el-fill-color); padding: 1px 6px; border-radius: 3px;
}
.bit-pos {
  display: inline-block; min-width: 56px; text-align: center; box-sizing: border-box;
  font-family: 'Cascadia Code', 'Fira Code', monospace; font-size: 11px;
  color: var(--el-color-warning); background: var(--el-color-warning-light-9);
  padding: 2px 6px; border-radius: 3px; line-height: 1.4;
}
.repeat-badge {
  display: inline-block; margin-left: 4px; font-size: 11px;
  color: var(--el-color-info); background: var(--el-color-info-light-9);
  padding: 1px 6px; border-radius: 8px;
}
.repeat-len { font-size: 12px; color: var(--el-text-color-secondary); }
.locked-len { font-size: 12px; color: var(--el-text-color-secondary); font-style: italic; }
.constraint-na { font-size: 13px; color: var(--el-text-color-placeholder); }

.bit-len-over {
  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px var(--el-color-danger) inset !important;
    background: var(--el-color-danger-light-9);
  }
}

/* 拖拽列：清除树形包裹器后确保手柄居中 */
.byte-tree {
  :deep(.drag-col .cell) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }
}

/* 偏移列：展开箭头（由 JS 迁入）+ 偏移文本 */
.byte-tree {
  :deep(.offset-col .cell) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    height: 100% !important;
  }
  :deep(.offset-col .el-table__expand-icon) {
    position: static !important;
    display: inline-flex !important;
    align-items: center !important;
    margin: 0 !important;
    padding: 0 !important;
    flex-shrink: 0;
  }
}

.offset-cell { display: inline-flex; align-items: center; gap: 4px; }

.drag-handle {
  cursor: grab; color: var(--el-text-color-placeholder); font-size: 14px; flex-shrink: 0;
  &:hover { color: var(--el-text-color-regular); }
  &:active { cursor: grabbing; }
}

/* 约束编辑器 */
.enum-editor { display: flex; flex-direction: column; gap: 4px; }
.enum-row { display: flex; align-items: center; gap: 4px; }

.constraint { display: flex; align-items: center; gap: 4px; }
.c-mode { width: 78px; flex-shrink: 0; }
.c-num { width: 56px; }
.c-num--fixed { width: 130px; }
.c-sep { color: var(--el-text-color-secondary); flex-shrink: 0; }

/* 重复组配置 */
.repeat-config { display: flex; align-items: center; gap: 6px; }

.bottom-actions { display: flex; gap: 8px; margin-top: 12px; }
.add-row { flex: 1; border-style: dashed; }

/* 右键菜单 */
.ctx-mask { position: fixed; inset: 0; z-index: 3000; }
.ctx-menu {
  position: fixed; min-width: 150px; padding: 4px 0;
  background: var(--el-bg-color-overlay, #fff); border: 1px solid var(--el-border-color-light);
  border-radius: 6px; box-shadow: var(--el-box-shadow-light); font-size: 13px;
  li {
    list-style: none; padding: 7px 16px; cursor: pointer; color: var(--el-text-color-primary);
    &:hover { background: var(--el-fill-color-light); }
    &.danger { color: var(--el-color-danger); }
  }
}
</style>
