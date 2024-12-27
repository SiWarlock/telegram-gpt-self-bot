import dotenv from 'dotenv';
dotenv.config();

export const config = {
    telegram: {
        apiId: Number(process.env.API_ID),
        apiHash: process.env.API_HASH as string,
        sessionString: process.env.SESSION_STRING as string,
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY as string,
    },
    bot: {
        triggerPrefix: process.env.TRIGGER_PREFIX || '!gpt',
        selfDestructPrefix: process.env.SELF_DESTRUCT_PREFIX || '!sd',
        tldrPrefix: '!tldr',
        enableMarkdown: process.env.ENABLE_MARKDOWN === 'true',
        showTimestamps: process.env.SHOW_TIMESTAMPS === 'true',
        maxRetries: Number(process.env.MAX_RETRIES) || 3,
        maxConversationLength: 10, // Keep last 10 messages in conversation
    },
}; 