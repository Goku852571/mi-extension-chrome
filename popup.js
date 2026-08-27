class FanFicCounter {
    constructor() {
        this.startDate = null;
        this.fanficName = '';
        this.currentRangeIndex = 1;
        this.weeklyIncrementEnabled = false;
        this.weeklyIncrementRange = null;
        this.patreonEnabled = false;
        this.patreonRange = null;
        this.incrementType = 'day';
        this.weeklyIncrementStarted = false;
        this.repeatCount = 1;
        this.currentRepetition = 0;
        
        // Propiedades para incremento aleatorio
        this.randomMaxDays = 4;
        this.randomPool = [];
        this.randomHistory = {};
        this.lastRandomValue = undefined;
        
        this.monthsSpanish = {
            'Jan': 'Ene', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Abr', 
            'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago', 
            'Sep': 'Sept', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dic'
        };
    }

    generateRanges() {
        const ranges = [];
        for (let i = 0; i < 4000; i += 25) {
            const start = i + 1;
            const end = Math.min(i + 25, 4000);
            ranges.push(`${start.toString().padStart(3, '0')}-${end.toString().padStart(3, '0')}`);
        }
        return ranges;
    }

    getCurrentRange() {
        const start = (this.currentRangeIndex - 1) * 25 + 1;
        const end = Math.min(this.currentRangeIndex * 25, 4000);
        return `${start.toString().padStart(3, '0')}-${end.toString().padStart(3, '0')}`;
    }

    shouldUseWeeklyIncrement() {
        if (!this.weeklyIncrementEnabled || !this.weeklyIncrementRange) return false;
        
        const currentRange = this.getCurrentRange();
        const currentStart = parseInt(currentRange.split('-')[0], 10);
        const selectedStart = parseInt(this.weeklyIncrementRange.split('-')[0], 10);
        
        // Se activa si estamos en el rango seleccionado o posterior
        if (currentStart >= selectedStart) {
            this.weeklyIncrementStarted = true;
            return true;
        }
        
        return this.weeklyIncrementStarted;
    }

    formatDateSpanish(date) {
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const spanishMonth = this.monthsSpanish[month] || month;
        return `${date.getDate()} ${spanishMonth} ${date.getFullYear()}`;
    }

    getIncrementedName() {
        const start = (this.currentRangeIndex - 1) * 25 + 1;
        const end = Math.min(this.currentRangeIndex * 25, 4000);
        const currentRange = `${start.toString().padStart(3, '0')}-${end.toString().padStart(3, '0')}`;
        
        let rangeText;
        if (this.patreonEnabled && this.patreonRange === currentRange) {
            rangeText = `${start.toString().padStart(3, '0')}-PATREON`;
        } else {
            rangeText = currentRange;
        }
        
        return `${this.fanficName} ${rangeText}`;
    }

    getPreviousRangeName() {
        // NUEVA LÓGICA: Si el flujo de subida ya pasó el rango de Patreon,
        // se debe buscar el video de Patreon para reutilizar sus detalles.
        if (this.patreonEnabled && this.patreonRange) {
            try {
                const currentStart = (this.currentRangeIndex - 1) * 25 + 1;
                const [patreonStartStr] = this.patreonRange.split('-');
                const patreonStart = parseInt(patreonStartStr, 10);

                // Si el inicio del rango actual es mayor que el inicio del rango de Patreon,
                // significa que ya lo pasamos.
                if (!isNaN(patreonStart) && currentStart > patreonStart) {
                    const patreonSearchName = `${this.fanficName} ${patreonStart.toString().padStart(3, '0')}-PATREON`;
                    console.log(`Búsqueda especial Patreon activada: ${patreonSearchName}`);
                    return patreonSearchName;
                }
            } catch (e) {
                console.error("Error al calcular el nombre de búsqueda de Patreon, se usará el método por defecto.", e);
            }
        }

        const fanficName = this.fanficName.trim();
        // Por solicitud, siempre buscar el rango 001-025
        return `${fanficName} 001-025`;
    }

    getNextRandomIncrement() {
        const N = this.randomMaxDays || 4;
        
        if (!this.randomPool || !Array.isArray(this.randomPool)) {
            this.randomPool = [];
        }
        
        if (this.randomPool.length === 0) {
            const pool = [];
            for (let i = 1; i <= N; i++) {
                pool.push(i);
            }
            
            // Fisher-Yates shuffle
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            
            // Evitar repetición consecutiva en la transición de lotes (refill)
            // Como hacemos pop(), el primer elemento devuelto será el del final del array.
            if (this.lastRandomValue !== undefined && N > 1 && pool[pool.length - 1] === this.lastRandomValue) {
                const swapIdx = Math.floor(Math.random() * (pool.length - 1));
                [pool[pool.length - 1], pool[swapIdx]] = [pool[swapIdx], pool[pool.length - 1]];
            }
            
            this.randomPool = pool;
        }
        
        const val = this.randomPool.pop();
        this.lastRandomValue = val;
        return val;
    }

    increment(keepRange = false) {
        const currentRange = this.getCurrentRange();
        const useWeekly = this.shouldUseWeeklyIncrement();
        const isPatreon = this.patreonEnabled && this.patreonRange === currentRange;
        
        if (this.incrementType === 'repeat') {
            this.currentRepetition++;
            if (this.currentRepetition >= this.repeatCount) {
                this.startDate.setDate(this.startDate.getDate() + 1);
                this.currentRepetition = 0;
            }
        } else if (this.incrementType === 'random') {
            if (useWeekly || (isPatreon && this.incrementType === 'week')) {
                this.startDate.setDate(this.startDate.getDate() + 7);
            } else {
                const stepKey = this.currentRangeIndex;
                let days = 1;
                if (this.randomHistory && this.randomHistory[stepKey] !== undefined) {
                    days = this.randomHistory[stepKey];
                } else {
                    days = this.getNextRandomIncrement();
                    if (!this.randomHistory) this.randomHistory = {};
                    this.randomHistory[stepKey] = days;
                }
                this.startDate.setDate(this.startDate.getDate() + days);
            }
        } else {
            // Lógica existente para 'day' y 'week'
            if (useWeekly || (isPatreon && this.incrementType === 'week')) {
                this.startDate.setDate(this.startDate.getDate() + 7);
            } else if (this.incrementType === 'day') {
                this.startDate.setDate(this.startDate.getDate() + 1);
            } else if (this.incrementType === 'week') {
                this.startDate.setDate(this.startDate.getDate() + 7);
            }
        }
        
        if (!keepRange && this.currentRangeIndex * 25 < 4000) {
            this.currentRangeIndex++;
        }
    }

    decrement() {
        const currentRange = this.getCurrentRange();
        const useWeekly = this.shouldUseWeeklyIncrement();
        const isPatreon = this.patreonEnabled && this.patreonRange === currentRange;
        
        if (this.incrementType === 'repeat') {
            if (this.currentRepetition > 0) {
                this.currentRepetition--;
            } else {
                this.startDate.setDate(this.startDate.getDate() - 1);
                this.currentRepetition = this.repeatCount - 1;
            }
        } else if (this.incrementType === 'random') {
            if (useWeekly || (isPatreon && this.incrementType === 'week')) {
                this.startDate.setDate(this.startDate.getDate() - 7);
            } else {
                const stepKey = this.currentRangeIndex - 1;
                let days = 1;
                if (this.randomHistory && this.randomHistory[stepKey] !== undefined) {
                    days = this.randomHistory[stepKey];
                }
                this.startDate.setDate(this.startDate.getDate() - days);
            }
        } else {
            // Lógica existente para 'day' y 'week'
            if (useWeekly || (isPatreon && this.incrementType === 'week')) {
                this.startDate.setDate(this.startDate.getDate() - 7);
            } else if (this.incrementType === 'day') {
                this.startDate.setDate(this.startDate.getDate() - 1);
            } else if (this.incrementType === 'week') {
                this.startDate.setDate(this.startDate.getDate() - 7);
            }
        }
        
        if (this.currentRangeIndex > 1) {
            this.currentRangeIndex--;
        }
    }
}

class YouTubeUploader {
    constructor() {
        this.counter = new FanFicCounter();
        this.videoFiles = [];
        this.currentVideoIndex = 0;
        this.isProcessing = false;
        this.isPaused = false;
        this.processState = 'config'; // config, processing, completed, error
        this.savedStateExists = false;
        this.savedConfigs = {};
        this.missingRanges = []; // Registrar saltos de rango
        this.uploadingFilesCount = 0;
        this.thumbnailImages = [];
        this.selectedStartImageIndex = 0;
        this.initialVideoIndex = 0;
        
        this.initializeUI();
        this.loadSavedData();
        
        // Auto-detección con pequeño retraso para asegurar que los listeners estén listos
        setTimeout(() => this.detectUploadingFiles(), 500);
    }

