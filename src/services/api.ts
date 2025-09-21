import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type {
  ProjectsResponse,
  ProjectConfigsResponse,
  ConfigItemResponse,
  SetConfigResponse,
  DeleteConfigResponse,
  DeleteNamespaceResponse
} from '@/types/api'

class ApiClient {
  private client: AxiosInstance

  constructor(baseURL = 'http://localhost:3001') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message)
        return Promise.reject(error)
      }
    )
  }

  // Health check
  async checkHealth(): Promise<{ status: string; services: { redis: string } }> {
    const response = await this.client.get('/health')
    return response.data
  }

  // Project operations
  async getProjects(): Promise<ProjectsResponse> {
    const response: AxiosResponse<ProjectsResponse> = await this.client.get('/projects')
    return response.data
  }

  async getProjectConfigs(project: string): Promise<ProjectConfigsResponse> {
    const response: AxiosResponse<ProjectConfigsResponse> = await this.client.get(
      `/projects/${encodeURIComponent(project)}/configs`
    )
    return response.data
  }

  // Config operations
  async getConfig(key: string): Promise<ConfigItemResponse> {
    const response: AxiosResponse<ConfigItemResponse> = await this.client.get(
      `/redis/${encodeURIComponent(key)}`
    )
    return response.data
  }

  async setConfig(key: string, value: string, options?: { forceAdd?: boolean }): Promise<SetConfigResponse> {
    const params = new URLSearchParams()
    if (options?.forceAdd) {
      params.set('forceAdd', 'true')
    }
    
    const url = `/redis/${encodeURIComponent(key)}${params.toString() ? '?' + params.toString() : ''}`
    const response: AxiosResponse<SetConfigResponse> = await this.client.post(url, { value })
    return response.data
  }

  async updateConfig(key: string, value: string): Promise<SetConfigResponse> {
    const response: AxiosResponse<SetConfigResponse> = await this.client.put(
      `/redis/${encodeURIComponent(key)}`,
      { value }
    )
    return response.data
  }

  async deleteConfig(key: string): Promise<DeleteConfigResponse> {
    const response: AxiosResponse<DeleteConfigResponse> = await this.client.delete(
      `/redis/${encodeURIComponent(key)}`
    )
    return response.data
  }

  async deleteNamespace(namespaceKey: string): Promise<DeleteNamespaceResponse> {
    const response: AxiosResponse<DeleteNamespaceResponse> = await this.client.delete(
      `/redis/${encodeURIComponent(namespaceKey)}/children`
    )
    return response.data
  }
}

// Create and export a singleton instance
export const apiClient = new ApiClient()
export default apiClient