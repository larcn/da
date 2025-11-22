// CORE.JS — Medovik Scientific Core (Physics-Pure)
// v3.0.0 (refactor): Physics-only core, no UI strings/DOM, decision-free.
// Notes:
// - Keep process-aware viscosity (Syrup→Emulsion→Dough), Brix, KD, F_net, Arrhenius,
//   Cp (tempering) and TRUE/BULK densities split.
// - Caramelization mode (T_pre / t_pre / evap) influences water pools and syrup base.
// - pH / aw estimators provided (codes and numeric only).
// - TemperingService: Cp-weighted batching model (EGG_TEMP_MAX=68°C).
// - ScalingService: TRUE_DENSITIES for volume/density.
// - Parser/Analysis utilities without UI strings.
// - Backward shim: DoughDecisionEngine logs console.warn('deprecated').
//
// Export: window.MedovikCalculatorCore = { CONSTANTS, ChemistryService, TemperingService, ScalingService, ParserService, AnalysisService, SecurityService, ValidationService, ... }
// Implementation policy:
//   - No UI/DOM access.
//   - No localized strings; use structured codes where needed.
//   - No decision mapping (GO/WAIT/STOP) here — done in main.js.

(function(window) {
  'use strict';

  // ============================== Core Meta ==============================
  const CORE_META = {
    name: 'MedovikCalculatorCore',
    version: '3.0.0',
    buildDate: '2025-11-21',
    changelog: [
      { version: '3.0.0', date: '2025-11-21', notes: 'Physics-only refactor; removed UI strings/decisions; kept scientific services; added deprecated shim for DoughDecisionEngine.' }
    ]
  };

  // ============================== CONSTANTS ==============================
  /**
   * Numeric-only constants and scientific thresholds.
   * No UI strings, only structured numeric config.
   */
  const CONSTANTS = {
    META: CORE_META,

    // (kept for analysis utilities; not for UI scoring here)
    SCIENTIFIC_RANGES: {
      flour:  { min: 48, max: 52, ideal: 50 },
      butter: { min: 10, max: 14, ideal: 12 },
      sugars: { min: 28, max: 33, ideal: 30.5 },
      eggs:   { min: 8,  max: 11, ideal: 9.5 },
      // internal total-only; soda display is flour-based in UI
      soda:   { min: 0.4, max: 0.8, ideal: 0.55 }
    },

    // Hydration model bases (mass fractions of water)
    HYDRATION: {
      EGG_WATER_CONTENT:   0.75,
      HONEY_WATER_CONTENT: 0.18,
      BUTTER_WATER_CONTENT:0.16
    },

    // Specific heat (J/g·K)
    SPECIFIC_HEAT: {
      EGG:    3.3,
      BUTTER: 2.1,
      SUGAR:  1.25,
      HONEY:  2.2,
      SODA:   0.9,
      LIQUID: 2.4 // fallback
    },

    // TRUE (intrinsic) densities for physics (g/cm³)
    TRUE_DENSITIES: {
      WATER: 1.000,
      FLOUR_TRUE: 1.55,  // [1.50..1.60]
      SUGAR_TRUE: 1.59,
      HONEY_TRUE: 1.42,
      BUTTER_TRUE: 0.911,
      EGGS_TRUE: 1.031
    },

    // BULK densities for cups parsing only
    BULK_DENSITIES: {
      FLOUR_BULK: 0.593,
      SUGAR_BULK: 0.85
    },

    // Legacy densities (kept for non-dough/filling items lookup)
    DENSITIES: {
      BUTTER: 0.911,
      HONEY:  1.420,
      EGGS:   1.031,
      SODA:   2.159,
      'GREEK_YOGURT_2': 1.03,
      'GREEK_YOGURT_5': 1.03,
      'GREEK_YOGURT_7': 1.02
    },

    // Average dough density (used by scaling), clamped 1.15–1.35 unless calibrated
    AVERAGE_DOUGH_DENSITY: 1.25,
    DEFAULT_AIR_FACTOR: 0.03,

    // Scientific thresholds (no UI strings)
    CONFIG: {
      VISCOSITY: {
        STICKY:  { min: 7000,  max: 12000 },
        OPTIMAL: { min: 12000, max: 20000 },
        STIFF:   { min: 20000, max: 30000 }
      },
      HYDRATION: {
        CRITICAL_HIGH: 35, // ≥35% STOP (requires correction upstream)
        MEDOVIK_HEAVY_LOWER: 31, // 31–<35% = “heavy sticky Medovik” (not failure)
        CRITICAL_LOW:  15
      },
      WORK: {
        // Default “classic window” for T_work suggestion (core only). Dynamic optimizer belongs to main.js.
        T_WORK_MIN: 35,
        T_WORK_MAX: 40,
        ETA_WORK_MIN: 12000,
        ETA_WORK_MAX: 20000
      },
      SAFETY: {
        ACID_SAFETY_PH: 4.6
      },
      HACCP: {
        EGG_TEMP_MAX: 68,  // °C
        FILLING_PH_MAX: 4.6
      },
      CARAMELIZATION: {
        enabled: false,
        T_pre: 108,   // °C in [105..110]
        t_pre: 2.0,   // min in [1.5..3.0]
        evap: 0.08    // fraction in [0.05..0.10] (from honey+butter water pools)
      }
    }
  };

  // ============================== Helpers: Density/Clamp ==============================
  const DensityHelper = {
    // Return TRUE density (g/cm³) for dough physics
    getTrue(name) {
      const T = CONSTANTS.TRUE_DENSITIES;
      const key = String(name).toLowerCase();
      if (key === 'water') return T.WATER;
      if (key === 'flour') return T.FLOUR_TRUE;
      if (key === 'sugar') return T.SUGAR_TRUE;
      if (key === 'honey') return T.HONEY_TRUE;
      if (key === 'butter') return T.BUTTER_TRUE;
      if (key === 'eggs' || key === 'egg') return T.EGGS_TRUE;
      return null;
    },
    // Return BULK density for cup parsing
    getBulk(name) {
      const B = CONSTANTS.BULK_DENSITIES;
      const key = String(name).toLowerCase();
      if (key === 'flour') return B.FLOUR_BULK;
      if (key === 'sugar') return B.SUGAR_BULK;
      return null;
    },
    clampDoughDensity(val) {
      return Math.min(1.35, Math.max(1.15, val));
    }
  };

  // ============================== Validation & Security ==============================
  /**
   * ValidationService: numeric validation and schema checks (no UI text).
   * Returns structured codes and numeric details only.
   */
  const ValidationService = {
    isPositiveNumber(value, min = 0, max = Infinity) {
      const num = Number(value);
      return Number.isFinite(num) && num >= min && num <= max;
    },

    /**
     * Validate dough recipe fields in grams.
     * @param {{flour:number,butter:number,sugar:number,honey:number,eggs:number,soda:number}} recipe
     * @returns {{valid:boolean, errors:Array<{code:string,field:string,min:number,max:number,value:number}>, warnings:Array<{code:string,data:any}>}}
     */
    validateRecipe(recipe) {
      const errors = [];
      const warnings = [];

      const schema = {
        flour:  { min: 0, max: 10000 },
        butter: { min: 0, max: 5000  },
        sugar:  { min: 0, max: 5000  },
        honey:  { min: 0, max: 5000  },
        eggs:   { min: 0, max: 5000  },
        soda:   { min: 0, max: 100   }
      };

      for (const [k, v] of Object.entries(recipe || {})) {
        if (schema[k] && !this.isPositiveNumber(v, schema[k].min, schema[k].max)) {
          errors.push({ code: 'INVALID_RANGE', field: k, min: schema[k].min, max: schema[k].max, value: Number(v) });
        }
      }

      // Soda advisory (flour-based %)
      if ((recipe?.flour || 0) > 0 && (recipe?.soda || 0) > 0) {
        const ratioPct = (recipe.soda / recipe.flour) * 100;
        if (ratioPct < 0.5) warnings.push({ code: 'SODA_LOW_PCT', data: { ratioPct } });
        if (ratioPct > 1.5) warnings.push({ code: 'SODA_HIGH_PCT', data: { ratioPct } });
        if (ratioPct > 1.0) warnings.push({ code: 'SODA_TASTE_RISK', data: { ratioPct } });
      }

      return { valid: errors.length === 0, errors, warnings };
    },

    validatePanDimensions(shape, dim1, dim2) {
      const errors = [];
      if (!this.isPositiveNumber(dim1, 10, 100)) errors.push({ code: 'DIM1_INVALID', data: { min: 10, max: 100 } });
      if (shape === 'rectangle' && !this.isPositiveNumber(dim2, 10, 100)) errors.push({ code: 'DIM2_INVALID', data: { min: 10, max: 100 } });
      return errors;
    },

    /**
     * Validate filling recipe map (ingredient->grams).
     * Returns structured codes only; no strings.
     */
    validateFillingRecipe(recipe) {
      const errors = [];
      const warnings = [];

      const total = Object.values(recipe || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      if (total === 0) return { valid: false, errors: [{ code: 'TOTAL_ZERO' }], warnings, stats: { totalWeight: 0 } };

      if (Object.values(recipe).some(v => (Number(v) || 0) < 0)) {
        return { valid: false, errors: [{ code: 'NEGATIVE_VALUE' }], warnings, stats: { totalWeight: total } };
      }

      // Allowed ingredients subset for legacy parsing (actual knowledge is in fillings-data.js)
      const allowed = new Set([
        'sour-cream','whipping-cream','cream-cheese','butter',
        'condensed-milk','dulce-de-leche','caramel','powdered-sugar',
        'sugar','milk','egg-yolks','vanilla','orange-zest',
        'greek-yogurt-2','greek-yogurt-5','greek-yogurt-7','honey',
        'mascarpone','cornstarch','lemon-juice','cocoa','heavy-cream'
      ]);
      const invalid = Object.keys(recipe).filter(k => (recipe[k] || 0) > 0 && !allowed.has(k));
      if (invalid.length > 0) errors.push({ code: 'UNKNOWN_INGREDIENTS', data: { list: invalid } });

      // Sweetness heuristic warning
      const sweets = ['powdered-sugar','sugar','condensed-milk','dulce-de-leche','honey','caramel'];
      const totalSweet = sweets.reduce((s, k) => s + (Number(recipe[k]) || 0), 0);
      const sweetPct = total > 0 ? (totalSweet / total) * 100 : 0;
      if (sweetPct > 40) warnings.push({ code: 'HIGH_SWEETNESS_PCT', data: { sweetPct } });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        stats: {
          totalWeight: total,
          sweetPercentage: +sweetPct.toFixed(1),
          ingredientCount: Object.keys(recipe).filter(k => (Number(recipe[k]) || 0) > 0).length
        }
      };
    },

    validateTemperingInputs(inputs) {
      const errors = [];
      const { eggMass, eggTemp, liquidMass, liquidTemp, batchCount } = inputs || {};
      if (!this.isPositiveNumber(eggMass, 1, 1000)) errors.push({ code: 'EGG_MASS_INVALID', range: [1,1000] });
      if (!this.isPositiveNumber(eggTemp, 0, 30)) errors.push({ code: 'EGG_TEMP_INVALID', range: [0,30] });
      if (!this.isPositiveNumber(liquidMass, 1, 5000)) errors.push({ code: 'LIQUID_MASS_INVALID', range: [1,5000] });
      if (!this.isPositiveNumber(liquidTemp, 60, 120)) errors.push({ code: 'LIQUID_TEMP_INVALID', range: [60,120] });
      if (!this.isPositiveNumber(batchCount, 2, 10)) errors.push({ code: 'BATCH_COUNT_INVALID', range: [2,10] });
      return errors;
    }
  };

  /**
   * SecurityService: input sanitation and numeric coercion (no strings).
   */
  const SecurityService = {
    sanitizeInput(value) {
      if (typeof value !== 'string') return value;
      return value.replace(/[<>]/g, '').substring(0, 1000);
    },
    sanitizeRecipe(recipe) {
      const out = {};
      for (const [k, v] of Object.entries(recipe || {})) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) out[k] = n;
      }
      return out;
    },
    validateRecipe: (recipe) => ValidationService.validateRecipe(recipe)
  };

  // ============================== Parser ==============================
  /**
   * ParserService: tolerant text parsing for dough recipes (AR/EN keywords).
   * Units: grams default; teaspoons/tablespoons for soda; cups for flour/sugar/honey.
   */
  const ParserService = {
    CONVERSIONS: {
      tsp: { soda: 4.6 },
      tbsp: { soda: 13.8 },
      cup: { flour: 120, sugar: 200, honey: 340 },
      eggWeight: 50
    },

    /**
     * Replace vulgar fractions and normalize Arabic numerals.
     */
    _normalize(text) {
      const replaceVulgarFractions = (s) => {
        const map = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1/3, '⅔': 2/3 };
        s = s.replace(/(\d+)\s*([½¼¾⅓⅔])/g, (_, d, f) => (Number(d) + map[f]).toString());
        s = s.replace(/([½¼¾⅓⅔])/g, (_, f) => map[f].toString());
        return s;
      };
      return replaceVulgarFractions(String(text || ''))
        .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
        .replace(/([0-9])[,،٫]([0-9])/g, '$1.$2')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    },

    /**
     * Parse free text to dough ingredients object.
     * @param {string} text
     * @returns {{flour:number,butter:number,sugar:number,honey:number,eggs:number,soda:number}}
     */
    parseRecipeText(text) {
      const normalizedText = this._normalize(text);
      const out = { flour:0, butter:0, sugar:0, honey:0, eggs:0, soda:0 };

      const keywords = {
        flour:  ['دقيق','طحين','flour'],
        butter: ['زبدة','زبد','butter'],
        sugar:  ['سكر','sugar'],
        honey:  ['عسل','honey'],
        eggs:   ['بيض','بيضة','بيضات','egg','eggs'],
        soda:   ['صودا','بيكربونات','بيكنج صودا','baking soda','bicarbonate']
      };

      const unitPatterns = {
        gram: '(?:جم|جرام|غرام|غ|g|gr|grs|gram|grams)',
        tsp: '(?:ملعقة صغيرة|ملاعق صغيرة|م\\.ص|tsp|teaspoon)',
        tbsp: '(?:ملعقة كبيرة|ملاعق كبيرة|م\\.ك|tbsp|tablespoon)',
        cup: '(?:كوب|أكواب|كأس|cup|cups)'
      };

      // grams / cups / spoons
      for (const [ing, keys] of Object.entries(keywords)) {
        for (const key of keys) {
          let found = false; let value = 0;
          let re = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.gram}\\s*${key}`, 'i');
          let m = normalizedText.match(re);

          if (!m) {
            re = new RegExp(`${key}\\s*:?\\s*(\\d*\\.?\\d+)\\s*${unitPatterns.gram}`, 'i');
            m = normalizedText.match(re);
          }
          if (m) { value = parseFloat(m[1]); found = true; }

          if (!found && ing === 'soda') {
            re = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.tsp}\\s*${key}`, 'i');
            m = normalizedText.match(re);
            if (m) { value = parseFloat(m[1]) * this.CONVERSIONS.tsp.soda; found = true; }
            if (!found) {
              re = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.tbsp}\\s*${key}`, 'i');
              m = normalizedText.match(re);
              if (m) { value = parseFloat(m[1]) * this.CONVERSIONS.tbsp.soda; found = true; }
            }
          }

          if (!found && this.CONVERSIONS.cup[ing]) {
            re = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.cup}\\s*${key}`, 'i');
            m = normalizedText.match(re);
            if (m) { value = parseFloat(m[1]) * this.CONVERSIONS.cup[ing]; found = true; }
          }

          if (found) { out[ing] = value; break; }
        }
      }

      // Eggs parsing by count when grams absent
      if (!out.eggs || out.eggs === 0) {
        const patterns = [
          /(\d*\.?\d+)\s*(?:بيضة|بيض|بيضات|egg|eggs)(?:\s|$)/i,
          /(?:بيض|بيضة|بيضات|egg|eggs)\s*:?\s*(\d*\.?\d+)(?:\s|$)/i,
          /(\d+(?:[,،٫]\d+)?)\s*(?:بيضة|بيض|بيضات)(?:\s|$)/i,
          /(?:بيض|بيضة)\s+(\d+(?:[,،٫]\d+)?)(?:\s|$)/i
        ];
        for (const p of patterns) {
          const m = normalizedText.match(p);
          if (m && m[1]) {
            const clean = m[1].replace(/[,،٫]/g,'.');
            const count = parseFloat(clean);
            if (count > 0 && count <= 20 && Number.isFinite(count)) {
              out.eggs = count * this.CONVERSIONS.eggWeight;
              break;
            }
          }
        }
      }

      return SecurityService.sanitizeRecipe(out);
    }
  };

  // ============================== Analysis Service ==============================
  /**
   * AnalysisService: numeric scientific analysis (no UI strings).
   * Provides composition percentages, hydration, basic range checks, and helpers.
   */
  const AnalysisService = {
    /**
     * Analyze dough recipe composition.
     * @param {{flour:number,butter:number,sugar:number,honey:number,eggs:number,soda:number}} recipe
     * @returns {{
     *  recipe: object,
     *  totalWeight: number,
     *  percentages: {flour:number,butter:number,sugar:number,honey:number,sugars:number,eggs:number,soda:number},
     *  checks: {flour:'low'|'optimal'|'high',butter:'low'|'optimal'|'high',sugars:'low'|'optimal'|'high',eggs:'low'|'optimal'|'high',soda:'low'|'optimal'|'high'},
     *  hydration: number,
     *  liquidWeight: number,
     *  qualityScore: number
     * }}
     */
    analyzeRecipe(recipe) {
      const validation = ValidationService.validateRecipe(recipe || {});
      if (!validation.valid) {
        return { error: { code: 'VALIDATION_FAILED', details: validation.errors } };
      }
      const r = Object.assign({ flour:0,butter:0,sugar:0,honey:0,eggs:0,soda:0 }, recipe);
      const total = Object.values(r).reduce((s, v) => s + (Number(v) || 0), 0);
      if (total === 0) return { error: { code: 'ZERO_TOTAL' } };

      const pct = {
        flour:  (r.flour / total) * 100,
        butter: (r.butter / total) * 100,
        sugar:  (r.sugar / total) * 100,
        honey:  (r.honey / total) * 100,
        sugars: ((r.sugar + r.honey) / total) * 100,
        eggs:   (r.eggs / total) * 100,
        soda:   (r.soda / total) * 100
      };

      const liquidWeight =
        r.eggs  * CONSTANTS.HYDRATION.EGG_WATER_CONTENT +
        r.honey * CONSTANTS.HYDRATION.HONEY_WATER_CONTENT +
        r.butter* CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
      const hydration = r.flour > 0 ? (liquidWeight / r.flour) * 100 : 0;

      const checks = {};
      let quality = 100;
      const ranges = CONSTANTS.SCIENTIFIC_RANGES;

      for (const comp of ['flour','butter','sugars','eggs','soda']) {
        const v = pct[comp];
        const range = ranges[comp];
        if (v < range.min) { checks[comp] = 'low';  quality -= 20; }
        else if (v > range.max) { checks[comp] = 'high'; quality -= 20; }
        else { checks[comp] = 'optimal'; }
      }

      return {
        recipe: r,
        totalWeight: total,
        percentages: {
          flour:+pct.flour, butter:+pct.butter, sugar:+pct.sugar, honey:+pct.honey,
          sugars:+pct.sugars, eggs:+pct.eggs, soda:+pct.soda
        },
        checks,
        hydration: +hydration,
        liquidWeight: +liquidWeight,
        qualityScore: Math.max(0, quality)
      };
    },

    /**
     * Compute numeric adjustments to move composition toward target ranges.
     * Positive delta = increase grams, Negative = decrease grams.
     * @param {ReturnType<AnalysisService.analyzeRecipe>} analysis
     * @returns {Record<string, number>}
     */
    computeRecipeAdjustment(analysis) {
      if (!analysis || analysis.error) return {};
      const { recipe, totalWeight } = analysis;
      const ranges = CONSTANTS.SCIENTIFIC_RANGES;
      const pct = k => (recipe[k] / totalWeight) * 100;
      const adj = {};

      // Flour
      if (pct('flour') < ranges.flour.min) {
        const target = (ranges.flour.min / 100) * totalWeight;
        adj.flour = Math.max(0, Math.round(target - recipe.flour));
      } else if (pct('flour') > ranges.flour.max) {
        const target = (ranges.flour.max / 100) * totalWeight;
        adj.flour = -Math.max(0, Math.round(recipe.flour - target));
      }
      // Sugars split across sugar + honey (favor sugar reduction first)
      if (pct('sugars') > ranges.sugars.max) {
        const sugarsNow = recipe.sugar + recipe.honey;
        const target = (ranges.sugars.max / 100) * totalWeight;
        const delta = Math.max(0, Math.round(sugarsNow - target));
        const reduceSugar = Math.min(delta, recipe.sugar);
        adj.sugar = -reduceSugar;
        if (delta > reduceSugar) adj.honey = -(delta - reduceSugar);
      }
      // Eggs
      if (pct('eggs') < ranges.eggs.min) {
        const target = (ranges.eggs.min / 100) * totalWeight;
        adj.eggs = Math.max(0, Math.round(target - recipe.eggs));
      } else if (pct('eggs') > ranges.eggs.max) {
        const target = (ranges.eggs.max / 100) * totalWeight;
        adj.eggs = -Math.max(0, Math.round(recipe.eggs - target));
      }
      // Butter
      if (pct('butter') < ranges.butter.min) {
        const target = (ranges.butter.min / 100) * totalWeight;
        adj.butter = Math.max(0, Math.round(target - recipe.butter));
      } else if (pct('butter') > ranges.butter.max) {
        const target = (ranges.butter.max / 100) * totalWeight;
        adj.butter = -Math.max(0, Math.round(recipe.butter - target));
      }
      // Soda (total-% based advisory)
      if (pct('soda') > ranges.soda.max) {
        const target = (ranges.soda.max / 100) * totalWeight;
        adj.soda = -Math.max(0, Math.round(recipe.soda - target));
      }
      return adj;
    },

    /**
     * Simulate baking effects (numeric-only).
     * @param {ReturnType<AnalysisService.analyzeRecipe>} analysis
     * @param {number} temp °C
     * @param {number} time minutes
     * @param {{thicknessMm?:number}} options
     * @returns {{
     *  browningIndex:number, moistureLoss:number, textureScore:number,
     *  params:{thickness:number,honeyShare:number,butterRatio:number},
     *  notes:{overBrownRisk:boolean, overDryRisk:boolean}
     * }}
     */
    simulateBaking(analysis, temp, time, options = {}) {
      if (!analysis || analysis.error) return null;
      const { recipe, percentages } = analysis;
      const rawThickness = options.thicknessMm ?? 3;
      const tmm = Math.max(1, rawThickness);

      const honeyShare = recipe.honey / Math.max(1, recipe.honey + recipe.sugar);
      const butterRatio = (percentages.butter || 0) / 100;

      // Simple kinetic proxies (numeric)
      const maillardRate = 0.005 * Math.exp((temp - 150) / 20);
      const sugarEffect = 1 + 0.4 * honeyShare;
      const sodaEffect = analysis.checks?.soda === 'high' ? 1.15 :
                         analysis.checks?.soda === 'low'  ? 0.85 : 1.0;
      const colorFactor = Math.pow(3 / tmm, 0.8);
      const browningIndex = 100 * (1 - Math.exp(-maillardRate * time * sugarEffect * sodaEffect * colorFactor));

      const moistureRate = 0.01 * Math.exp((temp - 100) / 30);
      const butterProtection = 1 - butterRatio * 0.5;
      const moistureThin = Math.pow(3 / tmm, 0.6);
      const thicknessDryness = tmm / 3;
      const moistureLossVal = analysis.hydration * (1 - Math.exp(-moistureRate * time)) * 0.3 * butterProtection / thicknessDryness;
      const moistureLoss = Math.max(0, Math.min(25, moistureLossVal * moistureThin));

      // Texture score purely numeric
      const textureScore = 100 - moistureLoss * 2 - Math.max(0, (temp - 190) * 0.5);

      return {
        browningIndex: Math.round(browningIndex),
        moistureLoss: +moistureLoss.toFixed(1),
        textureScore: Math.round(textureScore),
        params: {
          thickness: tmm,
          honeyShare: +(honeyShare * 100).toFixed(1),
          butterRatio: +(butterRatio * 100).toFixed(1)
        },
        notes: {
          overBrownRisk: browningIndex > 95,
          overDryRisk: textureScore < 60
        }
      };
    },

    /**
     * حساب جدول الخبز الأمثل بناءً على الوصفة وظروف الفرن
     */
    getBakingSchedule(analysis, options = {}) {
      if (!analysis || analysis.error) return null;
      
      const temp = options.temp || 180;
      const thickness = options.thicknessMm || 3;
      const diameter = options.diameterCm || 24;
      
      // عامل السماكة (أكثر سماكة = وقت أطول)
      const thicknessFactor = Math.pow(thickness / 3, 0.8);
      
      // عامل العسل (أكثر عسل = احتراق أسرع)
      const honeyPct = analysis.percentages?.honey || 0;
      const honeyFactor = 1 - (honeyPct / 100) * 0.15; // تخفيض 15% للعسل العالي
      
      // عامل الصودا (أكثر صودا = احتراق أسرع)
      const sodaPct = analysis.percentages?.soda || 0;
      const sodaFactor = sodaPct > 0.6 ? 0.9 : 1.0;
      
      // حساب الوقت الأساسي بناءً على الحرارة
      let baseTime;
      if (temp <= 160) baseTime = 10;
      else if (temp <= 180) baseTime = 7;
      else if (temp <= 200) baseTime = 5;
      else baseTime = 4;
      
      const recommended = Math.round(
        baseTime * thicknessFactor * honeyFactor * sodaFactor
      );
      
      return {
        temp: temp,
        recommended: Math.max(4, recommended),
        range: { 
          min: Math.max(4, recommended - 2), 
          max: recommended + 2 
        },
        cues: [
          honeyPct > 15 ? 'راقب اللون بعناية - العسل يحترق سريعاً' : 'الحواف ذهبية فاتحة',
          'المركز لا يهتز عند لمسه',
          thickness > 4 ? 'اختبر بعود خشبي في المركز' : 'رائحة عسل خفيفة'
        ]
      };
    }
  };

  // ============================== Tempering Service ==============================
  /**
   * TemperingService: Cp-weighted batching and safety helpers (numeric-only).
   */
  const TemperingService = {
    /**
     * Distribution array for N batches (percent per batch sums to 100).
     * @param {number} count
     * @returns {number[]}
     */
    getBatchDistribution(count) {
      let n = Math.max(2, Math.min(10, Number(count) || 5));
      if (n === 2) return [40.00, 60.00];

      const base = 100 / n;
      const arr = Array.from({ length: n }, (_, i) =>
        i === 0 ? base * 0.8 : (i === n - 1 ? base * 1.1 : base)
      );
      const sum = arr.reduce((a, b) => a + b, 0);
      const raw = arr.map(p => (p * 100) / sum);
      const centsRaw = raw.map(p => p * 100);
      const cents = centsRaw.map(x => Math.floor(x));
      let deficit = 10000 - cents.reduce((a, b) => a + b, 0);
      const frac = centsRaw.map((x, i) => ({ i, f: x - Math.floor(x) }))
                           .sort((a, b) => b.f - a.f);
      let k = 0;
      while (deficit > 0) {
        cents[frac[k % frac.length].i] += 1;
        deficit--;
        k++;
      }
      return cents.map(c => +(c / 100).toFixed(2));
    },

    /**
     * Compute effective Cp of liquid mixture by weights (J/g·K).
     * @param {{butter?:number,sugar?:number,honey?:number,soda?:number}} masses
     * @returns {number}
     */
    getLiquidCp(masses) {
      const C = CONSTANTS.SPECIFIC_HEAT;
      const butter = Math.max(0, masses?.butter || 0);
      const sugar  = Math.max(0, masses?.sugar  || 0);
      const honey  = Math.max(0, masses?.honey  || 0);
      const soda   = Math.max(0, masses?.soda   || 0);
      const total  = butter + sugar + honey + soda;
      if (total <= 0) return C.LIQUID;
      const weighted =
        (butter * C.BUTTER + sugar * C.SUGAR + honey * C.HONEY + soda * C.SODA) / total;
      return weighted;
    },

    /**
     * Calculate tempering batches and temperatures (numeric-only).
     * @param {number} eggMass g
     * @param {number} eggTemp °C
     * @param {number} liquidMass g
     * @param {number} liquidTemp °C
     * @param {number} batchCount
     * @param {{butter?:number,sugar?:number,honey?:number,soda?:number}} [liquidBreakdown]
     * @returns {{
     *  batches: Array<{batchNumber:number,percentage:number,tempBefore:number,tempAfter:number}>,
     *  finalTemp:number, maxBatchTemp:number, criticalBatch:number|null,
     *  safety:{status:'safe'|'warning'|'danger', eggLimit:number}, liquidCp:number
     * }|{error:{code:string,details?:any}}}
     */
    calculateOptimalBatches(eggMass, eggTemp, liquidMass, liquidTemp, batchCount, liquidBreakdown = null) {
      const invalids = ValidationService.validateTemperingInputs({ eggMass, eggTemp, liquidMass, liquidTemp, batchCount });
      if (invalids.length > 0) {
        return { error: { code: 'VALIDATION_FAILED', details: invalids } };
      }

      const C_EGG = CONSTANTS.SPECIFIC_HEAT.EGG;
      const C_LIQ = liquidBreakdown ? this.getLiquidCp(liquidBreakdown) : CONSTANTS.SPECIFIC_HEAT.LIQUID;

      const batches = [];
      const dist = this.getBatchDistribution(batchCount);
      let curMass = eggMass;
      let curTemp = eggTemp;
      let maxTemp = eggTemp;
      let critBatch = null;

      dist.forEach((p, idx) => {
        const bMass = (p / 100) * liquidMass;
        const totalE = curMass * C_EGG * curTemp + bMass * C_LIQ * liquidTemp;
        const totalC = curMass * C_EGG + bMass * C_LIQ;
        const newTemp = totalE / Math.max(1e-9, totalC);

        batches.push({
          batchNumber: idx + 1,
          percentage: +p,
          tempBefore: +curTemp.toFixed(1),
          tempAfter: +newTemp.toFixed(1)
        });

        if (newTemp > maxTemp) {
          maxTemp = newTemp;
          critBatch = idx + 1;
        }
        curMass += bMass;
        curTemp = newTemp;
      });

      const finalTemp = batches[batches.length - 1]?.tempAfter ?? curTemp;
      // Safety status compared to HACCP limit
      const limit = CONSTANTS.CONFIG.HACCP.EGG_TEMP_MAX;
      let status = 'safe';
      if (maxTemp > limit) status = 'danger';
      else if (maxTemp > 65) status = 'warning';

      return {
        batches,
        finalTemp,
        maxBatchTemp: +maxTemp.toFixed(1),
        criticalBatch: critBatch,
        safety: { status, eggLimit: limit },
        liquidCp: +C_LIQ.toFixed(2)
      };
    },

    // Utility calculators
    maxHotMassForTarget(m0, T0, tHot, Ttarget, liquidCpOverride = null) {
      const c0 = CONSTANTS.SPECIFIC_HEAT.EGG;
      const cHot = liquidCpOverride || CONSTANTS.SPECIFIC_HEAT.LIQUID;
      if (tHot <= Ttarget) return null;
      if (Ttarget <= T0) return 0;
      const val = (m0 * c0 * (Ttarget - T0)) / (cHot * (tHot - Ttarget));
      return Number.isFinite(val) ? val : null;
    },
    maxHotTempForTarget(m0, T0, mHot, Ttarget, liquidCpOverride = null) {
      const c0 = CONSTANTS.SPECIFIC_HEAT.EGG;
      const cHot = liquidCpOverride || CONSTANTS.SPECIFIC_HEAT.LIQUID;
      if (mHot <= 0) return null;
      const res = (Ttarget * (m0 * c0 + mHot * cHot) - m0 * c0 * T0) / (mHot * cHot);
      return Number.isFinite(res) ? Math.max(T0, res) : null;
    },
    neededEggIncrease(eggMass, eggTemp, liquidMass, liquidTemp, Ttarget, liquidCpOverride = null) {
      const cEgg = CONSTANTS.SPECIFIC_HEAT.EGG;
      const cLiq = liquidCpOverride || CONSTANTS.SPECIFIC_HEAT.LIQUID;
      if (Ttarget <= eggTemp || liquidTemp <= Ttarget) return 0;
      const needTotalEgg = (liquidMass * cLiq * (liquidTemp - Ttarget)) / (cEgg * (Ttarget - eggTemp));
      return Math.max(0, needTotalEgg - eggMass);
    }
  };

  // ============================== Scaling Service ==============================
  /**
   * ScalingService: density and coverage computations (numeric-only).
   * Calibrated density storage is not handled here (no localStorage).
   */
  const ScalingService = {
    /**
     * Effective dough density using TRUE densities and simple air factor model.
     * @param {object} recipe
     * @param {number|null} userAirFactor
     * @returns {number} g/cm³ clamped 1.15–1.35
     */
    calculateEffectiveDensity(recipe, userAirFactor = null) {
      const TD = CONSTANTS.TRUE_DENSITIES;
      let solidVolume = 0;
      const totalMass = Object.values(recipe || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      if (totalMass === 0) return CONSTANTS.AVERAGE_DOUGH_DENSITY;

      for (const [comp, massRaw] of Object.entries(recipe)) {
        const m = Number(massRaw) || 0; if (m <= 0) continue;
        let rho = null;
        switch (comp) {
          case 'flour':  rho = TD.FLOUR_TRUE; break;
          case 'sugar':  rho = TD.SUGAR_TRUE; break;
          case 'honey':  rho = TD.HONEY_TRUE; break;
          case 'butter': rho = TD.BUTTER_TRUE; break;
          case 'eggs':   rho = TD.EGGS_TRUE; break;
          default: {
            const key = String(comp).toUpperCase().replace(/-/g, '_');
            rho = CONSTANTS.DENSITIES[key] || null;
            break;
          }
        }
        if (typeof rho === 'number' && rho > 0) {
          solidVolume += m / rho;
        }
      }
      const airFactor = userAirFactor ?? CONSTANTS.DEFAULT_AIR_FACTOR;
      if (solidVolume <= 0) return CONSTANTS.AVERAGE_DOUGH_DENSITY;
      const raw = totalMass / (solidVolume / (1 - airFactor));
      return DensityHelper.clampDoughDensity(raw);
    },

    /**
     * Pan area in cm²
     */
    getPanArea(shape, dim1, dim2 = null) {
      if (shape === 'round') return Math.PI * Math.pow(dim1 / 2, 2);
      if (shape === 'rectangle' && dim2) return dim1 * dim2;
      return 0;
    },

    /**
     * Predict single-layer raw weight (g).
     * @param {number} density g/cm³
     * @param {number} area cm²
     * @param {number} thicknessMm mm
     */
    calculateSingleLayerWeight(density, area, thicknessMm) {
      const t = Math.max(1, thicknessMm) / 10; // cm
      return density * area * t;
    },

    /**
     * Given total dough mass, estimate number of layers and coverage.
     * @param {number} totalMass g
     * @param {number} density g/cm³
     * @param {number} area cm²
     * @param {number} thicknessMm
     */
    predictLayers(totalMass, density, area, thicknessMm) {
      const single = this.calculateSingleLayerWeight(density, area, thicknessMm);
      const num = single > 0 ? Math.floor(totalMass / single) : 0;
      const coverage = num * single;
      return {
        singleLayerWeight: single,
        numLayers: num,
        totalCoverage: coverage,
        remainder: totalMass - coverage
      };
    }
  };

  // ============================== Chemistry Service ==============================
  /**
   * ChemistryService: process-aware viscosity, Brix, pH, aw, and helpers.
   * No UI strings; all numeric or code fields only.
   */
  const ChemistryService = {
    _VISCOSITY_PARAMS: {
      // Krieger–Dougherty
      phiM: 0.60,
      intrinsic: 2.5,

      // Flour water absorption (short dough)
      wAbs: 0.16,

      // Sugar binding to water
      sugarBindSuc: 0.025,
      sugarBindInv: 0.035,

      // Thermal sensitivity
      kT: 0.045,     // syrup Arrhenius-like
      kTFat: 0.025,  // melted butter

      // Packing softening
      kFat: 0.20,
      kSugar: 0.10,

      // Structural network factor
      betaNet: 0.60,
      sSugar: 0.75,
      sFat: 0.50,
      sEgg: 0.15,

      // Ref fat viscosity (@40°C ~ 50 cP)
      etaFatRef40C: 50,

      // Guards
      denomGuard: 1e-9,
      etaCap: 300000,

      tref: 25
    },

    // Caramelization: adjust available water pools from honey+butter
    _applyCaramelization(recipe, options) {
      const cfgGlobal = CONSTANTS.CONFIG.CARAMELIZATION;
      const cfg = Object.assign({}, cfgGlobal, options?.caramelization || {});
      const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

      cfg.T_pre = clamp(cfg.T_pre, 105, 110);
      cfg.t_pre = clamp(cfg.t_pre, 1.5, 3.0);
      cfg.evap = clamp(cfg.evap, 0.05, 0.10);

      if (!cfg.enabled) {
        return { enabled: false, evap: 0, waterRemovedHoney: 0, waterRemovedButter: 0 };
      }
      const wHoney = (recipe.honey || 0) * CONSTANTS.HYDRATION.HONEY_WATER_CONTENT;
      const wButter= (recipe.butter|| 0) * CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
      const waterRemovedHoney = wHoney * cfg.evap;
      const waterRemovedButter = wButter * cfg.evap;
      return {
        enabled: true,
        evap: cfg.evap,
        T_pre: cfg.T_pre,
        t_pre: cfg.t_pre,
        waterRemovedHoney,
        waterRemovedButter
      };
    },

    _etaSyrup25(B) {
      const T = [
        { B: 30, eta: 2.0 },
        { B: 40, eta: 3.0 },
        { B: 50, eta: 9.0 },
        { B: 60, eta: 35.0 },
        { B: 65, eta: 110.0 },
        { B: 70, eta: 400.0 },
        { B: 75, eta: 1500.0 }
      ];
      if (B <= T[0].B) return T[0].eta;
      if (B >= T[T.length-1].B) return T[T.length-1].eta;
      for (let i = 0; i < T.length-1; i++) {
        const a = T[i], b = T[i+1];
        if (B >= a.B && B <= b.B) {
          const t = (B - a.B) / (b.B - a.B);
          return a.eta + t * (b.eta - a.eta);
        }
      }
      return 10.0;
    },

    _etaFatT(T, params) {
      const { etaFatRef40C, kTFat } = params;
      return Math.max(5, etaFatRef40C * Math.exp(-kTFat * (T - 40)));
    },

    _computeBrixAndFreeWater(recipe, T, options) {
      const P = this._VISCOSITY_PARAMS;
      const N = v => Math.max(0, +v || 0);

      const flour = N(recipe.flour);
      const butter = N(recipe.butter);
      const sugar  = N(recipe.sugar);
      const honey  = N(recipe.honey);
      const eggs   = N(recipe.eggs);

      // مسابح الماء
      let wEggs   = eggs  * CONSTANTS.HYDRATION.EGG_WATER_CONTENT;
      let wHoney, wButter;

      if (recipe._prePools && typeof recipe._prePools.wHoney === 'number' && typeof recipe._prePools.wButter === 'number') {
        // استخدم القيم المعدّلة مسبقاً
        wHoney  = Math.max(0, recipe._prePools.wHoney);
        wButter = Math.max(0, recipe._prePools.wButter);
      } else {
        // احسب من الصفر + ممكن تطبيق الكرملة هنا فقط
        wHoney  = honey * CONSTANTS.HYDRATION.HONEY_WATER_CONTENT;
        wButter = butter* CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
        const car = this._applyCaramelization({ honey, butter }, options);
        if (car.enabled) {
          wHoney  = Math.max(0, wHoney  - car.waterRemovedHoney);
          wButter = Math.max(0, wButter - car.waterRemovedButter);
        }
      }

      const waterPool = wEggs + wHoney + wButter;

      // Sugar species
      const sucrose = sugar;
      const invert  = 0.82 * honey;

      // Flour absorption occurs in dough phase; wAbsPhase may override
      const wAbsPhase = options?.wAbsPhase ?? 0.0;
      const boundFlour = Math.min(waterPool, flour * wAbsPhase);

      const residWater = Math.max(P.denomGuard, waterPool - boundFlour);
      const boundSug   = Math.min(residWater * 0.6, P.sugarBindSuc * sucrose + P.sugarBindInv * invert);
      const freeWater  = Math.max(P.denomGuard, residWater - boundSug);

      const sugarInAq = sucrose + invert;
      const brix = sugarInAq <= 0 ? 0 : (100 * sugarInAq / (sugarInAq + freeWater));

      return {
        brix,
        freeWater,
        pools: { wEggs, wHoney, wButter },
        sugarInAq, sucrose, invert,
        car: (options?.caramelization?.enabled ? { enabled: true } : { enabled: false })
      };
    },

    _logMix(etaAq, etaFat, volAq, volFat) {
      const g = 1e-9;
      const vTot = Math.max(g, volAq + volFat);
      const phiAq = Math.max(0, Math.min(1, volAq / vTot));
      const phiFat= 1 - phiAq;
      const lnEta = phiAq * Math.log(Math.max(1, etaAq)) + phiFat * Math.log(Math.max(1, etaFat));
      return Math.exp(lnEta);
    },

    calculateDoughViscosity(recipe, temperature = 25, options = {}) {
      try {
        const P = Object.assign({}, this._VISCOSITY_PARAMS);
        const N = v => Math.max(0, +v || 0);

        const flour = N(recipe.flour), butter = N(recipe.butter),
              sugar  = N(recipe.sugar),  honey  = N(recipe.honey),
              eggs   = N(recipe.eggs),   soda   = N(recipe.soda);

        const TD = CONSTANTS.TRUE_DENSITIES;

        // Phase 1) Syrup (butter+honey+sugar, before eggs)
        const syrupPhase = this._computeBrixAndFreeWater(
          { flour: 0, butter, sugar, honey, eggs: 0 },
          temperature,
          { caramelization: options.caramelization, wAbsPhase: 0.0 }
        );

        // حفظ مسابح الماء بعد الكرملة لنستخدمها في Phase 3
        const prePools = {
          wHoney: syrupPhase.pools.wHoney,
          wButter: syrupPhase.pools.wButter
        };

        // Syrup viscosity at T
        const etaAq25 = this._etaSyrup25(syrupPhase.brix);
        const etaAqT  = etaAq25 * Math.exp(-P.kT * (temperature - 25));
        const etaFatT = this._etaFatT(temperature, P);

        // Volume fractions of aqueous and fat pools (TRUE densities)
        const volAq =
          (syrupPhase.freeWater / TD.WATER) +
          (sugar / TD.SUGAR_TRUE) +
          (honey / TD.HONEY_TRUE);
        const volFat = butter / TD.BUTTER_TRUE;

        const eta0_syrup = this._logMix(etaAqT, etaFatT, volAq, volFat);

        // Phase 2) Emulsion (after eggs): temperature shift due to tempering
        const eggTemp = options.eggsTemp ?? 20;
        const liquidBreakdown = { butter, sugar, honey, soda };
        const C_liq = TemperingService.getLiquidCp(liquidBreakdown);
        const C_egg = CONSTANTS.SPECIFIC_HEAT.EGG;

        const mLiq = butter + sugar + honey + soda;
        const mEgg = eggs;
        let T_emul = temperature;
        if (mEgg > 0 && mLiq > 0) {
          const totE = mLiq * C_liq * temperature + mEgg * C_egg * eggTemp;
          const totC = mLiq * C_liq + mEgg * C_egg;
          T_emul = totE / Math.max(P.denomGuard, totC);
        }

        const etaAqT_emul = etaAq25 * Math.exp(-P.kT * (T_emul - 25));
        const etaFatT_emul = this._etaFatT(T_emul, P);
        const eta0_emul = this._logMix(etaAqT_emul, etaFatT_emul, volAq + (eggs * 0.001/TD.EGGS_TRUE), volFat);

        // Emulsification tightening factor K_egg: mild increase
        const eggFrac = (mEgg) / Math.max(P.denomGuard, (mEgg + mLiq + flour));
        const K_egg = 1 + 0.05 + 0.10 * Math.min(0.20, eggFrac) / 0.20; // 1.05–1.15
        const eta0_afterEggs = Math.min(P.etaCap, eta0_emul * K_egg);

        // Phase 3) Dough (after flour): adjust water with absorption and sugar binding again
        // استخدام مسابح الماء المعدلة من Phase 1 وتعطيل الكرملة هنا
        const doughPhase = this._computeBrixAndFreeWater(
          { 
            flour, 
            butter, 
            sugar, 
            honey, 
            eggs,
            _prePools: prePools  // تمرير المسابح المعدلة مسبقاً
          },
          T_emul,
          { 
            caramelization: { enabled: false }, // تعطيل الكرملة في Phase 3
            wAbsPhase: P.wAbs 
          }
        );
        const etaAq25_new = this._etaSyrup25(doughPhase.brix);
        const etaAqT_new  = etaAq25_new * Math.exp(-P.kT * (T_emul - 25));
        const etaFatT_new = this._etaFatT(T_emul, P);

        const volAq_new =
          (doughPhase.freeWater / TD.WATER) +
          (sugar / TD.SUGAR_TRUE) +
          (honey / TD.HONEY_TRUE) +
          (eggs * CONSTANTS.HYDRATION.EGG_WATER_CONTENT / TD.EGGS_TRUE);
        const volFat_new = butter / TD.BUTTER_TRUE;
        const volFlour   = flour / TD.FLOUR_TRUE;
        const volMatrix  = Math.max(P.denomGuard, volAq_new + volFat_new + volFlour);

        const eta0_new = this._logMix(etaAqT_new, etaFatT_new, volAq_new, volFat_new);

        // Krieger–Dougherty (effective packing)
        const phi = volFlour / volMatrix;
        const fFat = (butter) / Math.max(P.denomGuard, (flour + butter + sugar + honey + eggs + soda));
        const fSug = (sugar + honey) / Math.max(P.denomGuard, (flour + butter + sugar + honey + eggs + soda));
        let phiEff = phi * (1 - P.kFat * fFat - P.kSugar * fSug);
        phiEff = Math.max(0, Math.min(P.phiM * 0.98, phiEff));

        const kdPow = P.intrinsic * P.phiM;
        const oneMinus = Math.max(0.05, 1 - (phiEff / P.phiM));
        const etaRel = Math.pow(oneMinus, -kdPow);

        // Structural network factor F_net (hydration-centered strength)
        const waterMass =
          eggs  * CONSTANTS.HYDRATION.EGG_WATER_CONTENT +
          honey * CONSTANTS.HYDRATION.HONEY_WATER_CONTENT +
          butter* CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;
        const hydration = flour > 0 ? (waterMass / flour) * 100 : 0;

        const peak = 24; // %
        const sigma = 3; // ~22–26% peak band
        const gHyd = Math.exp(-Math.pow((hydration - peak) / sigma, 2) / 2);

        const sugarNorm = Math.min(1, doughPhase.brix / 80);
        const fatNorm   = Math.min(1, fFat / 0.20);
        const eggNorm   = Math.min(1, (eggs / Math.max(P.denomGuard, flour + butter + sugar + honey + eggs)) / 0.15);

        const netStrength = Math.max(0, gHyd * (1 - P.sSugar * sugarNorm) * (1 - P.sFat * fatNorm) + P.sEgg * eggNorm);
        const F_net = 1 + P.betaNet * netStrength;

        const eta_base = Math.min(P.etaCap, eta0_new * etaRel * F_net);

        // Work target inside the classic T_work window [35..40]°C (dynamic optimizer lives in main.js)
        const workCfg = CONSTANTS.CONFIG.WORK;
        const TworkMin = workCfg.T_WORK_MIN;
        const TworkMax = workCfg.T_WORK_MAX;

        const computeAtT = (T) => {
          const etaAqT_w  = this._etaSyrup25(doughPhase.brix) * Math.exp(-P.kT * (T - 25));
          const etaFatT_w = this._etaFatT(T, P);
          const eta0_w    = this._logMix(etaAqT_w, etaFatT_w, volAq_new, volFat_new);
          const eta_w     = Math.min(P.etaCap, eta0_w * etaRel * F_net);
          return eta_w;
        };

        let bestTwork = TworkMin;
        let etaWorkAtBest = computeAtT(bestTwork);
        const targetMin = workCfg.ETA_WORK_MIN;
        const targetMax = workCfg.ETA_WORK_MAX;
        const targetMid = Math.sqrt(targetMin * targetMax);

        let bestScore = Math.abs(Math.log(etaWorkAtBest / targetMid));
        for (let T = TworkMin; T <= TworkMax; T += 0.5) {
          const etaT = computeAtT(T);
          const score = Math.abs(Math.log(etaT / targetMid));
          if (score < bestScore) {
            bestScore = score;
            bestTwork = T;
            etaWorkAtBest = etaT;
          }
        }

        const components = {
          'η0_syrup' : Math.round(eta0_syrup),
          'η0_emul'  : Math.round(eta0_emul),
          'K_egg'    : +K_egg.toFixed(3),
          'η0_new'   : Math.round(eta0_new),
          'η_rel'    : +etaRel.toFixed(2),
          'F_net'    : +F_net.toFixed(2),
          'φ'        : +phi.toFixed(3),
          'φ_eff'    : +phiEff.toFixed(3),
          brix       : +doughPhase.brix.toFixed(1),
          hydration  : +hydration.toFixed(1)
        };

        const debug = !!options.debug;
        const debugData = debug ? {
          syrup: {
            brix: +syrupPhase.brix.toFixed(1),
            freeWater: +syrupPhase.freeWater.toFixed(3)
          },
          emulsion: {
            T_emul: +T_emul.toFixed(2),
            etaAqT_emul: Math.round(etaAqT_emul),
            etaFatT_emul: Math.round(etaFatT_emul)
          },
          dough: {
            brix_new: +doughPhase.brix.toFixed(1),
            freeWater: +doughPhase.freeWater.toFixed(3),
            etaAqT_new: Math.round(etaAqT_new),
            etaFatT_new: Math.round(etaFatT_new)
          },
          car: syrupPhase.car?.enabled ? {
            enabled: true,
            evap: syrupPhase.car.evap,
            T_pre: syrupPhase.car.T_pre,
            t_pre: syrupPhase.car.t_pre
          } : { enabled: false }
        } : undefined;

        const etaValue = Math.round(eta_base);
        return {
          value: etaValue,
          temperature,
          components,
          workTarget: {
            T_work: Math.round(bestTwork * 10) / 10,
            eta_work: Math.round(etaWorkAtBest),
            targetRange: { min: targetMin, max: targetMax }
          },
          debug: debugData
        };
      } catch (e) {
        return { value: 0, temperature, error: { code: 'VISCOSITY_ERROR', message: e?.message || 'unknown' } };
      }
    },

    // -------------------- Simple sugar metrics and water activity --------------------
    /**
     * Estimate Brix (rough) as sugar mass fraction × 100.
     * @param {object} recipe
     * @param {boolean} isDough
     * @returns {{value:number, band:'low'|'ideal'|'high'|'very-high'}}
     */
    estimateBrix(recipe, isDough = true) {
      const sugarContent = {
        flour: 0.01, sugar: 1.00, honey: 0.82, butter: 0.001, eggs: 0.01, soda: 0.00,
        'sour-cream': 0.04, 'whipping-cream': 0.03, 'cream-cheese': 0.041,
        'condensed-milk': 0.544, 'dulce-de-leche': 0.554, 'caramel': 0.685,
        'powdered-sugar': 1.00, 'milk': 0.05, 'egg-yolks': 0.01,
        'greek-yogurt-2': 0.040, 'greek-yogurt-5': 0.038, 'greek-yogurt-7': 0.036
      };
      let totalSugar = 0, totalWeight = 0;
      for (const [ing, wRaw] of Object.entries(recipe || {})) {
        const w = Number(wRaw) || 0;
        totalSugar += w * (sugarContent[ing] || 0);
        totalWeight += w;
      }
      if (totalWeight === 0) return { value: 0, band: 'unknown' };
      const brix = (totalSugar / totalWeight) * 100;

      // band codes only (UI maps to strings)
      let band;
      if (isDough) {
        if (brix < 25) band = 'low';
        else if (brix < 35) band = 'ideal';
        else if (brix < 45) band = 'high';
        else band = 'very-high';
      } else {
        if (brix < 10) band = 'low';
        else if (brix < 15) band = 'mid-low';
        else if (brix < 25) band = 'mid';
        else if (brix < 35) band = 'high';
        else if (brix < 45) band = 'very-high';
        else band = 'extreme';
      }
      return { value: +brix.toFixed(1), band };
    },

    /**
     * Estimate water activity proxy (0..1) from crude composition.
     * @param {object} recipe
     * @returns {{value:number, band:'very-low'|'low'|'medium'|'high'}}
     */
    estimateWaterActivity(recipe) {
      const waterContent = {
        'whipping-cream': 0.60, 'sour-cream': 0.72, 'cream-cheese': 0.55,
        'butter': 0.16, 'condensed-milk': 0.27, 'dulce-de-leche': 0.20,
        'caramel': 0.15, 'powdered-sugar': 0.005, 'sugar': 0.005,
        'milk': 0.87, 'egg-yolks': 0.50, 'honey': 0.18,
        'greek-yogurt-2': 0.84, 'greek-yogurt-5': 0.80, 'greek-yogurt-7': 0.78,
        'flour': 0.12, 'eggs': 0.75
      };

      let totalWater = 0, totalSolutes = 0, totalWeight = 0;
      for (const [ing, wRaw] of Object.entries(recipe || {})) {
        const w = Number(wRaw) || 0;
        totalWater += w * (waterContent[ing] || 0);
        if (['condensed-milk','dulce-de-leche','caramel','powdered-sugar','sugar','honey'].includes(ing)) {
          totalSolutes += w * 0.6;
        }
        totalWeight += w;
      }
      if (totalWeight === 0) return { value: 0, band: 'unknown' };

      const moleFractionWater = totalWater / (totalWater + totalSolutes * 0.003);
      const awRaw = moleFractionWater * 0.99;
      const aw = Math.min(1.0, Math.max(0.3, awRaw));

      let band;
      if (aw > 0.95) band = 'high';
      else if (aw > 0.90) band = 'medium';
      else if (aw > 0.85) band = 'low';
      else band = 'very-low';

      return { value: +aw.toFixed(3), band };
    },

    /**
     * Optional advanced aw model (Norrish-like sucrose/water).
     * @param {object} recipe
     * @returns {{value:number, band:string, model:'Norrish-like'}}
     */
    estimateWaterActivityAdvanced(recipe) {
      try {
        const N = v => Math.max(0, +v || 0);
        const waterMass =
          N(recipe.eggs)  * CONSTANTS.HYDRATION.EGG_WATER_CONTENT +
          N(recipe.honey) * CONSTANTS.HYDRATION.HONEY_WATER_CONTENT +
          N(recipe.butter)* CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT;

        const sucroseMass = N(recipe.sugar) + 0.82 * N(recipe.honey);
        const Mw = 18.015;
        const Ms = 342.296;

        const nw = waterMass / Mw;
        const ns = sucroseMass / Ms;
        if ((nw + ns) <= 0) return this.estimateWaterActivity(recipe);

        const k_s = 1.4;
        const xw = nw / (nw + ns);
        const xs = ns / (nw + ns);
        let awEst = xw / Math.max(1e-9, (xw + k_s * xs));
        awEst = Math.min(1.0, Math.max(0.3, awEst));

        let band;
        if (awEst > 0.95) band = 'high';
        else if (awEst > 0.90) band = 'medium';
        else if (awEst > 0.85) band = 'low';
        else band = 'very-low';

        return { value: +awEst.toFixed(3), band, model: 'Norrish-like' };
      } catch {
        return this.estimateWaterActivity(recipe);
      }
    },

    /**
     * Estimate pH via weighted mixing and buffer capacity (numeric/codes only).
     * @param {object} recipe
     * @param {boolean} isDough
     * @returns {{value:number, band:'very-acid'|'acid'|'near-neutral'|'neutral'|'alkaline', safety:'safe'|'warning'|'danger'}}
     */
    estimatePH(recipe, isDough = true) {
      const pHRef = {
        flour: 6.5, butter: 6.7, sugar: 7.0, 'powdered-sugar': 7.0,
        honey: 3.9, eggs: 7.6, 'egg-yolks': 6.0, milk: 6.7,
        soda: 8.3, 'baking-powder': 8.0,
        'sour-cream': 4.8, 'whipping-cream': 6.5, 'cream-cheese': 4.9,
        'condensed-milk': 6.3, 'dulce-de-leche': 6.0, caramel: 5.5,
        'lemon-juice': 2.0, 'greek-yogurt-2': 4.4, 'greek-yogurt-5': 4.5, 'greek-yogurt-7': 4.6
      };
      const bufferCapacity = {
        eggs: 0.025, 'condensed-milk': 0.012, butter: 0.010, 'cream-cheese': 0.010,
        'sour-cream': 0.008, 'whipping-cream': 0.006, 'dulce-de-leche': 0.006,
        flour: 0.005, caramel: 0.004, honey: 0.002, soda: 0.001, sugar: 0.001,
        'greek-yogurt-2': 0.008, 'greek-yogurt-5': 0.008, 'greek-yogurt-7': 0.008
      };

      const total = Object.values(recipe || {}).reduce((s, w) => s + (Number(w) || 0), 0);
      if (total === 0) return { value: 7.0, band: 'neutral', safety: 'safe' };

      let sumWeightedH = 0;
      let sumEffWeight = 0;
      for (const [ing, wRaw] of Object.entries(recipe)) {
        const w = Number(wRaw) || 0; if (w <= 0) continue;
        const p = pHRef[ing] ?? (isDough ? 7.0 : 6.8);
        const buf = bufferCapacity[ing] ?? 0.01;
        const effW = w * (1 + buf * 100);
        const H = Math.pow(10, -p);
        sumWeightedH += effW * H;
        sumEffWeight += effW;
      }
      let pH = sumEffWeight > 0 ? -Math.log10(sumWeightedH / sumEffWeight) : 7.0;
      pH = Math.max(3.0, Math.min(9.0, pH));

      let band;
      if (pH < 4.0) band = 'very-acid';
      else if (pH < CONSTANTS.CONFIG.SAFETY.ACID_SAFETY_PH) band = 'acid';
      else if (pH < 6.0) band = 'near-neutral';
      else if (pH < 7.5) band = 'neutral';
      else band = 'alkaline';

      let safety = 'safe';
      if (band === 'near-neutral') safety = 'warning';
      else if (band === 'alkaline') safety = 'danger';

      return { value: +pH.toFixed(2), band, safety };
    }
  };

  // ============================== Scaling Calibration (optional storage) ==============================
  // Note: Storage here is limited to calibrated density only; no UI/DOM or strings are used.

  ScalingService._CAL_DENSITY = null;

  /**
   * Compute calibrated density from measured mass and pan geometry (no storage).
   * @param {{shape:'round'|'rectangle', dim1:number, dim2?:number, thicknessMm:number, measuredRawMass:number}} inputs
   * @returns {{density:number}|{error:{code:string}}}
   */
  ScalingService.calibrateDoughDensity = function(inputs) {
    try {
      const { shape, dim1, dim2, thicknessMm, measuredRawMass } = inputs || {};
      if (!shape || !Number.isFinite(dim1) || dim1 <= 0 || !Number.isFinite(thicknessMm) || thicknessMm <= 0 || !Number.isFinite(measuredRawMass) || measuredRawMass <= 0) {
        return { error: { code: 'INVALID_INPUT' } };
      }
      const area = this.getPanArea(shape, dim1, dim2 || null);
      if (area <= 0) return { error: { code: 'INVALID_AREA' } };
      const volume = area * (thicknessMm / 10); // cm³
      const density = measuredRawMass / volume; // g/cm³
      return { density: +DensityHelper.clampDoughDensity(density).toFixed(3) };
    } catch {
      return { error: { code: 'CALC_ERROR' } };
    }
  };

  /**
   * Set/get calibrated density with optional localStorage persistence.
   */
  ScalingService.setCalibratedDensity = function(val) {
    if (typeof val === 'number' && isFinite(val) && val > 1 && val < 2) {
      this._CAL_DENSITY = DensityHelper.clampDoughDensity(val);
      try { localStorage.setItem('medovik_calibrated_density', this._CAL_DENSITY.toString()); } catch {}
    }
  };
  ScalingService.getCalibratedDensity = function() {
    if (!this._CAL_DENSITY) {
      try {
        const stored = localStorage.getItem('medovik_calibrated_density');
        if (stored) this._CAL_DENSITY = DensityHelper.clampDoughDensity(parseFloat(stored));
      } catch {}
    }
    return this._CAL_DENSITY;
  };

  // ============================== Backward Shim: DoughDecisionEngine ==============================
  /**
   * Deprecated: Decisions must be made in main.js Workability Optimizer.
   * This shim returns a minimal structure with numeric codes only.
   */
  const DoughDecisionEngine = (function() {
    function decide(recipe, options = {}) {
      // Warn once per session
      try {
        if (!DoughDecisionEngine._warned) {
          console.warn('[MedovikCore] DoughDecisionEngine.decide is deprecated. Use main.findOptimalWorkPlan().');
          DoughDecisionEngine._warned = true;
        }
      } catch {}
      // Compute basic η_work within classic window for compatibility
      const chem = ChemistryService.calculateDoughViscosity(recipe, options.temperature || 25, {
        caramelization: options.caramelization || CONSTANTS.CONFIG.CARAMELIZATION,
        debug: !!options.debug
      });

      const gates = CONSTANTS.CONFIG.HYDRATION;
      const analysis = AnalysisService.analyzeRecipe(recipe);
      const hydration = analysis?.hydration ?? 0;

      const etaWork = chem?.workTarget?.eta_work ?? 0;
      const visBands = CONSTANTS.CONFIG.VISCOSITY;
      let band = 'unknown';
      if (etaWork > 0) {
        if (etaWork < visBands.STICKY.min) band = 'too-wet';
        else if (etaWork < visBands.STICKY.max) band = 'sticky';
        else if (etaWork <= visBands.OPTIMAL.max) band = 'optimal';
        else if (etaWork <= visBands.STIFF.max) band = 'stiff';
        else band = 'too-stiff';
      }

      return {
        deprecated: true,
        hydration,
        viscosity: {
          eta_inputT: chem?.value ?? null,
          inputT: chem?.temperature ?? (options.temperature || 25),
          eta_work: Math.round(etaWork || 0),
          T_work: chem?.workTarget?.T_work ?? null,
          band
        },
        components: chem?.components || null,
        workTarget: chem?.workTarget || null,
        debug: chem?.debug || null
      };
    }
    return { decide, _warned: false };
  })();

  // ============================== Integrity Helper ==============================
  function checkServiceIntegrity() {
    const required = [
      'estimateBrix', 'estimatePH', 'estimateViscosity',
      'estimateWaterActivity', 'calculateSweetnessIndex',
      'estimateFillingChemistry', 'estimateCakeChemistry',
      'buildCompatibilityReport'
    ];
    const missing = required.filter(fn => typeof ChemistryService[fn] !== 'function');
    return {
      integrated: missing.length === 0,
      missing
    };
  }

  // ============================== Public Export ==============================
  window.MedovikCalculatorCore = {
    CONSTANTS,
    ValidationService,
    SecurityService,
    ParserService,
    AnalysisService,
    TemperingService,
    ScalingService,
    ChemistryService,
    DoughDecisionEngine, // deprecated shim
    checkServiceIntegrity,
    META: CORE_META
  };

})(window);