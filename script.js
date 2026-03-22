// ─── API Configuration ────────────────────────────────────────────
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : 'https://threed-scan-server.onrender.com/api';

// ─── API Helper ───────────────────────────────────────────────────
const api = {
    async getModels() {
        const res = await fetch(`${API_BASE}/models`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Не вдалося завантажити моделі');
        return data.data;
    },

    async uploadModel(file, description = '') {
        const formData = new FormData();
        formData.append('model', file);
        formData.append('description', description);

        const res = await fetch(`${API_BASE}/models/upload`, {
            method: 'POST',
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Помилка завантаження');
        return data.data;
    },

    async resizeImage(file, maxPixels = 4000000) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                const totalPixels = width * height;
                
                if (totalPixels <= maxPixels) {
                    resolve(file); // no need to resize
                    return;
                }
                
                const ratio = Math.sqrt(maxPixels / totalPixels);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, {
                            type: file.type || 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(newFile);
                    } else {
                        reject(new Error('Помилка генерації зображення'));
                    }
                }, file.type || 'image/jpeg', 0.9);
            };
            img.onerror = () => reject(new Error('Не вдалося завантажити зображення для зміни розміру'));
            img.src = URL.createObjectURL(file);
        });
    },

    async generateModel(imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);

        // Цей запит триватиме ~5-15 секунд
        const res = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Помилка генерації');
        return data.data; // повертає створену модель
    },

    async deleteModel(id) {
        const res = await fetch(`${API_BASE}/models/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Помилка видалення');
        return data;
    },

    async renameModel(id, newName) {
        const res = await fetch(`${API_BASE}/models/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Помилка перейменування');
        return data.data;
    },

    getFileUrl(filename) {
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `http://localhost:3001/uploads/${filename}`
            : `https://threed-scan-server.onrender.com/uploads/${filename}`;
    }
};

