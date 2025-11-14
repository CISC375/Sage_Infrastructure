/**
 * Tests for src/commands/feedback.ts
 * - Mocks @root/config and channel send path
 */
import type { Attachment, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import FeedbackCmd from '../../../commands/info/feedback';

jest.mock('@root/config', () => ({
	BOT: { NAME: 'Sage' },
	CHANNELS: { FEEDBACK: '123' },
	MAINTAINERS: 'the admins',
	ROLES: { VERIFIED: 'role-verified' } // <-- add
}));


type MinimalOptions = {
	getString: (name: string) => string | null;
	getAttachment: (name: string) => Attachment | null;
};

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'reply'> & {
	options: MinimalOptions;
	guild: { channels: { fetch: (id: string) => Promise<TextChannel> } };
	user: { tag: string; avatarURL: () => string | null };
};

const makeInteraction = (withFile: boolean) => {
	const send = jest.fn();
	const fetch = jest.fn().mockResolvedValue({ send } as unknown as TextChannel);

	const getString = jest.fn().mockReturnValue('great bot!');
	const getAttachment = jest.fn<Attachment | null, [string]>().mockReturnValue(withFile ? ({ url: 'https://cdn.example.com/screenshot.png' } as unknown as Attachment) : null);

	const interaction: MinimalInteraction = {
		options: { getString, getAttachment },
		guild: { channels: { fetch } },
		user: { tag: 'Ronald#0001', avatarURL: () => 'https://cdn.example.com/ava.png' },
		reply: jest.fn()
	};

	return { interaction, send, fetch };
};

describe('feedback command', () => {
	test('sends feedback without attachment', async () => {
		const { interaction, send, fetch } = makeInteraction(false);
		const cmd = new (FeedbackCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();

		await cmd.run(interaction);

		expect(fetch).toHaveBeenCalledWith('123');
		expect(send).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'Thanks! I\'ve sent your feedback to the admins.',
			ephemeral: true
		});
	});

	test('sends feedback with attachment', async () => {
		const { interaction, send } = makeInteraction(true);
		const cmd = new (FeedbackCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();

		await cmd.run(interaction);

		expect(send).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
		expect(interaction.reply).toHaveBeenCalledTimes(1);
	});
});
