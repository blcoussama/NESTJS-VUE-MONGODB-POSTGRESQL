import {
  getAllowedClientOrigin,
  isAllowedClientOrigin,
  isHandshakeOriginAllowed,
} from './client-origin.util';

describe('client origin policy', () => {
  const original = process.env.CLIENT_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = original;
  });

  it('uses CLIENT_URL (trailing slash ignored) and the documented default', () => {
    process.env.CLIENT_URL = 'https://profyle.example/';
    expect(getAllowedClientOrigin()).toBe('https://profyle.example');

    delete process.env.CLIENT_URL;
    expect(getAllowedClientOrigin()).toBe('http://localhost:5173');
  });

  it('accepts CLIENT_URL only, never a wildcard or another origin', () => {
    process.env.CLIENT_URL = 'https://profyle.example';

    expect(isAllowedClientOrigin('https://profyle.example')).toBe(true);
    expect(isAllowedClientOrigin('https://evil.example')).toBe(false);
    expect(isAllowedClientOrigin('*')).toBe(false);
    expect(isAllowedClientOrigin(undefined)).toBe(false);
  });

  it('lets non-browser handshakes (no Origin header) reach JWT authentication', () => {
    process.env.CLIENT_URL = 'https://profyle.example';

    expect(isHandshakeOriginAllowed(undefined)).toBe(true);
    expect(isHandshakeOriginAllowed('https://evil.example')).toBe(false);
  });
});
