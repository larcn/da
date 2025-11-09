		// CORE.JS - The Scientific Brain of the Medovik Calculator (Enhanced)
//
// Responsibilities:
// 1. All scientific and mathematical calculations.
// 2. Data processing, parsing, and analysis logic.
// 3. Enhanced security validation and sanitization.
// 4. Storage management (localStorage).
// 5. Centralized validation service.
// 6. This file is completely UI-agnostic. It does not touch the DOM.
// ===================================================================================

(function(window) {
    'use strict';

    // ============================ SCIENTIFIC CONSTANTS =============================
    const CONSTANTS = {
        SCIENTIFIC_RANGES: {
            flour: { min: 48, max: 52, ideal: 50 },
            butter: { min: 10, max: 14, ideal: 12 },
            sugars: { min: 28, max: 33, ideal: 30.5 },
            eggs: { min: 8, max: 11, ideal: 9.5 },
            soda: { min: 0.4, max: 0.8, ideal: 0.55 }
        },
        HYDRATION: {
            EGG_WATER_CONTENT: 0.75,
            HONEY_WATER_CONTENT: 0.18,
            BUTTER_WATER_CONTENT: 0.16
        },
        SPECIFIC_HEAT: {
            EGG: 3.3,      // kJ/kg·K
            BUTTER: 2.1,   // kJ/kg·K
            SUGAR: 1.25,   // kJ/kg·K
            HONEY: 3.35,   // kJ/kg·K
            SODA: 0.9,     // kJ/kg·K
            LIQUID: 2.4    // kJ/kg·K - fallback average
        },
        DENSITIES: {
            FLOUR: 0.593, 
            BUTTER: 0.911, 
            SUGAR: 0.845,
            HONEY: 1.420, 
            EGGS: 1.031, 
            SODA: 2.159
        },
        BAKING: {
            MAILLARD_START_TEMP: 140,
            IDEAL_COLOR_INDEX: 100,
            DRYNESS_RATE: 0.05,
            DEFAULT_TIME: 7,
            DEFAULT_TEMP: 180
        },
        FILLING: { 
            DENSITY: 1.1 
        },
        AVERAGE_DOUGH_DENSITY: 1.25,
        DEFAULT_AIR_FACTOR: 0.03
    };

    // ============================ VALIDATION SERVICE (NEW) =============================
    const ValidationService = {
        isPositiveNumber(value, min = 0, max = Infinity) {
            const num = Number(value);
            return !isNaN(num) && num >= min && num <= max;
        },
        
        validateRecipe(recipe) {
            const errors = [];
            const schema = {
                flour: { min: 0, max: 10000, name: 'دقيق' },
                butter: { min: 0, max: 5000, name: 'زبدة' },
                sugar: { min: 0, max: 5000, name: 'سكر' },
                honey: { min: 0, max: 5000, name: 'عسل' },
                eggs: { min: 0, max: 5000, name: 'بيض' },
                soda: { min: 0, max: 100, name: 'صودا الخبز' }
            };
            
            for (const [key, value] of Object.entries(recipe)) {
                if (schema[key] && !this.isPositiveNumber(value, schema[key].min, schema[key].max)) {
                    errors.push(`${schema[key].name}: قيمة غير صالحة (${value})`);
                }
            }
            
            // Check soda ratio
            if (recipe.flour > 0 && recipe.soda > 0) {
                const sodaRatio = (recipe.soda / recipe.flour) * 100;
                if (sodaRatio > 2) {
                    errors.push(`تحذير: نسبة الصودا عالية جداً (${sodaRatio.toFixed(1)}% من الدقيق) - قد تسبب طعماً قلوياً.`);
                }
            }
            
            return { valid: errors.length === 0, errors };
        },
        
        validatePanDimensions(shape, dim1, dim2) {
            const errors = [];
            if (!this.isPositiveNumber(dim1, 10, 100)) {
                errors.push('البعد الأول غير صالح');
            }
            if (shape === 'rectangle' && !this.isPositiveNumber(dim2, 10, 100)) {
                errors.push('البعد الثاني غير صالح');
            }
            return errors;
        },
        
        validateFillingRecipe(recipe) {
            const total = Object.values(recipe).reduce((sum, val) => sum + val, 0);
            if (total === 0) {
                return { valid: false, errors: ['وزن الحشو الإجمالي صفر'] };
            }
            
            // Check for negative values
            const hasNegative = Object.values(recipe).some(val => val < 0);
            if (hasNegative) {
                return { valid: false, errors: ['يوجد قيم سالبة في مقادير الحشو'] };
            }
            
            return { valid: true, errors: [] };
        },
        
        validateTemperingInputs(inputs) {
            const errors = [];
            const { eggMass, eggTemp, liquidMass, liquidTemp, batchCount } = inputs;
            
            if (!this.isPositiveNumber(eggMass, 1, 1000)) errors.push('كتلة البيض غير صالحة');
            if (!this.isPositiveNumber(eggTemp, 0, 30)) errors.push('حرارة البيض غير صالحة');
            if (!this.isPositiveNumber(liquidMass, 1, 5000)) errors.push('كتلة الخليط الساخن غير صالحة');
            if (!this.isPositiveNumber(liquidTemp, 60, 120)) errors.push('حرارة الخليط الساخن غير صالحة');
            if (!this.isPositiveNumber(batchCount, 2, 10)) errors.push('عدد الدفعات غير صالح');
            
            return errors;
        }
    };

    // ============================ SECURITY SERVICE (ENHANCED) =============================
    const SecurityService = {
        validateRecipe(recipe) {
            // Use the new ValidationService
            return ValidationService.validateRecipe(recipe);
        },
        
        sanitizeInput(value) {
            if (typeof value !== 'string') return value;
            return value
                .replace(/[<>]/g, '') // Basic XSS protection
                .substring(0, 1000); // Prevent extremely long inputs
        },
        
        sanitizeRecipe(recipe) {
            const sanitized = {};
            for (const [key, value] of Object.entries(recipe)) {
                if (typeof value === 'number' && isFinite(value)) {
                    sanitized[key] = Math.max(0, value); // Ensure non-negative
                }
            }
            return sanitized;
        }
    };

    // ============================ PARSER SERVICE =============================
    const ParserService = {
        CONVERSIONS: {
            tsp: { soda: 4.6 },
            tbsp: { soda: 13.8 },
            cup: { flour: 120, sugar: 200, honey: 340 },
            eggWeight: 55
        },

        parseRecipeText(text) {
            const ingredients = { flour: 0, butter: 0, sugar: 0, honey: 0, eggs: 0, soda: 0 };
            
            // Enhanced text normalization
            const normalizedText = text
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                .replace(/[٫،]/g, '.')
                .replace(/\s+/g, ' ')
                .toLowerCase();

            const keywords = {
                flour: ['دقيق', 'طحين', 'flour'],
                butter: ['زبدة', 'زبد', 'butter'],
                sugar: ['سكر', 'sugar'],
                honey: ['عسل', 'honey'],
                eggs: ['بيض', 'بيضة', 'بيضات', 'egg', 'eggs'],
                soda: ['صودا', 'بيكربونات', 'بيكنج صودا', 'baking soda', 'bicarbonate']
            };

            const unitPatterns = {
                gram: '(?:جم|جرام|غرام|غ|g|gr|grs|gram|grams)?',
                tsp: '(?:ملعقة صغيرة|ملاعق صغيرة|م\\.ص|tsp|teaspoon)',
                tbsp: '(?:ملعقة كبيرة|ملاعق كبيرة|م\\.ك|tbsp|tablespoon)',
                cup: '(?:كوب|أكواب|كأس|cup|cups)'
            };

            for (const [ingredient, keyList] of Object.entries(keywords)) {
                for (const key of keyList) {
                    let found = false;
                    let value = 0;

                    // Pattern 1: number before ingredient
                    let regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.gram}\\s*${key}`, 'i');
                    let match = normalizedText.match(regex);
                    
                    if (!match) {
                        // Pattern 2: ingredient before number
                        regex = new RegExp(`${key}\\s*:?\\s*(\\d*\\.?\\d+)\\s*${unitPatterns.gram}`, 'i');
                        match = normalizedText.match(regex);
                    }

                    if (match) {
                        value = parseFloat(match[1]);
                        
                        // Convert egg count to grams
                        if (ingredient === 'eggs' && value > 0 && value <= 20 && Number.isInteger(value)) {
                            value *= this.CONVERSIONS.eggWeight;
                        }
                        found = true;
                    }

                    // Check for special units
                    if (!found && ingredient === 'soda') {
                        // Teaspoon
                        regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.tsp}\\s*${key}`, 'i');
                        match = normalizedText.match(regex);
                        if (match) {
                            value = parseFloat(match[1]) * this.CONVERSIONS.tsp.soda;
                            found = true;
                        }
                        
                        // Tablespoon
                        if (!found) {
                            regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.tbsp}\\s*${key}`, 'i');
                            match = normalizedText.match(regex);
                            if (match) {
                                value = parseFloat(match[1]) * this.CONVERSIONS.tbsp.soda;
                                found = true;
                            }
                        }
                    }

                    // Check for cup measurements
                    if (!found && this.CONVERSIONS.cup[ingredient]) {
                        regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.cup}\\s*${key}`, 'i');
                        match = normalizedText.match(regex);
                        if (match) {
                            value = parseFloat(match[1]) * this.CONVERSIONS.cup[ingredient];
                            found = true;
                        }
                    }

                    if (found) {
                        ingredients[ingredient] = value;
                        break;
                    }
                }
            }
            
            // Sanitize the parsed ingredients
            return SecurityService.sanitizeRecipe(ingredients);
        }
    };
    
    // ============================ ANALYSIS SERVICE =============================
    const AnalysisService = {
        analyzeRecipe(recipe) {
            // Enhanced validation using ValidationService
            const validation = ValidationService.validateRecipe(recipe);
            if (!validation.valid) {
                return { error: validation.errors.join('\n') };
            }

            const total = Object.values(recipe).reduce((s, v) => s + v, 0);
            if (total === 0) return null;

            const percentages = {
                flour: (recipe.flour / total) * 100, 
                butter: (recipe.butter / total) * 100,
                sugar: (recipe.sugar / total) * 100, 
                honey: (recipe.honey / total) * 100,
                sugars: ((recipe.sugar + recipe.honey) / total) * 100,
                eggs: (recipe.eggs / total) * 100, 
                soda: (recipe.soda / total) * 100
            };

            const liquidWeight = (recipe.eggs * CONSTANTS.HYDRATION.EGG_WATER_CONTENT) +
                                 (recipe.honey * CONSTANTS.HYDRATION.HONEY_WATER_CONTENT) +
                                 (recipe.butter * CONSTANTS.HYDRATION.BUTTER_WATER_CONTENT);
            const hydration = recipe.flour > 0 ? (liquidWeight / recipe.flour) * 100 : 0;

            const checks = {};
            let qualityScore = 100;

            for (const comp in CONSTANTS.SCIENTIFIC_RANGES) {
                const range = CONSTANTS.SCIENTIFIC_RANGES[comp];
                const value = percentages[comp];
                if (value < range.min) { 
                    checks[comp] = 'low'; 
                    qualityScore -= 20; 
                }
                else if (value > range.max) { 
                    checks[comp] = 'high'; 
                    qualityScore -= 20; 
                }
                else { 
                    checks[comp] = 'optimal'; 
                }
            }

            return { 
                recipe, 
                totalWeight: total, 
                percentages, 
                checks, 
                qualityScore: Math.max(0, qualityScore), 
                hydration,
                liquidWeight
            };
        },

        predictDoughTexture(analysis) {
            if (!analysis || analysis.error) return null;
            const { hydration } = analysis;
            
            let result = {
                hydration,
                texture: "",
                sensory: {},
                techniques: {},
                troubleshooting: "",
                visualIndicator: ""
            };
            
            // Updated thresholds for Medovik (20-26% optimal)
            if (hydration > 32) {
                result.texture = "لزج جداً وشبيه بخليط الكيك";
                result.sensory = {
                    touch: "سيلتصق بالأصابع بقوة، لا يمكن تشكيله ككرة",
                    appearance: "لامع وسائل تقريباً، يسيل ببطء", 
                    sound: "صوت 'سكويش' عند الضغط",
                    aroma: "رائحة خام قوية للبيض والعسل"
                };
                result.techniques = {
                    immediate: "برّد فوراً 30 دقيقة",
                    working: "طاولة مرشوشة بكثافة + أدوات مبردة",
                    correction: "أضف 50-75جم دقيق تدريجياً"
                };
                result.visualIndicator = "🔴 حرج - تصحيح فوري";
                result.troubleshooting = "زيادة شديدة في السوائل أو نقص في الدقيق";
                
            } else if (hydration > 26) {
                result.texture = "طري ويميل للالتصاق";
                result.sensory = {
                    touch: "يلتصق قليلاً، يترك أثراً على الأصابع",
                    appearance: "سطح رطب قليلاً، مرن ولامع خفيف",
                    sound: "صوت خفيف عند الفصل عن السطح",
                    aroma: "رائحة متوازنة للعسل والزبدة"
                };
                result.techniques = {
                    immediate: "راحة 15-20 دقيقة بالثلاجة",
                    working: "رش خفيف بالدقيق، عمل سريع",
                    correction: "ممكن إضافة 20-30جم دقيق"
                };
                result.visualIndicator = "🟡 مقبول - يحتاج عناية";
                result.troubleshooting = "قد يحتاج تعديل طفيف";
                
            } else if (hydration >= 20) {
                result.texture = "متماسك ومثالي للميدوفيك";
                result.sensory = {
                    touch: "ناعم، مرن، بالكاد يلتصق",
                    appearance: "سطح أملس مات، متجانس",
                    sound: "صوت 'بوب' خفيف عند الضغط",
                    aroma: "رائحة عسل وزبدة متوازنة"
                };
                result.techniques = {
                    immediate: "راحة 10 دقائق بحرارة الغرفة",
                    working: "فرد مباشر بأقل دقيق ممكن",
                    tip: "نافذة العمل: 5-10 دقائق"
                };
                result.visualIndicator = "🟢 مثالي";
                result.troubleshooting = "لا يحتاج تعديل";
                
            } else {
                result.texture = "جاف ومتفتت";
                result.sensory = {
                    touch: "خشن، يتفتت عند الضغط",
                    appearance: "سطح مشقق، باهت",
                    sound: "صوت تكسر عند الطي",
                    aroma: "رائحة دقيق غالبة"
                };
                result.techniques = {
                    immediate: "أضف 1-2 ملعقة سائل دافئ",
                    working: "عجن لطيف بعد الإضافة",
                    correction: "عسل أو زبدة ذائبة للمرونة"
                };
                result.visualIndicator = "🔴 يحتاج إصلاح";
                result.troubleshooting = "نقص حاد في السوائل/الدهون";
            }
            
            return result;
        },

        getAdvisorReport(analysis) {
            if (!analysis || analysis.error) return null;
            const report = [];
            const componentNames = { 
                flour: 'الدقيق', 
                butter: 'الزبدة', 
                sugars: 'السكريات', 
                eggs: 'البيض', 
                soda: 'صودا الخبز' 
            };
            
            for (const component in analysis.checks) {
                if (analysis.checks[component] !== 'optimal') {
                    const details = {
                        componentName: componentNames[component], 
                        status: analysis.checks[component],
                        currentValue: analysis.percentages[component].toFixed(1) + '%',
                        idealRange: `${CONSTANTS.SCIENTIFIC_RANGES[component].min}-${CONSTANTS.SCIENTIFIC_RANGES[component].max}%`,
                        impact: "", 
                        solution: "",
                        science: ""
                    };
                    
                    switch (`${component}-${analysis.checks[component]}`) {
                        case 'flour-low':
                            details.impact = "عجينة لزجة وضعيفة البنية";
                            details.solution = "زيادة الدقيق بمقدار 10-15%";
                            details.science = "الدقيق يوفر البنية من خلال بروتينات الجلوتين والنشا";
                            break;
                        case 'flour-high':
                            details.impact = "عجينة قاسية وجافة";
                            details.solution = "تقليل الدقيق أو زيادة السوائل";
                            details.science = "زيادة الدقيق تمتص السوائل وتجعل العجينة متماسكة أكثر من اللازم";
                            break;
                        case 'butter-low':
                            details.impact = "فقدان الطراوة والنعومة";
                            details.solution = "زيادة الزبدة 15-20 جرام";
                            details.science = "الدهون تقطع شبكة الجلوتين وتمنح الهشاشة";
                            break;
                        case 'butter-high':
                            details.impact = "عجينة دهنية ورخوة";
                            details.solution = "تقليل الزبدة أو زيادة الدقيق قليلاً";
                            details.science = "الدهون الزائدة تمنع تماسك العجينة";
                            break;
                        case 'sugars-low':
                            details.impact = "لون باهت ونقص في الرطوبة";
                            details.solution = "زيادة السكر أو العسل 20-30 جرام";
                            details.science = "السكريات ضرورية لتفاعل ميلارد (اللون الذهبي) والاحتفاظ بالرطوبة";
                            break;
                        case 'sugars-high':
                            details.impact = "لزوجة زائدة ولون داكن سريع";
                            details.solution = "تقليل السكر/العسل أو خفض حرارة الخبز";
                            details.science = "السكريات الزائدة تسرع الكرملة وتزيد اللزوجة";
                            break;
                        case 'eggs-low':
                            details.impact = "بنية ضعيفة وعجينة متفتتة";
                            details.solution = "زيادة بيضة واحدة (50-55 جرام)";
                            details.science = "البيض يعمل كرابط ومستحلب ويوفر الرطوبة";
                            break;
                        case 'eggs-high':
                            details.impact = "قوام مطاطي وكثيف";
                            details.solution = "تقليل البيض أو زيادة الدهون";
                            details.science = "البروتين الزائد يجعل القوام مطاطي";
                            break;
                        case 'soda-low':
                            details.impact = "لون باهت وبنية كثيفة";
                            details.solution = "زيادة الصودا 0.5-1 جرام";
                            details.science = "الصودا ترفع pH مما يسرع تفاعل ميلارد ويحسن اللون";
                            break;
                        case 'soda-high':
                            details.impact = "طعم قلوي (صابوني) مر";
                            details.solution = "تقليل الصودا 25-30%";
                            details.science = "الصودا غير المتفاعلة تترك طعماً قلوياً";
                            break;
                    }
                    report.push(details);
                }
            }
            return report;
        },
        
        simulateBaking(analysis, temp, time, options = {}) {
            if (!analysis || analysis.error) return null;
            
            const { percentages, recipe } = analysis;
            const thickness = options.thicknessMm || 3;
            
            // Factors
            const honeyShare = recipe.honey / Math.max(1, recipe.honey + recipe.sugar);
            const butterRatio = percentages.butter / 100;
            
            // Browning calculation (Maillard + Caramelization)
            const maillardRate = 0.005 * Math.exp((temp - 150) / 20);
            const sugarEffect = 1 + 0.4 * honeyShare;
            const sodaEffect = analysis.checks.soda === 'high' ? 1.15 : 
                               analysis.checks.soda === 'low' ? 0.85 : 1.0;
            const thicknessEffect = Math.sqrt(3 / Math.max(1, thickness));
            
            const browningIndex = 100 * (1 - Math.exp(-maillardRate * time * sugarEffect * sodaEffect * thicknessEffect));
            
            // Moisture calculation
            const moistureRate = 0.01 * Math.exp((temp - 100) / 30);
            const butterProtection = 1 - butterRatio * 0.5;
            const thicknessDryness = thickness / 3;
            
            const moistureLoss = analysis.hydration * (1 - Math.exp(-moistureRate * time)) * 0.3 * butterProtection / thicknessDryness;
            
            // Assessment
            let colorAssessment, textureAssessment, recommendations = [];
            
            // Color
            if (browningIndex < 60) {
                colorAssessment = "باهت جداً";
                recommendations.push("ارفع الحرارة 10°C أو زد الوقت دقيقة");
            } else if (browningIndex < 90) {
                colorAssessment = "ذهبي فاتح";
                recommendations.push("مناسب للطبقات الداخلية");
            } else if (browningIndex < 110) {
                colorAssessment = "ذهبي مثالي";
                recommendations.push("مثالي!");
            } else if (browningIndex < 130) {
                colorAssessment = "بني ذهبي";
                recommendations.push("مناسب للطبقة العلوية");
            } else {
                colorAssessment = "داكن/محروق";
                recommendations.push("قلل الحرارة أو الوقت");
            }
            
            // Texture
            const textureScore = 100 - moistureLoss * 2 - Math.max(0, (temp - 190) * 0.5);
            
            if (textureScore > 85) {
                textureAssessment = "طري وهش";
            } else if (textureScore > 70) {
                textureAssessment = "مقرمش متوازن";
            } else if (textureScore > 55) {
                textureAssessment = "مقرمش وجاف قليلاً";
            } else {
                textureAssessment = "قاسي وجاف";
                recommendations.push("قلل الوقت أو الحرارة");
            }
            
            // Sensory predictions
            const sensoryPredictions = {
                visual: {
                    top: browningIndex > 110 ? "بقع بنية" : browningIndex > 90 ? "لون متجانس" : "مركز شاحب",
                    edges: browningIndex > 100 ? "حواف بنية واضحة" : "حواف ذهبية خفيفة"
                },
                aroma: {
                    expected: browningIndex > 120 ? ["كراميل قوي", "محمص"] : 
                             browningIndex > 80 ? ["عسل محمص", "زبدة دافئة"] : 
                             ["عجين خام", "دقيق"]
                },
                texture: {
                    bite: textureScore > 80 ? "ذوبان في الفم" : 
                          textureScore > 60 ? "مقرمش لطيف" : 
                          "يحتاج مضغ"
                }
            };
            
            return {
                color: colorAssessment,
                texture: textureAssessment,
                browningIndex: Math.round(browningIndex),
                moistureLoss: moistureLoss.toFixed(1) + '%',
                textureScore: Math.round(textureScore),
                recommendations,
                sensoryPredictions,
                parameters: {
                    thickness: thickness + 'mm',
                    honeyShare: (honeyShare * 100).toFixed(0) + '%',
                    butterProtection: ((1 - butterProtection) * 100).toFixed(0) + '%'
                }
            };
        }
    };
    
    // ============================ TEMPERING SERVICE =============================
    const TemperingService = {
        getBatchDistribution(count) {
            const distributions = {
                3: [25, 35, 40], 
                4: [20, 25, 25, 30],
                5: [15, 20, 20, 20, 25], 
                6: [12, 15, 18, 18, 18, 19]
            };
            return distributions[count] || distributions[5];
        },

        getLiquidCp(masses) {
            const C = CONSTANTS.SPECIFIC_HEAT;
            const total = masses.butter + masses.sugar + masses.honey + masses.soda;
            if (total <= 0) return C.LIQUID;
            
            const weightedCp = (
                masses.butter * C.BUTTER +
                masses.sugar * C.SUGAR +
                masses.honey * C.HONEY +
                masses.soda * C.SODA
            ) / total;
            
            return weightedCp;
        },

        calculateOptimalBatches(eggMass, eggTemp, liquidMass, liquidTemp, batchCount, liquidBreakdown = null) {
            // Enhanced validation
            const validation = ValidationService.validateTemperingInputs({
                eggMass, eggTemp, liquidMass, liquidTemp, batchCount
            });
            
            if (validation.length > 0) {
                return { error: validation.join(', ') };
            }
            
            const C_EGG = CONSTANTS.SPECIFIC_HEAT.EGG;
            const C_LIQUID = liquidBreakdown ? this.getLiquidCp(liquidBreakdown) : CONSTANTS.SPECIFIC_HEAT.LIQUID;
            
            const batches = [];
            const distribution = this.getBatchDistribution(batchCount);
            let currentMass = eggMass;
            let currentTemp = eggTemp;
            let maxTemp = eggTemp;
            let criticalBatch = null;
            
            distribution.forEach((percentage, index) => {
                const batchMass = (percentage / 100) * liquidMass;
                const totalEnergy = currentMass * C_EGG * currentTemp + batchMass * C_LIQUID * liquidTemp;
                const totalHeatCapacity = currentMass * C_EGG + batchMass * C_LIQUID;
                const newTemp = totalEnergy / totalHeatCapacity;
                
                // Sensory notes for each batch
                let sensoryNote = "";
                if (newTemp > 65) {
                    sensoryNote = "⚠️ خطر تخثر - اخفق بسرعة";
                } else if (newTemp > 60) {
                    sensoryNote = "انتبه - قرب منطقة الخطر";
                } else if (newTemp > 50) {
                    sensoryNote = "آمن - استمر بالخفق المعتدل";
                } else {
                    sensoryNote = "ممتاز - خفق عادي";
                }
                
                batches.push({
                    batchNumber: index + 1,
                    percentage: percentage,
                    tempBefore: parseFloat(currentTemp.toFixed(1)),
                    tempAfter: parseFloat(newTemp.toFixed(1)),
                    sensoryNote: sensoryNote,
                    technique: index === 0 ? "خيط رفيع + خفق سريع" : "صب معتدل + خفق مستمر"
                });
                
                if (newTemp > maxTemp) {
                    maxTemp = newTemp;
                    criticalBatch = index + 1;
                }
                
                currentMass += batchMass;
                currentTemp = newTemp;
            });
            
            const finalTemp = batches[batches.length - 1].tempAfter;
            
            // Overall assessment
            let safetyStatus, recommendation;
            if (maxTemp > 68) {
                safetyStatus = 'danger';
                recommendation = "خطر! توقع تخثر جزئي للبيض";
            } else if (maxTemp > 65) {
                safetyStatus = 'warning';
                recommendation = "حذر - على حافة التخثر";
            } else {
                safetyStatus = 'safe';
                recommendation = "آمن تماماً - لا خطر تخثر";
            }
            
            return {
                batches,
                finalTemp,
                maxBatchTemp: parseFloat(maxTemp.toFixed(1)),
                criticalBatch,
                safetyStatus,
                recommendation,
                liquidCp: parseFloat(C_LIQUID.toFixed(2))
            };
        },

        maxHotMassForTarget(m0, T0, tHot, Ttarget) {
            const c0 = CONSTANTS.SPECIFIC_HEAT.EGG;
            const cHot = CONSTANTS.SPECIFIC_HEAT.LIQUID;
            if (tHot <= Ttarget) return Infinity;
            if (Ttarget <= T0) return 0;
            return (m0 * c0 * (Ttarget - T0)) / (cHot * (tHot - Ttarget));
        },
        
        maxHotTempForTarget(m0, T0, mHot, Ttarget) {
            const c0 = CONSTANTS.SPECIFIC_HEAT.EGG;
            const cHot = CONSTANTS.SPECIFIC_HEAT.LIQUID;
            if (mHot <= 0) return Infinity;
            const result = (Ttarget * (m0 * c0 + mHot * cHot) - m0 * c0 * T0) / (mHot * cHot);
            return Math.max(T0, result);
        },
        
        neededEggIncrease(eggMass, eggTemp, liquidMass, liquidTemp, Ttarget) {
            const cEgg = CONSTANTS.SPECIFIC_HEAT.EGG;
            const cLiquid = CONSTANTS.SPECIFIC_HEAT.LIQUID;
            if (Ttarget <= eggTemp || liquidTemp <= Ttarget) return 0;
            const neededTotalEgg = (liquidMass * cLiquid * (liquidTemp - Ttarget)) / (cEgg * (Ttarget - eggTemp));
            return Math.max(0, neededTotalEgg - eggMass);
        }
    };

    // ============================ SCALING SERVICE (ENHANCED) =============================
    const ScalingService = {
        calculateEffectiveDensity(recipe, userAirFactor = null) {
            let solidVolume = 0;
            const totalMass = Object.values(recipe).reduce((s, v) => s + v, 0);
            if (totalMass === 0) return CONSTANTS.AVERAGE_DOUGH_DENSITY;

            for (const [comp, mass] of Object.entries(recipe)) {
                const density = CONSTANTS.DENSITIES[comp.toUpperCase()];
                if (density) {
                    solidVolume += mass / density;
                }
            }
            
            const airFactor = userAirFactor !== null ? userAirFactor : CONSTANTS.DEFAULT_AIR_FACTOR;
            return totalMass / (solidVolume / (1 - airFactor));
        },
        
        getPanArea(shape, dim1, dim2 = null) {
            if (shape === 'round') return Math.PI * (dim1 / 2) ** 2;
            if (shape === 'rectangle' && dim2) return dim1 * dim2;
            return 0;
        },

        calculateNormal(analysis, shape, dim1, dim2, thickness) {
            if (!analysis || analysis.error) return null;
            
            // Validate pan dimensions
            const validationErrors = ValidationService.validatePanDimensions(shape, dim1, dim2);
            if (validationErrors.length > 0) {
                return { error: validationErrors.join(', ') };
            }
            
            const density = this.calculateEffectiveDensity(analysis.recipe);
            const area = this.getPanArea(shape, dim1, dim2);
            if (area === 0) return null;
            
            const singleLayerWeight = area * (thickness / 10) * density;
            const numLayers = Math.floor(analysis.totalWeight / singleLayerWeight);
            
            return { 
                singleLayerWeight, 
                numLayers, 
                density,
                totalCoverage: numLayers * singleLayerWeight,
                remainder: analysis.totalWeight - (numLayers * singleLayerWeight)
            };
        },

        calculateAdvanced(analysis, targetWeight, targetCount, extra) {
            if (!analysis || analysis.error) return null;
            
            // Validate inputs
            if (!ValidationService.isPositiveNumber(targetWeight, 50, 300) || 
                !ValidationService.isPositiveNumber(targetCount, 1, 20) ||
                !ValidationService.isPositiveNumber(extra, 0, 30)) {
                return { error: 'قيم الإدخال غير صالحة' };
            }
            
            const totalWeight = targetWeight * targetCount * (1 + extra / 100);
            const scalingFactor = totalWeight / analysis.totalWeight;
            const newRecipe = {};
            
            for (const component in analysis.recipe) { 
                newRecipe[component] = analysis.recipe[component] * scalingFactor; 
            }
            
            return { 
                newRecipe, 
                totalWeight,
                scalingFactor,
                perLayerWeight: targetWeight
            };
        },

        calculateReverse(shape, dim1, dim2, targetCount, thickness) {
            // Validate inputs
            const validationErrors = ValidationService.validatePanDimensions(shape, dim1, dim2);
            if (validationErrors.length > 0) {
                return { error: validationErrors.join(', ') };
            }
            
            if (!ValidationService.isPositiveNumber(targetCount, 1, 20) ||
                !ValidationService.isPositiveNumber(thickness, 1, 5)) {
                return { error: 'قيم الإدخال غير صالحة' };
            }
            
            const area = this.getPanArea(shape, dim1, dim2);
            if (area === 0) return null;
            
            const singleLayerWeight = area * (thickness / 10) * CONSTANTS.AVERAGE_DOUGH_DENSITY;
            const totalWeight = singleLayerWeight * targetCount;
            const idealRecipe = {};
            const ranges = CONSTANTS.SCIENTIFIC_RANGES;
            
            const baseTotal = ranges.flour.ideal + ranges.butter.ideal + 
                            ranges.sugars.ideal + ranges.eggs.ideal + ranges.soda.ideal;
            const factor = totalWeight / baseTotal;
            
            idealRecipe.flour = ranges.flour.ideal * factor;
            idealRecipe.butter = ranges.butter.ideal * factor;
            const sugarsWeight = ranges.sugars.ideal * factor;
            idealRecipe.sugar = sugarsWeight * 0.5; 
            idealRecipe.honey = sugarsWeight * 0.5;
            idealRecipe.eggs = ranges.eggs.ideal * factor;
            idealRecipe.soda = ranges.soda.ideal * factor;
            
            return { 
                newRecipe: idealRecipe, 
                totalWeight: Object.values(idealRecipe).reduce((s,v)=>s+v,0),
                perLayerWeight: singleLayerWeight
            };
        },
        
        calculateFilling(baseFilling, shape, dim1, dim2, layerCount, thickness) {
            // Validate filling recipe
            const fillingValidation = ValidationService.validateFillingRecipe(baseFilling);
            if (!fillingValidation.valid) {
                return { error: fillingValidation.errors.join(', ') };
            }
            
            // Validate pan dimensions
            const panValidation = ValidationService.validatePanDimensions(shape, dim1, dim2);
            if (panValidation.length > 0) {
                return { error: panValidation.join(', ') };
            }
            
            if (!ValidationService.isPositiveNumber(layerCount, 1, 20) ||
                !ValidationService.isPositiveNumber(thickness, 2, 10)) {
                return { error: 'قيم الإدخال غير صالحة' };
            }
            
            const area = this.getPanArea(shape, dim1, dim2);
            if (area === 0) return null;
            
            const fillingLayers = Math.max(0, layerCount - 1); // Fixed: 0 layers when count=1
            if (fillingLayers === 0) {
                return { error: "لا توجد طبقات حشو (عدد الطبقات = 1)" };
            }
            
            const requiredWeight = area * (thickness / 10) * fillingLayers * CONSTANTS.FILLING.DENSITY;
            const baseTotalWeight = Object.values(baseFilling).reduce((s, v) => s + v, 0);
            
            // Prevent division by zero
            if (baseTotalWeight === 0) {
                return { error: "الوزن الأساسي للحشو صفر" };
            }
            
            const scalingFactor = requiredWeight / baseTotalWeight;
            const scaledRecipe = {};
            
            for (const comp in baseFilling) { 
                scaledRecipe[comp] = baseFilling[comp] * scalingFactor; 
            }
            
            return { 
                requiredWeight, 
                scaledRecipe,
                perLayerAmount: requiredWeight / fillingLayers
            };
        }
    };

    // ============================ CHEMISTRY SERVICE (CENTRALIZED) =============================
    const ChemistryService = {
        // حساب تركيز السكريات (Brix)
        estimateBrix(recipe, isDough = true) {
            const sugarContent = {
                // للمكونات الأساسية للعجين
                flour: 0.01,    // 1% سكريات طبيعية
                sugar: 1.00,    // 100% سكر
                honey: 0.82,    // 82% سكريات
                butter: 0.001,  // 0.1% لاكتوز
                eggs: 0.01,     // 1% سكريات طبيعية
                soda: 0.00,
                
                // لمكونات الحشوة
                'sour-cream': 0.04,
                'whipping-cream': 0.03,
                'cream-cheese': 0.03,
                'condensed-milk': 0.55,
                'dulce-de-leche': 0.55,
                'caramel': 0.70,
                'powdered-sugar': 1.00,
                'milk': 0.05,
                'egg-yolks': 0.01
            };

            let totalSugar = 0;
            let totalWeight = 0;

            for (const [ingredient, weight] of Object.entries(recipe)) {
                const sugarRatio = sugarContent[ingredient] || 0;
                totalSugar += weight * sugarRatio;
                totalWeight += weight;
            }

            if (totalWeight === 0) return { value: 0, level: 'غير معروف', description: 'لا توجد مكونات' };
            
            const brix = (totalSugar / totalWeight) * 100;
            
            // تصنيف Brix
            let level, description;
            if (isDough) {
                if (brix < 25) { level = 'منخفض'; description = 'لون باهت - يحتاج سكريات أكثر'; }
                else if (brix < 35) { level = 'مثالي'; description = 'لون ذهبي مثالي'; }
                else if (brix < 45) { level = 'مرتفع'; description = 'لون بني سريع - خطر الاحتراق'; }
                else { level = 'عالي جداً'; description = 'سيحترق بسرعة'; }
            } else {
                // للحشوة
                if (brix < 20) { level = 'غير محلى'; description = 'مناسب للحمية'; }
                else if (brix < 30) { level = 'قليل الحلاوة'; description = 'متوازن - يناسب معظم الأذواق'; }
                else if (brix < 40) { level = 'حلو'; description = 'حلو بشكل معتدل'; }
                else if (brix < 50) { level = 'حلو جداً'; description = 'حلو - قد يكون مفرطاً للبعض'; }
                else { level = 'مفرط الحلاوة'; description = 'حلاوة عالية - غير موصى بها'; }
            }

            return {
                value: parseFloat(brix.toFixed(1)),
                level,
                description
            };
        },

        // تقدير water activity
        estimateWaterActivity(recipe) {
            const waterContent = {
                'whipping-cream': 0.60, 'sour-cream': 0.72, 'cream-cheese': 0.55,
                'butter': 0.16, 'condensed-milk': 0.27, 'dulce-de-leche': 0.20,
                'caramel': 0.15, 'powdered-sugar': 0.005, 'sugar': 0.005,
                'milk': 0.87, 'egg-yolks': 0.50, 'honey': 0.18,
                'flour': 0.12, 'eggs': 0.75
            };
            
            let totalWater = 0;
            let totalSolutes = 0;
            let totalWeight = 0;

            for (const [ingredient, weight] of Object.entries(recipe)) {
                const water = weight * (waterContent[ingredient] || 0);
                totalWater += water;
                
                if (['condensed-milk', 'dulce-de-leche', 'caramel', 'powdered-sugar', 'sugar', 'honey'].includes(ingredient)) {
                    totalSolutes += weight * 0.6;
                }
                
                totalWeight += weight;
            }

            if (totalWeight === 0) return { value: 0, level: 'غير محسوب', description: 'لا توجد مكونات' };

            const moleFractionWater = totalWater / (totalWater + totalSolutes * 0.003);
            const aw = moleFractionWater * 0.99;

            let level, description;
            if (aw > 0.95) { level = 'مرتفع'; description = 'نشاط ميكروبي عالي - استخدم بسرعة'; }
            else if (aw > 0.90) { level = 'متوسط'; description = 'مقبول - استخدم خلال 24 ساعة'; }
            else if (aw > 0.85) { level = 'منخفض'; description = 'جيد - عمر تخزين أطول'; }
            else { level = 'منخفض جداً'; description = 'ممتاز - عمر تخزين طويل'; }

            return {
                value: parseFloat(aw.toFixed(3)),
                level,
                description,
                moistureTransferRate: this.getMoistureTransferRate(aw),
                maturationTime: this.getMaturationTime(aw)
            };
        },

        getMoistureTransferRate(aw) {
            if (aw > 0.95) return "سريع جداً (2-3 مم/ساعة)";
            if (aw > 0.90) return "سريع (1-2 مم/ساعة)";
            if (aw > 0.85) return "متوسط (0.5-1 مم/ساعة)";
            return "بطيء (<0.5 مم/ساعة)";
        },

        getMaturationTime(aw) {
            if (aw > 0.95) return "12-18 ساعة";
            if (aw > 0.90) return "18-24 ساعة";
            if (aw > 0.85) return "24-36 ساعة";
            if (aw > 0.80) return "36-48 ساعة";
            return "48+ ساعة";
        },

        // حساب pH تقديري
        estimatePH(recipe, isDough = true) {
            const phContributions = {
                // مكونات حامضية
                honey: -0.3,        // حامض
                'sour-cream': -0.4, // حامض
                'cream-cheese': -0.2,
                'lemon-juice': -2.0,
                
                // مكونات قلوية  
                soda: 2.5,          // قلوي قوي
                'baking-powder': 1.8
            };

            let basePH = isDough ? 7.0 : 6.8; // نقطة البداية
            let totalWeight = Object.values(recipe).reduce((sum, w) => sum + w, 0);
            
            if (totalWeight === 0) return { value: 7.0, level: 'محايد', description: 'لا توجد مكونات', safety: 'safe' };

            for (const [ingredient, weight] of Object.entries(recipe)) {
                const contribution = phContributions[ingredient] || 0;
                // التأثير يتناسب مع نسبة المكون من الوزن الكلي
                const effect = (contribution * weight) / totalWeight;
                basePH += effect;
            }

            // ضمان أن pH ضمن المدى المعقول
            basePH = Math.max(3.0, Math.min(9.0, basePH));

            // تصنيف pH
            let level, description, safety;
            if (basePH < 4.0) {
                level = 'حامضي جداً'; 
                description = 'طعم لاذع - قد يؤثر على القوام';
                safety = 'warning';
            } else if (basePH < 4.6) {
                level = 'حامضي'; 
                description = 'آمن ميكروبياً - مثالي للحشوات';
                safety = 'safe';
            } else if (basePH < 5.2) {
                level = 'شبه حامضي'; 
                description = 'جيد - مقبول لمعظم الاستخدامات';
                safety = 'safe';
            } else if (basePH < 6.0) {
                level = 'شبه محايد'; 
                description = 'مقبول - قد يحتاج تعديلاً';
                safety = 'warning';
            } else if (basePH < 7.5) {
                level = 'محايد'; 
                description = 'مثالي للعجين';
                safety = 'safe';
            } else {
                level = 'قلوي'; 
                description = 'طعم صابوني - خطر';
                safety = 'danger';
            }

            return {
                value: parseFloat(basePH.toFixed(2)),
                level,
                description,
                safety
            };
        },

        // حساب اللزوجة التقديرية (بالسنتيبواز cP)
        estimateViscosity(recipe, temperature = 10, isDough = false) {
            const viscosityBase = {
                'sour-cream': 15000,
                'whipping-cream': 8000,
                'cream-cheese': 25000,
                'condensed-milk': 5000,
                'dulce-de-leche': 15000,
                'caramel': 20000,
                'butter': 50000,
                'powdered-sugar': 1000,
                'honey': 12000,
                'milk': 2000,
                'egg-yolks': 6000
            };

            // تأثير الحرارة (كل 10°C تقلل اللزوجة إلى النصف تقريباً)
            const tempEffect = Math.exp(-0.03 * (temperature - 10));
            
            let totalWeight = Object.values(recipe).reduce((sum, w) => sum + w, 0);
            if (totalWeight === 0) return { value: 0, level: 'غير محسوب', description: 'لا توجد مكونات', workability: 'poor', temperature: temperature + '°C' };

            let weightedViscosity = 0;
            for (const [ingredient, weight] of Object.entries(recipe)) {
                const baseViscosity = viscosityBase[ingredient] || 5000; // قيمة افتراضية
                const proportion = weight / totalWeight;
                weightedViscosity += baseViscosity * proportion;
            }

            const finalViscosity = weightedViscosity * tempEffect;

            // تصنيف اللزوجة
            let level, description, workability;
            if (isDough) {
                // للعجين
                if (finalViscosity < 50000) { level = 'سائل'; description = 'لزج - صعب الفرد'; workability = 'poor'; }
                else if (finalViscosity < 100000) { level = 'مثالي'; description = 'سهل الفرد والتشكيل'; workability = 'excellent'; }
                else if (finalViscosity < 200000) { level = 'قاس'; description = 'يحتاج مجهود أكبر في الفرد'; workability = 'fair'; }
                else { level = 'قاس جداً'; description = 'صعب الفرد - قد يتشقق'; workability = 'poor'; }
            } else {
                // للحشوة
                if (finalViscosity < 10000) { level = 'سائلة'; description = 'ستسيل بين الطبقات'; workability = 'poor'; }
                else if (finalViscosity < 18000) { level = 'متوسطة'; description = 'جيدة - سهلة الفرد'; workability = 'good'; }
                else if (finalViscosity < 25000) { level = 'مثالية'; description = 'مثالية للفرد والثبات'; workability = 'excellent'; }
                else if (finalViscosity < 35000) { level = 'كثيفة'; description = 'جيدة ولكن تحتاج مجهود'; workability = 'fair'; }
                else { level = 'كثيفة جداً'; description = 'صعبة الفرد - قد تلتصق'; workability = 'poor'; }
            }

            return {
                value: Math.round(finalViscosity),
                level,
                description,
                workability,
                temperature: temperature + '°C'
            };
        },

        // حساب تأثير الخبز على الكيمياء
        computeBakingEffects(doughChemistry, temp = 180, time = 7) {
            if (!doughChemistry) return null;
            
            const { brix: initialBrix, ph: initialPH } = doughChemistry;
            
            // إضافة تحقق من القيم
            const safeTemp = temp || 180;
            const safeTime = time || 7;
            
            // فقد الرطوبة أثناء الخبز (تقريبي)
            const moistureLoss = Math.min(15, (safeTemp - 150) * safeTime * 0.05);
            const brixIncrease = (initialBrix.value * moistureLoss) / 100;
            
            // تغير pH بسبب تفاعل ميلارد
            const phChange = -0.1 * (safeTemp - 160) * 0.01 * safeTime;
            
            const finalBrix = initialBrix.value + brixIncrease;
            const finalPH = initialPH.value + phChange;
            
            // حساب Water Activity تقريبي
            const waterActivity = Math.max(0.3, 0.85 - (moistureLoss / 100));

            return {
                temp: safeTemp,
                time: safeTime,
                brix: {
                    before: initialBrix.value,
                    after: parseFloat(finalBrix.toFixed(1)),
                    change: parseFloat(brixIncrease.toFixed(1))
                },
                ph: {
                    before: initialPH.value,
                    after: parseFloat(finalPH.toFixed(2)),
                    change: parseFloat(phChange.toFixed(2))
                },
                waterActivity: parseFloat(waterActivity.toFixed(2)),
                moistureLoss: parseFloat(moistureLoss.toFixed(1)),
                maturationTime: this.getMaturationTime(waterActivity)
            };
        },

        // تحليل كيمياء العجين الشامل
        estimateCakeChemistry(recipe, bakingParams = null) {
            const brix = this.estimateBrix(recipe, true);
            const ph = this.estimatePH(recipe, true);
            const viscosity = this.estimateViscosity(recipe, 40, true); // عند 40°C للعجين
            
            let bakingEffects = null;
            if (bakingParams) {
                bakingEffects = this.computeBakingEffects({ brix, ph }, bakingParams.temp, bakingParams.time);
            }

            // مؤشر جاهزية الفرد
            const workability = this.assessDoughWorkability(viscosity, ph);

            return {
                brix,
                ph,
                viscosity,
                workability,
                bakingEffects,
                sweetnessIndex: this.calculateSweetnessIndex(recipe)
            };
        },

        // تحليل كيمياء الحشوة الشامل
        estimateFillingChemistry(recipe) {
            const brix = this.estimateBrix(recipe, false);
            const ph = this.estimatePH(recipe, false);
            const viscosity = this.estimateViscosity(recipe, 10, false); // عند 10°C للحشوة
            const waterActivity = this.estimateWaterActivity(recipe);
            const stability = this.assessFillingStability(recipe, viscosity);

            return {
                brix,
                ph,
                viscosity,
                waterActivity,
                stability,
                sweetnessIndex: this.calculateSweetnessIndex(recipe)
            };
        },

        // مؤشر جاهزية العجين للفرد
        assessDoughWorkability(viscosity, ph) {
            if (viscosity.workability === 'excellent' && ph.value >= 6.0 && ph.value <= 7.5) {
                return { ready: true, message: "✓ جاهز للفرد - قوام مثالي", color: "#4CAF50" };
            } else if (viscosity.workability === 'good') {
                return { ready: true, message: "✓ جاهز للفرد - جيد", color: "#8BC34A" };
            } else if (viscosity.workability === 'fair') {
                return { ready: true, message: "⚠ قابل للفرد - يحتاج مجهود", color: "#FFC107" };
            } else {
                return { ready: false, message: "✗ غير جاهز - يحتاج تعديل", color: "#F44336" };
            }
        },

        // تقييم ثبات الحشوة
        assessFillingStability(recipe, viscosity) {
            let score = 50;
            
            // عوامل زيادة الثبات
            if (recipe['cream-cheese'] > 0) score += 20;
            if (recipe['butter'] > 0) score += 15;
            if (recipe['dulce-de-leche'] > 0) score += 10;
            if (viscosity.value > 20000) score += 15;
            
            // عوامل تقليل الثبات
            if (recipe['milk'] > 0) score -= 10;
            if (recipe['whipping-cream'] > 0) score -= 5;
            
            score = Math.max(0, Math.min(100, score));
            
            let level, description;
            if (score >= 80) { level = 'ممتاز'; description = 'ثابت جداً - مثالي للتخزين'; }
            else if (score >= 60) { level = 'جيد'; description = 'ثابت - جيد لمعظم الاستخدامات'; }
            else if (score >= 40) { level = 'متوسط'; description = 'مقبول - استخدم خلال 24 ساعة'; }
            else { level = 'ضعيف'; description = 'غير مستقر - استخدم فوراً'; }

            return { score, level, description };
        },

        // حساب مؤشر الحلاوة (مركزي)
        calculateSweetnessIndex(recipe) {
            const sweetnessPower = {
                'sucrose': 100, 'powdered-sugar': 100, 'sugar': 100,
                'fructose': 173, 'glucose': 74, 'lactose': 16,
                'honey': 110, 'condensed-milk': 65, 'dulce-de-leche': 82, 'caramel': 140
            };
            
            const sugarContent = {
                'powdered-sugar': 1.00, 'sugar': 1.00, 'condensed-milk': 0.55,
                'dulce-de-leche': 0.55, 'caramel': 0.70, 'honey': 0.82,
                'sour-cream': 0.04, 'whipping-cream': 0.03, 'cream-cheese': 0.03,
                'butter': 0.001, 'milk': 0.05, 'egg-yolks': 0.01,
                'flour': 0.01, 'eggs': 0.01, 'soda': 0.00
            };

            let totalSweetness = 0;
            let totalWeight = 0;
            let sugarBreakdown = {};

            for (const [ingredient, weight] of Object.entries(recipe)) {
                const sugar = weight * (sugarContent[ingredient] || 0);
                const power = sweetnessPower[this.getSugarType(ingredient)] || 0;
                
                totalSweetness += sugar * power;
                totalWeight += weight;
                
                // تفصيل مصادر السكريات
                if (sugar > 0) {
                    const sugarType = this.getSugarType(ingredient);
                    sugarBreakdown[sugarType] = (sugarBreakdown[sugarType] || 0) + sugar;
                }
            }

            if (totalWeight === 0) return { index: 0, level: 'غير محلى', breakdown: {} };

            const index = totalSweetness / totalWeight;
            
            return {
                index: parseFloat(index.toFixed(1)),
                percentage: (index).toFixed(1),
                level: this.getSweetnessLevel(index),
                color: this.getSweetnessColor(index),
                breakdown: sugarBreakdown
            };
        },

        getSugarType(ingredient) {
            const mapping = {
                'powdered-sugar': 'sucrose', 'sugar': 'sucrose',
                'condensed-milk': 'condensed-milk', 'dulce-de-leche': 'dulce-de-leche',
                'caramel': 'caramel', 'honey': 'honey',
                'sour-cream': 'lactose', 'whipping-cream': 'lactose', 
                'cream-cheese': 'lactose', 'milk': 'lactose',
                'flour': 'natural', 'eggs': 'natural'
            };
            return mapping[ingredient] || 'sucrose';
        },

        getSweetnessLevel(index) {
            if (index < 10) return 'غير محلى';
            if (index < 20) return 'قليل الحلاوة';
            if (index < 35) return 'متوازن';
            if (index < 50) return 'حلو';
            if (index < 65) return 'حلو جداً';
            return 'مفرط الحلاوة';
        },

        getSweetnessColor(index) {
            if (index < 20) return '#4CAF50';
            if (index < 35) return '#8BC34A';
            if (index < 50) return '#FFC107';
            if (index < 65) return '#FF9800';
            return '#F44336';
        },

        // تقرير التوافق الشامل بين العجين والحشوة
        buildCompatibilityReport(cakeChemistry, fillingChemistry) {
            if (!cakeChemistry || !fillingChemistry) {
                return null;
            }
            
            const cake = cakeChemistry.bakingEffects || cakeChemistry;
            const filling = fillingChemistry;
            
            let compatibilityScore = 100;
            const issues = [];
            const recommendations = [];

            // فحص توافق Brix
            const brixDifference = Math.abs(cake.brix.after - filling.brix.value);
            if (brixDifference > 5) {
                compatibilityScore -= 20;
                issues.push(`فرق Brix كبير: ${brixDifference.toFixed(1)}°`);
                if (cake.brix.after > filling.brix.value) {
                    recommendations.push("الحشوة أقل حلاوة من الكيك - فكر في زيادة سكر الحشوة");
                } else {
                    recommendations.push("الكيك أقل حلاوة من الحشوة - فكر في تقليل سكر الحشوة");
                }
            }

            // فحص توافق الرطوبة
            const awDifference = Math.abs(cake.waterActivity - filling.waterActivity.value);
            if (awDifference > 0.1) {
                compatibilityScore -= 15;
                issues.push(`فرق نشاط مائي: ${awDifference.toFixed(2)}`);
                recommendations.push("اختلاف في محتوى الرطوبة قد يؤثر على نقل الرطوبة بين الطبقات");
            }

            // فحص الثبات
            if (filling.stability.score < 40) {
                compatibilityScore -= 10;
                issues.push("ثبات الحشوة ضعيف");
                recommendations.push("الحشوة قد لا تثبت جيداً - استخدم مكونات مثبتة أكثر");
            }

            // فحص درجة الحموضة
            if (filling.ph.safety === 'danger') {
                compatibilityScore -= 25;
                issues.push("درجة حموضة الحشوة خطيرة");
                recommendations.push("pH الحشوة مرتفع جداً - خطر النشاط الميكروبي");
            }

            compatibilityScore = Math.max(0, Math.min(100, compatibilityScore));

            // تقييم عام
            let overallRating, ratingColor;
            if (compatibilityScore >= 90) {
                overallRating = "ممتاز"; ratingColor = "#4CAF50";
            } else if (compatibilityScore >= 75) {
                overallRating = "جيد جداً"; ratingColor = "#8BC34A";
            } else if (compatibilityScore >= 60) {
                overallRating = "مقبول"; ratingColor = "#FFC107";
            } else if (compatibilityScore >= 40) {
                overallRating = "ضعيف"; ratingColor = "#FF9800";
            } else {
                overallRating = "غير متوافق"; ratingColor = "#F44336";
            }

            return {
                score: Math.round(compatibilityScore),
                rating: overallRating,
                ratingColor,
                issues,
                recommendations,
                estimatedMaturation: filling.waterActivity.maturationTime,
                summary: this.generateCompatibilitySummary(compatibilityScore, issues)
            };
        },

        generateCompatibilitySummary(score, issues) {
            if (score >= 90) return "توافق ممتاز - النتيجة شبه مثالية";
            if (score >= 75) return "توافق جيد - طفيف التعديل يحسن النتيجة";
            if (score >= 60) return "توافق مقبول - بعض التعديلات مطلوبة";
            if (score >= 40) return "توافق ضعيف - تعديلات كبيرة مطلوبة";
            return "غير متوافق - إعادة تصميم شبه مطلوبة";
        },

        // الدوال المضافة حديثاً
        getSugarTypeName(type) {
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
        },

        // دالة مساعدة للتحقق الآمن من الخصائص
        getSafeProperty(obj, path, defaultValue = null) {
            try {
                return path.split('.').reduce((current, key) => current?.[key], obj) || defaultValue;
            } catch (error) {
                return defaultValue;
            }
        }
    };

    // ============================ FILLING SERVICE (UPDATED - NO DUPLICATION) =============================
    const FillingService = {
        // Filling presets database (unchanged)
        PRESETS: {
            'classic-smetana': {
                name: 'سميتانا كلاسيكي',
                baseRecipe: {
                    'sour-cream': 800,
                    'whipping-cream': 400,
                    'powdered-sugar': 120,
                    'vanilla': 9
                },
                density: 1.07,
                defaultThickness: 5,
                characteristics: {
                    sweetness: 35,
                    waterActivity: 0.96,
                    stability: 'medium',
                    maturationTime: '12-24 ساعة'
                }
            },
            'dulce': {
                name: 'دولسي دي ليتشي',
                baseRecipe: {
                    'sour-cream': 600,
                    'dulce-de-leche': 360
                },
                density: 1.14,
                defaultThickness: 4,
                characteristics: {
                    sweetness: 85,
                    waterActivity: 0.80,
                    stability: 'high',
                    maturationTime: '36-48 ساعة'
                }
            },
            'cheese-cream': {
                name: 'جبن كريمي مستقر',
                baseRecipe: {
                    'sour-cream': 300,
                    'whipping-cream': 300,
                    'cream-cheese': 300,
                    'powdered-sugar': 100,
                    'orange-zest': 40
                },
                density: 1.12,
                defaultThickness: 5,
                characteristics: {
                    sweetness: 45,
                    waterActivity: 0.90,
                    stability: 'high',
                    maturationTime: '18-24 ساعة'
                }
            },
            // ... باقي القوالب (نفس الكود الأصلي)
        },

        // استخدام الدوال من ChemistryService بدلاً من التكرار
        calculateSweetnessIndex(recipe) {
            return ChemistryService.calculateSweetnessIndex(recipe);
        },

        calculateWaterActivity(recipe) {
            return ChemistryService.estimateWaterActivity(recipe);
        },

        getMoistureTransferRate(aw) {
            return ChemistryService.getMoistureTransferRate(aw);
        },

        getMaturationTime(aw) {
            return ChemistryService.getMaturationTime(aw);
        },

        // Smart scaling with sweetness adjustment
        scaleWithSweetnessAdjustment(baseRecipe, targetWeight, sweetnessReduction = 0) {
            const baseTotal = Object.values(baseRecipe).reduce((a,b) => a+b, 0);
            if (baseTotal === 0) {
                return { error: "إجمالي وزن الحشو الأساسي هو صفر" };
            }
            
            const scaleFactor = targetWeight / baseTotal;
            
            // Calculate sugar reduction factor
            let sugarReduction = 1 - (sweetnessReduction / 100);
            
            // Smart sugar reduction based on scale
            if (scaleFactor > 1) {
                // When scaling up, automatically reduce sweetness slightly
                const autoReduction = Math.max(0.75, 1 - (scaleFactor - 1) * 0.05);
                sugarReduction *= autoReduction;
            }
            
            const scaledRecipe = {};
            const sweetIngredients = ['powdered-sugar', 'sugar', 'condensed-milk', 
                                     'dulce-de-leche', 'honey', 'caramel'];
            
            for (const [ingredient, amount] of Object.entries(baseRecipe)) {
                if (sweetIngredients.includes(ingredient)) {
                    // Apply reduction to sweet ingredients
                    scaledRecipe[ingredient] = amount * scaleFactor * sugarReduction;
                    
                    // Compensate with other ingredients
                    const reduction = amount * scaleFactor * (1 - sugarReduction);
                    
                    if (ingredient === 'condensed-milk') {
                        scaledRecipe['sour-cream'] = (scaledRecipe['sour-cream'] || 0) + reduction * 0.7;
                        scaledRecipe['butter'] = (scaledRecipe['butter'] || 0) + reduction * 0.3;
                    } else if (ingredient === 'dulce-de-leche' || ingredient === 'caramel') {
                        scaledRecipe['cream-cheese'] = (scaledRecipe['cream-cheese'] || 0) + reduction * 0.6;
                        scaledRecipe['butter'] = (scaledRecipe['butter'] || 0) + reduction * 0.4;
                    } else if (ingredient === 'powdered-sugar' || ingredient === 'sugar') {
                        scaledRecipe['whipping-cream'] = (scaledRecipe['whipping-cream'] || 0) + reduction;
                    }
                } else {
                    scaledRecipe[ingredient] = amount * scaleFactor;
                }
            }
            
            return {
                recipe: scaledRecipe,
                originalSweetness: ChemistryService.calculateSweetnessIndex(baseRecipe),
                newSweetness: ChemistryService.calculateSweetnessIndex(scaledRecipe),
                reductionApplied: (1 - sugarReduction) * 100
            };
        },

        // Calculate stability score
        calculateStability(recipe) {
            // Use ChemistryService for consistency
            const viscosity = ChemistryService.estimateViscosity(recipe, 10, false);
            return ChemistryService.assessFillingStability(recipe, viscosity);
        },

        // Get preparation protocol (unchanged)
        getPreparationProtocol(presetId) {
            const protocols = {
                'classic-smetana': {
                    totalTime: '15 دقيقة',
                    difficulty: 'سهل',
                    steps: [
                        {
                            name: 'التحضير المسبق',
                            duration: '10 دقائق',
                            temp: '4-6°C',
                            actions: [
                                'برّد وعاء الخلط والمضرب في الفريزر 10 دقائق',
                                'تأكد من برودة جميع المكونات (4-6°C)'
                            ]
                        },
                        {
                            name: 'الخفق',
                            duration: '3-5 دقائق',
                            temp: '8-10°C',
                            technique: 'خفق تدريجي',
                            actions: [
                                'ابدأ بسرعة منخفضة 30 ثانية',
                                'ارفع للسرعة المتوسطة حتى التجانس',
                                'أضف السكر تدريجياً',
                                'اخفق على سرعة عالية حتى القمم المتوسطة'
                            ],
                            warnings: ['لا تفرط في الخفق لتجنب التحبب']
                        }
                    ]
                },
                // ... باقي البروتوكولات (نفس الكود الأصلي)
            };
            
            return protocols[presetId] || null;
        }
    };
    
    // ============================ STORAGE SERVICE =============================
    const StorageService = {
        STORAGE_KEY: 'medovik_recipes_v4',
        
        loadRecipes() {
            try { 
                return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; 
            } catch (e) { 
                console.error('Failed to load recipes:', e);
                return []; 
            }
        },
        
        saveAll(recipes) {
            try { 
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recipes)); 
                return true; 
            } catch (e) { 
                console.error('Failed to save recipes:', e);
                return false; 
            }
        },
        
        add(recipe) {
            const recipes = this.loadRecipes();
            recipe.id = Date.now(); 
            recipe.createdAt = new Date().toISOString();
            recipes.unshift(recipe);
            this.saveAll(recipes); 
            return recipes;
        },
        
        delete(id) {
            let recipes = this.loadRecipes();
            recipes = recipes.filter(r => r.id !== id);
            this.saveAll(recipes); 
            return recipes;
        }
    };

    // Export everything to window
    window.MedovikCalculatorCore = {
        CONSTANTS, 
        ValidationService,    // <-- خدمة التحقق الجديدة
        SecurityService, 
        ParserService, 
        AnalysisService, 
        TemperingService, 
        ScalingService,
        FillingService,
        ChemistryService,     // <-- الخدمة المركزية للكيمياء
        StorageService
    };
})(window);