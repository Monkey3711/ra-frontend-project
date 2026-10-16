(() => {
  const API = (window.RA_APP_CONFIG?.API_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const $ = (id) => document.getElementById(id);
  const state = { modelInfo: null, image: null };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const asPct = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v); if (!Number.isFinite(n)) return null;
    return `${(n <= 1 ? n * 100 : n).toFixed(2)}%`;
  };
  const first = (obj, keys) => { for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null) return obj[k]; return undefined; };
  async function request(path, options={}) {
    let response;
    try { response = await fetch(`${API}${path}`, options); }
    catch (e) { throw new Error(`Cannot reach the API at ${API}. Start your backend and check frontend/config.js. (${e.message})`); }
    const type = response.headers.get("content-type") || "";
    const data = type.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = typeof data === "object" ? (data.detail || data.message || JSON.stringify(data)) : data;
      throw new Error(`${response.status} ${response.statusText}: ${detail || "Request failed"}`);
    }
    return data;
  }
  function setBusy(button, busy, label) {
    button.disabled = busy;
    if (busy) { button.dataset.oldLabel = button.innerHTML; button.innerHTML = `<span class="spinner-text">Processing…</span>`; }
    else if (button.dataset.oldLabel) { button.innerHTML = button.dataset.oldLabel; delete button.dataset.oldLabel; }
  }
  function showError(id, message) { $(id).hidden = false; $(id).textContent = message; }
  function hideError(id) { $(id).hidden = true; $(id).textContent = ""; }
  function showApi(ok, text) {
    const pill = $("apiStatus"); pill.className = `status-pill ${ok === true ? "ok" : ok === false ? "bad" : ""}`;
    pill.innerHTML = `<i></i> ${esc(text)}`;
    $("sidebarApiStatus").textContent = text;
    document.querySelector(".status-dot").style.background = ok === true ? "#2c9c79" : ok === false ? "#d35454" : "#e4a13c";
  }
  async function refreshHealth() {
    showApi(null, "Checking API…");
    try {
      const d = await request("/api/health");
      const ok = d.status === "ok" || d.healthy === true || d.status === "healthy" || d.ok === true;
      showApi(ok, ok ? "API online" : (d.status || "API responded"));
      if (d.model1_loaded !== undefined || d.model2_loaded !== undefined) {
        $("sidebarApiStatus").textContent = `M1 ${d.model1_loaded ? "ready" : "—"} · M2 ${d.model2_loaded ? "ready" : "—"}`;
      }
    } catch (e) { showApi(false, "API offline"); $("sidebarApiStatus").textContent = "Cannot connect"; }
    try {
      state.modelInfo = await request("/api/model-info");
      const version = first(state.modelInfo, ["version","model_version","api_version"]);
      $("modelVersionFooter").textContent = version ? `Model version: ${version}` : "Model information loaded";
    } catch { $("modelVersionFooter").textContent = "Model version: unavailable"; }
  }
  function activateView(view) {
    const severity = view === "severity";
    $("severityView").hidden = !severity; $("progressionView").hidden = severity;
    document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $("pageTitle").textContent = severity ? "X-ray severity grading" : "Progression risk prediction";
    $("pageSubtitle").textContent = severity ? "Estimate severity from a hand/wrist X-ray image." : "Estimate progression risk from clinical and serological data.";
  }
  document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => activateView(b.dataset.view)));
  $("refreshHealth").addEventListener("click", refreshHealth);

  function setImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showError("severityError", "Please choose an image file."); return; }
    state.image = file;
    const reader = new FileReader();
    reader.onload = e => { $("imagePreview").src = e.target.result; $("imagePreview").hidden = false; $("uploadPlaceholder").hidden = true; };
    reader.readAsDataURL(file);
    $("fileMeta").hidden = false; $("fileMeta").textContent = `${file.name} · ${(file.size/1024).toFixed(1)} KB`;
    hideError("severityError"); $("severityResult").hidden = true; $("severityEmpty").hidden = false;
  }
  $("xrayFile").addEventListener("change", e => setImage(e.target.files[0]));
  $("clearImage").addEventListener("click", () => {
    state.image = null; $("xrayFile").value = ""; $("imagePreview").src = ""; $("imagePreview").hidden = true;
    $("uploadPlaceholder").hidden = false; $("fileMeta").hidden = true; $("severityResult").hidden = true; $("severityEmpty").hidden = false; hideError("severityError");
  });
  const drop = $("dropZone");
  ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => {e.preventDefault();drop.classList.add("dragover");}));
  ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => {e.preventDefault();drop.classList.remove("dragover");}));
  drop.addEventListener("drop", e => setImage(e.dataTransfer.files[0]));

  function renderProbabilities(container, values) {
    const entries = Array.isArray(values) ? values.map((v,i)=>[v.class || v.label || v.name || `Class ${i+1}`, v.probability ?? v.prob ?? v.score ?? v.value]) :
      (values && typeof values === "object" ? Object.entries(values) : []);
    if (!entries.length) { container.innerHTML = `<p class="helper">Probability values were not included in the API response.</p>`; return; }
    container.innerHTML = entries.map(([label,raw]) => {
      let n = Number(raw); if (!Number.isFinite(n)) n=0; const pct = n <= 1 ? n*100 : n;
      return `<div class="probability-row"><span>${esc(label)}</span><div class="track"><div style="width:${Math.max(0,Math.min(100,pct))}%"></div></div><span class="val">${pct.toFixed(1)}%</span></div>`;
    }).join("");
  }
  function renderMetrics(container, obj, exclude=[]) {
    const rows = Object.entries(obj || {}).filter(([k,v]) => !exclude.includes(k) && v !== null && typeof v !== "object");
    container.innerHTML = rows.slice(0,8).map(([k,v]) => `<div class="metric"><span>${esc(k.replace(/_/g," "))}</span><b>${esc(typeof v === "boolean" ? (v ? "Yes" : "No") : v)}</b></div>`).join("");
  }
  $("severityForm").addEventListener("submit", async e => {
    e.preventDefault(); hideError("severityError");
    if (!state.image) { showError("severityError","Choose an X-ray image before predicting."); return; }
    const button = $("severitySubmit"); setBusy(button,true);
    try {
      const form = new FormData(); form.append("file", state.image);
      const d = await request("/api/model1/predict", {method:"POST", body:form});
      const pred = first(d,["predicted_class","severity_class","prediction","class","label"]) ?? "Prediction returned";
      const rawConfidence = first(d,["confidence","predicted_probability","probability","max_probability"]);
      const conf = asPct(rawConfidence);
      $("severityClass").textContent = String(pred);
      $("severityConfidence").textContent = conf || "Confidence n/a";
      const pct = rawConfidence === undefined ? 0 : Math.max(0,Math.min(100,Number(rawConfidence) <= 1 ? Number(rawConfidence)*100 : Number(rawConfidence)));
      $("severityConfidenceBar").style.width = `${Number.isFinite(pct)?pct:0}%`;
      $("severityMessage").textContent = first(d,["selective_status","status_message","message"]) || "Review this result alongside clinical assessment.";
      const probs = first(d,["class_probabilities","probabilities","probability_by_class"]);
      renderProbabilities($("probabilityList"),probs);
      const meta = {};
      ["uncertainty","selective_status","explanation_available","model_version"].forEach(k=>{if(d[k]!==undefined)meta[k]=d[k]});
      renderMetrics($("severityMeta"),meta);
      const explanation = first(d,["explanation","explanation_summary","gradcam","explanation_available"]);
      $("explanationArea").hidden = explanation === undefined || explanation === null || explanation === false;
      if (!$("explanationArea").hidden) $("explanationContent").textContent = typeof explanation === "object" ? JSON.stringify(explanation,null,2) : String(explanation);
      $("severityEmpty").hidden = true; $("severityResult").hidden = false;
    } catch (err) { showError("severityError",err.message); }
    finally { setBusy(button,false); }
  });

  $("progressionForm").addEventListener("submit", async e => {
    e.preventDefault(); hideError("progressionError");
    const button = $("progressionSubmit"); setBusy(button,true);
    const fd = new FormData(e.currentTarget), payload = {};
    for (const [k,v] of fd.entries()) {
      if (v.trim() === "") continue;
      payload[k] = ["patient_id","gender"].includes(k) ? v.trim() : Number(v);
    }
    try {
      const d = await request("/api/model2/predict", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const risk = first(d,["progression_probability","risk_probability","probability","predicted_probability","risk"]);
      const pct = asPct(risk);
      const pred = first(d,["binary_prediction","prediction","predicted_class","class","label"]);
      $("riskPercent").textContent = pct || (risk === undefined ? "—" : String(risk));
      $("riskClass").textContent = pred === undefined ? "Prediction" : String(pred);
      const numericPct = risk === undefined ? 0 : Math.max(0,Math.min(100,Number(risk) <= 1 ? Number(risk)*100 : Number(risk)));
      $("riskBar").style.width = `${Number.isFinite(numericPct)?numericPct:0}%`;
      $("riskMessage").textContent = first(d,["message","status_message"]) || "Risk estimate based on submitted baseline data.";
      const detail = {};
      ["probability_progression","probability_non_progression","prediction","binary_prediction","threshold","model_version"].forEach(k=>{if(d[k]!==undefined)detail[k]=d[k]});
      $("riskDetails").innerHTML = Object.entries(detail).map(([k,v])=>`<div class="detail-row"><span>${esc(k.replace(/_/g," "))}</span><b>${esc(v)}</b></div>`).join("") || `<p class="helper">No additional prediction details were returned.</p>`;
      const shap = first(d,["shap_summary","shap_values","feature_contributions","top_features"]);
      renderShap(shap);
      $("progressionEmpty").hidden = true; $("progressionResult").hidden = false;
    } catch (err) { showError("progressionError",err.message); }
    finally { setBusy(button,false); }
  });
  function renderShap(shap) {
    const el = $("shapList");
    if (!shap || typeof shap !== "object") { el.innerHTML = `<p class="helper">SHAP contributions were not included in the API response.</p>`; return; }
    let entries = Array.isArray(shap) ? shap.map(x=>[x.feature || x.name || "Feature",x.shap_value ?? x.value ?? x.contribution]) : Object.entries(shap);
    entries = entries.filter(([k,v])=>Number.isFinite(Number(v))).slice(0,8);
    if (!entries.length) { el.innerHTML = `<p class="helper">No numeric SHAP contributions returned.</p>`; return; }
    const max = Math.max(...entries.map(([,v])=>Math.abs(Number(v))),1e-9);
    el.innerHTML = entries.map(([k,v])=>`<div class="shap-row"><span>${esc(k)}</span><div class="shap-track"><div style="width:${Math.abs(Number(v))/max*100}%"></div></div><span class="shap-value">${Number(v).toFixed(3)}</span></div>`).join("");
  }

  function openInfo() {
    $("infoModal").hidden = false;
    const d = state.modelInfo;
    if (!d) { $("modelInfoContent").innerHTML = `<p>Could not load <code>/api/model-info</code>. Check that the API is running.</p>`; return; }
    const sections = [];
    for (const [key,val] of Object.entries(d)) {
      const title = key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      sections.push(`<h3>${esc(title)}</h3>${typeof val === "object" ? `<pre>${esc(JSON.stringify(val,null,2))}</pre>` : `<p>${esc(val)}</p>`}`);
    }
    $("modelInfoContent").innerHTML = sections.join("") || "<p>No metadata returned.</p>";
  }
  $("modelInfoBtn").addEventListener("click",openInfo);
  $("closeModal").addEventListener("click",()=>$("infoModal").hidden=true);
  $("closeModalBottom").addEventListener("click",()=>$("infoModal").hidden=true);
  $("infoModal").addEventListener("click",e=>{if(e.target===$("infoModal"))$("infoModal").hidden=true;});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$("infoModal").hidden=true;});
  refreshHealth();
})();
