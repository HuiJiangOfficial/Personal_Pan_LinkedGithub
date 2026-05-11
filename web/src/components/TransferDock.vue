<template>
  <teleport to="body">
    <transition name="dock-fade">
      <div
        v-if="transferState.tasks.length > 0"
        class="transfer-dock"
        role="region"
        aria-label="传输进度"
      >
        <div class="transfer-dock__bar" @click="transferState.expanded = !transferState.expanded">
          <div class="transfer-dock__bar-left">
            <el-icon class="transfer-dock__bar-icon" :class="'is-' + runningMix.type">
              <Upload v-if="runningMix.type === 'upload'" />
              <Download v-else-if="runningMix.type === 'download'" />
              <Operation v-else />
            </el-icon>
            <span class="transfer-dock__bar-title">传输任务</span>
            <el-badge :value="transferState.tasks.length" class="transfer-dock__badge" />
            <span v-if="runningCount > 0" class="transfer-dock__bar-sub">进行中 {{ runningCount }}</span>
          </div>
          <el-icon class="transfer-dock__chevron">
            <ArrowUp v-if="transferState.expanded" />
            <ArrowDown v-else />
          </el-icon>
        </div>

        <el-collapse-transition>
          <div v-show="transferState.expanded" class="transfer-dock__body">
            <el-scrollbar max-height="240px">
              <div
                v-for="t in transferState.tasks"
                :key="t.id"
                class="transfer-dock__item"
                :class="'transfer-dock__item--' + t.status"
              >
                <div class="transfer-dock__item-head">
                  <el-icon class="transfer-dock__item-type" :class="'is-' + t.type">
                    <Upload v-if="t.type === 'upload'" />
                    <Download v-else />
                  </el-icon>
                  <span class="transfer-dock__item-name" :title="t.name">{{ t.name }}</span>
                  <el-tag :type="tagType(t.status)" size="small" effect="plain" class="transfer-dock__item-tag">
                    {{ statusLabel(t.status) }}
                  </el-tag>
                  <el-button
                    v-if="t.status === 'error'"
                    text
                    type="danger"
                    size="small"
                    class="transfer-dock__item-close"
                    @click.stop="t.dismiss()"
                  >
                    关闭
                  </el-button>
                </div>
                <el-progress
                  :percentage="t.indeterminate ? 0 : t.percent"
                  :indeterminate="t.status === 'running' && t.indeterminate"
                  :status="t.status === 'success' ? 'success' : t.status === 'error' ? 'exception' : undefined"
                  :stroke-width="5"
                  :show-text="false"
                  striped
                />
                <div class="transfer-dock__item-meta">
                  <template v-if="t.total != null && t.total > 0">
                    {{ formatTransferBytes(t.loaded) }} / {{ formatTransferBytes(t.total) }}
                    <span v-if="t.status === 'running' && !t.indeterminate" class="transfer-dock__pct">{{ t.percent }}%</span>
                  </template>
                  <template v-else-if="t.status === 'running'">
                    {{ t.type === 'upload' ? '已发送' : '已接收' }} {{ formatTransferBytes(t.loaded) }}
                    <span class="transfer-dock__hint">（总大小未知）</span>
                  </template>
                  <template v-else-if="t.status === 'success'">
                    已完成 · {{ formatTransferBytes(t.loaded) }}
                  </template>
                  <template v-else>
                    {{ t.errorMessage || '失败' }}
                  </template>
                </div>
              </div>
            </el-scrollbar>
          </div>
        </el-collapse-transition>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed } from 'vue';
import { Upload, Download, Operation, ArrowUp, ArrowDown } from '@element-plus/icons-vue';
import { transferState, formatTransferBytes } from '@/composables/transferTasks.js';

const runningCount = computed(() => transferState.tasks.filter((t) => t.status === 'running').length);

/** 用于标题栏图标：优先显示仍在运行的类型 */
const runningMix = computed(() => {
  const run = transferState.tasks.filter((t) => t.status === 'running');
  if (run.some((t) => t.type === 'upload')) return { type: 'upload' };
  if (run.some((t) => t.type === 'download')) return { type: 'download' };
  const last = transferState.tasks[transferState.tasks.length - 1];
  return { type: last?.type || 'upload' };
});

function statusLabel(s) {
  if (s === 'running') return '进行中';
  if (s === 'success') return '完成';
  return '失败';
}

function tagType(s) {
  if (s === 'running') return 'primary';
  if (s === 'success') return 'success';
  return 'danger';
}
</script>

<style>
/* teleport 到 body，不使用 scoped，限制在 .transfer-dock 前缀下 */
.transfer-dock {
  position: fixed;
  left: 50%;
  bottom: max(12px, env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: min(520px, calc(100vw - 24px));
  z-index: 3100;
  border-radius: 14px 14px 0 0;
  overflow: hidden;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(12px);
}

html.dark .transfer-dock {
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--el-border-color-darker);
}

.transfer-dock__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-fill-color-blank));
  border-bottom: 1px solid var(--el-border-color-lighter);
}

html.dark .transfer-dock__bar {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.12), var(--el-bg-color));
}

.transfer-dock__bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.transfer-dock__bar-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.transfer-dock__bar-icon.is-upload {
  color: var(--el-color-success);
}

.transfer-dock__bar-icon.is-download {
  color: var(--el-color-primary);
}

.transfer-dock__bar-title {
  font-weight: 600;
  font-size: 14px;
}

.transfer-dock__badge :deep(.el-badge__content) {
  transform: translateY(0) translateX(0);
}

.transfer-dock__bar-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.transfer-dock__chevron {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.transfer-dock__body {
  padding: 8px 12px 12px;
}

.transfer-dock__item {
  padding: 10px 4px 12px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.transfer-dock__item:last-child {
  border-bottom: none;
}

.transfer-dock__item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  min-width: 0;
}

.transfer-dock__item-type {
  flex-shrink: 0;
  font-size: 16px;
}

.transfer-dock__item-type.is-upload {
  color: var(--el-color-success);
}

.transfer-dock__item-type.is-download {
  color: var(--el-color-primary);
}

.transfer-dock__item-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.transfer-dock__item-tag {
  flex-shrink: 0;
}

.transfer-dock__item-close {
  flex-shrink: 0;
  margin-left: auto;
}

.transfer-dock__item-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.transfer-dock__pct {
  margin-left: 8px;
  color: var(--el-color-primary);
  font-weight: 600;
}

.transfer-dock__hint {
  margin-left: 4px;
  opacity: 0.85;
}

.dock-fade-enter-active,
.dock-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.dock-fade-enter-from,
.dock-fade-leave-to {
  opacity: 0;
}
</style>
