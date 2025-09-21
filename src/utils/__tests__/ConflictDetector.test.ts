import { describe, it, expect } from 'vitest'
import { ConflictDetector } from '../ConflictDetector'
import type { ConfigGroup } from '@/types/api'

// Mock configuration data for testing
const mockConfigsByGroup: Record<string, ConfigGroup> = {
  'database': {
    'database:host': {
      key: 'testproject:database:host',
      value: 'localhost',
      type: 'string',
      parsedValue: 'localhost'
    },
    'database:port': {
      key: 'testproject:database:port',
      value: '5432',
      type: 'integer', 
      parsedValue: 5432
    },
    'database:timeout': {
      key: 'testproject:database:timeout',
      value: '30000',
      type: 'integer',
      parsedValue: 30000
    }
  },
  'logging': {
    'logging:level': {
      key: 'testproject:logging:level',
      value: 'info',
      type: 'loglevel',
      parsedValue: 'info'
    },
    'logging:format': {
      key: 'testproject:logging:format',
      value: 'json',
      type: 'string',
      parsedValue: 'json'
    }
  },
  'feature': {
    'feature:newui': {
      key: 'testproject:feature:newui',
      value: 'true',
      type: 'boolean',
      parsedValue: true
    }
  },
  'nested': {
    'nested:config': {
      key: 'testproject:nested:config',
      value: 'parent-value',
      type: 'string',
      parsedValue: 'parent-value'
    }
  },
  'multi': {
    'multi:level': {
      key: 'testproject:multi:level',
      value: 'top-level',
      type: 'string', 
      parsedValue: 'top-level'
    }
  },
  'multi:level': {
    'multi:level:deep': {
      key: 'testproject:multi:level:deep',
      value: 'deep-value',
      type: 'string',
      parsedValue: 'deep-value'
    }
  }
}