    initializeUI() {
        // Generar opciones de rangos
        const ranges = this.counter.generateRanges();
        console.log('Rangos generados:', ranges.length, 'total'); // Debug
        
        const rangeSelectors = ['startingRange', 'weeklyIncrementRange', 'patreonRange'];
        
        rangeSelectors.forEach(selectorId => {
            const selector = document.getElementById(selectorId);
            if (selector) {
                // Limpiar opciones existentes
                selector.innerHTML = '';
                
                // Agregar opción por defecto para selectores opcionales
                if (selectorId !== 'startingRange') {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Seleccionar rango...';
                    selector.appendChild(defaultOption);
                }
                
                // Agregar todas las opciones de rango
                ranges.forEach((range, index) => {
                    const option = document.createElement('option');
                    option.value = range;
                    option.textContent = range;
                    if (selectorId === 'startingRange' && index === 0) {
                        option.selected = true; // Seleccionar el primer rango por defecto
                    }
                    selector.appendChild(option);
                });
                
                console.log(`Selector ${selectorId} configurado con ${selector.options.length} opciones`); // Debug
            } else {
                console.error(`Selector ${selectorId} no encontrado`);
            }
        });

        // Event listeners para checkboxes
        document.getElementById('weeklyIncrementEnabled').addEventListener('change', (e) => {
            const rangeSelector = document.getElementById('weeklyIncrementRange');
            rangeSelector.disabled = !e.target.checked;
            if (!e.target.checked) {
                rangeSelector.value = ''; // Limpiar selección cuando se desactiva
            }
        });

        document.getElementById('patreonEnabled').addEventListener('change', (e) => {
            const rangeSelector = document.getElementById('patreonRange');
            rangeSelector.disabled = !e.target.checked;
            if (!e.target.checked) {
                rangeSelector.value = ''; // Limpiar selección cuando se desactiva
            }
        });

        // Event listener para el nuevo tipo de incremento
        document.querySelectorAll('input[name="incrementType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const repeatCountInput = document.getElementById('repeatCount');
                const randomMaxDaysInput = document.getElementById('randomMaxDays');
                const randomMaxDaysLabel = document.getElementById('randomMaxDaysLabel');
                
                if (e.target.id === 'incrementRepeat' && e.target.checked) {
                    repeatCountInput.disabled = false;
                } else {
                    repeatCountInput.disabled = true;
                }
                
                if (e.target.id === 'incrementRandom' && e.target.checked) {
                    randomMaxDaysInput.disabled = false;
                    if (randomMaxDaysLabel) randomMaxDaysLabel.style.color = 'var(--text-main)';
                } else {
                    randomMaxDaysInput.disabled = true;
                    if (randomMaxDaysLabel) randomMaxDaysLabel.style.color = 'var(--text-dim)';
                }
            });
        });

        // Event listener para miniaturas
        document.getElementById('thumbnailFiles').addEventListener('change', (e) => this.handleThumbnailFiles(e));


        // Event listeners para botones
        document.getElementById('startProcess').addEventListener('click', () => this.startProcess());
        document.getElementById('startIndividualProcess').addEventListener('click', () => this.startProcess(true));
        document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
        document.getElementById('clearConfig').addEventListener('click', () => this.clearConfiguration());
        document.getElementById('loadConfig').addEventListener('click', () => this.handleLoadConfig());
        document.getElementById('saveCurrentConfigBtn').addEventListener('click', () => this.handleSaveCurrentConfig());
        document.getElementById('deleteConfig').addEventListener('click', () => this.handleDeleteConfig());
        document.getElementById('saveAndPauseProcess').addEventListener('click', () => this.saveAndPauseProcess());
        document.getElementById('resumeSavedProcess').addEventListener('click', () => this.resumeSavedProcess());
        document.getElementById('pauseProcess').addEventListener('click', () => this.pauseProcess());
        document.getElementById('skipVideo').addEventListener('click', () => this.skipCurrentVideo());
        document.getElementById('finishCurrentVideo').addEventListener('click', () => this.finishCurrentVideo());
        document.getElementById('stopProcess').addEventListener('click', () => this.stopProcess());
        document.getElementById('manualNext').addEventListener('click', () => this.continueProcess());
        document.getElementById('refreshDetection').addEventListener('click', () => this.detectUploadingFiles());
        document.getElementById('previousStep').addEventListener('click', () => this.changeStep(-1));
        document.getElementById('continueProcess').addEventListener('click', () => this.continueWithNextBatch());
        document.getElementById('nextStep').addEventListener('click', () => this.changeStep(1));
        document.getElementById('previousVideoInList').addEventListener('click', () => this.previousVideoInList());
        document.getElementById('nextVideoInList').addEventListener('click', () => this.nextVideoInList());

        // Event listeners para utilidades
        document.getElementById('incrementCounter').addEventListener('click', () => this.manualIncrement());
        document.getElementById('decrementCounter').addEventListener('click', () => this.manualDecrement());
        document.getElementById('resetStartDate').addEventListener('click', () => this.resetStartDate());

        // Export/Import de configuraciones
        document.getElementById('exportConfigs').addEventListener('click', () => this.exportConfigs());
        document.getElementById('importConfigs').addEventListener('click', () => this.importConfigs());

        // Historial
        document.getElementById('toggleHistory').addEventListener('click', () => this.toggleHistory());
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());

        // Reintento de paso
        document.getElementById('retryCurrentStep').addEventListener('click', () => this.retryCurrentStep());

        // Establecer fecha por defecto si no hay una
        const dateInput = document.getElementById('startDate');
        if (dateInput && !dateInput.value) {
            dateInput.valueAsDate = new Date();
        }
    }

    handleThumbnailFiles(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        // Limpiar lista anterior para nueva carga
        this.thumbnailImages = [];
        this.selectedStartImageIndex = 0;
        
        const list = document.getElementById('thumbnailList');
        list.innerHTML = '<div class="status info">Procesando imágenes...</div>';
        list.style.display = 'block';

        let processedCount = 0;
        const tempImages = new Array(files.length);

        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                tempImages[index] = {
                    name: file.name,
                    dataUrl: e.target.result // Base64
                };
                
                processedCount++;
                if (processedCount === files.length) {
                    this.thumbnailImages = tempImages;
                    this.renderThumbnailList();
                    // Guardar estado inmediatamente para persistencia
                    this.saveCurrentState(true);
                    this.showSuccess(`✅ ${files.length} miniaturas cargadas y guardadas.`);
                }
            };
            reader.onerror = () => {
                console.error(`Error al leer archivo: ${file.name}`);
                processedCount++;
            };
            reader.readAsDataURL(file);
        });
    }

    renderThumbnailList() {
        const list = document.getElementById('thumbnailList');
        list.innerHTML = '';
        
        if (!this.thumbnailImages || this.thumbnailImages.length === 0) {
            list.style.display = 'none';
            return;
        }
        
        list.style.display = 'block';
        
        this.thumbnailImages.forEach((img, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            
            const imgElement = document.createElement('img');
            imgElement.src = img.dataUrl;
            imgElement.className = 'thumbnail-preview';
            
            const info = document.createElement('div');
            info.className = 'file-info';
            info.textContent = `${index + 1}. ${img.name}`;
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'startImage';
            radio.checked = index === (this.selectedStartImageIndex || 0);
            radio.title = 'Empezar con esta imagen';
            radio.addEventListener('change', () => {
                this.selectedStartImageIndex = index;
                this.saveCurrentState(true);
            });
            
            item.appendChild(imgElement);
            item.appendChild(info);
            item.appendChild(radio);
            
            list.appendChild(item);
        });
    }

    async startProcess(isIndividual = false) {
        if (this.savedStateExists) {
            if (!confirm('Hay un proceso guardado. ¿Quieres empezar uno nuevo y borrar el anterior?')) {
                return;
            }
        }
        if (!this.validateConfiguration(isIndividual)) return;

        this.saveConfiguration();

        // Ajustar el índice de inicio y el contador según la selección del usuario
        const startFileIndex = parseInt(document.getElementById('startingFileIndex').value, 10) || 1;
        this.currentVideoIndex = isIndividual ? 0 : Math.max(0, startFileIndex - 1);
        this.initialVideoIndex = this.currentVideoIndex; // Guardar punto de inicio para cálculo de imágenes

        if (isIndividual) {
            this.uploadingFilesCount = 1;
            this.isIndividualFlow = true;
        } else {
            this.isIndividualFlow = false;
        }

        this.processState = 'processing';
        this.isProcessing = true;
        this.isPaused = false;
        
        // Guardar estado inmediatamente
        // Limpiar estado guardado anterior antes de empezar uno nuevo
        this.clearSavedState(false); // No mostrar mensaje
        this.saveCurrentState(true); // Guardar el nuevo estado
        
        this.showProcessSection();
        this.updateProcessDisplay();
        
        // Verificar que estamos en YouTube Studio
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('studio.youtube.com')) {
                this.showError('Debes estar en YouTube Studio para usar esta extensión. Ve a https://studio.youtube.com/');
                return;
            }
            
            // Verificar que el content script está cargado
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            
            if (response && response.pong) {
                console.log('Conexión con content script establecida');
                
                // Enviar configuración inicial
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'startUpload',
                    config: this.getConfiguration(),
                    videoIndex: this.currentVideoIndex
                });
            } else {
                throw new Error('Content script no responde');
            }
            
        } catch (error) {
            console.error('Error de comunicación:', error);
            
            if (error.message.includes('Could not establish connection') || 
                error.message.includes('receiving end does not exist')) {
                this.showError('La extensión no se ha cargado correctamente. Recarga la página e intenta de nuevo.');
            } else if (error.message.includes('Content script no responde')) {
                this.showError('La página no está lista. Espera un momento y recarga la página.');
            } else {
                this.showError('Error al comunicarse con YouTube Studio. Verifica que estés en la página correcta y recarga.');
            }
        }
    }

    async testConnection() {
        this.showInfo('Probando conexión con YouTube Studio...');
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Verificar URL
            if (!tab.url.includes('studio.youtube.com')) {
                this.showError(`❌ No estás en YouTube Studio. URL actual: ${tab.url}`);
                return;
            }
            
            this.showInfo('✓ URL correcta. Probando comunicación...');
            
            // Probar comunicación
            const response = await Promise.race([
                chrome.tabs.sendMessage(tab.id, { action: 'ping' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            
            if (response && response.pong) {
                this.showSuccess('✅ Conexión exitosa! La extensión está lista para usar.');
            } else {
                this.showError('❌ No hay respuesta del content script. Recarga la página.');
            }
            
        } catch (error) {
            console.error('Error en test de conexión:', error);
            
            if (error.message === 'Timeout') {
                this.showError('❌ Timeout: La página no responde. Recarga YouTube Studio.');
            } else if (error.message.includes('Could not establish connection')) {
                this.showError('❌ Content script no cargado. Recarga la página y la extensión.');
            } else {
                this.showError(`❌ Error: ${error.message}`);
            }
        }
    }

    async detectUploadingFiles() {
        console.log('Iniciando detección de archivos en subida...');
        
        // Mostrar sección de detección
        document.getElementById('uploadDetectionSection').style.display = 'block';
        document.getElementById('uploadDetectionInfo').textContent = 'Detectando archivos en YouTube Studio...';
        document.getElementById('uploadDetectionInfo').className = 'status info';
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Verificar URL
            if (!tab.url.includes('studio.youtube.com')) {
                document.getElementById('uploadDetectionInfo').textContent = '❌ No estás en YouTube Studio';
                document.getElementById('uploadDetectionInfo').className = 'status error';
                return;
            }
            
            // Enviar mensaje para detectar archivos
            const response = await Promise.race([
                chrome.tabs.sendMessage(tab.id, { action: 'detectUploadingFiles' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            
            if (response && response.success !== undefined) {
                // Durante un lote activo, el total original es inmutable. La detección
                // de YouTube solo devuelve los diálogos restantes.
                const stored = await chrome.storage.local.get(['uploaderState']);
                const savedBatch = stored.uploaderState;
                const hasActiveSavedBatch = savedBatch &&
                    (savedBatch.processState === 'processing' || savedBatch.processState === 'paused') &&
                    Number.isInteger(savedBatch.uploadingFilesCount) &&
                    savedBatch.uploadingFilesCount > 0;

                this.uploadingFilesCount = hasActiveSavedBatch
                    ? savedBatch.uploadingFilesCount
                    : response.fileCount;
                
                if (response.detected && response.fileCount > 0) {
                    document.getElementById('uploadDetectionInfo').textContent = 
                        `✅ Se detectaron ${response.fileCount} archivo(s) en proceso de subida`;
                    document.getElementById('uploadDetectionInfo').className = 'status success';
                } else {
                    document.getElementById('uploadDetectionInfo').textContent = 
                        'ℹ️ No se detectaron archivos en proceso de subida';
                    document.getElementById('uploadDetectionInfo').className = 'status info';
                }
                
                console.log(`Archivos en subida detectados: ${response.fileCount}`);
                
            } else {
                throw new Error('Respuesta inválida del content script');
            }
            
        } catch (error) {
          
            
            if (error.message === 'Timeout') {
                document.getElementById('uploadDetectionInfo').textContent = '❌ Timeout: La página no responde';
            } else if (error.message.includes('Could not establish connection')) {
                document.getElementById('uploadDetectionInfo').textContent = '❌ Content script no cargado. Recarga la página';
            } else {
                document.getElementById('uploadDetectionInfo').textContent = `❌ Error: ${error.message}`;
            }
            document.getElementById('uploadDetectionInfo').className = 'status error';
        }
    }

    validateConfiguration(isIndividual = false) {
        const startDate = document.getElementById('startDate').value;
        const fanficName = document.getElementById('fanficName').value.trim();
        const startingRange = document.getElementById('startingRange').value;
        const startingFileIndex = parseInt(document.getElementById('startingFileIndex').value, 10);
        
        if (!startDate) {
            this.showError('Por favor selecciona una fecha de inicio');
            return false;
        }
        
        if (!fanficName) {
            this.showError('Por favor ingresa el nombre del FanFic');
            return false;
        }
        
        if (!startingRange) {
            this.showError('Por favor selecciona un rango inicial');
            return false;
        }
        
        if (!isIndividual && this.uploadingFilesCount === 0) {
            this.showError('No se detectaron archivos en proceso de subida. Usa el botón "Actualizar Detección" o selecciona archivos manualmente');
            return false;
        }

        if (!isIndividual && (isNaN(startingFileIndex) || startingFileIndex < 1)) {
            this.showError('El número de archivo de inicio debe ser 1 o mayor.');
            return false;
        }

        if (!isIndividual && startingFileIndex > this.uploadingFilesCount) {
            this.showError(`El archivo de inicio (${startingFileIndex}) no puede ser mayor que el total de archivos detectados (${this.uploadingFilesCount}).`);
            return false;
        }
        
        // Validar configuraciones opcionales
        if (document.getElementById('weeklyIncrementEnabled').checked) {
            const weeklyRange = document.getElementById('weeklyIncrementRange').value;
            if (!weeklyRange) {
                this.showError('Por favor selecciona un rango para el incremento semanal');
                return false;
            }
            // Ya se valida que sea seleccionado arriba, removemos la redundancia
        }
        
        if (document.getElementById('patreonEnabled').checked) {
            const patreonRange = document.getElementById('patreonRange').value;
            if (!patreonRange) {
                this.showError('Por favor selecciona un rango para PATREON');
                return false;
            }
        }
        
        return true;
    }

    saveConfiguration() {
        this.counter.startDate = new Date(document.getElementById('startDate').value);
        // Corrección para el problema de la zona horaria.
        // new Date('YYYY-MM-DD') crea la fecha en UTC. Para evitar que se reste un día
        // en zonas horarias negativas, agregamos 'T00:00:00' para forzar la interpretación
        // como hora local.
        const dateValue = document.getElementById('startDate').value;
        this.counter.startDate = new Date(`${dateValue}T00:00:00`);
        this.counter.fanficName = document.getElementById('fanficName').value.trim();
        
        const selectedRange = document.getElementById('startingRange').value;
        this.counter.currentRangeIndex = Math.floor((parseInt(selectedRange.split('-')[0]) - 1) / 25) + 1;
        
        this.counter.weeklyIncrementEnabled = document.getElementById('weeklyIncrementEnabled').checked;
        this.counter.weeklyIncrementRange = document.getElementById('weeklyIncrementEnabled').checked ? 
            document.getElementById('weeklyIncrementRange').value : null;
        
        this.counter.patreonEnabled = document.getElementById('patreonEnabled').checked;
        this.counter.patreonRange = document.getElementById('patreonEnabled').checked ? 
            document.getElementById('patreonRange').value : null;
        
        const incrementType = document.querySelector('input[name="incrementType"]:checked').value;
        this.counter.incrementType = incrementType;
        
        const oldMaxDays = this.counter.randomMaxDays;
        this.counter.randomMaxDays = parseInt(document.getElementById('randomMaxDays').value, 10) || 4;
        if (oldMaxDays !== this.counter.randomMaxDays) {
            this.counter.randomPool = [];
            this.counter.randomHistory = {};
            this.counter.lastRandomValue = undefined;
        }
        
        this.counter.repeatCount = parseInt(document.getElementById('repeatCount').value, 10) || 1;
        // Reiniciar el contador de repetición al guardar la configuración
        this.counter.currentRepetition = 0;
        this.counter.weeklyIncrementStarted = false; // Resetear indicador de inicio de incremento semanal
        
        console.log('Configuración guardada:', {
            startDate: this.counter.startDate,
            fanficName: this.counter.fanficName,
            currentRangeIndex: this.counter.currentRangeIndex,
            weeklyIncrementEnabled: this.counter.weeklyIncrementEnabled,
            weeklyIncrementRange: this.counter.weeklyIncrementRange,
            patreonEnabled: this.counter.patreonEnabled,
            patreonRange: this.counter.patreonRange,
            incrementType: this.counter.incrementType,
            repeatCount: this.counter.repeatCount,
            currentRepetition: this.counter.currentRepetition
        });
    }

    getConfiguration() {
        const currentRange = this.counter.getCurrentRange();
        const patreonRange = this.counter.patreonRange;
        
        // Determinar postPatreonFlow: true si Patreon está habilitado
        // y el inicio del rango actual es mayor que el fin del rango Patreon.
        let postPatreonFlow = false;
        if (this.counter.patreonEnabled && patreonRange) {
            try {
                const [patStartStr, patEndStr] = patreonRange.split('-');
                const [curStartStr] = currentRange.split('-');
                const patEnd = parseInt(patEndStr, 10);
                const curStart = parseInt(curStartStr, 10);
                if (!Number.isNaN(patEnd) && !Number.isNaN(curStart) && curStart > patEnd) {
                    postPatreonFlow = true;
                }
            } catch (e) {
                console.warn('Error parsing ranges for postPatreonFlow:', patreonRange, currentRange, e);
            }
        }

        // Lógica para seleccionar miniatura cíclica
        let thumbnailData = null;
        if (this.thumbnailImages && this.thumbnailImages.length > 0) {
            const startVideo = this.initialVideoIndex !== undefined ? this.initialVideoIndex : 0;
            const startImage = this.selectedStartImageIndex || 0;
            const relativeIndex = this.currentVideoIndex - startVideo;
            
            let imageIndex = (startImage + relativeIndex) % this.thumbnailImages.length;
            if (imageIndex < 0) imageIndex += this.thumbnailImages.length;
            
            thumbnailData = this.thumbnailImages[imageIndex].dataUrl;
        }

        return {
            fanficName: this.counter.fanficName,
            incrementedName: this.counter.getIncrementedName(),
            previousRangeName: this.counter.getPreviousRangeName(), // Nuevo: Nombre para búsqueda
            currentDate: this.counter.formatDateSpanish(this.counter.startDate),
            videoFile: null, // Ya no se manejan archivos locales
            currentRange: currentRange,
            isMonetized: document.getElementById('channelMonetized').checked,
            // Nueva bandera que indica al content script qué flujo debe ejecutar
            postPatreonFlow: postPatreonFlow,
            // Nueva bandera para usar archivos ya en subida
            useUploadingFiles: true, // Siempre es true ahora
            // Índice del archivo actual en la lista de subida
            currentFileIndex: this.currentVideoIndex,
            // Total de archivos en subida detectados
            totalUploadingFiles: this.uploadingFilesCount,
            channelType: document.querySelector('input[name="channelType"]:checked').value,
            // Datos de la miniatura para este video
            thumbnailData: thumbnailData,
            isIndividualFlow: this.isIndividualFlow || false
        };
    }

    async saveAndPauseProcess() {
        // Esta función ahora se usa al final de un lote.
        // El estado ya ha sido guardado por onVideoCompleted.
        // Simplemente detenemos el proceso y mostramos un mensaje.
        this.isProcessing = false;
        this.isPaused = false;
        this.processState = 'config';

        this.showSuccess('✅ Progreso para el siguiente lote guardado. Puedes cerrar la extensión.');

        // En lugar de llamar a stopProcess() que borra el estado,
        // reseteamos la UI manualmente para volver a la pantalla de configuración
        // pero manteniendo el estado guardado para la próxima vez.
        setTimeout(() => {
            document.getElementById('configSection').style.display = 'block';
            document.getElementById('processSection').style.display = 'none';
            document.getElementById('utilitySection').style.display = 'none';
            document.getElementById('completionSection').style.display = 'none';
            // No llamamos a clearSavedState() para que el progreso persista.
            this.showInfo('Listo para la próxima sesión.');
        }, 2000);
    }

    async resumeSavedProcess() {
        // Cargar el estado guardado (ya se hizo en loadSavedData)
        if (!this.savedStateExists) {
            this.showError('No se encontró un proceso guardado para reanudar.');
            return;
        }

        this.isProcessing = true;
        this.isPaused = false;
        this.processState = 'processing';

        this.showProcessSection();
        this.updateProcessDisplay();
        document.getElementById('activeFlowBadge').style.display = 'none'; // Ocultar hasta recibir el primer update del content script

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const result = await chrome.storage.local.get(['contentScriptState']);
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'resumeFromSavedState',
                state: result.contentScriptState || { config: this.getConfiguration(), step: 0 }
            });
            this.showSuccess('🚀 Proceso reanudado exitosamente.');
        } catch (error) {
            console.error('Error al reanudar:', error);
            this.showError('Error al reanudar el proceso. Verifica la página y reintenta.');
        }
    }

    showProcessSection() {
        document.getElementById('configSection').style.display = 'none';
        document.getElementById('processSection').style.display = 'block';
        document.getElementById('utilitySection').style.display = 'block';
    }

    // Restaura la UI a la pantalla de configuración con ambos botones visibles.
    // El botón de Reanudar se muestra junto al de Iniciar para que el usuario elija.
    _restoreToConfigWithResume() {
        this.isProcessing = false;
        this.isPaused = false;
        this.processState = 'config';

        document.getElementById('configSection').style.display = 'block';
        document.getElementById('processSection').style.display = 'none';
        document.getElementById('utilitySection').style.display = 'none';
        document.getElementById('completionSection').style.display = 'none';

        // Siempre mostrar el botón de Iniciar
        document.getElementById('startProcess').style.display = 'block';
        // Mostrar Reanudar sólo si hay un progreso guardado
        document.getElementById('resumeSavedProcess').style.display = 'block';
    }


    updateProcessDisplay() {
        document.getElementById('currentDate').textContent = this.counter.formatDateSpanish(this.counter.startDate);
        document.getElementById('originalName').textContent = this.counter.fanficName;
        document.getElementById('incrementedName').textContent = this.counter.getIncrementedName();
        
        document.getElementById('currentVideo').textContent = `Archivo ${this.currentVideoIndex + 1} de la lista de subida`;
        document.getElementById('videoProgress').textContent = this.currentVideoIndex + 1;
        document.getElementById('totalVideos').textContent = this.uploadingFilesCount;
        
        document.getElementById('currentRange').textContent = this.counter.getCurrentRange();
        
        const totalFiles = this.uploadingFilesCount;
        const progress = totalFiles > 0 ? ((this.currentVideoIndex + 1) / totalFiles) * 100 : 0;
        const progressBar = document.getElementById('progressBar');
        progressBar.style.width = `${progress}%`;
        progressBar.textContent = `${Math.round(progress)}%`;
    }

    async onVideoCompleted(messageData) {
        let keepRange = false;
        if (messageData && messageData.part) {
            if (messageData.part.match(/PARTE[-\s]*1/i)) {
                keepRange = true;
                this.showInfo('Parte 1 detectada. Rango mantenido para la próxima subida.');
            }
        }

        this.currentVideoIndex++;
        
        // Guardar en historial
        this.saveToHistory({
            date: new Date().toLocaleString('es-CO'),
            fanficName: this.counter.fanficName,
            range: this.counter.getCurrentRange(),
            status: '✅ Completado'
        });

        if (this.currentVideoIndex >= this.uploadingFilesCount) {
            // Proceso completado
            this.processState = 'completed';
            
            if (this.missingRanges && this.missingRanges.length > 0) {
                const rangesStr = this.missingRanges.join(', ');
                this.showSuccess(`¡Lote procesado! Se detectaron rangos faltantes: ${rangesStr}`);
                this.missingRanges = []; // Limpiar para el siguiente lote
            } else {
                this.showSuccess('¡Todos los archivos en subida han sido procesados exitosamente!');
            }
            
            this.isProcessing = false;
            this.isPaused = true; // Pausamos para que no intente continuar automáticamente

            // --- NUEVA LÓGICA ---
            // 1. Incrementar el contador para el *siguiente* lote.
            this.counter.increment(keepRange);

            // 1.5 Adelantar el selector de imagen para el siguiente lote
            if (this.thumbnailImages && this.thumbnailImages.length > 0) {
                const startVideo = this.initialVideoIndex !== undefined ? this.initialVideoIndex : 0;
                const startImage = this.selectedStartImageIndex || 0;
                const videosProcessed = this.uploadingFilesCount - startVideo;
                
                let nextImageIndex = (startImage + videosProcessed) % this.thumbnailImages.length;
                if (nextImageIndex < 0) nextImageIndex += this.thumbnailImages.length;
                
                this.selectedStartImageIndex = nextImageIndex;
                this.renderThumbnailList(); // Actualizar la UI visualmente
            }

            // 2. Guardar el estado *actualizado* (que es la configuración para el siguiente lote).
            this.saveCurrentState(true);
            this.saveCurrentConfig(); // También guardar la configuración de la UI.

            // 3. Disparar notificación de escritorio
            chrome.runtime.sendMessage({
                action: 'showNotification',
                title: '🎬 Lote Completado',
                body: `${this.counter.fanficName} - Todos los archivos procesados exitosamente.`
            });

            // 4. Mostrar la sección de finalización con las opciones.
            document.getElementById('completionSection').style.display = 'block';
            document.getElementById('pauseProcess').disabled = true;
            document.getElementById('skipVideo').disabled = true;
            document.getElementById('finishCurrentVideo').disabled = true;

        } else {
            // Si aún quedan videos, incrementamos el contador y guardamos el estado.
            this.counter.increment(keepRange);
            this.saveCurrentState(true);
            // Continuar con el siguiente archivo
            this.updateProcessDisplay();
            
            if (!this.isPaused) {
                setTimeout(() => {
                    this.startNextVideo();
                }, 2000); // Esperar 2 segundos antes del siguiente archivo
            }
        }
    }

    async startNextVideo() {
        if (this.isPaused || !this.isProcessing) return;
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Verificar conexión antes de continuar
            const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            
            if (!pingResponse || !pingResponse.pong) {
                throw new Error('Conexión perdida con la página');
            }
            
            await chrome.tabs.sendMessage(tab.id, {
                action: 'startUpload',
                config: this.getConfiguration(),
                videoIndex: this.currentVideoIndex
            });
        } catch (error) {
            console.error('Error al continuar:', error);
            this.showError('Error al continuar con el siguiente video. Verifica la conexión.');
            this.showManualNext();
        }
    }

    pauseProcess() {
        const button = document.getElementById('pauseProcess');

        if (!this.isPaused) {
            // --- PAUSAR ---
            this.isPaused = true;
            this.processState = 'paused';
            button.textContent = '▶️ Reanudar';
            button.disabled = false;
            // Guardar estado de pausa
            this.saveCurrentState(true);
            // Notificar al content script
            this.sendMessageToContentScript({ action: 'pauseProcess' });
            this.showInfo('⏸️ Proceso pausado. Presiona Reanudar para continuar.');
        } else {
            // --- REANUDAR ---
            this.isPaused = false;
            this.processState = 'processing';
            button.textContent = '⏸️ Pausar';
            button.disabled = true; // Deshabilitar mientras se reconecta
            // Guardar estado actualizado
            this.saveCurrentState(true);
            // Iniciar reanudación
            this.resumeProcess().finally(() => {
                button.disabled = false;
            });
        }
    }

    async resumeProcess() {
        // No verificar isPaused aquí porque ya lo pusimos en false antes de llamar
        if (!this.isProcessing) {
            this.showError('El proceso no está activo. Inicia uno nuevo.');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Verificar que estamos en YouTube Studio
            if (!tab.url || !tab.url.includes('studio.youtube.com')) {
                throw new Error('No estás en YouTube Studio');
            }

            // Verificar conexión
            const pingResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            if (!pingResponse || !pingResponse.pong) {
                throw new Error('Conexión perdida con la página');
            }

            // Obtener el último paso guardado
            const result = await chrome.storage.local.get(['currentStep']);
            const lastStep = result.currentStep ? result.currentStep.step : 0;

            this.showInfo('▶️ Reanudando desde el paso ' + (lastStep || 1) + '...');

            // Enviar comando 'resumeUpload' con el último paso conocido
            await chrome.tabs.sendMessage(tab.id, {
                action: 'resumeUpload',
                config: this.getConfiguration(),
                startFromStep: lastStep
            });
        } catch (error) {
            console.error('Error al reanudar el proceso:', error);
            // Si falla la reanudación, volver a estado pausado
            this.isPaused = true;
            this.processState = 'paused';
            const button = document.getElementById('pauseProcess');
            if (button) {
                button.textContent = '▶️ Reanudar';
                button.disabled = false;
            }
            this.saveCurrentState(true);
            this.showError('Error al reanudar: ' + error.message + '. Verifica la conexión y reintenta.');
        }
    }

    skipCurrentVideo() {
        this.onVideoCompleted();
    }

    finishCurrentVideo() {
        this.showInfo('Finalizando el video actual y preparando el siguiente...');
        // Detener el proceso actual en content.js para evitar ejecuciones superpuestas
        this.sendMessageToContentScript({ action: 'stopProcess' });
        
        // Esperar medio segundo para permitir que content.js limpie su estado antes de iniciar el siguiente
        setTimeout(() => {
            this.onVideoCompleted();
        }, 500);
    }

    stopProcess(fromContentScript = false) {
        this.isProcessing = false;
        this.isPaused = false;
        this.processState = 'config';
        
        if (!fromContentScript) {
            this.sendMessageToContentScript({ action: 'stopProcess' });
        }
        
        // Actualizar el estado en storage para que al abrir de nuevo el popup no intente reanudar automáticamente
        this.saveCurrentState(true);
        
        document.getElementById('configSection').style.display = 'block';
        document.getElementById('processSection').style.display = 'none';
        document.getElementById('utilitySection').style.display = 'none';
        document.getElementById('completionSection').style.display = 'none'; // Ocultar sección de completado
        
        // Asegurarnos de que el botón de inicio vuelva a aparecer
        document.getElementById('startProcess').style.display = 'block';
        if (this.savedStateExists) {
            document.getElementById('resumeSavedProcess').style.display = 'block';
        } else {
            document.getElementById('resumeSavedProcess').style.display = 'none';
        }
        
        this.showInfo('Proceso detenido. El progreso se conservó.');
        document.getElementById('activeFlowBadge').style.display = 'none';
    }

    clearSavedState(showMessage) {
        chrome.storage.local.remove(['uploaderState', 'videoFiles', 'currentStep', 'contentScriptState'], () => {
            this.savedStateExists = false;
            if (showMessage) console.log('Estado guardado limpiado.');
        });
    }

    continueWithNextBatch() {
        // 1. Resetear el estado del proceso, pero mantener el contador
        this.isProcessing = false;
        this.isPaused = false;
        this.processState = 'config';
        this.currentVideoIndex = 0;
        
        // 2. Limpiar solo el estado de la subida anterior, no la configuración general
        this.clearSavedState(false);
        
        // 3. Mostrar la sección de configuración y ocultar las demás
        document.getElementById('configSection').style.display = 'block';
        document.getElementById('processSection').style.display = 'none';
        document.getElementById('utilitySection').style.display = 'none';
        document.getElementById('completionSection').style.display = 'none';
        
        // Asegurar que el botón de iniciar vuelva a estar visible
        document.getElementById('startProcess').style.display = 'block';
        document.getElementById('resumeSavedProcess').style.display = 'none';
        
        document.getElementById('statusArea').innerHTML = '';
        
        // 4. Actualizar la UI con los valores del contador ya incrementado
        document.getElementById('startDate').valueAsDate = this.counter.startDate;
        document.getElementById('startingRange').value = this.counter.getCurrentRange();
        document.getElementById('startingFileIndex').value = 1; // Reiniciar el índice de archivo a 1

        this.showSuccess('Listo para el siguiente lote. El rango y la fecha han sido actualizados.');

        // 5. Guardar la configuración actualizada para que persista al cerrar el popup
        this.saveCurrentConfig();
    }

    sendMessageToContentScript(message) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, message)
                    .catch(error => console.log(`Error enviando mensaje '${message.action}':`, error));
            }
        });
    }

    continueProcess() {
        document.getElementById('manualNext').style.display = 'none';
        this.startNextVideo();
    }

    manualIncrement() {
        this.counter.increment();
        this.updateProcessDisplay();
        
        // Guardar estado después de incremento manual si el proceso está activo
        if (this.isProcessing) this.saveCurrentState(true);
    }

    manualDecrement() {
        this.counter.decrement();
        this.updateProcessDisplay();
        
        // Guardar estado después de decremento manual si el proceso está activo
        if (this.isProcessing) this.saveCurrentState(true);
    }

    previousVideoInList() {
        if (this.currentVideoIndex > 0) {
            this.currentVideoIndex--;
            this.updateProcessDisplay();
            if (this.isProcessing) this.saveCurrentState(true);
            this.showInfo(`Selección movida al archivo ${this.currentVideoIndex + 1}`);
        } else {
            this.showInfo('Ya estás en el primer archivo de la lista.');
        }
    }

    resetStartDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2); // Pasado mañana
        const year = tomorrow.getFullYear();
        const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const day = String(tomorrow.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        document.getElementById('startDate').value = formattedDate;
        this.counter.startDate = new Date(`${formattedDate}T00:00:00`);
        
        // Regresar el rango a 026-050
        const startingRangeElement = document.getElementById('startingRange');
        if (startingRangeElement) {
            startingRangeElement.value = "026-050";
            this.counter.currentRangeIndex = 2; // Índice correspondiente a 026-050
        }
        
        this.saveCurrentConfig();
        this.showSuccess('📅 Fecha reiniciada a pasado mañana y rango a 026-050');
    }

    // ─── Historial de subidas ──────────────────────────────────────────────────
    saveToHistory(entry) {
        chrome.storage.local.get(['uploadHistory'], (result) => {
            let history = result.uploadHistory || [];
            history.unshift(entry); // Más reciente primero
            if (history.length > 100) history = history.slice(0, 100); // Límite 100 entradas
            chrome.storage.local.set({ uploadHistory: history });
        });
    }

    loadHistory(callback) {
        chrome.storage.local.get(['uploadHistory'], (result) => {
            callback(result.uploadHistory || []);
        });
    }

    clearHistory() {
        if (!confirm('¿Borrar todo el historial de subidas?')) return;
        chrome.storage.local.remove(['uploadHistory'], () => {
            this.renderHistory([]);
            this.showSuccess('🗑️ Historial borrado.');
        });
    }

    toggleHistory() {
        const section = document.getElementById('historySection');
        const isVisible = section.style.display !== 'none';
        if (isVisible) {
            section.style.display = 'none';
            document.getElementById('toggleHistory').textContent = '📜 Ver Historial';
        } else {
            section.style.display = 'block';
            document.getElementById('toggleHistory').textContent = '🔼 Ocultar Historial';
            this.loadHistory((h) => this.renderHistory(h));
        }
    }

    renderHistory(history) {
        const list = document.getElementById('historyList');
        if (!history || history.length === 0) {
            list.innerHTML = '<div class="status info">No hay subidas registradas aún.</div>';
            return;
        }
        list.innerHTML = history.map(e =>
            `<div class="history-entry">
                <span class="history-status">${e.status}</span>
                <span class="history-name">${e.fanficName}</span>
                <span class="history-range">${e.range}</span>
                <span class="history-date">${e.date}</span>
            </div>`
        ).join('');
    }

    // ─── Export / Import de configuraciones ───────────────────────────────────
    async exportConfigs() {
        if (!this.savedConfigs || Object.keys(this.savedConfigs).length === 0) {
            this.showError('❌ No hay configuraciones guardadas para exportar.');
            return;
        }
        try {
            const data = JSON.stringify(this.savedConfigs, null, 2);
            await navigator.clipboard.writeText(data);
            this.showSuccess('📋 JSON de configuraciones copiado al portapapeles.');
        } catch (error) {
            console.error('Error copiando configuraciones:', error);
            this.showError('❌ No se pudo copiar el JSON al portapapeles.');
        }
    }

    async importConfigs() {
        this.showInfo('⏳ Leyendo JSON desde el portapapeles...');
        try {
            const text = await navigator.clipboard.readText();
            if (!text || text.trim() === '') {
                throw new Error('El portapapeles está vacío');
            }
            const imported = JSON.parse(text);
            if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
                throw new Error('El formato del JSON no es válido. Debe ser un objeto con configuraciones.');
            }
            const importedKeys = Object.keys(imported);
            if (importedKeys.length === 0) {
                throw new Error('El JSON no contiene configuraciones');
            }

            this.savedConfigs = { ...this.savedConfigs, ...imported };
            await chrome.storage.local.set({ savedFanFicConfigs: this.savedConfigs });
            this.populateConfigSelector();
            this.showSuccess(`✅ ${importedKeys.length} configuración(es) pegadas: ${importedKeys.join(', ')}`);
        } catch (error) {
            console.error('Error importando configuraciones:', error);
            const detail = error instanceof SyntaxError
                ? 'El contenido del portapapeles no es un JSON válido.'
                : error.message;
            this.showError('❌ Error al importar: ' + detail);
        }
    }

    // ─── Reintento de paso ────────────────────────────────────────────────────
    retryCurrentStep() {
        document.getElementById('retryCurrentStep').style.display = 'none';
        this.resumeProcess();
    }

    nextVideoInList() {
        if (this.currentVideoIndex < this.uploadingFilesCount - 1) {
            this.currentVideoIndex++;
            this.updateProcessDisplay();
            if (this.isProcessing) this.saveCurrentState(true);
            this.showInfo(`Selección movida al archivo ${this.currentVideoIndex + 1}`);
        } else {
            this.showInfo('Ya estás en el último archivo de la lista.');
        }
    }

    clearConfiguration() {
        // Mostrar confirmación antes de limpiar
        if (!confirm('¿Estás seguro de que quieres limpiar toda la configuración? Esta acción no se puede deshacer.')) {
            return;
        }
        
        // Limpiar formularios
        document.getElementById('startDate').value = '';
        document.getElementById('fanficName').value = '';
        document.getElementById('startingRange').selectedIndex = 0;
        document.getElementById('startingFileIndex').value = 1;
        
        // Limpiar checkboxes
        document.getElementById('weeklyIncrementEnabled').checked = false;
        document.getElementById('weeklyIncrementRange').disabled = true;
        document.getElementById('weeklyIncrementRange').selectedIndex = 0;
        
        document.getElementById('patreonEnabled').checked = false;
        document.getElementById('patreonRange').disabled = true;
        document.getElementById('patreonRange').selectedIndex = 0;
        
        // Limpiar radio buttons
        document.getElementById('incrementDay').checked = true;
        document.getElementById('incrementWeek').checked = false;
        document.getElementById('incrementRandom').checked = false;
        document.getElementById('randomMaxDays').disabled = true;
        document.getElementById('randomMaxDays').value = 4;
        document.getElementById('incrementRepeat').checked = false;
        document.getElementById('repeatCount').disabled = true;

        // Limpiar tipo de canal
        document.getElementById('channelMonetized').checked = true;
        document.getElementById('channelNonMonetized').checked = false;
        document.getElementById('channelMonetizationDisabled').checked = false;
        
        // Resetear estado del uploader
        this.currentVideoIndex = 0;
        this.isProcessing = false;
        this.isPaused = false;
        this.processState = 'config';
        
        // Resetear counter
        this.counter = new FanFicCounter();

        // Resetear miniaturas
        this.thumbnailImages = [];
        document.getElementById('thumbnailList').innerHTML = '';
        document.getElementById('thumbnailList').style.display = 'none';
        document.getElementById('thumbnailFiles').value = '';
        this.selectedStartImageIndex = 0;
        this.initialVideoIndex = 0;
        
        // Establecer fecha por defecto
        document.getElementById('startDate').valueAsDate = new Date();
        
        // Limpiar storage
        this.clearSavedState(true);
        
        // Mostrar sección de configuración
        document.getElementById('configSection').style.display = 'block';
        document.getElementById('processSection').style.display = 'none';
        document.getElementById('utilitySection').style.display = 'none';
        
        // Restaurar visibilidad del botón de iniciar
        document.getElementById('startProcess').style.display = 'block';
        document.getElementById('resumeSavedProcess').style.display = 'none';
        
        // Limpiar área de estado
        document.getElementById('statusArea').innerHTML = '';
        
        this.showSuccess('✅ Configuración limpiada completamente');
    }

    async changeStep(direction) {
        if (!this.isProcessing && !this.isPaused) {
            this.showInfo('Inicia el proceso para poder cambiar de paso.');
            return;
        }

        // Asegurar que el proceso esté pausado antes de cambiar el paso
        // Sin usar pauseProcess() que hace toggle — aquí forzamos la pausa directamente
        if (!this.isPaused) {
            this.isPaused = true;
            this.processState = 'paused';
            const btn = document.getElementById('pauseProcess');
            if (btn) { btn.textContent = '▶️ Reanudar'; btn.disabled = false; }
            this.sendMessageToContentScript({ action: 'pauseProcess' });
            this.saveCurrentState(true);
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        const result = await chrome.storage.local.get(['currentStep']);
        let { step, description } = result.currentStep || { step: 1, description: 'Inicio' };

        const newStep = Math.max(1, step + direction);

        // No podemos saber la descripción del nuevo paso desde aquí,
        // así que solo actualizamos el número y ponemos una descripción genérica.
        // El content script la corregirá al ejecutar el paso.
        const newDescription = `Paso manual: ${newStep}`;
        
        // Actualizar la UI y el storage
        this.updateStepInfo(newStep, newDescription);

        this.showInfo(`Paso movido a ${newStep}. Presiona 'Reanudar' para continuar desde este paso.`);
    }

    updateStepInfo(step, description) {
        document.getElementById('stepInfo').textContent = `Paso ${step}: ${description}`;
        
        // Guardar paso actual en storage para persistencia
        chrome.storage.local.set({ currentStep: { step, description } });
    }

    showManualNext() {
        document.getElementById('manualNext').style.display = 'block'; // Guardar estado cuando se muestra botón manual
        if (this.isProcessing) this.saveCurrentState(true);
    }

    showSuccess(message) {
        this.showStatus(message, 'success');
    }

    showError(message) {
        this.showStatus(message, 'error');
    }

    showInfo(message) {
        this.showStatus(message, 'info');
    }

    showStatus(message, type) {
        const statusArea = document.getElementById('statusArea');
        statusArea.innerHTML = `<div class="status ${type}">${message.replace(/\n/g, '<br>')}</div>`;
        setTimeout(() => {
            statusArea.innerHTML = '';
        }, 5000);
    }

    showPersistentError(message) {
        // Muestra un error que NO desaparece automáticamente (para detenciones importantes)
        const statusArea = document.getElementById('statusArea');
        statusArea.innerHTML = `<div class="status error">${message.replace(/\n/g, '<br>')}</div>`;
    }

    loadSavedData() {
        chrome.storage.local.get(['uploaderConfig', 'uploaderState', 'videoFiles', 'currentStep', 'contentScriptState', 'savedFanFicConfigs'], (result) => {
            // Cargar configuración básica
            if (result.uploaderConfig) {
                const config = result.uploaderConfig;
                
                // Cargar datos básicos
                if (config.startDate) document.getElementById('startDate').value = config.startDate;
                if (config.fanficName) document.getElementById('fanficName').value = config.fanficName;
                if (config.startingFileIndex) document.getElementById('startingFileIndex').value = config.startingFileIndex;
                
                // Cargar rango inicial - esperar a que los rangos estén cargados
                setTimeout(() => {
                    if (config.startingRange) {
                        const startingSelector = document.getElementById('startingRange');
                        if (startingSelector && startingSelector.options.length > 0) {
                            startingSelector.value = config.startingRange;
                        }
                    }
                    
                    // Cargar configuraciones de checkboxes
                    if (config.weeklyIncrementEnabled) {
                        document.getElementById('weeklyIncrementEnabled').checked = true;
                        document.getElementById('weeklyIncrementRange').disabled = false;
                        if (config.weeklyIncrementRange) {
                            document.getElementById('weeklyIncrementRange').value = config.weeklyIncrementRange;
                        }
                    }
                    
                    if (config.patreonEnabled) {
                        document.getElementById('patreonEnabled').checked = true;
                        document.getElementById('patreonRange').disabled = false;
                        if (config.patreonRange) {
                            document.getElementById('patreonRange').value = config.patreonRange;
                        }
                    }
                    
                    // Cargar tipo de incremento
                    if (config.incrementType) {
                        let radioButtonId = 'incrementDay';
                        if (config.incrementType === 'week') radioButtonId = 'incrementWeek';
                        else if (config.incrementType === 'random') radioButtonId = 'incrementRandom';
                        else if (config.incrementType === 'repeat') radioButtonId = 'incrementRepeat';
                        
                        const radioButton = document.getElementById(radioButtonId);
                        if (radioButton) {
                            radioButton.checked = true;
                            // Disparar evento change para habilitar/deshabilitar según corresponda
                            radioButton.dispatchEvent(new Event('change'));
                        }
                    }

                    // Cargar configuración de repetición
                    if (config.incrementType === 'repeat') {
                        const repeatCountInput = document.getElementById('repeatCount');
                        if (repeatCountInput) {
                            repeatCountInput.disabled = false;
                            repeatCountInput.value = config.repeatCount || 1;
                        }
                    }

                    // Cargar configuración de aleatorio
                    if (config.incrementType === 'random') {
                        const randomMaxDaysInput = document.getElementById('randomMaxDays');
                        if (randomMaxDaysInput) {
                            randomMaxDaysInput.disabled = false;
                            randomMaxDaysInput.value = config.randomMaxDays || 4;
                        }
                    }

                    // Cargar tipo de canal
                    if (config.channelType) {
                        const radio = document.querySelector(`input[name="channelType"][value="${config.channelType}"]`);
                        if (radio) radio.checked = true;
                    } else if (config.isMonetized !== undefined) {
                        document.getElementById('channelMonetized').checked = config.isMonetized;
                        document.getElementById('channelNonMonetized').checked = !config.isMonetized;
                    }
                }, 100);
            }

            // Cargar múltiples configuraciones guardadas
            if (result.savedFanFicConfigs) {
                this.savedConfigs = result.savedFanFicConfigs;
                this.populateConfigSelector();
            }

            // Restaurar estado del proceso
            if (result.uploaderState) {
                const state = result.uploaderState;
                this.savedStateExists = true;

                // Mostrar botón de reanudar junto al de Iniciar (nunca ocultar Iniciar)
                if (state.processState === 'processing' || state.processState === 'paused') {
                    const resumeBtn = document.getElementById('resumeSavedProcess');
                    resumeBtn.style.display = 'block';
                    document.getElementById('startProcess').style.display = 'block';
                }
                
                // Restaurar propiedades del counter
                if (state.counterState) {
                    const cs = state.counterState;
                    this.counter.startDate = cs.startDate ? new Date(cs.startDate) : new Date();
                    this.counter.fanficName = cs.fanficName || '';
                    this.counter.currentRangeIndex = cs.currentRangeIndex || 1;
                    this.counter.weeklyIncrementEnabled = cs.weeklyIncrementEnabled || false;
                    this.counter.weeklyIncrementRange = cs.weeklyIncrementRange || null;
                    this.counter.patreonEnabled = cs.patreonEnabled || false;
                    this.counter.patreonRange = cs.patreonRange || null;
                    this.counter.incrementType = cs.incrementType || 'day';
                    this.counter.weeklyIncrementStarted = cs.weeklyIncrementStarted || false;
                    this.counter.repeatCount = cs.repeatCount || 1;
                    this.counter.currentRepetition = cs.currentRepetition || 0;
                    
                    // Restaurar propiedades del random
                    this.counter.randomMaxDays = cs.randomMaxDays || 4;
                    this.counter.randomPool = cs.randomPool || [];
                    this.counter.randomHistory = cs.randomHistory || {};
                    this.counter.lastRandomValue = cs.lastRandomValue;
                }

                // Restaurar miniaturas
                if (state.thumbnailImages && state.thumbnailImages.length > 0) {
                    this.thumbnailImages = state.thumbnailImages;
                    this.selectedStartImageIndex = state.selectedStartImageIndex || 0;
                    this.renderThumbnailList();
                }
                
                // Restaurar estado del proceso
                this.currentVideoIndex = state.currentVideoIndex || 0;
                if (Number.isInteger(state.uploadingFilesCount) && state.uploadingFilesCount > 0) {
                    this.uploadingFilesCount = state.uploadingFilesCount;
                }
                this.processState = state.processState || 'config';
                this.isProcessing = state.isProcessing || false;
                this.isPaused = state.isPaused || false;
                this.initialVideoIndex = state.initialVideoIndex !== undefined ? state.initialVideoIndex : (state.currentVideoIndex || 0);
                
                // Mostrar la sección correcta según el estado
                if (this.processState === 'processing' || this.processState === 'paused') {
                    // Verificar si el proceso sigue realmente activo en la pestaña
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        const tab = tabs[0];
                        if (!tab || !tab.url || !tab.url.includes('studio.youtube.com')) {
                            // No estamos en YouTube Studio, mostrar config con opción de reanudar
                            this._restoreToConfigWithResume();
                            return;
                        }
                        chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (pingResp) => {
                            if (chrome.runtime.lastError || !pingResp || !pingResp.pong) {
                                // No hay content script activo, proceso ya no corre
                                this._restoreToConfigWithResume();
                                return;
                            }
                            // El content script responde. Si el estado era 'processing', mostramos el panel
                            if (this.processState === 'processing') {
                                this.isProcessing = true;
                            } else {
                                // 'paused'
                                this.isProcessing = true;
                                this.isPaused = true;
                            }
                            this.showProcessSection();
                            this.updateProcessDisplay();
                            
                            if (this.isPaused) {
                                document.getElementById('pauseProcess').textContent = '▶️ Reanudar';
                                document.getElementById('pauseProcess').disabled = false;
                            } else {
                                document.getElementById('pauseProcess').textContent = '⏸️ Pausar';
                                document.getElementById('pauseProcess').disabled = false;
                            }
                            if (state.showManualNext) {
                                document.getElementById('manualNext').style.display = 'block';
                            }
                        });
                    });
                } else if (this.processState === 'completed') {
                    this.showProcessSection();
                    this.updateProcessDisplay();
                    document.getElementById('completionSection').style.display = 'block';
                    document.getElementById('pauseProcess').disabled = true;
                    document.getElementById('skipVideo').disabled = true;
                }
            }

            // Restaurar información del paso actual
            if (result.currentStep) {
                document.getElementById('stepInfo').textContent = `Paso ${result.currentStep.step}: ${result.currentStep.description}`;
            }

            // Restaurar lista de archivos
            if (result.videoFiles && result.videoFiles.length > 0) {
                // Asegurar que es un array válido antes de asignar
                this.videoFiles = Array.isArray(result.videoFiles) ? result.videoFiles : [];
                console.log('Archivos (metadata) restaurados:', this.videoFiles.length);
            }
        });
    }

    // --- Nuevas funciones para gestionar configuraciones ---

    populateConfigSelector() {
        const selector = document.getElementById('savedConfigs');
        selector.innerHTML = '<option value="">-- Selecciona una --</option>'; // Opción por defecto
        const configNames = Object.keys(this.savedConfigs).sort();
        
        configNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            selector.appendChild(option);
        });
    }

    handleLoadConfig() {
        const selector = document.getElementById('savedConfigs');
        const configName = selector.value;

        if (!configName) {
            this.showInfo('Por favor, selecciona una configuración para cargar.');
            return;
        }

        const configToLoad = this.savedConfigs[configName];
        if (configToLoad) {
            // Guardar la configuración seleccionada como la configuración activa.
            // Es importante también mantener las configuraciones guardadas en el storage.
            chrome.storage.local.set({ 
                uploaderConfig: configToLoad,
                savedFanFicConfigs: this.savedConfigs // Asegurarse de no perder la lista de configs
            }, () => {
                // Recargar todos los datos en la UI desde el storage
                this.loadSavedData();
                this.showSuccess(`✅ Configuración "${configName}" cargada.`);
            });
        } else {
            this.showError(`No se encontró la configuración "${configName}".`);
        }
    }

    handleSaveCurrentConfig() {
        const fanficName = document.getElementById('fanficName').value.trim();
        if (!fanficName) {
            this.showError('El "Nombre del FanFic" es necesario para guardar la configuración.');
            return;
        }

        const currentConfig = this.getCurrentConfigFromUI();
        this.savedConfigs[fanficName] = currentConfig;

        chrome.storage.local.set({ savedFanFicConfigs: this.savedConfigs }, () => {
            this.populateConfigSelector();
            // Seleccionar la configuración recién guardada
            document.getElementById('savedConfigs').value = fanficName;
            this.showSuccess(`✅ Configuración "${fanficName}" guardada.`);
        });
    }

    handleDeleteConfig() {
        const selector = document.getElementById('savedConfigs');
        const configName = selector.value;

        if (!configName) {
            this.showInfo('Por favor, selecciona una configuración para eliminar.');
            return;
        }

        if (confirm(`¿Estás seguro de que quieres eliminar la configuración "${configName}"?`)) {
            delete this.savedConfigs[configName];
            chrome.storage.local.set({ savedFanFicConfigs: this.savedConfigs }, () => {
                this.populateConfigSelector();
                this.showSuccess(`🗑️ Configuración "${configName}" eliminada.`);
            });
        }
    }

    getCurrentConfigFromUI() {
        return {
            startDate: document.getElementById('startDate').value,
            fanficName: document.getElementById('fanficName').value,
            startingFileIndex: document.getElementById('startingFileIndex').value,
            startingRange: document.getElementById('startingRange').value,
            weeklyIncrementEnabled: document.getElementById('weeklyIncrementEnabled').checked,
            weeklyIncrementRange: document.getElementById('weeklyIncrementEnabled').checked ? 
                document.getElementById('weeklyIncrementRange').value : '',
            patreonEnabled: document.getElementById('patreonEnabled').checked,
            patreonRange: document.getElementById('patreonEnabled').checked ? 
                document.getElementById('patreonRange').value : '',
            isMonetized: document.getElementById('channelMonetized').checked,
            incrementType: document.querySelector('input[name="incrementType"]:checked').value,
            repeatCount: document.getElementById('repeatCount').value,
            randomMaxDays: document.getElementById('randomMaxDays').value,
            channelType: document.querySelector('input[name="channelType"]:checked').value
        };
    }

    saveCurrentConfig() {
        const config = {
            startDate: document.getElementById('startDate').value,
            fanficName: document.getElementById('fanficName').value,
            startingFileIndex: document.getElementById('startingFileIndex').value,
            startingRange: document.getElementById('startingRange').value,
            weeklyIncrementEnabled: document.getElementById('weeklyIncrementEnabled').checked,
            weeklyIncrementRange: document.getElementById('weeklyIncrementEnabled').checked ? 
                document.getElementById('weeklyIncrementRange').value : '',
            patreonEnabled: document.getElementById('patreonEnabled').checked,
            patreonRange: document.getElementById('patreonEnabled').checked ? 
                document.getElementById('patreonRange').value : '',
            isMonetized: document.getElementById('channelMonetized').checked,
            incrementType: document.querySelector('input[name="incrementType"]:checked').value,
            repeatCount: document.getElementById('repeatCount').value,
            randomMaxDays: document.getElementById('randomMaxDays').value,
            channelType: document.querySelector('input[name="channelType"]:checked').value
        };
        
        chrome.storage.local.set({ uploaderConfig: config });
        console.log('Configuración guardada en storage:', config);
    }

    saveCurrentState(saveFullState = false) {
        const state = {
            counterState: {
                startDate: this.counter.startDate ? this.counter.startDate.toISOString() : null,
                fanficName: this.counter.fanficName,
                currentRangeIndex: this.counter.currentRangeIndex,
                weeklyIncrementEnabled: this.counter.weeklyIncrementEnabled,
                weeklyIncrementRange: this.counter.weeklyIncrementRange,
                patreonEnabled: this.counter.patreonEnabled,
                patreonRange: this.counter.patreonRange,
                incrementType: this.counter.incrementType,
                weeklyIncrementStarted: this.counter.weeklyIncrementStarted,
                repeatCount: this.counter.repeatCount,
                currentRepetition: this.counter.currentRepetition,
                
                // Guardar propiedades de random
                randomMaxDays: this.counter.randomMaxDays,
                randomPool: this.counter.randomPool,
                randomHistory: this.counter.randomHistory,
                lastRandomValue: this.counter.lastRandomValue
            },
            currentVideoIndex: this.currentVideoIndex,
            // Conservar el total original del lote al cerrar o reabrir el panel.
            uploadingFilesCount: this.uploadingFilesCount,
            processState: this.processState,
            isProcessing: this.isProcessing,
            isPaused: this.isPaused,
            thumbnailImages: this.thumbnailImages, // Guardar imágenes
            selectedStartImageIndex: this.selectedStartImageIndex,
            initialVideoIndex: this.initialVideoIndex
        };
        
        const dataToSave = { uploaderState: state };
        
        if (saveFullState) {
            // Convertir archivos a formato serializable
            const serializedVideoFiles = this.videoFiles.map(video => ({
                name: video.name,
                size: video.size,
                processed: video.processed,
            }));
            dataToSave.videoFiles = serializedVideoFiles;
            this.savedStateExists = true;
            console.log('Guardando estado completo:', state);
        }
        
        chrome.storage.local.set(dataToSave);
    }
}

