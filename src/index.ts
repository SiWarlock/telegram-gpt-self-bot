import { TelegramService } from './services/telegram.service';

async function main() {
    try {
        const telegramService = new TelegramService();
        await telegramService.start();
        console.log('Bot is running...');
    } catch (error) {
        console.error('Error starting the bot:', error);
        process.exit(1);
    }
}

main(); 