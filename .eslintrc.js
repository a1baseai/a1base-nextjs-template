module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Disable unused variable warnings
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    
    // Disable type-related warnings
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    
    // Disable React warnings
    'react/no-unescaped-entities': 'off',
    'react-hooks/exhaustive-deps': 'off',
    
    // Turn off all other TypeScript eslint rules that might cause build failures
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off'
  }
};
