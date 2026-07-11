import { describe, it, expect } from 'vitest'
import { organizeConfigs } from '@/utils/ConfigOrganizer'
import type { ConfigGroup } from '@/utils/ConfigOrganizer'

describe('Config Organization Logic', () => {
  const mockProject = 'test'
  
  it('should correctly organize simple standalone configs', () => {
    const configsByGroup: Record<string, ConfigGroup> = {
      'mygroup': {
        'simplekey': { key: 'test:mygroup:simplekey', value: 'value1', type: 'string', parsedValue: 'value1' },
        'anotherkey': { key: 'test:mygroup:anotherkey', value: 'value2', type: 'string', parsedValue: 'value2' }
      }
    }
    
    const result = organizeConfigs(configsByGroup, mockProject)
    
    expect(result.mygroup).toHaveLength(2)
    expect(result.mygroup[0]).toEqual({
      type: 'standalone',
      key: 'anotherkey',
      fullKey: 'test:anotherkey',
      config: { key: 'test:mygroup:anotherkey', value: 'value2', type: 'string', parsedValue: 'value2' }
    })
    expect(result.mygroup[1]).toEqual({
      type: 'standalone',
      key: 'simplekey',
      fullKey: 'test:simplekey',
      config: { key: 'test:mygroup:simplekey', value: 'value1', type: 'string', parsedValue: 'value1' }
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