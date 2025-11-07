// ===================================================================================
// UI.JS - The User Interface Renderer (Part 1 of 2)
//
// Responsibilities:
// 1. Rendering data from the Core logic to the DOM.
// 2. Reading user input from form fields.
// 3. Handling UI state changes (e.g., showing/hiding elements, toggling classes).
// 4. This file should NOT contain any core calculation or business logic.
// ===================================================================================

(function(window, Core) {
    'use strict';

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ============================ UTILITY FUNCTIONS =============================
    const escapeHTML = (str) => {
        if (typeof str !== 'string') return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            "/": '&#x2F;',
        };
        return str.replace(/[&<>"'/]/g, (s) => map[s]);
    };

    const formatNumber = (num, decimals = 1) => {
        return typeof num === 'number' ? num.toFixed(decimals) : num;
    };

    const UIRenderer = {
        
        // ============================ ANALYSIS TAB =============================
        renderAnalysisResults(analysis, prediction) {
            const container = $('#analysis-results-wrapper');
            if (!analysis) {
                container.innerHTML = `<div class="alert alert-info">أدخل المقادير واضغط "تحليل" لعرض النتائج.</div>`;
                return;
            }
            if (analysis.error) {
                container.innerHTML = `<div class="alert alert-danger"><strong>خطأ في المدخلات:</strong><br>${escapeHTML(analysis.error)}</div>`;
                return;
            }

            const mainAnalysisHTML = this.createMainAnalysisHTML(analysis);
            const doughPredictionHTML = this.createDoughPredictionHTML(prediction);

            container.innerHTML = `
                <div class="results-grid">
                    ${mainAnalysisHTML}
                    ${doughPredictionHTML}
                </div>
            `;
        },

        createMainAnalysisHTML(analysis) {
            const { qualityScore, checks, percentages, hydration, totalWeight } = analysis;
            const scoreClass = qualityScore >= 80 ? 'score-high' : qualityScore >= 60 ? 'score-medium' : 'score-low';
            const scoreText = qualityScore >= 80 ? 'ممتازة' : qualityScore >= 60 ? 'جيدة' : 'تحتاج تحسين';

            const componentNames = { 
                flour: 'الدقيق', 
                butter: 'الزبدة', 
                sugars: 'السكريات', 
                eggs: 'البيض', 
                soda: 'صودا الخبز' 
            };
            
            const rows = Object.keys(componentNames).map(key => {
                return this.createAnalysisRow(componentNames[key], percentages[key], checks[key]);
            }).join('');

            return `
                <div class="result-box">
                    <h3>📊 تقييم الجودة العلمية</h3>
                    <div class="quality-assessment">
                        <div class="score-display ${scoreClass}">
                            <span class="score-value">${qualityScore}</span>
                            <span class="score-max">/100</span>
                        </div>
                        <div class="score-label">${scoreText}</div>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${scoreClass.replace('score-','progress-')}" style="width:${qualityScore}%"></div>
                    </div>
                    
                    <div class="analysis-info">
                        <div class="info-item">
                            <span class="info-label">الوزن الإجمالي:</span>
                            <span class="info-value">${totalWeight.toFixed(0)} جرام</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">نسبة السوائل (Hydration):</span>
                            <span class="info-value ${hydration >= 20 && hydration <= 26 ? 'text-success' : 'text-warning'}">${hydration.toFixed(1)}%</span>
                        </div>
                    </div>
                    
                    <table class="analysis-table">
                        <thead>
                            <tr>
                                <th>المكون</th>
                                <th>النسبة %</th>
                                <th>الحالة</th>
                                <th>النطاق المثالي</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        },
        
        createAnalysisRow(name, value, status) {
            const statusMap = { 
                optimal: '✅ مثالي', 
                low: '⚠️ منخفض', 
                high: '❌ مرتفع' 
            };
            const classMap = { 
                optimal: 'score-high', 
                low: 'score-medium', 
                high: 'score-low' 
            };
            
            // Get ideal range
            const componentKey = Object.keys(Core.CONSTANTS.SCIENTIFIC_RANGES).find(
                key => name === 'الدقيق' && key === 'flour' ||
                       name === 'الزبدة' && key === 'butter' ||
                       name === 'السكريات' && key === 'sugars' ||
                       name === 'البيض' && key === 'eggs' ||
                       name === 'صودا الخبز' && key === 'soda'
            );
            const range = Core.CONSTANTS.SCIENTIFIC_RANGES[componentKey];
            const rangeText = range ? `${range.min}-${range.max}%` : '';
            
            return `
                <tr>
                    <td>${name}</td>
                    <td>${value.toFixed(1)}%</td>
                    <td><span class="status-badge ${classMap[status]}">${statusMap[status]}</span></td>
                    <td class="range-text">${rangeText}</td>
                </tr>`;
        },
        
        createDoughPredictionHTML(prediction) {
            if (!prediction) return '';
            const { hydration, texture, sensory, techniques, visualIndicator, troubleshooting } = prediction;
            const hydrationClass = hydration >= 20 && hydration <= 26 ? 'score-high' : 
                                  hydration < 20 || hydration > 32 ? 'score-low' : 'score-medium';
            
            return `
                <div class="result-box">
                    <h3>🍞 تحليل القوام والعلامات الحسية</h3>
                    
                    <div class="hydration-display">
                        <div class="hydration-value ${hydrationClass}">
                            ${hydration.toFixed(1)}%
                        </div>
                        <div class="hydration-label">نسبة السوائل للدقيق</div>
                    </div>
                    
                    <div class="texture-status">
                        <span class="visual-indicator">${visualIndicator}</span>
                        <span class="texture-text">${texture}</span>
                    </div>
                    
                    <div class="sensory-details">
                        <h4>العلامات الحسية:</h4>
                        <ul class="sensory-list">
                            <li><strong>الملمس:</strong> ${sensory.touch}</li>
                            <li><strong>المظهر:</strong> ${sensory.appearance}</li>
                            <li><strong>الصوت:</strong> ${sensory.sound}</li>
                            <li><strong>الرائحة:</strong> ${sensory.aroma}</li>
                        </ul>
                    </div>
                    
                    <div class="techniques-box">
                        <h4>التقنيات المطلوبة:</h4>
                        <ul class="techniques-list">
                            <li><strong>الإجراء الفوري:</strong> ${techniques.immediate}</li>
                            <li><strong>طريقة العمل:</strong> ${techniques.working}</li>
                            ${techniques.correction ? `<li><strong>التصحيح:</strong> ${techniques.correction}</li>` : ''}
                            ${techniques.tip ? `<li><strong>نصيحة:</strong> ${techniques.tip}</li>` : ''}
                        </ul>
                    </div>
                    
                    ${troubleshooting ? `
                    <div class="troubleshooting-note">
                        <strong>تشخيص المشكلة:</strong> ${troubleshooting}
                    </div>` : ''}
                </div>`;
        },

        // ============================ ADVISOR TAB =============================
        renderAdvisorReport(report) {
            const container = $('#advisor-report-container');
            if (report === null) {
                container.innerHTML = `<p class="text-muted">قم بتحليل وصفتك أولاً في تبويب "المحلل العلمي" لعرض التقرير.</p>`;
                return;
            }
            if (report.length === 0) {
                container.innerHTML = `
                    <div class="alert alert-success">
                        <h4>✅ ممتاز!</h4>
                        <p>كل النسب في وصفتك مثالية! لا توجد توصيات للتحسين حالياً.</p>
                    </div>`;
                return;
            }
            
            container.innerHTML = `
                <div class="advisor-intro">
                    <p>تم اكتشاف ${report.length} ${report.length === 1 ? 'مكون يحتاج' : 'مكونات تحتاج'} للتعديل:</p>
                </div>
                ${report.map(item => this.createAdvisorCard(item)).join('')}
            `;
        },

        createAdvisorCard(item) {
            const statusClass = item.status === 'low' ? 'warning' : 'danger';
            const statusText = item.status === 'low' ? 'منخفض' : 'مرتفع';
            
            return `
                <div class="advisor-card ${statusClass}">
                    <div class="advisor-card-header">
                        <div class="component-info">
                            <span class="component-name">${item.componentName}</span>
                            <span class="current-value">${item.currentValue}</span>
                        </div>
                        <div class="status-info">
                            <span class="status-badge score-${item.status === 'low' ? 'medium' : 'low'}">${statusText}</span>
                            <span class="ideal-range">المثالي: ${item.idealRange}</span>
                        </div>
                    </div>
                    <div class="advisor-card-body">
                        <div class="impact-section">
                            <h5>⚠️ التأثير:</h5>
                            <p>${item.impact}</p>
                        </div>
                        <div class="solution-section">
                            <h5>💡 الحل المقترح:</h5>
                            <p>${item.solution}</p>
                        </div>
                        <div class="science-section">
                            <h5>🔬 الأساس العلمي:</h5>
                            <p class="science-text">${item.science}</p>
                        </div>
                    </div>
                </div>
            `;
        },

        // ============================ METHOD TAB =============================
        renderMethod(method) {
            const container = $('#method-display-container');
            
            if (method === 'scientific') {
                container.innerHTML = this.renderScientificMethod();
            } else {
                container.innerHTML = this.renderAllInOneMethod();
            }
        },

        renderScientificMethod() {
            return `
                <div class="method-container">
                    <div class="method-header">
                        <h3>🔬 الطريقة العلمية المفصلة</h3>
                        <p class="method-subtitle">تعتمد على تفاعلات كيميائية محكومة بالحرارة والوقت</p>
                    </div>
                    
                    <div class="method-steps">
                        ${this.createMethodStep(1, 'التسخين الأولي', {
                            procedure: 'سخن الزبدة والسكر والعسل على نار متوسطة',
                            temperature: '75-80°C',
                            duration: '3-4 دقائق',
                            visualCues: ['ذوبان كامل للزبدة', 'فقاعات صغيرة على الحواف', 'رائحة كراميل خفيفة'],
                            science: 'السكر يذوب في الماء المتكون من ذوبان الزبدة، العسل يمنع التبلور',
                            criticalPoints: ['⚠️ لا تتجاوز 85°C وإلا ستتكرمل السكريات', 'حرك باستمرار لمنع الاحتراق'],
                            tools: ['ميزان حرارة', 'ملعقة خشبية']
                        })}
                        
                        ${this.createMethodStep(2, 'تفاعل الصودا', {
                            procedure: 'أضف الصودا وحرك بقوة',
                            temperature: '80-85°C',
                            duration: '30-45 ثانية',
                            visualCues: ['رغوة فورية كثيفة', 'زيادة الحجم 2-3 مرات', 'تحول للون الذهبي الفاتح'],
                            science: '2NaHCO₃ → Na₂CO₃ + H₂O + CO₂ (تحلل حراري) + تفاعل مع أحماض العسل',
                            criticalPoints: ['✅ الرغوة دليل على جودة الصودا', '⚠️ إذا لم ترغ: الصودا قديمة أو الحرارة منخفضة'],
                            tools: ['خفاقة يدوية سريعة']
                        })}
                        
                        ${this.createMethodStep(3, 'التبريد المحسوب', {
                            procedure: 'برّد الخليط مع التحريك',
                            temperature: 'من 85°C إلى 65°C',
                            duration: '5-7 دقائق',
                            visualCues: ['اختفاء البخار', 'قوام أثقل قليلاً', 'لون ذهبي ثابت'],
                            science: 'التبريد يحافظ على الـ CO₂ المتكون ويمنع فقدان الرطوبة',
                            criticalPoints: ['استخدم حمام مائي بارد للإسراع', 'حرك كل 30 ثانية لتبريد متجانس'],
                            tools: ['وعاء ماء بارد', 'ميزان حرارة']
                        })}
                        
                        ${this.createMethodStep(4, 'التمبرنج (الخطوة الحرجة)', {
                            procedure: 'أضف البيض المخفوق على 5 دفعات',
                            temperature: '65°C → 45°C تدريجياً',
                            duration: '3-4 دقائق',
                            visualCues: ['لا توجد كتل بيض', 'خليط كريمي متجانس', 'لون أصفر ذهبي فاتح'],
                            science: 'التدرج يمنع تخثر البروتينات (تجلط عند >68°C)',
                            criticalPoints: ['🔴 حرج: لا تضف كل البيض دفعة واحدة', 'قس الحرارة بعد كل دفعة', 'إذا ظهرت كتل: صفِّ فوراً'],
                            tools: ['خفاقة', 'ميزان حرارة دقيق'],
                            distribution: [
                                'دفعة 1 (15%): ملعقة كبيرة - خفق سريع 20 ثانية',
                                'دفعة 2 (20%): ملعقتان - خفق 15 ثانية',
                                'دفعة 3 (20%): ملعقتان - خفق 15 ثانية',
                                'دفعة 4 (20%): ملعقتان - خفق 15 ثانية',
                                'دفعة 5 (25%): الباقي - خفق حتى التجانس'
                            ]
                        })}
                        
                        ${this.createMethodStep(5, 'دمج الدقيق', {
                            procedure: 'أضف الدقيق تدريجياً',
                            temperature: '40-45°C',
                            duration: '2-3 دقائق',
                            technique: 'طي وليس خفق (folding)',
                            visualCues: ['اختفاء كل آثار الدقيق', 'عجينة ملساء لامعة قليلاً', 'قوام يشبه عجينة البسكويت الطرية'],
                            science: 'تكوين شبكة جلوتين محدودة للهشاشة المطلوبة',
                            criticalPoints: ['لا تفرط في العجن', 'أضف الدقيق على 3 دفعات', 'توقف فور الاندماج'],
                            tools: ['ملعقة خشبية أو سباتولا']
                        })}
                    </div>
                    
                    <div class="final-checks">
                        <h4>فحوصات نهائية قبل التشكيل:</h4>
                        <ul>
                            <li><strong>الحرارة:</strong> 35-40°C</li>
                            <li><strong>القوام:</strong> متماسك لكن مرن</li>
                            <li><strong>اللون:</strong> بيج ذهبي فاتح</li>
                            <li><strong>الرائحة:</strong> عسل وزبدة بدون حرق</li>
                        </ul>
                    </div>
                </div>
            `;
        },

        renderAllInOneMethod() {
            return `
                <div class="method-container">
                    <div class="method-header">
                        <h3>⚡ طريقة الكل دفعة واحدة (للمحترفين)</h3>
                        <p class="method-subtitle">سريعة لكن تتطلب خبرة ومهارة عالية</p>
                    </div>
                    
                    <div class="alert alert-warning">
                        <h4>⚠️ تحذير مهم:</h4>
                        <p><strong>المخاطر:</strong> احتمالية عالية لتخثر البيض، عجينة غير متجانسة</p>
                        <p><strong>تعديل وقائي:</strong> قلل البيض 10% وزد الدقيق 5% لتقليل المخاطر</p>
                    </div>
                    
                    <div class="method-steps">
                        <div class="step-card">
                            <h4>الخطوة 1: الخلط</h4>
                            <p>اخلط كل المكونات (عدا الدقيق) في وعاء مقاوم للحرارة</p>
                            <ul>
                                <li>تأكد من خفق البيض جيداً قبل الإضافة</li>
                                <li>استخدم خفاقة سلكية قوية</li>
                            </ul>
                        </div>
                        
                        <div class="step-card">
                            <h4>الخطوة 2: التسخين</h4>
                            <p>ضع الوعاء فوق حمام مائي ساخن (لا يغلي)</p>
                            <ul>
                                <li>حرك بسرعة ودون توقف</li>
                                <li>راقب القوام - سيثخن تدريجياً</li>
                                <li>الهدف: 75-80°C خلال 5-7 دقائق</li>
                            </ul>
                        </div>
                        
                        <div class="step-card">
                            <h4>الخطوة 3: إضافة الدقيق</h4>
                            <p>ارفع عن الحرارة وأضف الدقيق المنخول</p>
                            <ul>
                                <li>اعمل بسرعة قبل أن تبرد العجينة</li>
                                <li>اطوِ الدقيق برفق حتى يختفي</li>
                            </ul>
                        </div>
                    </div>
                    
                    <div class="troubleshooting-tips">
                        <h4>نصائح لتجنب المشاكل:</h4>
                        <ul>
                            <li>إذا ظهرت كتل بيض: صفِّ الخليط فوراً واستمر</li>
                            <li>إذا كان الخليط ثقيلاً جداً: أضف ملعقة ماء دافئ</li>
                            <li>لا تتوقف عن التحريك أبداً أثناء التسخين</li>
                        </ul>
                    </div>
                </div>
            `;
        },

        createMethodStep(stepNum, title, data) {
            return `
                <div class="method-step">
                    <div class="step-header">
                        <span class="step-number">${stepNum}</span>
                        <h4 class="step-title">${title}</h4>
                    </div>
                    <div class="step-content">
                        <div class="step-main">
                            <p class="procedure">${data.procedure}</p>
                            <div class="step-params">
                                <span class="param"><i class="icon-temp"></i> ${data.temperature}</span>
                                <span class="param"><i class="icon-time"></i> ${data.duration}</span>
                                ${data.technique ? `<span class="param"><i class="icon-technique"></i> ${data.technique}</span>` : ''}
                            </div>
                        </div>
                        
                        <div class="step-details">
                            <div class="visual-cues">
                                <h5>علامات بصرية:</h5>
                                <ul>${data.visualCues.map(cue => `<li>${cue}</li>`).join('')}</ul>
                            </div>
                            
                            <div class="critical-points">
                                <h5>نقاط حرجة:</h5>
                                <ul>${data.criticalPoints.map(point => `<li>${point}</li>`).join('')}</ul>
                            </div>
                            
                            ${data.distribution ? `
                            <div class="distribution">
                                <h5>توزيع الدفعات:</h5>
                                <ol>${data.distribution.map(d => `<li>${d}</li>`).join('')}</ol>
                            </div>` : ''}
                            
                            <div class="science-note">
                                <h5>الأساس العلمي:</h5>
                                <p>${data.science}</p>
                            </div>
                            
                            <div class="tools-needed">
                                <h5>الأدوات المطلوبة:</h5>
                                <p>${data.tools.join('، ')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },
        
        renderBakingSimulation(result) {
            const container = $('#baking-simulation-results');
            if (!result) { 
                container.style.display = 'none'; 
                return; 
            }
            
            const colorClass = result.browningIndex < 60 ? 'pale' :
                              result.browningIndex < 110 ? 'golden' :
                              'dark';
                              
            const textureClass = result.textureScore > 70 ? 'optimal' :
                                result.textureScore > 50 ? 'acceptable' :
                                'poor';
            
            container.innerHTML = `
                <div class="simulation-results">
                    <h4>🔥 نتائج المحاكاة:</h4>
                    
                    <div class="simulation-metrics">
                        <div class="metric color-metric ${colorClass}">
                            <div class="metric-value">${result.browningIndex}</div>
                            <div class="metric-label">مؤشر اللون</div>
                            <div class="metric-desc">${result.color}</div>
                        </div>
                        
                        <div class="metric texture-metric ${textureClass}">
                            <div class="metric-value">${result.textureScore}</div>
                            <div class="metric-label">نقاط القوام</div>
                            <div class="metric-desc">${result.texture}</div>
                        </div>
                        
                        <div class="metric moisture-metric">
                            <div class="metric-value">${result.moistureLoss}%</div>
                            <div class="metric-label">فقد الرطوبة</div>
                        </div>
                    </div>
                    
                    <div class="sensory-predictions">
                        <h5>التوقعات الحسية:</h5>
                        <div class="predictions-grid">
                            <div class="prediction">
                                <strong>المظهر:</strong>
                                <ul>
                                    <li>الأعلى: ${result.sensoryPredictions.visual.top}</li>
                                    <li>الحواف: ${result.sensoryPredictions.visual.edges}</li>
                                </ul>
                            </div>
                            <div class="prediction">
                                <strong>الرائحة المتوقعة:</strong>
                                <ul>
                                    ${result.sensoryPredictions.aroma.expected.map(a => `<li>${a}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="prediction">
                                <strong>القوام عند القضم:</strong>
                                <p>${result.sensoryPredictions.texture.bite}</p>
                            </div>
                        </div>
                    </div>
                    
                    ${result.recommendations.length > 0 ? `
                    <div class="simulation-recommendations">
                        <h5>توصيات:</h5>
                        <ul>
                            ${result.recommendations.map(r => `<li>${r}</li>`).join('')}
                        </ul>
                    </div>` : ''}
                    
                    <div class="simulation-params">
                        <small>المعاملات: سمك ${result.parameters.thickness} | عسل ${result.parameters.honeyShare} | حماية دهون ${result.parameters.butterProtection}</small>
                    </div>
                </div>
            `;
            container.style.display = 'block';
        },

        // ============================ TEMPERING TAB =============================
        renderTemperingResults(result) {
            const container = $('#tempering-results-container');
            if (!result) { 
                container.innerHTML = ''; 
                return; 
            }

            const { batches, finalTemp, maxBatchTemp, criticalBatch, safetyStatus, recommendation, liquidCp } = result;
            
            // Status icons and colors
            const statusConfig = {
                safe: { icon: '✅', class: 'success', text: 'آمن' },
                warning: { icon: '⚠️', class: 'warning', text: 'حذر' },
                danger: { icon: '🔴', class: 'danger', text: 'خطر' }
            };
            const status = statusConfig[safetyStatus];
            
            // Batches table with sensory notes
            const batchesHTML = batches.map(b => {
                const rowClass = b.tempAfter > 65 ? 'danger-row' : 
                                b.tempAfter > 60 ? 'warning-row' : '';
                return `
                    <tr class="${rowClass}">
                        <td>${b.batchNumber}</td>
                        <td>${b.percentage}%</td>
                        <td>${formatNumber(b.tempBefore, 1)}°C</td>
                        <td>${formatNumber(b.tempAfter, 1)}°C</td>
                        <td>${b.sensoryNote}</td>
                        <td class="technique-cell">${b.technique}</td>
                    </tr>
                `;
            }).join('');
            
            // Suggested solutions if status is not safe
            let solutionsHTML = '';
            if (safetyStatus !== 'safe') {
                const inputs = this.getTemperingInputs();
                const targetTemp = 65;
                const neededEgg = Core.TemperingService.neededEggIncrease(
                    inputs.eggMass, inputs.eggTemp, inputs.liquidMass, inputs.liquidTemp, targetTemp
                );
                const maxLiquidTemp = Core.TemperingService.maxHotTempForTarget(
                    inputs.eggMass, inputs.eggTemp, inputs.liquidMass, targetTemp
                );
                
                solutionsHTML = `
                    <div class="tempering-solutions">
                        <h4>🔧 حلول مقترحة للوصول لدرجة حرارة آمنة (${targetTemp}°C):</h4>
                        <div class="solutions-grid">
                            <div class="solution-card">
                                <h5>الحل 1: خفض الحرارة</h5>
                                <p>برّد الخليط الساخن إلى <strong>${formatNumber(maxLiquidTemp, 1)}°C</strong></p>
                                <small>(بدلاً من ${inputs.liquidTemp}°C)</small>
                            </div>
                            <div class="solution-card">
                                <h5>الحل 2: زيادة البيض</h5>
                                <p>أضف <strong>${Math.round(neededEgg)} جرام</strong> بيض إضافي</p>
                                <small>(ليصبح المجموع ${Math.round(inputs.eggMass + neededEgg)} جم)</small>
                            </div>
                            <div class="solution-card">
                                <h5>الحل 3: زيادة الدفعات</h5>
                                <p>استخدم <strong>6 دفعات</strong> بدلاً من ${inputs.batchCount}</p>
                                <small>توزيع أكثر تدرجاً</small>
                            </div>
                        </div>
                    </div>`;
            }
            
            container.innerHTML = `
                <div class="result-box tempering-results">
                    <div class="tempering-header">
                        <h3>نتائج التمبرنج ${status.icon}</h3>
                        <div class="status-badge ${status.class}">${status.text}</div>
                    </div>
                    
                    <div class="tempering-summary">
                        <div class="summary-grid">
                            <div class="summary-item">
                                <label>الحرارة النهائية:</label>
                                <value>${formatNumber(finalTemp, 1)}°C</value>
                            </div>
                            <div class="summary-item ${maxBatchTemp > 65 ? 'danger' : ''}">
                                <label>أقصى حرارة:</label>
                                <value>${formatNumber(maxBatchTemp, 1)}°C</value>
                                ${criticalBatch ? `<small>(دفعة ${criticalBatch})</small>` : ''}
                            </div>
                            <div class="summary-item">
                                <label>السعة الحرارية:</label>
                                <value>${formatNumber(liquidCp, 2)} kJ/kg·K</value>
                            </div>
                        </div>
                    </div>
                    
                    <div class="alert alert-${status.class}">
                        <strong>${recommendation}</strong>
                        ${criticalBatch && maxBatchTemp > 65 ? 
                          `<br>⚠️ انتبه بشكل خاص عند الدفعة ${criticalBatch}` : ''}
                    </div>
                    
                    <div class="tempering-table-container">
                        <table class="tempering-table">
                            <thead>
                                <tr>
                                    <th>الدفعة</th>
                                    <th>النسبة</th>
                                    <th>قبل</th>
                                    <th>بعد</th>
                                    <th>الحالة</th>
                                    <th>التقنية</th>
                                </tr>
                            </thead>
                            <tbody>${batchesHTML}</tbody>
                        </table>
                    </div>
                    
                    ${solutionsHTML}
                    
                    <div class="tempering-tips">
                        <h4>💡 نصائح عملية:</h4>
                        <ul>
                            <li>اخفق البيض جيداً قبل البدء (لكن دون رغوة كثيفة)</li>
                            <li>دفّئ البيض لدرجة حرارة الغرفة (20-24°C) قبل الاستخدام</li>
                            <li>اسكب الخليط الساخن كخيط رفيع مع الخفق المستمر</li>
                            <li>إذا شعرت بزيادة اللزوجة المفاجئة، توقف فوراً واخفق بقوة</li>
                            <li>استخدم وعاء ستانلس ستيل لتبديد الحرارة بشكل أفضل</li>
                        </ul>
                    </div>
                </div>
            `;
        },

        // ============================ SCALING TAB =============================
        renderPanShapeInputs(target, shape) {
            const container = $(`#pan-inputs-${target}`);
            if (shape === 'round') {
                container.innerHTML = `
                    <div class="input-group">
                        <label for="pan-dim1-${target}">قطر الصينية (سم):</label>
                        <input type="number" id="pan-dim1-${target}" value="24" min="10" max="50">
                    </div>`;
            } else {
                container.innerHTML = `
                    <div class="input-grid small">
                        <div class="input-group">
                            <label for="pan-dim1-${target}">طول الصينية (سم):</label>
                            <input type="number" id="pan-dim1-${target}" value="30" min="10" max="60">
                        </div>
                        <div class="input-group">
                            <label for="pan-dim2-${target}">عرض الصينية (سم):</label>
                            <input type="number" id="pan-dim2-${target}" value="20" min="10" max="40">
                        </div>
                    </div>`;
            }
        },

        renderScalingResult(result, mode) {
            const container = $('#scaling-results-container');
            if (!result) { 
                container.innerHTML = `<div class="alert alert-danger">خطأ في الحساب. تأكد من أن كل المدخلات صحيحة.</div>`; 
                return; 
            }

            let content = '';
            
            if (mode === 'normal') {
                const efficiency = ((result.totalCoverage / (result.totalCoverage + result.remainder)) * 100).toFixed(0);
                content = `
                    <div class="scaling-normal-result">
                        <h3>📊 نتائج حساب الطبقات:</h3>
                        
                        <div class="layers-display">
                            <div class="layers-count">${result.numLayers}</div>
                            <div class="layers-label">طبقة</div>
                        </div>
                        
                        <div class="scaling-details">
                            <div class="detail-item">
                                <label>وزن الطبقة الواحدة:</label>
                                <value>${result.singleLayerWeight.toFixed(0)} جرام</value>
                            </div>
                            <div class="detail-item">
                                <label>الكثافة المحسوبة:</label>
                                <value>${result.density.toFixed(2)} جم/سم³</value>
                            </div>
                            <div class="detail-item">
                                <label>الاستخدام الكلي:</label>
                                <value>${result.totalCoverage.toFixed(0)} جرام (${efficiency}%)</value>
                            </div>
                            ${result.remainder > 10 ? `
                            <div class="detail-item remainder">
                                <label>المتبقي:</label>
                                <value>${result.remainder.toFixed(0)} جرام</value>
                                <small>يمكن استخدامه للفتات أو طبقة رقيقة إضافية</small>
                            </div>` : ''}
                        </div>
                    </div>`;
                    
            } else if (mode === 'advanced') {
                const { newRecipe, totalWeight, scalingFactor, perLayerWeight } = result;
                const componentNames = { 
                    flour: 'دقيق', 
                    butter: 'زبدة', 
                    sugar: 'سكر', 
                    honey: 'عسل', 
                    eggs: 'بيض', 
                    soda: 'صودا الخبز' 
                };
                
                content = `
                    <div class="scaling-advanced-result">
                        <h3>⚖️ المقادير الجديدة المحسوبة:</h3>
                        
                        <div class="scaling-info">
                            <div class="info-card">
                                <label>الوزن الإجمالي:</label>
                                <value>${totalWeight.toFixed(0)} جرام</value>
                            </div>
                            <div class="info-card">
                                <label>معامل التحجيم:</label>
                                <value>×${scalingFactor.toFixed(2)}</value>
                            </div>
                            <div class="info-card">
                                <label>وزن كل طبقة:</label>
                                <value>${perLayerWeight.toFixed(0)} جرام</value>
                            </div>
                        </div>
                        
                        <div class="new-recipe">
                            <h4>المقادير:</h4>
                            <table class="recipe-table">
                                <thead>
                                    <tr>
                                        <th>المكون</th>
                                        <th>الكمية (جرام)</th>
                                        <th>الكمية (تقريبي)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(newRecipe).map(([key, value]) => {
                                        const approx = this.getApproximateMeasure(key, value);
                                        return `
                                        <tr>
                                            <td>${componentNames[key]}</td>
                                            <td>${value.toFixed(1)}</td>
                                            <td class="approx">${approx}</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>`;
                    
            } else if (mode === 'reverse') {
                const { newRecipe, totalWeight, perLayerWeight } = result;
                const componentNames = { 
                    flour: 'دقيق', 
                    butter: 'زبدة', 
                    sugar: 'سكر', 
                    honey: 'عسل', 
                    eggs: 'بيض', 
                    soda: 'صودا الخبز' 
                };
                
                content = `
                    <div class="scaling-reverse-result">
                        <h3>🔄 المقادير المطلوبة:</h3>
                        
                        <div class="reverse-info">
                            <p>للحصول على العدد المطلوب من الطبقات بالمواصفات المحددة، ستحتاج:</p>
                        </div>
                        
                        <div class="scaling-info">
                            <div class="info-card">
                                <label>الوزن الإجمالي:</label>
                                <value>${totalWeight.toFixed(0)} جرام</value>
                            </div>
                            <div class="info-card">
                                <label>وزن كل طبقة:</label>
                                <value>${perLayerWeight.toFixed(0)} جرام</value>
                            </div>
                        </div>
                        
                        <div class="ideal-recipe">
                            <h4>الوصفة المثالية:</h4>
                            <table class="recipe-table">
                                <thead>
                                    <tr>
                                        <th>المكون</th>
                                        <th>الكمية (جرام)</th>
                                        <th>النسبة المئوية</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${Object.entries(newRecipe).map(([key, value]) => {
                                        const percentage = (value / totalWeight * 100).toFixed(1);
                                        return `
                                        <tr>
                                            <td>${componentNames[key]}</td>
                                            <td>${value.toFixed(1)}</td>
                                            <td class="percentage">${percentage}%</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="reverse-note">
                            <p><small>ملاحظة: هذه المقادير محسوبة بناءً على النسب المثالية للميدوفيك</small></p>
                        </div>
                    </div>`;
            }
            
            container.innerHTML = `<div class="result-box">${content}</div>`;
        },

        // ============================ FILLING TAB (NEW) =============================
        renderFillingPanInputs(shape) {
            const container = $('#filling-pan-dimensions');
            if (shape === 'round') {
                container.innerHTML = `
                    <div class="input-group">
                        <label for="filling-pan-dim1">قطر الصينية (سم):</label>
                        <input type="number" id="filling-pan-dim1" value="24" min="10" max="50">
                    </div>`;
            } else {
                container.innerHTML = `
                    <div class="input-grid small">
                        <div class="input-group">
                            <label for="filling-pan-dim1">طول الصينية (سم):</label>
                            <input type="number" id="filling-pan-dim1" value="30" min="10" max="60">
                        </div>
                        <div class="input-group">
                            <label for="filling-pan-dim2">عرض الصينية (سم):</label>
                            <input type="number" id="filling-pan-dim2" value="20" min="10" max="40">
                        </div>
                    </div>`;
            }
        },

        renderFillingPresetIngredients(preset, presetId) {
                    const container = $('#preset-ingredients-container');
                    
                    let html = '<h4>المقادير الأساسية (قابلة للتعديل):</h4>';
                    
                    // تم تعديل هذا اللوب ليتعامل مع بنية البيانات الجديدة
                    for (const [ingredientKey, ingredientData] of Object.entries(preset.baseRecipe)) {
                        // نستخدم الاسم العربي المفصل من داخل الكائن نفسه
                        const ingredientName = ingredientData.nameAr || this.getIngredientArabicName(ingredientKey);
                        
                        html += `
                            <div class="preset-ingredient-row">
                                <label>${escapeHTML(ingredientName)}:</label>
                                <input type="number" 
                                       class="preset-ingredient-input" 
                                       data-ingredient="${ingredientKey}" 
                                       value="${ingredientData.amount}" 
                                       min="0" 
                                       step="1">
                                <span>جرام</span>
                            </div>
                        `;
                    }
                    
                    container.innerHTML = html;
                    container.style.display = 'block';
                },

        renderFillingProtocol(protocol) {
            const container = $('#preparation-protocol-container');
            
            if (!protocol) {
                container.innerHTML = '';
                return;
            }
            
            let html = `
                <div class="protocol-header-enhanced">
                    <h3>📋 ${escapeHTML(protocol.name)}</h3>
                    <div class="protocol-meta-grid">
                        <div class="meta-item">
                            <span class="label">⏱️ المدة الكلية:</span>
                            <span class="value">${escapeHTML(protocol.totalTime)}</span>
                        </div>
                        <div class="meta-item">
                            <span class="label">👨‍🍳 الصعوبة:</span>
                            <span class="value">${escapeHTML(protocol.difficulty)}</span>
                        </div>
                        ${protocol.yield ? `
                        <div class="meta-item">
                            <span class="label">📊 الكمية:</span>
                            <span class="value">${escapeHTML(protocol.yield)}</span>
                        </div>` : ''}
                        ${protocol.servings ? `
                        <div class="meta-item">
                            <span class="label">🍰 يكفي لـ:</span>
                            <span class="value">${escapeHTML(protocol.servings)}</span>
                        </div>` : ''}
                    </div>
                </div>
            `;
            
            // عرض التحضير المسبق إن وجد
            if (protocol.preparation) {
                html += `
                    <div class="preparation-phase ${protocol.preparation.critical ? 'critical-phase' : ''}">
                        <div class="phase-header">
                            <h4>${protocol.preparation.critical ? '🔴' : '⏰'} ${escapeHTML(protocol.preparation.title)}</h4>
                            <span class="phase-duration">${escapeHTML(protocol.preparation.duration)}</span>
                        </div>
                        ${protocol.preparation.steps.map(step => `
                            <div class="prep-step-card">
                                ${step.time ? `<div class="step-time-badge">${escapeHTML(step.time)}</div>` : ''}
                                <strong class="step-action">${escapeHTML(step.action)}</strong>
                                
                                ${step.procedure ? `
                                    <div class="step-procedure">
                                        ${Array.isArray(step.procedure) ? 
                                            `<ol>${step.procedure.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ol>` :
                                            `<p>${escapeHTML(step.procedure)}</p>`
                                        }
                                    </div>
                                ` : ''}
                                
                                ${step.detail ? `
                                    <div class="step-details-list">
                                        ${Array.isArray(step.detail) ? 
                                            `<ul>${step.detail.map(d => `<li>${escapeHTML(d)}</li>`).join('')}</ul>` :
                                            `<p>${escapeHTML(step.detail)}</p>`
                                        }
                                    </div>
                                ` : ''}
                                
                                <div class="step-meta-row">
                                    ${step.temp ? `<span class="meta-badge temp">🌡️ ${escapeHTML(step.temp)}${typeof step.temp === 'number' ? '°C' : ''}</span>` : ''}
                                    ${step.duration ? `<span class="meta-badge duration">⏱️ ${escapeHTML(step.duration)}</span>` : ''}
                                </div>
                                
                                ${step.expectedResult ? `
                                    <div class="expected-result">
                                        <strong>✅ النتيجة المتوقعة:</strong>
                                        ${typeof step.expectedResult === 'object' ? 
                                            Object.entries(step.expectedResult).map(([k,v]) => 
                                                `<div class="result-item"><span class="result-label">${escapeHTML(k)}:</span> <span class="result-value">${escapeHTML(v)}</span></div>`
                                            ).join('') :
                                            `<p>${escapeHTML(step.expectedResult)}</p>`
                                        }
                                    </div>
                                ` : ''}
                                
                                ${step.checkpoint ? `
                                    <div class="checkpoint-box">
                                        <strong>✓ نقطة التحقق:</strong> ${escapeHTML(step.checkpoint)}
                                    </div>
                                ` : ''}
                                
                                ${step.why ? `
                                    <div class="why-box">
                                        💡 ${escapeHTML(step.why)}
                                    </div>
                                ` : ''}
                                
                                ${step.warning ? `
                                    <div class="warning-box-inline">
                                        ${escapeHTML(step.warning)}
                                    </div>
                                ` : ''}
                                
                                ${step.troubleshooting ? `
                                    <div class="troubleshooting-inline">
                                        <strong>🔧 استكشاف الأخطاء:</strong>
                                        ${Object.entries(step.troubleshooting).map(([problem, solution]) => `
                                            <div class="ts-item">
                                                <span class="ts-problem">${escapeHTML(problem)}:</span> 
                                                <span class="ts-solution">${escapeHTML(solution)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            // عرض الخطوات المفصلة
            if (protocol.steps && protocol.steps.length > 0) {
                protocol.steps.forEach((step) => {
                    html += `
                        <div class="protocol-step-enhanced">
                            <div class="step-header-detailed">
                                <span class="step-number-large">${step.number}</span>
                                <div class="step-title-block">
                                    <h4>${escapeHTML(step.name)}</h4>
                                    <div class="step-meta">
                                        ${step.duration ? `<span>⏱️ ${escapeHTML(step.duration)}</span>` : ''}
                                        ${step.temp && typeof step.temp === 'object' ? 
                                            Object.entries(step.temp).map(([k,v]) => 
                                                `<span class="temp-badge">🌡️ ${escapeHTML(k)}: ${escapeHTML(v)}${typeof v === 'number' ? '°C' : ''}</span>`
                                            ).join('') :
                                            step.temp ? `<span>🌡️ ${escapeHTML(step.temp)}°C</span>` : ''
                                        }
                                        ${step.equipment?.mixer ? `<span>🔧 ${escapeHTML(step.equipment.mixer)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="step-body-timeline">
                                ${step.actions.map((action, i) => `
                                    <div class="action-timeline-item ${action.criticalPoint || action.criticalAction ? 'critical' : ''}">
                                        <div class="timeline-marker">
                                            ${action.time ? `<span class="time-badge">${escapeHTML(action.time)}</span>` : ''}
                                            ${action.rpm ? `<span class="rpm-badge">${action.rpm} RPM</span>` : ''}
                                            ${action.speed ? `<span class="speed-badge">${escapeHTML(action.speed)}</span>` : ''}
                                        </div>
                                        <div class="timeline-content">
                                            <p class="action-text"><strong>${escapeHTML(action.action)}</strong></p>
                                            
                                            ${action.detail ? `
                                                <div class="action-details">
                                                    ${Array.isArray(action.detail) ? 
                                                        `<ul>${action.detail.map(d => `<li>${escapeHTML(d)}</li>`).join('')}</ul>` :
                                                        `<p>${escapeHTML(action.detail)}</p>`
                                                    }
                                                </div>
                                            ` : ''}
                                            
                                            ${action.duration ? `
                                                <div class="action-duration">
                                                    ⏱️ <strong>المدة:</strong> ${escapeHTML(action.duration)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.temp ? `
                                                <div class="action-temp">
                                                    🌡️ <strong>الحرارة:</strong> ${escapeHTML(action.temp)}${typeof action.temp === 'number' ? '°C' : ''}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.visualCue ? `
                                                <div class="visual-cue">
                                                    👁️ <strong>العلامة البصرية:</strong> ${escapeHTML(action.visualCue)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.visualCues ? `
                                                <div class="visual-cues-timeline">
                                                    <strong>العلامات البصرية حسب الوقت:</strong>
                                                    ${Object.entries(action.visualCues).map(([time, cue]) => `
                                                        <div class="cue-timeline-item">
                                                            <span class="cue-time">${escapeHTML(time)}</span>
                                                            <span class="cue-desc">${escapeHTML(cue)}</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.sensory ? `
                                                <div class="sensory-box">
                                                    <strong>الإدراك الحسي:</strong>
                                                    ${Object.entries(action.sensory).map(([sense, desc]) => `
                                                        <div class="sensory-item">
                                                            <span class="sense-label">${escapeHTML(sense)}:</span> 
                                                            <span>${escapeHTML(desc)}</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.checkpoint ? `
                                                <div class="checkpoint">
                                                    ✓ <strong>نقطة التحقق:</strong> ${escapeHTML(action.checkpoint)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.why ? `
                                                <div class="why-explanation">
                                                    💡 ${escapeHTML(action.why)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.warning ? `
                                                <div class="warning-box">
                                                    ${Array.isArray(action.warning) ? 
                                                        action.warning.map(w => `<div>${escapeHTML(w)}</div>`).join('') :
                                                        escapeHTML(action.warning)
                                                    }
                                                </div>
                                            ` : ''}
                                            
                                            ${action.criticalPoint ? `
                                                <div class="critical-point-box">
                                                    🔴 <strong>نقطة حرجة:</strong> ${escapeHTML(action.criticalPoint)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.criticalAction ? `
                                                <div class="critical-action-box">
                                                    🔴 ${escapeHTML(action.criticalAction)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.criticalLimit ? `
                                                <div class="critical-limit-box">
                                                    ⚠️ <strong>الحد الحرج:</strong> ${escapeHTML(action.criticalLimit)}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.criticalLimits ? `
                                                <div class="critical-limits-box">
                                                    <strong>⚠️ الحدود الحرجة:</strong>
                                                    ${Object.entries(action.criticalLimits).map(([k,v]) => `
                                                        <div class="limit-item ${k === 'danger' ? 'danger-limit' : ''}">
                                                            <span class="limit-label">${escapeHTML(k)}:</span> 
                                                            <span class="limit-value">${escapeHTML(v)}</span>
                                                        </div>
                                                    `).join('')}
                                                </div>
                                            ` : ''}
                                            
                                            ${action.technique ? `
                                                <div class="technique-box">
                                                    🎯 <strong>التقنية:</strong> ${escapeHTML(action.technique)}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            ${step.sensoryCheckpoints ? `
                                <div class="sensory-checkpoints">
                                    <h5>🔍 اختبارات الجودة الحسية:</h5>
                                    ${step.sensoryCheckpoints.map(check => `
                                        <div class="checkpoint-card">
                                            ${check.time ? `<div class="check-time">${escapeHTML(check.time)}</div>` : ''}
                                            <strong>${escapeHTML(check.test)}</strong>
                                            ${check.method ? `
                                                <div class="check-method">
                                                    <strong>الطريقة:</strong>
                                                    ${Array.isArray(check.method) ? 
                                                        `<ol>${check.method.map(m => `<li>${escapeHTML(m)}</li>`).join('')}</ol>` :
                                                        `<p>${escapeHTML(check.method)}</p>`
                                                    }
                                                </div>
                                            ` : ''}
                                            <div class="result-indicators">
                                                ${check.success ? `<span class="success">✅ ${escapeHTML(check.success)}</span>` : ''}
                                                ${check.failure ? `<span class="failure">❌ ${escapeHTML(check.failure)}</span>` : ''}
                                                ${check.continue ? `<span class="continue">➡️ ${escapeHTML(check.continue)}</span>` : ''}
                                                ${check.stop ? `<span class="stop">🛑 ${escapeHTML(check.stop)}</span>` : ''}
                                                ${check.over ? `<span class="over">⚠️ ${escapeHTML(check.over)}</span>` : ''}
                                                ${check.target ? `<span class="target">🎯 ${escapeHTML(check.target)}</span>` : ''}
                                                ${check.warning ? `<span class="warning-inline">${escapeHTML(check.warning)}</span>` : ''}
                                            </div>
                                            ${check.tool ? `<div class="check-tool">🔧 ${escapeHTML(check.tool)}</div>` : ''}
                                            ${check.visual ? `<div class="check-visual">👁️ ${escapeHTML(check.visual)}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            
                            ${step.finalCheckpoints ? `
                                <div class="final-checkpoints-section">
                                    <h5>✓ الفحوصات النهائية:</h5>
                                    ${step.finalCheckpoints.map(check => `
                                        <div class="final-checkpoint-item">
                                            <strong>${escapeHTML(check.test)}</strong>
                                            ${check.method ? `
                                                <div class="check-method-desc">
                                                    ${Array.isArray(check.method) ? 
                                                        `<ol>${check.method.map(m => `<li>${escapeHTML(m)}</li>`).join('')}</ol>` :
                                                        escapeHTML(check.method)
                                                    }
                                                </div>
                                            ` : ''}
                                            ${check.success ? `<div class="check-success">✅ ${escapeHTML(check.success)}</div>` : ''}
                                            ${check.failure ? `<div class="check-failure">❌ ${escapeHTML(check.failure)}</div>` : ''}
                                            ${check.target ? `<div class="check-target">🎯 ${escapeHTML(check.target)}</div>` : ''}
                                            ${check.action ? `<div class="check-action">🔧 ${escapeHTML(check.action)}</div>` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            
                            ${step.recoveryPlan ? `
                                <div class="recovery-plan alert-info">
                                    <h5>🔧 خطة الإنقاذ:</h5>
                                    <div class="recovery-problem"><strong>المشكلة:</strong> ${escapeHTML(step.recoveryPlan.problem)}</div>
                                    ${step.recoveryPlan.signs ? `
                                        <div class="recovery-signs">
                                            <strong>العلامات:</strong> ${step.recoveryPlan.signs.map(s => escapeHTML(s)).join('، ')}
                                        </div>
                                    ` : ''}
                                    ${step.recoveryPlan.rescue ? `
                                        <div class="recovery-steps">
                                            <strong>خطوات الإنقاذ:</strong>
                                            <ol>${step.recoveryPlan.rescue.map(r => `<li>${escapeHTML(r)}</li>`).join('')}</ol>
                                        </div>
                                    ` : ''}
                                    ${step.recoveryPlan.solution ? `
                                        <div class="recovery-solution"><strong>الحل:</strong> ${escapeHTML(step.recoveryPlan.solution)}</div>
                                    ` : ''}
                                    ${step.recoveryPlan.prevention ? `
                                        <div class="recovery-prevention"><strong>الوقاية:</strong> ${escapeHTML(step.recoveryPlan.prevention)}</div>
                                    ` : ''}
                                </div>
                            ` : ''}
                            
                            ${step.troubleshooting ? `
                                <div class="step-troubleshooting">
                                    ${Object.entries(step.troubleshooting).map(([key, ts]) => `
                                        <div class="ts-card">
                                            <div class="ts-header">${escapeHTML(key)}</div>
                                            ${ts.cause ? `<div class="ts-cause"><strong>السبب:</strong> ${escapeHTML(ts.cause)}</div>` : ''}
                                            ${ts.immediateAction ? `
                                                <div class="ts-immediate">
                                                    <strong>إجراء فوري:</strong>
                                                    <ol>${ts.immediateAction.map(a => `<li>${escapeHTML(a)}</li>`).join('')}</ol>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            
                            ${step.finalCheck ? `
                                <div class="final-check-list">
                                    <h5>✓ قائمة التحقق النهائية:</h5>
                                    <ul class="checklist">
                                        ${step.finalCheck.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            
                            ${step.criticalNote ? `
                                <div class="critical-note-box">
                                    🔴 ${escapeHTML(step.criticalNote)}
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
            }
            
            // عرض ضبط الجودة
            if (protocol.qualityControl) {
                html += `
                    <div class="quality-control-section">
                        <h4>🎯 معايير الجودة النهائية</h4>
                        
                        ${protocol.qualityControl.visualInspection ? `
                            <div class="qc-visual">
                                <h5>الفحص البصري:</h5>
                                <ul>
                                    ${Object.entries(protocol.qualityControl.visualInspection).map(([k,v]) => 
                                        `<li><strong>${escapeHTML(k)}:</strong> ${escapeHTML(v)}</li>`
                                    ).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        
                        ${protocol.qualityControl.physicalTests ? `
                            <div class="qc-physical">
                                <h5>الاختبارات الفيزيائية:</h5>
                                <table class="qc-table">
                                    ${Object.entries(protocol.qualityControl.physicalTests).map(([test, data]) => {
                                        if (typeof data === 'object' && data.target) {
                                            return `
                                                <tr>
                                                    <td>${escapeHTML(test)}</td>
                                                    <td>${escapeHTML(data.target)}</td>
                                                </tr>
                                            `;
                                        }
                                        return '';
                                    }).join('')}
                                </table>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            // عرض استكشاف الأخطاء الشامل
            if (protocol.troubleshooting && protocol.troubleshooting.length > 0) {
                html += `
                    <div class="troubleshooting-guide">
                        <h4>🔧 دليل استكشاف الأخطاء الشامل</h4>
                        ${protocol.troubleshooting.map(issue => `
                            <div class="issue-card">
                                <h5 class="issue-title">❌ ${escapeHTML(issue.problem)}</h5>
                                
                                ${issue.signs ? `
                                    <div class="issue-signs">
                                        <strong>العلامات:</strong>
                                        <ul>${issue.signs.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ul>
                                    </div>
                                ` : ''}
                                
                                <div class="issue-details">
                                    ${issue.causes ? `
                                        <div class="causes">
                                            <strong>الأسباب المحتملة:</strong>
                                            <ul>${issue.causes.map(c => `<li>${escapeHTML(c)}</li>`).join('')}</ul>
                                        </div>
                                    ` : ''}
                                    
                                    ${issue.cause ? `
                                        <div class="cause-single"><strong>السبب:</strong> ${escapeHTML(issue.cause)}</div>
                                    ` : ''}
                                    
                                    ${issue.diagnosis ? `
                                        <div class="diagnosis">
                                            <strong>التشخيص:</strong> ${escapeHTML(issue.diagnosis)}
                                        </div>
                                    ` : ''}
                                    
                                    ${issue.solutions ? `
                                        <div class="solutions">
                                            <strong>الحلول:</strong>
                                            ${issue.solutions.map(sol => {
                                                if (typeof sol === 'object' && sol.method) {
                                                    return `
                                                        <div class="solution-method">
                                                            <div class="method-name">${escapeHTML(sol.method)}</div>
                                                            ${sol.steps ? `
                                                                <ol>${sol.steps.map(s => `<li>${escapeHTML(s)}</li>`).join('')}</ol>
                                                            ` : ''}
                                                            ${sol.success ? `<div class="success-rate">نسبة النجاح: ${escapeHTML(sol.success)}</div>` : ''}
                                                            ${sol.note ? `<div class="method-note">📝 ${escapeHTML(sol.note)}</div>` : ''}
                                                        </div>
                                                    `;
                                                }
                                                return `<div class="solution-simple">${escapeHTML(sol)}</div>`;
                                            }).join('')}
                                        </div>
                                    ` : ''}
                                    
                                    ${issue.solution ? `
                                        <div class="solution-single"><strong>الحل:</strong> ${escapeHTML(issue.solution)}</div>
                                    ` : ''}
                                    
                                    ${issue.prevention ? `
                                        <div class="prevention">
                                            <strong>🛡️ الوقاية المستقبلية:</strong>
                                            ${Array.isArray(issue.prevention) ? 
                                                `<ul>${issue.prevention.map(p => `<li>${escapeHTML(p)}</li>`).join('')}</ul>` :
                                                escapeHTML(issue.prevention)
                                            }
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            // ملاحظات علمية
            if (protocol.scienceNotes) {
                html += `
                    <div class="science-notes-section">
                        <h4>🔬 الملاحظات العلمية التفصيلية</h4>
                        ${Object.entries(protocol.scienceNotes).map(([key, note]) => `
                            <div class="science-note-card">
                                <h5>${escapeHTML(note.title)}</h5>
                                <p class="science-explanation">${escapeHTML(note.explanation)}</p>
                                ${note.key ? `<div class="science-key"><strong>النقطة الأساسية:</strong> ${escapeHTML(note.key)}</div>` : ''}
                                ${note.math ? `<div class="science-math"><strong>المعادلة:</strong> <code>${escapeHTML(note.math)}</code></div>` : ''}
                                ${note.critical ? `<div class="science-critical">⚠️ ${escapeHTML(note.critical)}</div>` : ''}
                                ${note.optimal ? `<div class="science-optimal">✓ ${escapeHTML(note.optimal)}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            // نصائح احترافية
            if (protocol.proTips) {
                html += `
                    <div class="pro-tips-section">
                        <h4>💎 نصائح احترافية</h4>
                        ${protocol.proTips.map(tip => `
                            <div class="pro-tip-card">
                                <div class="tip-header">${escapeHTML(tip.tip)}</div>
                                <div class="tip-detail">${escapeHTML(tip.detail)}</div>
                                ${tip.when ? `<div class="tip-when"><strong>متى:</strong> ${escapeHTML(tip.when)}</div>` : ''}
                                ${tip.brands ? `<div class="tip-brands"><strong>ماركات موصى بها:</strong> ${escapeHTML(tip.brands)}</div>` : ''}
                                ${tip.warning ? `<div class="tip-warning">⚠️ ${escapeHTML(tip.warning)}</div>` : ''}
                                ${tip.shelfLife ? `<div class="tip-shelf">📦 ${escapeHTML(tip.shelfLife)}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            container.innerHTML = html;
            container.style.display = 'block';
        },

        renderFillingResult(result) {
            const container = $('#filling-results-container');
            if (!result) { 
                container.innerHTML = ''; 
                return; 
            }
            
            const { requiredWeight, scaledRecipe, perLayerAmount, sweetness, waterActivity, stability, presetName } = result;
            
            // Sweetness color coding
            const sweetnessBarWidth = Math.min(100, sweetness.index * 2);
            
            container.innerHTML = `
                <div class="result-box filling-results">
                    <h3>🍰 نتائج حساب الحشوة</h3>
                    
                    <div class="filling-summary">
                        <div class="summary-card highlight">
                            <label>نوع الحشوة:</label>
                            <value>${presetName}</value>
                        </div>
                        <div class="summary-card">
                            <label>الكمية الإجمالية المطلوبة:</label>
                            <value>${requiredWeight.toFixed(0)} جرام</value>
                        </div>
                        <div class="summary-card">
                            <label>لكل طبقة:</label>
                            <value>${perLayerAmount.toFixed(0)} جرام</value>
                            <small>≈ ${(perLayerAmount / 15).toFixed(1)} ملعقة كبيرة</small>
                        </div>
                    </div>
                    
                    <div class="filling-analysis-card">
                        <h4>📊 التحليل العلمي للحشوة:</h4>
                        
                        <div class="analysis-metrics-grid">
                            <div class="analysis-metric">
                                <div class="metric-label">درجة الحلاوة</div>
                                <div class="metric-value" style="color: ${sweetness.color}">${sweetness.percentage}</div>
                                <div class="metric-description">${sweetness.level}</div>
                                <div class="sweetness-bar" style="margin-top: 10px;">
                                    <div class="sweetness-fill" style="width: ${sweetnessBarWidth}%; background: ${sweetness.color}"></div>
                                </div>
                            </div>
                            
                            <div class="analysis-metric">
                                <div class="metric-label">النشاط المائي</div>
                                <div class="metric-value">${waterActivity.value.toFixed(2)}</div>
                                <div class="metric-description">${waterActivity.moistureTransferRate}</div>
                            </div>
                            
                            <div class="analysis-metric">
                                <div class="metric-label">الثبات</div>
                                <div class="metric-value">${stability.score}</div>
                                <div class="metric-description">${stability.level}</div>
                            </div>
                            
                            <div class="analysis-metric">
                                <div class="metric-label">زمن النضوج المتوقع</div>
                                <div class="metric-value">⏱️</div>
                                <div class="metric-description">${waterActivity.maturationTime}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="filling-recipe">
                        <h4>المقادير المحسوبة:</h4>
                        <div class="ingredients-grid">
                            ${Object.entries(scaledRecipe).map(([ingredient, weight]) => {
                                const name = this.getIngredientArabicName(ingredient);
                                const approx = this.getFillingApproximateMeasure(ingredient, weight);
                                return `
                                    <div class="ingredient-card">
                                        <label>${name}:</label>
                                        <value>${weight.toFixed(0)} جم</value>
                                        ${approx ? `<small>${approx}</small>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="filling-tips">
                        <h4>💡 نصائح للحشو:</h4>
                        <ul>
                            <li>اخفق الكريمة قليلاً قبل الاستخدام للحصول على قوام كثيف</li>
                            <li>تأكد من برودة جميع المكونات (4-6°C) قبل البدء</li>
                            <li>اترك الكيكة تبرد تماماً قبل إضافة الحشو</li>
                            <li>وزع الحشو بالتساوي بين الطبقات للحصول على شكل متناسق</li>
                            <li>اترك الكيكة في الثلاجة للمدة الموصى بها: ${waterActivity.maturationTime}</li>
                        </ul>
                    </div>
                </div>`;
        },

        // ============================ TROUBLESHOOTING TAB =============================
        renderTroubleshootingWizard(step, data = null) {
            const container = $('#troubleshooting-wizard-container');
            
            if (step === 1) {
                container.innerHTML = `
                    <div class="troubleshooting-wizard">
                        <h3>🔧 ما المشكلة التي تواجهها؟</h3>
                        <p class="wizard-subtitle">اختر المشكلة للحصول على حلول علمية مفصلة</p>
                        
                        <div class="problems-grid">
                            <button class="problem-option" data-problem="sticky">
                                <span class="problem-icon">🍯</span>
                                <span class="problem-title">العجينة لزجة جداً</span>
                                <span class="problem-desc">تلتصق بكل شيء ولا يمكن فردها</span>
                            </button>
                            
                            <button class="problem-option" data-problem="dry">
                                <span class="problem-icon">🏜️</span>
                                <span class="problem-title">العجينة جافة ومتفتتة</span>
                                <span class="problem-desc">تتكسر عند محاولة الفرد</span>
                            </button>
                            
                            <button class="problem-option" data-problem="hard">
                                <span class="problem-icon">🪨</span>
                                <span class="problem-title">الطبقات قاسية بعد الخبز</span>
                                <span class="problem-desc">صعبة المضغ وجافة</span>
                            </button>
                            
                            <button class="problem-option" data-problem="bitter">
                                <span class="problem-icon">🧼</span>
                                <span class="problem-title">طعم قلوي (صابوني)</span>
                                <span class="problem-desc">طعم مر أو معدني</span>
                            </button>
                            
                            <button class="problem-option" data-problem="pale">
                                <span class="problem-icon">⚪</span>
                                <span class="problem-title">اللون باهت جداً</span>
                                <span class="problem-desc">لا يحمر حتى بعد الخبز الطويل</span>
                            </button>
                            
                            <button class="problem-option" data-problem="burnt">
                                <span class="problem-icon">🔥</span>
                                <span class="problem-title">احتراق سريع</span>
                                <span class="problem-desc">الحواف تحترق والوسط نيء</span>
                            </button>
                        </div>
                    </div>`;
                    
            } else if (step === 2 && data) {
                container.innerHTML = `
                    <div class="troubleshooting-solution">
                        <div class="solution-header">
                            <button class="btn btn-secondary" id="back-to-problems-btn">
                                ← العودة لقائمة المشاكل
                            </button>
                            <h3>${data.title}</h3>
                        </div>
                        
                        <div class="solution-content">
                            <div class="causes-section">
                                <h4>🔍 الأسباب المحتملة:</h4>
                                <ul class="causes-list">
                                    ${data.causes.map(c => `<li>${c}</li>`).join('')}
                                </ul>
                            </div>
                            
                            <div class="solutions-section">
                                <h4>✅ الحلول المقترحة:</h4>
                                <ul class="solutions-list">
                                    ${data.solutions.map(s => `<li>${s}</li>`).join('')}
                                </ul>
                            </div>
                            
                            <div class="science-section">
                                <h4>🔬 الأساس العلمي:</h4>
                                <p>${data.scientific}</p>
                            </div>
                            
                            ${data.prevention ? `
                            <div class="prevention-section">
                                <h4>🛡️ الوقاية المستقبلية:</h4>
                                <ul>
                                    ${data.prevention.map(p => `<li>${p}</li>`).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                    </div>`;
            }
        },

        // ============================ LIBRARY TAB =============================
        renderLibrary(recipes) {
            const container = $('#recipe-library-container');
            if (!recipes || recipes.length === 0) { 
                container.innerHTML = `
                    <div class="empty-library">
                        <p>📚 مكتبتك فارغة حالياً</p>
                        <small>احفظ وصفاتك المفضلة هنا للرجوع إليها لاحقاً</small>
                    </div>`; 
                return; 
            }
            
            container.innerHTML = `
                <div class="library-grid">
                    ${recipes.map(recipe => this.createRecipeCard(recipe)).join('')}
                </div>`;
        },
        
        createRecipeCard(recipe) {
            const { name, id, analysis, createdAt } = recipe;
            const safeName = escapeHTML(name);
            const score = analysis.qualityScore;
            const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-medium' : 'score-low';
            
            const date = new Date(createdAt);
            const dateStr = date.toLocaleDateString('ar-SA', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
            
            return `
                <div class="recipe-card">
                    <div class="recipe-card-header">
                        <h4 class="recipe-name">${safeName}</h4>
                        <span class="quality-badge ${scoreClass}">${score}/100</span>
                    </div>
                    
                    <div class="recipe-card-body">
                        <div class="recipe-ingredients">
                            ${Object.entries(analysis.recipe).map(([k,v]) => {
                                const names = {
                                    flour: 'دقيق',
                                    butter: 'زبدة',
                                    sugar: 'سكر',
                                    honey: 'عسل',
                                    eggs: 'بيض',
                                    soda: 'صودا'
                                };
                                return `<span class="ingredient-tag">${names[k]}: ${v}جم</span>`;
                            }).join('')}
                        </div>
                        
                        <div class="recipe-meta">
                            <small class="recipe-date">📅 ${dateStr}</small>
                            <small class="recipe-hydration">💧 ${analysis.hydration.toFixed(1)}%</small>
                        </div>
                        
                        <div class="recipe-actions">
                            <button class="btn btn-primary btn-load-recipe" data-id="${id}">
                                📥 تحميل
                            </button>
                            <button class="btn btn-danger btn-delete-recipe" data-id="${id}">
                                🗑️ حذف
                            </button>
                        </div>
                    </div>
                </div>`;
        },

        // ============================ HELPER FUNCTIONS =============================
        getRecipeInputs() {
            return {
                flour: parseFloat($('#flour').value) || 0, 
                butter: parseFloat($('#butter').value) || 0,
                sugar: parseFloat($('#sugar').value) || 0, 
                honey: parseFloat($('#honey').value) || 0,
                eggs: parseFloat($('#eggs').value) || 0, 
                soda: parseFloat($('#soda').value) || 0,
            };
        },
        
        setRecipeInputs(recipe) {
            $('#flour').value = recipe.flour.toFixed(1); 
            $('#butter').value = recipe.butter.toFixed(1);
            $('#sugar').value = recipe.sugar.toFixed(1); 
            $('#honey').value = recipe.honey.toFixed(1);
            $('#eggs').value = recipe.eggs.toFixed(1); 
            $('#soda').value = recipe.soda.toFixed(1);
        },

        getPanInputs(target) {
            const shape = $(`input[name="pan-shape-${target}"]:checked`)?.value || 'round';
            const dim1 = parseFloat($(`#pan-dim1-${target}`)?.value) || 24;
            const dim2 = shape === 'rectangle' ? (parseFloat($(`#pan-dim2-${target}`)?.value) || 20) : null;
            return { shape, dim1, dim2 };
        },

        getPanInputsForFilling() {
            const dim1 = parseFloat($('#filling-pan-dim1')?.value) || 24;
            const dim2 = parseFloat($('#filling-pan-dim2')?.value) || null;
            return { dim1, dim2 };
        },

        getTemperingInputs() {
            return {
                eggMass: parseFloat($('#tempering-egg-mass').value) || 0,
                eggTemp: parseFloat($('#tempering-egg-temp').value) || 20,
                liquidMass: parseFloat($('#tempering-liquid-mass').value) || 0,
                liquidTemp: parseFloat($('#tempering-liquid-temp').value) || 85,
                batchCount: parseInt($('#tempering-batch-count').value) || 5
            };
        },
        
        getApproximateMeasure(ingredient, grams) {
            const conversions = {
                flour: { unit: 'كوب', factor: 120 },
                butter: { unit: 'ملعقة كبيرة', factor: 14 },
                sugar: { unit: 'كوب', factor: 200 },
                honey: { unit: 'ملعقة كبيرة', factor: 21 },
                eggs: { unit: 'بيضة', factor: 55 },
                soda: { unit: 'ملعقة صغيرة', factor: 4.6 }
            };
            
            const conv = conversions[ingredient];
            if (!conv) return '';
            
            const amount = grams / conv.factor;
            if (amount < 0.25) return `ربع ${conv.unit}`;
            if (amount < 0.5) return `ثلث ${conv.unit}`;
            if (amount < 0.75) return `نصف ${conv.unit}`;
            if (amount < 1.25) return `${conv.unit} واحد`;
            
            return `${amount.toFixed(1)} ${conv.unit}`;
        },

        getFillingApproximateMeasure(ingredient, grams) {
            const conversions = {
                'sour-cream': { unit: 'كوب', factor: 240 },
                'whipping-cream': { unit: 'كوب', factor: 240 },
                'cream-cheese': { unit: 'علبة (227جم)', factor: 227 },
                'condensed-milk': { unit: 'علبة (397جم)', factor: 397 },
                'dulce-de-leche': { unit: 'علبة', factor: 450 },
                'butter': { unit: 'ملعقة كبيرة', factor: 14 },
                'powdered-sugar': { unit: 'كوب', factor: 120 },
                'honey': { unit: 'ملعقة كبيرة', factor: 21 }
            };
            
            const conv = conversions[ingredient];
            if (!conv) return '';
            
            const amount = grams / conv.factor;
            if (amount < 0.25) return '';
            if (amount < 0.5) return `ثلث ${conv.unit}`;
            if (amount < 0.75) return `نصف ${conv.unit}`;
            if (amount < 1.25) return `${conv.unit} واحد`;
            
            return `≈ ${amount.toFixed(1)} ${conv.unit}`;
        },

        getIngredientArabicName(ingredient) {
            const names = {
                // الأسماء الموحدة الجديدة
                'sour-cream': 'كريمة حامضة (Sour Cream)',
                'sour-cream-30': 'كريمة حامضة 30% دسم',
                'whipping-cream': 'كريمة خفق',
                'heavy-cream-35': 'كريمة خفق ثقيلة 35%',
                'cream-cheese': 'جبن كريمي',
                'cream-cheese-full-fat': 'جبن كريمي كامل الدسم',
                'condensed-milk': 'حليب مكثف محلى',
                'sweetened-condensed-milk': 'حليب مكثف محلى',
                'dulce-de-leche': 'دولسي دي ليتشي',
                'dulce-de-leche-authentic': 'دولسي دي ليتشي أصلي',
                'caramel': 'كراميل',
                'homemade-caramel': 'كراميل منزلي',
                'butter': 'زبدة',
                'unsalted-butter': 'زبدة غير مملحة',
                'powdered-sugar': 'سكر بودرة',
                'powdered-sugar-fine': 'سكر بودرة ناعم',
                'sugar': 'سكر',
                'granulated-sugar': 'سكر حبيبات',
                'honey': 'عسل',
                'honey-raw': 'عسل طبيعي خام',
                'vanilla': 'فانيليا',
                'vanilla-extract': 'خلاصة فانيليا',
                'vanilla-bean-pod': 'قرن فانيليا',
                'orange-zest': 'قشر برتقال',
                'milk': 'حليب',
                'whole-milk': 'حليب كامل الدسم',
                'egg-yolks': 'صفار بيض',
                'egg-yolks-large': 'صفار بيض كبير',
                'cornstarch': 'نشا ذرة',
                'mascarpone': 'ماسكربوني',
                'lemon-juice': 'عصير ليمون',
                'lemon-juice-fresh': 'عصير ليمون طازج',
                'sea-salt-fine': 'ملح بحري ناعم',
                'sea-salt-flakes': 'رقائق ملح بحري',
                'gelatin-sheets': 'جيلاتين ورقي',
                'water-gelatin': 'ماء للجيلاتين',
                'other': 'مكونات أخرى'
            };
            return names[ingredient] || ingredient;
        }
    };

    window.UIRenderer = UIRenderer;
})(window, window.MedovikCalculatorCore);