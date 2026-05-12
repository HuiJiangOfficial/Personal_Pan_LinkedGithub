<template>
  <Teleport to="body">
    <div v-if="modelValue" class="dcm-root" @contextmenu.prevent @mousedown.self="close">
      <div
        ref="panelRef"
        class="dcm-panel"
        :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
        role="menu"
        @mousedown.stop
      >
        <template v-for="(it, idx) in visibleItems" :key="it.key ? it.key + '-' + idx : 'div-' + idx">
          <div v-if="it.type === 'divider'" class="dcm-divider" />
          <button
            v-else
            type="button"
            class="dcm-item"
            :class="{ 'dcm-item--danger': it.danger, 'dcm-item--disabled': it.disabled }"
            :disabled="it.disabled"
            role="menuitem"
            @click="onPick(it)"
          >
            <el-icon v-if="it.icon" class="dcm-item__icon"><component :is="it.icon" /></el-icon>
            <span class="dcm-item__label">{{ it.label }}</span>
            <span v-if="it.shortcut" class="dcm-item__sc">{{ it.shortcut }}</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  /** @type {import('vue').PropType<{ key: string, type?: 'item'|'divider', label?: string, icon?: object, disabled?: boolean, danger?: boolean, shortcut?: string, show?: boolean }[]>} */
  items: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'pick']);

const panelRef = ref(null);
const pos = ref({ left: 0, top: 0 });

const visibleItems = computed(() =>
  (props.items || []).filter((it) => it.type === 'divider' || it.show !== false)
);

function close() {
  emit('update:modelValue', false);
}

function onPick(it) {
  if (it.disabled || it.type === 'divider') return;
  emit('pick', it.key);
  close();
}

function layout() {
  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const el = panelRef.value;
  const w = el?.offsetWidth ?? 220;
  const h = el?.offsetHeight ?? 280;
  let left = Math.min(props.x, vw - w - pad);
  let top = Math.min(props.y, vh - h - pad);
  left = Math.max(pad, left);
  top = Math.max(pad, top);
  pos.value = { left, top };
}

watch(
  () => [props.modelValue, props.x, props.y, props.items],
  async ([open]) => {
    if (!open) return;
    await nextTick();
    layout();
    requestAnimationFrame(layout);
  },
  { deep: true }
);

function onKeydown(e) {
  if (e.key === 'Escape' && props.modelValue) {
    close();
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof window === 'undefined') return;
    if (open) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  }
);

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
  }
});

defineExpose({ layout });
</script>

<style scoped>
.dcm-root {
  position: fixed;
  inset: 0;
  z-index: 3000;
  pointer-events: auto;
}

.dcm-panel {
  position: fixed;
  z-index: 3001;
  min-width: 208px;
  max-width: min(320px, calc(100vw - 16px));
  padding: 6px;
  border-radius: 12px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(10px);
}

html.dark .dcm-panel {
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.06);
}

.dcm-divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--el-border-color-lighter);
}

.dcm-item {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 10px;
  padding: 9px 10px;
  margin: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.dcm-item:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}

.dcm-item:disabled,
.dcm-item--disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dcm-item--danger {
  color: var(--el-color-danger);
}

.dcm-item--danger:hover:not(:disabled) {
  background: var(--el-color-danger-light-9);
}

.dcm-item__icon {
  flex-shrink: 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.dcm-item--danger .dcm-item__icon {
  color: var(--el-color-danger);
}

.dcm-item__label {
  flex: 1;
  min-width: 0;
  line-height: 1.35;
}

.dcm-item__sc {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  font-variant-numeric: tabular-nums;
}
</style>
