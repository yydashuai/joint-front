<template>
  <div class="framing-panel">
    <!-- ========== 拆包规则 ========== -->
    <el-collapse v-model="activePanels">
      <el-collapse-item name="framing" title="帧结构与拆包规则">
        <div class="fp-section">
          <!-- TCP 拆包模式 -->
          <div v-if="isByteStream" class="fp-block">
            <div class="fp-label">拆包模式</div>
            <el-radio-group v-model="framing.mode" size="small" class="fp-radio-group">
              <el-radio value="fixed">固定长度帧</el-radio>
              <el-radio value="lengthField">长度域分包</el-radio>
              <el-radio value="delimiter">分隔符分包</el-radio>
            </el-radio-group>

            <!-- 固定长度 -->
            <div v-if="framing.mode === 'fixed'" class="fp-row">
              <span class="fp-key">帧总长度</span>
              <el-input-number v-model="framing.fixedLength" :min="1" :max="65535" size="small" controls-position="right" style="width:120px" />
              <span class="fp-hint">字节</span>
            </div>

            <!-- 长度域 -->
            <template v-else-if="framing.mode === 'lengthField'">
              <div class="fp-row">
                <span class="fp-key">长度域字段</span>
                <el-select v-model="framing.lengthFieldId" size="small" placeholder="选择字段" style="width:180px" @change="onLengthFieldChange">
                  <el-option v-for="f in numericFieldOptions" :key="f.value" :label="f.label" :value="f.value" />
                </el-select>
              </div>
              <div class="fp-row">
                <el-checkbox v-model="framing.lengthIncludesHeader">长度值包含帧头</el-checkbox>
                <el-checkbox v-model="framing.lengthIncludesSelf">长度值包含自身</el-checkbox>
              </div>
            </template>

            <!-- 分隔符 -->
            <template v-else-if="framing.mode === 'delimiter'">
              <div class="fp-row">
                <span class="fp-key">帧头标识</span>
                <el-input v-model="framing.headerBytes" size="small" placeholder="十六进制，如 AA55" style="width:160px">
                  <template #prepend>0x</template>
                </el-input>
              </div>
              <div class="fp-row">
                <span class="fp-key">帧尾标识</span>
                <el-input v-model="framing.footerBytes" size="small" placeholder="可选" style="width:160px">
                  <template #prepend>0x</template>
                </el-input>
                <span class="fp-hint">（可选，留空则仅用帧头判断）</span>
              </div>
            </template>
          </div>

          <!-- UDP 提示 -->
          <div v-else class="fp-hint-block">
            <el-icon><InfoFilled /></el-icon>
            <span>UDP 天然有报文边界，通常不需要额外配置拆包规则。如需自定义帧结构，可展开配置。</span>
          </div>
        </div>
      </el-collapse-item>

      <!-- ========== 校验规则 ========== -->
      <el-collapse-item name="checksum" title="校验规则">
        <div class="fp-block">
          <div class="fp-row">
            <span class="fp-key">校验方式</span>
            <el-select v-model="checksum.type" size="small" style="width:160px" @change="onChecksumTypeChange">
              <el-option label="无" value="none" />
              <el-option label="和校验 (8位)" value="sum8" />
              <el-option label="和校验 (16位)" value="sum16" />
              <el-option label="CRC-16" value="crc16" />
              <el-option label="CRC-32" value="crc32" />
            </el-select>
          </div>

          <template v-if="checksum.type !== 'none'">
            <div class="fp-row">
              <span class="fp-key">校验域字段</span>
              <el-select v-model="checksum.fieldId" size="small" placeholder="选择字段" style="width:180px" @change="onChecksumFieldChange">
                <el-option v-for="f in allFieldOptions" :key="f.value" :label="f.label" :value="f.value" />
              </el-select>
            </div>
            <div class="fp-row">
              <span class="fp-key">校验范围</span>
              <el-input-number v-model="checksum.rangeStart" :min="0" :controls="false" size="small" style="width:70px" />
              <span class="fp-sep">~</span>
              <el-input-number v-model="checksum.rangeEnd" :min="0" :controls="false" size="small" style="width:70px" />
              <span class="fp-hint">字节偏移</span>
            </div>
          </template>

          <!-- CRC 专用配置 -->
          <template v-if="checksum.type === 'crc16' || checksum.type === 'crc32'">
            <el-divider content-position="left">CRC 参数</el-divider>
            <div class="fp-row">
              <span class="fp-key">选择预设</span>
              <el-select size="small" style="width:180px" placeholder="自定义" @change="onCrcPresetChange">
                <el-option v-for="p in crcPresets" :key="p.name" :label="p.name" :value="p.name">
                  <span>{{ p.name }}</span>
                  <span style="color:var(--el-text-color-secondary);font-size:12px;margin-left:8px">{{ p.desc }}</span>
                </el-option>
              </el-select>
            </div>
            <div class="fp-row fp-crc-params">
              <div class="fp-crc-item">
                <span class="fp-key">多项式</span>
                <el-input v-model="checksum.polynomial" size="small" style="width:100px">
                  <template #prepend>0x</template>
                </el-input>
              </div>
              <div class="fp-crc-item">
                <span class="fp-key">初始值</span>
                <el-input v-model="checksum.initValue" size="small" style="width:100px">
                  <template #prepend>0x</template>
                </el-input>
              </div>
              <div class="fp-crc-item">
                <span class="fp-key">结果异或</span>
                <el-input v-model="checksum.xorOut" size="small" style="width:100px">
                  <template #prepend>0x</template>
                </el-input>
              </div>
            </div>
            <div class="fp-row">
              <el-checkbox v-model="checksum.reflectIn">输入反转 (refIn)</el-checkbox>
              <el-checkbox v-model="checksum.reflectOut">输出反转 (refOut)</el-checkbox>
            </div>
          </template>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { isNumericType } from '@/stores/protocol'
