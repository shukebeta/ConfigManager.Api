<template>
  <div class="config-editor">
    <div class="editor-header">
      <h2 v-if="selectedProject">
        Configurations for <span class="project-name">{{ selectedProject }}</span>
      </h2>
      <div class="header-actions">
        <button 
          @click="showAddDialog = true" 
          class="add-btn"
        >
          Add Configuration
        </button>
        <button @click="refreshConfigs" :disabled="loading" class="refresh-btn">
          <span v-if="loading">Loading...</span>
          <span v-else>Refresh</span>
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
      <button @click="clearError" class="error-dismiss">Dismiss</button>
    </div>

    <div v-if="!hasSelectedProject" class="no-selection">
      <p>Please select a project to view its configurations.</p>
    </div>

    <div v-else-if="!hasConfigs && !loading" class="no-configs">
      <p>No configurations found for this project.</p>
    </div>

    <div v-else-if="hasConfigs" class="configs-container">
      <div class="configs-controls">
        <div class="search-bar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search configurations..."
            class="search-input"
          />
        </div>
        <div class="filter-controls">
          <select v-model="selectedCategory" class="category-filter">
            <option value="">All Categories</option>
            <option v-for="group in groups" :key="group" :value="group">
              {{ group }}
            </option>
          </select>
        </div>
      </div>

      <div class="configs-summary">
        <p>{{ filteredConfigsCount }} of {{ totalConfigs }} configurations</p>
        <p v-if="selectedCategory">Filtered by category: <strong>{{ selectedCategory }}</strong></p>
        <p v-if="searchQuery">Search: <strong>{{ searchQuery }}</strong></p>
      </div>

      <div v-for="category in filteredCategories" :key="category" class="category-section">
        <h3 class="category-header">{{ category }}</h3>
        <div class="configs-list">
          <div
            v-for="(configItem, key) in getFilteredConfigs(category)"
            :key="key"
            class="config-item"
          >
            <div class="config-key">
              <label :for="`config-${key}`">{{ key }}</label>
              <span class="config-type">{{ configItem.type }}</span>
            </div>
            <div class="config-value">
              <!-- Boolean type: use checkbox -->
              <input
                v-if="configItem.type === 'boolean'"
                type="checkbox"
                :id="`config-${key}`"
                :checked="configItem.parsedValue"
                @change="updateBooleanConfig(String(key), $event)"
                class="config-checkbox"
              />
              
              <!-- Number types: use number input -->
              <input
                v-else-if="configItem.type === 'integer' || configItem.type === 'float'"
                type="number"
                :step="configItem.type === 'float' ? '0.01' : '1'"
                :id="`config-${key}`"
                v-model="editableConfigs[String(key)]"
                @blur="handleConfigChange"
                @keyup.enter="handleConfigChange"
                :class="[
                  'config-input',
                  { 'modified': isModified(String(key), configItem.value) }
                ]"
                :placeholder="configItem.value || 'Enter value...'"
              />
              
              <!-- Log level: use select -->
              <select
                v-else-if="configItem.type === 'loglevel'"
                :id="`config-${key}`"
                v-model="editableConfigs[String(key)]"
                @change="handleConfigChange"
                :class="[
                  'config-select',
                  { 'modified': isModified(String(key), configItem.value) }
                ]"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="fatal">Fatal</option>
              </select>
              
              <!-- JSON types: use textarea -->
              <textarea
                v-else-if="configItem.type === 'object' || configItem.type === 'array'"
                :id="`config-${key}`"
                v-model="editableConfigs[String(key)]"
                @blur="handleConfigChange"
                :class="[
                  'config-textarea',
                  { 'modified': isModified(String(key), configItem.value) }
                ]"
                :placeholder="configItem.value || 'Enter JSON...'"
                rows="3"
              ></textarea>
              
              <!-- Default: text input -->
              <input
                v-else
                type="text"
                :id="`config-${key}`"
                v-model="editableConfigs[String(key)]"
                @blur="handleConfigChange"
                @keyup.enter="handleConfigChange"
                :class="[
                  'config-input',
                  { 'modified': isModified(String(key), configItem.value) }
                ]"
                :placeholder="configItem.value || 'Enter value...'"
              />
              <div class="config-actions">
                <button
                  v-if="isModified(String(key), configItem.value)"
                  @click="saveConfig(String(key))"
                  :disabled="loading"
                  class="save-btn"
                >
                  Save
                </button>
                <button
                  v-if="isModified(String(key), configItem.value)"
                  @click="resetConfig(String(key), configItem.value)"
                  class="reset-btn"
                >
                  Reset
                </button>
                <button
                  @click="handleDeleteConfig(String(key))"
                  class="delete-btn"
                  title="Delete this configuration"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Configuration Dialog -->
    <AddConfigDialog
      :show="showAddDialog"
      :selected-project="selectedProject"
      @confirm="handleAddConfig"
      @cancel="showAddDialog = false"
    />

    <!-- Delete Confirmation Dialog -->
    <ConfirmDialog
      :show="showDeleteDialog"
      title="Delete Configuration"
      message="Are you sure you want to delete this configuration? This action cannot be undone."
      confirm-text="Delete"
      loading-text="Deleting..."
      :is-danger="true"
      :config-key="configToDelete"
      @confirm="confirmDeleteConfig"
      @cancel="cancelDeleteConfig"
      ref="deleteDialog"
    />

    <!-- Conflict Confirmation Dialog -->
    <ConflictConfirmDialog
      :show="showConflictDialog"
      :conflict="conflictDetectionResult ? ConflictDetector.formatConflictForUI(conflictDetectionResult) : null"
      :new-config-info="pendingConfigData ? { key: pendingConfigData.key, value: pendingConfigData.value } : null"
      :loading="conflictDialogLoading"
      @confirm="handleConflictConfirm"
      @cancel="handleConflictCancel"
      @edit-existing="handleConflictEditExisting"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import AddConfigDialog from './AddConfigDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ConflictConfirmDialog from './ConflictConfirmDialog.vue'
