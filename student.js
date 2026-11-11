// 직업인 인터뷰 – 학생용
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs){ if (k === "class") el.className = attrs[k]; else if (k === "text") el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }
  for (const c of kids) if (c != null) el.append(c);
  return el;
}
const clone = (x) => JSON.parse(JSON.stringify(x));

const JOB_EXAMPLES = ["응급실 간호사","게임 기획자","초등학교 교사","경찰관","데이터 분석가","건축가","물리치료사","방송 PD","항공 정비사","사회복지사"];
const TIPS = [
  "답변 속 단어 하나를 골라 '그건 왜 그랬어요?'라고 다시 물어보세요.",
  "'구체적인 예를 하나 들어 주실 수 있나요?'는 언제나 좋은 꼬리 질문입니다.",
  "좋은 점을 들었다면, 반대로 그 일의 어려운 점도 물어보세요.",
  "'고등학생인 제가 지금 해 볼 수 있는 건 뭘까요?'처럼 나와 연결해 보세요.",
  "10년 뒤 이 직업이 어떻게 달라질지 물어보면 생각이 넓어집니다.",
  "답이 예상과 다르다면, 그 차이가 왜 생겼는지 물어보세요."
];

let db = null, uid = null;
let stuDoc = { student: {}, sessions: [] };
let cur = null, ctl = null, busy = false;

/* ---------- 수업 코드 ---------- */
const params = new URLSearchParams(location.search);
let classCode = (params.get("c") || "").trim();
try { if (classCode) localStorage.setItem("classCode", classCode); else classCode = localStorage.getItem("classCode") || ""; } catch {}
if (!classCode) $("code-wrap").hidden = false;
$("class-code").value = classCode;
function askCode(msg){ $("code-wrap").hidden = false; $("class-code").focus(); if (msg) $("setup-msg").textContent = msg; }

/* ---------- AI 호출 (Vercel 중계 파일) ---------- */
async function api(action, payload, { signal, onText } = {}){
  let res;
  try {
    res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, code: classCode, ...payload }), signal });
  } catch (e) { if (e && e.name === "AbortError") throw { code: "cancelled", text: "" }; throw { code: "network" }; }
  if (!res.ok) { let j = {}; try { j = await res.json(); } catch {} throw { code: j.error || "upstream" }; }
  if (action !== "chat") return res.json();
  const reader = res.body.getReader(); const dec = new TextDecoder(); let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      text += dec.decode(value, { stream: true });
      const z = text.indexOf("\u0000");
      if (z >= 0) { const tag = text.slice(z); text = text.slice(0, z); throw { code: tag.includes("REFUSED") ? "refused" : "upstream", text }; }
      onText && onText(text);
    }
  } catch (e) {
    if (e && e.name === "AbortError") throw { code: "cancelled", text };
    if (e && typeof e.code === "string") throw e;
    throw { code: "network", text };
  }
  if (!text.trim()) throw { code: "upstream", text: "" };
  return text;
}
function aiError(e, where){
  const c = e && e.code;
  if (c === "bad_code") { askCode(); return "수업 코드가 맞지 않아요. 선생님께 코드를 확인해 주세요."; }
  if (c === "busy") return "요청이 몰렸어요. 잠시 뒤 다시 눌러 주세요.";
  if (c === "refused") return "이 질문에는 답할 수 없어요. 질문을 바꿔 보세요.";
  if (c === "invalid_json") return where === "check" ? "질문 점검 결과를 받지 못했어요. 한 번 더 눌러 주세요." : "인물 정보를 만들지 못했어요. 한 번 더 눌러 주세요.";
  if (c === "no_key") { $("ai-off").hidden = false; return "AI 설정에 문제가 있어요. 선생님께 알려 주세요."; }
  if (c === "network") return "인터넷 연결을 확인하고 다시 시도해 주세요.";
  return "연결이 잠시 끊겼어요. 다시 시도해 주세요.";
}

/* ---------- 단계 표시 ---------- */
const SECTIONS = ["s-setup","s-prep","s-chat","s-reflect"];
function go(i){
  SECTIONS.forEach((id, k) => { $(id).hidden = k !== i; });
  [...$("steps").children].forEach((li, k) => { li.className = k === i ? "on" : (k < i ? "done" : ""); });
  window.scrollTo({ top: 0 });
}

/* ---------- 1. 직업 정하기 ---------- */
JOB_EXAMPLES.forEach(j => {
  const b = h("button", { class: "chip", type: "button", text: j });
  b.onclick = () => { $("job").value = j; $("job").focus(); };
  $("job-chips").append(b);
});

