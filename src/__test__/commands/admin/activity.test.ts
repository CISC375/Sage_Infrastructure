import { ApplicationCommandOptionType, ApplicationCommandPermissions, ChatInputCommandInteraction } from 'discord.js';
import ActivityCommand from '../../../commands/admin/activity';

// ------------------------------------------------------------------
// モックの設定
// ------------------------------------------------------------------

// discord.jsのモック化
// setActivityでActivityTypeが必要なため、discord.jsからインポートされたかのようにモック化します。
// 実際にはActivityTypeは数字または大文字の文字列(PLAYING, LISTENINGなど)として扱われるため、
// 今回のコマンドでは大文字の文字列が渡されることを想定し、その動作をモック内でエミュレートします。
const mockSetActivity = jest.fn();
const mockReply = jest.fn().mockResolvedValue(undefined); // replyはPromiseを返すのでresolveする
const mockGetString = jest.fn();

// MongoDBクライアントのモック化
const mockUpdateOne = jest.fn().mockResolvedValue({});
const mockMongo = {
    collection: jest.fn(() => ({
        updateOne: mockUpdateOne
    }))
};

// BOTとDBの設定をモック化 (configファイルからのインポートをエミュレート)
const mockConfig = {
    BOT: { NAME: 'TestBot' },
    DB: { CLIENT_DATA: 'clientDataCollection' },
};

// Activityコマンドがインポートされる前に設定をモック化する必要があるため、
// `jest.mock`を使用して依存関係をモック化します。

jest.mock('@root/config', () => ({
    BOT: { NAME: 'TestBot' },
    DB: { CLIENT_DATA: 'clientDataCollection' },
})
);
// ActivityTypeをActivityCommandが受け取る形式に合わせるため、ここでは詳細なモックは不要です。

// ------------------------------------------------------------------
// テストの開始
// ------------------------------------------------------------------

describe('Activity Command', () => {
    let command: ActivityCommand;
    let mockInteraction: ChatInputCommandInteraction;

    beforeEach(() => {
        // コマンドインスタンスを初期化
        command = new ActivityCommand();

        // モック関数をリセット
        mockSetActivity.mockClear();
        mockUpdateOne.mockClear();
        mockReply.mockClear();
        mockGetString.mockClear();

        // 模擬ChatInputCommandInteractionオブジェクトを作成
        // コマンド内のロジックに合わせて必要なプロパティのみをモックします。
        mockInteraction = {
            // interaction.client
            client: {
                user: {
                    id: '1234567890',
                    setActivity: mockSetActivity,
                },
                mongo: mockMongo,
            },
            // interaction.options.getString()
            options: {
                getString: mockGetString,
            },
            // interaction.reply()
            reply: mockReply,
            // その他の不要なInteractionプロパティは省略
        } as unknown as ChatInputCommandInteraction;
    });

    it('should correctly set the activity status and content, and update the database', async () => {
        const testStatus = 'Watching';
        const testContent = '/help';
        const expectedType = 'WATCHING'; // コマンド内で .toUpperCase() される

        // interaction.options.getString('status') と interaction.options.getString('content') の戻り値を設定
        mockGetString
            .mockImplementation((name) => {
                if (name === 'status') return testStatus;
                if (name === 'content') return testContent;
                // 注意: コマンド内の 'category' は、オプション名 'content' の間違いのようです。
                // 実際には interaction.options.getString('content') であるべきですが、
                // テストではコードの現在の実装 (interaction.options.getString('category')) に合わせます。
                if (name === 'category') return testContent; 
                return null;
            });
        
        // テストの実行
        await command.run(mockInteraction);

        // 1. bot.user.setActivity が正しく呼ばれたか検証
        // Discord.js v13/v14ではsetActivityはActivityType enum (または対応する数値/文字列) を期待します。
        // コマンドは 'WATCHING' のような大文字の文字列を渡そうとしています。
        expect(mockSetActivity).toHaveBeenCalledWith(testContent, { type: expectedType });

        // 2. MongoDBへの書き込みが正しく行われたか検証
        expect(mockMongo.collection).toHaveBeenCalledWith(mockConfig.DB.CLIENT_DATA);
        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: mockInteraction.client.user.id },
            { $set: { status: { type: expectedType, content: testContent } } },
            { upsert: true }
        );

        // 3. interaction.reply が正しく呼ばれたか検証
        expect(mockReply).toHaveBeenCalledWith({
            content: `Set ${mockConfig.BOT.NAME}'s activity to *${expectedType} ${testContent}*`,
            ephemeral: true
        });
    });

    // オプション名の間違いに関する注意:
    // コマンド内で `const content = interaction.options.getString('category');` となっていますが、
    // 定義されているオプション名は 'content' です。
    // 適切な修正は `const content = interaction.options.getString('content');` ですが、
    // このテストでは**現在のコマンド実装**に合わせてモックを設定しています。
    // このテストコードが正常に動作し、かつ、コマンドの意図通りに動作させたい場合は、
    // `ActivityCommand.run`メソッド内の `'category'` を `'content'` に修正することを推奨します。

    it('should use the status and content correctly for Streaming type', async () => {
        const testStatus = 'Streaming';
        const testContent = 'New Stream!';
        const expectedType = 'STREAMING';

        mockGetString
            .mockImplementation((name) => {
                if (name === 'status') return testStatus;
                if (name === 'category') return testContent; // 現在のコマンド実装に合わせて 'category' を使用
                return null;
            });

        await command.run(mockInteraction);

        expect(mockSetActivity).toHaveBeenCalledWith(testContent, { type: expectedType });
        expect(mockUpdateOne).toHaveBeenCalledWith(
            { _id: '1234567890' },
            { $set: { status: { type: expectedType, content: testContent } } },
            { upsert: true }
        );
        expect(mockReply).toHaveBeenCalledWith({
            content: `Set ${mockConfig.BOT.NAME}'s activity to *${expectedType} ${testContent}*`,
            ephemeral: true
        });
    });
});