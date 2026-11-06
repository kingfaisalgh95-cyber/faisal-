/* Local data layer. Everything is stored in this browser only (localStorage).
   Swap `persist`/`load` for API calls when a real backend and authentication exist. */
(function (root) {
  'use strict';
  var KEY = 'shaqaf.v2';
  var STAGES = ['request', 'review', 'assessment', 'design', 'quotation', 'approval', 'installation', 'commissioning', 'handover'];

  function blank() {
    return {
      role: 'customer', lang: 'ar',
      profile: { name: '', phone: '', city: 'riyadh' },
      projects: [], customers: [], requests: [], team: [], equipment: null, assumptions: {}
    };
  }
  var S = blank(), mem = null;

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = mem; }
    if (raw) { try { S = Object.assign(blank(), JSON.parse(raw)); } catch (e) { S = blank(); } }
    return S;
  }
  function persist() {
    var s = JSON.stringify(S);
    try { localStorage.setItem(KEY, s); } catch (e) { mem = s; }
  }
  function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function now() { return new Date().toISOString(); }

  function newProject(o) {
    return Object.assign({
      id: uid('p'), name: '', customerName: '', phone: '', kind: 'residential', type: 'villa', city: S.profile.city || 'riyadh', address: '',
      len: 20, wid: 10, obstacle: 0, mode: 'kwh', cons: 12000, system: 'grid', battery: { need: false, hours: 4, criticalKw: 3, arch: 'dc' },
      panelId: 'pv550', inverterId: '', inverterQty: 0, tilt: 10, manual: false, disabled: [], dcLen: 30, acLen: 20,
      simulated: false, createdAt: now(), status: 'draft'
    }, o || {});
  }

  function newRequest(project, contact) {
    var stages = STAGES.map(function (k, i) { return { key: k, status: i === 0 ? 'done' : (i === 1 ? 'active' : 'pending'), owner: '', due: '', notes: [], docs: [], history: [] }; });
    stages[0].history.push({ at: now(), by: contact.name || '-', text: 'created' });
    return { id: uid('r'), projectId: project.id, projectName: project.name, customerName: contact.name, phone: contact.phone, kind: contact.kind, createdAt: now(), stages: stages, company: '' };
  }
  function currentStage(rq) {
    for (var i = 0; i < rq.stages.length; i++) if (rq.stages[i].status !== 'done') return i;
    return rq.stages.length - 1;
  }

  function sampleProject() {
    return newProject({ name: 'Sample villa (simulated)', customerName: 'Sample customer', simulated: true, len: 20, wid: 10, cons: 12000 });
  }

  root.Store = {
    STAGES: STAGES, get: function () { return S; }, load: load, save: persist, uid: uid, now: now,
    newProject: newProject, newRequest: newRequest, currentStage: currentStage, sampleProject: sampleProject,
    reset: function () { S = blank(); persist(); },
    exportJSON: function () { return JSON.stringify(S, null, 2); },
    importJSON: function (txt) { var o = JSON.parse(txt); if (!o || typeof o !== 'object' || !Array.isArray(o.projects)) throw new Error('bad'); S = Object.assign(blank(), o); persist(); }
  };
})(window);
