// MAIN.JS — Medovik Brain (Flow + Optimizer + Decisions)
// v3.1.0 — Arabic UI, Physics‑pure Core, Decision Mapping in Main

(function(window, Core) {
  'use strict';

  // ---------------------- Metadata ----------------------
  const MedovikMain = {
    META: { name: 'MedovikMain', version: '3.1.0', buildDate: '2025-11-23' }
  };

  // ---------------------- Config (reads from Core) ----------------------
  const CFG = {
    SEARCH: {
      Tmin: 18,
      Tmax: 45,
      step: 0.5,
      refineWindow: 1.0,
      refineStep: 0.25
    },
    COST: {
      alphaStickiness: 0.15,   // α
      betaCrack: 0.15,         // β
      roomBiasCenter: 32,      // slight bias toward ~28–36°C
      roomBiasWeight: 0.02
    },
    TARGET: {
      etaMin: Core.CONSTANTS.CONFIG.WORK.ETA_WORK_MIN, // 12000
      etaMax: Core.CONSTANTS.CONFIG.WORK.ETA_WORK_MAX, // 20000
      get etaMid() { return Math.sqrt(this.etaMin * this.etaMax); } // ~15492
    },
    HYDRATION: {
      CRITICAL_HIGH: Core.CONSTANTS.CONFIG.HYDRATION.CRITICAL_HIGH,   // 35
      HEAVY_MIN: Core.CONSTANTS.CONFIG.HYDRATION.MEDOVIK_HEAVY_LOWER,// 31
      CRITICAL_LOW: Core.CONSTANTS.CONFIG.HYDRATION.CRITICAL_LOW      // 15
    },
    VISCOSITY_BANDS: Core.CONSTANTS.CONFIG.VISCOSITY, // 7k/12k/20k/30k
    KD: {
      phiM: Core.ChemistryService?._VISCOSITY_PARAMS?.phiM ?? 0.60,
      intrinsic: Core.ChemistryService?._VISCOSITY_PARAMS?.intrinsic ?? 2.5,
      kFat: Core.ChemistryService?._VISCOSITY_PARAMS?.kFat ?? 0.20,
      kSugar: Core.ChemistryService?._VISCOSITY_PARAMS?.kSugar ?? 0.10
    },
    TRUE_DENSITIES: Core.CONSTANTS.TRUE_DENSITIES
  };

  // ---------------------- Utilities (pure) ----------------------
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const isFiniteNum = v => typeof v === 'number' && isFinite(v);

  function computeHydrationPercent(recipe) {
    const r = recipe || {};
    const wm = (r.eggs || 0) * Core.CONSTANTS.HYDRATION.EGG_WATER_CONTENT
             + (r.honey|| 0) * Core.CONSTANTS.HYDRATION.HONEY_WATER_CONTENT
             + (r.butter||0) * Core.CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
    const flour = Number(r.flour) || 0;
    return (flour > 0) ? (wm / flour) * 100 : 0;
  }

  function computeWaterMass(recipe) {
    return (recipe.eggs || 0) * Core.CONSTANTS.HYDRATION.EGG_WATER_CONTENT
         + (recipe.honey|| 0) * Core.CONSTANTS.HYDRATION.HONEY_WATER_CONTENT
         + (recipe.butter||0) * Core.CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
  }

  // UI advisory for soda; unified threshold 1.0%
  function sodaRatioInfo(recipe) {
    const flour = Number(recipe.flour) || 0;
    const soda = Number(recipe.soda) || 0;
    if (flour <= 0 || soda <= 0) return null;
    const ratioPct = (soda / flour) * 100;
    return {
      ratioPct: +ratioPct.toFixed(2),
      tasteWarning: ratioPct >= 1.0,
      advisoryRange: [0.5, 1.0]
    };
  }

  function mapViscosityBand(eta) {
    if (!isFiniteNum(eta) || eta <= 0) return 'unknown';
    const R = CFG.VISCOSITY_BANDS;
    if (eta < R.STICKY.min) return 'too-wet';
    if (eta < R.STICKY.max) return 'sticky';
    if (eta <= R.OPTIMAL.max) return 'optimal';
    if (eta <= R.STIFF.max) return 'stiff';
    return 'too-stiff';
  }

  function bandToStatus(band) {
    switch (band) {
      case 'optimal': return 'GO';
      case 'sticky':
      case 'stiff': return 'WAIT';
      case 'too-wet':
      case 'too-stiff': return 'STOP';
      default: return 'WAIT';
    }
  }

  // η(T) via core
  function getEtaAtT(recipe, T, options) {
    const vis = Core.ChemistryService.calculateDoughViscosity(recipe, T, {
      caramelization: options?.caramelization, debug: !!options?.debug
    });
    return {
      eta: Math.max(0, Number(vis?.value) || 0),
      comp: vis?.components || null,
      debug: vis?.debug,
      workTarget: vis?.workTarget || null
    };
  }

  // Risk terms
  function stickinessRisk(eta, T) {
    const base = clamp((7000 - (eta || 0)) / 7000, 0, 1);
    const tempFactor = clamp((T - CFG.SEARCH.Tmin) / (CFG.SEARCH.Tmax - CFG.SEARCH.Tmin), 0, 1);
    return base * tempFactor; // أبرَد يخفف الخطر
  }
  function crackRisk(hydration, phiEff) {
    let risk = 0;
    if (isFiniteNum(hydration) && hydration < 20) {
      risk += clamp((20 - hydration) / 10, 0, 1);
    }
    if (isFiniteNum(phiEff) && phiEff > 0.45) {
      risk += clamp((phiEff - 0.45) / 0.15, 0, 1);
    }
    return clamp(risk, 0, 1);
  }
  function roomBias(T) {
    const c = CFG.COST.roomBiasCenter;
    return CFG.COST.roomBiasWeight * (Math.abs(T - c) / (CFG.SEARCH.Tmax - CFG.SEARCH.Tmin));
  }
  function costFn(T, eta, context) {
    const etaMid = CFG.TARGET.etaMid;
    const base = Math.abs(Math.log((eta || 1) / etaMid));
    const sR = stickinessRisk(eta, T);
    const cR = crackRisk(context.hydration, context.phiEff);
    return base + CFG.COST.alphaStickiness * sR + CFG.COST.betaCrack * cR + roomBias(T);
  }

  // KD inversion → φ_eff_target
  function invertKD(eta_target, eta0, F_net) {
    const { phiM, intrinsic } = CFG.KD;
    if (!isFiniteNum(eta_target) || !isFiniteNum(eta0) || !isFiniteNum(F_net) || eta_target <= 0 || eta0 <= 0 || F_net <= 0) {
      return null;
    }
    const eta_rel_target = eta_target / (eta0 * F_net);
    if (eta_rel_target <= 1) return 0; // بالفعل أعلى من الأساس
    const denom = intrinsic * phiM;
    const oneMinus = Math.pow(eta_rel_target, -1 / denom); // (1 − φ_eff/φM)
    const phi_eff_target = phiM * (1 - oneMinus);
    return clamp(phi_eff_target, 0, phiM * 0.98);
  }

  // حجم المزيج التقريبي (cm³) باستخدام TRUE densities
  function estimateTotalVolumeCm3(recipe) {
    const TD = CFG.TRUE_DENSITIES;
    const sumV = (name, rho) => ((Number(recipe[name]) || 0) / rho);
    return (
      sumV('flour', TD.FLOUR_TRUE) +
      sumV('sugar', TD.SUGAR_TRUE) +
      sumV('honey', TD.HONEY_TRUE) +
      sumV('butter', TD.BUTTER_TRUE) +
      sumV('eggs', TD.EGGS_TRUE)
    );
  }

  // Δφ_eff → Δm_flour
  function deltaFlourFromDeltaPhiEff(deltaPhiEff, recipe) {
    if (!isFiniteNum(deltaPhiEff) || deltaPhiEff <= 0) return 0;
    const Vtot = estimateTotalVolumeCm3(recipe);
    const totalMass = Object.values(recipe).reduce((a,b)=>a+(+b||0),0);
    const f_fat = (Number(recipe.butter)||0) / Math.max(1e-9, totalMass);
    const f_sug = ((Number(recipe.sugar)||0) + (Number(recipe.honey)||0)) / Math.max(1e-9, totalMass);
    const compaction = (1 - CFG.KD.kFat * f_fat - CFG.KD.kSugar * f_sug);
    const deltaV_flour = (deltaPhiEff * Vtot) / Math.max(1e-9, compaction);
    const rho_flour = CFG.TRUE_DENSITIES.FLOUR_TRUE;
    return Math.max(0, deltaV_flour * rho_flour); // g
  }

  // ΔLiquid (mL) للوصول إلى Hydration≈24% (22–26%)
  function deltaLiquidToTargetHydration(recipe, targetHydration = 24) {
    const flour = Number(recipe.flour) || 0;
    if (flour <= 0) return 0;
    const currentWater = computeWaterMass(recipe);
    const targetWater = (targetHydration / 100) * flour;
    const deltaWater = targetWater - currentWater; // g ≈ mL
    if (deltaWater <= 0) return 0;
    return deltaWater / 0.9; // تعويض بسيط
  }

  // ---------------------- Optimizer (public) ----------------------
  function findOptimalWorkPlan(recipe, options = {}) {
    const carOpt = options.caramelization || Core.CONSTANTS.CONFIG.CARAMELIZATION;
    const hydration = computeHydrationPercent(recipe);

    const Tmin = CFG.SEARCH.Tmin, Tmax = CFG.SEARCH.Tmax, step = CFG.SEARCH.step;
    const refineWin = CFG.SEARCH.refineWindow, refineStep = CFG.SEARCH.refineStep;

    let best = { T: Tmin, eta: 0, score: Infinity, comp: null };
    for (let T = Tmin; T <= Tmax + 1e-9; T += step) {
      const res = getEtaAtT(recipe, T, { caramelization: carOpt, debug: false });
      const eta = res.eta;
      const comp = res.comp || {};
      const context = { hydration, phiEff: comp['φ_eff'] };
      const score = costFn(T, eta, context);
      if (score < best.score) best = { T, eta, score, comp };
    }

    // تحسين محلي
    const Rmin = Math.max(Tmin, best.T - refineWin);
    const Rmax = Math.min(Tmax, best.T + refineWin);
    for (let T = Rmin; T <= Rmax + 1e-9; T += refineStep) {
      const res = getEtaAtT(recipe, T, { caramelization: carOpt, debug: false });
      const eta = res.eta;
      const comp = res.comp || {};
      const context = { hydration, phiEff: comp['φ_eff'] };
      const score = costFn(T, eta, context);
      if (score < best.score) best = { T, eta, score, comp };
    }

    const band = mapViscosityBand(best.eta);
    const planA = makePlanA(band, best.T, best.eta);

    // Plan B: تصحيح
    let planB = undefined;

    if (band === 'too-wet' || band === 'sticky') {
      // ΔFlour عبر KD inverse عند T_opt
      const eta0 = best.comp ? Number(best.comp['η0_new']) : NaN;
      const Fnet = best.comp ? Number(best.comp['F_net']) : NaN;
      const phiEffCur = best.comp ? Number(best.comp['φ_eff']) : NaN;

      const phiEffTarget = invertKD(CFG.TARGET.etaMid, eta0, Fnet);
      if (isFiniteNum(phiEffTarget) && isFiniteNum(phiEffCur)) {
        const dPhi = Math.max(0, phiEffTarget - phiEffCur);
        let dFlour = deltaFlourFromDeltaPhiEff(dPhi, recipe);

        // قيود: 10..80 جم أو ≤12% من الدقيق (الأقل)
        const flourMass = Number(recipe.flour) || 0;
        const pctCap = flourMass * 0.12;
        const hardMax = Math.min(80, pctCap);
        if (isFiniteNum(dFlour)) {
          dFlour = clamp(Math.round(dFlour), 0, Math.max(10, Math.round(hardMax)));
          if (dFlour > 0 && dFlour < 10) dFlour = 10;
        } else dFlour = 0;

        if (dFlour > 0) {
          planB = {
            deltaFlour: dFlour,
            T_opt: Math.round(best.T * 10) / 10,
            actions: [
              'أضف الدقيق على دفعات 10–20 جم مع الخلط الخفيف',
              'برّد/أرح العجين 10–15 دقيقة ثم أعد القياس',
              'افرد بين ورقتي خبز مع نثر خفيف فقط'
            ]
          };
        }
      }
    } else if (band === 'stiff' || band === 'too-stiff') {
      const dLiq = deltaLiquidToTargetHydration(recipe, 24);
      if (dLiq > 0) {
        planB = {
          deltaLiquid: Math.round(dLiq),
          T_opt: best.T < 28 ? 30 : Math.round(best.T * 10) / 10,
          actions: [
            'أضف 20–40 مل سوائل دافئة تدريجياً واعجن بلطف',
            'اترك العجين يرتاح 15–30 دقيقة ثم أعد القياس',
            'افرد بدرجة دافئة قليلاً (28–34°C) عند الحاجة'
          ]
        };
      }
    }

    // Override تشغيلي
    const closeToTarget = Math.abs(Math.log((best.eta || 1) / CFG.TARGET.etaMid)) < 0.8;
    const overrideApplied = (hydration >= 20 && hydration <= 28 && (band === 'sticky') && closeToTarget);

    return {
      planA,
      planB,
      flags: { overrideApplied, caramelization: !!carOpt?.enabled }
    };

    function makePlanA(b, T, eta) {
      let actions = [];
      if (b === 'too-wet') {
        actions = ['اخفض حرارة العمل إلى 18–22°C','راحة/تبريد 15–25 دقيقة','افرد بين ورقتين مع نثر خفيف جداً'];
      } else if (b === 'sticky') {
        actions = ['برّد 10–15 دقيقة','افرد بين ورقتين','نثر خفيف جداً فقط'];
      } else if (b === 'optimal') {
        actions = ['افرد مباشرة','حافظ على وتيرة العمل لتجنّب السخونة الزائدة'];
      } else if (b === 'stiff') {
        actions = ['ارفع حرارة العمل 28–34°C','راحة قصيرة 10 دقائق'];
      } else {
        actions = ['ارفع حرارة العمل تدريجياً','أضف 20–30 مل سوائل دافئة بحسب الحاجة','راحة 20–30 دقيقة'];
      }
      return { T_opt: Math.round(T * 10) / 10, eta_opt: Math.round(eta), band: b, actions };
    }
  }

  // ---------------------- Decision Mapping (public) ----------------------
  function decideDough(recipe, options = {}) {
    const carOpt = options.caramelization || Core.CONSTANTS.CONFIG.CARAMELIZATION;
    const hydration = computeHydrationPercent(recipe);
    const H = CFG.HYDRATION;

    // Gates
    if (hydration >= H.CRITICAL_HIGH) {
      return finalize({
        status: 'STOP',
        severity: 'high',
        message: `رطوبة مرتفعة جداً (${hydration.toFixed(1)}%). أوقف: برّد الخليط أو زد الدقيق تدريجياً حتى تقلّ عن 31%.`,
        actions: ['تبريد 20–30 دقيقة','أضف الدقيق تدريجياً حتى < 31%','أعد القياس بعد كل إضافة'],
        hydration, band: 'too-wet', T_opt: null, eta_opt: null,
        plans: { planA: null, planB: null },
        flags: { overrideApplied: false, caramelization: !!carOpt?.enabled }
      });
    }
    if (hydration < H.CRITICAL_LOW) {
      const dLiq = deltaLiquidToTargetHydration(recipe, 24);
      return finalize({
        status: 'WAIT',
        severity: 'high',
        message: `العجين جاف/متفتت (Hydration ${hydration.toFixed(1)}%).`,
        actions: ['أضف 1–2 ملعقة كبيرة سوائل دافئة','ارفَع حرارة العمل قليلاً','اعجن بلطف ثم اتركه يرتاح 15–20 دقيقة'],
        hydration, band: 'too-stiff', T_opt: null, eta_opt: null,
        plans: {
          planA: { T_opt: 30, eta_opt: null, band: 'stiff', actions: ['ارفع حرارة العمل 28–34°C','راحة قصيرة 10 دقائق'] },
          planB: dLiq > 0 ? { deltaLiquid: Math.round(dLiq), actions: ['أضف 20–40 مل تدريجياً','راحة 15–20 دقيقة'] } : null
        },
        flags: { overrideApplied: false, caramelization: !!carOpt?.enabled }
      });
    }

    const heavyStickyWindow = hydration >= H.HEAVY_MIN && hydration < H.CRITICAL_HIGH;

    // Optimizer
    const result = findOptimalWorkPlan(recipe, { caramelization: carOpt, debug: !!options.debug });
    const planA = result.planA, planB = result.planB;
    const band = planA.band;
    const status = bandToStatus(band);
    const overrideApplied = !!result.flags.overrideApplied;

    // Heavy sticky Medovik — explanatory branch
    if (heavyStickyWindow) {
      const explanation = `
        <div style="margin:10px 0;padding:12px;background:#E3F2FD;border-right:3px solid #2196F3;border-radius:6px;">
          <div style="margin-bottom:8px;">
            <strong style="color:#1976D2;">💡 لماذا هذا طبيعي؟</strong>
          </div>
          <div style="font-size:0.9em;line-height:1.6;color:#555;">
            نطاق الرطوبة ${hydration.toFixed(1)}% (31–35%) شائع في الميدوفيك الروسي الأصيل — ليس فشلاً بل يمنح:
            <ul style="margin:6px 0 0 20px;">
              <li>طبقات رطبة ولامعة بعد النقع</li>
              <li>قوام طري يذوب في الفم</li>
              <li>نكهة عسل أعمق</li>
            </ul>
          </div>
        </div>
      `;
      return finalize({
        status: 'WAIT',
        severity: 'medium',
        message: 'ميدوفيك ثقيل لزج — حالة طبيعية للوصفات الروسية الكلاسيكية',
        explanation,
        actions: [
          '❄️ التبريد 20–30 دقيقة (يرفع اللزوجة 3–4 مرات)',
          '📄 الفرد: ورقتان + نثر دقيق خفيف جداً',
          '⏱️ السرعة: افرد بسرعة قبل أن تسخن العجينة',
          '⚖️ اختياري: أضف 10–20 جم دقيق إن بقيت لزجة جداً ثم أعد التبريد'
        ],
        hydration, band, T_opt: planA.T_opt, eta_opt: planA.eta_opt,
        plans: { planA, planB }, flags: { overrideApplied, caramelization: !!carOpt?.enabled }
      });
    }

    // Normal hydration
    let msg = '', actions = [];
    switch (band) {
      case 'too-wet':
        msg = 'العجين ثقيل لزج — يحتاج تبريد وتصحيح بسيط بالدقيق.';
        actions = ['اخفض الحرارة إلى 18–22°C','راحة/تبريد 15–25 دقيقة','افرد بين ورقتين مع نثر خفيف','أضف 10–20 جم دقيق إذا لزم'];
        break;
      case 'sticky':
        if (overrideApplied) {
          return finalize({
            status: 'GO',
            severity: 'low',
            message: 'تجاوز تشغيلي: دافئ وقابل للتشكيل — سيتماسك بعد التبريد.',
            actions: ['افرد الآن بسرعة مع نثر خفيف جداً','دع الطبقات ترتاح/تتبرد بعد الفرد'],
            hydration, band, T_opt: planA.T_opt, eta_opt: planA.eta_opt,
            plans: { planA, planB }, flags: { overrideApplied: true, caramelization: !!carOpt?.enabled }
          });
        }
        msg = 'العجين يميل للّصق — برّد قليلاً ثم افرد بين ورقتين.';
        actions = ['برّد 10–15 دقيقة','افرد بين ورقتين','أضف 10–20 جم دقيق عند الحاجة'];
        break;
      case 'optimal':
        msg = 'جاهز للفرد — قوام مثالي.';
        actions = ['افرد مباشرة','حافظ على وتيرة العمل لتجنّب السخونة الزائدة'];
        break;
      case 'stiff':
        msg = 'العجين قاسٍ قليلاً — ارفع حرارة العمل وأضف سوائل بسيطة عند الحاجة.';
        actions = ['ارفع حرارة العمل 28–34°C','راحة قصيرة 10 دقائق','أضف 20–30 مل سوائل دافئة إذا لزم'];
        break;
      default:
        msg = 'العجين قاسٍ جداً — أوقف العمل وأضف سوائل دافئة ثم اتركه يرتاح.';
        actions = ['أضف 50 مل سوائل دافئة','راحة 30 دقيقة','أعد القياس قبل الفرد'];
        break;
    }

    return finalize({
      status, severity: 'low', message: msg, actions,
      hydration, band, T_opt: planA.T_opt, eta_opt: planA.eta_opt,
      plans: { planA, planB }, flags: { overrideApplied, caramelization: !!carOpt?.enabled }
    });

    function finalize(payload) {
      const thresholds = {
        hydration: { high: H.CRITICAL_HIGH, heavyMin: H.HEAVY_MIN, low: H.CRITICAL_LOW },
        viscosity: {
          sticky: { min: CFG.VISCOSITY_BANDS.STICKY.min, max: CFG.VISCOSITY_BANDS.STICKY.max },
          optimal:{ min: CFG.VISCOSITY_BANDS.OPTIMAL.min, max: CFG.VISCOSITY_BANDS.OPTIMAL.max },
          stiff:  { min: CFG.VISCOSITY_BANDS.STIFF.min,   max: CFG.VISCOSITY_BANDS.STIFF.max }
        }
      };
      return {
        status: payload.status,
        message: payload.message,
        severity: payload.severity || undefined,
        explanation: payload.explanation || undefined,
        actions: payload.actions,
        details: {
          hydration: +payload.hydration.toFixed(1),
          viscosity: {
            T_opt: isFiniteNum(payload.T_opt) ? +(+payload.T_opt).toFixed(1) : null,
            eta_opt: isFiniteNum(payload.eta_opt) ? Math.round(payload.eta_opt) : null,
            band: payload.band
          },
          soda: sodaRatioInfo(recipe),
          plans: payload.plans,
          flags: payload.flags,
          thresholds
        }
      };
    }
  }

  // ---------------------- Diagnostics (public) ----------------------
  function evaluateAtTemperature(recipe, T, options = {}) {
    const carOpt = options.caramelization || Core.CONSTANTS.CONFIG.CARAMELIZATION;
    const vis = Core.ChemistryService.calculateDoughViscosity(recipe, T, {
      caramelization: carOpt, debug: !!options.debug
    });
    const eta = Math.max(0, Number(vis?.value) || 0);
    const band = mapViscosityBand(eta);
    const hydration = computeHydrationPercent(recipe);
    return {
      T: Math.round((T + Number.EPSILON) * 10) / 10,
      eta: Math.round(eta),
      band,
      hydration: +hydration.toFixed(1),
      components: vis?.components || undefined,
      caramelization: !!carOpt?.enabled
    };
  }

  function checkIntegration() {
    const hasCore = !!window.MedovikCalculatorCore;
    const hasVis = typeof window.MedovikCalculatorCore?.ChemistryService?.calculateDoughViscosity === 'function';
    const hasAnalysis = typeof window.MedovikCalculatorCore?.AnalysisService?.analyzeRecipe === 'function';
    const ok = hasCore && hasVis && hasAnalysis;
    return {
      ok,
      modules: { core: hasCore, viscosity: hasVis, analysis: hasAnalysis },
      message: ok ? 'ready' : 'missing-core-or-services'
    };
  }

  // ---------------------- Public export ----------------------
  Object.assign(MedovikMain, {
    CFG, // exposed for advanced UI panels (read-only convention)
    findOptimalWorkPlan,
    decideDough,
    evaluateAtTemperature,
    checkIntegration
  });

  window.MedovikMain = MedovikMain;

})(window, window.MedovikCalculatorCore);