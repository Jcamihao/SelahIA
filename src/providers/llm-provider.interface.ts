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

export type StructuredGenerationFromContentsInput<T> = {
  model?: string;
  systemInstruction?: string;
  contents: Array<Record<string, unknown>>;
  responseSchema: JsonSchema;
  validate: (payload: unknown) => T;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number;
  promptChars?: number;
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
  generateStructuredFromContents<T>(
    input: StructuredGenerationFromContentsInput<T>,
  ): Promise<StructuredGenerationResult<T>>;
  generateTextFromContents(input: {
    model?: string;
    systemInstruction?: string;
    contents: Array<Record<string, unknown>>;
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    thinkingBudget?: number;
    promptChars?: number;
  }): Promise<GenerateTextResult>;
}
