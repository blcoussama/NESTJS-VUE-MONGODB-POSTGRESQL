import { UserRole } from '../users/schemas/user.schema';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageView } from './chat.types';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: {
    getConversations: jest.Mock;
    getMessages: jest.Mock;
    sendMessage: jest.Mock;
    markAsRead: jest.Mock;
  };
  let chatGateway: { emitNewMessage: jest.Mock };

  const user = {
    userId: '665f1c2e9b1e8a3d4c5b6a71',
    email: 'c@profyle.test',
    role: UserRole.CANDIDATE,
  };
  const otherId = '665f1c2e9b1e8a3d4c5b6a72';

  beforeEach(() => {
    chatService = {
      getConversations: jest.fn().mockResolvedValue([]),
      getMessages: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      sendMessage: jest.fn(),
      markAsRead: jest.fn().mockResolvedValue({ updated: 2 }),
    };
    chatGateway = { emitNewMessage: jest.fn() };
    controller = new ChatController(
      chatService as unknown as ChatService,
      chatGateway as unknown as ChatGateway,
    );
  });

  it('delegates history, conversations and read to the service with the current user', async () => {
    await controller.getConversations(user.userId);
    await controller.getMessages(user.userId, otherId, { limit: 10 });
    await expect(controller.markAsRead(user.userId, otherId)).resolves.toEqual({
      updated: 2,
    });

    expect(chatService.getConversations).toHaveBeenCalledWith(user.userId);
    expect(chatService.getMessages).toHaveBeenCalledWith(user.userId, otherId, {
      limit: 10,
    });
    expect(chatService.markAsRead).toHaveBeenCalledWith(user.userId, otherId);
  });

  it('sends as the authenticated user and pushes the message in real time', async () => {
    const message: MessageView = {
      id: '665f1c2e9b1e8a3d4c5b6a73',
      from: user.userId,
      to: otherId,
      text: 'Hi',
      createdAt: '2026-10-01T10:00:00.000Z',
      readAt: null,
    };
    chatService.sendMessage.mockResolvedValue(message);

    await expect(
      controller.sendMessage(user, { to: otherId, text: 'Hi' }),
    ).resolves.toBe(message);
    expect(chatService.sendMessage).toHaveBeenCalledWith(
      { userId: user.userId, role: user.role },
      otherId,
      'Hi',
    );
    expect(chatGateway.emitNewMessage).toHaveBeenCalledWith(message);
  });

  it('does not emit anything when the service rejects the message', async () => {
    chatService.sendMessage.mockRejectedValue(new Error('forbidden'));

    await expect(
      controller.sendMessage(user, { to: otherId, text: 'Hi' }),
    ).rejects.toThrow('forbidden');
    expect(chatGateway.emitNewMessage).not.toHaveBeenCalled();
  });
});
