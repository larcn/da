// ===================================================================================
// MAIN.JS - The Application Controller
//
// Responsibilities:
// 1. Initializing the application.
// 2. Setting up all event listeners.
// 3. Orchestrating the flow of data between the UI and the Core logic.
// 4. Managing the application's state (e.g., current analysis, saved recipes).
// ===================================================================================

(function(window, Core, UI) {
    'use strict';
    
    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ============================ APPLICATION STATE =============================
    const AppState = {
        currentAnalysis: null,
        savedRecipes: [],
        lastPanInputs: {
            normal: null,
            reverse: null,
            filling: null
        },
        userPreferences: {
            defaultBakingTemp: 180,
            defaultBakingTime: 8,
            defaultThickness: 3,
            preferredBatchCount: 5
        }
    };

    // ============================ USER PREFERENCES =============================
    const UserPreferences = {
        STORAGE_KEY: 'medovik_preferences',
        
        save() {
            try {
                const prefs = {
                    lastRecipe: UI.getRecipeInputs(),
                    lastPanInputs: AppState.lastPanInputs,
                    bakingTemp: $('#oven-temp')?.value || AppState.userPreferences.defaultBakingTemp,
                    bakingTime: $('#baking-time')?.value || AppState.userPreferences.defaultBakingTime,
                    thickness: $('#layer-thickness-normal')?.value || AppState.userPreferences.defaultThickness,
                    batchCount: $('#tempering-batch-count')?.value || AppState.userPreferences.preferredBatchCount,
                    timestamp: Date.now()
                };
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(prefs));
                return true;
            } catch (e) {
                console.error('Failed to save preferences:', e);
                return false;
            }
        },
        
        restore() {
            try {
                const stored = localStorage.getItem(this.STORAGE_KEY);
                if (!stored) return false;
                
                const prefs = JSON.parse(stored);
                // Only restore if saved within last 7 days
                if (Date.now() - prefs.timestamp > 7 * 24 * 60 * 60 * 1000) {
                    return false;
                }
                
                // Restore recipe inputs
                if (prefs.lastRecipe) {
                    UI.setRecipeInputs(prefs.lastRecipe);
                }
                
                // Restore baking settings
                if ($('#oven-temp')) $('#oven-temp').value = prefs.bakingTemp;
                if ($('#baking-time')) $('#baking-time').value = prefs.bakingTime;
                if ($('#layer-thickness-normal')) $('#layer-thickness-normal').value = prefs.thickness;
                if ($('#tempering-batch-count')) $('#tempering-batch-count').value = prefs.batchCount;
                
                // Restore pan inputs
                if (prefs.lastPanInputs) {
                    AppState.lastPanInputs = prefs.lastPanInputs;
                }
                
                // Update user preferences
                AppState.userPreferences.defaultBakingTemp = prefs.bakingTemp;
                AppState.userPreferences.defaultBakingTime = prefs.bakingTime;
                AppState.userPreferences.defaultThickness = prefs.thickness;
                AppState.userPreferences.preferredBatchCount = prefs.batchCount;
                
                return true;
            } catch (e) {
                console.error('Failed to restore preferences:', e);
                return false;
            }
        }
    };

    // ============================ EVENT HANDLERS =============================

    function handleAnalyze() {
        const recipe = UI.getRecipeInputs();
        const analysis = Core.AnalysisService.analyzeRecipe(recipe);
        
        if (analysis && analysis.error) {
            alert('أخطاء في المدخلات:\n' + analysis.error);
            UI.renderAnalysisResults(null, null);
            AppState.currentAnalysis = null;
            return;
        }

        AppState.currentAnalysis = analysis;
        
        if (analysis) {
            const prediction = Core.AnalysisService.predictDoughTexture(analysis);
            UI.renderAnalysisResults(analysis, prediction);
            
            const report = Core.AnalysisService.getAdvisorReport(analysis);
            UI.renderAdvisorReport(report);
            
            // Save preferences on successful analysis
            UserPreferences.save();
        } else {
            UI.renderAnalysisResults(null, null);
            UI.renderAdvisorReport(null);
        }
    }
    
    function handleParseText() {
        const text = $('#recipe-text-input').value;
        if (!text.trim()) {
            alert('يرجى لصق نص الوصفة أولاً.');
            return;
        }
        
        const parsedIngredients = Core.ParserService.parseRecipeText(text);
        
        // Check if any ingredients were parsed
        const hasIngredients = Object.values(parsedIngredients).some(v => v > 0);
        if (!hasIngredients) {
            alert('لم أتمكن من استخراج أي مكونات من النص. تأكد من تضمين الكميات والمكونات بوضوح.');
            return;
        }
        
        UI.setRecipeInputs(parsedIngredients);
        handleAnalyze();
        
        // Clear the text area after successful parsing
        $('#recipe-text-input').value = '';
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
    
    function handleSimulateBaking() {
        if (!AppState.currentAnalysis) {
            alert("يرجى تحليل الوصفة أولاً قبل محاكاة الخبز.");
            return;
        }
        
        const temp = parseFloat($('#oven-temp').value);
        const time = parseFloat($('#baking-time').value);
        
        // Get thickness from scaling tab if available
        const thicknessInput = $('#layer-thickness-normal');
        const thickness = thicknessInput ? parseFloat(thicknessInput.value) : 3;

        const result = Core.AnalysisService.simulateBaking(
            AppState.currentAnalysis, 
            temp, 
            time, 
            { thicknessMm: thickness }
        );
        
        UI.renderBakingSimulation(result);
        
        // Save preferences
        AppState.userPreferences.defaultBakingTemp = temp;
        AppState.userPreferences.defaultBakingTime = time;
        UserPreferences.save();
    }

    function handleCalculateTempering() {
        const inputs = UI.getTemperingInputs();
        
        // Validate inputs
        if (inputs.eggMass <= 0 || inputs.liquidMass <= 0) {
            alert('يرجى إدخال كتل صحيحة للبيض والخليط الساخن');
            return;
        }
        
        // Get liquid breakdown from current analysis if available
        let liquidBreakdown = null;
        if (AppState.currentAnalysis && AppState.currentAnalysis.recipe) {
            const r = AppState.currentAnalysis.recipe;
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
    }

    function handleAutofillTempering() {
        if (!AppState.currentAnalysis) {
            alert("يرجى تحليل الوصفة أولاً لتعبئة الحقول تلقائياً.");
            return;
        }
        
        const { recipe } = AppState.currentAnalysis;
        const liquidMass = recipe.butter + recipe.sugar + recipe.honey + recipe.soda;
        
        $('#tempering-egg-mass').value = recipe.eggs.toFixed(1);
        $('#tempering-liquid-mass').value = liquidMass.toFixed(1);
        
        // Set default temperatures if not already set
        if (!$('#tempering-egg-temp').value) {
            $('#tempering-egg-temp').value = '20';
        }
        if (!$('#tempering-liquid-temp').value) {
            $('#tempering-liquid-temp').value = '85';
        }
        
        // Auto-calculate after filling
        handleCalculateTempering();
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
        
        // Store pan inputs
        AppState.lastPanInputs[targetName] = UI.getPanInputs(targetName);
    }
    
    function handleScalingCalculations(event) {
        if (!AppState.currentAnalysis) {
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
                AppState.currentAnalysis, 
                shape, 
                dim1, 
                dim2, 
                thickness
            );
            
            // Save thickness preference
            AppState.userPreferences.defaultThickness = thickness;
            
        } else if (mode === 'advanced') {
            const weight = parseFloat($('#target-layer-weight').value);
            const count = parseInt($('#target-layer-count').value);
            const extra = parseFloat($('#extra-for-crumbs').value);
            
            if (!weight || !count) {
                alert('يرجى إدخال وزن الطبقة وعددها');
                return;
            }
            
            result = Core.ScalingService.calculateAdvanced(
                AppState.currentAnalysis, 
                weight, 
                count, 
                extra
            );
            
        } else { // reverse
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
    }
    
    function handleCalculateFilling() {
        const baseFilling = {
            'filling-cream': parseFloat($('#filling-cream').value) || 0,
            'filling-condensed-milk': parseFloat($('#filling-condensed-milk').value) || 0,
            'filling-other': parseFloat($('#filling-other').value) || 0,
        };
        
        // Validate that at least one filling ingredient is provided
        const totalFilling = Object.values(baseFilling).reduce((s, v) => s + v, 0);
        if (totalFilling === 0) {
            alert('يرجى إدخال مقادير الحشو الأساسية');
            return;
        }
        
        const { shape, dim1, dim2 } = UI.getPanInputs('filling');
        const layerCount = parseInt($('#cake-layers-filling').value);
        const fillingThickness = parseFloat($('#filling-thickness').value);
        
        if (!dim1 || (shape === 'rectangle' && !dim2) || !layerCount) {
            alert('يرجى إدخال جميع المعطيات المطلوبة');
            return;
        }

        const result = Core.ScalingService.calculateFilling(
            baseFilling, 
            shape, 
            dim1, 
            dim2, 
            layerCount, 
            fillingThickness
        );
        
        UI.renderFillingResult(result);
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
                },
                hard: { 
                    title: "حلول الطبقات القاسية", 
                    causes: [
                        "نقص الدهون (زبدة أقل من 10%)",
                        "زيادة الدقيق",
                        "خبز زائد (وقت طويل أو حرارة عالية)",
                        "عجن مفرط (تطور جلوتين زائد)"
                    ], 
                    solutions: [
                        "زد الزبدة 10-15% في الوصفة القادمة",
                        "قلل وقت الخبز 1-2 دقيقة",
                        "اخفض الحرارة 10 درجات",
                        "استخدم تقنية الطي بدلاً من العجن"
                    ], 
                    scientific: "الدهون تمنع تكوين شبكة جلوتين قوية وتحبس الرطوبة. الخبز الزائد يبخر الماء ويجعل البروتينات والنشا أكثر صلابة.",
                    prevention: [
                        "راقب اللون الذهبي كمؤشر للنضج",
                        "استخدم ميقاتي دقيق",
                        "اختبر النضج بلمس الحافة برفق"
                    ]
                },
                bitter: { 
                    title: "حلول الطعم القلوي", 
                    causes: [
                        "زيادة صودا الخبز (أكثر من 0.8% من الوزن)",
                        "عدم تفاعل الصودا بالكامل",
                        "توزيع غير متجانس للصودا",
                        "استخدام صودا قديمة أو فاسدة"
                    ], 
                    solutions: [
                        "قلل الصودا 25-30% في المرة القادمة",
                        "تأكد من حرارة كافية للتفاعل (80-85°C)",
                        "أضف قليلاً من العسل (حامضي) للمعادلة",
                        "انخل الصودا مع الدقيق للتوزيع المتجانس"
                    ], 
                    scientific: "الصودا (NaHCO₃) قلوية بطبيعتها. عند عدم تفاعلها بالكامل مع الأحماض (في العسل) أو الحرارة، تبقى كربونات الصوديوم (Na₂CO₃) التي لها طعم صابوني.",
                    prevention: [
                        "قس الصودا بدقة (0.4-0.8% من الوزن)",
                        "استخدم صودا طازجة (اختبرها بالخل)",
                        "وزع الصودا بالتساوي في الخليط الساخن"
                    ]
                },
                pale: { 
                    title: "حلول اللون الباهت", 
                    causes: [
                        "نقص الصودا (أقل من 0.4%)",
                        "نقص السكريات (أقل من 28%)",
                        "حرارة منخفضة (أقل من 170°C)",
                        "وقت خبز قصير"
                    ], 
                    solutions: [
                        "زد الصودا قليلاً (0.1-0.2%)",
                        "ارفع الحرارة 10-15 درجة",
                        "زد وقت الخبز 1-2 دقيقة",
                        "ادهن السطح بقليل من العسل المخفف"
                    ], 
                    scientific: "الصودا ترفع pH مما يسرّع تفاعل ميلارد (Maillard) المسؤول عن اللون الذهبي. يحتاج التفاعل لسكريات + أحماض أمينية + حرارة كافية (>140°C).",
                    prevention: [
                        "حافظ على نسبة السكريات 28-33%",
                        "استخدم حرارة 180-190°C",
                        "تأكد من نشاط الصودا"
                    ]
                },
                burnt: {
                    title: "حلول الاحتراق السريع",
                    causes: [
                        "حرارة عالية جداً (>200°C)",
                        "زيادة السكريات وخاصة العسل",
                        "طبقات رقيقة جداً (<2.5 ملم)",
                        "توزيع حرارة غير متساوٍ في الفرن"
                    ],
                    solutions: [
                        "اخفض الحرارة إلى 170-180°C",
                        "ضع الصينية في الرف الأوسط",
                        "غطِ بورق ألومنيوم إذا احمرّت بسرعة",
                        "اقلب الصينية منتصف الوقت"
                    ],
                    scientific: "العسل يحتوي على سكر الفركتوز الذي يتكرمل عند 110°C (أقل من السكروز 160°C). الطبقات الرقيقة تسخن بسرعة وتفقد الرطوبة الواقية.",
                    prevention: [
                        "معايرة حرارة الفرن بميزان حرارة",
                        "استخدام سُمك 2.5-3.5 ملم",
                        "مراقبة اللون كل دقيقة بعد 5 دقائق"
                    ]
                }
            };
            UI.renderTroubleshootingWizard(2, solutions[problem]);
        } else if (button.id === 'back-to-problems-btn') {
            UI.renderTroubleshootingWizard(1);
        }
    }
    
    function handleSaveRecipe() {
        if (!AppState.currentAnalysis) {
            alert("يرجى تحليل وصفة أولاً قبل حفظها.");
            return;
        }
        
        const name = $('#recipe-name-input').value.trim();
        if (!name) {
            alert("يرجى إدخال اسم للوصفة.");
            return;
        }
        
        // Check for duplicate names
        const existingRecipe = AppState.savedRecipes.find(r => r.name === name);
        if (existingRecipe) {
            if (!confirm(`يوجد وصفة بنفس الاسم "${name}". هل تريد استبدالها؟`)) {
                return;
            }
            // Delete the old one
            AppState.savedRecipes = Core.StorageService.delete(existingRecipe.id);
        }
        
        const recipeToSave = { 
            name, 
            analysis: AppState.currentAnalysis 
        };
        
        AppState.savedRecipes = Core.StorageService.add(recipeToSave);
        UI.renderLibrary(AppState.savedRecipes);
        $('#recipe-name-input').value = '';
        alert(`تم حفظ وصفة "${name}" بنجاح!`);
    }
    
    function handleLibraryActions(event) {
        const target = event.target;
        if (!target.dataset.id) return;
        const id = parseInt(target.dataset.id);
        
        if (target.classList.contains('btn-load-recipe')) {
            const recipe = AppState.savedRecipes.find(r => r.id === id);
            if (recipe) {
                UI.setRecipeInputs(recipe.analysis.recipe);
                handleAnalyze();
                
                // Switch to analyzer tab
                $('.tab-btn[data-tab="analyzer"]').click();
                
                // Show success message
                const name = recipe.name;
                showToast(`تم تحميل وصفة "${name}" بنجاح`, 'success');
            }
        } else if (target.classList.contains('btn-delete-recipe')) {
            const recipe = AppState.savedRecipes.find(r => r.id === id);
            if (recipe && confirm(`هل أنت متأكد من حذف وصفة "${recipe.name}"؟`)) {
                AppState.savedRecipes = Core.StorageService.delete(id);
                UI.renderLibrary(AppState.savedRecipes);
                showToast('تم حذف الوصفة', 'info');
            }
        }
    }

    function handleTabSwitch(event) {
        const button = event.target.closest('.tab-btn');
        if (!button) return;
        
        // Update active states
        $$('.tab-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const tabId = button.dataset.tab;
        $$('.tab-panel').forEach(panel => panel.classList.remove('active'));
        $(`#${tabId}`).classList.add('active');
        
        // Save state when switching tabs
        UserPreferences.save();
    }

    // ============================ HELPER FUNCTIONS =============================
    
    function showToast(message, type = 'info') {
        // Simple toast notification (you can enhance this with CSS animations)
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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

    // ============================ INITIALIZATION =============================
    function init() {
        console.log("Initializing Medovik Scientific Calculator...");
        
        // Restore user preferences
        const restored = UserPreferences.restore();
        if (restored) {
            console.log("User preferences restored");
        }
        
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
        $('#oven-temp, #baking-time').forEach(input => {
            if (input) input.addEventListener('change', autoSave);
        });

        // Tempering Tab Events
        $('#calculate-tempering-btn').addEventListener('click', handleCalculateTempering);
        $('#autofill-tempering-btn').addEventListener('click', handleAutofillTempering);
        $('#tempering-batch-count').addEventListener('change', () => {
            AppState.userPreferences.preferredBatchCount = parseInt($('#tempering-batch-count').value);
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
        
        // Layer thickness change
        const thicknessInputs = $$('#layer-thickness-normal, #layer-thickness-reverse');
        thicknessInputs.forEach(input => {
            if (input) {
                input.addEventListener('change', () => {
                    AppState.userPreferences.defaultThickness = parseFloat(input.value);
                    autoSave();
                });
            }
        });

        // Filling Tab Events
        $('#calculate-filling-btn').addEventListener('click', handleCalculateFilling);

        // Troubleshooting Tab Events
        $('#troubleshooting-wizard-container').addEventListener('click', handleTroubleshootingWizard);

        // Library Tab Events
        $('#save-recipe-btn').addEventListener('click', handleSaveRecipe);
        $('#recipe-library-container').addEventListener('click', handleLibraryActions);
        
        // Enter key support for recipe name input
        $('#recipe-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSaveRecipe();
            }
        });

        // Initial renders
        UI.renderMethod('scientific');
        UI.renderPanShapeInputs('normal', 'round');
        UI.renderPanShapeInputs('reverse', 'round');
        UI.renderPanShapeInputs('filling', 'round');
        UI.renderTroubleshootingWizard(1);
        
        // Load saved recipes
        AppState.savedRecipes = Core.StorageService.loadRecipes();
        UI.renderLibrary(AppState.savedRecipes);
        
        // Perform initial analysis with current inputs
        handleAnalyze();
        
        // Add CSS animation styles if not present
        if (!document.querySelector('#toast-animations')) {
            const style = document.createElement('style');
            style.id = 'toast-animations';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        console.log("Medovik Scientific Calculator Ready!");
    }

    // Start the application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window, window.MedovikCalculatorCore, window.UIRenderer);