$("make-persona").onclick = async () => {
  const no = $("stu-no").value.trim(), name = $("stu-name").value.trim(), job = $("job").value.trim(), reason = $("reason").value.trim();
  const code = $("class-code").value.trim();
  if (code) { classCode = code; try { localStorage.setItem("classCode", code); } catch {} }
  if (!classCode) { askCode("수업 코드를 적어 주세요."); return; }
  if (!no || !name) { $("setup-msg").textContent = "학번과 이름(닉네임)을 적어 주세요."; return; }
  if (!job) { $("setup-msg").textContent = "희망 직업을 적어 주세요."; $("job").focus(); return; }
  $("job-check").hidden = true;
  stuDoc.student = { no, name };
  const btn = $("make-persona"); btn.disabled = true; $("setup-msg").textContent = "직업인을 섭외하는 중입니다…";
  try {
    const p = await api("persona", { job, reason });
    if (p && p.valid === false) { showJobCheck(p.reason || "실제 우리 사회에서 합법적으로 일하는 직업을 입력해 주세요.", Array.isArray(p.suggestions) ? p.suggestions : []); $("setup-msg").textContent = ""; $("job").focus(); return; }
    if (!p || !p.name || !p.greeting) throw { code: "invalid_json" };
    $("code-wrap").hidden = true;
    cur = { id: "s" + Date.now().toString(36), student: { no, name }, job, reason, persona: p, questions: [], turns: [], reflection: null, finished: false, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    renderPersona(); renderQuestions(["","",""]); go(1); $("setup-msg").textContent = "";
  } catch (e) {
    if (e && e.code === "refused") { showJobCheck("이 직업으로는 인물을 만들 수 없어요. 실제 우리 사회에서 합법적으로 일하는 직업을 입력해 주세요.", []); $("setup-msg").textContent = ""; }
    else $("setup-msg").textContent = aiError(e);
  } finally { btn.disabled = false; }
};

function showJobCheck(msg, alts){
  $("job-check-msg").textContent = msg;
  const box = $("job-alt"); box.replaceChildren();
  alts.slice(0, 4).forEach(a => { const b = h("button", { class: "chip", type: "button", text: String(a) }); b.onclick = () => { $("job").value = String(a); $("job-check").hidden = true; $("job").focus(); }; box.append(b); });
  if (alts.length) box.prepend(h("span", { class: "note", text: "이런 직업은 어때요?" }));
  $("job-check").hidden = false;
}

function renderPersona(){
  const p = cur.persona, card = $("persona-card"); card.replaceChildren();
  const dl = h("dl", { class: "persona" });
  [["경력", p.role], ["근무지", p.workplace], ["걸어온 길", p.path], ["하루", p.day]].forEach(([k, v]) => { if (v) dl.append(h("dt", { text: k }), h("dd", { text: String(v) })); });
  card.append(h("span", { class: "badge", text: "오늘의 인터뷰 대상 · 가상 인물" }), h("div", { class: "persona-name", text: `${p.name} · ${p.job}` }), dl);
  const o = p.overview;
  if (o && typeof o === "object") {
    const dl2 = h("dl", { class: "persona" });
    [["하는 일", o.tasks], ["일하는 곳", o.where], ["세부 분야", o.branches], ["되는 길", o.entry], ["필요한 능력", o.skills], ["전망", o.outlook]].forEach(([k, v]) => { if (v) dl2.append(h("dt", { text: k }), h("dd", { text: String(v) })); });
    card.append(h("h3", { text: `${p.job}, 한눈에 보기`, style: "margin-top:6px" }), dl2);
  }
}

/* ---------- 2. 질문 준비 ---------- */
const PH = ["예: 이 일을 하려면 어떤 준비를 하셨나요?","예: 일하면서 가장 보람 있었던 순간은요?","예: AI 때문에 이 직업은 어떻게 바뀔까요?"];
function qInputs(){ return [...$("qlist").querySelectorAll("textarea")]; }
function renderQuestions(values, feedback){
  const list = $("qlist"); list.replaceChildren();
  values.forEach((v, i) => {
    const ta = h("textarea", { id: "q" + i, maxlength: "300", rows: "2", "aria-label": `질문 ${i + 1}`, placeholder: PH[i] || "" });
    ta.value = v;
    const box = h("div", null, ta);
    const fb = feedback && feedback.find(f => f && f.q === v.trim());
    if (fb && fb.type) box.append(h("div", { class: "qfb" }, h("span", { class: "type", text: fb.type }), fb.tip || ""));
    list.append(h("div", { class: "qitem" }, h("span", { class: "n", text: "Q" + (i + 1) }), box));
  });
}
$("add-q").onclick = () => { const vals = qInputs().map(t => t.value); if (vals.length >= 8) { $("prep-msg").textContent = "질문은 8개까지 준비할 수 있어요."; return; } vals.push(""); renderQuestions(vals, cur.questions); };

$("check-q").onclick = async () => {
  const qs = qInputs().map(t => t.value.trim()).filter(Boolean);
  if (qs.length < 1) { $("prep-msg").textContent = "질문을 먼저 적어 주세요."; return; }
  const btn = $("check-q"); btn.disabled = true; $("prep-msg").textContent = "질문을 살펴보는 중…";
  try {
    const r = await api("check", { job: cur.persona.job, questions: qs });
    const arr = r && Array.isArray(r.items) ? r.items : null;
    if (!arr || !arr.length) throw { code: "invalid_json" };
    cur.questions = qs.map((q, i) => ({ q, type: (arr[i] && arr[i].type) || "", tip: (arr[i] && arr[i].tip) || "" }));
    const types = new Set(cur.questions.map(x => x.type).filter(Boolean));
    renderQuestions(qs, cur.questions);
    $("prep-msg").textContent = types.size >= 3 ? "세 종류가 골고루 들어갔어요." : "아직 없는 종류의 질문을 하나 더 넣어 보면 어떨까요?";
  } catch (e) { $("prep-msg").textContent = aiError(e, "check"); }
  finally { btn.disabled = false; }
};

$("start-interview").onclick = () => {
  const qs = qInputs().map(t => t.value.trim()).filter(Boolean);
  if (qs.length < 3) { $("prep-msg").textContent = "질문을 3개 이상 준비해 주세요."; return; }
  const old = cur.questions || [];
  cur.questions = qs.map(q => old.find(o => o.q === q) || { q, type: "", tip: "" });
  cur.turns = [{ role: "assistant", content: cur.persona.greeting, t: Date.now() }];
  $("chat-title").textContent = `${cur.persona.name} 님과의 인터뷰`;
  $("chat-sub").textContent = cur.persona.role || cur.persona.job;
  stuDoc.sessions.push(cur);
  renderLog(); renderPrepChips(); updateMeter(); nextTip();
  go(2); save(); $("ask").focus();
};

/* ---------- 3. 인터뷰 ---------- */
function renderLog(streamingText){
  const log = $("log"); log.replaceChildren();
  const label = String(cur.persona.name || "답").slice(-2);
  cur.turns.forEach(t => log.append(h("div", { class: "turn " + (t.role === "user" ? "q" : "a") }, h("span", { class: "who", text: t.role === "user" ? "나" : label }), h("div", { text: t.content }))));
  if (streamingText !== undefined) {
    const d = h("div", { class: streamingText ? "" : "thinking", text: streamingText || "생각하는 중…", id: "live" });
    log.append(h("div", { class: "turn a" }, h("span", { class: "who", text: label }), d));
  }
  log.scrollTop = log.scrollHeight;
}
let pendingPrep = null;
function askedSet(){ return new Set(cur.turns.filter(t => t.role === "user").flatMap(t => [t.content.trim(), t.prep].filter(Boolean))); }
function renderPrepChips(){
  const box = $("prep-chips"); box.replaceChildren();
  const asked = askedSet();
  cur.questions.forEach(q => {
    if (asked.has(q.q)) return;
    const b = h("button", { class: "chip", type: "button", text: q.q.length > 34 ? q.q.slice(0, 34) + "…" : q.q, title: q.q });
    b.onclick = () => { $("ask").value = q.q; pendingPrep = q.q; $("ask").focus(); };
    box.append(b);
  });
}
function updateMeter(){
  const qs = cur.turns.filter(t => t.role === "user");
  const asked = askedSet();
  $("m-q").textContent = qs.length;
  $("m-prep").textContent = cur.questions.filter(q => asked.has(q.q)).length;
  $("m-prep-total").textContent = cur.questions.length;
  $("finish").disabled = qs.length < 5 || busy;
  $("finish-note").hidden = qs.length >= 5;
}
let tipIdx = Math.floor(Math.random() * TIPS.length);
function nextTip(){ tipIdx = (tipIdx + 1) % TIPS.length; $("tip").textContent = "꼬리 질문 힌트 · " + TIPS[tipIdx]; }

async function send(){
  const text = $("ask").value.trim();
  if (!text || busy) return;
  if (text.replace(/\s/g, "").length < 4) { $("tip").textContent = "질문을 조금 더 구체적으로 써 주세요."; return; }
  busy = true; $("send").disabled = true; $("stop").hidden = false; $("finish").disabled = true;
  const turn = { role: "user", content: text, t: Date.now() };
  if (pendingPrep) { turn.prep = pendingPrep; pendingPrep = null; }
  cur.turns.push(turn);
  $("ask").value = ""; renderLog(""); renderPrepChips(); updateMeter();
  const messages = cur.turns.slice(-30).map(t => ({ role: t.role, content: t.content }));
  ctl = new AbortController();
  try {
    const ans = await api("chat", { persona: cur.persona, messages }, { signal: ctl.signal,
      onText: (t) => { const live = $("live"); if (live) { const lg = $("log"); const near = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 60; live.className = ""; live.textContent = t; if (near) lg.scrollTop = lg.scrollHeight; } } });
    cur.turns.push({ role: "assistant", content: ans, t: Date.now() });
    nextTip();
  } catch (e) {
    if (e && e.text && e.code !== "refused") cur.turns.push({ role: "assistant", content: e.text + " …(중단됨)", t: Date.now() });
    else { const t0 = cur.turns.pop(); $("ask").value = text; pendingPrep = t0 && t0.prep || null; if (!e || e.code !== "cancelled") $("tip").textContent = aiError(e); }
  } finally {
    busy = false; $("send").disabled = false; $("stop").hidden = true;
    cur.updatedAt = new Date().toISOString();
    renderLog(); renderPrepChips(); updateMeter(); save();
  }
}
$("send").onclick = send;
$("stop").onclick = () => ctl && ctl.abort();
$("ask").addEventListener("input", () => { if (!$("ask").value.trim()) pendingPrep = null; });
$("ask").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
$("finish").onclick = () => { $("back-chat").hidden = !!cur.finished; go(3); };

/* ---------- 4. 돌아보기 ---------- */
$("submit-reflect").onclick = async () => {
  const r = { learned: $("r-learned").value.trim(), surprised: $("r-surprised").value.trim(), next: $("r-next").value.trim() };
  if (!r.learned || !r.surprised || !r.next) { $("reflect-msg").textContent = "세 칸을 모두 채워 주세요."; return; }
  cur.reflection = r; cur.finished = true; cur.updatedAt = new Date().toISOString();
  const ok = await save();
  $("back-chat").hidden = true; resetRestart();
  $("reflect-msg").textContent = ok ? "제출했습니다. 선생님이 기록을 볼 수 있어요." : "제출하지 못했습니다. '기록 전체 복사'로 복사해 선생님께 제출해 주세요.";
};
function recordText(stu, s){
  const lines = [`[가상 직업인 인터뷰] ${stu.no || ""} ${stu.name || ""}`, `직업: ${s.job}  /  인물: ${s.persona.name} (${s.persona.role || ""})`, `궁금한 이유: ${s.reason || "-"}`, "", "■ 준비한 질문"];
  s.questions.forEach((q, i) => lines.push(`${i + 1}. ${q.type ? "[" + q.type + "] " : ""}${q.q}`));
  lines.push("", "■ 인터뷰");
  s.turns.forEach(t => lines.push(`${t.role === "user" ? "나" : s.persona.name}: ${t.content}`));
  if (s.reflection) lines.push("", "■ 돌아보기", `새로 알게 된 점: ${s.reflection.learned}`, `예상과 달랐던 점: ${s.reflection.surprised}`, `더 알아볼 것: ${s.reflection.next}`);
  return lines.join("\n");
}
async function copyText(txt, msgEl){
  try { await navigator.clipboard.writeText(txt); msgEl.textContent = "복사했습니다."; }
  catch { const ta = h("textarea"); ta.value = txt; ta.style.minHeight = "200px"; msgEl.replaceChildren("자동 복사가 막혀 있어요. 아래 내용을 직접 복사하세요.", ta); ta.select(); }
}
$("copy-record").onclick = () => {
  if ($("r-learned").value.trim()) cur.reflection = { learned: $("r-learned").value.trim(), surprised: $("r-surprised").value.trim(), next: $("r-next").value.trim() };
  copyText(recordText(cur.student || stuDoc.student, cur), $("reflect-msg"));
};
$("back-chat").onclick = () => { renderLog(); renderPrepChips(); updateMeter(); go(2); $("ask").focus(); };
let restartArmed = false;
function resetRestart(){ restartArmed = false; $("restart").textContent = "다른 직업 인터뷰하기"; $("restart").className = "btn quiet"; }
$("restart").onclick = () => {
  const written = ["r-learned","r-surprised","r-next"].some(id => $(id).value.trim());
  if (cur && !cur.finished && written && !restartArmed) {
    restartArmed = true; $("restart").textContent = "제출하지 않은 돌아보기를 지우고 새로 시작"; $("restart").className = "btn danger";
    $("reflect-msg").textContent = "돌아보기를 아직 제출하지 않았어요. 제출하려면 '제출하기'를 누르세요."; return;
  }
  resetRestart();
  cur = null; ["job","reason","r-learned","r-surprised","r-next"].forEach(id => $(id).value = ""); $("reflect-msg").textContent = ""; renderResume(); go(0);
};

/* ---------- 저장 (Firestore) ---------- */
let chain = Promise.resolve(true);
function save(){
  if (!db || !uid) { $("save-state").textContent = "자동 제출 안 됨 · 마칠 때 기록을 복사하세요"; return Promise.resolve(false); }
  const curCopy = cur ? clone(cur) : null;
  const student = clone(stuDoc.student || {});
  chain = chain.then(async () => {
      const ref = doc(db, "interviews", uid);
      const snap = await getDoc(ref);
      const remote = snap.exists() && Array.isArray(snap.data().sessions) ? snap.data().sessions : [];
      const sessions = remote.filter(x => !curCopy || x.id !== curCopy.id).map(clone);
      if (curCopy) sessions.push(curCopy);
      await setDoc(ref, { student, sessions, updatedAt: new Date().toISOString() });
      $("save-state").textContent = "자동 저장됨"; return true; })
    .catch((e) => { console.error(e); $("save-state").textContent = "저장 실패 · 마칠 때 기록을 복사하세요"; return false; });
  return chain;
}

/* ---------- 이어하기 ---------- */
function renderResume(){
  const list = $("resume-list"); list.replaceChildren();
  const open = (stuDoc.sessions || []).filter(x => !x.finished && x.persona && (x.turns || []).length);
  open.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  open.forEach(x => {
    const n = x.turns.filter(t => t.role === "user").length;
    const b = h("button", { class: "btn sm", type: "button", text: "이어서 하기" });
    b.onclick = () => resumeSession(x.id);
    list.append(h("div", { class: "resume-item" }, h("span", { text: `${x.job} · ${x.persona.name} 님 · 질문 ${n}개` }), b));
  });
  $("resume").hidden = !open.length;
}
function resumeSession(id){
  const x = stuDoc.sessions.find(s => s.id === id); if (!x) return;
  cur = x; cur.questions = cur.questions || []; cur.turns = cur.turns || [];
  $("job").value = cur.job || ""; $("reason").value = cur.reason || "";
  renderPersona();
  $("chat-title").textContent = `${cur.persona.name} 님과의 인터뷰`;
  $("chat-sub").textContent = cur.persona.role || cur.persona.job;
  if (cur.reflection) { $("r-learned").value = cur.reflection.learned || ""; $("r-surprised").value = cur.reflection.surprised || ""; $("r-next").value = cur.reflection.next || ""; }
  renderLog(); renderPrepChips(); updateMeter(); nextTip(); go(2); $("ask").focus();
}

/* ---------- 시작 ---------- */
(async () => {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    db = getFirestore(app);
    const user = await new Promise(resolve => { const off = onAuthStateChanged(auth, u => { off(); resolve(u); }); });
    uid = user ? user.uid : (await signInAnonymously(auth)).user.uid;
    const snap = await getDoc(doc(db, "interviews", uid));
    if (snap.exists()) {
      const d = snap.data();
      stuDoc = { student: d.student || {}, sessions: Array.isArray(d.sessions) ? clone(d.sessions) : [] };
      if (stuDoc.student.no) $("stu-no").value = stuDoc.student.no;
      if (stuDoc.student.name) $("stu-name").value = stuDoc.student.name;
    }
    renderResume();
  } catch (e) {
    console.error(e); db = null; uid = null; $("save-off").hidden = false;
  }
})();
