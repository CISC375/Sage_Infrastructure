import { ApplicationCommandOptionData, ApplicationCommandOptionType, ApplicationCommandPermissions, ChatInputCommandInteraction, InteractionResponse, ActivityType, MessageFlags } from 'discord.js';
import { BOT, DB } from '@root/config';
import { BOTMASTER_PERMS } from '@lib/permissions';
import { Command } from '@lib/types/Command';

const ACTIVITIES = ['Playing', 'Streaming', 'Listening', 'Watching', 'Competing'];

export default class extends Command {

	description = `Sets ${BOT.NAME}'s activity to the given status and content`;
	permissions: ApplicationCommandPermissions[] = BOTMASTER_PERMS;

	options: ApplicationCommandOptionData[] = [
		{
			name: 'status',
			description: 'The activity status.',
			type: ApplicationCommandOptionType.String,
			required: true,
			choices: ACTIVITIES.map((activity) => ({
				name: activity,
				value: activity
			}))
		},
		{
			name: 'content',
			description: 'The activity itself (ex: /help).',
			type: ApplicationCommandOptionType.String,
			required: true
		}
	]

	async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
		const bot = interaction.client;
		const content = interaction.options.getString('content');
		const statusStr = interaction.options.getString('status');

		const typeMap: Record<string, ActivityType> = {
			Playing: ActivityType.Playing,
			Streaming: ActivityType.Streaming,
			Listening: ActivityType.Listening,
			Watching: ActivityType.Watching,
			Competing: ActivityType.Competing
		};
		const type = typeMap[statusStr] ?? ActivityType.Playing;

		bot.user.setActivity(content, { type });
		// update DB so it persists after restart
		bot.mongo.collection(DB.CLIENT_DATA).updateOne(
			{ _id: bot.user.id },
			{ $set: { status: { type, content } } },
			{ upsert: true });

		return interaction.reply({ content: `Set ${BOT.NAME}'s activity to *${statusStr} ${content}*`, flags: MessageFlags.Ephemeral });
	}

}
