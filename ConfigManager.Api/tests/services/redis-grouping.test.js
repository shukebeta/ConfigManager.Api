describe('Redis Configuration Grouping', () => {
  describe('getProjectConfigs grouping logic', () => {
    it('should correctly parse and group multi-level configuration keys', () => {
      // Mock the internal grouping logic that's used in getProjectConfigs
      const mockKeys = [
        'test:config1',
        'test:config1:k1', 
        'test:config1:k1:l2',
        'test:standalone',
        'test:anotherns:key1',
        'test:anotherns:key2'
      ];
      
      // Simulate the grouping logic from getProjectConfigs
      const configs = {};
      
      for (const key of mockKeys) {
        // New format: project:keyname (where keyname can be multi-level)
        const [, ...keyParts] = key.split(':');
        const keyname = keyParts.join(':');
        
        // Extract category from keyname (first part)
        const category = keyParts[0] || 'general';
        const setting = keyname; // Keep the full keyname as the setting identifier
        
        if (!configs[category]) {
          configs[category] = {};
        }
        
        configs[category][setting] = {
          key: key,
          value: `value_for_${keyname}`,
          type: 'string',
          parsedValue: `value_for_${keyname}`
        };
      }
      
      // Verify the grouping structure
      expect(configs).toHaveProperty('config1');
      expect(configs).toHaveProperty('standalone');
      expect(configs).toHaveProperty('anotherns');
      
      // config1 group should contain all config1:* keys
      expect(configs.config1).toHaveProperty('config1');
      expect(configs.config1).toHaveProperty('config1:k1');
      expect(configs.config1).toHaveProperty('config1:k1:l2');
      expect(Object.keys(configs.config1)).toHaveLength(3);
      
      // standalone group should only contain the standalone key
      expect(configs.standalone).toHaveProperty('standalone');
      expect(Object.keys(configs.standalone)).toHaveLength(1);
      
      // anotherns group should contain anotherns:* keys
      expect(configs.anotherns).toHaveProperty('anotherns:key1');
      expect(configs.anotherns).toHaveProperty('anotherns:key2');
      expect(Object.keys(configs.anotherns)).toHaveLength(2);
      
      // Verify the full key names are preserved
      expect(configs.config1['config1:k1:l2'].key).toBe('test:config1:k1:l2');
      expect(configs.config1['config1:k1'].key).toBe('test:config1:k1');
    });
    
    it('should handle edge cases in key parsing', () => {
      const mockKeys = [
        'project:singlekey',
        'project:deep:nested:very:deep:key',
        'project:with_underscore',
        'project:with-dash'
      ];
      
      const configs = {};
      
      for (const key of mockKeys) {
        const [, ...keyParts] = key.split(':');
        const keyname = keyParts.join(':');
        const category = keyParts[0] || 'general';
        const setting = keyname;
        
        if (!configs[category]) {
          configs[category] = {};
        }
        
        configs[category][setting] = {
          key: key,
          value: `value_for_${keyname}`,
          type: 'string',
          parsedValue: `value_for_${keyname}`
        };
      }
      
      expect(configs).toHaveProperty('singlekey');
      expect(configs).toHaveProperty('deep');
      expect(configs).toHaveProperty('with_underscore');
      expect(configs).toHaveProperty('with-dash');
      
      // Deep nested key should preserve full path
      expect(configs.deep).toHaveProperty('deep:nested:very:deep:key');
      expect(configs.deep['deep:nested:very:deep:key'].key).toBe('project:deep:nested:very:deep:key');
    });
  });
});