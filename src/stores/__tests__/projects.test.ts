import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectsStore } from '../projects'
import apiClient from '@/services/api'

// Mock the API client
vi.mock('@/services/api', () => ({
  default: {
    getProjects: vi.fn(),
    getProjectConfigs: vi.fn(),
    setConfig: vi.fn(),
  },
}))

const mockApiClient = vi.mocked(apiClient)

describe('Projects Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const store = useProjectsStore()
    
    expect(store.projects).toEqual([])
    expect(store.selectedProject).toBe('')
    expect(store.projectConfigs).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.hasProjects).toBe(false)
    expect(store.hasSelectedProject).toBe(false)
  })

  it('should fetch projects successfully', async () => {
    const store = useProjectsStore()
    const mockResponse = {
      projects: ['project1', 'project2'],
      count: 2,
      source: 'registry'
    }
    
    mockApiClient.getProjects.mockResolvedValue(mockResponse)
    
    await store.fetchProjects()
    
    expect(store.projects).toEqual(['project1', 'project2'])
    expect(store.selectedProject).toBe('project1') // Auto-selected first project
    expect(store.hasProjects).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('should handle fetch projects error', async () => {
    const store = useProjectsStore()
    const mockError = new Error('API Error')
    
    mockApiClient.getProjects.mockRejectedValue(mockError)
    
    await store.fetchProjects()
    
    expect(store.projects).toEqual([])
    expect(store.loading).toBe(false)
    expect(store.error).toBe('API Error')
  })

  it('should select project and fetch configs', async () => {
    const store = useProjectsStore()
    const mockConfigsResponse = {
      project: 'project2',
      configs: {
        database: { 'db.host': 'localhost', 'db.port': '5432' },
        cache: { 'cache.ttl': '3600' }
      },
      categories: ['database', 'cache'],
      totalConfigs: 3
    }
    
    mockApiClient.getProjectConfigs.mockResolvedValue(mockConfigsResponse)
    
    await store.selectProject('project2')
    
    expect(store.selectedProject).toBe('project2')
    expect(store.projectConfigs).toEqual(mockConfigsResponse)
    expect(store.categories).toEqual(['database', 'cache'])
    expect(store.configsByCategory).toEqual(mockConfigsResponse.configs)
  })

  it('should handle project configs fetch error', async () => {
    const store = useProjectsStore()
    const mockError = new Error('Config fetch error')
    
    mockApiClient.getProjectConfigs.mockRejectedValue(mockError)
    
    await store.selectProject('project1')
    
    expect(store.selectedProject).toBe('project1')
    expect(store.error).toBe('Config fetch error')
    expect(store.projectConfigs).toBeNull()
  })

  it('should update config successfully', async () => {
    const store = useProjectsStore()
    
    // First set up a selected project with configs
    store.selectedProject = 'project1'
    const mockConfigsResponse = {
      project: 'project1',
      configs: {
        database: { 'db.host': 'localhost' }
      },
      categories: ['database'],
      totalConfigs: 1
    }
    
    mockApiClient.setConfig.mockResolvedValue({
      success: true,
      key: 'db.host',
      value: 'newhost',
      operations: { set: true, published: 1, projectRegistered: 1 }
    })
    
    mockApiClient.getProjectConfigs.mockResolvedValue({
      ...mockConfigsResponse,
      configs: {
        database: { 'db.host': 'newhost' }
      }
    })
    
    await store.updateConfig('db.host', 'newhost')
    
    expect(mockApiClient.setConfig).toHaveBeenCalledWith('db.host', 'newhost')
    expect(mockApiClient.getProjectConfigs).toHaveBeenCalledWith('project1')
    expect(store.error).toBeNull()
  })

  it('should handle update config error', async () => {
    const store = useProjectsStore()
    store.selectedProject = 'project1'
    
    const mockError = new Error('Update failed')
    mockApiClient.setConfig.mockRejectedValue(mockError)
    
    await expect(store.updateConfig('key', 'value')).rejects.toThrow('Update failed')
    expect(store.error).toBe('Update failed')
  })

  it('should clear error', () => {
    const store = useProjectsStore()
    store.error = 'Some error'
    
    store.clearError()
    
    expect(store.error).toBeNull()
  })

  it('should not change project if same project selected', async () => {
    const store = useProjectsStore()
    store.selectedProject = 'project1'
    
    await store.selectProject('project1')
    
    expect(mockApiClient.getProjectConfigs).not.toHaveBeenCalled()
  })
})