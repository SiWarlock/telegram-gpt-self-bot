import dotenv from 'dotenv';
dotenv.config();

function parseEnvValue(value: string | undefined): string {
    if (!value) return '';
    // Remove surrounding quotes if they exist
    return value.replace(/^["'](.+)["']$/, '$1');
}

function parseEnvNumber(value: string | undefined): number {
    const parsed = parseInt(parseEnvValue(value) || '0');
    return isNaN(parsed) ? 0 : parsed;
}

function parseEnvBoolean(value: string | undefined): boolean {
    const parsed = parseEnvValue(value);
    return parsed.toLowerCase() === 'true';
}

export const config = {
    telegram: {
        apiId: parseEnvNumber(process.env.API_ID),
        apiHash: parseEnvValue(process.env.API_HASH),
        sessionString: parseEnvValue(process.env.SESSION_STRING),
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
        maxRetries: parseEnvNumber(process.env.MAX_RETRIES) || 3,
        maxConversationLength: 10,
    },
}; 