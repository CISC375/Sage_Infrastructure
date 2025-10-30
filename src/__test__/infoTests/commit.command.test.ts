/**
 * Tests for src/commands/commit.ts
 * - run(): mock getGitInfo() to avoid calling git
 * - getGitInfo(): mock child_process.execSync and ensure "Version bump" is skipped
 */
import type { ChatInputCommandInteraction } from 'discord.js';
import CommitCmd from '../../commands/info/commit';

jest.mock('@root/config', () => ({
	ROLES: { VERIFIED: 'role-verified' }
}), { virtual: true });

jest.mock('@root/package.json', () => ({ homepage: 'https://github.com/org/repo' }), { virtual: true });

jest.mock('child_process', () => ({ execSync: jest.fn() }));
import { execSync } from 'child_process';

type CommitInstance = {
	getGitInfo: (commitNumber?: number) => string[];
	run: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
};

const asCommit = (Cls: unknown) =>
	(Cls as unknown as { new (): CommitInstance });

describe('commit command', () => {
	test('run() replies with an embed using mocked git info', async () => {
		const Cmd = asCommit(CommitCmd);
		const cmd = new Cmd();

		const spy = jest.spyOn(cmd, 'getGitInfo').mockReturnValue([
			'abc1234567890', // hash
			'Add ping command', // subject line used as title
			'2025-10-01T12:00:00Z', // timestamp
			'main' // branch
		]);

		const reply = jest.fn();
		const interaction = { reply } as unknown as ChatInputCommandInteraction;

		await cmd.run(interaction);
		expect(reply).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });

		spy.mockRestore();
	});

	test('getGitInfo() skips version bump commits', () => {
		const first = `${[
			'hash1',
			'Author One',
			'Version bump: 3.2.1',
			'2025-10-01 10:00:00 -0400',
			'main'
		].join('\n')}\n`;

		const second = `${[
			'hash2',
			'Author Two',
			'Real feature commit',
			'2025-10-01 11:00:00 -0400',
			'main'
		].join('\n')}\n`;

		(execSync as unknown as jest.Mock).mockReturnValueOnce(first).mockReturnValueOnce(second); // commitNumber = 1

		const Cmd = asCommit(CommitCmd);
		const cmd = new Cmd();

		const info = cmd.getGitInfo();
		expect(info[0]).toBe('hash2');
		expect(info[2]).toBe('Real feature commit');
	});
});
