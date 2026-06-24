<template>
  <div class="sig-preview">
    <el-divider>签名预览</el-divider>

    <div class="sig-code">
      <code>{{ signature }}</code>
    </div>

    <!-- 接口参数标签行 -->
    <div class="sig-section" v-if="iface.request.length">
      <span class="sig-section__label">接口参数</span>
      <el-scrollbar class="sig-tags-scroll" direction="horizontal">
        <div class="sig-tags">
          <el-tag
            v-for="p in iface.request"
            :key="p.id"
            size="small"
            effect="light"
            class="sig-tag"
            @click="$emit('navigate', p.id)"
          >
            <span class="sig-tag__type">{{ typeShort(p) }}</span>
            <span class="sig-tag__name">{{ p.name }}</span>
          </el-tag>
        </div>
      </el-scrollbar>
    </div>

    <!-- 接口响应标签行 -->
    <div class="sig-section" v-if="iface.response.length">
      <span class="sig-section__label">接口响应</span>
      <el-scrollbar class="sig-tags-scroll" direction="horizontal">
        <div class="sig-tags">
          <el-tag
            v-for="p in iface.response"
            :key="p.id"
            size="small"
            type="success"
            effect="light"
            class="sig-tag"
            @click="$emit('navigate', p.id)"
          >
            <span class="sig-tag__type">{{ typeShort(p) }}</span>
            <span class="sig-tag__name">{{ p.name }}</span>
          </el-tag>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  iface: { type: Object, required: true },
})
defineEmits(['navigate'])

const typeShort = (p) => (p.type === '常量' ? p.dataType : p.type)

const signature = computed(() => {
  const it = props.iface
  if (!it) return ''
  const ret = it.response.map(typeShort).join(', ') || 'void'
  const args = it.request.map((p) => `${typeShort(p)} ${p.name}`).join(', ')
  return `(${ret}) ${it.name}(${args})`
})
</script>

<style scoped lang="scss">
.sig-preview { margin-bottom: 12px; }
.sig-code {
  margin-bottom: 10px;
  code {
    display: inline-block; font-size: 13px; color: var(--el-color-primary);
    background: var(--el-fill-color-light); padding: 4px 12px; border-radius: 4px;
    font-family: 'Cascadia Code', 'Fira Code', monospace;
  }
}
.sig-section {
  display: flex; align-items: center; gap: 10px; margin-bottom: 6px;
  &__label {
    font-size: 12px; font-weight: 600; color: var(--el-text-color-secondary);
    min-width: 56px; flex-shrink: 0; padding-left: 8px;
    border-left: 2px solid var(--el-color-primary);
  }
}
.sig-tags-scroll { flex: 1; min-width: 0; :deep(.el-scrollbar__wrap) { overflow-y: hidden; } }
.sig-tags { display: flex; gap: 6px; white-space: nowrap; padding: 2px 0; }
.sig-tag {
  cursor: pointer; transition: transform 0.15s;
  &:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.08); }
  &__type { color: var(--el-text-color-secondary); margin-right: 4px; }
  &__name { font-weight: 500; }
}
</style>
