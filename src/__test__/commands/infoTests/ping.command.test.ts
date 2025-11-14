/**
 * Tests for src/commands/ping.ts
 * - Mocks pretty-ms and checks reply + editReply
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import PingCmd from '../../../commands/info/ping';

jest.mock('pretty-ms', () => jest.fn(() => '5 ms'));
import prettyMilliseconds from 'pretty-ms';

jest.mock('@root/config', () => ({
	ROLES: { VERIFIED: 'role-verified' }
}));

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'reply' | 'editReply' | 'createdTimestamp' | 'client'>;

describe('ping command', () => {
	test('replies Ping? then edits with pong & timings', async () => {
		const interactionTimestamp = Date.now();
		
		const mockMessage = {
			createdTimestamp: interactionTimestamp + 5 // 5ms after interaction
		};
		const reply = jest.fn().mockResolvedValue(mockMessage);
		const editReply = jest.fn().mockResolvedValue(undefined);

		const interaction = {
			reply,
			editReply,
			createdTimestamp: interactionTimestamp,
			client: { ws: { ping: 42 } }
		} as unknown as MinimalInteraction;

		const cmd = new (PingCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<unknown> } })();
		await cmd.run(interaction); 

		expect(reply).toHaveBeenCalledWith('Ping?');
		expect(prettyMilliseconds).toHaveBeenCalled();

		// FIX 3: Update strings to match command output
		const expectedWebSocketPing = 'REST ping 42ms'; // This is from client.ws.ping
		const expectedRoundTripPing = 'Round trip took 5 ms'; // This is from the pretty-ms mock

		// Check that editReply was called ONCE
		expect(editReply).toHaveBeenCalledTimes(1); 
		
		// Check that the single call's argument contains both strings
		expect(editReply).toHaveBeenCalledWith(
			expect.stringContaining(expectedWebSocketPing)
		);
		expect(editReply).toHaveBeenCalledWith(
			expect.stringContaining(expectedRoundTripPing)
		);
	});
});
