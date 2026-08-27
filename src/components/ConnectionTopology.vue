<template>
  <div class="topo">
    <!-- 中心：本机联试工具 / 当前联试对象 -->
    <div class="topo__hub">
      <el-icon class="topo__hub-icon"><Monitor /></el-icon>
      <div class="topo__hub-name">{{ hubLabel }}</div>
      <div class="topo__hub-sub">本机联试工具</div>
    </div>

    <div v-if="hasContent" class="topo__groups">
      <div v-for="g in renderGroups" :key="g.id" class="topo__group" :class="{ 'no-sys': !g.showSys }">
        <!-- 二级节点：系统接口 / xx方案 -->
        <template v-if="g.showSys">
          <span class="topo__line line--sys" />
          <div class="topo__sysnode" :class="{ 'is-active': g.selectId && g.selectId === selectedId }" @click="emit('select', g.selectId)">
            <el-icon class="topo__sysnode-icon"><component :is="g.icon" /></el-icon>
            <div class="topo__sysnode-main">
              <div class="topo__sysnode-name">{{ g.name }}</div>
              <div v-if="g.sub" class="topo__sysnode-sub">{{ g.sub }}</div>
            </div>
          </div>
        </template>

        <!-- 叶子节点：接口卡 -->
        <div v-if="g.modules.length" class="topo__spokes">
          <div v-for="m in g.modules" :key="m.id" class="topo__spoke">
            <span class="topo__line" :class="`line--${m.status}`" />
            <div
              class="topo__node"
              :class="[{ 'is-active': m.id === selectedId }, `node--${m.status}`]"
              @click="emit('select', m.id)"
            >
              <span class="dot" :class="`dot--${m.status}`" />
              <div class="topo__node-main">
                <div class="topo__node-name">{{ m.name }}</div>
                <div class="topo__node-sub">{{ m.status === 'unlinked' ? '未配置链路节点' : `${m.ip}:${m.port}` }}</div>
                <div v-if="m.desc" class="topo__node-desc">{{ m.desc }}</div>
              </div>
              <el-tag size="small" :type="statusMeta[m.status].tag" effect="light" disable-transitions>
                {{ statusMeta[m.status].text }}
              </el-tag>
              <el-button
                link type="primary" size="small"
                :loading="m.status === 'pinging'"
                @click.stop="emit('ping', m)"
              >检测</el-button>
            </div>
          </div>
        </div>
        <span v-else class="topo__nomod">暂无接口</span>
      </div>
    </div>
    <el-empty v-else :image-size="56" description="暂无接口或方案" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Monitor } from '@element-plus/icons-vue'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  grouped: { type: Boolean, default: false },
  hubLabel: { type: String, default: '联试工具' },
  selectedId: { type: [Number, String, null], default: null }
})
const emit = defineEmits(['select', 'ping', 'select-system'])

const statusMeta = {
  online: { text: '在线', tag: 'success' },
  offline: { text: '离线', tag: 'info' },
  pinging: { text: '检测中', tag: 'warning' },
  unlinked: { text: '未配置', tag: 'info' }
}

// 统一成"分组"渲染：全部联试对象→按联试对象分组；单个联试对象→一个无联试对象节点的组直接挂链路节点
const renderGroups = computed(() =>
  props.grouped
    ? props.groups.map((g) => ({ ...g, showSys: true }))
    : [{ id: '__single__', name: '', modules: props.modules, showSys: false }]
)
const hasContent = computed(() => (props.grouped ? props.groups.length > 0 : props.modules.length > 0))
</script>

<style scoped lang="scss">
.topo {
  display: flex;
  align-items: center;
  min-height: 100%;
  padding: 8px 6px;
}

/* 中心节点 */
.topo__hub {
  position: relative;
  flex-shrink: 0;
  width: 132px;
  margin-right: 40px;
  padding: 14px 10px;
  text-align: center;
  background: linear-gradient(160deg, var(--el-color-primary) 0%, #5b8def 100%);
  color: #fff;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(47, 111, 235, 0.25);

  &::after {
    content: '';
    position: absolute;
    right: -40px;
    top: 50%;
    width: 40px;
    border-top: 2px solid var(--el-border-color-darker);
  }

  &-icon { font-size: 24px; }
  &-name { font-size: 14px; font-weight: 700; margin-top: 4px; line-height: 1.3; }
  &-sub { font-size: 11px; opacity: 0.85; margin-top: 2px; }
}

/* 分组（系统接口 / xx方案） */
.topo__groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
  min-width: 0;
}
.topo__group {
  position: relative;
  display: flex;
  align-items: center;

  /* 竖向脊线（hub → 二级节点） */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-left: 2px solid var(--el-border-color-darker);
  }
  &:first-child::after { top: 50%; }
  &:last-child::after { bottom: 50%; }
  &:only-child::after { display: none; }
}

/* 二级节点框：系统接口 / xx方案 */
.topo__sysnode {
  position: relative;
  flex-shrink: 0;
  min-width: 150px;
  margin-right: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: var(--el-color-primary-light-8); box-shadow: 0 2px 8px rgba(47, 111, 235, 0.15); }
  &.is-active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-8); }

  /* 二级节点 → 接口的横向短线 */
  &::after {
    content: '';
    position: absolute;
    right: -40px;
    top: 50%;
    width: 40px;
    border-top: 2px solid var(--el-border-color-darker);
  }

  &-icon { font-size: 18px; color: var(--el-color-primary); flex-shrink: 0; }
  &-main { min-width: 0; }
  &-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &-sub { font-size: 11px; color: var(--el-text-color-secondary); }
}

/* 暂无接口占位 */
.topo__nomod {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  align-self: center;
}

/* 接口列 */
.topo__spokes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.topo__spoke {
  position: relative;
  display: flex;
  align-items: center;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    border-left: 2px solid var(--el-border-color-darker);
  }
  &:first-child::after { top: 50%; }
  &:last-child::after { bottom: 50%; }
  &:only-child::after { display: none; }
}

/* 横向连线，按状态着色 */
.topo__line {
  flex-shrink: 0;
  width: 44px;
  height: 0;
  border-top: 2px solid var(--el-border-color);
  &.line--sys { width: 40px; border-color: var(--el-border-color-darker); }
  &.line--online { border-color: var(--el-color-success); }
  &.line--pinging { border-top-style: dashed; border-color: var(--el-color-warning); }
  &.line--offline { border-top-style: dashed; border-color: var(--el-border-color); }
  &.line--unlinked { border-top-style: dashed; border-color: var(--el-border-color-lighter); }
}

/* 模块节点卡片 */
.topo__node {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-left: 3px solid var(--el-text-color-placeholder);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
  &.is-active { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
  &.node--online { border-left-color: var(--el-color-success); }
  &.node--pinging { border-left-color: var(--el-color-warning); }
  &.node--unlinked { border-left-color: var(--el-text-color-placeholder); opacity: .85; }

  &-main { flex: 1; min-width: 0; }
  &-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &-sub { font-size: 12px; color: var(--el-text-color-secondary); }
  &-desc {
    font-size: 11px; color: var(--el-text-color-placeholder); margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
}

.dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  &--online { background: var(--el-color-success); box-shadow: 0 0 0 3px var(--el-color-success-light-7); }
  &--offline { background: var(--el-text-color-placeholder); }
  &--pinging { background: var(--el-text-color-placeholder); animation: pulse 1s infinite; }
  &--unlinked { background: var(--el-border-color); }
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
