export const COMMANDS = {
    GPT: '!gpt',
    SELF_DESTRUCT: '!sd',
    TLDR: '!tldr',
    GAME: '!game'
} as const;

export const BOT_CONFIG = {
    ENABLE_MARKDOWN: true,
    SHOW_TIMESTAMPS: true,
    MAX_RETRIES: 3,
    MAX_CONVERSATION_LENGTH: 10
} as const; 