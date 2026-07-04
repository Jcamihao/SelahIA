import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RunSelahCoderAgentDto {
  @IsString()
  @MaxLength(4000)
  task: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  workingDirectory?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  maxIterations?: number;

  /** Previous session message history for continuation */
  @IsOptional()
  @IsArray()
  messages?: any[];
}
