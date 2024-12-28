import express from 'express';
import { TelegramService } from './services/telegram.service';

const app = express();
const port = process.env.PORT || 3000;

const telegramService = new TelegramService();

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.get('/health', (req, res) => {
    res.send('OK');
});

async function start() {
    try {
        await telegramService.start();
        console.log('Bot is running...');
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    start();
});