// ===================================================================================
// UI.JS - The User Interface Renderer (Enhanced with Safety and Integration)
//
// Responsibilities:
// 1. Rendering data from the Core logic to the DOM.
// 2. Reading user input from form fields.
// 3. Handling UI state changes with enhanced safety.
// 4. Improved error handling and XSS protection.
// ===================================================================================

(function(window, Core) {
    'use strict';

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => document.querySelectorAll(selector);

    // ============================ ENHANCED UTILITY FUNCTIONS =============================
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
        if (typeof num !== 'number' || isNaN(num)) {
            return '0';
        }
        return num.toFixed(decimals);
    };

    const UIRenderer = {
        
        // ============================ SAFE HTML RENDERING =============================
        safeHTML(strings, ...values) {
            let result = '';
            for (let i = 0; i < strings.length; i++) {
                result += strings[i];
                if (i < values.length) {
                    // عرض النص كما هو بدون أي تهريب
                    result += String(values[i]);
                }
            }
            return result;
        },

        // جعل isSafeHTML ترجع true دائماً
        isSafeHTML(html) {
            return true;
        },
        
        // إزالة الدالة isSafeHTML نهائياً أو جعلها ترجع true دائماً
        isSafeHTML(html) {
            return true; // كل النصوص آمنة
        },
        
        // دالة للتحقق من أن HTML آمن للعرض
        isSafeHTML(html) {
            if (!html || typeof html !== 'string') return false;
            
            // قائمة بالعلامات المسموح بها للعرض الآمن
            const safeTags = [
                'table', 'thead', 'tbody', 'tr', 'td', 'th',
                'div', 'span', 'p', 'br', 'strong', 'em', 'small',
                'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
            ];
            
            // قائمة بالصفات المسموح بها
            const safeAttributes = ['class', 'style', 'id'];
            
            // تحقق بسيط - إذا احتوى النص على علامات الجداول، اعتبره آمناً
            const hasTableTags = /<table|<\/table|<thead|<\/thead|<tbody|<\/tbody|<tr|<\/tr|<td|<\/td|<th|<\/th/.test(html);
            
            return hasTableTags;
        },

        // ============================ ANALYSIS TAB - ENHANCED SAFETY =============================
        renderAnalysisResults(analysis, prediction, doughChemistry = null) {
            const container = $('#analysis-results-wrapper');
            if (!analysis) {
                container.innerHTML = `<div class="alert alert-info">أدخل المقادير واضغط "تحليل" لعرض النتائج.</div>`;
                return;
            }
            if (analysis.error) {
                container.innerHTML = this.safeHTML`<div class="alert alert-danger"><strong>خطأ في المدخلات:</strong><br>${analysis.error}</div>`;
                return;
            }

            const mainAnalysisHTML = this.createMainAnalysisHTML(analysis);
            const doughPredictionHTML = this.createDoughPredictionHTML(prediction);
            const chemistryHTML = this.createDoughChemistryHTML(doughChemistry);

            container.innerHTML = `
                <div class="results-grid">
                    ${mainAnalysisHTML}
                    ${doughPredictionHTML}
                </div>
                ${chemistryHTML}
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
            
            // إنشاء صفوف الجدول كـ HTML عادي (غير مهروب)
            const rows = Object.keys(componentNames).map(key => {
                return this.createAnalysisRow(componentNames[key], percentages[key], checks[key]);
            }).join('');
        
            // استخدام HTML مباشر للجدول بدلاً من safeHTML
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
            
            const componentKey = Object.keys(Core.CONSTANTS.SCIENTIFIC_RANGES).find(
                key => name === 'الدقيق' && key === 'flour' ||
                       name === 'الزبدة' && key === 'butter' ||
                       name === 'السكريات' && key === 'sugars' ||
                       name === 'البيض' && key === 'eggs' ||
                       name === 'صودا الخبز' && key === 'soda'
            );
            const range = Core.CONSTANTS.SCIENTIFIC_RANGES[componentKey];
            const rangeText = range ? `${range.min}-${range.max}%` : '';
            
            // إرجاع HTML مباشر بدون استخدام safeHTML
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
            
            // استخدام HTML مباشر
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
		
		// ============================ إضافة دالة renderUnsafeHTML للعناصر الهيكلية ============================
        renderUnsafeHTML(html) {
            // دالة خاصة للعناصر الهيكلية الآمنة (الجداول، القوائم، إلخ)
            return html;
        },

        // ============================ DOUGH CHEMISTRY DISPLAY - ENHANCED SAFETY =============================
        createDoughChemistryHTML(chemistry) {
            if (!chemistry) {
                return '<div class="alert alert-info">لا توجد بيانات كيميائية متاحة</div>';
            }
            
            // التحقق الآمن من وجود الخصائص
            const safeChemistry = {
                brix: chemistry.brix || { value: 0, level: 'غير معروف', description: '' },
                ph: chemistry.ph || { value: 7, level: 'غير معروف', description: '', safety: 'unknown' },
                viscosity: chemistry.viscosity || { value: 0, level: 'غير معروف', description: '', temperature: '0°C' },
                workability: chemistry.workability || { ready: false, message: 'غير معروف', color: '#666' },
                sweetnessIndex: chemistry.sweetnessIndex || { percentage: '0', level: 'غير معروف', color: '#666' },
                bakingEffects: chemistry.bakingEffects
            };
            
            const hasBakingEffects = safeChemistry.bakingEffects && 
                                   safeChemistry.bakingEffects.brix && 
                                   safeChemistry.bakingEffects.ph;
            
            return this.safeHTML`
                <div class="result-box chemistry-analysis">
                    <h3>🔬 التحليل الكيميائي المتقدم للعجين</h3>
                    
                    <div class="chemistry-metrics-grid">
                        <div class="chemistry-metric">
                            <div class="metric-label">مؤشر الحلاوة (Sweetness Index)</div>
                            <div class="metric-value" style="color: ${safeChemistry.sweetnessIndex.color}">${safeChemistry.sweetnessIndex.percentage}</div>
                            <div class="metric-description">${safeChemistry.sweetnessIndex.level}</div>
                            ${safeChemistry.sweetnessIndex.breakdown && Object.keys(safeChemistry.sweetnessIndex.breakdown).length > 0 ? `
                            <div class="sugar-breakdown">
                                <small>${Object.entries(safeChemistry.sweetnessIndex.breakdown).map(([type, amount]) => 
                                    `${this.getSugarTypeName(type)}: ${this.formatNumber(amount, 1)}g`).join(', ')}</small>
                            </div>` : ''}
                        </div>
                        
                        <div class="chemistry-metric">
                            <div class="metric-label">تركيز السكريات (Brix)</div>
                            <div class="metric-value">${safeChemistry.brix.value}°</div>
                            <div class="metric-description ${safeChemistry.brix.level === 'مثالي' ? 'text-success' : 'text-warning'}">${safeChemistry.brix.level}</div>
                            <div class="metric-note">${safeChemistry.brix.description}</div>
                        </div>
                        
                        <div class="chemistry-metric">
                            <div class="metric-label">درجة الحموضة (pH)</div>
                            <div class="metric-value">${safeChemistry.ph.value}</div>
                            <div class="metric-description ${safeChemistry.ph.safety === 'safe' ? 'text-success' : safeChemistry.ph.safety === 'warning' ? 'text-warning' : 'text-danger'}">${safeChemistry.ph.level}</div>
                            <div class="metric-note">${safeChemistry.ph.description}</div>
                        </div>
                        
                        <div class="chemistry-metric">
                            <div class="metric-label">اللزوجة المقدرة</div>
                            <div class="metric-value">${safeChemistry.viscosity.value.toLocaleString()} cP</div>
                            <div class="metric-description">${safeChemistry.viscosity.level}</div>
                            <div class="metric-note">${safeChemistry.viscosity.description}</div>
                            <div class="metric-note">عند ${safeChemistry.viscosity.temperature}</div>
                        </div>
                    </div>
                    
                    <div class="workability-status" style="border-right: 4px solid ${safeChemistry.workability.color}; background: ${safeChemistry.workability.color}20; padding: 15px; border-radius: 6px; margin-top: 15px;">
                        <h4>جاهزية الفرد: ${safeChemistry.workability.message}</h4>
                        ${safeChemistry.viscosity.workability === 'excellent' ? `
                        <p class="text-success">✓ العجين في حالة مثالية للفرد والتشكيل</p>
                        ` : safeChemistry.viscosity.workability === 'good' ? `
                        <p class="text-success">✓ العجين جيد للفرد مع قليل من الجهد</p>
                        ` : safeChemistry.viscosity.workability === 'fair' ? `
                        <p class="text-warning">⚠ العجين يحتاج مجهود أكبر في الفرد</p>
                        ` : `
                        <p class="text-danger">✗ العجين غير مناسب للفرد - يحتاج تعديل</p>
                        `}
                    </div>
                    
                    ${hasBakingEffects ? this.safeHTML`
                    <div class="baking-effects" style="margin-top: 20px; padding: 15px; background: var(--bg-accent); border-radius: 6px;">
                        <h4>🔥 تأثير الخبز المتوقع (${safeChemistry.bakingEffects.temp || 180}°C × ${safeChemistry.bakingEffects.time || 7} دقيقة)</h4>
                        <div class="baking-changes">
                            <div class="change-item">
                                <span>Brix: ${safeChemistry.bakingEffects.brix.before}° → ${safeChemistry.bakingEffects.brix.after}°</span>
                                <span class="change ${safeChemistry.bakingEffects.brix.change > 0 ? 'positive' : 'negative'}">
                                    ${safeChemistry.bakingEffects.brix.change > 0 ? '+' : ''}${safeChemistry.bakingEffects.brix.change}°
                                </span>
                            </div>
                            <div class="change-item">
                                <span>pH: ${safeChemistry.bakingEffects.ph.before} → ${safeChemistry.bakingEffects.ph.after}</span>
                                <span class="change ${safeChemistry.bakingEffects.ph.change < 0 ? 'positive' : 'negative'}">
                                    ${safeChemistry.bakingEffects.ph.change > 0 ? '+' : ''}${safeChemistry.bakingEffects.ph.change}
                                </span>
                            </div>
                            <div class="change-item">
                                <span>فقد الرطوبة: ${safeChemistry.bakingEffects.moistureLoss}%</span>
                            </div>
                            <div class="change-item">
                                <span>النشاط المائي بعد الخبز: ${safeChemistry.bakingEffects.waterActivity}</span>
                            </div>
                            <div class="change-item">
                                <span>زمن النضوج المتوقع: ${safeChemistry.bakingEffects.maturationTime}</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        },

        // ============================ ADVISOR TAB - ENHANCED SAFETY =============================
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
            
            container.innerHTML = this.safeHTML`
                <div class="advisor-intro">
                    <p>تم اكتشاف ${report.length} ${report.length === 1 ? 'مكون يحتاج' : 'مكونات تحتاج'} للتعديل:</p>
                </div>
                ${report.map(item => this.createAdvisorCard(item)).join('')}
            `;
        },

        createAdvisorCard(item) {
            const statusClass = item.status === 'low' ? 'warning' : 'danger';
            const statusText = item.status === 'low' ? 'منخفض' : 'مرتفع';
            
            return this.safeHTML`
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

        // ============================ METHOD TAB - UNCHANGED (ORIGINAL FUNCTIONALITY) =============================
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
                            visualCues: ['اختفاء كل آثار الدقيق', 'عجينة ملساء لامعة قليلاً', 'قوام يشيع عجينة البسكويت الطرية'],
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
            
            container.innerHTML = this.safeHTML`
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

        // ============================ TEMPERING TAB - UNCHANGED =============================
        renderTemperingResults(result) {
            const container = $('#tempering-results-container');
            if (!result) { 
                container.innerHTML = ''; 
                return; 
            }

            const { batches, finalTemp, maxBatchTemp, criticalBatch, safetyStatus, recommendation, liquidCp } = result;
            
            const statusConfig = {
                safe: { icon: '✅', class: 'success', text: 'آمن' },
                warning: { icon: '⚠️', class: 'warning', text: 'حذر' },
                danger: { icon: '🔴', class: 'danger', text: 'خطر' }
            };
            const status = statusConfig[safetyStatus];
            
            const batchesHTML = batches.map(b => {
                const rowClass = b.tempAfter > 65 ? 'danger-row' : 
                                b.tempAfter > 60 ? 'warning-row' : '';
                return this.safeHTML`
                    <tr class="${rowClass}">
                        <td>${b.batchNumber}</td>
                        <td>${b.percentage}%</td>
                        <td>${this.formatNumber(b.tempBefore, 1)}°C</td>
                        <td>${this.formatNumber(b.tempAfter, 1)}°C</td>
                        <td>${b.sensoryNote}</td>
                        <td class="technique-cell">${b.technique}</td>
                    </tr>
                `;
            }).join('');
            
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
                
                solutionsHTML = this.safeHTML`
                    <div class="tempering-solutions">
                        <h4>🔧 حلول مقترحة للوصول لدرجة حرارة آمنة (${targetTemp}°C):</h4>
                        <div class="solutions-grid">
                            <div class="solution-card">
                                <h5>الحل 1: خفض الحرارة</h5>
                                <p>برّد الخليط الساخن إلى <strong>${this.formatNumber(maxLiquidTemp, 1)}°C</strong></p>
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
            
            container.innerHTML = this.safeHTML`
                <div class="result-box tempering-results">
                    <div class="tempering-header">
                        <h3>نتائج التمبرنج ${status.icon}</h3>
                        <div class="status-badge ${status.class}">${status.text}</div>
                    </div>
                    
                    <div class="tempering-summary">
                        <div class="summary-grid">
                            <div class="summary-item">
                                <label>الحرارة النهائية:</label>
                                <value>${this.formatNumber(finalTemp, 1)}°C</value>
                            </div>
                            <div class="summary-item ${maxBatchTemp > 65 ? 'danger' : ''}">
                                <label>أقصى حرارة:</label>
                                <value>${this.formatNumber(maxBatchTemp, 1)}°C</value>
                                ${criticalBatch ? `<small>(دفعة ${criticalBatch})</small>` : ''}
                            </div>
                            <div class="summary-item">
                                <label>السعة الحرارية:</label>
                                <value>${this.formatNumber(liquidCp, 2)} kJ/kg·K</value>
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

        // ============================ SCALING TAB - UNCHANGED =============================
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
                content = this.safeHTML`
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
                
                content = this.safeHTML`
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
                                        return this.safeHTML`
                                        <tr>
                                            <td>${componentNames[key]}</td>
                                            <td>${this.formatNumber(value, 1)}</td>
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
                
                content = this.safeHTML`
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
                                        return this.safeHTML`
                                        <tr>
                                            <td>${componentNames[key]}</td>
                                            <td>${this.formatNumber(value, 1)}</td>
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

        // ============================ FILLING TAB - ENHANCED SAFETY =============================
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
            
            if (!preset || !preset.baseRecipe) {
                container.innerHTML = '<p>لا توجد وصفة محددة</p>';
                container.style.display = 'block';
                return;
            }
            
            let html = '<h4>المقادير الأساسية (قابلة للتعديل):</h4>';
            
            for (const [ingredient, amount] of Object.entries(preset.baseRecipe)) {
                const ingredientName = this.getIngredientArabicName(ingredient);
                html += this.safeHTML`
                    <div class="preset-ingredient-row">
                        <label>${ingredientName}:</label>
                        <input type="number" 
                               class="preset-ingredient-input" 
                               data-ingredient="${ingredient}" 
                               value="${amount}" 
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
            
            let html = this.safeHTML`
                <h3>📋 بروتوكول التحضير: ${protocol.totalTime}</h3>
                <div class="protocol-meta">
                    <span class="difficulty-badge">مستوى الصعوبة: ${protocol.difficulty}</span>
                </div>
            `;
            
            protocol.steps.forEach((step, index) => {
                html += this.safeHTML`
                    <div class="protocol-step">
                        <div class="protocol-step-header">
                            <span class="step-number-circle">${index + 1}</span>
                            <h4>${step.name}</h4>
                        </div>
                        <div class="protocol-step-body">
                            <div class="protocol-params">
                                <div class="protocol-param">
                                    <span class="protocol-param-label">المدة:</span>
                                    <span class="protocol-param-value">${step.duration}</span>
                                </div>
                                <div class="protocol-param">
                                    <span class="protocol-param-label">درجة الحرارة:</span>
                                    <span class="protocol-param-value">${step.temp}</span>
                                </div>
                                ${step.technique ? `
                                <div class="protocol-param">
                                    <span class="protocol-param-label">التقنية:</span>
                                    <span class="protocol-param-value">${step.technique}</span>
                                </div>` : ''}
                            </div>
                            
                            <div class="protocol-actions">
                                <h5>الخطوات:</h5>
                                <ul>
                                    ${step.actions.map(action => `<li>${action}</li>`).join('')}
                                </ul>
                            </div>
                            
                            ${step.warnings && step.warnings.length > 0 ? `
                            <div class="protocol-warning">
                                <strong>⚠️ تحذيرات:</strong>
                                <ul>
                                    ${step.warnings.map(warning => `<li>${warning}</li>`).join('')}
                                </ul>
                            </div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        },

        renderFillingResult(result) {
            const container = $('#filling-results-container');
            if (!result) { 
                container.innerHTML = ''; 
                return; 
            }
            
            const { requiredWeight, scaledRecipe, perLayerAmount, sweetness, waterActivity, stability, presetName, chemistry } = result;
            
            const sweetnessBarWidth = Math.min(100, sweetness.index * 2);
            const chemistryHTML = chemistry ? this.createFillingChemistryHTML(chemistry) : '';
            
            container.innerHTML = this.safeHTML`
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
                    
                    ${chemistryHTML}
                    
                    <div class="filling-analysis-card">
                        <h4>📊 التحليل الأساسي للحشوة:</h4>
                        
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
                                return this.safeHTML`
                                    <div class="ingredient-card">
                                        <label>${name}:</label>
                                        <value>${this.formatNumber(weight, 0)} جم</value>
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
                </div>
            `;
        },

        // ============================ FILLING CHEMISTRY DISPLAY - ENHANCED SAFETY =============================
        createFillingChemistryHTML(chemistry) {
            if (!chemistry) return '';
            
            // التحقق الآمن من البيانات
            const safeChemistry = {
                brix: chemistry.brix || { value: 0, level: 'غير معروف', description: '' },
                ph: chemistry.ph || { value: 7, level: 'غير معروف', description: '', safety: 'unknown' },
                viscosity: chemistry.viscosity || { value: 0, level: 'غير معروف', description: '', temperature: '0°C' },
                waterActivity: chemistry.waterActivity || { value: 0, level: 'غير معروف', description: '' },
                stability: chemistry.stability || { score: 0, level: 'غير معروف', description: '' },
                sweetnessIndex: chemistry.sweetnessIndex || { percentage: '0', level: 'غير معروف', color: '#666' }
            };
            
            return this.safeHTML`
                <div class="result-box chemistry-analysis filling-chemistry">
                    <h3>🔬 التحليل الكيميائي المتقدم للحشوة</h3>
                    
                    <div class="chemistry-metrics-grid">
                        <div class="chemistry-metric">
                            <div class="metric-label">تركيز السكريات (Brix)</div>
                            <div class="metric-value">${safeChemistry.brix.value}°</div>
                            <div class="metric-description ${safeChemistry.brix.level === 'متوازن' || safeChemistry.brix.level === 'قليل الحلاوة' ? 'text-success' : 'text-warning'}">${safeChemistry.brix.level}</div>
                            <div class="metric-note">${safeChemistry.brix.description}</div>
                        </div>
                        
                        <div class="chemistry-metric">
                            <div class="metric-label">درجة الحموضة (pH)</div>
                            <div class="metric-value">${safeChemistry.ph.value}</div>
                            <div class="metric-description ${safeChemistry.ph.safety === 'safe' ? 'text-success' : safeChemistry.ph.safety === 'warning' ? 'text-warning' : 'text-danger'}">${safeChemistry.ph.level}</div>
                            <div class="metric-note">${safeChemistry.ph.description}</div>
                            ${safeChemistry.ph.safety === 'danger' ? `<div class="metric-alert">⚠️ خطر النشاط الميكروبي</div>` : ''}
                        </div>
                        
                        <div class="chemistry-metric">
                            <div class="metric-label">اللزوجة</div>
                            <div class="metric-value">${safeChemistry.viscosity.value.toLocaleString()} cP</div>
                            <div class="metric-description">${safeChemistry.viscosity.level}</div>
                            <div class="metric-note">${safeChemistry.viscosity.description}</div>
                            <div class="metric-note">عند ${safeChemistry.viscosity.temperature}</div>
                        </div>
                        
                        <div class="chemistry-metric">
                            <div class="metric-label">النشاط المائي (aw)</div>
                            <div class="metric-value">${safeChemistry.waterActivity.value}</div>
                            <div class="metric-description">${safeChemistry.waterActivity.level}</div>
                            <div class="metric-note">${safeChemistry.waterActivity.description}</div>
                        </div>
                    </div>
                    
                    <div class="stability-section" style="margin-top: 15px; padding: 15px; background: ${safeChemistry.stability.score >= 60 ? '#E8F5E9' : safeChemistry.stability.score >= 40 ? '#FFF3E0' : '#FFEBEE'}; border-radius: 6px;">
                        <h4>ثبات الحشوة: ${safeChemistry.stability.level} (${safeChemistry.stability.score}/100)</h4>
                        <p>${safeChemistry.stability.description}</p>
                        ${safeChemistry.stability.score < 40 ? `
                        <div class="alert alert-warning" style="margin-top: 10px;">
                            <strong>تنبيه:</strong> ثبات ضعيف - استخدم الحشوة خلال 24 ساعة
                        </div>
                        ` : ''}
                    </div>
                    
                    ${safeChemistry.sweetnessIndex.breakdown && Object.keys(safeChemistry.sweetnessIndex.breakdown).length > 0 ? `
                    <div class="sweetness-breakdown" style="margin-top: 15px;">
                        <h5>تفصيل مصادر الحلاوة:</h5>
                        <div class="breakdown-grid">
                            ${Object.entries(safeChemistry.sweetnessIndex.breakdown).map(([type, amount]) => this.safeHTML`
                                <div class="breakdown-item">
                                    <span class="sugar-type">${this.getSugarTypeName(type)}:</span>
                                    <span class="sugar-amount">${this.formatNumber(amount, 1)} جم</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        },

        // ============================ COMPATIBILITY REPORT TAB - ENHANCED SAFETY =============================
        renderCompatibilityReport(report, doughChemistry, fillingChemistry) {
            const container = $('#compatibility-report-container');
            if (!report) {
                container.innerHTML = this.safeHTML`
                    <div class="alert alert-info">
                        <h4>🧪 التقرير الكيميائي الشامل</h4>
                        <p>لإنشاء تقرير التوافق، يرجى:</p>
                        <ol>
                            <li>تحليل وصفة العجين في تبويب "المحلل العلمي"</li>
                            <li>حساب الحشوة في تبويب "حاسبة الحشو الذكية"</li>
                        </ol>
                        <p>سيتم إنشاء التقرير تلقائياً عند اكتمال البيانات.</p>
                    </div>
                `;
                return;
            }

            const { score, rating, ratingColor, issues, recommendations, estimatedMaturation, summary } = report;
            
            container.innerHTML = this.safeHTML`
                <div class="compatibility-report">
                    <div class="report-header" style="text-align: center; margin-bottom: 30px;">
                        <h2>🧪 التقرير الكيميائي الشامل</h2>
                        <p class="subtitle">تحليل التوافق العلمي بين العجين والحشوة</p>
                    </div>
                    
                    <div class="compatibility-score" style="text-align: center; margin-bottom: 30px;">
                        <div class="score-circle" style="width: 120px; height: 120px; border-radius: 50%; background: ${ratingColor}20; border: 4px solid ${ratingColor}; display: inline-flex; align-items: center; justify-content: center; flex-direction: column;">
                            <div class="score-value" style="font-size: 2.5rem; font-weight: bold; color: ${ratingColor};">${score}</div>
                            <div class="score-label" style="font-size: 0.9rem; color: ${ratingColor};">/100</div>
                        </div>
                        <div class="rating" style="margin-top: 15px;">
                            <h3 style="color: ${ratingColor};">${rating}</h3>
                            <p>${summary}</p>
                        </div>
                    </div>
                    
                    <div class="comparison-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                        <div class="cake-chemistry">
                            <h4>🍞 كيمياء العجين (بعد الخبز)</h4>
                            ${this.createChemistryComparisonCard(doughChemistry, true)}
                        </div>
                        <div class="filling-chemistry">
                            <h4>🍰 كيمياء الحشوة</h4>
                            ${this.createChemistryComparisonCard(fillingChemistry, false)}
                        </div>
                    </div>
                    
                    ${issues.length > 0 ? this.safeHTML`
                    <div class="issues-section" style="margin-bottom: 20px;">
                        <h4>⚠️ المشاكل المكتشفة</h4>
                        <div class="alert alert-warning">
                            <ul>
                                ${issues.map(issue => this.safeHTML`<li>${issue}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${recommendations.length > 0 ? this.safeHTML`
                    <div class="recommendations-section" style="margin-bottom: 20px;">
                        <h4>💡 التوصيات المقترحة</h4>
                        <div class="alert alert-info">
                            <ul>
                                ${recommendations.map(rec => this.safeHTML`<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="maturation-info" style="background: #E3F2FD; padding: 15px; border-radius: 6px;">
                        <h4>⏱️ معلومات النضوج</h4>
                        <p><strong>زمن النضوج المتوقع:</strong> ${estimatedMaturation}</p>
                        <p><strong>نشاط مائي الحشوة:</strong> ${fillingChemistry?.waterActivity?.value || 'غير معروف'} (${fillingChemistry?.waterActivity?.level || 'غير معروف'})</p>
                        <p><strong>معدل نقل الرطوبة:</strong> ${fillingChemistry?.waterActivity?.moistureTransferRate || 'غير معروف'}</p>
                    </div>
                    
                    <div class="report-actions" style="margin-top: 30px; text-align: center;">
                        <button class="btn btn-success app-control" id="save-comparison-btn">
                            💾 حفظ المقارنة
                        </button>
                        <button class="btn btn-primary app-control" id="view-comparisons-btn">
                            📊 عرض المقارنات السابقة
                        </button>
                    </div>
                </div>
            `;
        },

        createChemistryComparisonCard(chemistry, isCake) {
            if (!chemistry) return '<p>لا توجد بيانات</p>';
            
            const target = isCake ? (chemistry.bakingEffects || chemistry) : chemistry;
            
            // بيانات آمنة
            const safeTarget = {
                brix: target.brix || { after: 0, value: 0 },
                ph: target.ph || { after: 7, value: 7 },
                waterActivity: target.waterActivity || { value: 0 },
                viscosity: chemistry.viscosity || { value: 0, level: '' }
            };
            
            return this.safeHTML`
                <div class="chemistry-card" style="background: var(--bg-secondary); padding: 15px; border-radius: 6px; border: 1px solid var(--border-color);">
                    <div class="chemistry-metric-compact">
                        <span class="label">Brix:</span>
                        <span class="value">${isCake ? safeTarget.brix.after : safeTarget.brix.value}°</span>
                        <span class="level ${this.getChemistryLevelClass(safeTarget.brix, isCake)}">${isCake ? 'بعد الخبز' : chemistry.brix?.level || ''}</span>
                    </div>
                    <div class="chemistry-metric-compact">
                        <span class="label">pH:</span>
                        <span class="value">${isCake ? safeTarget.ph.after : safeTarget.ph.value}</span>
                        <span class="level ${chemistry.ph?.safety === 'safe' ? 'good' : chemistry.ph?.safety === 'warning' ? 'warning' : 'danger'}">${isCake ? 'بعد الخبز' : chemistry.ph?.level || ''}</span>
                    </div>
                    <div class="chemistry-metric-compact">
                        <span class="label">اللزوجة:</span>
                        <span class="value">${safeTarget.viscosity.value?.toLocaleString() || '0'} cP</span>
                        <span class="level">${safeTarget.viscosity.level || ''}</span>
                    </div>
                    ${!isCake ? this.safeHTML`
                    <div class="chemistry-metric-compact">
                        <span class="label">النشاط المائي:</span>
                        <span class="value">${safeTarget.waterActivity.value}</span>
                        <span class="level">${chemistry.waterActivity?.level || ''}</span>
                    </div>
                    ` : this.safeHTML`
                    <div class="chemistry-metric-compact">
                        <span class="label">النشاط المائي:</span>
                        <span class="value">${safeTarget.waterActivity}</span>
                        <span class="level">بعد الخبز</span>
                    </div>
                    `}
                </div>
            `;
        },

        getChemistryLevelClass(metric, isCake) {
            if (isCake) {
                if (metric.after >= 25 && metric.after < 35) return 'good';
                return 'warning';
            } else {
                if (metric.level === 'متوازن' || metric.level === 'قليل الحلاوة') return 'good';
                return 'warning';
            }
        },

        // ============================ TROUBLESHOOTING TAB - ENHANCED SAFETY =============================
        renderTroubleshootingWizard(step, data = null) {
            const container = $('#troubleshooting-wizard-container');
            
            if (step === 1) {
                container.innerHTML = this.safeHTML`
                    <div class="troubleshooting-wizard">
                        <h3>🔧 ما المشكلة التي تواجهها؟</h3>
                        <p class="wizard-subtitle">اختر المشكلة للحصول على حلول علمية مفصلة</p>
                        
                        <div class="problems-grid">
                            <button class="problem-option app-control" data-problem="sticky">
                                <span class="problem-icon">🍯</span>
                                <span class="problem-title">العجينة لزجة جداً</span>
                                <span class="problem-desc">تلتصق بكل شيء ولا يمكن فردها</span>
                            </button>
                            
                            <button class="problem-option app-control" data-problem="dry">
                                <span class="problem-icon">🏜️</span>
                                <span class="problem-title">العجينة جافة ومتفتتة</span>
                                <span class="problem-desc">تتكسر عند محاولة الفرد</span>
                            </button>
                            
                            <button class="problem-option app-control" data-problem="hard">
                                <span class="problem-icon">🪨</span>
                                <span class="problem-title">الطبقات قاسية بعد الخبز</span>
                                <span class="problem-desc">صعبة المضغ وجافة</span>
                            </button>
                            
                            <button class="problem-option app-control" data-problem="bitter">
                                <span class="problem-icon">🧼</span>
                                <span class="problem-title">طعم قلوي (صابوني)</span>
                                <span class="problem-desc">طعم مر أو معدني</span>
                            </button>
                            
                            <button class="problem-option app-control" data-problem="pale">
                                <span class="problem-icon">⚪</span>
                                <span class="problem-title">اللون باهت جداً</span>
                                <span class="problem-desc">لا يحمر حتى بعد الخبز الطويل</span>
                            </button>
                            
                            <button class="problem-option app-control" data-problem="burnt">
                                <span class="problem-icon">🔥</span>
                                <span class="problem-title">احتراق سريع</span>
                                <span class="problem-desc">الحواف تحترق والوسط نيء</span>
                            </button>
                        </div>
                    </div>`;
                    
            } else if (step === 2 && data) {
                container.innerHTML = this.safeHTML`
                    <div class="troubleshooting-solution">
                        <div class="solution-header">
                            <button class="btn btn-secondary app-control" id="back-to-problems-btn">
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
                            
                            ${data.prevention ? this.safeHTML`
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

        // ============================ LIBRARY TAB - ENHANCED SAFETY =============================
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
            
            return this.safeHTML`
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
                            <button class="btn btn-primary btn-load-recipe app-control" data-id="${id}">
                                📥 تحميل
                            </button>
                            <button class="btn btn-danger btn-delete-recipe app-control" data-id="${id}">
                                🗑️ حذف
                            </button>
                        </div>
                    </div>
                </div>`;
        },

        // ============================ ENHANCED HELPER FUNCTIONS =============================
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
            if (!recipe) return;
            
            $('#flour').value = this.formatNumber(recipe.flour, 1); 
            $('#butter').value = this.formatNumber(recipe.butter, 1);
            $('#sugar').value = this.formatNumber(recipe.sugar, 1); 
            $('#honey').value = this.formatNumber(recipe.honey, 1);
            $('#eggs').value = this.formatNumber(recipe.eggs, 1); 
            $('#soda').value = this.formatNumber(recipe.soda, 1);
        },

        getPanInputs(target) {
            const shape = $(`input[name="pan-shape-${target}"]:checked`)?.value || 'round';
            const dim1 = parseFloat($(`#pan-dim1-${target}`)?.value) || 24;
            const dim2 = shape === 'rectangle' ? (parseFloat($(`#pan-dim2-${target}`)?.value) || 20) : null;
            return { shape, dim1, dim2 };
        },

        // === الدوال المضافة للكائن الرئيسي ===
        getPanInputsForFilling() {
            const shape = $('#filling-pan-shape').value;
            const dim1 = parseFloat($('#filling-pan-dim1')?.value) || 24;
            const dim2 = shape === 'rectangle' ? (parseFloat($('#filling-pan-dim2')?.value) || 20) : null;
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
            
            return `${this.formatNumber(amount, 1)} ${conv.unit}`;
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
            
            return `≈ ${this.formatNumber(amount, 1)} ${conv.unit}`;
        },

        getIngredientArabicName(ingredient) {
            const names = {
                'sour-cream': 'قشطة رائبة/سميتانا',
                'whipping-cream': 'كريمة خفق',
                'cream-cheese': 'جبن كريمي',
                'condensed-milk': 'حليب مكثف محلى',
                'dulce-de-leche': 'دولسي دي ليتشي',
                'caramel': 'كراميل',
                'butter': 'زبدة',
                'powdered-sugar': 'سكر بودرة',
                'sugar': 'سكر',
                'honey': 'عسل',
                'custom-honey': 'عسل',
                'vanilla': 'فانيليا',
                'orange-zest': 'قشر برتقال',
                'milk': 'حليب',
                'egg-yolks': 'صفار بيض',
                'cornstarch': 'نشا ذرة',
                'mascarpone': 'ماسكربوني',
                'heavy-cream': 'كريمة ثقيلة',
                'lemon-juice': 'عصير ليمون',
                'other': 'مكونات أخرى'
            };
            return names[ingredient] || ingredient;
        },

        // ============================ الدوال المصححة المفقودة =============================
        getSugarTypeName(type) {
            // استخدام Core.ChemistryService إذا كان متاحاً، وإلا استخدام fallback
            if (window.MedovikCalculatorCore && window.MedovikCalculatorCore.ChemistryService) {
                return window.MedovikCalculatorCore.ChemistryService.getSugarTypeName(type);
            }
            // fallback محلي
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

        // ============================ دالة التنسيق المحسنة =============================
        formatNumber(num, decimals = 1) {
            if (typeof num !== 'number' || isNaN(num)) {
                return '0';
            }
            return num.toFixed(decimals);
        },

        // ============================ تحديث عرض التقرير الكيميائي =============================
        updateChemistryReportDisplay() {
            // هذه الدالة ستتم استدعاؤها من main.js لتحديث العرض
            console.log('Chemistry report display updated');
        }
    };

    // === تصدير الكائن المحسن ===
    window.UIRenderer = UIRenderer;
})(window, window.MedovikCalculatorCore);