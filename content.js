console.log('=== CONTENT SCRIPT INICIANDO ===');
console.log('URL actual:', window.location.href);
console.log('DOM readyState:', document.readyState);

class YouTubeStudioAutomator {
    constructor() {
        this.isProcessing = false;
        this.currentConfig = null;
        this.currentStep = 0;
        this.maxRetries = 3;
        this.retryCount = 0;
        this.pageReady = false;
        this.cleanupPending = false;
        
        this.waitForPageReady();
        
        this.selectors = {
            createIcon: '//*[@id="create-icon"]',
            uploadOption: '//*[@id="text-item-0"]',
            selectFilesButton: '//*[@id="select-files-button"]',
            reuseDetailsButton: '//*[@id="reuse-details-button"]',
            searchInput: '#search-yours',
            firstVideoResult: '//*[@id="videos"]/ytcp-video-pick-dialog-contents/div/div/div/ytcp-entity-card[1]',
            selectButton: '//*[@id="select-button"]',
            titleInput: 'ytcp-social-suggestion-input #textbox[contenteditable="true"]', // Deprecated, see updateVideoTitle
            nextButton: '//*[@id="next-button"]',
            textContainer: '//*[@id="text-container"]/div/ytcp-icon-button/tp-yt-iron-icon',
            radioOn: '//*[@id="radio-on"]', // Selector for "No, it's not made for kids"
            saveButton: '//*[@id="save-button"]', // Save button for "made for kids"
            secondaryIcon: '#button-area-secondary-icon', // Button to expand ad settings
            onRadio: '//*[@id="onRadio"]',
            submitQuestionnaireButton: '//*[@id="submit-questionnaire-button"]',
            secondContainerExpandButton: '#second-container-expand-button',
            rightIcon: '//*[@id="right-icon"]',
            dateTextbox: '//*[@id="textbox"]',
            doneButton: '//*[@id="done-button"]',
            primaryActionButton: '//*[@id="primary-action-button"]',
            closeButton: '//*[@id="close-button"]/ytcp-button-shape/button',
            finalCloseButton: '//*[@id="close-button"]',
            backButton: '//*[@id="back-button"]',
            
            dateDropdownTrigger: 'ytcp-text-dropdown-trigger#datepicker-trigger',
            dateDropdownButton: 'ytcp-text-dropdown-trigger#datepicker-trigger ytcp-dropdown-trigger',
            rightIconSpecific: 'ytcp-text-dropdown-trigger#datepicker-trigger yt-icon#right-icon',
            dateInput: 'ytcp-date-picker tp-yt-paper-input input',
            datePickerForm: 'ytcp-date-picker #form',
            dateInputAlt: '.style-scope.tp-yt-paper-input[autocomplete="off"]',
            datePickerContainer: 'ytcp-date-picker',
            
            publishFromSponsorsRadio: 'tp-yt-paper-radio-button#publish-from-sponsors-only',
            publishFromSponsorsOnRadio: 'tp-yt-paper-radio-button#publish-from-sponsors-only #onRadio',
            membersToPublicRadio: 'tp-yt-paper-radio-button[name="PUBLISH_FROM_SPONSORS_ONLY"]',
            thumbnailUploadButton: 'ytcp-video-custom-still-editor #select-button, ytcp-thumbnail-editor #select-button'
        };

        this.selectors.madeForKidsContainer = {
            optionsContainer: '#made-for-kids-group', // The container for the "made for kids" radio buttons
            expandIcon: '#text-container [role="button"]' // A more robust selector for the dropdown icon
        };
        
        this.setupMessageListener();
        this.performHealthCheck();
    }

