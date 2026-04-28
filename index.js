const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const pino = require('pino');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'bakulhosting_secret_123'; // Ganti ini nanti

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('SCAN QR CODE DI BAWAH INI:');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus. Menghubungkan kembali...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ WhatsApp Bridge SIAP!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Endpoint untuk kirim pesan
app.post('/send', async (req, res) => {
    const { key, number, message } = req.body;

    if (key !== API_KEY) {
        return res.status(401).json({ status: 'error', message: 'API Key tidak valid' });
    }

    if (!number || !message) {
        return res.status(400).json({ status: 'error', message: 'Nomor atau pesan kosong' });
    }

    try {
        const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        res.json({ status: 'success', message: 'Pesan terkirim' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/', (req, res) => {
    res.send('BakulHosting WA-Bridge is Running!');
});

app.listen(PORT, () => {
    console.log(`Server jalan di port ${PORT}`);
    connectToWhatsApp();
});
