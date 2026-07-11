<template>
  <div v-if="show" class="dialog-overlay" @click="handleBackdropClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h3>{{ title }}</h3>
      </div>
      
      <div class="dialog-body">
        <p>{{ message }}</p>
        <div v-if="configKey" class="config-details">
          <strong>Configuration Key:</strong> <code>{{ configKey }}</code>
        </div>
      </div>
      
      <div class="dialog-actions">
        <button @click="cancel" class="cancel-btn" :disabled="loading">
          Cancel
        </button>
        <button 
          @click="confirm" 
          class="confirm-btn"
          :class="{ 'danger': isDanger }"
          :disabled="loading"
        >
          <span v-if="loading">{{ loadingText }}</span>
          <span v-else>{{ confirmText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  show: boolean
  title: string
  message: string
  confirmText?: string
  loadingText?: string
  isDanger?: boolean
  configKey?: string
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}

withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  loadingText: 'Loading...',
  isDanger: false,
  configKey: ''
})

const emit = defineEmits<Emits>()

const loading = ref(false)

const confirm = () => {
  loading.value = true
  emit('confirm')
}

const cancel = () => {
  if (!loading.value) {
    emit('cancel')
  }
}

const handleBackdropClick = () => {
  cancel()
}

// Reset loading state when dialog is closed
const resetLoading = () => {
  loading.value = false
}

// Expose method to parent
defineExpose({
  resetLoading
})
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-container {
  background: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  min-width: 400px;
  max-width: 500px;
  border: 1px solid var(--color-border);
}

.dialog-header {
  padding: 1.5rem 1.5rem 0 1.5rem;
}

.dialog-header h3 {
  margin: 0;
  color: var(--color-heading);
  font-size: 1.25rem;
}

.dialog-body {
  padding: 1rem 1.5rem;
}

.dialog-body p {
  margin: 0 0 1rem 0;
  color: var(--color-text);
  line-height: 1.5;
}

.config-details {
  background: var(--color-background-soft);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  margin-top: 1rem;
}

.config-details code {
  background: transparent;
  color: var(--color-text);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.dialog-actions {
  padding: 0 1.5rem 1.5rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.cancel-btn,
.confirm-btn {
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
  min-width: 80px;
}

.cancel-btn {
  background: var(--color-background);
  color: var(--color-text);
}

.cancel-btn:hover:not(:disabled) {
  background: var(--color-background-mute);
}

.confirm-btn {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.confirm-btn:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.confirm-btn.danger {
  background: #dc2626;
  border-color: #dc2626;
}

.confirm-btn.danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

.cancel-btn:disabled,
.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .dialog-container {
    min-width: 90vw;
    margin: 1rem;
  }
  
  .dialog-actions {
    flex-direction: column-reverse;
  }
  
  .cancel-btn,
  .confirm-btn {
    width: 100%;
  }
}
</style>