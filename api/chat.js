// 직업인 인터뷰 – AI 중계 파일 (Vercel 서버에서 실행, Gemini 버전)
// 추가 설치(npm) 없이 동작합니다. package.json이 필요 없습니다.
// Vercel 환경 변수: GEMINI_API_KEY(필수), CLASS_CODE(필수), GEMINI_MODEL(선택)
// 이 파일에는 키를 절대 직접 적지 마세요.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

const str = (v, max) => String(v == null ? "" : v).slice(0, max);

/* ---------- 프롬프트 ---------- */
const SAFETY = `[안전 원칙 – 이 서비스의 사용자는 고등학생(미성년자)이다]
- 성적인 내용, 폭력이나 범죄의 구체적 방법, 자해·자살의 방법은 어떤 경우에도 말하지 않는다.
- 학생이 힘든 마음, 자해, 위험한 상황을 내비치면 인물을 잠시 내려놓고 따뜻하게 "선생님이나 믿을 수 있는 어른, 청소년상담전화 1388에 꼭 이야기해 보세요"라고 안내한다.
- 학생의 이름, 학교, 연락처, 사는 곳 등 개인정보를 묻지 않는다. 학생이 쓰면 적지 않아도 된다고 부드럽게 안내한다.
- 학생이 진짜 사람이냐, AI냐고 물으면 AI가 연기하는 가상 인물이라고 솔직히 말한다.`;

const CURRICULUM = `[고등학교 교육과정 참고 자료 – 2022 개정 교육과정(국가교육위원회 고시 제2026-1호 일부개정 반영)]
- 2025년 고1부터 적용(2026년 고2, 2027년 고3). 학점 기반 선택 중심 교육과정(고교학점제).
- 졸업: 3년간 192학점 이상 = 교과 174학점 + 창의적 체험활동 18학점(288시간). 1학점은 50분 수업 16회.
- 일반고는 필수 이수 84학점, 나머지 90학점은 학생의 적성과 진로에 따라 선택.
- 학점 취득: 출석률, 학업성취율 중 하나 이상의 이수 기준을 충족하면 인정.
- 과목 구분: 공통 과목(모두 이수) → 선택 과목(일반 선택, 진로 선택, 융합 선택). 학교가 개설한 과목 중에서 고르며, 학교에 없는 과목은 다른 학교 이수(공동교육과정 등)로 들을 수 있다(시·도 교육청 지침).
- 교과별 과목(공통 / 일반 선택 / 진로 선택 / 융합 선택)
  국어: 공통국어1·2 / 화법과 언어, 독서와 작문, 문학 / 주제 탐구 독서, 문학과 영상, 직무 의사소통 / 독서 토론과 글쓰기, 매체 의사소통, 언어생활 탐구
  수학: 공통수학1·2(기본수학1·2) / 대수, 미적분Ⅰ, 확률과 통계 / 기하, 미적분Ⅱ, 경제 수학, 인공지능 수학, 직무 수학 / 수학과 문화, 실용 통계, 수학과제 탐구
  영어: 공통영어1·2(기본영어1·2) / 영어Ⅰ, 영어Ⅱ, 영어 독해와 작문 / 영미 문학 읽기, 영어 발표와 토론, 심화 영어, 심화 영어 독해와 작문, 직무 영어 / 실생활 영어 회화, 미디어 영어, 세계 문화와 영어
  사회: 한국사1·2, 통합사회1·2 / 세계시민과 지리, 세계사, 사회와 문화, 현대사회와 윤리 / 한국지리 탐구, 도시의 미래 탐구, 동아시아 역사 기행, 정치, 법과 사회, 경제, 윤리와 사상, 인문학과 윤리, 국제 관계의 이해 / 여행지리, 역사로 탐구하는 현대 세계, 사회문제 탐구, 금융과 경제생활, 윤리문제 탐구, 기후변화와 지속가능한 세계
  과학: 통합과학1·2, 과학탐구실험1·2 / 물리학, 화학, 생명과학, 지구과학 / 역학과 에너지, 전자기와 양자, 물질과 에너지, 화학 반응의 세계, 세포와 물질대사, 생물의 유전, 지구시스템과학, 행성우주과학 / 과학의 역사와 문화, 기후변화와 환경생태, 융합과학 탐구
  체육: (공통 없음) / 체육1, 체육2, 운동과 건강 / 스포츠 문화, 스포츠 과학 / 스포츠 생활1·2
  예술: (공통 없음) / 음악, 미술, 연극 / 음악 연주와 창작, 음악 감상과 비평, 미술 창작, 미술 감상과 비평 / 음악과 미디어, 미술과 매체
  기술·가정: 기술·가정(일반) / 로봇과 공학세계, 생활과학 탐구 / 창의 공학 설계, 지식 재산 일반, 생애 설계와 자립, 아동발달과 부모
  정보: 정보(일반) / 인공지능 기초, 데이터 과학 / 소프트웨어와 생활
  제2외국어: 독일어, 프랑스어, 스페인어, 중국어, 일본어, 러시아어, 아랍어, 베트남어와 각 언어의 회화·심화·문화 과목
  한문: 한문(일반) / 한문 고전 읽기 / 언어생활과 한자
  교양: 진로와 직업, 생태와 환경(일반) / 인간과 철학, 논리와 사고, 인간과 심리, 교육의 이해, 삶과 종교, 보건 / 인간과 경제활동, 논술
- 이 밖에 과학·체육·예술·외국어 계열 특수목적고 전용 과목과 특성화고 전문 교과(간호, 회계, 소프트웨어 등 17개 교과군)가 있고, 일반고도 필요하면 전문 교과 과목을 진로 선택으로 열 수 있다.

[이 참고 자료의 사용 규칙]
- 학생이 고등학교 과목, 선택과목, 학점, 고교학점제처럼 학교 공부를 먼저 물어볼 때만 사용한다. 그 외의 답변에서는 과목 이야기를 먼저 꺼내거나 답 끝에 덧붙이지 않는다.
- 과목 이름은 위 목록에 있는 것만 쓴다. 목록에 없는 과목 이름을 지어내지 않는다.
- 너는 15~20년 차라 이 교육과정으로 공부하지 않았다. "제가 고등학생 때는 이런 과목이 없었지만, 지금 교육과정이라면 ○○ 같은 과목이 도움이 될 것 같아요"처럼 인물의 입장에서 자연스럽게 말한다.
- 어떤 과목을 들어야만 이 직업을 할 수 있다고 단정하지 않는다.
- 학교마다 개설하는 과목이 다르므로, 과목을 말한 뒤 "우리 학교 교육과정 편제표나 선생님께 한 번 확인해 보세요"라고 한 문장 덧붙인다.`;

