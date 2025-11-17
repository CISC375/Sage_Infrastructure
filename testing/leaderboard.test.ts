/**
 * Tests for src/commands/leaderboard.ts
 * - Mocks canvas + guild + mongo + avatars
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import LeaderboardCmd from '../src/commands/info/leaderboard';


// Mock canvas (no native bindings)
const ctx = {
	fillStyle: '',
	font: '',
	textBaseline: '',
	beginPath: jest.fn(),
	moveTo: jest.fn(),
	lineTo: jest.fn(),
	arcTo: jest.fn(),
	fill: jest.fn(),
	drawImage: jest.fn(),
	fillText: jest.fn()
};
const fakeCanvas = {
	getContext: () => ctx,
	toBuffer: () => Buffer.from('img')
};
jest.mock('canvas', () => ({
	createCanvas: jest.fn(() => fakeCanvas),
	loadImage: jest.fn(async () => ({}))
}), { virtual: true });

type MinimalInteraction = Pick<
ChatInputCommandInteraction,
'deferReply' | 'followUp' | 'options' | 'guild' | 'client' | 'user'
>;

type MockMember = {
	displayName: string;
	displayHexColor: string;
	user: {
		displayAvatarURL: () => string;
	};
};

describe('leaderboard command', () => {
	test('builds image and follows up with embed + file', async () => {
		// Two users, different levels/exp
		const users = [
			{ discordId: 'u1', level: 5, curExp: 10, levelExp: 100 },
			{ discordId: 'u2', level: 6, curExp: 40, levelExp: 120 }
		];

		const membersCache = new Map<string, MockMember>([
			[
				'u1',
				{
					displayName: 'Alpha',
					displayHexColor: '#00ff00',
					user: {
						displayAvatarURL: () => 'u1.png'
					}
				}
			],
			[
				'u2',
				{
					displayName: 'Beta',
					displayHexColor: '#123456',
					user: {
						displayAvatarURL: () => 'u2.png'
					}
				}
			]
		]);

		const interaction = {

			deferReply: jest.fn(),
			followUp: jest.fn(),
			user: { id: 'u1' },
			options: { getNumber: jest.fn().mockReturnValue(null) },
			guild: {
				members: {
					fetch: jest.fn().mockResolvedValue(undefined),
					cache: {
						has: (id: string) => membersCache.has(id),
						get: (id: string) => membersCache.get(id)
					}
				}
			},
			client: {
				mongo: {
					collection: () => ({
						find: () => ({ toArray: async () => users })
					})
				}
			}
		} as unknown as MinimalInteraction;

		const cmd = new (LeaderboardCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(interaction.deferReply).toHaveBeenCalled();
		expect(interaction.followUp).toHaveBeenCalledWith({
			embeds: [expect.any(Object)],
			files: [{ name: 'leaderboard.png', attachment: expect.any(Buffer) }]
		});
	});
});
