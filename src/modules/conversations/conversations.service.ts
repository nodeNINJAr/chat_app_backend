import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { UpdateParticipantStateDto } from './dto/update-participant-state.dto';
import {
  ConversationParticipant,
  ConversationParticipantDocument,
  ParticipantRole,
} from './schemas/conversation-participant.schema';
import {
  Conversation,
  ConversationDocument,
  directParticipantsHash,
  LastMessageSnapshotInput,
} from './schemas/conversation.schema';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(ConversationParticipant.name)
    private readonly participantModel: Model<ConversationParticipantDocument>,
  ) {}

  async getOrCreateDirect(
    userId: string,
    otherUserId: string,
  ): Promise<ConversationDocument> {
    const hash = directParticipantsHash(userId, otherUserId);
    const existing = await this.conversationModel.findOne({
      type: 'direct',
      participantsHash: hash,
    });
    if (existing) {
      return existing;
    }

    try {
      const conversation = await this.conversationModel.create({
        type: 'direct',
        participantsHash: hash,
        lastMessageAt: new Date(),
      });
      await this.participantModel.insertMany([
        { conversationId: conversation._id, userId },
        { conversationId: conversation._id, userId: otherUserId },
      ]);
      return conversation;
    } catch (err) {
      // Race: another request created the same direct thread first — return it.
      if (this.isDuplicateKeyError(err)) {
        const winner = await this.conversationModel.findOne({
          type: 'direct',
          participantsHash: hash,
        });
        if (winner) return winner;
      }
      throw err;
    }
  }

  async listMine(
    userId: string,
    limit = 30,
    before?: Date,
  ): Promise<
    Array<{
      conversation: ConversationDocument;
      participant: ConversationParticipantDocument;
    }>
  > {
    const participants = await this.participantModel
      .find({ userId, leftAt: null })
      .exec();
    const conversationIds = participants.map((p) => p.conversationId);

    const filter: Record<string, unknown> = {
      _id: { $in: conversationIds },
    };
    if (before) {
      filter.lastMessageAt = { $lt: before };
    }

    const conversations = await this.conversationModel
      .find(filter)
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .exec();

    const participantByConversation = new Map(
      participants.map((p) => [p.conversationId.toString(), p]),
    );

    return conversations.map((conversation) => ({
      conversation,
      participant: participantByConversation.get(
        conversation.id,
      ) as ConversationParticipantDocument,
    }));
  }

  async getParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantDocument | null> {
    return this.participantModel
      .findOne({ conversationId, userId, leftAt: null })
      .exec();
  }

  /** Throws if the user isn't an active participant — the core authz check for every message/conversation operation. */
  async assertActiveParticipant(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantDocument> {
    const participant = await this.getParticipant(conversationId, userId);
    if (!participant) {
      throw new ForbiddenException('not a participant of this conversation');
    }
    return participant;
  }

  async listParticipants(
    conversationId: string,
  ): Promise<ConversationParticipantDocument[]> {
    return this.participantModel.find({ conversationId, leftAt: null }).exec();
  }

  async listParticipantIds(conversationId: string): Promise<string[]> {
    const rows = await this.participantModel
      .find({ conversationId, leftAt: null })
      .select('userId')
      .exec();
    return rows.map((r) => r.userId.toString());
  }

  /** Conversation room ids this user should join on socket connect. */
  async listMyConversationIds(userId: string): Promise<string[]> {
    const rows = await this.participantModel
      .find({ userId, leftAt: null })
      .select('conversationId')
      .exec();
    return rows.map((r) => r.conversationId.toString());
  }

  async updateParticipantState(
    conversationId: string,
    userId: string,
    dto: UpdateParticipantStateDto,
  ): Promise<ConversationParticipantDocument> {
    const participant = await this.participantModel.findOneAndUpdate(
      { conversationId, userId, leftAt: null },
      { $set: dto },
      { returnDocument: 'after' },
    );
    if (!participant) {
      throw new NotFoundException('not a participant of this conversation');
    }
    return participant;
  }

  async leave(conversationId: string, userId: string): Promise<void> {
    await this.participantModel.updateOne(
      { conversationId, userId },
      { $set: { leftAt: new Date() } },
    );
  }

  async touchLastMessage(
    conversationId: string,
    snapshot: LastMessageSnapshotInput,
  ): Promise<void> {
    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { lastMessage: snapshot, lastMessageAt: snapshot.createdAt } },
    );
  }

  async incrementUnreadForOthers(
    conversationId: string,
    senderId: string,
  ): Promise<void> {
    await this.participantModel.updateMany(
      { conversationId, userId: { $ne: senderId }, leftAt: null },
      { $inc: { unreadCount: 1 } },
    );
  }

  async resetUnread(
    conversationId: string,
    userId: string,
    upToMessageId: string,
  ): Promise<void> {
    await this.participantModel.updateOne(
      { conversationId, userId },
      {
        $set: {
          unreadCount: 0,
          lastReadMessageId: new Types.ObjectId(upToMessageId),
          lastReadAt: new Date(),
        },
      },
    );
  }

  /** Bare group-type conversation shell — GroupsService links it to a Group doc right after, within the same transaction. */
  async createGroupConversation(
    session: ClientSession,
  ): Promise<ConversationDocument> {
    const [conversation] = await this.conversationModel.create(
      [{ type: 'group', lastMessageAt: new Date() }],
      { session },
    );
    return conversation;
  }

  async linkGroup(
    conversationId: string | Types.ObjectId,
    groupId: string | Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.conversationModel.updateOne(
      { _id: conversationId },
      { $set: { groupId } },
      { session },
    );
  }

  async addParticipantsWithRoles(
    conversationId: string | Types.ObjectId,
    entries: Array<{ userId: string; role: ParticipantRole }>,
    session?: ClientSession,
  ): Promise<void> {
    await this.participantModel.insertMany(
      entries.map(({ userId, role }) => ({ conversationId, userId, role })),
      { session },
    );
  }

  async updateRole(
    conversationId: string,
    userId: string,
    role: ParticipantRole,
  ): Promise<ConversationParticipantDocument> {
    const participant = await this.participantModel.findOneAndUpdate(
      { conversationId, userId, leftAt: null },
      { $set: { role } },
      { returnDocument: 'after' },
    );
    if (!participant) {
      throw new NotFoundException('not a participant of this conversation');
    }
    return participant;
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: number }).code === 11000
    );
  }
}
