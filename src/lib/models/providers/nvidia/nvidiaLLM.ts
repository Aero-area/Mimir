import OpenAILLM from '../openai/openaiLLM';
import { GenerateObjectInput } from '../../types';
import { parse } from 'partial-json';
import { repairJson } from '@toolsycc/json-repair';
import { zodResponseFormat } from 'openai/helpers/zod';
import z from 'zod';

type NVIDIAConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
};

class NVIDIALLM extends OpenAILLM {
  constructor(config: NVIDIAConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: config.baseURL || 'https://integrate.api.nvidia.com/v1',
    });
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    // NVIDIA NIM uses OpenAI-compatible client. We pass response_format as json_schema
    // with strict: false to bypass local SDK checks on optional Zod fields while still
    // enforcing correct schema structure on the model.
    const response = await this.openAIClient.chat.completions.create({
      messages: this.convertToOpenAIMessages(input.messages),
      model: this.config.model,
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: false,
          schema: z.toJSONSchema(input.schema) as any,
        }
      },
    });

    if (response.choices && response.choices.length > 0) {
      const content = response.choices[0].message.content!;
      try {
        const repaired = repairJson(content, { extractJson: true }) as string;
        return input.schema.parse(JSON.parse(repaired)) as T;
      } catch (err) {
        throw new Error(`Error parsing response from NVIDIA NIM: ${err}. Content: ${content}`);
      }
    }

    throw new Error('No response from NVIDIA NIM');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let recievedObj: string = '';

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(input.messages),
      temperature:
        input.options?.temperature ?? this.config.options?.temperature ?? 1.0,
      top_p: input.options?.topP ?? this.config.options?.topP,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      frequency_penalty:
        input.options?.frequencyPenalty ??
        this.config.options?.frequencyPenalty,
      presence_penalty:
        input.options?.presencePenalty ?? this.config.options?.presencePenalty,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'response',
          strict: false,
          schema: z.toJSONSchema(input.schema) as any,
        }
      },
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        recievedObj += chunk.choices[0].delta.content || '';
        try {
          yield parse(recievedObj) as T;
        } catch (err) {
          yield {} as T;
        }
      }
    }
  }
}

export default NVIDIALLM;
