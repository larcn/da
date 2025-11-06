// ===================================================================================
// UI.JS - The User Interface Renderer
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
            
            // الحصول على النطاق المثالي
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
            
            // أيقونات وألوان الحالة
            const statusConfig = {
                safe: { icon: '✅', class: 'success', text: 'آمن' },
                warning: { icon: '⚠️', class: 'warning', text: 'حذر' },
                danger: { icon: '🔴', class: 'danger', text: 'خطر' }
            };
            const status = statusConfig[safetyStatus];
            
            // جدول الدفعات مع الدلائل الحسية
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
            
            // حلول مقترحة إذا كانت الحالة غير آمنة
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
        
        renderFillingResult(result) {
            const container = $('#filling-results-container');
            if (!result) { 
                container.innerHTML = ''; 
                return; 
            }
            
            const { requiredWeight, scaledRecipe, perLayerAmount } = result;
            
            container.innerHTML = `
                <div class="result-box filling-results">
                    <h3>🍰 مقادير الحشو المحسوبة</h3>
                    
                    <div class="filling-summary">
                        <div class="summary-card highlight">
                            <label>الكمية الإجمالية المطلوبة:</label>
                            <value>${requiredWeight.toFixed(0)} جرام</value>
                        </div>
                        <div class="summary-card">
                            <label>لكل طبقة:</label>
                            <value>${perLayerAmount.toFixed(0)} جرام</value>
                            <small>≈ ${(perLayerAmount / 15).toFixed(1)} ملعقة كبيرة</small>
                        </div>
                    </div>
                    
                    <div class="filling-recipe">
                        <h4>المقادير المفصلة:</h4>
                        <div class="ingredients-grid">
                            <div class="ingredient-card">
                                <i class="icon-cream"></i>
                                <label>كريمة حامضة/زبادي:</label>
                                <value>${scaledRecipe['filling-cream'].toFixed(0)} جم</value>
                                <small>≈ ${(scaledRecipe['filling-cream'] / 240).toFixed(1)} كوب</small>
                            </div>
                            <div class="ingredient-card">
                                <i class="icon-milk"></i>
                                <label>حليب مكثف محلى:</label>
                                <value>${scaledRecipe['filling-condensed-milk'].toFixed(0)} جم</value>
                                <small>≈ ${(scaledRecipe['filling-condensed-milk'] / 397).toFixed(1)} علبة</small>
                            </div>
                            ${scaledRecipe['filling-other'] > 0 ? `
                            <div class="ingredient-card">
                                <i class="icon-other"></i>
                                <label>مكونات أخرى:</label>
                                <value>${scaledRecipe['filling-other'].toFixed(0)} جم</value>
                            </div>` : ''}
                        </div>
                    </div>
                    
                    <div class="filling-tips">
                        <h4>نصائح للحشو:</h4>
                        <ul>
                            <li>اخفق الكريمة قليلاً قبل الاستخدام للحصول على قوام كثيف</li>
                            <li>أضف الحليب المكثف تدريجياً حتى تصل للحلاوة المطلوبة</li>
                            <li>اترك الكيكة تبرد تماماً قبل إضافة الحشو</li>
                            <li>وزع الحشو بالتساوي بين الطبقات للحصول على شكل متناسق</li>
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
        }
    };

    window.UIRenderer = UIRenderer;
})(window, window.MedovikCalculatorCore);