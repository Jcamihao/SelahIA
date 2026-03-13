export type JsonSchema = Record<string, any>;

export type GenerationBaseInput = {
  model?: string;
  systemInstruction?: string;
  userPrompt: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
};

export type GenerateTextInput = GenerationBaseInput;

export type StructuredGenerationInput<T> = GenerationBaseInput & {
  responseSchema: JsonSchema;
  validate: (payload: unknown) => T;
};

export type GenerateTextResult = {
  text: string;
  model: string;
  raw: unknown;
};

export type StructuredGenerationResult<T> = {
  data: T;
  text: string;
  model: string;
  raw: unknown;
};

export interface LlmProvider {
  generateText(input: GenerateTextInput): Promise<GenerateTextResult>;
  generateStructured<T>(
    input: StructuredGenerationInput<T>,
  ): Promise<StructuredGenerationResult<T>>;
}
