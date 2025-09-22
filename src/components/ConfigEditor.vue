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

      <!-- Compact Configuration Display -->
      <div v-for="category in filteredCategories" :key="category" class="category-section">
        <h3 class="category-header">{{ category }}</h3>
        <div class="configs-compact-list">
          <template v-for="item in namespaceStructure[category]" :key="item.type === 'namespace' ? item.namespaceKey : item.configKey">
            
            <!-- Namespace Entry -->
            <div v-if="item.type === 'namespace'" class="namespace-wrapper">
              <div class="config-compact-item namespace-item">
                <div class="config-compact-content" @click="toggleNamespace(item.namespaceKey)">
                  <span class="config-compact-key">{{ item.namespaceKey }}:...</span>
                  <span class="config-compact-type">namespace</span>
                  <span class="config-compact-value">({{ item.childConfigKeys.length }} items)</span>
                  <button 
                    class="expand-btn" 
                    :class="{ expanded: item.isExpanded }"
                    type="button"
                  >
                    {{ item.isExpanded ? '−' : '+' }}
                  </button>
                </div>
                <button 
                  @click.stop="handleDeleteNamespace(item.namespaceKey)"
                  class="delete-btn-compact"
                  title="Delete all child configurations in this namespace"
                >
                  Delete Group
                </button>
              </div>
              
              <!-- Expanded Children -->
              <div v-if="item.isExpanded" class="namespace-children">
                <div 
                  v-for="childKey in item.childConfigKeys" 
                  :key="getConfigData(category, childKey).key"
                  class="config-compact-item child-item"
                >
                  <div class="config-compact-content">
                    <span class="config-compact-key">{{ getConfigData(category, childKey).key }}</span>
                    <span class="config-compact-type">{{ getConfigData(category, childKey).type }}</span>
                    <input
                      v-if="getConfigData(category, childKey).type === 'boolean'"
                      type="checkbox"
                      :checked="Boolean(getConfigData(category, childKey).parsedValue)"
                      @change="updateBooleanConfig(getConfigData(category, childKey).key, $event)"
                      class="config-compact-input checkbox"
                    />
                    <input
                      v-else-if="getConfigData(category, childKey).type === 'integer' || getConfigData(category, childKey).type === 'float'"
                      type="number"
                      :step="getConfigData(category, childKey).type === 'float' ? '0.01' : '1'"
                      v-model="editableConfigs[getConfigData(category, childKey).key]"
                      @blur="handleConfigChange"
                      @keyup.enter="handleConfigChange"
                      :class="[
                        'config-compact-input',
                        { 'modified': isModified(getConfigData(category, childKey).key, getConfigData(category, childKey).value) }
                      ]"
                      :placeholder="getConfigData(category, childKey).value || 'Enter value...'"
                    />
                    <select
                      v-else-if="getConfigData(category, childKey).type === 'loglevel'"
                      v-model="editableConfigs[getConfigData(category, childKey).key]"
                      @change="handleConfigChange"
                      :class="[
                        'config-compact-input',
                        { 'modified': isModified(getConfigData(category, childKey).key, getConfigData(category, childKey).value) }
                      ]"
                    >
                      <option value="trace">Trace</option>
                      <option value="debug">Debug</option>
                      <option value="info">Info</option>
                      <option value="warn">Warn</option>
                      <option value="error">Error</option>
                      <option value="fatal">Fatal</option>
                    </select>
                    <textarea
                      v-else-if="getConfigData(category, childKey).type === 'object' || getConfigData(category, childKey).type === 'array'"
                      v-model="editableConfigs[getConfigData(category, childKey).key]"
                      @blur="handleConfigChange"
                      :class="[
                        'config-compact-textarea',
                        { 'modified': isModified(getConfigData(category, childKey).key, getConfigData(category, childKey).value) }
                      ]"
                      :placeholder="getConfigData(category, childKey).value || 'Enter JSON...'"
                      rows="2"
                    ></textarea>
                    <input
                      v-else
                      type="text"
                      v-model="editableConfigs[getConfigData(category, childKey).key]"
                      @blur="handleConfigChange"
                      @keyup.enter="handleConfigChange"
                      :class="[
                        'config-compact-input',
                        { 'modified': isModified(getConfigData(category, childKey).key, getConfigData(category, childKey).value) }
                      ]"
                      :placeholder="getConfigData(category, childKey).value || 'Enter value...'"
                    />
                  </div>
                  <div class="config-compact-actions">
                    <button
                      v-if="isModified(getConfigData(category, childKey).key, getConfigData(category, childKey).value)"
                      @click="saveConfig(getConfigData(category, childKey).key)"
                      :disabled="loading"
                      class="save-btn-compact"
                    >
                      Save
                    </button>
                    <button
                      v-if="isModified(getConfigData(category, childKey).key, getConfigData(category, childKey).value)"
                      @click="resetConfig(getConfigData(category, childKey).key, getConfigData(category, childKey).value)"
                      class="reset-btn-compact"
                    >
                      Reset
                    </button>
                    <button
                      @click="handleDeleteConfig(getConfigData(category, childKey).key)"
                      class="delete-btn-compact"
                      title="Delete this configuration"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Standalone Entry -->
            <div v-else class="config-compact-item standalone-item">
              <div class="config-compact-content">
                <span class="config-compact-key">{{ getConfigData(category, item.configKey).key }}</span>
                <span class="config-compact-type">{{ getConfigData(category, item.configKey).type }}</span>
                <input
                  v-if="getConfigData(category, item.configKey).type === 'boolean'"
                  type="checkbox"
                  :checked="Boolean(getConfigData(category, item.configKey).parsedValue)"
                  @change="updateBooleanConfig(getConfigData(category, item.configKey).key, $event)"
                  class="config-compact-input checkbox"
                />
                <input
                  v-else-if="getConfigData(category, item.configKey).type === 'integer' || getConfigData(category, item.configKey).type === 'float'"
                  type="number"
                  :step="getConfigData(category, item.configKey).type === 'float' ? '0.01' : '1'"
                  v-model="editableConfigs[getConfigData(category, item.configKey).key]"
                  @blur="handleConfigChange"
                  @keyup.enter="handleConfigChange"
                  :class="[
                    'config-compact-input',
                    { 'modified': isModified(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value) }
                  ]"
                  :placeholder="getConfigData(category, item.configKey).value || 'Enter value...'"
                />
                <select
                  v-else-if="getConfigData(category, item.configKey).type === 'loglevel'"
                  v-model="editableConfigs[getConfigData(category, item.configKey).key]"
                  @change="handleConfigChange"
                  :class="[
                    'config-compact-input',
                    { 'modified': isModified(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value) }
                  ]"
                >
                  <option value="trace">Trace</option>
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                  <option value="fatal">Fatal</option>
                </select>
                <textarea
                  v-else-if="getConfigData(category, item.configKey).type === 'object' || getConfigData(category, item.configKey).type === 'array'"
                  v-model="editableConfigs[getConfigData(category, item.configKey).key]"
                  @blur="handleConfigChange"
                  :class="[
                    'config-compact-textarea',
                    { 'modified': isModified(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value) }
                  ]"
                  :placeholder="getConfigData(category, item.configKey).value || 'Enter JSON...'"
                  rows="2"
                ></textarea>
                <input
                  v-else
                  type="text"
                  v-model="editableConfigs[getConfigData(category, item.configKey).key]"
                  @blur="handleConfigChange"
                  @keyup.enter="handleConfigChange"
                  :class="[
                    'config-compact-input',
                    { 'modified': isModified(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value) }
                  ]"
                  :placeholder="getConfigData(category, item.configKey).value || 'Enter value...'"
                />
              </div>
              <div class="config-compact-actions">
                <button
                  v-if="isModified(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value)"
                  @click="saveConfig(getConfigData(category, item.configKey).key)"
                  :disabled="loading"
                  class="save-btn-compact"
                >
                  Save
                </button>
                <button
                  v-if="isModified(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value)"
                  @click="resetConfig(getConfigData(category, item.configKey).key, getConfigData(category, item.configKey).value)"
                  class="reset-btn-compact"
                >
                  Reset
                </button>
                <button
                  @click="handleDeleteConfig(getConfigData(category, item.configKey).key)"
                  class="delete-btn-compact"
                  title="Delete this configuration"
                >
                  Delete
                </button>
              </div>
            </div>
            
          </template>
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

    <!-- Delete Namespace Confirmation Dialog -->
    <ConfirmDialog
      :show="showDeleteNamespaceDialog"
      title="Delete Namespace"
      :message="`Are you sure you want to delete all child configurations in namespace '${namespaceToDelete}'?\n\nThis action cannot be undone.`"
      confirm-text="Delete All"
      loading-text="Deleting..."
      :is-danger="true"
      :config-key="namespaceToDelete"
      @confirm="confirmDeleteNamespace"
      @cancel="cancelDeleteNamespace"
      ref="deleteNamespaceDialog"
    />

    <!-- Conflict Confirmation Dialog -->
    <ConflictConfirmDialog
      :show="showConflictDialog"
      :conflict="conflictDetectionResult ? ConflictDetector.formatConflictForUI(conflictDetectionResult, pendingConfigData?.key) : null"
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
const { fetchProjectConfigs, updateConfig, deleteConfig, deleteNamespace, clearError } = projectsStore

