/* 词卡·博客版 v1.0 —— 右下角每日一词挂件
 * 数据：/words/gaokao-3500.json（高考3668词，词频加权）
 * 逻辑：默认显示"今日一词"（按本地日期确定性轮转），刷新=词频加权随机，
 *       撤销=回退上一词；跨页面导航用 sessionStorage 保持当前词。
 */
(function () {
    'use strict';
    if (document.getElementById('wc-root')) return;

    var CSS = [
        '#wc-root{position:fixed;right:14px;bottom:14px;z-index:60;font-family:inherit;',
        'max-width:270px;width:calc(100vw - 28px);}',
        '#wc-badge{width:44px;height:44px;border-radius:50%;margin-left:auto;',
        'background:var(--accent-color,#0f8377);color:#fff;border:none;cursor:pointer;',
        'font-size:17px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.18);display:flex;',
        'align-items:center;justify-content:center;transition:transform .15s}',
        '#wc-badge:hover{transform:scale(1.08)}',
        '#wc-card{display:none;background:var(--card-background,#fff);border-radius:14px;',
        'box-shadow:0 8px 28px rgba(0,0,0,.18);border:1px solid var(--card-border-color,transparent);',
        'padding:12px 14px;animation:wc-rise .22s ease}',
        '#wc-root.wc-open #wc-card{display:block}',
        '#wc-root.wc-open #wc-badge{display:none}',
        '@keyframes wc-rise{from{transform:translateY(10px);opacity:0}}',
        '.wc-top{display:flex;align-items:baseline;gap:8px}',
        '.wc-word{font-size:21px;font-weight:700;color:var(--accent-color,#0f8377);',
        'word-break:break-word;line-height:1.25}',
        '.wc-ipa{font-size:12px;color:var(--body-text-color,#64748b);opacity:.75}',
        '.wc-tools{margin-left:auto;display:flex;gap:2px;flex:none}',
        '.wc-ico{border:none;background:none;cursor:pointer;font-size:14px;line-height:1;',
        'padding:3px 5px;border-radius:6px;color:var(--body-text-color,#64748b);opacity:.8}',
        '.wc-ico:hover{background:rgba(15,131,119,.1);opacity:1}',
        '.wc-tag{font-size:10.5px;color:#fff;background:var(--accent-color,#0f8377);',
        'border-radius:4px;padding:1px 5px;flex:none;align-self:center}',
        '.wc-tr{margin:7px 0 0;font-size:13px;line-height:1.55;color:var(--body-text-color,#334155)}',
        '.wc-sen{margin-top:8px;padding:6px 8px;border-left:3px solid var(--accent-color,#0f8377);',
        'background:rgba(15,131,119,.06);border-radius:0 6px 6px 0;font-size:12px;line-height:1.55}',
        '.wc-sen .wc-en{font-style:italic;display:block;color:var(--body-text-color,#1e293b)}',
        '.wc-sen .wc-cn{display:block;color:var(--body-text-color,#64748b);opacity:.85;margin-top:2px}',
        '.wc-foot{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}',
        '.wc-btn{border:1px solid var(--card-border-color,rgba(15,131,119,.35));background:none;',
        'cursor:pointer;border-radius:8px;padding:4px 12px;font-size:12.5px;',
        'color:var(--body-text-color,#334155);transition:.15s}',
        '.wc-btn:hover:not(:disabled){border-color:var(--accent-color,#0f8377);color:var(--accent-color,#0f8377)}',
        '.wc-btn:disabled{opacity:.4;cursor:not-allowed}',
        '.wc-btn.wc-main{background:var(--accent-color,#0f8377);color:#fff;border-color:transparent}',
        '.wc-btn.wc-main:hover:not(:disabled){filter:brightness(1.1);color:#fff}',
        '#wc-tip{font-size:12px;color:var(--body-text-color,#64748b);padding:2px 0 4px}',
        '@media (max-width:640px){#wc-root{max-width:240px}.wc-word{font-size:18px}}'
    ].join('');

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'wc-root';
    root.innerHTML =
        '<div id="wc-card" role="dialog" aria-label="每日一词">' +
        '  <div class="wc-top">' +
        '    <span class="wc-word" id="wc-w"></span>' +
        '    <span class="wc-tag" id="wc-tag" style="display:none">今日</span>' +
        '    <span class="wc-ipa" id="wc-ipa"></span>' +
        '    <span class="wc-tools">' +
        '      <button class="wc-ico" id="wc-tts" title="朗读">🔊</button>' +
        '      <button class="wc-ico" id="wc-min" title="收起">—</button>' +
        '    </span>' +
        '  </div>' +
        '  <div class="wc-tr" id="wc-tr"></div>' +
        '  <div class="wc-sen" id="wc-sen" style="display:none">' +
        '    <span class="wc-en" id="wc-en"></span><span class="wc-cn" id="wc-cn"></span>' +
        '  </div>' +
        '  <div class="wc-foot">' +
        '    <button class="wc-btn" id="wc-undo" disabled>↶ 撤销</button>' +
        '    <button class="wc-btn wc-main" id="wc-next">↻ 换一个</button>' +
        '  </div>' +
        '</div>' +
        '<button id="wc-badge" title="每日一词">词</button>';
    document.body.appendChild(root);

    var $ = function (id) { return document.getElementById(id); };
    var data = null, prefix = null, totalW = 0;

    /* ---------- 状态（跨页面保持） ---------- */
    function loadState() {
        try { return JSON.parse(sessionStorage.getItem('wc-state')) || null; }
        catch (e) { return null; }
    }
    function saveState() {
        try { sessionStorage.setItem('wc-state', JSON.stringify({
            i: state.i, hist: state.hist, day: state.day
        })); } catch (e) {}
    }
    var state = loadState() || { i: -1, hist: [], day: 0 };

    function dayNumber() {
        return Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
    }
    /* 今日词：确定性伪随机轮转，911 与 3668 互质 → 均匀覆盖全表 */
    function todayIndex() {
        return (dayNumber() * 911) % data.length;
    }

    /* ---------- 词频加权随机 ---------- */
    function pickWeighted(exclude) {
        for (var guard = 0; guard < 8; guard++) {
            var r = Math.random() * totalW, lo = 0, hi = prefix.length - 1;
            while (lo < hi) {
                var mid = (lo + hi) >> 1;
                if (prefix[mid] > r) hi = mid; else lo = mid + 1;
            }
            if (lo !== exclude) return lo;
        }
        return (exclude + 1) % data.length;
    }

    /* ---------- 渲染 ---------- */
    function render(i, isToday) {
        var e = data[i];
        state.i = i;
        state.day = dayNumber();
        saveState();
        $('wc-w').textContent = e.w;
        $('wc-tag').style.display = isToday ? '' : 'none';
        var ipa = e.uk ? ('/' + e.uk + '/') : '';
        if (e.us && e.us !== e.uk) ipa += '  /' + e.us + '/';
        $('wc-ipa').textContent = ipa;
        $('wc-tr').innerHTML = e.tr.map(function (t) {
            return '<div>' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</div>';
        }).join('');
        if (e.en && e.cn) {
            $('wc-en').textContent = e.en;
            $('wc-cn').textContent = e.cn;
            $('wc-sen').style.display = '';
        } else {
            $('wc-sen').style.display = 'none';
        }
        $('wc-undo').disabled = !state.hist.length;
    }

    function showToday() {
        var i = todayIndex();
        state.hist = [];
        render(i, true);
    }
    function next() {
        if (!data) return;
        if (state.i >= 0) { state.hist.push(state.i); if (state.hist.length > 30) state.hist.shift(); }
        render(pickWeighted(state.i), false);
    }
    function undo() {
        if (!data || !state.hist.length) return;
        render(state.hist.pop(), false);
    }

    /* ---------- 发音 ---------- */
    function speak() {
        if (!data || !window.speechSynthesis) return;
        var u = new SpeechSynthesisUtterance(data[state.i].w);
        u.lang = 'en-GB';
        u.rate = 0.9;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    }

    /* ---------- 事件 ---------- */
    $('wc-next').addEventListener('click', next);
    $('wc-undo').addEventListener('click', undo);
    $('wc-tts').addEventListener('click', speak);
    $('wc-min').addEventListener('click', function () {
        root.classList.remove('wc-open');
        try { localStorage.setItem('wc-collapsed', '1'); } catch (e) {}
    });
    $('wc-badge').addEventListener('click', function () {
        root.classList.add('wc-open');
        try { localStorage.removeItem('wc-collapsed'); } catch (e) {}
        if (state.i >= 0 && data && state.day === dayNumber()) render(state.i, state.i === todayIndex());
    });
    if (!window.speechSynthesis) $('wc-tts').style.display = 'none';

    /* ---------- 数据加载 ---------- */
    function onData(arr) {
        data = arr;
        prefix = new Array(arr.length);
        for (var i = 0; i < arr.length; i++) {
            totalW += arr[i].wt;
            prefix[i] = totalW;
        }
        /* 会话恢复：同一天内跨页面保持当前词；跨天则回到今日词 */
        if (state.i >= 0 && state.i < data.length && state.day === dayNumber()) {
            render(state.i, state.i === todayIndex());
        } else {
            showToday();
        }
    }

    var collapsed = false;
    try { collapsed = localStorage.getItem('wc-collapsed') === '1'; } catch (e) {}

    fetch('/words/gaokao-3500.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (arr) {
            onData(arr);
            if (!collapsed) root.classList.add('wc-open');
        })
        .catch(function () {
            /* 数据加载失败：卡片打开时给出提示，词区不空白 */
            if (!collapsed) root.classList.add('wc-open');
            $('wc-tr').innerHTML = '<div id="wc-tip">词库加载失败，稍后刷新页面试试</div>';
        });
})();
