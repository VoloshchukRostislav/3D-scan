const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Model3D = require('../models/Model3D');

const router = express.Router();

// Налаштування Multer для тимчасового збереження фото
const upload = multer({ dest: 'uploads/temp/' });

// ─────────────────────────────────────────────
// POST /api/generate
// Відправляє фото до Stability AI Fast 3D API і повертає готову 3D модель
// ─────────────────────────────────────────────
router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Зображення не було передано' });
    }

    const imagePath = req.file.path;
    const originalName = req.file.originalname;

    // Створюємо FormData для відправки в Stability AI
    const data = new FormData();
    data.append('image', fs.createReadStream(imagePath));

    console.log('[Stability AI] Відправка запиту на генерацію...');

    // Запит до Stability AI Fast 3D API
    const authHeader = `Bearer ${process.env.STABILITY_API_KEY}`;
    
    // Зауваження: В Stability AI Fast 3D API запит триває близько 5-10 секунд, 
    // і файл повертається безпосередньо у відповіді
    const response = await axios.post(
      'https://api.stability.ai/v2beta/3d/stable-fast-3d',
      data,
      {
        headers: {
          Authorization: authHeader,
          ...data.getHeaders(),
        },
        responseType: 'arraybuffer', // Отримуємо бінарний файл (GLB)
        validateStatus: undefined,
      }
    );

    if (response.status !== 200) {
      // Якщо помилка (в arraybuffer вона прийде як буфер, треба перевести в рядок)
      const errorStr = Buffer.from(response.data).toString('utf-8');
      console.error('[Stability AI] Помилка:', errorStr);
      throw new Error(`Помилка API Stability AI (Код ${response.status})`);
    }

    console.log('[Stability AI] Генерація успішна! Збереження локально...');

    // 1. Зберігаємо отриманий файл локально
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const glbFilename = `${uniquePrefix}-generated.glb`;
    const finalPath = path.join(__dirname, '..', 'uploads', glbFilename);
    
    fs.writeFileSync(finalPath, response.data);

    // 2. Видаляємо тимчасове вхідне зображення
    fs.unlink(imagePath, () => {});

    // 3. Зберігаємо запис про модель в MongoDB
    const baseName = path.parse(originalName).name.replace(/[^a-zA-Z0-9А-Яа-яієії]/g, '_');
    const finalOriginalName = `${baseName}_3D.glb`;

    const modelRecord = await Model3D.create({
      originalName: finalOriginalName,
      filename: glbFilename,
      mimetype: 'model/gltf-binary',
      size: response.data.length,
      format: 'glb',
      description: 'Згенеровано через Stability AI Fast 3D',
    });

    res.status(200).json({
      success: true,
      message: 'Модель успішно згенеровано',
      data: modelRecord,
    });

  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(error);
  }
});

module.exports = router;
