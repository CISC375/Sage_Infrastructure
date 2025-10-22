/* eslint-disable eqeqeq */
import { ChatInputCommandInteraction, InteractionResponse } from 'discord.js';
import { Command } from '@lib/types/Command';

const COIN_FLIP = ['You got: Heads!', 'You got: Tails!'];

export default class extends Command {
    description = 'Have Sage flip a coin for you!';

    async run(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean> | void> {
        await interaction.reply('Flipping...');
        const result = COIN_FLIP[Math.floor(Math.random() * COIN_FLIP.length)];

        setTimeout(() => {
            let fileAttachment;
            if (result == COIN_FLIP[0]) {
                fileAttachment = {
                    attachment: `${__dirname}../../../../../assets/images/steve_heads.png`,
                    name: `steve_heads.png`
                };
            } else {
                fileAttachment = {
                    attachment: `${__dirname}../../../../../assets/images/steve_tails.png`,
                    name: `steve_tails.png`
                };
            }
            
            return interaction.editReply({ content: result, files: [fileAttachment] });
        }, 3000);
    }

}