import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { validateDto } from './validate-dto';
import { IsHttpUrl } from './is-http-url.decorator';

class ChildDto {
  @IsString()
  name: string;
}

class SampleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  count?: number;

  @IsOptional()
  @IsHttpUrl()
  url?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChildDto)
  children?: ChildDto[];
}

async function messages(payload: unknown): Promise<string[]> {
  try {
    await validateDto(SampleDto, payload);
    return [];
  } catch (error) {
    const response = (error as BadRequestException).getResponse() as {
      message: string[] | string;
    };
    return ([] as string[]).concat(response.message);
  }
}

describe('validateDto', () => {
  it('returns a typed instance for a valid payload', async () => {
    const dto = await validateDto(SampleDto, { title: 'ok', count: 2 });

    expect(dto).toBeInstanceOf(SampleDto);
    expect(dto.count).toBe(2);
  });

  it('rejects unknown properties (forbidNonWhitelisted)', async () => {
    await expect(messages({ title: 'ok', role: 'admin' })).resolves.toContain(
      'property role should not exist',
    );
  });

  it('does not coerce types (no implicit conversion)', async () => {
    await expect(messages({ count: '2' })).resolves.toEqual([
      'count must be an integer number',
    ]);
  });

  it('reports nested errors with their path', async () => {
    const result = await messages({ children: [{ name: 1 }] });

    expect(result).toEqual(['children.0.name must be a string']);
  });

  it.each([null, 'text', 42, [{ title: 'x' }]])(
    'rejects the non-object body %p',
    async (payload) => {
      await expect(validateDto(SampleDto, payload)).rejects.toThrow(
        'Request body must be a JSON object',
      );
    },
  );

  it('IsHttpUrl rejects javascript: URLs and accepts https URLs', async () => {
    await expect(
      messages({ url: 'javascript:alert(1)' }),
    ).resolves.toHaveLength(1);
    await expect(messages({ url: 'https://example.com/a' })).resolves.toEqual(
      [],
    );
  });
});
