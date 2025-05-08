import AnnounceCommand from '../../src/commands/admin/announce';
import { CHANNELS } from '../../config';
import { BOTMASTER_PERMS } from '../lib/permissions';

import {
	TextChannel,
	ModalBuilder,
	ActionRowBuilder,
	TextInputStyle,
	TextInputBuilder
} from 'discord.js';

const mockShowModal = jest.fn();

const createMockInteraction = ({
	channelId = '123456',
	channelFromOption = true,
	fileProvided = true,
	fallbackChannel = true
} = {}) => {
	const file = fileProvided ? { url: 'https://example.com/file.png' } : null;

	const mockTextChannel = {
		id: channelId,
		type: 0 // TextChannel type
	} as unknown as TextChannel;

	const guild = {
		channels: {
			cache: {
				get: jest.fn((id: string) => fallbackChannel ? mockTextChannel : undefined)
			}
		}
	};

	return {
		guild,
		options: {
			getChannel: jest.fn().mockReturnValue(channelFromOption ? mockTextChannel : null),
			getAttachment: jest.fn().mockReturnValue(file)
		},
		showModal: mockShowModal
	};
};

describe('AnnounceCommand', () => {
	let command: AnnounceCommand;

	beforeEach(() => {
		command = new AnnounceCommand();
		mockShowModal.mockClear();
	});

	it('should show modal using provided channel and file', async () => {
		const interaction = createMockInteraction();
		await command.run(interaction as any);

		expect(interaction.showModal).toHaveBeenCalled();
		const modalArg = mockShowModal.mock.calls[0][0];

		const components = modalArg.components.flatMap((row: ActionRowBuilder<TextInputBuilder>) => row.components);
		const channelInput = components.find((c: TextInputBuilder) => c.data.custom_id === 'channel');
		const fileInput = components.find((c: TextInputBuilder) => c.data.custom_id === 'file');

		expect(channelInput.data.value).toBe('123456');
		expect(fileInput.data.value).toBe('https://example.com/file.png');
	});

	it('should fall back to announcement channel if no option is given', async () => {
		const interaction = createMockInteraction({ channelFromOption: false });
		await command.run(interaction as any);

		expect(interaction.options.getChannel).toHaveBeenCalledWith('channel');
		expect(interaction.guild.channels.cache.get).toHaveBeenCalledWith(CHANNELS.ANNOUNCEMENTS);

		const modalArg = mockShowModal.mock.calls[0][0];
		const channelInput = modalArg.components[1].components[0];
		expect(channelInput.data.value).toBe('123456');
	});

	it('should leave file input blank if no file is given', async () => {
		const interaction = createMockInteraction({ fileProvided: false });
		await command.run(interaction as any);

		const modalArg = mockShowModal.mock.calls[0][0];
		const fileInput = modalArg.components[2].components[0];
		expect(fileInput.data.value).toBe('');
	});
});
