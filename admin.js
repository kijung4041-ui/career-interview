// 직업인 인터뷰 – 교사용
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs){ if (k === "class") el.className = attrs[k]; else if (k === "text") el.textContent = attrs[k]; else el.setAttribute(k, attrs[k]); }
  for (const c of kids) if (c != null) el.append(c);
  return el;
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- 로그인 ---------- */
$("login").onclick = async () => {
  const email = $("email").value.trim(), pw = $("pw").value;
  if (!email || !pw) { $("login-msg").textContent = "이메일과 비밀번호를 적어 주세요."; return; }
  $("login").disabled = true; $("login-msg").textContent = "로그인 중…";
  try { await signInWithEmailAndPassword(auth, email, pw); $("login-msg").textContent = ""; }
  catch (e) { $("login-msg").textContent = /invalid|wrong|user-not-found|credential/i.test(e.code || "") ? "이메일이나 비밀번호가 맞지 않습니다." : "로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요."; }
  finally { $("login").disabled = false; }
};
$("pw").addEventListener("keydown", e => { if (e.key === "Enter") $("login").click(); });
$("logout").onclick = () => signOut(auth);

let unsub = null;
onAuthStateChanged(auth, user => {
  if (unsub) { unsub(); unsub = null; }
  const teacher = user && !user.isAnonymous;
  $("login-view").hidden = !!teacher; $("teacher-view").hidden = !teacher; $("logout").hidden = !teacher;
  if (!teacher) return;
  $("t-status").textContent = "기록을 불러오는 중입니다.";
  unsub = onSnapshot(collection(db, "interviews"), snap => {
    teacherRows = snap.docs.map(d => Object.assign({}, d.data(), { _id: d.id }));
    refreshClassOptions(); renderTeacher();
  }, err => {
    console.error(err);
    $("t-status").textContent = err.code === "permission-denied" ? "이 계정에는 기록을 볼 권한이 없습니다. Firestore 보안 규칙의 교사 이메일을 확인해 주세요." : "기록을 불러오지 못했습니다. 새로고침해 주세요.";
  });
});

