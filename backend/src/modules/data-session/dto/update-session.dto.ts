import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { SessionStatus } from '../../../entities/data-session.entity';

export class UpdateSessionDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;
}