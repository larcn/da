// ===================================================================================
// CORE.JS - The Scientific Brain of the Medovik Calculator
//
// Responsibilities:
// 1. All scientific and mathematical calculations.
// 2. Data processing, parsing, and analysis logic.
// 3. Security validation and sanitization.
// 4. Storage management (localStorage).
// 5. This file is completely UI-agnostic. It does not touch the DOM.
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
            DRYNESS_RATE: 0.05
        },
        FILLING: { 
            DENSITY: 1.1 
        },
        AVERAGE_DOUGH_DENSITY: 1.25,
        DEFAULT_AIR_FACTOR: 0.03  // تقليل من 0.10 إلى 0.03 للميدوفيك
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
            
            // تحقق إضافي: نسبة الصودا للدقيق
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
        // ثوابت التحويل
        CONVERSIONS: {
            tsp: { soda: 4.6 },
            tbsp: { soda: 13.8 },
            cup: { flour: 120, sugar: 200, honey: 340 },
            eggWeight: 55  // متوسط وزن البيضة
        },

        parseRecipeText(text) {
            const ingredients = { flour: 0, butter: 0, sugar: 0, honey: 0, eggs: 0, soda: 0 };
            
            // معالجة النص
            const normalizedText = text
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))  // أرقام عربية
                .replace(/[٫،]/g, '.')  // فاصلة عشرية عربية
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

                    // Pattern 1: رقم قبل المكون (500 جم دقيق)
                    let regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.gram}\\s*${key}`, 'i');
                    let match = normalizedText.match(regex);
                    
                    if (!match) {
                        // Pattern 2: المكون قبل الرقم (دقيق 500 جم)
                        regex = new RegExp(`${key}\\s*:?\\s*(\\d*\\.?\\d+)\\s*${unitPatterns.gram}`, 'i');
                        match = normalizedText.match(regex);
                    }

                    if (match) {
                        value = parseFloat(match[1]);
                        
                        // تحويل عدد البيض إلى جرامات
                        if (ingredient === 'eggs' && value > 0 && value <= 20 && Number.isInteger(value)) {
                            value *= this.CONVERSIONS.eggWeight;
                        }
                        found = true;
                    }

                    // بحث عن وحدات خاصة
                    if (!found && ingredient === 'soda') {
                        // ملعقة صغيرة
                        regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.tsp}\\s*${key}`, 'i');
                        match = normalizedText.match(regex);
                        if (match) {
                            value = parseFloat(match[1]) * this.CONVERSIONS.tsp.soda;
                            found = true;
                        }
                        
                        // ملعقة كبيرة
                        if (!found) {
                            regex = new RegExp(`(\\d*\\.?\\d+)\\s*${unitPatterns.tbsp}\\s*${key}`, 'i');
                            match = normalizedText.match(regex);
                            if (match) {
                                value = parseFloat(match[1]) * this.CONVERSIONS.tbsp.soda;
                                found = true;
                            }
                        }
                    }

                    // بحث عن كوب
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
            
            // عتبات محدثة للميدوفيك (20-26% مثالي)
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
            
            // العوامل المؤثرة
            const honeyShare = recipe.honey / Math.max(1, recipe.honey + recipe.sugar);
            const butterRatio = percentages.butter / 100;
            
            // حساب التلوين (Maillard + Caramelization)
            const maillardRate = 0.005 * Math.exp((temp - 150) / 20);
            const sugarEffect = 1 + 0.4 * honeyShare; // العسل يسرع التلوين
            const sodaEffect = analysis.checks.soda === 'high' ? 1.15 : 
                               analysis.checks.soda === 'low' ? 0.85 : 1.0;
            const thicknessEffect = Math.sqrt(3 / Math.max(1, thickness)); // طبقات أرق = تلوين أسرع
            
            const browningIndex = 100 * (1 - Math.exp(-maillardRate * time * sugarEffect * sodaEffect * thicknessEffect));
            
            // حساب الجفاف
            const moistureRate = 0.01 * Math.exp((temp - 100) / 30);
            const butterProtection = 1 - butterRatio * 0.5; // الدهون تحمي من الجفاف
            const thicknessDryness = thickness / 3; // طبقات أسمك = جفاف أبطأ
            
            const moistureLoss = analysis.hydration * (1 - Math.exp(-moistureRate * time)) * 0.3 * butterProtection / thicknessDryness;
            
            // تقييم النتائج
            let colorAssessment, textureAssessment, recommendations = [];
            
            // اللون
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
            
            // القوام
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
            
            // دلائل حسية متوقعة
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
                
                // دلائل حسية لكل دفعة
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
            
            // تقييم شامل
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
            
            // استخدام airFactor مخفض للميدوفيك
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
            
            // حساب المقادير بناءً على النسب المثالية
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
        StorageService
    };
})(window);