// Local state for editable configs
const editableConfigs = ref<Record<string, string>>({})

// Search and filter state
const searchQuery = ref('')
const selectedCategory = ref('')

// Dialog state
const showAddDialog = ref(false)
const showDeleteDialog = ref(false)
const showDeleteNamespaceDialog = ref(false)
const showConflictDialog = ref(false)
const configToDelete = ref('')
const namespaceToDelete = ref('')
const deleteDialog = ref()
const deleteNamespaceDialog = ref()

// Conflict detection state
const pendingConfigData = ref<{ key: string; value: string } | null>(null)
const conflictDetectionResult = ref<ConflictDetectionResult | null>(null)
const conflictDialogLoading = ref(false)

// Namespace expand/collapse state
const expandedNamespaces = ref<Set<string>>(new Set())

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

// Namespace structure organization (no data mapping)
const namespaceStructure = computed(() => {
  if (!selectedProject.value) return {}
  
  const result: Record<string, any[]> = {}
  
  filteredCategories.value.forEach(category => {
    const configs = getFilteredConfigs(category)
    const configKeys = Object.keys(configs)
    const items: any[] = []
    
    // Group keys by namespaces and identify standalone keys
    const processed = new Set<string>()
    
    // Sort keys to ensure parents come before children
    const sortedKeys = configKeys.sort()
    
    // First pass: identify all potential namespace relationships
    const allActualKeys = sortedKeys.map(key => configs[key].key)
    const namespaceGroups = new Map<string, string[]>()
    
    // Group keys by their potential namespace prefixes
    allActualKeys.forEach(actualKey => {
      // Find all keys that could be children of this key
      const children = allActualKeys.filter(otherKey => 
        otherKey !== actualKey && otherKey.startsWith(`${actualKey}:`)
      )
      
      if (children.length > 0) {
        namespaceGroups.set(actualKey, children)
      }
    })
    
    // Also check for potential namespace patterns where parent doesn't exist
    // Look for common prefixes among keys, but only create meaningful namespaces
    allActualKeys.forEach(actualKey => {
      const keyParts = actualKey.split(':')
      if (keyParts.length > 2) { // Only consider keys with at least 3 parts (project:namespace:key)
        // Try the most specific parent (exclude the last part)
        const potentialParent = keyParts.slice(0, -1).join(':')
        
        // Count how many keys share this prefix
        const siblings = allActualKeys.filter(otherKey => 
          otherKey !== actualKey && otherKey.startsWith(`${potentialParent}:`)
        )
        
        if (siblings.length > 0 && !namespaceGroups.has(potentialParent)) {
          // Include the current key in the siblings list
          siblings.push(actualKey)
          namespaceGroups.set(potentialParent, siblings)
        }
      }
    })
    
    // Second pass: process each namespace group
    const processedNamespaces = new Set<string>()
    
    // Process all namespace groups first
    for (const [namespaceKey, children] of namespaceGroups.entries()) {
      if (processedNamespaces.has(namespaceKey)) continue
      
      // Check if the namespace parent has a value
      const parentConfigKey = sortedKeys.find(k => configs[k].key === namespaceKey)
      const hasParentValue = !!parentConfigKey
      
      const childConfigKeys = children.map(childActualKey => {
        return sortedKeys.find(k => configs[k].key === childActualKey)!
      }).filter(Boolean)
      
      // If parent has a value, include it as the first child
      const allChildKeys = hasParentValue && parentConfigKey 
        ? [parentConfigKey, ...childConfigKeys]
        : childConfigKeys
      
      items.push({
        type: 'namespace',
        namespaceKey: namespaceKey,
        childConfigKeys: allChildKeys, // Just store the config keys, no data mapping
        hasParentValue: hasParentValue,
        isExpanded: expandedNamespaces.value.has(namespaceKey)
      })
      
      // Mark all related keys as processed
      if (parentConfigKey) processed.add(parentConfigKey)
      childConfigKeys.forEach(childKey => processed.add(childKey))
      
      processedNamespaces.add(namespaceKey)
    }
    
    // Third pass: process remaining standalone keys
    sortedKeys.forEach(key => {
      if (processed.has(key)) return
      
      // This is a standalone key
      items.push({
        type: 'standalone',
        configKey: key // Just store the config key, no data mapping
      })
      processed.add(key)
    })
    
    result[category] = items
  })
  
  return result
})