import { ConflictDetector } from '@/utils/ConflictDetector'
import type { ConflictDetectionResult } from '@/utils/ConflictDetector'
import type { ConfigItem } from '@/types/api'

const projectsStore = useProjectsStore()
const {
  selectedProject,
  projectConfigs,
  loading,
  error,
  hasSelectedProject,
  groups,
  configsByGroup
} = storeToRefs(projectsStore)
const { fetchProjectConfigs, updateConfig, deleteConfig, clearError } = projectsStore

// Local state for editable configs
const editableConfigs = ref<Record<string, string>>({})

// Search and filter state
const searchQuery = ref('')
const selectedCategory = ref('')

// Dialog state
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const showConflictDialog = ref(false)
const configToDelete = ref('')
const deleteDialog = ref()

// Conflict detection state
const pendingConfigData = ref<{ key: string; value: string } | null>(null)
const conflictDetectionResult = ref<ConflictDetectionResult | null>(null)
const conflictDialogLoading = ref(false)

// Computed properties
const hasConfigs = computed(() => {
  return projectConfigs.value && Object.keys(configsByGroup.value).length > 0
})

const totalConfigs = computed(() => projectConfigs.value?.totalConfigs || 0)

// Filtering logic
const filteredCategories = computed(() => {
  if (selectedCategory.value) {
    return [selectedCategory.value]
  }
  return groups.value.filter(category => {
    if (!searchQuery.value) return true
    const configs = configsByGroup.value[category]
    return Object.keys(configs).some(key => 
      key.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      configs[key].value.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  })
})

const filteredConfigsCount = computed(() => {
  return filteredCategories.value.reduce((count, category) => {
    return count + Object.keys(getFilteredConfigs(category)).length
  }, 0)
})

// Initialize editable configs when project configs change
watch(
  projectConfigs,
  (newConfigs) => {
    if (newConfigs?.configs) {
      const flattened: Record<string, string> = {}
      Object.entries(newConfigs.configs).forEach(([, configs]) => {
        Object.entries(configs).forEach(([key, configItem]) => {
          flattened[key] = configItem.value
        })
      })
      editableConfigs.value = { ...flattened }
    }
  },
  { immediate: true }
)

// Helper functions
const isModified = (key: string, originalValue: string): boolean => {
  return editableConfigs.value[key] !== originalValue
}

const resetConfig = (key: string, originalValue: string) => {
  editableConfigs.value[key] = originalValue
}

const handleConfigChange = async () => {
  // Auto-save could be implemented here if desired
  // For now, we require explicit save action
}

const saveConfig = async (key: string) => {
  try {
    const value = editableConfigs.value[key]
    await updateConfig(key, value)
    // The store will refresh configs after successful update
  } catch (err) {
    console.error('Failed to save config:', err)
    // Error is handled by the store
  }
}

const updateBooleanConfig = async (key: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.checked ? 'true' : 'false'
  editableConfigs.value[key] = value
  await saveConfig(key)
}

const refreshConfigs = async () => {
  await fetchProjectConfigs()
}

// Handle adding new configuration
const handleAddConfig = async (data: { key: string; value: string }) => {
  // Validate key format first
  const formatValidation = ConflictDetector.validateKeyFormat(data.key)
  if (!formatValidation.valid) {
    alert(`Invalid key format: ${formatValidation.message}`)
    return
  }

  // Detect conflicts using existing configuration data
  if (selectedProject.value && configsByGroup.value) {
    const conflictResult = ConflictDetector.detectConflicts(
      data.key,
      configsByGroup.value,
      selectedProject.value
    )

    if (conflictResult.conflict) {
      // Store pending data and show conflict dialog
      pendingConfigData.value = data
      conflictDetectionResult.value = conflictResult
      showConflictDialog.value = true
      showAddDialog.value = false
      return
    }
  }

  // No conflicts detected, proceed with adding
  await proceedWithAddConfig(data, false)
}

// Proceed with adding configuration (with optional forceAdd)
const proceedWithAddConfig = async (data: { key: string; value: string }, forceAdd = false) => {
  try {
    conflictDialogLoading.value = true
    
    // Use different API endpoints based on operation
    const apiClient = (await import('@/services/api')).default
    
    if (forceAdd) {
      // Use POST with forceAdd=true to bypass conflict detection
      await apiClient.setConfig(data.key, data.value, { forceAdd: true })
    } else {
      // Use PUT for normal create/update
      await apiClient.updateConfig(data.key, data.value)
    }
    
    // Refresh project configs to get updated data
    await fetchProjectConfigs()
    
    // Close dialogs
    showAddDialog.value = false
    showConflictDialog.value = false
    pendingConfigData.value = null
    conflictDetectionResult.value = null
    
  } catch (err: unknown) {
    console.error('Failed to add config:', err)
    
    // Handle specific error types
    const error = err as { response?: { data?: { error?: string; message?: string } }; message?: string }
    if (error.response?.data?.error === 'key_already_exists') {
      alert('Configuration key already exists. Please refresh the page and use the edit function instead.')
    } else if (error.response?.data?.error === 'naming_conflict') {
      alert(`Naming conflict: ${error.response.data.message}`)
    } else {
      alert(`Failed to add configuration: ${error.message || 'Unknown error'}`)
    }
  } finally {
    conflictDialogLoading.value = false
  }
}

// Handle conflict dialog confirmation
const handleConflictConfirm = async () => {
  if (pendingConfigData.value) {
    await proceedWithAddConfig(pendingConfigData.value, true)
  }
}

// Handle conflict dialog cancellation
const handleConflictCancel = () => {
  showConflictDialog.value = false
  showAddDialog.value = true
  pendingConfigData.value = null
  conflictDetectionResult.value = null
}

// Handle edit existing configuration
const handleConflictEditExisting = () => {
  showConflictDialog.value = false
  pendingConfigData.value = null
  conflictDetectionResult.value = null
  // TODO: Focus on the existing configuration in the UI
  // This could scroll to and highlight the conflicting configuration
}

// Handle delete configuration request
const handleDeleteConfig = (key: string) => {
  configToDelete.value = key
  showDeleteDialog.value = true
}

// Confirm delete configuration
const confirmDeleteConfig = async () => {
  try {
    await deleteConfig(configToDelete.value)
    showDeleteDialog.value = false
    configToDelete.value = ''
    deleteDialog.value?.resetLoading()
  } catch (err) {
    console.error('Failed to delete config:', err)
    deleteDialog.value?.resetLoading()
    // Error is handled by the store
  }
}

// Cancel delete configuration
const cancelDeleteConfig = () => {
  showDeleteDialog.value = false
  configToDelete.value = ''
  deleteDialog.value?.resetLoading()
}

// Helper function to get filtered configs for a category
const getFilteredConfigs = (category: string) => {
  const configs = configsByGroup.value[category] || {}
  
  if (!searchQuery.value) {
    return configs
  }
  
  const filtered: Record<string, ConfigItem> = {}
  Object.entries(configs).forEach(([key, configItem]) => {
    if (
      key.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      configItem.value.toLowerCase().includes(searchQuery.value.toLowerCase())
    ) {
      filtered[key] = configItem
    }
  })
  
  return filtered
}
</script>

<style scoped>
.config-editor {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.editor-header h2 {
  margin: 0;
  color: var(--color-heading);
}

.project-name {
  color: #10b981;
  font-weight: bold;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.add-btn,
.refresh-btn {
  padding: 0.5rem 1rem;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.add-btn {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.add-btn:hover:not(:disabled) {
  background: #059669;
  border-color: #059669;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-background-soft);
}

.add-btn:disabled,
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message p {
  margin: 0;
  color: #dc2626;
}

.error-dismiss {
  background: transparent;
  border: none;
  color: #dc2626;
  cursor: pointer;
  text-decoration: underline;
}

.no-selection,
.no-configs {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-2);
}

.configs-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--color-background-soft);
  border-radius: 4px;
  align-items: center;
  flex-wrap: wrap;
}

.search-bar {
  flex: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.9rem;
}

.search-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.category-filter {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text);
  cursor: pointer;
}

.category-filter:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.configs-summary {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--color-background-soft);
  border-radius: 4px;
  color: var(--color-text-2);
}

