import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConversationsService } from '../conversations/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ForwardMessageDto } from './dto/forward-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  MessageReceipt,
  MessageReceiptDocument,
} from './schemas/message-receipt.schema';
import { Message, MessageDocument } from './schemas/message.schema';

export interface CreateMessageResult {
  message: MessageDocument;
  recipientIds: string[];
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(MessageReceipt.name)
    private readonly receiptModel: Model<MessageReceiptDocument>,
    private readonly conversationsService: ConversationsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    senderId: string,
    dto: SendMessageDto,
  ): Promise<CreateMessageResult> {
    await this.conversationsService.assertActiveParticipant(
      dto.conversationId,
      senderId,
    );
    const participantIds = await this.conversationsService.listParticipantIds(
      dto.conversationId,
    );
    const recipientIds = participantIds.filter((id) => id !== senderId);

    if (recipientIds.length === 1) {
      const blocked = await this.usersService.isBlocked(
        senderId,
        recipientIds[0],
      );
      if (blocked) {
        throw new ForbiddenException('cannot message a blocked user');
      }
    }

    const message = await this.messageModel.create({
      conversationId: dto.conversationId,
      senderId,
      type: dto.type,
      content: dto.content,
      replyToMessageId: dto.replyToMessageId ?? null,
    });

    const messageCreatedAt = message.get('createdAt') as Date;

    if (recipientIds.length > 0) {
      await this.receiptModel.insertMany(
        recipientIds.map((userId) => ({
          messageId: message._id,
          conversationId: dto.conversationId,
          userId,
          status: 'sent',
          messageCreatedAt,
        })),
      );
    }

    await this.conversationsService.touchLastMessage(dto.conversationId, {
      messageId: message._id,
      senderId,
      type: message.type,
      preview: this.preview(message),
      createdAt: messageCreatedAt,
    });
    await this.conversationsService.incrementUnreadForOthers(
      dto.conversationId,
      senderId,
    );

    if (recipientIds.length > 0) {
      const sender = await this.usersService.findByIdOrThrow(senderId);
      void this.notificationsService.notifyOfflineUsers(recipientIds, {
        title: sender.displayName,
        body: this.preview(message),
        data: { conversationId: dto.conversationId, messageId: message.id },
      });
    }

    return { message, recipientIds };
  }

  async edit(userId: string, dto: EditMessageDto): Promise<MessageDocument> {
    const message = await this.findOrThrow(dto.messageId);
    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException('only the sender can edit this message');
    }
    if (message.isDeletedForEveryone) {
      throw new BadRequestException('cannot edit a deleted message');
    }
    message.content.text = dto.text;
    message.editedAt = new Date();
    await message.save();
    return message;
  }

  async deleteMessage(
    userId: string,
    dto: DeleteMessageDto,
  ): Promise<{ message: MessageDocument; recipientIds: string[] }> {
    const message = await this.findOrThrow(dto.messageId);
    const recipientIds = await this.conversationsService.listParticipantIds(
      message.conversationId.toString(),
    );

    if (dto.mode === 'me') {
      if (!message.deletedForUserIds.some((id) => id.toString() === userId)) {
        message.deletedForUserIds.push(new Types.ObjectId(userId));
        await message.save();
      }
      return { message, recipientIds: [userId] };
    }

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException(
        'only the sender can delete this message for everyone',
      );
    }
    message.isDeletedForEveryone = true;
    message.content = {
      text: null,
      mediaUrl: null,
      thumbnailUrl: null,
      fileName: null,
      fileSize: null,
      mimeType: null,
      durationSec: null,
    };
    await message.save();
    return {
      message,
      recipientIds: recipientIds.filter((id) => id !== userId),
    };
  }

  async react(
    userId: string,
    dto: ReactMessageDto,
  ): Promise<{ message: MessageDocument; recipientIds: string[] }> {
    const message = await this.findOrThrow(dto.messageId);
    const existingIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === userId,
    );
    const hadSameEmoji =
      existingIndex >= 0 &&
      message.reactions[existingIndex].emoji === dto.emoji;

    if (existingIndex >= 0) {
      message.reactions.splice(existingIndex, 1);
    }
    if (!hadSameEmoji) {
      message.reactions.push({
        userId: new Types.ObjectId(userId),
        emoji: dto.emoji,
        createdAt: new Date(),
      });
    }
    await message.save();

    const recipientIds = await this.conversationsService.listParticipantIds(
      message.conversationId.toString(),
    );
    return {
      message,
      recipientIds: recipientIds.filter((id) => id !== userId),
    };
  }

  async forward(
    userId: string,
    dto: ForwardMessageDto,
  ): Promise<CreateMessageResult[]> {
    const original = await this.findOrThrow(dto.messageId);
    if (original.isDeletedForEveryone) {
      throw new BadRequestException('cannot forward a deleted message');
    }

    const results: CreateMessageResult[] = [];
    for (const targetConversationId of dto.targetConversationIds) {
      await this.conversationsService.assertActiveParticipant(
        targetConversationId,
        userId,
      );
      const participantIds =
        await this.conversationsService.listParticipantIds(
          targetConversationId,
        );
      const recipientIds = participantIds.filter((id) => id !== userId);

      const forwarded = await this.messageModel.create({
        conversationId: targetConversationId,
        senderId: userId,
        type: original.type,
        content: original.content,
        forwardedFrom: {
          messageId: original._id,
          conversationId: original.conversationId,
        },
      });

      const forwardedCreatedAt = forwarded.get('createdAt') as Date;

      if (recipientIds.length > 0) {
        await this.receiptModel.insertMany(
          recipientIds.map((rid) => ({
            messageId: forwarded._id,
            conversationId: targetConversationId,
            userId: rid,
            status: 'sent',
            messageCreatedAt: forwardedCreatedAt,
          })),
        );
      }

      await this.conversationsService.touchLastMessage(targetConversationId, {
        messageId: forwarded._id,
        senderId: userId,
        type: forwarded.type,
        preview: this.preview(forwarded),
        createdAt: forwardedCreatedAt,
      });
      await this.conversationsService.incrementUnreadForOthers(
        targetConversationId,
        userId,
      );

      results.push({ message: forwarded, recipientIds });
    }
    return results;
  }

  async listHistory(
    userId: string,
    conversationId: string,
    limit = 30,
    before?: string,
  ): Promise<MessageDocument[]> {
    await this.conversationsService.assertActiveParticipant(
      conversationId,
      userId,
    );

    const filter: Record<string, unknown> = {
      conversationId,
      deletedForUserIds: { $ne: new Types.ObjectId(userId) },
    };
    if (before) {
      filter._id = { $lt: new Types.ObjectId(before) };
    }

    return this.messageModel.find(filter).sort({ _id: -1 }).limit(limit).exec();
  }

  async search(
    userId: string,
    conversationId: string,
    query: string,
  ): Promise<MessageDocument[]> {
    await this.conversationsService.assertActiveParticipant(
      conversationId,
      userId,
    );
    return this.messageModel
      .find({
        conversationId,
        deletedForUserIds: { $ne: new Types.ObjectId(userId) },
        $text: { $search: query },
      })
      .limit(30)
      .exec();
  }

  async markDelivered(
    userId: string,
    messageId: string,
  ): Promise<MessageReceiptDocument | null> {
    return this.receiptModel.findOneAndUpdate(
      { messageId, userId, status: 'sent' },
      { $set: { status: 'delivered' } },
      { returnDocument: 'after' },
    );
  }

  async markRead(
    userId: string,
    conversationId: string,
    upToMessageId: string,
  ): Promise<void> {
    await this.conversationsService.assertActiveParticipant(
      conversationId,
      userId,
    );
    const upToMessage = await this.findOrThrow(upToMessageId);

    await this.receiptModel.updateMany(
      {
        conversationId,
        userId,
        status: { $ne: 'read' },
        messageCreatedAt: { $lte: upToMessage.get('createdAt') as Date },
      },
      { $set: { status: 'read' } },
    );
    await this.conversationsService.resetUnread(
      conversationId,
      userId,
      upToMessageId,
    );
  }

  private async findOrThrow(messageId: string): Promise<MessageDocument> {
    const message = await this.messageModel.findById(messageId).exec();
    if (!message) {
      throw new NotFoundException('message not found');
    }
    return message;
  }

  private preview(message: MessageDocument): string {
    if (message.type === 'text') {
      return (message.content.text ?? '').slice(0, 120);
    }
    return `[${message.type}]`;
  }
}
