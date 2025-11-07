// ===================================================================================
// CORE.JS - The Scientific Brain of the Medovik Calculator (Updated)
//
// Responsibilities:
// 1. All scientific and mathematical calculations.
// 2. Data processing, parsing, and analysis logic.
// 3. Security validation and sanitization.
// 4. Storage management (localStorage).
// 5. Filling system with sweetness analysis and smart scaling.
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
            DEFAULT_TIME: 7,  // Updated from 8
            DEFAULT_TEMP: 180
        },
        FILLING: { 
            DENSITY: 1.1 
        },
        AVERAGE_DOUGH_DENSITY: 1.25,
        DEFAULT_AIR_FACTOR: 0.03  // Reduced for Medovik
    };

    // ============================ SECURITY SERVICE =============================
    const SecurityService = {
        validateRecipe(recipe) {
            const errors = [];
            const limits = {
                flour: { min: 0, max: 10000 }, 
                butter: { min: 0, max: 5000 },
                sugar: { min: 0, max: 5000 }, 
                honey: { min: 0, max: 5000 },
                eggs: { min: 0, max: 5000 }, 
                soda: { min: 0, max: 100 }
            };

            for (const [key, value] of Object.entries(recipe)) {
                if (!limits[key]) continue;
                if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
                    errors.push(`- ${key}: قيمة غير صالحة.`);
                    continue;
                }
                if (value < limits[key].min || value > limits[key].max) {
                    errors.push(`- ${key}: قيمة غير واقعية (يجب أن تكون بين ${limits[key].min} و ${limits[key].max}).`);
                }
            }
            
            // Check soda ratio
            if (recipe.flour > 0 && recipe.soda > 0) {
                const sodaRatio = (recipe.soda / recipe.flour) * 100;
                if (sodaRatio > 2) {
                    errors.push(`- تحذير: نسبة الصودا عالية جداً (${sodaRatio.toFixed(1)}% من الدقيق) - قد تسبب طعماً قلوياً.`);
                }
            }
            
            return { valid: errors.length === 0, errors };
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
            
            return ingredients;
        }
    };
    
    // ============================ ANALYSIS SERVICE =============================
    const AnalysisService = {
        analyzeRecipe(recipe) {
            const validation = SecurityService.validateRecipe(recipe);
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
                moistureLoss: moistureLoss.toFixed(1),
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

    // ============================ SCALING SERVICE =============================
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
            const area = this.getPanArea(shape, dim1, dim2);
            if (area === 0) return null;
            const fillingLayers = layerCount > 1 ? layerCount - 1 : 1;
            const requiredWeight = area * (thickness / 10) * fillingLayers * CONSTANTS.FILLING.DENSITY;
            const baseTotalWeight = Object.values(baseFilling).reduce((s, v) => s + v, 0);
            if (baseTotalWeight === 0) return null;
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

    // ============================ FILLING SERVICE (NEW) =============================
    const FillingService = {
        // Filling presets database
        PRESETS: {
            // ==================== 1. CLASSIC SOUR CREAM ====================
            'classic-sour-cream': {
                name: 'كريمة حامضة كلاسيكية (Classic Sour Cream)',
                nameEn: 'Classic Sour Cream Filling',
                scientificName: 'Stabilized Cultured Cream Emulsion',
                origin: 'روسيا التقليدية',
                
                baseRecipe: {
                    'sour-cream-30': {
                        amount: 800,
                        nameAr: 'كريمة حامضة 30% دسم',
                        nameEn: 'Sour Cream 30% fat',
                        temp: 4,
                        fatContent: 30,
                        requiredPrep: 'تصفية 6-8 ساعات في قماش موسلين',
                        expectedLoss: 100,  // جرام بعد التصفية
                        brand: 'President أو Danone',
                        warning: 'يجب أن تكون مصفاة جيداً لمنع الانفصال'
                    },
                    'heavy-cream-35': {
                        amount: 400,
                        nameAr: 'كريمة خفق ثقيلة 35%',
                        nameEn: 'Heavy Whipping Cream 35% fat',
                        temp: 2,
                        fatContent: 35,
                        requiredPrep: 'مباشرة من الثلاجة، لا تترك خارجاً',
                        brand: 'Elle & Vire أو Anchor',
                        warning: 'يجب أن تكون باردة جداً (<4°C)'
                    },
                    'powdered-sugar-fine': {
                        amount: 120,
                        nameAr: 'سكر بودرة ناعم منخول',
                        nameEn: 'Powdered Sugar (Confectioners)',
                        temp: 20,
                        meshSize: 200,
                        requiredPrep: 'نخل مرتين قبل الاستخدام',
                        warning: 'لا تستخدم سكر بودرة يحتوي نشا'
                    },
                    'vanilla-extract': {
                        amount: 5,
                        unit: 'ml',
                        nameAr: 'خلاصة فانيليا نقية',
                        nameEn: 'Pure Vanilla Extract',
                        temp: 20,
                        type: 'طبيعي 100%، ليس صناعي',
                        additionStage: 'final',
                        warning: 'أضف في النهاية لعدم فقدان الرائحة'
                    }
                },
                
                // الخصائص الفيزيوكيميائية المستهدفة
                targetProperties: {
                    density: 1.05,                          // g/cm³ at 4°C
                    viscosity: {min: 18000, max: 22000},    // cP (Centipoise) at 4°C
                    pH: {min: 4.3, max: 4.5},               // حموضة طبيعية
                    brix: {min: 28, max: 30},               // درجة الحلاوة (°Brix)
                    waterActivity: 0.96,                     // aw (نشاط الماء)
                    fatContent: {min: 28, max: 30},         // % دهون إجمالية
                    totalSolids: {min: 42, max: 45},        // % مواد صلبة
                    stability: 'medium',
                    shelfLife: 72,                          // ساعات عند 4°C
                    maturationTime: {min: 12, max: 24},     // ساعات
                    spreadability: 'soft',                   // قوام الفرد
                    setTime: 2                               // ساعات للتماسك
                },
                
                // معايير الجودة الحسية
                sensoryTargets: {
                    texture: {
                        visual: 'حريري لامع، أبيض كريمي ناصع',
                        mouthfeel: 'ناعم كالحرير، يذوب ببطء دون حبيبات',
                        structure: 'قمة متوسطة (Medium Peak) - تنحني 45° ثم تثبت',
                        spreadTest: 'ينساب بسلاسة بدون مقاومة'
                    },
                    taste: {
                        sweetness: 'متوازن - ليس مفرط الحلاوة (7/10)',
                        acidity: 'حموضة خفيفة منعشة من السور كريم',
                        aftertaste: 'نظيف بدون طعم دهني',
                        balance: 'توازن مثالي حلو-حامض'
                    },
                    aroma: {
                        primary: 'كريمة طازجة مخمرة',
                        secondary: 'فانيليا خفيفة',
                        overall: 'نظيف بدون روائح غريبة'
                    },
                    appearance: {
                        color: 'أبيض ناصع إلى كريمي خفيف (#FFFEF0)',
                        shine: 'لمعان حريري خفيف',
                        uniformity: 'متجانس تماماً بدون خطوط أو كتل'
                    },
                    stability: {
                        roomTemp: '30 دقيقة دون انفصال عند 20-22°C',
                        refrigerated: '6 ساعات دون انفصال عند 4°C',
                        afterWhipping: 'لا تحبب، لا انفصال سوائل'
                    }
                },
                
                // الأدوات المطلوبة
                requiredEquipment: {
                    essential: [
                        {
                            name: 'خلاط كهربائي بقاعدة (Stand Mixer)',
                            specs: 'قوة 300 واط كحد أدنى',
                            attachment: 'مضرب سلكي (Whisk)',
                            speedRange: '150-320 RPM'
                        },
                        {
                            name: 'وعاء خلط معدني (ستانلس ستيل)',
                            specs: 'سعة 3-4 لتر',
                            reason: 'توصيل حرارة أفضل + إمكانية التبريد السريع'
                        },
                        {
                            name: 'ميزان حرارة رقمي',
                            specs: 'دقة ±0.5°C',
                            range: '-10°C إلى 100°C',
                            critical: true
                        },
                        {
                            name: 'قماش موسلين أو شاش طبي',
                            specs: 'للتصفية',
                            size: '50×50 سم على الأقل'
                        },
                        {
                            name: 'مصفاة شبكية ناعمة',
                            specs: 'قطر 20 سم'
                        },
                        {
                            name: 'سباتولا سيليكون',
                            specs: 'مقاومة حرارة، مرنة'
                        }
                    ],
                    optional: [
                        {
                            name: 'Viscometer (مقياس اللزوجة)',
                            specs: 'Brookfield DV-II+',
                            use: 'قياس دقيق للزوجة (18000-22000 cP)'
                        },
                        {
                            name: 'pH Meter',
                            specs: 'دقة ±0.01',
                            use: 'قياس الحموضة (4.3-4.5)'
                        },
                        {
                            name: 'Refractometer',
                            specs: 'Brix 0-50°',
                            use: 'قياس درجة الحلاوة (28-30°Brix)'
                        },
                        {
                            name: 'ميزان ديجيتال دقيق',
                            specs: 'دقة 0.1 جرام'
                        }
                    ]
                },
                
                defaultThickness: 5,              // mm
                needsCooking: false,
                difficultyLevel: 3,               // من 10
                yieldAmount: 1100,                // جرام (بعد التصفية)
                servings: 'يكفي لـ8-10 طبقات 24 سم',
                
                // نقاط التحكم الحرجة (Critical Control Points)
                criticalControlPoints: [
                    {
                        step: 'تصفية السور كريم',
                        hazard: 'عدم التصفية الكافية → انفصال بعد ساعات',
                        control: 'تصفية 6-8 ساعات حتى فقد 100-150جم سوائل',
                        limit: 'وزن نهائي 650-700جم من 800جم أولي',
                        verification: 'اختبار القوام: يجب أن تكون كثيفة كالزبادي اليوناني',
                        correctiveAction: 'إذا كانت سائلة: صفِّ 2-3 ساعات إضافية'
                    },
                    {
                        step: 'درجة حرارة المكونات',
                        hazard: 'حرارة >10°C → انفصال الدهون عن الماء',
                        control: 'قياس كل مكون بميزان الحرارة',
                        limit: 'سور كريم: 4-6°C | كريمة خفق: 2-4°C | وعاء: <5°C',
                        verification: 'لمس الوعاء = بارد جداً للمس',
                        correctiveAction: 'برّد الوعاء في الفريزر 10 دقائق إضافية'
                    },
                    {
                        step: 'الخفق - نقطة التوقف',
                        hazard: 'Over-whipping → تحبب وتحول لزبدة',
                        control: 'مراقبة بصرية كل 30 ثانية بعد الدقيقة 6',
                        limit: 'توقف عند Medium Peak (القمة تنحني 45°)',
                        verification: 'رفع المضرب: القمة تقف ثم تنحني ببطء',
                        correctiveAction: 'إذا تحببت: أضف 50-75مل كريمة سائلة باردة واخفق 20 ثانية'
                    },
                    {
                        step: 'درجة الحرارة أثناء الخفق',
                        hazard: 'ارتفاع حرارة المزيج >12°C → فقدان الثبات',
                        control: 'قياس كل 3 دقائق',
                        limit: '8-10°C طوال الوقت',
                        verification: 'ميزان حرارة في وسط المزيج',
                        correctiveAction: 'ضع الوعاء في حمام ثلجي 2-3 دقائق'
                    }
                ],
                
                // مؤشرات الفشل ونقاط الإنقاذ
                failureIndicators: {
                    'separation': {
                        sign: 'ظهور ماء في القاع',
                        cause: 'سور كريم غير مصفى كفاية',
                        rescue: 'صفِّ المزيج عبر قماش موسلين 1-2 ساعة'
                    },
                    'curdling': {
                        sign: 'حبيبات صغيرة + سطح مطفي',
                        cause: 'خفق زائد',
                        rescue: 'أضف 50مل كريمة باردة + اخفق 20 ثانية برفق'
                    },
                    'too-soft': {
                        sign: 'سائل جداً، لا يمسك شكله',
                        cause: 'نقص خفق أو سور كريم رقيق',
                        rescue: 'اخفق 1-2 دقيقة إضافية أو أضف 100جم سور كريم مصفى'
                    },
                    'too-stiff': {
                        sign: 'صلب جداً، صعب الفرد',
                        cause: 'خفق زائد أو سور كريم كثيف جداً',
                        rescue: 'أضف 2-3 ملاعق كريمة سائلة واطوِ بملعقة'
                    }
                }
            },
        
            // ==================== 2. DULCE DE LECHE CARAMEL ====================
            'dulce-caramel': {
                name: 'كراميل دولسي دي ليتشي (Dulce de Leche)',
                nameEn: 'Dulce de Leche Caramel Filling',
                scientificName: 'Maillard Caramelized Dairy Emulsion',
                origin: 'الأرجنتين',
                
                baseRecipe: {
                    'sour-cream-30': {
                        amount: 600,
                        nameAr: 'كريمة حامضة 30% مصفاة',
                        temp: 4,
                        fatContent: 30,
                        requiredPrep: 'تصفية 6-8 ساعات',
                        expectedLoss: 75,
                        warning: 'يجب أن تكون كثيفة جداً'
                    },
                    'dulce-de-leche-authentic': {
                        amount: 360,
                        nameAr: 'دولسي دي ليتشي أصلي',
                        nameEn: 'Authentic Dulce de Leche',
                        temp: 18,  // ⚠️ مهم جداً - ليست باردة!
                        brand: 'La Serenísima (أرجنتيني) أو Nestlé La Lechera Repostero',
                        solidsContent: 70,  // % مواد صلبة
                        color: '#B8860B (Dark Golden)',
                        requiredPrep: 'خفق منفرد 3 دقائق عند 180 RPM',
                        warning: 'إذا كان بارداً سيكون صلباً جداً ويصعب دمجه'
                    },
                    'sea-salt-fine': {
                        amount: 2,
                        nameAr: 'ملح بحري ناعم',
                        temp: 20,
                        purpose: 'موازنة الحلاوة + تعزيز النكهة',
                        additionStage: 'with-dulce',
                        warning: 'لا تزد الكمية - الملح الزائد يفسد التوازن'
                    },
                    'lemon-juice-fresh': {
                        amount: 5,
                        unit: 'ml',
                        nameAr: 'عصير ليمون طازج',
                        temp: 20,
                        purpose: 'تعديل pH ومنع الحلاوة المفرطة',
                        additionStage: 'final',
                        warning: 'يجب أن يكون طازجاً، ليس معلباً'
                    }
                },
                
                targetProperties: {
                    density: 1.14,
                    viscosity: {min: 25000, max: 30000},  // أعلى من السور كريم
                    pH: {min: 4.5, max: 4.7},
                    brix: {min: 32, max: 35},  // أحلى
                    waterActivity: 0.80,  // منخفض = ثبات عالي
                    fatContent: {min: 22, max: 24},
                    totalSolids: {min: 48, max: 52},
                    stability: 'high',
                    shelfLife: 120,  // 5 أيام
                    maturationTime: {min: 36, max: 48},
                    spreadability: 'medium-firm',
                    setTime: 4
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'كريمي سميك، بيج كراميلي موحد',
                        mouthfeel: 'غني ومخملي، يغطي اللسان',
                        structure: 'يترك أثراً 3 ثواني عند الفرد',
                        spreadTest: 'يحتاج ضغط معتدل للفرد'
                    },
                    taste: {
                        sweetness: 'حلو جداً مع عمق كراميل (8/10)',
                        acidity: 'حموضة خفيفة موازنة',
                        caramelDepth: 'كراميل عميق من تفاعل Maillard',
                        saltyNote: 'ملوحة خفيفة جداً تعزز الحلاوة',
                        aftertaste: 'كراميل طويل الأمد'
                    },
                    aroma: {
                        primary: 'كراميل حليب محمص',
                        secondary: 'فانيليا طبيعية من الدولسي',
                        overall: 'دافئ ومريح'
                    },
                    appearance: {
                        color: 'بيج كراميلي (#D2B48C) موحد',
                        shine: 'لمعان خفيف',
                        uniformity: 'بدون خطوط بيضاء من السور كريم'
                    },
                    stability: {
                        roomTemp: '1 ساعة عند 20-22°C بدون انفصال',
                        refrigerated: '8 ساعات دون انفصال',
                        afterWhipping: 'ثابت جداً'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'Stand Mixer',
                            attachment: 'Paddle (مجداف) ثم Whisk',
                            speedRange: '120-200 RPM'
                        },
                        {
                            name: 'وعاء ستانلس 2 لتر',
                            reason: 'حجم مناسب للكمية'
                        },
                        {
                            name: 'ميزان حرارة',
                            critical: 'لقياس حرارة الدولسي (18-20°C)'
                        },
                        {
                            name: 'سباتولا قوية',
                            reason: 'للكشط والدمج'
                        }
                    ],
                    optional: [
                        {
                            name: 'Thermometer Gun',
                            use: 'قياس سريع لسطح الدولسي'
                        }
                    ]
                },
                
                defaultThickness: 4,
                needsCooking: false,
                difficultyLevel: 5,
                yieldAmount: 920,
                servings: 'يكفي لـ8 طبقات 24 سم',
                
                criticalControlPoints: [
                    {
                        step: 'تجهيز الدولسي',
                        hazard: 'دولسي بارد → كتل صلبة لا تذوب',
                        control: 'درجة حرارة 18-20°C (ملمس: ينساب ببطء)',
                        limit: 'اختبار السكب: ينسكب بسلاسة من الملعقة',
                        verification: 'خفق منفرد 3 دقائق → زيادة حجم 15-20%',
                        correctiveAction: 'سخّن في حمام مائي 40°C مع التحريك'
                    },
                    {
                        step: 'الدمج مع السور كريم',
                        hazard: 'إضافة سور كريم بارد جداً → صلابة',
                        control: 'سور كريم عند 6-8°C (ليس 4°C)',
                        limit: 'دمج تدريجي على 3 دفعات',
                        verification: 'لون موحد بدون خطوط بيضاء',
                        correctiveAction: 'اخفق لمدة أطول حتى التجانس'
                    },
                    {
                        step: 'الخفق النهائي',
                        hazard: 'خفق زائد → انفصال الدولسي',
                        control: 'سرعة منخفضة (120 RPM) فقط',
                        limit: 'توقف فور التجانس الكامل',
                        verification: 'قوام كريمي سميك موحد',
                        correctiveAction: 'لا يوجد - الوقاية فقط'
                    }
                ],
                
                failureIndicators: {
                    'dulce-lumps': {
                        sign: 'كتل دولسي صلبة',
                        cause: 'دولسي بارد أو لم يُخفق كفاية',
                        rescue: 'صفِّ المزيج، سخّن الكتل في حمام مائي، أعد الدمج'
                    },
                    'separation': {
                        sign: 'انفصال طبقة سائلة',
                        cause: 'سور كريم غير مصفى',
                        rescue: 'صفِّ وأعد الخفق مع 50جم سور كريم كثيف'
                    }
                }
            },
        
            // ==================== 3. CREAM CHEESE HONEY (with Gelatin) ====================
            'cream-cheese-honey': {
                name: 'جبن كريمي بالعسل والجيلاتين',
                nameEn: 'Cream Cheese Honey with Gelatin',
                scientificName: 'Gelatin-Stabilized Cheese Mousse',
                origin: 'حديث - تطوير احترافي',
                
                baseRecipe: {
                    'cream-cheese-full-fat': {
                        amount: 400,
                        nameAr: 'جبن كريمي كامل الدسم',
                        nameEn: 'Full-Fat Cream Cheese',
                        temp: 18,  // ⚠️ ليس بارداً!
                        fatContent: 33,
                        brand: 'Philadelphia أو Kiri',
                        requiredPrep: '15-20 دقيقة خارج الثلاجة',
                        warning: 'يجب أن يكون طرياً بدرجة حرارة الغرفة'
                    },
                    'mascarpone': {
                        amount: 200,
                        nameAr: 'ماسكربوني',
                        nameEn: 'Mascarpone',
                        temp: 18,
                        fatContent: 40,
                        brand: 'Galbani أو BelGioioso',
                        requiredPrep: '15-20 دقيقة خارج الثلاجة',
                        warning: 'يجب أن يكون بنفس حرارة الجبن الكريمي'
                    },
                    'heavy-cream-35': {
                        amount: 300,
                        nameAr: 'كريمة خفق ثقيلة 35%',
                        temp: 2,
                        fatContent: 35,
                        requiredPrep: 'تُخفق منفصلة لـSoft Peak',
                        warning: 'يجب خفقها قبل الدمج'
                    },
                    'honey-raw': {
                        amount: 80,
                        nameAr: 'عسل طبيعي خام',
                        nameEn: 'Raw Natural Honey',
                        temp: 22,
                        type: 'عسل زهور (ليس متبلوراً)',
                        viscosity: 'سائل',
                        requiredPrep: 'إذا كان متبلوراً: سخّن 40°C حتى يذوب',
                        warning: 'لا تسخن فوق 45°C (يفقد الأنزيمات)'
                    },
                    'powdered-sugar-fine': {
                        amount: 60,
                        nameAr: 'سكر بودرة',
                        temp: 20,
                        requiredPrep: 'منخول'
                    },
                    'gelatin-sheets': {
                        amount: 4,
                        nameAr: 'جيلاتين ورقي',
                        nameEn: 'Gelatin Sheets',
                        bloom: 200,  // قوة الجيلاتين
                        type: 'Gold/Platinum',
                        soakTime: 5,  // دقائق في ماء بارد
                        soakTemp: 4,
                        meltTemp: {min: 50, max: 55},
                        useTemp: 35,  // ⚠️ حرج جداً
                        warning: '🔴 الأهم: لا تتجاوز 60°C (يفقد القوة)'
                    },
                    'water-gelatin': {
                        amount: 20,
                        unit: 'ml',
                        nameAr: 'ماء للنقع',
                        temp: 4
                    }
                },
                
                targetProperties: {
                    density: 1.12,
                    viscosity: {min: 35000, max: 42000},  // الأعلى (بسبب الجيلاتين)
                    pH: {min: 4.6, max: 4.8},
                    brix: {min: 30, max: 32},
                    waterActivity: 0.90,
                    fatContent: {min: 32, max: 35},
                    totalSolids: {min: 50, max: 54},
                    stability: 'very-high',
                    shelfLife: 168,  // 7 أيام
                    maturationTime: {min: 12, max: 16},
                    setTime: 4,  // ساعات للتماسك الكامل
                    spreadability: 'firm',
                    thermalStability: '18-22°C لـ4 ساعات'
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'موس كثيف، كريمي ذهبي فاتح',
                        mouthfeel: 'حريري ناعم، يذوب ببطء',
                        structure: 'موس كثيف (Dense Mousse) - ارتداد 85%',
                        spreadTest: 'قطع نظيف بالسكين الساخن'
                    },
                    taste: {
                        sweetness: 'متوازن مع عمق عسل (7/10)',
                        acidity: 'حموضة جبن خفيفة',
                        honeyNote: 'عسل طبيعي واضح',
                        creamCheese: 'جبن كريمي غني',
                        aftertaste: 'عسل طويل الأمد'
                    },
                    aroma: {
                        primary: 'جبن كريمي طازج',
                        secondary: 'عسل زهور طبيعي',
                        overall: 'غني ومريح'
                    },
                    appearance: {
                        color: 'كريمي ذهبي فاتح (#FFF8DC)',
                        shine: 'مطفي ناعم',
                        uniformity: 'متجانس تماماً'
                    },
                    stability: {
                        roomTemp: '4 ساعات عند 18-22°C بدون ذوبان',
                        refrigerated: 'أسبوع كامل بدون انفصال',
                        structural: 'يحتفظ بالشكل عند التقطيع'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'Stand Mixer',
                            attachment: 'Paddle + Whisk',
                            speedRange: '100-250 RPM'
                        },
                        {
                            name: 'وعاءين منفصلين',
                            reason: 'واحد للأجبان، واحد للكريمة'
                        },
                        {
                            name: 'قدر صغير',
                            use: 'إذابة الجيلاتين'
                        },
                        {
                            name: 'ميزان حرارة دقيق',
                            specs: 'دقة ±0.5°C',
                            critical: '🔴 حرج جداً للجيلاتين'
                        },
                        {
                            name: 'سباتولا سيليكون كبيرة',
                            use: 'الطي اليدوي للكريمة'
                        }
                    ]
                },
                
                defaultThickness: 5,
                needsCooking: true,  // للجيلاتين فقط
                difficultyLevel: 7,
                yieldAmount: 1020,
                servings: 'يكفي لـ8-9 طبقات 24 سم',
                
                criticalControlPoints: [
                    {
                        step: 'نقع الجيلاتين',
                        hazard: 'ماء دافئ → ذوبان مبكر غير متحكم فيه',
                        control: 'ماء مثلج 4°C بالضبط',
                        limit: 'نقع 5 دقائق بالضبط (لا أكثر)',
                        verification: 'الجيلاتين يصبح مطاطياً طرياً',
                        correctiveAction: 'إذا ذاب جزئياً: تخلص منه واستخدم جديد'
                    },
                    {
                        step: 'إذابة الجيلاتين',
                        hazard: '>60°C → فقدان 30-50% من القوة',
                        control: 'قياس مستمر بميزان الحرارة',
                        limit: '50-55°C فقط',
                        verification: 'سائل شفاف بدون حبيبات',
                        correctiveAction: 'إذا تجاوز 60°C: أضف 2 ورقة جيلاتين إضافية'
                    },
                    {
                        step: 'تبريد الجيلاتين',
                        hazard: 'ساخن → يطبخ الأجبان | بارد → يتصلب قبل الدمج',
                        control: 'تبريد دقيق لـ35°C بالضبط',
                        limit: '33-37°C (نافذة ضيقة)',
                        verification: 'دافئ للمس، سائل تماماً',
                        correctiveAction: 'إذا تصلب: سخّن مرة أخرى لـ50°C'
                    },
                    {
                        step: 'دمج الجيلاتين مع الأجبان',
                        hazard: 'أجبان باردة → تصلب فوري للجيلاتين (كتل)',
                        control: 'أجبان عند 18-20°C',
                        limit: 'دمج فوري مع خفق سريع 100 RPM',
                        verification: 'لا كتل جيلاتين، خليط متجانس',
                        correctiveAction: 'إذا ظهرت كتل: صفِّ فوراً وأعد الخفق'
                    },
                    {
                        step: 'دمج الكريمة المخفوقة',
                        hazard: 'خفق → فقدان الهواء (قوام كثيف ثقيل)',
                        control: 'طي يدوي فقط بسباتولا',
                        limit: 'حركة من الأسفل للأعلى فقط',
                        verification: 'قوام موس خفيف',
                        correctiveAction: 'لا يمكن الإصلاح - الوقاية فقط'
                    }
                ],
                
                failureIndicators: {
                    'gelatin-lumps': {
                        sign: 'كتل جيلاتين مطاطية',
                        cause: 'دمج مع أجبان باردة',
                        rescue: 'صفِّ وأعد تسخين الجيلاتين'
                    },
                    'too-firm': {
                        sign: 'صلب كالجبن',
                        cause: 'جيلاتين زائد',
                        rescue: 'اخلط مع 100جم ماسكربوني طري'
                    },
                    'too-soft': {
                        sign: 'لا يتماسك بعد 4 ساعات',
                        cause: 'جيلاتين تالف أو محموم',
                        rescue: 'أضف 2-3 ورقات جيلاتين مذابة عند 35°C'
                    }
                }
            },
        
            // ==================== 4. CUSTARD BUTTER CREAM ====================
            'custard-butter': {
                name: 'كاسترد بالزبدة (Pastry Cream)',
                nameEn: 'Custard Butter Cream',
                scientificName: 'Starch-Stabilized Egg Custard Emulsion',
                origin: 'فرنسا الكلاسيكية',
                
                baseRecipe: {
                    'whole-milk': {
                        amount: 450,
                        nameAr: 'حليب كامل الدسم',
                        nameEn: 'Whole Milk 3.5% fat',
                        temp: 4,  // بارد عند البدء
                        fatContent: 3.5,
                        brand: 'Nadec أو Almarai كامل الدسم',
                        requiredPrep: 'قياس دقيق، بارد من الثلاجة',
                        warning: 'لا تستخدم حليب قليل الدسم - سيكون رقيقاً'
                    },
                    'egg-yolks-large': {
                        amount: 150,
                        nameAr: 'صفار بيض كبير',
                        nameEn: 'Large Egg Yolks',
                        temp: 20,  // حرارة الغرفة
                        count: '6-7 صفار',
                        weight: '22-25 جم للصفار الواحد',
                        requiredPrep: 'فصل دقيق بدون أي بياض',
                        warning: '⚠️ أي أثر لبياض البيض سيسبب تخثر'
                    },
                    'granulated-sugar': {
                        amount: 120,
                        nameAr: 'سكر حبيبات ناعم',
                        nameEn: 'Granulated Sugar',
                        temp: 20,
                        purpose: 'تحلية + حماية الصفار من التخثر',
                        warning: 'لا تستبدل بسكر بودرة (يحتوي نشا)'
                    },
                    'cornstarch': {
                        amount: 50,
                        nameAr: 'نشا ذرة نقي',
                        nameEn: 'Pure Cornstarch',
                        temp: 20,
                        type: '100% نشا ذرة (ليس كاسترد مسحوق)',
                        requiredPrep: 'منخول مرتين',
                        purpose: 'تثبيت البنية ومنع التخثر',
                        warning: 'النشا المتكتل سيسبب كتل'
                    },
                    'unsalted-butter': {
                        amount: 180,
                        nameAr: 'زبدة غير مملحة',
                        nameEn: 'Unsalted Butter',
                        temp: 20,  // طرية
                        fatContent: 82,
                        requiredPrep: 'مقطعة مكعبات 2سم، طرية',
                        brand: 'Président أو Lurpak',
                        warning: 'تُضاف للكاسترد الساخن (85°C)'
                    },
                    'vanilla-bean-pod': {
                        amount: 1,
                        unit: 'قرن',
                        nameAr: 'قرن فانيليا طبيعي',
                        nameEn: 'Vanilla Bean Pod',
                        temp: 20,
                        requiredPrep: 'شق بالطول + كشط البذور',
                        alternative: '50مل خلاصة فانيليا نقية',
                        warning: 'القرن يُنقع في الحليب الساخن'
                    }
                },
                
                targetProperties: {
                    density: 1.04,
                    viscosity: {min: 15000, max: 20000},  // كثيف لكن ليس كالموس
                    pH: {min: 6.2, max: 6.5},  // قريب من الحيادية
                    brix: {min: 26, max: 28},
                    waterActivity: 0.92,
                    fatContent: {min: 18, max: 22},  // من الزبدة + الحليب + الصفار
                    totalSolids: {min: 38, max: 42},
                    stability: 'high',
                    shelfLife: 72,  // 3 أيام بالثلاجة
                    maturationTime: {min: 24, max: 24},  // يوم واحد
                    setTime: 2,  // ساعتين بالثلاجة
                    cookingTemp: {min: 82, max: 85},  // ⚠️ نطاق ضيق جداً
                    spreadability: 'soft-medium',
                    thermalStability: 'medium'
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'كريمي أصفر فاتح، أملس تماماً',
                        mouthfeel: 'ناعم حريري، يذوب فوراً',
                        structure: 'كاسترد سميك - يغطي ظهر الملعقة',
                        spreadTest: 'ينساب بسلاسة عند 8-10°C'
                    },
                    taste: {
                        sweetness: 'متوازن، ليس مفرط (6/10)',
                        eggyNote: 'خفيف جداً (بسبب النشا)',
                        butterRichness: 'غني بطعم الزبدة',
                        vanillaDepth: 'فانيليا عميقة من القرن',
                        aftertaste: 'نظيف كريمي'
                    },
                    aroma: {
                        primary: 'فانيليا طبيعية قوية',
                        secondary: 'حليب دافئ + زبدة',
                        overall: 'دافئ ومريح'
                    },
                    appearance: {
                        color: 'أصفر كريمي فاتح (#FFFACD)',
                        shine: 'لمعان زبدي',
                        uniformity: 'أملس تماماً بدون كتل',
                        thickness: 'يسقط من الملعقة ببطء'
                    },
                    stability: {
                        roomTemp: '1 ساعة عند 20°C',
                        refrigerated: '3 أيام بدون انفصال',
                        structural: 'يحتفظ بالقوام'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'قدر ستانلس متوسط (2 لتر)',
                            specs: 'قاع سميك لتوزيع حرارة متساوٍ',
                            critical: true
                        },
                        {
                            name: 'خفاقة سلكية يدوية',
                            specs: 'قوية ومرنة',
                            reason: 'خفق مستمر لمنع التخثر'
                        },
                        {
                            name: 'ميزان حرارة طبخ',
                            specs: 'مدى 0-100°C، دقة ±1°C',
                            critical: '⚠️ حرج جداً - الكاسترد يتخثر عند 90°C'
                        },
                        {
                            name: 'مصفاة شبكية ناعمة (Fine Mesh)',
                            specs: 'فتحات صغيرة جداً',
                            reason: 'تصفية أي كتل صغيرة'
                        },
                        {
                            name: 'وعاءين - واحد للخفق + واحد للتبريد',
                            reason: 'انتقال سريع بعد الطبخ'
                        },
                        {
                            name: 'غلاف بلاستيكي ملامس',
                            reason: 'منع تكون قشرة على السطح'
                        },
                        {
                            name: 'حمام ثلجي',
                            specs: 'وعاء كبير + ثلج + ماء',
                            reason: 'تبريد سريع لوقف الطبخ'
                        }
                    ],
                    optional: [
                        {
                            name: 'ميزان حرارة رقمي بشاشة',
                            use: 'مراقبة مستمرة'
                        },
                        {
                            name: 'ملعقة خشبية طويلة',
                            use: 'اختبار التغطية (Nappé Test)'
                        }
                    ]
                },
                
                defaultThickness: 5,
                needsCooking: true,  // ⚠️ يتطلب طبخ دقيق
                difficultyLevel: 7,
                yieldAmount: 950,  // بعد الطبخ والتبريد
                servings: 'يكفي لـ7-8 طبقات 24 سم',
                cookingTime: '35 دقيقة + تبريد',
                
                criticalControlPoints: [
                    {
                        step: 'خلط الصفار والسكر',
                        hazard: 'ترك الصفار مع السكر بدون خفق → "حرق" الصفار',
                        control: 'خفق فوري ومستمر حتى يصبح كريمي فاتح',
                        limit: 'اللون: أصفر فاتح كريمي، القوام: كثيف',
                        verification: 'عند رفع الخفاقة: يسقط كشريط سميك',
                        correctiveAction: 'إذا تكتل: تخلص منه وابدأ من جديد'
                    },
                    {
                        step: 'تسخين الحليب',
                        hazard: 'غليان الحليب → طعم محروق + تبخر زائد',
                        control: 'تسخين حتى ظهور بخار فقط (80-85°C)',
                        limit: 'لا فقاعات غليان - فقط بخار خفيف',
                        verification: 'ظهور بخار + رائحة فانيليا قوية',
                        correctiveAction: 'إذا غلى: أزل فوراً وبرّد لـ80°C'
                    },
                    {
                        step: 'التمبرنج (Tempering)',
                        hazard: 'إضافة حليب ساخن للصفار مباشرة → تخثر فوري',
                        control: 'إضافة 1/3 الحليب ببطء شديد مع خفق سريع',
                        limit: 'خيط رفيع من الحليب + خفق مستمر لا يتوقف',
                        verification: 'خليط صفار دافئ متجانس بدون كتل',
                        correctiveAction: 'إذا تخثر: صفِّ فوراً عبر مصفاة ناعمة'
                    },
                    {
                        step: 'الطبخ النهائي',
                        hazard: 'تجاوز 85°C → تخثر كامل | عدم الوصول لـ82°C → لا يثخن',
                        control: 'خفق مستمر بشكل 8، قياس حرارة كل 30 ثانية',
                        limit: '82-85°C بالضبط',
                        verification: 'Nappé Test: يغطي ظهر الملعقة، خط واضح عند المسح',
                        correctiveAction: {
                            overcooked: 'صفِّ فوراً + أضف 50جم زبدة إضافية',
                            undercooked: 'ارجع للنار وراقب حتى 82°C'
                        }
                    },
                    {
                        step: 'إضافة الزبدة',
                        hazard: 'زبدة باردة → لا تذوب | كاسترد بارد → تصلب الزبدة',
                        control: 'كاسترد عند 85°C + زبدة طرية (20°C)',
                        limit: 'إضافة على 3-4 دفعات مع التقليب',
                        verification: 'ذوبان كامل، لمعان قوي',
                        correctiveAction: 'زبدة لم تذب: سخّن قليلاً (لا تغلي)'
                    },
                    {
                        step: 'التبريد',
                        hazard: 'تبريد بطيء → نمو بكتيري | تكون قشرة → جفاف',
                        control: 'حمام ثلجي فوري + غلاف ملامس',
                        limit: 'من 85°C إلى 20°C في 10-15 دقيقة',
                        verification: 'غلاف يلامس السطح مباشرة',
                        correctiveAction: 'قشرة تكونت: أزلها وغطِّ مرة أخرى'
                    }
                ],
                
                failureIndicators: {
                    'scrambled-eggs': {
                        sign: 'حبيبات صفراء صغيرة (بيض مخفوق)',
                        cause: 'حرارة زائدة (>90°C) أو تمبرنج سريع',
                        rescue: 'صفِّ عبر مصفاة ناعمة + اخفق في الخلاط 1 دقيقة'
                    },
                    'too-thin': {
                        sign: 'سائل بعد التبريد',
                        cause: 'عدم الوصول لـ82°C أو نشا قليل',
                        rescue: 'أعد التسخين لـ82°C أو أضف 1 ملعقة نشا مذابة'
                    },
                    'lumpy': {
                        sign: 'كتل نشا',
                        cause: 'نشا غير مذاب أو خفق غير كافٍ',
                        rescue: 'صفِّ + اخفق في الخلاط'
                    },
                    'skin-formed': {
                        sign: 'قشرة جافة على السطح',
                        cause: 'عدم تغطية بغلاف ملامس',
                        rescue: 'أزل القشرة + غطِّ مباشرة'
                    }
                }
            },
        
            // ==================== 5. AHMED SHAWKY #1: Caramel Butter Cream ====================
            'ahmed-shawky-caramel': {
                name: 'أحمد شوقي 1: كريمة كراميل بالزبدة',
                nameEn: 'Ahmed Shawky Caramel Butter Cream',
                scientificName: 'Caramel-Enriched Butter Emulsion',
                origin: 'مصر - الشيف أحمد شوقي',
                authorNote: 'وصفة مشهورة بالثبات العالي والطعم الغني',
                
                baseRecipe: {
                    'heavy-cream-35': {
                        amount: 250,
                        nameAr: 'كريمة خفق ثقيلة 35%',
                        temp: 2,
                        fatContent: 35,
                        requiredPrep: 'باردة جداً من الثلاجة',
                        warning: 'تُخفق لـMedium Peak قبل الدمج'
                    },
                    'sour-cream-30': {
                        amount: 100,
                        nameAr: 'كريمة حامضة 30%',
                        temp: 4,
                        fatContent: 30,
                        requiredPrep: 'تصفية خفيفة 2-3 ساعات (اختياري)',
                        purpose: 'إضافة حموضة موازنة للكراميل',
                        warning: 'ليست إلزامية للتصفية الطويلة'
                    },
                    'homemade-caramel': {
                        amount: 250,
                        nameAr: 'كراميل منزلي',
                        nameEn: 'Homemade Caramel Sauce',
                        temp: 22,  // ⚠️ حرارة الغرفة - مهم جداً
                        type: 'كراميل رطب (Wet Caramel)',
                        requiredPrep: 'محضر مسبقاً ومبرد لحرارة الغرفة',
                        recipe: 'انظر الوصفة المفصلة أدناه',
                        warning: '🔴 إذا كان بارداً سيتصلب، إذا كان ساخناً سيذيب الكريمة'
                    },
                    'unsalted-butter': {
                        amount: 75,
                        nameAr: 'زبدة غير مملحة',
                        temp: 18,  // طرية
                        fatContent: 82,
                        requiredPrep: '15 دقيقة خارج الثلاجة',
                        brand: 'Président أو Lurpak',
                        warning: 'تُخفق أولاً لتصبح كريمية'
                    },
                    'sea-salt-flakes': {
                        amount: 1,
                        unit: 'جرام',
                        nameAr: 'رقائق ملح بحري',
                        nameEn: 'Sea Salt Flakes',
                        type: 'Maldon أو Fleur de Sel',
                        purpose: 'Salted Caramel effect',
                        optional: true
                    }
                },
                
                // وصفة الكراميل المنزلي (Sub-recipe)
                caramelRecipe: {
                    ingredients: {
                        sugar: 200,  // جرام
                        water: 60,   // مل
                        heavyCream: 120,  // مل (دافئة)
                        butter: 30,  // جرام
                        salt: 0.5    // جرام
                    },
                    method: 'Wet Caramel Method',
                    cookingTemp: {min: 170, max: 180},  // °C
                    color: 'Dark Amber (#C75F00)',
                    coolingTime: '2 ساعة حتى 22°C',
                    shelfLife: 'أسبوع بالثلاجة'
                },
                
                targetProperties: {
                    density: 1.10,
                    viscosity: {min: 28000, max: 33000},
                    pH: {min: 5.8, max: 6.2},  // أقل حموضة من السور كريم
                    brix: {min: 30, max: 33},
                    waterActivity: 0.88,
                    fatContent: {min: 28, max: 32},
                    totalSolids: {min: 45, max: 48},
                    stability: 'very-high',
                    shelfLife: 120,  // 5 أيام
                    maturationTime: {min: 24, max: 30},
                    setTime: 3,
                    spreadability: 'medium',
                    thermalStability: 'high (20-24°C لـ3 ساعات)'
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'كريمي بيج كراميلي، لمعان قوي',
                        mouthfeel: 'غني زبدي، ذوبان متوسط',
                        structure: 'موس سميك - قمة صلبة (Stiff Peak)',
                        spreadTest: 'يحتاج ضغط معتدل'
                    },
                    taste: {
                        sweetness: 'حلو مع عمق كراميل (7/10)',
                        caramelDepth: 'كراميل محمص عميق',
                        butterRichness: 'زبدي غني جداً',
                        saltyNote: 'ملوحة خفيفة إن أضيفت',
                        sourCreamTang: 'حموضة خلفية موازنة',
                        aftertaste: 'كراميل زبدي طويل'
                    },
                    aroma: {
                        primary: 'كراميل محمص',
                        secondary: 'زبدة بندق (Beurre Noisette)',
                        overall: 'دافئ فاخر'
                    },
                    appearance: {
                        color: 'بيج كراميلي (#D4A574)',
                        shine: 'لمعان زبدي قوي',
                        uniformity: 'متجانس تماماً'
                    },
                    stability: {
                        roomTemp: '3 ساعات عند 20-24°C',
                        refrigerated: '5 أيام بدون انفصال',
                        structural: 'ممتاز - يحتفظ بالشكل'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'Stand Mixer',
                            attachment: 'Paddle ثم Whisk',
                            speedRange: '100-280 RPM'
                        },
                        {
                            name: 'وعاء خلط 3 لتر',
                            material: 'ستانلس أو زجاج'
                        },
                        {
                            name: 'سباتولا سيليكون قوية',
                            reason: 'كشط الكراميل'
                        },
                        {
                            name: 'ميزان حرارة',
                            use: 'للكراميل المنزلي'
                        }
                    ]
                },
                
                defaultThickness: 4,
                needsCooking: false,  // الكراميل يُحضّر مسبقاً
                difficultyLevel: 5,
                yieldAmount: 675,
                servings: 'يكفي لـ7-8 طبقات 24 سم',
                
                criticalControlPoints: [
                    {
                        step: 'تحضير الكراميل المسبق',
                        hazard: 'كراميل ساخن → يذيب الكريمة | بارد → صلب',
                        control: 'تبريد لـ22°C (حرارة الغرفة) بالضبط',
                        limit: '20-24°C',
                        verification: 'ملمس: سائل سميك ينساب ببطء',
                        correctiveAction: {
                            cold: 'سخّن في حمام مائي 40°C حتى يلين',
                            hot: 'برّد حتى 22°C'
                        }
                    },
                    {
                        step: 'خفق الزبدة',
                        hazard: 'زبدة باردة → كتل | دافئة جداً → دهنية',
                        control: 'زبدة عند 18-20°C',
                        limit: 'خفق 90 ثانية حتى كريمية بيضاء خفيفة',
                        verification: 'حجم يزيد 30-40%، لون أفتح',
                        correctiveAction: 'باردة: اترك 10 دقائق | دافئة: برّد 5 دقائق'
                    },
                    {
                        step: 'دمج الكراميل',
                        hazard: 'إضافة دفعة واحدة → انفصال',
                        control: 'إضافة على 3 دفعات متساوية',
                        limit: 'خفق 30 ثانية بعد كل إضافة عند 150 RPM',
                        verification: 'تجانس كامل بعد كل دفعة',
                        correctiveAction: 'انفصل: أضف 1 ملعقة كريمة سائلة باردة'
                    },
                    {
                        step: 'دمج الكريمة المخفوقة',
                        hazard: 'خفق → فقدان الهواء',
                        control: 'طي لطيف بسباتولا على سرعة 100 RPM',
                        limit: '30-45 ثانية فقط',
                        verification: 'موس خفيف موحد',
                        correctiveAction: 'لا يمكن - الوقاية فقط'
                    }
                ],
                
                failureIndicators: {
                    'separated': {
                        sign: 'طبقتين: كراميل أسفل + كريمة أعلى',
                        cause: 'كراميل بارد أو إضافة سريعة',
                        rescue: 'اخفق بقوة 2-3 دقائق + أضف 1 ملعقة كريمة دافئة'
                    },
                    'too-sweet': {
                        sign: 'حلاوة مفرطة',
                        cause: 'كراميل كثير',
                        rescue: 'أضف 50-75جم سور كريم إضافية'
                    }
                }
            },
        
            // ==================== 6. AHMED SHAWKY #2: Light Sugar Cream ====================
            'ahmed-shawky-sugar': {
                name: 'أحمد شوقي 2: كريمة سكر خفيفة',
                nameEn: 'Ahmed Shawky Light Sugar Cream',
                scientificName: 'Sweetened Whipped Cream with Sour Cream',
                origin: 'مصر - الشيف أحمد شوقي',
                
                baseRecipe: {
                    'heavy-cream-35': {
                        amount: 250,
                        nameAr: 'كريمة خفق ثقيلة 35%',
                        temp: 2,
                        fatContent: 35,
                        requiredPrep: 'باردة جداً',
                        warning: 'الأساس الرئيسي للخفق'
                    },
                    'powdered-sugar-fine': {
                        amount: 150,
                        nameAr: 'سكر بودرة ناعم',
                        temp: 20,
                        requiredPrep: 'منخول مرتين',
                        purpose: 'تحلية + تثبيت خفيف',
                        warning: 'إضافة تدريجية أثناء الخفق'
                    },
                    'sour-cream-30': {
                        amount: 500,
                        nameAr: 'كريمة حامضة 30%',
                        temp: 6,  // أدفأ قليلاً من المعتاد
                        fatContent: 30,
                        requiredPrep: 'بدون تصفية - مباشرة من العبوة',
                        warning: 'تُضاف بعد خفق الكريمة'
                    },
                    'vanilla-extract': {
                        amount: 7,
                        unit: 'ml',
                        nameAr: 'خلاصة فانيليا',
                        temp: 20,
                        additionStage: 'final'
                    }
                },
                
                targetProperties: {
                    density: 1.08,
                    viscosity: {min: 16000, max: 20000},  // أخف من المعتاد
                    pH: {min: 4.4, max: 4.6},
                    brix: {min: 28, max: 30},
                    waterActivity: 0.94,  // أعلى = نقل رطوبة أسرع
                    fatContent: {min: 28, max: 30},
                    totalSolids: {min: 40, max: 43},
                    stability: 'medium',
                    shelfLife: 72,
                    maturationTime: {min: 18, max: 24},
                    setTime: 2,
                    spreadability: 'soft',
                    thermalStability: 'medium (20°C لـ2 ساعة)'
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'أبيض ناصع، خفيف وجيد التهوية',
                        mouthfeel: 'خفيف هوائي، يذوب فوراً',
                        structure: 'موس خفيف - قمة ناعمة (Soft Peak)',
                        spreadTest: 'ينساب بسهولة شديدة'
                    },
                    taste: {
                        sweetness: 'حلو متوازن (6/10)',
                        sourCreamTang: 'حموضة منعشة واضحة',
                        lightness: 'خفيف غير ثقيل',
                        aftertaste: 'نظيف منعش'
                    },
                    aroma: {
                        primary: 'كريمة طازجة',
                        secondary: 'فانيليا خفيفة',
                        overall: 'نظيف وبسيط'
                    },
                    appearance: {
                        color: 'أبيض ناصع (#FFFFFF)',
                        shine: 'مطفي ناعم',
                        uniformity: 'متجانس'
                    },
                    stability: {
                        roomTemp: '2 ساعة عند 20°C',
                        refrigerated: '3 أيام',
                        warning: 'قد ينفصل قليلاً بعد 48 ساعة'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'Stand Mixer',
                            attachment: 'Whisk',
                            speedRange: '150-320 RPM'
                        },
                        {
                            name: 'وعاء مبرد',
                            prep: '10 دقائق فريزر'
                        },
                        {
                            name: 'سباتولا سيليكون',
                            use: 'طي السور كريم'
                        }
                    ]
                },
                
                defaultThickness: 5,
                needsCooking: false,
                difficultyLevel: 3,  // سهل
                yieldAmount: 900,
                servings: 'يكفي لـ8-9 طبقات 24 سم',
                
                criticalControlPoints: [
                    {
                        step: 'خفق الكريمة',
                        hazard: 'خفق زائد → تحبب',
                        control: 'توقف عند Soft Peak',
                        limit: 'قمة تنحني بالكامل',
                        verification: 'ناعم وجيد التهوية',
                        correctiveAction: 'أضف 50مل كريمة باردة'
                    },
                    {
                        step: 'إضافة السور كريم',
                        hazard: 'خفق بالخلاط → فقدان الهواء',
                        control: 'طي يدوي فقط',
                        limit: '30-45 ثانية',
                        verification: 'خفيف موحد',
                        correctiveAction: 'لا يمكن - وقاية فقط'
                    }
                ],
                
                failureIndicators: {
                    'too-soft': {
                        sign: 'سائل جداً',
                        cause: 'نقص خفق',
                        rescue: 'اخفق 1-2 دقيقة إضافية'
                    },
                    'curdled': {
                        sign: 'حبيبات',
                        cause: 'خفق زائد',
                        rescue: 'أضف 50مل كريمة باردة'
                    }
                }
            },
        
            // ==================== 7. AHMED SHAWKY #3: Condensed Milk Rich ====================
            'ahmed-shawky-condensed': {
                name: 'أحمد شوقي 3: حليب مكثف غني',
                nameEn: 'Ahmed Shawky Condensed Milk Cream',
                scientificName: 'Sweetened Condensed Milk Butter Emulsion',
                origin: 'مصر - الشيف أحمد شوقي',
                
                baseRecipe: {
                    'sweetened-condensed-milk': {
                        amount: 400,
                        nameAr: 'حليب مكثف محلى',
                        nameEn: 'Sweetened Condensed Milk',
                        temp: 20,  // حرارة الغرفة
                        brand: 'Nestlé أو Rainbow',
                        solidsContent: 73,  // % مواد صلبة
                        sugarContent: 55,  // % سكر
                        requiredPrep: 'رج العبوة جيداً',
                        warning: 'يجب أن يكون سميكاً ولزجاً'
                    },
                    'unsalted-butter': {
                        amount: 100,
                        nameAr: 'زبدة غير مملحة',
                        temp: 18,
                        fatContent: 82,
                        requiredPrep: 'طرية - 15 دقيقة خارج الثلاجة',
                        warning: 'تُخفق أولاً حتى كريمية'
                    },
                    'cream-cheese-full-fat': {
                        amount: 120,
                        nameAr: 'جبن كريمي كامل الدسم',
                        temp: 18,
                        fatContent: 33,
                        brand: 'Philadelphia',
                        requiredPrep: '15 دقيقة خارج الثلاجة',
                        warning: 'نفس حرارة الزبدة'
                    },
                    'lemon-juice-fresh': {
                        amount: 10,
                        unit: 'ml',
                        nameAr: 'عصير ليمون طازج',
                        temp: 20,
                        purpose: 'موازنة الحلاوة المفرطة',
                        optional: true,
                        warning: 'يُضاف في النهاية'
                    }
                },
                
                targetProperties: {
                    density: 1.12,
                    viscosity: {min: 30000, max: 38000},
                    pH: {min: 6.0, max: 6.3},
                    brix: {min: 35, max: 38},  // حلو جداً
                    waterActivity: 0.85,
                    fatContent: {min: 24, max: 28},
                    totalSolids: {min: 52, max: 56},
                    stability: 'very-high',
                    shelfLife: 120,
                    maturationTime: {min: 30, max: 36},
                    setTime: 4,
                    spreadability: 'medium-firm',
                    thermalStability: 'excellent (24°C لـ4 ساعات)'
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'كريمي أبيض مصفر، كثيف',
                        mouthfeel: 'غني جداً، زبدي كثيف',
                        structure: 'كريمة زبدة (Buttercream) - صلبة',
                        spreadTest: 'يحتاج ضغط قوي'
                    },
                    taste: {
                        sweetness: 'حلو جداً (8/10)',
                        condensedMilkDepth: 'حليب مكثف واضح',
                        butterRichness: 'زبدي غني',
                        creamCheeseNote: 'جبن كريمي خفيف',
                        lemonBalance: 'إن أضيف: توازن منعش',
                        aftertaste: 'حلو طويل'
                    },
                    aroma: {
                        primary: 'حليب مكثف حلو',
                        secondary: 'زبدة كريمية',
                        overall: 'حلو مريح'
                    },
                    appearance: {
                        color: 'أبيض كريمي مصفر خفيف (#FFFEF5)',
                        shine: 'لمعان زبدي',
                        uniformity: 'أملس'
                    },
                    stability: {
                        roomTemp: '4 ساعات عند 24°C',
                        refrigerated: '5 أيام',
                        structural: 'ممتاز'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'Stand Mixer',
                            attachment: 'Paddle',
                            speedRange: '100-250 RPM'
                        },
                        {
                            name: 'سباتولا قوية',
                            reason: 'الخليط كثيف'
                        }
                    ]
                },
                
                defaultThickness: 4,
                needsCooking: false,
                difficultyLevel: 4,
                yieldAmount: 620,
                servings: 'يكفي لـ6-7 طبقات 24 سم',
                
                criticalControlPoints: [
                    {
                        step: 'خفق الزبدة والجبن',
                        hazard: 'مكونات باردة → كتل',
                        control: '18-20°C للجميع',
                        limit: 'خفق 2-3 دقائق حتى ناعم تماماً',
                        verification: 'بدون أي كتل',
                        correctiveAction: 'دفّئ قليلاً'
                    },
                    {
                        step: 'إضافة الحليب المكثف',
                        hazard: 'إضافة دفعة واحدة → ثقيل جداً',
                        control: 'إضافة تدريجية على 3 دفعات',
                        limit: 'خفق 30 ثانية بعد كل دفعة',
                        verification: 'كريمي ناعم',
                        correctiveAction: 'كثيف جداً: أضف 1-2 ملعقة حليب'
                    }
                ],
                
                failureIndicators: {
                    'too-stiff': {
                        sign: 'صلب كالزبدة',
                        cause: 'خفق زائد أو بارد',
                        rescue: 'اترك 10 دقائق حرارة الغرفة'
                    },
                    'lumps': {
                        sign: 'كتل جبن أو زبدة',
                        cause: 'مكونات باردة',
                        rescue: 'دفّئ قليلاً واخفق'
                    }
                }
            },
        
            // ==================== 8. AHMED ABDELSALAM: Triple Richness ====================
            'ahmed-abdelsalam': {
                name: 'أحمد عبد السلام: الثلاثي الغني',
                nameEn: 'Ahmed Abdelsalam Triple Richness',
                scientificName: 'Butter-Cheese-Dulce Complex Emulsion',
                origin: 'مصر - الشيف أحمد عبد السلام',
                authorNote: 'وصفة شهيرة بالثراء الفائق والثبات الممتاز',
                
                baseRecipe: {
                    'unsalted-butter': {
                        amount: 200,
                        nameAr: 'زبدة أوروبية غير مملحة',
                        nameEn: 'European Unsalted Butter',
                        temp: 18,
                        fatContent: 82,
                        brand: 'Président أو Lurpak',
                        requiredPrep: '15-20 دقيقة خارج الثلاجة',
                        warning: 'يجب أن تكون طرية جداً لكن ليست ذائبة'
                    },
                    'cream-cheese-full-fat': {
                        amount: 200,
                        nameAr: 'جبن كريمي كامل الدسم',
                        temp: 18,
                        fatContent: 33,
                        brand: 'Philadelphia أصلي',
                        requiredPrep: 'نفس حرارة الزبدة بالضبط',
                        warning: '🔴 حرج: يجب نفس حرارة الزبدة لمنع التكتل'
                    },
                    'dulce-de-leche-authentic': {
                        amount: 200,
                        nameAr: 'دولسي دي ليتشي أصلي',
                        temp: 20,  // أدفأ قليلاً
                        brand: 'La Serenísima',
                        solidsContent: 70,
                        requiredPrep: 'خفق منفرد 2-3 دقائق',
                        warning: 'يجب أن يكون قوامه سلساً'
                    },
                    'vanilla-extract': {
                        amount: 5,
                        unit: 'ml',
                        nameAr: 'خلاصة فانيليا',
                        temp: 20,
                        additionStage: 'final',
                        optional: true
                    },
                    'sea-salt-fine': {
                        amount: 1,
                        nameAr: 'ملح بحري ناعم',
                        purpose: 'تعزيز النكهات',
                        optional: true
                    }
                },
                
                targetProperties: {
                    density: 1.13,
                    viscosity: {min: 32000, max: 40000},  // كثيف جداً
                    pH: {min: 5.5, max: 5.8},
                    brix: {min: 30, max: 34},
                    waterActivity: 0.82,  // الأقل = الأكثر ثباتاً
                    fatContent: {min: 35, max: 40},  // الأعلى دهوناً
                    totalSolids: {min: 55, max: 60},
                    stability: 'excellent',
                    shelfLife: 144,  // 6 أيام
                    maturationTime: {min: 36, max: 48},
                    setTime: 6,  // الأطول
                    spreadability: 'firm',
                    thermalStability: 'exceptional (26°C لـ5 ساعات)'
                },
                
                sensoryTargets: {
                    texture: {
                        visual: 'كريمي بيج فاتح، كثيف جداً',
                        mouthfeel: 'غني فاخر، زبدي كثيف',
                        structure: 'كريمة زبدة صلبة - قمة صلبة جداً',
                        spreadTest: 'يحتاج ضغط قوي، قطع نظيف'
                    },
                    taste: {
                        sweetness: 'حلو غني (7/10)',
                        complexity: 'طبقات نكهة: زبدة → جبن → كراميل',
                        butterDepth: 'زبدة أوروبية غنية',
                        creamCheese: 'جبن كريمي واضح',
                        dulceCaramel: 'كراميل دولسي عميق',
                        balance: 'توازن معقد ممتاز',
                        aftertaste: 'طويل جداً ومتعدد الطبقات'
                    },
                    aroma: {
                        primary: 'زبدة كراميل',
                        secondary: 'جبن كريمي + دولسي',
                        tertiary: 'فانيليا خفيفة',
                        overall: 'فاخر معقد'
                    },
                    appearance: {
                        color: 'بيج كريمي فاتح (#F5E6D3)',
                        shine: 'لمعان زبدي قوي',
                        uniformity: 'أملس تماماً'
                    },
                    stability: {
                        roomTemp: '5 ساعات عند 26°C',
                        refrigerated: '6 أيام بدون أي انفصال',
                        structural: 'استثنائي - يحتفظ بالشكل تماماً',
                        freezable: 'نعم - حتى شهر'
                    }
                },
                
                requiredEquipment: {
                    essential: [
                        {
                            name: 'Stand Mixer قوي',
                            power: '400 واط كحد أدنى',
                            attachment: 'Paddle',
                            speedRange: '100-200 RPM',
                            reason: 'الخليط كثيف جداً'
                        },
                        {
                            name: 'ميزان حرارة',
                            critical: 'للتأكد من تساوي حرارة المكونات'
                        },
                        {
                            name: 'سباتولا قوية جداً',
                            reason: 'كشط وخلط خليط كثيف'
                        }
                    ]
                },
                
                defaultThickness: 3.5,  // طبقة رقيقة لأنه غني جداً
                needsCooking: false,
                difficultyLevel: 6,
                yieldAmount: 600,
                servings: 'يكفي لـ8-10 طبقات 24 سم (طبقة رقيقة)',
                
                criticalControlPoints: [
                    {
                        step: 'تساوي درجة حرارة المكونات',
                        hazard: 'اختلاف حرارة → انفصال وتكتل',
                        control: 'قياس كل مكون: 18-20°C بالضبط',
                        limit: 'فرق لا يزيد عن 2°C بين المكونات',
                        verification: 'لمس كل مكون - نفس الإحساس',
                        correctiveAction: 'دفّئ البارد أو برّد الدافئ'
                    },
                    {
                        step: 'خفق الزبدة',
                        hazard: 'نقص خفق → كثيفة جداً',
                        control: 'خفق 90 ثانية حتى كريمية فاتحة',
                        limit: 'زيادة حجم 40%، لون أفتح',
                        verification: 'ناعمة كالموس',
                        correctiveAction: 'اخفق 30-60 ثانية إضافية'
                    },
                    {
                        step: 'دمج الجبن الكريمي',
                        hazard: 'دمج سريع → كتل',
                        control: 'إضافة تدريجية على 3 دفعات',
                        limit: 'خفق 30 ثانية بعد كل دفعة',
                        verification: 'ناعم تماماً بدون كتل',
                        correctiveAction: 'كتل: اخفق أطول أو دفّئ قليلاً'
                    },
                    {
                        step: 'دمج الدولسي',
                        hazard: 'دولسي بارد → كتل | خفق زائد → سيولة',
                        control: 'دولسي 20-22°C، خفق برفق 120 RPM',
                        limit: 'إضافة على دفعتين فقط',
                        verification: 'لون موحد، قوام كريمي كثيف',
                        correctiveAction: {
                            lumps: 'خفق أطول',
                            runny: 'برّد 15 دقيقة'
                        }
                    }
                ],
                
                failureIndicators: {
                    'separated': {
                        sign: 'طبقتين منفصلتين',
                        cause: 'اختلاف حرارة المكونات',
                        rescue: 'دفّئ قليلاً (25°C) واخفق بقوة 3-4 دقائق'
                    },
                    'grainy': {
                        sign: 'حبيبات سكر',
                        cause: 'دولسي بارد جداً',
                        rescue: 'دفّئ لـ25°C واخفق'
                    },
                    'too-soft': {
                        sign: 'طري جداً',
                        cause: 'خفق زائد أو حرارة عالية',
                        rescue: 'برّد 30 دقيقة'
                    },
                    'butter-lumps': {
                        sign: 'كتل زبدة صفراء',
                        cause: 'زبدة باردة',
                        rescue: 'اترك 10 دقائق واخفق مرة أخرى'
                    }
                }
            }
        },

        // Get preparation protocol
        getPreparationProtocol(presetId) {
            const protocols = {
                
                // ==================== PROTOCOL 1: Classic Sour Cream ====================
                'classic-sour-cream': {
                    name: 'كريمة حامضة كلاسيكية',
                    totalTime: '25 دقيقة (+ 6-8 ساعات تصفية مسبقة)',
                    difficulty: 'سهل',
                    yield: '~1100 جرام',
                    servings: 'يكفي لـ8-10 طبقات 24سم',
                    
                    // التحضير المسبق الإلزامي
                    preparation: {
                        title: '⏰ التحضير المسبق (ليلة سابقة - إلزامي)',
                        duration: '6-8 ساعات',
                        critical: true,
                        steps: [
                            {
                                time: 'قبل 6-8 ساعات',
                                action: 'تصفية الكريمة الحامضة (Sour Cream)',
                                procedure: [
                                    'ضع قماش موسلين (أو شاش طبي 4 طبقات) في مصفاة',
                                    'ضع المصفاة فوق وعاء عميق',
                                    'اسكب 800 جرام سور كريم في القماش',
                                    'غطِّ بغلاف بلاستيكي',
                                    'ضعها في الثلاجة'
                                ],
                                temp: '4°C طوال فترة التصفية',
                                duration: '6-8 ساعات (أو ليلة كاملة)',
                                expectedResult: {
                                    weight: '650-700 جرام (فقد 100-150 جرام سوائل)',
                                    texture: 'كثيفة كالزبادي اليوناني',
                                    color: 'أبيض ناصع'
                                },
                                why: '💡 إزالة الماء الحر يزيد نسبة الدهون من 30% إلى ~38%، مما يحسن الثبات ويمنع الانفصال',
                                checkpoint: 'اختبار الملعقة: يجب أن تقف الملعقة في السور كريم بدون أن تسقط',
                                troubleshooting: {
                                    'still-watery': 'صفِّ 2-3 ساعات إضافية',
                                    'too-thick': 'أضف 1-2 ملعقة من السائل المصفى'
                                }
                            }
                        ]
                    },
                    
                    // البروتوكول الرئيسي
                    steps: [
                        {
                            number: 1,
                            name: 'التحضير البارد (Cold Setup)',
                            duration: '10 دقائق',
                            temp: {
                                equipment: -5,  // فريزر
                                ingredients: 4,
                                ambient: '18-20°C'
                            },
                            actions: [
                                {
                                    time: '0:00',
                                    action: 'تبريد الأدوات',
                                    detail: [
                                        'ضع وعاء الخلط المعدني (ستانلس ستيل 3-4 لتر) في الفريزر',
                                        'ضع مضرب الخفق السلكي (Whisk) في الفريزر',
                                        'إذا كان لديك: ضع السباتولا أيضاً'
                                    ],
                                    duration: '10 دقائق بالضبط',
                                    checkpoint: 'لمس الوعاء = بارد جداً يكاد يلتصق بالأصابع',
                                    why: 'الوعاء البارد يمنع ارتفاع حرارة الكريمة أثناء الخفق'
                                },
                                {
                                    time: '0:00',
                                    action: 'إخراج المكونات',
                                    detail: [
                                        'أخرج السور كريم المصفاة من الثلاجة',
                                        'قس درجة حرارتها: يجب 4-6°C',
                                        'أخرج الكريمة السائلة (Heavy Cream) من الثلاجة',
                                        'قس درجة حرارتها: يجب 2-4°C (أبرد من السور كريم)'
                                    ],
                                    checkpoint: 'ميزان الحرارة يقرأ 2-6°C للمكونات',
                                    warning: '⚠️ إذا كانت المكونات >10°C: برّدها 15 دقيقة إضافية'
                                },
                                {
                                    time: '8:00',
                                    action: 'نخل السكر البودرة',
                                    detail: [
                                        'ضع 120 جرام سكر بودرة في منخل ناعم (200 mesh)',
                                        'انخل مرتين فوق ورق زبدة',
                                        'اترك السكر جانباً في حرارة الغرفة'
                                    ],
                                    why: 'النخل يمنع التكتل عند الإضافة للكريمة المخفوقة',
                                    checkpoint: 'السكر ناعم جداً بدون أي كتل'
                                },
                                {
                                    time: '9:00',
                                    action: 'تحضير خلاصة الفانيليا',
                                    detail: [
                                        'قس 5 مل خلاصة فانيليا نقية',
                                        'ضعها في كوب صغير'
                                    ],
                                    warning: 'لا تضع الفانيليا الآن - تُضاف في النهاية فقط'
                                }
                            ],
                            finalCheck: [
                                '✓ وعاء ومضرب باردين جداً من الفريزر',
                                '✓ سور كريم مصفاة 650-700جم عند 4-6°C',
                                '✓ كريمة سائلة 400جم عند 2-4°C',
                                '✓ سكر بودرة منخول 120جم',
                                '✓ فانيليا 5مل جاهزة'
                            ]
                        },
                        
                        {
                            number: 2,
                            name: 'خفق الكريمة السائلة (المرحلة الأولى)',
                            duration: '6-8 دقائق',
                            temp: {
                                start: '2-4°C',
                                during: '6-8°C',
                                end: '8-10°C'
                            },
                            equipment: {
                                mixer: 'Stand Mixer',
                                attachment: 'Whisk (مضرب سلكي)',
                                bowl: 'الوعاء المبرد من الفريزر'
                            },
                            actions: [
                                {
                                    time: '0:00',
                                    rpm: 0,
                                    action: 'صب الكريمة السائلة',
                                    detail: [
                                        'أخرج الوعاء من الفريزر',
                                        'اسكب 400 جرام كريمة خفق ثقيلة 35%',
                                        'ركّب المضرب السلكي البارد'
                                    ],
                                    visualCue: 'الكريمة سائلة تماماً، تتحرك بحرية في الوعاء',
                                    checkpoint: 'درجة الحرارة: 2-4°C'
                                },
                                {
                                    time: '0:00 - 0:30',
                                    rpm: 150,
                                    speed: 'منخفضة (Low - Setting 2)',
                                    action: 'البدء البطيء',
                                    detail: [
                                        'شغّل الخلاط على أقل سرعة',
                                        'اترك المضرب يدور ببطء 30 ثانية'
                                    ],
                                    visualCue: 'فقاعات صغيرة تبدأ بالظهور على السطح',
                                    sensory: {
                                        sound: 'صوت خفق هادئ',
                                        visual: 'حركة دائرية بطيئة'
                                    },
                                    why: 'البداية البطيئة تمنع الرش وتوزع الهواء بالتساوي',
                                    warning: '⚠️ لا تبدأ بسرعة عالية - سترش الكريمة خارج الوعاء'
                                },
                                {
                                    time: '0:30 - 2:00',
                                    rpm: 200,
                                    speed: 'متوسطة (Medium - Setting 4)',
                                    action: 'رفع السرعة التدريجي',
                                    detail: [
                                        'ارفع السرعة للمتوسطة',
                                        'راقب الكريمة تبدأ بالتثخن'
                                    ],
                                    visualCue: 'الكريمة تبدأ بترك أثر خفيف عند رفع المضرب',
                                    sensory: {
                                        visual: 'لون أبيض يزداد، حجم يبدأ بالزيادة',
                                        texture: 'تتحول من سائل لكريمي'
                                    },
                                    checkpoint: 'درجة الحرارة: 6-8°C (قس بميزان الحرارة)',
                                    warning: 'إذا تجاوزت 10°C: أوقف الخلاط، ضع الوعاء في حمام ثلجي 2-3 دقائق'
                                },
                                {
                                    time: '2:00',
                                    rpm: 200,
                                    action: 'بدء إضافة السكر - الدفعة الأولى',
                                    detail: [
                                        'أوقف الخلاط لحظة',
                                        'أضف 40 جرام سكر بودرة (ثلث الكمية)',
                                        'شغّل الخلاط على سرعة متوسطة'
                                    ],
                                    duration: '10 ثوانٍ خفق',
                                    visualCue: 'السكر يذوب فوراً، لا يُرى',
                                    why: 'الإضافة التدريجية تمنع تكتل السكر وتساعد على الثبات'
                                },
                                {
                                    time: '2:10',
                                    rpm: 200,
                                    action: 'إضافة السكر - الدفعة الثانية',
                                    detail: [
                                        'أوقف الخلاط',
                                        'أضف 40 جرام سكر (الثلث الثاني)',
                                        'شغّل واخفق 10 ثوانٍ'
                                    ],
                                    visualCue: 'الكريمة تبدأ بالتماسك أكثر'
                                },
                                {
                                    time: '2:20',
                                    rpm: 200,
                                    action: 'إضافة السكر - الدفعة الثالثة',
                                    detail: [
                                        'أوقف الخلاط',
                                        'أضف آخر 40 جرام سكر',
                                        'شغّل واخفق 10 ثوانٍ'
                                    ],
                                    checkpoint: 'كل السكر الآن مدمج'
                                },
                                {
                                    time: '2:30 - 6:00',
                                    rpm: 280,
                                    speed: 'عالية (High - Setting 8)',
                                    action: 'الخفق النهائي للكريمة',
                                    detail: [
                                        'ارفع السرعة للعالية',
                                        'راقب بعناية كل 30 ثانية',
                                        'ابحث عن علامات التحول'
                                    ],
                                    visualCues: {
                                        '3:00': 'الكريمة تبدأ بتكوين موجات عند دوران المضرب',
                                        '4:00': 'تبدأ القمم الناعمة (Soft Peak) - تنحني تماماً',
                                        '5:00': 'قمم متوسطة (Medium Peak) - تنحني قليلاً ثم تثبت',
                                        '6:00': 'قمم متوسطة إلى قوية - الهدف!'
                                    },
                                    sensoryCheckpoints: [
                                        {
                                            time: 'كل 30 ثانية بعد الدقيقة 4',
                                            test: 'اختبار القمة (Peak Test)',
                                            method: [
                                                'أوقف الخلاط',
                                                'ارفع المضرب ببطء',
                                                'راقب شكل القمة المتكونة'
                                            ],
                                            success: 'القمة تقف ثم تنحني 45° ببطء',
                                            continue: 'القمة تسقط تماماً - استمر بالخفق',
                                            stop: 'القمة تقف صلبة (Stiff Peak) - توقف فوراً!',
                                            over: 'سطح مطفي + حبيبات صغيرة = خفق زائد!'
                                        },
                                        {
                                            test: 'اختبار اللمعان',
                                            success: 'سطح حريري لامع',
                                            failure: 'سطح مطفي = بداية التحبب'
                                        },
                                        {
                                            test: 'اختبار الحرارة',
                                            tool: 'ميزان حرارة',
                                            target: '8-10°C',
                                            warning: 'إذا تجاوزت 12°C: توقف وبرّد'
                                        }
                                    ],
                                    criticalPoint: '🔴 نقطة الخطر: الفرق بين Medium Peak المثالي و Over-whipped هو 20-30 ثانية فقط!',
                                    warning: [
                                        '⚠️ لا تترك الخلاط يعمل دون مراقبة',
                                        '⚠️ توقف عند Medium Peak - الكريمة ستثخن أكثر عند إضافة السور كريم'
                                    ]
                                }
                            ],
                            recoveryPlan: {
                                problem: 'خفق زائد (Over-whipped) - ظهرت حبيبات',
                                signs: ['سطح مطفي', 'حبيبات صغيرة مرئية', 'بداية انفصال سوائل'],
                                rescue: [
                                    'أوقف الخلاط فوراً',
                                    'أضف 50-75 مل كريمة سائلة باردة (2-4°C)',
                                    'اخفق يدوياً بملعقة 10 ثوانٍ',
                                    'ثم اخفق بالخلاط على سرعة منخفضة 20 ثانية',
                                    'توقف عند عودة اللمعان'
                                ],
                                prevention: 'مراقبة كل 30 ثانية بعد الدقيقة 4'
                            }
                        },
                        
                        {
                            number: 3,
                            name: 'دمج الكريمة الحامضة (المرحلة الثانية)',
                            duration: '3-4 دقائق',
                            temp: {
                                mixture: '8-10°C',
                                sourCream: '4-6°C'
                            },
                            actions: [
                                {
                                    time: '0:00',
                                    rpm: 0,
                                    action: 'تحضير السور كريم المصفاة',
                                    detail: [
                                        'أخرج السور كريم المصفاة من الثلاجة',
                                        'يجب أن يكون الوزن 650-700 جرام',
                                        'قس الحرارة: 4-6°C'
                                    ],
                                    checkpoint: 'قوام كثيف كالزبادي اليوناني'
                                },
                                {
                                    time: '0:00 - 1:00',
                                    rpm: 100,
                                    speed: 'منخفضة جداً (Setting 2)',
                                    action: 'الدفعة الأولى من السور كريم',
                                    detail: [
                                        'شغّل الخلاط على أقل سرعة',
                                        'أضف حوالي 250 جرام سور كريم (ثلث الكمية)',
                                        'اخفق 30 ثانية'
                                    ],
                                    visualCue: 'بداية اندماج، خطوط بيضاء تختفي تدريجياً',
                                    why: 'البدء بكمية صغيرة يسهل الدمج دون فقدان الهواء',
                                    checkpoint: 'قوام متجانس بعد 30 ثانية',
                                    warning: '⚠️ لا ترفع السرعة - ستفقد الهواء المخفوق'
                                },
                                {
                                    time: '1:00 - 2:00',
                                    rpm: 100,
                                    action: 'الدفعة الثانية',
                                    detail: [
                                        'أضف 250 جرام أخرى (الثلث الثاني)',
                                        'اخفق 30 ثانية على نفس السرعة'
                                    ],
                                    visualCue: 'اللون أكثر تجانساً، لا خطوط واضحة',
                                    sensory: {
                                        visual: 'أبيض كريمي موحد',
                                        texture: 'كريمي سميك'
                                    }
                                },
                                {
                                    time: '2:00 - 3:00',
                                    rpm: 120,
                                    speed: 'منخفضة إلى متوسطة (Setting 3)',
                                    action: 'الدفعة الثالثة والأخيرة',
                                    detail: [
                                        'أضف باقي السور كريم (200-250 جرام)',
                                        'ارفع السرعة قليلاً',
                                        'اخفق حتى التجانس الكامل'
                                    ],
                                    visualCue: 'لون موحد تماماً، بدون أي خطوط',
                                    checkpoint: 'قوام كريمي سميك موحد',
                                    duration: '30-60 ثانية'
                                },
                                {
                                    time: '3:00',
                                    rpm: 100,
                                    action: 'إضافة الفانيليا',
                                    detail: [
                                        'أضف 5 مل خلاصة فانيليا',
                                        'اخفق 15 ثانية فقط'
                                    ],
                                    why: 'الخفق الطويل يطير الرائحة',
                                    warning: 'لا تخفق أكثر من 15 ثانية بعد الفانيليا'
                                }
                            ],
                            finalCheckpoints: [
                                {
                                    test: 'اختبار القوام النهائي',
                                    method: 'ارفع ملعقة من الحشوة',
                                    success: 'تسقط ببطء، تترك أثراً على الملعقة 2-3 ثواني',
                                    tooLiquid: 'تسقط بسرعة = نقص خفق أو سور كريم غير مصفى',
                                    tooThick: 'لا تسقط = خفق زائد أو سور كريم كثيف جداً'
                                },
                                {
                                    test: 'اختبار الثبات',
                                    method: [
                                        'ضع ملعقة كبيرة من الحشوة في كوب',
                                        'اتركها 5 دقائق في حرارة الغرفة',
                                        'راقب قاع الكوب'
                                    ],
                                    success: 'لا انفصال سوائل في القاع',
                                    failure: 'ماء في القاع = سور كريم غير مصفى جيداً'
                                },
                                {
                                    test: 'اختبار درجة الحرارة النهائية',
                                    tool: 'ميزان حرارة في وسط المزيج',
                                    target: '8-10°C',
                                    action: 'إذا تجاوزت 12°C: ضع الوعاء في حمام ثلجي 3 دقائق مع التحريك برفق'
                                },
                                {
                                    test: 'اختبار اللون',
                                    success: 'أبيض كريمي ناصع موحد',
                                    failure: 'خطوط أو عدم تجانس = خفق أطول'
                                }
                            ]
                        },
                        
                        {
                            number: 4,
                            name: 'التبريد والتخزين',
                            duration: '30 دقيقة - ساعتين',
                            temp: {
                                storage: '2-4°C',
                                use: '8-10°C'
                            },
                            actions: [
                                {
                                    action: 'نقل الحشوة',
                                    detail: [
                                        'استخدم سباتولا سيليكون',
                                        'انقل كل الحشوة لوعاء نظيف محكم',
                                        'اكشط جوانب الوعاء جيداً'
                                    ],
                                    why: 'عدم ترك أي كمية = استفادة قصوى'
                                },
                                {
                                    action: 'التغطية الصحيحة',
                                    detail: [
                                        'قطع غلاف بلاستيكي كافٍ',
                                        'ضعه مباشرة على سطح الحشوة (ملامس)',
                                        'اضغط برفق لإزالة الهواء'
                                    ],
                                    critical: '🔴 الغلاف يجب أن يلامس السطح - وإلا ستتكون قشرة جافة',
                                    why: 'منع تكون قشرة جافة + منع امتصاص روائح الثلاجة'
                                },
                                {
                                    action: 'التبريد',
                                    detail: [
                                        'ضع الوعاء في الثلاجة',
                                        'الرف الأوسط (ليس الأبرد)'
                                    ],
                                    duration: '30 دقيقة كحد أدنى',
                                    maxDuration: 'ساعتين',
                                    warning: '⚠️ لا تترك أكثر من ساعتين قبل الاستخدام - قد تتصلب جداً',
                                    checkpoint: 'بعد 30 دقيقة: قوام أثخن قليلاً لكن قابل للفرد'
                                },
                                {
                                    action: 'قبل الاستخدام',
                                    detail: [
                                        'أخرج الحشوة من الثلاجة',
                                        'أزل الغلاف البلاستيكي',
                                        'حرّك برفق بملعقة خشبية',
                                        'لا تخفق - فقط قلّب'
                                    ],
                                    duration: '20 ثانية تحريك يدوي',
                                    why: 'استعادة القوام الكريمي دون إدخال هواء زائد',
                                    checkpoint: 'قوام ناعم كريمي قابل للفرد'
                                }
                            ]
                        }
                    ],
                    
                    // معايير الجودة النهائية
                    qualityControl: {
                        visualInspection: {
                            color: 'أبيض كريمي ناصع موحد (#FFFEF0)',
                            texture: 'حريري لامع، بدون حبيبات',
                            consistency: 'متجانس تماماً، لا كتل ولا انفصال',
                            surface: 'أملس ناعم'
                        },
                        physicalTests: {
                            viscosity: {
                                target: '18,000-22,000 cP at 4°C',
                                method: 'Brookfield Viscometer DV-II+',
                                spindle: '#4',
                                rpm: 20,
                                temp: '4°C',
                                acceptance: '±2000 cP'
                            },
                            pH: {
                                target: '4.3-4.5',
                                method: 'pH Meter (calibrated)',
                                temp: '20°C',
                                acceptance: '±0.1'
                            },
                            brix: {
                                target: '28-30°Brix',
                                method: 'Handheld Refractometer',
                                temp: '20°C',
                                acceptance: '±1°'
                            },
                            temperature: {
                                storage: '2-4°C',
                                use: '8-10°C',
                                max: '12°C (فقد ثبات بعدها)'
                            }
                        },
                        sensoryCriteria: [
                            {
                                attribute: 'الطعم',
                                target: 'حموضة معتدلة منعشة مع حلاوة متوازنة',
                                scale: '7/10 حلاوة، 6/10 حموضة',
                                defects: ['حموضة زائدة', 'حلاوة مفرطة', 'طعم دهني']
                            },
                            {
                                attribute: 'الرائحة',
                                target: 'كريمة طازجة مخمرة + فانيليا خفيفة',
                                defects: ['رائحة حامضة قوية', 'بدون رائحة', 'رائحة غريبة']
                            },
                            {
                                attribute: 'القوام في الفم',
                                target: 'ناعم حريري، يذوب ببطء دون حبيبات',
                                defects: ['حبيبي', 'دهني ثقيل', 'مائي']
                            },
                            {
                                attribute: 'المظهر',
                                target: 'أبيض ناصع، لمعان حريري',
                                defects: ['اصفرار', 'سطح مطفي', 'انفصال']
                            }
                        ],
                        shelfLifeTest: {
                            method: 'حفظ عينة عند 4°C',
                            checkpoints: [
                                '24 ساعة: لا تغيير',
                                '48 ساعة: قد يظهر انفصال طفيف جداً',
                                '72 ساعة: حد الصلاحية - تخلص بعدها'
                            ]
                        }
                    },
                    
                    // استكشاف الأخطاء الشامل
                    troubleshooting: [
                        {
                            problem: 'الحشوة سائلة جداً (Runny)',
                            signs: ['تسيل من الملعقة فوراً', 'لا تحتفظ بالشكل', 'تنساب بسرعة'],
                            causes: [
                                'السور كريم لم تُصفى كفاية (أكثر سبب شيوع)',
                                'الكريمة السائلة لم تُخفق لـMedium Peak',
                                'درجة الحرارة مرتفعة (>12°C) أثناء الخفق'
                            ],
                            diagnosis: 'اختبار الملعقة: إذا سقطت فوراً = سائلة جداً',
                            solutions: [
                                {
                                    method: 'إعادة التصفية',
                                    steps: [
                                        'ضع قماش موسلين في مصفاة',
                                        'اسكب الحشوة',
                                        'صفِّ في الثلاجة 2-3 ساعات',
                                        'أعد الخفق 1-2 دقيقة'
                                    ],
                                    success: '70%'
                                },
                                {
                                    method: 'إضافة كريمة مخفوقة جاهزة',
                                    steps: [
                                        'اخفق 100 جم كريمة سائلة لـStiff Peak',
                                        'اطوِها في الحشوة بسباتولا',
                                        'برّد 15 دقيقة'
                                    ],
                                    success: '80%'
                                },
                                {
                                    method: 'إضافة سور كريم مصفى إضافي',
                                    steps: [
                                        'صفِّ 150 جم سور كريم 3-4 ساعات',
                                        'اطوِه في الحشوة',
                                        'برّد 30 دقيقة'
                                    ],
                                    success: '90%'
                                }
                            ],
                            prevention: [
                                'تصفية السور كريم ليلة كاملة (8 ساعات)',
                                'التأكد من فقد 100-150جم سوائل',
                                'قياس درجة الحرارة كل 3 دقائق أثناء الخفق'
                            ]
                        },
                        {
                            problem: 'تحبب (Curdled/Grainy)',
                            signs: ['حبيبات صغيرة مرئية', 'سطح مطفي', 'قوام خشن', 'بداية انفصال'],
                            causes: [
                                'خفق زائد للكريمة السائلة (>Medium Peak)',
                                'إضافة السور كريم بسرعة كبيرة',
                                'خفق بسرعة عالية أثناء دمج السور كريم'
                            ],
                            diagnosis: 'اختبار اللمعان: سطح مطفي = تحبب',
                            solutions: [
                                {
                                    method: 'إضافة كريمة باردة',
                                    steps: [
                                        'أضف 50-75 مل كريمة سائلة باردة (2°C)',
                                        'اخفق يدوياً بملعقة 10 ثوانٍ',
                                        'ثم اخفق بالخلاط على سرعة 100 RPM لمدة 20 ثانية',
                                        'توقف فور عودة اللمعان'
                                    ],
                                    success: '85%',
                                    note: 'يعمل فقط إذا اكتشفت مبكراً'
                                },
                                {
                                    method: 'التصفية والخفق بالخلاط',
                                    steps: [
                                        'صفِّ الحشوة عبر قماش موسلين',
                                        'ضع المصفى في خلاط كهربائي (Blender)',
                                        'اخفق 30 ثانية على سرعة متوسطة',
                                        'برّد 30 دقيقة'
                                    ],
                                    success: '60%',
                                    note: 'آخر محاولة - قد يفقد بعض الهواء'
                                }
                            ],
                            prevention: [
                                'مراقبة كل 30 ثانية بعد الدقيقة 4 من الخفق',
                                'التوقف فوراً عند Medium Peak',
                                'استخدام سرعة منخفضة (100 RPM) فقط عند دمج السور كريم'
                            ]
                        },
                        {
                            problem: 'انفصال (Separation) بعد ساعات',
                            signs: ['ماء في القاع', 'طبقة دهنية في الأعلى', 'فقدان التجانس'],
                            causes: [
                                'السور كريم لم تُصفى أصلاً',
                                'خفق غير كافٍ',
                                'تخزين في درجة حرارة مرتفعة (>6°C)',
                                'تجاوز مدة الصلاحية (>72 ساعة)'
                            ],
                            diagnosis: 'فحص بعد ساعة: إذا ظهر ماء = انفصال',
                            solutions: [
                                {
                                    method: 'إعادة الخفق',
                                    steps: [
                                        'اسكب أي سوائل منفصلة',
                                        'اخفق الحشوة 1-2 دقيقة بالخلاط على 200 RPM',
                                        'برّد فوراً واستخدم خلال 6 ساعات'
                                    ],
                                    success: '50%',
                                    note: 'حل مؤقت فقط'
                                },
                                {
                                    method: 'إضافة مثبت طارئ (Gelatin)',
                                    steps: [
                                        'انقع ورقة جيلاتين (2جم) في ماء بارد 5 دقائق',
                                        'اعصرها وأذبها في 10مل ماء دافئ (50°C)',
                                        'برّدها لـ35°C',
                                        'اخلطها مع الحشوة بالخفق السريع',
                                        'برّد ساعتين'
                                    ],
                                    success: '70%',
                                    note: 'يغير القوام قليلاً لكن يثبّت'
                                }
                            ],
                            prevention: [
                                'تصفية جيدة 8 ساعات',
                                'تخزين عند 2-4°C دائماً',
                                'استخدام خلال 48 ساعة (الأمثل 24 ساعة)'
                            ]
                        },
                        {
                            problem: 'صلبة جداً (Too Stiff)',
                            signs: ['صعبة الفرد', 'تحتاج ضغط قوي', 'تتشقق عند الفرد'],
                            causes: [
                                'خفق زائد',
                                'سور كريم كثيفة جداً (تصفية أكثر من اللازم)',
                                'تبريد طويل (>2 ساعة) قبل الاستخدام'
                            ],
                            solutions: [
                                {
                                    method: 'إضافة كريمة سائلة',
                                    steps: [
                                        'أضف 2-3 ملاعق كبيرة كريمة سائلة',
                                        'اطوِ بملعقة (لا تخفق)',
                                        'اترك 5 دقائق في حرارة الغرفة'
                                    ],
                                    success: '90%'
                                },
                                {
                                    method: 'التدفئة الطفيفة',
                                    steps: [
                                        'اترك الحشوة 10-15 دقيقة في حرارة الغرفة',
                                        'قلّب برفق',
                                        'استخدم فوراً'
                                    ],
                                    success: '80%'
                                }
                            ],
                            prevention: 'عدم تصفية أكثر من 8 ساعات، استخدام خلال ساعة من التبريد'
                        }
                    ],
                    
                    // ملاحظات علمية تفصيلية
                    scienceNotes: {
                        emulsification: {
                            title: 'الاستحلاب (Emulsification)',
                            explanation: 'الدهون في الكريمة (غير قطبية) لا تذوب في الماء (قطبي). الخفق يكسر قطرات الدهون لحجم صغير جداً (2-5 ميكرون) ويحيطها بطبقة بروتينية من الكازين، مكوناً مستحلباً زيت-في-ماء مستقر.',
                            key: 'الخفق البارد (<10°C) ضروري لأن الدهون تكون صلبة جزئياً، مما يسهل تكوين فقاعات هواء ثابتة.'
                        },
                        stabilization: {
                            title: 'التثبيت بالتصفية',
                            explanation: 'التصفية تزيل الماء الحر (Free Water) من السور كريم، مما يرفع نسبة الدهون من 30% إلى ~38%. هذا يقلل نشاط الماء (aw) من 0.98 إلى 0.96، مما يبطئ نمو الميكروبات ويحسن الثبات الميكانيكي.',
                            math: 'نسبة الدهون بعد التصفية = (240 جم دهون) / (650 جم وزن نهائي) = 36.9%'
                        },
                        temperatureEffect: {
                            title: 'تأثير درجة الحرارة',
                            explanation: 'دهون الحليب تبدأ بالتصلب عند 10°C وتكون صلبة جزئياً عند 4°C. هذا يعطي بنية ميكانيكية للفقاعات الهوائية. عند >15°C، الدهون سائلة فلا تدعم الفقاعات، والحشوة تنهار.',
                            critical: 'كل 5°C زيادة تقلل الثبات 30%'
                        },
                        sugarRole: {
                            title: 'دور السكر',
                            explanation: 'السكر البودرة يذوب في الطور المائي ويزيد اللزوجة، مما يبطئ حركة قطرات الدهون ويمنع التحامها (Coalescence). أيضاً يخفض نقطة التجمد قليلاً.',
                            optimal: '10-12% سكر من الوزن الكلي'
                        },
                        whippingMechanism: {
                            title: 'آلية الخفق',
                            explanation: 'المضرب يدخل الهواء كفقاعات كبيرة (>500 ميكرون). الخفق المستمر يكسرها لفقاعات أصغر (50-200 ميكرون). بروتينات الحليب تغلف الفقاعات، والدهون الصلبة جزئياً تتجمع على سطحها، مكونة شبكة 3D.',
                            overWhipping: 'الخفق الزائد يكسر الشبكة الدهنية ويحرر الدهون السائلة = تحبب (Churning)'
                        }
                    },
                    
                    // نصائح احترافية
                    proTips: [
                        {
                            tip: 'استخدام ملح خفيف جداً',
                            detail: 'إضافة قرصة ملح (0.5 جم) عند إضافة السكر تعزز النكهات وتموّه الحموضة الزائدة',
                            when: 'اختياري - للذوق الشخصي'
                        },
                        {
                            tip: 'اختبار السور كريم قبل الشراء',
                            detail: 'افتح العبوة في المتجر (إن أمكن): يجب ألا يكون هناك ماء منفصل في الأعلى. إذا كان سائلاً = نوعية رديئة',
                            brands: 'President, Galbani, Zott (أفضل للتصفية)'
                        },
                        {
                            tip: 'تسريع التبريد',
                            detail: 'ضع الوعاء في حمام ثلجي وحرّك برفق كل دقيقة. سيبرد من 10°C إلى 4°C في 5 دقائق بدلاً من 30',
                            warning: 'لا تترك في الفريزر - قد تتجمد الحواف'
                        },
                        {
                            tip: 'اختبار نضارة الكريمة',
                            detail: 'شم الكريمة السائلة: يجب أن تكون رائحتها حلوة نظيفة. أي رائحة حامضة = قديمة، لن تخفق جيداً',
                            shelfLife: 'استخدم الكريمة خلال 3 أيام من الفتح'
                        }
                    ]
                },
        
                // ==================== PROTOCOL 2: Dulce Caramel (سيكون أقصر لتوفير المساحة) ====================
                'dulce-caramel': {
                    name: 'دولسي دي ليتشي كراميل',
                    totalTime: '12 دقيقة',
                    difficulty: 'سهل',
                    yield: '~920 جرام',
                    
                    preparation: {
                        title: 'تحضير السور كريم المصفاة',
                        duration: '6-8 ساعات',
                        steps: [{
                            action: 'تصفية 600 جم سور كريم',
                            expectedResult: { weight: '500-525 جرام' }
                        }]
                    },
                    
                    steps: [
                        {
                            number: 1,
                            name: 'تجهيز الدولسي',
                            duration: '5 دقائق',
                            actions: [
                                {
                                    time: '0:00',
                                    action: 'فحص درجة حرارة الدولسي',
                                    detail: ['يجب 18-20°C', 'إذا كان بارداً: سخّن في حمام مائي 40°C'],
                                    checkpoint: 'قوام: ينساب ببطء من الملعقة'
                                },
                                {
                                    time: '2:00',
                                    rpm: 180,
                                    action: 'خفق الدولسي منفرداً',
                                    detail: ['ضع 360جم دولسي في وعاء', 'اخفق بمضرب Paddle لمدة 3 دقائق'],
                                    visualCue: 'زيادة حجم 15-20%، لون أفتح قليلاً',
                                    why: 'إدخال هواء يسهل الدمج مع السور كريم'
                                }
                            ]
                        },
                        {
                            number: 2,
                            name: 'دمج السور كريم',
                            duration: '4 دقائق',
                            actions: [
                                {
                                    rpm: 120,
                                    action: 'إضافة السور كريم على 3 دفعات',
                                    detail: [
                                        'دفعة 1: 175جم + خفق 30 ثانية',
                                        'دفعة 2: 175جم + خفق 30 ثانية',
                                        'دفعة 3: الباقي + خفق حتى التجانس'
                                    ],
                                    checkpoint: 'لون بيج كراميلي موحد بدون خطوط بيضاء',
                                    warning: 'لا ترفع السرعة - سيسبب انفصال'
                                }
                            ]
                        },
                        {
                            number: 3,
                            name: 'الإضافات النهائية',
                            duration: '2 دقيقة',
                            actions: [
                                {
                                    action: 'إضافة ملح + ليمون',
                                    detail: ['2جم ملح بحري', '5مل عصير ليمون', 'اخفق 15 ثانية'],
                                    why: 'الملح يعزز الكراميل، الليمون يوازن الحلاوة'
                                }
                            ]
                        }
                    ],
                    
                    troubleshooting: [
                        {
                            problem: 'كتل دولسي صلبة',
                            causes: ['دولسي بارد'],
                            solutions: ['صفِّ، سخّن الكتل في حمام مائي 40°C، أعد الدمج']
                        }
                    ]
                },
        
                // ==================== PROTOCOL 3: Cream Cheese Honey with Gelatin ====================
                'cream-cheese-honey': {
                    name: 'جبن كريمي بالعسل والجيلاتين',
                    totalTime: '20 دقيقة + 4 ساعات تماسك',
                    difficulty: 'متقدم',
                    yield: '~1020 جرام',
                    
                    steps: [
                        {
                            number: 1,
                            name: 'نقع وإذابة الجيلاتين (Critical Step)',
                            duration: '10 دقائق',
                            temp: { soak: 4, melt: '50-55', use: 35 },
                            actions: [
                                {
                                    time: '0:00',
                                    action: 'نقع الجيلاتين',
                                    detail: [
                                        'ضع 20مل ماء مثلج (4°C) في كوب صغير',
                                        'أضف 4 ورقات جيلاتين (Bloom 200)',
                                        'اتركها 5 دقائق بالضبط'
                                    ],
                                    checkpoint: 'الجيلاتين يصبح مطاطياً طرياً',
                                    warning: '🔴 لا تستخدم ماء دافئ - سيذوب بشكل غير متحكم فيه'
                                },
                                {
                                    time: '5:00',
                                    action: 'عصر الجيلاتين',
                                    detail: [
                                        'اعصر الجيلاتين بيدك لإزالة الماء الزائد',
                                        'يجب أن يكون وزنه ~6 جرام بعد العصر'
                                    ]
                                },
                                {
                                    time: '6:00',
                                    action: 'إذابة الجيلاتين (نقطة حرجة)',
                                    detail: [
                                        'ضع الجيلاتين المعصور في قدر صغير',
                                        'سخّن على نار هادئة جداً',
                                        'راقب ميزان الحرارة بدقة'
                                    ],
                                    temp: '50-55°C',
                                    criticalLimit: '⚠️ لا تتجاوز 60°C أبداً!',
                                    why: '>60°C يكسر سلاسل البروتين ويفقد الجيلاتين 30-50% من قوته',
                                    visualCue: 'سائل شفاف تماماً بدون أي حبيبات',
                                    duration: '2-3 دقائق'
                                },
                                {
                                    time: '9:00',
                                    action: 'تبريد الجيلاتين (نقطة حرجة)',
                                    detail: [
                                        'أزل القدر من النار',
                                        'اتركه يبرد في حرارة الغرفة',
                                        'راقب الحرارة حتى تصل لـ35°C بالضبط'
                                    ],
                                    temp: '33-37°C',
                                    duration: '3-4 دقائق',
                                    checkpoint: 'ميزان الحرارة يقرأ 35°C، سائل تماماً',
                                    warning: '🔴 إذا تصلب: سخّن مرة أخرى لـ50°C ثم برّد لـ35°C'
                                }
                            ],
                            criticalNote: 'هذه أهم خطوة - خطأ هنا = فشل كامل'
                        },
                        {
                            number: 2,
                            name: 'تجهيز الأجبان',
                            duration: '15 دقيقة قبل الاستخدام',
                            temp: { target: '18-20' },
                            actions: [
                                {
                                    action: 'إخراج الأجبان من الثلاجة',
                                    detail: [
                                        '400جم جبن كريمي (Philadelphia)',
                                        '200جم ماسكربوني',
                                        'اتركها 15-20 دقيقة في حرارة الغرفة'
                                    ],
                                    checkpoint: 'قس الحرارة: يجب 18-20°C',
                                    test: 'اضغط بإصبعك: يترك أثراً بسهولة = جاهز',
                                    warning: '⚠️ إذا كانت باردة (<15°C): سيتكتل الجيلاتين فوراً'
                                }
                            ]
                        },
                        {
                            number: 3,
                            name: 'خفق الجبن والماسكربوني',
                            duration: '3 دقائق',
                            temp: '18-20°C',
                            actions: [
                                {
                                    rpm: 100,
                                    action: 'خفق الأجبان',
                                    detail: [
                                        'ضع الجبن الكريمي في وعاء الخلاط',
                                        'أضف الماسكربوني',
                                        'اخفق بمضرب Paddle على سرعة منخفضة'
                                    ],
                                    duration: '90 ثانية',
                                    visualCue: 'كريمي أملس بدون أي كتل',
                                    checkpoint: 'توقف، اكشط الجوانب بسباتولا، اخفق 30 ثانية إضافية'
                                },
                                {
                                    action: 'إضافة العسل والسكر',
                                    detail: [
                                        'أضف 80جم عسل طبيعي (22°C)',
                                        'أضف 60جم سكر بودرة',
                                        'اخفق 60 ثانية'
                                    ],
                                    checkpoint: 'متجانس تماماً، لون كريمي ذهبي فاتح'
                                }
                            ]
                        },
                        {
                            number: 4,
                            name: 'دمج الجيلاتين (الخطوة الحرجة)',
                            duration: '1 دقيقة',
                            temp: { gelatin: 35, cheese: '18-20' },
                            actions: [
                                {
                                    time: '0:00',
                                    action: 'فحص حرارة الجيلاتين',
                                    detail: ['يجب أن يكون 33-37°C', 'سائل تماماً'],
                                    checkpoint: 'ميزان الحرارة يقرأ 35°C'
                                },
                                {
                                    time: '0:10',
                                    rpm: 100,
                                    action: 'دمج الجيلاتين',
                                    detail: [
                                        'شغّل الخلاط على سرعة منخفضة',
                                        'اسكب الجيلاتين السائل في خط رفيع مستمر',
                                        'استمر بالخفق أثناء السكب',
                                        'اخفق 30 ثانية إضافية بعد الإضافة'
                                    ],
                                    duration: '30 ثانية',
                                    visualCue: 'دمج فوري، لا كتل جيلاتين',
                                    criticalAction: 'يجب الخفق الفوري - لا توقف',
                                    warning: '🔴 إذا ظهرت كتل جيلاتين: صفِّ فوراً واستبعد الكتل'
                                }
                            ],
                            troubleshooting: {
                                'gelatin-lumps': {
                                    cause: 'جيلاتين بارد أو أجبان باردة',
                                    immediateAction: [
                                        'أوقف الخلاط فوراً',
                                        'صفِّ عبر مصفاة ناعمة',
                                        'الكتل لن تذوب - تخلص منها',
                                        'أضف ورقتي جيلاتين إضافيتين (اتبع نفس الخطوات)'
                                    ]
                                }
                            }
                        },
                        {
                            number: 5,
                            name: 'خفق ودمج الكريمة',
                            duration: '5 دقائق',
                            actions: [
                                {
                                    action: 'خفق الكريمة السائلة منفصلة',
                                    detail: [
                                        'في وعاء منفصل بارد',
                                        'اخفق 300جم كريمة خفق 35%',
                                        'اخفق حتى Soft Peak'
                                    ],
                                    checkpoint: 'قمة ناعمة تنحني بالكامل'
                                },
                                {
                                    action: 'دمج الكريمة بالطي (Folding)',
                                    detail: [
                                        'أضف ثلث الكريمة المخفوقة لخليط الجبن',
                                        'اطوِ بسباتولا سيليكون من الأسفل للأعلى',
                                        'أضف الثلث الثاني واطوِ',
                                        'أضف الباقي واطوِ بحذر شديد'
                                    ],
                                    technique: 'حركة "J" من القاع للأعلى',
                                    duration: '30-45 ثانية فقط',
                                    warning: '⚠️ لا تخفق بالخلاط - ستفقد كل الهواء',
                                    checkpoint: 'موس خفيف موحد'
                                }
                            ]
                        },
                        {
                            number: 6,
                            name: 'التبريد والتماسك',
                            duration: '4 ساعات',
                            temp: '4°C',
                            actions: [
                                {
                                    action: 'نقل وتبريد',
                                    detail: [
                                        'انقل لوعاء محكم',
                                        'غطِّ بغلاف ملامس',
                                        'ضع في الثلاجة 4 ساعات كحد أدنى'
                                    ],
                                    why: 'الجيلاتين يحتاج 4 ساعات للتماسك الكامل',
                                    checkpoint: 'بعد 4 ساعات: قوام موس كثيف، يحتفظ بالشكل'
                                }
                            ]
                        }
                    ],
                    
                    troubleshooting: [
                        {
                            problem: 'لم يتماسك بعد 4 ساعات',
                            causes: ['جيلاتين محموم (>60°C)', 'جيلاتين قليل', 'جيلاتين منتهي الصلاحية'],
                            solutions: [
                                'سخّن 50جم من الخليط لـ50°C',
                                'أضف 2-3 ورقات جيلاتين مذابة عند 35°C',
                                'اخلط مع الباقي',
                                'برّد 4 ساعات إضافية'
                            ]
                        },
                        {
                            problem: 'صلب جداً (مطاطي)',
                            causes: ['جيلاتين زائد'],
                            solutions: ['اخلط مع 100-150جم ماسكربوني طري']
                        }
                    ]
                },
        
                // ==================== PROTOCOL 4: Custard Butter Cream ====================
                'custard-butter': {
                    name: 'كاسترد بالزبدة',
                    totalTime: '35 دقيقة + تبريد',
                    difficulty: 'متقدم',
                    yield: '~950 جرام',
                    
                    steps: [
                        {
                            number: 1,
                            name: 'تحضير خليط الصفار',
                            duration: '5 دقائق',
                            temp: '20°C',
                            actions: [
                                {
                                    action: 'فصل الصفار',
                                    detail: [
                                        'افصل 6-7 بيضات كبيرة',
                                        'خذ الصفار فقط = 150جم',
                                        '⚠️ أي أثر لبياض البيض سيسبب تخثر'
                                    ],
                                    checkpoint: 'صفار نقي 100% بدون بياض'
                                },
                                {
                                    rpm: 0,
                                    action: 'خفق الصفار والسكر',
                                    detail: [
                                        'ضع الصفار في وعاء',
                                        'أضف 120جم سكر حبيبات',
                                        'اخفق فوراً بخفاقة يدوية'
                                    ],
                                    duration: '2-3 دقائق',
                                    visualCue: 'كريمي أصفر فاتح، يسقط كشريط سميك',
                                    why: '⚠️ السكر يسحب الماء من الصفار - إذا تركته سيتكتل (Sugar Burn)',
                                    checkpoint: 'حجم يزيد 50%، لون أفتح'
                                },
                                {
                                    action: 'إضافة النشا',
                                    detail: [
                                        'انخل 50جم نشا ذرة',
                                        'أضفه للصفار',
                                        'اخفق حتى يذوب تماماً'
                                    ],
                                    checkpoint: 'بدون أي كتل نشا',
                                    warning: 'النشا المتكتل سيبقى كتلاً في الكاسترد'
                                }
                            ]
                        },
                        {
                            number: 2,
                            name: 'تسخين الحليب',
                            duration: '5 دقائق',
                            temp: '80-85°C',
                            actions: [
                                {
                                    action: 'تحضير قرن الفانيليا',
                                    detail: [
                                        'شق قرن الفانيليا بالطول',
                                        'اكشط البذور بسكين',
                                        'ضع القرن والبذور في قدر'
                                    ]
                                },
                                {
                                    action: 'تسخين الحليب',
                                    detail: [
                                        'أضف 450جم حليب كامل الدسم للقدر',
                                        'سخّن على نار متوسطة',
                                        'حرّك باستمرار'
                                    ],
                                    temp: '80-85°C',
                                    visualCue: 'بخار يظهر، رائحة فانيليا قوية',
                                    checkpoint: 'لا فقاعات غليان - فقط بخار',
                                    warning: '⚠️ إذا غلى: طعم محروق + تبخر زائد'
                                }
                            ]
                        },
                        {
                            number: 3,
                            name: 'التمبرنج (Tempering) - نقطة حرجة',
                            duration: '3-4 دقائق',
                            temp: '65-70°C',
                            actions: [
                                {
                                    action: 'تمبرنج الصفار (تدريج الحرارة)',
                                    detail: [
                                        'خذ نصف كوب (~100مل) من الحليب الساخن',
                                        'اسكبه بخيط رفيف جداً على الصفار',
                                        'اخفق بسرعة أثناء السكب',
                                        'استمر بالخفق 30 ثانية'
                                    ],
                                    why: '💡 رفع حرارة الصفار تدريجياً يمنع التخثر الفوري',
                                    visualCue: 'خليط صفار دافئ متجانس',
                                    criticalPoint: '🔴 توقف عن الخفق = تخثر فوري'
                                },
                                {
                                    action: 'إضافة خليط الصفار للحليب',
                                    detail: [
                                        'اسكب خليط الصفار الدافئ في قدر الحليب',
                                        'اسكب ببطء مع التحريك المستمر',
                                        'لا تتوقف عن التحريك أبداً'
                                    ],
                                    checkpoint: 'خليط موحد بدون كتل'
                                }
                            ]
                        },
                        {
                            number: 4,
                            name: 'الطبخ (أخطر مرحلة)',
                            duration: '8-10 دقائق',
                            temp: '82-85°C',
                            actions: [
                                {
                                    action: 'الطبخ مع التحريك المستمر',
                                    detail: [
                                        'ارجع القدر للنار المتوسطة',
                                        'حرّك بخفاقة بشكل "8" مستمر',
                                        'اكشط القاع والجوانب',
                                        'راقب ميزان الحرارة كل 30 ثانية'
                                    ],
                                    temp: '82-85°C',
                                    criticalLimits: {
                                        min: '82°C - لن يثخن تحتها',
                                        max: '85°C - لا تتجاوزها',
                                        danger: '90°C - تخثر كامل'
                                    },
                                    visualCues: {
                                        '70°C': 'يبدأ بالتثخن قليلاً',
                                        '78°C': 'تثخن واضح',
                                        '82°C': 'سميك، يغطي الخفاقة'
                                    },
                                    checkpoint: 'اختبار Nappé',
                                    nappéTest: {
                                        method: [
                                            'ارفع ملعقة خشبية من الكاسترد',
                                            'مرر إصبعك على ظهر الملعقة',
                                            'إذا بقي الخط واضحاً = جاهز'
                                        ],
                                        visual: 'خط واضح لا يسيل'
                                    },
                                    warning: '🔴 لا تتوقف عن التحريك حتى لو رن الهاتف!'
                                }
                            ],
                            recoveryPlan: {
                                'scrambled': {
                                    signs: 'حبيبات صغيرة، قوام خشن',
                                    immediateAction: [
                                        'أزل من النار فوراً',
                                        'صفِّ عبر مصفاة ناعمة جداً',
                                        'اخفق بخلاط كهربائي 1 دقيقة',
                                        'أضف 50جم زبدة واخلط'
                                    ],
                                    success: '60% - سيكون القوام مقبولاً'
                                }
                            }
                        },
                        {
                            number: 5,
                            name: 'التصفية وإضافة الزبدة',
                            duration: '3 دقائق',
                            temp: '85°C → 40°C',
                            actions: [
                                {
                                    action: 'تصفية فورية',
                                    detail: [
                                        'فور الوصول لـ82-85°C: أزل من النار',
                                        'صفِّ فوراً عبر مصفاة شبكية ناعمة',
                                        'اضغط بملعقة لتمرير كل الكاسترد'
                                    ],
                                    why: 'إزالة أي كتل صغيرة + قرن الفانيليا',
                                    checkpoint: 'كاسترد أملس 100%'
                                },
                                {
                                    action: 'إضافة الزبدة',
                                    detail: [
                                        'أضف 180جم زبدة طرية (20°C) مقطعة مكعبات',
                                        'قلّب بخفاقة حتى تذوب تماماً',
                                        'لا تخفق - فقط قلّب'
                                    ],
                                    temp: 'الكاسترد يجب أن يكون ~80°C',
                                    visualCue: 'لمعان قوي، زبدي',
                                    why: 'الزبدة تضيف غنى ولمعان'
                                }
                            ]
                        },
                        {
                            number: 6,
                            name: 'التبريد السريع',
                            duration: '10-15 دقيقة',
                            temp: '85°C → 20°C',
                            actions: [
                                {
                                    action: 'حمام ثلجي',
                                    detail: [
                                        'حضّر وعاء كبير: ثلج + ماء',
                                        'ضع وعاء الكاسترد في الحمام الثلجي',
                                        'حرّك كل دقيقة بملعقة',
                                        'راقب الحرارة'
                                    ],
                                    target: 'من 85°C إلى 20°C في 10-15 دقيقة',
                                    why: 'تبريد سريع = منع نمو بكتيري',
                                    checkpoint: 'ميزان الحرارة يقرأ 20°C'
                                },
                                {
                                    action: 'تغطية ملامسة',
                                    detail: [
                                        'ضع غلاف بلاستيكي مباشرة على السطح',
                                        'اضغط لإزالة الهواء',
                                        'ضع في الثلاجة'
                                    ],
                                    duration: 'ساعتين كحد أدنى',
                                    why: 'منع تكون قشرة جافة'
                                }
                            ]
                        }
                    ],
                    
                    troubleshooting: [
                        {
                            problem: 'رقيق جداً (لم يثخن)',
                            causes: ['لم يصل لـ82°C', 'نشا قليل'],
                            solutions: [
                                'أعد التسخين لـ82°C مع التحريك',
                                'أو: أذب 1 ملعقة نشا في 2 ملعقة حليب بارد، أضفها للكاسترد، أعد التسخين'
                            ]
                        }
                    ]
                },
        
                // ==================== PROTOCOLS 5-8: (مختصرة للمساحة) ====================
                'ahmed-shawky-caramel': {
                    name: 'أحمد شوقي 1: كريمة كراميل',
                    totalTime: '25 دقيقة',
                    difficulty: 'متوسط',
                    
                    steps: [
                        {
                            number: 1,
                            name: 'خفق الزبدة',
                            actions: [{ rpm: 200, action: 'اخفق 200جم زبدة (18°C) لمدة 90 ثانية حتى كريمية بيضاء' }]
                        },
                        {
                            number: 2,
                            name: 'دمج الكراميل',
                            actions: [{
                                action: 'أضف 250جم كراميل (22°C) على 3 دفعات، اخفق 30 ثانية بعد كل دفعة',
                                warning: 'كراميل بارد = كتل صلبة'
                            }]
                        },
                        {
                            number: 3,
                            name: 'خفق ودمج الكريمة',
                            actions: [
                                { action: 'اخفق 250جم كريمة خفق لـMedium Peak في وعاء منفصل' },
                                { action: 'اخفق 100جم سور كريم مع الكريمة 30 ثانية' },
                                { action: 'اطوِ في خليط الزبدة والكراميل' }
                            ]
                        }
                    ]
                },
        
                'ahmed-shawky-sugar': {
                    name: 'أحمد شوقي 2: كريمة سكر',
                    totalTime: '12 دقيقة',
                    difficulty: 'سهل',
                    
                    steps: [
                        {
                            number: 1,
                            name: 'خفق الكريمة بالسكر',
                            actions: [{
                                action: 'اخفق 250جم كريمة خفق (2°C) مع إضافة 150جم سكر بودرة تدريجياً حتى Soft Peak',
                                duration: '4-5 دقائق'
                            }]
                        },
                        {
                            number: 2,
                            name: 'طي السور كريم',
                            actions: [{
                                action: 'اطوِ 500جم سور كريم (6°C) على 3 دفعات بسباتولا فقط',
                                warning: 'لا تخفق - ستفقد الهواء'
                            }]
                        }
                    ]
                },
        
                'ahmed-shawky-condensed': {
                    name: 'أحمد شوقي 3: حليب مكثف',
                    totalTime: '20 دقيقة',
                    difficulty: 'متوسط',
                    
                    steps: [
                        {
                            number: 1,
                            name: 'خفق الزبدة والجبن',
                            actions: [{
                                action: 'اخفق 100جم زبدة (18°C) لمدة 60 ثانية، أضف 120جم جبن كريمي (18°C)، اخفق 90 ثانية',
                                checkpoint: 'كريمي أملس بدون كتل'
                            }]
                        },
                        {
                            number: 2,
                            name: 'دمج الحليب المكثف',
                            actions: [{
                                action: 'أضف 400جم حليب مكثف (20°C) على 3 دفعات، اخفق 30 ثانية بعد كل دفعة',
                                checkpoint: 'كريمي موحد'
                            }]
                        }
                    ]
                },
        
                'ahmed-abdelsalam': {
                    name: 'أحمد عبد السلام: الثلاثي الغني',
                    totalTime: '30 دقيقة',
                    difficulty: 'متقدم',
                    
                    preparation: {
                        title: 'تساوي درجة الحرارة (حرج جداً)',
                        duration: '15-20 دقيقة',
                        critical: true,
                        steps: [{
                            action: 'أخرج 200جم زبدة + 200جم جبن كريمي من الثلاجة، اتركها 15-20 دقيقة حتى 18-20°C',
                            checkpoint: 'قس كل مكون: يجب 18-20°C بالضبط (فرق لا يزيد عن 2°C)',
                            why: 'اختلاف الحرارة = انفصال وتكتل فوري'
                        }]
                    },
                    
                    steps: [
                        {
                            number: 1,
                            name: 'خفق الزبدة',
                            actions: [{ rpm: 200, action: 'اخفق الزبدة 90 ثانية حتى كريمية فاتحة (حجم +40%)' }]
                        },
                        {
                            number: 2,
                            name: 'دمج الجبن',
                            actions: [{
                                action: 'أضف الجبن الكريمي على 3 دفعات، اخفق 30 ثانية بعد كل دفعة',
                                checkpoint: 'أملس تماماً بدون كتل'
                            }]
                        },
                        {
                            number: 3,
                            name: 'دمج الدولسي (نقطة حرجة)',
                            actions: [{
                                action: 'تأكد أن الدولسي 20-22°C، اخفقه منفرداً 2 دقيقة، ثم أضفه على دفعتين، اخفق برفق 120 RPM',
                                warning: 'خفق زائد = سيولة'
                            }]
                        }
                    ],
                    
                    troubleshooting: [{
                        problem: 'انفصال طبقتين',
                        cause: 'اختلاف حرارة المكونات',
                        solution: 'دفّئ لـ25°C واخفق بقوة 3-4 دقائق'
                    }]
                }
            };
            
            return protocols[presetId] || null;
        },

        // Calculate sweetness index
        calculateSweetnessIndex(recipe) {
            const sweetnessPower = {
                'sucrose': 100,           // السكروز (مرجع)
                'fructose': 173,          // الفركتوز (أحلى)
                'glucose': 74,            // الجلوكوز (أقل)
                'lactose': 16,            // اللاكتوز (أقل بكثير)
                'honey': 110,             // العسل (مزيج فركتوز+جلوكوز)
                'condensed-milk': 65,     // متوسط بسبب اللاكتوز
                'dulce-de-leche': 78,     // معدّل من 82 كما اقترحت
                'caramel': 140            // كراميل محروق (أحلى)
            };
            
            const sugarContent = {
                'powdered-sugar': 1.00,
                'sugar': 1.00,
                'granulated-sugar': 1.00,
                'condensed-milk': 0.55,
                'sweetened-condensed-milk': 0.55,
                'dulce-de-leche': 0.55,
                'dulce-de-leche-authentic': 0.55,
                'caramel': 0.70,
                'homemade-caramel': 0.70,
                'honey': 0.82,
                'honey-raw': 0.82,
                'sour-cream': 0.04,
                'sour-cream-30': 0.04,
                'whipping-cream': 0.03,
                'heavy-cream-35': 0.03,
                'cream-cheese': 0.03,
                'cream-cheese-full-fat': 0.03,
                'butter': 0.001,
                'unsalted-butter': 0.001,
                'milk': 0.05,
                'whole-milk': 0.05,
                'egg-yolks': 0.01,
                'egg-yolks-large': 0.01,
                'mascarpone': 0.03,
                'vanilla-extract': 0.00,
                'vanilla-bean-pod': 0.00,
                'cornstarch': 0.00,
                'gelatin-sheets': 0.00,
                'sea-salt-fine': 0.00,
                'sea-salt-flakes': 0.00,
                'lemon-juice-fresh': 0.00,
                'orange-zest': 0.00
            };
            
            let totalSweetness = 0;
            let totalWeight = 0;
            
            for (const [ingredient, data] of Object.entries(recipe)) {
                // التعامل مع البنية الجديدة (amount في object)
                const weight = typeof data === 'object' ? (data.amount || 0) : data;
                
                const sugar = weight * (sugarContent[ingredient] || 0);
                const power = sweetnessPower[this.getSugarType(ingredient)] || 0;
                
                totalSweetness += sugar * power;
                totalWeight += weight;
            }
            
            if (totalWeight === 0) return { index: 0, level: 'غير محلى', percentage: '0', color: '#4CAF50' };
            
            const index = (totalSweetness / totalWeight);
            
            return {
                index: index,
                percentage: index.toFixed(1),
                level: this.getSweetnessLevel(index),
                color: this.getSweetnessColor(index),
                raw: {
                    totalSweetness: totalSweetness.toFixed(1),
                    totalWeight: totalWeight.toFixed(1),
                    sugarEquivalent: (totalSweetness / 100).toFixed(1) + ' جم سكروز'
                }
            };
        },

        getSugarType(ingredient) {
            const mapping = {
                'powdered-sugar': 'sucrose',
                'powdered-sugar-fine': 'sucrose',
                'sugar': 'sucrose',
                'granulated-sugar': 'sucrose',
                'condensed-milk': 'condensed-milk',
                'sweetened-condensed-milk': 'condensed-milk',
                'dulce-de-leche': 'dulce-de-leche',
                'dulce-de-leche-authentic': 'dulce-de-leche',
                'caramel': 'caramel',
                'homemade-caramel': 'caramel',
                'honey': 'honey',
                'honey-raw': 'honey',
                'sour-cream': 'lactose',
                'sour-cream-30': 'lactose',
                'whipping-cream': 'lactose',
                'heavy-cream-35': 'lactose',
                'cream-cheese': 'lactose',
                'cream-cheese-full-fat': 'lactose',
                'milk': 'lactose',
                'whole-milk': 'lactose',
                'mascarpone': 'lactose'
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

        // Smart scaling with sweetness adjustment
        scaleWithSweetnessAdjustment(baseRecipe, targetWeight, sweetnessReduction = 0) {
            const baseTotal = Object.values(baseRecipe).reduce((a,b) => a+b, 0);
            if (baseTotal === 0) return null;
            
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
                originalSweetness: this.calculateSweetnessIndex(baseRecipe),
                newSweetness: this.calculateSweetnessIndex(scaledRecipe),
                reductionApplied: (1 - sugarReduction) * 100
            };
        },

        // Calculate water activity
        calculateWaterActivity(recipe) {
            const waterContent = {
                'whipping-cream': 0.60,
                'heavy-cream-35': 0.60,
                'sour-cream': 0.72,
                'sour-cream-30': 0.72,
                'cream-cheese': 0.55,
                'cream-cheese-full-fat': 0.55,
                'butter': 0.16,
                'unsalted-butter': 0.16,
                'condensed-milk': 0.27,
                'sweetened-condensed-milk': 0.27,
                'dulce-de-leche': 0.20,
                'dulce-de-leche-authentic': 0.20,
                'caramel': 0.15,
                'homemade-caramel': 0.15,
                'powdered-sugar': 0.005,
                'powdered-sugar-fine': 0.005,
                'sugar': 0.005,
                'granulated-sugar': 0.005,
                'milk': 0.87,
                'whole-milk': 0.87,
                'egg-yolks': 0.50,
                'egg-yolks-large': 0.50,
                'honey': 0.18,
                'honey-raw': 0.18,
                'mascarpone': 0.50,
                'cornstarch': 0.12,
                'gelatin-sheets': 0.10,
                'vanilla-extract': 0.40,
                'lemon-juice-fresh': 0.90
            };
            
            let totalWater = 0;
            let totalSolutes = 0;
            let totalWeight = 0;
            
            for (const [ingredient, data] of Object.entries(recipe)) {
                const weight = typeof data === 'object' ? (data.amount || 0) : data;
                const water = weight * (waterContent[ingredient] || 0);
                totalWater += water;
                
                // حساب المذابات (سكريات وأملاح)
                const highSugar = ['condensed-milk', 'sweetened-condensed-milk', 'dulce-de-leche', 
                                  'dulce-de-leche-authentic', 'caramel', 'homemade-caramel', 
                                  'powdered-sugar', 'powdered-sugar-fine', 'sugar', 
                                  'granulated-sugar', 'honey', 'honey-raw'];
                if (highSugar.includes(ingredient)) {
                    totalSolutes += weight * 0.6;
                }
                
                totalWeight += weight;
            }
            
            if (totalWeight === 0) return { 
                value: 0, 
                moistureTransferRate: 'غير محسوب', 
                maturationTime: 'غير محسوب',
                stability: 'غير محسوب'
            };
            
            // قانون Raoult المبسط
            const moleFractionWater = totalWater / (totalWater + totalSolutes * 0.003);
            const aw = Math.min(0.99, moleFractionWater * 0.99);
            
            return {
                value: parseFloat(aw.toFixed(3)),
                moistureTransferRate: this.getMoistureTransferRate(aw),
                maturationTime: this.getMaturationTime(aw),
                stability: this.getStabilityFromAw(aw),
                microbialSafety: this.getMicrobialSafety(aw),
                raw: {
                    totalWater: totalWater.toFixed(1) + ' جم',
                    waterPercentage: ((totalWater / totalWeight) * 100).toFixed(1) + '%'
                }
            };
        },

        getMoistureTransferRate(aw) {
            if (aw > 0.95) return "سريع جداً (2-3 مم/ساعة) - ترطيب سريع";
            if (aw > 0.90) return "سريع (1-2 مم/ساعة) - ترطيب جيد";
            if (aw > 0.85) return "متوسط (0.5-1 مم/ساعة) - ترطيب تدريجي";
            return "بطيء (<0.5 مم/ساعة) - ترطيب بطيء جداً";
        },

        getMaturationTime(aw) {
            if (aw > 0.95) return "12-24 ساعة";
            if (aw > 0.90) return "18-30 ساعة";
            if (aw > 0.85) return "24-36 ساعة";
            return "36-48 ساعة";
        },

        getStabilityFromAw(aw) {
            if (aw > 0.95) return 'منخفض - قد ينفصل';
            if (aw > 0.90) return 'متوسط';
            if (aw > 0.85) return 'جيد';
            return 'ممتاز - استقرار عالي';
        },
        
        getMicrobialSafety(aw) {
            if (aw > 0.95) return 'خطر متوسط - استخدم خلال 48 ساعة';
            if (aw > 0.90) return 'آمن - حتى 72 ساعة';
            if (aw > 0.85) return 'آمن جداً - حتى 5 أيام';
            return 'آمن للغاية - حتى أسبوع';
        },

        // Calculate stability score
        calculateStability(recipe) {
            let score = 50; // نقطة البداية
            
            const totalWeight = Object.values(recipe).reduce((sum, data) => {
                const weight = typeof data === 'object' ? (data.amount || 0) : data;
                return sum + weight;
            }, 0);
            
            if (totalWeight === 0) return { score: 0, level: 'غير محسوب', details: [] };
            
            const details = [];
            
            // عوامل تزيد الثبات
            const stabilizers = {
                'butter': { power: 15, reason: 'دهون صلبة' },
                'unsalted-butter': { power: 15, reason: 'دهون صلبة' },
                'cream-cheese': { power: 20, reason: 'بروتينات مستحلبة' },
                'cream-cheese-full-fat': { power: 20, reason: 'بروتينات مستحلبة' },
                'condensed-milk': { power: 10, reason: 'سكريات عالية' },
                'sweetened-condensed-milk': { power: 10, reason: 'سكريات عالية' },
                'dulce-de-leche': { power: 12, reason: 'سكريات + مايلارد' },
                'dulce-de-leche-authentic': { power: 12, reason: 'سكريات + مايلارد' },
                'caramel': { power: 10, reason: 'سكريات مكرملة' },
                'homemade-caramel': { power: 10, reason: 'سكريات مكرملة' },
                'cornstarch': { power: 25, reason: 'جيلاتنة النشا' },
                'gelatin-sheets': { power: 35, reason: 'شبكة جيلاتين' },
                'egg-yolks': { power: 8, reason: 'ليسيثين مستحلب' },
                'egg-yolks-large': { power: 8, reason: 'ليسيثين مستحلب' },
                'mascarpone': { power: 15, reason: 'دهون ثقيلة' }
            };
            
            // عوامل تقلل الثبات
            const destabilizers = {
                'milk': { power: -10, reason: 'ماء زائد' },
                'whole-milk': { power: -10, reason: 'ماء زائد' },
                'whipping-cream': { power: -5, reason: 'دهون سائلة جزئياً' },
                'heavy-cream-35': { power: -5, reason: 'دهون سائلة جزئياً' }
            };
            
            for (const [ingredient, data] of Object.entries(recipe)) {
                const weight = typeof data === 'object' ? (data.amount || 0) : data;
                const percentage = (weight / totalWeight) * 100;
                
                if (stabilizers[ingredient]) {
                    const contribution = (percentage * stabilizers[ingredient].power) / 100;
                    score += contribution;
                    if (contribution > 1) {
                        details.push({
                            ingredient: ingredient,
                            effect: '+' + contribution.toFixed(1),
                            reason: stabilizers[ingredient].reason
                        });
                    }
                }
                
                if (destabilizers[ingredient]) {
                    const contribution = (percentage * destabilizers[ingredient].power) / 100;
                    score += contribution; // سالب
                    if (Math.abs(contribution) > 1) {
                        details.push({
                            ingredient: ingredient,
                            effect: contribution.toFixed(1),
                            reason: destabilizers[ingredient].reason
                        });
                    }
                }
            }
            
            // حدود النقاط
            score = Math.max(0, Math.min(100, score));
            
            let level, recommendation;
            if (score >= 80) {
                level = 'ممتاز';
                recommendation = 'ثبات استثنائي - مناسب للطقس الدافئ';
            } else if (score >= 60) {
                level = 'جيد';
                recommendation = 'ثبات جيد - مناسب لمعظم الظروف';
            } else if (score >= 40) {
                level = 'متوسط';
                recommendation = 'ثبات مقبول - استخدم بسرعة';
            } else {
                level = 'ضعيف';
                recommendation = 'ثبات ضعيف - قد ينفصل بسرعة';
            }
            
            return {
                score: Math.round(score),
                level: level,
                recommendation: recommendation,
                details: details
            };
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
        SecurityService, 
        ParserService, 
        AnalysisService, 
        TemperingService, 
        ScalingService,
        FillingService,
        StorageService
    };
})(window);