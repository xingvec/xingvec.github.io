/* ============================================================
   悠听 · 博客版 v3.0
   由悠听 v2.2 油猴脚本移植：GM_* 换成 fetch + localStorage，
   其余交互与悠听保持一致。配合 youyin.css 使用。
   ============================================================ */
(function () {
    'use strict';

    /* ---------- 配置 ---------- */
    var API = 'https://api.qijieya.cn/meting/';
    var DEFAULT_PL = '3778678';   /* 首次打开自动加载的网易云歌单 */
    var SV = { volume: 'yy_vol', server: 'yy_srv', mode: 'yy_mode', pl: 'yy_pl' };

    /* ---------- 存储（替代 GM_getValue/setValue）---------- */
    function sget(k, d) {
        try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
        catch (e) { return d; }
    }
    function sset(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }

    /* ---------- 状态 ---------- */
    var audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = sget(SV.volume, 0.5);
    var queue = [], currentIndex = -1, lrcData = [], isPlaying = false;

    /* ---------- 网络（替代 GM_xmlhttpRequest，qijieya CORS 全开）---------- */
    function jget(url) {
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var ct = r.headers.get('content-type') || '';
            return ct.indexOf('json') !== -1 ? r.json() : r.text();
        });
    }
    function searchSongs(kw, page, limit) {
        var srv = sget(SV.server, 'netease');
        return jget(API + '?server=' + srv + '&type=search&id=' + encodeURIComponent(kw) +
            '&page=' + (page || 1) + '&limit=' + (limit || 30))
            .then(function (d) { return Array.isArray(d) ? d : []; });
    }
    function fetchPlaylist(pid) {
        var srv = sget(SV.server, 'netease');
        return jget(API + '?server=' + srv + '&type=playlist&id=' + pid)
            .then(function (d) { return Array.isArray(d) ? d : []; });
    }
    function fetchLrc(u) {
        if (!u) return Promise.resolve([]);
        return jget(u).then(parseLrc).catch(function () { return []; });
    }

    function parseLrc(text) {
        var lines = text.split('\n'), result = [];
        var re = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g;
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i], matches = [], m;
            re.lastIndex = 0;
            while ((m = re.exec(line)) !== null) matches.push(m);
            var txt = line.replace(re, '').trim();
            if (!txt && !matches.length) continue;
            for (var j = 0; j < matches.length; j++) {
                var min = parseInt(matches[j][1], 10), sec = parseInt(matches[j][2], 10);
                var ms = matches[j][3] ? parseInt(matches[j][3].padEnd(3, '0'), 10) : 0;
                result.push({ time: min * 60 + sec + ms / 1000, text: txt });
            }
        }
        return result.sort(function (a, b) { return a.time - b.time; });
    }

    function fmtTime(s) {
        if (!s || isNaN(s)) return '00:00';
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    }
    function esc(s) {
        var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML;
    }
    function loadingHTML() {
        return '<div class="yy-loading"><div class="spinner"></div><br>加载中...</div>';
    }

    /* ---------- UI ---------- */
    function buildUI() {
        var root = document.createElement('div');
        root.id = 'yy-player';
        root.innerHTML =
            '<div class="yy-panel-wrap" id="yy-panel">' +
              '<div class="yy-panel-handle" id="yy-panel-handle">' +
                '<div class="yy-tabs">' +
                  '<span class="yy-tab active" data-tab="search">搜索</span>' +
                  '<span class="yy-tab" data-tab="playlist">歌单</span>' +
                  '<span class="yy-tab" data-tab="lrc">歌词</span>' +
                '</div>' +
                '<span class="yy-panel-arrow" id="yy-panel-arrow">▸</span>' +
              '</div>' +
              '<div class="yy-panel-body">' +
                '<div class="yy-tab-content" data-content="search">' +
                  '<div class="yy-search-box">' +
                    '<input type="text" id="yy-search-input" placeholder="搜索歌曲、歌手..." />' +
                    '<button class="yy-search-btn" id="yy-search-btn">搜索</button>' +
                  '</div>' +
                  '<div class="yy-list" id="yy-search-list"></div>' +
                '</div>' +
                '<div class="yy-tab-content" data-content="playlist" style="display:none">' +
                  '<div class="yy-search-box">' +
                    '<input type="text" id="yy-playlist-input" placeholder="输入网易云歌单ID，如 2619366284" />' +
                    '<button class="yy-search-btn" id="yy-playlist-btn">加载</button>' +
                  '</div>' +
                  '<div class="yy-list" id="yy-playlist-list">' +
                    '<div class="yy-empty">输入歌单ID加载</div>' +
                  '</div>' +
                '</div>' +
                '<div class="yy-tab-content" data-content="lrc" style="display:none">' +
                  '<div class="yy-lrc" id="yy-lrc"><div class="yy-lrc-empty">暂无歌词，播放后自动加载</div></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="yy-base">' +
              '<div class="yy-now-playing">' +
                '<span class="yy-disc">' +
                  '<div class="yy-cover-ph" id="yy-cover-ph">♪</div>' +
                  '<img class="yy-cover" id="yy-cover-img" style="display:none" alt="封面" />' +
                '</span>' +
                '<div class="yy-np-info">' +
                  '<div class="yy-np-name" id="yy-np-name">未播放</div>' +
                  '<div class="yy-np-artist" id="yy-np-artist">—</div>' +
                '</div>' +
                '<span class="yy-server-badge" id="yy-server-badge">' + sget(SV.server, 'netease') + '</span>' +
                '<button class="yy-min-btn" id="yy-btn-min" title="最小化">—</button>' +
              '</div>' +
              '<div class="yy-progress-bar">' +
                '<span class="yy-time" id="yy-time-cur">00:00</span>' +
                '<div class="yy-progress" id="yy-progress"><div class="yy-progress-fill" id="yy-progress-fill"></div></div>' +
                '<span class="yy-time" id="yy-time-dur">00:00</span>' +
              '</div>' +
              '<div class="yy-controls">' +
                '<button class="yy-ctrl-btn" id="yy-btn-prev" title="上一首">«</button>' +
                '<button class="yy-play-btn" id="yy-btn-play" title="播放/暂停">▶</button>' +
                '<button class="yy-ctrl-btn" id="yy-btn-next" title="下一首">»</button>' +
                '<div class="yy-vol-wrap">' +
                  '<button class="yy-vol-btn" id="yy-vol-btn" title="音量">♪</button>' +
                  '<div class="yy-vol-pop">' +
                    '<div class="yy-vol-slider" id="yy-vol-slider"><div class="yy-vol-fill" id="yy-vol-fill"></div></div>' +
                    '<span class="yy-vol-num" id="yy-vol-num">50</span>' +
                  '</div>' +
                '</div>' +
                '<button class="yy-mode-btn" id="yy-btn-mode" title="播放模式">顺序</button>' +
              '</div>' +
            '</div>' +
            '<button class="yy-mini-play" id="yy-mini-play" title="播放/暂停">' +
              '<svg viewBox="0 0 24 24" id="yy-mini-play-svg"><path d="M8 5v14l11-7z"/></svg>' +
            '</button>';
        document.body.appendChild(root);
        bindEvents();
    }

    /* ---------- 事件 ---------- */
    function bindEvents() {
        var root = document.getElementById('yy-player');

        /* 抽屉整体折叠 */
        document.getElementById('yy-panel-handle').addEventListener('click', function (e) {
            if (e.target.closest('.yy-tab')) return;
            var panel = document.getElementById('yy-panel');
            panel.classList.toggle('open');
            document.getElementById('yy-panel-arrow').textContent =
                panel.classList.contains('open') ? '▾' : '▸';
        });

        /* 标签切换（点标签自动展开抽屉） */
        root.querySelectorAll('.yy-tab').forEach(function (tab) {
            tab.addEventListener('click', function (e) {
                e.stopPropagation();
                root.querySelectorAll('.yy-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                var target = tab.dataset.tab;
                root.querySelectorAll('.yy-tab-content').forEach(function (c) {
                    c.style.display = c.dataset.content === target ? '' : 'none';
                });
                document.getElementById('yy-panel').classList.add('open');
                document.getElementById('yy-panel-arrow').textContent = '▾';
                if (target === 'playlist') autoloadPlaylist();
            });
        });

        /* ---------- 最小化 / 恢复 / 闲置全隐 ---------- */
        /* v3.2: 隐身后不再放遮挡元素，改用鼠标接近检测唤出（不影响页面点击） */
        var IDLE_MS = 30000, idleTimer = null, probing = false;
        function disarmProximity() {
            if (probing) {
                probing = false;
                document.removeEventListener('mousemove', onProbe);
                document.removeEventListener('pointerdown', onProbe);
            }
        }
        function onProbe(e) {
            /* 左下角感应带：横向 90px × 纵向 170px 内算"停靠" */
            if (e.clientX <= 90 && (window.innerHeight - e.clientY) <= 170) {
                root.classList.remove('yy-hidden');
                disarmProximity();
                armIdleHide();
            }
        }
        function armProximity() {
            if (!probing) {
                probing = true;
                document.addEventListener('mousemove', onProbe);
                document.addEventListener('pointerdown', onProbe);
            }
        }
        function disarmIdleHide() {
            if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
            disarmProximity();
        }
        function armIdleHide() {
            disarmIdleHide();
            if (!root.classList.contains('yy-mini')) return;   /* 展开模式永不隐藏 */
            idleTimer = setTimeout(function () {
                root.classList.add('yy-hidden');
                armProximity();
            }, IDLE_MS);
        }

        document.getElementById('yy-btn-min').addEventListener('click', function () {
            root.classList.add('yy-mini');
            armIdleHide();
        });
        var restoreFn = function () {
            root.classList.remove('yy-mini');
            root.classList.remove('yy-hidden');
            disarmIdleHide();
        };
        document.getElementById('yy-cover-img').addEventListener('click', restoreFn);
        document.getElementById('yy-cover-ph').addEventListener('click', restoreFn);
        document.getElementById('yy-mini-play').addEventListener('click', togglePlay);

        /* 页面加载即进入迷你模式，30 秒无操作后完全隐身 */
        root.classList.add('yy-mini');
        armIdleHide();

        /* 数据源切换 */
        document.getElementById('yy-server-badge').addEventListener('click', function () {
            var cur = sget(SV.server, 'netease');
            var next = cur === 'netease' ? 'tencent' : 'netease';
            sset(SV.server, next);
            this.textContent = next;
        });

        /* 搜索 */
        var si = document.getElementById('yy-search-input');
        var doSearch = async function () {
            var kw = si.value.trim();
            if (!kw) return;
            var le = document.getElementById('yy-search-list');
            le.innerHTML = loadingHTML();
            try { renderList(le, await searchSongs(kw, 1, 30), true); }
            catch (e) {
                le.innerHTML = '<div class="yy-empty">搜索失败，请重试</div>';
            }
        };
        document.getElementById('yy-search-btn').addEventListener('click', doSearch);
        si.addEventListener('keydown', function (e) { if (e.key === 'Enter') doSearch(); });

        /* 歌单 */
        var pi = document.getElementById('yy-playlist-input');
        var loadPL = async function (pid) {
            var id = (pid || pi.value).trim();
            if (!id) return;
            var le = document.getElementById('yy-playlist-list');
            le.innerHTML = loadingHTML();
            try {
                var songs = await fetchPlaylist(id);
                sset(SV.pl, id);
                renderList(le, songs, false);
                if (songs.length > 0) { queue = songs; currentIndex = 0; await playIndex(0); }
            } catch (e) {
                le.innerHTML = '<div class="yy-empty">歌单加载失败</div>';
            }
        };
        document.getElementById('yy-playlist-btn').addEventListener('click', function () { loadPL(); });
        pi.addEventListener('keydown', function (e) { if (e.key === 'Enter') loadPL(); });
        var plLoaded = false;
        function autoloadPlaylist() {
            if (plLoaded) return;
            plLoaded = true;
            var saved = sget(SV.pl, DEFAULT_PL);
            if (saved) { pi.value = saved; loadPL(saved); }
        }

        /* 控制 */
        document.getElementById('yy-btn-play').addEventListener('click', togglePlay);
        document.getElementById('yy-btn-prev').addEventListener('click', playPrev);
        document.getElementById('yy-btn-next').addEventListener('click', playNext);

        /* 播放模式（v2.2 的 modeLabels 拼写修正） */
        var modeBtn = document.getElementById('yy-btn-mode');
        var modeLabels = ['顺序', '单曲', '随机'];
        var modeIdx = sget(SV.mode, 0) % 3;
        modeBtn.textContent = modeLabels[modeIdx];
        modeBtn.addEventListener('click', function () {
            modeIdx = (modeIdx + 1) % modeLabels.length;
            sset(SV.mode, modeIdx);
            modeBtn.textContent = modeLabels[modeIdx];
        });

        /* 音量：点 ♪ 弹竖向滑块，点外面关闭 */
        var volSlider = document.getElementById('yy-vol-slider');
        var volFill = document.getElementById('yy-vol-fill');
        var volNum = document.getElementById('yy-vol-num');
        function updateVolUI() {
            var pct = Math.round(audio.volume * 100);
            volFill.style.height = pct + '%';
            volNum.textContent = pct;
        }
        updateVolUI();
        function setVolFromY(clientY) {
            var r = volSlider.getBoundingClientRect();
            var v = 1 - (clientY - r.top) / r.height;
            audio.volume = Math.max(0, Math.min(1, v));
            sset(SV.volume, audio.volume);
            updateVolUI();
        }
        var volDragging = false;
        volSlider.addEventListener('mousedown', function (e) { volDragging = true; setVolFromY(e.clientY); });
        document.addEventListener('mousemove', function (e) { if (volDragging) setVolFromY(e.clientY); });
        document.addEventListener('mouseup', function () { volDragging = false; });
        document.getElementById('yy-vol-btn').addEventListener('click', function (e) {
            e.stopPropagation();
            this.closest('.yy-vol-wrap').classList.toggle('open');
        });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.yy-vol-wrap')) {
                var w = document.querySelector('.yy-vol-wrap');
                if (w) w.classList.remove('open');
            }
        });

        /* 进度条 */
        var prog = document.getElementById('yy-progress');
        prog.addEventListener('click', function (e) {
            if (!audio.duration) return;
            var r = prog.getBoundingClientRect();
            audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
        });

        /* audio 状态 */
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('play', function () {
            isPlaying = true;
            root.classList.add('yy-playing');
            document.getElementById('yy-btn-play').textContent = '⏸';
            document.getElementById('yy-mini-play-svg').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        });
        audio.addEventListener('pause', function () {
            isPlaying = false;
            root.classList.remove('yy-playing');
            document.getElementById('yy-btn-play').textContent = '▶';
            document.getElementById('yy-mini-play-svg').innerHTML = '<path d="M8 5v14l11-7z"/>';
        });
        audio.addEventListener('loadedmetadata', function () {
            document.getElementById('yy-time-dur').textContent = fmtTime(audio.duration);
        });

        /* 键盘：空格仅当抽屉展开时接管（博客里空格默认翻页，平时不抢） */
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            var panel = document.getElementById('yy-panel');
            if (e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); playNext(); return; }
            if (e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); playPrev(); return; }
            if (e.key === ' ' && panel.classList.contains('open')) { e.preventDefault(); togglePlay(); }
        });
    }

    /* ---------- 列表渲染 ---------- */
    function renderList(container, items, isSearch) {
        if (!items || !items.length) {
            container.innerHTML = '<div class="yy-empty">没有结果</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var s = items[i];
            var cur = !isSearch && i === currentIndex;
            html += '<div class="yy-item' + (cur ? ' playing' : '') + '" data-idx="' + i + '">' +
                '<span class="yy-item-num">' + (cur ? '▶' : (i + 1)) + '</span>' +
                '<div class="yy-item-info">' +
                '<div class="yy-item-name">' + esc(s.name || '未知') + '</div>' +
                '<div class="yy-item-artist">' + esc(s.artist || '未知歌手') + '</div>' +
                '</div></div>';
        }
        container.innerHTML = html;
        container.querySelectorAll('.yy-item').forEach(function (el) {
            el.addEventListener('click', function () {
                var idx = parseInt(el.dataset.idx, 10);
                queue = items; currentIndex = idx; playIndex(idx);
            });
        });
    }

    /* ---------- 播放核心 ---------- */
    async function playIndex(idx) {
        if (!queue.length || idx < 0 || idx >= queue.length) return;
        currentIndex = idx;
        var song = queue[idx];
        document.getElementById('yy-np-name').textContent = song.name || '未知';
        document.getElementById('yy-np-artist').textContent = song.artist || '未知歌手';
        var ci = document.getElementById('yy-cover-img');
        var cp = document.getElementById('yy-cover-ph');
        if (song.pic) {
            ci.src = song.pic; ci.style.display = ''; cp.style.display = 'none';
        } else {
            ci.style.display = 'none'; cp.style.display = '';
        }
        if ('mediaSession' in navigator) {   /* 系统媒体键 / 锁屏信息 */
            try {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: song.name || '', artist: song.artist || '',
                    artwork: song.pic ? [{ src: song.pic, sizes: '300x300' }] : []
                });
            } catch (e) {}
        }
        try { audio.src = song.url; audio.play(); } catch (e) {}
        lrcData = await fetchLrc(song.lrc);
        renderLrc();
        ['yy-search-list', 'yy-playlist-list'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.querySelectorAll('.yy-item').forEach(function (item) {
                var ii = parseInt(item.dataset.idx, 10);
                var c = ii === currentIndex;
                item.classList.toggle('playing', c);
                var n = item.querySelector('.yy-item-num');
                if (n) n.textContent = c ? '▶' : (ii + 1);
            });
        });
    }

    function togglePlay() {
        if (!audio.src) { if (queue.length > 0) playIndex(0); return; }
        if (isPlaying) audio.pause(); else audio.play();
    }
    function playNext() {
        if (!queue.length) return;
        var mode = sget(SV.mode, 0);
        if (mode === 1) { audio.currentTime = 0; audio.play(); return; }
        var next = mode === 2
            ? Math.floor(Math.random() * queue.length)
            : (currentIndex + 1) % queue.length;
        playIndex(next);
    }
    function playPrev() {
        if (!queue.length) return;
        playIndex((currentIndex - 1 + queue.length) % queue.length);
    }
    function onEnded() { playNext(); }

    function onTimeUpdate() {
        if (!audio.duration) return;
        var pct = (audio.currentTime / audio.duration) * 100;
        document.getElementById('yy-progress-fill').style.width = pct + '%';
        document.getElementById('yy-time-cur').textContent = fmtTime(audio.currentTime);
        if (lrcData.length) {
            var ai = -1;
            for (var i = 0; i < lrcData.length; i++) {
                if (audio.currentTime >= lrcData[i].time) ai = i; else break;
            }
            if (ai >= 0) {
                var els = document.querySelectorAll('.yy-lrc-line');
                els.forEach(function (el, i2) { el.classList.toggle('active', i2 === ai); });
                var ae = els[ai];
                if (ae) {
                    var c = document.getElementById('yy-lrc');
                    c.scrollTop = ae.offsetTop - c.clientHeight / 2 + ae.clientHeight / 2;
                }
            }
        }
    }

    function renderLrc() {
        var c = document.getElementById('yy-lrc');
        if (!lrcData.length) {
            c.innerHTML = '<div class="yy-lrc-empty">暂无歌词</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < lrcData.length; i++) {
            html += '<div class="yy-lrc-line" data-time="' + lrcData[i].time + '">' +
                esc(lrcData[i].text || '♪') + '</div>';
        }
        c.innerHTML = html;
        c.querySelectorAll('.yy-lrc-line').forEach(function (el) {
            el.addEventListener('click', function () {
                audio.currentTime = parseFloat(el.dataset.time);
            });
        });
    }

    /* ---------- 启动 ---------- */
    function init() {
        if (!document.body) { setTimeout(init, 100); return; }
        buildUI();
        /* 调试钩子：控制台可 window.__youyin.audio 直接查状态 */
        window.__youyin = { audio: audio, queue: function () { return queue; } };
    }
    init();
})();
