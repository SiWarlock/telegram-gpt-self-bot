import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { config } from './config/config';

async function getSession() {
    const client = new TelegramClient(
        new StringSession(''),
        config.telegram.apiId ?? 0,
        config.telegram.apiHash ?? '',
        { connectionRetries: 5 }
    );

    await client.start({
        phoneNumber: async () => await input('Please enter your phone number: '),
        password: async () => await input('Please enter your password: '),
        phoneCode: async () => await input('Please enter the code you received: '),
        onError: (err) => console.log(err),
    });

    console.log('Your session string is:', client.session.save());
}

async function input(question: string): Promise<string> {
    return new Promise((resolve) => {
        process.stdout.write(question);
        process.stdin.once('data', (data) => {
            resolve(data.toString().trim());
        });
    });
}

getSession(); 