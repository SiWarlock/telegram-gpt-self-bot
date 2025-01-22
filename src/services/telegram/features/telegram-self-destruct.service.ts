import type { Api } from 'telegram';
import { config } from '../../../config/config';

export class SelfDestructFeature {
    constructor(private client: any) {}

    async handle(message: any): Promise<void> {
        const messageText = message.text || '';
        const chatId = message.chatId?.toString() || message.peerId?.toString();

        if (!chatId) return;

        const parts = messageText.slice(config.bot.selfDestructPrefix.length).trim().split(' ');
        const seconds = parseInt(parts[0]);
        const text = parts.slice(1).join(' ');

        if (isNaN(seconds) || seconds <= 0 || seconds > 60 || !text) {
            await message.reply({
                message: '❌ Format: !sd <seconds 1-60> <message>',
            });
            return;
        }

        try {
            await message.edit({
                text: this.formatSelfDestructMessage(text, seconds),
            });

            let remainingSeconds = seconds;
            const interval = setInterval(async () => {
                remainingSeconds--;
                
                if (remainingSeconds <= 0) {
                    clearInterval(interval);
                    await this.client.deleteMessages(message.chat, [message.id], { revoke: true });
                } else {
                    try {
                        await message.edit({
                            text: this.formatSelfDestructMessage(text, remainingSeconds),
                        });
                    } catch (error) {
                        clearInterval(interval);
                        console.error('Error updating self-destruct message:', error);
                    }
                }
            }, 1000);

        } catch (error) {
            console.error('Error handling self-destruct message:', error);
        }
    }

    private formatSelfDestructMessage(text: string, seconds: number): string {
        return `${text}\n\n💣 Self-destructing in ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
} 