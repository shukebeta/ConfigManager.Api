import type { ConfigGroup } from '@/types/api'

export interface ConflictDetectionResult {
  conflict: boolean
  type?: 'duplicate_key' | 'parent_exists' | 'children_exist'
  conflictingKey?: string
  conflictingKeys?: string[]
  message?: string
  suggestion?: string
}

export class ConflictDetector {
  /**
   * Detect conflicts when adding a new configuration key
   * @param newKey The new key to be added (e.g., "project1:config1:key1")
   * @param existingConfigs Current project configurations grouped by categories/groups
   * @param projectName The current project name
   */
  static detectConflicts(
    newKey: string,
    existingConfigs: Record<string, ConfigGroup>,
    projectName: string
  ): ConflictDetectionResult {
    
    // Extract the key without project prefix for easier manipulation
    const keyWithoutProject = newKey.startsWith(`${projectName}:`) 
      ? newKey.substring(`${projectName}:`.length)
      : newKey;
    
    // Build a flat list of all existing keys (without project prefix)
    const existingKeys = this.extractAllKeys(existingConfigs);
    
    // Check for exact duplicate
    const duplicateCheck = this.checkDuplicateKey(keyWithoutProject, existingKeys);
    if (duplicateCheck.conflict) {
      return duplicateCheck;
    }
    
    // Check for naming conflicts (parent-child relationships)
    const conflictCheck = this.checkNamingConflicts(keyWithoutProject, existingKeys);
    if (conflictCheck.conflict) {
      return conflictCheck;
    }
    
    return { conflict: false };
  }
  
  /**
   * Extract all configuration keys from the grouped structure
   */
  private static extractAllKeys(
    existingConfigs: Record<string, ConfigGroup>
  ): string[] {
    const keys: string[] = [];
    
    for (const [groupName, group] of Object.entries(existingConfigs)) {
      for (const [settingName] of Object.entries(group)) {
        // settingName is already the full key (may contain colons)
        // groupName is just for grouping/display purposes
        keys.push(settingName);
      }
    }
    
    return keys;
  }
  
  /**
   * Check if the new key exactly matches an existing key
   */
  private static checkDuplicateKey(
    newKey: string,
    existingKeys: string[]
  ): ConflictDetectionResult {
    
    if (existingKeys.includes(newKey)) {
      return {
        conflict: true,
        type: 'duplicate_key',
        conflictingKey: newKey,
        message: `Configuration key '${newKey}' already exists`,
        suggestion: 'Use the edit function to modify the existing configuration'
      };
    }
    
    return { conflict: false };
  }
  
  /**
   * Check for parent-child naming conflicts
   */
  private static checkNamingConflicts(
    newKey: string,
    existingKeys: string[]
  ): ConflictDetectionResult {
    
    const newKeyParts = newKey.split(':');
    
    // Check for parent key conflicts (Scenario A: parent exists, trying to add child)
    for (let i = newKeyParts.length - 1; i > 0; i--) {
      const parentKey = newKeyParts.slice(0, i).join(':');
      
      if (existingKeys.includes(parentKey)) {
        return {
          conflict: true,
          type: 'parent_exists',
          conflictingKey: parentKey,
          message: `Key '${newKey}' conflicts with existing parent key '${parentKey}'`,
          suggestion: 'This may cause confusion. Consider using a different naming structure or confirm to continue.'
        };
      }
    }
    
    // Check for child key conflicts (Scenario B: children exist, trying to add parent)
    const childKeys = existingKeys.filter(key => key.startsWith(`${newKey}:`));
    
    if (childKeys.length > 0) {
      return {
        conflict: true,
        type: 'children_exist',
        conflictingKeys: childKeys,
        message: `Key '${newKey}' conflicts with existing child keys: ${childKeys.join(', ')}`,
        suggestion: 'This may cause confusion. Consider using a different naming structure or confirm to continue.'
      };
    }
    
    return { conflict: false };
  }
  
  /**
   * Generate user-friendly conflict description for UI display
   */
  static formatConflictForUI(
    conflict: ConflictDetectionResult, 
    originalNewKey?: string
  ): {
    title: string
    description: string
    details: string[]
    severity: 'error' | 'warning'
  } {
    
    if (!conflict.conflict) {
      throw new Error('No conflict to format');
    }
    
    switch (conflict.type) {
      case 'duplicate_key':
        return {
          title: 'Duplicate Configuration Key',
          description: 'This configuration key already exists in the project.',
          details: [
            `Existing key: ${conflict.conflictingKey}`,
            'Use the edit button to modify the existing configuration instead.'
          ],
          severity: 'error'
        };
        
      case 'parent_exists':
        return {
          title: 'Naming Conflict Detected',
          description: 'The key you\'re trying to add conflicts with an existing parent configuration.',
          details: [
            `New key: ${originalNewKey || conflict.message?.match(/Key '([^']+)'/)?.[1] || 'unknown'}`,
            `Existing parent: ${conflict.conflictingKey}`,
            'This may cause confusion for configuration consumers.'
          ],
          severity: 'warning'
        };
        
      case 'children_exist':
        return {
          title: 'Naming Conflict Detected', 
          description: 'The key you\'re trying to add conflicts with existing child configurations.',
          details: [
            `Existing child keys:`,
            ...(conflict.conflictingKeys || []).map(key => `  • ${key}`)
          ],
          severity: 'warning'
        };
        
      default:
        return {
          title: 'Configuration Conflict',
          description: conflict.message || 'Unknown conflict detected',
          details: [conflict.suggestion || 'Please review your configuration structure'],
          severity: 'warning'
        };
    }
  }
  
  /**
   * Helper to validate key format
   */
  static validateKeyFormat(key: string): { valid: boolean; message?: string } {
    if (!key || key.trim() === '') {
      return { valid: false, message: 'Key cannot be empty' };
    }
    
    // Basic validation - adjust as needed
    if (!/^[a-zA-Z0-9._:-]+$/.test(key)) {
      return { valid: false, message: 'Key contains invalid characters. Use only letters, numbers, dots, hyphens, underscores, and colons.' };
    }
    
    if (key.startsWith(':') || key.endsWith(':')) {
      return { valid: false, message: 'Key cannot start or end with a colon' };
    }
    
    if (key.includes('::')) {
      return { valid: false, message: 'Key cannot contain consecutive colons' };
    }
    
    return { valid: true };
  }
}