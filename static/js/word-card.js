/* 词卡·每日一词 v4.0 —— 左侧栏「工具→每日一词」弹出面板
 * 交互：由对弈面板注入的菜单按钮派发 wc-toggle 事件开关；Esc/点击外部/✕ 关闭；
 *       与对弈面板互斥（互相监听 gq-opened / wc-opened）。
 * 样式：词典风磨砂卡片（v3 风格：衬线词头+渐变描边玻璃+辉光+引号例句）。
 * 数据：/words/gaokao-3500.json（高考3668词），首次打开面板才加载（省流量）。
 * 权重：难词重点词优先——wt 分档反压，简单词几乎不抽到（v3.1）；
 *       今日词=本地日期确定性轮换（全站同日同词，池剔除超高频词）；
 *       「换一个」避开最近 12 词；撤销=回退上一词；跨页面 sessionStorage 保持。
 */
(function () {
    'use strict';
    if (document.getElementById('wc-panel')) return;

    var CSS = [
        '#wc-panel{position:fixed;z-index:9997;width:min(340px,calc(100vw - 24px));',
            'max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;',
            'opacity:0;visibility:hidden;transform:translateX(-14px);pointer-events:none;',
            'transition:opacity .3s ease,transform .3s ease,visibility .3s;}',
        '#wc-panel.wc-show{opacity:1;visibility:visible;transform:none;pointer-events:auto;}',
        '#wc-panel.wc-show .wc-card{animation:wcIn .46s cubic-bezier(.34,1.56,.64,1);}',
        '@keyframes wcIn{from{opacity:0;transform:translateY(16px) scale(.94);}to{opacity:1;transform:none;}}',
        '.wc-card{position:relative;overflow:hidden;border-radius:18px;padding:14px 18px 13px;',
            'background:linear-gradient(165deg,rgba(255,255,255,.78),rgba(255,255,255,.55));',
            'backdrop-filter:blur(20px) saturate(1.6);-webkit-backdrop-filter:blur(20px) saturate(1.6);',
            'box-shadow:0 18px 44px -12px rgba(15,131,119,.28),0 4px 14px rgba(0,0,0,.06);',
            'color:var(--card-text-color-main,#3b4a54);}',
        '@supports ((-webkit-mask-composite: xor) or (mask-composite: exclude)) {',
            '.wc-card::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;',
                'padding:1px;background:linear-gradient(140deg,rgba(255,255,255,.9),rgba(255,255,255,.2) 45%,rgba(15,131,119,.35));',
                '-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);',
                '-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;}}',
        '.wc-glow{position:absolute;top:-44px;right:-44px;width:130px;height:130px;border-radius:50%;',
            'background:radial-gradient(circle,rgba(15,131,119,.14),transparent 70%);pointer-events:none;}',
        '#wc-head-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}',
        '#wc-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;',
            'color:var(--card-text-color-secondary,#5a6b74);letter-spacing:.5px;}',
        '#wc-title svg{color:var(--accent-color,#0f8377);}',
        '.wc-mini-btn{width:26px;height:26px;border:none;border-radius:8px;cursor:pointer;',
            'background:rgba(15,131,119,.08);color:var(--card-text-color-secondary,#5a6b74);',
            'font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;',
            'transition:background .15s,color .15s;}',
        '.wc-mini-btn:hover{background:rgba(15,131,119,.16);color:var(--accent-color,#0f8377);}',
        '.wc-tick{width:30px;height:3px;border-radius:2px;margin-bottom:8px;',
            'background:linear-gradient(90deg,#0f8377,#57cdbd);}',
        '#wc-head{display:flex;align-items:baseline;gap:8px;}',
        '#wc-w{font-family:Georgia,"Times New Roman",serif;font-size:23px;font-weight:700;line-height:1.15;',
            'color:var(--accent-color,#0f8377);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '#wc-tag{flex-shrink:0;font-size:11px;padding:2px 9px;border-radius:999px;color:#fff;',
            'background:linear-gradient(135deg,#119a8b,#0b6b5f);display:none;}',
        '#wc-tag.on{display:inline-block;}',
        '#wc-uk{flex-shrink:0;min-width:0;max-width:52%;font-size:12px;color:var(--card-text-color-tertiary,#7d8b93);',
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '#wc-tr{margin-top:9px;}',
        '.wc-sense{display:flex;gap:7px;padding:2.5px 0;font-size:13.5px;line-height:1.5;}',
        '.wc-pos{flex-shrink:0;font-weight:600;color:var(--accent-color,#0f8377);opacity:.85;}',
        '#wc-sen{position:relative;margin-top:10px;padding:9px 12px 8px 26px;border-radius:12px;',
            'background:linear-gradient(135deg,rgba(15,131,119,.09),rgba(15,131,119,.03));}',
        '#wc-sen::before{content:"\\201C";position:absolute;left:8px;top:2px;',
            'font:700 26px/1 Georgia,serif;color:var(--accent-color,#0f8377);opacity:.35;}',
        '#wc-sen-en{font-family:Georgia,"Times New Roman",serif;font-style:italic;font-size:13.5px;line-height:1.5;}',
        '#wc-sen-cn{font-size:12.5px;line-height:1.5;color:var(--card-text-color-secondary,#5a6b74);margin-top:2px;}',
        '#wc-btns{display:flex;align-items:center;gap:10px;margin-top:12px;}',
        '#wc-next{flex:1;padding:7px 0;border:none;border-radius:999px;cursor:pointer;',
            'font-size:13.5px;font-weight:600;color:#fff;',
            'background:linear-gradient(135deg,#119a8b,#0b6b5f);',
            'box-shadow:0 4px 10px rgba(15,131,119,.32);transition:transform .15s,box-shadow .15s,filter .15s;}',
        '#wc-next:hover{transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 6px 14px rgba(15,131,119,.4);}',
        '#wc-prev{flex:1;padding:6px 0;border-radius:999px;cursor:pointer;font-size:13px;',
            'background:transparent;border:1px solid rgba(15,131,119,.45);color:var(--accent-color,#0f8377);',
            'transition:opacity .15s,background .15s;}',
        '#wc-prev:hover{background:rgba(15,131,119,.08);}',
        '#wc-prev:disabled{opacity:.35;cursor:default;background:transparent;}',
        '#wc-tip{font-size:13px;color:var(--card-text-color-secondary,#5a6b74);padding:6px 0 2px;}',
        '#wc-loading{font-size:13px;color:var(--card-text-color-secondary,#7d8b93);padding:10px 0 6px;}',
        'html[data-scheme="dark"] .wc-card{',
            'background:linear-gradient(165deg,rgba(33,40,44,.72),rgba(25,31,34,.62));',
            'box-shadow:0 18px 44px -12px rgba(0,0,0,.5),0 4px 14px rgba(0,0,0,.3);}',
        'html[data-scheme="dark"] .wc-card::after{',
            'background:linear-gradient(140deg,rgba(255,255,255,.18),rgba(255,255,255,.05) 45%,rgba(69,199,181,.35));}',
        'html[data-scheme="dark"] .wc-glow{background:radial-gradient(circle,rgba(87,205,189,.10),transparent 70%);}',
        'html[data-scheme="dark"] .wc-tick{background:linear-gradient(90deg,#3cb8a7,#7fd8cc);}',
        'html[data-scheme="dark"] .wc-mini-btn{background:rgba(255,255,255,.07);}',
        'html[data-scheme="dark"] .wc-mini-btn:hover{background:rgba(255,255,255,.14);}',
        'html[data-scheme="dark"] #wc-sen{background:linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,.03));}',
        '@media (prefers-reduced-motion: reduce){#wc-panel,.wc-card{transition:none;animation:none;}}'
    ].join('\n');

    function buildDom() {
        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        var wrap = document.createElement('div');
        wrap.id = 'wc-panel';
        wrap.innerHTML =
            '<div class="wc-card">' +
                '<div class="wc-glow"></div>' +
                '<div id="wc-head-row">' +
                    '<span id="wc-title">' +
                        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' +
                        '每日一词</span>' +
                    '<button class="wc-mini-btn" id="wc-close" title="收起">✕</button>' +
                '</div>' +
                '<div class="wc-tick"></div>' +
                '<div id="wc-head"><span id="wc-w"></span><span id="wc-tag">今日</span><span id="wc-uk"></span></div>' +
                '<div id="wc-tr"><div id="wc-loading">词库加载中…</div></div>' +
                '<div id="wc-sen"><div id="wc-sen-en"></div><div id="wc-sen-cn"></div></div>' +
                '<div id="wc-btns">' +
                    '<button id="wc-next">↻ 换一个</button>' +
                    '<button id="wc-prev" disabled>↶ 撤销</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap);
    }

    function $(id) { return document.getElementById(id); }
    function panelEl() { return $('wc-panel'); }
    function isOpen() { return panelEl().classList.contains('wc-show'); }

    /* ---------- 数据与状态 ---------- */
    var data = null, prefix = null, totalW = 0, loading = false;
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

    /* ---------- 渲染 ---------- */
    function render(idx, isToday) {
        var d = data[idx];
        state.i = idx;
        saveSession();
        $('wc-w').textContent = d.w;
        $('wc-w').title = d.w;
        var tag = $('wc-tag');
        tag.classList.toggle('on', !!isToday);
        $('wc-uk').textContent = d.uk || '';
        $('wc-uk').title = d.uk || '';
        var tr = $('wc-tr');
        var html = '';
        for (var k = 0; k < d.tr.length && k < 3; k++) {
            var t = d.tr[k], dot = t.indexOf('. ');
            var pos = dot > 0 && dot < 6 ? t.slice(0, dot + 1) : '';
            var rest = pos ? t.slice(pos.length + 1) : t;
            html += '<div class="wc-sense">' +
                    (pos ? '<span class="wc-pos">' + pos + '</span>' : '') +
                    '<span>' + rest + '</span></div>';
        }
        tr.innerHTML = html;
        $('wc-sen-en').textContent = d.en || '';
        $('wc-sen-cn').textContent = d.cn || '';
        $('wc-sen').style.display = d.en ? '' : 'none';
        $('wc-prev').disabled = state.hist.length === 0;
        /* 内容高度随词变化，下一帧校准面板定位（避免底边超出视口） */
        if (panelEl().classList.contains('wc-show')) requestAnimationFrame(placePanel);
    }

    function showToday() {
        state.day = dayNumber();
        var i = todayIndex();
        render(i, true);
    }
    function showRandom() {
        if (state.i >= 0) {
            state.hist.push(state.i);
            if (state.hist.length > 30) state.hist.shift();
        }
        render(pickWeighted(), false);
    }
    function undo() {
        if (!state.hist.length) return;
        render(state.hist.pop(), false);
        saveSession();
    }

    /* ---------- 加载（首次打开面板才拉词库） ---------- */
    function loadData() {
        if (data || loading) return;
        loading = true;
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
            })
            .catch(function () {
                $('wc-tr').innerHTML = '<div id="wc-tip">词库加载失败，稍后重试</div>';
            });
    }

    /* ---------- 面板开关 ---------- */
    function placePanel() {
        var p = panelEl();
        var right = window.innerWidth > 1024, x, y;
        if (right) {
            var item = document.getElementById('gq-menu-item');
            if (item) {
                var r = item.getBoundingClientRect();
                var h = p.offsetHeight || 320;
                y = Math.max(12, Math.min(r.top, window.innerHeight - h - 12));
            } else { y = 80; }
            var sidebar = document.querySelector('aside.left-sidebar');
            var sw = sidebar ? sidebar.getBoundingClientRect().right : 300;
            x = Math.min(sw + 12, window.innerWidth - p.offsetWidth - 12);
            p.style.left = x + 'px'; p.style.right = 'auto';
            p.style.top = y + 'px'; p.style.bottom = 'auto';
            p.style.margin = '0';
            p.style.transform = 'none';
        } else {
            /* 窄屏：底部居中（margin auto，transform 留给开关动画） */
            p.style.left = '0px'; p.style.right = '0px';
            p.style.top = 'auto'; p.style.bottom = '12px';
            p.style.margin = '0 auto';
            p.style.transform = 'none';
        }
    }
    function openPanel() {
        placePanel();
        panelEl().classList.add('wc-show');
        loadData();
        var sub = document.getElementById('gq-sub-word');
        if (sub) sub.classList.add('current');
        /* 通知对弈面板关闭（互斥） */
        window.dispatchEvent(new CustomEvent('wc-opened'));
        /* 首次打开时内容可能还没量到真实高度，下一帧校准一次定位 */
        requestAnimationFrame(placePanel);
    }
    function closePanel() {
        panelEl().classList.remove('wc-show');
        var sub = document.getElementById('gq-sub-word');
        if (sub) sub.classList.remove('current');
    }
    function toggle() { isOpen() ? closePanel() : openPanel(); }

    /* ---------- 事件 ---------- */
    function initEvents() {
        $('wc-close').addEventListener('click', closePanel);
        $('wc-next').addEventListener('click', showRandom);
        $('wc-prev').addEventListener('click', undo);
        window.addEventListener('wc-toggle', toggle);
        window.addEventListener('gq-opened', function () { if (isOpen()) closePanel(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) closePanel();
        });
        /* 点击外部关闭：composedPath 快照（五子棋 v2.1 的教训：innerHTML 重建致 closest 断链） */
        document.addEventListener('click', function (e) {
            if (!isOpen()) return;
            var ids = ['wc-panel', 'gq-menu-item'];
            var path = e.composedPath ? e.composedPath() : null, hit = false;
            if (path) {
                for (var i = 0; i < path.length; i++) {
                    if (path[i] && path[i].id && ids.indexOf(path[i].id) >= 0) { hit = true; break; }
                }
            } else if (e.target && e.target.closest) {
                for (var j = 0; j < ids.length; j++) {
                    if (e.target.closest('#' + ids[j])) { hit = true; break; }
                }
            }
            if (!hit) closePanel();
        });
        window.addEventListener('resize', function () { if (isOpen()) placePanel(); });
    }

    /* ---------- 启动 ---------- */
    (function boot() {
        if (!document.body) { setTimeout(boot, 60); return; }
        buildDom();
        initEvents();
    })();

    /* 回归测试钩子（只读） */
    window.__wcTest = {
        get data() { return data; },
        get dailyPool() { return dailyPool; },
        hardWt: hardWt,
        pickWeighted: pickWeighted,
        todayIndex: todayIndex,
        open: openPanel,
        close: closePanel
    };
})();
