/**
 * Tests for src/commands/info.ts
 * - Simple verification of reply content including BOT.NAME and MAINTAINERS.
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import InfoCmd from '../../../commands/info/info';

jest.mock('@root/config', () => ({
	BOT: { NAME: 'Sage' },
	MAINTAINERS: 'the admins',
	ROLES: { VERIFIED: 'mock-verified-role-id' }
}));

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'reply'>;

describe('info command', () => {
	test('replies with info text', async () => {
		const reply = jest.fn();
		const interaction = { reply } as unknown as MinimalInteraction;

		const cmd = new (InfoCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(reply).toHaveBeenCalledTimes(1);
		const sent = reply.mock.calls[0][0] as string;
		expect(sent).toContain('Sage');
		expect(sent).toContain('the admins');
	});
});