// Inicializar la aplicación
let uploader;

document.addEventListener('DOMContentLoaded', () => {
    uploader = new YouTubeUploader();
    
    // Escuchar mensajes del content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
            case 'stepUpdate':
                uploader.updateStepInfo(message.step, message.description);
                // Ocultar botones de intervención si el proceso está avanzando normalmente
                document.getElementById('manualNext').style.display = 'none';
                document.getElementById('retryCurrentStep').style.display = 'none';
                break;
            case 'videoCompleted':
                uploader.onVideoCompleted(message);
                break;
            case 'processError':
                uploader.showError(message.error);
                uploader.showManualNext();
                document.getElementById('retryCurrentStep').style.display = 'block';
                break;
            case 'manualIntervention':
                uploader.showInfo(message.message);
                if (message.showButton !== false) {
                    uploader.showManualNext();
                }
                break;
            case 'processStopped':
                uploader.showPersistentError(message.message || 'Proceso detenido.');
                uploader.stopProcess(true);
                break;
            case 'stateSaved':
                chrome.storage.local.set({ contentScriptState: message });
                console.log('Estado del content script guardado:', message);
                break;
            case 'activeFlowUpdate': {
                const flowLabels = {
                    'monetized': '💰 Canal Monetizado',
                    'non-monetized': '🔓 Sin Monetizar',
                    'monetization-disabled': '⛔ Monetización Desactivada',
                    'monetized-post-patreon': '💰 Monetizado · Post-Patreon',
                    'non-monetized-post-patreon': '🔓 Sin Monetizar · Post-Patreon',
                    'monetization-disabled-post-patreon': '⛔ Monetización Desactivada · Post-Patreon'
                };
                const label = flowLabels[message.flowName] || message.flowName;
                document.getElementById('activeFlowBadge').textContent = label;
                document.getElementById('activeFlowBadge').style.display = 'inline-block';
                break;
            }
            case 'updateCounterToRange': {
                const newStart = parseInt(message.newRange.split('-')[0], 10);
                const currentStart = parseInt(uploader.counter.getCurrentRange().split('-')[0], 10);
                if (newStart > currentStart) {
                    const steps = Math.floor((newStart - currentStart) / 25);
                    for (let i = 0; i < steps; i++) {
                        uploader.counter.increment();
                    }
                    uploader.updateProcessDisplay();
                    uploader.saveCurrentState(true);
                    
                    if (!uploader.missingRanges) uploader.missingRanges = [];
                    uploader.missingRanges.push(message.missingRange);
                    uploader.showInfo(`Rango faltante detectado: ${message.missingRange}. Saltando a ${message.newRange}.`);
                }
                break;
            }
        }
        sendResponse({ received: true });
    });
});

// Guardar configuración antes de cerrar
window.addEventListener('beforeunload', () => {
    if (uploader) {
        uploader.saveCurrentConfig();
        if (uploader.isProcessing || uploader.isPaused) uploader.saveCurrentState(true);
    }
});

// Auto-guardar configuración cuando se cambian valores
document.addEventListener('DOMContentLoaded', () => {
    // Event listeners para auto-guardar configuración
    const configInputs = [
        'startDate', 'fanficName', 'startingRange', 
        'startingFileIndex', 'weeklyIncrementEnabled', 'weeklyIncrementRange',
        'patreonEnabled', 'patreonRange', 'incrementDay', 'incrementWeek', 'incrementRandom', 'randomMaxDays', 'incrementRepeat', 'repeatCount',
        'channelMonetized', 'channelNonMonetized', 'channelMonetizationDisabled'
    ];
    
    configInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', () => {
                if (uploader) {
                    setTimeout(() => uploader.saveCurrentConfig(), 100);
                }
            });
        }
    });
});
                
