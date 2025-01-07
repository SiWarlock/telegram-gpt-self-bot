import { Client, Message, User } from 'discord.js-selfbot-v13';
import { config } from '../../../config/config';

interface TicTacToeGame {
    board: string[];
    currentPlayer: string;
    player1: string;
    player2: string;
    lastActive: number;
}

interface ConnectFourGame {
    board: string[][];
    currentPlayer: string;
    player1: string;
    player2: string;
    lastActive: number;
}

export class DiscordGameFeature {
    private tttGames: Map<string, TicTacToeGame> = new Map();
    private c4Games: Map<string, ConnectFourGame> = new Map();
    private readonly GAME_TIMEOUT = 5 * 60 * 1000;

    constructor(private client: Client) {
        setInterval(() => this.cleanupOldGames(), 60 * 1000);
    }

    async handle(message: Message): Promise<void> {
        const args = message.content.slice(config.bot.gamePrefix.length).trim().split(' ');
        const command = args[0].toLowerCase();
        const mention = message.mentions.users.first();

        switch (command) {
            case 'ttt':
                await this.handleTicTacToe(message, mention);
                break;
            case 'c4':
                await this.handleConnectFour(message, mention);
                break;
            case 'play':
                if (this.tttGames.has(message.channelId)) {
                    await this.handleTicTacToeMove(message, args[1]);
                } else if (this.c4Games.has(message.channelId)) {
                    await this.handleConnectFourMove(message, args[1]);
                }
                break;
        }
    }

    private async handleTicTacToe(message: Message, mention: User | undefined): Promise<void> {
        if (!mention) {
            await message.reply('❌ Please mention a player to play with: !game ttt @player');
            return;
        }

        if (mention.id === message.author.id) {
            await message.reply('❌ You cannot play against yourself!');
            return;
        }

        const game: TicTacToeGame = {
            board: ['⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜'],
            currentPlayer: message.author.id,
            player1: message.author.id,
            player2: mention.id,
            lastActive: Date.now()
        };

        this.tttGames.set(message.channelId, game);
        await this.displayBoard(message, game);
    }

    private async handleTicTacToeMove(message: Message, position: string): Promise<void> {
        const game = this.tttGames.get(message.channelId);
        if (!game) {
            await message.reply('❌ No active Tic Tac Toe game in this channel. Start one with !game ttt @player');
            return;
        }

        if (game.currentPlayer !== message.author.id) {
            await message.reply('❌ Not your turn!');
            return;
        }

        const pos = parseInt(position) - 1;
        if (pos < 0 || pos > 8 || game.board[pos] !== '⬜') {
            await message.reply('❌ Invalid move! Choose a number 1-9 in an empty space.');
            return;
        }

        game.board[pos] = game.currentPlayer === game.player1 ? '❌' : '⭕';
        game.currentPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        game.lastActive = Date.now();

        const winner = this.checkWinner(game.board);
        if (winner) {
            await this.displayBoard(message, game);
            await message.channel.send(`🎉 ${winner === '❌' ? `<@${game.player1}>` : `<@${game.player2}>`} wins!`);
            this.tttGames.delete(message.channelId);
            return;
        }

        if (!game.board.includes('⬜')) {
            await this.displayBoard(message, game);
            await message.channel.send("🤝 It's a draw!");
            this.tttGames.delete(message.channelId);
            return;
        }

        await this.displayBoard(message, game);
    }

    private async displayBoard(message: Message, game: TicTacToeGame): Promise<void> {
        const board = this.formatBoard(game);
        const isNewGame = game.board.every(cell => cell === '⬜');
        
        let content = `${board}\n\n`;
        
        if (isNewGame) {
            content += `🎮 **Tic Tac Toe**\n`;
            content += `Player 1 (❌): <@${game.player1}>\n`;
            content += `Player 2 (⭕): <@${game.player2}>\n\n`;
            content += `**How to Play:**\n`;
            content += `• Use \`!game play 1-9\` to place your mark\n`;
            content += `• Numbers correspond to positions:\n`;
            content += `1️⃣2️⃣3️⃣\n4️⃣5️⃣6️⃣\n7️⃣8️⃣9️⃣\n\n`;
        }
        
        content += `Current turn: <@${game.currentPlayer}>\n`;
        content += `Use \`!game play 1-9\` to make a move!`;

        await message.channel.send({ content });
    }

    private formatBoard(game: TicTacToeGame): string {
        let board = '';
        for (let i = 0; i < 9; i += 3) {
            board += game.board.slice(i, i + 3).join('') + '\n';
        }
        return board;
    }

