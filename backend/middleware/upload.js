const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Переконатись, що папка uploads існує
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Дозволені розширення
const ALLOWED_EXTENSIONS = ['.glb', '.obj', '.stl'];

// Налаштування зберігання
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Унікальне ім'я: timestamp + оригінальне ім'я (без пробілів)
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    const sanitized = file.originalname.replace(/\s+/g, '_');
    cb(null, `${uniquePrefix}-${sanitized}`);
  },
});

// Фільтр типів файлів
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Непідтримуваний формат файлу "${ext}". Дозволено: ${ALLOWED_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
});

module.exports = upload;
