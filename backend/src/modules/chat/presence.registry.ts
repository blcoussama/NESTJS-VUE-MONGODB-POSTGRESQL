import { Injectable } from '@nestjs/common';

/**
 * Counts open sockets per user so that a user with several tabs is "online"
 * until the last tab disconnects.
 *
 * In-memory: valid for a single backend instance (scaling out requires the
 * Socket.io Redis adapter and a shared presence store).
 */
@Injectable()
export class PresenceRegistry {
  private readonly sockets = new Map<string, number>();

  /** Registers a socket; returns true when the user just came online. */
  add(userId: string): boolean {
    const next = (this.sockets.get(userId) ?? 0) + 1;
    this.sockets.set(userId, next);
    return next === 1;
  }

  /** Unregisters a socket; returns true when the user just went offline. */
  remove(userId: string): boolean {
    const current = this.sockets.get(userId) ?? 0;
    if (current <= 1) {
      this.sockets.delete(userId);
      return current === 1;
    }
    this.sockets.set(userId, current - 1);
    return false;
  }

  count(userId: string): number {
    return this.sockets.get(userId) ?? 0;
  }

  isOnline(userId: string): boolean {
    return this.count(userId) > 0;
  }
}
