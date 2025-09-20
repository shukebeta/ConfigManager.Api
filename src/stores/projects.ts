import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/services/api'
import type { ProjectsResponse, ProjectConfigsResponse } from '@/types/api'

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
  const categories = computed(() => projectConfigs.value?.categories || [])
  const configsByCategory = computed(() => projectConfigs.value?.configs || {})

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
      await apiClient.setConfig(key, value)
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

  function clearError() {
    error.value = null
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
    categories,
    configsByCategory,
    // Actions
    fetchProjects,
    selectProject,
    fetchProjectConfigs,
    updateConfig,
    deleteConfig,
    clearError
  }
})