/* 词卡·每日一词 v3.1 —— 右下角词典风磨砂卡片（难词重点词加权版）
 * 交互：页面加载后自动亮相约 4 秒（每个浏览器标签页仅一次），随后隐身；
 *       鼠标进入右下角感应区（或移到卡片上）淡入，离开淡出。
 *       坐标检测唤出，不用热区 div（会挡住角落点击，悠听 v3.2 的教训）。
 * 数据：/words/gaokao-3500.json（高考3668词）。
 * 权重：难词重点词优先——建库词频权重 wt 越大越常用，按档位反压：
 *       简单词（the/what/record 级）几乎不抽到，中低频课本重点词占绝大头；
 *       今日词轮换池剔除超高频简单词；「换一个」避开最近看过的 12 个词。
 * 逻辑：今日词=本地日期确定性轮换（全站同日同词）；撤销=回退上一词；
 *       跨页面导航用 sessionStorage 保持当前词。
 */
(function () {
    'use strict';
    if (document.getElementById('wc-root')) return;

    var ACCENT = '#0f8377';
    var CSS = [
        '#wc-root{position:fixed;right:14px;bottom:14px;z-index:60;',
            'width:min(320px,calc(100vw - 24px));',
            'opacity:0;visibility:hidden;transform:translateY(12px);pointer-events:none;',
            'transition:opacity .34s ease,transform .34s ease,visibility .34s;}',
        '#wc-root.wc-show{opacity:1;visibility:visible;transform:none;pointer-events:auto;}',
        '#wc-root.wc-show #wc-card{animation:wcIn .46s cubic-bezier(.34,1.56,.64,1);}',
        '@keyframes wcIn{from{opacity:0;transform:translateY(16px) scale(.94);}to{opacity:1;transform:none;}}',
        '@media (prefers-reduced-motion: reduce){',
            '#wc-root{transition:none;}#wc-root.wc-show #wc-card{animation:none;}}',

        /* 磨砂玻璃卡片 + 渐变描边（@supports 门控，不支持则退回普通边框） */
        '#wc-card{position:relative;overflow:hidden;',
            'background:linear-gradient(165deg,rgba(255,255,255,.78),rgba(255,255,255,.55));',
            'backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);',
            'border:1px solid rgba(255,255,255,.6);border-radius:18px;',
            'box-shadow:0 18px 44px -12px rgba(15,131,119,.28),0 4px 14px rgba(0,0,0,.06);',
            'padding:15px 18px 13px;color:var(--body-text-color,#3b4a54);}',
        '@supports ((-webkit-mask-composite:xor) or (mask-composite:exclude)){',
            '#wc-card{border-color:transparent;}',
            '#wc-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1px;',
                'background:linear-gradient(140deg,rgba(255,255,255,.95),rgba(255,255,255,.25) 45%,rgba(15,131,119,.4));',
                '-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;',
                'mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;}}',
        'html[data-scheme="dark"] #wc-card{',
            'background:linear-gradient(165deg,rgba(33,40,44,.74),rgba(25,31,34,.62));',
            'border-color:rgba(255,255,255,.1);',
            'box-shadow:0 18px 44px -12px rgba(0,0,0,.55);color:#c8d3d8;}',
        '@supports ((-webkit-mask-composite:xor) or (mask-composite:exclude)){',
            'html[data-scheme="dark"] #wc-card::after{',
                'background:linear-gradient(140deg,rgba(255,255,255,.2),rgba(255,255,255,.06) 45%,rgba(87,205,189,.4));}}',
        '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){',
            '#wc-card{background:var(--card-background,#fff);}}',

        '.wc-glow{position:absolute;top:-46px;right:-46px;width:130px;height:130px;border-radius:50%;',
            'background:radial-gradient(circle,rgba(15,131,119,.14),transparent 70%);pointer-events:none;}',
        'html[data-scheme="dark"] .wc-glow{background:radial-gradient(circle,rgba(87,205,189,.12),transparent 70%);}',
        '.wc-tick{width:30px;height:3px;border-radius:2px;margin-bottom:8px;',
            'background:linear-gradient(90deg,#0f8377,#57cdbd);}',
        'html[data-scheme="dark"] .wc-tick{background:linear-gradient(90deg,#3cb8a7,#7fd8cc);}',

        '#wc-head{display:flex;align-items:baseline;gap:8px;min-width:0;}',
        '#wc-w{font-family:Georgia,"Times New Roman",serif;font-size:23px;font-weight:700;',
            'color:#0e7c70;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
            'flex:0 0 auto;max-width:58%;min-width:0;}',
        'html[data-scheme="dark"] #wc-w{color:#6fd3c4;}',
        '#wc-tag{flex-shrink:0;font-size:10.5px;line-height:1;padding:3px 7px;border-radius:999px;',
            'color:#fff;background:linear-gradient(135deg,#119a8b,#0b6b5f);white-space:nowrap;}',
        '#wc-ipa{flex:1 1 0;min-width:0;text-align:right;font-size:12px;',
            'color:var(--body-text-color,#3b4a54);opacity:.6;',
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

        '#wc-tr{margin-top:8px;}',
        '#wc-loading{font-size:12.5px;opacity:.55;margin-top:4px;}',
        '.wc-line{display:flex;gap:7px;font-size:13px;line-height:1.55;margin-top:3px;min-width:0;}',
        '.wc-pos{flex-shrink:0;font-size:12px;font-weight:600;color:#0f8377;padding-top:1px;',
            'white-space:nowrap;font-family:Georgia,serif;}',
        'html[data-scheme="dark"] .wc-pos{color:#57cdbd;}',
        '.wc-cn{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;',
            'overflow:hidden;overflow-wrap:break-word;}',

        '#wc-sen{position:relative;margin-top:10px;padding:10px 12px 9px 27px;',
            'background:linear-gradient(135deg,rgba(15,131,119,.09),rgba(15,131,119,.03));border-radius:12px;}',
        'html[data-scheme="dark"] #wc-sen{background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.03));}',
        '#wc-sen::before{content:"\\201C";position:absolute;left:9px;top:3px;',
            'font:700 26px/1 Georgia,serif;color:' + ACCENT + ';opacity:.4;}',
        'html[data-scheme="dark"] #wc-sen::before{color:#57cdbd;}',
        '#wc-en{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:13px;line-height:1.5;',
            'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:break-word;}',
        '#wc-cnx{font-size:12px;opacity:.72;line-height:1.5;margin-top:2px;',
            'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',

        '#wc-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:11px;}',
        '#wc-btns button{font-family:inherit;font-size:12px;padding:5px 14px;border-radius:999px;',
            'cursor:pointer;transition:transform .16s,box-shadow .16s,opacity .16s;border:1px solid transparent;}',
        '#wc-next{background:linear-gradient(135deg,#119a8b,#0b6b5f);color:#fff;',
            'box-shadow:0 4px 12px rgba(15,131,119,.32);}',
        '#wc-next:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(15,131,119,.42);}',
        '#wc-undo{background:transparent;color:var(--body-text-color,#3b4a54);opacity:.7;border-color:currentColor;}',
        'html[data-scheme="dark"] #wc-undo{color:#c8d3d8;}',
        '#wc-undo:hover{opacity:1;transform:translateY(-1px);}',
        '#wc-btns button:disabled{opacity:.32;cursor:default;transform:none;box-shadow:none;}',
        '#wc-tip{font-size:12px;opacity:.7;margin-top:6px;}'
    ].join('');

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'wc-root';
    root.innerHTML =
        '<div id="wc-card">' +
            '<div class="wc-glow"></div>' +
            '<div class="wc-tick"></div>' +
            '<div id="wc-head">' +
                '<span id="wc-w"></span>' +
                '<span id="wc-tag" style="display:none">今日</span>' +
                '<span id="wc-ipa"></span>' +
            '</div>' +
            '<div id="wc-tr"><div id="wc-loading">加载词库…</div></div>' +
            '<div id="wc-sen" style="display:none"><div id="wc-en"></div><div id="wc-cnx"></div></div>' +
            '<div id="wc-btns">' +
                '<button id="wc-undo" type="button">↶ 撤销</button>' +
                '<button id="wc-next" type="button">↻ 换一个</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(root);

    function $(id) { return document.getElementById(id); }

    /* ---------- 数据与状态 ---------- */
    var data = null, prefix = null, totalW = 0;
    var state = { i: -1, hist: [], day: -1 };
    var dailyPool = null, dailyStep = 0;

    /* 难词加权：建库时 wt=300/rank^0.6（越大越常用），按档位反压——
     * 简单词压到极低，中低频课本重点词（写作词汇主力）抬到最高档。 */
    function hardWt(wt) {
        if (wt >= 100) return 0.6;   /* the/of/and 级超高频 */
        if (wt >= 20) return 1.5;    /* 高频常用词 */
        if (wt >= 6) return 4;       /* 中频词 */
        if (wt >= 2) return 8;       /* 中低频重点词 */
        return 12;                   /* 低频难词 */
    }

    function dayNumber() {
        return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
    }

    /* 今日词轮换池：剔除 wt>=20 的超高频简单词，按与池长互质的素数步长确定性轮换 */
    function buildDailyPool() {
        dailyPool = [];
        for (var k = 0; k < data.length; k++) if (data[k].wt < 20) dailyPool.push(k);
        if (!dailyPool.length) { for (k = 0; k < data.length; k++) dailyPool.push(k); }
        function gcd(a, b) { return b ? gcd(b, a % b) : a; }
        for (var p = 911; ; p += 2) {
            var prime = true;
            for (var d = 3; d * d <= p; d += 2) if (p % d === 0) { prime = false; break; }
            if (prime && gcd(p, dailyPool.length) === 1) { dailyStep = p; break; }
        }
    }
    function todayIndex() {
        return dailyPool[(dayNumber() * dailyStep) % dailyPool.length];
    }

    function saveSession() {
        try { sessionStorage.setItem('wc-state', JSON.stringify(state)); } catch (e) {}
    }
    function loadSession() {
        try {
            var s = JSON.parse(sessionStorage.getItem('wc-state') || 'null');
            if (s && typeof s.i === 'number') state = s;
        } catch (e) {}
    }

    /* 最近看过的词（当前+撤销栈末12个），「换一个」尽量避开，防止反复出同一个词 */
    function recentSet() {
        var s = {};
        if (state.i >= 0) s[state.i] = 1;
        for (var k = Math.max(0, state.hist.length - 12); k < state.hist.length; k++) {
            s[state.hist[k]] = 1;
        }
        return s;
    }
    function pickWeighted() {
        var recent = recentSet();
        for (var tries = 0; tries < 24; tries++) {
            var r = Math.random() * totalW, lo = 0, hi = prefix.length - 1;
            while (lo < hi) {
                var mid = (lo + hi) >> 1;
                if (prefix[mid] <= r) lo = mid + 1; else hi = mid;
            }
            if (!recent[lo] || tries === 23) return lo;
        }
    }

    function render(idx, isToday) {
        var d = data[idx];
        state.i = idx;
        var ld = $('wc-loading');
        if (ld) ld.remove();
        $('wc-w').textContent = d.w;
        $('wc-w').title = d.w;
        $('wc-tag').style.display = isToday ? '' : 'none';
        $('wc-ipa').textContent = d.uk ? ('/' + d.uk + '/' + (d.us ? ' /' + d.us + '/' : '')) : '';
        $('wc-ipa').title = $('wc-ipa').textContent;
        var tr = $('wc-tr');
        tr.innerHTML = '';
        for (var k = 0; k < d.tr.length; k++) {
            var line = document.createElement('div');
            line.className = 'wc-line';
            var pos = document.createElement('span');
            pos.className = 'wc-pos';
            var cn = document.createElement('span');
            cn.className = 'wc-cn';
            var m = d.tr[k].match(/^([a-z\.\s]+?)\s*(.*)$/);
            if (m && m[1] && m[2]) {
                pos.textContent = m[1].trim() + '.';
                cn.textContent = m[2];
                cn.title = m[2];
            } else {
                cn.textContent = d.tr[k];
                cn.title = d.tr[k];
            }
            line.appendChild(pos); line.appendChild(cn);
            tr.appendChild(line);
        }
        if (d.en) {
            $('wc-sen').style.display = '';
            $('wc-en').textContent = d.en;
            $('wc-cnx').textContent = d.cn;
        } else {
            $('wc-sen').style.display = 'none';
        }
        $('wc-undo').disabled = !state.hist.length;
        saveSession();
    }

    function showToday() {
        state.hist = [];
        state.day = dayNumber();
        render(todayIndex(), true);
    }

    $('wc-next').addEventListener('click', function () {
        if (!data) return;
        state.hist.push(state.i);
        if (state.hist.length > 30) state.hist.shift();
        render(pickWeighted(), false);
    });
    $('wc-undo').addEventListener('click', function () {
        if (!data || !state.hist.length) return;
        render(state.hist.pop(), false);
    });

    /* ---------- 显隐：加载亮相 + 悬停唤出（坐标检测） ---------- */
    var ZONE_W = 200, ZONE_H = 260, HIDE_DELAY = 420, FLASH_MS = 4200;
    var hideTimer = null, flashTimer = null, shown = false;

    function inZone(x, y) {
        return x > window.innerWidth - ZONE_W && y > window.innerHeight - ZONE_H;
    }
    function overCard(x, y) {
        if (!shown) return false;
        var r = root.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }
    function showCard() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
        if (!shown) { shown = true; root.classList.add('wc-show'); }
    }
    function hideCard() {
        if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
        shown = false;
        root.classList.remove('wc-show');
    }
    function flashOnce() {
        try {
            if (sessionStorage.getItem('wc-flash')) return;
            sessionStorage.setItem('wc-flash', '1');
        } catch (e) { return; }
        showCard();
        flashTimer = setTimeout(hideCard, FLASH_MS);
    }
    function track(x, y) {
        if (inZone(x, y) || overCard(x, y)) showCard();
        else if (shown && !hideTimer) hideTimer = setTimeout(hideCard, HIDE_DELAY);
    }
    var lastTrack = 0;
    document.addEventListener('mousemove', function (e) {
        var now = Date.now();
        if (now - lastTrack < 60) return;
        lastTrack = now;
        track(e.clientX, e.clientY);
    }, { passive: true });
    document.addEventListener('touchstart', function (e) {
        if (!e.touches || !e.touches[0]) return;
        track(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    /* ---------- 启动 ---------- */
    loadSession();
    fetch('/words/gaokao-3500.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (arr) {
            data = arr;
            prefix = []; totalW = 0;
            for (var k = 0; k < data.length; k++) {
                totalW += hardWt(data[k].wt);
                prefix.push(totalW);
            }
            buildDailyPool();
            if (state.i >= 0 && state.i < data.length && state.day === dayNumber()) {
                render(state.i, state.i === todayIndex());
            } else {
                showToday();
            }
            flashOnce();
        })
        .catch(function () {
            var tr = $('wc-tr');
            tr.innerHTML = '<div id="wc-tip">词库加载失败，稍后刷新页面试试</div>';
            flashOnce();
        });

    /* 回归测试钩子（只读） */
    window.__wcTest = {
        get data() { return data; },
        get dailyPool() { return dailyPool; },
        hardWt: hardWt,
        pickWeighted: pickWeighted,
        todayIndex: todayIndex
    };
})();
