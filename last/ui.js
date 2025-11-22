// UI.JS — Presenter & Generator (Arabic UI)
// v3.1.0 — Arabic-first Presentation; No business logic; Supports technique rendering and translated metrics.

(function(window, Core) {
  'use strict';

  // -------------------- Config & Intl --------------------
  const UIRenderer = {
    NUMBER_LOCALE: 'ar-EG',
    get nf() {
      try {
        return new Intl.NumberFormat(this.NUMBER_LOCALE);
      } catch {
        return new Intl.NumberFormat('ar-EG');
      }
    },
    setLocale(locale) {
      if (typeof locale === 'string' && locale.trim()) {
        this.NUMBER_LOCALE = locale;
      }
    }
  };

  // -------------------- Safe Template Helpers --------------------
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
    return str.replace(/[&<>"'/]/g, s => map[s]);
  }

  function safeHTML(strings, ...values) {
    let out = '';
    for (let i = 0; i < strings.length; i++) {
      out += strings[i];
      if (i < values.length) out += String(values[i]);
    }
    return out;
  }

  function isSafeHTML(html) {
    if (!html || typeof html !== 'string') return false;
    const dangerous = [
      /<script[\s\/>]/i, /javascript:/i, /data:text\/html/i, /on\w+\s*=/i,
      /<iframe[\s\/>]/i, /<object[\s\/>]/i, /<embed[\s\/>]/i, /<applet[\s\/>]/i,
      /<form[\s\/>]/i, /<input[\s\/>]/i, /<link[\s\/>]/i, /<meta[\s\/>]/i, /<base[\s\/>]/i,
      /eval\s*\(/i, /document\s*\./i, /window\s*[\.\[]/i, /alert\s*\(/i, /prompt\s*\(/i, /confirm\s*\(/i,
      /import\s+/i, /require\s*\(/i, /expression\s*\(/i, /-moz-binding/i, /<svg[\s>]/i, /<foreignobject/i
    ];
    for (const re of dangerous) if (re.test(html)) return false;
    const hasValidTags = /<(div|span|p|ul|ol|li|h[1-6]|strong|em|small|br|table|thead|tbody|tr|td|th)/i.test(html);
    return hasValidTags || !/<[^>]+>/.test(html);
  }

  // -------------------- DOM utils --------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  function removeOld(root, selector) { const old = root?.querySelector?.(selector); if (old) old.remove(); }

  // -------------------- Number helpers --------------------
  function fmtInt(n) {
    if (!Number.isFinite(n)) return '—';
    try { return UIRenderer.nf.format(Math.round(n)); } catch { return String(Math.round(n)); }
  }
  function fmtFixed(n, d = 1) {
    if (!Number.isFinite(n)) return '—';
    const v = Number(n.toFixed(d));
    try { return UIRenderer.nf.format(v); } catch { return String(v); }
  }

  // -------------------- Knowledge helpers --------------------
  function getIngredientDisplayName(slug) {
    const kb = window.FILLING_KNOWLEDGE;
    if (kb && kb.ingredients && kb.ingredients[slug]) {
      return kb.ingredients[slug].displayName || slug;
    }
    const arNames = {
      'sour-cream': 'قشطة حامضة (سميتانا)',
      'whipping-cream': 'كريمة خفق',
      'heavy_cream': 'كريمة ثقيلة',
      'cream-cheese': 'جبن كريمي',
      'mascarpone': 'ماسكربوني',
      'quark': 'كوارك',
      'yogurt': 'زبادي',
      'greek-yogurt-2': 'زبادي يوناني 2%',
      'greek-yogurt-5': 'زبادي يوناني 5%',
      'greek-yogurt-7': 'زبادي يوناني 7%',
      'powdered-sugar': 'سكر بودرة',
      'sugar': 'سكر',
      'honey': 'عسل',
      'condensed-milk': 'حليب مكثف محلى',
      'dulce-de-leche': 'دولسي دي ليتشي',
      'caramel': 'كراميل',
      'jam': 'مربى',
      'fruit-puree': 'هريس فواكه',
      'butter': 'زبدة',
      'chocolate-dark': 'شوكولاتة داكنة',
      'chocolate-milk': 'شوكولاتة بالحليب',
      'cocoa_powder': 'كاكاو',
      'cocoa': 'كاكاو',
      'gelatin': 'جيلاتين',
      'pectin': 'بكتين',
      'cornstarch': 'نشا ذرة',
      'vanilla': 'فانيليا',
      'lemon-juice': 'عصير ليمون',
      'salt': 'ملح',
      // Dough basics (used in scaling tables)
      'flour':'دقيق','eggs':'بيض','soda':'صودا الخبز'
    };
    return arNames[slug] || slug;
  }

  function getIngredientType(slug) {
    const kb = window.FILLING_KNOWLEDGE;
    if (kb?.ingredients?.[slug]?.type) return kb.ingredients[slug].type;
    // heuristic fallback
    if (/cream|cheese|yogurt|sour|mascarpone|quark/.test(slug)) return 'dairy';
    if (/sugar|honey|dulce|caramel|condensed|jam|puree/.test(slug)) return 'sweetener';
    if (/butter|chocolate/.test(slug)) return 'fat';
    if (/gelatin|pectin|starch/.test(slug)) return 'hydrocolloid';
    if (/lemon|acid/.test(slug)) return 'acid';
    if (/vanilla|salt/.test(slug)) return 'flavor';
    if (/cocoa/.test(slug)) return 'dry';
    return 'misc';
  }

  // -------------------- Dynamic Protocol Engine --------------------
  /**
   * generateDynamicProtocol(ingredients, knowledge=FILLING_KNOWLEDGE)
   * @param {Object|string[]} ingredients - either {slug: grams} or array of ingredient slugs
   * @param {Object} knowledge - window.FILLING_KNOWLEDGE structure
   * @returns {{ steps:Array, warnings:Array, html:string }}
   */
  function generateDynamicProtocol(ingredients, knowledge = window.FILLING_KNOWLEDGE) {
    const result = { steps: [], warnings: [], html: '' };
    try {
      if (!knowledge || !knowledge.rules || !Array.isArray(knowledge.rules)) {
        return { steps: [], warnings: ['NO_KNOWLEDGE_RULES'], html: '' };
      }

      const ingSet = normalizeIngredientsSet(ingredients);
      const bySlug = normalizeIngredientsMap(ingredients);

      const context = {
        has: (slug) => ingSet.has(slug),
        hasAny: (list) => Array.isArray(list) && list.some(s => ingSet.has(s)),
        hasType: (type) => {
          for (const s of ingSet) if (getIngredientType(s) === type) return true;
          return false;
        }
      };

      // Sort rules by priority (desc)
      const rules = [...knowledge.rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      const applied = [];
      const allWarnings = [];

      for (const rule of rules) {
        if (ruleMatches(rule.if, context)) {
          if (Array.isArray(rule.then)) {
            for (const step of rule.then) applied.push(sanitizeStep(step));
          }
          if (Array.isArray(rule.warnings)) {
            for (const w of rule.warnings) allWarnings.push(String(w));
          }
        }
      }

      const steps = coalesceSteps(applied);
      const html = renderProtocolHTML(steps, bySlug);
      result.steps = steps;
      result.warnings = allWarnings;
      result.html = html;
      return result;

    } catch (e) {
      return { steps: [], warnings: ['ENGINE_ERROR'], html: '' };
    }

    // Helpers
    function normalizeIngredientsSet(input) {
      const set = new Set();
      if (!input) return set;
      if (Array.isArray(input)) {
        input.forEach(s => { if (typeof s === 'string') set.add(s); });
      } else if (typeof input === 'object') {
        for (const k of Object.keys(input)) if ((input[k] || 0) > 0) set.add(k);
      }
      return set;
    }
    function normalizeIngredientsMap(input) {
      const map = {};
      if (!input) return map;
      if (Array.isArray(input)) {
        input.forEach(s => { if (typeof s === 'string') map[s] = map[s] ? map[s] : 1; });
      } else if (typeof input === 'object') {
        for (const [k, v] of Object.entries(input)) {
          const n = Number(v) || 0;
          if (n > 0) map[k] = n;
        }
      }
      return map;
    }
    function ruleMatches(cond, ctx) {
      if (!cond) return false;
      function evalNode(node) {
        if (node.has && Array.isArray(node.has)) return node.has.every(sl => ctx.has(sl));
        if (node.hasType && Array.isArray(node.hasType)) return node.hasType.every(tp => ctx.hasType(tp));
        if (node.any && Array.isArray(node.any)) return node.any.some(ch => evalNode(ch));
        if (node.all && Array.isArray(node.all)) return node.all.every(ch => evalNode(ch));
        return false;
      }
      return evalNode(cond);
    }
    function sanitizeStep(s) {
      const out = {};
      if (s.step) out.step = String(s.step);
      if (s.name) out.name = String(s.name);
      if (s.time) out.time = String(s.time);
      if (s.temp) out.temp = String(s.temp);
      if (s.speed) out.speed = String(s.speed);
      if (s.tools) out.tools = Array.isArray(s.tools) ? s.tools.map(t => String(t)) : undefined;
      if (s.notes) out.notes = String(s.notes);
      if (s.technique) out.technique = s.technique;
      return out;
    }
    function coalesceSteps(steps) {
      const seen = new Set();
      const ordered = [];
      const orderHint = [
        'pre_chill','soften','drain_if_runny','sift_dry','warm_gently',
        'bloom_gelatin','melt_gelatin','temper_gelatin',
        'whip_cream','cream_butter','add_powdered_sugar','mix_cold','gentle_mix',
        'stream_into_butter','add_acid_last','fold','emulsify',
        // Custard/Chocolate extended
        'prep','heat_milk','temper_eggs','cook','cook_to_target','strain_immediately','ice_bath','contact_wrap','cool_to_working_temp',
        'rest','chill'
      ];
      const weight = (st) => {
        const idx = orderHint.indexOf(st.step || '');
        return idx >= 0 ? idx : orderHint.length + 1;
      };
      steps.sort((a,b) => weight(a) - weight(b));
      for (const s of steps) {
        const key = `${s.step}|${s.name}|${s.temp||''}|${s.time||''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        ordered.push(s);
      }
      return ordered;
    }
    function renderProtocolHTML(steps, ingMap) {
      const container = document.createElement('div');
      container.className = 'protocol-dynamic';

      const header = document.createElement('h3');
      header.textContent = '📋 بروتوكول التحضير (ديناميكي)';
      container.appendChild(header);

      const ingList = document.createElement('div');
      ingList.className = 'protocol-ingredients';
      ingList.innerHTML = `<h4>المكونات:</h4>`;
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(180px,1fr))';
      grid.style.gap = '8px';
      for (const [slug, grams] of Object.entries(ingMap)) {
        const card = document.createElement('div');
        card.className = 'ing-card';
        card.style.background = 'var(--bg-secondary, #fafafa)';
        card.style.border = '1px solid var(--border-color, #ddd)';
        card.style.borderRadius = '6px';
        card.style.padding = '8px 10px';
        card.innerHTML = `<strong>${escapeHTML(getIngredientDisplayName(slug))}</strong> — ${fmtInt(grams)} جم`;
        grid.appendChild(card);
      }
      ingList.appendChild(grid);
      container.appendChild(ingList);

      if (steps.length > 0) {
        const list = document.createElement('ol');
        list.className = 'protocol-steps';
        for (const st of steps) {
          const li = document.createElement('li');
          li.style.margin = '15px 0';
          li.style.padding = '12px';
          li.style.background = '#fafafa';
          li.style.borderRadius = '8px';
          li.style.border = '1px solid #e0e0e0';
          
          const line1 = `<div style="font-weight:600; font-size:1.1em; margin-bottom:8px;">${escapeHTML(st.name || st.step || 'خطوة')}</div>`;
          
          const meta = [];
          if (st.time) meta.push(`⏱️ ${escapeHTML(st.time)}`);
          if (st.temp) meta.push(`🌡️ ${escapeHTML(st.temp)}`);
          if (st.speed) meta.push(`⚡ ${escapeHTML(st.speed)}`);
          
          const line2 = meta.length ? `<div style="margin-bottom:8px;">${meta.join(' • ')}</div>` : '';
          const line3 = st.tools?.length ? `<div style="margin-bottom:8px;">🛠️ <strong>الأدوات:</strong> ${escapeHTML(st.tools.join(', '))}</div>` : '';
          
          const line4 = st.technique ? renderTechniqueObject(st.technique) : '';
          const line5 = st.notes ? `<div class="notes" style="margin-top:8px; padding:8px; background:#FFFDE7; border-radius:4px; border-left:3px solid #FFD54F;">
            <strong>💡 ملاحظات:</strong> ${escapeHTML(st.notes)}
          </div>` : '';
          
          li.innerHTML = `${line1}${line2}${line3}${line4}${line5}`;
          list.appendChild(li);
        }
        container.appendChild(list);
      } else {
        const empty = document.createElement('div');
        empty.className = 'alert alert-info';
        empty.textContent = 'لا توجد خطوات متاحة للمكونات المدخلة.';
        container.appendChild(empty);
      }

      return container.outerHTML;
    }
  }

  // -------------------- Cards: η@T, Optimizer (Plan A/B), WorkTarget, Caramelization --------------------
  function renderViscosityAtTCard(etaValue, T) {
    const container = $('#analysis-results-wrapper');
    if (!container) return;
    removeOld(container, '.visc-at-t-card');
    const box = document.createElement('div');
    box.className = 'result-box visc-at-t-card';
    box.innerHTML = safeHTML`
      <h4>🧪 اللزوجة عند الحرارة الحالية</h4>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><label>الحرارة:</label> <value><strong>${fmtFixed(T,1)}°C</strong></value></div>
        <div><label>الزوجة:</label> <value><strong>${fmtInt(etaValue)} cP</strong></value></div>
      </div>
    `;
    container.appendChild(box);
  }

  function renderViscosityAtTCardEnhanced(etaValue, T) {
    const container = $('#analysis-results-wrapper');
    if (!container) return;
    removeOld(container, '.visc-at-t-card');
    
    const getViscosityDesc = (eta) => {
      if (eta < 100) return { text: 'سائل كالماء', icon: '💧', example: 'ماء' };
      if (eta < 1000) return { text: 'سائل خفيف', icon: '🥛', example: 'حليب' };
      if (eta < 5000) return { text: 'سائل ثقيل', icon: '🍯', example: 'زيت زيتون' };
      if (eta < 10000) return { text: 'كريمي', icon: '🥄', example: 'زبادي' };
      if (eta < 20000) return { text: 'عجين طري', icon: '🍪', example: 'عجين الكوكيز' };
      if (eta < 50000) return { text: 'عجين متماسك', icon: '🥖', example: 'عجين الخبز' };
      return { text: 'صلب جداً', icon: '🗿', example: 'معجون' };
    };

    const desc = getViscosityDesc(etaValue);

    const box = document.createElement('div');
    box.className = 'result-box visc-at-t-card';
    box.innerHTML = `
      <h4>🧪 قوام العجين عند ${fmtFixed(T,1)}°C</h4>
      
      <div style="display:flex;align-items:center;gap:20px;margin:12px 0;">
        <div style="font-size:3em;">${desc.icon}</div>
        <div>
          <div style="font-size:1.8em;font-weight:bold;color:#333;">
            ${desc.text}
          </div>
          <div style="color:#666;margin:4px 0;">
            مثل: ${desc.example}
          </div>
          <div style="font-size:0.9em;color:#999;">
            القيمة العلمية: ${fmtInt(etaValue)} سنتيبواز
          </div>
        </div>
      </div>

      <details style="margin-top:12px;">
        <summary style="cursor:pointer;color:#1976d2;font-weight:600;">
          ما هو السنتيبواز (cP)؟ اضغط للتوضيح
        </summary>
        <div style="background:#f5f5f5;padding:12px;border-radius:4px;margin-top:8px;">
          <p><strong>السنتيبواز (cP)</strong> = وحدة قياس "مقاومة السائل للحركة" (اللزوجة)</p>
          
          <table style="width:100%;margin:8px 0;font-size:0.9em;">
            <tr style="background:#e0e0e0;">
              <th style="padding:4px;">المادة</th>
              <th style="padding:4px;">اللزوجة (cP)</th>
              <th style="padding:4px;">الوصف</th>
            </tr>
            <tr><td>الماء</td><td>1</td><td>يسيل فوراً</td></tr>
            <tr><td>الحليب</td><td>3</td><td>سائل خفيف</td></tr>
            <tr><td>زيت الزيتون</td><td>80</td><td>سائل ثقيل</td></tr>
            <tr><td>العسل</td><td>10,000</td><td>لزج جداً</td></tr>
            <tr><td>زبدة الفول السوداني</td><td>250,000</td><td>شبه صلب</td></tr>
          </table>
          
          <p style="margin:8px 0 0 0;">
            <strong>للعجين المثالي:</strong> 12,000-20,000 cP عند درجة العمل
          </p>
        </div>
      </details>
    `;
    container.appendChild(box);
  }

  function renderOptimizerCard(optimizerResult) {
    const container = $('#analysis-results-wrapper');
    if (!container || !optimizerResult) return;
    removeOld(container, '.optimizer-card');

    const { planA, planB, flags } = optimizerResult;
    const inRange = planA?.band === 'optimal';
    const badgeColor = inRange ? '#4CAF50' : '#F44336';
    const badgeText = inRange ? 'داخل النطاق' : 'خارج النطاق';

    const wrap = document.createElement('div');
    wrap.className = 'result-box optimizer-card';
    wrap.innerHTML = safeHTML`
      <h4>🎯 هدف العمل — المُحسّن</h4>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span class="badge" style="background:${badgeColor}20;border:1px solid ${badgeColor};color:${badgeColor};padding:4px 10px;border-radius:12px;">
          ${badgeText}
        </span>
        ${flags?.overrideApplied ? `<span class="badge" style="background:#2196F320;border:1px solid #2196F3;color:#2196F3;padding:4px 10px;border-radius:12px;">تجاوز تشغيلي</span>` : ''}
        ${flags?.caramelization ? `<span class="badge" style="background:#79554820;border:1px solid #795548;color:#795548;padding:4px 10px;border-radius:12px;">🍯 كراملة مفعّلة</span>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;">
        <div class="plan-card" style="border:1px solid var(--border-color,#ddd);padding:10px;border-radius:8px;background:#FAFAFA;">
          <h5>الخطة A — حرارة فقط</h5>
          <div>الحرارة المثلى: <strong>${fmtFixed(planA?.T_opt,1)}°C</strong></div>
          <div>η@T_opt: <strong>${fmtInt(planA?.eta_opt)} cP</strong> (<small>${escapeHTML(planA?.band || '—')}</small>)</div>
          <ul style="margin:8px 0 0 18px;">
            ${(planA?.actions || []).map(a => `<li>${escapeHTML(a)}</li>`).join('')}
          </ul>
        </div>

        <div class="plan-card" style="border:1px solid var(--border-color,#ddd);padding:10px;border-radius:8px;background:#F7F7FF;">
          <h5>الخطة B — حرارة + تصحيح</h5>
          ${planB
            ? safeHTML`
              ${planB.deltaFlour ? `<div>تصحيح دقيق: <strong>+${fmtInt(planB.deltaFlour)} جم</strong></div>` : ''}
              ${planB.deltaLiquid ? `<div>تصحيح سوائل: <strong>+${fmtInt(planB.deltaLiquid)} مل</strong></div>` : ''}
              ${planB.T_opt ? `<div>الحرارة المقترحة: <strong>${fmtFixed(planB.T_opt,1)}°C</strong></div>` : ''}
              <ul style="margin:8px 0 0 18px;">
                ${(planB.actions || []).map(a => `<li>${escapeHTML(a)}</li>`).join('')}
              </ul>
            ` : `<div class="muted">لا حاجة لتصحيح إضافي</div>`}
        </div>
      </div>
    `;
    container.appendChild(wrap);
  }

  function renderWorkTargetCardCompat(data) {
    const container = $('#analysis-results-wrapper');
    if (!container || !data) return;
    removeOld(container, '.work-target-card');
    const box = document.createElement('div');
    box.className = 'result-box work-target-card';
    box.innerHTML = safeHTML`
      <h4>🎯 نقطة عمل الفرد (نافذة مرجعية)</h4>
      <div style="display:flex;gap:20px;flex-wrap:wrap;">
        <div><label>T_work:</label> <value><strong>${fmtFixed(data.T_work,1)}°C</strong></value></div>
        <div><label>η_work:</label> <value><strong>${fmtInt(data.eta_work)} cP</strong></value></div>
        ${data.targetRange ? `<div><label>النطاق المستهدف:</label> <value>${fmtInt(data.targetRange.min)}–${fmtInt(data.targetRange.max)} cP</value></div>` : ''}
      </div>
    `;
    container.appendChild(box);
  }

  function renderCaramelizationBadge(enabled, opts) {
    const container = $('#analysis-results-wrapper');
    if (!container) return;
    removeOld(container, '.caramelization-badge');
    if (!enabled) return;
    
    const div = document.createElement('div');
    div.className = 'caramelization-badge';
    div.style.cssText = 'margin:8px 0;padding:12px;border-radius:8px;background:#FFF8E1;border-left:4px solid #FFC107;';
    div.innerHTML = safeHTML`
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-weight:600; margin-bottom:6px;">
            🍯 وضع الكرملة مُفعّل — T_pre=${fmtInt(opts?.T_pre)}°C • t_pre=${escapeHTML(String(opts?.t_pre ?? '—'))} دقيقة • تبخّر ~${fmtInt((opts?.evap||0)*100)}%
          </div>
          
          <details style="margin-top:8px;">
            <summary style="cursor:pointer; color:#1976d2; font-weight:500; font-size:0.95em;">
              📖 اضغط لمعرفة فوائد الكرملة والعلم وراءها
            </summary>
            <div style="margin-top:8px; padding:12px; background:#FFFDE7; border-radius:6px; border:1px solid #FFF9C4;">
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:12px;">
                
                <div style="padding:8px;">
                  <h5 style="margin:0 0 6px 0; color:#FF8F00;">🎨 تحسين اللون والنكهة</h5>
                  <ul style="margin:0; padding-left:16px; font-size:0.9em;">
                    <li>تفاعل ميلارد: بروتينات + سكريات → نكهة عميقة</li>
                    <li>كاراميلization: تكسير السكريات → لون كهرماني</li>
                    <li>تقليل حلاوة العسل المباشرة → نكهة معقدة</li>
                  </ul>
                </div>
                
                <div style="padding:8px;">
                  <h5 style="margin:0 0 6px 0; color:#FF8F00;">🧪 تحسين القوام والرطوبة</h5>
                  <ul style="margin:0; padding-left:16px; font-size:0.9em;">
                    <li>تبخير الماء الزائد → عجين أقل لزوجة</li>
                    <li>تركيز النكهات → شدة طعم أعلى</li>
                    <li>تحسين مدة الصلاحية → تقليل النشاط المائي</li>
                  </ul>
                </div>
                
                <div style="padding:8px;">
                  <h5 style="margin:0 0 6px 0; color:#FF8F00;">⚗️ العلم وراء الأرقام</h5>
                  <ul style="margin:0; padding-left:16px; font-size:0.9em;">
                    <li>108°C: درجة مثالية لتكوين النكهة دون احتراق</li>
                    <li>2 دقيقة: وقت كافٍ للتفاعلات الكيميائية</li>
                    <li>8% تبخير: توازن بين الفقدان والتركيز</li>
                  </ul>
                </div>
                
              </div>
              
              <div style="margin-top:10px; padding:8px; background:#E8F5E8; border-radius:4px; border-left:3px solid #4CAF50;">
                <strong>💡 نصائح عملية:</strong>
                <div style="font-size:0.9em; margin-top:4px;">
                  • استخدم مقياس حرارة للحصول على نتائج متسقة<br>
                  • حرك باستمرار لمنع التكتل والاحتراق<br>
                  • توقف عندما يصبح الخليط كهرمانياً وله رائحة عسل محمص
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    `;
    container.appendChild(div);
  }

  // -------------------- Translated Chemistry Strip (User-friendly) --------------------
  function renderChemistryStrip(doughChemistry, sodaInfo) {
    const container = $('#analysis-results-wrapper');
    if (!container || !doughChemistry) return;
    removeOld(container, '.chemistry-strip');

    const ch = document.createElement('div');
    ch.className = 'chemistry-strip result-box';
    ch.style.cssText = 'margin:12px 0;padding:0;border-radius:8px;border:1px solid #e0e0e0;background:#fafafa;overflow:hidden;';
    
    const brix = doughChemistry.brix?.value;
    const ph = doughChemistry.ph?.value;
    const aw = doughChemistry.baking?.waterActivity ?? doughChemistry.waterActivity?.value;
    const hydration = doughChemistry.hydration ?? null;
    const visc = doughChemistry.viscosity?.value;
    const temp = doughChemistry.temperature || 25;

    let metricsHTML = '';

    // Hydration
    if (Number.isFinite(hydration)) {
      let icon = '', label = '', desc = '', color = '';
      if (hydration < 18) { icon='🏜️'; label='جاف جداً'; desc='العجين قد يتشقق عند الفرد'; color='#F57C00'; }
      else if (hydration < 22) { icon='🌾'; label='جاف قليلاً'; desc='يحتاج ضغط للفرد'; color='#FFA726'; }
      else if (hydration < 28) { icon='✅'; label='مثالي'; desc='سهل الفرد والتشكيل'; color='#4CAF50'; }
      else if (hydration < 33) { icon='💧'; label='طري'; desc='يلتصق قليلاً، يحتاج دقيق خفيف'; color='#2196F3'; }
      else { icon='🌊'; label='رطب جداً'; desc='شبه سائل، يحتاج تبريد طويل'; color='#FF5722'; }
      metricsHTML += `
        <div class="metric-card" style="border-right:4px solid ${color};">
          <div class="metric-icon">${icon}</div>
          <div class="metric-content">
            <div class="metric-label">نسبة السوائل في العجين</div>
            <div class="metric-value">${fmtFixed(hydration,1)}%</div>
            <div class="metric-status" style="color:${color};">${label}</div>
            <div class="metric-desc">${desc}</div>
            <details class="metric-technical">
              <summary>التفاصيل التقنية</summary>
              <small>Hydration: نسبة الماء (من البيض + العسل + الزبدة) إلى الدقيق. المدى المثالي للميدوفيك: 22-28%.</small>
            </details>
          </div>
        </div>
      `;
    }

    // Viscosity
    if (Number.isFinite(visc)) {
      let icon = '', label = '', desc = '', color = '';
      if (visc < 7000) { icon='💧'; label='سائل جداً'; desc='يسيل من الملعقة كالعسل'; color='#2196F3'; }
      else if (visc < 12000) { icon='🍯'; label='لزج'; desc='يلتصق بالأصابع ويتمطط'; color='#FFC107'; }
      else if (visc <= 20000) { icon='✅'; label='مثالي'; desc='مثل العجين الطري، سهل التشكيل'; color='#4CAF50'; }
      else if (visc <= 30000) { icon='🥖'; label='قاسٍ'; desc='يحتاج ضغط قوي للفرد'; color='#FF9800'; }
      else { icon='🪨'; label='صلب'; desc='صعب جداً، كالعجين الجاف'; color='#F44336'; }
      metricsHTML += `
        <div class="metric-card" style="border-right:4px solid ${color};">
          <div class="metric-icon">${icon}</div>
          <div class="metric-content">
            <div class="metric-label">قوام العجين عند ${fmtFixed(temp,1)}°C</div>
            <div class="metric-value">${label}</div>
            <div class="metric-status" style="color:${color};">${desc}</div>
            <details class="metric-technical">
              <summary>التفاصيل التقنية</summary>
              <small>اللزوجة (Viscosity): ${fmtInt(visc)} cP. المدى المثالي: 12,000-20,000 cP.</small>
            </details>
          </div>
        </div>
      `;
    }

    // Brix (as % sweet)
    if (Number.isFinite(brix)) {
      let icon = '', label = '', color = '';
      if (brix < 22) { icon='🍋'; label='حلاوة خفيفة'; color='#FFF59D'; }
      else if (brix < 30) { icon='🍯'; label='حلاوة متوازنة'; color='#FFD54F'; }
      else if (brix < 38) { icon='🍬'; label='حلاوة عالية'; color='#FFA726'; }
      else { icon='🍭'; label='حلاوة مركزة جداً'; color='#FF6F00'; }
      metricsHTML += `
        <div class="metric-card" style="border-right:4px solid ${color};">
          <div class="metric-icon">${icon}</div>
          <div class="metric-content">
            <div class="metric-label">مستوى الحلاوة الكلي</div>
            <div class="metric-value">${fmtFixed(brix,1)}°</div>
            <div class="metric-status" style="color:${color};">${label}</div>
            <details class="metric-technical">
              <summary>التفاصيل التقنية</summary>
              <small>°Brix: تقدير لنسبة السكريات. للميدوفيك الكلاسيكي: 25-32°.</small>
            </details>
          </div>
        </div>
      `;
    }

    // Water Activity
    if (Number.isFinite(aw)) {
      let icon = '', label = '', shelf = '', color = '';
      if (aw < 0.85) { icon='📦'; label='صلاحية طويلة'; shelf='5-7 أيام في حرارة الغرفة'; color='#4CAF50'; }
      else if (aw < 0.92) { icon='❄️'; label='صلاحية متوسطة'; shelf='3-4 أيام في الثلاجة'; color='#2196F3'; }
      else if (aw < 0.96) { icon='⚠️'; label='صلاحية قصيرة'; shelf='1-2 يوم في الثلاجة'; color='#FF9800'; }
      else { icon='🔴'; label='استهلاك فوري'; shelf='24 ساعة كحد أقصى'; color='#F44336'; }
      metricsHTML += `
        <div class="metric-card" style="border-right:4px solid ${color};">
          <div class="metric-icon">${icon}</div>
          <div class="metric-content">
            <div class="metric-label">مدة الصلاحية المتوقعة</div>
            <div class="metric-value">${shelf}</div>
            <div class="metric-status" style="color:${color};">${label}</div>
            <details class="metric-technical">
              <summary>التفاصيل التقنية</summary>
              <small>Water Activity (aw): ${fmtFixed(aw,3)}. أقل من 0.85 = آمن. أعلى من 0.95 = خطر.</small>
            </details>
          </div>
        </div>
      `;
    }

    // Soda ratio
    if (sodaInfo) {
      let icon = '', label = '', color = '';
      const ratio = sodaInfo.ratioPct;
      if (ratio < 0.7) { icon='⚠️'; label='منخفضة (انتفاش ضعيف)'; color='#FF9800'; }
      else if (ratio <= 1.0) { icon='✅'; label='مثالية'; color='#4CAF50'; }
      else if (ratio <= 1.2) { icon='⚠️'; label='مرتفعة قليلاً'; color='#FFC107'; }
      else { icon='🔴'; label='مرتفعة جداً (طعم صابوني)'; color='#F44336'; }
      metricsHTML += `
        <div class="metric-card" style="border-right:4px solid ${color};">
          <div class="metric-icon">${icon}</div>
          <div class="metric-content">
            <div class="metric-label">نسبة صودا الخبز</div>
            <div class="metric-value">${fmtFixed(ratio,2)}%</div>
            <div class="metric-status" style="color:${color};">${label}</div>
            <div class="metric-desc">المدى المثالي: 0.8-1.0%</div>
            <details class="metric-technical">
              <summary>التفاصيل التقنية</summary>
              <small>نسبة الصودا إلى الدقيق. أقل من 0.8% = انتفاش ضعيف. أكثر من 1.2% = طعم صابوني بعد يوم.</small>
            </details>
          </div>
        </div>
      `;
    }

    ch.innerHTML = `
      <div style="padding:16px;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;">
        <h4 style="margin:0;font-size:1.1em;font-weight:600;">📊 التحليل الكيميائي المُبسّط</h4>
        <p style="margin:4px 0 0 0;font-size:0.85em;opacity:0.9;">نتائج واضحة بدون مصطلحات معقدة</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1px;background:#e0e0e0;">
        ${metricsHTML}
      </div>
    `;
    
    container.appendChild(ch);
  }

  // -------------------- Analysis Results, Decision Strip, Kitchen Dashboard --------------------
  function renderAnalysisResults(analysis, prediction, doughChemistry = null) {
    const container = $('#analysis-results-wrapper');
    if (!container) return;

    if (!analysis || analysis.error) {
      container.innerHTML = `<div class="alert alert-info">أدخل المقادير واضغط "تحليل" لعرض النتائج.</div>`;
      return;
    }

    const { totalWeight, hydration, percentages, checks } = analysis;
    const score = analysis.qualityScore ?? 100;
    const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-medium' : 'score-low';

    container.innerHTML = `
      <div class="result-box">
        <h3>📊 ملخّص التحليل</h3>
        <div class="quality-assessment">
          <div class="score-display ${scoreClass}">
            <span class="score-value">${fmtInt(score)}</span><span class="score-max">/100</span>
          </div>
        </div>
        <div class="analysis-info" style="display:flex;gap:16px;flex-wrap:wrap;margin:8px 0;">
          <div>الوزن الإجمالي: <strong>${fmtInt(totalWeight)} جم</strong></div>
          <div>Hydration: <strong>${fmtFixed(hydration,1)}%</strong></div>
        </div>
        <table class="analysis-table">
          <thead><tr><th>المكون</th><th>النسبة %</th><th>الحالة</th></tr></thead>
          <tbody>
            ${renderRow('الدقيق','flour')}
            ${renderRow('الزبدة','butter')}
            ${renderRow('السكريات','sugars')}
            ${renderRow('البيض','eggs')}
            ${renderRow('صودا الخبز','soda')}
          </tbody>
        </table>
      </div>
    `;

    function renderRow(label, key) {
      const val = percentages[key] ?? 0;
      const state = checks[key] || 'optimal';
      const badge = state === 'optimal' ? '✅' : (state === 'low' ? '⚠️' : '❌');
      const cls = state === 'optimal' ? 'score-high' : (state === 'low' ? 'score-medium' : 'score-low');
      return `<tr><td>${label}</td><td>${fmtFixed(val,1)}%</td><td><span class="${cls}">${badge}</span></td></tr>`;
    }

    if (doughChemistry) {
      renderChemistryStrip(doughChemistry, null);
    }
  }

  function renderDecisionStrip(decision) {
    const container = $('#analysis-results-wrapper');
    if (!container || !decision) return;

    removeOld(container, '.decision-strip');
    const strip = document.createElement('div');
    strip.className = 'decision-strip';
    
    const severity = decision.severity || 'low';
    let color, emoji, bgColor, borderColor;
    
    if (severity === 'critical') {
      color = '#D32F2F'; emoji = '🛑'; bgColor = '#FFEBEE'; borderColor = '#EF5350';
    } else if (severity === 'high') {
      color = '#F57C00'; emoji = '⚠️'; bgColor = '#FFF3E0'; borderColor = '#FF9800';
    } else if (severity === 'medium') {
      color = '#1976D2'; emoji = '💡'; bgColor = '#E3F2FD'; borderColor = '#42A5F5';
    } else {
      color = '#388E3C'; emoji = '✅'; bgColor = '#E8F5E9'; borderColor = '#66BB6A';
    }
    
    strip.style.cssText = `
      margin:16px 0;
      padding:0;
      border-radius:8px;
      overflow:hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;

    const explanationHTML = decision.explanation || '';

    strip.innerHTML = `
      <div style="padding:16px;background:${bgColor};border-right:4px solid ${borderColor};">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${explanationHTML ? '0' : '12px'};">
          <span style="font-size:2.5em;line-height:1;">${emoji}</span>
          <div style="flex:1;">
            <div style="font-size:0.75em;color:${color};font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
              حالة العجين
            </div>
            <div style="font-size:1.2em;font-weight:700;color:#333;line-height:1.3;">
              ${decision.message || ''}
            </div>
          </div>
        </div>
        
        ${explanationHTML}
        
        ${Array.isArray(decision.actions) && decision.actions.length
          ? `<div style="margin-top:16px;padding:16px;background:white;border-radius:6px;border:1px solid ${borderColor}40;">
               <div style="font-weight:700;color:#333;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                 <span>📋</span> الخطوات التالية
               </div>
               <ul style="margin:0;padding:0 0 0 20px;color:#555;line-height:1.8;">
                 ${decision.actions.map(a => `<li>${a}</li>`).join('')}
               </ul>
             </div>`
          : ''}
      </div>
    `;
    
    container.prepend(strip);
  }

  function renderKitchenDashboard(decision, analysis) {
    const container = $('#kitchen-dashboard-container');
    if (!container) return;

    if (!decision || !analysis) {
      container.innerHTML = `
        <div class="empty-state-kitchen">
          <h3>👋 مرحباً أيها الشيف</h3>
          <p>ابدأ بإدخال المقادير في "المحلل العلمي" لعرض حالة المطبخ.</p>
        </div>
      `;
      return;
    }

    const visc = decision.details?.viscosity || {};
    const eta = Number.isFinite(visc.eta_opt) ? visc.eta_opt : visc.eta_inputT;
    const T = Number.isFinite(visc.T_opt) ? visc.T_opt : visc.inputT;

    container.innerHTML = safeHTML`
      <div class="kitchen-dash result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h4>لوحة المطبخ</h4>
          <span class="badge" style="background:${statusColor(decision.status)}20;border:1px solid ${statusColor(decision.status)};color:${statusColor(decision.status)};padding:4px 10px;border-radius:12px;">${escapeHTML(decision.status)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">
          <div>Hydration: <strong>${fmtFixed(decision.details?.hydration,1)}%</strong></div>
          <div>η: <strong>${fmtInt(eta)} cP</strong></div>
          <div>T: <strong>${fmtFixed(T,1)}°C</strong></div>
          ${decision.details?.soda ? `<div>صودا/دقيق: <strong>${fmtFixed(decision.details.soda.ratioPct,2)}%</strong></div>` : ''}
        </div>
        <div style="margin-top:8px;">
          <strong>الإجراءات:</strong> ${Array.isArray(decision.actions) ? decision.actions.map(escapeHTML).join(' • ') : ''}
        </div>
      </div>
    `;

    function statusColor(st) {
      return st === 'GO' ? '#4CAF50' : st === 'STOP' ? '#F44336' : '#FFC107';
    }
  }

  // -------------------- Smart Filling Panels: Chemistry, Results, Dynamic Inputs; Compatibility Report --------------------
  function renderFillingChemistryPanel(chemistry) {
    const container = $('#filling-results-container');
    if (!container) return;
    if (!chemistry) { container.innerHTML = ''; return; }

    const brix = chemistry.brix?.value;
    const ph = chemistry.ph?.value;
    const aw = chemistry.waterActivity?.value;
    const visc = chemistry.viscosity?.value;
    const st = chemistry.stability?.score;

    container.innerHTML = safeHTML`
      <div class="result-box">
        <h3>🔬 التحليل الكيميائي للحشوة</h3>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div>°Brix: <strong>${fmtFixed(brix,1)}°</strong></div>
          <div>pH: <strong>${fmtFixed(ph,2)}</strong></div>
          <div>aw: <strong>${fmtFixed(aw,3)}</strong></div>
          <div>اللزوجة: <strong>${fmtInt(visc)} cP</strong></div>
          <div>الثبات: <strong>${fmtInt(st)}/100</strong></div>
        </div>
      </div>
    `;
  }

  function renderFillingResult(result) {
    const container = $('#filling-results-container');
    if (!container) return;
    if (!result || result.error) {
        container.innerHTML = result?.error ? `<div class="alert alert-danger">${escapeHTML(result.error)}</div>` : '';
        return;
    }

    const { requiredWeight, perLayerAmount, scaledRecipe, chemistry } = result;
    
    const brixVal = chemistry?.brix?.value || 0;
    const brixDesc = brixVal < 20 ? 'خفيفة الحلاوة' : brixVal < 35 ? 'حلاوة متوازنة' : 'حلوة جداً';
    
    const phVal = chemistry?.ph?.value || 7;
    const phDesc = phVal < 4.6 ? '✅ آمن (حمضي)' : '⚠️ استهلاك سريع (متعادل)';
    
    const awVal = chemistry?.waterActivity?.value || 0.9;
    const awDesc = awVal < 0.85 ? 'صلاحية عالية' : 'صلاحية متوسطة (ثلاجة)';

    const thicknessStatus = perLayerAmount <= 80 ? 'مثالية 🎯' : 
                           perLayerAmount <= 120 ? 'جيدة 👍' : 
                           'سميكة ⚠️';
    
    const thicknessColor = perLayerAmount <= 80 ? '#4caf50' : 
                          perLayerAmount <= 120 ? '#ff9800' : '#f44336';

    container.innerHTML = safeHTML`
      <div class="result-box filling-out">
        <h3>🍰 نتيجة الحشوة</h3>
        
        <div style="margin-bottom:15px; padding:10px; border-radius:8px; background:#f8f9fa; border-left:4px solid ${thicknessColor};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>سماكة الحشوة:</strong> ${thicknessStatus}
            </div>
            <div style="font-weight:bold; color:${thicknessColor};">
              ${fmtInt(perLayerAmount)} جم/طبقة
            </div>
          </div>
          ${perLayerAmount > 120 ? `
            <div style="margin-top:8px; font-size:0.9em; color:#666;">
              💡 الموصى به: 80-120 جم/طبقة للحصول على أفضل نتيجة
            </div>
          ` : ''}
        </div>

        <div style="display:flex;gap:16px;flex-wrap:wrap; margin-bottom:15px;">
          <div class="metric-badge">📦 الوزن الكلي: <strong>${fmtInt(requiredWeight)} جم</strong></div>
          <div class="metric-badge">🥞 لكل طبقة: <strong>${fmtInt(perLayerAmount)} جم</strong></div>
          <div class="metric-badge">🍯 °Brix: <strong>${fmtFixed(brixVal,1)}°</strong></div>
        </div>

        <h4 style="border-bottom:1px solid #eee; padding-bottom:5px;">المؤشرات الحسية والتقنية:</h4>
        <div class="chem-grid">
            <div class="chem-item">
                <small>الحلاوة</small>
                <strong>${brixDesc}</strong>
                <div style="font-size:0.8em">${fmtFixed(brixVal,1)}°Brix</div>
            </div>
            <div class="chem-item">
                <small>الأمان (pH)</small>
                <strong>${fmtFixed(phVal, 2)}</strong>
                <div style="font-size:0.8em">${phDesc}</div>
            </div>
            <div class="chem-item">
                <small>اللزوجة (القوام)</small>
                <strong>${fmtInt(chemistry?.viscosity?.value)} cP</strong>
            </div>
            <div class="chem-item">
                <small>الثبات</small>
                <strong>${fmtInt(chemistry?.stability?.score)}/100</strong>
            </div>
        </div>

        <h4>📝 المقادير المطلوبة:</h4>
        <div class="ingredients-list-compact">
          ${Object.entries(scaledRecipe).map(([slug, g]) => `
            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #eee; padding:4px 0;">
              <span>${escapeHTML(getIngredientDisplayName(slug))}</span>
              <strong>${fmtInt(g)} جم</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderDynamicFillingInputs(available = []) {
    const container = $('#filling-dynamic-ingredients');
    if (!container) return;
    const list = Array.isArray(available) && available.length ? available : Object.keys(window.FILLING_KNOWLEDGE?.ingredients || {});

    container.innerHTML = `
      <div class="result-box">
        <h4>🧪 مكونات الحشوة (إدخال حر)</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
          ${list.map(slug => `
            <div class="row" data-ingredient-row="${escapeHTML(slug)}">
              <label>${escapeHTML(getIngredientDisplayName(slug))}</label>
              <input type="number" class="dyn-filling-input" data-ingredient="${escapeHTML(slug)}" min="0" step="1" value="0">
              <span>جم</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderCompatibilityReport(report, doughChemistry, fillingChemistry) {
    const container = $('#compatibility-report-container');
    if (!container) return;

    if (!report) {
      container.innerHTML = `
        <div class="alert alert-info">
          <h4>🧪 التقرير الكيميائي الشامل</h4>
          <p>أكمل تحليل العجين والحشوة لعرض التقرير.</p>
        </div>
      `;
      return;
    }

    const color = (r) =>
      r === 'excellent' ? '#4CAF50' :
      r === 'very-good' ? '#8BC34A' :
      r === 'acceptable' ? '#FFC107' :
      r === 'weak' ? '#FF9800' : '#F44336';

    container.innerHTML = safeHTML`
      <div class="compat-report result-box">
        <div style="text-align:center;margin-bottom:10px;">
          <div style="display:inline-flex;width:120px;height:120px;border-radius:50%;align-items:center;justify-content:center;border:4px solid ${color(report.rating)};background:${color(report.rating)}20;">
            <div style="font-size:2rem;color:${color(report.rating)}">${fmtInt(report.score)}</div>
          </div>
          <h4 style="margin-top:8px;color:${color(report.rating)}">${escapeHTML(report.rating)}</h4>
        </div>

        ${(report.issues || []).length ? `
          <div class="alert alert-warning">
            <ul style="margin:0;">
              ${report.issues.map(i => `<li>${escapeHTML(i.code)}</li>`).join('')}
            </ul>
          </div>` : ''}

        ${(report.recommendations || []).length ? `
          <div class="alert alert-info" style="margin-top:8px;">
            <ul style="margin:0;">
              ${report.recommendations.map(r => `<li>${escapeHTML(r.code)}</li>`).join('')}
            </ul>
          </div>` : ''}
      </div>
    `;
  }

  // -------------------- Baking Simulation, Tempering Results, Scaling Result --------------------
  function renderBakingSimulation(result) {
    const container = $('#baking-simulation-results');
    if (!container) return;
    if (!result) { container.innerHTML = ''; return; }

    const bi = result.browningIndex;
    let colorDesc = "باهت جداً";
    let colorHex = "#f5f5dc";
    if (bi > 40) { colorDesc = "ذهبي فاتح"; colorHex = "#f0e68c"; }
    if (bi > 60) { colorDesc = "ذهبي مثالي"; colorHex = "#ffd700"; }
    if (bi > 80) { colorDesc = "بني كراميل"; colorHex = "#cd853f"; }
    if (bi > 95) { colorDesc = "داكن/محروق"; colorHex = "#8b4513"; }

    container.innerHTML = safeHTML`
      <div class="result-box">
        <h4>🔥 محاكاة الخبز (${result.params?.thickness} مم)</h4>
        
        <div class="alert alert-info" style="margin-bottom:15px; font-size:0.9em;">
          <strong>💡 ملاحظة:</strong> هذه محاكاة تقريبية بناءً على نماذج مبسطة. النتائج الفعلية تتأثر بنوع الفرن، الرطوبة، موضع الرف، ودقة الحرارة.
        </div>
        
        <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
            <div style="width:50px; height:50px; border-radius:50%; background:${colorHex}; border:2px solid #ddd; box-shadow:inset 0 0 10px rgba(0,0,0,0.1);"></div>
            <div>
                <div style="font-weight:bold; font-size:1.1em;">${colorDesc}</div>
                <small class="muted">مؤشر اللون: ${fmtInt(bi)}</small>
            </div>
        </div>

        <div class="sensory-cues">
            <strong>👀 علامات النضج:</strong>
            <div class="sensory-cue">1. الأطراف تتحول للون ${colorDesc}.</div>
            <div class="sensory-cue">2. الرائحة: ${bi > 80 ? 'كراميل قوي/محمص' : 'عسل دافئ وفانيليا'}.</div>
            <div class="sensory-cue">3. الملمس: ${result.textureScore > 80 ? 'طري ومرن (Soft)' : 'مقرمش (Crispy)'}.</div>
        </div>

        <div style="margin-top:10px; font-size:0.9em; color:#666;">
            فقد الرطوبة المتوقع: <strong>${fmtFixed(result.moistureLoss, 1)}%</strong>
        </div>

        ${bi > 90 ? `
          <div class="alert alert-warning" style="margin-top:10px;">
            🔥 خطر الاحتراق - اللون داكن جداً. انخفض درجة الحرارة 10-15°C أو قلل وقت الخبز.
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderBakingSchedule(schedule) {
    const container = $('#baking-simulation-results');
    if (!container || !schedule) return;
    const block = document.createElement('div');
    block.className = 'result-box';
    block.innerHTML = safeHTML`
      <h4>⏱️ جدول الخبز المقترح</h4>
      <div><strong>${fmtInt(schedule.temp)}°C × ${fmtInt(schedule.recommended)} دقيقة</strong> (نطاق: ${fmtInt(schedule.range.min)}–${fmtInt(schedule.range.max)})</div>
      <ul style="margin-top:8px;">${schedule.cues.map(c => `<li>${escapeHTML(c)}</li>`).join('')}</ul>
    `;
    container.appendChild(block);
  }

  function renderTemperingResults(result) {
    const container = $('#tempering-results-container');
    if (!container) return;

    if (!result) { container.innerHTML = ''; return; }
    if (result.error) {
      container.innerHTML = `<div class="alert alert-danger"><strong>خطأ:</strong> ${escapeHTML(result.error.code || String(result.error))}</div>`;
      return;
    }

    const { batches = [], finalTemp, maxBatchTemp, criticalBatch, safety } = result;
    const status = safety?.status || 'safe';
    const color = status === 'danger' ? '#F44336' : status === 'warning' ? '#FFC107' : '#4CAF50';

    container.innerHTML = safeHTML`
      <div class="result-box">
        <h3>نتائج التمبرنج</h3>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div>الحرارة النهائية: <strong>${fmtFixed(finalTemp,1)}°C</strong></div>
          <div>أقصى حرارة: <strong style="color:${color}">${fmtFixed(maxBatchTemp,1)}°C</strong> ${criticalBatch ? `<small>(دفعة ${fmtInt(criticalBatch)})</small>` : ''}</div>
        </div>
        <div class="tempering-table" style="margin-top:8px;overflow:auto;">
          <table>
            <thead><tr><th>الدفعة</th><th>%</th><th>قبل</th><th>بعد</th></tr></thead>
            <tbody>
              ${batches.map(b => `
                <tr>
                  <td>${fmtInt(b.batchNumber || b.batch)}</td>
                  <td>${fmtFixed(b.percentage || 0,2)}%</td>
                  <td>${fmtFixed(b.tempBefore,1)}°C</td>
                  <td>${fmtFixed(b.tempAfter,1)}°C</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderScalingResult(result, mode) {
    const container = $('#scaling-results-container');
    if (!container) return;
    if (!result) { container.innerHTML = `<div class="alert alert-danger">لا توجد نتيجة.</div>`; return; }
    if (result.error) { container.innerHTML = `<div class="alert alert-danger">${escapeHTML(result.error)}</div>`; return; }

    if (mode === 'normal') {
      const eff = (result.totalCoverage / Math.max(1, result.totalCoverage + result.remainder)) * 100;
      container.innerHTML = safeHTML`
        <div class="result-box">
          <h3>📊 حساب الطبقات</h3>
          <div>عدد الطبقات: <strong>${fmtInt(result.numLayers)}</strong></div>
          <div>وزن الطبقة: <strong>${fmtInt(result.singleLayerWeight)} جم</strong></div>
          <div>الكثافة: <strong>${fmtFixed(result.density,2)} جم/سم³</strong></div>
          <div>الاستخدام: <strong>${fmtInt(result.totalCoverage)} جم</strong> (${fmtInt(eff)}%)</div>
          ${result.remainder > 10 ? `<div>المتبقي: <strong>${fmtInt(result.remainder)} جم</strong></div>` : ''}
        </div>
      `;
    } else if (mode === 'advanced') {
      const { newRecipe, totalWeight, scalingFactor, perLayerWeight } = result;
      container.innerHTML = safeHTML`
        <div class="result-box">
          <h3>⚖️ المقادير الجديدة</h3>
          <div>الوزن الإجمالي: <strong>${fmtInt(totalWeight)} جم</strong></div>
          <div>معامل التحجيم: <strong>×${fmtFixed(scalingFactor,2)}</strong></div>
          <div>وزن الطبقة: <strong>${fmtInt(perLayerWeight)} جم</strong></div>
          <table style="margin-top:8px;">
            <thead><tr><th>المكوّن</th><th>الكمية (جم)</th></tr></thead>
            <tbody>${Object.entries(newRecipe).map(([k,v]) => `<tr><td>${escapeHTML(arName(k))}</td><td>${fmtFixed(v,1)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      `;
    } else { // reverse
      const { newRecipe, totalWeight, perLayerWeight } = result;
      container.innerHTML = safeHTML`
        <div class="result-box">
          <h3>🔄 المقادير المطلوبة</h3>
          <div>الوزن الإجمالي: <strong>${fmtInt(totalWeight)} جم</strong></div>
          <div>وزن الطبقة: <strong>${fmtInt(perLayerWeight)} جم</strong></div>
          <table style="margin-top:8px;">
            <thead><tr><th>المكوّن</th><th>الكمية (جم)</th></tr></thead>
            <tbody>${Object.entries(newRecipe).map(([k,v]) => `<tr><td>${escapeHTML(arName(k))}</td><td>${fmtFixed(v,1)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      `;
    }

    function arName(k) {
      const map = { flour:'دقيق', butter:'زبدة', sugar:'سكر', honey:'عسل', eggs:'بيض', soda:'صودا الخبز' };
      return map[k] || k;
    }
  }

  // -------------------- Dough Preparation Guide --------------------
  function renderDoughPreparationGuide(methodType = 'scientific') {
    const container = document.getElementById('dough-method-container');
    if (!container) return;

    const content = {
        'scientific': `
            <div class="protocol-card scientific-method">
                <div class="method-header">
                    <h4>🔬 الطريقة الكلاسيكية (Bain-marie)</h4>
                    <small class="muted">الأكثر أماناً لضمان عدم تخثر البيض والتحكم الدقيق في اللون.</small>
                </div>
                
                <div class="step-timeline">
                    <div class="step-item">
                        <div class="step-marker">1</div>
                        <div class="step-content">
                            <strong>الإذابة والكرملة الأولية (75-80°C):</strong>
                            <p>في وعاء معدني فوق حمام مائي (ماء يغلي ببطء ولا يلامس الوعاء)، اخلط <strong>الزبدة، السكر، والعسل</strong>. حرك حتى تذوب تماماً وتصبح ساخنة للملمس.</p>
                            <div class="science-tip">💡 الحرارة غير المباشرة تمنع احتراق السكر وتسمح بتوزيع الحرارة بانتظام.</div>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-marker">2</div>
                        <div class="step-content">
                            <strong>تفاعل الصودا (Maillard Kickstart):</strong>
                            <p>أضف <strong>بيكربونات الصوديوم</strong> وحرك بسرعة. سيحدث فوران ويتحول الخليط للأبيض، ثم يبدأ بالتلون للذهبي.</p>
                            <div class="science-tip">💡 الصودا تتفاعل مع أحماض العسل (pH) وتنتج CO2 وترفع القلوية مما يسرع تفاعل "ميلارد".</div>
                        </div>
                    </div>

                    <div class="step-item critical">
                        <div class="step-marker">3</div>
                        <div class="step-content">
                            <strong>التمبرنج (Tempering) - نقطة حرجة:</strong>
                            <p>ارفع الوعاء عن النار وانتظر دقيقة لتنخفض الحرارة لـ <strong>65-70°C</strong>. اخفق البيض جانباً، ثم أضفه <strong>كخيط رفيع جداً</strong> مع الخفق المستمر والسريع.</p>
                            <div class="science-tip">🔴 بياض البيض يتخثر عند 62-65°C. الإضافة دفعة واحدة تصنع "بيضاً مقلياً".</div>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-marker">4</div>
                        <div class="step-content">
                            <strong>تكوين العجين (Hydration):</strong>
                            <p>أضف الدقيق وقلب بالملعقة. العجينة ستكون <strong>سائلة جداً ولزجة</strong> وهي ساخنة. هذا طبيعي! لا تضف دقيقاً زائداً.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-marker">5</div>
                        <div class="step-content">
                            <strong>التبريد والتبلور:</strong>
                            <p>اترك العجينة تبرد لدرجة حرارة الغرفة (أو الثلاجة 10 دقائق). ستلاحظ أن الزبدة والسكر يتبلوران وتتحول العجينة إلى قوام قابل للفرد.</p>
                        </div>
                    </div>
                </div>
            </div>
        `,
        
        'allinone': `
            <div class="protocol-card fast-method">
                <div class="method-header">
                    <h4>⚡ طريقة القدر الواحد (Saucepan Method)</h4>
                    <small class="muted">سريعة للمحترفين، لكن تتطلب حذراً شديداً من الحرارة.</small>
                </div>

                <div class="alert alert-warning">
                    ⚠️ <strong>خطر عالٍ:</strong> هذه الطريقة تخلط البيض مع السكر قبل التسخين. التوقف عن التحريك للحظة قد يسبب تكتل البيض.
                </div>

                <div class="step-timeline">
                    <div class="step-item">
                        <div class="step-marker">1</div>
                        <div class="step-content">
                            <strong>الخلط البارد:</strong>
                            <p>في قدر سميك القاع (على البارد)، اخلط <strong>البيض والسكر</strong> جيداً، ثم أضف <strong>العسل والزبدة</strong>.</p>
                        </div>
                    </div>

                    <div class="step-item critical">
                        <div class="step-marker">2</div>
                        <div class="step-content">
                            <strong>الطبخ المستمر:</strong>
                            <p>ارفع القدر على نار <strong>هادئة جداً</strong>. حرك باستمرار دون توقف. الهدف رفع الحرارة ببطء شديد دون تخثر.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-marker">3</div>
                        <div class="step-content">
                            <strong>إضافة الصودا:</strong>
                            <p>عندما يذوب كل شيء ويصبح الخليط ساخناً جداً (قبل الغليان)، أضف الصودا. استمر بالتحريك حتى يتحول اللون للكراميل العميق.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-marker">4</div>
                        <div class="step-content">
                            <strong>العجن الفوري:</strong>
                            <p>ارفع عن النار وأضف الدقيق دفعة واحدة. قلب بقوة حتى تختفي الكتل.</p>
                        </div>
                    </div>
                </div>
            </div>
        `
    };

    container.innerHTML = content[methodType] || '';
  }

  // -------------------- Technique Object Renderer --------------------
  function renderTechniqueObject(technique) {
    if (!technique || typeof technique !== 'object') return '';
    const esc = (s) => escapeHTML(String(s));
    
    let html = '';
    
    if (technique.why) {
      html += `<div class="tech-section">
        <strong>🎯 الهدف العلمي:</strong>
        <div class="tech-content">${esc(technique.why)}</div>
      </div>`;
    }
    
    if (technique.method && Array.isArray(technique.method)) {
      html += `<div class="tech-section">
        <strong>📋 الخطوات:</strong>
        <ol class="tech-steps">${technique.method.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
      </div>`;
    }
    
    if (technique.setup && Array.isArray(technique.setup)) {
      html += `<div class="tech-section">
        <strong>🔧 الإعداد:</strong>
        <ul class="tech-setup">${technique.setup.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
      </div>`;
    }
    
    if (technique.test) {
      html += `<div class="tech-section">
        <strong>✅ اختبار الجودة:</strong>
        <div class="tech-content">${esc(technique.test)}</div>
      </div>`;
    }
    
    return html ? `<div class="technique-container">${html}</div>` : '';
  }

  // -------------------- Expose API --------------------
  Object.assign(UIRenderer, {
    // config/intl
    setLocale: UIRenderer.setLocale.bind(UIRenderer),
    // helpers
    escapeHTML, safeHTML, isSafeHTML, fmtInt, fmtFixed, getIngredientDisplayName,
    // protocol generator
    generateDynamicProtocol,
    // cards & presenters
    renderViscosityAtTCard,
    renderViscosityAtTCardEnhanced,
    renderOptimizerCard,
    renderWorkTargetCardCompat,
    renderCaramelizationBadge,
    renderChemistryStrip,
    renderAnalysisResults,
    renderDecisionStrip,
    renderKitchenDashboard,
    renderFillingChemistryPanel,
    renderFillingResult,
    renderDynamicFillingInputs,
    renderCompatibilityReport,
    renderBakingSimulation,
    renderBakingSchedule,
    renderTemperingResults,
    renderScalingResult,
    renderDoughPreparationGuide,
    renderTechniqueObject
  });

  window.UIRenderer = UIRenderer;

})(window, window.MedovikCalculatorCore);