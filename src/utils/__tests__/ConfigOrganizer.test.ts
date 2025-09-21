import { describe, it, expect } from 'vitest'

interface ConfigItem {
  value: string
  type: string
  parsedValue?: any
}

interface ConfigGroup {
  [key: string]: ConfigItem
}

// Extract the organization logic for testing
function organizeConfigs(
  configsByGroup: Record<string, ConfigGroup>, 
  selectedProject: string,
  expandedNamespaces: Set<string> = new Set()
): Record<string, any[]> {
  const result: Record<string, any[]> = {}
  
  Object.entries(configsByGroup).forEach(([category, configs]) => {
    const configKeys = Object.keys(configs)
    const items: any[] = []
    
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

describe('Config Organization Logic', () => {
  const mockProject = 'test'
  
  it('should correctly organize simple standalone configs', () => {
    const configsByGroup = {
      'mygroup': {
        'simplekey': { value: 'value1', type: 'string' },
        'anotherkey': { value: 'value2', type: 'string' }
      }
    }
    
    const result = organizeConfigs(configsByGroup, mockProject)
    
    expect(result.mygroup).toHaveLength(2)
    expect(result.mygroup[0]).toEqual({
      type: 'standalone',
      key: 'anotherkey',
      fullKey: 'test:anotherkey',
      config: { value: 'value2', type: 'string' }
    })
    expect(result.mygroup[1]).toEqual({
      type: 'standalone',
      key: 'simplekey',
      fullKey: 'test:simplekey',
      config: { value: 'value1', type: 'string' }
    })
  })
  
  it('should correctly organize configs with correct backend grouping', () => {
    // This is how the backend SHOULD group the config1 data
    const configsByGroup = {
      'config1': {
        'config1': { value: 'value1', type: 'string' },
        'config1:k1': { value: 'v1', type: 'string' },
        'config1:k1:l2': { value: 'l2v2', type: 'string' }
      }
    }
    
    const result = organizeConfigs(configsByGroup, mockProject)
    
    expect(result.config1).toHaveLength(1)
    
    const namespaceItem = result.config1[0]
    expect(namespaceItem.type).toBe('namespace')
    expect(namespaceItem.key).toBe('config1')
    expect(namespaceItem.fullKey).toBe('test:config1')
    expect(namespaceItem.children).toHaveLength(2)
    
    expect(namespaceItem.children[0]).toEqual({
      key: 'config1:k1',
      fullKey: 'test:config1:k1',
      config: { value: 'v1', type: 'string' }
    })
    
    expect(namespaceItem.children[1]).toEqual({
      key: 'config1:k1:l2', 
      fullKey: 'test:config1:k1:l2',
      config: { value: 'l2v2', type: 'string' }
    })
  })
  
  it('should handle mixed namespace and standalone keys', () => {
    const configsByGroup = {
      'mixed': {
        'standalone': { value: 'alone', type: 'string' },
        'parent': { value: 'parentval', type: 'string' },
        'parent:child1': { value: 'child1val', type: 'string' },
        'parent:child2': { value: 'child2val', type: 'string' },
        'anotherstanalone': { value: 'alone2', type: 'string' }
      }
    }
    
    const result = organizeConfigs(configsByGroup, mockProject)
    
    expect(result.mixed).toHaveLength(3)
    
    // Should have: anotherstanalone, parent (namespace), standalone
    const sortedItems = result.mixed.sort((a, b) => a.key.localeCompare(b.key))
    
    expect(sortedItems[0].type).toBe('standalone')
    expect(sortedItems[0].key).toBe('anotherstanalone')
    
    expect(sortedItems[1].type).toBe('namespace')
    expect(sortedItems[1].key).toBe('parent')
    expect(sortedItems[1].children).toHaveLength(2)
    
    expect(sortedItems[2].type).toBe('standalone')
    expect(sortedItems[2].key).toBe('standalone')
  })
  
  it('should correctly identify the current backend bug case', () => {
    // This represents what the backend is currently returning (incorrectly)
    const configsByGroup = {
      'config1': {
        'config1': { value: 'value1', type: 'string' },
        'k1': { value: 'v1', type: 'string' },  // Should be 'config1:k1'
        'k1:l2': { value: 'l2v2', type: 'string' }  // Should be 'config1:k1:l2'
      }
    }
    
    const result = organizeConfigs(configsByGroup, mockProject)
    
    // With the current incorrect backend data, this is what we get:
    expect(result.config1).toHaveLength(2)
    
    // config1 is standalone (incorrect - it should be a namespace)
    expect(result.config1[0].type).toBe('standalone')
    expect(result.config1[0].key).toBe('config1')
    
    // k1 is treated as namespace with k1:l2 as child (incorrect keys)
    expect(result.config1[1].type).toBe('namespace')
    expect(result.config1[1].key).toBe('k1')
    expect(result.config1[1].fullKey).toBe('test:k1')  // Should be test:config1:k1
  })
})