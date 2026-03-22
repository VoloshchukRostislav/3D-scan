const mongoose = require('mongoose');

const Model3DSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: [true, 'Оригінальна назва файлу обов\'язкова'],
      trim: true,
    },
    filename: {
      type: String,
      required: [true, 'Назва збереженого файлу обов\'язкова'],
      unique: true,
    },
    mimetype: {
      type: String,
    },
    size: {
      type: Number, // розмір у байтах
      required: true,
    },
    format: {
      type: String,
      enum: ['glb', 'obj', 'stl'],
      required: [true, 'Формат файлу обов\'язковий'],
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true, // автоматично додає createdAt та updatedAt
  }
);

module.exports = mongoose.model('Model3D', Model3DSchema);
