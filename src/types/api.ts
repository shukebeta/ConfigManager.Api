export interface Project {
  name: string
}

export interface ProjectsResponse {
  projects: string[]
  count: number
  source: string
}

export interface ConfigItem {
  key: string
  value: string
  type: 'string' | 'integer' | 'float' | 'boolean' | 'loglevel' | 'array' | 'object' | 'null'
  parsedValue: string | number | boolean | object | null
}

export interface ConfigGroup {
  [key: string]: ConfigItem
}

export interface ProjectConfigsResponse {
  project: string
  configs: Record<string, ConfigGroup>
  groups: string[]
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

export interface DeleteNamespaceResponse {
  success: boolean
  namespaceKey: string
  operations: {
    deleted: number
    published: number
    childKeys: string[]
    preservedParent: boolean
  }
}

export interface ApiError {
  error: string
  message: string
}