export interface AgentMemorySettingFieldOption {
  value: string;
  label: string;
}

export interface CustomMemoryField {
  id: string; // Unique ID for React keys and stable updates
  title: string;
  description: string;
}

export interface AgentMemorySettingField {
  name: never;
  label: string;
  type: "toggle" | "select";
  description: string;
  options?: AgentMemorySettingFieldOption[];
}

export interface AgentMemorySettingsData {
  userMemoryEnabled: boolean;
  userMemoryFields: CustomMemoryField[];
  chatMemoryEnabled: boolean;
  chatThreadMemoryFields: CustomMemoryField[];
  memoryTypeNote: string;
  fields: AgentMemorySettingField[];
  title: string;
  description: string;
  _source?: string; // For debugging, like in profile-settings
}
