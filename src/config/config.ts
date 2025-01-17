import dotenv from 'dotenv';
import { COMMANDS, BOT_CONFIG } from './constants';
dotenv.config();

function parseEnvValue(value: string | undefined): string {
    if (!value) return '';
    return value.replace(/^["'](.+)["']$/, '$1');
}

function parseEnvBoolean(value: string | undefined): boolean {
    const parsed = parseEnvValue(value);
    return parsed.toLowerCase() === 'true';
}

function parseEnvNumber(value: string | undefined): number {
    const parsed = parseInt(parseEnvValue(value) || '0');
    return isNaN(parsed) ? 0 : parsed;
}

export const config = {
    telegram: {
        apiId: parseEnvNumber(process.env.API_ID),
        apiHash: parseEnvValue(process.env.API_HASH),
        sessionString: parseEnvValue(process.env.SESSION_STRING),
        botToken: parseEnvValue(process.env.TELEGRAM_BOT_TOKEN),
        ownerId: parseEnvValue(process.env.TELEGRAM_OWNER_ID),
    },
    discord: {
        token: parseEnvValue(process.env.DISCORD_TOKEN),
    },
    openai: {
        apiKey: parseEnvValue(process.env.OPENAI_API_KEY),
    },
    bot: {
        triggerPrefix: COMMANDS.GPT,
        selfDestructPrefix: COMMANDS.SELF_DESTRUCT,
        tldrPrefix: COMMANDS.TLDR,
        gamePrefix: COMMANDS.GAME,
        enableMarkdown: BOT_CONFIG.ENABLE_MARKDOWN,
        showTimestamps: BOT_CONFIG.SHOW_TIMESTAMPS,
        maxConversationLength: BOT_CONFIG.MAX_CONVERSATION_LENGTH,
    },
}; 