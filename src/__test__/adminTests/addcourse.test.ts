import {
    ChatInputCommandInteraction,
    TextChannel,
    CategoryChannel,
    Role,
    ChannelType
} from 'discord.js';
import AddCourseCommand from '../../commands/admin/addcourse'; // コマンドのパス
import { updateDropdowns } from '@lib/utils/generalUtils'; // モック対象

// ------------------------------------------------------------------
// 📚 モックの設定 (Mock Setup)
// ------------------------------------------------------------------

// (1) 外部ユーティリティ関数をモック
jest.mock('@lib/utils/generalUtils', () => ({
    updateDropdowns: jest.fn().mockResolvedValue(undefined),
}));
// モックされた関数に型付けしてアクセスできるようにする
const mockedUpdateDropdowns = updateDropdowns as jest.Mock;

// (2) jest.setup.ts が @root/config (DB, ROLES, GUILDS) を
//     モックしていることを前提とします

// (3) discord.js の各種モック関数
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockEditReply = jest.fn().mockResolvedValue(undefined);
const mockGetString = jest.fn();
const mockRoleCreate = jest.fn();
const mockChannelCreate = jest.fn();

// (4) データベース (mongo) のモック関数
const mockCountDocuments = jest.fn();
const mockInsertOne = jest.fn();

// client.mongo.collection('...').countDocuments(...) を再現
const mockMongoCollection = jest.fn(() => ({
    countDocuments: mockCountDocuments,
    insertOne: mockInsertOne,
}));

// ------------------------------------------------------------------
// 🚀 テストの開始 (Start Testing)
// ------------------------------------------------------------------

