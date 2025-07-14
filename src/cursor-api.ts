import {
  CursorApiConfig,
  CursorApiError,
  CursorApiResponse,
  GitHubInstallationsResponse,
  FetchAllInstallationReposRequest,
  FetchAllInstallationReposResponse,
  GetRepositoryBranchesRequest,
  GetRepositoryBranchesResponse,
  ListBackgroundComposersRequest,
  ListBackgroundComposersResponse,
  StartBackgroundComposerRequest,
  StartBackgroundComposerResponse,
  ArchiveBackgroundComposerRequest,
  BackgroundComposer,
  ConversationMessage,
  MessageType,
  BackgroundComposerSource,
  DevcontainerStartingPoint,
  ModelDetails,
  GetUserInfoResponse,
} from './types/cursor-api';

export class CursorApi {
  private config: CursorApiConfig;
  private baseUrl: string;

  constructor(config: CursorApiConfig) {
    this.config = {
      baseUrl: 'https://cursor.com',
      timeout: 30000,
      ...config,
    };
    this.baseUrl = this.config.baseUrl!;
  }

  /**
   * Общий метод для выполнения HTTP запросов
   * @private
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9,ru;q=0.8',
      'content-type': 'application/json',
      'dnt': '1',
      'origin': this.baseUrl,
      'referer': `${this.baseUrl}/agents`,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
      ...(this.config.cookies && this.config.cookies.trim() ? { 'cookie': this.config.cookies } : {}),
      ...this.config.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        throw new CursorApiError({
          message: error.message,
          status: error.name === 'AbortError' ? 408 : undefined,
        });
      }
      
      throw new CursorApiError({
        message: 'Unknown error occurred',
      });
    }
  }

  /**
   * Получить информацию о текущем пользователе
   * Проверяет авторизацию и возвращает информацию о пользователе
   * 
   * @returns {Promise<GetUserInfoResponse>} Информация о пользователе
   */
  async getUserInfo(): Promise<GetUserInfoResponse> {
    return this.request<GetUserInfoResponse>(
      '/api/auth/me',
      {
        method: 'GET',
      }
    );
  }

