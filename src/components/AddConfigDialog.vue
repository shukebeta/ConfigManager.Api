<template>
  <div v-if="show" class="dialog-overlay" @click="handleBackdropClick">
    <div class="dialog-container" @click.stop>
      <div class="dialog-header">
        <h3>Add New Configuration</h3>
      </div>
      
      <form @submit.prevent="handleSubmit" class="dialog-body">
        <div class="form-group">
          <label for="configKey">Configuration Key *</label>
          <input
            id="configKey"
            v-model="formData.key"
            type="text"
            :placeholder="selectedProject ? `e.g., ${selectedProject}:mysql:host or ${selectedProject}:redis` : 'e.g., myproject:mysql:host or myproject:redis'"
            class="form-input"
            :class="{ 'error': errors.key }"
            required
          />
          <div v-if="errors.key" class="error-message">{{ errors.key }}</div>
          <div class="help-text">
            Use format: <code>project:keyname</code> where keyname can be multi-level<br>
            Examples: <code>myapp:redis</code>, <code>myapp:mysql:host</code>, <code>myapp:api:timeout</code>
          </div>
        </div>

        <div class="form-group">
          <label for="configValue">Configuration Value *</label>
          <input
            id="configValue"
            v-model="formData.value"
            type="text"
            placeholder="Enter configuration value"
            class="form-input"
            :class="{ 'error': errors.value }"
            required
          />
          <div v-if="errors.value" class="error-message">{{ errors.value }}</div>
        </div>

        <div class="project-info">
          <strong>Project:</strong> 
          <span v-if="selectedProject">{{ selectedProject }}</span>
          <span v-else class="no-project">None selected - specify project in the key</span>
        </div>
      </form>
      
      <div class="dialog-actions">
        <button @click="cancel" type="button" class="cancel-btn" :disabled="loading">
          Cancel
        </button>
        <button 
          @click="handleSubmit" 
          type="submit"
          class="confirm-btn"
          :disabled="loading || !isFormValid"
        >
          <span v-if="loading">Adding...</span>
          <span v-else>Add Configuration</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  show: boolean
  selectedProject: string
}

interface Emits {
  (e: 'confirm', data: { key: string; value: string }): void
  (e: 'cancel'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const loading = ref(false)
const formData = ref({
  key: '',
  value: ''
})

const errors = ref({
  key: '',
  value: ''
})

// Validation rules
const isFormValid = computed(() => {
  return (
    formData.value.key.trim() !== '' &&
    formData.value.value.trim() !== '' &&
    !errors.value.key &&
    !errors.value.value
  )
})

// Validate configuration key format
const validateKey = () => {
  const key = formData.value.key.trim()
  errors.value.key = ''
  
  if (!key) {
    errors.value.key = 'Configuration key is required'
    return
  }
  
  // Unified format: project:keyname (keyname can be multi-level)
  if (!/^[a-zA-Z0-9._-]+:[a-zA-Z0-9._:-]+$/.test(key)) {
    errors.value.key = 'Key must be in format: project:keyname (e.g., myapp:redis or myapp:mysql:host)'
    return
  }
}

// Validate configuration value
const validateValue = () => {
  const value = formData.value.value.trim()
  errors.value.value = ''
  
  if (!value) {
    errors.value.value = 'Configuration value is required'
    return
  }
}

// Watch for changes and validate
watch(() => formData.value.key, validateKey)
watch(() => formData.value.value, validateValue)

const handleSubmit = () => {
  validateKey()
  validateValue()
  
  if (isFormValid.value) {
    loading.value = true
    emit('confirm', {
      key: formData.value.key,
      value: formData.value.value
    })
  }
}

const cancel = () => {
  if (!loading.value) {
    resetForm()
    emit('cancel')
  }
}

const handleBackdropClick = () => {
  cancel()
}

const resetForm = () => {
  formData.value = { key: '', value: '' }
  errors.value = { key: '', value: '' }
  loading.value = false
}

// Reset form when dialog is closed
watch(() => props.show, (newShow) => {
  if (!newShow) {
    resetForm()
  } else if (props.selectedProject) {
    // Pre-fill project name when dialog opens and project is selected
    formData.value.key = `${props.selectedProject}:`
  }
})

// Update key when selected project changes
watch(() => props.selectedProject, (newProject) => {
  if (newProject && props.show) {
    // Only update if the current key is empty or doesn't match the project
    if (!formData.value.key || !formData.value.key.startsWith(newProject + ':')) {
      formData.value.key = `${newProject}:`
    }
  }
})

// Expose method to parent
defineExpose({
  resetForm
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
  min-width: 500px;
  max-width: 600px;
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

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-heading);
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.9rem;
  background: var(--color-background);
  color: var(--color-text);
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.form-input.error {
  border-color: #dc2626;
}

.form-input.error:focus {
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
}

.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.help-text {
  color: var(--color-text-2);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.help-text code {
  background: var(--color-background-soft);
  padding: 0.125rem 0.25rem;
  border-radius: 2px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.project-info {
  background: var(--color-background-soft);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  margin-top: 1rem;
  color: var(--color-text-2);
}

.no-project {
  color: #f59e0b;
  font-style: italic;
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
  min-width: 100px;
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