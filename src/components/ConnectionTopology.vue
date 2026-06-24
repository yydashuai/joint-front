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
              <div class="topo__sysnode-sub">在线 {{ onlineOf(g.modules) }} / {{ g.modules.length }}</div>
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
const emit = defineEmits(['select', 'ping', 'select-system'])

const statusMeta = {
  online: { text: '在线', tag: 'success' },
  offline: { text: '离线', tag: 'info' },
  pinging: { text: '检测中', tag: 'warning' }
}

const onlineOf = (modules) => modules.filter((m) => m.status === 'online').length

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
  &.line--online { border-color: var(--el-color-success); }
  &.line--pinging { border-top-style: dashed; border-color: var(--el-color-warning); }
  &.line--offline { border-top-style: dashed; border-color: var(--el-border-color); }
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
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
