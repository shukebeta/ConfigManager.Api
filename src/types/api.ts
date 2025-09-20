export interface Project {
  name: string
}

export interface ProjectsResponse {
  projects: string[]
  count: number
  source: string
}

export interface ConfigValue {
  [key: string]: string
}

export interface ProjectConfigsResponse {
  project: string
  configs: Record<string, ConfigValue>
  categories: string[]
  totalConfigs: number
}

export interface ConfigItemResponse {
  key: string
  value: string | null
  exists: boolean
}

export interface SetConfigResponse {
  success: boolean
  key: string
  value: string
  operations: {
    set: boolean
    published: number
    projectRegistered: number | null
  }
}

export interface DeleteConfigResponse {
  success: boolean
  key: string
  existed: boolean
  operations: {
    deleted: number
    published: number
  }
}

export interface ApiError {
  error: string
  message: string
}