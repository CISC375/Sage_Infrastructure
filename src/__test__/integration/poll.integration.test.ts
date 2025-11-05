import PollCommand, { handlePollOptionSelect } from '../../commands/fun/poll';
import { SageInteractionType } from '@lib/types/InteractionType';
import { DB } from '@root/config';

jest.mock('parse-duration', () => jest.fn());

jest.mock('@root/config', () => ({
	BOT: { NAME: 'TestSage' },
	DB: { POLLS: 'polls' },
	ROLES: { VERIFIED: 'role-verified' }
}));

jest.mock('@root/src/lib/utils/generalUtils', () => ({
	generateErrorEmbed: jest.fn((msg: string) => ({ type: 'error', msg })),
	dateToTimestamp: jest.fn(() => '<timestamp>')
}));

jest.mock('discord.js', () => {
	const MockEmbedBuilder = jest.fn(() => ({
		setTitle: jest.fn().mockReturnThis(),
		setDescription: jest.fn().mockReturnThis(),
		addFields: jest.fn().mockReturnThis(),
		setFooter: jest.fn().mockReturnThis(),
		setColor: jest.fn().mockReturnThis()
	}));
	const MockButtonBuilder = jest.fn((init = {}) => ({
		data: { ...init },
		setLabel: jest.fn().mockReturnThis(),
		setCustomId: jest.fn().mockReturnThis(),
		setStyle: jest.fn().mockReturnThis(),
		setEmoji: jest.fn().mockReturnThis()
	}));
	const MockActionRowBuilder = jest.fn((init = {}) => ({
		components: [...(init.components ?? [])],
		addComponents: jest.fn(function (...components) {
			this.components.push(...components.flat());
			return this;
		})
	}));

	return {
		EmbedBuilder: MockEmbedBuilder,
		ButtonBuilder: MockButtonBuilder,
		ActionRowBuilder: MockActionRowBuilder,
		ButtonStyle: { Secondary: 2 },
		ApplicationCommandOptionType: { String: 3 },
		ApplicationCommandPermissionType: { Role: 2 },
		ButtonInteraction: jest.fn(),
		ChatInputCommandInteraction: jest.fn()
	};
});

const parse = require('parse-duration') as jest.Mock;

describe('Poll command integration', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		parse.mockReturnValue(60_000);
	});

	test('creates a poll and stores it', async () => {
		const pollCollection = {
			insertOne: jest.fn().mockResolvedValue({})
		};
		const mongo = {
			collection: jest.fn((name: string) => {
				if (name !== DB.POLLS) throw new Error(`Unexpected collection ${name}`);
				return pollCollection;
			})
		};

		const options = new Map([
			['timespan', '1m'],
			['question', 'Favorite color?'],
			['choices', 'Red|Blue'],
			['optiontype', 'Single']
		]);

		const interaction = {
			options: {
				getString: jest.fn((key: string) => options.get(key))
			},
			reply: jest.fn().mockResolvedValue(undefined),
			fetchReply: jest.fn().mockResolvedValue({ id: 'message-1' }),
			client: { mongo },
			user: { id: 'user-1', username: 'Tester' },
			channelId: 'channel-1'
		};

		const command = new PollCommand();
		await command.run(interaction as any);

		expect(interaction.reply).toHaveBeenCalledTimes(1);
		expect(mongo.collection).toHaveBeenCalledWith(DB.POLLS);
		expect(pollCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
			owner: 'user-1',
			message: 'message-1',
			channel: 'channel-1'
		}));
	});

	test('rejects duplicate options and stays out of Mongo', async () => {
		const pollCollection = {
			insertOne: jest.fn()
		};
		const mongo = {
			collection: jest.fn(() => pollCollection)
		};

		const options = new Map([
			['timespan', '1m'],
			['question', 'Favorite color?'],
			['choices', 'Red|Red'],
			['optiontype', 'Single']
		]);

		const interaction = {
			options: {
				getString: jest.fn((key: string) => options.get(key))
			},
			reply: jest.fn().mockResolvedValue(undefined),
			client: { mongo }
		};

		const command = new PollCommand();
		await command.run(interaction as any);

		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
			content: 'All poll options must be unique.',
			ephemeral: true
		}));
		expect(pollCollection.insertOne).not.toHaveBeenCalled();
	});

	test('records and removes votes via handlePollOptionSelect', async () => {
		const basePoll = {
			owner: 'owner-1',
			message: 'message-1',
			results: [
				{ option: 'Red', users: [] },
				{ option: 'Blue', users: [] }
			],
			question: 'Favorite color?',
			channel: 'channel-1',
			type: 'Single',
			expires: new Date(Date.now() + 60_000)
		};

		const pollMessage = {
			id: 'message-1',
			edit: jest.fn().mockResolvedValue(undefined)
		};

		const collection = {
			findOne: jest.fn().mockResolvedValue({ ...basePoll }),
			findOneAndReplace: jest.fn().mockResolvedValue({})
		};

		const bot = {
			mongo: { collection: jest.fn(() => collection) }
		};

		const interaction = {
			client: bot,
			channel: { messages: { fetch: jest.fn().mockResolvedValue(pollMessage) } },
			guild: { members: { fetch: jest.fn().mockResolvedValue({ displayName: 'Owner' }) } },
			message: { id: 'message-1' },
			customId: `${SageInteractionType.POLL}_Red`,
			user: { id: 'voter-1', username: 'Voter' },
			replied: false,
			reply: jest.fn(function (this: any, payload) {
				this.replied = true;
				return Promise.resolve(payload);
			})
		};

		await handlePollOptionSelect(bot as any, interaction as any);
		expect(collection.findOneAndReplace).toHaveBeenCalledWith(
			{ message: 'message-1' },
			expect.objectContaining({
				results: [
					{ option: 'Red', users: ['voter-1'] },
					{ option: 'Blue', users: [] }
				]
			})
		);
		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
			content: expect.stringContaining('Vote for ***Red*** recorded'),
			ephemeral: true
		}));

		interaction.replied = false;
		collection.findOne.mockResolvedValue({
			...basePoll,
			results: [
				{ option: 'Red', users: ['voter-1'] },
				{ option: 'Blue', users: [] }
			]
		});

		await handlePollOptionSelect(bot as any, interaction as any);
		expect(collection.findOneAndReplace).toHaveBeenLastCalledWith(
			{ message: 'message-1' },
			expect.objectContaining({
				results: [
					{ option: 'Red', users: [] },
					{ option: 'Blue', users: [] }
				]
			})
		);
		expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
			content: 'Vote for Red removed.',
			ephemeral: true
		}));
	});
});
