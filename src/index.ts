import express from 'express';
import { TelegramService } from './services/telegram/telegram.service';
import { DiscordService } from './services/discord/discord.service';
import { TelegramBotService } from './services/telegram/telegram-bot.service';
import { config } from './config/config';

const app = express();
const port = process.env.PORT || 3000;

async function startServices() {
    let servicesStarted = 0;
    const services: Promise<void>[] = [];

    // Check Telegram credentials
    if (config.telegram.apiId && config.telegram.apiHash && config.telegram.sessionString) {
        console.log('Starting Telegram service...');
        const telegramService = new TelegramService();
        services.push(telegramService.start());
        servicesStarted++;
    } else {
        console.log('Skipping Telegram service - missing credentials');
    }

    // Check Telegram Bot Token
    if (config.telegram.botToken) {
        console.log('Starting Telegram bot service...');
        const telegramBotService = new TelegramBotService();
        services.push(telegramBotService.start());
        servicesStarted++;
    } else {
        console.log('Skipping Telegram bot service - missing bot token');
    }

    // Check Discord token
    if (config.discord.token) {
        console.log('Starting Discord service...');
        const discordService = new DiscordService();
        services.push(discordService.start());
        servicesStarted++;
    } else {
        console.log('Skipping Discord service - missing token');
    }

    if (servicesStarted === 0) {
        console.error('No services could be started - missing all credentials');
        process.exit(1);
    }

    try {
        await Promise.all(services);
        console.log(`Successfully started ${servicesStarted} service(s)`);
    } catch (error) {
        console.error('Error starting services:', error);
        process.exit(1);
    }
}

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.get('/health', (req, res) => {
    res.send('OK');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    startServices();
});