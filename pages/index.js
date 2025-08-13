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

  // Получение нового вопроса (примерная функция, адаптируй под твой fetch)
  const getQuestion = async () => {
    if (qIndex >= TOTAL_QUESTIONS) {
      setStep("summary");
      return;
    }
    const response = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, ratings: Array.from(selected) }),
    });
    const data = await response.json();
    setQuestion(data.question);
    setDifficulty(data.difficulty);
    setTopic(data.topic);
    setCanonical(data.canonicalAnswer || "");
    setAnswer("");
    setEvaluated(false);
    setRunning(true);
    setQIndex(qIndex + 1);
  };

  // Оценка ответа
  const evaluate = async () => {
    if (evaluated) return;
    const response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, topic, canonicalFromPdf: canonical }),
    });
    const data = await response.json();
    setScore(data.score);
    setFeedback(data.feedback);
    setCanonical(data.canonicalAnswer);
    setMatchedAs(data.matchedAs);
    setEvaluated(true);
    setHistory([...history, { question, answer, score: data.score, time: elapsed }]);
    setRunning(false);
  };

  // UI рендеринг
  return (
    <div className="container">
      <style>{`
        :root { --bg: #0f172a; --fg: #e5e7eb; }
        body { margin: 0; padding: 20px; background: var(--bg); color: var(--fg); font-family: Arial, sans-serif; }
        .container { max-width: 800px; margin: 0 auto; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .diffBox{ position: relative; height: 8px; background: rgba(255,255,255,.12); border-radius: 999px; margin: 10px 0 0 0; }
        .diffFill{ position: absolute; top:0; left:0; bottom:0; background: rgba(255,255,255,.85); mix-blend-mode: overlay; border-right: 2px solid rgba(255,255,255,.9); transition: width .25s ease; }
        .diffFill.easy{ box-shadow: inset 0 0 12px rgba(22,163,74,.35); }
        .diffFill.medium{ box-shadow: inset 0 0 12px rgba(245,158,11,.35); }
        .diffFill.hard{ box-shadow: inset 0 0 12px rgba(239,68,68,.35); }
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
        .canonical{ margin-top:6px; color:#94a3b8; }
        .muted{ color:#94a3b8; }
        .eval-ok{ border-color:#22c55e88; background:#22c55e1a; }
        .eval-good{ border-color:#84cc16aa; background:#84cc161a; }
        .eval-mid{ border-color:#f59e0baa; background:#f59e0b1a; }
        .eval-low{ border-color:#f97316aa; background:#f973161a; }
        .eval-bad{ border-color:#ef4444aa; background:#ef44441a; }
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

        /* Прогресс-бар */
        .progress-bar {
          width: 100%;
          background-color: #e5e7eb;
          border-radius: 999px;
          height: 8px;
          margin: 10px 0;
        }
        .progress-fill {
          width: 0%;
          height: 100%;
          background-color: #3b82f6;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        /* Мобильная адаптация */
        @media (max-width: 560px) {
          .grid { grid-template-columns: 1fr; }
          .summaryGrid { grid-template-columns: 1fr; }
          input { font-size: 16px; padding: 10px; }
          .controls { flex-direction: column; gap: 8px; }
          .progress-bar { height: 6px; }
        }
      `}</style>

      {step === "welcome" && (
        <div className="grid">
          <div>Добро пожаловать в тест для авиадиспетчеров!</div>
          <button onClick={() => setStep("ratings")}>Начать</button>
        </div>
      )}
      {step === "ratings" && (
        <div className="grid">
          <div>Выбери рейтинг:</div>
          <div>
            {Object.entries(RATING_TREE).map(([key, values]) => (
              <div key={key}>
                <input type="checkbox" id={key} onChange={(e) => {
                  const newSet = new Set(selected);
                  if (e.target.checked) newSet.add(`${key}/${values[0]}`);
                  else newSet.delete(`${key}/${values[0]}`);
                  setSelected(newSet);
                }} />
                <label htmlFor={key}>{key}</label>
              </div>
            ))}
            <button onClick={() => setStep("role")}>Далее</button>
          </div>
        </div>
      )}
      {step === "role" && (
        <div className="grid">
          <div>Выбери роль:</div>
          <div>
            {ROLES.map((r) => (
              <div key={r.value}>
                <input type="radio" id={r.value} name="role" value={r.value} onChange={(e) => setRole(e.target.value)} />
                <label htmlFor={r.value}>{r.label}</label>
              </div>
            ))}
            <button onClick={() => setStep("question")} disabled={!role}>Далее</button>
          </div>
        </div>
      )}
      {step === "question" && (
        <div>
          {/* Прогресс-бар */}
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(qIndex / TOTAL_QUESTIONS) * 100}%` }} />
          </div>
          <div>Вопрос {qIndex} из {TOTAL_QUESTIONS}</div>

          <div className="questionBox">
            <div className="label">Вопрос:</div>
            <div>{question}</div>
            <div className="diffBox">
              <div className={`diffFill ${difficulty}`} style={{ width: `${difficultyPercent(difficulty)}%` }} />
            </div>
            <div className="diffLabels">
              <span>Лёгкий</span><span>Сложный</span>
            </div>
          </div>
          <div className="label">Ваш ответ:</div>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Введите ответ..." />
          <div className="controls">
            <button onClick={evaluate} disabled={evaluated || !answer}>Оценить</button>
            <button onClick={getQuestion}>Следующий вопрос</button>
          </div>
          {score !== null && (
            <div className={`evaluation eval-${verdictClass(score)}`}>
              <div className="scoreRow">
                <span className="scoreNum">{(score * 100).toFixed(0)}</span>
                <span className="scoreText">{verdictLabel(score)}</span>
              </div>
              <div className="feedback">{feedback}</div>
              <div className="canonical">Канон: {canonical}</div>
            </div>
          )}
        </div>
      )}
      {step === "summary" && (
        <div>
          <div>Итоги:</div>
          <div className="summaryGrid">
            <div className="sumBox">
              <div className="sumLabel">Средний балл</div>
              <div className="sumValue">{avg(history.map(h => h.score)).toFixed(2)}</div>
            </div>
            <div className="sumBox">
              <div className="sumLabel">Время</div>
              <div className="sumValue">{formatSecs(avg(history.map(h => h.time)))}</div>
            </div>
          </div>
          <div className="history">
            {history.map((h, i) => (
              <div key={i} className="histItem">
                <div className="row">
                  <span>{i + 1}. {h.question}</span>
                  <span className="time">{formatSecs(h.time)}</span>
                </div>
                <div className="row">
                  <span>Ваш ответ: {h.answer}</span>
                  <span>{(h.score * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
