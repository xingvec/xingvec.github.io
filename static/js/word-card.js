/* 词卡·每日一词 v5.0 —— 工具→每日一词：3D 翻转记忆卡
 * 交互：正面只露单词+音标（自测），点卡片 3D 翻面看释义/例句；
 *       「换一个」出新词并自动翻回正面；「撤销」回上一词；✕/Esc/点外部关闭；
 *       与对弈面板互斥（监听 gq-opened，打开时广播 wc-opened）。
 * 数据：/words/gaokao-3500.json（高考3668词），首次打开面板才加载。
 * 权重：难词重点词优先——wt 分档反压（v3.1）；今日词=日期确定性轮换
 *       （池剔除超高频词，全站同日同词）；「换一个」避开最近 12 词；
 *       撤销=回退；跨页面 sessionStorage 保持（键 wc-state 沿用）。
 */
(function () {
    'use strict';
    if (document.getElementById('wc-panel')) return;

    var CSS = [
        '#wc-panel{position:fixed;z-index:9997;width:min(384px,calc(100vw - 24px));',
            'max-height:calc(100vh - 24px);overflow:auto;box-sizing:border-box;',
            'border-radius:22px;padding:14px;',
            'background:linear-gradient(165deg,rgba(255,255,255,.94),rgba(238,250,247,.9) 55%,rgba(228,244,240,.88));',
            '-webkit-backdrop-filter:blur(20px) saturate(1.5);backdrop-filter:blur(20px) saturate(1.5);',
            'border:1px solid rgba(255,255,255,.7);',
            'box-shadow:0 24px 60px -12px rgba(15,60,54,.28),0 6px 18px rgba(15,131,119,.1),inset 0 1px 0 rgba(255,255,255,.8);',
            'opacity:0;visibility:hidden;transform:translateX(-14px);pointer-events:none;',
            'transition:opacity .3s ease,transform .3s ease,visibility .3s;}',
        'html[data-scheme="dark"] #wc-panel{',
            'background:linear-gradient(165deg,rgba(22,38,36,.94),rgba(14,26,25,.92));',
            'border-color:rgba(255,255,255,.09);',
            'box-shadow:0 24px 60px -12px rgba(0,0,0,.55),0 6px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.06);}',
        '#wc-panel.wc-show{opacity:1;visibility:visible;transform:none;pointer-events:auto;}',
        '#wc-panel.wc-show .wc-stage{animation:wcIn .5s cubic-bezier(.34,1.4,.64,1);}',
        '@keyframes wcIn{from{opacity:0;transform:translateY(14px) scale(.96);}to{opacity:1;transform:none;}}',

        /* 头部 */
        '.wc-head{display:flex;align-items:center;gap:8px;padding:2px 4px 10px;}',
        '.wc-title{font-size:14px;font-weight:600;color:#17322e;letter-spacing:.5px;}',
        '.wc-date{font-size:12px;color:rgba(23,50,46,.5);}',
        '.wc-close{margin-left:auto;width:26px;height:26px;border:none;border-radius:50%;',
            'background:rgba(15,131,119,.08);color:#0f8377;font-size:13px;cursor:pointer;',
            'display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0;}',
        '.wc-close:hover{background:rgba(15,131,119,.16);}',
        'html[data-scheme="dark"] .wc-title{color:rgba(230,244,240,.92);}',
        'html[data-scheme="dark"] .wc-date{color:rgba(230,244,240,.45);}',

        /* 翻转舞台 */
        '.wc-stage{perspective:1500px;}',
        '#wc-flip{position:relative;height:318px;transform-style:preserve-3d;',
            'transition:transform .62s cubic-bezier(.35,.15,.2,1);cursor:pointer;',
            '-webkit-tap-highlight-color:transparent;}',
        '#wc-flip.flipped{transform:rotateY(180deg);}',
        '.wc-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;',
            'border-radius:18px;padding:20px 22px;box-sizing:border-box;overflow:hidden;',
            'background:linear-gradient(170deg,rgba(255,255,255,.97),rgba(243,251,249,.95));',
            'border:1px solid rgba(255,255,255,.9);',
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 2px 10px rgba(15,60,54,.07);}',
        'html[data-scheme="dark"] .wc-face{',
            'background:linear-gradient(170deg,rgba(30,48,46,.96),rgba(20,35,33,.95));',
            'border-color:rgba(255,255,255,.07);',
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 2px 10px rgba(0,0,0,.3);}',
        '.wc-face::after{content:\'\';position:absolute;top:-40%;right:-30%;width:220px;height:220px;',
            'border-radius:50%;pointer-events:none;',
            'background:radial-gradient(circle,rgba(15,131,119,.09),transparent 65%);}',
        '.wc-back{transform:rotateY(180deg);}',

        /* 正面：单词自测 */
        '.wc-front{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;}',
        '.wc-tag{position:absolute;top:14px;left:14px;font-size:10.5px;letter-spacing:2px;',
            'color:#0f8377;border:1px solid rgba(15,131,119,.4);border-radius:999px;',
            'padding:2.5px 8px 2.5px 10px;font-weight:600;opacity:0;transition:opacity .3s;}',
        '.wc-tag.on{opacity:1;}',
        'html[data-scheme="dark"] .wc-tag{color:#3ddbc4;border-color:rgba(61,219,196,.4);}',
        '#wc-w{font-family:Georgia,\'Times New Roman\',\'Noto Serif SC\',serif;font-weight:600;',
            'font-size:42px;line-height:1.15;color:#132a26;max-width:100%;',
            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        'html[data-scheme="dark"] #wc-w{color:rgba(235,248,244,.95);}',
        '#wc-uk{margin-top:10px;font-size:15px;color:#0f8377;max-width:100%;',
            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        'html[data-scheme="dark"] #wc-uk{color:#3ddbc4;}',
        '.wc-hint{position:absolute;bottom:16px;left:0;right:0;font-size:11.5px;',
            'color:rgba(23,50,46,.4);letter-spacing:1px;}',
        '.wc-hint b{display:inline-block;font-weight:400;animation:wcNudge 1.6s ease-in-out infinite;}',
        '@keyframes wcNudge{0%,100%{transform:translateY(0);}50%{transform:translateY(3px);}}',
        'html[data-scheme="dark"] .wc-hint{color:rgba(230,244,240,.35);}',

        /* 背面：释义与例句 */
        '.wc-back{display:flex;flex-direction:column;}',
        '.wc-bhead{display:flex;align-items:baseline;gap:9px;min-width:0;}',
        '#wc-bw{font-family:Georgia,\'Noto Serif SC\',serif;font-weight:600;font-size:23px;',
            'color:#132a26;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        'html[data-scheme="dark"] #wc-bw{color:rgba(235,248,244,.95);}',
        '#wc-buk{font-size:12.5px;color:#0f8377;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;}',
        'html[data-scheme="dark"] #wc-buk{color:#3ddbc4;}',
        '.wc-div{height:1px;background:linear-gradient(90deg,rgba(15,131,119,.35),rgba(15,131,119,.06));',
            'margin:11px 0;flex-shrink:0;}',
        '#wc-tr{display:flex;flex-direction:column;gap:7px;overflow:auto;min-height:0;flex:1;}',
        '.wc-sense{font-size:14px;line-height:1.6;color:#22423d;display:flex;gap:7px;align-items:baseline;}',
        'html[data-scheme="dark"] .wc-sense{color:rgba(225,240,236,.9);}',
        '.wc-pos{color:#0f8377;font-weight:700;font-size:12.5px;flex-shrink:0;',
            'font-family:Georgia,serif;font-style:italic;}',
        'html[data-scheme="dark"] .wc-pos{color:#3ddbc4;}',
        '#wc-sen{border-left:3px solid rgba(15,131,119,.55);padding:2px 0 2px 12px;margin-top:11px;flex-shrink:0;}',
        '#wc-sen-en{font-size:13px;font-style:italic;line-height:1.55;color:#2a4a45;}',
        'html[data-scheme="dark"] #wc-sen-en{color:rgba(225,240,236,.85);}',
        '#wc-sen-cn{font-size:12.5px;color:rgba(23,50,46,.55);margin-top:3px;line-height:1.5;}',
        'html[data-scheme="dark"] #wc-sen-cn{color:rgba(225,240,236,.5);}',

        /* 底部按钮 */
        '.wc-foot{display:flex;gap:10px;padding:12px 2px 0;}',
        '#wc-next{flex:1.6;height:44px;border:none;border-radius:14px;cursor:pointer;',
            'font-size:14.5px;font-weight:600;color:#fff;letter-spacing:1px;',
            'background:linear-gradient(135deg,#0f8377,#12a18d);',
            'box-shadow:0 6px 16px -4px rgba(15,131,119,.5);',
            'transition:transform .18s,box-shadow .18s,filter .18s;}',
        '#wc-next:hover{transform:translateY(-1px);box-shadow:0 9px 20px -4px rgba(15,131,119,.55);filter:brightness(1.05);}',
        '#wc-next:active{transform:translateY(0);}',
        '#wc-prev{flex:1;height:44px;border:1px solid rgba(15,131,119,.35);border-radius:14px;',
            'background:rgba(15,131,119,.05);color:#0f8377;font-size:14px;cursor:pointer;',
            'transition:opacity .2s,background .2s;}',
        '#wc-prev:hover:not(:disabled){background:rgba(15,131,119,.12);}',
        '#wc-prev:disabled{opacity:.35;cursor:default;}',
        'html[data-scheme="dark"] #wc-prev{border-color:rgba(61,219,196,.35);color:#3ddbc4;background:rgba(61,219,196,.06);}',
        '@media (prefers-reduced-motion:reduce){#wc-flip,#wc-flip.flipped{transition:none;}.wc-hint b{animation:none;}}'
    ].join('');

    /* ---------- 数据与状态 ---------- */
    var data = null, prefix = null, totalW = 0, loading = false;
    var state = { i: -1, hist: [], day: -1 };
    var dailyPool = null, dailyStep = 0;

    /* 难词加权：wt=300/rank^0.6（越大越常用），分档反压 */
    function hardWt(wt) {
        if (wt >= 100) return 0.6;
        if (wt >= 20) return 1.5;
        if (wt >= 6) return 4;
        if (wt >= 2) return 8;
        return 12;
    }

    function dayNumber() {
        return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
    }

    /* 今日词轮换池：剔除超高频词，素数步长确定性轮换（全站同日同词） */
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

    /* 最近看过的词，「换一个」尽量避开 */
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

    /* ---------- DOM ---------- */
    function panelEl() { return document.getElementById('wc-panel'); }
    function $(id) { return document.getElementById(id); }

    function buildDom() {
        if (document.getElementById('wc-panel')) return;
        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        var p = document.createElement('div');
        p.id = 'wc-panel';
        p.innerHTML =
            '<div class="wc-head">' +
                '<span class="wc-title">每日一词</span>' +
                '<span class="wc-date" id="wc-date"></span>' +
                '<button class="wc-close" id="wc-close" title="收起 (Esc)">✕</button>' +
            '</div>' +
            '<div class="wc-stage">' +
                '<div id="wc-flip" role="button" aria-pressed="false" title="点击翻面">' +
                    '<div class="wc-face wc-front">' +
                        '<span class="wc-tag" id="wc-tag">今日</span>' +
                        '<div id="wc-w"></div>' +
                        '<div id="wc-uk"></div>' +
                        '<div class="wc-hint" id="wc-hint">点击卡片，翻面看释义 <b>▾</b></div>' +
                    '</div>' +
                    '<div class="wc-face wc-back">' +
                        '<div class="wc-bhead"><span id="wc-bw"></span><span id="wc-buk"></span></div>' +
                        '<div class="wc-div"></div>' +
                        '<div id="wc-tr"></div>' +
                        '<div id="wc-sen"><div id="wc-sen-en"></div><div id="wc-sen-cn"></div></div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="wc-foot">' +
                '<button id="wc-next" title="随机换一个难词">⟳ 换一个</button>' +
                '<button id="wc-prev" title="回到上一个词">↩ 撤销</button>' +
            '</div>';
        document.body.appendChild(p);
        var dt = new Date();
        $('wc-date').textContent = (dt.getMonth() + 1) + '月' + dt.getDate() + '日';
    }

    /* 长词收缩：先缩字号，缩到底再交给 CSS 省略号 */
    function fitOne(el, base, min) {
        el.style.fontSize = '';
        var size = base;
        while (el.scrollWidth > el.clientWidth && size > min) {
            size -= 2;
            el.style.fontSize = size + 'px';
        }
    }

    function render(idx, isToday) {
        var d = data[idx];
        state.i = idx;
        saveSession();
        /* 正面 */
        var w = $('wc-w');
        w.textContent = d.w; w.title = d.w;
        fitOne(w, 42, 20);
        var uk = $('wc-uk');
        uk.textContent = d.uk || ''; uk.title = d.uk || '';
        $('wc-tag').classList.toggle('on', !!isToday);
        /* 背面 */
        $('wc-bw').textContent = d.w;
        $('wc-buk').textContent = d.uk || '';
        var tr = $('wc-tr'), html = '';
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
        /* 还原提示语（打开时可能被设为"词库加载中"） */
        $('wc-hint').firstChild.textContent = '点击卡片，翻面看释义 ';
        /* 新词回到正面（自测流程） */
        var f = $('wc-flip');
        f.classList.remove('flipped');
        f.setAttribute('aria-pressed', 'false');
        if (panelEl().classList.contains('wc-show')) requestAnimationFrame(placePanel);
    }

    function showToday() {
        state.day = dayNumber();
        render(todayIndex(), true);
    }
    function showRandom() {
        if (state.i >= 0) {
            state.hist.push(state.i);
            if (state.hist.length > 30) state.hist.shift();
        }
        render(pickWeighted(), false);
        saveSession();
    }
    function undo() {
        if (!state.hist.length) return;
        render(state.hist.pop(), state.i === todayIndex());
        saveSession();
    }

    function loadData() {
        if (data || loading) return;
        loading = true;
        $('wc-hint').firstChild.textContent = '词库加载中，请稍候 ';
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
                loadSession();
                if (state.i >= 0 && state.i < data.length && state.day === dayNumber()) {
                    render(state.i, state.i === todayIndex());
                } else {
                    showToday();
                }
            })
            .catch(function () {
                $('wc-hint').firstChild.textContent = '词库加载失败，稍后重试 ';
                loading = false;
            });
    }

    /* ---------- 面板开关 ---------- */
    function placePanel() {
        var p = panelEl();
        if (window.innerWidth > 1024) {
            var item = document.getElementById('gq-menu-item');
            var y = 80;
            if (item) {
                var r = item.getBoundingClientRect();
                var h = p.offsetHeight || 420;
                y = Math.max(12, Math.min(r.top, window.innerHeight - h - 12));
            }
            var sidebar = document.querySelector('aside.left-sidebar');
            var sw = sidebar ? sidebar.getBoundingClientRect().right : 300;
            var x = Math.min(sw + 12, window.innerWidth - p.offsetWidth - 12);
            p.style.left = x + 'px'; p.style.right = 'auto';
            p.style.top = y + 'px'; p.style.bottom = 'auto';
            p.style.margin = '0';
            p.style.transform = 'none';
        } else {
            p.style.left = '0px'; p.style.right = '0px';
            p.style.top = 'auto'; p.style.bottom = '12px';
            p.style.margin = '0 auto';
            p.style.transform = 'none';
        }
    }
    function isOpen() { return panelEl().classList.contains('wc-show'); }
    function openPanel() {
        placePanel();
        panelEl().classList.add('wc-show');
        loadData();
        var sub = document.getElementById('gq-sub-word');
        if (sub) sub.classList.add('current');
        window.dispatchEvent(new CustomEvent('wc-opened'));
        requestAnimationFrame(placePanel);
    }
    function closePanel() {
        panelEl().classList.remove('wc-show');
        var sub = document.getElementById('gq-sub-word');
        if (sub) sub.classList.remove('current');
    }
    function togglePanel() { isOpen() ? closePanel() : openPanel(); }

    function initEvents() {
        $('wc-flip').addEventListener('click', function () {
            var f = $('wc-flip');
            f.classList.toggle('flipped');
            f.setAttribute('aria-pressed', String(f.classList.contains('flipped')));
        });
        $('wc-next').addEventListener('click', showRandom);
        $('wc-prev').addEventListener('click', undo);
        $('wc-close').addEventListener('click', closePanel);
        window.addEventListener('wc-toggle', togglePanel);
        window.addEventListener('gq-opened', function () { if (isOpen()) closePanel(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen()) closePanel();
        });
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
