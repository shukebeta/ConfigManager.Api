<template>
  <div v-if="show" class="dialog-overlay" @click.self="cancel">
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-icon" :class="severityClass">
          <svg v-if="conflict?.severity === 'error'" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
        </div>
        <div class="header-content">
          <h2 class="dialog-title">{{ conflict?.title }}</h2>
          <p class="dialog-subtitle">{{ conflict?.description }}</p>
        </div>
      </div>

      <div class="dialog-body">
        <div class="conflict-details">
          <div v-for="(detail, index) in conflict?.details" :key="index" class="detail-item">
            {{ detail }}
          </div>
        </div>

        <div v-if="newConfigInfo" class="new-config-preview">
          <h4>New Configuration</h4>
          <div class="config-preview">
            <span class="config-key">{{ newConfigInfo.key }}</span>
            <span class="config-value">{{ newConfigInfo.value }}</span>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button 
          v-if="conflict?.severity === 'error'"
          @click="close"
          class="btn btn-primary"
          :disabled="loading"
        >
          Close
        </button>
        
        <template v-else>
          <button 
            @click="cancel" 
            class="btn btn-secondary"
            :disabled="loading"
          >
            Cancel
          </button>
          
          <button 
            @click="confirm" 
            class="btn btn-warning"
            :disabled="loading"
          >
            <span v-if="loading">Adding...</span>
            <span v-else>Continue Anyway</span>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ConflictInfo {
  title: string
  description: string
  details: string[]
  severity: 'error' | 'warning'
}

interface NewConfigInfo {
  key: string
  value: string
}

interface Props {
  show: boolean
  conflict: ConflictInfo | null
  newConfigInfo?: NewConfigInfo | null
  loading?: boolean
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const severityClass = computed(() => {
  return props.conflict?.severity === 'error' ? 'severity-error' : 'severity-warning'
})

const confirm = () => {
  emit('confirm')
}

const cancel = () => {
  emit('cancel')
}

const close = () => {
  emit('close')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.dialog-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  animation: dialogEnter 0.2s ease-out;
}

@keyframes dialogEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.header-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.header-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.severity-error {
  background: #fee2e2;
  color: #dc2626;
}

.severity-warning {
  background: #fef3c7;
  color: #d97706;
}

.header-content {
  flex: 1;
  min-width: 0;
}

.dialog-title {
  margin: 0 0 0.25rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.dialog-subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.4;
}

.dialog-body {
  padding: 1.5rem;
}

.conflict-details {
  margin-bottom: 1.5rem;
}

.detail-item {
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: #374151;
  border-left: 3px solid #e5e7eb;
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.new-config-preview {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 1rem;
}

.new-config-preview h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.config-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.config-key {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: #1f2937;
  font-weight: 600;
}

.config-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: #6b7280;
  padding: 0.25rem 0.5rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1.5rem;
  background: #f9fafb;
  justify-content: flex-end;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  min-width: 80px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: white;
  color: #374151;
  border-color: #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d97706;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .dialog-container {
    background: #1f2937;
    color: #f9fafb;
  }
  
  .dialog-header {
    border-bottom-color: #374151;
  }
  
  .dialog-title {
    color: #f9fafb;
  }
  
  .dialog-subtitle {
    color: #9ca3af;
  }
  
  .detail-item {
    color: #d1d5db;
    border-left-color: #374151;
  }
  
  .new-config-preview {
    background: #374151;
    border-color: #4b5563;
  }
  
  .config-value {
    background: #1f2937;
    border-color: #4b5563;
    color: #9ca3af;
  }
  
  .dialog-actions {
    background: #374151;
  }
  
  .btn-secondary {
    background: #374151;
    color: #d1d5db;
    border-color: #4b5563;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background: #4b5563;
  }
}
</style>