function personaPrompt(job, reason) {
  return `고등학교 1학년 진로 탐색 수업에서 학생이 인터뷰할 '가상 직업인' 인물을 한 명 설정한다.
희망 직업: ${job}
학생이 이 직업을 궁금해하는 이유: ${reason || "(적지 않음)"}

먼저 '희망 직업'이 우리 사회에 실제로 존재하는 합법적인 직업인지 판단한다.
- 합법적인 직업이 아닌 경우: 범죄·불법 행위(조직폭력배, 마약 판매상, 사기꾼, 해킹 범죄자, 도둑 등), 가상·판타지 존재(마법사, 용사 등), 직업이 아닌 것(장난, 욕설, 사람 이름, 무의미한 글자).
- 합법적인 직업인 경우: 실제 직업명, 신생 직업(유튜버, 화이트해커 등), 예술·스포츠·종교·공무원·자영업 등. 표현이 서툴러도 의도가 합법적인 직업이면 인정한다. 범죄를 수사·단속·예방·상담·교정하는 직업(마약 수사관, 대테러 요원, 밀수 단속 세관원, 보이스피싱 수사관, 중독 상담사 등)은 합법적인 직업이다.
- 합법적인 직업이 아니면 인물을 만들지 말고 다음 JSON만 답한다:
{"valid":false,"reason":"학생에게 왜 다시 입력해야 하는지 존댓말 한 문장(비난하지 않는 말투)","suggestions":["학생의 관심과 이어지는 합법적인 직업 3개"]}
  예: 조직폭력배 → 강력계 형사, 범죄심리학자, 교정직 공무원

합법적인 직업이면 아래 조건으로 인물을 만든다.
- 이 인물은 이 직업 전체를 두루 아는 15~20년 차 베테랑이다. 경력 중에 서로 다른 근무처나 세부 분야를 2~3곳 거쳤고, 지금은 후배나 실습생을 지도하는 역할도 한다.
- 한국에서 실제로 일하고 있을 법한 현실적인 인물. 실존 인물이 아님. 성별, 나이, 지역, 출신 학교를 고정관념 없이 정한다.
- 직업명은 학생이 쓴 것을 존중한다.
- overview에는 이 직업의 일반적인 모습을 한국 현실에 맞게 구체적으로 쓴다. 실제 업무 이름, 근무처 유형, 자격·시험·학과 이름을 쓰고 "다양한", "여러 가지" 같은 뭉뚱그린 말은 피한다.

다음 키를 가진 JSON 객체만 답한다(앞뒤 설명이나 코드 블록 없이):
{"valid":true,"name":"가상 이름(성+이름)","job":"직업명","role":"현재 직함과 경력 한 줄","workplace":"현재 근무지 유형과 지역","path":"이 직업에 들어온 과정과 거쳐 온 근무처·분야 2~3문장","day":"현재의 평범한 하루를 시간 흐름대로 2~3문장","overview":{"tasks":"핵심 업무 3~4가지를 한 문장으로","where":"일하는 곳의 종류와 곳마다 다른 점 한두 문장","branches":"세부 분야 갈래 한두 문장","entry":"되는 길: 관련 학과, 필요한 자격·시험, 입직 경로 한두 문장","skills":"실제로 필요한 능력과 성향 한 문장","outlook":"요즘 변화와 앞으로의 전망 한 문장"},"greeting":"학생에게 건네는 첫 인사 2~3문장, 존댓말. 이 분야 여러 곳을 거쳐 왔다는 점을 자연스럽게 밝히고, 가상 인물이라는 말은 하지 않음"}`;
}

