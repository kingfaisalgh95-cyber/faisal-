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

    var sc = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 2000);
    sc.add(new T.HemisphereLight(0xffffff, 0x8a8068, 0.85));
    var sun = new T.DirectionalLight(0xffffff, 0.8); sun.position.set(30, 60, 25); sc.add(sun);

    var st = { az: -0.75, el: 0.55, dist: 40, h: 8, auto: true, alive: true, grp: null, key: '' };
    var drag = null;

    function mat(c, rough, metal) { return new T.MeshStandardMaterial({ color: c, roughness: rough == null ? 0.9 : rough, metalness: metal || 0 }); }

    function build(R) {
      if (st.grp) { sc.remove(st.grp); st.grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
      var g = new T.Group(), W = R.W, L = R.L;
      var H = (root.Calc.TYPES[R.type] || { height: 8 }).height; st.h = H;
      function box(w, h, d, c, x, y, z) { var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c)); m.position.set(x, y, z); g.add(m); return m; }

      var gs = Math.max(W, L) * 3 + 60;
      var ground = new T.Mesh(new T.PlaneGeometry(gs, gs), mat(0xcdbf9f, 1)); ground.rotation.x = -Math.PI / 2; g.add(ground);
      box(W, H, L, 0xe8e2d4, 0, H / 2, 0);
      box(W + 0.4, 0.4, L + 0.4, 0xd5cfc0, 0, H + 0.2, 0);
      var py = H + 0.85, pc = 0xdcd6c6;
      box(W + 0.4, 0.9, 0.25, pc, 0, py, L / 2 + 0.07); box(W + 0.4, 0.9, 0.25, pc, 0, py, -L / 2 - 0.07);
      box(0.25, 0.9, L + 0.4, pc, W / 2 + 0.07, py, 0); box(0.25, 0.9, L + 0.4, pc, -W / 2 - 0.07, py, 0);
      var floors = Math.max(1, Math.round(H / 3.5)), wc = Math.max(2, Math.floor(W / 4));
      for (var f = 0; f < floors; f++) for (var c = 0; c < wc; c++) box(1.4, 1.4, 0.1, 0x3a5068, -W / 2 + (c + 0.5) * W / wc, 1.8 + f * 3.3, L / 2 + 0.05);

      // نخيل للديكور
      var spots = [[-W / 2 - 4, L / 2 + 4], [W / 2 + 4, L / 2 + 5], [-W / 2 - 5, -L / 4], [W / 2 + 5, -L / 3]];
      spots.forEach(function (p) {
        var trunk = new T.Mesh(new T.CylinderGeometry(0.2, 0.3, 5, 6), mat(0x7a5a3a)); trunk.position.set(p[0], 2.5, p[1]); g.add(trunk);
        var top = new T.Mesh(new T.SphereGeometry(1.8, 8, 6), mat(0x3f7d4a)); top.scale.y = 0.55; top.position.set(p[0], 5.3, p[1]); g.add(top);
      });

      var on = R.slots.filter(function (q) { return q.st === 'on'; });
      if (on.length) {
        var A = root.Calc.DEFAULTS, pn = R.panel, tl = R.tilt * Math.PI / 180;
        var im = new T.InstancedMesh(new T.BoxGeometry(pn.wid, 0.05, pn.len), mat(0x1d3a78, 0.35, 0.4), on.length);
        var m4 = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(tl, 0, 0)), s1 = new T.Vector3(1, 1, 1);
        var gridW = R.cols * R.pitchX - A.gap, x0 = (W - gridW) / 2, gridH = (R.rows - 1) * R.pitchY + R.fp, y0 = A.margin + ((L - 2 * A.margin) - gridH) / 2;
        on.forEach(function (sl, i) {
          m4.compose(new T.Vector3(x0 + sl.c * R.pitchX + pn.wid / 2 - W / 2, H + 0.5 + pn.len * Math.sin(tl) / 2, y0 + sl.r * R.pitchY + R.fp / 2 - L / 2), q, s1);
          im.setMatrixAt(i, m4);
        });
        im.instanceMatrix.needsUpdate = true; g.add(im);
      }
      box(0.7, 0.9, 0.25, 0x2f7a4f, -W / 2 + 1.2, 1.3, L / 2 + 0.2);
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
      reset: function () { st.az = -0.75; st.el = 0.55; st.auto = true; st.key = ''; build(R); },
      destroy: function () {
        st.alive = false; root.removeEventListener('resize', onResize);
        if (st.grp) st.grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        r.dispose(); if (dom.parentNode) dom.parentNode.removeChild(dom);
      }
    };
  }

  root.Viewer3D = { mount: mount };
})(window);
