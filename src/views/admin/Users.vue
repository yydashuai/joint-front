<template>
  <div class="page users-page">
    <!-- ======== 页面头 ======== -->
    <div class="page__header">
      <div>
        <h2>用户管理</h2>
        <div class="page__desc">创建和管理联试工具用户账号，分配测试权限</div>
      </div>
      <el-tooltip content="创建一个新的用户账号"><el-button type="primary" :icon="Plus" @click="openDialog()">新建用户</el-button></el-tooltip>
    </div>

    <!-- ======== 统计栏 ======== -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-num">{{ authStore.users.length }}</span>
        <span class="stat-label">总用户</span>
      </div>
      <div class="stat-item">
        <span class="stat-num stat-num--primary">{{ authStore.adminUsers.length }}</span>
        <span class="stat-label">管理员</span>
      </div>
      <div class="stat-item">
        <span class="stat-num stat-num--info">{{ authStore.testerUsers.length }}</span>
        <span class="stat-label">测试员</span>
      </div>
      <div class="stat-item">
        <span class="stat-num" :class="{ 'stat-num--warn': disabledCount > 0 }">{{ disabledCount }}</span>
        <span class="stat-label">已禁用</span>
      </div>
    </div>

    <!-- ======== 用户表格 ======== -->
    <el-card shadow="never" :body-style="{ padding: '0' }">
      <el-table :data="authStore.users" size="small" style="width: 100%;" stripe>
        <el-table-column label="用户名" width="140">
          <template #default="{ row }">
            <span class="mono">{{ row.username }}</span>
          </template>
        </el-table-column>

        <el-table-column label="姓名" width="120" prop="realName" />

        <el-table-column label="角色" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? '' : 'info'" size="small" effect="plain">
              {{ row.role === 'admin' ? '管理员' : '测试员' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="分配系统" min-width="200">
          <template #default="{ row }">
            <template v-if="row.role === 'admin'">
              <el-tag size="small" type="success" effect="plain">全部系统</el-tag>
            </template>
            <template v-else>
              <div class="sys-tags">
                <el-tag
                  v-for="sys in getAssignedSystems(row.id).slice(0, 3)"
                  :key="sys.id"
                  size="small"
                  class="sys-tag"
                >
                  {{ sys.name }}
                </el-tag>
                <el-tag v-if="getAssignedSystems(row.id).length > 3" size="small" type="info" effect="plain">
                  +{{ getAssignedSystems(row.id).length - 3 }}
                </el-tag>
                <span v-if="!getAssignedSystems(row.id).length" class="text-ph">未分配</span>
              </div>
            </template>
          </template>
        </el-table-column>

        <el-table-column label="启用账号" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 'active'"
              :disabled="row.id === authStore.currentUser?.id"
              @change="onToggleStatus(row)"
              size="small"
            />
          </template>
        </el-table-column>

        <el-table-column label="最后登录" width="160" prop="lastLogin">
          <template #default="{ row }">
            <span :class="{ 'text-ph': !row.lastLogin }">{{ row.lastLogin || '从未登录' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="300" align="center">
          <template #default="{ row }">
            <el-tooltip content="编辑该用户信息"><el-button size="small" text type="primary" @click="openDialog(row)">编辑</el-button></el-tooltip>
            <el-tooltip content="重置该用户的登录密码"><el-button size="small" text type="warning" @click="openResetPwd(row)">重置密码</el-button></el-tooltip>
            <el-popconfirm
              title="确认删除该用户？此操作不可恢复。"
              confirm-button-text="删除"
              cancel-button-text="取消"
              @confirm="onDelete(row.id)"
            >
              <template #reference>
                <el-button size="small" text type="danger" :disabled="row.id === authStore.currentUser?.id">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- ======== 新建/编辑用户对话框 ======== -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingUser ? '编辑用户' : '新建用户'"
      width="560px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" placeholder="登录账号（英文+数字）" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%;">
            <el-option label="管理员" value="admin" />
            <el-option label="测试员" value="tester" />
          </el-select>
        </el-form-item>
        <template v-if="!editingUser">
          <el-form-item label="初始密码" prop="password">
            <el-input v-model="form.password" type="password" placeholder="至少4位" show-password />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPwd">
            <el-input v-model="form.confirmPwd" type="password" placeholder="再次输入密码" show-password />
          </el-form-item>
        </template>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" placeholder="可选" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="可选" />
        </el-form-item>
        <el-form-item v-if="form.role === 'tester'" label="分配系统">
          <el-select v-model="form.systemIds" multiple placeholder="选择可访问的系统" style="width: 100%;">
            <el-option
              v-for="sys in systemStore.systems"
              :key="sys.id"
              :label="sys.name"
              :value="sys.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">{{ editingUser ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- ======== 重置密码对话框 ======== -->
    <el-dialog v-model="resetPwdVisible" title="重置密码" width="420px" destroy-on-close>
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-width="80px">
        <el-form-item label="用户">
          <el-input :model-value="resetTarget?.realName" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="password">
          <el-input v-model="resetForm.password" type="password" placeholder="至少4位" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPwd">
          <el-input v-model="resetForm.confirmPwd" type="password" placeholder="再次输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPwdVisible = false">取消</el-button>
        <el-button type="primary" @click="onResetPwd">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useSystemStore } from '@/stores/system'

const authStore = useAuthStore()
const systemStore = useSystemStore()

/* ========== 统计 ========== */
const disabledCount = computed(() => authStore.users.filter(u => u.status === 'disabled').length)

/* ========== 分配系统显示 ========== */
const getAssignedSystems = (userId) => {
  const ids = authStore.getSystemIds(userId)
  return systemStore.systems.filter(s => ids.includes(s.id))
}

/* ========== 新建/编辑对话框 ========== */
const dialogVisible = ref(false)
const editingUser = ref(null)
const saving = ref(false)
const formRef = ref(null)

const defaultForm = () => ({
  username: '',
  realName: '',
  role: 'tester',
  password: '',
  confirmPwd: '',
  phone: '',
  email: '',
  systemIds: []
})

const form = reactive(defaultForm())

const validateConfirm = (rule, value, callback) => {
  if (value !== form.password) callback(new Error('两次输入的密码不一致'))
  else callback()
}

const formRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '长度 2-20 个字符', trigger: 'blur' }
  ],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' }
  ],
  confirmPwd: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' }
  ]
}

