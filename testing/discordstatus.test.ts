/**
 * Tests for src/commands/discordstatus.ts
 * - Mocks node-fetch and ensures defer + editReply with an embed
 */
/* eslint-disable camelcase */
import type { ChatInputCommandInteraction } from 'discord.js';
import DiscordStatusCmd from '../src/commands/info/discordstatus';

jest.mock('node-fetch', () => jest.fn());
import fetch from 'node-fetch';

const mockFetch = fetch as unknown as jest.Mock;

type MinimalInteraction = Pick<ChatInputCommandInteraction, 'deferReply' | 'editReply'>;

describe('discordstatus command', () => {
	afterEach(() => jest.clearAllMocks());

	test('all components operational -> friendly field', async () => {
		const payload = {
			page: { url: 'https://status.discord.com', updated_at: '2025-10-01T12:00:00Z' },
			status: { description: 'All Systems Operational', indicator: 'none' },
			components: [
				{ id: '1', name: 'API', status: 'operational', created_at: '', page_id: '', position: 1, updated_at: '', only_show_if_degraded: false }
			],
			incidents: [],
			scheduled_maintenances: []
		};
		mockFetch.mockResolvedValue({ json: async () => payload });

		const interaction: MinimalInteraction = {
			deferReply: jest.fn(),
			editReply: jest.fn()
		} as unknown as MinimalInteraction;

		const cmd = new (DiscordStatusCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<void> } })();
		await cmd.run(interaction);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
	});

	test('degraded component + maintenance -> multiple fields', async () => {
		const payload = {
			page: { url: 'https://status.discord.com', updated_at: '2025-10-01T12:00:00Z' },
			status: { description: 'Partial System Outage', indicator: 'minor' },
			components: [
				{ id: '1', name: 'API', status: 'degraded_performance', created_at: '', page_id: '', position: 1, updated_at: '', only_show_if_degraded: false },
				{ id: '2', name: 'Media Proxy', status: 'operational', created_at: '', page_id: '', position: 2, updated_at: '', only_show_if_degraded: false }
			],
			incidents: [{ created_at: '', id: 'inc1', impact: 'minor', name: 'API latency', page_id: '', shortlink: '', status: 'investigating', updated_at: '' }],
			scheduled_maintenances:
			[{ id: 'm1', name: 'DB Upgrade', impact: 'minor', created_at: '', page_id: '', scheduled_for: '', scheduled_until: '', shortlink: '', status: '', updated_at: '', incident_updates: [] }]
		};
		mockFetch.mockResolvedValue({ json: async () => payload });

		const interaction: MinimalInteraction = {
			deferReply: jest.fn(),
			editReply: jest.fn()
		} as unknown as MinimalInteraction;

		const cmd = new (DiscordStatusCmd as unknown as { new (): { run(i: MinimalInteraction): Promise<void> } })();
		await cmd.run(interaction);

		expect(interaction.deferReply).toHaveBeenCalledTimes(1);
		expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [expect.any(Object)] });
	});
});
