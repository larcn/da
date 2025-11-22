// app-controller.js — Event wiring & flow (Arabic)
// يربط الواجهة مع MedovikMain/Core/UIRenderer دون منطق فيزيائي جديد.

(function(window, Core, UI, Main) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const nf = new Intl.NumberFormat('ar-EG');

  // حالة التطبيق العامة
  const AppState = {
    doughAnalysis: null,
    doughChemistry: null,
    fillingRecipe: null,
    fillingChemistry: null
  };

  // انتظار جاهزية جميع الوحدات
  function init() {
    if (!window.MedovikCalculatorCore || !window.FILLING_KNOWLEDGE || !window.MedovikMain || !window.UIRenderer) {
      setTimeout(init, 100);
      return;
    }
    console.log('✅ Medovik App Controller initialized');

    // 1) تجهيز مدخلات الحشو الديناميكية مع مربعات تفعيل
    renderFillingInputsWithCheckboxes();

    // 2) ربط أزرار المحلل العلمي
    $('#analyze-btn')?.addEventListener('click', handleAnalyze);
    $('#simulate-baking-btn')?.addEventListener('click', handleSimulateBaking);

    // 3) إعدادات الكرملة — تفعيل تلقائي عند تغيير القيم + إعادة تحليل
    const caramelInputs = ['caramelization-Tpre','caramelization-tpre','caramelization-evap'];
    caramelInputs.forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const checkbox = document.getElementById('caramelization-enabled');
        if (checkbox && !checkbox.checked) checkbox.checked = true;
        handleAnalyze();
      });
    });
    document.getElementById('caramelization-enabled')?.addEventListener('change', handleAnalyze);

    // 4) تحكّم تمبرنج
    $('#calculate-tempering-btn')?.addEventListener('click', handleCalculateTempering);
    $('#autofill-tempering-btn')?.addEventListener('click', autofillTemperingFromRecipe);

    // 5) تحكّم الهندسة (طبقات/تحجيم)
    $('#calculate-layers-normal-btn')?.addEventListener('click', handleCalcLayersNormal);
    $('#calculate-scaling-advanced-btn')?.addEventListener('click', handleCalcScalingAdvanced);
    $('#calculate-scaling-reverse-btn')?.addEventListener('click', handleCalcScalingReverse);

    // 6) معايرة الكثافة
    $('#calibrate-density-btn')?.addEventListener('click', handleCalibrateDensity);

    // تبديل وضع الهندسة
    $$('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        $$('.btn-toggle').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        $$('.scaling-mode-panel').forEach(p => p.classList.remove('active'));
        $(`.scaling-mode-panel[data-panel="${mode}"]`)?.classList.add('active');
      });
    });

    // تبديل شكل الصينية في لوحات التحجيم
    $$('.pan-shape-selector').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const target = e.currentTarget?.dataset?.target;
        updatePanInputs(target);
      });
    });

    // 7) تحكّم الحشوة الذكية
    $('#filling-pan-shape')?.addEventListener('change', syncFillingPanShapeHint);
    $('#generate-protocol-btn')?.addEventListener('click', handleGenerateFillingProtocol);
    $('#save-filling-btn')?.addEventListener('click', handleSaveFilling);

    // 8) تفويض أحداث مكتبة الحشوات
    $('#filling-library-container')?.addEventListener('click', onLibraryClick);

    // 9) تهيئة بسيطة
    syncFillingPanShapeHint();
    updatePanInputs('normal');
    updatePanInputs('reverse');

    // تحميل المكتبة المحفوظة
    renderFillingsLibrary(loadFillings());

    // 10) مكتبة وصفات العجين
    $('#save-recipe-btn')?.addEventListener('click', handleSaveDoughRecipe);
    $('#export-recipe-btn')?.addEventListener('click', handleExportRecipes);
    $('#import-recipe-input')?.addEventListener('change', handleImportRecipes);
    renderRecipeLibrary(loadRecipes());

    // 11) تحديث عرض قيمة تقليل الحلاوة
    $('#sweetness-reduction')?.addEventListener('input', (e) => {
      const val = Number(e.target.value) || 0;
      const span = document.getElementById('sweetness-reduction-value');
      if (span) span.textContent = `${val}%`;
    });

    // 12) تفعيل أدلة طريقة العجين
    $('#method-scientific')?.addEventListener('click', () => {
      $('#method-scientific').classList.add('active');
      $('#method-allinone').classList.remove('active');
      UI.renderDoughPreparationGuide('scientific');
    });
    $('#method-allinone')?.addEventListener('click', () => {
      $('#method-allinone').classList.add('active');
      $('#method-scientific').classList.remove('active');
      UI.renderDoughPreparationGuide('allinone');
    });
    if (UI.renderDoughPreparationGuide) UI.renderDoughPreparationGuide('scientific');
  }

  // ============================ Helpers: IO ============================
  function getRecipeInputs() {
    return {
      flour: num('#flour'), butter: num('#butter'),
      sugar: num('#sugar'), honey: num('#honey'),
      eggs: num('#eggs'), soda: num('#soda')
    };
  }
  function num(sel) { const el = $(sel); return el ? Number(el.value) || 0 : 0; }

  function getCaramelizationOptions() {
    const enabled = !!$('#caramelization-enabled')?.checked;
    const T_pre = clamp(Number($('#caramelization-Tpre')?.value) || 108, 105, 110);
    const t_pre = clamp(Number($('#caramelization-tpre')?.value) || 2.0, 1.5, 3.0);
    const evap  = clamp(Number($('#caramelization-evap')?.value) || 0.08, 0.05, 0.10);
    return { enabled, T_pre, t_pre, evap };
  }
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function computeHydrationPercent(recipe) {
    const r = recipe || {};
    const wm = (r.eggs || 0) * Core.CONSTANTS.HYDRATION.EGG_WATER_CONTENT
             + (r.honey|| 0) * Core.CONSTANTS.HYDRATION.HONEY_WATER_CONTENT
             + (r.butter||0) * Core.CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
    const flour = Number(r.flour) || 0;
    return (flour > 0) ? (wm / flour) * 100 : 0;
  }

  function sodaRatioInfo(recipe) {
    const flour = Number(recipe.flour) || 0;
    const soda = Number(recipe.soda) || 0;
    if (flour <= 0 || soda <= 0) return null;
    const ratioPct = (soda / flour) * 100;
    return {
      ratioPct: +ratioPct.toFixed(2),
      tasteWarning: ratioPct >= 1.0, // عتبة موحدة 1.0%
      advisoryRange: [0.5, 1.0]
    };
  }

  // ============================ المحلل العلمي ============================
  async function handleAnalyze() {
    try {
      const recipe = getRecipeInputs();
      const car = getCaramelizationOptions();

      const validation = Core.ValidationService.validateRecipe(recipe);
      if (!validation.valid) {
        alert('أخطاء في المدخلات: تحقق من القيم.');
        return;
      }

      // تحليل علمي
      const analysis = Core.AnalysisService.analyzeRecipe(recipe);
      const hydration = computeHydrationPercent(recipe);
      const brix = Core.ChemistryService.estimateBrix(recipe, true);
      const ph = Core.ChemistryService.estimatePH(recipe, true);
      const aw = Core.ChemistryService.estimateWaterActivity(recipe);

      // محسن العمل + القرار
      const optimizer = Main.findOptimalWorkPlan(recipe, { caramelization: car });
      const decision = Main.decideDough(recipe, { caramelization: car });

      // η عند T_opt (موحّدة للعرض)
      const T_display = optimizer?.planA?.T_opt || 25;
      const viscosityAtOptimal = Core.ChemistryService.calculateDoughViscosity(
        recipe,
        T_display,
        { caramelization: car }
      );

      const doughChemistry = {
        hydration,
        brix,
        ph,
        waterActivity: aw,
        viscosity: viscosityAtOptimal,
        temperature: T_display
      };

      // رندر
      UI.renderAnalysisResults(analysis, null, doughChemistry);

      if (typeof UI.renderViscosityAtTCardEnhanced === 'function') {
        UI.renderViscosityAtTCardEnhanced(viscosityAtOptimal.value, T_display);
      } else {
        UI.renderViscosityAtTCard(viscosityAtOptimal.value, T_display);
      }
      if (typeof UI.renderChemistryStripEnhanced === 'function') {
        UI.renderChemistryStripEnhanced(doughChemistry, sodaRatioInfo(recipe));
      } else {
        UI.renderChemistryStrip(doughChemistry, sodaRatioInfo(recipe));
      }

      UI.renderOptimizerCard(optimizer);

      // شارة الكرملة + توجيهات عملية
      if (car.enabled) {
        UI.renderCaramelizationBadge(true, car);

        const honeyWeight = recipe.honey || 0;
        const butterWeight = recipe.butter || 0;
        const honeyTarget = Math.round(honeyWeight * (1 - car.evap));
        const butterTarget = Math.round(butterWeight * (1 - car.evap * 0.8)); // الزبدة تتبخر أقل قليلاً

        const container = $('#analysis-results-wrapper');
        const caramelAdvice = document.createElement('div');
        caramelAdvice.className = 'alert alert-info';
        caramelAdvice.style.marginTop = '10px';
        caramelAdvice.innerHTML = `
          <strong>🍯 توجيهات عملية للكرملة:</strong><br>
          <table style="width:100%; margin:8px 0; font-size:0.9em;">
              <tr><th>المكون</th><th>قبل النار</th><th>بعد النار</th><th>الفرق</th></tr>
              <tr><td>العسل</td><td>${nf.format(honeyWeight)} جم</td><td>${nf.format(honeyTarget)} جم</td><td>${nf.format(honeyWeight - honeyTarget)} جم</td></tr>
              <tr><td>الزبدة</td><td>${nf.format(butterWeight)} جم</td><td>${nf.format(butterTarget)} جم</td><td>${nf.format(butterWeight - butterTarget)} جم</td></tr>
              <tr style="font-weight:bold"><td>المجموع</td><td>${nf.format(honeyWeight + butterWeight)} جم</td><td>${nf.format(honeyTarget + butterTarget)} جم</td><td>${nf.format((honeyWeight + butterWeight) - (honeyTarget + butterTarget))} جم</td></tr>
          </table>
          <small>💡 استخدم ميزان المطبخ لقياس الوزن بدقة عند كل خطوة</small>
        `;
        container.appendChild(caramelAdvice);
      } else {
        // إزالة الشارة عند التعطيل
        const container = document.querySelector('#analysis-results-wrapper');
        container?.querySelector('.caramelization-badge')?.remove();
      }

      UI.renderDecisionStrip(decision);
      UI.renderKitchenDashboard(decision, analysis);

      // حفظ الحالة للتقرير الشامل
      AppState.doughAnalysis = analysis;
      AppState.doughChemistry = doughChemistry;
      updateCompatibilityReportWrapper();

    } catch (e) {
      console.error('handleAnalyze error:', e);
      alert('تعذر إتمام التحليل: ' + e.message);
    }
  }

  async function handleSimulateBaking() {
    try {
      const recipe = getRecipeInputs();
      const analysis = Core.AnalysisService.analyzeRecipe(recipe);
      if (!analysis || analysis.error) {
        alert('حلّل الوصفة أولاً.');
        return;
      }

      const temp = Number($('#oven-temp')?.value) || 180;
      const time = Number($('#baking-time')?.value) || 7;
      const thickness = Number($('#layer-thickness-simulation')?.value) || 3;

      const result = Core.AnalysisService.simulateBaking(analysis, temp, time, { thicknessMm: thickness });
      UI.renderBakingSimulation(result);

      let schedule;
      if (Core.AnalysisService.getBakingSchedule) {
        schedule = Core.AnalysisService.getBakingSchedule(analysis, { temp, thicknessMm: thickness, diameterCm: 24 });
      } else {
        schedule = {
          temp,
          recommended: time,
          range: { min: Math.max(5, time - 2), max: time + 3 },
          cues: [
            'الحواف ذهبية فاتحة',
            'المركز لا يهتز عند لمسه',
            'رائحة عسل خفيفة'
          ]
        };
      }
      UI.renderBakingSchedule(schedule);

    } catch (e) {
      console.error('handleSimulateBaking error:', e);
      alert('خطأ في محاكاة الخبز: ' + e.message);
    }
  }

  // ============================ تمبرنج ============================
  function handleCalculateTempering() {
    try {
      const eggMass = Number($('#tempering-egg-mass')?.value) || 0;
      const eggTemp = Number($('#tempering-egg-temp')?.value) || 20;
      const liquidMass = Number($('#tempering-liquid-mass')?.value) || 0;
      const liquidTemp = Number($('#tempering-liquid-temp')?.value) || 85;
      const batchCount = Number($('#tempering-batch-count')?.value) || 5;

      // breakdown من الوصفة الحالية لتحسين Cp
      const r = getRecipeInputs();
      const breakdown = {
        butter: r.butter || 0,
        sugar: r.sugar || 0,
        honey: r.honey || 0,
        soda: r.soda || 0
      };

      const result = Core.TemperingService.calculateOptimalBatches(
        eggMass, eggTemp, liquidMass, liquidTemp, batchCount, breakdown
      );
      UI.renderTemperingResults(result);
    } catch (e) {
      console.error('handleCalculateTempering error:', e);
      alert('خطأ في حساب التمبرنج: ' + e.message);
    }
  }

  function autofillTemperingFromRecipe() {
    try {
      const r = getRecipeInputs();

      const totalWeight = Object.values(r).reduce((s, v) => s + (Number(v) || 0), 0);
      if (totalWeight === 0) {
        alert('⚠️ يرجى إدخال مقادير العجين في تبويب "المحلل العلمي" أولاً.');
        return;
      }

      const liquidMass = (r.butter || 0) + (r.sugar || 0) + (r.honey || 0) + (r.soda || 0);

      if (liquidMass === 0 || r.eggs === 0) {
        alert('⚠️ الوصفة لا تحتوي على بيض أو سوائل كافية للتمبرنج.');
        return;
      }

      if ($('#tempering-egg-mass')) $('#tempering-egg-mass').value = (r.eggs || 0).toFixed(1);
      if ($('#tempering-liquid-mass')) $('#tempering-liquid-mass').value = liquidMass.toFixed(1);
      if ($('#tempering-egg-temp') && !$('#tempering-egg-temp').value) $('#tempering-egg-temp').value = '20';
      if ($('#tempering-liquid-temp') && !$('#tempering-liquid-temp').value) $('#tempering-liquid-temp').value = '85';

      handleCalculateTempering();
    } catch (e) {
      console.error('autofillTemperingFromRecipe error:', e);
      alert('خطأ في الملء التلقائي: ' + e.message);
    }
  }

  // ============================ الهندسة (طبقات/تحجيم) ============================
  function updatePanInputs(target) {
    const container = $(`#pan-inputs-${target}`);
    if (!container) return;

    const shape = document.querySelector(`input[name="pan-shape-${target}"]:checked`)?.value || 'round';

    if (shape === 'rectangle') {
      container.innerHTML = `
        <div class="input-group">
          <label for="pan-dim1-${target}">الطول (سم)</label>
          <input type="number" id="pan-dim1-${target}" value="24" min="10" max="50">
        </div>
        <div class="input-group">
          <label for="pan-dim2-${target}">العرض (سم)</label>
          <input type="number" id="pan-dim2-${target}" value="20" min="10" max="50">
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="input-group">
          <label for="pan-dim1-${target}">القطر (سم)</label>
          <input type="number" id="pan-dim1-${target}" value="24" min="10" max="50">
        </div>
      `;
    }
  }

  function handleCalcLayersNormal() {
    try {
      const recipe = getRecipeInputs();
      const analysis = Core.AnalysisService.analyzeRecipe(recipe);
      if (!analysis || analysis.error) {
        alert('حلّل الوصفة أولاً.');
        return;
      }

      const shape = document.querySelector('input[name="pan-shape-normal"]:checked')?.value || 'round';
      const dim1 = Number($('#pan-dim1-normal')?.value) || 24;
      const dim2 = (shape === 'rectangle') ? Number($('#pan-dim2-normal')?.value) || 20 : null;
      const thicknessMm = Number($('#layer-thickness-normal')?.value) || 2;

      const area = Core.ScalingService.getPanArea(shape, dim1, dim2);
      const density = Core.ScalingService.getCalibratedDensity();
      const isCalibrated = !!density;
      const finalDensity = density || Core.CONSTANTS.AVERAGE_DOUGH_DENSITY;
      const prediction = Core.ScalingService.predictLayers(analysis.totalWeight, finalDensity, area, thicknessMm);

      const result = Object.assign({}, prediction, { density: finalDensity });
      UI.renderScalingResult(result, 'normal');

      if (!isCalibrated) {
        const container = $('#scaling-results-container');
        if (container) {
          container.insertAdjacentHTML('beforeend', `
            <div class="alert alert-warning" style="margin-top:8px;">
              ⚠️ الكثافة المستخدمة افتراضية (${finalDensity.toFixed(2)} جم/سم³).
              للدقة الأعلى، قم بمعايرة الكثافة من خلال وزن طبقة فعلية.
            </div>
          `);
        }
      }
    } catch (e) {
      console.error('handleCalcLayersNormal error:', e);
      alert('خطأ في حساب الطبقات: ' + e.message);
    }
  }

  function handleCalcScalingAdvanced() {
    try {
      const analysis = Core.AnalysisService.analyzeRecipe(getRecipeInputs());
      if (!analysis || analysis.error) {
        alert('حلّل الوصفة أولاً.');
        return;
      }

      const targetWeight = Number($('#target-layer-weight')?.value) || 120;
      const targetCount  = Number($('#target-layer-count')?.value) || 8;
      const extra = Number($('#extra-for-crumbs')?.value) || 0;

      const totalWeight = targetWeight * targetCount * (1 + extra / 100);
      const scalingFactor = totalWeight / analysis.totalWeight;
      const newRecipe = {};

      for (const [k, v] of Object.entries(analysis.recipe)) {
        newRecipe[k] = k === 'soda' ? round2(v * scalingFactor) : round1(v * scalingFactor);
      }

      UI.renderScalingResult({
        newRecipe,
        totalWeight: Math.round(totalWeight),
        scalingFactor: +scalingFactor.toFixed(2),
        perLayerWeight: targetWeight
      }, 'advanced');

      injectApplyToLabButton({ newRecipe }, getCaramelizationOptions());

    } catch (e) {
      console.error('handleCalcScalingAdvanced error:', e);
      alert('خطأ في التحجيم المتقدم: ' + e.message);
    }
  }

  function handleCalcScalingReverse() {
    try {
      const shape = document.querySelector('input[name="pan-shape-reverse"]:checked')?.value || 'round';
      const dim1 = Number($('#pan-dim1-reverse')?.value) || 24;
      const dim2 = (shape === 'rectangle') ? Number($('#pan-dim2-reverse')?.value) || 20 : null;
      const thickness = Number($('#layer-thickness-reverse')?.value) || 2;
      const count = Number($('#target-layers-reverse')?.value) || 8;

      const area = Core.ScalingService.getPanArea(shape, dim1, dim2);
      const density = Core.ScalingService.getCalibratedDensity() || Core.CONSTANTS.AVERAGE_DOUGH_DENSITY;
      const single = Core.ScalingService.calculateSingleLayerWeight(density, area, thickness);
      const totalWeight = single * count;

      const analysis = Core.AnalysisService.analyzeRecipe(getRecipeInputs());
      if (!analysis || analysis.error) {
        alert('حلّل الوصفة أولاً.');
        return;
      }

      const pct = {};
      const sum = analysis.totalWeight || 1;
      for (const [k, v] of Object.entries(analysis.recipe)) pct[k] = (v / sum);

      const newRecipe = {};
      for (const [k, p] of Object.entries(pct)) {
        newRecipe[k] = (k === 'soda' ? round2 : round1)(totalWeight * p);
      }

      UI.renderScalingResult({
        newRecipe,
        totalWeight: Math.round(totalWeight),
        perLayerWeight: Math.round(single)
      }, 'reverse');

      injectApplyToLabButton({ newRecipe }, getCaramelizationOptions());

    } catch (e) {
      console.error('handleCalcScalingReverse error:', e);
      alert('خطأ في الحساب العكسي: ' + e.message);
    }
  }

  // ============================ معايرة الكثافة ============================
  function handleCalibrateDensity() {
    try {
      const weight = Number($('#calibrate-weight')?.value) || 0;
      const diameter = Number($('#calibrate-diameter')?.value) || 24;
      const thickness = Number($('#calibrate-thickness')?.value) || 2;

      if (weight <= 0) {
        alert('أدخل وزن الطبقة المخبوزة');
        return;
      }

      const result = Core.ScalingService.calibrateDoughDensity({
        shape: 'round',
        dim1: diameter,
        dim2: null,
        thicknessMm: thickness,
        measuredRawMass: weight
      });

      if (result.error) {
        alert('خطأ في المعايرة: ' + (result.error.code || 'قيم غير صالحة'));
        return;
      }

      Core.ScalingService.setCalibratedDensity(result.density);

      const container = $('#calibration-result');
      if (container) {
        container.innerHTML = `
          <div class="alert alert-success" style="margin-top:8px;">
            ✅ تم حفظ الكثافة المُعايرة: <strong>${result.density.toFixed(3)} جم/سم³</strong>
            <br><small>سيتم استخدام هذه القيمة في جميع حسابات الطبقات.</small>
          </div>
        `;
      }

      if ($('#scaling-results-container')?.innerHTML.includes('حساب الطبقات')) {
        handleCalcLayersNormal();
      }

    } catch (e) {
      console.error('handleCalibrateDensity error:', e);
      alert('خطأ في المعايرة: ' + e.message);
    }
  }

  // ============================ زر نقل المقادير إلى الصفحة الرئيسية ============================
  function injectApplyToLabButton(recipeObj, originalCaramelization = null) {
    const cont = document.querySelector('#scaling-results-container');
    if (!cont || !recipeObj) return;
    const newRecipe = recipeObj.newRecipe || recipeObj;
    if (!newRecipe) return;

    const btn = document.createElement('button');
    btn.className = 'btn primary apply-to-lab';
    btn.textContent = 'نقل المقادير إلى الصفحة الرئيسية وإعادة الحساب';
    btn.style.marginTop = '8px';
    btn.style.width = '100%';

    // منع التكرار
    cont.querySelector('.btn.primary.apply-to-lab')?.remove();

    btn.addEventListener('click', () => {
      const map = {
        flour: '#flour', butter: '#butter', sugar: '#sugar',
        honey: '#honey', eggs: '#eggs', soda: '#soda'
      };

      Object.entries(map).forEach(([key, selector]) => {
        if (newRecipe[key] !== undefined) {
          const element = document.querySelector(selector);
          if (element) element.value = String(round1(newRecipe[key]));
        }
      });

      if (originalCaramelization) {
        const enabledCheckbox = document.getElementById('caramelization-enabled');
        const tpreInput = document.getElementById('caramelization-Tpre');
        const timeInput = document.getElementById('caramelization-tpre');
        const evapInput = document.getElementById('caramelization-evap');

        if (enabledCheckbox) enabledCheckbox.checked = originalCaramelization.enabled;
        if (tpreInput) tpreInput.value = originalCaramelization.T_pre;
        if (timeInput) timeInput.value = originalCaramelization.t_pre;
        if (evapInput) evapInput.value = originalCaramelization.evap;

        setTimeout(() => {
          if (originalCaramelization.enabled) alert('تم تفعيل إعدادات الكرملة تلقائياً مع المقادير المنقولة');
        }, 500);
      }

      const labTab = document.querySelector('.tab-btn[data-tab="lab"]');
      if (labTab) labTab.click();

      setTimeout(() => {
        const analyzeBtn = document.querySelector('#analyze-btn');
        if (analyzeBtn) {
          analyzeBtn.click();
          alert('تم نقل المقادير بنجاح! جاري إعادة التحليل...');
        }
      }, 300);
    });

    cont.appendChild(btn);
  }

  // ============================ تقليل الحلاوة للحشوات ============================
  function applySweetnessReduction(recipe, percent, options = {}) {
    const p = Math.max(0, Math.min(50, Number(percent) || 0)) / 100;
    if (p <= 0) return { recipe: { ...recipe }, removedTotal: 0, removedMap: {} };

    const sweetKeys = ['powdered-sugar', 'sugar', 'honey', 'condensed-milk', 'dulce-de-leche', 'caramel', 'jam'];
    let removedTotal = 0;
    const removedMap = {};
    const newRecipe = { ...recipe };

    sweetKeys.forEach(k => {
      const v = Number(newRecipe[k]) || 0;
      if (v > 0) {
        const reduced = v * (1 - p);
        const delta = v - reduced;
        newRecipe[k] = Math.max(0, Math.round(reduced));
        removedTotal += delta;
        removedMap[k] = Math.round(delta);
      }
    });

    if (options.reallocate === true && removedTotal > 0) {
      let pool = options.pool && options.pool.length ? options.pool
        : ['cream-cheese', 'sour-cream', 'whipping-cream', 'mascarpone'];

      let present = pool.filter(k => (Number(newRecipe[k]) || 0) > 0);
      if (present.length === 0) present = ['sour-cream'];

      const share = removedTotal / present.length;
      present.forEach(k => {
        newRecipe[k] = Math.round((Number(newRecipe[k]) || 0) + share);
      });
    }

    return { recipe: newRecipe, removedTotal: Math.round(removedTotal), removedMap };
  }

  // ============================ الحشوة الذكية ============================
  function renderFillingInputsWithCheckboxes() {
    const container = $('#filling-dynamic-ingredients');
    if (!container) return;

    const kb = window.FILLING_KNOWLEDGE?.ingredients || {};
    const keys = Object.keys(kb);

    if (!keys.length) {
      container.innerHTML = `<div class="alert alert-warning">⚠️ لم يتم تحميل قاعدة المعرفة للحشوات. تأكد من تضمين fillings-data.js</div>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'result-box';
    grid.innerHTML = `<h4>🧪 اختر المكونات وفعلها ثم أدخل الوزن</h4>`;

    const wrap = document.createElement('div');
    wrap.style.display = 'grid';
    wrap.style.gridTemplateColumns = 'repeat(auto-fit,minmax(220px,1fr))';
    wrap.style.gap = '8px';

    keys.forEach(slug => {
      const row = document.createElement('div');
      row.className = 'dyn-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'auto 1fr auto';
      row.style.gap = '8px';
      row.style.alignItems = 'center';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'dyn-check';
      check.dataset.ingredient = slug;

      const label = document.createElement('label');
      label.textContent = UI.getIngredientDisplayName(slug);
      label.style.fontWeight = '600';

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'dyn-filling-input';
      input.dataset.ingredient = slug;
      input.min = '0';
      input.step = '1';
      input.value = '0';
      input.disabled = true;
      input.style.padding = '4px 8px';

      check.addEventListener('change', () => {
        input.disabled = !check.checked;
        if (!check.checked) input.value = '0';
      });

      row.appendChild(check);
      row.appendChild(label);
      row.appendChild(input);
      wrap.appendChild(row);
    });

    grid.appendChild(wrap);
    container.innerHTML = '';
    container.appendChild(grid);
  }

  function handleGenerateFillingProtocol() {
    try {
      // جمع المكونات المفعلة
      const rows = $$('.dyn-row');
      let recipe = {};
      const errors = [];

      rows.forEach(row => {
        const chk = row.querySelector('.dyn-check');
        const inp = row.querySelector('.dyn-filling-input');
        if (chk?.checked) {
          const slug = chk.dataset.ingredient;
          const grams = Number(inp?.value) || 0;
          if (grams > 0) {
            if (grams > 5000) {
              errors.push(`كمية ${UI.getIngredientDisplayName(slug)} كبيرة جداً (${grams} جم). الحد الأقصى 5000 جم.`);
            } else {
              recipe[slug] = grams;
            }
          }
        }
      });

      if (errors.length > 0) {
        alert('أخطاء في المدخلات:\n' + errors.join('\n'));
        return;
      }
      if (!Object.keys(recipe).length) {
        alert('اختر مكونات الحشوة وفعّلها بعلامة ✔ ثم أدخل الأوزان.');
        return;
      }

      // تقليل الحلاوة (اختياري)
      const reduction = Number($('#sweetness-reduction')?.value) || 0;
      if (reduction > 0) {
        const { recipe: reducedRecipe, removedTotal, removedMap } = applySweetnessReduction(
          recipe,
          reduction,
          { reallocate: true, pool: ['cream-cheese', 'sour-cream', 'whipping-cream', 'mascarpone'] }
        );

        // Feedback
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'alert alert-info';
        feedbackDiv.style.cssText = 'margin:12px 0;padding:14px;background:#E8F5E9;border-right:4px solid #4CAF50;border-radius:8px;';
        feedbackDiv.innerHTML = `
          <div style="display:flex;gap:12px;align-items:start;">
            <span style="font-size:1.8em;line-height:1;">📉</span>
            <div style="flex:1;">
              <strong style="color:#2E7D32;font-size:1.05em;">تم تقليل الحلاوة بنسبة ${reduction}%</strong>
              <div style="margin:10px 0;">
                <strong style="color:#555;">ما تم إزالته:</strong>
                <ul style="margin:6px 0 0 20px;color:#666;line-height:1.6;">
                  ${Object.entries(removedMap)
                    .filter(([k,v]) => v > 0)
                    .map(([k,v]) => `<li>${UI.escapeHTML(UI.getIngredientDisplayName(k))}: <strong style="color:#D32F2F;">-${Math.round(v)} جم</strong></li>`)
                    .join('')}
                </ul>
                <div style="margin-top:8px;padding:8px;background:white;border-radius:4px;">
                  <strong>الإجمالي المُزال:</strong> <span style="color:#D32F2F;font-size:1.1em;font-weight:700;">${Math.round(removedTotal)} جم</span>
                </div>
              </div>
            </div>
          </div>
        `;
        const fbContainer = $('#filling-results-container');
        if (fbContainer) {
          fbContainer.querySelector('.alert.alert-info')?.remove();
          fbContainer.insertBefore(feedbackDiv, fbContainer.firstChild);
        }

        recipe = reducedRecipe; // اعتماد الوصفة الجديدة
      }

      // كيمياء الحشوة
      let chem;
      if (Core.ChemistryService.estimateFillingChemistry) {
        chem = Core.ChemistryService.estimateFillingChemistry(recipe, { viscosityTemp: 10 });
      } else {
        const brix = Core.ChemistryService.estimateBrix(recipe, false);
        const ph = Core.ChemistryService.estimatePH(recipe, false);
        const aw = Core.ChemistryService.estimateWaterActivity(recipe);
        chem = { brix, ph, waterActivity: aw, viscosity: { value: 1500 }, stability: { score: 85 } };
      }

      // حساب الوزن المطلوب للحشوة
      const shape = $('#filling-pan-shape')?.value || 'round';
      const dim1 = Number($('#filling-pan-dim1')?.value) || 24;
      const dim2 = (shape === 'rectangle') ? Number($('#filling-pan-dim2')?.value) || 20 : null;
      const layers = Number($('#filling-layers')?.value) || 8;
      const thick = Number($('#filling-thickness')?.value) || 5;

      const area = Core.ScalingService.getPanArea(shape, dim1, dim2);
      const fillingDensity = 1.10;
      const fillingLayers = Math.max(0, layers - 1);
      const requiredWeight = area * (thick / 10) * fillingDensity * fillingLayers;

      const totalInput = Object.values(recipe).reduce((a,b) => a + (Number(b) || 0), 0);
      const scale = totalInput > 0 ? requiredWeight / totalInput : 1;

      // وصفة محجمة
      const scaledRecipe = {};
      Object.entries(recipe).forEach(([k,v]) => {
        scaledRecipe[k] = Math.max(0, Math.round((Number(v) || 0) * scale));
      });

      // وزن لكل طبقة
      const perLayerAmount = area * (thick / 10) * fillingDensity;

      // تحذير "حشوة سميكة + حلاوة مركزة"
      const sweetIngredients = ['powdered-sugar','sugar','condensed-milk','dulce-de-leche','honey','caramel','jam'];
      const totalSweet = sweetIngredients.reduce((sum, k) => sum + (Number(scaledRecipe[k]) || 0), 0);
      const totalScaled = Object.values(scaledRecipe).reduce((s, v) => s + (Number(v) || 0), 0);
      const sweetPct = totalScaled > 0 ? (totalSweet / totalScaled) * 100 : 0;

      if (perLayerAmount > 120 && sweetPct > 25) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'alert alert-warning';
        warningDiv.style.cssText = 'margin:16px 0;padding:16px;border-radius:8px;background:#FFF3E0;border-right:4px solid #FF9800;';
        warningDiv.innerHTML = `
          <div style="display:flex;gap:12px;align-items:start;">
            <span style="font-size:2em;line-height:1;">⚠️</span>
            <div style="flex:1;">
              <strong style="font-size:1.1em;color:#E65100;">تحذير: حشوة سميكة + حلاوة مُركّزة</strong>
              <div style="margin:12px 0;padding:12px;background:white;border-radius:6px;">
                <strong>📊 التحليل:</strong>
                <ul style="margin:8px 0 0 20px;color:#555;">
                  <li>سماكة الحشوة لكل طبقة: <strong>${perLayerAmount.toFixed(0)} جم</strong> (مرتفع، المثالي <120 جم)</li>
                  <li>نسبة السكريات: <strong>${sweetPct.toFixed(1)}%</strong> (مرتفع، المثالي <25%)</li>
                </ul>
              </div>
              <div style="margin-top:12px;">
                <strong style="color:#E65100;">💡 حلول سريعة:</strong>
                <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
                  <button class="btn" onclick="applySweetnessReductionQuick(15)" style="background:#2196F3;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">تقليل الحلاوة 15%</button>
                  <button class="btn" onclick="suggestMoreLayers()" style="background:#4CAF50;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">زيادة عدد الطبقات</button>
                  <button class="btn" onclick="showBalancingTips()" style="background:#FF9800;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">نصائح الموازنة</button>
                </div>
              </div>
            </div>
          </div>
        `;
        const warnContainer = $('#filling-results-container');
        if (warnContainer) warnContainer.insertBefore(warningDiv, warnContainer.firstChild);

        // وظائف الأزرار
        window.applySweetnessReductionQuick = function(percent) {
          const slider = document.getElementById('sweetness-reduction');
          if (slider) {
            slider.value = percent;
            const event = new Event('input', { bubbles: true });
            slider.dispatchEvent(event);
            alert(`✅ تم ضبط المؤشر على ${percent}%. اضغط "توليد بروتوكول التحضير" مرة أخرى.`);
          }
        };
        window.suggestMoreLayers = function() {
          const currentLayers = Number($('#filling-layers')?.value) || 8;
          const suggested = currentLayers + 2;
          const newPerLayer = (perLayerAmount * currentLayers / suggested).toFixed(0);
          alert(`💡 الاقتراح:\n\nبدلاً من ${currentLayers} طبقات × ${perLayerAmount.toFixed(0)} جم/طبقة\nجرّب ${suggested} طبقات × ${newPerLayer} جم/طبقة`);
        };
        window.showBalancingTips = function() {
          alert(`🎯 نصائح موازنة الحلاوة:\n\n1) زيادة المكونات الحامضة: 10-15 مل عصير ليمون\n2) زيادة الألبان غير المحلاة: 50-100 جم جبن كريمي/سور كريم\n3) استبدال جزئي: 30% من الدولسي بمسكربوني\n4) نكهات قوية: قهوة فورية، كاكاو، لوز`);
        };
      }

      // بروتوكول التحضير
      const proto = UI.generateDynamicProtocol(scaledRecipe);
      const protoContainer = $('#preparation-protocol-container');

      if (protoContainer) {
        protoContainer.innerHTML = '';
        if (proto.html && UI.isSafeHTML(proto.html)) {
          protoContainer.innerHTML = proto.html;
        } else {
          const box = document.createElement('div');
          box.className = 'result-box';
          box.innerHTML = `<h4>📋 بروتوكول التحضير</h4><ol>${
            proto.steps.map(s =>
              `<li><strong>${UI.escapeHTML(s.name||s.step||'خطوة')}</strong> — ${UI.escapeHTML(s.time||'')}, ${UI.escapeHTML(s.temp||'')}</li>`
            ).join('')
          }</ol>`;
          protoContainer.appendChild(box);
        }
      }

      // نتيجة الحشوة
      const result = {
        requiredWeight: Math.round(requiredWeight),
        perLayerAmount: Math.round(perLayerAmount),
        scaledRecipe,
        chemistry: chem
      };

      UI.renderFillingResult(result);
      UI.renderFillingChemistryPanel(chem);

      // حفظ الحالة للتقرير
      AppState.fillingRecipe = scaledRecipe;
      AppState.fillingChemistry = chem;
      updateCompatibilityReportWrapper();

    } catch (e) {
      console.error('handleGenerateFillingProtocol error:', e);
      alert('تعذر توليد بروتوكول الحشوة: ' + e.message);
    }
  }

  function handleSaveFilling() {
    try {
      const name = prompt('اسم الحشوة للحفظ؟');
      if (!name) return;

      const rows = $$('.dyn-row');
      const recipe = {};

      rows.forEach(row => {
        const chk = row.querySelector('.dyn-check');
        const inp = row.querySelector('.dyn-filling-input');
        if (chk?.checked) {
          const slug = chk.dataset.ingredient;
          const grams = Number(inp?.value) || 0;
          if (grams > 0) recipe[slug] = grams;
        }
      });

      if (!Object.keys(recipe).length) {
        alert('لا توجد مكونات محددّة للحفظ.');
        return;
      }

      let chem;
      if (Core.ChemistryService.estimateFillingChemistry) {
        chem = Core.ChemistryService.estimateFillingChemistry(recipe, { viscosityTemp: 10 });
      } else {
        const brix = Core.ChemistryService.estimateBrix(recipe, false);
        const ph = Core.ChemistryService.estimatePH(recipe, false);
        const aw = Core.ChemistryService.estimateWaterActivity(recipe);
        chem = { brix, ph, waterActivity: aw };
      }

      const saved = loadFillings();
      const item = { id: Date.now(), name, recipe, chemistry: chem, createdAt: new Date().toISOString() };
      saved.unshift(item);
      localStorage.setItem('medovik_fillings_v3', JSON.stringify(saved));
      renderFillingsLibrary(saved);
      alert('تم حفظ الحشوة: ' + name);

    } catch (e) {
      console.error('handleSaveFilling error:', e);
      alert('تعذر الحفظ: ' + e.message);
    }
  }

  function onLibraryClick(e) {
    const btn = e.target.closest('.btn-load-filling');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    const all = loadFillings();
    const filling = all.find(f => f.id === id);
    if (filling) {
      fillFillingInputsFromRecipe(filling.recipe);
    }
  }

  function fillFillingInputsFromRecipe(recipe) {
    const rows = $$('.dyn-row');
    rows.forEach(row => {
      const chk = row.querySelector('.dyn-check');
      const inp = row.querySelector('.dyn-filling-input');
      const slug = chk?.dataset?.ingredient;
      if (!slug) return;
      const val = Number(recipe[slug] || 0);
      chk.checked = val > 0;
      inp.disabled = !(val > 0);
      inp.value = val > 0 ? String(val) : '0';
    });
  }

  function loadFillings() {
    try { return JSON.parse(localStorage.getItem('medovik_fillings_v3')) || []; }
    catch { return []; }
  }

  function renderFillingsLibrary(items) {
    const container = $('#filling-library-container');
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = `<div class="alert alert-info">لا توجد حشوات محفوظة.</div>`;
      return;
    }

    container.innerHTML = items.map(it => `
      <div class="recipe-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4 class="recipe-name">${UI.escapeHTML(it.name)}</h4>
          <small class="muted">${new Date(it.createdAt).toLocaleString('ar-EG')}</small>
        </div>
        <div class="recipe-ingredients muted" style="font-size:0.9rem;">
          ${Object.entries(it.recipe).map(([k,v]) =>
            `<span>${UI.escapeHTML(UI.getIngredientDisplayName(k))}: ${nf.format(v)} جم</span>`
          ).join(' • ')}
        </div>
        <button class="btn btn-load-filling" data-id="${it.id}" style="margin-top:8px;padding:4px 8px;font-size:0.8rem;">تحميل</button>
      </div>
    `).join('');
  }

  function syncFillingPanShapeHint() {
    const shape = $('#filling-pan-shape')?.value || 'round';
    const dim2 = $('#filling-pan-dim2');
    if (!dim2) return;

    if (shape === 'rectangle') {
      dim2.disabled = false;
      dim2.placeholder = 'العرض (سم)';
    } else {
      dim2.disabled = true;
      dim2.value = '';
      dim2.placeholder = 'للمستطيلة فقط';
    }
  }

  // ============================ مكتبة وصفات العجين ============================
  function loadRecipes() {
    try { return JSON.parse(localStorage.getItem('medovik_recipes_v5')) || []; }
    catch { return []; }
  }

  function saveRecipes(list) { localStorage.setItem('medovik_recipes_v5', JSON.stringify(list)); }

  function handleSaveDoughRecipe() {
    try {
      const name = prompt('اسم الوصفة؟');
      if (!name) return;
      const note = prompt('ملاحظة/تعليق تظهر عند التحميل (اختياري):') || '';
      const recipe = getRecipeInputs();
      const analysis = Core.AnalysisService.analyzeRecipe(recipe);
      const item = {
        id: Date.now(),
        name,
        note,
        recipe,
        createdAt: new Date().toISOString(),
        summary: {
          hydration: analysis?.hydration ?? null,
          weight: analysis?.totalWeight ?? null
        }
      };
      const all = loadRecipes();
      all.unshift(item);
      saveRecipes(all);
      renderRecipeLibrary(all);
      alert('تم حفظ الوصفة.');
    } catch (e) {
      console.error('handleSaveDoughRecipe error:', e);
      alert('تعذر حفظ الوصفة: ' + e.message);
    }
  }

  function handleExportRecipes() {
    try {
      const all = loadRecipes();
      const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `medovik-recipes-${Date.now()}.json`;
      a.click();
    } catch (e) {
      console.error('handleExportRecipes error:', e);
      alert('تعذر التصدير: ' + e.message);
    }
  }

  function handleImportRecipes(e) {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arr = JSON.parse(reader.result);
          if (!Array.isArray(arr)) throw new Error('ملف غير صالح - يجب أن يكون مصفوفة');

          const validRecipes = [];
          const invalidRecipes = [];

          arr.forEach((item, index) => {
            if (!item || typeof item !== 'object') {
              invalidRecipes.push(`العنصر ${index + 1}: ليس كائنًا صالحًا`);
              return;
            }
            if (!item.recipe || typeof item.recipe !== 'object') {
              invalidRecipes.push(`الوصفة ${index + 1}: لا تحتوي على مقادير صالحة`);
              return;
            }
            const keys = ['flour', 'butter', 'sugar', 'honey', 'eggs', 'soda'];
            let valid = true;
            for (const key of keys) {
              const val = item.recipe[key];
              if (val !== undefined && (typeof val !== 'number' || val < 0)) {
                invalidRecipes.push(`الوصفة ${item.name || index + 1}: ${key} قيمة غير صالحة (${val})`);
                valid = false;
                break;
              }
            }
            if (valid) validRecipes.push(item);
          });

          if (validRecipes.length === 0) throw new Error('لا توجد وصفات صالحة في الملف');

          const existing = loadRecipes();
          const merged = [...validRecipes, ...existing];
          saveRecipes(merged);
          renderRecipeLibrary(merged);

          let message = `✅ تم استيراد ${validRecipes.length} وصفة صالحة`;
          if (invalidRecipes.length > 0) {
            message += `\n⚠️ تم تجاهل ${invalidRecipes.length} وصفة غير صالحة:\n${invalidRecipes.slice(0, 5).join('\n')}`;
            if (invalidRecipes.length > 5) message += `\n... و ${invalidRecipes.length - 5} أكثر`;
          }
          alert(message);

        } catch (err) {
          alert('❌ خطأ في الاستيراد:\n' + err.message);
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (e) {
      console.error('handleImportRecipes error:', e);
      alert('تعذر الاستيراد: ' + e.message);
    }
  }

  function renderRecipeLibrary(items) {
    const container = $('#recipe-library-container');
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = '<div class="alert alert-info">لا توجد وصفات محفوظة.</div>';
      return;
    }

    container.innerHTML = items.map(it => `
      <div class="recipe-card" data-id="${it.id}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong>${UI.escapeHTML(it.name)}</strong>
          <small class="muted">${new Date(it.createdAt).toLocaleString('ar-EG')}</small>
        </div>
        ${it.note ? `<div class="muted" style="margin:4px 0;">📝 ${UI.escapeHTML(it.note)}</div>` : ''}
        <div class="muted" style="font-size:0.9rem;">
          Hydration: ${it.summary?.hydration?.toFixed ? it.summary.hydration.toFixed(1) : '—'}% • الوزن الإجمالي: ${it.summary?.weight ?? '—'} جم
        </div>
        <div class="buttons-row" style="margin-top:6px;">
          <button class="btn btn-load-recipe" data-id="${it.id}">تحميل</button>
          <button class="btn btn-danger btn-del-recipe" data-id="${it.id}">حذف</button>
        </div>
      </div>
    `).join('');
  }

  // تفويض أحداث مكتبة الوصفات
  $('#recipe-library-container')?.addEventListener('click', (e) => {
    const loadBtn = e.target.closest('.btn-load-recipe');
    const delBtn = e.target.closest('.btn-del-recipe');

    if (loadBtn) {
      const id = parseInt(loadBtn.dataset.id, 10);
      const all = loadRecipes();
      const recipe = all.find(r => r.id === id);
      if (recipe) {
        if (recipe.note) alert(`ملاحظة الوصفة:\n${recipe.note}`);

        const fields = { flour:'#flour', butter:'#butter', sugar:'#sugar', honey:'#honey', eggs:'#eggs', soda:'#soda' };
        Object.entries(fields).forEach(([key, selector]) => {
          const element = $(selector);
          if (element && recipe.recipe[key] !== undefined) element.value = recipe.recipe[key];
        });

        setTimeout(() => { $('#analyze-btn')?.click(); }, 100);
      }
    }

    if (delBtn) {
      const id = parseInt(delBtn.dataset.id, 10);
      const all = loadRecipes().filter(r => r.id !== id);
      saveRecipes(all);
      renderRecipeLibrary(all);
    }
  });

  // ============================ تقرير التوافق الكيميائي ============================
  function updateCompatibilityReportWrapper() {
    if (AppState.doughChemistry && AppState.fillingChemistry) {
      let report;

      if (Core.ChemistryService.buildCompatibilityReport) {
        report = Core.ChemistryService.buildCompatibilityReport(
          AppState.doughChemistry,
          AppState.fillingChemistry
        );
      } else {
        const doughHydration = AppState.doughChemistry.hydration || 0;
        const fillingAw = AppState.fillingChemistry.waterActivity?.value || 0;
        const doughPh = AppState.doughChemistry.ph?.value || 7;
        const fillingPh = AppState.fillingChemistry.ph?.value || 7;

        let score = 100;
        const issues = [];
        const recommendations = [];

        if (fillingAw > 0.85 && doughHydration < 25) {
          score -= 20;
          issues.push({ code: 'رطوبة الحشوة عالية مقارنة بالعجين الجاف' });
          recommendations.push({ code: 'فكر في زيادة رطوبة العجين أو تقليل رطوبة الحشوة' });
        }

        const phDiff = Math.abs(doughPh - fillingPh);
        if (phDiff > 1.5) {
          score -= 15;
          issues.push({ code: `فرق كبير في الحموضة (${phDiff.toFixed(1)})` });
        }

        let rating = 'excellent';
        if (score >= 90) rating = 'excellent';
        else if (score >= 75) rating = 'very-good';
        else if (score >= 60) rating = 'acceptable';
        else rating = 'weak';

        report = { score: Math.max(0, score), rating, issues, recommendations };
      }

      UI.renderCompatibilityReport(report, AppState.doughChemistry, AppState.fillingChemistry);
    }
  }

  // ============================ Utilities ============================
  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }

  // بدء التطبيق
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, window.MedovikCalculatorCore, window.UIRenderer, window.MedovikMain);