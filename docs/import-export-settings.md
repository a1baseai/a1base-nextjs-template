# Import/Export Settings Feature

## Overview

The Import/Export Settings feature allows you to backup and restore all your agent configuration files in a single operation. This is useful for:

- Creating backups of your configuration
- Sharing configurations between environments
- Version controlling your settings
- Migrating settings to a new installation

## Accessing the Feature

1. Navigate to the Settings page (`/settings`)
2. Click the "Import/Export All Settings" button
3. You'll be taken to the Import/Export page (`/settings/import-export`)

## Exporting Settings

### What Gets Exported

The export includes all 8 JSON configuration files from the `data` folder:

1. **profile-settings.json** - Agent profile and personality settings
2. **group-onboarding-flow.json** - Group chat onboarding configuration
3. **onboarding-flow.json** - Individual chat onboarding configuration
4. **safety-settings.json** - Safety and moderation settings
5. **message-settings.json** - Message formatting preferences
6. **agent-memory-settings.json** - Agent memory configuration
7. **base-information.json** - Base information settings
8. **model-settings.json** - AI model preferences

### How to Export

1. Click the "Export All Settings" button
2. A JSON file will be downloaded with the format: `a1-settings-export-YYYY-MM-DD.json`
3. The file contains:
   - Version information
   - Export timestamp
   - All settings files combined into one

### Export File Structure

```json
{
  "version": "1.0",
  "exportedAt": "2025-01-05T12:00:00.000Z",
  "settings": {
    "profile-settings.json": { ... },
    "group-onboarding-flow.json": { ... },
    // ... other settings files
  }
}
```

## Importing Settings

### Before Importing

⚠️ **Important**: Importing settings will overwrite your current configuration. Always review the import file before proceeding.

### How to Import

1. Click the "Choose File" button
2. Select a previously exported settings file
3. The system will validate the file and show:
   - File version
   - Export date/time
   - Number of settings files contained
4. Click "Import Settings" to apply the configuration
5. The system will show the results of the import

### Safety Features

1. **File Validation**: The system validates that the file is a proper settings export
2. **Whitelist Protection**: Only approved settings files can be imported
3. **Automatic Backups**: Before importing, the system creates `.backup` files of existing settings
4. **Rollback on Error**: If an import fails, the system attempts to restore from backup
5. **Path Traversal Protection**: File names are sanitized to prevent security issues

## Security Considerations

1. **Whitelisted Files Only**: The system only allows import/export of specific files
2. **No Path Traversal**: File names containing `..`, `/`, or `\` are rejected
3. **JSON Validation**: Each file type has basic validation to ensure proper structure
4. **Backup Files**: Backup files (`.*.backup`) are automatically excluded from git

## Troubleshooting

### Export Issues

- **"Failed to fetch [filename]"**: The file may not exist or have incorrect permissions
- **"Export failed"**: Check browser console for detailed error messages

### Import Issues

- **"Invalid file"**: Ensure you're uploading a file exported by this system
- **"Invalid data structure"**: The file may be corrupted or manually edited incorrectly
- **"Failed to import file"**: Check that the data folder has write permissions

### Backup Files

If something goes wrong during import, backup files are created with the pattern `.{filename}.backup` in the data folder. These can be manually restored if needed.

## Best Practices

1. **Regular Backups**: Export your settings regularly, especially before major changes
2. **Version Control**: Consider storing exported settings in version control
3. **Test Imports**: Test importing in a development environment before production
4. **Review Changes**: Always review the settings file before importing
5. **Document Changes**: Keep notes about what changed between exports 