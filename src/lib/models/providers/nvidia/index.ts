import { UIConfigField } from '@/lib/config/types';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import NVIDIALLM from './nvidiaLLM';

interface NVIDIAConfig {
  apiKey: string;
  baseURL: string;
}

const defaultChatModels: Model[] = [
  {
    name: 'NVIDIA Nemotron 3 Ultra 550B',
    key: 'nvidia/nemotron-3-ultra-550b-a55b',
  },
  {
    name: 'NVIDIA Nemotron 3 Nano 30B',
    key: 'nvidia/nemotron-3-nano-30b-a3b',
  },
];

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'External NVIDIA cloud endpoint. Trial usage may log input and output. Do not use for confidential, personal or sensitive data.',
    required: true,
    placeholder: 'NVIDIA API Key',
    env: 'NVIDIA_API_KEY',
    scope: 'server',
  },
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for NVIDIA NIM endpoint.',
    required: true,
    placeholder: 'NVIDIA Base URL',
    default: 'https://integrate.api.nvidia.com/v1',
    env: 'NVIDIA_BASE_URL',
    scope: 'server',
  },
];

class NVIDIAProvider extends BaseModelProvider<NVIDIAConfig> {
  constructor(id: string, name: string, config: NVIDIAConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    if (!this.config.apiKey) {
      throw new Error('NVIDIA_API_KEY is not configured.');
    }

    try {
      const res = await fetch(`${this.config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-ultra-550b-a55b',
          messages: [{ role: 'user', content: 'MODELTEST OK' }],
          max_tokens: 15,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('401 invalid API key');
        } else if (res.status === 429) {
          throw new Error('429 rate limit or quota');
        } else if (res.status === 404) {
          throw new Error('404 model not found');
        } else {
          throw new Error(`NVIDIA NIM API error: Status ${res.status} - ${res.statusText}`);
        }
      }

      const data = await res.json();
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message?.content) {
        throw new Error('Empty response from NVIDIA NIM API');
      }

      return {
        embedding: [],
        chat: defaultChatModels,
      };
    } catch (err: any) {
      if (err.message && (err.message.includes('401') || err.message.includes('429') || err.message.includes('404') || err.message.includes('Empty response'))) {
        throw err;
      }
      throw new Error(`NVIDIA NIM connection/network error: ${err.message || err}`);
    }
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    
    // Resolve dynamically to prevent circular dependencies in ESM/CommonJS modules
    const { getConfiguredModelProviderById } = require('@/lib/config/serverRegistry');
    const configProvider = getConfiguredModelProviderById(this.id);
    const customChatModels = configProvider?.chatModels || [];

    return {
      embedding: [],
      chat: [...defaultModels.chat, ...customChatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading NVIDIA NIM Chat Model. Invalid Model Selected',
      );
    }

    return new NVIDIALLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: this.config.baseURL,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('NVIDIA provider does not support embedding models in this version.');
  }

  static parseAndValidate(raw: any): NVIDIAConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey || !raw.baseURL)
      throw new Error(
        'Invalid config provided. API key and base URL must be provided',
      );

    return {
      apiKey: String(raw.apiKey),
      baseURL: String(raw.baseURL),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'nvidia',
      name: 'NVIDIA NIM',
    };
  }
}

export default NVIDIAProvider;
