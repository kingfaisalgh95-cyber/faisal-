/* عارض ثلاثي الأبعاد: مجسم مبسط للمبنى مع الألواح بنفس عددها وأماكنها في المخطط 2D. */
(function (root) {
  'use strict';

  function mount(el, R) {
    if (!root.THREE) return null;
    var T = root.THREE, r;
    try {
      r = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) { return null; }
    r.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    el.appendChild(r.domElement);
    r.domElement.style.display = 'block';

    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    var sc = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 2000);
    sc.fog = new T.Fog(0xf0d9b0, 120, 420);
    sc.add(new T.HemisphereLight(0xfff0d8, 0x6b5a45, 0.55));
    var sun = new T.DirectionalLight(0xffdcae, 0.8); sun.position.set(40, 70, 30);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    var sh = sun.shadow.camera; sh.left = -90; sh.right = 90; sh.top = 90; sh.bottom = -90; sh.near = 1; sh.far = 300;
    sc.add(sun);

    var st = { az: -0.75, el: 0.55, dist: 40, h: 8, auto: true, alive: true, grp: null, key: '' };
    var drag = null;

    function mat(c, rough, metal) { return new T.MeshStandardMaterial({ color: c, roughness: rough == null ? 0.9 : rough, metalness: metal || 0 }); }

    function build(R) {
      if (st.grp) { sc.remove(st.grp); st.grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      var g = new T.Group(), W = R.W, L = R.L;
      var H = (root.Calc.TYPES[R.type] || { height: 8 }).height; st.h = H;
      function box(w, h, d, c, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }

      // أرض مكعبات (طابع فوكسل): بلاطات رملية متبادلة اللون
      var tile = 4, n = Math.ceil((Math.max(W, L) * 2 + 40) / tile), cnt = n * n;
      var gm = new T.InstancedMesh(new T.BoxGeometry(tile, 0.5, tile), mat(0xffffff, 1), cnt), m4g = new T.Matrix4(), col = new T.Color(), k = 0;
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        m4g.setPosition((i - n / 2 + 0.5) * tile, -0.25, (j - n / 2 + 0.5) * tile); gm.setMatrixAt(k, m4g);
        gm.setColorAt(k++, col.setHex(((i + j) % 2) ? 0xcdb98f : 0xc2ad82));
      }
      gm.receiveShadow = true; g.add(gm);

      // مبنى من كتل: جدار + حواف سطح + نوافذ
      box(W, H, L, 0xe6d9bd, 0, H / 2, 0);
      box(W + 0.4, 0.4, L + 0.4, 0xb9a47c, 0, H + 0.2, 0);
      var py = H + 0.85, pc = 0xcdb98f;
      box(W + 0.4, 0.9, 0.25, pc, 0, py, L / 2 + 0.07); box(W + 0.4, 0.9, 0.25, pc, 0, py, -L / 2 - 0.07);
      box(0.25, 0.9, L + 0.4, pc, W / 2 + 0.07, py, 0); box(0.25, 0.9, L + 0.4, pc, -W / 2 - 0.07, py, 0);
      var floors = Math.max(1, Math.round(H / 3.5)), wc = Math.max(2, Math.floor(W / 4));
      for (var f = 0; f < floors; f++) for (var c = 0; c < wc; c++) box(1.4, 1.4, 0.2, 0x4a6b8a, -W / 2 + (c + 0.5) * W / wc, 1.8 + f * 3.3, L / 2 + 0.05);

      // نخيل من مكعبات
      var spots = [[-W / 2 - 4, L / 2 + 4], [W / 2 + 4, L / 2 + 5], [-W / 2 - 5, -L / 4], [W / 2 + 5, -L / 3]];
      spots.forEach(function (p) {
        for (var y = 0; y < 5; y++) box(0.5, 1, 0.5, 0x8a5a2b, p[0], 0.5 + y, p[1]);
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (d) {
          box(1.4, 0.4, 1.4, 0x3f8a3c, p[0] + d[0] * 1.1, 5.4, p[1] + d[1] * 1.1);
          box(1.2, 0.4, 1.2, 0x56a64a, p[0] + d[0] * 2.1, 5.0, p[1] + d[1] * 2.1);
        });
        box(1.4, 0.6, 1.4, 0x56a64a, p[0], 5.8, p[1]);
      });

      var on = R.slots.filter(function (q) { return q.st === 'on'; });
      if (on.length) {
        var A = root.Calc.DEFAULTS, pn = R.panel, tl = R.tilt * Math.PI / 180;
        var im = new T.InstancedMesh(new T.BoxGeometry(pn.wid, 0.08, pn.len), mat(0x1f4a9a, 0.3, 0.5), on.length); im.castShadow = true; im.receiveShadow = true;
        var m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(tl, 0, 0)), s1 = new T.Vector3(1, 1, 1);
        var gridW = R.cols * R.pitchX - A.gap, x0 = (W - gridW) / 2, gridH = (R.rows - 1) * R.pitchY + R.fp, y0 = A.margin + ((L - 2 * A.margin) - gridH) / 2;
        on.forEach(function (sl, i) {
          m4.compose(new T.Vector3(x0 + sl.c * R.pitchX + pn.wid / 2 - W / 2, H + 0.5 + pn.len * Math.sin(tl) / 2, y0 + sl.r * R.pitchY + R.fp / 2 - L / 2), q, s1);
          im.setMatrixAt(i, m4);
        });
        im.instanceMatrix.needsUpdate = true; g.add(im);
      }
      (R.obsRects || []).forEach(function (o) {
        box(o.w, 1.2, o.h, 0x9a9488, o.x + o.w / 2 - W / 2, H + 0.4 + 0.6, o.y + o.h / 2 - L / 2);
        box(o.w * 0.7, 0.3, o.h * 0.7, 0x6f6a60, o.x + o.w / 2 - W / 2, H + 1.15 + 0.4, o.y + o.h / 2 - L / 2);
      });
      box(0.7, 0.9, 0.25, 0x2f9a5f, -W / 2 + 1.2, 1.3, L / 2 + 0.2);
      if (R.bat) box(0.8, 1.3, 0.45, 0x2b6cb0, -W / 2 + 2.6, 1.5, L / 2 + 0.3);
      st.grp = g; sc.add(g);
      var key = W + 'x' + L;
      if (st.key !== key) { st.key = key; st.dist = Math.max(W, L) * 1.6 + 16; }
    }

    function resize() {
      var w = el.clientWidth || 300, h = el.clientHeight || 380;
      r.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    function frame() {
      if (!st.alive) return;
      if (st.auto) st.az += 0.004;
      cam.position.set(Math.sin(st.az) * Math.cos(st.el) * st.dist, st.h + Math.sin(st.el) * st.dist, Math.cos(st.az) * Math.cos(st.el) * st.dist);
      cam.lookAt(0, st.h * 0.6, 0);
      r.render(sc, cam);
      requestAnimationFrame(frame);
    }

    function el_w() { return el.clientWidth || 300; } function el_h() { return el.clientHeight || 380; }
    var dom = r.domElement;
    dom.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; st.auto = false; dom.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
    dom.addEventListener('pointermove', function (e) {
      if (!drag) return;
      st.az -= (e.clientX - drag.x) * 0.008;
      st.el = Math.max(0.15, Math.min(1.45, st.el + (e.clientY - drag.y) * 0.006));
      drag = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('pointerup', function () { drag = null; el.style.cursor = 'grab'; });
    dom.addEventListener('wheel', function (e) { e.preventDefault(); st.dist = Math.max(10, Math.min(300, st.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
    var onResize = function () { resize(); };
    root.addEventListener('resize', onResize);

    build(R); resize(); frame();

    return {
      update: function (R2) { build(R2); },
      zoom: function (f) { st.dist = Math.max(10, Math.min(300, st.dist * f)); },
      view: function (name) {
        st.auto = false;
        if (name === 'top') { st.az = 0; st.el = 1.45; } else if (name === 'side') { st.az = 0; st.el = 0.2; } else { st.az = -0.75; st.el = 0.55; }
      },
      snap: function (az, el, w, h) {
        var ow = el_w(), oh = el_h(); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
        cam.position.set(Math.sin(az) * Math.cos(el) * st.dist, st.h + Math.sin(el) * st.dist, Math.cos(az) * Math.cos(el) * st.dist); cam.lookAt(0, st.h * 0.6, 0);
        r.render(sc, cam); var url = r.domElement.toDataURL('image/png'); r.setSize(ow, oh, false); return url;
      },
      state: function () { return { az: st.az, el: st.el, dist: st.dist }; },
      reset: function () { st.az = -0.75; st.el = 0.55; st.auto = true; st.key = ''; build(R); },
      destroy: function () {
        st.alive = false; root.removeEventListener('resize', onResize);
        if (st.grp) st.grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        r.dispose(); if (dom.parentNode) dom.parentNode.removeChild(dom);
      }
    };
  }

  // static 3D pictures for the printed report (rendered off-screen from the same model as the live viewer)
  function snapshots(R, views) {
    var host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:560px';
    document.body.appendChild(host); var out = [], m = null;
    try { m = mount(host, R); if (m) views.forEach(function (v) { out.push(m.snap(v[0], v[1], 900, 560)); }); } catch (e) { out = []; }
    if (m) m.destroy(); if (host.parentNode) host.parentNode.removeChild(host); return out;
  }
  root.Viewer3D = { mount: mount, snapshots: snapshots };
})(window);
