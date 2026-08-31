/* 词卡·每日一词 v2.0 —— 右下角磨砂玻璃词卡
 * 交互：默认隐藏；鼠标进入右下角感应区（或移到卡片上）淡入，离开淡出。
 *       用 mousemove 坐标检测唤出，不用热区 div（会挡住角落点击，悠听 v3.2 的教训）。
 * 数据：/words/gaokao-3500.json（高考3668词，词频加权）。
 * 逻辑：今日词=本地日期确定性轮换；换一个=词频加权随机；撤销=回退上一词；
 *       跨页面导航用 sessionStorage 保持当前词。
 */
(function () {
    'use strict';
    if (document.getElementById('wc-root')) return;

    var CSS = [
        '#wc-root{position:fixed;right:12px;bottom:12px;z-index:60;',
            'width:min(300px,calc(100vw - 24px));',
            'opacity:0;visibility:hidden;transform:translateY(10px);pointer-events:none;',
            'transition:opacity .3s ease,transform .3s ease,visibility .3s;}',
        '#wc-root.wc-show{opacity:1;visibility:visible;transform:none;pointer-events:auto;}',

        '#wc-card{background:rgba(255,255,255,.60);',
            'backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);',
            'border:1px solid rgba(255,255,255,.65);border-radius:16px;',
            'box-shadow:0 10px 34px rgba(15,131,119,.18),0 2px 8px rgba(0,0,0,.05);',
            'padding:13px 15px 12px;color:var(--body-text-color,#3b4a54);}',
        'html[data-scheme="dark"] #wc-card{background:rgba(30,36,40,.62);',
            'border-color:rgba(255,255,255,.10);',
            'box-shadow:0 10px 34px rgba(0,0,0,.45);color:#c8d3d8;}',
        '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){',
            '#wc-card{background:var(--card-background,#fff);}}',

        '#wc-head{display:flex;align-items:baseline;gap:8px;min-width:0;}',
        '#wc-w{font-size:22px;font-weight:700;color:var(--accent-color,#0f8377);',
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
            'flex:0 0 auto;max-width:58%;min-width:0;}',
        '#wc-tag{flex-shrink:0;font-size:10.5px;line-height:1;padding:3px 6px;border-radius:6px;',
            'color:#fff;background:var(--accent-color,#0f8377);opacity:.85;white-space:nowrap;}',
        '#wc-ipa{flex:1 1 0;min-width:0;text-align:right;font-size:12px;',
            'color:var(--body-text-color,#3b4a54);opacity:.62;',
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',

        '#wc-tr{margin-top:7px;}',
        '.wc-line{display:flex;gap:6px;font-size:13px;line-height:1.55;margin-top:3px;min-width:0;}',
        '.wc-pos{flex-shrink:0;font-size:12px;font-weight:600;color:var(--accent-color,#0f8377);',
            'padding-top:1px;white-space:nowrap;}',
        '.wc-cn{flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;',
            'overflow:hidden;overflow-wrap:break-word;}',

        '#wc-sen{margin-top:8px;padding:7px 10px;border-left:3px solid var(--accent-color,#0f8377);',
            'background:rgba(15,131,119,.07);border-radius:0 10px 10px 0;}',
        'html[data-scheme="dark"] #wc-sen{background:rgba(255,255,255,.06);}',
        '#wc-en{font-style:italic;font-size:12.5px;line-height:1.5;',
            'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;',
            'overflow-wrap:break-word;}',
        '#wc-cnx{font-size:12px;opacity:.72;line-height:1.5;margin-top:2px;',
            'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',

        '#wc-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}',
        '#wc-btns button{font-family:inherit;font-size:12px;padding:5px 13px;border-radius:999px;',
            'cursor:pointer;transition:opacity .15s,transform .15s;border:1px solid transparent;}',
        '#wc-btns button:hover{transform:translateY(-1px);}',
        '#wc-undo{background:transparent;color:var(--body-text-color,#3b4a54);opacity:.75;',
            'border-color:currentColor!important;}',
        'html[data-scheme="dark"] #wc-undo{color:#c8d3d8;}',
        '#wc-next{background:var(--accent-color,#0f8377);color:#fff;}',
        '#wc-btns button:disabled{opacity:.35;cursor:default;transform:none;}',
        '#wc-tip{font-size:12px;opacity:.7;margin-top:6px;}'
    ].join('');

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'wc-root';
    root.innerHTML =
        '<div id="wc-card">' +
            '<div id="wc-head">' +
                '<span id="wc-w"></span>' +
                '<span id="wc-tag" style="display:none">今日</span>' +
                '<span id="wc-ipa"></span>' +
            '</div>' +
            '<div id="wc-tr"></div>' +
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

    function dayNumber() {
        return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
    }
    function todayIndex() { return (dayNumber() * 911) % data.length; }

    function saveSession() {
        try { sessionStorage.setItem('wc-state', JSON.stringify(state)); } catch (e) {}
    }
    function loadSession() {
        try {
            var s = JSON.parse(sessionStorage.getItem('wc-state') || 'null');
            if (s && typeof s.i === 'number') state = s;
        } catch (e) {}
    }

    function pickWeighted() {
        var r = Math.random() * totalW, lo = 0, hi = prefix.length - 1;
        while (lo < hi) {
            var mid = (lo + hi) >> 1;
            if (prefix[mid] <= r) lo = mid + 1; else hi = mid;
        }
        return lo === state.i ? (lo + 1) % data.length : lo;
    }

    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function render(idx, isToday) {
        var d = data[idx];
        state.i = idx;
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

    /* ---------- 悬停唤出（坐标检测，不用热区 div） ---------- */
    var ZONE_W = 170, ZONE_H = 240, HIDE_DELAY = 420;
    var hideTimer = null, shown = false;

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
        if (!shown) { shown = true; root.classList.add('wc-show'); }
    }
    function hideCard() {
        shown = false;
        root.classList.remove('wc-show');
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
                totalW += data[k].wt;
                prefix.push(totalW);
            }
            if (state.i >= 0 && state.i < data.length && state.day === dayNumber()) {
                render(state.i, state.i === todayIndex());
            } else {
                showToday();
            }
        })
        .catch(function () {
            $('wc-tr').innerHTML = '<div id="wc-tip">词库加载失败，稍后刷新页面试试</div>';
        });
})();
