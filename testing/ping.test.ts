/**
 * Tests for src/commands/ping.ts
 * - Mocks pretty-ms and checks reply + editReply
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import PingCmd from '../src/commands/info/ping';

jest.mock('pretty-ms', () => jest.fn(() => '5 ms'));
import prettyMilliseconds from 'pretty-ms';

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'reply' | 'editReply' | 'createdTimestamp' | 'client'>;

describe('ping command', () => {
	test('replies Ping? then edits with pong & timings', async () => {
		const reply = jest.fn().mockResolvedValue(undefined);
		const editReply = jest.fn().mockResolvedValue(undefined);

		const interaction = {
			reply,
			editReply,
			createdTimestamp: Date.now() - 5,
			client: { ws: { ping: 42 } }
		} as unknown as MinimalInteraction;

		const cmd = new (PingCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction);

		expect(reply).toHaveBeenCalledWith('Ping?');
		expect(prettyMilliseconds).toHaveBeenCalled();
		expect(editReply).toHaveBeenCalledWith(expect.stringContaining('REST ping 42ms'));
	});
});