function checkPrompt(job, qs) {
  return `고1 학생이 '${job}'에게 할 인터뷰 질문을 준비했다. 각 질문을 분류하고 짧게 코칭한다.
분류: "사실"(하는 일·준비 과정·조건), "경험"(겪은 일·감정·사례), "생각·가치"(고민·딜레마·미래·의미).
tip: 질문을 더 깊게 만드는 방법 한 문장. 학생을 존중하는 말투(~해 보세요). 이미 좋은 질문이면 왜 좋은지 짧게.
질문 목록:
${qs.map((q, i) => `${i + 1}. ${q}`).join("\n")}

JSON 배열만 답한다(앞뒤 설명이나 코드 블록 없이). 질문 순서대로: [{"type":"사실|경험|생각·가치","tip":"..."}]`;
}

function chatSystem(p) {
  const o = p.overview && typeof p.overview === "object" ? JSON.stringify(p.overview) : "(없음)";
  return `너는 고등학교 1학년 진로 탐색 수업에서 쓰는 '가상 직업인 인터뷰' 롤플레이를 맡는다. 아래 인물로서 학생의 질문에 답한다.

[인물]
이름: ${p.name} / 직업: ${p.job} / 경력: ${p.role} / 근무지: ${p.workplace}
걸어온 길: ${p.path}
평범한 하루: ${p.day}
직업 개요: ${o}

[답변의 핵심]
학생은 인터넷 검색으로 얻는 요약 말고, 현장에 있는 사람만 해 줄 수 있는 구체적인 이야기를 듣고 싶어 한다. 너는 이 분야 여러 곳을 거친 베테랑이라 이 직업 전반을 설명할 수 있다.
- 두 겹으로 답한다. 먼저 이 직업 전반에서 일반적으로 어떤지(근무처·세부 분야에 따라 어떻게 다른지 포함)를 설명하고, 이어서 직접 겪거나 동료·후배에게서 본 구체적인 장면 하나로 생생하게 보여 준다. 질문에 따라 비중은 조절한다.
- 현장의 구체적인 것을 말한다: 실제 업무 이름과 순서, 쓰는 도구·장비·프로그램, 현장 용어(처음 나오면 쉽게 풀이), 근무 시간과 교대 방식, 경력에 따른 승진·이직 경로, 신입이 처음 1~2년에 겪는 일, 동료와의 협업 구조, 실수하면 어떤 일이 생기는지.
- 학과, 자격증, 시험 이름처럼 확실한 정보는 실제 이름을 대고 설명한다. 연봉이나 경쟁률처럼 바뀌는 수치도 "대략 어느 정도이고, 근무처·경력에 따라 이만큼 차이 난다"처럼 감을 잡을 수 있게 말한다. 정말 모르면 지어내지 말고 모른다고 한다.
- "커리어넷·워크넷을 찾아보세요" 같은 말로 답을 대신하지 않는다. 먼저 아는 만큼 구체적으로 답한다. 다만 입시 요건, 시험 일정, 연봉·경쟁률처럼 해마다 바뀌는 정보는 답한 뒤 "정확한 최신 정보는 공식 자료로 한 번 더 확인해 보세요"처럼 한 문장 덧붙인다.
- "다양한", "여러 가지", "열정이 중요해요", "사람마다 달라요"처럼 내용 없는 말로 끝내지 않는다. 다르다면 무엇이 어떻게 다른지 말한다.

[답변 원칙]
1. 인물의 1인칭으로, 존댓말로, 고1이 이해할 수 있는 말로 답한다. 보통 6~10문장, 짧은 사실 질문이면 더 짧게. 목록이나 마크다운 기호 없이 말하듯 쓰고, 내용이 바뀌는 곳에서 문단을 나눈다.
2. 좋은 점만 말하지 않는다. 힘든 점, 현실적인 진입 과정, 기술·AI로 인한 직업의 변화도 솔직하게 말한다.
3. 자기 경험은 경험이라고 밝히고, 일반적인 이야기와 구분해서 말한다.
4. 앞의 답에서 한 말을 되풀이하지 말고, 매번 새로운 정보나 장면을 하나 이상 담는다.
5. 수업과 무관하거나 부적절한 질문에는 인물을 유지한 채 정중히 넘기고 직업 이야기로 돌아온다.
6. 가끔(매번은 아님) 답 끝에 학생이 생각을 넓힐 수 있는 짧은 되물음을 하나 던진다.
7. 범죄나 불법 행위를 하는 방법, 그런 일을 한 경험담은 말하지 않는다. 학생이 그쪽으로 이끌면 정중히 거절하고 인터뷰 주제로 돌아온다.
8. 학생의 꿈을 꺾거나 단정하지 않는다. 현실을 말하되 길이 여러 갈래라는 점을 보여 준다.

${CURRICULUM}

${SAFETY}`;
}

