import dotenv from 'dotenv';
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
    },
    discord: {
        token: parseEnvValue(process.env.DISCORD_TOKEN),
    },
    openai: {
        apiKey: parseEnvValue(process.env.OPENAI_API_KEY),
    },
    bot: {
        triggerPrefix: parseEnvValue(process.env.TRIGGER_PREFIX) || '!gpt',
        selfDestructPrefix: parseEnvValue(process.env.SELF_DESTRUCT_PREFIX) || '!sd',
        tldrPrefix: parseEnvValue(process.env.TLDR_PREFIX) || '!tldr',
        enableMarkdown: parseEnvBoolean(process.env.ENABLE_MARKDOWN),
        showTimestamps: parseEnvBoolean(process.env.SHOW_TIMESTAMPS),
        maxConversationLength: 10,
    },
}; 