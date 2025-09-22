import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectsStore } from '../projects'
import apiClient from '@/services/api'

// Mock the API client
vi.mock('@/services/api', () => ({
  default: {
    getProjects: vi.fn(),
    getProjectConfigs: vi.fn(),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(),
  },
}))

const mockApiClient = vi.mocked(apiClient)

describe('Projects Store', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Spy on console.error and silence it during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original console.error functionality
    consoleErrorSpy.mockRestore()
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
    
    // Verify error was logged (but silenced by our spy)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching projects:', mockError)
  })

  it('should select project and fetch configs', async () => {
    const store = useProjectsStore()
    const mockConfigsResponse = {
      project: 'project2',
      configs: {
        database: { 
          'db.host': { key: 'project2:database:db.host', value: 'localhost', type: 'string' as const, parsedValue: 'localhost' },
          'db.port': { key: 'project2:database:db.port', value: '5432', type: 'integer' as const, parsedValue: 5432 }
        },
        cache: { 
          'cache.ttl': { key: 'project2:cache:cache.ttl', value: '3600', type: 'integer' as const, parsedValue: 3600 }
        }
      },
      groups: ['database', 'cache'],
      totalConfigs: 3
    }
    
    mockApiClient.getProjectConfigs.mockResolvedValue(mockConfigsResponse)
    
    await store.selectProject('project2')
    
    expect(store.selectedProject).toBe('project2')
    expect(store.projectConfigs).toEqual(mockConfigsResponse)
    expect(store.groups).toEqual(['database', 'cache'])
    expect(store.configsByGroup).toEqual(mockConfigsResponse.configs)
  })

  it('should handle project configs fetch error', async () => {
    const store = useProjectsStore()
    const mockError = new Error('Config fetch error')
    
    mockApiClient.getProjectConfigs.mockRejectedValue(mockError)
    
    await store.selectProject('project1')
    
    expect(store.selectedProject).toBe('project1')
    expect(store.error).toBe('Config fetch error')
    expect(store.projectConfigs).toBeNull()
    
    // Verify error was logged (but silenced by our spy)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching project configs:', mockError)
  })

  it('should update config successfully', async () => {
    const store = useProjectsStore()
    
    // First set up a selected project with configs
    store.selectedProject = 'project1'
    const mockConfigsResponse = {
      project: 'project1',
      configs: {
        database: { 'db.host': { key: 'project1:database:db.host', value: 'localhost', type: 'string', parsedValue: 'localhost' } }
      },
      groups: ['database'],
      totalConfigs: 1
    }
    
    mockApiClient.updateConfig.mockResolvedValue({
      success: true,
      key: 'db.host',
      value: 'newhost',
      operations: { set: true, published: 1, projectRegistered: 1 }
    })
    
    mockApiClient.getProjectConfigs.mockResolvedValue({
      ...mockConfigsResponse,
      configs: {
        database: { 'db.host': { key: 'project1:database:db.host', value: 'newhost', type: 'string' as const, parsedValue: 'newhost' } }
      }
    })
    
    await store.updateConfig('db.host', 'newhost')
    
    expect(mockApiClient.updateConfig).toHaveBeenCalledWith('db.host', 'newhost')
    expect(mockApiClient.getProjectConfigs).toHaveBeenCalledWith('project1')
    expect(store.error).toBeNull()
  })

  it('should handle update config error', async () => {
    const store = useProjectsStore()
    store.selectedProject = 'project1'
    
    const mockError = new Error('Update failed')
    mockApiClient.updateConfig.mockRejectedValue(mockError)
    
    await expect(store.updateConfig('key', 'value')).rejects.toThrow('Update failed')
    expect(store.error).toBe('Update failed')
    
    // Verify error was logged (but silenced by our spy)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error updating config:', mockError)
  })

  it('should delete config successfully', async () => {
    const store = useProjectsStore()
    store.selectedProject = 'project1'
    
    const mockDeleteResponse = {
      success: true,
      key: 'db.host',
      existed: true,
      operations: { deleted: 1, published: 1 }
    }
    
    const mockConfigsResponse = {
      project: 'project1',
      configs: {
        database: {} // Empty after deletion
      },
      groups: ['database'],
      totalConfigs: 0
    }
    
    mockApiClient.deleteConfig.mockResolvedValue(mockDeleteResponse)
    mockApiClient.getProjectConfigs.mockResolvedValue(mockConfigsResponse)
    
    await store.deleteConfig('db.host')
    
    expect(mockApiClient.deleteConfig).toHaveBeenCalledWith('db.host')
    expect(mockApiClient.getProjectConfigs).toHaveBeenCalledWith('project1')
    expect(store.error).toBeNull()
  })

  it('should handle delete config error', async () => {
    const store = useProjectsStore()
    store.selectedProject = 'project1'
    
    const mockError = new Error('Delete failed')
    mockApiClient.deleteConfig.mockRejectedValue(mockError)
    
    await expect(store.deleteConfig('key')).rejects.toThrow('Delete failed')
    expect(store.error).toBe('Delete failed')
    
    // Verify error was logged (but silenced by our spy)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error deleting config:', mockError)
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