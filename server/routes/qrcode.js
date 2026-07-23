'use strict';

const express = require('express');
const QRCode = require('qrcode');

const router = express.Router();

// GET /api/qrcode?text=<conteúdo> — devolve um QR code em PNG.
// Usado no lobby para os jogadores escanearem e entrarem direto na sala.
router.get('/', async (req, res) => {
  const text = req.query.text;
  if (!text) {
    return res.status(400).json({ error: 'missing_text' });
  }
  try {
    const buffer = await QRCode.toBuffer(String(text), {
      type: 'png',
      width: 320,
      margin: 1,
      color: { dark: '#1b1533', light: '#ffffff' },
    });
    res.type('png').send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'qrcode_failed' });
  }
});

module.exports = router;