describe('ConflictDetector', () => {
  const projectName = 'testproject'

  describe('detectConflicts', () => {
    it('should detect no conflicts for unique keys', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:unique:key',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(false)
    })

    it('should detect duplicate key conflicts', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:database:host',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('duplicate_key')
      expect(result.conflictingKey).toBe('database:host')
      expect(result.message).toContain('already exists')
    })

    it('should detect parent exists conflicts', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:nested:config:subkey',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('parent_exists')
      expect(result.conflictingKey).toBe('nested:config')
      expect(result.message).toContain('conflicts with existing parent key')
    })

    it('should detect children exist conflicts', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:multi',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('children_exist')
      expect(result.conflictingKeys).toContain('multi:level')
      expect(result.message).toContain('conflicts with existing child keys')
    })

    it('should handle deep nesting conflicts correctly', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:database:host:readonly',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('parent_exists')
      expect(result.conflictingKey).toBe('database:host')
    })

    it('should handle multi-level parent detection', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:database:host:config:readonly',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('parent_exists')
      expect(result.conflictingKey).toBe('database:host')
    })

    it('should work with keys that do not have project prefix', () => {
      const result = ConflictDetector.detectConflicts(
        'database:host',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('duplicate_key')
      expect(result.conflictingKey).toBe('database:host')
    })

    it('should handle complex nested conflicts', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:multi:level:deeper',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('parent_exists')
      expect(result.conflictingKey).toBe('multi:level')
    })
  })

  describe('formatConflictForUI', () => {
    it('should format duplicate key conflicts for UI', () => {
      const conflict = {
        conflict: true,
        type: 'duplicate_key' as const,
        conflictingKey: 'database:host',
        message: 'Key already exists',
        suggestion: 'Use edit instead'
      }

      const formatted = ConflictDetector.formatConflictForUI(conflict)

      expect(formatted.title).toBe('Duplicate Configuration Key')
      expect(formatted.description).toContain('already exists')
      expect(formatted.severity).toBe('error')
      expect(formatted.details).toContain('Existing key: database:host')
    })

    it('should format parent exists conflicts for UI', () => {
      const conflict = {
        conflict: true,
        type: 'parent_exists' as const,
        conflictingKey: 'nested:config',
        message: 'Parent key exists',
        suggestion: 'Consider different naming'
      }

      const formatted = ConflictDetector.formatConflictForUI(conflict)

      expect(formatted.title).toBe('Naming Conflict Detected')
      expect(formatted.description).toContain('conflicts with an existing parent')
      expect(formatted.severity).toBe('warning')
      expect(formatted.details).toContain('Existing parent: nested:config')
    })

    it('should format children exist conflicts for UI', () => {
      const conflict = {
        conflict: true,
        type: 'children_exist' as const,
        conflictingKeys: ['multi:level', 'multi:other'],
        message: 'Child keys exist',
        suggestion: 'Consider different naming'
      }

      const formatted = ConflictDetector.formatConflictForUI(conflict)

      expect(formatted.title).toBe('Naming Conflict Detected')
      expect(formatted.description).toContain('conflicts with existing child')
      expect(formatted.severity).toBe('warning')
      expect(formatted.details.join(' ')).toContain('• multi:level')
      expect(formatted.details.join(' ')).toContain('• multi:other')
    })

    it('should throw error for non-conflict input', () => {
      const noConflict = { conflict: false }

      expect(() => {
        ConflictDetector.formatConflictForUI(noConflict as ConflictDetectionResult)
      }).toThrow('No conflict to format')
    })
  })

  describe('validateKeyFormat', () => {
    it('should validate correct key formats', () => {
      const validKeys = [
        'simple',
        'project:config',
        'project:config:setting',
        'app.feature',
        'app_config',
        'project-name:config-item',
        'version2:config:item123'
      ]

      validKeys.forEach(key => {
        const result = ConflictDetector.validateKeyFormat(key)
        expect(result.valid).toBe(true)
      })
    })

    it('should reject invalid key formats', () => {
      const invalidCases = [
        { key: '', description: 'empty' },
        { key: '   ', description: 'empty' },
        { key: ':config', description: 'start with colon' },
        { key: 'config:', description: 'end with colon' },
        { key: 'config::setting', description: 'consecutive colons' },
        { key: 'config@setting', description: 'invalid characters' },
        { key: 'config#setting', description: 'invalid characters' },
        { key: 'config$setting', description: 'invalid characters' },
        { key: 'config setting', description: 'invalid characters' }
      ]

      invalidCases.forEach(({ key }) => {
        const result = ConflictDetector.validateKeyFormat(key)
        expect(result.valid).toBe(false)
        expect(result.message).toBeDefined()
      })
    })

    it('should allow special characters that are valid', () => {
      const validKeys = [
        'project:config-item',
        'project:config_item',
        'project:config.item',
        'project123:config456',
        'Project_Name:Config-Item.Value'
      ]

      validKeys.forEach(key => {
        const result = ConflictDetector.validateKeyFormat(key)
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty configuration groups', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:new:key',
        {},
        projectName
      )

      expect(result.conflict).toBe(false)
    })

    it('should handle single-level keys', () => {
      const result = ConflictDetector.detectConflicts(
        'testproject:database',
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('children_exist')
      expect(result.conflictingKeys).toContain('database:host')
      expect(result.conflictingKeys).toContain('database:port')
      expect(result.conflictingKeys).toContain('database:timeout')
    })

    it('should handle complex project names', () => {
      const complexProject = 'my-app.service'
      
      // Create mock data with complex project name
      const complexProjectMockConfigs: Record<string, ConfigGroup> = {
        'database': {
          'database:host': {
            key: `${complexProject}:database:host`,
            value: 'localhost',
            type: 'string',
            parsedValue: 'localhost'
          }
        }
      }
      
      const result = ConflictDetector.detectConflicts(
        `${complexProject}:database:host`,
        complexProjectMockConfigs,
        complexProject
      )

      expect(result.conflict).toBe(true)
      expect(result.type).toBe('duplicate_key')
    })

    it('should handle very deep nesting', () => {
      const deepKey = 'testproject:level1:level2:level3:level4:level5'
      const result = ConflictDetector.detectConflicts(
        deepKey,
        mockConfigsByGroup,
        projectName
      )

      expect(result.conflict).toBe(false)
    })
  })
})