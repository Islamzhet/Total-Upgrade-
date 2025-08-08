import { useEffect, useRef, useState } from "react";

// ===== РЕЙТИНГИ (ветки) =====
const RATING_TREE = {
  Control: ["A1C", "A2C", "A3C", "A4C"],
  Approach: ["Approach", "Radar"],
  Aerodrome: ["Tower", "Delivery", "Ground"],
};

// ===== РОЛИ =====
const ROLES = [
  { value: "trainee", label: "Диспетчер‑стажёр" },
  { value: "controller", label: "Диспетчер" },
  { value: "instructor", label: "Инструктор" },
  { value: "krs", label: "КРС" },
];

// ===== ХЕЛПЕРЫ =====
function labelRole(value) {
  const map = {
    trainee: "Диспетчер‑стажёр",
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
  // тоньше шкала, чтобы 1.0 = зелёный, 0.75.. = лайм, 0.5.. = жёлтый, 0.25.. = оранжевый, <0.25 = красный
  if (n >= 0.90) return "Отлично";
  if (n >= 0.75) return "Почти идеально";
  if (n >= 0.50) return "В целом верно";
  if (n >= 0.25) return "Частично";
  if (n > 0) return "Слабо";
  return "Не по сути";
}
function verdictClass(v) {
  const n = Number(v);
  if (n >= 0.90) return "ok";     // зелёный
  if (n >= 0.75) return "good";   // лайм
  if (n >= 0.50) return "mid";    // жёлтый
  if (n >= 0.25) return "low";    // оранжевый
  return "bad";                   // красный
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

// ===== КОМПОНЕНТ =====
export default function Home() {
  // Шаги: welcome → ratings → role → question
  const [step, setStep] = useState("welcome");

  // Рейтинги (Set строк "Control/A1C")
  const [selected, setSelected] = useState(new Set());

  // Роль
  const [role, setRole] = useState(null);

  // Вопрос/ответ/сложность
  const [question, setQuestion] = useState("");
  const [difficulty, setDifficulty] = useState("medium"); // приходит из API
  const [answer, setAnswer] = useState("");

  // Оценка и пояснения (НОВОЕ)
  const [score, setScore] = useState(null);          // число 0..1
  const [feedback, setFeedback] = useState("");      // короткий комментарий
  const [canonical, setCanonical] = useState("");    // правильный ответ
  const [matchedAs, setMatchedAs] = useState("");    // как распознан ответ пользователя

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
  const proceedToRole = () => {
    if (selected.size === 0) return;
    setStep("role");
  };
  const chooseRole = (r) => {
    setRole(r);
    generateQuestion(r, Array.from(selected));
  };

  // ==== API: Генерация вопроса ====
  async function generateQuestion(roleValue, ratingsArray) {
    setQuestion("");
    setAnswer("");
    // обнуляем оценку и комментарии
    setScore(null);
    setFeedback("");
    setCanonical("");
    setMatchedAs("");
    setElapsed(0);
    setRunning(false);

    const res = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: roleValue,
        ratings: ratingsArray,
      }),
    });
    const data = await res.json();

    setQuestion(data.question || "Не удалось сгенерировать вопрос.");
    setDifficulty((data.difficulty || "medium").toLowerCase());
    setElapsed(0);
    setRunning(true);
    setStep("question");
  }

  // ==== API: Оценка ====
  const sendForEvaluation = async () => {
    if (!answer.trim()) return;
    setRunning(false);

    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // достаточно вопроса и ответа; роль/рейтинги при желании можно тоже отправить
      body: JSON.stringify({ question, answer }),
    });

    const data = await res.json();

    // Нормализуем: поддерживаем и новый формат ({score,feedback,canonicalAnswer,matchedAs}),
    // и старый ({evaluation: "1.0 …"}), чтобы ничего не ломалось.
    let s = null;
    if (typeof data.score === "number") {
      s = data.score;
    } else {
      const raw = String(data.evaluation ?? data.result ?? "").trim();
      const m = raw.match(/\b(?:1(?:\.0+)?|0(?:\.\d+)?|\.\d+)\b/);
      if (m) s = Number(m[0]);
    }
    if (s == null || Number.isNaN(s)) s = 0;

    const fb = String(data.feedback ?? "").trim();
    const can = String(data.canonicalAnswer ?? data.canonical ?? "").trim();
    const ma  = String(data.matchedAs ?? "").trim();

    setScore(s);
    setFeedback(fb);
    setCanonical(can);
    setMatchedAs(ma);

    setHistory((prev) => [
      {
        ts: Date.now(),
        role,
        ratings: Array.from(selected),
        question,
        answer,
        score: s,
        feedback: fb,
        canonical: can,
        matchedAs: ma,
        difficulty,
        time: elapsed,
      },
      ...prev,
    ]);
  };

  const nextQuestion = () => {
    generateQuestion(role, Array.from(selected));
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
            <button className="primary" onClick={startTesting}>
              Тестирование
            </button>
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
              </div>
              <div className="timerNote">Секундомер запущен</div>
            </div>

            {/* Индикатор сложности — градиентная плашка */}
            <div className="diffBar">
              <div
                className={`diffFill ${difficulty}`}
                style={{ width: `${difficultyPercent(difficulty)}%` }}
              />
              <div className="diffLabels">
                <span>Easy</span>
                <span>Medium</span>
                <span>Hard</span>
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
            />

            <div className="controls">
              <button className="primary" onClick={sendForEvaluation}>
                Оценить
              </button>
              <button className="ghost" onClick={nextQuestion}>
                Следующий вопрос
              </button>
            </div>

            {/* Блок результата — работает с ЧИСЛОВЫМ score + текстом */}
            {score !== null && (
              <div className={`evaluation eval-${verdictClass(score)}`}>
                <div className="scoreRow">
                  <span className="scoreNum">{Number(score).toFixed(2)}</span>
                  <span className="scoreText">{verdictLabel(score)}</span>
                </div>
                {feedback && <div className="feedback">{feedback}</div>}
                {(canonical || matchedAs) && (
                  <div className="canonical">
                    {canonical && (
                      <div><b>Правильный ответ:</b> {canonical}</div>
                    )}
                    {matchedAs && matchedAs !== answer && (
                      <div className="muted">Ваш ответ распознан как: {matchedAs}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <section className="history">
            <h2>История</h2>
            {history.map((h, i) => (
              <div key={i} className="histItem">
                <div className="row">
                  <span className="chip">{labelRole(h.role)}</span>
                  <span className={`chip diff ${h.difficulty}`}>{ruDifficulty(h.difficulty)}</span>
                  <span className="chip">{h.ratings.length} рейтингов</span>
                  <span className={`chip small eval-${verdictClass(h.score)}`}>
                    {Number(h.score).toFixed(2)}
                  </span>
                  <span className="time">⏱ {formatSecs(h.time)}</span>
                </div>
                <p><b>Вопрос:</b> {h.question}</p>
                <p><b>Ответ:</b> {h.answer}</p>
                {h.feedback && <p><b>Комментарий:</b> {h.feedback}</p>}
                {h.canonical && (
                  <p>
                    <b>Правильный ответ:</b> {h.canonical}
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

        .diffLabels{
          display: flex; justify-content: space-between;
          font-size: 11px; color:#cbd5e1; margin-top:4px;
        }

        .questionBox{
          background: rgba(15,23,42,.5);
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 14px;
          padding: 14px; margin: 10px 0 8px 0;
        }

        .label{ font-weight:700; margin-top:6px; margin-bottom:6px; }
        input{
          width:100%; border:1px solid rgba(255,255,255,.18);
          border-radius:12px; padding:12px 14px; background: rgba(255,255,255,.08);
          color:#e5e7eb; outline:none;
        }
        .controls{ display:flex; gap:10px; margin-top:10px; }

        .evaluation{
          margin-top:12px; border-radius:12px; padding:10px 12px;
          border:1px solid rgba(255,255,255,.16); background: rgba(255,255,255,.08);
        }
        .scoreRow{ display:flex; gap:8px; align-items:center; }
        .scoreNum{ font-weight:800; font-variant-numeric: tabular-nums; }
        .scoreText{ opacity:.9; }
        .feedback{ margin-top:6px; opacity:.95; }
        .canonical{ margin-top:6px; }
        .muted{ color:#94a3b8; }

        /* цветовые состояния оценки */
        .eval-ok  { border-color:#22c55e88; background:#22c55e1a; }
        .eval-good{ border-color:#84cc16aa; background:#84cc161a; }
        .eval-mid { border-color:#f59e0baa; background:#f59e0b1a; }
        .eval-low { border-color:#f97316aa; background:#f973161a; }
        .eval-bad { border-color:#ef4444aa; background:#ef44441a; }

        .history{ margin-top:16px; }
        .histItem{
          background: rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.12);
          border-radius: 14px; padding:12px; margin-bottom:10px;
        }
        .row{ display:flex; align-items:center; gap:8px; }
        .time{ margin-left:auto; font-variant-numeric: tabular-nums; color:#cbd5e1; }
        .hint{ color:#cbd5e1; font-size:13px; margin: -4px 0 10px; }
        @media (max-width: 560px) { .grid{ grid-template-columns:1fr; } }
      `}</style>
    </div>
  );
}
