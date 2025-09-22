import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/services/api'
import type { ProjectsResponse, ProjectConfigsResponse } from '@/types/api'
import { createConfigItem } from '@/utils/ConfigTypeInference'

export const useProjectsStore = defineStore('projects', () => {
  // State
  const projects = ref<string[]>([])
  const selectedProject = ref<string>('')
  const projectConfigs = ref<ProjectConfigsResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const hasProjects = computed(() => projects.value.length > 0)
  const hasSelectedProject = computed(() => selectedProject.value !== '')
  const groups = computed(() => projectConfigs.value?.groups || [])
  const configsByGroup = computed(() => projectConfigs.value?.configs || {})

  // Actions
  async function fetchProjects() {
    loading.value = true
    error.value = null
    
    try {
      const response: ProjectsResponse = await apiClient.getProjects()
      projects.value = response.projects
      
      // Auto-select first project if none selected
      if (response.projects.length > 0 && !selectedProject.value) {
        selectedProject.value = response.projects[0]
        // Fetch configs for the auto-selected project
        await fetchProjectConfigs()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch projects'
      console.error('Error fetching projects:', err)
    } finally {
      loading.value = false
    }
  }

  async function selectProject(projectName: string) {
    if (projectName === selectedProject.value) return
    
    selectedProject.value = projectName
    projectConfigs.value = null
    await fetchProjectConfigs()
  }

  async function fetchProjectConfigs() {
    if (!selectedProject.value) return
    
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getProjectConfigs(selectedProject.value)
      projectConfigs.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch project configs'
      console.error('Error fetching project configs:', err)
    } finally {
      loading.value = false
    }
  }

  async function updateConfig(key: string, value: string) {
    loading.value = true
    error.value = null
    
    try {
      await apiClient.updateConfig(key, value)
      // Refresh project configs to get updated data
      await fetchProjectConfigs()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update config'
      console.error('Error updating config:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteConfig(key: string) {
    loading.value = true
    error.value = null
    
    try {
      await apiClient.deleteConfig(key)
      // Refresh project configs to get updated data
      await fetchProjectConfigs()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete config'
      console.error('Error deleting config:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteNamespace(namespaceKey: string) {
    loading.value = true
    error.value = null
    
    try {
      const result = await apiClient.deleteNamespace(namespaceKey)
      // Refresh project configs to get updated data
      await fetchProjectConfigs()
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete namespace'
      console.error('Error deleting namespace:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  // Utility function to parse config key into components
  function parseConfigKey(key: string, projectName: string) {
    // Remove project prefix if present
    const keyWithoutProject = key.startsWith(`${projectName}:`) 
      ? key.substring(`${projectName}:`.length)
      : key

    // Split into parts and extract group (first part after project)
    const parts = keyWithoutProject.split(':')
    const groupName = parts[0]
    const settingName = parts.slice(1).join(':') || parts[0] // Handle single-part keys
    
    return {
      groupName,
      settingName,
      keyWithoutProject
    }
  }

  // Incremental config addition after successful API call
  async function addConfigIncremental(key: string, value: string, forceAdd = false) {
    loading.value = true
    error.value = null
    
    try {
      // Call API first
      const response = forceAdd 
        ? await apiClient.setConfig(key, value, { forceAdd: true })
        : await apiClient.updateConfig(key, value)
      
      // Only update UI after successful API call
      if (response.success && projectConfigs.value && selectedProject.value) {
        const { groupName, settingName } = parseConfigKey(key, selectedProject.value)
        
        // Create new config item with inferred type and parsed value
        const newConfigItem = {
          key,
          ...createConfigItem(key, value)
        }
        
        // Clone current state for immutable update
        const newConfigs = { ...projectConfigs.value.configs }
        
        // Add/update group
        if (!newConfigs[groupName]) {
          newConfigs[groupName] = {}
        }
        newConfigs[groupName] = { ...newConfigs[groupName], [settingName]: newConfigItem }
        
        // Update groups array with sorted insertion
        const newGroups = projectConfigs.value.groups.includes(groupName)
          ? projectConfigs.value.groups
          : [...projectConfigs.value.groups, groupName].sort((a, b) => a.localeCompare(b))
        
        // Update state
        projectConfigs.value = {
          ...projectConfigs.value,
          configs: newConfigs,
          groups: newGroups,
          totalConfigs: projectConfigs.value.totalConfigs + 1
        }
      }
      
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to add config'
      console.error('Error adding config:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Incremental config update after successful API call
  async function updateConfigIncremental(key: string, value: string) {
    loading.value = true
    error.value = null
    
    try {
      // Call API first
      const response = await apiClient.updateConfig(key, value)
      
      // Only update UI after successful API call
      if (response.success && projectConfigs.value && selectedProject.value) {
        const { groupName, settingName } = parseConfigKey(key, selectedProject.value)
        
        // Find and update existing config item
        const currentGroup = projectConfigs.value.configs[groupName]
        if (currentGroup && currentGroup[settingName]) {
          const currentItem = currentGroup[settingName]
          
          // Clone and update the specific config item
          const updatedItem = {
            ...currentItem,
            value,
            parsedValue: value // Keep same type, just update value
          }
          
          // Clone state for immutable update
          const newConfigs = {
            ...projectConfigs.value.configs,
            [groupName]: {
              ...currentGroup,
              [settingName]: updatedItem
            }
          }
          
          // Update state (no need to change groups or totalConfigs)
          projectConfigs.value = {
            ...projectConfigs.value,
            configs: newConfigs
          }
        }
      }
      
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update config'
      console.error('Error updating config:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Incremental config deletion after successful API call
  async function deleteConfigIncremental(key: string) {
    loading.value = true
    error.value = null
    
    try {
      // Call API first
      const response = await apiClient.deleteConfig(key)
      
      // Only update UI after successful API call
      if (response.success && projectConfigs.value && selectedProject.value) {
        const { groupName, settingName } = parseConfigKey(key, selectedProject.value)
        
        // Clone current state
        const newConfigs = { ...projectConfigs.value.configs }
        const currentGroup = newConfigs[groupName]
        
        if (currentGroup && currentGroup[settingName]) {
          // Remove the specific config item
          const updatedGroup = { ...currentGroup }
          delete updatedGroup[settingName]
          
          // Check if group becomes empty
          if (Object.keys(updatedGroup).length === 0) {
            // Remove empty group
            delete newConfigs[groupName]
            
            // Update groups array to remove empty group
            const newGroups = projectConfigs.value.groups.filter(g => g !== groupName)
            
            projectConfigs.value = {
              ...projectConfigs.value,
              configs: newConfigs,
              groups: newGroups,
              totalConfigs: projectConfigs.value.totalConfigs - 1
            }
          } else {
            // Keep group but remove the config item
            newConfigs[groupName] = updatedGroup
            
            projectConfigs.value = {
              ...projectConfigs.value,
              configs: newConfigs,
              totalConfigs: projectConfigs.value.totalConfigs - 1
            }
          }
        }
      }
      
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete config'
      console.error('Error deleting config:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Incremental namespace deletion after successful API call
  async function deleteNamespaceIncremental(namespaceKey: string) {
    loading.value = true
    error.value = null
    
    try {
      // Call API first
      const result = await apiClient.deleteNamespace(namespaceKey)
      
      // Only update UI after successful API call
      if (result.success && projectConfigs.value && selectedProject.value) {
        // Clone current state
        const newConfigs = { ...projectConfigs.value.configs }
        const affectedGroups = new Set<string>()
        let deletedCount = 0
        
        // Process each deleted child key
        result.operations.childKeys.forEach(childKey => {
          const { groupName, settingName } = parseConfigKey(childKey, selectedProject.value)
          affectedGroups.add(groupName)
          
          const currentGroup = newConfigs[groupName]
          if (currentGroup && currentGroup[settingName]) {
            const updatedGroup = { ...currentGroup }
            delete updatedGroup[settingName]
            deletedCount++
            
            // Update or remove the group
            if (Object.keys(updatedGroup).length === 0) {
              delete newConfigs[groupName]
            } else {
              newConfigs[groupName] = updatedGroup
            }
          }
        })
        
        // Update groups array to remove any empty groups
        const newGroups = projectConfigs.value.groups.filter(groupName => 
          newConfigs[groupName] && Object.keys(newConfigs[groupName]).length > 0
        )
        
        // Update state
        projectConfigs.value = {
          ...projectConfigs.value,
          configs: newConfigs,
          groups: newGroups,
          totalConfigs: projectConfigs.value.totalConfigs - deletedCount
        }
      }
      
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete namespace'
      console.error('Error deleting namespace:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    projects,
    selectedProject,
    projectConfigs,
    loading,
    error,
    // Getters
    hasProjects,
    hasSelectedProject,
    groups,
    configsByGroup,
    // Actions
    fetchProjects,
    selectProject,
    fetchProjectConfigs,
    updateConfig,
    deleteConfig,
    deleteNamespace,
    clearError,
    // Incremental actions
    addConfigIncremental,
    updateConfigIncremental,
    deleteConfigIncremental,
    deleteNamespaceIncremental
  }
})