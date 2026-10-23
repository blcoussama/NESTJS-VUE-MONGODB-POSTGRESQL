import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: 'ALTEN Maroc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Engineering and technology consulting company.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://alten.ma' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ example: 'Casablanca, Maroc' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}