const openDialog = (user) => {
  editingUser.value = user || null
  if (user) {
    Object.assign(form, {
      username: user.username,
      realName: user.realName,
      role: user.role,
      password: '',
      confirmPwd: '',
      phone: user.phone || '',
      email: user.email || '',
      systemIds: user.role === 'tester' ? authStore.getSystemIds(user.id) : []
    })
  } else {
    Object.assign(form, defaultForm())
  }
  dialogVisible.value = true
}

const onSave = async () => {
  // 编辑时密码非必填，跳过密码校验
  if (editingUser.value) {
    const fields = ['username', 'realName', 'role']
    const valid = await formRef.value?.validateField(fields).catch(() => false)
    if (!valid) return
  } else {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid) return
  }

  saving.value = true
  await new Promise(r => setTimeout(r, 300))

  if (editingUser.value) {
    const result = authStore.updateUser(editingUser.value.id, {
      username: form.username,
      realName: form.realName,
      role: form.role,
      phone: form.phone,
      email: form.email
    })
    if (!result.ok) {
      ElMessage.error(result.message)
      saving.value = false
      return
    }
    // 更新权限
    if (form.role === 'tester') {
      authStore.setPermission(editingUser.value.id, form.systemIds)
    }
    ElMessage.success('用户信息已更新')
  } else {
    const result = authStore.addUser({
      username: form.username,
      password: form.password,
      realName: form.realName,
      role: form.role,
      phone: form.phone,
      email: form.email,
      systemIds: form.role === 'tester' ? form.systemIds : []
    })
    if (!result.ok) {
      ElMessage.error(result.message)
      saving.value = false
      return
    }
    ElMessage.success('用户创建成功')
  }

  saving.value = false
  dialogVisible.value = false
}

/* ========== 删除用户 ========== */
const onDelete = (id) => {
  const result = authStore.removeUser(id)
  if (result.ok) {
    ElMessage.success('用户已删除')
  } else {
    ElMessage.error(result.message)
  }
}

/* ========== 启用/禁用 ========== */
const onToggleStatus = (user) => {
  const action = user.status === 'active' ? '禁用' : '启用'
  ElMessageBox.confirm(
    `${action}后该用户将${user.status === 'active' ? '无法登录' : '恢复登录权限'}，是否继续？`,
    `确认${action}`,
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    authStore.toggleStatus(user.id)
    ElMessage.success(`已${action}用户 ${user.realName}`)
  }).catch(() => {})
}

/* ========== 重置密码 ========== */
const resetPwdVisible = ref(false)
const resetTarget = ref(null)
const resetFormRef = ref(null)

const resetForm = reactive({
  password: '',
  confirmPwd: ''
})

const resetValidateConfirm = (rule, value, callback) => {
  if (value !== resetForm.password) callback(new Error('两次输入的密码不一致'))
  else callback()
}

const resetRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' }
  ],
  confirmPwd: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: resetValidateConfirm, trigger: 'blur' }
  ]
}

const openResetPwd = (user) => {
  resetTarget.value = user
  resetForm.password = ''
  resetForm.confirmPwd = ''
  resetPwdVisible.value = true
}

const onResetPwd = async () => {
  const valid = await resetFormRef.value?.validate().catch(() => false)
  if (!valid) return
  authStore.resetPassword(resetTarget.value.id, resetForm.password)
  ElMessage.success(`已重置 ${resetTarget.value.realName} 的密码`)
  resetPwdVisible.value = false
}
</script>

<style scoped lang="scss">
.users-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  gap: 16px;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 12px 20px;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  flex: 1;
}

.stat-num {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  &--primary { color: var(--el-color-primary); }
  &--info { color: #8b9dc3; }
  &--warn { color: var(--el-color-warning); }
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.mono {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.sys-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.sys-tag {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-ph {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}
</style>
