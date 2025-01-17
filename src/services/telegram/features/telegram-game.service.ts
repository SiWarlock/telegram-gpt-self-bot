import { Api } from 'telegram/tl';
import { TelegramClient } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { config } from '../../../config/config';
import { COMMANDS } from '../../../config/constants';
import { EntityLike } from 'telegram/define';
import { BigInteger } from 'big-integer';

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

export class TelegramGameFeature {
    private tttGames: Map<string, TicTacToeGame> = new Map();
    private c4Games: Map<string, ConnectFourGame> = new Map();
    private readonly GAME_TIMEOUT = 5 * 60 * 1000;

    constructor(private client: TelegramClient) {
        setInterval(() => this.cleanupOldGames(), 60 * 1000);
    }

    private getChatId(message: Api.Message): EntityLike | null {
        if (!message.chatId) return null;
        return message.peerId as EntityLike;
    }

    async handle(event: NewMessageEvent): Promise<void> {
        const message = event.message;
        const text = message.message;
        const chatId = this.getChatId(message);
        if (!text || !chatId) return;

        const args = text.slice(COMMANDS.GAME.length).trim().split(' ');
        const command = args[0].toLowerCase();
        const mentionedUser = await this.getMentionedUser(message);

        const chatIdStr = chatId.toString();

        switch (command) {
            case 'ttt':
                await this.handleTicTacToe(message, mentionedUser, chatId, chatIdStr);
                break;
            case 'c4':
                await this.handleConnectFour(message, mentionedUser, chatId, chatIdStr);
                break;
            case 'play':
                if (this.tttGames.has(chatIdStr)) {
                    await this.handleTicTacToeMove(message, args[1], chatId, chatIdStr);
                } else if (this.c4Games.has(chatIdStr)) {
                    await this.handleConnectFourMove(message, args[1], chatId, chatIdStr);
                }
                break;
        }
    }

    private async getMentionedUser(message: Api.Message): Promise<{ id: string; username?: string } | undefined> {
        if (!message.entities) return undefined;

        for (const entity of message.entities) {
            if (entity instanceof Api.MessageEntityMention) {
                const username = message.message.substring(entity.offset + 1, entity.offset + entity.length);
                try {
                    const result = await this.client.invoke(new Api.users.GetUsers({
                        id: [username]
                    }));
                    if (result && result[0]) {
                        const user = result[0] as Api.User;
                        return {
                            id: user.id.toString(),
                            username: user.username
                        };
                    }
                } catch (error) {
                    console.error('Error getting mentioned user:', error);
                }
            }
        }
        return undefined;
    }

    private async handleTicTacToe(
        message: Api.Message,
        mention: { id: string; username?: string } | undefined,
        chatId: EntityLike,
        chatIdStr: string
    ): Promise<void> {
        const senderId = message.senderId?.toString();

        if (!mention) {
            await this.client.sendMessage(chatId, {
                message: '❌ Please mention a player to play with: !game ttt @player'
            });
            return;
        }

        if (!senderId || mention.id === senderId) {
            await this.client.sendMessage(chatId, {
                message: '❌ You cannot play against yourself!'
            });
            return;
        }

        const game: TicTacToeGame = {
            board: ['⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜', '⬜'],
            currentPlayer: senderId,
            player1: senderId,
            player2: mention.id,
            lastActive: Date.now()
        };

        this.tttGames.set(chatIdStr, game);
        await this.displayBoard(chatId, game);
    }

    private async handleTicTacToeMove(
        message: Api.Message,
        position: string,
        chatId: EntityLike,
        chatIdStr: string
    ): Promise<void> {
        const senderId = message.senderId?.toString();
        const game = this.tttGames.get(chatIdStr);

        if (!game || !senderId) {
            await this.client.sendMessage(chatId, {
                message: '❌ No active Tic Tac Toe game in this chat. Start one with !game ttt @player'
            });
            return;
        }

        if (game.currentPlayer !== senderId) {
            await this.client.sendMessage(chatId, {
                message: '❌ Not your turn!'
            });
            return;
        }

        const pos = parseInt(position) - 1;
        if (pos < 0 || pos > 8 || game.board[pos] !== '⬜') {
            await this.client.sendMessage(chatId, {
                message: '❌ Invalid move! Choose a number 1-9 in an empty space.'
            });
            return;
        }

        game.board[pos] = game.currentPlayer === game.player1 ? '❌' : '⭕';
        game.currentPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        game.lastActive = Date.now();

        const winner = this.checkWinner(game.board);
        if (winner) {
            await this.displayBoard(chatId, game);
            const winnerUsername = await this.getUsernameById(winner === '❌' ? game.player1 : game.player2);
            await this.client.sendMessage(chatId, {
                message: `🎉 ${winnerUsername} wins!`
            });
            this.tttGames.delete(chatIdStr);
            return;
        }

        if (!game.board.includes('⬜')) {
            await this.displayBoard(chatId, game);
            await this.client.sendMessage(chatId, {
                message: "🤝 It's a draw!"
            });
            this.tttGames.delete(chatIdStr);
            return;
        }

        await this.displayBoard(chatId, game);
    }

