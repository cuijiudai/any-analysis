import { IsString, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ShareSessionDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}