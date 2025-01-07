# Telegram & Discord Self-Bot

A powerful self-bot with GPT integration, self-destructing messages, and chat summarization features. Can be used with Telegram, Discord, or both simultaneously.

## Features

### Flexible Setup
- Use with Telegram only
- Use with Discord only
- Or use both simultaneously
- Bot automatically detects available credentials and starts appropriate services

### Available Commands
All commands are consistent across both Telegram and Discord:

1. **GPT Integration** (`!gpt`)
   - `!gpt [question]` - Ask GPT a question
   - `!gpt clear` - Clear conversation history
   - `!gpt help` - Show help menu

2. **Self-Destructing Messages** (`!sd`)
   - `!sd [seconds] [message]` - Send a message that deletes itself
   - Example: `!sd 10 This will delete in 10 seconds`
   - Time limit: 1-60 seconds

3. **Chat Summarization** (`!tldr`)
   - `!tldr [count]` - Summarize last N messages
   - `!tldr [time]` - Summarize messages from time period
   - Examples:
     - `!tldr 50` - Last 50 messages
     - `!tldr 1h` - Last hour
     - `!tldr 30m` - Last 30 minutes
     - `!tldr 1d` - Last day

## Setup

1. Prerequisites
   - Node.js 16+
   - npm/yarn
   - OpenAI API key
   - Telegram API credentials (optional)
   - Discord user token (optional)

2. Installation
   ```bash
   git clone [repository-url]
   cd [repository-name]
   npm install
   cp .env.example .env
   # Edit .env with your credentials
   npm run start
   ```

## Environment Variables

Create a `.env` file with your credentials:

### Required for All
```env
OPENAI_API_KEY=your_openai_api_key
```

### Required for Telegram (Optional)
```env
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash
SESSION_STRING=your_telegram_session_string
```

### Required for Discord (Optional)
```env
DISCORD_TOKEN=your_discord_token
```

## Service Selection

The bot will automatically:
1. Start Telegram service if Telegram credentials are provided
2. Start Discord service if Discord token is provided
3. Start both services if all credentials are available
4. Exit with an error if no valid credentials are found

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
   - In the network tab, find a request to the Discord API https://discord.com/api/
   - Look for the Authorization header in the request headers
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