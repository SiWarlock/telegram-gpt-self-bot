import dotenv from 'dotenv';

dotenv.config();

function parseEnvValue(value: string | undefined): string {
    if (!value) {
        throw new Error('Missing required environment variable');
    }
    return value;
}

export const config = {
    telegram: {
        apiId: process.env.API_ID ? parseInt(process.env.API_ID) : undefined,
        apiHash: process.env.API_HASH,
        sessionString: process.env.SESSION_STRING,
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        ownerId: process.env.TELEGRAM_OWNER_ID,
        mode: (process.env.TELEGRAM_MODE || 'self') as 'bot' | 'self'
    },
    discord: {
        token: process.env.DISCORD_TOKEN,
        botToken: process.env.DISCORD_BOT_TOKEN,
        ownerId: process.env.DISCORD_OWNER_ID,
        enabled: process.env.ENABLE_DISCORD === 'true'
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY
    },
    xai: {
        apiKey: process.env.XAI_API_KEY,
        model: 'grok-2-latest' // ensuring access to latest agentic & search features
    },
    bot: {
        triggerPrefix: '!gpt',
        grokPrefix: '!grok',
        selfDestructPrefix: '!sd',
        tldrPrefix: '!tldr',
        gamePrefix: '!game',
        enableMarkdown: true,
        maxConversationLength: 10,
        showTimestamps: true
    }
}; 