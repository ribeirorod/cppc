import type { ProviderTemplate } from '../types.js';

const templates: ProviderTemplate[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-20250514',
    validateUrl: 'https://api.anthropic.com/v1/models',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/anthropic',
    defaultModel: 'MiniMax-M2.7',
    smallFastModel: 'MiniMax-M2.7',
    validateUrl: 'https://api.minimax.io/anthropic/v1/models',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/anthropic',
    defaultModel: 'deepseek-reasoner',
    smallFastModel: 'deepseek-chat',
    validateUrl: 'https://api.deepseek.com/models',
  },
  {
    id: 'kimi',
    name: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.ai/anthropic',
    defaultModel: 'K2.5',
    validateUrl: 'https://api.moonshot.ai/anthropic/v1/models',
  },
  {
    id: 'qwen',
    name: 'Qwen / DashScope',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/apps/anthropic',
    defaultModel: 'qwen3.5-plus',
    smallFastModel: 'qwen3-coder-next',
    validateUrl: 'https://dashscope-intl.aliyuncs.com/apps/anthropic/v1/models',
  },
  {
    id: 'zhipu',
    name: 'Z.AI / GLM',
    baseUrl: 'https://api.z.ai/api/anthropic',
    defaultModel: 'GLM-5.1',
    validateUrl: 'https://api.z.ai/api/anthropic/v1/models',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4',
    validateUrl: 'https://openrouter.ai/api/v1/models',
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3',
    validateUrl: 'http://localhost:11434/v1/models',
  },
];

export function getAllTemplates(): ProviderTemplate[] {
  return [...templates];
}

export function getTemplate(id: string): ProviderTemplate | undefined {
  return templates.find(t => t.id === id);
}

export function getTemplateOrThrow(id: string): ProviderTemplate {
  const t = getTemplate(id);
  if (!t) throw new Error(`Unknown provider: ${id}. Available: ${templates.map(t => t.id).join(', ')}`);
  return t;
}
