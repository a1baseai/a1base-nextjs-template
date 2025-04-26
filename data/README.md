# A1Framework Profile Storage

This directory contains persistent storage files for the agent profile settings and information. These files allow your customized agent personality to persist across development environment restarts without requiring a database.

## Files in This Directory

- `profile-settings.json` - Contains the agent's profile settings (name, role, language style, etc.)
- `base-information.json` - Contains the agent's knowledge base information sections

## How It Works

When you use the profile editor UI at `/profile-editor`, your changes are saved in two places:

1. **Server-side file storage** (this directory) - Persists through development environment restarts
2. **Browser localStorage** - As a fallback in case file storage is unavailable

## Storage Priority Chain

When the application loads agent settings, it checks multiple sources in this order:

1. Server-side file storage (this directory)
2. Browser localStorage
3. Environment variables (`AGENT_PROFILE_SETTINGS` and `AGENT_BASE_INFORMATION`)
4. Default settings coded in the application

## API Routes

The application includes API routes to interact with these files:

- `GET /api/profile-settings` - Retrieves the agent profile settings
- `POST /api/profile-settings` - Saves agent profile settings
- `GET /api/base-information` - Retrieves the agent base information
- `POST /api/base-information` - Saves agent base information

## Manual Editing

You can manually edit these JSON files if needed, but be careful to maintain the correct structure. It's recommended to use the UI at `/profile-editor` instead.

## Backup and Version Control

It's a good practice to back up or version control these files if you've made significant customizations to your agent's personality.

