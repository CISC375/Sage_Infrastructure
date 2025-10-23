import { ChatInputCommandInteraction, ButtonStyle, TextChannel, Message, InteractionResponse } from 'discord.js';
import ButtonCommand from '../../../commands/admin/addbutton'; // あなたのプロジェクト構成に合わせてパスを調整してください
import * as mockConfig from '@root/config';

// ------------------------------------------------------------------
// 📚 モックの設定 (Mock Setup)
// ------------------------------------------------------------------

// Jestのモック関数 (スパイ)
const mockGetString = jest.fn();
const mockReply = jest.fn().mockResolvedValue(undefined);
const mockEdit = jest.fn().mockResolvedValue(undefined); // message.editをモック

// メッセージフェッチの成功と失敗を制御するためのモック関数
const mockFetchMessage = jest.fn();
const mockFetchChannel = jest.fn();

// Discord.jsの構造を再現したモックMessageオブジェクト
const mockMessage = (editable: boolean, content: string = 'Original message content') => ({
    editable: editable,
    content: content,
    edit: mockEdit,
    // その他、コマンドがアクセスしないプロパティは省略
} as unknown as Message);

// interaction.client.channels.fetch と channel.messages.fetch をモック
const mockClient = {
    channels: {
        fetch: mockFetchChannel,
    },
    // その他の不要なclientプロパティは省略
};

// BOT設定のモック化
jest.mock('@root/config', () => ({
    BOT: { NAME: 'TestBot' },
    BOTMASTER_PERMS: [], // テストではpermissionsは実行しないため省略可
	ROLES: {
        STAFF: 'dummy-staff-role-id' // テストが動作すればIDは何でもOK
        // 他に参照されるロールがあればここに追加
    }
})
);

// ------------------------------------------------------------------
// 🚀 テストの開始 (Start Testing)
// ------------------------------------------------------------------

