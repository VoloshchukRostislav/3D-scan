const express = require('express');
const path = require('path');
const fs = require('fs');

const upload = require('../middleware/upload');
const Model3D = require('../models/Model3D');

const router = express.Router();

// ─────────────────────────────────────────────
// POST /api/models/upload
// Завантаження 3D моделі
// ─────────────────────────────────────────────
router.post('/upload', upload.single('model'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Файл не було передано' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    const model = await Model3D.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      format: ext,
      description: req.body.description || '',
    });

    res.status(201).json({
      success: true,
      message: 'Модель успішно завантажено',
      data: model,
    });
  } catch (error) {
    // Якщо помилка при збереженні в БД — видалити фізичний файл
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/models
// Список усіх моделей
// ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const models = await Model3D.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: models.length,
      data: models,
    });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/models/:id
// Отримати метадані конкретної моделі
// ─────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const model = await Model3D.findById(req.params.id);

    if (!model) {
      return res.status(404).json({ success: false, message: 'Модель не знайдено' });
    }

    res.json({ success: true, data: model });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// GET /api/models/:id/file
// Завантажити / стримити файл моделі
// ─────────────────────────────────────────────
router.get('/:id/file', async (req, res, next) => {
  try {
    const model = await Model3D.findById(req.params.id);

    if (!model) {
      return res.status(404).json({ success: false, message: 'Модель не знайдено' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', model.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Файл не знайдено на сервері' });
    }

    res.download(filePath, model.originalName);
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// PUT /api/models/:id
// Оновити назву моделі (Перейменування)
// ─────────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Назва не може бути порожньою' });
    }

    const model = await Model3D.findById(req.params.id);
    if (!model) {
      return res.status(404).json({ success: false, message: 'Модель не знайдено' });
    }

    // Зберігаємо оригінальне розширення файла (якщо воно є)
    const ext = path.extname(model.originalName);
    const newName = name.endsWith(ext) ? name : name + ext;

    model.originalName = newName;
    await model.save();

    res.json({ success: true, data: model, message: 'Модель перейменовано' });
  } catch (error) {
    next(error);
  }
});

// ─────────────────────────────────────────────
// DELETE /api/models/:id
// Видалити модель (файл + запис у БД)
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const model = await Model3D.findById(req.params.id);

    if (!model) {
      return res.status(404).json({ success: false, message: 'Модель не знайдено' });
    }

    // Видаляємо файл з диску
    const filePath = path.join(__dirname, '..', 'uploads', model.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Model3D.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Модель успішно видалено' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
