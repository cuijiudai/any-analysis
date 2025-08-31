import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}