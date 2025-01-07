import { Client, Message } from 'discord.js-selfbot-v13';
import { config } from '../../../config/config';

export class DiscordSelfDestructFeature {
    constructor(private client: Client) {}

    async handle(message: Message): Promise<void> {
        const parts = message.content.slice(config.bot.selfDestructPrefix.length).trim().split(' ');
        const seconds = parseInt(parts[0]);
        const text = parts.slice(1).join(' ');

        if (isNaN(seconds) || seconds <= 0 || seconds > 60 || !text) {
            await message.reply('❌ Format: !sd <seconds 1-60> <message>');
            return;
        }

        try {
            const sentMessage = await message.channel.send(this.formatSelfDestructMessage(text, seconds));
            let remainingSeconds = seconds;

            const interval = setInterval(async () => {
                remainingSeconds--;
                
                if (remainingSeconds <= 0) {
                    clearInterval(interval);
                    await sentMessage.delete();
                } else {
                    try {
                        await sentMessage.edit(this.formatSelfDestructMessage(text, remainingSeconds));
                    } catch (error) {
                        clearInterval(interval);
                        console.error('Error updating self-destruct message:', error);
                    }
                }
            }, 1000);

            // Delete the command message
            await message.delete();

        } catch (error) {
            console.error('Error handling self-destruct message:', error);
        }
    }

    private formatSelfDestructMessage(text: string, seconds: number): string {
        return `${text}\n\n💣 Self-destructing in ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
} 