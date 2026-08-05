<template>
  <el-card class="main" shadow="never" :body-style="mainBody">
    <template #header>
      <div class="proto-head">
        <span class="proto-head__label">报文名称</span>
        <el-input
          v-model="iface.name"
          class="proto-name"
          placeholder="报文名称"
          @focus="beginNameEdit"
          @change="commitNameEdit"
        />
        <el-popconfirm title="删除该报文？" @confirm="$emit('delete')">
          <template #reference><el-button :icon="Delete" plain>删除报文</el-button></template>
        </el-popconfirm>
      </div>
    </template>

    <el-scrollbar class="editor-scroll">
      <!-- 报文基本信息 -->
      <div class="field-label">备注说明</div>
      <el-input v-model="iface.desc" placeholder="可选，描述该报文的用途" class="proto-desc" />

      <!-- 字段定义（统一表格，不再区分收发） -->
      <MessageFieldTable :iface="iface" />
    </el-scrollbar>
  </el-card>
</template>

<script setup>
import { ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'
import MessageFieldTable from './MessageFieldTable.vue'

const props = defineProps({
  iface: { type: Object, required: true },
})
defineEmits(['delete'])

const { nextUniqueName, validateName } = useEntityNameGuard()

const mainBody = { flex: '1', minHeight: '0', display: 'flex', flexDirection: 'column' }

const nameBeforeEdit = ref('')
function beginNameEdit() { nameBeforeEdit.value = props.iface.name }
function commitNameEdit() {
  const validName = validateName(props.iface.name, props.iface, '报文')
  if (!validName) props.iface.name = nameBeforeEdit.value || nextUniqueName('新建报文', props.iface)
  else props.iface.name = validName
}
</script>

<style scoped lang="scss">
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.proto-head { display: flex; align-items: center; gap: 12px; }
.proto-head__label { font-size: 14px; font-weight: 600; color: var(--el-text-color-regular); flex-shrink: 0; }
.proto-name { max-width: 320px; :deep(.el-input__wrapper) { font-weight: 600; } }
.proto-head .el-popconfirm { margin-left: auto; }
.field-label { font-size: 13px; font-weight: 500; color: var(--el-text-color-regular); margin: 4px 0 4px; }
.proto-desc { margin-bottom: 12px; }
.editor-scroll { flex: 1; min-height: 0; }
</style>