import { CRC_PRESETS, crcPresetByName } from '@/utils/crc'

const props = defineProps({
  protocol: { type: Object, required: true },
  fields: { type: Array, default: () => [] },
  highlightFieldId: { type: [Number, null], default: null },
})
const emit = defineEmits(['highlight'])

// 判断是否为字节流协议（有帧结构/校验和）
const isByteStream = computed(() =>
  (props.protocol.fields || []).some(f => f.kind === 'byte' || f.kind === 'bit' || f.kind === 'repeat')
)

// framing/checksum 是协议的直接属性（重构后不再嵌套在 config 下）
const framing = computed(() => {
  if (!props.protocol.framing) {
    props.protocol.framing = {
      mode: 'fixed', fixedLength: 0, lengthFieldId: null,
      lengthIncludesHeader: true, lengthIncludesSelf: true,
      headerBytes: '', footerBytes: ''
    }
  }
  return props.protocol.framing
})

const checksum = computed(() => {
  if (!props.protocol.checksum) {
    props.protocol.checksum = {
      type: 'none', fieldId: null, rangeStart: 0, rangeEnd: 0,
      polynomial: '0x1021', initValue: '0xFFFF',
      reflectIn: false, reflectOut: false, xorOut: '0x0000'
    }
  }
  return props.protocol.checksum
})

const activePanels = ref(['framing'])

// 字段选项
const numericFieldOptions = computed(() => {
  const result = []
  const collect = (fields) => {
    for (const f of fields) {
      if (f.kind === 'byte' && isNumericType(f.dataType)) {
        result.push({ label: f.name || `字段#${f.id}`, value: f.id })
      }
      if (f.kind === 'repeat' && f.children) collect(f.children)
    }
  }
  collect(props.fields)
  return result
})

const allFieldOptions = computed(() => {
  const result = []
  const collect = (fields) => {
    for (const f of fields) {
      if (f.kind === 'byte') {
        result.push({ label: f.name || `字段#${f.id}`, value: f.id })
      }
      if (f.kind === 'repeat' && f.children) collect(f.children)
    }
  }
  collect(props.fields)
  return result
})

// CRC 预设
const crcPresets = computed(() => {
  const width = checksum.value.type === 'crc32' ? 32 : 16
  return CRC_PRESETS.filter(p => p.width === width)
})

// 事件处理
const onLengthFieldChange = (fieldId) => {
  emit('highlight', fieldId)
}

const onChecksumFieldChange = (fieldId) => {
  emit('highlight', fieldId)
}

const onChecksumTypeChange = (type) => {
  if (type === 'none') {
    emit('highlight', null)
  }
}

const onCrcPresetChange = (name) => {
  const preset = crcPresetByName(name)
  if (!preset) return
  checksum.value.polynomial = '0x' + preset.poly.toString(16).toUpperCase()
  checksum.value.initValue = '0x' + preset.init.toString(16).toUpperCase()
  checksum.value.reflectIn = preset.refIn
  checksum.value.reflectOut = preset.refOut
  checksum.value.xorOut = '0x' + preset.xorOut.toString(16).toUpperCase()
}
</script>

<style scoped lang="scss">
.framing-panel { margin-bottom: 12px; }

.fp-section { padding: 4px 0; }
.fp-block { padding: 4px 0; }

.fp-label {
  font-size: 13px; font-weight: 500; color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.fp-radio-group { margin-bottom: 12px; }

.fp-row {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
  flex-wrap: wrap;
}

.fp-key {
  font-size: 13px; color: var(--el-text-color-secondary);
  min-width: 70px; flex-shrink: 0;
}

.fp-sep { color: var(--el-text-color-secondary); }

.fp-hint {
  font-size: 12px; color: var(--el-text-color-placeholder);
}

.fp-hint-block {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: var(--el-fill-color-light); border-radius: 6px;
  font-size: 13px; color: var(--el-text-color-secondary);
}

.fp-crc-params { gap: 16px; }
.fp-crc-item { display: flex; align-items: center; gap: 6px; }

:deep(.el-collapse) {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
:deep(.el-collapse-item__header) {
  height: 40px; padding: 0 16px;
  font-size: 13px; font-weight: 500;
  background: var(--el-fill-color-lighter);
}
:deep(.el-collapse-item__content) { padding: 12px 16px; }
:deep(.el-divider) { margin: 8px 0 12px; }
</style>