    private checkWinner(board: string[]): string | null {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (const [a, b, c] of lines) {
            if (board[a] !== '⬜' && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }
        return null;
    }

    private cleanupOldGames(): void {
        const now = Date.now();
        for (const [channelId, game] of this.tttGames.entries()) {
            if (now - game.lastActive > this.GAME_TIMEOUT) {
                this.tttGames.delete(channelId);
            }
        }
        for (const [channelId, game] of this.c4Games.entries()) {
            if (now - game.lastActive > this.GAME_TIMEOUT) {
                this.c4Games.delete(channelId);
            }
        }
    }

    private async handleConnectFour(message: Message, mention: User | undefined): Promise<void> {
        if (!mention) {
            await message.reply('❌ Please mention a player to play with: !game c4 @player');
            return;
        }

        if (mention.id === message.author.id) {
            await message.reply('❌ You cannot play against yourself!');
            return;
        }

        const game: ConnectFourGame = {
            board: Array(6).fill(null).map(() => Array(7).fill('⚪')),
            currentPlayer: message.author.id,
            player1: message.author.id,
            player2: mention.id,
            lastActive: Date.now()
        };

        this.c4Games.set(message.channelId, game);
        await this.displayC4Board(message, game);
    }

    private async handleConnectFourMove(message: Message, column: string): Promise<void> {
        const game = this.c4Games.get(message.channelId);
        if (!game) {
            await message.reply('❌ No active Connect Four game in this channel. Start one with !game c4 @player');
            return;
        }

        if (game.currentPlayer !== message.author.id) {
            await message.reply('❌ Not your turn!');
            return;
        }

        const col = parseInt(column) - 1;
        if (col < 0 || col > 6 || !this.isValidMove(game.board, col)) {
            await message.reply('❌ Invalid move! Choose a column 1-7 that isn\'t full.');
            return;
        }

        const row = this.getLowestEmptyRow(game.board, col);
        game.board[row][col] = game.currentPlayer === game.player1 ? '🔴' : '🔵';
        game.currentPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        game.lastActive = Date.now();

        const winner = this.checkC4Winner(game.board);
        if (winner) {
            await this.displayC4Board(message, game);
            await message.channel.send(`🎉 ${winner === '🔴' ? `<@${game.player1}>` : `<@${game.player2}>`} wins!`);
            this.c4Games.delete(message.channelId);
            return;
        }

        if (this.isBoardFull(game.board)) {
            await this.displayC4Board(message, game);
            await message.channel.send("🤝 It's a draw!");
            this.c4Games.delete(message.channelId);
            return;
        }

        await this.displayC4Board(message, game);
    }

    private async displayC4Board(message: Message, game: ConnectFourGame): Promise<void> {
        const isNewGame = game.board.every(row => row.every(cell => cell === '⚪'));
        let content = this.formatC4Board(game);
        
        if (isNewGame) {
            content += `\n🎮 **Connect Four**\n`;
            content += `Player 1 (🔴): <@${game.player1}>\n`;
            content += `Player 2 (🔵): <@${game.player2}>\n\n`;
            content += `**How to Play:**\n`;
            content += `• Use \`!game play 1-7\` to drop your piece\n`;
            content += `• Columns are numbered left to right:\n`;
            content += `1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n`;
            content += `• Get 4 in a row to win (horizontal, vertical, or diagonal)\n\n`;
        }

        content += `\nCurrent turn: <@${game.currentPlayer}>\n`;
        content += `Use \`!game play 1-7\` to make a move!`;

        await message.channel.send({ content });
    }

    private formatC4Board(game: ConnectFourGame): string {
        return game.board.map(row => row.join('')).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
    }

    private isValidMove(board: string[][], col: number): boolean {
        return board[0][col] === '⚪';
    }

    private getLowestEmptyRow(board: string[][], col: number): number {
        for (let row = board.length - 1; row >= 0; row--) {
            if (board[row][col] === '⚪') return row;
        }
        return -1;
    }

    private isBoardFull(board: string[][]): boolean {
        return board[0].every(cell => cell !== '⚪');
    }

    private checkC4Winner(board: string[][]): string | null {
        // Check horizontal
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 4; col++) {
                const piece = board[row][col];
                if (piece !== '⚪' &&
                    piece === board[row][col + 1] &&
                    piece === board[row][col + 2] &&
                    piece === board[row][col + 3]) {
                    return piece;
                }
            }
        }

        // Check vertical
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 7; col++) {
                const piece = board[row][col];
                if (piece !== '⚪' &&
                    piece === board[row + 1][col] &&
                    piece === board[row + 2][col] &&
                    piece === board[row + 3][col]) {
                    return piece;
                }
            }
        }

        // Check diagonal (down-right)
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 4; col++) {
                const piece = board[row][col];
                if (piece !== '⚪' &&
                    piece === board[row + 1][col + 1] &&
                    piece === board[row + 2][col + 2] &&
                    piece === board[row + 3][col + 3]) {
                    return piece;
                }
            }
        }

        // Check diagonal (down-left)
        for (let row = 0; row < 3; row++) {
            for (let col = 3; col < 7; col++) {
                const piece = board[row][col];
                if (piece !== '⚪' &&
                    piece === board[row + 1][col - 1] &&
                    piece === board[row + 2][col - 2] &&
                    piece === board[row + 3][col - 3]) {
                    return piece;
                }
            }
        }

        return null;
    }
} 