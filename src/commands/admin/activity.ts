import { ApplicationCommandOptionData, ApplicationCommandOptionType, ApplicationCommandPermissions, ChatInputCommandInteraction, InteractionResponse, ActivityType } from 'discord.js';
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
		
		// FIX 1: Get 'content', not 'category'
		const content = interaction.options.getString('content');

		// FIX 2: Get the string value for the reply, and the enum value for the API
		const statusString = interaction.options.getString('status');
		const typeEnum = ActivityType[statusString as keyof typeof ActivityType];

		// setting Sage's activity status in the guild
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore - TypeScript still complains but this is correct for discord.js v13/v14
		// FIX 3: Use the numeric enum value (e.g., 3) for setActivity
		bot.user.setActivity(content, { type: typeEnum });

		//	updating Sage's activity status in the database (so that it stays upon a restart)
		await bot.mongo.collection(DB.CLIENT_DATA).updateOne(
			{ _id: bot.user.id },
			// FIX 4: Use the numeric enum value (e.g., 3) for the database
			{ $set: { status: { type: typeEnum, content } } },
			{ upsert: true });

		// FIX 5: Use the original string (e.g., "Watching") for the reply
		interaction.reply({ content: `Set ${BOT.NAME}'s activity to *${statusString} ${content}*`, ephemeral: true });
	}

}