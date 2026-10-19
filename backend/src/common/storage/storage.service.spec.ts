import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

/** Typed access to the arguments of a recorded mock call. */
function arg(mock: jest.Mock, call = 0, index = 0): unknown {
  return (mock.mock.calls as unknown[][])[call][index];
}

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    put: input,
  })),
  DeleteObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    delete: input,
  })),
  GetObjectCommand: jest.fn().mockImplementation((input: unknown) => ({
    get: input,
  })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/cv'),
}));

const UUID = '0b5f8c2e-1d3a-4e5b-9c7d-2a4b6c8d0e1f';
const BASE = 'https://test-bucket.s3.eu-west-3.amazonaws.com';

describe('StorageService', () => {
  let service: StorageService;
  let send: jest.Mock;

  beforeEach(() => {
    const values: Record<string, string> = {
      'aws.region': 'eu-west-3',
      'aws.bucketName': 'test-bucket',
      'aws.accessKeyId': 'id',
      'aws.secretAccessKey': 'secret',
    };
    service = new StorageService({
      get: (key: string) => values[key],
    } as unknown as ConfigService);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    send = (service as any).s3.send as jest.Mock;
  });

  afterEach(() => jest.clearAllMocks());

  describe('isValidKey', () => {
    it.each([
      ['avatars', `avatars/${UUID}.png`, true],
      ['avatars', `avatars/${UUID}.jpeg`, true],
      ['logos', `logos/${UUID}.webp`, true],
      ['cvs', `cvs/${UUID}.pdf`, true],
      ['avatars', `logos/${UUID}.png`, false],
      ['cvs', `cvs/${UUID}.png`, false],
      ['cvs', `cvs/../logos/${UUID}.pdf`, false],
      ['avatars', 'avatars/anything.png', false],
      ['cvs', `${UUID}.pdf`, false],
    ] as const)('%s / %s → %s', (prefix, key, expected) => {
      expect(service.isValidKey(key, prefix)).toBe(expected);
    });
  });

  it('uploads under a server-generated key with the detected content type', async () => {
    const key = await service.upload(
      'cvs',
      Buffer.from('%PDF-'),
      'application/pdf',
    );

    expect(key).toMatch(/^cvs\/[0-9a-f-]{36}\.pdf$/);
    expect(send).toHaveBeenCalledWith({
      put: expect.objectContaining({
        Bucket: 'test-bucket',
        Key: key,
        ContentType: 'application/pdf',
      }) as object,
    });
  });

  describe('keyFromPublicUrl', () => {
    it('extracts the key from one of our URLs', () => {
      expect(
        service.keyFromPublicUrl(`${BASE}/avatars/${UUID}.png`, 'avatars'),
      ).toBe(`avatars/${UUID}.png`);
    });

    it.each([
      `${BASE}/logos/${UUID}.png`,
      `https://evil.example/avatars/${UUID}.png`,
      `http://test-bucket.s3.eu-west-3.amazonaws.com/avatars/${UUID}.png`,
      'not a url',
    ])('rejects %s for the avatars prefix', (url) => {
      expect(service.keyFromPublicUrl(url, 'avatars')).toBeNull();
    });
  });

  it("refuses to delete a key from another prefix (e.g. someone's logo via an avatar URL)", async () => {
    await service.deleteByPublicUrl(`${BASE}/logos/${UUID}.png`, 'avatars');
    await service.delete(`logos/${UUID}.png`, 'avatars');

    expect(send).not.toHaveBeenCalled();
  });

  it('deletes a valid key', async () => {
    await service.delete(`cvs/${UUID}.pdf`, 'cvs');

    expect(send).toHaveBeenCalledWith({
      delete: { Bucket: 'test-bucket', Key: `cvs/${UUID}.pdf` },
    });
  });

  it('deleteQuietly never throws', async () => {
    send.mockRejectedValueOnce(new Error('S3 down'));

    await expect(
      service.deleteQuietly({ key: `cvs/${UUID}.pdf` }, 'cvs'),
    ).resolves.toBeUndefined();
  });

  it('presigns only valid CV keys, for 15 minutes', async () => {
    await expect(
      service.presignDownload(`cvs/${UUID}.pdf`, 'cvs'),
    ).resolves.toBe('https://signed.example/cv');
    expect(arg(getSignedUrl as jest.Mock, 0, 2)).toEqual({
      expiresIn: 900,
    });

    await expect(
      service.presignDownload(`logos/${UUID}.png`, 'cvs'),
    ).rejects.toThrow(NotFoundException);
  });
});