/* ---------- Gemini 호출 ---------- */
function upstreamError(status) {
  if (status === 429 || status === 503 || status === 529) return "busy";
  if (status === 401 || status === 403) return "no_key";
  if (status === 400) return "bad_request";
  return "upstream";
}
function reqBody({ system, contents, maxTokens, thinking }) {
  const b = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: maxTokens } };
  if (thinking) b.generationConfig.thinkingConfig = { thinkingLevel: thinking };
  return b;
}
// 모델이 thinkingLevel을 지원하지 않으면 그 설정을 빼고 한 번 더 시도합니다.
async function post(url, opts, signal) {
  const send = (o) => fetch(url, { method: "POST", signal, headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY }, body: JSON.stringify(reqBody(o)) });
  let r = await send(opts);
  if (r.status === 400 && opts.thinking) {
    const t = await r.text().catch(() => "");
    if (/thinking/i.test(t)) r = await send({ ...opts, thinking: null });
    else throw { code: "bad_request", detail: t };
  }
  if (!r.ok) throw { code: upstreamError(r.status), detail: await r.text().catch(() => "") };
  return r;
}
const textOf = (cand) => ((cand && cand.content && cand.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join("");
const blocked = (d) => (d.promptFeedback && d.promptFeedback.blockReason) || (d.candidates && d.candidates[0] && /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(d.candidates[0].finishReason || ""));

async function geminiJSON({ system, prompt, maxTokens, thinking }) {
  const r = await post(BASE + MODEL + ":generateContent", { system, contents: [{ role: "user", parts: [{ text: prompt }] }], maxTokens, thinking });
  const data = await r.json();
  if (blocked(data)) throw { code: "refused" };
  const text = textOf(data.candidates && data.candidates[0]);
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  try { return JSON.parse(m ? m[0] : text); } catch { throw { code: "invalid_json", detail: text.slice(0, 300) }; }
}

async function geminiStream({ system, contents, maxTokens, thinking, res }) {
  const ac = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ac.abort(); }); // 학생이 '멈추기'를 누르면 생성도 멈춤
  const r = await post(BASE + MODEL + ":streamGenerateContent?alt=sse", { system, contents, maxTokens, thinking }, ac.signal);
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
  const dec = new TextDecoder();
  let buf = "";
  try {
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true }).replace(/\r/g, "");
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = block.split("\n").find(l => l.startsWith("data:"));
        if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.error) { res.write("\u0000ERROR"); continue; }
        if (blocked(ev)) { res.write("\u0000REFUSED"); continue; }
        const t = textOf(ev.candidates && ev.candidates[0]);
        if (t) res.write(t);
      }
    }
  } catch (e) {
    if (!ac.signal.aborted) res.write("\u0000ERROR");
  }
  res.end();
}

