import { useEffect, useRef, useState } from "react";

// ===== РЕЙТИНГИ (ветки) =====
const RATING_TREE = {
  Control: ["A1C", "A2C", "A3C", "A4C"],
  Approach: ["Approach", "Radar"],
  Aerodrome: ["Tower", "Delivery", "Ground"],
};

// ===== РОЛИ =====
const ROLES = [
  { value: "trainee", label: "Диспетчер-стажёр" },
  { value: "controller", label: "Диспетчер" },
  { value: "instructor", label: "Инструктор" },
  { value: "krs", label: "КРС" },
];

// ===== ХЕЛПЕРЫ =====
function labelRole(value) {
  const map = {
    trainee: "Диспетчер-стажёр",
    controller: "Диспетчер",
    instructor: "Инструктор",
    krs: "КРС",
  };
  return map[value] || value;
}
function formatSecs(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}
function verdictLabel(v) {
  const n = Number(v);
  if (n >= 0.90) return "Отлично";
  if (n >= 0.75) return "Почти идеально";
  if (n >= 0.50) return "В целом верно";
  if (n >= 0.25) return "Частично";
  if (n > 0) return "Слабо";
  return "Не по сути";
}
function verdictClass(v) {
  const n = Number(v);
  if (n >= 0.90) return "ok";
  if (n >= 0.75) return "good";
  if (n >= 0.50) return "mid";
  if (n >= 0.25) return "low";
  return "bad";
}
function ruDifficulty(d) {
  if (d === "easy") return "Лёгкий";
  if (d === "medium") return "Средний";
  if (d === "hard") return "Сложный";
  return d || "Средний";
}
function difficultyPercent(d) {
  if (d === "easy") return 33;
  if (d === "medium") return 66;
  if (d === "hard") return 100;
  return 66;
}
const avg = (arr) => (arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0);
const pct = (n,d) => (d ? Math.round((n/d)*100) : 0);

