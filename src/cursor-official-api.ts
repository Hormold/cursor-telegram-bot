import {
  AgentImage,
  AgentSummary,
  AgentConversationResponse,
  CreateAgentRequestBody,
  CreateAgentResponseBody,
  FollowupRequestBody,
  ListModelsResponse,
  ListRepositoriesResponse,
} from './types/cursor-official';

export interface OfficialApiConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export default class CursorOfficialApi {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private repositoriesCacheTtlMs: number;
  private modelsCacheTtlMs: number;

  constructor(config: OfficialApiConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? 'https://api.cursor.com';
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.repositoriesCacheTtlMs = Number(process.env.CURSOR_REPOS_TTL_MS || 60000);
    this.modelsCacheTtlMs = Number(process.env.CURSOR_MODELS_TTL_MS || 2 * 60 * 60 * 1000); // default 2h
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'authorization': `Bearer ${this.apiKey}`,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
      }
      if (res.status === 204) return undefined as unknown as T;
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }

  // Helpers
  mapImages(images?: AgentImage[]): AgentImage[] | undefined {
    if (!images || images.length === 0) return undefined;
    return images.map((img) => ({ data: img.data, dimension: img.dimension }));
  }

  // API methods
  async createAgent(params: {
    text: string;
    images?: AgentImage[];
    model?: string; // optional; omit to use Auto
    repository: string; // required by API in source.repository
    ref?: string; // Git ref (branch/tag) to use as the base branch
    webhook?: Record<string, any>;
  }): Promise<CreateAgentResponseBody> {
    const body: CreateAgentRequestBody = {
      prompt: {
        text: params.text,
        images: this.mapImages(params.images),
      },
      ...(params.model ? { model: params.model } : {}),
      source: {
        repository: params.repository,
        ...(params.ref ? { ref: params.ref } : {}),
      },
      ...(params.webhook ? { webhook: params.webhook } : {}),
    };

    return await this.request<CreateAgentResponseBody>('/v0/agents', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getAgent(id: string): Promise<AgentSummary> {
    return await this.request<AgentSummary>(`/v0/agents/${encodeURIComponent(id)}`);
  }

  async getConversation(id: string): Promise<AgentConversationResponse> {
    return await this.request<AgentConversationResponse>(`/v0/agents/${encodeURIComponent(id)}/conversation`);
  }

  async addFollowup(id: string, text: string, images?: AgentImage[]): Promise<{ id: string }> {
    const body: FollowupRequestBody = {
      prompt: {
        text,
        images: this.mapImages(images),
      },
    };
    return await this.request<{ id: string }>(`/v0/agents/${encodeURIComponent(id)}/followup`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async deleteAgent(id: string): Promise<{ id: string }> {
    return await this.request<{ id: string }>(`/v0/agents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listModels(): Promise<ListModelsResponse> {
    const now = Date.now();
    if (modelsCache && now - modelsCacheAt < this.modelsCacheTtlMs) {
      return modelsCache;
    }
    if (modelsInFlight) {
      return modelsInFlight;
    }
    modelsInFlight = this.request<ListModelsResponse>('/v0/models')
      .then((res) => {
        modelsCache = res;
        modelsCacheAt = Date.now();
        return res;
      })
      .finally(() => {
        modelsInFlight = null;
      });
    return modelsInFlight;
  }

  async listRepositories(): Promise<ListRepositoriesResponse> {
    // In-memory cache with TTL and in-flight dedupe
    const now = Date.now();
    if (repoCache && now - repoCacheAt < this.repositoriesCacheTtlMs) {
      return repoCache;
    }
    if (repoInFlight) {
      return repoInFlight;
    }
    repoInFlight = this.request<ListRepositoriesResponse>('/v0/repositories')
      .then((res) => {
        repoCache = res;
        repoCacheAt = Date.now();
        return res;
      })
      .finally(() => {
        repoInFlight = null;
      });
    return repoInFlight;
  }
}

// Module-level cache for repositories endpoint (shared across instances)
let repoCache: ListRepositoriesResponse | null = null;
let repoCacheAt = 0;
let repoInFlight: Promise<ListRepositoriesResponse> | null = null;

let modelsCache: ListModelsResponse | null = null;
let modelsCacheAt = 0;
let modelsInFlight: Promise<ListModelsResponse> | null = null;