// Helper function to get config data by key (no mapping, direct access)
const getConfigData = (category: string, configKey: string) => {
  const configs = getFilteredConfigs(category)
  return configs[configKey]
}

// Initialize editable configs when project configs change
watch(
  projectConfigs,
  (newConfigs) => {
    if (newConfigs?.configs) {
      const flattened: Record<string, string> = {}
      Object.entries(newConfigs.configs).forEach(([, configs]) => {
        Object.entries(configs).forEach(([, configItem]) => {
          // Use the complete key from configItem.key instead of the partial key
          flattened[configItem.key] = configItem.value
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

const toggleNamespace = (fullKey: string) => {
  if (expandedNamespaces.value.has(fullKey)) {
    expandedNamespaces.value.delete(fullKey)
  } else {
    expandedNamespaces.value.add(fullKey)
  }
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

// Handle delete namespace request
const handleDeleteNamespace = (namespaceKey: string) => {
  namespaceToDelete.value = namespaceKey
  showDeleteNamespaceDialog.value = true
}

// Confirm delete namespace
const confirmDeleteNamespace = async () => {
  const namespace = namespaceToDelete.value
  try {
    const result = await deleteNamespace(namespace)
    showDeleteNamespaceDialog.value = false
    namespaceToDelete.value = ''
    deleteNamespaceDialog.value?.resetLoading()
    
    alert(`Successfully deleted ${result.operations.deleted} child configurations from namespace "${namespace}".${result.operations.preservedParent ? '\nParent configuration was preserved.' : ''}`)
  } catch (err) {
    alert(`Failed to delete namespace: ${err instanceof Error ? err.message : 'Unknown error'}`)
    deleteNamespaceDialog.value?.resetLoading()
  }
}

// Cancel delete namespace
const cancelDeleteNamespace = () => {
  showDeleteNamespaceDialog.value = false
  namespaceToDelete.value = ''
  deleteNamespaceDialog.value?.resetLoading()
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

/* Compact Configuration Display Styles */
.configs-compact-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.config-compact-item {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  min-height: 40px;
}

.config-compact-item.namespace-item {
  background: #f8fafc;
  border-left: 3px solid #10b981;
}

.config-compact-item.child-item {
  margin-left: 1rem;
  background: #fefefe;
  border-left: 2px solid #e5e7eb;
}

.config-compact-content {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 0.75rem;
  cursor: pointer;
}

.namespace-item .config-compact-content {
  cursor: pointer;
}

.standalone-item .config-compact-content {
  cursor: default;
}

.config-compact-key {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  color: var(--color-heading);
  font-weight: 500;
  min-width: 300px;
  flex-shrink: 0;
}

.config-compact-type {
  font-size: 0.75rem;
  color: var(--color-text-2);
  background: var(--color-background-mute);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  min-width: 60px;
  text-align: center;
  flex-shrink: 0;
}

.config-compact-value {
  color: var(--color-text-2);
  font-size: 0.875rem;
  flex-shrink: 0;
}

.config-compact-input,
.config-compact-textarea {
  flex: 1;
  min-width: 120px;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
}

.config-compact-input:focus,
.config-compact-textarea:focus {
  outline: none;
  border-color: #10b981;
  box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.2);
}

.config-compact-input.modified,
.config-compact-textarea.modified {
  border-color: #f59e0b;
  background: #fffbeb;
}

.config-compact-input.checkbox {
  flex: none;
  width: 1rem;
  height: 1rem;
}

.config-compact-textarea {
  resize: vertical;
  min-height: 35px;
}

.config-compact-actions {
  display: flex;
  gap: 0.25rem;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.save-btn-compact,
.reset-btn-compact,
.delete-btn-compact {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.2s;
  white-space: nowrap;
}

.save-btn-compact {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.save-btn-compact:hover:not(:disabled) {
  background: #059669;
}

.save-btn-compact:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.reset-btn-compact {
  background: var(--color-background);
  color: var(--color-text);
}

.reset-btn-compact:hover {
  background: var(--color-background-mute);
}

.delete-btn-compact {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.delete-btn-compact:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

.expand-btn {
  background: none;
  border: none;
  color: #10b981;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.expand-btn:hover {
  background: rgba(16, 185, 129, 0.1);
}

.expand-btn.expanded {
  background: rgba(16, 185, 129, 0.1);
}

.namespace-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.namespace-children {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

@media (max-width: 768px) {
  .config-compact-content {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .config-compact-key {
    min-width: unset;
  }
  
  .config-compact-actions {
    margin-left: 0;
    margin-top: 0.5rem;
    justify-content: center;
  }
  
  .config-compact-item {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>