// ===== КОМПОНЕНТ =====
export default function Home() {
  const TOTAL_QUESTIONS = 20;

  // Шаги: welcome → ratings → role → question → summary
  const [step, setStep] = useState("welcome");

  // Рейтинги (Set строк "Control/A1C")
  const [selected, setSelected] = useState(new Set());

  // Роль
  const [role, setRole] = useState(null);

  // Вопрос/ответ/сложность/тема
  const [question, setQuestion] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [topic, setTopic] = useState("Общее");
  const [answer, setAnswer] = useState("");

  // Оценка и пояснения
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [canonical, setCanonical] = useState("");
  const [matchedAs, setMatchedAs] = useState("");

  // Управление вопросом
  const [qIndex, setQIndex] = useState(0);           // 0..19
  const [evaluated, setEvaluated] = useState(false); // запрет двойной оценки

  // Таймер
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  // История
  const [history, setHistory] = useState([]);

  // Секундомер
  useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [running]);

  // ==== Рейтинги ====
  const toggleLeaf = (cat, leaf) => {
    const key = `${cat}/${leaf}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const toggleCategoryAll = (cat) => {
    const leaves = RATING_TREE[cat];
    const next = new Set(selected);
    const allSelected = leaves.every((l) => next.has(`${cat}/${l}`));
    if (allSelected) leaves.forEach((l) => next.delete(`${cat}/${l}`));
    else leaves.forEach((l) => next.add(`${cat}/${l}`));
    setSelected(next);
  };

  // ==== Поток ====
  const startTesting = () => setStep("ratings");
  const proceedToRole = () => { if (selected.size) setStep("role"); };
  const chooseRole = (r) => {
    setRole(r);
    setQIndex(0);
    getQuestion(r, Array.from(selected), 0);
  };

  // ==== API: Генерация вопроса ====
  async function getQuestion(roleValue, ratingsArray, index) {
    if (index >= TOTAL_QUESTIONS) {
      setStep("summary");
      setRunning(false);
      return;
    }
    setQuestion(""); setAnswer("");
    setScore(null); setFeedback(""); setCanonical(""); setMatchedAs("");
    setEvaluated(false); setElapsed(0); setRunning(false);

    const res = await fetch("/api/generate-question", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: roleValue, ratings: ratingsArray, index, total: TOTAL_QUESTIONS })
    });
    const data = await res.json();

    setQuestion(data.question || "Не удалось сгенерировать вопрос.");
    setDifficulty((data.difficulty || "medium").toLowerCase());
    setTopic(data.topic || "Общее");
    setElapsed(0); setRunning(true); setStep("question");
  }

  // ==== API: Оценка ====
  const sendForEvaluation = async () => {
    if (!answer.trim() || evaluated) return;
    setRunning(false);

    const res = await fetch("/api/evaluate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, topic, role, ratings: Array.from(selected) })
    });
    const data = await res.json();

    let s = typeof data.score === "number" ? data.score : 0;
    const fb = String(data.feedback ?? "").trim();
    const can = String(data.canonicalAnswer ?? "").trim();
    const ma  = String(data.matchedAs ?? "").trim();

    setScore(s); setFeedback(fb); setCanonical(can); setMatchedAs(ma);
    setEvaluated(true);

    setHistory(prev => [{
      ts: Date.now(), role, ratings: Array.from(selected),
      question, topic, answer, score: s, feedback: fb,
      canonical: can, matchedAs: ma, difficulty, time: elapsed, index: qIndex
    }, ...prev]);
  };

  const nextQuestion = () => {
    if (!evaluated) return; // нельзя без оценки
    const next = qIndex + 1;
    setQIndex(next);
    getQuestion(role, Array.from(selected), next);
  };

  // ==== Итоговый отчёт ====
  const renderSummary = () => {
    const scores = history.map(h => h.score ?? 0);
    const avgScore = avg(scores);
    const passed = history.filter(h => (h.score ?? 0) >= 0.75).length;
    const byTopic = history.reduce((acc, h) => {
      const t = h.topic || "Общее";
      (acc[t] ||= []).push(h.score ?? 0);
      return acc;
    }, {});
    const topicRows = Object.entries(byTopic)
      .map(([t, arr]) => ({ t, avg: avg(arr), n: arr.length }))
      .sort((a,b)=>a.avg-b.avg);

    const weak = topicRows.filter(r => r.avg < 0.6).slice(0,3);
    const feedbackText = weak.length
      ? `Обрати внимание на темы: ${weak.map(w=>`${w.t} (ср. ${w.avg.toFixed(2)})`).join("; ")}.`
      : "Хорошая равномерность знаний по темам.";

    return (
      <div className="card">
        <h2>Итоги теста</h2>
        <p className="hint">Вы прошли {TOTAL_QUESTIONS} вопросов.</p>

        <div className="summaryGrid">
          <div className="sumBox">
            <div className="sumLabel">Средний балл</div>
            <div className="sumValue">{avgScore.toFixed(2)}</div>
          </div>
          <div className="sumBox">
            <div className="sumLabel">Зачтено (≥ 0.75)</div>
            <div className="sumValue">{passed}/{TOTAL_QUESTIONS} · {pct(passed, TOTAL_QUESTIONS)}%</div>
          </div>
          <div className="sumBox">
            <div className="sumLabel">Должность</div>
            <div className="sumValue">{labelRole(role)}</div>
          </div>
          <div className="sumBox">
            <div className="sumLabel">Рейтингов</div>
            <div className="sumValue">{selected.size}</div>
          </div>
        </div>

        <h3 style={{marginTop:12}}>Темы</h3>
        <div className="topicList">
          {topicRows.map(r => (
            <div className="topicRow" key={r.t}>
              <div className="topicName">{r.t}</div>
              <div className={`topicScore chip small eval-${verdictClass(r.avg)}`}>{r.avg.toFixed(2)}</div>
              <div className="topicCount">вопросов: {r.n}</div>
            </div>
          ))}
        </div>

        <div className="evaluation" style={{marginTop:12}}>
          <b>Обратная связь:</b> {feedbackText}
        </div>

        <div className="controls" style={{marginTop:12}}>
          <button className="primary" onClick={()=>{
            // начать заново
            setHistory([]); setQIndex(0); setStep("welcome");
            setSelected(new Set()); setRole(null);
            setQuestion(""); setAnswer("");
            setScore(null); setFeedback(""); setCanonical(""); setMatchedAs("");
            setTopic("Общее");
          }}>
            Начать заново
          </button>
        </div>
      </div>
    );
  };

  // ==== Рендер ====
  return (
    <div className="wrap">
      <header className="header">
        <div className="brand">
          <span className="logo">✈️</span>
          <div className="title">
            <div className="name">Upgrade Your Knowledge</div>
            <div className="sub">Экзаменационная сессия</div>
          </div>
        </div>
        <div className="timerPill">⏱ {formatSecs(elapsed)}</div>
      </header>

      <main className="main">
        {step === "welcome" && (
          <div className="card center">
            <h1>Привет! Давай пройдём тест.</h1>
            <p>Для начала укажи свои рейтинги.</p>
            <button className="primary" onClick={startTesting}>Тестирование</button>
          </div>
        )}

        {step === "ratings" && (
          <div className="card">
            <h2>Выбери рейтинги</h2>
            <p className="hint">Можно нажать на название ветки, чтобы выбрать/снять все пункты сразу.</p>

            <div className="ratings">
              {Object.keys(RATING_TREE).map((cat) => {
                const leaves = RATING_TREE[cat];
                const allSelected = leaves.every((l) => selected.has(`${cat}/${l}`));
                return (
                  <div key={cat} className="branch">
                    <div
                      className={`branchHead ${allSelected ? "on" : ""}`}
                      onClick={() => toggleCategoryAll(cat)}
                      role="button"
                    >
                      {cat} {allSelected ? "✓" : ""}
                    </div>
                    <div className="leaves">
                      {leaves.map((l) => {
                        const k = `${cat}/${l}`;
                        const isOn = selected.has(k);
                        return (
                          <button
                            key={k}
                            className={`leaf ${isOn ? "on" : ""}`}
                            onClick={() => toggleLeaf(cat, l)}
                          >
                            {l} {isOn ? "✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="actions">
              <button className="primary" onClick={proceedToRole} disabled={selected.size === 0}>
                Далее
              </button>
            </div>
          </div>
        )}

        {step === "role" && (
          <div className="card">
            <h2>Выберите должность</h2>
            <div className="grid">
              {ROLES.map((r) => (
                <button key={r.value} className="tile" onClick={() => chooseRole(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "question" && question && (
          <div className="card">
            <div className="metaRow">
              <div className="chips">
                <span className="chip">{labelRole(role)}</span>
                <span className={`chip diff ${difficulty}`}>{ruDifficulty(difficulty)}</span>
                <span className="chip">Рейтингов: {selected.size}</span>
                <span className="chip">Тема: {topic}</span>
                <span className="chip">Вопрос {qIndex + 1}/{TOTAL_QUESTIONS}</span>
              </div>
              <div className="timerNote">Секундомер запущен</div>
            </div>

            <div className="diffBar">
              <div className={`diffFill ${difficulty}`} style={{ width: `${difficultyPercent(difficulty)}%` }} />
              <div className="diffLabels">
                <span>Easy</span><span>Medium</span><span>Hard</span>
              </div>
            </div>

            <h3>Вопрос</h3>
            <div className="questionBox">{question}</div>

            <label className="label">Ответ</label>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Введите ваш ответ…"
              onKeyDown={(e) => e.key === "Enter" && sendForEvaluation()}
              readOnly={evaluated}
            />

            <div className="controls">
              <button className="primary" onClick={sendForEvaluation} disabled={evaluated || !answer.trim()}>
                Оценить
              </button>
              <button className="ghost" onClick={nextQuestion} disabled={!evaluated}>
                Следующий вопрос
              </button>
            </div>

            {score !== null && (
              <div className={`evaluation eval-${verdictClass(score)}`}>
                <div className="scoreRow">
                  <span className="scoreNum">{Number(score).toFixed(2)}</span>
                  <span className="scoreText">{verdictLabel(score)}</span>
                </div>
                {feedback && <div className="feedback">{feedback}</div>}
                {(canonical || matchedAs) && (
                  <div className="canonical">
                    {canonical && <div><b>Правильный ответ (канон):</b> {canonical}</div>}
                    {matchedAs && matchedAs !== answer && (
                      <div className="muted">Ваш ответ распознан как: {matchedAs}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === "summary" && renderSummary()}

        {history.length > 0 && step !== "summary" && (
          <section className="history">
            <h2>История</h2>
            {history.map((h, i) => (
              <div key={i} className="histItem">
                <div className="row">
                  <span className="chip">{labelRole(h.role)}</span>
                  <span className={`chip diff ${h.difficulty}`}>{ruDifficulty(h.difficulty)}</span>
                  <span className="chip">{h.ratings.length} рейтингов</span>
                  <span className="chip">Тема: {h.topic || "Общее"}</span>
                  <span className={`chip small eval-${verdictClass(h.score)}`}>{Number(h.score).toFixed(2)}</span>
                  <span className="time">⏱ {formatSecs(h.time)}</span>
                </div>
                <p><b>Вопрос:</b> {h.question}</p>
                <p><b>Ответ:</b> {h.answer}</p>
                {h.feedback && <p><b>Комментарий:</b> {h.feedback}</p>}
                {h.canonical && (
                  <p>
                    <b>Правильный ответ (канон):</b> {h.canonical}
                    {h.matchedAs && h.matchedAs !== h.answer && (
                      <span className="muted"> (распознан как: {h.matchedAs})</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}
      </main>

      <style jsx>{`
        :global(body){ margin:0; background:#0b1220; color:#e5e7eb; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial;}
        .wrap{ max-width: 980px; margin:0 auto; padding:16px;}
        .header{
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          color:#fff; border-radius:16px; padding:12px 16px;
          display:flex; align-items:center; justify-content:space-between;
          box-shadow:0 18px 50px rgba(37,99,235,.35);
          position:sticky; top:12px; z-index:10;
        }
        .brand{ display:flex; align-items:center; gap:12px;}
        .logo{ font-size:22px;}
        .title .name{ font-weight:800;}
        .title .sub{ font-size:12px; opacity:.92;}
        .timerPill{ font-variant-numeric:tabular-nums; font-weight:800; background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.28); padding:6px 10px; border-radius:999px;}
        .main{ margin-top:16px;}
        .card{
          background: rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.14);
          border-radius:16px; padding:16px;
          box-shadow: 0 12px 30px rgba(0,0,0,.25);
          backdrop-filter: blur(8px);
          margin-bottom:12px;
        }
        .center{ text-align:center; }
        .primary{
          background: linear-gradient(135deg, #16a34a, #15803d);
          color:white; border:none; border-radius:12px;
          padding:12px 16px; font-weight:800; cursor:pointer;
          box-shadow:0 12px 30px rgba(34,197,94,.28);
        }
        .ghost{
          background: transparent;
          color:#e5e7eb; border:1px solid rgba(255,255,255,.25);
          border-radius:12px; padding:12px 16px; font-weight:700; cursor:pointer;
        }
        button:hover{ filter: brightness(1.06); }

        .ratings{ display:grid; gap:12px; }
        .branch{ background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:10px;}
        .branchHead{
          font-weight:800; cursor:pointer; user-select:none; margin-bottom:8px;
          padding:8px 10px; border-radius:10px; background: rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.14);
        }
        .branchHead.on{ background:#0ea5e922; border-color:#0ea5e955;}
        .leaves{ display:flex; flex-wrap:wrap; gap:8px; }
        .leaf{
          background:#f1f5f911; color:#e5e7eb; border:1px solid rgba(255,255,255,.18);
          border-radius:10px; padding:8px 12px; cursor:pointer;
        }
        .leaf.on{ background:#22c55e22; border-color:#22c55e77; }

        .actions{ margin-top:12px; display:flex; justify-content:flex-end; }

        .grid{
          display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px;
        }
        .tile{
          background:#f1f5f911; color:#e5e7eb; border:1px solid rgba(255,255,255,.18);
          border-radius:12px; padding:12px 16px; font-weight:800; cursor:pointer; text-align:center;
        }
        .tile:hover{ background:#e2e8f022; }

        .metaRow{ display:flex; align-items:center; justify-content:space-between; }
        .chips{ display:flex; gap:8px; flex-wrap:wrap; }
        .chip{
          background: rgba(255,255,255,.12);
          border:1px solid rgba(255,255,255,.2);
          color:#e5e7eb; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:800;
        }
        .chip.diff.easy   { background:#0f766e33; border-color:#0f766e66; color:#99f6e4; }
        .chip.diff.medium { background:#854d0e33; border-color:#854d0e66; color:#fde68a; }
        .chip.diff.hard   { background:#991b1b33; border-color:#991b1b66; color:#fecaca; }

        .timerNote{ opacity:.8; font-size:12px; }

        .diffBar{
          position: relative;
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, #16a34a, #f59e0b, #ef4444);
          opacity: 0.9;
          margin: 8px 0 12px;
          overflow: hidden;
        }
        .diffFill{
          position: absolute; top:0; left:0; bottom:0;
          background: rgba(255,255,255,.85);
          mix-blend-mode: overlay;
          border-right: 2px solid rgba(255,255,255,.9);
          transition: width .25s ease;
        }
        .diffFill.easy{   box-shadow: inset 0 0 12px rgba(22,163,74,.35); }
        .diffFill.medium{ box-shadow: inset 0 0 12px rgba(245,158,11,.35); }
        .diffFill.hard{   box-shadow: inset 0 0 12px rgba(239,68,68,.35); }

        .diffLabels{ display: flex; justify-content: space-between; font-size: 11px; color:#cbd5e1; margin-top:4px; }

        .questionBox{ background: rgba(15,23,42,.5); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 14px; margin: 10px 0 8px 0; }

        .label{ font-weight:700; margin-top:6px; margin-bottom:6px; }
        input{ width:100%; border:1px solid rgba(255,255,255,.18); border-radius:12px; padding:12px 14px; background: rgba(255,255,255,.08); color:#e5e7eb; outline:none; }
        .controls{ display:flex; gap:10px; margin-top:10px; }

        .evaluation{ margin-top:12px; border-radius:12px; padding:10px 12px; border:1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.08); }
        .scoreRow{ display:flex; gap:8px; align-items:center; }
        .scoreNum{ font-weight:800; font-variant-numeric: tabular-nums; }
        .scoreText{ opacity:.9; }
        .feedback{ margin-top:6px; opacity:.95; }
        .canonical{ margin-top:6px; }
        .muted{ color:#94a3b8; }

        .eval-ok  { border-color:#22c55e88; background:#22c55e1a; }
        .eval-good{ border-color:#84cc16aa; background:#84cc161a; }
        .eval-mid { border-color:#f59e0baa; background:#f59e0b1a; }
        .eval-low { border-color:#f97316aa; background:#f973161a; }
        .eval-bad { border-color:#ef4444aa; background:#ef44441a; }

        .history{ margin-top:16px; }
        .histItem{ background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); border-radius: 14px; padding:12px; margin-bottom:10px; }
        .row{ display:flex; align-items:center; gap:8px; }
        .time{ margin-left:auto; font-variant-numeric: tabular-nums; color:#cbd5e1; }
        .hint{ color:#cbd5e1; font-size:13px; margin: -4px 0 10px; }

        .summaryGrid{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; margin-top:8px; }
        .sumBox{ background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px; }
        .sumLabel{ color:#cbd5e1; font-size:12px; }
        .sumValue{ font-size:18px; font-weight:800; }

        .topicList{ display:grid; gap:8px; margin-top:8px; }
        .topicRow{ display:flex; align-items:center; gap:10px; }
        .topicName{ flex:1; }
        .chip.small{ padding:2px 8px; font-size:12px; }
        .topicCount{ color:#cbd5e1; font-size:12px; }

        @media (max-width: 560px) { .grid{ grid-template-columns:1fr; } .summaryGrid{ grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}
