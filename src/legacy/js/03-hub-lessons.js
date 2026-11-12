

(function () {
/* ================= Engine: helpers, 3D projection, charts ================= */
var C = { bg: '#0A121D', surf: '#0E1826', ink: '#E8F0F6', muted: '#8FA4B6', line: '#23364B', teal: '#3CCFD0', coral: '#FF7A59', violet: '#A99BFF', amber: '#F2C14E', good: '#5BD68B', bad: '#FF8A80' };
var SQ = Math.SQRT1_2;
var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function store(get, key, val) {
  try { if (get) { return localStorage.getItem(key); } localStorage.setItem(key, val); } catch (e) { }
  return null;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(v, d) { var s = v.toFixed(d === undefined ? 3 : d); return /^-0\.?0*$/.test(s) ? s.replace('-', '') : s; }
function sci(v) {
  if (v === 0) { return '0'; }
  var e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
  return m.toFixed(2) + '×10' + String(e).replace(/\d/g, function (d) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(+d); }).replace('-', '⁻');
}
function bytesFmt(b) {
  var u = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'], i = 0;
  while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
  return (b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + ' ' + u[i];
}
function rand() { return Math.random(); }

/* canvas that keeps its backing store sharp and redraws on resize */
function setupCanvas(cv, draw) {
  var o = { w: 0, h: 0, dpr: 1, ctx: cv.getContext('2d') };
  o.redraw = function () {
    if (!o.w) { return; }
    o.ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
    o.ctx.clearRect(0, 0, o.w, o.h);
    draw(o.ctx, o.w, o.h);
  };
  function size() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) { return; }
    o.dpr = Math.min(window.devicePixelRatio || 1, 2);
    o.w = r.width; o.h = r.height;
    cv.width = Math.round(o.w * o.dpr); cv.height = Math.round(o.h * o.dpr);
    o.redraw();
  }
  if (window.ResizeObserver) { new ResizeObserver(size).observe(cv); } else { window.addEventListener('resize', size); }
  size();
  return o;
}

/* 3D: z is up, screen-right is y, depth toward the viewer is x (after yaw and tilt). */
function P3(p, cam, cx, cy, R) {
  var c = Math.cos(cam.az), s = Math.sin(cam.az);
  var x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c, z = p[2];
  var ce = Math.cos(cam.el), se = Math.sin(cam.el);
  var sx = y, sy = z * ce - x * se, d = x * ce + z * se;
  var k = 1 / (1 - clamp(d, -8, 8) * 0.1);
  return [cx + sx * k * R, cy - sy * k * R, d, k];
}
function makeDrag(cv, cam, redraw) {
  var d = null;
  cv.addEventListener('pointerdown', function (e) { d = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (_) { } });
  cv.addEventListener('pointermove', function (e) {
    if (!d) { return; }
    cam.az += (e.clientX - d.x) * 0.01;
    cam.el = clamp(cam.el + (e.clientY - d.y) * 0.008, -1.3, 1.3);
    d.x = e.clientX; d.y = e.clientY; redraw();
  });
  function end() { d = null; }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { cam.az -= 0.1; redraw(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { cam.az += 0.1; redraw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cam.el = clamp(cam.el + 0.08, -1.3, 1.3); redraw(); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { cam.el = clamp(cam.el - 0.08, -1.3, 1.3); redraw(); e.preventDefault(); }
  });
  cv.setAttribute('tabindex', '0'); cv.classList.add('drag');
}

/* ring (great circle) drawn with a solid front half and a dashed back half */
function ring3(ctx, cam, cx, cy, R, f, color, alpha) {
  var N = 96, prev = P3(f(0), cam, cx, cy, R), pf = new Path2D(), pb = new Path2D(), last = null, i, cur, front;
  for (i = 1; i <= N; i++) {
    cur = P3(f(i / N * Math.PI * 2), cam, cx, cy, R);
    front = (prev[2] + cur[2]) / 2 >= 0;
    if (front) { if (last !== true) { pf.moveTo(prev[0], prev[1]); } pf.lineTo(cur[0], cur[1]); }
    else { if (last !== false) { pb.moveTo(prev[0], prev[1]); } pb.lineTo(cur[0], cur[1]); }
    last = front; prev = cur;
  }
  ctx.strokeStyle = color; ctx.lineWidth = 1.1;
  ctx.setLineDash([]); ctx.globalAlpha = alpha; ctx.stroke(pf);
  ctx.setLineDash([3, 4]); ctx.globalAlpha = alpha * 0.45; ctx.stroke(pb);
  ctx.setLineDash([]); ctx.globalAlpha = 1;
}
function glow(ctx, x, y, r, color, a) {
  var g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}

/* Bloch sphere view (reused by several lessons) */
function BlochView(cv, o) {
  var self = this;
  o = o || {};
  self.v = [0, 0, 1]; self.trail = []; self.cam = { az: -0.62, el: 0.34 }; self.ghost = null; self.ghostLabel = '';
  self.ox = o.shadow !== false;
  self.cv = setupCanvas(cv, function (ctx, w, h) {
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.33, cam = self.cam, i;
    function P(p) { return P3(p, cam, cx, cy, R); }
    var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.05);
    g.addColorStop(0, 'rgba(60,207,208,0.20)'); g.addColorStop(1, 'rgba(60,207,208,0.03)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = C.muted; ctx.globalAlpha = 0.9; ctx.stroke(); ctx.globalAlpha = 1;
    ring3(ctx, cam, cx, cy, R, function (t) { return [Math.cos(t), Math.sin(t), 0]; }, C.muted, 0.8);
    ring3(ctx, cam, cx, cy, R, function (t) { return [Math.cos(t), 0, Math.sin(t)]; }, C.muted, 0.55);
    ring3(ctx, cam, cx, cy, R, function (t) { return [0, Math.cos(t), Math.sin(t)]; }, C.muted, 0.55);
    var axes = [[[1, 0, 0], '|+⟩', '|−⟩'], [[0, 1, 0], '|+i⟩', '|−i⟩'], [[0, 0, 1], '|0⟩', '|1⟩']];
    ctx.font = '500 12px "IBM Plex Mono", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    axes.forEach(function (ax) {
      var k = ax[0], a0 = P([-1.08 * k[0], -1.08 * k[1], -1.08 * k[2]]), a1 = P([1.08 * k[0], 1.08 * k[1], 1.08 * k[2]]);
      ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]);
      ctx.setLineDash([2, 4]); ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.strokeStyle = C.muted; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      var lp = P([1.3 * k[0], 1.3 * k[1], 1.3 * k[2]]), ln = P([-1.3 * k[0], -1.3 * k[1], -1.3 * k[2]]);
      ctx.fillStyle = C.ink; ctx.fillText(ax[1], lp[0], lp[1]); ctx.fillText(ax[2], ln[0], ln[1]);
    });
    /* trail */
    if (self.trail.length > 1) {
      ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (i = 1; i < self.trail.length; i++) {
        var a = P(self.trail[i - 1]), b = P(self.trail[i]);
        ctx.strokeStyle = C.coral; ctx.globalAlpha = 0.15 + 0.6 * i / self.trail.length;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (self.ghost) {
      var gp = P(self.ghost);
      ctx.strokeStyle = C.violet; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gp[0], gp[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(gp[0], gp[1], 4, 0, Math.PI * 2); ctx.fill();
      if (self.ghostLabel) { ctx.font = '11px "IBM Plex Mono", monospace'; ctx.fillText(self.ghostLabel, gp[0], gp[1] - 12); }
    }
    var v = self.v, tip = P(v), foot = P([v[0], v[1], 0]);
    if (self.ox) {
      ctx.strokeStyle = C.teal; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(foot[0], foot[1]); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = C.teal; ctx.beginPath(); ctx.arc(foot[0], foot[1], 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = C.coral; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    glow(ctx, tip[0], tip[1], 20, C.coral, 0.7);
    ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(tip[0], tip[1], 6, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.surf; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();
  });
  makeDrag(cv, self.cam, function () { self.cv.redraw(); });
  self.set = function (v) { self.v = v; self.cv.redraw(); };
  self.redraw = function () { self.cv.redraw(); };
}

/* 3D bar chart of basis-state probabilities; bar colour encodes phase */
function StateCity(cv, labels) {
  var self = this;
  self.cam = { az: -0.55, el: 0.5 }; self.p = []; self.ph = [];
  self.cv = setupCanvas(cv, function (ctx, w, h) {
    var n = self.p.length, cam = self.cam, cx = w / 2, cy = h * 0.58, R = Math.min(w * 0.42, h * 0.55), i;
    function P(p) { return P3(p, cam, cx, cy, R); }
    var span = 1.0, bw = span / n * 0.8, ys = [];
    for (i = 0; i < n; i++) { ys.push(-span + (i + 0.5) * 2 * span / n); }
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    [[-0.3, -span - 0.05, 0.3, -span - 0.05], [-0.3, span + 0.05, 0.3, span + 0.05]].forEach(function (l) {
      var a = P([l[0], l[1], 0]), b = P([l[2], l[3], 0]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    });
    var base = [P([-0.3, -span - 0.05, 0]), P([0.3, -span - 0.05, 0]), P([0.3, span + 0.05, 0]), P([-0.3, span + 0.05, 0])];
    ctx.beginPath(); ctx.moveTo(base[0][0], base[0][1]); for (i = 1; i < 4; i++) { ctx.lineTo(base[i][0], base[i][1]); } ctx.closePath();
    ctx.fillStyle = 'rgba(60,207,208,0.05)'; ctx.fill(); ctx.stroke();
    for (i = 0; i <= 4; i++) {
      var zz = i / 4 * 1.2, a0 = P([-0.3, -span - 0.05, zz]), a1 = P([-0.3, span + 0.05, zz]);
      ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke(); ctx.globalAlpha = 1;
    }
    var order = ys.map(function (y, k) { return k; });
    order.sort(function (a, b) { return P([0, ys[a], 0])[2] - P([0, ys[b], 0])[2]; });
    order.forEach(function (k) {
      var ht = Math.max(self.p[k] * 1.2, 0.004), y0 = ys[k] - bw / 2, y1 = ys[k] + bw / 2, x0 = -0.14, x1 = 0.14;
      var hue = ((self.ph[k] / (2 * Math.PI)) * 360 + 540) % 360;
      var V = [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [x0, y0, ht], [x1, y0, ht], [x1, y1, ht], [x0, y1, ht]].map(P);
      var faces = [[4, 5, 6, 7, 62], [0, 1, 5, 4, 42], [1, 2, 6, 5, 50], [2, 3, 7, 6, 36], [3, 0, 4, 7, 46]];
      faces.forEach(function (f) { f.d = (V[f[0]][2] + V[f[1]][2] + V[f[2]][2] + V[f[3]][2]) / 4; });
      faces.sort(function (a, b) { return a.d - b.d; });
      faces.forEach(function (f) {
        ctx.fillStyle = 'hsl(' + hue + ',70%,' + (self.p[k] < 0.002 ? 28 : f[4]) + '%)';
        ctx.beginPath(); ctx.moveTo(V[f[0]][0], V[f[0]][1]); ctx.lineTo(V[f[1]][0], V[f[1]][1]); ctx.lineTo(V[f[2]][0], V[f[2]][1]); ctx.lineTo(V[f[3]][0], V[f[3]][1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(6,11,20,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
      });
      var lp = P([0.34, ys[k], 0]);
      ctx.fillStyle = self.p[k] > 0.002 ? C.ink : C.muted; ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(labels[k], lp[0], lp[1] + 3);
    });
    ctx.fillStyle = C.muted; ctx.font = '11px "IBM Plex Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('height = probability, colour = phase, drag to rotate', 10, 8);
  });
  makeDrag(cv, self.cam, function () { self.cv.redraw(); });
  self.set = function (p, ph) { self.p = p; self.ph = ph; self.cv.redraw(); };
}

/* axes helper used by 2D plots */
function axes(ctx, bx, xs, ys, mx, my) {
  ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace'; ctx.lineWidth = 1;
  ctx.strokeStyle = C.line; ctx.fillStyle = C.muted;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  xs.forEach(function (t) { var x = mx(t[0]); ctx.beginPath(); ctx.moveTo(x, bx.y); ctx.lineTo(x, bx.y + bx.h); ctx.stroke(); ctx.fillText(t[1], x, bx.y + bx.h + 6); });
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ys.forEach(function (t) { var y = my(t[0]); ctx.beginPath(); ctx.moveTo(bx.x, y); ctx.lineTo(bx.x + bx.w, y); ctx.stroke(); ctx.fillText(t[1], bx.x - 6, y); });
}
function label(ctx, txt, x, y, color, align) { ctx.fillStyle = color || C.muted; ctx.font = '11px "IBM Plex Mono", ui-monospace, monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y); }

/* control builder: unique ids so form state survives republishing */
function ctl(pre, id, lab, min, max, val, step, outTxt) {
  return '<label class="ctl" for="' + pre + '-' + id + '"><span>' + lab + '</span><input type="range" id="' + pre + '-' + id + '" min="' + min + '" max="' + max + '" step="' + (step || 1) + '" value="' + val + '"><output id="' + pre + '-' + id + '-o">' + (outTxt || val) + '</output></label>';
}
function simHead(title, sub) { return '<div class="sim-head"><b>' + title + '</b><span>' + sub + '</span></div>'; }

/* tiny complex helpers */
function cmul(p, q) { return [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]]; }
function cadd(p, q) { return [p[0] + q[0], p[1] + q[1]]; }
function csub(p, q) { return [p[0] - q[0], p[1] - q[1]]; }
function csc(p, s) { return [p[0] * s, p[1] * s]; }
function conj(p) { return [p[0], -p[1]]; }
function n2(p) { return p[0] * p[0] + p[1] * p[1]; }
function rotV(v, k, ang) {
  var c = Math.cos(ang), s = Math.sin(ang), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  var cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)];
}
function blochOf(a, b) { var ab = cmul(conj(a), b); return [2 * ab[0], 2 * ab[1], n2(a) - n2(b)]; }
function binom(n, k) { var r = 1, i; for (i = 1; i <= k; i++) { r = r * (n - k + i) / i; } return r; }
function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }
function powmod(a, e, m) { var r = 1; a %= m; while (e > 0) { if (e & 1) { r = (r * a) % m; } a = (a * a) % m; e >>= 1; } return r; }
function binSample(n, p) { var c = 0, i; for (i = 0; i < n; i++) { if (Math.random() < p) { c++; } } return c; }

/* ================= Hero scene ================= */
function heroScene(cv) {
  var stars = [], i, T = 0, cam = { az: 0.4, el: 0.3 }, tgt = { az: 0.4, el: 0.3 }, running = true, drag = null, last = 0;
  for (i = 0; i < 520; i++) {
    var u = Math.random() * 2 - 1, ph = Math.random() * Math.PI * 2, rr = 2.4 + Math.random() * 4.5, s = Math.sqrt(1 - u * u);
    stars.push({ p: [rr * s * Math.cos(ph), rr * s * Math.sin(ph), rr * u], k: Math.random(), c: Math.random() < 0.25 ? C.violet : (Math.random() < 0.5 ? C.teal : '#FFFFFF') });
  }
  var o = setupCanvas(cv, function (ctx, w, h) {
    var wide = w > 760, cx = wide ? w * 0.7 : w * 0.5, cy = wide ? h * 0.5 : h * 0.62, R = Math.min(wide ? w * 0.26 : w * 0.34, h * 0.36);
    function P(p) { return P3(p, cam, cx, cy, R); }
    var i, q;
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < stars.length; i++) {
      var st = stars[i], a = T * 0.03, c = Math.cos(a), s = Math.sin(a);
      q = P([st.p[0] * c - st.p[1] * s, st.p[0] * s + st.p[1] * c, st.p[2]]);
      var al = clamp(0.25 + 0.12 * q[2], 0.08, 0.7) * (0.6 + 0.4 * Math.sin(T * 1.4 + st.k * 40));
      ctx.globalAlpha = al; ctx.fillStyle = st.c;
      ctx.beginPath(); ctx.arc(q[0], q[1], 0.7 + st.k * 1.1 * q[3], 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    /* sphere */
    var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, 'rgba(60,207,208,0.22)'); g.addColorStop(1, 'rgba(60,207,208,0.02)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.teal; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
    ring3(ctx, cam, cx, cy, R, function (t) { return [Math.cos(t), Math.sin(t), 0]; }, C.teal, 0.7);
    ring3(ctx, cam, cx, cy, R, function (t) { return [Math.cos(t), 0, Math.sin(t)]; }, C.teal, 0.4);
    ring3(ctx, cam, cx, cy, R, function (t) { return [0, Math.cos(t), Math.sin(t)]; }, C.teal, 0.4);
    [0.5, -0.5].forEach(function (zz) { var rr = Math.sqrt(1 - zz * zz); ring3(ctx, cam, cx, cy, R, function (t) { return [rr * Math.cos(t), rr * Math.sin(t), zz]; }, C.teal, 0.18); });
    /* orbits with electrons */
    var orbits = [[0.0, 1.0, 0.7], [1.05, -0.6, 0.45], [-0.9, 0.4, -0.55]];
    orbits.forEach(function (ob, k) {
      var rr = 1.75 + k * 0.28, ax = [Math.cos(ob[1]) * Math.cos(ob[0]), Math.sin(ob[1]), Math.cos(ob[1]) * Math.sin(ob[0])];
      function pt(t) { var v = [rr * Math.cos(t), rr * Math.sin(t), 0]; v = rotV(v, [1, 0, 0], ob[0] + 0.8); v = rotV(v, [0, 0, 1], ob[1] * 2); return v; }
      ring3(ctx, cam, cx, cy, R, function (t) { return pt(t); }, C.violet, 0.45);
      var t = T * (0.8 - k * 0.18) + k * 2, e = P(pt(t));
      ctx.globalCompositeOperation = 'lighter'; glow(ctx, e[0], e[1], 16 * e[3], C.teal, 0.85); ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#EFFFFF'; ctx.beginPath(); ctx.arc(e[0], e[1], 2.6 * e[3], 0, Math.PI * 2); ctx.fill();
    });
    /* entangled pair */
    var A = [0.2, -2.9, 0.8], B = [0.2, 2.9, 0.8], pa = P(A), pb = P(B);
    ctx.beginPath();
    var n = 60, j;
    for (j = 0; j <= n; j++) {
      var f = j / n, wv = Math.sin(f * 14 - T * 3) * 0.16 * Math.sin(f * Math.PI);
      var pp = P([A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + wv]);
      if (j === 0) { ctx.moveTo(pp[0], pp[1]); } else { ctx.lineTo(pp[0], pp[1]); }
    }
    ctx.strokeStyle = C.violet; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(T * 2); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, pa[0], pa[1], 22 * pa[3], C.violet, 0.9); glow(ctx, pb[0], pb[1], 22 * pb[3], C.violet, 0.9);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#F1EEFF'; ctx.beginPath(); ctx.arc(pa[0], pa[1], 4 * pa[3], 0, Math.PI * 2); ctx.arc(pb[0], pb[1], 4 * pb[3], 0, Math.PI * 2); ctx.fill();
    /* qubit vector */
    var th = 1.1 + 0.7 * Math.sin(T * 0.5), phi = T * 1.1, v = [Math.sin(th) * Math.cos(phi), Math.sin(th) * Math.sin(phi), Math.cos(th)];
    var tip = P(v);
    ctx.strokeStyle = C.coral; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, tip[0], tip[1], 26 * tip[3], C.coral, 0.9); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFE9E1'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 5.5 * tip[3], 0, Math.PI * 2); ctx.fill();
  });
  function frame(now) {
    if (!running) { return; }
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; T += dt;
    if (!drag) { tgt.az += dt * 0.12; }
    cam.az += (tgt.az - cam.az) * 0.08; cam.el += (tgt.el - cam.el) * 0.08;
    o.redraw(); requestAnimationFrame(frame);
  }
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (_) { } });
  cv.addEventListener('pointermove', function (e) {
    if (drag) { tgt.az += (e.clientX - drag.x) * 0.008; tgt.el = clamp(tgt.el + (e.clientY - drag.y) * 0.005, -0.2, 1.1); drag.x = e.clientX; drag.y = e.clientY; if (reduce) { cam.az = tgt.az; cam.el = tgt.el; o.redraw(); } }
    else if (e.pointerType === 'mouse') { var r = cv.getBoundingClientRect(); tgt.el = 0.15 + 0.35 * (e.clientY - r.top) / r.height; }
  });
  function end() { drag = null; }
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  if (reduce) { T = 3; cam.az = tgt.az; o.redraw(); return; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      var vis = en[0].isIntersecting;
      if (vis && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!vis) { running = false; }
    }).observe(cv);
  }
  requestAnimationFrame(frame);
}

