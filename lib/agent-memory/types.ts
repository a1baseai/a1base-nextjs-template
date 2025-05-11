export interface AgentMemorySettingFieldOption {
  value: string;
  label: string;
}

export interface AgentMemorySettingField {
  name: "memoryCollectionEnabled" | "informationToSave";
  label: string;
  type: "toggle" | "select";
  description: string;
  options?: AgentMemorySettingFieldOption[];
}

export interface AgentMemorySettingsData {
  memoryCollectionEnabled: boolean;
  informationToSave: string;
  memoryTypeNote: string;
  fields: AgentMemorySettingField[];
  title: string;
  description: string;
  _source?: string; // For debugging, like in profile-settings
}