  /**
   * Получить все установки GitHub с репозиториями
   * Возвращает список всех подключенных GitHub установок с их репозиториями
   * 
   * @returns {Promise<GitHubInstallationsResponse>} Список установок GitHub
   */
  async getGitHubInstallations(): Promise<GitHubInstallationsResponse> {
    return this.request<GitHubInstallationsResponse>(
      '/api/dashboard/get-github-installations',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  }

  /**
   * Получить все репозитории для конкретной установки
   * Используется для получения полного списка репозиториев в установке с пагинацией
   * 
   * @param {FetchAllInstallationReposRequest} request - Параметры запроса
   * @returns {Promise<FetchAllInstallationReposResponse>} Список репозиториев
   */
  async fetchAllInstallationRepos(
    request: FetchAllInstallationReposRequest
  ): Promise<FetchAllInstallationReposResponse> {
    return this.request<FetchAllInstallationReposResponse>(
      '/api/dashboard/fetch-all-installation-repos',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Получить список веток репозитория
   * Возвращает доступные ветки для указанного репозитория
   * 
   * @param {GetRepositoryBranchesRequest} request - Параметры запроса
   * @returns {Promise<GetRepositoryBranchesResponse>} Список веток
   */
  async getRepositoryBranches(
    request: GetRepositoryBranchesRequest
  ): Promise<GetRepositoryBranchesResponse> {
    return this.request<GetRepositoryBranchesResponse>(
      '/api/background-composer/get-repository-branches',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Получить список всех background composers
   * Возвращает список всех созданных background composers с их статусами
   * 
   * @param {ListBackgroundComposersRequest} request - Параметры запроса
   * @returns {Promise<ListBackgroundComposersResponse>} Список composers
   */
  async listBackgroundComposers(
    request: ListBackgroundComposersRequest = { n: 100, include_status: true }
  ): Promise<ListBackgroundComposersResponse> {
    return this.request<ListBackgroundComposersResponse>(
      '/api/background-composer/list',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Создать и запустить новый background composer
   * Запускает новый AI воркер для работы с репозиторием
   * 
   * @param {StartBackgroundComposerRequest} request - Параметры запроса
   * @returns {Promise<StartBackgroundComposerResponse>} Информация о созданном composer
   */
  async startBackgroundComposer(
    request: StartBackgroundComposerRequest
  ): Promise<StartBackgroundComposerResponse> {
    return this.request<StartBackgroundComposerResponse>(
      '/api/auth/startBackgroundComposerFromSnapshot',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  /**
   * Архивировать (отменить) background composer
   * Останавливает и архивирует указанный background composer
   * 
   * @param {ArchiveBackgroundComposerRequest} request - Параметры запроса
   * @returns {Promise<void>}
   */
  async archiveBackgroundComposer(
    request: ArchiveBackgroundComposerRequest
  ): Promise<void> {
    await this.request(
      '/api/auth/archiveBackgroundComposer',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  // Utility methods

  /**
   * Создать простое сообщение для conversation history
   * Хелпер для создания сообщений в правильном формате
   * 
   * @param {string} text - Текст сообщения
   * @param {MessageType} type - Тип сообщения (HUMAN или AI)
   * @returns {ConversationMessage} Сформированное сообщение
   */
  createMessage(text: string, type: MessageType = MessageType.HUMAN): ConversationMessage {
    return {
      text,
      type,
      richText: JSON.stringify({
        root: {
          children: [
            {
              children: [
                {
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text,
                  type: 'text',
                  version: 1,
                },
              ],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'paragraph',
              version: 1,
              textFormat: 0,
              textStyle: '',
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      }),
    };
  }

  /**
   * Генерировать уникальный ID для background composer
   * Создает уникальный идентификатор в формате bc-uuid
   * 
   * @returns {string} Уникальный ID
   */
  generateBcId(): string {
    return `bc-${crypto.randomUUID()}`;
  }

  /**
   * Создать базовую конфигурацию для запуска composer
   * Хелпер для создания стандартных параметров запуска
   * 
   * @param {string} repoUrl - URL репозитория
   * @param {string} task - Задача для AI
   * @param {string} branch - Ветка (по умолчанию 'main')
   * @param {string} modelName - Модель AI (по умолчанию 'o3')
   * @returns {Partial<StartBackgroundComposerRequest>} Базовая конфигурация
   */
  createBaseComposerConfig(
    repoUrl: string,
    task: string,
    branch: string = 'main',
    modelName: string = 'o3'
  ): Partial<StartBackgroundComposerRequest> {
    const bcId = this.generateBcId();
    
    return {
      snapshotNameOrId: repoUrl,
      devcontainerStartingPoint: {
        url: repoUrl,
        ref: branch,
      },
      modelDetails: {
        modelName,
        maxMode: true,
      },
      repositoryInfo: {},
      snapshotWorkspaceRootPath: '/workspace',
      autoBranch: true,
      returnImmediately: true,
      repoUrl,
      conversationHistory: [this.createMessage(task)],
      source: BackgroundComposerSource.WEBSITE,
      bcId,
      addInitialMessageToResponses: true,
    };
  }

  /**
   * Запустить composer с простой задачей
   * Упрощенный метод для быстрого запуска AI воркера
   * 
   * @param {string} repoUrl - URL репозитория
   * @param {string} task - Задача для AI
   * @param {string} branch - Ветка (по умолчанию 'main')
   * @param {string} modelName - Модель AI (по умолчанию 'o3')
   * @returns {Promise<StartBackgroundComposerResponse>} Информация о созданном composer
   */
  async startSimpleComposer(
    repoUrl: string,
    task: string,
    branch: string = 'main',
    modelName: string = 'o3'
  ): Promise<StartBackgroundComposerResponse> {
    const config = this.createBaseComposerConfig(repoUrl, task, branch, modelName);
    
    return this.startBackgroundComposer(config as StartBackgroundComposerRequest);
  }

  /**
   * Получить активные composers
   * Возвращает только активные (не архивированные) composers
   * 
   * @returns {Promise<BackgroundComposer[]>} Список активных composers
   */
  async getActiveComposers(): Promise<BackgroundComposer[]> {
    const response = await this.listBackgroundComposers();
    return response.composers.filter(composer => !composer.isArchived);
  }

  /**
   * Найти composer по ID
   * Поиск конкретного composer по его ID
   * 
   * @param {string} bcId - ID composer
   * @returns {Promise<BackgroundComposer | null>} Найденный composer или null
   */
  async findComposerById(bcId: string): Promise<BackgroundComposer | null> {
    const response = await this.listBackgroundComposers();
    return response.composers.find(composer => composer.bcId === bcId) || null;
  }
}

export default CursorApi; 