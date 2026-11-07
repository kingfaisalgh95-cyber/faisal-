/* عارض ثلاثي الأبعاد: مجسم مبسط للمبنى مع الألواح بنفس عددها وأماكنها في المخطط 2D. */
(function (root) {
  'use strict';

  function mount(el, R) {
    if (!root.THREE) return null;
    var T = root.THREE, r;
    try {
      r = new T.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) { return null; }
    r.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    el.appendChild(r.domElement);
    r.domElement.style.display = 'block';

    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    var sc = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 0.1, 2000);
    var sk = document.createElement('canvas'); sk.width = 4; sk.height = 256; var sg = sk.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#5f94c9'); gr.addColorStop(0.55, '#a9c9e6'); gr.addColorStop(1, '#e8dcc3'); sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
    sc.background = new T.CanvasTexture(sk); sc.fog = new T.Fog(0xe3d8c2, 140, 460);
    sc.add(new T.HemisphereLight(0xdfeaff, 0x7a6a55, 0.6));
    var sun = new T.DirectionalLight(0xfff1dc, 0.8); sun.position.set(40, 70, 30);
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

      var ground = new T.Mesh(new T.PlaneGeometry(600, 600), new T.MeshStandardMaterial({ color: 0xb3a688, roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
      var pad = new T.Mesh(new T.BoxGeometry(W + 8, 0.15, L + 8), mat(0xa7a196, 0.95)); pad.position.set(0, 0.075, 0); pad.receiveShadow = true; g.add(pad);

      var fc = document.createElement('canvas'); fc.width = fc.height = 256; var fx = fc.getContext('2d');
      fx.fillStyle = '#e7dcc4'; fx.fillRect(0, 0, 256, 256);
      for (var q = 0; q < 2600; q++) { var v = 200 + Math.floor(Math.random() * 40); fx.fillStyle = 'rgba(' + v + ',' + (v - 8) + ',' + (v - 30) + ',0.22)'; fx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
      var ft = new T.CanvasTexture(fc); ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(Math.max(1, W / 6), Math.max(1, H / 6));
      var wall = new T.Mesh(new T.BoxGeometry(W, H, L), new T.MeshStandardMaterial({ map: ft, roughness: 0.95 })); wall.position.set(0, H / 2, 0); wall.castShadow = wall.receiveShadow = true; g.add(wall);
      box(W + 0.3, 0.3, L + 0.3, 0xcfc4ab, 0, H + 0.15, 0);
      var pc = 0xd9cfb8, ph = 0.9, py = H + 0.3 + ph / 2;
      box(W + 0.3, ph, 0.25, pc, 0, py, L / 2 + 0.02); box(W + 0.3, ph, 0.25, pc, 0, py, -L / 2 - 0.02);
      box(0.25, ph, L + 0.3, pc, W / 2 + 0.02, py, 0); box(0.25, ph, L + 0.3, pc, -W / 2 - 0.02, py, 0);
      var roofTop = new T.Mesh(new T.PlaneGeometry(W - 0.2, L - 0.2), mat(0x8d8a84, 0.95)); roofTop.rotation.x = -Math.PI / 2; roofTop.position.set(0, H + 0.32, 0); roofTop.receiveShadow = true; g.add(roofTop);
      var floors = Math.max(1, Math.round(H / 3.5)), wc = Math.max(2, Math.floor(W / 4));
      var glass = new T.MeshStandardMaterial({ color: 0x3d5b78, roughness: 0.12, metalness: 0.75 }), frameM = mat(0x58554f, 0.6, 0.3);
      for (var f = 0; f < floors; f++) for (var c = 0; c < wc; c++) {
        var wx = -W / 2 + (c + 0.5) * W / wc, wy = 1.9 + f * 3.3;
        var fr = new T.Mesh(new T.BoxGeometry(1.6, 1.6, 0.12), frameM); fr.position.set(wx, wy, L / 2 + 0.04); g.add(fr);
        var gl = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 0.14), glass); gl.position.set(wx, wy, L / 2 + 0.06); g.add(gl);
      }
      box(1.3, 2.2, 0.16, 0x4a3b2c, W / 2 - 1.6, 1.1, L / 2 + 0.06);

      var on = R.slots.filter(function (q) { return q.st === 'on'; });
      if (on.length) {
        var A = root.Calc.DEFAULTS, pn = R.panel, tl = R.tilt * Math.PI / 180;
        var pcv = document.createElement('canvas'); pcv.width = 128; pcv.height = 256; var px = pcv.getContext('2d');
        px.fillStyle = '#c9ced6'; px.fillRect(0, 0, 128, 256); px.fillStyle = '#0f2447'; px.fillRect(4, 4, 120, 248);
        px.strokeStyle = 'rgba(150,175,215,0.55)'; px.lineWidth = 1;
        for (var gx = 4; gx <= 124; gx += 20) { px.beginPath(); px.moveTo(gx, 4); px.lineTo(gx, 252); px.stroke(); }
        for (var gy = 4; gy <= 252; gy += 20.6) { px.beginPath(); px.moveTo(4, gy); px.lineTo(124, gy); px.stroke(); }
        var ptx = new T.CanvasTexture(pcv); ptx.anisotropy = 4;
        var pmat = new T.MeshStandardMaterial({ map: ptx, roughness: 0.25, metalness: 0.55 });
        var im = new T.InstancedMesh(new T.BoxGeometry(pn.wid, 0.06, pn.len), pmat, on.length); im.castShadow = true; im.receiveShadow = true;
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
      box(0.7, 0.9, 0.25, 0xd5d8dc, -W / 2 + 1.2, 1.3, L / 2 + 0.2);
      if (R.bat) box(0.8, 1.3, 0.45, 0x8d949c, -W / 2 + 2.6, 1.5, L / 2 + 0.3);
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
