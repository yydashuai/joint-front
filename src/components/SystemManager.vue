<template>
  <el-dialog
    :model-value="modelValue"
    title="被测系统管理"
    width="860px"
    class="system-manager"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="resetForm"
  >
    <div class="system-manager__body">
      <div class="system-manager__list">
        <div class="system-manager__toolbar">
          <span>系统列表</span>
          <el-tooltip content="创建一个新的被测系统"><el-button type="primary" :icon="Plus" size="small" @click="startCreate">新增系统</el-button></el-tooltip>
        </div>

        <el-table :data="systemStore.systems" height="360" stripe>
          <el-table-column prop="name" label="系统名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="owner" label="负责人" width="120" show-overflow-tooltip />
          <el-table-column label="模块数" width="80" align="center">
            <template #default="{ row }">{{ moduleCount(row.id) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" align="center">
            <template #default="{ row }">
              <el-tooltip content="管理该系统下的模块"><el-button :icon="ConnectionIcon" size="small" link type="success" @click="manageModules(row)">模块管理</el-button></el-tooltip>
              <el-tooltip content="编辑该系统信息"><el-button :icon="Edit" size="small" link type="primary" @click="startEdit(row)">编辑</el-button></el-tooltip>
              <el-popconfirm
                width="260"
                title="删除后，该系统下模块将归入未分配，不会删除模块。确认删除？"
                @confirm="removeSystem(row)"
              >
                <template #reference>
                  <el-button :icon="Delete" size="small" link type="danger">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-form ref="formRef" :model="draft" :rules="rules" label-width="76px" class="system-manager__form">
        <div class="system-manager__form-title">{{ editingId ? '编辑系统' : '新增系统' }}</div>
        <el-form-item label="名称" prop="name">
          <el-input v-model="draft.name" placeholder="如 综合武器管理系统" />
        </el-form-item>
        <el-form-item label="负责人" prop="owner">
          <el-input v-model="draft.owner" placeholder="如 装备联试组" />
        </el-form-item>
        <el-form-item label="描述" prop="desc">
          <el-input v-model="draft.desc" type="textarea" :rows="4" placeholder="说明该系统覆盖的接口范围" />
        </el-form-item>
        <div class="system-manager__form-actions">
          <el-tooltip content="清空表单内容"><el-button @click="resetForm">清空</el-button></el-tooltip>
          <el-tooltip :content="editingId ? '保存对系统的修改' : '创建新的被测系统'"><el-button type="primary" @click="saveSystem">{{ editingId ? '保存修改' : '创建系统' }}</el-button></el-tooltip>
        </div>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Connection as ConnectionIcon, Delete, Edit, Plus } from '@element-plus/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'

defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const systemStore = useSystemStore()
const connectionStore = useConnectionStore()
const router = useRouter()
const formRef = ref()
const editingId = ref(null)
const blankDraft = () => ({ name: '', desc: '', owner: '' })
const draft = reactive(blankDraft())

const rules = {
  name: [{ required: true, message: '请输入系统名称', trigger: 'blur' }]
}

const moduleCount = (systemId) => connectionStore.nodes.filter((module) => module.systemId === systemId).length

const startCreate = () => {
  editingId.value = null
  Object.assign(draft, blankDraft())
  formRef.value?.clearValidate()
}

const startEdit = (system) => {
  editingId.value = system.id
  Object.assign(draft, {
    name: system.name,
    desc: system.desc,
    owner: system.owner
  })
  formRef.value?.clearValidate()
}

const resetForm = () => {
  startCreate()
}

const saveSystem = async () => {
  if (!formRef.value) return
  await formRef.value.validate((valid) => {
    if (!valid) return
    const payload = { ...draft }
    if (editingId.value) {
      systemStore.update(editingId.value, payload)
      ElMessage.success('系统信息已更新')
    } else {
      const created = systemStore.add(payload)
      systemStore.setCurrent(created.id)
      ElMessage.success('系统已创建')
    }
    resetForm()
  })
}

const manageModules = async (system) => {
  systemStore.setCurrent(system.id)
  emit('update:modelValue', false)
  await nextTick()
  router.push('/connection')
}

const removeSystem = (system) => {
  const count = moduleCount(system.id)
  connectionStore.unassignSystem(system.id)
  systemStore.remove(system.id)
  ElMessage.success(count ? `已删除系统，${count} 个模块已归入未分配` : '系统已删除')
}
</script>

<style scoped lang="scss">
.system-manager {
  &__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 18px;
  }

  &__list,
  &__form {
    min-width: 0;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-weight: 600;
  }

  &__form {
    border-left: 1px solid var(--el-border-color-lighter);
    padding-left: 18px;
  }

  &__form-title {
    font-weight: 600;
    margin-bottom: 14px;
  }

  &__form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
