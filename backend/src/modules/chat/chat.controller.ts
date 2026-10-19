import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import {
  ChatUser,
  ConversationView,
  MessagePage,
  MessageView,
} from './chat.types';
import { GetMessagesQueryDto } from './dto/get-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageRateLimitGuard } from './guards/message-rate-limit.guard';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // ─── GET /chat/conversations ──────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({
    summary: 'My conversations (last message + unread count), newest first',
  })
  getConversations(
    @CurrentUser('userId') userId: string,
  ): Promise<ConversationView[]> {
    return this.chatService.getConversations(userId);
  }

  // ─── GET /chat/messages/:otherUserId ──────────────────────────────────────

  @Get('messages/:otherUserId')
  @ApiOperation({
    summary: 'Message history with a user (cursor pagination, newest first)',
  })
  @ApiParam({ name: 'otherUserId', description: 'MongoDB ObjectId' })
  getMessages(
    @CurrentUser('userId') userId: string,
    @Param('otherUserId') otherUserId: string,
    @Query() query: GetMessagesQueryDto,
  ): Promise<MessagePage> {
    return this.chatService.getMessages(userId, otherUserId, query);
  }

  // ─── POST /chat/messages (REST fallback of `message:send`) ───────────────

  @Post('messages')
  @UseGuards(MessageRateLimitGuard)
  @ApiOperation({
    summary: 'Send a message (REST fallback, also delivered in real time)',
  })
  async sendMessage(
    @CurrentUser() user: ChatUser,
    @Body() dto: SendMessageDto,
  ): Promise<MessageView> {
    const message = await this.chatService.sendMessage(
      { userId: user.userId, role: user.role },
      dto.to,
      dto.text,
    );
    this.chatGateway.emitNewMessage(message);
    return message;
  }

  // ─── PATCH /chat/messages/:otherUserId/read ───────────────────────────────

  @Patch('messages/:otherUserId/read')
  @ApiOperation({ summary: 'Mark messages received from a user as read' })
  @ApiParam({ name: 'otherUserId', description: 'MongoDB ObjectId' })
  markAsRead(
    @CurrentUser('userId') userId: string,
    @Param('otherUserId') otherUserId: string,
  ): Promise<{ updated: number }> {
    return this.chatService.markAsRead(userId, otherUserId);
  }
}
