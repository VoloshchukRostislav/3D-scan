require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const modelsRouter = require('./routes/models');
const generateRouter = require('./routes/generate');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Підключення до MongoDB ─────────────────
connectDB();

// ─── CORS ───────────────────────────────────
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Парсинг JSON ───────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Статичний доступ до завантажених файлів ─
// Наприклад: GET http://localhost:3001/uploads/filename.glb
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Маршрути API ───────────────────────────
app.use('/api/models', modelsRouter);
app.use('/api/generate', generateRouter);

// ─── Корінь (перевірка стану сервера та віддача Фронтенду) ─
app.use(express.static(path.join(__dirname, '..')));

app.get('/api-status', (req, res) => {
  res.json({ message: '3D Scan API працює ✅', version: '1.0.0' });
});

// ─── Обробка невідомих маршрутів (404) ──────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Маршрут ${req.originalUrl} не знайдено` });
});

// ─── Глобальна обробка помилок ───────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Помилка сервера:', err.message);

  // Multer-специфічні помилки
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Файл занадто великий. Максимальний розмір — 100 MB',
    });
  }

  if (err.message && err.message.includes('Непідтримуваний формат')) {
    return res.status(415).json({ success: false, message: err.message });
  }

  // Mongoose помилки валідації
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join('; ') });
  }

  // Mongoose: невірний ObjectId
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Невірний формат ID' });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Внутрішня помилка сервера',
  });
});

// ─── Запуск сервера ──────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
});