    private async displayBoard(chatId: EntityLike, game: TicTacToeGame): Promise<void> {
        const board = this.formatBoard(game);
        const isNewGame = game.board.every(cell => cell === '⬜');
        
        let content = `${board}\n\n`;
        
        if (isNewGame) {
            const player1Username = await this.getUsernameById(game.player1);
            const player2Username = await this.getUsernameById(game.player2);
            
            content += `🎮 **Tic Tac Toe**\n`;
            content += `Player 1 (❌): @${player1Username}\n`;
            content += `Player 2 (⭕): @${player2Username}\n\n`;
            content += `**How to Play:**\n`;
            content += `• Use \`!game play 1-9\` to place your mark\n`;
            content += `• Numbers correspond to positions:\n`;
            content += `1️⃣2️⃣3️⃣\n4️⃣5️⃣6️⃣\n7️⃣8️⃣9️⃣\n\n`;
        }
        
        const currentPlayerUsername = await this.getUsernameById(game.currentPlayer);
        content += `Current turn: @${currentPlayerUsername}\n`;
        content += `Use \`!game play 1-9\` to make a move!`;

        await this.client.sendMessage(chatId, { message: content });
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

    private async handleConnectFour(
        message: Api.Message,
        mention: { id: string; username?: string } | undefined,
        chatId: EntityLike,
        chatIdStr: string
    ): Promise<void> {
        const senderId = message.senderId?.toString();

        if (!mention) {
            await this.client.sendMessage(chatId, {
                message: '❌ Please mention a player to play with: !game c4 @player'
            });
            return;
        }

        if (!senderId || mention.id === senderId) {
            await this.client.sendMessage(chatId, {
                message: '❌ You cannot play against yourself!'
            });
            return;
        }

        const game: ConnectFourGame = {
            board: Array(6).fill(null).map(() => Array(7).fill('⚪')),
            currentPlayer: senderId,
            player1: senderId,
            player2: mention.id,
            lastActive: Date.now()
        };

        this.c4Games.set(chatIdStr, game);
        await this.displayC4Board(chatId, game);
    }

    private async handleConnectFourMove(
        message: Api.Message,
        column: string,
        chatId: EntityLike,
        chatIdStr: string
    ): Promise<void> {
        const senderId = message.senderId?.toString();
        const game = this.c4Games.get(chatIdStr);

        if (!game || !senderId) {
            await this.client.sendMessage(chatId, {
                message: '❌ No active Connect Four game in this chat. Start one with !game c4 @player'
            });
            return;
        }

        if (game.currentPlayer !== senderId) {
            await this.client.sendMessage(chatId, {
                message: '❌ Not your turn!'
            });
            return;
        }

        const col = parseInt(column) - 1;
        if (col < 0 || col > 6 || !this.isValidMove(game.board, col)) {
            await this.client.sendMessage(chatId, {
                message: '❌ Invalid move! Choose a column 1-7 that isn\'t full.'
            });
            return;
        }

        const row = this.getLowestEmptyRow(game.board, col);
        game.board[row][col] = game.currentPlayer === game.player1 ? '🔴' : '🔵';
        game.currentPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        game.lastActive = Date.now();

        const winner = this.checkC4Winner(game.board);
        if (winner) {
            await this.displayC4Board(chatId, game);
            const winnerUsername = await this.getUsernameById(winner === '🔴' ? game.player1 : game.player2);
            await this.client.sendMessage(chatId, {
                message: `🎉 ${winnerUsername} wins!`
            });
            this.c4Games.delete(chatIdStr);
            return;
        }

        if (this.isBoardFull(game.board)) {
            await this.displayC4Board(chatId, game);
            await this.client.sendMessage(chatId, {
                message: "🤝 It's a draw!"
            });
            this.c4Games.delete(chatIdStr);
            return;
        }

        await this.displayC4Board(chatId, game);
    }

    private async displayC4Board(chatId: EntityLike, game: ConnectFourGame): Promise<void> {
        const isNewGame = game.board.every(row => row.every(cell => cell === '⚪'));
        let content = this.formatC4Board(game);
        
        if (isNewGame) {
            const player1Username = await this.getUsernameById(game.player1);
            const player2Username = await this.getUsernameById(game.player2);
            
            content += `\n🎮 **Connect Four**\n`;
            content += `Player 1 (🔴): @${player1Username}\n`;
            content += `Player 2 (🔵): @${player2Username}\n\n`;
            content += `**How to Play:**\n`;
            content += `• Use \`!game play 1-7\` to drop your piece\n`;
            content += `• Columns are numbered left to right:\n`;
            content += `1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n`;
            content += `• Get 4 in a row to win (horizontal, vertical, or diagonal)\n\n`;
        }

        const currentPlayerUsername = await this.getUsernameById(game.currentPlayer);
        content += `\nCurrent turn: @${currentPlayerUsername}\n`;
        content += `Use \`!game play 1-7\` to make a move!`;

        await this.client.sendMessage(chatId, { message: content });
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

    private async getUsernameById(userId: string): Promise<string> {
        try {
            const result = await this.client.invoke(new Api.users.GetUsers({
                id: [userId]
            }));
            if (result && result[0] && result[0] instanceof Api.User) {
                return result[0].username || result[0].id.toString();
            }
            return userId;
        } catch (error) {
            console.error('Error getting username:', error);
            return userId;
        }
    }

    private cleanupOldGames(): void {
        const now = Date.now();
        for (const [chatId, game] of this.tttGames.entries()) {
            if (now - game.lastActive > this.GAME_TIMEOUT) {
                this.tttGames.delete(chatId);
            }
        }
        for (const [chatId, game] of this.c4Games.entries()) {
            if (now - game.lastActive > this.GAME_TIMEOUT) {
                this.c4Games.delete(chatId);
            }
        }
    }
} 