describe('AddCourse Command', () => {
    let command: AddCourseCommand;
    let mockInteraction: ChatInputCommandInteraction;

    // 各テストの前にモックをリセットし、
    // 模擬Interactionオブジェクトを再構築する
    beforeEach(() => {
        command = new AddCourseCommand();

        // モックのリセット
        mockReply.mockReset();
        mockEditReply.mockReset();
        mockGetString.mockReset();
        mockRoleCreate.mockReset();
        mockChannelCreate.mockReset();
        mockCountDocuments.mockReset();
        mockInsertOne.mockReset();
        mockedUpdateDropdowns.mockReset();

        // 模擬ChatInputCommandInteraction
        mockInteraction = {
            reply: mockReply,
            editReply: mockEditReply,
            options: {
                getString: mockGetString,
            },
            guild: {
                roles: {
                    create: mockRoleCreate,
                },
                channels: {
                    create: mockChannelCreate,
                },
            },
            client: {
                mongo: {
                    collection: mockMongoCollection,
                },
            },
            user: {
                username: 'TestUser',
                id: 'user-123',
            },
            // 型アサーションで不要なプロパティを省略
        } as unknown as ChatInputCommandInteraction;
    });

    // ------------------------------------------------------------------
    // ✅ 正常系テスト (Success Case)
    // ------------------------------------------------------------------

    describe('Success Path', () => {
        it('should create a new course with all channels and roles', async () => {
            const courseName = '101';

            // --- Arrange (準備) ---
            // ユーザー入力を設定
            mockGetString.mockReturnValue(courseName);

            // 1. データベースチェック (コースは存在しない)
            mockCountDocuments.mockResolvedValue(0);

            // 2. ロール作成 (Staff, Student)
            mockRoleCreate
                .mockResolvedValueOnce({ id: 'staff-role-id', name: `${courseName} Staff` } as Role)
                .mockResolvedValueOnce({ id: 'student-role-id', name: `CISC ${courseName}` } as Role);

            // 3. チャンネル作成 (Category, General, HW, Lab, Proj, Staff, Private)
            mockChannelCreate
                // Category
                .mockResolvedValueOnce({ id: 'category-id', type: ChannelType.GuildCategory } as CategoryChannel)
                // General
                .mockResolvedValueOnce({ id: 'general-id', type: ChannelType.GuildText } as TextChannel)
                // Homework
                .mockResolvedValueOnce({ id: 'hw-id', type: ChannelType.GuildText } as TextChannel)
                // Labs
                .mockResolvedValueOnce({ id: 'labs-id', type: ChannelType.GuildText } as TextChannel)
                // Projects
                .mockResolvedValueOnce({ id: 'projects-id', type: ChannelType.GuildText } as TextChannel)
                // Staff
                .mockResolvedValueOnce({ id: 'staff-id', type: ChannelType.GuildText } as TextChannel)
                // Private Qs
                .mockResolvedValueOnce({ id: 'private-id', type: ChannelType.GuildText } as TextChannel);
            
            // 4. データベース挿入
            mockInsertOne.mockResolvedValue({ acknowledged: true });

            // 5. ドロップダウン更新
            mockedUpdateDropdowns.mockResolvedValue(undefined);


            // --- Act (実行) ---
            await command.run(mockInteraction);


            // --- Assert (検証) ---
            // 最初の応答
            expect(mockReply).toHaveBeenCalledWith('<a:loading:755121200929439745> working...');

            // DBチェック
            expect(mockMongoCollection).toHaveBeenCalledWith('courses'); // DB.COURSES
            expect(mockCountDocuments).toHaveBeenCalledWith({ name: courseName });

            // ロール作成
            expect(mockRoleCreate).toHaveBeenCalledTimes(2);
            expect(mockRoleCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '101 Staff' }));
            expect(mockRoleCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'CISC 101' }));

            // チャンネル作成 (カテゴリ1 + テキスト4 + スタッフ2 = 7)
            expect(mockChannelCreate).toHaveBeenCalledTimes(7);
            expect(mockChannelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'CISC 101', type: ChannelType.GuildCategory }));
            expect(mockChannelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '101_general' }));
            expect(mockChannelCreate).toHaveBeenCalledWith(expect.objectContaining({ name: '101_staff' }));

            // DB挿入
            expect(mockInsertOne).toHaveBeenCalledTimes(1);
            expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({
                name: courseName,
                channels: expect.objectContaining({
                    category: 'category-id',
                    general: 'general-id',
                    staff: 'staff-id',
                    private: 'private-id'
                }),
                roles: expect.objectContaining({
                    staff: 'staff-role-id',
                    student: 'student-role-id'
                })
            }));

            // ドロップダウン更新
            expect(mockedUpdateDropdowns).toHaveBeenCalledWith(mockInteraction);

            // 最終応答
            expect(mockEditReply).toHaveBeenLastCalledWith(`Successfully added course with ID ${courseName}`);
        });
    });

    // ------------------------------------------------------------------
    // ❌ エラー系テスト (Error Cases)
    // ------------------------------------------------------------------

    describe('Failure Path', () => {
        it('should reply with an error if the course already exists', async () => {
            const courseName = '102';

            // --- Arrange (準備) ---
            mockGetString.mockReturnValue(courseName);

            // 1. データベースチェック (コースが *存在する*)
            mockCountDocuments.mockResolvedValue(1);

            
            // --- Act (実行) ---
            await command.run(mockInteraction);

            
            // --- Assert (検証) ---
            // 最初の応答
            expect(mockReply).toHaveBeenCalledWith('<a:loading:755121200929439745> working...');
            
            // DBチェック
            expect(mockCountDocuments).toHaveBeenCalledWith({ name: courseName });

            // 早期リターン後の応答
            expect(mockEditReply).toHaveBeenCalledWith({
                content: `${courseName} has already been registered as a course.`,
            });
            // 以下の処理が *実行されていない* ことを確認
            expect(mockRoleCreate).not.toHaveBeenCalled();
            expect(mockChannelCreate).not.toHaveBeenCalled();
            expect(mockInsertOne).not.toHaveBeenCalled();
            expect(mockedUpdateDropdowns).not.toHaveBeenCalled();
        });
    });
});
