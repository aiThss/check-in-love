/**
 * Minimal Pure JS QR Code Generator for Terminal & Web
 * Zero dependencies - 100% Offline SVG & Terminal QR Generator!
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// --- 1. Pure JS QR Code Generator (Unicode & SVG) ---
var QRCodeLib = (function () {
    var MODE_8BIT_BYTE = 1 << 2;
    var ECL_L = 1;

    function QRPolynomial(num, shift) {
        var offset = 0;
        while (offset < num.length && num[offset] == 0) offset++;
        this.num = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    }
    QRPolynomial.prototype = {
        get: function (index) { return this.num[index]; },
        getLength: function () { return this.num.length; },
        multiply: function (e) {
            var num = new Array(this.getLength() + e.getLength() - 1);
            for (var i = 0; i < this.getLength(); i++) {
                for (var j = 0; j < e.getLength(); j++) {
                    num[i + j] ^= QRMath.glog(this.get(i)) + QRMath.glog(e.get(j));
                    num[i + j] = QRMath.gexp(num[i + j]);
                }
            }
            return new QRPolynomial(num, 0);
        },
        mod: function (e) {
            if (this.getLength() - e.getLength() < 0) return this;
            var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
            var num = new Array(this.getLength());
            for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
            for (var i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
            return new QRPolynomial(num, 0).mod(e);
        }
    };

    var QRMath = {
        glog: function (n) { return QRMath.LOG_TABLE[n]; },
        gexp: function (n) {
            while (n < 0) n += 255;
            while (n >= 256) n -= 255;
            return QRMath.EXP_TABLE[n];
        },
        EXP_TABLE: new Array(256),
        LOG_TABLE: new Array(256)
    };
    for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
    for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
    for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

    var RS_BLOCK_TABLE = [
        [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80], [1, 134, 108],
        [2, 86, 68], [2, 98, 78], [2, 121, 97], [2, 146, 116], [2, 174, 138]
    ];

    function QRCodeModel(typeNumber) {
        this.typeNumber = typeNumber;
        this.modules = null;
        this.moduleCount = 0;
        this.dataList = [];
    }

    QRCodeModel.prototype = {
        addData: function (data) {
            this.dataList.push({
                mode: MODE_8BIT_BYTE,
                data: data,
                getLength: function () { return this.data.length; },
                write: function (buffer) {
                    for (var i = 0; i < this.data.length; i++) buffer.put(this.data.charCodeAt(i), 8);
                }
            });
        },
        make: function () {
            this.moduleCount = this.typeNumber * 4 + 17;
            this.modules = new Array(this.moduleCount);
            for (var row = 0; row < this.moduleCount; row++) {
                this.modules[row] = new Array(this.moduleCount);
                for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
            }
            this.setupPositionProbePattern(0, 0);
            this.setupPositionProbePattern(this.moduleCount - 7, 0);
            this.setupPositionProbePattern(0, this.moduleCount - 7);
            this.setupTimingPattern();
            this.setupTypeInfo(false, 0);
            if (this.typeNumber >= 7) this.setupTypeNumber(false);
            var data = QRCodeModel.createData(this.typeNumber, this.dataList);
            this.mapData(data, 0);
        },
        setupPositionProbePattern: function (row, col) {
            for (var r = -1; r <= 7; r++) {
                if (row + r <= -1 || this.moduleCount <= row + r) continue;
                for (var c = -1; c <= 7; c++) {
                    if (col + c <= -1 || this.moduleCount <= col + c) continue;
                    if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
                        this.modules[row + r][col + c] = true;
                    } else {
                        this.modules[row + r][col + c] = false;
                    }
                }
            }
        },
        setupTimingPattern: function () {
            for (var r = 8; r < this.moduleCount - 8; r++) {
                if (this.modules[r][6] !== null) continue;
                this.modules[r][6] = (r % 2 == 0);
            }
            for (var c = 8; c < this.moduleCount - 8; c++) {
                if (this.modules[6][c] !== null) continue;
                this.modules[6][c] = (c % 2 == 0);
            }
        },
        setupTypeInfo: function (test, maskPattern) {
            var data = (ECL_L << 3) | maskPattern;
            var bits = QRUtil.getBCHTypeInfo(data);
            for (var i = 0; i < 15; i++) {
                var mod = (!test && ((bits >> i) & 1) == 1);
                if (i < 6) this.modules[i][8] = mod;
                else if (i < 9) this.modules[i + 1][8] = mod;
                else this.modules[this.moduleCount - 15 + i][8] = mod;

                if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
                else if (i < 9) this.modules[8][15 - i] = mod;
                else this.modules[8][15 - i - 1] = mod;
            }
            this.modules[this.moduleCount - 8][8] = (!test);
        },
        setupTypeNumber: function (test) {
            var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
            for (var i = 0; i < 18; i++) {
                var mod = (!test && ((bits >> i) & 1) == 1);
                this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
                this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
            }
        },
        mapData: function (data, maskPattern) {
            var inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
            for (var col = this.moduleCount - 1; col > 0; col -= 2) {
                if (col == 6) col--;
                while (true) {
                    for (var c = 0; c < 2; c++) {
                        if (this.modules[row][col - c] === null) {
                            var dark = false;
                            if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
                            var mask = QRUtil.getMask(maskPattern, row, col - c);
                            if (mask) dark = !dark;
                            this.modules[row][col - c] = dark;
                            bitIndex--;
                            if (bitIndex == -1) { byteIndex++; bitIndex = 7; }
                        }
                    }
                    row += inc;
                    if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
                }
            }
        }
    };

    QRCodeModel.createData = function (typeNumber, dataList) {
        var rsBlock = RS_BLOCK_TABLE[typeNumber - 1];
        var buffer = new QRBitBuffer();
        for (var i = 0; i < dataList.length; i++) {
            var data = dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), 8);
            data.write(buffer);
        }
        var totalDataCount = rsBlock[0] * rsBlock[2];
        if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error("Data overflow");
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
        while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(false);
        while (true) {
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(0xec, 8);
            if (buffer.getLengthInBits() >= totalDataCount * 8) break;
            buffer.put(0x11, 8);
        }
        var dcdata = buffer.buffer;
        var rsPoly = QRUtil.getErrorCorrectPolynomial(rsBlock[1] - rsBlock[2]);
        var rawPoly = new QRPolynomial(dcdata, rsPoly.getLength() - 1);
        var modPoly = rawPoly.mod(rsPoly);
        var res = dcdata.slice(0);
        for (var i = 0; i < rsPoly.getLength() - 1; i++) {
            var modIndex = i + modPoly.getLength() - (rsPoly.getLength() - 1);
            res.push((modIndex >= 0) ? modPoly.get(modIndex) : 0);
        }
        return res;
    };

    var QRUtil = {
        getMask: function (maskPattern, i, j) {
            switch (maskPattern) {
                case 0: return (i + j) % 2 == 0;
                case 1: return i % 2 == 0;
                case 2: return j % 3 == 0;
                case 3: return (i + j) % 3 == 0;
                case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
                case 5: return (i * j) % 2 + (i * j) % 3 == 0;
                case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
                case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
                default: return false;
            }
        },
        getErrorCorrectPolynomial: function (errorCorrectLength) {
            var a = new QRPolynomial([1], 0);
            for (var i = 0; i < errorCorrectLength; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
            return a;
        },
        getBCHTypeInfo: function (data) {
            var d = data << 10;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x537) >= 0) d ^= (0x537 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x537)));
            return ((data << 10) | d) ^ 0x5412;
        },
        getBCHTypeNumber: function (data) {
            var d = data << 12;
            while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x1f25) >= 0) d ^= (0x1f25 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(0x1f25)));
            return (data << 12) | d;
        },
        getBCHDigit: function (data) {
            var digit = 0;
            while (data != 0) { digit++; data >>>= 1; }
            return digit;
        }
    };

    function QRBitBuffer() {
        this.buffer = [];
        this.length = 0;
    }
    QRBitBuffer.prototype = {
        get: function (index) { return ((this.buffer[Math.floor(index / 8)] >>> (7 - index % 8)) & 1) == 1; },
        put: function (num, length) { for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) == 1); },
        getLengthInBits: function () { return this.length; },
        putBit: function (bit) {
            var bufIndex = Math.floor(this.length / 8);
            if (this.buffer.length <= bufIndex) this.buffer.push(0);
            if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
            this.length++;
        }
    };

    return {
        generateAscii: function (text) {
            var typeNum = 3;
            if (text.length > 32) typeNum = 4;
            if (text.length > 50) typeNum = 5;
            var qr = new QRCodeModel(typeNum);
            qr.addData(text);
            qr.make();

            var count = qr.moduleCount;
            var border = 2;
            var out = "";
            var black = "██";
            var white = "  ";

            for (var r = 0; r < border; r++) {
                for (var c = 0; c < count + border * 2; c++) out += white;
                out += "\n";
            }
            for (var r = 0; r < count; r++) {
                for (var c = 0; c < border; c++) out += white;
                for (var c = 0; c < count; c++) {
                    out += qr.modules[r][c] ? black : white;
                }
                for (var c = 0; c < border; c++) out += white;
                out += "\n";
            }
            for (var r = 0; r < border; r++) {
                for (var c = 0; c < count + border * 2; c++) out += white;
                out += "\n";
            }
            return out;
        },

        generateSVG: function (text) {
            var typeNum = 3;
            if (text.length > 32) typeNum = 4;
            if (text.length > 50) typeNum = 5;
            var qr = new QRCodeModel(typeNum);
            qr.addData(text);
            qr.make();

            var count = qr.moduleCount;
            var border = 2;
            var totalSize = count + border * 2;

            var svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="240" height="240" shape-rendering="crispEdges">`;
            svg += `<rect width="${totalSize}" height="${totalSize}" fill="#ffffff"/>`;
            for (var r = 0; r < count; r++) {
                for (var c = 0; c < count; c++) {
                    if (qr.modules[r][c]) {
                        svg += `<rect x="${c + border}" y="${r + border}" width="1" height="1" fill="#000000"/>`;
                    }
                }
            }
            svg += `</svg>`;
            return svg;
        }
    };
})();

// --- 2. Local IP Detection ---
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

// --- 3. Main Execution ---
const port = process.argv[2] || '5173';
const ip = getLocalIP();
const url = `http://${ip}:${port}`;

console.log('\n======================================================');
console.log('      🚀 VITE LOCAL PROJECT - WIFI CONNECT TOOL 🚀');
console.log('======================================================\n');
console.log(`  🌐 Local IP:   ${ip}`);
console.log(`  🔌 Port:       ${port}`);
console.log(`  🔗 Full URL:   ${url}\n`);

console.log('  📱 Mã QR Code (Quét bằng camera điện thoại):\n');
try {
    console.log(QRCodeLib.generateAscii(url));
} catch (e) {
    console.log(`  👉 Mở liên kết: ${url}\n`);
}

// --- 4. Generate & Auto Open Inline SVG QR Code HTML Page ---
const svgQrCode = QRCodeLib.generateSVG(url);
const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vite Local - Mobile Connect</title>
    <style>
        :root {
            --bg: #0f172a;
            --card-bg: #1e293b;
            --accent: #6366f1;
            --accent-hover: #4f46e5;
            --text: #f8fafc;
            --text-muted: #94a3b8;
            --success: #10b981;
        }
        body {
            font-family: system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
        }
        .card {
            background: var(--card-bg);
            border-radius: 24px;
            padding: 32px;
            max-width: 420px;
            width: 100%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        h1 {
            font-size: 1.5rem;
            margin-top: 0;
            margin-bottom: 8px;
            color: #fff;
        }
        p {
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-bottom: 24px;
        }
        .qr-container {
            background: #ffffff;
            padding: 16px;
            border-radius: 16px;
            display: inline-block;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
            margin-bottom: 24px;
        }
        .qr-container svg {
            display: block;
            border-radius: 4px;
        }
        .url-box {
            background: rgba(0, 0, 0, 0.3);
            padding: 14px 18px;
            border-radius: 12px;
            font-family: monospace;
            font-size: 1.1rem;
            color: var(--success);
            word-break: break-all;
            border: 1px dashed rgba(16, 185, 129, 0.4);
            margin-bottom: 20px;
        }
        .btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
            width: 100%;
            box-sizing: border-box;
        }
        .btn:hover {
            background: var(--accent-hover);
        }
        .troubleshoot {
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid rgba(255,255,255,0.1);
            text-align: left;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
        .troubleshoot summary {
            cursor: pointer;
            color: var(--accent);
            font-weight: 600;
            margin-bottom: 8px;
        }
        .troubleshoot ul {
            padding-left: 20px;
            margin: 8px 0;
        }
        .troubleshoot li {
            margin-bottom: 6px;
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>📱 Vite Mobile Connect</h1>
        <p>Quét mã QR bằng điện thoại (cùng mạng Wi-Fi)</p>
        
        <div class="qr-container">
            ${svgQrCode}
        </div>

        <div class="url-box">
            <span id="urlText">${url}</span>
        </div>

        <button class="btn" onclick="copyUrl()">📋 Sao chép URL</button>

        <div class="troubleshoot">
            <details>
                <summary>❓ Mẹo khắc phục nếu điện thoại không vào được:</summary>
                <ul>
                    <li>1. Đảm bảo Điện thoại & PC kết nối <b>cùng mạng Wi-Fi</b>.</li>
                    <li>2. Chạy file <b>open-firewall.bat</b> để cho phép Port ${port} qua Firewall.</li>
                    <li>3. Chuyển Wi-Fi trên Windows từ "Public" sang <b>"Private"</b>.</li>
                </ul>
            </details>
        </div>
    </div>

    <script>
        function copyUrl() {
            const url = document.getElementById('urlText').innerText;
            navigator.clipboard.writeText(url).then(() => alert('Đã sao chép: ' + url));
        }
    </script>
</body>
</html>`;

const tempHtmlPath = path.join(os.tmpdir(), 'vite-mobile-qr.html');
fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

if (process.platform === 'win32') {
    exec(`start "" "${tempHtmlPath}"`, () => {});
}
