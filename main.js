// MAIN.JS - The Application Controller (Updated with Enhanced Architecture)
//
// Responsibilities:
// 1. Initializing the application.
// 2. Setting up all event listeners.
// 3. Orchestrating the flow of data between the UI and the Core logic.
// 4. Managing the application's state with SSOT pattern.
// 5. Enhanced error handling and loading states.
// ===================================================================================

(function(window, Core, UI) {
    'use strict';
    
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ============================ APPLICATION STATE (ENHANCED) =============================
    const AppState = {
        // المدخلات الأساسية (مصدر الحقيقة الوحيد)
        inputs: {
            dough: { flour: 500, butter: 120, sugar: 200, honey: 100, eggs: 95, soda: 5.5 },
            filling: {
                mode: 'preset',
                preset: null,
                custom: {},
                pan: { shape: 'round', dim1: 24, dim2: null },
                layers: 8,
                thickness: 5,
                currentRecipe: null
            },
            baking: { temp: 180, time: 7 },
            tempering: { batchCount: 5 },
            chemistry: { doughTemp: 40, fillingTemp: 10 }
        },
        
        // الحالة المشتقة (يتم حسابها)
        derived: {
            doughAnalysis: null,
            doughChemistry: null,
            fillingAnalysis: null,
            fillingChemistry: null,
            compatibilityReport: null
        },
        
        // التخزين والمقارنات
        savedRecipes: [],
        comparisons: [],
        alertsQueue: [],
        
        // نظام التحميل
        isLoading: false,
        
        // آخر المدخلات المحفوظة
        lastPanInputs: {
            normal: null,
            reverse: null,
            filling: null
        }
    };

    // ============================ ENHANCED SYSTEMS =============================

    // نظام إدارة النوافذ المحسن
    const ModalManager = {
        activeModals: new Map(),
        modalCounter: 0,
        
        createModal(html, className = '', options = {}) {
            const modalId = `modal-${++this.modalCounter}`;
            
            // لا تغلق النوافذ الأخرى إلا إذا طلب ذلك صراحة
            if (options.closeOthers === true) {
                this.closeAllModals();
            }
            
            const modal = document.createElement('div');
            modal.className = `modal-overlay ${className}`;
            modal.id = modalId;
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; align-items: center;
                justify-content: center; z-index: 10000;
            `;
            
            modal.innerHTML = html;
            document.body.appendChild(modal);
            this.activeModals.set(modalId, {
                element: modal,
                created: Date.now(),
                options: options
            });
            
            // إغلاق تلقائي بعد فترة إذا تم تحديدها
            if (options.autoClose) {
                setTimeout(() => this.closeModal(modalId), options.autoClose);
            }
            
            return modalId;
        },
        
        closeModal(modalId) {
            const modalInfo = this.activeModals.get(modalId);
            if (modalInfo) {
                if (modalInfo.element && modalInfo.element.parentNode) {
                    modalInfo.element.parentNode.removeChild(modalInfo.element);
                }
                this.activeModals.delete(modalId);
            }
        },
        
        closeAllModals() {
            this.activeModals.forEach((info, id) => this.closeModal(id));
        },
        
        getModalCount() {
            return this.activeModals.size;
        }
    };

    // نظام التسجيل المحسن
    const Logger = {
        errors: [],
        isDevelopment: true,
        
        error(error, context = 'unknown') {
            const errorObj = {
                timestamp: new Date().toISOString(),
                context,
                message: error.message,
                stack: error.stack,
                userAgent: navigator.userAgent
            };
            
            this.errors.push(errorObj);
            console.error(`[${context}]`, error);
            return errorObj;
        },
        
        warn(message, context = 'unknown') {
            console.warn(`[${context}] ${message}`);
        },
        
        info(message, context = 'unknown') {
            if (this.isDevelopment) {
                console.info(`[${context}] ${message}`);
            }
        },
        
        getErrors() {
            return this.errors;
        }
    };

    // نظام Timers و Debounce المحسن
    const AppTimers = {
        filling: null,
        dough: null,
        general: null,
        
        debounce(timerName, func, delay) {
            this.clear(timerName);
            this[timerName] = setTimeout(() => {
                try {
                    func();
                } catch (error) {
                    Logger.error(error, `debounce-${timerName}`);
                } finally {
                    this[timerName] = null;
                }
            }, delay);
        },
        
        clear(timerName) {
            if (this[timerName] !== null) {
                clearTimeout(this[timerName]);
                this[timerName] = null;
            }
        },
        
        clearAll() {
            Object.keys(this).forEach(key => {
                if (this[key] !== null && typeof this[key] !== 'function') {
                    this.clear(key);
                }
            });
        }
    };

    // ============================ STATE MANAGEMENT (SSOT PATTERN) =============================

    function deepMerge(target, source) {
        if (typeof target !== 'object' || target === null) target = {};
        if (typeof source !== 'object' || source === null) return target;
        
        const result = Array.isArray(target) ? [...target] : { ...target };
        
        for (const key in source) {
            if (source.hasOwnProperty(key)) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    result[key] = deepMerge(target[key] || {}, source[key]);
                } else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }

    function updateState(updates, context = 'unknown') {
        try {
            Logger.info(`State update: ${context}`, 'updateState');
            
            // حفظ الحالة الحالية كنسخة احتياطية
            window.previousAppState = JSON.parse(JSON.stringify(AppState));
            
            // merge عميق بدلاً من سطحي
            if (updates.inputs) {
                AppState.inputs = deepMerge(AppState.inputs, updates.inputs);
            }
            
            // إعادة حساب الحالة المشتقة
            recalculateDerivedState();
            
            // تحديث الواجهة
            updateAllDisplays();
            
            // الحفظ التلقائي
            UserPreferences.save();
            
        } catch (error) {
            Logger.error(error, `updateState-${context}`);
            showErrorToUser('تعذر تحديث البيانات', error.message);
            restorePreviousState();
        }
    }

    function restorePreviousState() {
        try {
            // محاولة استعادة من النسخة الاحتياطية
            if (window.previousAppState) {
                AppState.inputs = window.previousAppState.inputs;
                recalculateDerivedState();
                updateAllDisplays();
                showToast('تم استعادة الحالة السابقة', 'warning');
            }
        } catch (restoreError) {
            Logger.error(restoreError, 'restorePreviousState');
        }
    }

    function recalculateDerivedState() {
        const { inputs, derived } = AppState;
        
        try {
            // تحليل العجين
            if (Object.values(inputs.dough).some(v => v > 0)) {
                const analysis = Core.AnalysisService.analyzeRecipe(inputs.dough);
                if (analysis && !analysis.error) {
                    derived.doughAnalysis = analysis;
                    derived.doughChemistry = Core.ChemistryService.estimateCakeChemistry(
                        inputs.dough, 
                        { temp: inputs.baking.temp, time: inputs.baking.time }
                    );
                }
            }
            
            // تحليل الحشوة إذا كانت هناك بيانات
            const fillingRecipe = getCurrentFillingRecipe();
            if (fillingRecipe && Object.values(fillingRecipe).some(v => v > 0)) {
                derived.fillingChemistry = Core.ChemistryService.estimateFillingChemistry(fillingRecipe);
                
                // تحديث الحالة المشتقة للحشوة
                AppState.inputs.filling.currentRecipe = fillingRecipe;
            }
            
            // تحديث تقرير التوافق
            if (derived.doughChemistry && derived.fillingChemistry) {
                derived.compatibilityReport = Core.ChemistryService.buildCompatibilityReport(
                    derived.doughChemistry, 
                    derived.fillingChemistry
                );
            }
            
            return true;
            
        } catch (error) {
            Logger.error(error, 'recalculateDerivedState');
            return false;
        }
    }

    function updateAllDisplays() {
        const { derived } = AppState;
        
        try {
            // تحديث المحلل العلمي
            if (derived.doughAnalysis) {
                const prediction = Core.AnalysisService.predictDoughTexture(derived.doughAnalysis);
                UI.renderAnalysisResults(derived.doughAnalysis, prediction, derived.doughChemistry);
            }
            
            // تحديث المستشار العلمي
            if (derived.doughAnalysis) {
                const report = Core.AnalysisService.getAdvisorReport(derived.doughAnalysis);
                UI.renderAdvisorReport(report);
            }
            
            // تحديث التقرير الكيميائي
            updateChemistryReportDisplay();
            
        } catch (error) {
            Logger.error(error, 'updateAllDisplays');
        }
    }

    // ============================ LOADING STATE MANAGEMENT (FIXED) =============================

    function setLoadingState(loading, message = '') {
        try {
            AppState.isLoading = loading;
            
            // استخدم فئة محددة بدلاً من اختيار عام
            const buttons = $$('button.app-control');
            
            buttons.forEach(btn => {
                if (loading) {
                    // احفظ الحالة الحالية فقط إذا لم تكن محفوظة مسبقاً
                    if (!btn.hasAttribute('data-original-disabled')) {
                        btn.setAttribute('data-original-disabled', btn.disabled.toString());
                    }
                    btn.disabled = true;
                    btn.style.opacity = '0.6';
                    btn.classList.add('loading-state');
                } else {
                    // استعد الحالة الأصلية
                    const wasDisabled = btn.getAttribute('data-original-disabled') === 'true';
                    btn.disabled = wasDisabled;
                    btn.style.opacity = '1';
                    btn.classList.remove('loading-state');
                    btn.removeAttribute('data-original-disabled');
                }
            });
            
            // تحديث واجهة التحميل
            const loader = $('#global-loader') || createGlobalLoader();
            if (loading) {
                loader.innerHTML = `<div class="loading-spinner">⏳ ${message}</div>`;
                loader.style.display = 'flex';
            } else {
                loader.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Failed to set loading state:', error);
            // fallback: حاول على الأقل إخفاء loader
            const loader = $('#global-loader');
            if (loader) loader.style.display = 'none';
        }
    }

    function createGlobalLoader() {
        const loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px;
            z-index: 10000; display: none; align-items: center; justify-content: center;
        `;
        document.body.appendChild(loader);
        return loader;
    }

    // ============================ USER PREFERENCES (ENHANCED) =============================
    const UserPreferences = {
        STORAGE_KEY: 'medovik_preferences',
        
        save() {
            try {
                const prefs = {
                    inputs: AppState.inputs,
                    lastPanInputs: AppState.lastPanInputs,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
                return true;
            } catch (e) {
                Logger.error(e, 'UserPreferences.save');
                return false;
            }
        },
        
        restore() {
            try {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                if (!stored) return false;
                
                const prefs = JSON.parse(stored);
                if (Date.now() - prefs.timestamp > 7 * 24 * 60 * 60 * 1000) {
                    return false;
                }
                
                // استعادة المدخلات
                if (prefs.inputs) {
                    AppState.inputs = { ...AppState.inputs, ...prefs.inputs };
                }
                
                // استعادة إعدادات الصواني
                if (prefs.lastPanInputs) {
                    AppState.lastPanInputs = prefs.lastPanInputs;
                }
                
                // تحديث الواجهة بالقيم المستعادة
                updateUIFromState();
                
                return true;
            } catch (e) {
                Logger.error(e, 'UserPreferences.restore');
                return false;
            }
        }
    };

    function updateUIFromState() {
        const { inputs } = AppState;
        
        // تحديث حقول العجين
        if (inputs.dough) {
            $('#flour').value = inputs.dough.flour;
            $('#butter').value = inputs.dough.butter;
            $('#sugar').value = inputs.dough.sugar;
            $('#honey').value = inputs.dough.honey;
            $('#eggs').value = inputs.dough.eggs;
            $('#soda').value = inputs.dough.soda;
        }
        
        // تحديث إعدادات الخبز
        if (inputs.baking) {
            $('#oven-temp').value = inputs.baking.temp;
            $('#baking-time').value = inputs.baking.time;
        }
        
        // تحديث إعدادات الكيمياء
        if (inputs.chemistry) {
            $('#dough-temp-input').value = inputs.chemistry.doughTemp;
            $('#filling-temp-input').value = inputs.chemistry.fillingTemp;
        }
    }

    // ============================ CHEMISTRY CALCULATION HANDLERS =============================

    function calculateDoughChemistry() {
        if (!AppState.derived.doughAnalysis) return null;
        
        const recipe = AppState.derived.doughAnalysis.recipe;
        const bakingParams = {
            temp: AppState.inputs.baking.temp,
            time: AppState.inputs.baking.time
        };
        
        AppState.derived.doughChemistry = Core.ChemistryService.estimateCakeChemistry(recipe, bakingParams);
        return AppState.derived.doughChemistry;
    }

    function calculateFillingChemistry(fillingRecipe) {
        if (!fillingRecipe || Object.keys(fillingRecipe).length === 0) return null;
        
        AppState.derived.fillingChemistry = Core.ChemistryService.estimateFillingChemistry(fillingRecipe);
        return AppState.derived.fillingChemistry;
    }

    function updateCompatibilityReport() {
        if (!AppState.derived.doughChemistry || !AppState.derived.fillingChemistry) {
            AppState.derived.compatibilityReport = null;
            return null;
        }
        
        AppState.derived.compatibilityReport = Core.ChemistryService.buildCompatibilityReport(
            AppState.derived.doughChemistry, 
            AppState.derived.fillingChemistry
        );
        
        checkForCriticalAlerts();
        return AppState.derived.compatibilityReport;
    }

    function checkForCriticalAlerts() {
        if (!AppState.derived.compatibilityReport) return;
        
        const { issues, score } = AppState.derived.compatibilityReport;
        AppState.alertsQueue = [];
        
        if (score < 40) {
            AppState.alertsQueue.push({
                type: 'danger',
                message: '⚠️ توافق ضعيف جداً - يحتاج تعديلات كبيرة',
                location: 'compatibility'
            });
        }
        
        if (issues.some(issue => issue.includes('خطيرة'))) {
            AppState.alertsQueue.push({
                type: 'danger', 
                message: '🔴 مشكلة حرجة في درجة الحموضة',
                location: 'filling'
            });
        }
        
        showQueuedAlerts();
    }

    function showQueuedAlerts() {
        AppState.alertsQueue.forEach(alert => {
            showToast(alert.message, alert.type);
        });
    }

    // ============================ COMPARISON MANAGEMENT =============================

    function saveComparison() {
        if (!AppState.derived.compatibilityReport || !AppState.derived.doughChemistry || !AppState.derived.fillingChemistry) {
            alert("لا توجد بيانات كافية لحفظ المقارنة");
            return;
        }
        
        const comparison = {
            id: Date.now(),
            date: new Date().toISOString(),
            recipe: AppState.derived.doughAnalysis.recipe,
            bakingParams: {
                temp: AppState.inputs.baking.temp,
                time: AppState.inputs.baking.time
            },
            doughChemistry: AppState.derived.doughChemistry,
            fillingChemistry: AppState.derived.fillingChemistry,
            compatibility: AppState.derived.compatibilityReport,
            notes: $('#comparison-notes')?.value || ''
        };
        
        AppState.comparisons.unshift(comparison);
        
        try {
            localStorage.setItem('medovik_comparisons_v1', JSON.stringify(AppState.comparisons));
            showToast('تم حفظ المقارنة بنجاح', 'success');
        } catch (e) {
            Logger.error(e, 'saveComparison');
        }
    }

    function loadComparisons() {
        try {
            const stored = localStorage.getItem('medovik_comparisons_v1');
            if (stored) {
                AppState.comparisons = JSON.parse(stored);
            }
        } catch (e) {
            Logger.error(e, 'loadComparisons');
            AppState.comparisons = [];
        }
    }

    function deleteComparison(id) {
        AppState.comparisons = AppState.comparisons.filter(c => c.id !== id);
        try {
            localStorage.setItem('medovik_comparisons_v1', JSON.stringify(AppState.comparisons));
        } catch (e) {
            Logger.error(e, 'deleteComparison');
        }
    }

    // ============================ AUTO-CORRECTION SYSTEM (ENHANCED) =============================

    function handleUpdateChemistry() {
        setLoadingState(true, 'جاري تحديث الحسابات الكيميائية...');
        
        try {
            const doughTemp = parseFloat($('#dough-temp-input').value) || 40;
            const fillingTemp = parseFloat($('#filling-temp-input').value) || 10;
            
            // تحديث المدخلات
            updateState({
                inputs: {
                    chemistry: { doughTemp, fillingTemp }
                }
            }, 'handleUpdateChemistry');
            
            showToast('تم تحديث الحسابات بدرجات الحرارة الجديدة', 'success');
        } catch (error) {
            Logger.error(error, 'handleUpdateChemistry');
            showErrorToUser('خطأ في التحديث', 'حدث خطأ أثناء تحديث الحسابات الكيميائية');
        } finally {
            setLoadingState(false);
        }
    }

    function handleAutoCorrection() {
        if (!AppState.derived.compatibilityReport || AppState.derived.compatibilityReport.score >= 80) {
            alert('التوافق جيد بالفعل (>80) - لا حاجة للتصحيح');
            return;
        }
        
        const corrections = generateAutoCorrections();
        showCorrectionSuggestions(corrections);
    }

    function generateAutoCorrections() {
        const corrections = [];
        
        if (!AppState.derived.doughChemistry || !AppState.derived.fillingChemistry) {
            Logger.warn('بيانات الكيمياء غير متوفرة', 'generateAutoCorrections');
            return corrections;
        }
        
        const cake = AppState.derived.doughChemistry.bakingEffects || AppState.derived.doughChemistry;
        const filling = AppState.derived.fillingChemistry;
        
        if (!cake?.brix || !filling?.brix) {
            Logger.warn('بيانات Brix غير مكتملة', 'generateAutoCorrections');
            return corrections;
        }
        
        // تصحيح فرق Brix
        const brixDiff = cake.brix.after - filling.brix.value;
        if (Math.abs(brixDiff) > 3) {
            if (brixDiff > 0) {
                const currentFilling = getCurrentFillingRecipe();
                const fillingTotalWeight = Object.values(currentFilling).reduce((sum, weight) => sum + weight, 0);
                const sugarToAdd = Math.abs(brixDiff) * fillingTotalWeight / 100;
                
                if (!isNaN(sugarToAdd) && sugarToAdd > 0) {
                    corrections.push({
                        type: 'brix',
                        message: `أضف ${sugarToAdd.toFixed(1)} جم سكر بودرة للحشوة`,
                        action: () => adjustFillingIngredient('powdered-sugar', sugarToAdd)
                    });
                }
            } else {
                const sugarToReduce = Math.abs(brixDiff) * AppState.derived.doughAnalysis.totalWeight / 100;
                if (!isNaN(sugarToReduce) && sugarToReduce > 0) {
                    corrections.push({
                        type: 'brix', 
                        message: `قلل السكر في العجين بمقدار ${sugarToReduce.toFixed(1)} جم`,
                        action: () => adjustDoughIngredient('sugar', -sugarToReduce)
                    });
                }
            }
        }
        
        // تصحيح pH الحشوة
        if (filling.ph.value > 5.0) {
            corrections.push({
                type: 'ph',
                message: 'أضف 5-10 مل عصير ليمون للحشوة لخفض pH',
                action: () => {
                    showToast('تم اقتراح إضافة عصير ليمون - عدل الوصفة يدوياً', 'info');
                }
            });
        }
        
        // تصحيح اللزوجة
        if (filling.viscosity.value < 15000) {
            const creamCheeseToAdd = 50;
            corrections.push({
                type: 'viscosity',
                message: `أضف ${creamCheeseToAdd} جم جبن كريمي لزيادة اللزوجة`,
                action: () => adjustFillingIngredient('cream-cheese', creamCheeseToAdd)
            });
        }
        
        return corrections;
    }

    function showCorrectionSuggestions(corrections) {
        if (corrections.length === 0) {
            alert('لا توجد توصيات تصحيح متاحة');
            return;
        }
        
        const modal = ModalManager.createModal(`
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3>🛠️ توصيات التصحيح التلقائي</h3>
                <p>بناءً على تحليل التوافق، هذه التعديلات المقترحة:</p>
                
                <div class="corrections-list" style="margin: 20px 0;">
                    ${corrections.map((correction, index) => `
                        <div class="correction-item" style="padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff;">
                            <h4>${index + 1}. ${getCorrectionTypeName(correction.type)}</h4>
                            <p>${correction.message}</p>
                            <button class="btn btn-sm btn-primary apply-correction-btn app-control" data-index="${index}">
                                تطبيق هذا التصحيح
                            </button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary app-control" id="close-correction-modal">
                        إغلاق
                    </button>
                    <button class="btn btn-success app-control" id="apply-all-corrections">
                        تطبيق الكل
                    </button>
                </div>
            </div>
        `);
        
        // معالجات الأحداث الآمنة
        const closeHandler = () => ModalManager.closeModal(modal);
        const applyAllHandler = () => {
            corrections.forEach(corr => corr.action());
            closeHandler();
            showToast('تم تطبيق جميع التصحيحات', 'success');
        };
        
        modal.querySelector('#close-correction-modal').addEventListener('click', closeHandler);
        modal.querySelector('#apply-all-corrections').addEventListener('click', applyAllHandler);
        
        $$('.apply-correction-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                corrections[index].action();
                this.textContent = '✓ تم التطبيق';
                this.disabled = true;
                this.classList.remove('btn-primary');
                this.classList.add('btn-success');
            });
        });
    }

    // ============================ الدوال المفقودة المطلوبة ============================
    function getCorrectionTypeName(type) {
        const names = {
            'brix': 'توازن الحلاوة',
            'ph': 'درجة الحموضة', 
            'viscosity': 'قوام الحشوة',
            'stability': 'ثبات الحشوة',
            'hydration': 'نسبة الترطيب'
        };
        return names[type] || type;
    }

    function getSugarTypeName(type) {
        const names = {
            'sucrose': 'سكر',
            'honey': 'عسل',
            'condensed-milk': 'حليب مكثف',
            'dulce-de-leche': 'دولسي دي ليتشي',
            'caramel': 'كراميل',
            'lactose': 'لاكتوز',
            'natural': 'سكريات طبيعية'
        };
        return names[type] || type;
    }

    function showErrorToUser(title, message) {
        const errorModal = ModalManager.createModal(`
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h3 style="color: #d32f2f;">❌ ${title}</h3>
                <p>${message}</p>
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn btn-primary app-control" onclick="window.ModalManager.closeModal('${Array.from(ModalManager.activeModals.keys())[0]}')">
                        فهمت
                    </button>
                </div>
            </div>
        `, 'error-modal');
    }

    // ============================ إصلاح دوال adjust مع نظام Timers الجديد ============================
    function adjustFillingIngredient(ingredient, amount) {
        const input = $(`[data-ingredient="${ingredient}"]`) || $(`#custom-${ingredient}`);
        if (input) {
            const current = parseFloat(input.value) || 0;
            input.value = Math.max(0, current + amount).toFixed(1);
            
            // استخدام نظام Timers الجديد
            AppTimers.debounce('filling', () => {
                handleCalculateFilling();
            }, 800);
        }
    }

    function adjustDoughIngredient(ingredient, amount) {
        const input = $(`#${ingredient}`);
        if (input) {
            const current = parseFloat(input.value) || 0;
            input.value = Math.max(0, current + amount).toFixed(1);
            
            // استخدام نظام Timers الجديد
            AppTimers.debounce('dough', () => {
                handleAnalyze();
            }, 800);
        }
    }

    // ============================ COMPARISONS DISPLAY =============================

    function renderSavedComparisons() {
        const container = $('#saved-comparisons-list');
        if (AppState.comparisons.length === 0) {
            container.innerHTML = '<p class="text-muted">لا توجد مقارنات محفوظة</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="comparisons-grid">
                ${AppState.comparisons.map(comp => `
                    <div class="comparison-card" style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid var(--border-color);">
                        <div class="comparison-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <h5>مقارنة ${new Date(comp.date).toLocaleDateString('ar-SA')}</h5>
                            <div class="comparison-score" style="background: ${comp.compatibility.ratingColor}20; color: ${comp.compatibility.ratingColor}; padding: 5px 10px; border-radius: 15px; font-weight: bold;">
                                ${comp.compatibility.score}/100
                            </div>
                        </div>
                        
                        <div class="comparison-details" style="margin: 10px 0;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9rem;">
                                <div>
                                    <strong>العجين:</strong><br>
                                    Brix: ${comp.doughChemistry.bakingEffects?.brix.after || comp.doughChemistry.brix.value}°<br>
                                    pH: ${comp.doughChemistry.bakingEffects?.ph.after || comp.doughChemistry.ph.value}
                                </div>
                                <div>
                                    <strong>الحشوة:</strong><br>
                                    Brix: ${comp.fillingChemistry.brix.value}°<br>
                                    pH: ${comp.fillingChemistry.ph.value}
                                </div>
                            </div>
                        </div>
                        
                        <div class="comparison-actions" style="display: flex; gap: 8px;">
                            <button class="btn btn-sm btn-primary view-comparison-btn app-control" data-id="${comp.id}">
                                عرض
                            </button>
                            <button class="btn btn-sm btn-danger delete-comparison-btn app-control" data-id="${comp.id}">
                                حذف
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        $$('.view-comparison-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                viewComparison(id);
            });
        });
        
        $$('.delete-comparison-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                if (confirm('هل أنت متأكد من حذف هذه المقارنة؟')) {
                    deleteComparison(id);
                    renderSavedComparisons();
                }
            });
        });
    }

    function viewComparison(id) {
        const comparison = AppState.comparisons.find(c => c.id === id);
        if (!comparison) return;
        
        const modal = ModalManager.createModal(`
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3>📊 مقارنة ${new Date(comparison.date).toLocaleDateString('ar-SA')}</h3>
                
                <div class="comparison-score" style="text-align: center; margin: 20px 0;">
                    <div style="font-size: 3rem; font-weight: bold; color: ${comparison.compatibility.ratingColor};">
                        ${comparison.compatibility.score}
                    </div>
                    <div style="color: ${comparison.compatibility.ratingColor}; font-size: 1.2rem;">
                        ${comparison.compatibility.rating}
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                    <div>
                        <h4>🍞 العجين</h4>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                            <p><strong>Brix:</strong> ${comparison.doughChemistry.bakingEffects?.brix.after || comparison.doughChemistry.brix.value}°</p>
                            <p><strong>pH:</strong> ${comparison.doughChemistry.bakingEffects?.ph.after || comparison.doughChemistry.ph.value}</p>
                            <p><strong>اللزوجة:</strong> ${comparison.doughChemistry.viscosity.value.toLocaleString()} cP</p>
                        </div>
                    </div>
                    <div>
                        <h4>🍰 الحشوة</h4>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                            <p><strong>Brix:</strong> ${comparison.fillingChemistry.brix.value}°</p>
                            <p><strong>pH:</strong> ${comparison.fillingChemistry.ph.value}</p>
                            <p><strong>اللزوجة:</strong> ${comparison.fillingChemistry.viscosity.value.toLocaleString()} cP</p>
                            <p><strong>النشاط المائي:</strong> ${comparison.fillingChemistry.waterActivity.value}</p>
                        </div>
                    </div>
                </div>
                
                ${comparison.compatibility.issues.length > 0 ? `
                <div class="issues-section" style="margin: 20px 0;">
                    <h4>المشاكل المكتشفة:</h4>
                    <ul>
                        ${comparison.compatibility.issues.map(issue => `<li>${issue}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                
                <div style="text-align: center; margin-top: 20px;">
                    <button class="btn btn-secondary app-control" id="close-view-modal">
                        إغلاق
                    </button>
                </div>
            </div>
        `);
        
        modal.querySelector('#close-view-modal').addEventListener('click', () => {
            ModalManager.closeModal(modal);
        });
    }

    // ============================ EVENT HANDLERS (ENHANCED) =============================

    async function handleAnalyze() {
        // التحقق من أن Core متاح
        if (!window.MedovikCalculatorCore) {
            showErrorToUser('خطأ في النظام', 'وحدة الحسابات الأساسية غير متوفرة');
            return;
        }
        
        setLoadingState(true, 'جاري تحليل الوصفة...');
        
        try {
            const recipe = UI.getRecipeInputs();
            
            // التحقق من المدخلات
            const validation = Core.SecurityService.validateRecipe(recipe);
            if (!validation.valid) {
                alert('أخطاء في المدخلات:\n' + validation.errors.join('\n'));
                return;
            }

            // تحديث الحالة
            updateState({ 
                inputs: { dough: recipe } 
            }, 'handleAnalyze');
            
        } catch (error) {
            Logger.error(error, 'handleAnalyze');
            showErrorToUser('خطأ في التحليل', 'حدث خطأ أثناء تحليل الوصفة');
        } finally {
            setLoadingState(false);
        }
    }
    
    function handleParseText() {
        try {
            const text = $('#recipe-text-input').value;
            if (!text.trim()) {
                alert('يرجى لصق نص الوصفة أولاً.');
                return;
            }
            
            const parsedIngredients = Core.ParserService.parseRecipeText(text);
            const hasIngredients = Object.values(parsedIngredients).some(v => v > 0);
            
            if (!hasIngredients) {
                alert('لم أتمكن من استخراج أي مكونات من النص. تأكد من تضمين الكميات والمكونات بوضوح.');
                return;
            }
            
            UI.setRecipeInputs(parsedIngredients);
            handleAnalyze();
            $('#recipe-text-input').value = '';
            
        } catch (error) {
            Logger.error(error, 'handleParseText');
            showErrorToUser('خطأ في التحليل', 'حدث خطأ أثناء تحليل النص');
        }
    }
    
    function handleResetToIdeal() {
        const idealRecipe = {
            flour: 500, 
            butter: 120, 
            sugar: 155,
            honey: 150, 
            eggs: 95, 
            soda: 5.5,
        };
        UI.setRecipeInputs(idealRecipe);
        handleAnalyze();
    }
    
    function handleMethodToggle(event) {
        const button = event.target.closest('.btn-toggle');
        if (!button) return;
        
        $$('.btn-toggle[data-method]').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        UI.renderMethod(button.dataset.method);
    }
    
    async function handleSimulateBaking() {
        setLoadingState(true, 'جاري محاكاة الخبز...');
        
        try {
            if (!AppState.derived.doughAnalysis) {
                alert("يرجى تحليل الوصفة أولاً قبل محاكاة الخبز.");
                return;
            }
            
            const temp = parseFloat($('#oven-temp').value);
            const time = parseFloat($('#baking-time').value);
            const thicknessInput = $('#layer-thickness-normal');
            const thickness = thicknessInput ? parseFloat(thicknessInput.value) : 3;

            const result = Core.AnalysisService.simulateBaking(
                AppState.derived.doughAnalysis, 
                temp, 
                time, 
                { thicknessMm: thickness }
            );
            
            // تحديث إعدادات الخبز
            updateState({
                inputs: {
                    baking: { temp, time }
                }
            }, 'handleSimulateBaking');
            
            UI.renderBakingSimulation(result);
            
        } catch (error) {
            Logger.error(error, 'handleSimulateBaking');
            showErrorToUser('خطأ في المحاكاة', 'حدث خطأ أثناء محاكاة الخبز');
        } finally {
            setLoadingState(false);
        }
    }

    async function handleCalculateTempering() {
        setLoadingState(true, 'جاري حساب التمبرنج...');
        
        try {
            const inputs = UI.getTemperingInputs();
            
            if (inputs.eggMass <= 0 || inputs.liquidMass <= 0) {
                alert('يرجى إدخال كتل صحيحة للبيض والخليط الساخن');
                return;
            }
            
            let liquidBreakdown = null;
            if (AppState.derived.doughAnalysis) {
                const r = AppState.derived.doughAnalysis.recipe;
                liquidBreakdown = {
                    butter: r.butter || 0,
                    sugar: r.sugar || 0,
                    honey: r.honey || 0,
                    soda: r.soda || 0
                };
            }
            
            const result = Core.TemperingService.calculateOptimalBatches(
                inputs.eggMass, 
                inputs.eggTemp, 
                inputs.liquidMass, 
                inputs.liquidTemp, 
                inputs.batchCount,
                liquidBreakdown
            );
            
            UI.renderTemperingResults(result);
            
        } catch (error) {
            Logger.error(error, 'handleCalculateTempering');
            showErrorToUser('خطأ في الحساب', 'حدث خطأ أثناء حساب التمبرنج');
        } finally {
            setLoadingState(false);
        }
    }

    function handleAutofillTempering() {
        try {
            if (!AppState.derived.doughAnalysis) {
                alert("يرجى تحليل الوصفة أولاً لتعبئة الحقول تلقائياً.");
                return;
            }
            
            const { recipe } = AppState.derived.doughAnalysis;
            const liquidMass = recipe.butter + recipe.sugar + recipe.honey + recipe.soda;
            
            $('#tempering-egg-mass').value = recipe.eggs.toFixed(1);
            $('#tempering-liquid-mass').value = liquidMass.toFixed(1);
            
            if (!$('#tempering-egg-temp').value) $('#tempering-egg-temp').value = '20';
            if (!$('#tempering-liquid-temp').value) $('#tempering-liquid-temp').value = '85';
            
            handleCalculateTempering();
            
        } catch (error) {
            Logger.error(error, 'handleAutofillTempering');
        }
    }
    
    function handleScalingModeToggle(event) {
        const button = event.target.closest('.btn-toggle');
        if (!button) return;
        
        const mode = button.dataset.mode;
        $$('#scaling-mode-toggle .btn-toggle').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        $$('.scaling-mode-panel').forEach(panel => panel.classList.remove('active'));
        $(`.scaling-mode-panel[data-panel="${mode}"]`).classList.add('active');
    }
    
    function handlePanShapeChange(event) {
        const target = event.target.closest('input[type="radio"]');
        if (!target) return;
        
        const targetName = target.closest('.pan-shape-selector').dataset.target;
        UI.renderPanShapeInputs(targetName, target.value);
        
        AppState.lastPanInputs[targetName] = UI.getPanInputs(targetName);
    }
    
    async function handleScalingCalculations(event) {
        setLoadingState(true, 'جاري حساب الطبقات...');
        
        try {
            if (!AppState.derived.doughAnalysis) {
                alert("يجب تحليل الوصفة أولاً قبل استخدام حاسبة الطبقات.");
                return;
            }
            
            const buttonId = event.target.id;
            const mode = buttonId.includes('normal') ? 'normal' :
                         buttonId.includes('advanced') ? 'advanced' : 'reverse';
            
            let result;
            
            if (mode === 'normal') {
                const { shape, dim1, dim2 } = UI.getPanInputs('normal');
                const thickness = parseFloat($('#layer-thickness-normal').value);
                
                if (!dim1 || (shape === 'rectangle' && !dim2)) {
                    alert('يرجى إدخال أبعاد الصينية');
                    return;
                }
                
                result = Core.ScalingService.calculateNormal(
                    AppState.derived.doughAnalysis, 
                    shape, 
                    dim1, 
                    dim2, 
                    thickness
                );
                
                AppState.inputs.filling.pan = { shape, dim1, dim2 };
                
            } else if (mode === 'advanced') {
                const weight = parseFloat($('#target-layer-weight').value);
                const count = parseInt($('#target-layer-count').value);
                const extra = parseFloat($('#extra-for-crumbs').value);
                
                if (!weight || !count) {
                    alert('يرجى إدخال وزن الطبقة وعددها');
                    return;
                }
                
                result = Core.ScalingService.calculateAdvanced(
                    AppState.derived.doughAnalysis, 
                    weight, 
                    count, 
                    extra
                );
                
            } else {
                const { shape, dim1, dim2 } = UI.getPanInputs('reverse');
                const count = parseInt($('#target-layers-reverse').value);
                const thickness = parseFloat($('#layer-thickness-reverse').value);
                
                if (!dim1 || (shape === 'rectangle' && !dim2) || !count) {
                    alert('يرجى إدخال جميع المعطيات المطلوبة');
                    return;
                }
                
                result = Core.ScalingService.calculateReverse(
                    shape, 
                    dim1, 
                    dim2, 
                    count, 
                    thickness
                );
            }
            
            UI.renderScalingResult(result, mode);
            UserPreferences.save();
            
        } catch (error) {
            Logger.error(error, 'handleScalingCalculations');
            showErrorToUser('خطأ في الحساب', 'حدث خطأ أثناء حساب الطبقات');
        } finally {
            setLoadingState(false);
        }
    }

    // ============================ FILLING SYSTEM HANDLERS (ENHANCED) =============================
    
    function handleFillingModeToggle(event) {
        const button = event.target.closest('.mode-btn');
        if (!button) return;
        
        const oldMode = AppState.inputs.filling.mode;
        const newMode = button.dataset.mode;
        
        // حفظ البيانات الحالية قبل التبديل
        if (oldMode === 'custom') {
            AppState.inputs.filling.custom = getCurrentFillingRecipe();
        }
        
        // تحديث الحالة
        updateState({
            inputs: {
                filling: {
                    ...AppState.inputs.filling,
                    mode: newMode
                }
            }
        }, 'handleFillingModeToggle');
        
        $$('.mode-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        $$('.filling-mode').forEach(panel => panel.classList.remove('active'));
        $(`#${newMode}-mode`).classList.add('active');
        
        // استعادة البيانات إذا كانت موجودة
        if (newMode === 'custom' && Object.keys(AppState.inputs.filling.custom).length > 0) {
            setCustomFillingInputs(AppState.inputs.filling.custom);
        }
    }
    
    function handleFillingPresetChange(event) {
        const presetId = event.target.value;
        
        if (!presetId) {
            $('#preset-ingredients-container').style.display = 'none';
            $('#preparation-protocol-container').style.display = 'none';
            $('.sweetness-control').style.display = 'none';
            AppState.inputs.filling.preset = null;
            return;
        }
        
        AppState.inputs.filling.preset = Core.FillingService.PRESETS[presetId];
        if (!AppState.inputs.filling.preset) return;
        
        UI.renderFillingPresetIngredients(AppState.inputs.filling.preset, presetId);
        
        const protocol = Core.FillingService.getPreparationProtocol(presetId);
        if (protocol) {
            UI.renderFillingProtocol(protocol);
            $('#preparation-protocol-container').style.display = 'block';
        }
        
        $('.sweetness-control').style.display = 'block';
        updateSweetnessIndicator();
    }
    
    function updateSweetnessIndicator() {
        if (!AppState.inputs.filling.preset) return;
        
        const reduction = parseInt($('#sweetness-adjuster').value) || 0;
        $('#sweetness-reduction-value').textContent = reduction + '%';
        
        let currentRecipe = {};
        $$('.preset-ingredient-input').forEach(input => {
            const ingredient = input.dataset.ingredient;
            const value = parseFloat(input.value) || 0;
            if (value > 0) currentRecipe[ingredient] = value;
        });
        
        if (Object.keys(currentRecipe).length === 0) {
            currentRecipe = { ...AppState.inputs.filling.preset.baseRecipe };
        }
        
        const sweetness = Core.ChemistryService.calculateSweetnessIndex(currentRecipe);
        
        const fill = $('.sweetness-fill');
        fill.style.width = Math.min(100, sweetness.index * 2) + '%';
        fill.style.background = `linear-gradient(90deg, ${sweetness.color}, ${sweetness.color})`;
        
        $('#sweetness-level-text').textContent = `${sweetness.level} (${sweetness.percentage}%)`;
        $('#sweetness-level-text').style.color = sweetness.color;
    }
    
    async function handleCalculateFilling() {
        setLoadingState(true, 'جاري حساب الحشوة...');
        
        try {
            const mode = AppState.inputs.filling.mode;
            let baseFilling = {};
            
            if (mode === 'preset') {
                if (!AppState.inputs.filling.preset) {
                    alert('يرجى اختيار نوع الحشوة أولاً');
                    return;
                }
                
                $$('.preset-ingredient-input').forEach(input => {
                    const ingredient = input.dataset.ingredient;
                    const value = parseFloat(input.value) || 0;
                    if (value > 0) baseFilling[ingredient] = value;
                });
                
                if (Object.keys(baseFilling).length === 0) {
                    baseFilling = { ...AppState.inputs.filling.preset.baseRecipe };
                }
                
            } else {
                const customMapping = {
                    'custom-sour-cream': 'sour-cream',
                    'custom-whipping-cream': 'whipping-cream',
                    'custom-cream-cheese': 'cream-cheese',
                    'custom-condensed-milk': 'condensed-milk',
                    'custom-dulce': 'dulce-de-leche',
                    'custom-butter': 'butter',
                    'custom-powdered-sugar': 'powdered-sugar',
                    'custom-honey': 'honey'
                };
                
                for (const [inputId, ingredient] of Object.entries(customMapping)) {
                    const value = parseFloat($(`#${inputId}`).value) || 0;
                    if (value > 0) baseFilling[ingredient] = value;
                }
            }
            
            // التحقق من المدخلات الأساسية
            const totalFilling = Object.values(baseFilling).reduce((s, v) => s + v, 0);
            if (totalFilling === 0) {
                alert('يرجى إدخال مقادير الحشو');
                return;
            }
            
            // الحصول على معايير الكيكة
            const shape = $('#filling-pan-shape').value;
            const { dim1, dim2 } = UI.getPanInputsForFilling();
            const layerCount = parseInt($('#filling-layers').value);
            const fillingThickness = parseFloat($('#filling-thickness').value);
            
            if (!shape || !dim1 || (shape === 'rectangle' && !dim2) || !layerCount || !fillingThickness) {
                alert('يرجى إدخال جميع معايير الكيكة (الشكل، الأبعاد، عدد الطبقات، سمك الحشو)');
                return;
            }
            
            if (dim1 <= 0 || (dim2 && dim2 <= 0) || layerCount <= 0 || fillingThickness <= 0) {
                alert('يجب أن تكون جميع القيم المدخلة أكبر من الصفر');
                return;
            }
            
            const area = Core.ScalingService.getPanArea(shape, dim1, dim2);
            if (area === 0) {
                alert('خطأ في حساب مساحة الصينية - تأكد من صحة الأبعاد المدخلة');
                return;
            }
            
            const fillingLayers = Math.max(0, layerCount - 1);
            if (fillingLayers === 0) {
                alert('تحذير: عدد الطبقات 1 - لن يكون هناك حشو بين الطبقات');
                return;
            }
            
            const requiredWeight = area * (fillingThickness / 10) * fillingLayers * 1.1;
            
            if (requiredWeight <= 0) {
                alert('خطأ في حساب وزن الحشو المطلوب');
                return;
            }
            
            let result;
            try {
                if (mode === 'preset' && $('#sweetness-adjuster')) {
                    const reduction = parseInt($('#sweetness-adjuster').value) || 0;
                    result = Core.FillingService.scaleWithSweetnessAdjustment(
                        baseFilling, 
                        requiredWeight, 
                        reduction
                    );
                } else {
                    const baseTotal = Object.values(baseFilling).reduce((s, v) => s + v, 0);
                    const scalingFactor = requiredWeight / baseTotal;
                    
                    if (!isFinite(scalingFactor) || scalingFactor <= 0) {
                        alert('خطأ في حساب كميات الحشو - تأكد من صحة المقادير المدخلة');
                        return;
                    }
                    
                    const scaledRecipe = {};
                    for (const [comp, value] of Object.entries(baseFilling)) {
                        scaledRecipe[comp] = value * scalingFactor;
                    }
                    
                    result = {
                        recipe: scaledRecipe,
                        originalSweetness: Core.ChemistryService.calculateSweetnessIndex(baseFilling),
                        newSweetness: Core.ChemistryService.calculateSweetnessIndex(scaledRecipe),
                        reductionApplied: 0
                    };
                }
            } catch (error) {
                Logger.error(error, 'FillingCalculation');
                alert('حدث خطأ أثناء حساب الحشو. يرجى التحقق من المدخلات والمحاولة مرة أخرى.');
                return;
            }
            
            // حساب كيمياء الحشوة
            calculateFillingChemistry(result.recipe);
            
            // حساب التوافق إذا كانت هناك كيمياء عجين
            if (AppState.derived.doughChemistry) {
                updateCompatibilityReport();
            }
            
            let waterActivity, stability;
            try {
                waterActivity = Core.ChemistryService.estimateWaterActivity(result.recipe);
                stability = Core.ChemistryService.assessFillingStability(result.recipe, AppState.derived.fillingChemistry.viscosity);
            } catch (error) {
                Logger.error(error, 'FillingMetricsCalculation');
                waterActivity = { value: 0, risk: 'غير معروف' };
                stability = { level: 'غير معروف', description: 'لم يتم حساب الثبات' };
            }
            
            const finalResult = {
                requiredWeight,
                scaledRecipe: result.recipe,
                perLayerAmount: requiredWeight / fillingLayers,
                sweetness: result.newSweetness,
                waterActivity,
                stability,
                reductionApplied: result.reductionApplied,
                presetName: AppState.inputs.filling.preset?.name || 'مخصص',
                chemistry: AppState.derived.fillingChemistry
            };
            
            UI.renderFillingResult(finalResult);
            
            // تحديث الحالة
            updateState({
                inputs: {
                    filling: {
                        ...AppState.inputs.filling,
                        pan: { shape, dim1, dim2 },
                        layers: layerCount,
                        thickness: fillingThickness,
                        currentRecipe: result.recipe
                    }
                }
            }, 'handleCalculateFilling');
            
        } catch (error) {
            Logger.error(error, 'handleCalculateFilling');
            showErrorToUser('خطأ غير متوقع', 'حدث خطأ غير متوقع أثناء حساب الحشوة');
        } finally {
            setLoadingState(false);
        }
    }

    function setCustomFillingInputs(recipe) {
        const mapping = {
            'sour-cream': 'custom-sour-cream',
            'whipping-cream': 'custom-whipping-cream',
            'cream-cheese': 'custom-cream-cheese',
            'condensed-milk': 'custom-condensed-milk',
            'dulce-de-leche': 'custom-dulce',
            'butter': 'custom-butter',
            'powdered-sugar': 'custom-powdered-sugar',
            'honey': 'custom-honey'
        };
        
        for (const [ingredient, inputId] of Object.entries(mapping)) {
            const input = $(`#${inputId}`);
            if (input && recipe[ingredient]) {
                input.value = recipe[ingredient];
            }
        }
    }

    function getCurrentFillingRecipe() {
        // محاولة استخدام البيانات من الحالة أولاً
        if (AppState.inputs.filling.currentRecipe) {
            return AppState.inputs.filling.currentRecipe;
        }
        
        let recipe = {};
        if (AppState.inputs.filling.mode === 'preset' && AppState.inputs.filling.preset) {
            $$('.preset-ingredient-input').forEach(input => {
                const ingredient = input.dataset.ingredient;
                const value = parseFloat(input.value) || 0;
                if (value > 0) recipe[ingredient] = value;
            });
            
            if (Object.keys(recipe).length === 0) {
                recipe = { ...AppState.inputs.filling.preset.baseRecipe };
            }
        } else {
            const customMapping = {
                'custom-sour-cream': 'sour-cream',
                'custom-whipping-cream': 'whipping-cream',
                'custom-cream-cheese': 'cream-cheese',
                'custom-condensed-milk': 'condensed-milk',
                'custom-dulce': 'dulce-de-leche',
                'custom-butter': 'butter',
                'custom-powdered-sugar': 'powdered-sugar',
                'custom-honey': 'honey'
            };
            
            for (const [inputId, ingredient] of Object.entries(customMapping)) {
                const value = parseFloat($(`#${inputId}`).value) || 0;
                if (value > 0) recipe[ingredient] = value;
            }
        }
        return recipe;
    }

    function handleTroubleshootingWizard(event) {
        const button = event.target.closest('button');
        if (!button) return;

        if (button.dataset.problem) {
            const problem = button.dataset.problem;
            const solutions = {
                sticky: { 
                    title: "حلول العجينة اللزجة", 
                    causes: [
                        "نقص في الدقيق (أقل من 48% من الوزن الكلي)",
                        "زيادة السوائل/السكريات (Hydration > 26%)",
                        "عدم تبريد العجينة بما فيه الكفاية",
                        "درجة حرارة المطبخ مرتفعة"
                    ], 
                    solutions: [
                        "أضف 10-15% دقيق إضافي تدريجياً",
                        "برد العجينة 30-45 دقيقة في الثلاجة",
                        "استخدم سطح مرشوش بسخاء بالدقيق",
                        "اعمل بسرعة وبأدوات مبردة"
                    ], 
                    scientific: "السكريات مواد استرطابية (hygroscopic) تجذب الرطوبة من الهواء. زيادة الدقيق تمتص السوائل الزائدة وتقلل نسبة الترطيب.",
                    prevention: [
                        "قس المكونات بدقة باستخدام ميزان",
                        "تحقق من نسبة الترطيب قبل البدء (20-26% مثالي)",
                        "احفظ العجينة مغطاة لمنع امتصاص الرطوبة"
                    ]
                },
                dry: { 
                    title: "حلول العجينة الجافة", 
                    causes: [
                        "زيادة الدقيق (أكثر من 52% من الوزن)",
                        "نقص الدهون (أقل من 10% زبدة)",
                        "نقص السوائل (Hydration < 20%)",
                        "تبخر السوائل أثناء التحضير"
                    ], 
                    solutions: [
                        "قلل الدقيق 5-10% أو أضف سوائل",
                        "أضف 1-2 ملعقة كبيرة زبدة ذائبة أو عسل",
                        "رش العجينة بقليل من الماء الدافئ",
                        "اعجن برفق بعد إضافة السوائل"
                    ], 
                    scientific: "الدهون تعمل كملدّن (plasticizer) بتشكيل طبقة حول جزيئات الدقيق، مما يقلل التماسك الجاف. السوائل ضرورية لترطيب البروتينات والنشا.",
                    prevention: [
                        "احفظ نسبة الزبدة بين 10-14%",
                        "تأكد من نسبة الترطيب المناسبة",
                        "غطِ العجينة أثناء الراحة"
                    ]
                }
                // ... باقي المشاكل
            };
            UI.renderTroubleshootingWizard(2, solutions[problem]);
        } else if (button.id === 'back-to-problems-btn') {
            UI.renderTroubleshootingWizard(1);
        }
    }
    
    function handleSaveRecipe() {
        try {
            if (!AppState.derived.doughAnalysis) {
                alert("يرجى تحليل وصفة أولاً قبل حفظها.");
                return;
            }
            
            const name = $('#recipe-name-input').value.trim();
            if (!name) {
                alert("يرجى إدخال اسم للوصفة.");
                return;
            }
            
            const existingRecipe = AppState.savedRecipes.find(r => r.name === name);
            if (existingRecipe) {
                if (!confirm(`يوجد وصفة بنفس الاسم "${name}". هل تريد استبدالها؟`)) {
                    return;
                }
                AppState.savedRecipes = Core.StorageService.delete(existingRecipe.id);
            }
            
            const recipeToSave = { 
                name, 
                analysis: AppState.derived.doughAnalysis 
            };
            
            AppState.savedRecipes = Core.StorageService.add(recipeToSave);
            UI.renderLibrary(AppState.savedRecipes);
            $('#recipe-name-input').value = '';
            showToast(`تم حفظ وصفة "${name}" بنجاح!`, 'success');
            
        } catch (error) {
            Logger.error(error, 'handleSaveRecipe');
            showErrorToUser('خطأ في الحفظ', 'حدث خطأ أثناء حفظ الوصفة');
        }
    }
    
    function handleLibraryActions(event) {
        const target = event.target;
        if (!target.dataset.id) return;
        const id = parseInt(target.dataset.id);
        
        try {
            if (target.classList.contains('btn-load-recipe')) {
                const recipe = AppState.savedRecipes.find(r => r.id === id);
                if (recipe) {
                    UI.setRecipeInputs(recipe.analysis.recipe);
                    handleAnalyze();
                    $('.tab-btn[data-tab="analyzer"]').click();
                    showToast(`تم تحميل وصفة "${recipe.name}" بنجاح`, 'success');
                }
            } else if (target.classList.contains('btn-delete-recipe')) {
                const recipe = AppState.savedRecipes.find(r => r.id === id);
                if (recipe && confirm(`هل أنت متأكد من حذف وصفة "${recipe.name}"؟`)) {
                    AppState.savedRecipes = Core.StorageService.delete(id);
                    UI.renderLibrary(AppState.savedRecipes);
                    showToast('تم حذف الوصفة', 'info');
                }
            }
        } catch (error) {
            Logger.error(error, 'handleLibraryActions');
        }
    }

    function handleTabSwitch(event) {
        const button = event.target.closest('.tab-btn');
        if (!button) return;
        
        $$('.tab-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const tabId = button.dataset.tab;
        $$('.tab-panel').forEach(panel => panel.classList.remove('active'));
        $(`#${tabId}`).classList.add('active');
        
        if (tabId === 'chemistry-report') {
            updateChemistryReportDisplay();
        }
        
        UserPreferences.save();
    }

    function updateChemistryReportDisplay() {
        const container = $('#compatibility-report-container');
        const controls = $('#chemistry-controls');
        const alertsContainer = $('#compatibility-alerts-container');
        
        if (AppState.derived.doughChemistry && AppState.derived.fillingChemistry) {
            controls.style.display = 'block';
            
            if (AppState.alertsQueue.length > 0) {
                alertsContainer.innerHTML = AppState.alertsQueue.map(alert => `
                    <div class="alert alert-${alert.type}">
                        ${alert.message}
                    </div>
                `).join('');
            } else {
                alertsContainer.innerHTML = '<div class="alert alert-success">✅ لا توجد مشاكل حرجة - التوافق جيد</div>';
            }
        } else {
            controls.style.display = 'none';
            alertsContainer.innerHTML = '';
        }
        
        UI.renderCompatibilityReport(
            AppState.derived.compatibilityReport, 
            AppState.derived.doughChemistry, 
            AppState.derived.fillingChemistry
        );
        
        if (AppState.comparisons.length > 0) {
            $('#comparisons-history-container').style.display = 'block';
            renderSavedComparisons();
        }
    }

    function handleFillingPanShapeChange() {
        const shape = $('#filling-pan-shape').value;
        UI.renderFillingPanInputs(shape);
    }

    // ============================ HELPER FUNCTIONS =============================
    
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">${getToastIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${getToastColor(type)};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            min-width: 300px;
            max-width: 500px;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function getToastIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌', 
            'warning': '⚠️',
            'info': 'ℹ️',
            'danger': '🔴'
        };
        return icons[type] || 'ℹ️';
    }

    function getToastColor(type) {
        const colors = {
            'success': '#4CAF50',
            'error': '#f44336', 
            'warning': '#FF9800',
            'info': '#2196F3',
            'danger': '#F44336'
        };
        return colors[type] || '#2196F3';
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Auto-save on input changes (debounced)
    const autoSave = debounce(() => {
        UserPreferences.save();
    }, 2000);

    // ============================ INITIALIZATION (ENHANCED) =============================

    function checkIntegration() {
        const missing = [];
        
        if (!window.MedovikCalculatorCore) missing.push('Core Module');
        if (!window.UIRenderer) missing.push('UI Module');
        if (!window.MedovikCalculatorCore?.ChemistryService) missing.push('Chemistry Service');
        if (!window.MedovikCalculatorCore?.AnalysisService) missing.push('Analysis Service');
        
        if (missing.length > 0) {
            console.error('❌ Missing modules:', missing);
            showErrorToUser('خطأ في التكامل', `الوحدات التالية مفقودة: ${missing.join(', ')}`);
            return false;
        }
        
        console.log('✅ All modules integrated successfully');
        return true;
    }

    function initializeApp() {
        console.log("🚀 Starting Medovik Scientific Calculator...");
        
        try {
            // تنظيف أي Timers متبقية من الجلسات السابقة
            AppTimers.clearAll();
            
            // إزالة أي نوافذ متبقية
            ModalManager.closeAllModals();
            
            // إنشاء عناصر النظام المحسنة
            createGlobalLoader();
            
            // التحقق من التكامل قبل المتابعة
            if (!checkIntegration()) {
                showErrorToUser('خطأ في التكامل', 'بعض الوحدات الأساسية غير متوفرة. يرجى تحديث الصفحة.');
                return;
            }
            
            // حفظ الحالة الحالية كنسخة احتياطية
            window.previousAppState = JSON.parse(JSON.stringify(AppState));
            
            // جعل ModalManager متاحاً عالمياً للاستدعاء من HTML
            window.ModalManager = ModalManager;
            
            // استعادة التفضيلات
            const restored = UserPreferences.restore();
            if (restored) {
                console.log("✅ User preferences restored");
            }
            
            // تحميل المقارنات
            loadComparisons();
            
            // إعداد معالجي الأحداث مع التعامل مع الأخطاء
            setupEventHandlers();
            
            // العروض الأولية
            initializeUI();
            
            // التحليل الأولي
            setTimeout(() => {
                handleAnalyze();
            }, 100);
            
            console.log("✅ Medovik Scientific Calculator Ready!");
            
        } catch (initError) {
            console.error("❌ Initialization failed:", initError);
            showErrorToUser('خطأ في بدء التشغيل', 'تعذر بدء التطبيق. يرجى تحديث الصفحة.');
        }
    }

    function setupEventHandlers() {
        try {
            // Setup Tab Switching
            $('.tab-buttons').addEventListener('click', handleTabSwitch);
            
            // Analyzer Tab Events
            $('#analyze-btn').addEventListener('click', handleAnalyze);
            $('#parse-text-btn').addEventListener('click', handleParseText);
            $('#reset-btn').addEventListener('click', handleResetToIdeal);
            
            // Auto-analyze on input change (debounced)
            $$('#flour, #butter, #sugar, #honey, #eggs, #soda').forEach(input => {
                input.addEventListener('input', debounce(handleAnalyze, 500));
                input.addEventListener('change', autoSave);
            });
            
            // Method Tab Events
            $$('.btn-toggle[data-method]').forEach(btn => {
                btn.addEventListener('click', handleMethodToggle);
            });
            $('#simulate-baking-btn').addEventListener('click', handleSimulateBaking);
            
            $$('#oven-temp, #baking-time').forEach(input => {
                if (input) input.addEventListener('change', autoSave);
            });

            // Tempering Tab Events
            $('#calculate-tempering-btn').addEventListener('click', handleCalculateTempering);
            $('#autofill-tempering-btn').addEventListener('click', handleAutofillTempering);
            $('#tempering-batch-count').addEventListener('change', () => {
                AppState.inputs.tempering.batchCount = parseInt($('#tempering-batch-count').value);
                autoSave();
            });

            // Scaling Tab Events
            $('#scaling-mode-toggle').addEventListener('click', handleScalingModeToggle);
            $$('.pan-shape-selector').forEach(sel => {
                sel.addEventListener('change', handlePanShapeChange);
            });
            $('#calculate-layers-normal-btn').addEventListener('click', handleScalingCalculations);
            $('#calculate-scaling-advanced-btn').addEventListener('click', handleScalingCalculations);
            $('#calculate-scaling-reverse-btn').addEventListener('click', handleScalingCalculations);
            
            const thicknessInputs = $$('#layer-thickness-normal, #layer-thickness-reverse');
            thicknessInputs.forEach(input => {
                if (input) {
                    input.addEventListener('change', () => {
                        AppState.inputs.filling.thickness = parseFloat(input.value);
                        autoSave();
                    });
                }
            });

            // Filling Tab Events
            $('.filling-mode-selector').addEventListener('click', handleFillingModeToggle);
            $('#filling-preset-selector').addEventListener('change', handleFillingPresetChange);
            $('#calculate-filling-btn').addEventListener('click', handleCalculateFilling);
            $('#filling-pan-shape').addEventListener('change', handleFillingPanShapeChange);
            
            const sweetnessAdjuster = $('#sweetness-adjuster');
            if (sweetnessAdjuster) {
                sweetnessAdjuster.addEventListener('input', updateSweetnessIndicator);
            }
            
            document.addEventListener('input', (e) => {
                if (e.target.classList.contains('preset-ingredient-input')) {
                    updateSweetnessIndicator();
                }
            });

            // Troubleshooting Tab Events
            $('#troubleshooting-wizard-container').addEventListener('click', handleTroubleshootingWizard);

            // Library Tab Events
            $('#save-recipe-btn').addEventListener('click', handleSaveRecipe);
            $('#recipe-library-container').addEventListener('click', handleLibraryActions);
            
            $('#recipe-name-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleSaveRecipe();
                }
            });

            // Chemistry Events
            $('#update-chemistry-btn').addEventListener('click', handleUpdateChemistry);
            $('#auto-correction-btn').addEventListener('click', handleAutoCorrection);
            
            document.addEventListener('click', function(e) {
                if (e.target.id === 'save-comparison-btn') {
                    saveComparison();
                    updateChemistryReportDisplay();
                }
                if (e.target.id === 'view-comparisons-btn') {
                    $('#comparisons-history-container').style.display = 'block';
                    renderSavedComparisons();
                }
            });

            console.log("✅ Event handlers setup completed");
            
        } catch (handlerError) {
            Logger.error(handlerError, 'setupEventHandlers');
        }
    }

    function initializeUI() {
        try {
            UI.renderMethod('scientific');
            UI.renderPanShapeInputs('normal', 'round');
            UI.renderPanShapeInputs('reverse', 'round');
            UI.renderFillingPanInputs('round');
            UI.renderTroubleshootingWizard(1);
            
            // Load saved recipes
            AppState.savedRecipes = Core.StorageService.loadRecipes();
            UI.renderLibrary(AppState.savedRecipes);
            
            console.log("✅ UI initialization completed");
            
        } catch (uiError) {
            Logger.error(uiError, 'initializeUI');
        }
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp();
    }

    // تنظيف الموارد عند إغلاق الصفحة
    window.addEventListener('beforeunload', function() {
        AppTimers.clearAll();
        ModalManager.closeAllModals();
    });

})(window, window.MedovikCalculatorCore, window.UIRenderer);