describe('Button Command', () => {
    let command: ButtonCommand;
    let mockInteraction: ChatInputCommandInteraction;

    // 各テストケースの前に実行
    beforeEach(() => {
        command = new ButtonCommand();

        // モックのリセット
        mockGetString.mockClear();
        mockReply.mockClear();
        mockEdit.mockClear();
        mockFetchMessage.mockClear();
        mockFetchChannel.mockClear();

        // 模擬ChatInputCommandInteractionオブジェクトの作成
        mockInteraction = {
            client: mockClient,
            options: {
                getString: mockGetString,
            },
            reply: mockReply,
            // 型キャストで不要なプロパティを省略
        } as unknown as ChatInputCommandInteraction;

        // モックのデフォルト設定
        // 成功ケースのデフォルト設定として、モックメッセージのフェッチ関数を設定
        mockFetchChannel.mockImplementation((channelID: string) => {
            // channelIDとmessageIDはここでは使用しないが、引数として受け取る
            return Promise.resolve({
                messages: {
                    fetch: mockFetchMessage
                }
            } as unknown as TextChannel);
        });
    });

    // ------------------------------------------------------------------
    // ✅ 正常系テスト (Success Cases)
    // ------------------------------------------------------------------

    it('should successfully edit a message with a Primary button', async () => {
        const msgLink = 'https://discord.com/channels/12345/67890/112233';
        const label = 'Click Me!';
        const customID = 'unique_id_1';
        const style = 'primary';
        
        // ユーザー入力のモック設定
        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return label;
                if (name === 'custom_id') return customID;
                if (name === 'style') return style;
                return null;
            });

        // メッセージフェッチの成功と編集可能なメッセージを返す設定
        const messageToEdit = mockMessage(true);
        mockFetchMessage.mockResolvedValue(messageToEdit);

        // テストの実行
        await command.run(mockInteraction);

        // 1. メッセージがフェッチされたか検証
        // リンクからchannelID(67890)とmessageID(112233)が正しく抽出されたかを確認
        expect(mockClient.channels.fetch).toHaveBeenCalledWith('67890');
        expect(mockFetchMessage).toHaveBeenCalledWith('112233');

        // 2. message.edit が正しく呼ばれたか検証
        expect(mockEdit).toHaveBeenCalledTimes(1);
        const editCall = mockEdit.mock.calls[0][0]; // 1回目の呼び出しの最初の引数
        
        // 編集内容の検証
        expect(editCall.content).toBe(messageToEdit.content); // 元のcontentが保持されていること
        expect(editCall.components).toHaveLength(1); // ActionRowが1つあること

        // ボタンの検証 (ActionRowの中身)
        const componentData = editCall.components[0].toJSON().components[0];
        expect(componentData.label).toBe(label);
        expect(componentData.custom_id).toBe(customID);
        // 'PRIMARY'に変換されてButtonComponentのStyleが設定される
        expect(componentData.style).toBe(ButtonStyle.Primary); 

        // 3. interaction.reply が成功メッセージで呼ばれたか検証
        expect(mockReply).toHaveBeenCalledWith({
            content: 'Your message has been given a button', 
            ephemeral: true 
        });
    });

    it('should handle "canary." in the message link correctly', async () => {
        const msgLink = 'https://canary.discord.com/channels/12345/67890/112233';
        const label = 'Test';
        const customID = 'test_id';
        const style = 'success';
        
        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return label;
                if (name === 'custom_id') return customID;
                if (name === 'style') return style;
                return null;
            });
        
        mockFetchMessage.mockResolvedValue(mockMessage(true)); // 編集可能

        await command.run(mockInteraction);

        // 'canary.'が削除され、正しくIDが抽出されてメッセージが取得されることを検証
        expect(mockClient.channels.fetch).toHaveBeenCalledWith('67890');
        expect(mockFetchMessage).toHaveBeenCalledWith('112233');
        expect(mockEdit).toHaveBeenCalled();
    });

    // ------------------------------------------------------------------
    // ❌ エラー系テスト (Error Cases)
    // ------------------------------------------------------------------

    it('should reply with an error if the message cannot be found', async () => {
        const msgLink = 'https://discord.com/channels/12345/67890/112233';

        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return 'l';
                if (name === 'custom_id') return 'c';
                if (name === 'style') return 'secondary';
                return null;
            });

        // message.fetchが失敗したときのエラーをシミュレート
        mockFetchMessage.mockRejectedValue(new Error('Discord API Error'));

        // コマンドがエラー文字列を throw することを検証
        await expect(command.run(mockInteraction)).rejects.toBe("I can't seem to find that message");

        // 最終的なユーザー応答 (成功メッセージ) が呼ばれていないことを確認
        expect(mockReply).not.toHaveBeenCalledWith({ content: 'Your message has been given a button', ephemeral: true });
        
        // message.editが実行されていないことを検証
        expect(mockEdit).not.toHaveBeenCalled();
    });

    it('should reply with an error if the message is not editable', async () => {
        const msgLink = 'https://discord.com/channels/12345/67890/112233';
        
        mockGetString
            .mockImplementation((name) => {
                if (name === 'msg_link') return msgLink;
                if (name === 'label') return 'l';
                if (name === 'custom_id') return 'c';
                if (name === 'style') return 'danger';
                return null;
            });

        // 編集不可能なメッセージを返す設定
        mockFetchMessage.mockResolvedValue(mockMessage(false)); 

        await command.run(mockInteraction);

        // 1. 編集不可のエラーメッセージで応答されたことを検証
        expect(mockReply).toHaveBeenCalledWith({
            content: `It seems I can't edit that message. You'll need to tag a message that was sent by me, ${mockConfig.BOT.NAME}`,
            ephemeral: true
        });

        // 2. message.editが実行されていないことを検証 (早期リターン)
        expect(mockEdit).not.toHaveBeenCalled();
    });
});