.configs-summary p {
  margin: 0 0 0.5rem 0;
}

.configs-summary p:last-child {
  margin-bottom: 0;
}

.category-section {
  margin-bottom: 2rem;
}

.category-header {
  margin: 0 0 1rem 0;
  padding: 0.5rem 0;
  border-bottom: 2px solid var(--color-border);
  color: var(--color-heading);
  text-transform: capitalize;
}

.configs-list {
  display: grid;
  gap: 1rem;
}

.config-item {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 1rem;
  align-items: start;
  padding: 1rem;
  background: var(--color-background-soft);
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.config-key label {
  font-weight: 500;
  color: var(--color-heading);
  word-break: break-word;
}

.config-value {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.config-input {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
}

.config-input:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.config-input.modified {
  border-color: #f59e0b;
  background: #fffbeb;
}

.config-checkbox {
  width: 1.2rem;
  height: 1.2rem;
  margin-right: 0.5rem;
}

.config-select {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  background: white;
}

.config-select:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.config-select.modified {
  border-color: #f59e0b;
  background: #fffbeb;
}

.config-textarea {
  flex: 1;
  min-width: 200px;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  resize: vertical;
  min-height: 60px;
}

.config-textarea:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.config-textarea.modified {
  border-color: #f59e0b;
  background: #fffbeb;
}

.config-type {
  font-size: 0.75rem;
  color: var(--color-text-2);
  background: var(--color-background-soft);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  margin-left: 0.5rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.config-actions {
  display: flex;
  gap: 0.5rem;
}

.save-btn,
.reset-btn,
.delete-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.save-btn {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.save-btn:hover:not(:disabled) {
  background: #059669;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-btn {
  background: var(--color-background);
  color: var(--color-text);
}

.reset-btn:hover {
  background: var(--color-background-mute);
}

.delete-btn {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.delete-btn:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

@media (max-width: 768px) {
  .config-item {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .config-value {
    flex-direction: column;
    align-items: stretch;
  }
  
  .config-input {
    min-width: unset;
  }
}
</style>