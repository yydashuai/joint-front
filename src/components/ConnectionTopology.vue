<template>
  <div class="topo">
    <!-- 中心：本机联试工具 / 当前系统 -->
    <div class="topo__hub">
      <el-icon class="topo__hub-icon"><Monitor /></el-icon>
      <div class="topo__hub-name">{{ hubLabel }}</div>
      <div class="topo__hub-sub">本机联试工具</div>
    </div>

    <div v-if="hasContent" class="topo__groups">
      <div v-for="g in renderGroups" :key="g.id" class="topo__group" :class="{ 'no-sys': !g.showSys }">
        <!-- 系统中间节点（仅"全部系统"模式） -->
        <template v-if="g.showSys">
          <span class="topo__line line--sys" />
          <div class="topo__sysnode" @click="emit('select-system', g.id)">
            <el-icon class="topo__sysnode-icon"><Box /></el-icon>
            <div class="topo__sysnode-main">
              <div class="topo__sysnode-name">{{ g.name }}</div>
              <div class="topo__sysnode-sub">已连接 {{ connectedOf(g.modules) }} / {{ g.modules.length }}</div>
            </div>
          </div>
        </template>

        <!-- 模块节点 -->
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
                <div class="topo__node-sub">{{ m.ip }}:{{ m.port }}</div>
              </div>
              <el-tag size="small" :type="statusMeta[m.status].tag" effect="light" disable-transitions>
                {{ statusMeta[m.status].text }}
              </el-tag>
              <el-button
                v-if="m.status === 'connected'"
                link type="danger" size="small"
                @click.stop="emit('disconnect', m)"
              >断开</el-button>
              <el-button
                v-else
                link type="success" size="small"
                :loading="m.status === 'connecting'"
                @click.stop="emit('connect', m)"
              >连接</el-button>
            </div>
          </div>
        </div>
        <span v-else class="topo__nomod">该系统暂无模块</span>
      </div>
    </div>
    <el-empty v-else :image-size="56" description="暂无模块" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Monitor, Box } from '@element-plus/icons-vue'

const props = defineProps({
  modules: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  grouped: { type: Boolean, default: false },
  hubLabel: { type: String, default: '全部系统' },
  selectedId: { type: [Number, String, null], default: null }
})
const emit = defineEmits(['select', 'connect', 'disconnect', 'select-system'])

const statusMeta = {
  disconnected: { text: '未连接', tag: 'info' },
  connecting: { text: '连接中', tag: 'warning' },
  connected: { text: '已连接', tag: 'success' },
  error: { text: '异常', tag: 'danger' }
}

const connectedOf = (modules) => modules.filter((m) => m.status === 'connected').length

// 统一成"分组"渲染：全部系统→按系统分组；单系统→一个无系统节点的组直接挂模块
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

/* 系统分组列 */
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

  /* 竖向脊线（hub → 各系统/各模块） */
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

/* 系统中间节点 */
.topo__sysnode {
  position: relative;
  flex-shrink: 0;
  width: 150px;
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

  /* 系统 → 模块的横向短线 */
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

/* 无模块占位（保留与系统节点的连线，所以挂在 sysnode 右侧） */
.topo__nomod {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  align-self: center;
}

/* 模块列 */
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
  &.line--connected { border-color: var(--el-color-success); }
  &.line--connecting { border-top-style: dashed; border-color: var(--el-color-warning); }
  &.line--disconnected { border-top-style: dashed; border-color: var(--el-border-color); }
  &.line--error { border-color: var(--el-color-danger); }
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
  &.node--connected { border-left-color: var(--el-color-success); }
  &.node--connecting { border-left-color: var(--el-color-warning); }
  &.node--error { border-left-color: var(--el-color-danger); }

  &-main { flex: 1; min-width: 0; }
  &-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  &-sub { font-size: 12px; color: var(--el-text-color-secondary); }
}

.dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  &--connected { background: var(--el-color-success); box-shadow: 0 0 0 3px var(--el-color-success-light-7); }
  &--connecting { background: var(--el-color-warning); animation: pulse 1s infinite; }
  &--disconnected { background: var(--el-text-color-placeholder); }
  &--error { background: var(--el-color-danger); }
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