/* ================= Simulations, part 1 ================= */
var SIMS = {};
function bindR(box, pre, id, fn, fm) {
  var el = box.querySelector('#' + pre + '-' + id), out = box.querySelector('#' + pre + '-' + id + '-o');
  function u() { var v = +el.value; out.textContent = fm ? fm(v) : v; fn(v); }
  el.addEventListener('input', u);
  return { el: el, out: out, update: u };
}
/* runs fn(t) every frame while the element is on screen; static draw when reduced motion is requested */
function animate(el, fn) {
  var running = false, t0 = performance.now();
  function f(now) { if (!running) { return; } fn((now - t0) / 1000); requestAnimationFrame(f); }
  if (reduce || !('IntersectionObserver' in window)) { fn(1.3); return function () { fn(1.3); }; }
  new IntersectionObserver(function (en) {
    var vis = en[0].isIntersecting;
    if (vis && !running) { running = true; requestAnimationFrame(f); } else if (!vis) { running = false; }
  }).observe(el);
  return function () { };
}

/* ---------- Why: state space ---------- */
SIMS.statespace = function (box) {
  var p = 'ss';
  box.innerHTML = simHead('Why classical simulation breaks down', 'memory to store n qubits') +
    '<canvas style="aspect-ratio:16/9" role="img" aria-label="Chart of memory needed to store a quantum state against the number of qubits"></canvas>' +
    ctl(p, 'n', 'Qubits n', 1, 70, 30, 1, '30') + '<div class="readout" id="ss-read"></div>' +
    '<div class="note">Full statevector, 16 bytes per complex amplitude. Smart methods such as tensor networks can simulate some structured circuits with far less, but not circuits in general.</div>';
  var n = 30;
  function lg(k) { return k * Math.LOG10E * Math.LN2 + Math.log10(16); }
  var cv = setupCanvas($('canvas', box), function (ctx, w, h) {
    var bx = { x: 50, y: 12, w: w - 66, h: h - 40 }, ymax = 24;
    function mx(v) { return bx.x + (v - 1) / 69 * bx.w; }
    function my(v) { return bx.y + bx.h - v / ymax * bx.h; }
    axes(ctx, bx, [[1, '1'], [10, '10'], [20, '20'], [30, '30'], [40, '40'], [50, '50'], [60, '60'], [70, '70']],
      [[3, 'kB'], [6, 'MB'], [9, 'GB'], [12, 'TB'], [15, 'PB'], [18, 'EB'], [21, 'ZB']], mx, my);
    [[Math.log10(16e9), 'laptop, 16 GB', C.amber], [16, 'large supercomputer, ~10 PB', C.violet]].forEach(function (r) {
      ctx.strokeStyle = r[2]; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(bx.x, my(r[0])); ctx.lineTo(bx.x + bx.w, my(r[0])); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, r[1], bx.x + 6, my(r[0]) - 8, r[2]);
    });
    ctx.beginPath(); for (var k = 1; k <= 70; k++) { var x = mx(k), y = my(lg(k)); if (k === 1) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } }
    ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; ctx.stroke();
    var xm = mx(n), ym = my(lg(n));
    glow(ctx, xm, ym, 18, C.coral, 0.8); ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(xm, ym, 5.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'n = number of qubits', bx.x + bx.w, bx.y + 6, C.muted, 'right');
  });
  var b = bindR(box, p, 'n', function (v) {
    n = v;
    var amps = n < 24 ? Math.pow(2, n).toLocaleString('en-US') : sci(Math.pow(2, n));
    var msg = n <= 30 ? 'fits on a laptop' : n <= 40 ? 'needs a large server' : n <= 50 ? 'needs a supercomputer-scale memory' : 'beyond storing the full state on any machine';
    $('#ss-read', box).innerHTML = '<b>' + n + ' qubits</b> hold <b>' + amps + '</b> amplitudes<br>Memory: <b>' + bytesFmt(Math.pow(2, n) * 16) + '</b>, which ' + msg + '.';
    cv.redraw();
  });
  b.update();
};

/* ---------- Why: scaling ---------- */
SIMS.scaling = function (box) {
  var p = 'sc';
  box.innerHTML = simHead('Factoring cost against key size', 'log scale, shape only') +
    '<canvas style="aspect-ratio:16/9" role="img" aria-label="Chart comparing how classical and quantum factoring costs grow with key size"></canvas>' +
    ctl(p, 'b', 'RSA bits', 256, 4096, 2048, 256, '2048') + '<div class="readout" id="sc-read"></div>' +
    '<div class="note">Classical: general number field sieve, exp(1.92 (ln N)^(1/3) (ln ln N)^(2/3)). Quantum: about n³ gates for Shor. Constant factors and error-correction overhead are left out.</div>';
  var bits = 2048;
  function gnfs(b) { var lnN = b * Math.LN2, ll = Math.log(lnN); return 1.923 * Math.pow(lnN, 1 / 3) * Math.pow(ll, 2 / 3) * Math.LOG10E; }
  function shor(b) { return 3 * Math.log10(b); }
  var cv = setupCanvas($('canvas', box), function (ctx, w, h) {
    var bx = { x: 46, y: 12, w: w - 62, h: h - 40 };
    function mx(v) { return bx.x + (v - 256) / (4096 - 256) * bx.w; }
    function my(v) { return bx.y + bx.h - v / 50 * bx.h; }
    axes(ctx, bx, [[256, '256'], [1024, '1024'], [2048, '2048'], [3072, '3072'], [4096, '4096']], [[0, '10⁰'], [10, '10¹⁰'], [20, '10²⁰'], [30, '10³⁰'], [40, '10⁴⁰'], [50, '10⁵⁰']], mx, my);
    [[gnfs, C.coral, 'classical'], [shor, C.teal, 'Shor']].forEach(function (s) {
      ctx.beginPath(); for (var b = 256; b <= 4096; b += 64) { var x = mx(b), y = my(s[0](b)); if (b === 256) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } }
      ctx.strokeStyle = s[1]; ctx.lineWidth = 2.5; ctx.stroke();
    });
    label(ctx, 'classical (sieve)', mx(1300), my(gnfs(1300)) - 14, C.coral);
    label(ctx, 'Shor (n³)', mx(1700), my(shor(1700)) - 12, C.teal);
    ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx(bits), bx.y); ctx.lineTo(mx(bits), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]);
    [[gnfs, C.coral], [shor, C.teal]].forEach(function (s) { ctx.fillStyle = s[1]; ctx.beginPath(); ctx.arc(mx(bits), my(s[0](bits)), 5, 0, Math.PI * 2); ctx.fill(); });
  });
  bindR(box, p, 'b', function (v) {
    bits = v;
    $('#sc-read', box).innerHTML = '<b>' + bits + '-bit key</b><br>Classical operations: about <b>10^' + gnfs(bits).toFixed(1) + '</b><br>Shor gate count: about <b>10^' + shor(bits).toFixed(1) + '</b><br>The gap is about <b>10^' + (gnfs(bits) - shor(bits)).toFixed(1) + '</b> and widens with key size.';
    cv.redraw();
  }).update();
};

/* ---------- Lesson: qubit ---------- */
SIMS.qubit = function (box) {
  var p = 'qb';
  box.innerHTML = simHead('Live qubit', 'Bloch sphere, drag to rotate') +
    '<canvas style="aspect-ratio:1/1;max-height:440px;margin-inline:auto" role="img" aria-label="Interactive Bloch sphere. Use arrow keys to rotate."></canvas>' +
    '<div class="readout" id="qb-ket"></div><div class="row" id="qb-g" role="group" aria-label="Apply a gate"></div>' +
    ctl(p, 'th', 'θ polar', 0, 180, 0, 1, '0°') + ctl(p, 'ph', 'φ phase', 0, 360, 0, 1, '0°') +
    '<div class="pr"><span>P(0)</span><div class="track"><div class="fill" id="qb-b0"></div></div><span class="v" id="qb-v0"></span></div>' +
    '<div class="pr"><span>P(1)</span><div class="track"><div class="fill" id="qb-b1"></div></div><span class="v" id="qb-v1"></span></div>' +
    '<div class="row"><button class="btn ghost sm" type="button" id="qb-reset">Reset to |0⟩</button><span class="note" id="qb-hist"></span></div>';
  var view = new BlochView($('canvas', box));
  var st = { a: [1, 0], b: [0, 0] }, hist = [], anim = 0;
  var G = {
    X: { ax: [1, 0, 0], ang: Math.PI, f: function (a, b) { return [b, a]; } },
    Y: { ax: [0, 1, 0], ang: Math.PI, f: function (a, b) { return [cmul([0, -1], b), cmul([0, 1], a)]; } },
    Z: { ax: [0, 0, 1], ang: Math.PI, f: function (a, b) { return [a, csc(b, -1)]; } },
    H: { ax: [SQ, 0, SQ], ang: Math.PI, f: function (a, b) { return [csc(cadd(a, b), SQ), csc(csub(a, b), SQ)]; } },
    S: { ax: [0, 0, 1], ang: Math.PI / 2, f: function (a, b) { return [a, cmul([0, 1], b)]; } },
    'S†': { ax: [0, 0, 1], ang: -Math.PI / 2, f: function (a, b) { return [a, cmul([0, -1], b)]; } },
    T: { ax: [0, 0, 1], ang: Math.PI / 4, f: function (a, b) { return [a, cmul([SQ, SQ], b)]; } },
    'T†': { ax: [0, 0, 1], ang: -Math.PI / 4, f: function (a, b) { return [a, cmul([SQ, -SQ], b)]; } }
  };
  function norm(a, b) {
    var n = Math.sqrt(n2(a) + n2(b)); a = csc(a, 1 / n); b = csc(b, 1 / n);
    var m = Math.sqrt(n2(a)); if (m > 1e-9) { var ph = [a[0] / m, -a[1] / m]; a = cmul(a, ph); b = cmul(b, ph); }
    return { a: a, b: b };
  }
  var th = bindR(box, p, 'th', function () { fromSliders(); }, function (v) { return v + '°'; });
  var ph = bindR(box, p, 'ph', function () { fromSliders(); }, function (v) { return v + '°'; });
  function sync() {
    var b = blochOf(st.a, st.b), t = Math.acos(clamp(b[2], -1, 1));
    th.el.value = Math.round(t * 180 / Math.PI); th.out.textContent = th.el.value + '°';
    if (Math.hypot(b[0], b[1]) > 1e-6) { var f = Math.atan2(b[1], b[0]); if (f < 0) { f += 2 * Math.PI; } ph.el.value = Math.round(f * 180 / Math.PI) % 360; ph.out.textContent = ph.el.value + '°'; }
  }
  function readout() {
    var p0 = n2(st.a), p1 = n2(st.b), ket;
    if (p1 < 1e-9) { ket = '1.000 |0⟩'; } else if (p0 < 1e-9) { ket = '1.000 |1⟩'; }
    else { var f = Math.atan2(st.b[1], st.b[0]) * 180 / Math.PI; if (f < 0) { f += 360; } ket = Math.sqrt(p0).toFixed(3) + ' |0⟩ + ' + Math.sqrt(p1).toFixed(3) + ' e^(i·' + Math.round(f) + '°) |1⟩'; }
    var b = blochOf(st.a, st.b);
    $('#qb-ket', box).innerHTML = '|ψ⟩ = <b>' + ket + '</b><br>x = ' + fmt(b[0]) + '   y = ' + fmt(b[1]) + '   z = ' + fmt(b[2]);
    $('#qb-b0', box).style.width = (p0 * 100) + '%'; $('#qb-b1', box).style.width = (p1 * 100) + '%';
    $('#qb-v0', box).textContent = (p0 * 100).toFixed(1) + '%'; $('#qb-v1', box).textContent = (p1 * 100).toFixed(1) + '%';
    $('#qb-hist', box).textContent = hist.length ? hist.slice(-10).join(' → ') : 'no gates applied';
  }
  function fromSliders() {
    cancelAnimationFrame(anim);
    var t = +th.el.value * Math.PI / 180, f = +ph.el.value * Math.PI / 180;
    st = { a: [Math.cos(t / 2), 0], b: [Math.cos(f) * Math.sin(t / 2), Math.sin(f) * Math.sin(t / 2)] };
    hist = []; view.trail = []; view.set(blochOf(st.a, st.b)); readout();
  }
  function apply(name) {
    var g = G[name], from = blochOf(st.a, st.b), r = g.f(st.a, st.b);
    st = norm(r[0], r[1]); hist.push(name);
    var to = blochOf(st.a, st.b); cancelAnimationFrame(anim); view.trail = [];
    sync(); readout();
    if (reduce) { view.set(to); return; }
    var t0 = performance.now(), dur = 560;
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var v = rotV(from, g.ax, g.ang * e); view.trail.push(v); if (view.trail.length > 70) { view.trail.shift(); }
      view.set(v);
      if (t < 1) { anim = requestAnimationFrame(step); } else { view.set(to); }
    })(t0);
  }
  Object.keys(G).forEach(function (k) {
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'gb'; bt.textContent = k; bt.setAttribute('aria-label', 'Apply ' + k + ' gate');
    bt.addEventListener('click', function () { apply(k); }); $('#qb-g', box).appendChild(bt);
  });
  $('#qb-reset', box).addEventListener('click', function () { cancelAnimationFrame(anim); st = { a: [1, 0], b: [0, 0] }; hist = []; view.trail = []; sync(); view.set([0, 0, 1]); readout(); });
  readout();
};

/* ---------- Lesson: superposition and measurement ---------- */
SIMS.superposition = function (box) {
  var p = 'sp';
  box.innerHTML = simHead('Born rule sampler', 'measure the same state again and again') +
    '<canvas style="aspect-ratio:16/10" role="img" aria-label="Histogram of measurement counts and convergence of the estimated probability"></canvas>' +
    ctl(p, 'th', 'State θ', 0, 180, 66, 1, '66°') +
    '<div class="row"><button class="btn sm" type="button" data-n="1">+1 shot</button><button class="btn sm" type="button" data-n="10">+10</button><button class="btn sm" type="button" data-n="100">+100</button><button class="btn sm" type="button" data-n="1000">+1000</button><button class="btn ghost sm" type="button" id="sp-reset">Reset</button></div>' +
    '<div class="readout" id="sp-read"></div>';
  var p1 = 0, n0 = 0, n1 = 0, pts = [], cps = [], ci = 0;
  [1, 1.5, 2, 3, 5, 7].forEach(function (m) { for (var e = 0; e < 5; e++) { cps.push(Math.round(m * Math.pow(10, e))); } });
  cps = cps.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  var cv = setupCanvas($('canvas', box), function (ctx, w, h) {
    var n = n0 + n1, L = { x: 40, y: 22, w: w * 0.3, h: h - 52 }, Rg = { x: w * 0.46, y: 22, w: w * 0.54 - 16, h: h - 52 };
    function myL(v) { return L.y + L.h - v * L.h; }
    axes(ctx, L, [], [[0, '0'], [0.5, '0.5'], [1, '1']], function () { return 0; }, myL);
    label(ctx, 'fraction of shots', L.x, 8, C.muted);
    var bw = L.w * 0.32;
    [[0, n0, C.teal, '|0⟩'], [1, n1, C.coral, '|1⟩']].forEach(function (b) {
      var x = L.x + L.w * (0.2 + b[0] * 0.45), fr = n ? b[1] / n : 0;
      ctx.fillStyle = b[2]; ctx.globalAlpha = 0.9; ctx.fillRect(x, myL(fr), bw, L.y + L.h - myL(fr)); ctx.globalAlpha = 1;
      var tp = b[0] ? p1 : 1 - p1;
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, myL(tp)); ctx.lineTo(x + bw + 6, myL(tp)); ctx.stroke();
      label(ctx, b[3], x + bw / 2, L.y + L.h + 16, C.ink, 'center');
    });
    label(ctx, 'amber = theory', L.x + 4, L.y + L.h + 30, C.amber);
    function mxR(nn) { return Rg.x + Math.log10(Math.max(1, nn)) / 4 * Rg.w; }
    function myR(v) { return Rg.y + Rg.h - v * Rg.h; }
    axes(ctx, Rg, [[1, '1'], [10, '10'], [100, '100'], [1000, '1k'], [10000, '10k']], [[0, '0'], [0.5, '0.5'], [1, '1']], mxR, myR);
    label(ctx, 'estimate of P(1) against shots', Rg.x, 8, C.muted);
    ctx.beginPath(); var k, nn, s;
    for (k = 0; k <= 80; k++) { nn = Math.pow(10, k / 20); s = 2 * Math.sqrt(p1 * (1 - p1) / nn); var yy = myR(clamp(p1 + s, 0, 1)); if (k === 0) { ctx.moveTo(mxR(nn), yy); } else { ctx.lineTo(mxR(nn), yy); } }
    for (k = 80; k >= 0; k--) { nn = Math.pow(10, k / 20); s = 2 * Math.sqrt(p1 * (1 - p1) / nn); ctx.lineTo(mxR(nn), myR(clamp(p1 - s, 0, 1))); }
    ctx.closePath(); ctx.fillStyle = 'rgba(242,193,78,0.16)'; ctx.fill();
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(Rg.x, myR(p1)); ctx.lineTo(Rg.x + Rg.w, myR(p1)); ctx.stroke();
    if (pts.length) {
      ctx.beginPath(); pts.forEach(function (q, i) { var x = mxR(q[0]), y = myR(q[1]); if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); } });
      ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.stroke();
      var q = pts[pts.length - 1]; ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(mxR(q[0]), myR(q[1]), 4, 0, Math.PI * 2); ctx.fill();
    }
  });
  function readout() {
    var n = n0 + n1, est = n ? n1 / n : 0, se = n ? Math.sqrt(p1 * (1 - p1) / n) : 0;
    $('#sp-read', box).innerHTML = 'True P(1) = <b>' + (p1 * 100).toFixed(1) + '%</b>   shots = <b>' + n + '</b> (|0⟩: ' + n0 + ', |1⟩: ' + n1 + ')<br>' +
      (n ? 'Estimate = <b>' + (est * 100).toFixed(1) + '%</b>, expected spread ±' + (se * 100).toFixed(1) + '% (one standard error)' : 'No shots yet. Press a button to measure.');
  }
  function reset() { n0 = 0; n1 = 0; pts = []; ci = 0; readout(); cv.redraw(); }
  bindR(box, p, 'th', function (v) { p1 = Math.pow(Math.sin(v * Math.PI / 360), 2); reset(); }, function (v) { return v + '°'; }).update();
  $$('button[data-n]', box).forEach(function (bt) {
    bt.addEventListener('click', function () {
      var k = +bt.getAttribute('data-n'), i;
      for (i = 0; i < k; i++) { if (Math.random() < p1) { n1++; } else { n0++; } var n = n0 + n1; if (n >= cps[ci]) { pts.push([n, n1 / n]); while (ci < cps.length && cps[ci] <= n) { ci++; } } }
      var nn = n0 + n1; if (!pts.length || pts[pts.length - 1][0] !== nn) { pts.push([nn, n1 / nn]); }
      readout(); cv.redraw();
    });
  });
  $('#sp-reset', box).addEventListener('click', reset);
};

