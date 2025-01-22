# Telegram & Discord Self-Bot

A powerful self-bot with GPT integration, self-destructing messages, chat summarization features, and role-based access control. Can be used with Telegram, Discord, or both simultaneously.

## Features

### Flexible Setup
- Use with Telegram only
- Use with Discord only
- Or use both simultaneously
- Bot automatically detects available credentials and starts appropriate services

### Self-Bot vs Companion Bot

#### Discord
1. **Self-Bot Mode** (Using User Token):
   - Uses your personal Discord account
   - Can access all your chats and servers
   - Can read message history
   - Can use custom emojis from your servers
   - More natural interaction as it appears as you
   - Note: Against Discord's Terms of Service

2. **Companion Bot Mode** (Using Bot Token):
   - Separate bot account with [BOT] tag
   - Must be invited to servers
   - Limited to servers where it's been added
   - Cannot access message history before joining
   - Cannot use custom emojis unless added to source server
   - More official but limited functionality

#### Telegram
1. **Self-Bot Mode** (Using User Session):
   - Uses your personal Telegram account
   - Full access to all your chats
   - Can read entire message history
   - Can join private groups
   - Can use any sticker or emoji
   - Appears as normal user activity

2. **Companion Bot Mode** (Using Bot Token):
   - Separate bot account with bot badge
   - Must be added to groups
   - Cannot see messages between users
   - Cannot join channels/groups on its own
   - Limited to bot API capabilities
   - More restrictive but officially supported

Choose the mode that best fits your needs and compliance requirements. This implementation supports both modes for maximum flexibility.

### Role-Based Access Control (RBAC)
- Default roles with predefined permissions:
  - **Admin**: Full access to all features and management commands
  - **Moderator**: Access to GPT, TLDR, games, and game management
  - **User**: Basic access to GPT, TLDR, and games

- Permission Management Commands (Owner Only):
  - `!roles` - List all available roles
  - `!grant @user permission` - Grant specific permission
  - `!revoke @user permission` - Revoke specific permission
  - `!role @user rolename` - Assign role to user
  - `!perms @user` - Check user's permissions

- Available Permissions:
  - `use_bot` - Basic bot access
  - `use_gpt` - Access to GPT commands
  - `use_tldr` - Access to TLDR commands
  - `use_games` - Access to game commands
  - `manage_games` - Game management
  - `manage_users` - User management
  - `manage_roles` - Role management

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

4. **Games** (`!game`)
   - Tic Tac Toe:
     - `!game ttt @player` - Start a game
     - `!game play 1-9` - Make a move
     - Board positions: 1 (top-left) to 9 (bottom-right)

   - Connect Four:
     - `!game c4 @player` - Start a game
     - `!game play 1-7` - Drop piece in column
     - Get 4 in a row to win (horizontal, vertical, diagonal)

   Features:
     - Visual game boards with emojis
     - Turn tracking
     - Win/draw detection
     - Game instructions on start
     - 5-minute inactivity timeout

## Setup

1. Prerequisites
   - Node.js 16+
   - npm/yarn
   - PostgreSQL database
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
   ```

3. Database Setup
   ```bash
   # Add your PostgreSQL connection URL to .env:
   DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

   # Run database migrations
   npx prisma migrate dev

   # Generate Prisma client
   npx prisma generate
   ```

4. Start the Bot
   ```bash
   npm run start
   ```

## Environment Variables

Create a `.env` file with your credentials:

### Required for All
```env
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=your_postgresql_connection_url
```

### Required for Telegram (Optional)
```env
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash
SESSION_STRING=your_telegram_session_string
TELEGRAM_OWNER_ID=your_telegram_user_id
```

### Required for Discord (Optional)
```env
DISCORD_TOKEN=your_discord_token
DISCORD_OWNER_ID=your_discord_user_id
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
   - Add your API_ID and API_HASH to .env file
   - Run the session generator:
     ```bash
     npm run get-session
     ```
   - Enter your phone number when prompted
   - Enter the verification code you receive
   - Enter your 2FA password if enabled
   - Copy the generated session string to your .env file
   - Note: You only need to do this once, the session string remains valid until you log out

3. Get your Telegram User ID:
   - Message @userinfobot on Telegram
   - Copy your ID to TELEGRAM_OWNER_ID in .env

4. Final .env setup for Telegram:
   ```env
   API_ID=your_api_id
   API_HASH=your_api_hash
   SESSION_STRING=your_generated_session_string
   TELEGRAM_OWNER_ID=your_telegram_user_id
   ```

### Discord Token and ID
1. Get your Discord token:
   - Open Discord in browser
   - Press F12 for Developer Tools
   - In the network tab, find a request to the Discord API https://discord.com/api/
   - Look for the Authorization header in the request headers
   - Copy the token from the Authorization header to .env file

2. Get your Discord User ID:
   - Enable Developer Mode in Discord (Settings > App Settings > Advanced)
   - Right-click your name and select "Copy ID"
   - Add to DISCORD_OWNER_ID in .env

## Security Notes

- Keep your .env file secure and never commit it
- Never share your SESSION_STRING or DISCORD_TOKEN - they provide full account access
- This is a self-bot (uses your accounts), use responsibly
- Follow platform terms of service
- Be careful with self-destructing messages in important chats
- If your Discord token is exposed, change your password immediately
- Regularly review user permissions and roles

## Deployment

The bot can be deployed on platforms like Railway:
1. Connect your GitHub repository
2. Add environment variables
3. Deploy the main branch
4. Ensure sufficient resources (512MB+ RAM recommended)
5. Set up PostgreSQL database add-on

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT License - See LICENSE file for details 

## 🗺️ Roadmap

### 🔐 Access Control & Privacy
- [x] Role-Based Access Control (RBAC) mechanism
- [x] Private management bot integration for both Telegram & Discord
- [ ] Silent mode (`-s` flag) to redirect outputs to private bot chat

### 🤖 Enhanced Chat Features
- [ ] Reminder System (`!remindme`)
  - Custom time/date scheduling
  - Recurring reminders
  - Priority levels
  - Categories/tags

- [ ] Memory Management (`!remember`)
  - List management with add/remove operations
  - Categorization and tagging
  - Search functionality
  - Export/import capabilities

### 📊 Advanced Summarization
- [ ] Enhanced TLDR functionality
  - Multiple verbosity levels
  - Topic-based filtering
  - Custom focus areas
  - Thread/conversation isolation

### 📈 Smart Reporting
- [ ] Engagement Analysis
  - Contact interaction summaries
  - Conversation topic tracking
  - Action item extraction
  - Follow-up recommendations

- [ ] Message Management
  - Missed message categorization
  - Importance-based prioritization
  - Smart response reminders
  - Context preservation

- [ ] Task Aggregation
  - Consolidated view of reminders
  - List status reports
  - Priority-based task organization
  - Deadline tracking

### 🔄 Integration & Automation
- [ ] Cross-platform synchronization
- [ ] Automated report generation
- [ ] Custom workflow creation
- [ ] Data export and backup
