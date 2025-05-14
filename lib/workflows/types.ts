import { MessageRecord } from "@/types/chat";

export interface ProjectIntent {
  type: 'CONTINUE_CURRENT_PROJECT' | 'COMPLETE_PROJECT' | 'REFERENCE_PAST_PROJECT' | 'START_NEW_PROJECT';
  projectId?: string; // For REFERENCE_PAST_PROJECT
}