/* ---------- Lesson: interference ---------- */
SIMS.interference = function (box) {
  var p = 'if';
  box.innerHTML = simHead('Mach–Zehnder interferometer', 'one photon, two paths') +
    '<canvas id="if-a" style="aspect-ratio:16/10" role="img" aria-label="Interferometer with two arms and two detectors"></canvas>' +
    ctl(p, 'phi', 'Phase φ', 0, 360, 0, 1, '0°') +
    '<label class="row" for="if-blk" style="font-size:14px;gap:10px"><input type="checkbox" id="if-blk" style="width:18px;height:18px;accent-color:var(--coral)"> Block lower arm (learn which path)</label>' +
    '<canvas id="if-b" style="aspect-ratio:16/5" role="img" aria-label="Detector probabilities against phase"></canvas>' +
    '<div class="row"><button class="btn sm" type="button" id="if-send">Send 200 photons</button></div><div class="readout" id="if-read"></div>';
  var phi = 0, blocked = false;
  function probs() { var c = Math.pow(Math.cos(phi / 2), 2), s = 1 - c; return blocked ? [0.25, 0.25, 0.5] : [c, s, 0]; }
  function along(pts, f) {
    var len = [], tot = 0, i;
    for (i = 1; i < pts.length; i++) { var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(d); tot += d; }
    var target = clamp(f, 0, 1) * tot, acc = 0;
    for (i = 0; i < len.length; i++) { if (acc + len[i] >= target) { var u = (target - acc) / len[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; } acc += len[i]; }
    return pts[pts.length - 1];
  }
  var T = 0;
  var cvA = setupCanvas($('#if-a', box), function (ctx, w, h) {
    function Q(x, y) { return [x * w, y * h]; }
    var S = Q(0.05, 0.8), B1 = Q(0.26, 0.8), MA = Q(0.26, 0.3), B2 = Q(0.68, 0.3), MB = Q(0.68, 0.8), D0 = Q(0.94, 0.3), D1 = Q(0.68, 0.08);
    var pr = probs(), i;
    function seg(a, b, col, al, lw) { ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = 1; }
    [[S, B1], [B1, MA], [MA, B2], [B1, MB], [MB, B2], [B2, D0], [B2, D1]].forEach(function (s) { seg(s[0], s[1], C.muted, 0.55, 1.5); });
    /* components */
    ctx.fillStyle = C.surf; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    [B1, B2].forEach(function (b) { ctx.save(); ctx.translate(b[0], b[1]); ctx.rotate(-Math.PI / 4); ctx.fillStyle = 'rgba(60,207,208,0.25)'; ctx.fillRect(-16, -3, 32, 6); ctx.strokeRect(-16, -3, 32, 6); ctx.restore(); });
    [MA, MB].forEach(function (m, k) { ctx.save(); ctx.translate(m[0], m[1]); ctx.rotate(Math.PI / 4); ctx.fillStyle = C.muted; ctx.fillRect(-14, -2, 28, 4); ctx.restore(); });
    var ps = Q(0.47, 0.3); ctx.fillStyle = C.violet; ctx.globalAlpha = 0.9; ctx.fillRect(ps[0] - 17, ps[1] - 12, 34, 24); ctx.globalAlpha = 1;
    label(ctx, 'φ', ps[0], ps[1], C.bg, 'center');
    var bk = Q(0.47, 0.8);
    if (blocked) { ctx.fillStyle = C.bad; ctx.fillRect(bk[0] - 4, bk[1] - 18, 8, 36); label(ctx, 'block', bk[0], bk[1] + 30, C.bad, 'center'); }
    label(ctx, 'source', S[0], S[1] + 20, C.muted, 'left'); label(ctx, 'splitter', B1[0] + 20, B1[1] + 22, C.muted);
    [[D0, 'D0', pr[0]], [D1, 'D1', pr[1]]].forEach(function (d) {
      glow(ctx, d[0][0], d[0][1], 14 + 34 * d[2], C.teal, 0.25 + 0.7 * d[2]);
      ctx.fillStyle = C.surf; ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(d[0][0], d[0][1], 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      label(ctx, d[1], d[0][0], d[0][1], C.ink, 'center');
      label(ctx, Math.round(d[2] * 100) + '%', d[0][0], d[0][1] + (d[1] === 'D0' ? 26 : -22), C.teal, 'center');
    });
    /* photon */
    var u = (T % 3.4) / 3.4, A = [B1, MA, B2], Bp = [B1, MB, B2];
    function dot(pt, col, al, r) { glow(ctx, pt[0], pt[1], r * 3.2, col, al * 0.8); ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    if (u < 0.22) { dot(along([S, B1], u / 0.22), C.coral, 1, 5); }
    else if (u < 0.7) {
      var f = (u - 0.22) / 0.48;
      dot(along(A, f), C.coral, 0.85, 5);
      if (!blocked || f < 0.24) { dot(along(Bp, f), C.coral, 0.85, 5); }
    } else {
      var g = (u - 0.7) / 0.3;
      if (pr[0] > 0.001) { dot(along([B2, D0], g), C.coral, clamp(pr[0] * 1.6, 0.15, 1), 5); }
      if (pr[1] > 0.001) { dot(along([B2, D1], g), C.coral, clamp(pr[1] * 1.6, 0.15, 1), 5); }
    }
  });
  var cvB = setupCanvas($('#if-b', box), function (ctx, w, h) {
    var bx = { x: 40, y: 12, w: w - 56, h: h - 36 };
    function mx(v) { return bx.x + v / 360 * bx.w; } function my(v) { return bx.y + bx.h - v * bx.h; }
    axes(ctx, bx, [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°'], [360, '360°']], [[0, '0'], [0.5, '0.5'], [1, '1']], mx, my);
    [[0, C.teal, 'D0'], [1, C.coral, 'D1']].forEach(function (s) {
      ctx.beginPath();
      for (var d = 0; d <= 360; d += 4) {
        var c = Math.pow(Math.cos(d * Math.PI / 360), 2), v = blocked ? 0.25 : (s[0] ? 1 - c : c);
        if (d === 0) { ctx.moveTo(mx(d), my(v)); } else { ctx.lineTo(mx(d), my(v)); }
      }
      ctx.strokeStyle = s[1]; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx(phi * 180 / Math.PI), bx.y); ctx.lineTo(mx(phi * 180 / Math.PI), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'D0', bx.x + bx.w - 4, my(0.9), C.teal, 'right'); label(ctx, 'D1', bx.x + bx.w - 4, my(0.1), C.coral, 'right');
  });
  var stopAnim = animate($('#if-a', box), function (t) { T = t; cvA.redraw(); });
  function readout(extra) {
    var pr = probs();
    $('#if-read', box).innerHTML = 'P(D0) = <b>' + (pr[0] * 100).toFixed(1) + '%</b>   P(D1) = <b>' + (pr[1] * 100).toFixed(1) + '%</b>' + (blocked ? '   absorbed = <b>' + (pr[2] * 100).toFixed(0) + '%</b>' : '') + (extra ? '<br>' + extra : '');
  }
  bindR(box, p, 'phi', function (v) { phi = v * Math.PI / 180; readout(); cvA.redraw(); cvB.redraw(); }, function (v) { return v + '°'; });
  $('#if-blk', box).addEventListener('change', function (e) { blocked = e.target.checked; readout(); cvA.redraw(); cvB.redraw(); });
  $('#if-send', box).addEventListener('click', function () {
    var pr = probs(), c0 = 0, c1 = 0, ab = 0, i;
    for (i = 0; i < 200; i++) { var r = Math.random(); if (r < pr[0]) { c0++; } else if (r < pr[0] + pr[1]) { c1++; } else { ab++; } }
    readout('200 photons: D0 = <b>' + c0 + '</b>, D1 = <b>' + c1 + '</b>' + (blocked ? ', absorbed = <b>' + ab + '</b>' : ''));
  });
  readout();
};

/* ---------- Lesson: entanglement and CHSH ---------- */
SIMS.entanglement = function (box) {
  var p = 'en';
  box.innerHTML = simHead('Bell (CHSH) experiment', 'singlet pairs, E(a,b) = −cos(a − b)') +
    '<canvas style="aspect-ratio:16/7" role="img" aria-label="Bar showing the measured CHSH score against the classical and quantum bounds"></canvas>' +
    ctl(p, 'a', 'Alice a', 0, 360, 0, 1, '0°') + ctl(p, 'a2', 'Alice a′', 0, 360, 90, 1, '90°') + ctl(p, 'b', 'Bob b', 0, 360, 45, 1, '45°') + ctl(p, 'b2', 'Bob b′', 0, 360, 135, 1, '135°') +
    '<div class="row"><button class="btn sm" type="button" id="en-run">Run experiment (4 × 4000 pairs)</button><button class="btn ghost sm" type="button" id="en-opt">Optimal angles</button><button class="btn ghost sm" type="button" id="en-zero">All zero</button></div>' +
    '<div class="readout" id="en-read"></div>';
  var ang = [0, 90, 45, 135], meas = null;
  var el = ['a', 'a2', 'b', 'b2'].map(function (id, i) { return bindR(box, p, id, function (v) { ang[i] = v; meas = null; show(); }, function (v) { return v + '°'; }); });
  function E(a, b) { return -Math.cos((a - b) * Math.PI / 180); }
  function Sth() { return E(ang[0], ang[2]) - E(ang[0], ang[3]) + E(ang[1], ang[2]) + E(ang[1], ang[3]); }
  function sample(a, b, n) {
    var pe = (1 - Math.cos((a - b) * Math.PI / 180)) / 2, s = 0, i;
    for (i = 0; i < n; i++) { var A = Math.random() < 0.5 ? 1 : -1, B = Math.random() < pe ? A : -A; s += A * B; }
    return s / n;
  }
  var cv = setupCanvas($('canvas', box), function (ctx, w, h) {
    var bx = { x: 20, y: 18, w: w - 40, h: h - 56 };
    function mx(v) { return bx.x + v / 4 * bx.w; }
    axes(ctx, bx, [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], [], mx, function () { return 0; });
    var th = Math.abs(Sth()), bh = bx.h * 0.36;
    ctx.fillStyle = C.teal; ctx.globalAlpha = 0.35; ctx.fillRect(bx.x, bx.y + bx.h * 0.1, mx(th) - bx.x, bh); ctx.globalAlpha = 1;
    label(ctx, 'theory |S| = ' + th.toFixed(2), bx.x + 6, bx.y + bx.h * 0.1 + bh / 2, C.ink);
    if (meas !== null) { ctx.fillStyle = C.coral; ctx.fillRect(bx.x, bx.y + bx.h * 0.55, mx(Math.abs(meas)) - bx.x, bh); label(ctx, 'measured |S| = ' + Math.abs(meas).toFixed(2), bx.x + 6, bx.y + bx.h * 0.55 + bh / 2, C.bg); }
    [[2, C.amber, 'classical limit 2'], [2.828, C.violet, 'quantum limit 2.83']].forEach(function (l, i) {
      ctx.strokeStyle = l[1]; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(mx(l[0]), bx.y - 2); ctx.lineTo(mx(l[0]), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, l[2], mx(l[0]) + (i ? 6 : -6), bx.y + 6 + i * 0, l[1], i ? 'left' : 'right');
    });
  });
  function show() {
    var s = Sth(), t = Math.abs(s);
    $('#en-read', box).innerHTML = 'Quantum prediction: S = <b>' + s.toFixed(3) + '</b> ' + (t > 2.0001 ? '<span class="ok">beats the classical bound of 2</span>' : '<span class="no">within the classical bound of 2</span>') +
      (meas !== null ? '<br>Measured S = <b>' + meas.toFixed(3) + '</b> from 16,000 simulated pairs (statistical error about 0.03)' : '<br>Press Run experiment to sample pairs.');
    cv.redraw();
  }
  $('#en-run', box).addEventListener('click', function () {
    var n = 4000; meas = sample(ang[0], ang[2], n) - sample(ang[0], ang[3], n) + sample(ang[1], ang[2], n) + sample(ang[1], ang[3], n); show();
  });
  function setAll(arr) { arr.forEach(function (v, i) { el[i].el.value = v; el[i].out.textContent = v + '°'; ang[i] = v; }); meas = null; show(); }
  $('#en-opt', box).addEventListener('click', function () { setAll([0, 90, 45, 135]); });
  $('#en-zero', box).addEventListener('click', function () { setAll([0, 0, 0, 0]); });
  show();
};

/* ---------- Lesson: circuit builder ---------- */
SIMS.circuit = function (box) {
  var NQ = 3, NC = 8, p = 'cc', sel = 'H', cols = [], c, labels = [];
  for (c = 0; c < NC; c++) { cols.push([null, null, null]); }
  for (c = 0; c < 8; c++) { labels.push('|' + ((c >> 2) & 1) + ((c >> 1) & 1) + (c & 1) + '⟩'); }
  var PAL = [['H', 'H'], ['X', 'X'], ['Y', 'Y'], ['Z', 'Z'], ['S', 'S'], ['T', 'T'], ['CX', 'CNOT'], ['CZ', 'CZ'], ['E', 'Erase']];
  box.innerHTML = simHead('Three-qubit circuit builder', 'pick a gate, click a cell') +
    '<div class="row" id="cc-pal" role="group" aria-label="Gate palette"></div>' +
    '<div class="cgrid" id="cc-grid"></div>' +
    '<div class="row"><span class="note">Presets:</span><button class="btn ghost sm" data-pre="bell" type="button">Bell pair</button><button class="btn ghost sm" data-pre="ghz" type="button">GHZ</button><button class="btn ghost sm" data-pre="hzh" type="button">H–Z–H</button><button class="btn ghost sm" data-pre="uni" type="button">Uniform</button><button class="btn ghost sm" data-pre="clr" type="button">Clear</button></div>' +
    '<canvas style="aspect-ratio:16/10" role="img" aria-label="3D bar chart of the probability of each basis state. Drag to rotate."></canvas>' +
    '<div class="readout" id="cc-read"></div><div class="row"><button class="btn sm" type="button" id="cc-shots">Run 1024 shots</button></div><div id="cc-hist"></div>';
  var city = new StateCity($('canvas', box), labels), re, im;
  var U = { H: [SQ, 0, SQ, 0, SQ, 0, -SQ, 0], X: [0, 0, 1, 0, 1, 0, 0, 0], Y: [0, 0, 0, -1, 0, 1, 0, 0], Z: [1, 0, 0, 0, 0, 0, -1, 0], S: [1, 0, 0, 0, 0, 0, 0, 1], T: [1, 0, 0, 0, 0, 0, SQ, SQ] };
  function g1(q, u) {
    var bit = 1 << (NQ - 1 - q), i, j, ar, ai, br, bi;
    for (i = 0; i < 8; i++) {
      if (i & bit) { continue; }
      j = i | bit; ar = re[i]; ai = im[i]; br = re[j]; bi = im[j];
      re[i] = u[0] * ar - u[1] * ai + u[2] * br - u[3] * bi; im[i] = u[0] * ai + u[1] * ar + u[2] * bi + u[3] * br;
      re[j] = u[4] * ar - u[5] * ai + u[6] * br - u[7] * bi; im[j] = u[4] * ai + u[5] * ar + u[6] * bi + u[7] * br;
    }
  }
  function cx(cq, tq) {
    var cb = 1 << (NQ - 1 - cq), tb = 1 << (NQ - 1 - tq), i, j, t;
    for (i = 0; i < 8; i++) { if ((i & cb) && !(i & tb)) { j = i | tb; t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  }
  function cz(a, b) { var ab = 1 << (NQ - 1 - a), bb = 1 << (NQ - 1 - b), i; for (i = 0; i < 8; i++) { if ((i & ab) && (i & bb)) { re[i] = -re[i]; im[i] = -im[i]; } } }
  function run() {
    re = new Float64Array(8); im = new Float64Array(8); re[0] = 1;
    cols.forEach(function (col) {
      col.forEach(function (cell, r) {
        if (!cell) { return; }
        if (cell.o === undefined) { g1(r, U[cell.g]); }
        else if (cell.g === 'CX' && cell.role === 'c') { cx(r, cell.o); }
        else if (cell.g === 'CZ' && r < cell.o) { cz(r, cell.o); }
      });
    });
  }
  function ampStr(k) {
    var m = Math.hypot(re[k], im[k]), ph = Math.atan2(im[k], re[k]), s;
    if (Math.abs(im[k]) < 1e-9 * 1e3 && re[k] < 0) { s = '−' + m.toFixed(3); } else if (Math.abs(im[k]) < 1e-6) { s = m.toFixed(3); }
    else { s = m.toFixed(3) + '·e^(i' + Math.round(ph * 180 / Math.PI) + '°)'; }
    return s + labels[k];
  }
  function update() {
    run();
    var pr = [], ph = [], k, parts = [];
    for (k = 0; k < 8; k++) { pr.push(re[k] * re[k] + im[k] * im[k]); ph.push(Math.atan2(im[k], re[k])); if (pr[k] > 1e-6) { parts.push(ampStr(k)); } }
    city.set(pr, ph);
    $('#cc-read', box).innerHTML = '|ψ⟩ = <b>' + parts.join(' + ').replace(/\+ −/g, '− ') + '</b>';
    $('#cc-hist', box).innerHTML = '';
  }
  function clear(cc, r) { var cell = cols[cc][r]; if (!cell) { return; } if (cell.o !== undefined) { cols[cc][cell.o] = null; } cols[cc][r] = null; }
  function place(cc, r) {
    var cell = cols[cc][r];
    if (sel === 'E') { clear(cc, r); return; }
    if (sel === 'CX' || sel === 'CZ') {
      var o = r < NQ - 1 ? r + 1 : r - 1;
      if (cell && cell.g === sel && cell.role === 'c' && cell.o === o) { clear(cc, r); return; }
      clear(cc, r); clear(cc, o);
      cols[cc][r] = { g: sel, role: 'c', o: o }; cols[cc][o] = { g: sel, role: sel === 'CX' ? 't' : 'c', o: r };
    } else {
      if (cell && cell.g === sel) { clear(cc, r); } else { clear(cc, r); cols[cc][r] = { g: sel }; }
    }
  }
  function renderGrid() {
    var h = '', r, cc;
    for (r = 0; r < NQ; r++) {
      h += '<div class="crow"><span class="ql">q' + r + '</span>';
      for (cc = 0; cc < NC; cc++) {
        var cell = cols[cc][r], cls = 'cell', txt = '';
        if (cell) {
          if (cell.o !== undefined) { cls += (cell.role === 't' ? ' t' : ' c') + (cell.o > r ? ' dn' : ' up'); txt = cell.g === 'CX' && cell.role === 't' ? '⊕' : '●'; }
          else { cls += ' g'; txt = cell.g; }
        }
        h += '<button type="button" class="' + cls + '" data-c="' + cc + '" data-r="' + r + '" aria-label="qubit ' + r + ', step ' + (cc + 1) + (cell ? ', ' + cell.g : ', empty') + '"><span>' + txt + '</span></button>';
      }
      h += '</div>';
    }
    $('#cc-grid', box).innerHTML = h;
  }
  $('#cc-grid', box).addEventListener('click', function (e) {
    var b = e.target.closest('.cell'); if (!b) { return; }
    place(+b.getAttribute('data-c'), +b.getAttribute('data-r')); renderGrid(); update();
  });
  PAL.forEach(function (g) {
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'gb' + (g[0] === sel ? ' on' : ''); bt.textContent = g[1]; bt.setAttribute('data-g', g[0]);
    bt.addEventListener('click', function () { sel = g[0]; $$('#cc-pal .gb', box).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-g') === sel); }); });
    $('#cc-pal', box).appendChild(bt);
  });
  function preset(name) {
    cols = []; for (var i = 0; i < NC; i++) { cols.push([null, null, null]); }
    var keep = sel;
    function put(g, cc, r) { sel = g; place(cc, r); }
    if (name === 'bell') { put('H', 0, 0); put('CX', 1, 0); }
    else if (name === 'ghz') { put('H', 0, 0); put('CX', 1, 0); put('CX', 2, 1); }
    else if (name === 'hzh') { put('H', 0, 0); put('Z', 1, 0); put('H', 2, 0); }
    else if (name === 'uni') { put('H', 0, 0); put('H', 0, 1); put('H', 0, 2); }
    sel = keep; renderGrid(); update();
  }
  $$('button[data-pre]', box).forEach(function (b) { b.addEventListener('click', function () { preset(b.getAttribute('data-pre')); }); });
  $('#cc-shots', box).addEventListener('click', function () {
    var pr = [], k, cnt = [0, 0, 0, 0, 0, 0, 0, 0], i, r, acc;
    for (k = 0; k < 8; k++) { pr.push(re[k] * re[k] + im[k] * im[k]); }
    for (i = 0; i < 1024; i++) { r = Math.random(); acc = 0; for (k = 0; k < 8; k++) { acc += pr[k]; if (r < acc || k === 7) { cnt[k]++; break; } } }
    $('#cc-hist', box).innerHTML = cnt.map(function (n, k) { return n ? '<div class="hbar"><span>' + labels[k] + '</span><div class="track"><div class="fill" style="width:' + (n / 10.24) + '%"></div></div><span>' + n + '</span></div>' : ''; }).join('');
  });
  preset('bell');
};

/* ================= Simulations, part 2 ================= */

/* ---------- Grover ---------- */
SIMS.grover = function (box) {
  var p = 'gr';
  box.innerHTML = simHead('Grover search', 'click a bar to mark a different item') +
    '<canvas id="gr-a" style="aspect-ratio:16/9" role="img" aria-label="Bar chart of amplitudes for each item. The marked item is highlighted."></canvas>' +
    '<canvas id="gr-b" style="aspect-ratio:16/6" role="img" aria-label="Probability of the marked item against the number of iterations"></canvas>' +
    ctl(p, 'n', 'Qubits n', 2, 5, 4, 1, '4 (N = 16)') +
    '<div class="row"><button class="btn sm" type="button" id="gr-step">Step: oracle + diffusion</button><button class="btn sm" type="button" id="gr-opt">Run to optimum</button><button class="btn ghost sm" type="button" id="gr-reset">Reset</button></div>' +
    '<div class="readout" id="gr-read"></div>';
  var nq = 4, N = 16, m = 5, a = [], k = 0, timer = 0;
  function reset() { clearInterval(timer); N = 1 << nq; a = []; for (var i = 0; i < N; i++) { a.push(1 / Math.sqrt(N)); } k = 0; if (m >= N) { m = N - 1; } show(); }
  function kopt() { return Math.floor(Math.PI / 4 * Math.sqrt(N)); }
  function step() {
    a[m] = -a[m];
    var mean = 0, i; for (i = 0; i < N; i++) { mean += a[i]; } mean /= N;
    for (i = 0; i < N; i++) { a[i] = 2 * mean - a[i]; }
    k++; show();
  }
  var A = setupCanvas($('#gr-a', box), function (ctx, w, h) {
    if (!a.length) { return; }
    var bx = { x: 40, y: 12, w: w - 56, h: h - 34 }, cw = bx.w / N, i, mean = 0;
    function my(v) { return bx.y + bx.h / 2 - v * bx.h / 2 * 0.98; }
    axes(ctx, bx, [], [[-1, '−1'], [-0.5, ''], [0, '0'], [0.5, ''], [1, '1']], function () { return 0; }, my);
    for (i = 0; i < N; i++) { mean += a[i]; } mean /= N;
    for (i = 0; i < N; i++) {
      var x = bx.x + i * cw + cw * 0.15, y0 = my(0), y1 = my(a[i]);
      ctx.fillStyle = i === m ? C.coral : C.teal; ctx.globalAlpha = i === m ? 1 : 0.8;
      ctx.fillRect(x, Math.min(y0, y1), cw * 0.7, Math.max(1, Math.abs(y1 - y0))); ctx.globalAlpha = 1;
      if (N <= 16 || i % 4 === 0 || i === m) { label(ctx, String(i), x + cw * 0.35, bx.y + bx.h + 14, i === m ? C.coral : C.muted, 'center'); }
    }
    ctx.strokeStyle = C.amber; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx.x, my(mean)); ctx.lineTo(bx.x + bx.w, my(mean)); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'mean', bx.x + bx.w - 4, my(mean) - 9, C.amber, 'right');
    label(ctx, 'amplitude', bx.x, 4, C.muted);
  });
  var B = setupCanvas($('#gr-b', box), function (ctx, w, h) {
    if (!a.length) { return; }
    var bx = { x: 40, y: 12, w: w - 56, h: h - 34 }, th = Math.asin(1 / Math.sqrt(N)), K = Math.max(8, Math.ceil(kopt() * 2.8) + 1), i;
    function mx(v) { return bx.x + v / K * bx.w; } function my(v) { return bx.y + bx.h - v * bx.h; }
    var xt = []; var st = K > 20 ? 4 : K > 12 ? 2 : 1; for (i = 0; i <= K; i += st) { xt.push([i, String(i)]); }
    axes(ctx, bx, xt, [[0, '0'], [0.5, '0.5'], [1, '1']], mx, my);
    ctx.beginPath(); for (i = 0; i <= K * 8; i++) { var kk = i / 8, v = Math.pow(Math.sin((2 * kk + 1) * th), 2); if (i === 0) { ctx.moveTo(mx(kk), my(v)); } else { ctx.lineTo(mx(kk), my(v)); } }
    ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx(kopt()), bx.y); ctx.lineTo(mx(kopt()), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'optimum', mx(kopt()) + 5, bx.y + 8, C.amber);
    var pk = a[m] * a[m]; glow(ctx, mx(k), my(pk), 16, C.coral, 0.8); ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(mx(k), my(pk), 5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'P(marked) against iterations k', bx.x, 4, C.muted);
  });
  function show() {
    var pk = a[m] * a[m];
    $('#gr-read', box).innerHTML = 'N = <b>' + N + '</b>, marked item = <b>' + m + '</b>, iterations k = <b>' + k + '</b> (optimum <b>' + kopt() + '</b>)<br>P(marked) = <b>' + (pk * 100).toFixed(1) + '%</b>   classical average: about <b>' + Math.round(N / 2) + '</b> checks, Grover: <b>' + kopt() + '</b> iterations' +
      (k > kopt() + 1 && pk < 0.9 ? '<br><span class="no">Overshot. The probability is falling again.</span>' : '');
    A.redraw(); B.redraw();
  }
  $('#gr-a', box).addEventListener('pointerdown', function (e) {
    var r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left - 40, cw = (r.width - 56) / N, i = Math.floor(x / cw);
    if (i >= 0 && i < N) { m = i; reset(); }
  });
  bindR(box, p, 'n', function (v) { nq = v; reset(); }, function (v) { return v + ' (N = ' + (1 << v) + ')'; });
  $('#gr-step', box).addEventListener('click', function () { clearInterval(timer); step(); });
  $('#gr-opt', box).addEventListener('click', function () {
    clearInterval(timer); reset();
    if (reduce) { while (k < kopt()) { step(); } return; }
    timer = setInterval(function () { if (k >= kopt()) { clearInterval(timer); } else { step(); } }, 420);
  });
  $('#gr-reset', box).addEventListener('click', reset);
  reset();
};

/* ---------- Shor ---------- */
SIMS.shor = function (box) {
  var p = 'sh';
  box.innerHTML = simHead('Period finding and the QFT', 'order of a modulo N') +
    '<div class="ctl"><span>N</span><select id="sh-n" aria-label="Number to factor"><option>15</option><option>21</option><option>33</option><option>35</option><option>39</option></select></div>' +
    '<div class="ctl"><span>a</span><select id="sh-a" aria-label="Base a"></select></div>' +
    '<canvas id="sh-f" style="aspect-ratio:16/6" role="img" aria-label="Values of a to the x mod N for x from 0 to 47, repeating with period r"></canvas>' +
    '<canvas id="sh-q" style="aspect-ratio:16/6" role="img" aria-label="Probability distribution of the measured value y after the quantum Fourier transform, with peaks at multiples of Q over r"></canvas>' +
    '<div class="row"><button class="btn sm" type="button" id="sh-meas">Run quantum step (measure y)</button></div><div class="readout" id="sh-read"></div>';
  var N = 15, a = 7, r = 4, Q = 256, dist = [], yMeas = -1;
  function order(a, N) { var x = a % N, k = 1; while (x !== 1 && k < 1000) { x = (x * a) % N; k++; } return k; }
  function build() {
    r = order(a, N); Q = 1; while (Q < N * N) { Q *= 2; }
    var M = Math.floor((Q - 1) / r) + 1, ct = new Float64Array(Q), st = new Float64Array(Q), y, j, i, tot = 0;
    for (i = 0; i < Q; i++) { ct[i] = Math.cos(2 * Math.PI * i / Q); st[i] = Math.sin(2 * Math.PI * i / Q); }
    dist = new Float64Array(Q);
    for (y = 0; y < Q; y++) {
      var sr = 0, si = 0;
      for (j = 0; j < M; j++) { var idx = (y * ((j * r) % Q)) % Q; sr += ct[idx]; si += st[idx]; }
      dist[y] = (sr * sr + si * si) / (Q * M); tot += dist[y];
    }
    for (y = 0; y < Q; y++) { dist[y] /= tot; }
    yMeas = -1;
  }
  function fillA() {
    var sel = $('#sh-a', box), h = '', x;
    for (x = 2; x < N; x++) { if (gcd(x, N) === 1) { h += '<option>' + x + '</option>'; } }
    sel.innerHTML = h; a = +sel.options[0].value;
    if (N === 15) { sel.value = '7'; a = 7; }
  }
  var F = setupCanvas($('#sh-f', box), function (ctx, w, h) {
    var bx = { x: 40, y: 14, w: w - 56, h: h - 36 }, X = 48, i;
    function mx(v) { return bx.x + (v + 0.5) / X * bx.w; } function my(v) { return bx.y + bx.h - v / N * bx.h; }
    var xt = []; for (i = 0; i < X; i += 8) { xt.push([i, String(i)]); }
    axes(ctx, bx, xt, [[0, '0'], [Math.round(N / 2), String(Math.round(N / 2))], [N, String(N)]], mx, my);
    for (i = 0; i < X; i += r) { ctx.strokeStyle = C.amber; ctx.globalAlpha = 0.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(mx(i), bx.y); ctx.lineTo(mx(i), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    for (i = 0; i < X; i++) { var v = powmod(a, i, N); ctx.fillStyle = v === 1 ? C.coral : C.teal; ctx.beginPath(); ctx.arc(mx(i), my(v), 3.5, 0, Math.PI * 2); ctx.fill(); }
    label(ctx, a + '^x mod ' + N + ', period r = ' + r, bx.x, 5, C.ink);
    label(ctx, 'x', bx.x + bx.w, 5, C.muted, 'right');
  });
  var Qc = setupCanvas($('#sh-q', box), function (ctx, w, h) {
    var bx = { x: 40, y: 14, w: w - 56, h: h - 36 }, y, mxv = 0;
    for (y = 0; y < Q; y++) { if (dist[y] > mxv) { mxv = dist[y]; } }
    function mx(v) { return bx.x + v / Q * bx.w; } function my(v) { return bx.y + bx.h - v / (mxv * 1.05) * bx.h; }
    var xt = []; for (y = 0; y <= 4; y++) { xt.push([Q * y / 4, String(Q * y / 4)]); }
    axes(ctx, bx, xt, [[0, '0'], [mxv, '']], mx, my);
    ctx.strokeStyle = C.teal; ctx.lineWidth = Math.max(1, bx.w / Q * 0.8);
    for (y = 0; y < Q; y++) { if (dist[y] < mxv * 0.004) { continue; } ctx.beginPath(); ctx.moveTo(mx(y) + 0.5, my(0)); ctx.lineTo(mx(y) + 0.5, my(dist[y])); ctx.stroke(); }
    if (yMeas >= 0) { ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx(yMeas), bx.y); ctx.lineTo(mx(yMeas), bx.y + bx.h); ctx.stroke(); label(ctx, 'y = ' + yMeas, mx(yMeas) + 6, bx.y + 8, C.coral, yMeas > Q * 0.8 ? 'right' : 'left'); }
    label(ctx, 'P(y) after the QFT, Q = ' + Q + ', peaks near k·Q/r', bx.x, 5, C.ink);
  });
  function classical() {
    if (r % 2 === 1) { return 'r = ' + r + ' is odd, so this choice of a fails. Pick another a.'; }
    var x = powmod(a, r / 2, N);
    if (x === N - 1) { return 'r = ' + r + ', but a^(r/2) ≡ −1 (mod N), so this choice of a fails. Pick another a.'; }
    var f1 = gcd(x - 1, N), f2 = gcd(x + 1, N);
    return 'r = ' + r + ' is even and a^(r/2) = ' + x + '. gcd(' + (x - 1) + ', ' + N + ') = <b>' + f1 + '</b>, gcd(' + (x + 1) + ', ' + N + ') = <b>' + f2 + '</b>, so <b>' + N + ' = ' + f1 + ' × ' + (N / f1) + '</b>.';
  }
  function cfrac(y, Qq, maxd) {
    var num = y, den = Qq, p0 = 0, q0 = 1, p1 = 1, q1 = 0, res = [0, 1];
    while (den) { var aa = Math.floor(num / den), p2 = aa * p1 + p0, q2 = aa * q1 + q0; if (q2 >= maxd) { break; } p0 = p1; q0 = q1; p1 = p2; q1 = q2; res = [p1, q1]; var t = num - aa * den; num = den; den = t; }
    return res;
  }
  function show(extra) {
    $('#sh-read', box).innerHTML = 'Classical check: ' + classical() + (extra ? '<br><br>' + extra : '');
    F.redraw(); Qc.redraw();
  }
  function refresh() { build(); show(''); }
  $('#sh-n', box).addEventListener('change', function (e) { N = +e.target.value; fillA(); refresh(); });
  $('#sh-a', box).addEventListener('change', function (e) { a = +e.target.value; refresh(); });
  $('#sh-meas', box).addEventListener('click', function () {
    var u = Math.random(), acc = 0, y;
    for (y = 0; y < Q; y++) { acc += dist[y]; if (u < acc) { break; } }
    if (y >= Q) { y = Q - 1; }
    yMeas = y;
    var fr = cfrac(y, Q, N), cand = fr[1], found = 0, m;
    for (m = 1; m <= 8; m++) { if (powmod(a, cand * m, N) === 1) { found = cand * m; break; } }
    var msg = 'Measured y = <b>' + y + '</b>, y/Q = ' + (y / Q).toFixed(4) + ', closest fraction with denominator below N: <b>' + fr[0] + '/' + fr[1] + '</b>.<br>';
    if (!found) { msg += '<span class="no">That fraction did not give a valid period. Run the quantum step again.</span>'; }
    else if (found === r) { msg += '<span class="ok">Period found: r = ' + r + '.</span> The classical step above turns it into factors.'; }
    else { msg += 'Candidate gives r = ' + found + '.'; }
    show(msg);
  });
  fillA(); refresh();
};

/* ---------- VQE ---------- */
SIMS.vqe = function (box) {
  var p = 'vq';
  box.innerHTML = simHead('VQE on one qubit', 'H = a·Z + b·X, ansatz Ry(θ)|0⟩') +
    '<canvas id="vq-a" style="aspect-ratio:16/8" role="img" aria-label="Energy against the ansatz angle with the optimiser path"></canvas>' +
    '<canvas id="vq-b" style="aspect-ratio:16/5" role="img" aria-label="Energy against optimiser iteration"></canvas>' +
    ctl(p, 'a', 'Coefficient a', -20, 20, 10, 1, '1.0') + ctl(p, 'b', 'Coefficient b', -20, 20, 5, 1, '0.5') + ctl(p, 's', 'Shots', 0, 4, 0, 1, 'exact') +
    '<div class="row"><button class="btn sm" type="button" id="vq-run">Optimise</button><button class="btn ghost sm" type="button" id="vq-step">One step</button><button class="btn ghost sm" type="button" id="vq-rand">Random start</button></div><div class="readout" id="vq-read"></div>';
  var a = 1, b = 0.5, shots = 0, th = 0, path = [], en = [], timer = 0, it = 0, SH = [0, 10, 50, 200, 1000];
  function Et(t) { return a * Math.cos(t) + b * Math.sin(t); }
  function Eest(t) {
    if (!shots) { return Et(t); }
    var z = 2 * binSample(shots, (1 + Math.cos(t)) / 2) / shots - 1, x = 2 * binSample(shots, (1 + Math.sin(t)) / 2) / shots - 1;
    return a * z + b * x;
  }
  function E0() { return -Math.hypot(a, b); }
  function start(t) { clearInterval(timer); timer = 0; th = t; path = [t]; en = [Et(t)]; it = 0; $('#vq-run', box).textContent = 'Optimise'; show(); }
  function randStart() { start(Math.atan2(-b, -a) + (Math.random() < 0.5 ? 1 : -1) * (1.8 + Math.random() * 1.2)); }
  function step() {
    var g = (Eest(th + Math.PI / 2) - Eest(th - Math.PI / 2)) / 2;
    th += -0.35 * g / Math.max(0.5, Math.hypot(a, b)) * 1.6; it++; path.push(th); en.push(Et(th)); show();
  }
  var A = setupCanvas($('#vq-a', box), function (ctx, w, h) {
    var bx = { x: 44, y: 14, w: w - 60, h: h - 36 }, R = Math.max(1, Math.hypot(a, b)) * 1.15;
    function mx(v) { return bx.x + v / (2 * Math.PI) * bx.w; } function my(v) { return bx.y + bx.h / 2 - v / R * bx.h / 2; }
    axes(ctx, bx, [[0, '0'], [Math.PI / 2, 'π/2'], [Math.PI, 'π'], [3 * Math.PI / 2, '3π/2'], [2 * Math.PI, '2π']], [[-R, fmt(-R, 1)], [0, '0'], [R, fmt(R, 1)]], mx, my);
    ctx.beginPath(); for (var i = 0; i <= 200; i++) { var t = i / 200 * 2 * Math.PI; if (i === 0) { ctx.moveTo(mx(t), my(Et(t))); } else { ctx.lineTo(mx(t), my(Et(t))); } }
    ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = C.amber; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(bx.x, my(E0())); ctx.lineTo(bx.x + bx.w, my(E0())); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, 'ground energy ' + fmt(E0(), 3), bx.x + bx.w - 4, my(E0()) - 9, C.amber, 'right');
    var wrap = function (t) { return ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); };
    ctx.fillStyle = C.coral; path.forEach(function (t, k) { ctx.globalAlpha = 0.25 + 0.5 * k / Math.max(1, path.length); ctx.beginPath(); ctx.arc(mx(wrap(t)), my(Et(t)), 3, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1;
    var cx = mx(wrap(th)), cy = my(Et(th)); glow(ctx, cx, cy, 18, C.coral, 0.8); ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'E(θ) = a cos θ + b sin θ', bx.x, 5, C.ink);
  });
  var B = setupCanvas($('#vq-b', box), function (ctx, w, h) {
    var bx = { x: 44, y: 12, w: w - 60, h: h - 34 }, K = Math.max(20, en.length - 1), R = Math.max(1, Math.hypot(a, b)) * 1.15;
    function mx(v) { return bx.x + v / K * bx.w; } function my(v) { return bx.y + bx.h / 2 - v / R * bx.h / 2; }
    axes(ctx, bx, [[0, '0'], [K / 2, String(Math.round(K / 2))], [K, String(Math.round(K))]], [[-R, fmt(-R, 1)], [0, '0'], [R, fmt(R, 1)]], mx, my);
    ctx.strokeStyle = C.amber; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(bx.x, my(E0())); ctx.lineTo(bx.x + bx.w, my(E0())); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); en.forEach(function (e, k) { if (k === 0) { ctx.moveTo(mx(k), my(e)); } else { ctx.lineTo(mx(k), my(e)); } }); ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.stroke();
    label(ctx, 'energy against iteration', bx.x, 4, C.muted);
  });
  function show() {
    var e = Et(th);
    $('#vq-read', box).innerHTML = 'Iteration <b>' + it + '</b>   θ = <b>' + fmt(((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 3) + '</b> rad   E = <b>' + fmt(e, 4) + '</b><br>Exact ground energy <b>' + fmt(E0(), 4) + '</b>, error <b>' + fmt(e - E0(), 4) + '</b>' + (shots ? '   (gradients from ' + shots + ' shots per term)' : '   (exact expectation values)');
    A.redraw(); B.redraw();
  }
  bindR(box, p, 'a', function (v) { a = v / 10; randStart(); }, function (v) { return (v / 10).toFixed(1); });
  bindR(box, p, 'b', function (v) { b = v / 10; randStart(); }, function (v) { return (v / 10).toFixed(1); });
  bindR(box, p, 's', function (v) { shots = SH[v]; show(); }, function (v) { return SH[v] ? SH[v] : 'exact'; });
  $('#vq-run', box).addEventListener('click', function () {
    var btn = $('#vq-run', box);
    if (timer) { clearInterval(timer); timer = 0; btn.textContent = 'Optimise'; return; }
    if (it >= 80) { randStart(); }
    btn.textContent = 'Pause';
    timer = setInterval(function () { step(); if (it >= 80) { clearInterval(timer); timer = 0; btn.textContent = 'Optimise'; } }, reduce ? 10 : 110);
  });
  $('#vq-step', box).addEventListener('click', step);
  $('#vq-rand', box).addEventListener('click', randStart);
  randStart();
};

/* ---------- Decoherence ---------- */
SIMS.noise = function (box) {
  var p = 'nz';
  box.innerHTML = simHead('Decoherence on the Bloch sphere', 'state starts as |+⟩') +
    '<canvas id="nz-a" style="aspect-ratio:1/1;max-height:400px;margin-inline:auto" role="img" aria-label="Bloch sphere with a shrinking state vector"></canvas>' +
    ctl(p, 't1', 'T1 (µs)', 20, 300, 100, 5, '100') + ctl(p, 't2', 'T2 (µs)', 10, 600, 80, 5, '80') + ctl(p, 't', 'Time t (µs)', 0, 400, 0, 1, '0') + ctl(p, 'g', 'Gate (ns)', 10, 500, 50, 10, '50') +
    '<div class="row"><button class="btn sm" type="button" id="nz-play">Play</button></div><div class="readout" id="nz-read"></div>' +
    '<canvas id="nz-b" style="aspect-ratio:16/6" role="img" aria-label="Circuit fidelity against depth"></canvas>';
  var T1 = 100, T2 = 80, t = 0, gt = 50, play = 0, view = new BlochView($('#nz-a', box));
  var s1 = bindR(box, p, 't1', function (v) { T1 = v; if (T2 > 2 * T1) { T2 = 2 * T1; s2.el.value = T2; s2.out.textContent = T2; } s2.el.max = Math.min(600, 2 * T1); upd(); });
  var s2 = bindR(box, p, 't2', function (v) { T2 = Math.min(v, 2 * T1); upd(); });
  var st = bindR(box, p, 't', function (v) { t = v; upd(); });
  bindR(box, p, 'g', function (v) { gt = v; upd(); });
  var Bc = setupCanvas($('#nz-b', box), function (ctx, w, h) {
    var bx = { x: 44, y: 14, w: w - 60, h: h - 36 }, eps = gateErr(), i;
    function mx(v) { return bx.x + Math.log10(v) / 5 * bx.w; } function my(v) { return bx.y + bx.h - v * bx.h; }
    axes(ctx, bx, [[1, '1'], [10, '10'], [100, '100'], [1000, '1k'], [10000, '10k'], [100000, '100k']], [[0, '0'], [0.5, '0.5'], [1, '1']], mx, my);
    ctx.beginPath(); for (i = 0; i <= 100; i++) { var d = Math.pow(10, i / 20), f = Math.pow(1 - eps, d); if (i === 0) { ctx.moveTo(mx(d), my(f)); } else { ctx.lineTo(mx(d), my(f)); } }
    ctx.strokeStyle = C.teal; ctx.lineWidth = 2.5; ctx.stroke();
    var d50 = Math.log(0.5) / Math.log(1 - eps);
    if (d50 >= 1 && d50 <= 1e5) { ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx(d50), bx.y); ctx.lineTo(mx(d50), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]); label(ctx, 'F = 0.5 at depth ' + Math.round(d50), mx(d50) + (d50 > 3e3 ? -6 : 6), bx.y + 10, C.amber, d50 > 3e3 ? 'right' : 'left'); }
    label(ctx, 'circuit fidelity (1 − ε)^depth', bx.x, 4, C.muted);
  });
  function gateErr() { var g = gt * 1e-3; return 1 - (3 + Math.exp(-g / T1) + 2 * Math.exp(-g / T2)) / 6; }
  function upd() {
    var x = Math.exp(-t / T2), z = 1 - Math.exp(-t / T1), v = [x, 0, z], len = Math.hypot(x, z), eps = gateErr();
    view.ghost = [1, 0, 0]; view.ghostLabel = 'start'; view.set(v);
    $('#nz-read', box).innerHTML = 'x = <b>' + fmt(x) + '</b>   z = <b>' + fmt(z) + '</b>   length |r| = <b>' + fmt(len) + '</b><br>Purity = <b>' + fmt((1 + len * len) / 2) + '</b>   fidelity with |+⟩ = <b>' + fmt((1 + x) / 2) + '</b><br>Gate error ε = <b>' + (eps * 100).toFixed(3) + '%</b>, so about <b>' + Math.round(1 / Math.max(eps, 1e-12)) + '</b> gates before fidelity falls to 1/e';
    Bc.redraw();
  }
  $('#nz-play', box).addEventListener('click', function () {
    var btn = $('#nz-play', box);
    if (play) { cancelAnimationFrame(play); play = 0; btn.textContent = 'Play'; return; }
    btn.textContent = 'Pause'; var last = performance.now(); if (t >= 400) { t = 0; }
    (function f(now) {
      t = Math.min(400, t + (now - last) / 1000 * 70); last = now; st.el.value = Math.round(t); st.out.textContent = Math.round(t); upd();
      if (t < 400) { play = requestAnimationFrame(f); } else { play = 0; btn.textContent = 'Play'; }
    })(last);
  });
  upd();
};

/* ---------- Error correction ---------- */
SIMS.qec = function (box) {
  var p = 'qe';
  box.innerHTML = simHead('Repetition code', 'bit flips only, perfect syndrome measurement') +
    '<div class="qrow" id="qe-data"></div><div class="qrow" id="qe-syn"></div>' +
    '<div class="ctl"><span>Code size d</span><select id="qe-d" aria-label="Code distance"><option>1</option><option selected>3</option><option>5</option><option>7</option><option>9</option></select></div>' +
    ctl(p, 'p', 'Flip chance p', 0, 1000, 500, 1, '2.45%') +
    '<div class="row"><button class="btn sm" type="button" id="qe-inj">Inject noise</button><button class="btn sm" type="button" id="qe-mc">Run 20,000 trials</button></div>' +
    '<div class="readout" id="qe-read"></div>' +
    '<canvas style="aspect-ratio:16/9" role="img" aria-label="Logical error rate against physical error rate for several code sizes, log-log"></canvas>';
  var d = 3, pp = 0.0245, mc = null, flips = null, COL = { 1: C.muted, 3: C.teal, 5: C.violet, 7: C.amber, 9: C.coral };
  function PL(dd, q) { var s = 0, k; for (k = (dd + 1) / 2; k <= dd; k++) { s += binom(dd, k) * Math.pow(q, k) * Math.pow(1 - q, dd - k); } return s; }
  function pctStr(v) { return v >= 0.1 ? (v * 100).toFixed(0) + '%' : v >= 0.01 ? (v * 100).toFixed(1) + '%' : (v * 100).toFixed(2) + '%'; }
  var cv = setupCanvas($('canvas', box), function (ctx, w, h) {
    var bx = { x: 50, y: 14, w: w - 66, h: h - 38 };
    function mx(v) { return bx.x + (v + 3) / 2.78 * bx.w; } function my(v) { return bx.y + (0 - v) / 12 * bx.h; }
    axes(ctx, bx, [[-3, '0.1%'], [-2, '1%'], [-1, '10%']], [[0, '1'], [-3, '10⁻³'], [-6, '10⁻⁶'], [-9, '10⁻⁹'], [-12, '10⁻¹²']], mx, my);
    [1, 3, 5, 7, 9].forEach(function (dd) {
      ctx.beginPath(); var started = false, i;
      for (i = 0; i <= 120; i++) { var lx = -3 + i / 120 * 2.78, v = Math.log10(Math.max(PL(dd, Math.pow(10, lx)), 1e-13)); if (v < -12) { v = -12; } if (!started) { ctx.moveTo(mx(lx), my(v)); started = true; } else { ctx.lineTo(mx(lx), my(v)); } }
      ctx.strokeStyle = COL[dd]; ctx.lineWidth = dd === d ? 3 : 1.4; ctx.globalAlpha = dd === d ? 1 : 0.6; ctx.setLineDash(dd === 1 ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      label(ctx, 'd=' + dd, bx.x + bx.w - 8 - (9 - dd) * 20, bx.y + 10, COL[dd], 'right');
    });
    ctx.strokeStyle = C.amber; ctx.setLineDash([3, 4]); ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(mx(Math.log10(0.5)), bx.y); ctx.lineTo(mx(Math.log10(0.5)), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    label(ctx, 'threshold 50%', mx(Math.log10(0.5)) - 5, bx.y + bx.h - 10, C.amber, 'right');
    var lx = Math.log10(pp), v = Math.max(Math.log10(Math.max(PL(d, pp), 1e-13)), -12);
    glow(ctx, mx(lx), my(v), 16, C.coral, 0.8); ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(mx(lx), my(v), 5, 0, Math.PI * 2); ctx.fill();
    if (mc !== null && mc > 0) { ctx.fillStyle = C.ink; ctx.strokeStyle = C.violet; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx(lx), my(Math.max(Math.log10(mc), -12)), 7, 0, Math.PI * 2); ctx.stroke(); }
    label(ctx, 'logical error against physical error p', bx.x, 4, C.muted);
  });
  function drawRow() {
    var dh = '', sh = '', i;
    for (i = 0; i < d; i++) { dh += '<div class="qb' + (flips && flips[i] ? ' flip' : '') + '" aria-label="data qubit ' + (i + 1) + (flips && flips[i] ? ' flipped' : ' fine') + '">' + (flips && flips[i] ? '1' : '0') + '</div>'; }
    for (i = 0; i < d - 1; i++) { var hit = flips && (flips[i] ^ flips[i + 1]); sh += '<div class="qb syn' + (hit ? ' hit' : '') + '" aria-label="parity check ' + (i + 1) + (hit ? ' triggered' : ' quiet') + '">' + (hit ? '!' : '·') + '</div>'; }
    $('#qe-data', box).innerHTML = dh; $('#qe-syn', box).innerHTML = d > 1 ? sh + '<span class="srow2">parity checks</span>' : '<span class="srow2">no checks with one qubit</span>';
  }
  function readout(extra) {
    $('#qe-read', box).innerHTML = 'Physical error p = <b>' + pctStr(pp) + '</b>, d = <b>' + d + '</b><br>Logical error (formula) = <b>' + (PL(d, pp) < 1e-12 ? '< 10⁻¹²' : sci(PL(d, pp))) + '</b>' + (d > 1 ? ' against unprotected <b>' + sci(pp) + '</b>' : '') + (extra ? '<br>' + extra : '');
    drawRow(); cv.redraw();
  }
  var ps = bindR(box, p, 'p', function (v) { pp = Math.pow(10, -3 + 2.778 * v / 1000); mc = null; flips = null; readout(); }, function (v) { return pctStr(Math.pow(10, -3 + 2.778 * v / 1000)); });
  $('#qe-d', box).addEventListener('change', function (e) { d = +e.target.value; mc = null; flips = null; readout(); });
  $('#qe-inj', box).addEventListener('click', function () {
    flips = []; var i, c = 0; for (i = 0; i < d; i++) { var f = Math.random() < pp ? 1 : 0; flips.push(f); c += f; }
    var fail = c > d / 2;
    readout('Flipped ' + c + ' of ' + d + '. Majority vote returns <b>' + (fail ? '1' : '0') + '</b>: ' + (fail ? '<span class="no">logical error</span>' : '<span class="ok">corrected</span>'));
  });
  $('#qe-mc', box).addEventListener('click', function () {
    var n = 20000, bad = 0, i, j, c;
    for (i = 0; i < n; i++) { c = 0; for (j = 0; j < d; j++) { if (Math.random() < pp) { c++; } } if (c > d / 2) { bad++; } }
    mc = bad / n; flips = null;
    readout('20,000 trials: <b>' + bad + '</b> logical errors, rate <b>' + (mc ? sci(mc) : '0') + '</b> (violet ring on the chart)');
  });
  ps.update();
};

/* ---------- BB84 ---------- */
SIMS.bb84 = function (box) {
  var p = 'bb';
  box.innerHTML = simHead('BB84 key exchange', '400 photons, first 24 shown') +
    '<label class="row" for="bb-eve" style="font-size:14px;gap:10px"><input type="checkbox" id="bb-eve" style="width:18px;height:18px;accent-color:var(--coral)"> Eve intercepts and resends every photon</label>' +
    ctl(p, 'n', 'Channel noise', 0, 15, 0, 1, '0%') +
    '<div class="row"><button class="btn sm" type="button" id="bb-run">Run exchange</button></div>' +
    '<div class="bb" id="bb-tbl"></div><div class="readout" id="bb-read"></div>' +
    '<div class="note">Bases: + is rectilinear, × is diagonal. A bit is kept when Alice and Bob used the same basis. ✗ marks a kept bit that disagrees.</div>';
  var noise = 0;
  function h2(x) { return x <= 0 || x >= 1 ? 0 : -x * Math.log2(x) - (1 - x) * Math.log2(1 - x); }
  function run() {
    var eve = $('#bb-eve', box).checked, N = 400, rows = { ab: [], aB: [], eB: [], bB: [], bb: [], keep: [], err: [] }, kept = 0, errs = 0, i;
    for (i = 0; i < N; i++) {
      var ab = rand() < 0.5 ? 1 : 0, aB = rand() < 0.5 ? 1 : 0, sb = ab, sB = aB, eB = -1;
      if (eve) { eB = rand() < 0.5 ? 1 : 0; var eb = eB === aB ? ab : (rand() < 0.5 ? 1 : 0); sb = eb; sB = eB; }
      var bB = rand() < 0.5 ? 1 : 0, bb = bB === sB ? sb : (rand() < 0.5 ? 1 : 0);
      if (rand() < noise) { bb = 1 - bb; }
      var keep = bB === aB, err = keep && bb !== ab;
      if (keep) { kept++; } if (err) { errs++; }
      rows.ab.push(ab); rows.aB.push(aB); rows.eB.push(eB); rows.bB.push(bB); rows.bb.push(bb); rows.keep.push(keep); rows.err.push(err);
    }
    var show = 24, hd = '<table><tbody>';
    function row(lab, arr, f, cls) { hd += '<tr><th>' + lab + '</th>'; for (var j = 0; j < show; j++) { hd += '<td class="' + (cls ? cls(j) : '') + '">' + f(arr[j], j) + '</td>'; } hd += '</tr>'; }
    var bs = function (v) { return v ? '×' : '+'; };
    row('Alice bit', rows.ab, function (v) { return v; });
    row('Alice basis', rows.aB, bs);
    if (eve) { row('Eve basis', rows.eB, bs); }
    row('Bob basis', rows.bB, bs);
    row('Bob result', rows.bb, function (v) { return v; });
    row('Kept', rows.keep, function (v) { return v ? '✓' : ''; }, function (j) { return rows.keep[j] ? 'keep' : ''; });
    row('Error', rows.err, function (v) { return v ? '✗' : ''; }, function (j) { return rows.err[j] ? 'err' : ''; });
    $('#bb-tbl', box).innerHTML = hd + '</tbody></table>';
    var q = kept ? errs / kept : 0, frac = Math.max(0, 1 - 2 * h2(q));
    $('#bb-read', box).innerHTML = 'Sifted bits = <b>' + kept + '</b> of ' + N + ', errors = <b>' + errs + '</b><br>Error rate (QBER) = <b>' + (q * 100).toFixed(1) + '%</b><br>' +
      (q > 0.11 ? '<span class="no">Above about 11%: Alice and Bob abort. Someone is listening, or the line is too noisy.</span>' : '<span class="ok">Below about 11%: keep going.</span> Estimated secret key about <b>' + Math.floor(kept * frac) + '</b> bits after error correction and privacy amplification.');
  }
  bindR(box, p, 'n', function (v) { noise = v / 100; }, function (v) { return v + '%'; });
  $('#bb-run', box).addEventListener('click', run);
  $('#bb-eve', box).addEventListener('change', run);
  run();
};

/* ---------- Sensing ---------- */
SIMS.sensing = function (box) {
  var p = 'se';
  box.innerHTML = simHead('Ramsey fringes', 'π/2 pulse, wait τ, π/2 pulse, measure') +
    '<canvas id="se-a" style="aspect-ratio:16/8" role="img" aria-label="Probability of measuring 1 against free evolution time"></canvas>' +
    '<canvas id="se-b" style="aspect-ratio:16/5" role="img" aria-label="Relative sensitivity against free evolution time"></canvas>' +
    ctl(p, 'd', 'Detuning Δ (MHz)', 5, 200, 60, 1, '0.60') + ctl(p, 't2', 'T2 (µs)', 10, 100, 40, 1, '4.0') + ctl(p, 'tau', 'Wait τ (µs)', 0, 100, 15, 1, '1.5') +
    '<div class="readout" id="se-read"></div>';
  var D = 0.6, T2 = 4, tau = 1.5, TM = 10;
  function P(t) { return 0.5 * (1 + Math.exp(-t / T2) * Math.cos(2 * Math.PI * D * t)); }
  function S(t) { return (t / T2) * Math.exp(1 - t / T2); }
  var A = setupCanvas($('#se-a', box), function (ctx, w, h) {
    var bx = { x: 40, y: 14, w: w - 56, h: h - 36 };
    function mx(v) { return bx.x + v / TM * bx.w; } function my(v) { return bx.y + bx.h - v * bx.h; }
    var xt = [], i; for (i = 0; i <= 10; i += 2) { xt.push([i, String(i)]); }
    axes(ctx, bx, xt, [[0, '0'], [0.5, '0.5'], [1, '1']], mx, my);
    ctx.beginPath(); for (i = 0; i <= 600; i++) { var t = i / 600 * TM; if (i === 0) { ctx.moveTo(mx(t), my(P(t))); } else { ctx.lineTo(mx(t), my(P(t))); } }
    ctx.strokeStyle = C.teal; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = C.muted; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(bx.x, my(0.5)); ctx.lineTo(bx.x + bx.w, my(0.5)); ctx.stroke(); ctx.setLineDash([]);
    var env = [1, -1]; env.forEach(function (sg) { ctx.beginPath(); for (var k = 0; k <= 100; k++) { var tt = k / 100 * TM, y = 0.5 + sg * 0.5 * Math.exp(-tt / T2); if (k === 0) { ctx.moveTo(mx(tt), my(y)); } else { ctx.lineTo(mx(tt), my(y)); } } ctx.strokeStyle = C.violet; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1; });
    ctx.strokeStyle = C.coral; ctx.beginPath(); ctx.moveTo(mx(tau), bx.y); ctx.lineTo(mx(tau), bx.y + bx.h); ctx.stroke();
    glow(ctx, mx(tau), my(P(tau)), 16, C.coral, 0.8); ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(mx(tau), my(P(tau)), 5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'P(1) against τ (µs)', bx.x, 4, C.muted);
  });
  var B = setupCanvas($('#se-b', box), function (ctx, w, h) {
    var bx = { x: 40, y: 14, w: w - 56, h: h - 36 };
    function mx(v) { return bx.x + v / TM * bx.w; } function my(v) { return bx.y + bx.h - v * bx.h; }
    var xt = [], i; for (i = 0; i <= 10; i += 2) { xt.push([i, String(i)]); }
    axes(ctx, bx, xt, [[0, '0'], [0.5, '0.5'], [1, '1']], mx, my);
    ctx.beginPath(); for (i = 0; i <= 200; i++) { var t = i / 200 * TM; if (i === 0) { ctx.moveTo(mx(t), my(S(t))); } else { ctx.lineTo(mx(t), my(S(t))); } }
    ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.stroke();
    if (T2 <= TM) { ctx.strokeStyle = C.amber; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx(T2), bx.y); ctx.lineTo(mx(T2), bx.y + bx.h); ctx.stroke(); ctx.setLineDash([]); label(ctx, 'best τ = T2', mx(T2) + 6, bx.y + 8, C.amber); }
    glow(ctx, mx(tau), my(S(tau)), 14, C.coral, 0.8); ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(mx(tau), my(S(tau)), 5, 0, Math.PI * 2); ctx.fill();
    label(ctx, 'relative sensitivity τ·e^(−τ/T2)', bx.x, 4, C.muted);
  });
  function show() {
    $('#se-read', box).innerHTML = 'Phase gathered φ = 2πΔτ = <b>' + (2 * Math.PI * D * tau).toFixed(2) + '</b> rad   contrast = <b>' + Math.exp(-tau / T2).toFixed(2) + '</b>   P(1) = <b>' + P(tau).toFixed(3) + '</b><br>Sensitivity at this τ is <b>' + (S(tau) * 100).toFixed(0) + '%</b> of its best value.' + (Math.abs(tau - T2) < 0.25 ? ' <span class="ok">You are at the optimum.</span>' : '');
    A.redraw(); B.redraw();
  }
  bindR(box, p, 'd', function (v) { D = v / 100; show(); }, function (v) { return (v / 100).toFixed(2); });
  bindR(box, p, 't2', function (v) { T2 = v / 10; show(); }, function (v) { return (v / 10).toFixed(1); });
  bindR(box, p, 'tau', function (v) { tau = v / 10; show(); }, function (v) { return (v / 10).toFixed(1); });
  show();
};

/* ================= Lesson content ================= */
var LESSONS = [
  { id: 'qubit', lvl: 2, short: 'Qubit and Bloch sphere', title: 'The qubit and the Bloch sphere',
    tagline: 'One qubit is a point on a sphere. Every single-qubit gate is a rotation of that sphere.',
    eq: ['|ψ⟩ = cos(θ/2)|0⟩ + e^(iφ) sin(θ/2)|1⟩', 'P(0) = cos²(θ/2),  P(1) = sin²(θ/2)'],
    what: [
      'A qubit is any two-level quantum system whose two states are labelled |0⟩ and |1⟩. They can be two spin directions of an electron, two polarisations of a photon, two energy levels of an atom or the two lowest levels of a superconducting circuit. The label is a convention, and the physics underneath changes from one platform to the next.',
      'A general pure state is a weighted sum of the two basis states, with complex weights called amplitudes. Normalisation and the fact that an overall phase cannot be observed leave just two real numbers: an angle θ from the north pole and an angle φ around the equator. Those two numbers are a point on the surface of a sphere, the Bloch sphere. The north pole is |0⟩, the south pole is |1⟩, and the equator holds the equal superpositions such as |+⟩ and |−⟩.',
      'The height of the point tells you the measurement statistics in the computational basis. The longitude φ is invisible to that measurement but it is real: it decides how the qubit interferes with itself after further gates.'],
    how: [
      'A gate is a rotation. X, Y and Z are half-turns (180°) about the x, y and z axes. S and T are z-rotations by 90° and 45°. The Hadamard gate is a half-turn about the axis halfway between x and z, which swaps the Z basis and the X basis. Any single-qubit gate can be written as a rotation, so three angles are enough to describe all of them.',
      'On hardware the rotation is a physical pulse. A microwave pulse on a superconducting qubit with a given length, amplitude and phase rotates the Bloch vector by a chosen angle about a chosen axis. Calibrating a quantum computer largely means tuning these pulses until the rotations are accurate.',
      'Noisy qubits are not on the surface. A mixed state sits inside the ball, and the length of the vector measures purity. The lesson on decoherence shows the vector shrinking.'],
    used: [
      'Designing and calibrating control pulses, for example Rabi oscillation experiments that sweep a pulse length and watch the vector swing between the poles.',
      'Compilers that merge sequences of single-qubit gates into one rotation to shorten a circuit.',
      'Visual reasoning about algorithms such as phase estimation, where the final phase is read from the equator.'],
    watch: 'Press H, then S, then H and watch where the vector ends up. Press T eight times and note that you return to where you began. Drag the θ and φ sliders and see that P(0) depends only on the height of the arrow.' },

  { id: 'superposition', lvl: 2, short: 'Superposition and measurement', title: 'Superposition and measurement',
    tagline: 'Amplitudes are not probabilities. Measurement turns one into the other, and only through repetition.',
    eq: ['P(outcome) = |amplitude|²   (the Born rule)', 'standard error of the estimate = √(p(1−p)/n)'],
    what: [
      'A superposition is a state described by a sum of basis states with complex amplitudes. It is not a statement that the qubit is secretly 0 or 1 and we do not know which. Before measurement the qubit has no definite value of the measured quantity. It has an amplitude for each, and those amplitudes can be steered by later gates in ways that a hidden classical value could not.',
      'A measurement forces the issue. It returns 0 or 1 at random, with probability equal to the squared magnitude of the corresponding amplitude (the Born rule). Afterwards the state is the basis state you saw, so a second identical measurement gives the same answer. The superposition is gone.'],
    how: [
      'Because each run yields a single random bit, one run teaches almost nothing. Quantum programs are therefore executed many times, each repetition called a shot, and the answer is read from the histogram. The statistical error of a probability estimate shrinks as one over the square root of the number of shots, so ten times more precision costs a hundred times more shots.',
      'You can measure in other bases too. Measuring in the X basis amounts to applying a Hadamard gate and then measuring normally. Different bases reveal different information about the same state, and no single measurement reveals the amplitudes.',
      'Estimating a probability to precision ε takes about p(1−p)/ε² shots. Amplitude estimation, a quantum technique, improves the scaling to about 1/ε shots, which is the source of quadratic speedups in Monte Carlo methods.'],
    used: [
      'Every algorithm ends with sampling, so the shot budget sets the cost and precision of every experiment on real hardware.',
      'Estimating expectation values for chemistry, where each term of the Hamiltonian is measured in its own basis.',
      'Randomness generation: a measurement of an equal superposition is a source of random bits that is unpredictable according to quantum theory.'],
    watch: 'Set P(1) near 30% and add 10 shots, then add 1000. The estimate starts noisy and settles. The shaded band is two standard errors, and it narrows like 1/√n.' },

  { id: 'interference', lvl: 2, short: 'Interference', title: 'Interference: the engine of quantum algorithms',
    tagline: 'Amplitudes add like waves. A good algorithm makes the wrong answers cancel.',
    eq: ['P(D0) = cos²(φ/2),   P(D1) = sin²(φ/2)', 'amplitude(D0) = ½ (1 + e^(iφ))'],
    what: [
      'Classical probabilities only add. Quantum amplitudes can add or cancel, because they carry a sign or phase. Two routes to the same outcome can reinforce each other (constructive interference) or wipe each other out (destructive interference). This is the single feature that gives quantum algorithms their power.',
      'The cleanest demonstration is the Mach–Zehnder interferometer. A photon meets a beam splitter and goes into a superposition of two arms. A phase shifter delays one arm. A second beam splitter recombines them. Which of the two detectors fires depends on the relative phase φ between the arms, even though each photon travels alone.'],
    how: [
      'With a symmetric pair of beam splitters, a phase of zero sends every photon to detector D0 and a phase of π sends every one to D1. In between, the probabilities follow the cosine-squared curve. If you place a block in one arm, you learn which path the photon took, the superposition is destroyed, and the interference vanishes: the survivors split 50/50.',
      'A quantum algorithm is choreographed interference. It puts the register in a uniform superposition, then applies operations that rotate the phases of the amplitudes so that the wrong answers cancel and the right answer reinforces. Grover search does this with repeated reflections, and Shor’s algorithm does it with the quantum Fourier transform.',
      'The same circuit with qubits is H, then a Z-rotation by φ, then H again. It is the basic building block of phase estimation.'],
    used: [
      'Interferometric sensors: gravitational-wave detectors, atom-interferometer gravimeters and gyroscopes all read a tiny phase shift as a change in detector counts.',
      'Quantum algorithms, in which the whole design problem is arranging the interference.',
      'Optical quantum computing, where beam-splitter networks are the gates.'],
    watch: 'Slide φ from 0 to π and watch the photons switch detectors. Then tick “Block lower arm”. The fringes disappear, because knowing the path removes the interference.' },

  { id: 'entanglement', lvl: 3, short: 'Entanglement and Bell tests', title: 'Entanglement and Bell’s theorem',
    tagline: 'Entangled particles show correlations that no local classical model can reproduce.',
    eq: ['|Φ⁺⟩ = (|00⟩ + |11⟩)/√2', 'S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′)', 'classical |S| ≤ 2     quantum |S| ≤ 2√2 ≈ 2.83'],
    what: [
      'A joint state of two qubits is entangled when it cannot be written as one state for the first qubit times one for the second. The Bell state (|00⟩ + |11⟩)/√2 is the standard example. Neither qubit has a definite value on its own, yet when both are measured in the same basis the results always agree.',
      'The deeper fact is that the agreement persists for every choice of measurement direction in a pattern that cannot be explained by pre-agreed instructions. John Bell showed in 1964 that any theory in which each particle carries its own hidden instructions and no influence travels faster than light must obey an inequality. Quantum mechanics violates it.'],
    how: [
      'In the CHSH version of the test, Alice measures her particle along one of two directions (a or a′) and Bob along one of two (b or b′). Each result is +1 or −1. The correlation E is the average of the product of their results. The combination S above can never exceed 2 in absolute value for any local hidden-variable model. Quantum mechanics predicts a maximum of 2√2, known as Tsirelson’s bound, reached at 45° angle spacings.',
      'Experiments by Aspect in the 1980s and loophole-free experiments in 2015 observed the violation, and Aspect, Clauser and Zeilinger shared the 2022 Nobel Prize in Physics for this line of work.',
      'Entanglement cannot send messages. Each side sees random-looking results, and only when they compare notes over an ordinary channel does the correlation appear. That is why nothing travels faster than light.'],
    used: [
      'Teleportation and superdense coding, which spend one entangled pair plus classical bits to move quantum or classical information.',
      'The E91 key distribution protocol and device-independent security, where a Bell violation certifies that a device is behaving quantum mechanically.',
      'Error-correcting codes, whose logical qubits are entangled states spread across many physical qubits.',
      'Quantum repeaters and networks, which use entanglement swapping to link distant nodes.'],
    watch: 'Press “Optimal angles” and run the experiment. The score passes the classical bound of 2 and approaches 2.83. Then press “All zero”, a setting a classical model could also reach, and watch the advantage disappear.' },

  { id: 'circuit', lvl: 2, short: 'Circuits and the statevector', title: 'Quantum circuits and the statevector',
    tagline: 'A circuit is a list of matrices applied to a vector of 2ⁿ amplitudes.',
    eq: ['|ψ_final⟩ = U_k … U_2 U_1 |00…0⟩', 'CNOT: |c, t⟩ → |c, t ⊕ c⟩'],
    what: [
      'A quantum circuit is a diagram that reads left to right. Each horizontal line is a qubit, and each box is a gate. The circuit ends with measurement. A register of n qubits is described by 2ⁿ complex numbers, one amplitude for each bit string. This list is the statevector.',
      'Each gate is a unitary matrix, which means it preserves the total probability and can be undone. A single-qubit gate multiplies pairs of amplitudes. A two-qubit gate such as CNOT permutes or mixes amplitudes between pairs of basis states. The Hadamard, T and CNOT gates together can approximate any quantum computation to any accuracy.'],
    how: [
      'A simulator on a laptop does exactly what you see in the simulation: keep an array of amplitudes and update it gate by gate. Memory doubles with every added qubit, and about 30 qubits fills 16 GB. That doubling is why a quantum computer is a different kind of machine.',
      'Entanglement appears when the final state cannot be factored. Place an H on qubit 0 and a CNOT from 0 to 1, and you get a Bell state. Add one more CNOT to get the three-qubit GHZ state. Notice in the 3D chart that only |000⟩ and |111⟩ are left.',
      'Real devices only support a native gate set. Compilers rewrite your circuit into those gates and insert SWAP operations when the qubits you want to couple are not neighbours. Fewer gates and shallower circuits mean fewer errors.'],
    used: [
      'All gate-based quantum programming in Qiskit, Cirq, PennyLane, Braket and Q#.',
      'Verifying small circuits on classical simulators before spending hardware time.',
      'Teaching: the statevector shows exactly why interference and entanglement behave the way they do.'],
    watch: 'Press the presets for Bell and GHZ. Then build H, Z, H on qubit 0 yourself: the 3D bars show |1⟩, because the Z flips the sign between two Hadamards. Use “Run 1024 shots” to see sampling noise.' },

  { id: 'grover', lvl: 3, short: 'Grover search', title: 'Grover’s search algorithm',
    tagline: 'Find one marked item among N with about √N queries. Do too many and the answer gets worse.',
    eq: ['k* ≈ (π/4) √N', 'P(k) = sin²((2k + 1)θ),   θ = arcsin(1/√N)'],
    what: [
      'Suppose you have an unsorted list of N items and a way to check whether a candidate is the one you want. Classically you check about N/2 on average. Grover’s algorithm, published in 1996, finds the marked item with about (π/4)√N checks. That is a quadratic speedup and it is provably the best possible for unstructured search.',
      'The checker is called an oracle. On a quantum computer it acts on a superposition of all candidates at once, and it marks the winner by flipping the sign of its amplitude. A sign flip does not change any probability, so something else is needed to turn that hidden sign into a visible difference.'],
    how: [
      'Each Grover iteration has two steps. First, the oracle flips the sign of the marked amplitude. Second, the diffusion operator reflects every amplitude about the average. The marked amplitude, now below the average, is pushed far above it, while the others shrink slightly. In the picture of two directions (marked and unmarked), each iteration rotates the state by 2θ towards the marked item.',
      'The optimal number of iterations is about (π/4)√N. Past that point the rotation overshoots and the probability of the correct answer falls again, then oscillates. Unlike a classical search, you must know when to stop.',
      'With N = 32 the optimum is 4 iterations. For a million items it is about 785.'],
    used: [
      'Brute-force style searches over structured problems such as SAT and constraint satisfaction, where the oracle checks whether a configuration satisfies the constraints.',
      'Reducing the effective strength of symmetric keys: searching a 128-bit key space takes about 2⁶⁴ quantum steps, which is why AES-256 is recommended for long-term security.',
      'Amplitude amplification, a generalisation that speeds up many other algorithms as a subroutine.',
      'A caution: after error-correction overhead, a quadratic speedup only wins for very large problems or very slow classical checks.'],
    watch: 'Click a bar to choose the marked item, then press Step. The marked bar grows. Keep pressing past the optimum and the probability falls. The lower chart marks where you are on the theoretical curve.' },

  { id: 'shor', lvl: 3, short: 'Shor and the QFT', title: 'Shor’s algorithm and the quantum Fourier transform',
    tagline: 'Factoring reduces to finding a period, and a quantum computer finds periods efficiently.',
    eq: ['r = smallest r > 0 with aʳ ≡ 1 (mod N)', 'factors = gcd(a^(r/2) ± 1, N)'],
    what: [
      'RSA encryption is safe because multiplying two large primes is easy and recovering them from the product N is believed to be hard for classical computers. Peter Shor showed in 1994 that a quantum computer can factor N in time polynomial in the number of digits.',
      'The key observation is a classical piece of number theory. Pick a number a that shares no factor with N. The sequence a⁰, a¹, a², … taken modulo N repeats with some period r. If r is even and a^(r/2) is not congruent to −1, then gcd(a^(r/2) ± 1, N) gives a nontrivial factor of N. Finding the period is the only hard step.'],
    how: [
      'The quantum computer prepares a superposition of all x, computes aˣ mod N into a second register, and measures that second register. What remains in the first register is a superposition of values of x spaced exactly r apart. The quantum Fourier transform (QFT) then turns the periodic pattern into sharp peaks at multiples of Q/r, where Q is the size of the register. A measurement gives one of the peaks, y, and the continued-fraction expansion of y/Q recovers r.',
      'The QFT is the quantum analogue of the fast Fourier transform. On n qubits it needs only about n² gates, while the classical FFT on 2ⁿ values needs about n·2ⁿ operations. It is a building block of phase estimation, which is why it appears in chemistry algorithms too.',
      'Everything except the period finding runs on a classical computer. A failed run, for example when y gives only a divisor of r, is simply repeated.'],
    used: [
      'It is the reason for post-quantum cryptography. Published resource estimates for breaking 2048-bit RSA have fallen to under one million noisy physical qubits and about a week of run time in a 2025 analysis by Craig Gidney, with a machine far larger than any available today.',
      'Phase estimation, the workhorse of fault-tolerant chemistry, uses the same QFT.',
      'Elliptic-curve cryptography falls to a close relative of the same algorithm, so it is also being replaced.'],
    watch: 'Choose N = 15 and a = 7 to see period 4 with peaks at 0, 64, 128, 192. Then choose a = 14: the period is 2 and 14 ≡ −1 (mod 15), so this choice fails. Try different N and run the measurement a few times.' },

  { id: 'vqe', lvl: 3, short: 'Variational algorithms', title: 'Variational algorithms: VQE and QAOA',
    tagline: 'A short quantum circuit with knobs, and a classical optimiser that turns them.',
    eq: ['E(θ) = ⟨ψ(θ)| H |ψ(θ)⟩ ≥ E₀', 'dE/dθ = ½ [E(θ + π/2) − E(θ − π/2)]   (parameter shift)'],
    what: [
      'Variational algorithms were designed for today’s noisy machines. Instead of a long, precise circuit, they use a short circuit (the ansatz) with adjustable angles θ. The quantum processor prepares the state and measures its energy. A classical optimiser changes the angles and the loop repeats.',
      'The justification is the variational principle: no state can have lower energy than the ground state, so minimising the measured energy pushes the state towards the ground state. The Variational Quantum Eigensolver (VQE) uses this for molecules and materials. The Quantum Approximate Optimisation Algorithm (QAOA) uses the same idea for combinatorial problems such as Max-Cut.'],
    how: [
      'The Hamiltonian is written as a sum of Pauli strings. Each is measured in its own basis and the results are added. For a rotation gate, the exact gradient comes from two extra evaluations at shifted angles, called the parameter-shift rule, so gradient descent is possible on hardware.',
      'Every energy estimate comes from finite shots, so the landscape the optimiser sees is noisy. With few shots the optimiser jitters, and with too many shots the experiment is slow. Deeper circuits can also have flat gradients, called barren plateaus, that make training exponentially hard.',
      'The model here is the simplest one: H = a·Z + b·X on one qubit, with an ansatz that rotates about y by the angle θ. The exact ground energy is −√(a² + b²).'],
    used: [
      'Small molecule demonstrations (H₂, LiH, BeH₂) and hardware benchmarks.',
      'Prototyping hybrid workflows that will carry over to error-corrected machines.',
      'Optimisation and machine-learning experiments. Evidence of advantage over the best classical methods is still lacking, and the field is actively debating it.'],
    watch: 'Press Optimise with shots set to exact and the energy falls smoothly to the floor. Then lower the shots to 20 and the path wobbles. Change a and b to move the minimum.' },

  { id: 'noise', lvl: 4, short: 'Decoherence', title: 'Decoherence, T1 and T2',
    tagline: 'Qubits leak information to the world around them, and this sets how long a computation can run.',
    eq: ['x(t) = e^(−t/T₂),   z(t) = 1 − e^(−t/T₁)   (start in |+⟩)', 'F_gate = (3 + e^(−t_g/T₁) + 2e^(−t_g/T₂)) / 6      T₂ ≤ 2T₁'],
    what: [
      'No qubit is perfectly isolated. Stray electric and magnetic fields, vibrations, heat, material defects and the control electronics all interact with it. Each interaction copies a little information about the qubit into the environment, and that destroys the delicate phase relationships a computation depends on. This process is called decoherence.',
      'Two numbers summarise it. T1 is the energy relaxation time: how long an excited |1⟩ takes to fall to |0⟩. T2 is the dephasing time: how long a superposition keeps its phase. T2 can never exceed twice T1.'],
    how: [
      'On the Bloch sphere, a state starting on the equator slides toward the north pole (T1) and its arrow shrinks toward the z-axis (T2). The arrow gets shorter because the state turns into a statistical mixture, and the length of the arrow is the purity of the state.',
      'Gate errors follow from these times. A gate that takes time t_g has an average fidelity near the expression above, so each operation costs roughly t_g/(6T₁) + t_g/(3T₂). If each gate has error ε, a circuit of depth d keeps a fidelity of about (1 − ε)^d, which gives a practical limit of roughly 1/ε operations.',
      'This is why the ratio of gate speed to coherence time matters more than either number alone. Superconducting qubits run very fast gates with coherence of tens to hundreds of microseconds. Trapped ions have coherence of seconds or longer but slower gates.'],
    used: [
      'Routine hardware diagnostics: T1 is measured by exciting the qubit and waiting, T2 by Ramsey and echo experiments.',
      'Choosing a platform and a circuit depth for a given algorithm.',
      'Estimating how many error-correction rounds are needed for a given hardware.'],
    watch: 'Press Play and watch the arrow shrink and slide north. Make T2 equal to 2·T1 (the best case) and compare. Lengthen the gate time and see the usable circuit depth in the lower chart drop.' },

  { id: 'qec', lvl: 4, short: 'Error correction', title: 'Quantum error correction',
    tagline: 'Spread one logical qubit over many physical ones, and detect errors without looking at the data.',
    eq: ['P_L = Σ C(d,k) p^k (1−p)^(d−k),   k ≥ (d+1)/2   (repetition code)', 'below threshold: logical error falls exponentially with code distance'],
    what: [
      'Useful algorithms need error rates around one in a trillion per operation. The best physical qubits manage about one in a thousand to one in ten thousand. The gap is closed by error correction: encode a single logical qubit in many physical qubits so that errors can be detected and fixed faster than they accumulate.',
      'Copying is forbidden, so quantum codes cannot simply repeat the state. Instead they measure parity checks, called syndromes, which reveal where an error happened without revealing the encoded information. A decoder then chooses the most likely correction.'],
    how: [
      'The simplest example is the repetition code against bit flips: store 0 as 000, and when one bit flips, a majority vote restores it. The simulation uses this code. The logical error is the chance that more than half the qubits flip at once. The formula shows that a bigger code distance d helps only if the physical error rate p is below a threshold, which here is 50%.',
      'A real quantum code must catch both bit flips and phase flips. Shor’s nine-qubit code does that, and the surface code arranges qubits on a grid with a threshold near 1% and a cost of about d² data qubits per logical qubit. In 2024 Google reported surface-code memories in which the logical error fell by roughly a factor of two each time the code distance grew by two, which is the below-threshold behaviour the theory predicts.',
      'Newer quantum low-density parity-check (qLDPC) codes, which IBM’s roadmap builds on, aim for far fewer physical qubits per logical qubit than the surface code, at the cost of longer-range connections.'],
    used: [
      'Fault-tolerant machines of the 2030s: most of their qubits will be error-correction overhead.',
      'Resource estimation, which converts an algorithm into a count of physical qubits and run time.',
      'Real-time decoding hardware, which must keep up with microsecond cycles.'],
    watch: 'Press Inject noise at p = 10% with d = 3, then d = 9. Larger codes fix more. Push p above 50% and larger codes become worse. Run 20,000 trials and compare the violet dot with the curve.' },

  { id: 'bb84', lvl: 5, short: 'Quantum key distribution', title: 'Quantum key distribution (BB84)',
    tagline: 'An eavesdropper cannot copy a quantum state, so any listening leaves a trace.',
    eq: ['QBER = errors / sifted bits', 'secret fraction ≈ 1 − 2h(QBER),  h = binary entropy;  positive below about 11%'],
    what: [
      'Two people who want to encrypt messages need a shared secret key. Classical key exchange relies on mathematical hardness. Quantum key distribution (QKD) relies on physics: measuring an unknown quantum state in the wrong way disturbs it, so an eavesdropper must leave evidence.',
      'In BB84, proposed by Bennett and Brassard in 1984, Alice sends single photons, each carrying a random bit encoded in one of two bases: rectilinear (+) or diagonal (×). Bob measures each photon in a randomly chosen basis. When his basis matches hers, he gets her bit. When it does not, his result is random.'],
    how: [
      'After the transmission, Alice and Bob announce their bases over an open channel (not the bits) and keep only the positions where the bases matched. This is sifting and it keeps about half. They then sacrifice a sample of the sifted bits to measure the error rate.',
      'An intercept-and-resend attacker must guess a basis for each photon and is wrong half the time. A wrong guess gives Bob a random result with probability one half, so Eve adds errors to about 25% of the sifted bits. Natural noise adds some errors too, so the protocol sets a threshold. Above roughly 11% the parties abort. Below it they run error correction and privacy amplification, which shrink the key to remove whatever Eve might know.',
      'Practical systems face photon loss, which limits fibre links to a few hundred kilometres without relay nodes, and imperfect detectors, which open side channels. Satellites and trusted-node chains extend the range.'],
    used: [
      'Government, banking and research networks, including multi-thousand-kilometre trusted-node backbones in China and European pilot networks.',
      'Satellite links, first demonstrated by the Micius satellite.',
      'Complementary to post-quantum cryptography: QKD secures the key exchange with physics, PQC secures it with new mathematics.'],
    watch: 'Run the exchange without Eve: errors are near zero. Tick Eve and run again: the error rate jumps to about 25%. Add a little channel noise to see why the abort threshold is set at 11%, not zero.' },

  { id: 'sensing', lvl: 4, short: 'Quantum sensing', title: 'Quantum sensing and Ramsey interferometry',
    tagline: 'A superposition is an extremely sensitive ruler. Measure its phase and you measure the world.',
    eq: ['P(1) = ½ [1 + e^(−τ/T₂) cos(2πΔ·τ)]', 'sensitivity ∝ τ e^(−τ/T₂),  best at τ = T₂'],
    what: [
      'Quantum sensors use fragile quantum states as probes. A qubit prepared in a superposition accumulates phase at a rate set by the energy difference between its two states. Anything that shifts that energy, such as a magnetic field, an electric field, acceleration, rotation or temperature, shows up as a change in phase, and the phase can be read out very precisely.',
      'The standard protocol is Ramsey interferometry. Apply a π/2 pulse to put the qubit on the equator, wait a free-evolution time τ while the signal rotates the vector, apply a second π/2 pulse, and measure. The probability of finding 1 oscillates with the detuning Δ and decays with the dephasing time T2.'],
    how: [
      'A longer wait gives a bigger phase for the same field, so sensitivity grows with τ. But the signal contrast decays as e^(−τ/T₂). The product τ·e^(−τ/T₂) peaks at τ = T₂, so the best interrogation time equals the coherence time and longer coherence means a better sensor.',
      'With N independent probes the noise falls as 1/√N (the standard quantum limit). Entangled or squeezed probes can improve this towards 1/N (the Heisenberg limit). That is the main reason entanglement is being engineered into sensors.',
      'An atomic clock is a Ramsey experiment in a feedback loop: a laser is tuned until the atoms sit exactly at the centre of the fringe, and the laser frequency then defines the time unit.'],
    used: [
      'Atomic clocks for satellite navigation, telecom and finance timestamps, and the optical clocks that may redefine the second.',
      'Diamond NV-centre magnetometers for imaging chips, cells and rocks, and optically pumped magnetometers for wearable brain scanners.',
      'Cold-atom gravimeters and gyroscopes for geology and navigation without GPS.',
      'Squeezed light in gravitational-wave observatories, which lowers the quantum noise floor.'],
    watch: 'Move the detuning slider and the fringes get faster. Increase T2 and the oscillations last longer. The lower curve shows sensitivity peaking at τ = T2, where the marker sits.' }
];

  var LEVELS = [
    { id: 1, name: 'Foundations', time: '3 to 4 weeks',
      blurb: 'The mathematics and Python you need so that nothing later feels like magic.',
      prereq: 'High-school algebra and basic programming.',
      outcome: 'Read and write state vectors and matrices, and check that a matrix is unitary.',
      topics: [
        ['Complex numbers', 'Modulus, phase and Euler’s formula. Why amplitudes are complex.'],
        ['Vectors and inner products', 'Orthonormal bases, norms and projections.'],
        ['Matrices and unitaries', 'Matrix products, the adjoint, unitary and Hermitian matrices.'],
        ['Eigenvalues and eigenvectors', 'Why observables are Hermitian and outcomes are eigenvalues.'],
        ['Tensor products', 'Combining systems with the Kronecker product, by hand and in NumPy.'],
        ['Probability and NumPy', 'Distributions, expectation values and sampling with Python.']
      ] },
    { id: 2, name: 'Core concepts', time: '4 to 6 weeks',
      blurb: 'Qubits, gates, measurement and entanglement, all worked through on small circuits.',
      prereq: 'Level 1, or comfort with vectors, matrices and complex numbers.',
      outcome: 'Build and reason about circuits of up to three qubits, including Bell states and teleportation.',
      topics: [
        ['The qubit and the Bloch sphere', 'Pure states as points on a sphere, and what θ and φ mean.'],
        ['Superposition and measurement', 'The Born rule, collapse, and measuring in other bases.'],
        ['Single-qubit gates', 'X, Y, Z, H, S, T and arbitrary rotations.'],
        ['Multi-qubit states and CNOT', 'Basis ordering, controlled gates and building larger circuits.'],
        ['Entanglement and Bell states', 'Correlations that no classical model reproduces, and the CHSH test.'],
        ['Teleportation and superdense coding', 'Using entanglement plus classical bits to move information.'],
        ['Circuits in Qiskit or Cirq', 'Draw, simulate and run circuits with a real SDK.']
      ] },
    { id: 3, name: 'Algorithms', time: '6 to 8 weeks',
      blurb: 'The ideas behind every known quantum speedup, and the limits of each.',
      prereq: 'Level 2, plus a working SDK installation.',
      outcome: 'Implement Grover and phase estimation, explain Shor, and judge whether a claimed speedup is real.',
      topics: [
        ['Oracles and phase kickback', 'How a function is queried in superposition and how phase moves to the control.'],
        ['Deutsch–Jozsa and Bernstein–Vazirani', 'The first provable separations between quantum and classical queries.'],
        ['Grover search', 'Amplitude amplification, the quadratic speedup, and choosing the iteration count.'],
        ['Quantum Fourier transform', 'The circuit, its O(n²) gate count and why it matters.'],
        ['Phase estimation', 'Reading an eigenvalue of a unitary into a register of qubits.'],
        ['Shor’s algorithm', 'Reduction of factoring to period finding, and the cost of running it.'],
        ['Variational algorithms', 'VQE and QAOA, and the classical optimizer loop around them.']
      ] },
    { id: 4, name: 'Hardware and noise', time: '4 to 6 weeks',
      blurb: 'What real devices do wrong, and the first tools for living with it.',
      prereq: 'Level 3, or at least Level 2 and some time on a cloud backend.',
      outcome: 'Explain why current devices are limited and apply mitigation or a small code to a noisy circuit.',
      topics: [
        ['Qubit platforms', 'Superconducting, trapped-ion, neutral-atom, photonic and spin qubits compared.'],
        ['Decoherence: T1 and T2', 'Relaxation, dephasing, and how they limit circuit depth.'],
        ['Noise models and density matrices', 'Mixed states, Kraus operators and depolarizing noise.'],
        ['Transpilation and connectivity', 'Mapping a circuit onto a device’s native gates and coupling graph.'],
        ['Error mitigation', 'Zero-noise extrapolation, readout correction and probabilistic error cancellation.'],
        ['Error correction basics', 'The repetition code, syndromes and the stabilizer idea.'],
        ['Benchmarking', 'Randomized benchmarking, quantum volume and what each number tells you.']
      ] },
    { id: 5, name: 'Advanced topics', time: 'Ongoing',
      blurb: 'The research frontier: fault tolerance, complexity, cryptography and applications.',
      prereq: 'Level 4, and comfort reading papers.',
      outcome: 'Read current research papers and estimate the resources a useful algorithm would need.',
      topics: [
        ['Stabilizer formalism', 'Clifford circuits, the Gottesman–Knill theorem and efficient simulation.'],
        ['Surface codes and decoders', 'Code distance, thresholds and minimum-weight perfect matching.'],
        ['Fault tolerance and magic states', 'Logical gates, transversality limits and T-state distillation.'],
        ['Quantum complexity', 'BQP, QMA and the evidence for quantum advantage.'],
        ['Quantum cryptography', 'BB84 key distribution, and post-quantum cryptography for classical systems.'],
        ['Quantum machine learning', 'Variational classifiers, kernels, and where speedups are in doubt.'],
        ['Hamiltonian simulation', 'Trotterization and quantum chemistry on future hardware.'],
        ['Resource estimation', 'Physical qubits and runtime for a useful algorithm at a given error rate.']
      ] }
  ];

  var GT = [
    ['X', [['0', '1'], ['1', '0']], '', 'Bit flip', 'Swaps |0⟩ and |1⟩. A π rotation about the x-axis.'],
    ['Y', [['0', '−i'], ['i', '0']], '', 'Bit and phase flip', 'A π rotation about the y-axis.'],
    ['Z', [['1', '0'], ['0', '−1']], '', 'Phase flip', 'Leaves |0⟩ alone and negates |1⟩. A π rotation about the z-axis.'],
    ['H', [['1', '1'], ['1', '−1']], '1/√2', 'Hadamard', 'Switches between the Z and X bases. Turns |0⟩ into an equal superposition.'],
    ['S', [['1', '0'], ['0', 'i']], '', 'Quarter phase', 'A π/2 rotation about z. Applying it twice gives Z.'],
    ['T', [['1', '0'], ['0', 'e^(iπ/4)']], '', 'Eighth phase', 'A π/4 rotation about z. Needed for universality, and the costly gate in error-corrected machines.'],
    ['CNOT', [['1', '0', '0', '0'], ['0', '1', '0', '0'], ['0', '0', '0', '1'], ['0', '0', '1', '0']], '', 'Controlled NOT', 'Flips the target qubit when the control is |1⟩. Creates entanglement from a superposition.']
  ];

  var QUESTIONS = [
    { l: 1, q: 'A qubit is in the state α|0⟩ + β|1⟩. Which condition must the amplitudes satisfy?',
      o: ['α + β = 1', '|α|² + |β|² = 1', 'α = β', 'α and β must both be real'], a: 1,
      e: 'The measurement probabilities are |α|² and |β|², and probabilities sum to 1. The amplitudes can be complex and do not need to be equal.' },
    { l: 1, q: 'Which kind of matrix represents a gate acting on a closed quantum system?',
      o: ['Symmetric', 'Diagonal', 'Unitary', 'Any invertible matrix'], a: 2,
      e: 'Unitary matrices satisfy U†U = I. They preserve the norm of the state, so total probability stays at 1, and they are always reversible.' },
    { l: 1, q: 'What is the inner product ⟨0|1⟩?',
      o: ['0', '1', '1/√2', '−1'], a: 0,
      e: '|0⟩ and |1⟩ are orthonormal, so ⟨0|0⟩ = 1 and ⟨0|1⟩ = 0. Orthogonal states can be told apart perfectly.' },
    { l: 1, q: 'How many complex amplitudes describe a general state of 3 qubits?',
      o: ['3', '6', '9', '8'], a: 3,
      e: 'n qubits need 2ⁿ amplitudes, so 3 qubits need 8. This exponential growth is why classical simulation becomes hard.' },

    { l: 2, q: 'What does the Hadamard gate do to |0⟩?',
      o: ['Gives |1⟩', '(|0⟩ + |1⟩)/√2', '(|0⟩ − |1⟩)/√2', 'Leaves it unchanged'], a: 1,
      e: 'H maps |0⟩ to |+⟩ = (|0⟩ + |1⟩)/√2 and |1⟩ to |−⟩. It turns a basis state into an equal superposition.' },
    { l: 2, q: 'You measure (|0⟩ + |1⟩)/√2 in the computational basis. What is P(1)?',
      o: ['0', '25%', '50%', '100%'], a: 2,
      e: 'By the Born rule, P(1) = |1/√2|² = 1/2. Afterwards the state collapses to whichever basis state you observed.' },
    { l: 2, q: 'Which circuit prepares (|00⟩ + |11⟩)/√2 from |00⟩?',
      o: ['CNOT, then H on the control', 'H on qubit 0, then CNOT with qubit 0 as control', 'X on both qubits', 'H on both qubits'], a: 1,
      e: 'H on qubit 0 gives (|00⟩ + |10⟩)/√2. The CNOT then flips qubit 1 whenever qubit 0 is 1, giving (|00⟩ + |11⟩)/√2.' },
    { l: 2, q: 'Why can an unknown quantum state not be copied?',
      o: ['Measurement destroys all information', 'Qubits are too fragile to copy', 'Copying needs extra qubits', 'The no-cloning theorem, which follows from linearity'], a: 3,
      e: 'A universal copier would have to be linear and unitary, which is impossible for non-orthogonal states. Known states, or states from an orthogonal set, can be copied.' },
    { l: 2, q: 'The states |ψ⟩ and e^(iγ)|ψ⟩ differ by a global phase. How do they differ physically?',
      o: ['They give different measurement statistics', 'They respond differently to H', 'They do not differ at all', 'They differ once entangled'], a: 2,
      e: 'A global phase cancels in every probability |⟨m|ψ⟩|². Only relative phases between amplitudes can be observed.' },

    { l: 3, q: 'About how many oracle queries does Grover’s algorithm need to search N unstructured items?',
      o: ['O(log N)', 'O(√N)', 'O(N)', 'O(N²)'], a: 1,
      e: 'Grover gives a quadratic speedup, roughly (π/4)√N iterations against about N/2 classical queries. It is not an exponential speedup.' },
    { l: 3, q: 'Shor’s algorithm factors integers by reducing the problem to which subproblem?',
      o: ['Sorting', 'Graph coloring', 'Period finding', 'Matrix inversion'], a: 2,
      e: 'The quantum Fourier transform finds the period of aˣ mod N. Classical post-processing then turns that period into factors of N.' },
    { l: 3, q: 'Deutsch–Jozsa decides whether a function is constant or balanced. How many quantum queries does it need?',
      o: ['1', 'n', '2ⁿ⁻¹ + 1', '2ⁿ'], a: 0,
      e: 'One query is enough, using phase kickback and interference. A deterministic classical algorithm needs 2ⁿ⁻¹ + 1 queries in the worst case.' },
    { l: 3, q: 'In VQE, what does the classical computer do?',
      o: ['Runs the quantum gates', 'Updates circuit parameters to lower the measured energy', 'Corrects hardware errors', 'Stores the full wavefunction'], a: 1,
      e: 'The quantum device prepares a parameterized state and measures its energy. A classical optimizer adjusts the parameters and the loop repeats until the energy stops improving.' },
    { l: 3, q: 'Phase kickback is the effect where…',
      o: ['the eigenvalue of a controlled operation shows up as a phase on the control qubit', 'errors move from data qubits to ancilla qubits', 'measurement changes the circuit that follows', 'a gate adds only a global phase'], a: 0,
      e: 'When a controlled gate acts on an eigenstate of its target, the eigenvalue is imprinted on the control as a relative phase. Phase estimation and Deutsch–Jozsa both rely on it.' },

    { l: 4, q: 'What does the T1 time measure?',
      o: ['How long a qubit keeps its phase', 'How fast a qubit relaxes from |1⟩ toward |0⟩', 'The duration of a CNOT gate', 'The readout integration time'], a: 1,
      e: 'T1 is energy relaxation. T2 is the dephasing time, and it is always bounded by T2 ≤ 2·T1.' },
    { l: 4, q: 'Which platform stores qubits in Josephson-junction circuits cooled to millikelvin temperatures?',
      o: ['Trapped ions', 'Photonic circuits', 'Neutral atoms', 'Superconducting transmons'], a: 3,
      e: 'Transmons are superconducting circuits run at roughly 10 to 20 mK in dilution refrigerators and driven by microwave pulses.' },
    { l: 4, q: 'What does NISQ stand for?',
      o: ['Noisy Intermediate-Scale Quantum', 'Non-Interacting Spin Qubit', 'Native Instruction Set Quantum', 'Near-Ideal Stable Qubit'], a: 0,
      e: 'John Preskill coined the term for today’s devices, which have tens to thousands of noisy qubits and no full error correction.' },
    { l: 4, q: 'A 3-qubit repetition code (|0⟩ → |000⟩) can correct which error?',
      o: ['Any single-qubit error', 'A single phase flip', 'A single bit flip', 'Two bit flips'], a: 2,
      e: 'Majority vote repairs one X error. Phase flips go undetected, which is why Shor’s 9-qubit code and the surface code protect against both kinds.' },
    { l: 4, q: 'Zero-noise extrapolation estimates the ideal result by…',
      o: ['running at several amplified noise levels and extrapolating back to zero noise', 'cooling the chip until noise vanishes', 'encoding qubits in a surface code', 'discarding any run that contains an error'], a: 0,
      e: 'It is an error-mitigation method. It needs more circuit runs but no extra qubits, and it works best for shallow circuits.' },

    { l: 5, q: 'The surface code’s fault-tolerance threshold is roughly…',
      o: ['0.0001%', '25%', '1%', '50%'], a: 2,
      e: 'With a standard noise model and a good decoder, thresholds near 1% per operation are often quoted. Below it, a larger code distance suppresses logical errors exponentially.' },
    { l: 5, q: 'BQP is the class of decision problems that…',
      o: ['a quantum computer solves in polynomial time with bounded error', 'every classical computer solves in polynomial time', 'are NP-complete', 'need exponential memory'], a: 0,
      e: 'BQP is the quantum counterpart of BPP. Factoring is in BQP, but it is not known whether any NP-complete problem is.' },
    { l: 5, q: 'What does the Gottesman–Knill theorem say?',
      o: ['All quantum circuits can be simulated classically', 'Error correction is impossible', 'CNOT cannot create entanglement', 'Clifford circuits can be simulated efficiently on a classical computer'], a: 3,
      e: 'Circuits made only of H, S and CNOT on stabilizer states can be tracked in polynomial time. Universality needs a non-Clifford resource such as the T gate.' },
    { l: 5, q: 'Why are T gates expensive in a surface-code machine?',
      o: ['They are slower to calibrate', 'They are not transversal there, so they need magic state distillation', 'They destroy entanglement', 'They only work on physical qubits'], a: 1,
      e: 'Clifford gates are comparatively cheap. T states are prepared noisily and then distilled, and the distillation factories can dominate the qubit count.' },
    { l: 5, q: 'Why does an eavesdropper on BB84 become detectable?',
      o: ['Photons carry timestamps', 'The key is encrypted twice', 'Measuring in the wrong basis disturbs the state and adds errors', 'Quantum channels are always noisy'], a: 2,
      e: 'Eve cannot copy the qubits and must guess a basis for each. Wrong guesses raise the error rate Alice and Bob see, about 25% on the sampled bits for a full intercept-and-resend attack.' }
  ];

  var PROJECTS = [
    { l: 1, t: 'NumPy statevector simulator', d: 'Write your own simulator. States are vectors, gates are matrices, and measurement is sampling from |amplitude|².', s: 'Python, NumPy', w: '1 week', p: 'Tensor products, unitary evolution, the Born rule' },
    { l: 1, t: 'Linear algebra drill notebook', d: 'A notebook of checks and exercises that test unitarity, eigendecompositions and Kronecker products on random matrices.', s: 'Python, Jupyter', w: '3 to 4 days', p: 'Matrix fluency, numerical tolerance' },
    { l: 2, t: 'CHSH Bell test', d: 'Run the CHSH experiment on a simulator and on a cloud device. Compare against the classical bound of 2 and the quantum value of 2√2.', s: 'Qiskit or Cirq', w: '1 week', p: 'Entanglement, measurement bases, hardware noise' },
    { l: 2, t: 'Quantum random number generator', d: 'Build a generator from H and measurement, then test its output with frequency and runs tests.', s: 'Python, any SDK', w: '3 days', p: 'Measurement, statistics, honest evaluation' },
    { l: 2, t: 'Teleportation circuit', d: 'Teleport an arbitrary state between two qubits using mid-circuit measurement and classically controlled gates.', s: 'Qiskit or Cirq', w: '1 week', p: 'Entanglement as a resource, classical control' },
    { l: 3, t: 'Grover solver for a small puzzle', d: 'Encode a 4×4 Sudoku or a small SAT instance as an oracle and find the solution with Grover search.', s: 'Qiskit', w: '2 weeks', p: 'Oracle design, iteration count, circuit depth' },
    { l: 3, t: 'Shor’s algorithm for 15 and 21', d: 'Implement period finding with the QFT on a simulator and report the gate counts as N grows.', s: 'Qiskit or Cirq', w: '2 weeks', p: 'QFT, modular arithmetic, scaling costs' },
    { l: 3, t: 'VQE for the H₂ molecule', d: 'Find the ground-state energy of hydrogen and plot the energy curve against bond length.', s: 'PennyLane or Qiskit', w: '2 weeks', p: 'Ansatz choice, optimizers, chemistry basics' },
    { l: 3, t: 'QAOA for Max-Cut', d: 'Solve Max-Cut on small graphs and compare your result with a classical heuristic at increasing circuit depth.', s: 'PennyLane or Qiskit', w: '2 weeks', p: 'Cost Hamiltonians, hybrid loops, fair baselines' },
    { l: 4, t: 'Noisy simulator study', d: 'Build a noise model from T1, T2 and readout error, then measure how Bell-state fidelity falls as circuit depth grows.', s: 'Qiskit Aer', w: '1 to 2 weeks', p: 'Decoherence, noise models, fidelity' },
    { l: 4, t: 'Error mitigation benchmark', d: 'Implement zero-noise extrapolation and readout correction. Compare the raw and mitigated results on a real cloud backend.', s: 'Qiskit, Mitiq', w: '2 weeks', p: 'Mitigation trade-offs, running real hardware' },
    { l: 4, t: '3-qubit repetition code', d: 'Simulate bit-flip noise and plot the logical error rate against the physical error rate to find the break-even point.', s: 'Python, any SDK', w: '1 week', p: 'Syndromes, decoding, pseudo-threshold' },
    { l: 5, t: 'Surface code decoder', d: 'Generate surface-code circuits, decode them with minimum-weight perfect matching, and plot logical error against code distance.', s: 'Stim, PyMatching', w: '3 to 4 weeks', p: 'Stabilizer circuits, decoders, thresholds' },
    { l: 5, t: 'BB84 with an eavesdropper', d: 'Simulate key exchange, add an intercept-and-resend attacker, and show the error rate that reveals her.', s: 'Python', w: '1 to 2 weeks', p: 'QKD, sifting, error estimation' },
    { l: 5, t: 'Resource estimate for a useful algorithm', d: 'Estimate physical qubits and runtime for factoring a 2048-bit number from code distance, error rate and cycle time. Compare with published estimates.', s: 'Python, papers', w: '2 weeks', p: 'Fault-tolerant overheads, reading research' }
  ];

  var TOOLS = [
    ['Qiskit', 'IBM’s Python SDK for circuits, simulators and hardware access.', 'L2–5'],
    ['Cirq', 'Google’s framework for building and simulating noisy-device circuits.', 'L2–4'],
    ['PennyLane', 'Differentiable quantum programming, strong for variational algorithms and QML.', 'L3–5'],
    ['Amazon Braket', 'Managed access to several kinds of quantum hardware and simulators.', 'L3–4'],
    ['Q# and Azure Quantum', 'Microsoft’s quantum language and tools, including resource estimation.', 'L3–5'],
    ['Stim', 'A very fast stabilizer-circuit simulator used for error-correction research.', 'L5'],
    ['QuTiP', 'Open quantum system dynamics, useful for understanding noise physically.', 'L4–5']
  ];
  var BOOKS = [
    ['Quantum Computation and Quantum Information', 'Nielsen and Chuang. The standard graduate reference, best used alongside a course.', 'L2–5'],
    ['Quantum Computer Science: An Introduction', 'N. David Mermin. A short, clear route in for readers with a CS background.', 'L2–3'],
    ['Lecture notes on quantum computation', 'John Preskill, Caltech. Free notes with a strong treatment of error correction.', 'L4–5'],
    ['Quantum Computing Since Democritus', 'Scott Aaronson. Complexity and the foundations, written conversationally.', 'L3–5'],
    ['Your SDK’s own learning material', 'Each major SDK ships tutorials that are kept in step with its API.', 'L2–4']
  ];


/* ================= Wiring ================= */
var nTopics = 0;
LEVELS.forEach(function (L) { nTopics += L.topics.length; });

(function wire() {
  var stats = [[LESSONS.length + 2, 'live simulations'], [LEVELS.length, 'learning levels'], [QUESTIONS.length, 'practice questions'], [PROJECTS.length, 'project ideas']];
  $('#hero-stats').innerHTML = stats.map(function (s) { return '<div><b>' + s[0] + '</b>' + s[1] + '</div>'; }).join('');

  var host = $('#lessons'), idx = $('#lab-index');
  host.innerHTML = LESSONS.map(function (L) {
    function paras(a) { return a.map(function (t) { return '<p>' + t + '</p>'; }).join(''); }
    return '<article class="lesson" id="lesson-' + L.id + '"><div class="lesson-text">' +
      '<div class="meta"><span class="tag">Level ' + L.lvl + ' · ' + esc(LEVELS[L.lvl - 1].name) + '</span></div>' +
      '<h3>' + esc(L.title) + '</h3><p class="tagline">' + esc(L.tagline) + '</p>' +
      '<h4>Key equations</h4>' + L.eq.map(function (e) { return '<div class="eqn">' + esc(e) + '</div>'; }).join('') +
      '<h4>What it is</h4>' + paras(L.what) +
      '<h4>How it works</h4>' + paras(L.how) +
      '<h4>Where it is used</h4><ul>' + L.used.map(function (u) { return '<li>' + u + '</li>'; }).join('') + '</ul>' +
      '<h4>Try this in the simulation</h4><div class="watch">' + L.watch + '</div></div>' +
      '<div class="sim" id="sim-' + L.id + '"></div></article>';
  }).join('');
  idx.innerHTML = LESSONS.map(function (L) { return '<a href="#lesson-' + L.id + '">' + esc(L.short) + '</a>'; }).join('');

  function build(key, el) {
    if (!el) { return; }
    try { SIMS[key](el); } catch (err) {
      if (window.console) { console.error('Simulation failed: ' + key, err); }
      el.innerHTML = '<div class="readout">This simulation could not start in your browser.</div>';
    }
  }
  build('statespace', $('#sim-statespace')); build('scaling', $('#sim-scaling'));
  LESSONS.forEach(function (L) { build(L.id, $('#sim-' + L.id)); });

  /* 3D tilt on cards */
  if (!reduce && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
    $$('.tilt').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = 'rotateX(' + (-y * 7).toFixed(2) + 'deg) rotateY(' + (x * 9).toFixed(2) + 'deg) translateZ(6px)';
      });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  }
  try { heroScene($('#hero3d')); } catch (err) { if (window.console) { console.error('Hero failed', err); } }
})();

  /* ------------------------------------------------------ Learning path */
  var DONE_KEY = 'qhub.done.v1';
  var done = {};
  try { (JSON.parse(store(true, DONE_KEY) || '[]')).forEach(function (k) { done[k] = true; }); } catch (e) { }
  var cur = 1;
  function saveDone() { store(false, DONE_KEY, JSON.stringify(Object.keys(done))); }
  function levelDone(L) { var n = 0; L.topics.forEach(function (t, i) { if (done[L.id + '-' + i]) { n++; } }); return n; }

  function renderTabs() {
    $('#tabs').innerHTML = LEVELS.map(function (L) {
      return '<button type="button" class="tab" role="tab" id="tab-' + L.id + '" data-l="' + L.id + '" aria-selected="' + (L.id === cur) + '" aria-controls="panel" tabindex="' + (L.id === cur ? 0 : -1) + '">' +
        '<span class="tn">LEVEL ' + L.id + '</span><span class="tt">' + esc(L.name) + '</span><span class="tc" data-count="' + L.id + '">' + levelDone(L) + ' / ' + L.topics.length + ' done</span></button>';
    }).join('');
  }
  function updateCounts() {
    var total = 0;
    LEVELS.forEach(function (L) {
      var n = levelDone(L); total += n;
      var el = $('[data-count="' + L.id + '"]'); if (el) { el.textContent = n + ' / ' + L.topics.length + ' done'; }
    });
    $('#overall-txt').textContent = total + ' of ' + nTopics + ' topics';
    $('#overall-bar').style.width = (total / nTopics * 100) + '%';
  }
  function renderPanel() {
    var L = LEVELS[cur - 1];
    $('#panel').setAttribute('aria-labelledby', 'tab-' + L.id);
    $('#panel').innerHTML =
      '<div><h3>' + esc(L.name) + '</h3><div class="time">Plan for ' + esc(L.time) + '</div>' +
      '<p class="blurb">' + esc(L.blurb) + '</p>' +
      '<dl><div><dt>Before you start</dt><dd>' + esc(L.prereq) + '</dd></div><div><dt>When you finish</dt><dd>' + esc(L.outcome) + '</dd></div></dl></div>' +
      '<ul class="topics">' + L.topics.map(function (t, i) {
        var k = L.id + '-' + i;
        return '<li><label class="topic"><input type="checkbox" data-k="' + k + '"' + (done[k] ? ' checked' : '') + '><div><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div></label></li>';
      }).join('') + '</ul>';
  }
  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) { return; }
    cur = +b.getAttribute('data-l'); renderTabs(); renderPanel(); updateCounts();
  });
  $('#tabs').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
    cur = e.key === 'ArrowRight' ? (cur % LEVELS.length) + 1 : ((cur + LEVELS.length - 2) % LEVELS.length) + 1;
    renderTabs(); renderPanel(); updateCounts();
    var t = $('#tab-' + cur); if (t) { t.focus(); }
    e.preventDefault();
  });
  $('#panel').addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-k'); if (!k) { return; }
    if (e.target.checked) { done[k] = true; } else { delete done[k]; }
    saveDone(); updateCounts();
  });
  renderTabs(); renderPanel(); updateCounts();

  /* ------------------------------------------------------------- Gates */
  $('#gtable').innerHTML = GT.map(function (g) {
    var n = g[1].length;
    var cells = g[1].map(function (r) { return r.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join(''); }).join('');
    var pre = g[2] ? '<span>' + esc(g[2]) + ' ×</span>' : '';
    return '<div class="grow"><div class="gn">' + esc(g[0]) + '</div>' +
      '<div class="matwrap">' + pre + '<div class="mat" style="grid-template-columns:repeat(' + n + ',auto)">' + cells + '</div></div>' +
      '<div class="gname">' + esc(g[3]) + '</div><div class="gdesc">' + esc(g[4]) + '</div></div>';
  }).join('');

  /* ---------------------------------------------------------- Practice */
  var qf = 0, qlist = [], qi = 0, qscore = 0, qpicked = -1;
  function chipsHtml(active, attr) {
    var items = [[0, 'All levels']].concat(LEVELS.map(function (L) { return [L.id, 'L' + L.id + ' ' + L.name]; }));
    return items.map(function (it) { return '<button type="button" class="chip" ' + attr + '="' + it[0] + '" aria-pressed="' + (it[0] === active) + '">' + esc(it[1]) + '</button>'; }).join('');
  }
  function startQuiz(f) {
    qf = f; qlist = QUESTIONS.filter(function (q) { return f === 0 || q.l === f; });
    qi = 0; qscore = 0; qpicked = -1;
    $('#qchips').innerHTML = chipsHtml(qf, 'data-qf');
    renderQuiz();
  }
  function renderQuiz() {
    var body = $('#qbody');
    if (qi >= qlist.length) {
      var pct = Math.round(qscore / qlist.length * 100);
      var msg = pct >= 80 ? 'Strong result. Move on to the next level or pick a project to cement this one.'
        : pct >= 50 ? 'A solid start. Re-read the topics you missed in the learning path, then try again.'
          : 'Spend more time on this level’s topics first, then retry. The explanations are a good revision list.';
      body.innerHTML = '<div class="result"><div class="score">' + qscore + '<small> / ' + qlist.length + '</small></div><p>' + esc(msg) + '</p>' +
        '<div class="actions"><button class="btn" type="button" id="qrestart">Try again</button></div></div>';
      return;
    }
    var q = qlist[qi], letters = ['A', 'B', 'C', 'D'];
    body.innerHTML =
      '<div class="qmeta"><span>Question ' + (qi + 1) + ' of ' + qlist.length + '</span><span>Level ' + q.l + ' · ' + esc(LEVELS[q.l - 1].name) + '</span></div>' +
      '<div class="qbar"><i style="width:' + (qi / qlist.length * 100) + '%"></i></div>' +
      '<h3 class="qtext">' + esc(q.q) + '</h3>' +
      '<div class="opts" id="opts">' + q.o.map(function (o, i) {
        return '<button type="button" class="opt" data-i="' + i + '"><span class="k">' + letters[i] + '</span><span>' + esc(o) + '</span></button>';
      }).join('') + '</div><div id="qfb" aria-live="polite"></div>';
  }
  $('#qbody').addEventListener('click', function (e) {
    if (e.target.closest('#qrestart')) { startQuiz(qf); return; }
    if (e.target.closest('#qnext')) { qi++; qpicked = -1; renderQuiz(); return; }
    var b = e.target.closest('.opt');
    if (!b || qpicked >= 0) { return; }
    var q = qlist[qi], i = +b.getAttribute('data-i');
    qpicked = i;
    var ok = i === q.a; if (ok) { qscore++; }
    $$('.opt').forEach(function (o, idx) {
      o.disabled = true;
      if (idx === q.a) { o.classList.add('correct'); }
      else if (idx === i) { o.classList.add('wrong'); }
      else { o.classList.add('dim'); }
    });
    $('#qfb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '"><strong>' + (ok ? 'Correct' : 'Not quite') + '</strong>' + esc(q.e) + '</div>' +
      '<button type="button" class="btn qnext" id="qnext">' + (qi + 1 < qlist.length ? 'Next question' : 'See my score') + '</button>';
    var nb = $('#qnext'); if (nb) { nb.focus(); }
  });
  $('#qchips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) { return; }
    startQuiz(+c.getAttribute('data-qf'));
  });
  startQuiz(0);

  /* ---------------------------------------------------------- Projects */
  var pf = 0;
  function renderProjects() {
    $('#pchips').innerHTML = chipsHtml(pf, 'data-pf');
    $('#pgrid').innerHTML = PROJECTS.filter(function (p) { return pf === 0 || p.l === pf; }).map(function (p) {
      return '<article class="pcard"><div class="ptop"><span class="pill">LEVEL ' + p.l + '</span><span>' + esc(p.w) + '</span></div>' +
        '<h3>' + esc(p.t) + '</h3><p class="pd">' + esc(p.d) + '</p>' +
        '<div class="pmeta"><div><b>Stack</b>' + esc(p.s) + '</div><div><b>Practise</b>' + esc(p.p) + '</div></div></article>';
    }).join('');
  }
  $('#pchips').addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) { return; }
    pf = +c.getAttribute('data-pf'); renderProjects();
  });
  renderProjects();

  /* --------------------------------------------------------- Resources */
  function listHtml(arr) {
    return arr.map(function (r) { return '<li><b>' + esc(r[0]) + '</b><span class="pill">' + esc(r[2]) + '</span><span class="rd">' + esc(r[1]) + '</span></li>'; }).join('');
  }
  $('#tools').innerHTML = listHtml(TOOLS);
  $('#books').innerHTML = listHtml(BOOKS);

})();

