import { IsString, IsNotEmpty } from 'class-validator';

export class ParseCurlDto {
  @IsString()
  @IsNotEmpty()
  curlCommand: string;
}