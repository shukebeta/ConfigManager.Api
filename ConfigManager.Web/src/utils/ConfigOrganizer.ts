import type { ConfigItem } from '@/types/api'

export interface ConfigGroup {
  [key: string]: ConfigItem
}

export interface OrganizedConfigItem {
  type: 'standalone' | 'namespace'
  key: string
  fullKey: string
  config?: ConfigItem
  children?: Array<{
    key: string
    fullKey: string
    config: ConfigItem
  }>
  isExpanded?: boolean
}

export type OrganizedConfigs = Record<string, OrganizedConfigItem[]>

/**
 * Organize configurations into namespaces and standalone items
 * Groups keys hierarchically and identifies parent-child relationships
 * 
 * @param configsByGroup - Configurations grouped by category
 * @param selectedProject - Current project name for fullKey generation
 * @param expandedNamespaces - Set of expanded namespace keys for UI state
 * @returns Organized configuration structure
 */
export function organizeConfigs(
  configsByGroup: Record<string, ConfigGroup>, 
  selectedProject: string,
  expandedNamespaces: Set<string> = new Set()
): OrganizedConfigs {
  const result: OrganizedConfigs = {}
  
  Object.entries(configsByGroup).forEach(([category, configs]) => {
    const configKeys = Object.keys(configs)
    const items: OrganizedConfigItem[] = []
    
    // Group keys by namespaces and identify standalone keys
    const processed = new Set<string>()
    
    // Sort keys to ensure parents come before children
    const sortedKeys = configKeys.sort()
    
    sortedKeys.forEach(key => {
      if (processed.has(key)) return
      
      const fullKey = `${selectedProject}:${key}`
      
      // Check if this key has children (is a namespace)
      const children = sortedKeys.filter(otherKey => 
        otherKey !== key && otherKey.startsWith(`${key}:`)
      )
      
      if (children.length > 0) {
        // This is a namespace with children
        items.push({
          type: 'namespace',
          key: key,
          fullKey: fullKey,
          children: children.map(childKey => ({
            key: childKey,
            fullKey: `${selectedProject}:${childKey}`,
            config: configs[childKey]
          })),
          isExpanded: expandedNamespaces.has(fullKey)
        })
        
        // Mark all children as processed
        children.forEach(child => processed.add(child))
      } else {
        // This is a standalone key
        items.push({
          type: 'standalone',
          key: key,
          fullKey: fullKey,
          config: configs[key]
        })
      }
      
      processed.add(key)
    })
    
    result[category] = items
  })
  
  return result
}