/* ---------- 기록 표 ---------- */
let teacherRows = [];
const openRows = new Set(); let confirmKey = null;
const LEGACY_STU = { no: "-", name: "(학번 정보 없음)" };
function fmtTime(iso){ const d = new Date(iso); if (!iso || isNaN(d)) return ""; const p = n => String(n).padStart(2, "0"); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function fmtFull(iso){ const d = new Date(iso); if (!iso || isNaN(d)) return ""; const p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function classOf(no){ const s = String(no || "").trim(); if (/^\d{5}$/.test(s)) return s.slice(0, 3); return ""; }
function classLabel(c){ return c ? `${c[0]}학년 ${Number(c.slice(1))}반` : "기타"; }
function allRows(){
  const rows = [];
  teacherRows.forEach(d => (d.sessions || []).forEach(s => rows.push({ stu: s.student || d.student || LEGACY_STU, s, docId: d._id })));
  rows.sort((a, b) => String(a.stu.no).localeCompare(String(b.stu.no), undefined, { numeric: true }) || String(b.s.updatedAt).localeCompare(String(a.s.updatedAt)));
  return rows;
}
function filteredRows(){
  const fc = $("f-class").value, fs = $("f-state").value, fq = $("f-q").value.trim().toLowerCase();
  return allRows().filter(({ stu, s }) => {
    if (fc && classOf(stu.no) !== fc) return false;
    if (fs === "done" && !s.finished) return false;
    if (fs === "run" && s.finished) return false;
    if (fq && ![stu.no, stu.name, s.job].some(v => String(v || "").toLowerCase().includes(fq))) return false;
    return true;
  });
}
function refreshClassOptions(){
  const sel = $("f-class"), keep = sel.value;
  const classes = [...new Set(allRows().map(r => classOf(r.stu.no)).filter(Boolean))].sort();
  sel.replaceChildren(h("option", { value: "", text: "전체" }), ...classes.map(c => h("option", { value: c, text: classLabel(c) })));
  sel.value = classes.includes(keep) ? keep : "";
}
["f-class", "f-state"].forEach(id => $(id).addEventListener("change", renderTeacher));
$("f-q").addEventListener("input", renderTeacher);

function renderTeacher(){
  const body = $("t-body"); body.replaceChildren();
  const rows = filteredRows(), all = allRows();
  const done = rows.filter(r => r.s.finished).length;
  $("stats").replaceChildren(
    h("span", null, "보이는 인터뷰 ", h("b", { text: String(rows.length) }), "건"),
    h("span", null, "제출 ", h("b", { text: String(done) })),
    h("span", null, "진행 중 ", h("b", { text: String(rows.length - done) })));
  $("t-status").textContent = !all.length ? "아직 제출된 인터뷰가 없습니다. 학생들이 인터뷰를 시작하면 여기에 바로 나타납니다." : (!rows.length ? "조건에 맞는 기록이 없습니다." : "");
  rows.forEach(({ stu, s, docId }) => {
    const nq = (s.turns || []).filter(t => t.role === "user").length;
    const key = docId + "/" + s.id;
    const tr = h("tr", { class: "rec", tabindex: "0" },
      h("td", { class: "num", text: stu.no || "" }), h("td", { text: stu.name || "" }), h("td", { text: s.job || "" }),
      h("td", { class: "num", text: String(nq) }),
      h("td", null, h("span", { class: s.finished ? "state-ok" : "state-run", text: s.finished ? "제출" : "진행 중" })),
      h("td", { class: "num", text: fmtTime(s.updatedAt) }),
      delCell(docId, s));
    const detail = h("tr", { class: "detail" }); detail.hidden = !openRows.has(key);
    const td = h("td", { colspan: "7" });
    const log = h("div", { class: "log" });
    log.append(h("p", { class: "note", text: `${s.persona?.name || ""} · ${s.persona?.role || ""}` }));
    if (s.reason) log.append(h("p", { class: "note", text: `궁금한 이유: ${s.reason}` }));
    (s.turns || []).forEach(t => log.append(h("div", { class: "turn " + (t.role === "user" ? "q" : "a") }, h("span", { class: "who", text: t.role === "user" ? "학생" : "답" }), h("div", { text: t.content }))));
    if (s.reflection) log.append(h("div", { class: "tip", text: `새로 알게 된 점: ${s.reflection.learned}\n예상과 달랐던 점: ${s.reflection.surprised}\n더 알아볼 것: ${s.reflection.next}` }));
    const msg = h("span", { class: "note" });
    const cp = h("button", { class: "btn quiet", type: "button", text: "이 기록 복사" });
    cp.onclick = () => copyText(recordText(stu, s), msg);
    td.append(log, h("div", { class: "actions" }, cp, msg)); detail.append(td);
    const toggle = () => { detail.hidden = !detail.hidden; if (detail.hidden) openRows.delete(key); else openRows.add(key); };
    tr.onclick = toggle; tr.onkeydown = e => { if (e.key === "Enter") toggle(); };
    body.append(tr, detail);
  });
}
function delCell(docId, s){
  const td = h("td", { class: "delcell" });
  td.onclick = e => e.stopPropagation(); td.onkeydown = e => e.stopPropagation();
  if (!docId || !s.id) return td;
  const key = docId + "/" + s.id;
  const idle = () => { if (confirmKey === key) confirmKey = null; const b = h("button", { class: "btn quiet sm", type: "button", text: "삭제" }); b.onclick = confirmView; td.replaceChildren(b); };
  const confirmView = () => {
    confirmKey = key;
    const yes = h("button", { class: "btn danger sm", type: "button", text: "삭제 확인" });
    const no = h("button", { class: "btn quiet sm", type: "button", text: "취소" });
    no.onclick = idle;
    yes.onclick = async () => {
      yes.disabled = true; no.disabled = true; yes.textContent = "삭제 중…";
      try { await deleteSession(docId, s.id); confirmKey = null; openRows.delete(key); }
      catch { td.replaceChildren(h("span", { class: "note", text: "삭제하지 못했습니다." })); setTimeout(idle, 2500); }
    };
    td.replaceChildren(yes, no); yes.focus();
  };
  if (confirmKey === key) confirmView(); else idle();
  return td;
}
async function deleteSession(docId, sid){
  const ref = doc(db, "interviews", docId);
  const snap = await getDoc(ref); if (!snap.exists()) return;
  const d = JSON.parse(JSON.stringify(snap.data()));
  const sessions = (d.sessions || []).filter(x => x.id !== sid);
  if (!sessions.length) await deleteDoc(ref);
  else await setDoc(ref, Object.assign(d, { sessions, updatedAt: new Date().toISOString() }));
}

/* ---------- 복사 ---------- */
function recordText(stu, s){
  const lines = [`[가상 직업인 인터뷰] ${stu.no || ""} ${stu.name || ""}`, `직업: ${s.job}  /  인물: ${s.persona?.name || ""} (${s.persona?.role || ""})`, `궁금한 이유: ${s.reason || "-"}`, "", "■ 준비한 질문"];
  (s.questions || []).forEach((q, i) => lines.push(`${i + 1}. ${q.type ? "[" + q.type + "] " : ""}${q.q}`));
  lines.push("", "■ 인터뷰");
  (s.turns || []).forEach(t => lines.push(`${t.role === "user" ? "학생" : (s.persona?.name || "답")}: ${t.content}`));
  if (s.reflection) lines.push("", "■ 돌아보기", `새로 알게 된 점: ${s.reflection.learned}`, `예상과 달랐던 점: ${s.reflection.surprised}`, `더 알아볼 것: ${s.reflection.next}`);
  return lines.join("\n");
}
async function copyText(txt, msgEl){
  try { await navigator.clipboard.writeText(txt); msgEl.textContent = "복사했습니다."; }
  catch { const ta = h("textarea"); ta.value = txt; ta.style.minHeight = "200px"; msgEl.replaceChildren("자동 복사가 막혀 있어요. 아래 내용을 직접 복사하세요.", ta); ta.select(); }
}
$("copy-all").onclick = () => {
  const rows = filteredRows();
  if (!rows.length) { $("t-msg").textContent = "복사할 기록이 없습니다."; return; }
  copyText(rows.map(({ stu, s }) => recordText(stu, s)).join("\n\n────────\n\n"), $("t-msg"));
};

/* ---------- 엑셀 ---------- */
$("xlsx").onclick = () => {
  const rows = filteredRows();
  if (!rows.length) { $("t-msg").textContent = "내려받을 기록이 없습니다."; return; }
  if (!window.XLSX) { $("t-msg").textContent = "엑셀 기능을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."; return; }
  const summary = rows.map(({ stu, s }) => ({
    "학번": stu.no || "", "이름": stu.name || "", "반": classLabel(classOf(stu.no)),
    "희망 직업": s.job || "", "궁금한 이유": s.reason || "",
    "인터뷰 인물": s.persona ? `${s.persona.name || ""} (${s.persona.role || ""})` : "",
    "준비한 질문 수": (s.questions || []).length,
    "한 질문 수": (s.turns || []).filter(t => t.role === "user").length,
    "상태": s.finished ? "제출" : "진행 중",
    "시작": fmtFull(s.startedAt), "마지막 기록": fmtFull(s.updatedAt),
    "새로 알게 된 점": s.reflection?.learned || "", "예상과 달랐던 점": s.reflection?.surprised || "", "더 알아볼 것": s.reflection?.next || "",
  }));
  const qa = [];
  rows.forEach(({ stu, s }) => {
    const t = s.turns || []; let n = 0;
    t.forEach((turn, i) => {
      if (turn.role !== "user") return;
      const next = t[i + 1] && t[i + 1].role === "assistant" ? t[i + 1].content : "";
      qa.push({ "학번": stu.no || "", "이름": stu.name || "", "희망 직업": s.job || "", "순번": ++n, "학생 질문": turn.content, "직업인 답변": next });
    });
  });
  const prep = [];
  rows.forEach(({ stu, s }) => (s.questions || []).forEach((q, i) => prep.push({ "학번": stu.no || "", "이름": stu.name || "", "희망 직업": s.job || "", "순번": i + 1, "준비한 질문": q.q, "분류": q.type || "" })));
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(summary);
  ws1["!cols"] = [8, 10, 10, 16, 30, 24, 8, 8, 8, 16, 16, 40, 40, 40].map(w => ({ wch: w }));
  const ws2 = XLSX.utils.json_to_sheet(qa.length ? qa : [{ "학번": "", "이름": "", "희망 직업": "", "순번": "", "학생 질문": "", "직업인 답변": "" }]);
  ws2["!cols"] = [8, 10, 16, 6, 40, 80].map(w => ({ wch: w }));
  const ws3 = XLSX.utils.json_to_sheet(prep.length ? prep : [{ "학번": "", "이름": "", "희망 직업": "", "순번": "", "준비한 질문": "", "분류": "" }]);
  ws3["!cols"] = [8, 10, 16, 6, 50, 10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws1, "요약");
  XLSX.utils.book_append_sheet(wb, ws2, "문답 전체");
  XLSX.utils.book_append_sheet(wb, ws3, "준비한 질문");
  const d = new Date(), p = n => String(n).padStart(2, "0");
  const fc = $("f-class").value;
  XLSX.writeFile(wb, `직업인인터뷰_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${fc ? "_" + classLabel(fc).replace(/\s/g, "") : ""}.xlsx`);
  $("t-msg").textContent = `${rows.length}건을 엑셀로 내려받았습니다.`;
};
