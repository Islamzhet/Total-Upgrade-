import { useEffect, useRef, useState } from "react";

// Ветки рейтингов
const RATING_TREE = {
  Control: ["A1C", "A2C", "A3C", "A4C"],
  Approach: ["Approach", "Radar"],
  Aerodrome: ["Tower", "Delivery", "Ground"],
};

// Должность (внутренний код → подпись)
const ROLES = [
  { value: "trainee", label: "Диспетчер‑стажёр" },
  { value: "controller", label: "Диспетчер" },
  { value: "instructor", label: "Инструктор" },
  { value: "krs", label: "КРС" },
];

export default function Home() {
  // Шаги: welcome → ratings → role → question
  const [step, setStep] = useState("welcome");

  // Рейтинги: храним выбранные как набор строк (например: "Control/A1C")
  const [selected, setSelected] = useState(new Set());

  // Роль
  const [role, setRole] = useState(null);

  // Q/A + секундомер
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  // История
  const [history, setHistory] = useState([]);

  // секундомер
  useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [running]);

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
    const allSelected = leaves.every(l => next.has(`${cat}/${l}`));
    if (allSelected) {
      // снять все
      leaves.forEach(l => next.delete(`${cat}/${l}`));
    } else {
      // выбрать все
      leaves.forEach(l => next.add(`${cat}/${l}`));
    }
    setSelected(next);
  };

  const startTesting = () => setStep("ratings");

  const proceedToRole = () => {
    if (selected.size === 0) return;
    setStep("role");
  };

  const chooseRole = (r) => {
    setRole(r);
    // сразу генерируем первый вопрос
    generateQuestion(r, Array.from(selected));
  };

  async function generateQuestion(roleValue, ratingsArray) {
    setQuestion("");
    setEvaluation("");
    setAnswer("");
    setElapsed(0);
    setRunning(false);

    const res = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: roleValue,               // trainee|controller|instructor|krs
        ratings: ratingsArray,         // ["Control/A1C", "Approach/Radar", ...]
      }),
    });
    const data = await res.json();

    setQuestion(data.question || "Не удалось сгенерировать вопрос.");
    setElapsed(0);
    setRunning(true);
    setStep("question");
  }

  const evaluateAnswer = async () => {
    if (!answer.trim()) return;
    setRunning(false);
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    const data = await res.json();
    const grade = data.result || data.evaluation || "";
    setEvaluation(grade);

    setHistory(prev => [
      {
        ts: Date.now(),
        role,
        ratings: Array.from(selected),
        question,
        answer,
        evaluation: grade,
        time: elapsed,
      },
      ...prev,
    ]);
  };

  const nextQuestion = () => {
    generateQuestion(role, Array.from(selected));
  };

  return (
    <div className="wrap">
      {/* Шапка */}
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
            <p className="hint">Можно выбрать по отдельности или нажать на название ветки, чтобы выбрать всё сразу.</p>

            <div className="ratings">
              {Object.keys(RATING_TREE).map(cat => {
                const leaves = RATING_TREE[cat];
                const allSelected = leaves.every(l => selected.has(`${cat}/${l}`));
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
                      {leaves.map(l => {
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
              <button
                className="primary"
                onClick={proceedToRole}
                disabled={selected.size === 0}
              >
                Далее
              </button>
            </div>
          </div>
        )}

        {step === "role" && (
          <div className="card">
            <h2>Кто вы по должности?</h2>
            <div className="grid">
              {ROLES.map(r => (
                <button
                  key={r.value}
                  className="tile"
                  onClick={() => chooseRole(r.value)}
                >
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
                <span className="chip">Рейтингов: {selected.size}</span>
              </div>
              <div className="timerNote">Секундомер запущен</div>
            </div>

            <h3>Вопрос:</h3>
            <div className="questionBox">{question}</div>

            <label className="label">Ответ:</label>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Введите ваш ответ…"
            />

            <div className="controls">
              <button className="primary" onClick={evaluateAnswer}>
                Оценить
              </button>
              <button className="ghost" onClick={nextQuestion}>
                Следующий вопрос
              </button>
            </div>

            {evaluation && (
              <div className="evaluation">
                <strong>Оценка:</strong> {evaluation}
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
                  <span className="chip">{h.ratings.length} рейтингов</span>
                  <span className="time">⏱ {formatSecs(h.time)}</span>
                </div>
                <p><b>Вопрос:</b> {h.question}</p>
                <p><b>Ответ:</b> {h.answer}</p>
                <p><b>Оценка:</b> {h.evaluation}</p>
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
        .timerNote{ opacity:.8; font-size:12px; }

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