// ─── App State & Routing ──────────────────────────────────────────
const app = {
    currentScreen: 'home-screen',
    uploadedFiles: [],       // файли зображень для scan-процесу
    currentModelId: null,    // ID відкритої моделі у viewer
    currentModelName: null,  // ім'я для завантаження

    // UI Elements — заповнюються в init() після DOMContentLoaded
    elements: {},

    // ─── Init ────────────────────────────────────────────────────
    init() {
        // Запитуємо DOM тільки після того як він готовий
        this.elements = {
            navBtns: document.querySelectorAll('.nav-btn'),
            screens: document.querySelectorAll('.screen'),
            dropZone: document.getElementById('drop-zone'),
            photoInput: document.getElementById('photo-input'),
            videoInput: document.getElementById('video-input'),
            previewSection: document.getElementById('preview-section'),
            imageGrid: document.getElementById('image-grid'),
            fileCount: document.getElementById('file-count'),
            startProcessBtn: document.getElementById('start-process-btn'),
            galleryGrid: document.getElementById('gallery-grid'),
            // Processing
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            processStatus: document.getElementById('processing-status'),
            processDetails: document.getElementById('processing-details'),
            // Three.js
            canvasContainer: document.getElementById('three-canvas-container'),
            // 3D model direct upload
            modelFileInput: document.getElementById('model-file-input'),
            // Toast
            toast: document.getElementById('upload-toast'),
            toastMsg: document.getElementById('upload-toast-msg')
        };

        this.setupEventListeners();
        this.navigateTo('home-screen');
        this.loadGallery();
    },

    // ─── Navigation ──────────────────────────────────────────────
    navigateTo(screenId) {
        this.elements.screens.forEach(s => s.classList.remove('active'));
        this.elements.navBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.target === screenId);
        });
        const target = document.getElementById(screenId);
        if (target) target.classList.add('active');
        this.currentScreen = screenId;

        if (screenId === 'viewer-screen') {
            setTimeout(() => this.initThreeJS(), 100);
        }
        if (screenId === 'gallery-screen') {
            this.loadGallery();
        }
    },

    // ─── Event Listeners ─────────────────────────────────────────
    setupEventListeners() {
        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.target) this.navigateTo(btn.dataset.target);
            });
        });

        // Drag & Drop
        this.elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.add('dragover');
        });
        this.elements.dropZone.addEventListener('dragleave', () => {
            this.elements.dropZone.classList.remove('dragover');
        });
        this.elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) this.handleFiles(e.dataTransfer.files);
        });

        // File Inputs (фото/відео для scan-процесу)
        if (this.elements.photoInput) {
            this.elements.photoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) this.handleFiles(e.target.files);
            });
        }
        if (this.elements.videoInput) {
            this.elements.videoInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) this.handleVideoScan(e.target.files[0]);
            });
        }

        // 3D model file upload (GLB / OBJ / STL)
        this.elements.modelFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            e.target.value = ''; // reset so same file can be re-selected
            await this.uploadModelFile(file);
        });
    },

    // ─── File Handling (фото для scan-процесу) ───────────────────
    handleFiles(files) {
        const newFiles = Array.from(files);
        if (newFiles.length === 0) return;
        this.uploadedFiles = [...this.uploadedFiles, ...newFiles];
        this.updateUploadUI();
    },

    updateUploadUI() {
        this.elements.dropZone.style.display = 'none';
        this.elements.previewSection.style.display = 'block';
        this.elements.startProcessBtn.disabled = false;
        this.elements.fileCount.textContent = `Вибрано фото: ${this.uploadedFiles.length}`;
        this.elements.imageGrid.innerHTML = '';

        this.uploadedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const card = document.createElement('div');
                card.className = 'img-preview-card';
                card.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button class="remove-btn" onclick="app.removeFile(${index})">
                        <i class="ph ph-x"></i>
                    </button>
                `;
                this.elements.imageGrid.appendChild(card);
            };
            reader.readAsDataURL(file);
        });
    },

    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        if (this.uploadedFiles.length === 0) this.clearUploads();
        else this.updateUploadUI();
    },

    clearUploads() {
        this.uploadedFiles = [];
        if (this.elements.photoInput) this.elements.photoInput.value = '';
        if (this.elements.videoInput) this.elements.videoInput.value = '';
        this.elements.dropZone.style.display = 'flex';
        this.elements.previewSection.style.display = 'none';
        this.elements.startProcessBtn.disabled = true;
    },

    // ─── Відео-сканування (Справжня фотограмметрія) ────────────────
    handleVideoScan(file) {
        // Оскільки API для відео (Luma AI) ще очікує підключення ключа,
        // показуємо повідомлення користувачеві
        alert('Відео успішно завантажено! (Тут буде відправка на Luma AI API для генерації)');
        
        // Для дипломної: зберігаємо файл щоб хоча б імітувати процес
        this.uploadedFiles = [file];
        this.updateUploadUI();
    },

    // ─── Processing (Реальна генерація 3D через AI) ──────────────
    startProcessing() {
        if (this.uploadedFiles.length === 0) return;
        
        // Stability Fast 3D приймає лише одне фото для генерації
        // Якщо користувач завантажив кілька — беремо лише перше
        const imageToProcess = this.uploadedFiles[0];
        
        this.navigateTo('processing-screen');
        this.runGeneration(imageToProcess);
    },

    async runGeneration(imageFile) {
        // Початковий інтерфейс очікування
        this.elements.progressFill.style.width = '10%';
        this.elements.progressFill.style.transition = 'width 10s ease-out';
        this.elements.progressText.textContent = '...';
        this.elements.processStatus.textContent = 'Відправка на штучний інтелект...';
        this.elements.processStatus.classList.remove('text-success', 'text-danger');
        this.elements.processDetails.textContent = 'Це може зайняти 10-20 секунд (Stability Fast 3D)';

        // Симулюємо рух прогрес-бару поки чекаємо відповіді від API
        setTimeout(() => {
            this.elements.progressFill.style.width = '85%';
            this.elements.processStatus.textContent = 'Генерація 3D моделі...';
        }, 1000);

        try {
            // Оптимізуємо зображення (Stability Fast 3D приймає макс 4.19М пікселів)
            this.elements.processStatus.textContent = 'Оптимізація фотографії...';
            const resizedFile = await api.resizeImage(imageFile, 4000000);

            // Симулюємо рух прогрес-бару поки чекаємо відповіді від API
            this.elements.progressFill.style.width = '85%';
            this.elements.processStatus.textContent = 'Генерація 3D моделі...';
            
            // Реальний виклик нашого бекенду -> Stability AI
            const generatedModel = await api.generateModel(resizedFile);

            // Успіх
            this.elements.progressFill.style.transition = 'width 0.5s';
            this.elements.progressFill.style.width = '100%';
            this.elements.progressText.textContent = '100%';
            this.elements.processStatus.textContent = 'Успішно завершено!';
            this.elements.processStatus.classList.add('text-success');
            this.elements.processDetails.textContent = 'Модель збережено в базі.';

            this.clearUploads();
            await this.loadGallery();

            // Автоматично показуємо згенеровану модель
            setTimeout(() => {
                this.openViewer(generatedModel._id, generatedModel.originalName, generatedModel.filename);
                this.elements.processStatus.classList.remove('text-success');
            }, 1500);

        } catch (err) {
            // Помилка
            this.elements.progressFill.style.width = '0%';
            this.elements.processStatus.textContent = 'Помилка генерації';
            this.elements.processStatus.classList.add('text-danger');
            this.elements.processDetails.textContent = err.message;
        }
    },

    updateProcessStatus() {
        // Залишено для кнопки в інтерфейсі (в разі чого оновлює галерею)
        this.loadGallery();
    },

    // ─── Gallery (реальні дані з бекенду) ────────────────────────
    async loadGallery() {
        try {
            this.elements.galleryGrid.innerHTML = '<p style="color:var(--text-muted);padding:2rem;">Завантаження...</p>';
            const models = await api.getModels();
            this.renderGallery(models);
        } catch (err) {
            this.elements.galleryGrid.innerHTML = `
                <p style="color:var(--danger);padding:2rem;">
                    <i class="ph ph-warning"></i> Не вдалося завантажити моделі.<br>
                    <small>Переконайтесь, що бекенд запущено на localhost:3001</small>
                </p>`;
            console.error('loadGallery error:', err);
        }
    },

    renderGallery(models) {
        this.elements.galleryGrid.innerHTML = '';

        if (!models || models.length === 0) {
            this.elements.galleryGrid.innerHTML = `
                <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
                    <i class="ph ph-cube" style="font-size:3rem"></i>
                    <p>Ще немає моделей. Завантажте першу!</p>
                </div>`;
            return;
        }

        models.forEach(model => {
            const card = document.createElement('div');
            card.className = 'model-card glass-panel';
            const date = new Date(model.createdAt).toLocaleDateString('uk-UA');
            const sizeMB = (model.size / (1024 * 1024)).toFixed(1);
            const formatBadge = model.format.toUpperCase();

            card.innerHTML = `
                <div class="model-thumbnail" onclick="app.openViewer('${model._id}', '${model.originalName}', '${model.filename}')">
                    <i class="ph ph-cube"></i>
                    <span class="model-badge" style="color:var(--primary)">${formatBadge}</span>
                </div>
                <div class="model-info">
                    <h4>${model.originalName}</h4>
                    <div class="model-meta">
                        <span><i class="ph ph-calendar-blank"></i> ${date}</span>
                        <span><i class="ph ph-hard-drive"></i> ${sizeMB} MB</span>
                    </div>
                    <div class="model-actions">
                        <button class="btn btn-ghost btn-small" title="Перейменувати"
                            onclick="app.renameModel('${model._id}', '${model.originalName}')">
                            <i class="ph ph-pencil-simple text-primary"></i>
                        </button>
                        <button class="btn btn-ghost btn-small" title="Видалити"
                            onclick="app.deleteModel('${model._id}', this)">
                            <i class="ph ph-trash text-danger"></i>
                        </button>
                        <button class="btn btn-secondary btn-small" title="Завантажити"
                            onclick="api.downloadModel('${model._id}', '${model.originalName}')">
                            <i class="ph ph-download-simple"></i>
                        </button>
                    </div>
                </div>
            `;
            this.elements.galleryGrid.appendChild(card);
        });
    },

    // ─── Toast helper ─────────────────────────────────────────────
    showToast(msg, isError = false) {
        const toast = this.elements.toast;
        this.elements.toastMsg.textContent = msg;
        toast.style.display = 'block';
        toast.style.borderColor = isError
            ? 'rgba(239,68,68,0.6)'
            : 'rgba(99,102,241,0.4)';
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
    },

    // ─── Upload 3D model file directly ───────────────────────────
    async uploadModelFile(file) {
        this.showToast(`⏳ Завантаження «${file.name}»...`);
        try {
            const model = await api.uploadModel(file);
            this.showToast(`✅ «${model.originalName}» збережено!`);
            await this.loadGallery();
            return model;
        } catch (err) {
            this.showToast(`❌ ${err.message}`, true);
        }
    },

    // ─── Delete Model ─────────────────────────────────────────────
    async deleteModel(id, btnEl) {
        if (!confirm('Видалити модель? Цю дію не можна скасувати.')) return;
        try {
            btnEl.disabled = true;
            await api.deleteModel(id);
            await this.loadGallery();
        } catch (err) {
            alert(`Помилка видалення: ${err.message}`);
            btnEl.disabled = false;
        }
    },

    // ─── Rename Model ─────────────────────────────────────────────
    async renameModel(id, currentName) {
        const newName = prompt('Введіть нову назву моделі:', currentName);
        if (newName === null || newName.trim() === '' || newName === currentName) return;
        
        try {
            await api.renameModel(id, newName.trim());
            this.showToast('✅ Модель успішно перейменовано!');
            await this.loadGallery();
            
            // Якщо модель відкрита у в'ювері, оновлюємо заголовок
            if (this.currentModelId === id) {
                this.currentModelName = newName.trim();
                document.getElementById('viewer-title').textContent = this.currentModelName;
            }
        } catch (err) {
            alert(`Помилка перейменування: ${err.message}`);
        }
    },

    // ─── Open Viewer ──────────────────────────────────────────────
    openViewer(id, originalName, filename) {
        this.currentModelId = id;
        this.currentModelName = originalName;
        this.currentModelFile = filename;
        document.getElementById('viewer-title').textContent = originalName;
        this.viewerInitialized = false; // reset so Three.js reloads
        this.navigateTo('viewer-screen');
    },

    // ─── Download from viewer ─────────────────────────────────────
    async downloadModel(format = 'glb') {
        if (!this.currentModelId) {
            alert('Спочатку оберіть модель у галереї.');
            return;
        }

        const id = this.currentModelId;
        const originalName = this.currentModelName || 'model';
        const baseName = originalName.replace(/\.[^/.]+$/, ""); // видаляємо розширення

        try {
            if (format === 'glb') {
                // Оригінальне завантаження з бекенду
                const res = await fetch(`${API_BASE}/models/${id}/file`);
                if (!res.ok) throw new Error('Файл не знайдено');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = originalName;
                a.click();
                URL.revokeObjectURL(url);
            } else if (format === 'obj' && this.currentThreeScene) {
                // Експорт в OBJ
                const exporter = new THREE.OBJExporter();
                const result = exporter.parse(this.currentThreeScene);
                const blob = new Blob([result], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${baseName}.obj`;
                a.click();
                URL.revokeObjectURL(url);
            } else if (format === 'stl' && this.currentThreeScene) {
                // Експорт в STL
                const exporter = new THREE.STLExporter();
                const result = exporter.parse(this.currentThreeScene);
                const blob = new Blob([result], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${baseName}.stl`;
                a.click();
                URL.revokeObjectURL(url);
            } else {
                alert("Модель ще завантажується або формат не підтримується.");
            }
        } catch (err) {
            alert(`Помилка завантаження: ${err.message}`);
        }
    },

    // ─── Three.js Viewer ──────────────────────────────────────────
    initThreeJS() {
        if (this.viewerInitialized) return;

        const container = this.elements.canvasContainer;
        container.innerHTML = '';

        const scene = new THREE.Scene();
        scene.background = null;
        this.currentThreeScene = scene;

        const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.set(0, 2, 5);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 2.0;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 5, 5);
        scene.add(dirLight);
        const pointLight = new THREE.PointLight(0x6366f1, 1, 10);
        pointLight.position.set(-2, -2, 2);
        scene.add(pointLight);

        // Спробуємо завантажити реальний GLB, якщо є
        if (this.currentModelFile && this.currentModelFile.endsWith('.glb')) {
            const loader = new THREE.GLTFLoader();

            loader.load(
                api.getFileUrl(this.currentModelFile),
                (gltf) => {
                    const model = gltf.scene;

                    // Знайдемо центр і розмір моделі щоб правильно налаштувати камеру
                    const box = new THREE.Box3().setFromObject(model);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());

                    // Вирівняємо модель по центру
                    model.position.x += (model.position.x - center.x);
                    model.position.y += (model.position.y - center.y);
                    model.position.z += (model.position.z - center.z);

                    // Підберемо відстань камери відповідно до розміру моделі
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const fov = camera.fov * (Math.PI / 180);
                    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                    cameraZ *= 1.5; // відступ

                    camera.position.set(0, cameraZ * 0.5, cameraZ);
                    camera.lookAt(0, 0, 0);
                    controls.target.set(0, 0, 0);
                    controls.update();

                    scene.add(model);
                },
                (xhr) => {
                    // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                (error) => {
                    console.error('Помилка завантаження моделі:', error);
                    this.addPlaceholderMesh(scene);
                }
            );
        } else {
            this.addPlaceholderMesh(scene);
        }

        controls.addEventListener('start', () => { controls.autoRotate = false; });

        window.addEventListener('resize', () => {
            if (this.currentScreen !== 'viewer-screen') return;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });

        const animate = () => {
            requestAnimationFrame(animate);
            if (this.currentScreen === 'viewer-screen') {
                controls.update();
                renderer.render(scene, camera);
            }
        };
        animate();
        this.viewerInitialized = true;
    },

    addPlaceholderMesh(scene) {
        const geometry = new THREE.IcosahedronGeometry(2, 2);
        const solidMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color: 0x8b5cf6, roughness: 0.2, metalness: 0.8
        }));
        const wireMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
            color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.3
        }));
        const group = new THREE.Group();
        group.add(solidMesh);
        group.add(wireMesh);
        scene.add(group);
    }
};

// ─── Bootstrap ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { app.init(); });
