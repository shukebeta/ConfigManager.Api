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
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }}
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
            v-for="(value, key) in getFilteredConfigs(category)"
            :key="key"
            class="config-item"
          >
            <div class="config-key">
              <label :for="`config-${key}`">{{ key }}</label>
            </div>
            <div class="config-value">
              <input
                :id="`config-${key}`"
                v-model="editableConfigs[String(key)]"
                @blur="handleConfigChange"
                @keyup.enter="handleConfigChange"
                :class="[
                  'config-input',
                  { 'modified': isModified(String(key), value) }
                ]"
                :placeholder="value || 'Enter value...'"
              />
              <div class="config-actions">
                <button
                  v-if="isModified(String(key), value)"
                  @click="saveConfig(String(key))"
                  :disabled="loading"
                  class="save-btn"
                >
                  Save
                </button>
                <button
                  v-if="isModified(String(key), value)"
                  @click="resetConfig(String(key), value)"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectsStore } from '@/stores/projects'
import AddConfigDialog from './AddConfigDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'

const projectsStore = useProjectsStore()
const {
  selectedProject,
  projectConfigs,
  loading,
  error,
  hasSelectedProject,
  categories,
  configsByCategory
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
const configToDelete = ref('')
const deleteDialog = ref()

// Computed properties
const hasConfigs = computed(() => {
  return projectConfigs.value && Object.keys(configsByCategory.value).length > 0
})

const totalConfigs = computed(() => projectConfigs.value?.totalConfigs || 0)

// Filtering logic
const filteredCategories = computed(() => {
  if (selectedCategory.value) {
    return [selectedCategory.value]
  }
  return categories.value.filter(category => {
    if (!searchQuery.value) return true
    const configs = configsByCategory.value[category]
    return Object.keys(configs).some(key => 
      key.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      configs[key].toLowerCase().includes(searchQuery.value.toLowerCase())
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
        Object.entries(configs).forEach(([key, value]) => {
          flattened[key] = value
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

const refreshConfigs = async () => {
  await fetchProjectConfigs()
}

// Handle adding new configuration
const handleAddConfig = async (data: { key: string; value: string }) => {
  try {
    await updateConfig(data.key, data.value)
    showAddDialog.value = false
  } catch (err) {
    console.error('Failed to add config:', err)
    // Error is handled by the store
  }
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
  const configs = configsByCategory.value[category] || {}
  
  if (!searchQuery.value) {
    return configs
  }
  
  const filtered: Record<string, string> = {}
  Object.entries(configs).forEach(([key, value]) => {
    if (
      key.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      value.toLowerCase().includes(searchQuery.value.toLowerCase())
    ) {
      filtered[key] = value
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