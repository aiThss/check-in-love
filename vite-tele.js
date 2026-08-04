/**
 * Vite Project Telegram Launcher
 * Scans d:\memory, lets user pick a project, starts Vite, and sends the URL to Telegram Bot!
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');
const readline = require('readline');
const https = require('https');

const MEMORY_DIR = 'd:\\memory';
const CONFIG_FILE = path.join(__dirname, 'tele-config.json');
const BOT_PRJ_ENV = 'd:\\memory\\bot_prj\\.env';

// 1. Get IPv4 Address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    let preferredIP = null;

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
                    return net.address;
                }
                if (!preferredIP) preferredIP = net.address;
            }
        }
    }
    return preferredIP || '127.0.0.1';
}

// 2. Load or Prompt Telegram Config
function loadTelegramConfig(rl, callback) {
    let token = '';
    let chatId = '';

    // Try reading from bot_prj/.env first
    if (fs.existsSync(BOT_PRJ_ENV)) {
        const envContent = fs.readFileSync(BOT_PRJ_ENV, 'utf-8');
        const tokenMatch = envContent.match(/^BOT_TOKEN=(.+)$/m);
        const chatIdMatch = envContent.match(/^(?:ADMIN_CHAT_ID|CHAT_ID|ADMIN_CHAT_IDS)=([^\r\n,]+)/m);
        if (tokenMatch && tokenMatch[1]) token = tokenMatch[1].trim();
        if (chatIdMatch && chatIdMatch[1]) chatId = chatIdMatch[1].trim();
    }

    // Try reading local tele-config.json
    if ((!token || !chatId) && fs.existsSync(CONFIG_FILE)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            if (cfg.BOT_TOKEN) token = cfg.BOT_TOKEN;
            if (cfg.CHAT_ID) chatId = cfg.CHAT_ID;
        } catch (e) {}
    }

    if (token && chatId && token !== '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ') {
        return callback({ BOT_TOKEN: token, CHAT_ID: chatId });
    }

    console.log('\n======================================================');
    console.log('  🤖 CẤU HÌNH TELEGRAM BOT (CHỈ CẦN NHẬP 1 LẦN DỰ KIỆN)');
    console.log('======================================================\n');

    rl.question('👉 Nhập Telegram BOT_TOKEN từ @BotFather: ', (inputToken) => {
        rl.question('👉 Nhập Telegram CHAT_ID của bạn: ', (inputChatId) => {
            const config = {
                BOT_TOKEN: inputToken.trim(),
                CHAT_ID: inputChatId.trim()
            };
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
            console.log('✅ Đã lưu cấu hình Telegram vào tele-config.json!\n');
            callback(config);
        });
    });
}

// 3. Send Message to Telegram Bot
function sendTelegramMessage(config, message, callback) {
    const postData = JSON.stringify({
        chat_id: config.CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false
    });

    const options = {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${config.BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.ok) {
                    console.log('✅ Đã gửi liên kết thành công đến Telegram Bot!');
                } else {
                    console.log('⚠️ Lỗi gửi Telegram:', parsed.description || data);
                }
            } catch (e) {
                console.log('⚠️ Phản hồi Telegram:', data);
            }
            if (callback) callback();
        });
    });

    req.on('error', (e) => {
        console.log('❌ Lỗi kết nối Telegram:', e.message);
        if (callback) callback();
    });

    req.write(postData);
    req.end();
}

// 4. Scan d:\memory for Vite/Node Projects
function scanProjects() {
    const projects = [];
    if (!fs.existsSync(MEMORY_DIR)) return projects;

    const items = fs.readdirSync(MEMORY_DIR, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory() && item.name !== 'node_modules' && item.name !== 'rules') {
            const fullPath = path.join(MEMORY_DIR, item.name);
            const pkgPath = path.join(fullPath, 'package.json');
            if (fs.existsSync(pkgPath)) {
                projects.push({ name: item.name, path: fullPath });
            }
        }
    }
    return projects;
}

// 5. Main Flow
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const projects = scanProjects();

console.log('\n======================================================');
console.log('      🚀 VITE PROJECT TELEGRAM LAUNCHER 🚀');
console.log('======================================================\n');

if (projects.length === 0) {
    console.log('❌ Không tìm thấy dự án Vite/Node nào trong d:\\memory');
    rl.close();
    process.exit(1);
}

console.log('Danh sách các dự án khả dụng trong d:\\memory:\n');
projects.forEach((proj, index) => {
    console.log(`  [${index + 1}] ${proj.name}`);
});
console.log('');

loadTelegramConfig(rl, (config) => {
    rl.question('👉 Chọn số thứ tự dự án (hoặc nhập tên dự án): ', (choice) => {
        let selected = null;
        const num = parseInt(choice.trim(), 10);
        if (!isNaN(num) && num >= 1 && num <= projects.length) {
            selected = projects[num - 1];
        } else {
            selected = projects.find(p => p.name.toLowerCase() === choice.trim().toLowerCase());
        }

        if (!selected) {
            console.log('❌ Lựa chọn không hợp lệ!');
            rl.close();
            return;
        }

        rl.close();

        const ip = getLocalIP();
        const port = '5173';
        const url = `http://${ip}:${port}`;

        console.log(`\n------------------------------------------------------`);
        console.log(`🚀 Đang chọn dự án: ${selected.name}`);
        console.log(`🌐 Local URL:       ${url}`);
        console.log(`------------------------------------------------------\n`);

        const teleMsg = `🚀 <b>VITE LOCAL DEV SERVER</b>\n\n📌 <b>Dự án:</b> ${selected.name}\n🌐 <b>URL:</b> <a href="${url}">${url}</a>\n\n👉 <i>Nhấp vào đường dẫn trên để mở dự án trực tiếp trên điện thoại!</i>`;

        sendTelegramMessage(config, teleMsg, () => {
            console.log(`\n🚀 Đang khởi chạy Vite Server cho [${selected.name}]...\n`);
            
            // Spawn Vite process in selected directory
            const viteProc = spawn('npx.cmd', ['vite', '--host', '0.0.0.0', '--port', port, '--clearScreen', 'false'], {
                cwd: selected.path,
                stdio: 'inherit',
                shell: true
            });

            viteProc.on('error', (err) => {
                console.error('❌ Không thể khởi chạy Vite:', err.message);
            });
        });
    });
});
