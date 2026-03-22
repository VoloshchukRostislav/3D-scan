# 3D Scan Backend 🗄️

Backend для веб-додатку 3D сканування. Node.js + Express + MongoDB.

---

## Структура проєкту

```
backend/
├── config/
│   └── db.js              # Підключення до MongoDB
├── middleware/
│   └── upload.js          # Multer — обробка завантаження файлів
├── models/
│   └── Model3D.js         # Mongoose-схема для 3D моделей
├── routes/
│   └── models.js          # API маршрути (/api/models)
├── uploads/               # Папка зі збереженими файлами моделей
│   └── .gitkeep
├── .env.example           # Шаблон змінних середовища
├── package.json
└── server.js              # Точка входу — Express сервер
```

---

## Вимоги

- [Node.js](https://nodejs.org/) v18+
- [MongoDB](https://www.mongodb.com/try/download/community) (локально) або [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (хмарно)

---

## Запуск локально

### 1. Перейдіть в папку backend

```bash
cd backend
```

### 2. Встановіть залежності

```bash
npm install
```

### 3. Налаштуйте змінні середовища

Скопіюйте `.env.example` у `.env`:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
```

Відкрийте `.env` і відредагуйте:

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/scan3d
ALLOWED_ORIGIN=http://localhost:5500
```

> **Підказка:** якщо використовуєте MongoDB Atlas, замініть `MONGO_URI` на рядок підключення з Atlas.

### 4. Запустіть сервер

```bash
# Продакшн (звичайний запуск)
npm start

# Розробка (з автоперезапуском при змінах)
npm run dev
```

Сервер буде доступний на `http://localhost:3001`.

---

## API Ендпоінти

| Метод | URL | Опис |
|-------|-----|------|
| `POST` | `/api/models/upload` | Завантажити 3D модель |
| `GET` | `/api/models` | Список усіх моделей |
| `GET` | `/api/models/:id` | Метадані конкретної моделі |
| `GET` | `/api/models/:id/file` | Завантажити файл моделі |
| `DELETE` | `/api/models/:id` | Видалити модель |

---

## Приклади fetch-запитів (frontend JavaScript)

### 1. Завантаження моделі (POST)

```javascript
async function uploadModel(file, description = '') {
  const formData = new FormData();
  formData.append('model', file);          // поле 'model' — обов'язкове
  formData.append('description', description);

  const response = await fetch('http://localhost:3001/api/models/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Помилка завантаження');
  }

  console.log('Модель завантажено:', data.data);
  return data.data; // об'єкт моделі з _id, filename, format тощо
}

// Використання з <input type="file">
document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    try {
      const model = await uploadModel(file, 'Моя 3D модель');
      console.log('ID моделі:', model._id);
    } catch (err) {
      console.error(err.message);
    }
  }
});
```

### 2. Отримання списку всіх моделей (GET)

```javascript
async function getModels() {
  const response = await fetch('http://localhost:3001/api/models');
  const data = await response.json();

  if (!response.ok) throw new Error(data.message);

  console.log(`Всього моделей: ${data.count}`);
  data.data.forEach((model) => {
    console.log(`• ${model.originalName} [${model.format.toUpperCase()}] — ${(model.size / 1024).toFixed(1)} KB`);
  });

  return data.data;
}
```

### 3. Отримання конкретної моделі (GET)

```javascript
async function getModelById(id) {
  const response = await fetch(`http://localhost:3001/api/models/${id}`);
  const data = await response.json();

  if (!response.ok) throw new Error(data.message);

  console.log('Модель:', data.data);
  return data.data;
}
```

### 4. Завантаження файлу моделі (GET)

```javascript
async function downloadModel(id, filename) {
  const response = await fetch(`http://localhost:3001/api/models/${id}/file`);

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message);
  }

  // Створюємо посилання для авто-завантаження
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 5. Видалення моделі (DELETE)

```javascript
async function deleteModel(id) {
  const response = await fetch(`http://localhost:3001/api/models/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) throw new Error(data.message);

  console.log(data.message); // "Модель успішно видалено"
}
```

### 6. Пряме посилання на файл (статичний URL)

Якщо вам потрібно вставити модель у Three.js або model-viewer — використовуйте статичне посилання:

```javascript
// Якщо знаєте filename з метаданих:
const modelUrl = `http://localhost:3001/uploads/${model.filename}`;

// Для Three.js GLTFLoader:
const loader = new THREE.GLTFLoader();
loader.load(modelUrl, (gltf) => {
  scene.add(gltf.scene);
});
```

---

## Підтримувані формати

| Формат | Розширення | MIME |
|--------|-----------|------|
| GL Binary | `.glb` | model/gltf-binary |
| Wavefront OBJ | `.obj` | text/plain |
| STL | `.stl` | model/stl |

Максимальний розмір файлу: **100 MB**
