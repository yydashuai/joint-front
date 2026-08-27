<template>
  <el-dialog
    :model-value="modelValue"
    title="联试对象管理"
    width="960px"
    class="system-manager"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="resetForm"
  >
    <div class="system-manager__body">
      <div class="system-manager__list">
        <div class="system-manager__toolbar">
          <span>联试对象列表</span>
        </div>

        <el-table :data="systemStore.systems" height="360" stripe>
          <el-table-column prop="name" label="联试对象名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="owner" label="负责人" width="120" show-overflow-tooltip />
          <el-table-column label="模块数" width="80" align="center">
            <template #default="{ row }">{{ moduleCount(row.id) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="220" align="center">
            <template #default="{ row }">
              <el-tooltip content="管理该联试对象下的链路节点"><el-button :icon="ConnectionIcon" size="small" link type="success" @click="manageModules(row)">节点管理</el-button></el-tooltip>
              <el-tooltip content="编辑该联试对象信息"><el-button :icon="Edit" size="small" link type="primary" @click="startEdit(row)">编辑</el-button></el-tooltip>
              <el-popconfirm
                width="260"
                title="删除后，该联试对象下链路节点将归入未分配，不会删除链路节点。确认删除？"
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

      <el-form ref="formRef" :model="draft" :rules="rules" label-position="left" label-width="76px" hide-required-asterisk class="system-manager__form">
        <div class="system-manager__form-title">{{ editingId ? '编辑联试对象' : '新增联试对象' }}</div>
        <el-form-item label="名称" prop="name" class="system-manager__required">
          <el-input v-model="draft.name" placeholder="如 综合武器管理对象" />
        </el-form-item>
        <el-form-item label="负责人" prop="owner">
          <el-input v-model="draft.owner" placeholder="如 装备联试组" />
        </el-form-item>
        <el-form-item label="描述" prop="desc">
          <el-input v-model="draft.desc" type="textarea" :rows="4" placeholder="说明该联试对象覆盖的接口范围" />
        </el-form-item>
        <div class="system-manager__form-actions">
          <el-tooltip content="清空表单内容"><el-button @click="resetForm">清空</el-button></el-tooltip>
          <el-tooltip :content="editingId ? '保存对联试对象的修改' : '创建新的联试对象'"><el-button type="primary" @click="saveSystem">{{ editingId ? '保存修改' : '创建联试对象' }}</el-button></el-tooltip>
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
import { Connection as ConnectionIcon, Delete, Edit } from '@element-plus/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import { useSystemStore } from '@/stores/system'
import { useEntityNameGuard } from '@/composables/useEntityNameGuard'

defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const systemStore = useSystemStore()
const connectionStore = useConnectionStore()
const { validateName } = useEntityNameGuard()
const router = useRouter()
const formRef = ref()
const editingId = ref(null)
const blankDraft = () => ({ name: '', desc: '', owner: '' })
const draft = reactive(blankDraft())

const rules = {
  name: [{ required: true, message: '请输入联试对象名称', trigger: 'blur' }]
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
    const current = editingId.value
      ? systemStore.systems.find((system) => system.id === editingId.value)
      : null
    const validName = validateName(draft.name, current, '系统')
    if (!validName) return
    const payload = { ...draft, name: validName }
    if (editingId.value) {
      systemStore.update(editingId.value, payload)
      ElMessage.success('联试对象信息已更新')
    } else {
      const created = systemStore.add(payload)
      systemStore.setCurrent(created.id)
      ElMessage.success('联试对象已创建')
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
  ElMessage.success(count ? `已删除联试对象，${count} 个链路节点已归入未分配` : '联试对象已删除')
}
</script>

<style scoped lang="scss">
.system-manager {
  &__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 290px;
    gap: 24px;
  }

  &__list,
  &__form {
    min-width: 0;
  }

  &__toolbar {
    display: flex;
    align-items: center;
    height: 32px;
    margin-bottom: 10px;
    font-weight: 600;
  }

  &__form {
    border-left: 1px solid var(--el-border-color-lighter);
    padding-left: 24px;

    :deep(.el-form-item__label) {
      justify-content: flex-start;
      text-align: left;
    }

    :deep(.el-input__inner),
    :deep(.el-textarea__inner) {
      text-align: left;
    }
  }

  &__required {
    :deep(.el-form-item__content) {
      position: relative;

      &::before {
        position: absolute;
        left: -11px;
        top: 50%;
        color: var(--el-color-danger);
        content: '*';
        font-size: 14px;
        line-height: 1;
        transform: translateY(-50%);
      }
    }
  }

  &__form-title {
    display: flex;
    align-items: center;
    height: 32px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  &__form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>
