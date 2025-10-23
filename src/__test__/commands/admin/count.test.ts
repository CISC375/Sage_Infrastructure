import { Command } from '@lib/types/Command';
import { ChatInputCommandInteraction } from 'discord.js';
import CountCategoryChannelsCommand from '../../../commands/admin/count';

// --- MOCK SETUP ---

// 依存関係である ADMIN_PERMS のダミー定義をモックします
jest.mock('@lib/permissions', () => ({
    ADMIN_PERMS: { id: 'admin_role_id', permission: true, type: 1 },
}));

const MOCK_CATEGORY_ID = '123456789';
const MOCK_CHANNEL_COUNT = 7;

/**
 * 成功パスで使用する CategoryChannel のモックヘルパー
 */
const mockCategoryChannel = (count: number): any => ({
    id: MOCK_CATEGORY_ID,
    name: 'archive-category',
    // Discordのメンション形式 (toString) をシミュレート
    toString: () => `<#${MOCK_CATEGORY_ID}>`,
    // 子チャンネルのキャッシュサイズをモック
    children: {
        cache: {
            size: count,
        }
    }
});

/**
 * 失敗パスで使用する TextChannel のモックヘルパー
 * children.cache が存在しないため、try/catchブロックでエラーを引き起こします
 */
const mockInvalidChannel: any = {
    id: '987654321',
    name: 'general-chat',
    toString: () => `<#987654321>`,
    // CategoryChannelに必要な 'children'プロパティを意図的に省略
};


let mockInteraction: ChatInputCommandInteraction;
let command: Command;

beforeEach(() => {
    // 相互作用オブジェクトと、それに付随するメソッドのモック
    mockInteraction = {
        options: {
            getChannel: jest.fn(),
        },
        reply: jest.fn(), // 応答メソッドをモック
    } as unknown as ChatInputCommandInteraction; 

    // コマンドインスタンスの初期化
    command = new CountCategoryChannelsCommand();
});

// --- TESTS ---

describe('CountCategoryChannels Command', () => {

    test('should reply with the correct channel count for a valid category', async () => {
        // Setup: 有効な CategoryChannel モックを返すように設定
        const categoryChannelMock = mockCategoryChannel(MOCK_CHANNEL_COUNT);
        (mockInteraction.options.getChannel as jest.Mock).mockReturnValue(categoryChannelMock);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: interaction.reply が一度だけ呼び出されたことを確認
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledTimes(1);

        // Assertion 2: 正しいチャンネル数を含むコンテンツで応答されたことを確認
        const expectedContent = `**${categoryChannelMock}** has **${MOCK_CHANNEL_COUNT}** channel(s)!`;
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledWith({
            content: expectedContent,
            ephemeral: true
        });
    });

    test('should reply with an error message if the channel is not a valid category', async () => {
        // Setup: childrenプロパティを持たない無効なチャンネルモックを返すように設定
        (mockInteraction.options.getChannel as jest.Mock).mockReturnValue(mockInvalidChannel);

        // Execute
        await command.run(mockInteraction);

        // Assertion 1: interaction.reply が一度だけ呼び出されたことを確認
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledTimes(1);

        // Assertion 2: エラーメッセージで応答されたことを確認 (try/catchブロックが発動)
        const expectedContent = `That's not a valid channel category.`;
        expect(mockInteraction.reply as jest.Mock).toHaveBeenCalledWith({
            content: expectedContent,
            ephemeral: true
        });
    });
});
