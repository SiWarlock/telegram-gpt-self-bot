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
        apiId: parseInt(parseEnvValue(process.env.API_ID)),
        apiHash: parseEnvValue(process.env.API_HASH),
        sessionString: parseEnvValue(process.env.SESSION_STRING),
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        ownerId: process.env.TELEGRAM_OWNER_ID
    },
    discord: {
        token: process.env.DISCORD_TOKEN
    },
    openai: {
        apiKey: parseEnvValue(process.env.OPENAI_API_KEY)
    },
    bot: {
        triggerPrefix: '!gpt',
        selfDestructPrefix: '!sd',
        tldrPrefix: '!tldr',
        gamePrefix: '!game',
        enableMarkdown: true,
        maxConversationLength: 10
    }
}; 