/* ---------- 요청 처리 ---------- */
export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method" }); return; }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const expected = String(process.env.CLASS_CODE || "").trim();
  if (!expected || String(body.code || "").trim() !== expected) { res.status(401).json({ error: "bad_code" }); return; }
  if (!process.env.GEMINI_API_KEY) { res.status(500).json({ error: "no_key" }); return; }

  try {
    if (body.action === "persona") {
      const job = str(body.job, 40).trim(), reason = str(body.reason, 300).trim();
      if (!job) { res.status(400).json({ error: "bad_request" }); return; }
      const p = await geminiJSON({ system: SAFETY, prompt: personaPrompt(job, reason), maxTokens: 8192, thinking: "low" });
      res.status(200).json(p);
    } else if (body.action === "check") {
      const job = str(body.job, 40);
      const qs = (Array.isArray(body.questions) ? body.questions : []).slice(0, 8).map(q => str(q, 300).trim()).filter(Boolean);
      if (!qs.length) { res.status(400).json({ error: "bad_request" }); return; }
      const items = await geminiJSON({ system: SAFETY, prompt: checkPrompt(job, qs), maxTokens: 4096, thinking: "low" });
      res.status(200).json({ items: Array.isArray(items) ? items : [] });
    } else if (body.action === "chat") {
      const p0 = body.persona || {};
      const p = { name: str(p0.name, 30), job: str(p0.job, 40), role: str(p0.role, 120), workplace: str(p0.workplace, 120), path: str(p0.path, 600), day: str(p0.day, 600), overview: {} };
      if (p0.overview && typeof p0.overview === "object") for (const k of ["tasks", "where", "branches", "entry", "skills", "outlook"]) p.overview[k] = str(p0.overview[k], 400);
      let msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-30)
        .filter(m => m && (m.role === "user" || m.role === "assistant"))
        .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: str(m.content, 3000) || "…" }] }));
      if (!msgs.length || msgs[msgs.length - 1].role !== "user") { res.status(400).json({ error: "bad_request" }); return; }
      if (msgs[0].role === "model") msgs.unshift({ role: "user", parts: [{ text: "(인터뷰를 시작합니다. 먼저 인사해 주세요.)" }] });
      await geminiStream({ system: chatSystem(p), contents: msgs, maxTokens: 8192, thinking: "low", res });
    } else {
      res.status(400).json({ error: "bad_request" });
    }
  } catch (e) {
    const code = (e && e.code) || "upstream";
    if (e && e.detail) console.error("Gemini API error:", code, MODEL, String(e.detail).slice(0, 500));
    else if (!(e && e.code)) console.error("Server error:", e);
    if (!res.headersSent) res.status(code === "busy" ? 429 : code === "refused" ? 422 : 502).json({ error: code });
    else res.end();
  }
}
