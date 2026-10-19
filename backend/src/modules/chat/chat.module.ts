import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../users/schemas/user.schema';
import { ChatSocketAuthService } from './chat-socket-auth.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { PresenceRegistry } from './presence.registry';
import { Message, MessageSchema } from './schemas/message.schema';

/**
 * Chat: REST history + Socket.io gateway (namespace `/chat`).
 *
 * Requires, from the root module: a global ConfigModule (`jwt.accessSecret`),
 * the MongoDB connection, the global PrismaModule, and AuthModule (registers
 * the `jwt-access` passport strategy used by JwtAuthGuard).
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    // No global config: the access secret is passed to verifyAsync()
    JwtModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatGateway,
    ChatSocketAuthService,
    PresenceRegistry,
  ],
  exports: [ChatService],
})
export class ChatModule {}
