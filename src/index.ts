import express from 'express';
import { TelegramService } from './services/telegram/telegram.service';
import { DiscordService } from './services/discord/discord.service';

const app = express();
const port = process.env.PORT || 3000;

const telegramService = new TelegramService();
const discordService = new DiscordService();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.get('/health', (req, res) => {
    res.send('OK');
});

async function start() {
    try {
        await Promise.all([
            telegramService.start(),
            discordService.start()
        ]);
        console.log('All services started successfully');
    } catch (error) {
        console.error('Failed to start services:', error);
        process.exit(1);
    }
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    start();
});