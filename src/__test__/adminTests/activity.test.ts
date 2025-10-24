import { ActivityType, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import ActivityCommand from '../../commands/admin/activity';

// ------------------------------------------------------------------
// モックの設定
// ------------------------------------------------------------------

const mockSetActivity = jest.fn();
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockGetString = jest.fn();
const mockUpdateOne = jest.fn().mockResolvedValue({});
const mockMongo = {
    collection: jest.fn(() => ({
        updateOne: mockUpdateOne
    }))
}

const mockConfig = {
    BOT: { NAME: 'TestBot' },
    DB: { CLIENT_DATA: 'clientDataCollection' },
};

jest.mock('@root/config', () => ({
    BOT: { NAME: 'TestBot' },
    DB: { CLIENT_DATA: 'clientDataCollection' },
    ROLES:{
        STAFF: 'mock-staff-role-id-123'
    }
}));

// ------------------------------------------------------------------
// テストの開始
// ------------------------------------------------------------------

describe('Activity Command', () => {
    let command: ActivityCommand;
    let mockInteraction: ChatInputCommandInteraction;

    beforeEach(() => {
        command = new ActivityCommand();

        mockSetActivity.mockClear();
        mockUpdateOne.mockClear();
        mockReply.mockClear();
        mockGetString.mockClear();

        mockInteraction = {
            client: {
                user: {
                    id: '1234567890',
                    setActivity: mockSetActivity,
                },
                mongo: mockMongo,
            },
            options: {
                getString: mockGetString,
            },
            reply: mockReply,
        } as unknown as ChatInputCommandInteraction;
    });

    it('should correctly set the activity status and content, and update the database', async () => {
        const testStatus = 'Watching';
        const testContent = '/help';
        const expectedType = ActivityType.Watching;

        mockGetString
            .mockImplementation((name) => {
                if (name === 'status') return testStatus;
                if (name === 'content') return testContent;
                return null;
            });
        
        await command.run(mockInteraction);

        expect(mockSetActivity).toHaveBeenCalledWith(testContent, { type: expectedType });

        expect(mockMongo.collection).toHaveBeenCalledWith(mockConfig.DB.CLIENT_DATA);
        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: mockInteraction.client.user.id },
            { $set: { status: { type: expectedType, content: testContent } } },
            { upsert: true }
        );

        // FIX: Changed 'flags: MessageFlags.Ephemeral' to 'ephemeral: true'
        expect(mockReply).toHaveBeenCalledWith({
            content: `Set ${mockConfig.BOT.NAME}'s activity to *${testStatus} ${testContent}*`,
            ephemeral: true,
        });
    });

    it('should use the status and content correctly for Streaming type', async () => {
        const testStatus = 'Streaming';
        const testContent = 'New Stream!';
        const expectedType = ActivityType.Streaming;

        mockGetString
            .mockImplementation((name) => {
                if (name === 'status') return testStatus;
                if (name === 'content') return testContent;
                return null;
            });

        await command.run(mockInteraction);

        expect(mockSetActivity).toHaveBeenCalledWith(testContent, { type: expectedType });
        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: '1234567890' },
            { $set: { status: { type: expectedType, content: testContent } } },
            { upsert: true }
        );

        // FIX: Changed 'flags: MessageFlags.Ephemeral' to 'ephemeral: true'
        expect(mockReply).toHaveBeenCalledWith({
            content: `Set ${mockConfig.BOT.NAME}'s activity to *${testStatus} ${testContent}*`,
            ephemeral: true,
        });
    });
});