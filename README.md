# Telegram & Discord Self-Bot

A powerful self-bot with GPT integration, self-destructing messages, and chat summarization features for both Telegram and Discord.

## Features

### 1. GPT Integration
Use GPT-4 directly in your chats with the !gpt command.

Example:
- !gpt What is TypeScript?
- !gpt clear (Clear conversation history)
- !gpt help (Show help menu)

Features:
- Maintains conversation context
- Supports code formatting
- Command history
- Markdown support

### 2. Self-Destructing Messages
Send messages that delete themselves after a specified time using the !sd command.

Example:
- !sd 10 This message will delete in 10 seconds
- !sd 60 One minute until this disappears
- Maximum time: 60 seconds

### 3. Chat Summarization (TLDR)
Summarize chat history with GPT-4 using the !tldr command.

Example:
- !tldr 50 (Summarize last 50 messages)
- !tldr 1h (Summarize last hour)
- !tldr 30m (Summarize last 30 minutes)
- !tldr 1d (Summarize last day)

## Setup

1. Prerequisites
   - Node.js 16+
   - npm/yarn
   - Telegram API credentials
   - Discord user token
   - OpenAI API key

2. Installation
   - Clone the repository
   - Run npm install
   - Configure .env file
   - Start with npm run start

## Environment Variables

Create a .env file with:

### Telegram Configuration
- API_ID: Your Telegram API ID
- API_HASH: Your Telegram API hash
- SESSION_STRING: Your Telegram session string

### Discord Configuration
- DISCORD_TOKEN: Your Discord user token

### OpenAI Configuration
- OPENAI_API_KEY: Your OpenAI API key

### Bot Configuration
- TRIGGER_PREFIX: Command prefix (default: !gpt)
- SELF_DESTRUCT_PREFIX: Self-destruct prefix (default: !sd)
- ENABLE_MARKDOWN: Enable markdown support (true/false)
- SHOW_TIMESTAMPS: Show timestamps in messages (true/false)
- MAX_RETRIES: Maximum retry attempts (default: 3)

## Getting Credentials

### Telegram Credentials
1. Get API_ID and API_HASH:
   - Visit https://my.telegram.org
   - Log in with your phone number
   - Go to 'API Development Tools'
   - Create a new application
   - Copy API_ID and API_HASH

2. Get SESSION_STRING:
   - First run will prompt for phone number
   - Enter verification code
   - Session string will be generated
   - Copy it to .env file

### Discord Token
1. Get your Discord token:
   - Open Discord in browser
   - Press F12 for Developer Tools
   - In Console tab, paste:
     ```javascript
     window.webpackChunkdiscord_app.push([[Math.random()], {}, (req) => {for (const m of Object.keys(req.c).map((x) => req.c[x].exports).filter((x) => x)) {if (m.default && m.default.getToken !== undefined) {console.log(m.default.getToken())}}}]);
     ```
   - Copy the token to .env file

## Security Notes

- Keep your .env file secure and never commit it
- Never share your SESSION_STRING or DISCORD_TOKEN - they provide full account access
- This is a self-bot (uses your accounts), use responsibly
- Follow platform terms of service
- Be careful with self-destructing messages in important chats
- If your Discord token is exposed, change your password immediately

## Deployment

The bot can be deployed on platforms like Railway:
1. Connect your GitHub repository
2. Add environment variables
3. Deploy the main branch
4. Ensure sufficient resources (512MB+ RAM recommended)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License - See LICENSE file for details 