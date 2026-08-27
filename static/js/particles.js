(function () {
/* 系统"减少动态效果"开启则整个跳过 */
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

var c = document.createElement('canvas');
var s = c.style;
s.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
document.body.appendChild(c);
var x = c.getContext('2d');

/* 粒子数量按屏幕面积算，手机自动更少；DPR 封顶 1.5 保老显卡 */
var W, H, DPR = Math.min(window.devicePixelRatio || 1, 1.5), P = [], N;
function size() {
    W = innerWidth; H = innerHeight;
    c.width = W * DPR; c.height = H * DPR;
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    N = Math.round(Math.min(60, Math.max(24, W * H / 26000)));
    if (P.length > N) P.length = N;
}
function mk(top) {
    return {
        x: Math.random() * W,
        y: top ? H + 12 : Math.random() * H,
        r: 0.8 + Math.random() * 2.0,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -(0.06 + Math.random() * 0.28),
        a: 0.10 + Math.random() * 0.30,
        ph: Math.random() * 6.28
    };
}
size();
addEventListener('resize', function () { size(); });
for (var i = 0; i < N; i++) P.push(mk(false));

var TAU = Math.PI * 2;
function tick() {
    if (!document.hidden) {           /* 切去别的标签页就原地暂停 */
        x.clearRect(0, 0, W, H);
        var dark = document.documentElement.dataset.scheme === 'dark';
        var col = dark ? '140, 230, 215' : '16, 131, 119';   /* 薄荷 / 湖水青 */
        for (var i = 0; i < P.length; i++) {
            var p = P[i];
            p.ph += 0.010;
            p.x += p.vx + Math.sin(p.ph) * 0.14;   /* 带一点横向摆动，像雾里游丝 */
            p.y += p.vy;
            if (p.y < -14 || p.x < -14 || p.x > W + 14) P[i] = mk(true);
            x.beginPath();
            x.arc(p.x, p.y, p.r, 0, TAU);
            x.fillStyle = 'rgba(' + col + ',' + p.a.toFixed(3) + ')';
            x.fill();
        }
    }
    requestAnimationFrame(tick);
}
tick();
})();
