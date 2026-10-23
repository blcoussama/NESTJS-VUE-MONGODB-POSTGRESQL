import { PresenceRegistry } from './presence.registry';

describe('PresenceRegistry', () => {
  let registry: PresenceRegistry;

  beforeEach(() => {
    registry = new PresenceRegistry();
  });

  it('reports "came online" only for the first socket of a user', () => {
    expect(registry.add('u1')).toBe(true);
    expect(registry.add('u1')).toBe(false);
    expect(registry.count('u1')).toBe(2);
    expect(registry.isOnline('u1')).toBe(true);
  });

  it('reports "went offline" only when the last socket leaves', () => {
    registry.add('u1');
    registry.add('u1');

    expect(registry.remove('u1')).toBe(false);
    expect(registry.isOnline('u1')).toBe(true);
    expect(registry.remove('u1')).toBe(true);
    expect(registry.isOnline('u1')).toBe(false);
  });

  it('never goes negative for unknown users', () => {
    expect(registry.remove('ghost')).toBe(false);
    expect(registry.count('ghost')).toBe(0);
    expect(registry.add('ghost')).toBe(true);
  });
});