    async waitForPageReady() {
        const checkReady = () => {
            const createButton = document.querySelector('#create-icon, [aria-label*="Crear"], [title*="Crear"]');
            const ytcpElements = document.querySelectorAll('[id*="ytcp"], [class*="ytcp"]');
            
            if (createButton && ytcpElements.length > 5) {
                this.pageReady = true;
                console.log('YouTube Studio página lista para automatización');
                return true;
            }
            return false;
        };

        if (!checkReady()) {
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (checkReady()) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 1000);
                
                setTimeout(() => {
                    clearInterval(interval);
                    this.pageReady = true;
                    console.log('Timeout esperando página, continuando...');
                    resolve();
                }, 30000);
            });
        }
    }

    setupMessageListener() {
        console.log('=== CONFIGURANDO MESSAGE LISTENER ===');
        
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('=== MENSAJE RECIBIDO ===', message);
            
            try {
                if (message.action === 'ping') {
                    console.log('Ping recibido, respondiendo pong');
                    sendResponse({ pong: true, ready: this.pageReady, timestamp: Date.now() });
                    return true;
                }
                
                if (message.action === 'startUpload') {
                    console.log('Iniciando proceso de upload...');
                    this.startUploadProcess(message.config, message.videoIndex);
                    sendResponse({ received: true });
                    return true;
                }
                
                if (message.action === 'resumeUpload') {
                    console.log('Reanudando proceso de upload...');
                    this.resumeUploadProcess(message.config, message.startFromStep);
                    sendResponse({ received: true });
                    return true;
                }

                if (message.action === 'pauseProcess') {
                    console.log('Pausando proceso en content script...');
                    this.isProcessing = false; // Detiene el bucle de pasos
                    sendResponse({ paused: true });
                    return true;
                }

                if (message.action === 'stopProcess') {
                    console.log('Deteniendo proceso...');
                    this.stopProcess();
                    sendResponse({ stopped: true });
                    return true;
                }
                
                if (message.action === 'detectUploadingFiles') {
                    console.log('Detectando archivos en subida...');
                    this.detectUploadingFiles().then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        sendResponse({ 
                            success: false, 
                            fileCount: 0, 
                            detected: false, 
                            error: error.message 
                        });
                    });
                    return true; // Mantener el canal abierto para respuesta asíncrona
                }
                
                if (message.action === 'selectUploadingFile') {
                    console.log('Seleccionando archivo de subida...');
                    this.selectUploadingFile(message.fileIndex || 0).then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        sendResponse({ 
                            success: false, 
                            fileIndex: message.fileIndex || 0,
                            error: error.message 
                        });
                    });
                    return true; // Mantener el canal abierto para respuesta asíncrona
                }
                
                if (message.action === 'saveStateAndPause') {
                    console.log('Guardando estado y pausando...');
                    this.isProcessing = false; // Detiene el bucle de pasos
                    const state = {
                        config: this.currentConfig,
                        step: this.currentStep
                    };
                    // Enviamos el estado al background para que lo guarde
                    this.sendMessage('stateSaved', state);
                    sendResponse({ saved: true, state: state });
                    return true;
                }

                if (message.action === 'resumeFromSavedState') {
                    console.log('Reanudando desde estado guardado...');
                    this.resumeUploadProcess(message.state.config, message.state.step);
                    sendResponse({ received: true });
                    return true;
                }
                
                console.log('Acción no reconocida:', message.action);
                sendResponse({ error: 'Acción no reconocida' });
                
            } catch (error) {
                console.error('Error procesando mensaje:', error);
                sendResponse({ error: error.message });
            }
            
            return false;
        });
        
        console.log('=== MESSAGE LISTENER CONFIGURADO ===');
    }

    async performHealthCheck() {
        console.log('=== HEALTH CHECK INICIANDO ===');
        
        const checks = {
            'URL correcta': window.location.hostname.includes('studio.youtube.com'),
            'Elemento create-icon': !!document.querySelector('#create-icon'),
            'Elementos ytcp': document.querySelectorAll('[id*="ytcp"], [class*="ytcp"]').length > 0,
            'DOM cargado': document.readyState === 'complete',
            'Chrome runtime disponible': !!chrome.runtime,
            'Message listener activo': !!chrome.runtime.onMessage.hasListeners()
        };
        
        console.log('=== RESULTADOS HEALTH CHECK ===');
        Object.entries(checks).forEach(([check, result]) => {
            console.log(`${result ? '✅' : '❌'} ${check}: ${result}`);
        });
        
        const allPassed = Object.values(checks).every(Boolean);
        console.log(`=== HEALTH CHECK ${allPassed ? 'EXITOSO' : 'FALLÓ'} ===`);
        
        return { checks, allPassed };
    }

    // Nuevo método para detectar archivos en proceso de subida
    async detectUploadingFiles() {
        console.log('=== DETECTANDO ARCHIVOS EN SUBIDA ===');
        
        try {
            let fileCount = 0;

            // Método 1: Elementos en la lista de diálogo de subida múltiple
            const listItems = document.querySelectorAll('ytcp-uploads-file-list-item');
            if (listItems && listItems.length > 0) {
                fileCount = listItems.length;
                console.log(`Archivos detectados por ytcp-uploads-file-list-item: ${fileCount}`);
            }

            // Método 2: Buscar el contador de archivos en el monitor de progreso
            if (fileCount === 0) {
                const progressMonitor = document.querySelector('.count.style-scope.ytcp-multi-progress-monitor, ytcp-multi-progress-monitor .count');
                if (progressMonitor) {
                    const countText = progressMonitor.textContent || '';
                    console.log('Texto del contador encontrado:', countText);
                    
                    const match = countText.match(/Subiendo\s+(\d+)\s+de\s+(\d+)|(\d+)\s+de\s+(\d+)/i);
                    if (match) {
                        fileCount = parseInt(match[2] || match[4], 10);
                        console.log(`Archivos detectados por contador: ${fileCount}`);
                    }
                }
            }
            
            // Método 3: Elementos de lista de archivo con tag li.row
            if (fileCount === 0) {
                const fileRows = document.querySelectorAll('li.row');
                if (fileRows.length > 0) {
                    fileCount = fileRows.length;
                    console.log(`Archivos detectados por li.row: ${fileCount}`);
                }
            }
            
            // Método 4: buscar elementos con progress-title o botones de edición genericos
            if (fileCount === 0) {
                const fallbackItems = document.querySelectorAll('span.progress-title[id^="progress-title-"], button.edit-button[aria-label], ytcp-icon-button[aria-label*="Borrador"], ytcp-icon-button[aria-label*="draft"]');
                fileCount = fallbackItems.length;
                if (fileCount > 0) {
                    console.log(`Archivos detectados por fallback (títulos o botones): ${fileCount}`);
                }
            }
            
            console.log(`=== TOTAL DE ARCHIVOS EN SUBIDA: ${fileCount} ===`);
            
            return {
                success: true,
                fileCount: fileCount,
                detected: fileCount > 0
            };
            
        } catch (error) {
            console.error('Error detectando archivos en subida:', error);
            return {
                success: false,
                fileCount: 0,
                detected: false,
                error: error.message
            };
        }
    }

    // Nuevo método para seleccionar un archivo específico de la lista de subida
    async selectUploadingFile(fileIndex = 0) {
        console.log(`=== SELECCIONANDO ARCHIVO ${fileIndex + 1} DE LA LISTA DE SUBIDA ===`);
        
        try {
            // Buscar todos los botones de edición disponibles
            let editButtons = Array.from(document.querySelectorAll('ytcp-uploads-file-list-item #edit-draft-button, ytcp-uploads-file-list-item #draft-button, ytcp-uploads-file-list-item .edit-draft-button, ytcp-uploads-file-list-item button[aria-label*="draft"], ytcp-uploads-file-list-item button[aria-label*="Borrador"]'));
            
            if (editButtons.length === 0) {
                // Fallback a los selectores antiguos genéricos
                editButtons = Array.from(document.querySelectorAll('button.edit-button[aria-label], ytcp-icon-button[aria-label*="Borrador"], ytcp-icon-button[aria-label*="draft"]'));
            }
            
            // Fallback total iterativo: buscar cualquier cosa dentro de las filas que contenga la palabra editar o borrador o el ícono de lápiz en la lista de subida
            if (editButtons.length === 0) {
                const listItems = document.querySelectorAll('ytcp-uploads-file-list-item');
                editButtons = Array.from(listItems).map(item => item.querySelector('ytcp-icon-button, ytcp-button, tp-yt-iron-icon[icon="yt-sys:icons_pencil"]')).filter(b => b);
            }

            if (editButtons.length === 0) {
                throw new Error('No se encontraron botones de edición en la lista de subida');
            }
            
            if (fileIndex >= editButtons.length) {
                throw new Error(`Índice de archivo ${fileIndex} fuera de rango. Solo hay ${editButtons.length} archivos`);
            }
            
            let targetButton = editButtons[fileIndex];
            // Si el targetButton es un iron-icon que está dentro de un botón real, intentamos hacer clic en el contenedor clickeable
            const closestButton = targetButton.closest('ytcp-button, ytcp-icon-button, button');
            if (closestButton) {
                targetButton = closestButton;
            }

            const ariaLabel = targetButton.getAttribute('aria-label') || 'archivo sin nombre';
            
            console.log(`Seleccionando archivo ${fileIndex + 1}: ${ariaLabel}`);
            
            // Hacer scroll al botón y hacer click
            targetButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.wait(500);
            
            // Nos saltamos isElementInteractable que puede ser muy estricto y fallar
            targetButton.click();
            console.log(`Click realizado en archivo ${fileIndex + 1}`);
            
            // Esperar a que se abra la interfaz de edición
            await this.wait(2000);
            
            return {
                success: true,
                fileIndex: fileIndex,
                fileName: ariaLabel,
                totalFiles: editButtons.length
            };
            
        } catch (error) {
            console.error('Error seleccionando archivo de subida:', error);
            return {
                success: false,
                fileIndex: fileIndex,
                error: error.message
            };
        }
    }

    stopProcess() {
        console.log('Deteniendo proceso de automatización...');
        this.isProcessing = false;
        this.currentConfig = null;
        this.currentStep = 0;
        this.retryCount = 0;
        this.sendMessage('processStopped');
    }

    async startUploadProcess(config, videoIndex) {
        // Verificar si ya hay un proceso en curso ANTES de reiniciar el estado
        if (this.isProcessing || this.cleanupPending) {
            console.log('Proceso en curso o limpieza pendiente, esperando...');
            await new Promise(r => setTimeout(r, 200));
            if (this.isProcessing || this.cleanupPending) {
                console.log('Sigue ocupado, ignorando nueva solicitud.');
                return;
            }
        }

        // Reinicio de estado seguro
        this.currentConfig = null;
        this.currentStep = 0;
        this.retryCount = 0;

        if (!this.pageReady) {
            console.log('Esperando a que la página esté lista...');
            await this.waitForPageReady();
        }

        this.isProcessing = true;
        this.currentConfig = config || {};
        this.currentStep = 0;
        this.retryCount = 0;

        console.log('Iniciando proceso de subida:', config);
        
        try {
            await this.executeUploadSteps();
        } catch (error) {
            console.error('Error en el proceso de subida:', error);
            this.sendMessage('processError', { error: error.message });
            this.isProcessing = false;
        }
    }

    async resumeUploadProcess(config, startFromStep = 0) {
        if (this.isProcessing || this.cleanupPending) {
            console.log('Proceso en curso o limpieza pendiente, esperando...');
            await new Promise(r => setTimeout(r, 200));
            if (this.isProcessing || this.cleanupPending) {
                console.log('Sigue ocupado, no se puede reanudar.');
                return;
            }
        }

        this.isProcessing = true;
        this.currentConfig = config || {};
        // Usamos el paso recibido para continuar, en lugar de empezar en 0
        this.currentStep = startFromStep;
        this.retryCount = 0;

        console.log('Reanudando proceso desde el paso:', startFromStep, 'con config:', config);

        try {
            // executeUploadSteps ahora necesita saber desde dónde empezar
            await this.executeUploadSteps(startFromStep);
        } catch (error) {
            console.error('Error en la reanudación del proceso:', error);
            this.sendMessage('processError', { error: error.message });
            this.isProcessing = false;
        }
    }
    // Se agregó branching para soportar un flujo alterno "postPatreon".
    async executeUploadSteps(startFromStep = 0) {
        // Selecciona el conjunto de pasos según la configuración actual
        const steps = this.getStepsForConfig();

        // Notificar al popup qué flujo está usando
        const channelType = this.currentConfig && this.currentConfig.channelType;
        const postPatreon = !!(this.currentConfig && this.currentConfig.postPatreonFlow);
        let flowName = 'monetized';
        if (channelType === 'non-monetized') flowName = 'non-monetized';
        else if (channelType === 'monetization-disabled') flowName = 'monetization-disabled';
        if (postPatreon) flowName += '-post-patreon';
        this.sendMessage('activeFlowUpdate', { flowName });

        try {
            // Encontrar el índice de inicio basado en startFromStep
            const startIndex = Math.max(0, steps.findIndex(s => s.step === startFromStep));

            for (let i = startIndex; i < steps.length; i++) {
                const stepData = steps[i];
                
                if (!this.isProcessing) {
                    console.log('Proceso detenido por el usuario');
                    return;
                }
                
                this.currentStep = stepData.step;
                this.sendMessage('stepUpdate', { step: stepData.step, description: stepData.description });
                
                let stepCompleted = false;
                let attempts = 0;
                const maxAttempts = stepData.required ? this.maxRetries : 1;
                
                while (!stepCompleted && attempts < maxAttempts && this.isProcessing) {
                    try {
                        console.log(`Ejecutando paso ${stepData.step} (intento ${attempts + 1})`);
                        const result = await stepData.action();
                        
                        if (stepData.required) {
                            await this.verifyStepCompletion(stepData.step, result);
                        }
                        
                        stepCompleted = true;
                        console.log(`Paso ${stepData.step} completado exitosamente`);
                        
                        await this.wait(500);
                        
                    } catch (error) {
                        if (error.message === 'PROCESS_PAUSED') {
                            console.log('Paso interrumpido por pausa del usuario');
                            return;
                        }
                        attempts++;
                        console.error(`Error en paso ${stepData.step} (intento ${attempts}):`, error);
                        
                        if (attempts >= maxAttempts) {
                            if (stepData.required) {
                                throw new Error(`Paso crítico ${stepData.step} falló después de ${maxAttempts} intentos: ${error.message}`);
                            } else {
                                console.warn(`Paso opcional ${stepData.step} falló, continuando...`);
                                stepCompleted = true;
                            }
                        } else {
                            console.log(`Reintentando paso ${stepData.step} en 2 segundos...`);
                            await this.wait(2000);
                        }
                    }
                    
                    if (!this.isProcessing) {
                        console.log('Proceso detenido durante reintentos');
                        return;
                    }
                }
                
                if (!stepCompleted && stepData.required) {
                    throw new Error(`No se pudo completar el paso crítico ${stepData.step}`);
                }
            }
            
            if (this.isProcessing) {
                this.sendMessage('videoCompleted', { part: this.detectedPart });
            }
            
            this.isProcessing = false;
        } finally {
            // Limpieza segura siempre
            this.cleanupPending = true;
            this.isProcessing = false;
            this.currentConfig = null;
            this.currentStep = 0;
            this.retryCount = 0;
            console.log('=== Estado reiniciado después de la subida ===');
            setTimeout(() => { this.cleanupPending = false; }, 100);
        }
    }

    // Nuevo método: devuelve el flujo de pasos según currentConfig
    getStepsForConfig() {
        // Si currentConfig.postPatreonFlow es true, se usa un flujo alternativo
        const usePostPatreon = !!(this.currentConfig && this.currentConfig.postPatreonFlow);
        const isMonetized = !!(this.currentConfig && this.currentConfig.isMonetized);
        const channelType = this.currentConfig && this.currentConfig.channelType;

        // NUEVO FLUJO: Para archivos ya en subida (empieza desde paso 6)
        const uploadingFilesFlow = [
            { step: 1, description: 'Seleccionando archivo de la lista de subida', action: () => this.selectUploadingFile(this.currentConfig.currentFileIndex || 0), required: true },
            { step: 2, description: 'Esperando carga de la interfaz de edición', action: () => this.wait(1000), required: false },
            { step: 2.5, description: 'Verificando archivo y nombre', action: () => this.verifyFileAndName(), required: false },
            { step: 3, description: 'Haciendo click en reutilizar detalles', action: () => this.clickElement(this.selectors.reuseDetailsButton), required: true },
            { step: 4, description: 'Esperando ventana de búsqueda', action: () => this.waitForElement(this.selectors.searchInput), required: true },
            { step: 5, description: 'Buscando video base', action: () => this.searchBaseVideo(), required: true },
            { step: 6, description: 'Esperando resultados de búsqueda', action: () => this.waitAndClick(500, this.selectors.firstVideoResult), required: true },
            { step: 7, description: 'Esperando carga de selección', action: () => this.wait(900), required: false },
            { step: 8, description: 'Confirmando selección', action: () => this.clickSelectButton()},
            { step: 9, description: 'Actualizando título del video', action: () => this.updateVideoTitle(), required: true },
            { step: 10, description: 'Desplazando a miniatura', action: () => this.scrollToThumbnail() },
            { step: 11, description: 'Subiendo miniatura personalizada', action: () => this.uploadThumbnail(), required: false },
            { step: 12, description: 'Avanzando a siguiente sección', action: () => this.clickElement(this.selectors.nextButton) },
            { step: 13, description: 'Esperando carga de sección', action: () => this.wait(500), required: false },
            { step: 14, description: 'Configurando opciones de contenido', action: () => this.clickElement(this.selectors.madeForKidsContainer.expandIcon)},
            { step: 15, description: 'Seleccionando opción radio', action: () => this.clickElement(this.selectors.radioOn) },
            { step: 16, description: 'Guardando configuración', action: () => this.clickElement(this.selectors.saveButton) },
            { step: 17, description: 'Continuando al siguiente paso', action: () => this.clickElement(this.selectors.nextButton) },
            { step: 18, description: 'Configurando opciones secundarias', action: () => this.clickElement(this.selectors.secondaryIcon) },
            { step: 19, description: 'Seleccionando radio secundario', action: () => this.clickElement(this.selectors.onRadio) },
            { step: 20, description: 'Enviando cuestionario', action: () => this.clickElement(this.selectors.submitQuestionnaireButton)},
            { step: 21, description: 'Esperando procesamiento', action: () => this.wait(500), required: false },
            { step: 22, description: 'Avanzando', action: () => this.clickElement(this.selectors.nextButton), required: true },
            { step: 23, description: 'Continuando', action: () => this.clickElement(this.selectors.nextButton), required: true },
            { step: 24, description: 'Avanzando a configuración final', action: () => this.clickElement(this.selectors.nextButton), required: true }
        ];

        // Flujos para archivos ya en subida
        const uploadingFilesPostPatreonFlow = [
            ...uploadingFilesFlow,
            { step: 25, description: 'Seleccionando "Solo para miembros"', action: () => this.clickElementWithNavigationRecovery('tp-yt-paper-radio-button[name="SPONSORS_ONLY"]'), required: true },
            { step: 26, description: 'Abriendo selector de niveles de patrocinio', action: () => this.clickSponsorshipTierSelector(), required: true },
            { step: 27, description: 'Seleccionando nivel "Ninja Kage"', action: () => this.selectNinjaKageOption(), required: true },
            { step: 28, description: 'Publicando video', action: () => this.clickElement('#done-button'), required: true },
            { step: 28.5, description: 'Confirmando advertencia (si existe)', action: () => this.clickOptionalButton('ytcp-prechecks-warning-dialog #primary-action-button', 'Entendido'), required: false },
            { step: 29, description: 'Esperando publicación', action: () => this.wait(1000), required: false },
            { step: 30, description: 'Cerrando primer diálogo (si existe)', action: () => this.clickCloseButton(5000, { allowAbsent: true }), required: true },
            { step: 31, description: 'Esperando segundo diálogo', action: () => this.wait(500), required: false },
            { step: 32, description: 'Cerrando ventana final (si existe)', action: () => this.clickCloseButton(5000, { allowAbsent: true }), required: true }
        ];


        const uploadingFilesDefaultFlow = [
            ...uploadingFilesFlow,
            { step: 25, description: 'Expandiendo opciones avanzadas', action: () => this.clickElementWithNavigationRecovery(this.selectors.secondContainerExpandButton), required: true },
            { step: 26, description: 'Seleccionando "De exclusivo para miembros a público"', action: () => this.clickMembersToPublicRadio(), required: true },
            { step: 27, description: 'Abriendo selector de fecha', action: () => this.clickRightIcon(), required: true },
            { step: 28, description: 'Configurando fecha de publicación', action: () => this.setPublishDate(), required: true },
            { step: 29, description: 'Confirmando fecha', action: () => this.clickElement(this.selectors.doneButton), required: true },
            { step: 30, description: 'Esperando confirmación', action: () => this.wait(500), required: false },
            { step: 31, description: 'Confirmando advertencia (si existe)', action: () => this.clickOptionalButton('ytcp-prechecks-warning-dialog #primary-action-button', 'Entendido'), required: false },
            { step: 32, description: 'Esperando publicación', action: () => this.wait(1000), required: false },
            { step: 33, description: 'Cerrando primer diálogo (si existe)', action: () => this.clickCloseButton(5000, { allowAbsent: true }), required: true },
            { step: 34, description: 'Esperando segundo diálogo', action: () => this.wait(500), required: false },
            { step: 35, description: 'Cerrando ventana final (si existe)', action: () => this.clickCloseButton(5000, { allowAbsent: true }), required: true }
        ];

        // NUEVO FLUJO: Para canales sin monetizar
        const uploadingFilesNonMonetizedFlow = [
            // Pasos 1-10 del flujo base
            ...uploadingFilesFlow.slice(0, 13), // steps 1 to 12 (incluyendo 10 y 11)
            // Paso 15 del flujo base
            uploadingFilesFlow[17], // step 17 (índice desplazado)
            // Paso 22 del flujo base
            uploadingFilesFlow[24], // step 24 (índice desplazado)
            // Pasos finales del flujo por defecto
            uploadingFilesDefaultFlow[25], // step 25 (Expandiendo opciones avanzadas)
            { step: 27, description: 'Abriendo selector de fecha (Sin Monetizar)', action: () => this.clickRightIconNonMonetized(), required: true },
            uploadingFilesDefaultFlow[28], // step 28 (Configurando fecha)
            uploadingFilesDefaultFlow[29], // step 29 (Confirmando fecha)
            // NUEVO PASO OPCIONAL: Hacer click en el botón "Entendido" si aparece en el diálogo de pre-verificación, justo antes de confirmar la fecha.
            { step: 29.5, description: 'Confirmando advertencia (si existe)', action: () => this.clickOptionalButton('ytcp-prechecks-warning-dialog #primary-action-button', 'Entendido'), required: false },
            uploadingFilesDefaultFlow[30], // step 30 (Esperando confirmación)
            uploadingFilesDefaultFlow[32], // step 32 (Esperando publicación)
            uploadingFilesDefaultFlow[35]  // step 35 (Cerrando ventana final)
        ];

        // NUEVO FLUJO: Para canales sin monetizar, Post Patreon (Publicar como Privado)
        const uploadingFilesNonMonetizedPostPatreonFlow = [
            // Pasos 1-10 del flujo base
            ...uploadingFilesFlow.slice(0, 13), // steps 1 to 12
            // Paso 15 del flujo base
            uploadingFilesFlow[17], // step 17
            // Avanzando a configuración final
            uploadingFilesFlow[24], // step 24
            { step: 25, description: 'Seleccionando "Privado"', action: () => this.clickElementWithNavigationRecovery('#private-radio-button'), required: true },
            { step: 26, description: 'Guardando video privado', action: () => this.clickElement('#done-button'), required: true },
            { step: 27, description: 'Esperando guardado', action: () => this.wait(1000), required: false },
            { step: 28, description: 'Cerrando primer diálogo (si existe)', action: () => this.clickCloseButton(5000, { allowAbsent: true }), required: true },
            { step: 29, description: 'Esperando segundo diálogo', action: () => this.wait(500), required: false },
            { step: 30, description: 'Cerrando ventana final (si existe)', action: () => this.clickCloseButton(5000, { allowAbsent: true }), required: true }
        ];

        // NUEVO FLUJO: Monetización Desactivada - Post Patreon
        const uploadingFilesMonetizationDisabledPostPatreonFlow = [
            // Pasos base para canal con monetización desactivada (sin pasos de monetización)
            ...uploadingFilesFlow.slice(0, 13), // steps 1 to 12
            uploadingFilesFlow[17], // step 17
            uploadingFilesFlow[24], // step 24
            // Pasos para publicación de Patreon (tomados del flujo post-patreon monetizado)
            // Esto asume que "Monetización Desactivada" aún permite "Solo para miembros"
            ...uploadingFilesPostPatreonFlow.slice(uploadingFilesFlow.length)
        ];


        // NUEVO FLUJO: Monetización Desactivada
        const uploadingFilesMonetizationDisabledFlow = [
            // Pasos 1-10 del flujo base
            ...uploadingFilesFlow.slice(0, 13), // steps 1 to 12
            // Paso 15 del flujo base
            uploadingFilesFlow[17], // step 17
            // Paso 22 del flujo base
            uploadingFilesFlow[24], // step 24
            // Pasos finales del flujo por defecto
            uploadingFilesDefaultFlow[25], // step 25 (Expandiendo opciones avanzadas)
            uploadingFilesDefaultFlow[26], // step 26 (Seleccionando "De exclusivo para miembros a público")
            uploadingFilesDefaultFlow[27], // step 27
            uploadingFilesDefaultFlow[28], // step 28
            uploadingFilesDefaultFlow[29], // step 29
            // NUEVO PASO OPCIONAL: Hacer click en el botón "Entendido" si aparece en el diálogo de pre-verificación
            { step: 29.5, description: 'Confirmando advertencia (si existe)', action: () => this.clickOptionalButton('ytcp-prechecks-warning-dialog #primary-action-button', 'Entendido'), required: false },
            uploadingFilesDefaultFlow[30], // step 30
            uploadingFilesDefaultFlow[32], // step 32
            uploadingFilesDefaultFlow[33], // step 33
            uploadingFilesDefaultFlow[34], // step 34
            uploadingFilesDefaultFlow[35]  // step 35
        ];

        const isIndividualFlow = !!(this.currentConfig && this.currentConfig.isIndividualFlow);
        
        const renumberSteps = (flowSteps) => {
            if (isIndividualFlow) {
                // Saltar el paso 1 y mantener los números originales para que muestre "Paso 2" en adelante
                return flowSteps.filter(s => s.step !== 1);
            }
            return flowSteps.map((s, i) => ({ ...s, step: i + 1 }));
        };
        
        if (channelType === 'monetization-disabled') {
            if (usePostPatreon) {
                return renumberSteps(uploadingFilesMonetizationDisabledPostPatreonFlow);
            }
            return renumberSteps(uploadingFilesMonetizationDisabledFlow);
        } else if (channelType === 'non-monetized' || (!isMonetized && !channelType)) {
            if (usePostPatreon) {
                return renumberSteps(uploadingFilesNonMonetizedPostPatreonFlow);
            }
            return renumberSteps(uploadingFilesNonMonetizedFlow);
        } else if (usePostPatreon) {
            return renumberSteps(uploadingFilesPostPatreonFlow);
        } else {
            return renumberSteps(uploadingFilesDefaultFlow);
        }
    }
    
    // Mueva verifyStepCompletion fuera de executeUploadSteps como un método de clase
    async verifyStepCompletion(step, result) {
        switch (step) {
            case 9:
                // Verificación para el paso 9: Confirmando selección
                await this.wait(1000);
                
                const titleSelectors = [
                    'ytcp-social-suggestion-input #textbox[contenteditable="true"]',
                    '#textbox[contenteditable="true"][role="textbox"]',
                    'div[contenteditable="true"][role="textbox"]',
                    this.selectors.titleInput
                ];
                
                let titleFound = false;
                for (const selector of titleSelectors) {
                    try {
                        await this.waitForElement(selector, 2000);
                        titleFound = true;
                        console.log(`Campo de título encontrado con selector: ${selector}`);
                        break;
                    } catch (error) {
                        continue;
                    }
                }
                
                if (!titleFound) {
                    throw new Error('No se pudo confirmar que la selección fue exitosa - campo de título no encontrado');
                }
                break;

            case 10:
                // Paso 10: Sin verificación - el título se actualiza correctamente
                console.log('Paso 10 completado - título actualizado, continuando sin verificación');
                break;
                
            // Las verificaciones para pasos posteriores han sido removidas porque 
            // la renumeración dinámica de pasos hace que el mismo número de paso
            // apunte a diferentes acciones en cada flujo, provocando errores falsos.
            // Las acciones críticas lanzan sus propios errores si fallan.
                
            default:
                if (result === null || result === undefined) {
                    throw new Error(`El paso ${step} no retornó un resultado válido`);
                }
        }
    }


    async waitForElementByText(texts, timeout = 4000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const allElements = document.querySelectorAll('button, span, div, ytcp-button, [role="button"]');
                
                for (const element of allElements) {
                    const textContent = (element.textContent || '').trim().toLowerCase();
                    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
                    
                    for (const text of texts) {
                        if (textContent.includes(text.toLowerCase()) || ariaLabel.includes(text.toLowerCase())) {
                            if (this.isElementInteractable(element)) {
                                console.log(`Elemento encontrado por texto "${text}":`, element);
                                resolve(element);
                                return;
                            }
                        }
                    }
                }
                
                if (Date.now() - startTime > timeout) {
                    reject(new Error(`No se encontró elemento con textos: ${texts.join(', ')}`));
                    return;
                }
                
                setTimeout(checkElement, 1000);
            };
            
            checkElement();
        });
    }

    async searchBaseVideo() {
        console.log('Buscando video base...');
        
        const searchInput = await this.waitForElement(this.selectors.searchInput);
        
        const isContentEditable = searchInput.contentEditable === 'true' || 
                                 searchInput.getAttribute('contenteditable') === 'true';
        
        console.log(`Campo de búsqueda - contentEditable: ${isContentEditable}`);
        
        if (isContentEditable) {
            searchInput.textContent = '';
            searchInput.focus();
            await this.wait(300);

            searchInput.textContent = this.currentConfig.previousRangeName;
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            if (searchInput.value !== undefined) {
                searchInput.value = '';
            }
            searchInput.focus();
            await this.wait(300);

            await this.typeText(searchInput, this.currentConfig.previousRangeName);
        }
        
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13 });
        searchInput.dispatchEvent(enterEvent);

        console.log(`Búsqueda realizada para: ${this.currentConfig.previousRangeName}`);
        
        return searchInput; // Devolver el elemento para confirmar el éxito del paso
    }

    async verifyFileAndName() {
        console.log('=== VERIFICANDO ARCHIVO Y NOMBRE ===');
        
        const titleSelectors = [
            'ytcp-social-suggestion-input #textbox[contenteditable="true"]',
            '#textbox[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"][aria-label*="tulo"]',
            'div[contenteditable="true"][aria-label*="itle"]'
        ];

        let titleElement = null;

        // Intentar hasta 3 segundos por selector para encontrar el campo de título
        for (const selector of titleSelectors) {
            try {
                titleElement = await this.waitForElement(selector, 3000);
                if (titleElement) break;
            } catch (e) {}
        }
        
        if (!titleElement) {
            const allDivs = document.querySelectorAll('div[contenteditable="true"]');
            for (const div of allDivs) {
                const ariaLabel = div.getAttribute('aria-label') || '';
                if (ariaLabel.toLowerCase().includes('título') || ariaLabel.toLowerCase().includes('title')) {
                    titleElement = div;
                    break;
                }
            }
        }

        if (!titleElement) {
            console.warn('Verificación de nombre: campo de título no encontrado, continuando sin verificar.');
            return true; // No bloquear el proceso
        }

        let inputName = '';
        for (let i = 0; i < 15; i++) {
            inputName = (titleElement.textContent || titleElement.value || '').trim();
            if (inputName.length > 0) break;
            await this.wait(500);
        }
        
        if (!inputName) {
            console.warn('Verificación de nombre: el campo de título está vacío, continuando sin verificar.');
            return true; // No bloquear si YouTube no llenó el campo aún
        }

        console.log(`Nombre detectado en el input: "${inputName}"`);

        const configFanficName = (this.currentConfig.fanficName || '').trim();
        const configRangeRaw = String(this.currentConfig.currentRange || '').trim();
        const currentFileIndex = this.currentConfig.currentFileIndex || 0;

        // Extraer el rango del inputName.
        // Acepta rangos desde 000-025 y también superiores a 999, por ejemplo
        // 1001-1025. YouTube puede sustituir el guion por un espacio o una raya.
        const rangeMatch = inputName.match(/(\d{3,})\s*(?:[-\u2012\u2013\u2014]|\s)\s*(\d{3,})/);
        const inputRange = rangeMatch ? `${rangeMatch[1]}-${rangeMatch[2]}` : null;
        const configRangeMatch = configRangeRaw.match(/(\d{3,})\s*(?:[-\u2012\u2013\u2014]|\s)\s*(\d{3,})/);
        const configRange = configRangeMatch
            ? `${configRangeMatch[1]}-${configRangeMatch[2]}`
            : configRangeRaw;
        
        // Inicializar a su valor original antes de modificarlo en caso de reintentos
        if (!this.currentConfig.originalIncrementedName) {
            this.currentConfig.originalIncrementedName = this.currentConfig.incrementedName;
        } else {
            this.currentConfig.incrementedName = this.currentConfig.originalIncrementedName;
        }
        
        // Limpiar el nombre del input
        let cleanedInputName = inputName;
        if (inputRange) {
            cleanedInputName = cleanedInputName.replace(rangeMatch[0], '');
        }
        // Limpiar extensión de archivo si YouTube la incluyó
        cleanedInputName = cleanedInputName.replace(/\.(mp4|mkv|avi|mov|wmv)$/i, '');
        
        // Buscar sufijo de PARTE en inputName
        const partMatchRegex = /[-_\s]+(PARTE[-\s]*\d+)/i;
        let partMatch = cleanedInputName.match(partMatchRegex);
        this.detectedPart = null;
        if (partMatch) {
            let detectedPart = partMatch[1].trim(); // Ej. "PARTE-1"
            this.currentConfig.incrementedName = `${this.currentConfig.originalIncrementedName}-${detectedPart}`;
            this.detectedPart = detectedPart;
            console.log(`Se detectó un sufijo de parte: ${detectedPart}. Título actualizado a: ${this.currentConfig.incrementedName}`);
            cleanedInputName = cleanedInputName.replace(partMatchRegex, '');
        }

        // Quitar códigos alfanuméricos iniciales (ej. INGUIXF )
        cleanedInputName = cleanedInputName.replace(/^[A-Z0-9_]{3,10}\s+/, '');
        cleanedInputName = cleanedInputName.trim();

        // Algoritmo de Levenshtein para similitud
        const levenshteinDistance = (a, b) => {
            if(a.length === 0) return b.length; 
            if(b.length === 0) return a.length; 
            const matrix = [];
            let i, j;
            for(i = 0; i <= b.length; i++){ matrix[i] = [i]; }
            for(j = 0; j <= a.length; j++){ matrix[0][j] = j; }
            for(i = 1; i <= b.length; i++){
                for(j = 1; j <= a.length; j++){
                    if(b.charAt(i-1) === a.charAt(j-1)){
                        matrix[i][j] = matrix[i-1][j-1];
                    } else {
                        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, Math.min(matrix[i][j-1] + 1, matrix[i-1][j] + 1));
                    }
                }
            }
            return matrix[b.length][a.length];
        };

        let nameSimilarity = 0;
        if (configFanficName.length > 0 && cleanedInputName.length > 0) {
            const distance = levenshteinDistance(configFanficName.toLowerCase(), cleanedInputName.toLowerCase());
            const maxLength = Math.max(configFanficName.length, cleanedInputName.length);
            nameSimilarity = 1 - (distance / maxLength);
        } else if (configFanficName.length === 0 && cleanedInputName.length === 0) {
            nameSimilarity = 1.0;
        }

        console.log(`Similitud de nombre calculada: ${(nameSimilarity * 100).toFixed(2)}%`);
        console.log(`Rango del input: ${inputRange}, Rango configurado: ${configRange}`);

        const namesMatch = nameSimilarity >= 0.8;
        const rangesMatch = inputRange === configRange;

        if (currentFileIndex === 0) {
            // Comenzando recién la automatización
            if (!namesMatch || !rangesMatch) {
                const errorMsg = `⛔ Automatización detenida: El archivo inicial no coincide.\nArchivo detectado: "${inputName}"\nEsperado: "${configFanficName} ${configRange}"\nSimilitud nombre: ${(nameSimilarity * 100).toFixed(1)}%`;
                this.isProcessing = false;
                this.sendMessage('processStopped', { message: errorMsg });
                throw new Error('PROCESS_PAUSED');
            }
        } else {
            // La automatización ya está avanzada
            if (!namesMatch) {
                const errorMsg = `⛔ Automatización detenida: El nombre no coincide.\nDetectado: "${inputName}"\nEsperado: "${configFanficName}"\nSimilitud: ${(nameSimilarity * 100).toFixed(1)}%`;
                this.isProcessing = false;
                this.sendMessage('processStopped', { message: errorMsg });
                throw new Error('PROCESS_PAUSED');
            }

            if (!rangesMatch && inputRange) {
                const configStart = parseInt(configRange.split('-')[0], 10);
                const inputStart = parseInt(inputRange.split('-')[0], 10);
                
                if (inputStart > configStart) {
                    console.log(`Salto de rango detectado. Configurado: ${configRange}, Encontrado en archivo: ${inputRange}`);
                    
                    // Enviar mensaje al background/popup para que el contador salte a este rango
                    this.sendMessage('updateCounterToRange', { 
                        newRange: inputRange, 
                        missingRange: configRange,
                        newRangeStart: inputStart 
                    });
                    
                    // Actualizar config actual para continuar con el nuevo rango en este flujo
                    this.currentConfig.currentRange = inputRange;
                    // El incrementedName también cambia
                    this.currentConfig.incrementedName = `${configFanficName} ${inputRange}`;
                } else if (inputStart < configStart) {
                    // Si el rango es menor, algo está muy mal, detenemos
                    const errorMsg = `⛔ Automatización detenida: El rango del archivo (${inputRange}) es inferior al esperado (${configRange}).`;
                    this.isProcessing = false;
                    this.sendMessage('processStopped', { message: errorMsg });
                    throw new Error('PROCESS_PAUSED');
                }
            } else if (!rangesMatch && !inputRange) {
                // No se detectó rango pero el nombre sí coincide: continuar de todas formas
                console.warn(`No se detectó rango en "${inputName}", pero el nombre coincide. Continuando...`);
            }
        }
        
        return true;
    }

    async updateVideoTitle() {
        console.log('Actualizando título del video...');
        
        const titleSelectors = [
            'ytcp-social-suggestion-input #textbox[contenteditable="true"]',
            '#textbox[contenteditable="true"][role="textbox"]' // Backup genérico
        ];

        let titleElement = null;
        
        for (const selector of titleSelectors) {
            try {
                console.log(`Probando selector de título: ${selector}`);
                titleElement = await this.waitForElement(selector, 2000);
                if (titleElement) {
                    console.log('Campo de título encontrado:', titleElement);
                    break;
                }
            } catch (error) {
                console.log(`Selector ${selector} falló:`, error.message);
                continue;
            }
        }

        if (!titleElement) {
            console.log('Buscando elemento de título manualmente...');
            const allDivs = document.querySelectorAll('div[contenteditable="true"]');
            for (const div of allDivs) {
                const ariaLabel = div.getAttribute('aria-label') || '';
                const id = div.id || '';
                const role = div.getAttribute('role') || '';
                
                if (ariaLabel.toLowerCase().includes('título') || 
                    ariaLabel.toLowerCase().includes('title') ||
                    (id === 'textbox' && role === 'textbox')) {
                    titleElement = div;
                    console.log('Elemento encontrado manualmente:', titleElement);
                    break;
                }
            }
        }

        if (!titleElement) {
            throw new Error('No se pudo encontrar el campo de título después de probar todos los métodos');
        }
        
        const isContentEditable = titleElement.contentEditable === 'true' || 
                                 titleElement.getAttribute('contenteditable') === 'true';
        
        if (!isContentEditable) {
            titleElement.focus();
            if (titleElement.value !== undefined) {
                titleElement.value = this.currentConfig.incrementedName;
                titleElement.dispatchEvent(new Event('input', { bubbles: true }));
                titleElement.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                titleElement.textContent = this.currentConfig.incrementedName;
                titleElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else {
            titleElement.focus();
            await this.wait(300);
            
            try {
                const range = document.createRange();
                range.selectNodeContents(titleElement);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                await this.wait(200);
                
                document.execCommand('insertText', false, this.currentConfig.incrementedName);
                
            } catch (rangeError) {
                console.log('Método de rango falló, usando método directo:', rangeError);
                titleElement.textContent = this.currentConfig.incrementedName;
            }
            
            titleElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            titleElement.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            titleElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true }));
            titleElement.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
        }
        
        console.log(`Título actualizado a: ${this.currentConfig.incrementedName}`);
        
        await this.wait(1000);
        const currentContent = titleElement.textContent || titleElement.value || '';
        const expectedStart = this.currentConfig.incrementedName.substring(0, 15);
        
        if (!currentContent.includes(expectedStart)) {
            titleElement.focus();
            await this.wait(300);
            titleElement.textContent = this.currentConfig.incrementedName;
            
            titleElement.dispatchEvent(new InputEvent('input', { 
                bubbles: true, 
                cancelable: true,
                inputType: 'insertText',
                data: this.currentConfig.incrementedName
            }));
            titleElement.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        return titleElement;
    }

    async scrollToThumbnail() {
        console.log('Desplazando a botón de miniatura...');
        try {
            const element = await this.waitForElement(this.selectors.thumbnailUploadButton, 5000);
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.wait(1000);
            return element;
        } catch (e) {
            console.warn('No se pudo hacer scroll a la miniatura:', e);
            return true; // No fallar el proceso por esto
        }
    }

    async dataURLtoFile(dataUrl, filename) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    }

    async uploadThumbnail(retryCount = 0) {
        if (!this.currentConfig.thumbnailData) {
            console.log('No hay miniatura personalizada configurada para este video.');
            return;
        }
        
        console.log(`Iniciando carga de miniatura personalizada (intento ${retryCount + 1})...`);
        
        try {
            // Estrategias de búsqueda para el input de archivo
            const selectors = [
                'ytcp-video-custom-still-editor input[type="file"]',
                'ytcp-thumbnail-editor input[type="file"]',
                '#file-loader',
                'input[type="file"][accept="image/*"]'
            ];

            let fileInput = null;
            for (const selector of selectors) {
                fileInput = document.querySelector(selector);
                if (fileInput) {
                    console.log(`Input de miniatura encontrado con selector: ${selector}`);
                    break;
                }
            }
            
            if (fileInput) {
                // Convertir base64 a File
                const file = await this.dataURLtoFile(this.currentConfig.thumbnailData, 'thumbnail.png');
                
                // Asignar archivo usando DataTransfer
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                // Disparar eventos esenciales para que YouTube reconozca el cambio
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                fileInput.dispatchEvent(new Event('blur', { bubbles: true }));
                
                console.log('Miniatura asignada exitosamente. Esperando validación visual...');
                await this.wait(2000); 
                return true;
            } else if (retryCount < 1) {
                // Un solo reintento: intentar activar el editor de miniaturas
                console.warn('Input de miniatura no encontrado, intentando activar el editor...');
                const uploadBtn = document.querySelector('ytcp-button#plus-button') || 
                                  document.querySelector('ytcp-thumbnails-compact-editor-v2 #plus-button');
                if (uploadBtn) {
                    uploadBtn.click();
                    await this.wait(1000);
                    return this.uploadThumbnail(retryCount + 1); // Reintento único y controlado
                }
                console.warn('Botón de editor no encontrado, saltando miniatura.');
                return false; // No bloquear el proceso si no se puede subir miniatura
            } else {
                console.warn('No se pudo encontrar el input de miniatura tras 2 intentos. Continuando sin miniatura.');
                return false;
            }
        } catch (error) {
            console.error('Error en uploadThumbnail:', error);
            // No relanzar el error para no detener el proceso por un problema de miniatura
            return false;
        }
    }

    async clickMembersToPublicRadio() {
        console.log('Haciendo click en radio "De exclusivo para miembros a público"...');
        
        const strategies = [
            // Estrategia JSON: Click en offRadio si está presente (estado inicial)
            async () => {
                const offRadio = await this.waitForElement('tp-yt-paper-radio-button#publish-from-sponsors-only #offRadio', 2000);
                if (offRadio && this.isElementInteractable(offRadio)) {
                    console.log('Encontrado #offRadio, clickeando...');
                    offRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    offRadio.click();
                    return offRadio;
                }
                throw new Error('offRadio no encontrado');
            },
            async () => {
                const radioButton = await this.waitForElement('tp-yt-paper-radio-button#publish-from-sponsors-only', 3000);
                if (radioButton && this.isElementInteractable(radioButton)) {
                    radioButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    radioButton.click();
                    return radioButton;
                }
                throw new Error('Radio button completo no encontrado');
            },
            
            async () => {
                const onRadio = await this.waitForElement('tp-yt-paper-radio-button#publish-from-sponsors-only #onRadio', 3000);
                if (onRadio && this.isElementInteractable(onRadio)) {
                    onRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    onRadio.click();
                    return onRadio;
                }
                throw new Error('OnRadio específico no encontrado');
            }
        ];
        
        for (let i = 0; i < strategies.length; i++) {
            try {
                const result = await strategies[i]();
                
                if (result) {
                    await this.wait(1000);
                    
                    const radioElement = document.querySelector('tp-yt-paper-radio-button#publish-from-sponsors-only');
                    if (radioElement) {
                        const isChecked = radioElement.getAttribute('aria-checked') === 'true';
                        
                        if (isChecked) {
                            console.log(`Estrategia ${i + 1} exitosa - radio seleccionado`);
                            return result;
                        }
                    }
                    
                    return result;
                }
            } catch (error) {
                console.log(`Estrategia ${i + 1} falló:`, error.message);
                continue;
            }
        }
        
        throw new Error('No se pudo hacer click en el radio "De exclusivo para miembros a público"');
    }

    async clickRightIconNonMonetized() {
        console.log('Haciendo click en icono derecho (Flujo Sin Monetizar)...');
        
        // Esperar a que la expansión del paso anterior termine
        await this.wait(1000);
        
        const strategies = [
            // Estrategia 1: Selector CSS directo al ID del trigger proporcionado en el HTML
            async () => {
                const selector = 'ytcp-text-dropdown-trigger#datepicker-trigger';
                const element = await this.waitForElement(selector, 2000);
                if (this.isElementInteractable(element)) {
                    console.log(`Encontrado trigger por ID: ${selector}`);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    element.click();
                    return element;
                }
                throw new Error('Trigger ID not found');
            },
            // Estrategia 2: Selector al contenedor derecho dentro del trigger (donde está el icono)
            async () => {
                const selector = 'ytcp-text-dropdown-trigger#datepicker-trigger .right-container';
                const element = await this.waitForElement(selector, 2000);
                if (this.isElementInteractable(element)) {
                    console.log(`Encontrado right-container: ${selector}`);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    element.click();
                    return element;
                }
                throw new Error('Right container not found');
            },
            // Estrategia 3: Selector al icono específico dentro del trigger
            async () => {
                const selector = 'ytcp-text-dropdown-trigger#datepicker-trigger #right-icon';
                const element = await this.waitForElement(selector, 2000);
                if (this.isElementInteractable(element)) {
                    console.log(`Encontrado right-icon: ${selector}`);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    element.click();
                    return element;
                }
                throw new Error('Right icon not found');
            },
            // Estrategia 4: XPath basado en la estructura HTML
            async () => {
                const selector = '//ytcp-text-dropdown-trigger[@id="datepicker-trigger"]//div[contains(@class, "right-container")]';
                const element = await this.waitForElement(selector, 2000);
                if (this.isElementInteractable(element)) {
                    console.log(`Encontrado por XPath: ${selector}`);
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    element.click();
                    return element;
                }
                throw new Error('XPath not found');
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const result = await strategies[i]();
                await this.wait(1000);
                return result;
            } catch (e) {
                console.log(`Estrategia ${i+1} (Sin Monetizar) falló:`, e.message);
            }
        }
        
        throw new Error('No se pudo hacer click en el icono derecho (Sin Monetizar)');
    }

    async clickRightIcon() {
        console.log('Haciendo click en elemento para abrir configuración de fecha...');
        
        const strategies = [
            // Estrategia JSON: Específica para early-access-scheduler
            async () => {
                const selectors = [
                    'ytcp-visibility-scheduler.early-access-scheduler-sponsors-only div.right-container div',
                    'ytcp-visibility-scheduler.early-access-scheduler-sponsors-only #right-icon',
                    '//*[@id="right-icon"]/span/div'
                ];
                
                for (const selector of selectors) {
                    try {
                        const element = await this.waitForElement(selector, 1000);
                        if (this.isElementInteractable(element)) {
                            console.log('Encontrado por estrategia JSON:', selector);
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await this.wait(500);
                            element.click();
                            return element;
                        }
                    } catch (e) { continue; }
                }
                throw new Error('Estrategia JSON no encontró el elemento');
            },
            // Estrategia 0: NUEVA - Basada en actualización de YouTube (yt-icon)
            async () => {
                const rightIcon = document.querySelector('ytcp-text-dropdown-trigger#datepicker-trigger yt-icon#right-icon') ||
                                  document.querySelector('ytcp-text-dropdown-trigger#datepicker-trigger .right-container yt-icon');
                
                if (rightIcon && this.isElementInteractable(rightIcon)) {
                    console.log('Encontrado yt-icon nuevo:', rightIcon);
                    rightIcon.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    rightIcon.click();
                    return rightIcon;
                }
                
                // Fallback: Click en el contenedor .right-container (basado en HTML proporcionado)
                const rightContainer = document.querySelector('ytcp-text-dropdown-trigger#datepicker-trigger .right-container');
                if (rightContainer && this.isElementInteractable(rightContainer)) {
                    console.log('Encontrado container derecho:', rightContainer);
                    rightContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    rightContainer.click();
                    return rightContainer;
                }

                throw new Error('yt-icon nuevo no encontrado');
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`Probando estrategia ${i + 1} para abrir selector de fecha...`);
                const result = await strategies[i]();

                // Esperar un poco más para que el dropdown se abra
                await this.wait(1500);
                
                console.log(`Estrategia ${i + 1} completada - continuando sin verificación`);
                return result; // Si la estrategia no lanza error, tiene éxito. Salimos de la función.

            } catch (error) {
                console.log(`Estrategia ${i + 1} falló:`, error.message);
                continue;
            }
        }
        
        // Si llegamos aquí, ninguna estrategia funcionó
        console.error('Todas las estrategias fallaron. Intentando método de emergencia...');
        
        // Método de emergencia: buscar y hacer click en cualquier cosa relacionada con fecha
        try {
            const emergencySelectors = [
                '[id*="date"]',
                '[class*="date"]',
                '[aria-label*="fecha"]',
                '[aria-label*="date"]',
                'ytcp-text-dropdown-trigger',
                'ytcp-dropdown-trigger'
            ];
            
            for (const selector of emergencySelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (this.isElementInteractable(element) && 
                        (element.textContent.toLowerCase().includes('ago') || 
                        element.textContent.toLowerCase().includes('2025') ||
                        element.getAttribute('aria-label')?.toLowerCase().includes('fecha'))) {
                        
                        console.log('Método de emergencia - clickeando elemento relacionado con fecha:', element);
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await this.wait(500);
                        element.click();
                        
                        await this.wait(1500);
                        console.log('Método de emergencia completado');
                        return element;
                    }
                }
            }
        } catch (emergencyError) {
            console.error('Método de emergencia también falló:', emergencyError);
        }
        
        throw new Error('No se pudo hacer click en el selector de fecha después de probar todas las estrategias');
    }
    // Abre el dropdown del selector de niveles de patrocinio
    async clickSponsorshipTierSelector() {
        console.log('Intentando abrir selector de niveles de patrocinio...');
        const strategies = [
            // Estrategia 1: click en el dropdown-trigger dentro del ytcp-select
            async () => {
                const select = document.querySelector('ytcp-select.sponsorships-tier-selector') ||
                            document.querySelector('ytcp-select[class*="sponsorships-tier-selector"]') ||
                            document.querySelector('ytcp-select[placeholder*="Elige"]');
                if (!select) throw new Error('ytcp-select no encontrado');
                const trigger = select.querySelector('ytcp-text-dropdown-trigger ytcp-dropdown-trigger') ||
                                select.querySelector('ytcp-dropdown-trigger[role="button"]') ||
                                select.querySelector('[role="button"]') ||
                                select.querySelector('div.container[role="button"]');
                if (!trigger) throw new Error('trigger interno no encontrado');
                trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.wait(200);
                // intentar varios tipos de "click"
                try { trigger.click(); } catch(e) { 
                    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    trigger.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                return trigger;
            },

            // Estrategia 2: buscar por id "trigger" en ytcp-text-dropdown-trigger
            async () => {
                const trigger = document.querySelector('ytcp-text-dropdown-trigger#trigger ytcp-dropdown-trigger') ||
                                document.querySelector('#trigger ytcp-dropdown-trigger');
                if (!trigger) throw new Error('trigger #trigger no encontrado');
                trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.wait(200);
                trigger.click();
                return trigger;
            },

            // Estrategia 3: dispatch keyboard Enter sobre el elemento padre
            async () => {
                const parent = document.querySelector('ytcp-select.sponsorships-tier-selector') ||
                            document.querySelector('ytcp-text-dropdown-trigger#trigger') ||
                            document.querySelector('ytcp-select');
                if (!parent) throw new Error('Elemento padre para teclado no encontrado');
                parent.focus();
                const ev = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true });
                parent.dispatchEvent(ev);
                await this.wait(300);
                return parent;
            },

            // Estrategia 4: buscar cualquier elemento clickeable dentro del componente y clickear
            async () => {
                const candidate = document.querySelector('ytcp-select') || document.body;
                const clickable = candidate.querySelectorAll('[role="button"], [tabindex="0"], button, div.container');
                for (const el of clickable) {
                    if (this.isElementInteractable(el)) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await this.wait(100);
                        el.click();
                        return el;
                    }
                }
                throw new Error('No se encontró elemento clickeable dentro del selector');
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                console.log(`Estrategia ${i+1} para abrir sponsorship selector...`);
                const res = await strategies[i]();
                await this.wait(700); // dejar tiempo al UI para abrir
                console.log('Selector abierto con estrategia', i+1, res);
                return res;
            } catch (err) {
                console.log(`Estrategia ${i+1} falló:`, err.message);
                continue;
            }
        }

        throw new Error('No fue posible abrir el selector de niveles de patrocinio');
    }

    // Selecciona una opción del menú por texto parcial (más robusto que #text-item-2)
    async selectNinjaKageOption() {
        console.log('Buscando opción de nivel "Ninja Kage"...');
        const searchTexts = [
            'Ninja Kage 🥇🏅 y superiores',
            'Ninja Kage🥇🏅 y superiores'
        ];
        const timeout = 5000;
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const items = document.querySelectorAll('tp-yt-paper-item');
            
            for (const textToFind of searchTexts) {
                for (const item of items) {
                    const txt = (item.textContent || '').trim();
                    if (txt.includes(textToFind)) {
                        console.log(`Opción encontrada con el texto "${textToFind}":`, txt);
                        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await this.wait(200);
    
                        try {
                            item.click();
                        } catch (e) {
                            console.warn('Click fallido, pero no se reintenta con eventos de mouse.');
                        }
    
                        await this.wait(400);
                        return true; // ✅ Retorna éxito
                    }
                }
            }

            await this.wait(200);
        }

        console.log('No se encontró la opción de nivel "Ninja Kage" dentro del tiempo establecido.');
        return false; // ✅ Retorna falso si no fue encontrada
    }

    async setPublishDate() {
        console.log('Configurando fecha de publicación...');
        
        await this.wait(1000);
        
        const dateInputStrategies = [
            () => this.waitForElement('ytcp-date-picker input', 3000)
        ];
        
        let dateInput = null;
        for (let i = 0; i < dateInputStrategies.length; i++) {
            try {
                console.log(`Buscando campo de fecha con estrategia ${i + 1}...`);
                dateInput = await dateInputStrategies[i]();
                if (dateInput) {
                    console.log('Campo de fecha encontrado:', dateInput);
                    break;
                }
            } catch (error) {
                console.log(`Estrategia de búsqueda ${i + 1} falló:`, error.message);
                continue;
            }
        }
        
        if (!dateInput) {
            console.log('Búsqueda manual de campo de fecha...');
            const allInputs = document.querySelectorAll('input');
            for (const input of allInputs) {
                if (input.closest('ytcp-date-picker') || 
                    input.getAttribute('aria-label')?.toLowerCase().includes('fecha') ||
                    input.getAttribute('aria-label')?.toLowerCase().includes('date')) {
                    dateInput = input;
                    console.log('Campo encontrado manualmente:', dateInput);
                    break;
                }
            }
        }
        
        if (!dateInput) {
            throw new Error('No se pudo encontrar el campo de entrada de fecha');
        }
        
        dateInput.focus();
        await this.wait(500);
        
        if (typeof dateInput.select === 'function') {
            dateInput.select();
        }
        await this.wait(200);
        
        try {
            document.execCommand('selectAll');
            document.execCommand('delete');
            await this.wait(200);
            document.execCommand('insertText', false, this.currentConfig.currentDate);
        } catch (execError) {
            dateInput.value = this.currentConfig.currentDate;
        }
        
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        await this.wait(500);
        
        const enterEvent = new KeyboardEvent('keydown', { 
            key: 'Enter', 
            keyCode: 13, 
            bubbles: true, 
            cancelable: true 
        });
        dateInput.dispatchEvent(enterEvent);
        
        console.log(`Fecha configurada a: ${this.currentConfig.currentDate}`);
        
        return dateInput;
    }

    async clickSelectButton() {
        console.log('Intentando hacer click en botón "Reutilizar"...');

        const strategies = [
            async () => {
                const button = await this.waitForElement('button[aria-label="Reutilizar"]', 3000);
                if (button && this.isElementInteractable(button)) {
                    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await this.wait(500);
                    button.click();
                    return button;
                }
                throw new Error('No se encontró por aria-label');
            }
        ];

        for (let i = 0; i < strategies.length; i++) {
            try {
                const result = await strategies[i]();
                
                if (result) {
                    await this.wait(1000);
                    try {
                        await this.waitForElement(this.selectors.titleInput, 3000);
                        console.log(`Estrategia ${i + 1} exitosa - botón Reutilizar clickeado`);
                        return result;
                    } catch (verifyError) {
                        continue;
                    }
                }
            } catch (error) {
                console.log(`Estrategia ${i + 1} falló:`, error.message);
                continue;
            }
        }
        
        throw new Error('No se pudo encontrar el botón "Reutilizar"');
    }

    async typeText(element, text) {
        const isContentEditable = element.contentEditable === 'true' || 
                                 element.getAttribute('contenteditable') === 'true';
        
        if (isContentEditable) {
            element.textContent = text;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            if (element.value !== undefined) {
                element.value = text;
            } else {
                element.textContent = text;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        await this.wait(500);
    }

    async clickElementWithNavigationRecovery(selector) {
        try {
            return await this.clickElement(selector);
        } catch (error) {
            console.log(`Elemento ${selector} no encontrado. Intentando recuperación de navegación (Atrás -> Siguiente)...`);
            
            try {
                // 1. Buscar y clickear botón Atrás
                const backButton = await this.waitForElement(this.selectors.backButton || '//*[@id="back-button"]', 2000);
                if (this.isElementInteractable(backButton)) {
                    console.log('Recuperación: Click en Atrás');
                    backButton.click();
                    await this.wait(2000);
                    
                    // 2. Buscar y clickear botón Siguiente (Paso 24)
                    const nextButton = await this.waitForElement(this.selectors.nextButton, 2000);
                    if (this.isElementInteractable(nextButton)) {
                        console.log('Recuperación: Click en Siguiente');
                        nextButton.click();
                        await this.wait(3000); // Esperar a que cargue la siguiente pantalla
                        
                        // 3. Reintentar el click original (Paso 25)
                        console.log('Recuperación: Reintentando acción original');
                        return await this.clickElement(selector);
                    }
                }
            } catch (recoveryError) {
                console.warn('Falló la recuperación de navegación:', recoveryError);
            }
            
            throw error; // Si falla la recuperación, lanzar el error original
        }
    }

    async clickElement(selector) {
        const element = await this.waitForElement(selector);
        
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await this.wait(500);
        
        try {
            element.click();
        } catch (error) {
            console.warn(`Error al hacer click estándar en ${selector}, intentando MouseEvents:`, error);
            element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
        return element;
    }

    async clickCloseButton(timeout = 15000, { allowAbsent = false } = {}) {
        const closeSelectors = [
            'button[aria-label="Cerrar"]',
            'button[aria-label="Close"]',
            'ytcp-button#close-button button',
            '#close-button ytcp-button-shape button',
            'ytcp-button#close-button'
        ];
        const deadline = Date.now() + timeout;
        let lastCandidate = null;

        while (Date.now() < deadline) {
            const candidates = closeSelectors.flatMap(selector =>
                Array.from(document.querySelectorAll(selector))
            );
            const button = candidates.find(element =>
                this.isElementInteractable(element) &&
                element.getAttribute('aria-disabled') !== 'true' &&
                !element.disabled
            );

            if (!button) {
                await this.wait(250);
                continue;
            }

            lastCandidate = button;
            const dialog = button.closest(
                'ytcp-dialog, tp-yt-paper-dialog, ytcp-uploads-still-processing-dialog, ytcp-prechecks-warning-dialog, [role="dialog"]'
            );

            button.scrollIntoView({
                behavior: document.hidden ? 'auto' : 'smooth',
                block: 'center'
            });
            button.focus({ preventScroll: true });
            button.click();

            // YouTube Studio conserva algunos diálogos ocultos en el DOM. El paso
            // solo termina cuando el diálogo o su botón realmente desaparecen.
            const confirmationDeadline = Date.now() + 4000;
            while (Date.now() < confirmationDeadline) {
                const dialogClosed = dialog &&
                    (!dialog.isConnected || !this.isElementInteractable(dialog));
                const buttonClosed = !button.isConnected ||
                    !this.isElementInteractable(button) ||
                    button.getAttribute('aria-disabled') === 'true';

                if (dialogClosed || buttonClosed) return button;
                await this.wait(200);
            }

            // Respaldo para componentes que ignoran HTMLElement.click().
            for (const eventName of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
                button.dispatchEvent(new MouseEvent(eventName, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            }
            await this.wait(500);

            if (!button.isConnected || !this.isElementInteractable(button) ||
                (dialog && (!dialog.isConnected || !this.isElementInteractable(dialog)))) {
                return button;
            }
        }

        if (!lastCandidate && allowAbsent) {
            console.log('No hay ningún diálogo visible que cerrar; continuando el flujo.');
            return false;
        }

        const detail = lastCandidate
            ? 'El botón "Cerrar" permaneció visible después de los intentos de clic'
            : 'No se encontró un botón visible con aria-label="Cerrar"';
        throw new Error(`${detail} después de ${timeout}ms`);
    }

    async clickOptionalButton(selector, description) {
        console.log(`Buscando botón opcional: ${description}`);
        try {
            // Usar un timeout corto porque es opcional
            const element = await this.waitForElement(selector, 2000);
            console.log(`Botón opcional encontrado: ${description}. Haciendo click...`);
            element.click();
            await this.wait(500); // Esperar un poco después del click
            return true;
        } catch (error) {
            console.log(`Botón opcional no encontrado o no interactuable: ${description}. Continuando...`);
            return false; // No es un error, simplemente no se encontró
        }
    }

    async waitAndClick(waitTime, selector) {
        await this.wait(waitTime);
        return this.clickElement(selector);
    }

    /**
     * Espera a que un elemento sea interactuable (visible y clickeable).
     * @param {string} selector 
     * @param {number} timeout 
     * @returns {Promise<HTMLElement>}
     */
    async waitForInteractable(selector, timeout = 10000) {
        console.log(`Esperando elemento interactuable: ${selector}`);
        return this.waitForElement(selector, timeout);
    }

    async waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let isResolved = false;
            
            const checkElement = () => {
                if (isResolved) return;

                let interactableElement = null;
                try {
                    if (selector.startsWith('//') || selector.startsWith('/')) {
                        const result = document.evaluate(
                            selector,
                            document,
                            null,
                            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                            null
                        );
                        for (let i = 0; i < result.snapshotLength; i++) {
                            const node = result.snapshotItem(i);
                            if (this.isElementInteractable(node)) {
                                interactableElement = node;
                                break;
                            }
                        }
                    } else {
                        const elements = document.querySelectorAll(selector);
                        for (const node of elements) {
                            if (this.isElementInteractable(node)) {
                                interactableElement = node;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error en selector:', e);
                }
                
                if (!this.isProcessing) {
                    isResolved = true;
                    reject(new Error('PROCESS_PAUSED'));
                    return;
                }
                
                if (interactableElement) {
                    isResolved = true;
                    resolve(interactableElement);
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    isResolved = true;
                    reject(new Error(`Elemento no encontrado o no interactuable después de ${timeout}ms: ${selector}`));
                    return;
                }
                
                // Usamos una frecuencia de chequeo más rápida al inicio
                const nextCheck = Date.now() - startTime < 2000 ? 50 : 200;
                setTimeout(checkElement, nextCheck);
            };
            
            checkElement();
        });
    }

    isElementInteractable(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    }

    async wait(ms) {
        // Si la pestaña no está visible, los setTimeout son poco fiables.
        // Usamos una combinación de requestAnimationFrame para esperar de forma segura.
        if (document.hidden) {
            console.log(`Pestaña en segundo plano, esperando ${ms}ms de forma segura...`);
            const start = performance.now();
            return new Promise((resolve, reject) => {
                const checkTime = (now) => {
                    if (!this.isProcessing) {
                        reject(new Error('PROCESS_PAUSED'));
                        return;
                    }
                    if (now - start >= ms) {
                        resolve(true);
                    } else {
                        requestAnimationFrame(checkTime);
                    }
                };
                requestAnimationFrame(checkTime);
            });
        } else {
            // Si la pestaña está activa, usamos el método normal.
            const step = 50;
            let elapsed = 0;
            while (elapsed < ms) {
                if (!this.isProcessing) throw new Error('PROCESS_PAUSED');
                await new Promise(r => setTimeout(r, Math.min(step, ms - elapsed)));
                elapsed += step;
            }
            return true;
        }
    }

    sendMessage(action, data = {}) {
        chrome.runtime.sendMessage({
            action: action,
            ...data
        }).catch(error => {
            console.error('Error enviando mensaje:', error);
        });
    }

    stop() {
        this.isProcessing = false;
    }
}

if (!window.location.hostname.includes('studio.youtube.com')) {
    console.log('No estamos en YouTube Studio, extensión no activa');
} else {
    console.log('YouTube Studio detectado en:', window.location.href);
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAutomator);
    } else {
        initializeAutomator();
    }
    
    function initializeAutomator() {
        try {
            console.log('=== INICIALIZANDO AUTOMATOR ===');
            
            const automator = new YouTubeStudioAutomator();
            window.youtubeAutomator = automator;

            console.log('=== AUTOMATOR INICIALIZADO CORRECTAMENTE ===');
            
            window.addEventListener('message', (event) => {
                if (event.data.type === 'EXTENSION_READY_CHECK') {
                    event.source.postMessage({ type: 'EXTENSION_READY', ready: true }, '*');
                }
            });
            
            chrome.runtime.sendMessage({ action: 'contentScriptReady' })
                .catch(error => console.log('Error enviando mensaje de ready:', error));
            
        } catch (error) {
            console.error('=== ERROR INICIALIZANDO AUTOMATOR ===', error);
            console.error('Stack trace:', error.stack);
        }
    }
}
