// Official Cursor Background Agents API types

export type AgentStatus = 'RUNNING' | 'FINISHED' | 'ERROR' | 'CREATING' | 'EXPIRED';

export interface AgentSummary {
  id: string;
  name: string;
  status: AgentStatus;
  source: Record<string, any>;
  target: Record<string, any>;
  createdAt: string; // ISO string
  summary?: string;
}

export interface AgentConversationMessage {
  id: string;
  type: 'user_message' | 'assistant_message';
  text: string;
}

export interface AgentConversationResponse {
  id: string;
  messages: AgentConversationMessage[];
}

export interface AgentImageDimension {
  width: number;
  height: number;
}

export interface AgentImage {
  data: string; // base64 encoded image (PNG recommended)
  dimension: AgentImageDimension;
}

export interface CreateAgentRequestBody {
  prompt: {
    text: string;
    images?: AgentImage[];
  };
  model?: string; // optional; omit to use Auto
  source: Record<string, any>;
  target?: Record<string, any>;
  webhook?: Record<string, any>;
}

export interface CreateAgentResponseBody extends AgentSummary {}

export interface FollowupRequestBody {
  prompt: {
    text: string;
    images?: AgentImage[];
  };
}

export interface FollowupResponse {
  id: string;
}

export interface ListModelsResponse {
  models: string[];
}

export interface ListedRepository {
  owner: string;
  name: string;
  repository: string; // full URL
}

export interface ListRepositoriesResponse {
  repositories: ListedRepository[];
}
