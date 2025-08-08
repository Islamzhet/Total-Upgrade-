// pages/index.js
import { useEffect, useMemo, useRef, useState } from "react";

// список предметов (можно расширять)
const SUBJECTS = [
  "ОВД",
  "Метеорология",
  "Радиосвязь (ФРАСА)",
  "Навигация",
  "Документы (ИКАО/ФАП и др.)",
];

// уровни сложности
const LEVELS = [
  { value: "trainee", label: "Диспетчер‑стажёр" },
  { value: "controller", label: "Диспетчер" },
  { value: "krs", label: "КРС" },
  { value: "instructor", label: "Инструктор" },
];

export default function Home() {
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [level, setLevel] = useState("trainee");

  const [question, setQuestion] = useState("");
  const [questionMeta, setQuestionMeta] = useState(null); // difficulty/subject/level
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState("");
  const [history, setHistory] = useState([]);

  // секундомер
  const [elapsed, setElapsed] = useState(0); // сек
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  // форматируем мм:сс
  const elapsedStr = useMemo(() => {
    const m = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, "0");
    const s = (elapsed % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [elapsed]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed((x) => x + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  const generateQuestion = async () => {
    setQuestion("");
    setEvaluation("");
    setAnswer("");
    setElapsed(0);
    setRunning(false);

    const res = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, level }),
    });
    const data = await res.json();

    setQuestion(data.question || "Ошибка генерации вопроса");
    setQuestionMeta({
      difficulty: data.difficulty,
      subject: data.subject,
      level: data.level,
    });

    // запускаем секундомер
    setElapsed(0);
    setRunning(true);
  };

  const evaluateAnswer = async () => {
    if (!question || !answer) return;

    // стоп секундомер
    setRunning(false);

    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    const data = await res.json();

    const resultText = data.result || data.evaluation || "";
    setEvaluation(resultText);

    setHistory((prev) => [
      {
        ts: new Date().toISOString(),
        subject,
        level,
        difficulty: questionMeta?.difficulty,
        question,
        answer,
        evaluation: resultText,
        time: elapsed, // сек
      },
      ...prev,
    ]);
  };

  return (
    <div className="container">
      <h1>Upgrade Your Knowledge</h1>

      {/* Панель выбора */}
      <div className="panel">
        <div className="field">
          <label>Предмет</label>
          <select value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Уровень</label>
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <button onClick={generateQuestion}>Сгенерировать вопрос</button>
      </div>

      {/* Вопрос + секундомер */}
      {question && (
        <div className="card">
          <div className="questionRow">
            <div className="meta">
              <span className="chip">{questionMeta?.subject}</span>
              <span className="chip">{labelByLevel(level)}</span>
              {questionMeta?.difficulty && (
                <span className={`chip ${questionMeta.difficulty}`}>
                  {ruDifficulty(questionMeta.difficulty)}
                </span>
              )}
            </div>
            <div className="timer" title="Секундомер">
              ⏱ {elapsedStr}
            </div>
          </div>

          <div className="question">{question}</div>

          <label className="label">Ответ на вопрос</label>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Введите ваш ответ…"
          />

          <button className="primary" onClick={evaluateAnswer}>
            Оценить
          </button>

          {evaluation && (
            <div className="evaluation">
              <strong>Оценка:</strong> {evaluation}
            </div>
          )}
        </div>
      )}

      {/* История */}
      {history.length > 0 && (
        <div className="history">
          <h2>Последние ответы</h2>
          {history.map((item, i) => (
            <div key={i} className="historyItem">
              <div className="historyTop">
                <div className="left">
                  <span className="chip">{item.subject}</span>
                  <span className="chip">{labelByLevel(item.level)}</span>
                  {item.difficulty && (
                    <span className={`chip ${item.difficulty}`}>
                      {ruDifficulty(item.difficulty)}
                    </span>
                  )}
                </div>
                <div className="right">⏱ {formatSecs(item.time)}</div>
              </div>

              <p>
                <strong>Вопрос:</strong> {item.question}
              </p>
              <p>
                <strong>Ответ:</strong> {item.answer}
              </p>
              <p>
                <strong>Оценка:</strong> {item.evaluation}
              </p>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 880px;
          margin: 0 auto;
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji",
            "Segoe UI Emoji";
        }

        h1 {
          font-size: 34px;
          font-weight: 800;
          text-align: center;
          margin-bottom: 18px;
        }

        .panel {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 12px;
          align-items: end;
          margin-bottom: 16px;
        }

        .field label {
          display: block;
          font-size: 12px;
          color: #425466;
          margin-bottom: 6px;
        }

        select,
        input {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 10px 12px;
          outline: none;
          font-size: 14px;
        }

        button {
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-weight: 600;
          cursor: pointer;
          height: 40px;
        }
        button:hover {
          background: #1558c0;
        }
        .primary {
          margin-top: 8px;
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
          margin-top: 8px;
        }

        .questionRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .chip {
          background: #eef2ff;
          color: #1e40af;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .chip.easy {
          background: #ecfdf5;
          color: #065f46;
        }
        .chip.medium {
          background: #fef9c3;
          color: #854d0e;
        }
        .chip.hard {
          background: #fee2e2;
          color: #991b1b;
        }

        .timer {
          font-variant-numeric: tabular-nums;
          color: #111827;
          font-weight: 700;
        }

        .question {
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 10px;
          line-height: 1.45;
        }

        .label {
          font-weight: 600;
          margin-top: 6px;
          margin-bottom: 6px;
          color: #111827;
        }

        .evaluation {
          margin-top: 10px;
        }

        .history {
          margin-top: 28px;
        }
        .history h2 {
          margin-bottom: 12px;
          font-size: 20px;
          font-weight: 800;
        }
        .historyItem {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 12px;
        }
        .historyTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .left {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .right {
          font-variant-numeric: tabular-nums;
          color: #374151;
          font-weight: 700;
        }

        @media (max-width: 640px) {
          .panel {
            grid-template-columns: 1fr;
          }
          button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// helpers
function labelByLevel(v) {
  const found = LEVELS.find((x) => x.value === v);
  return found ? found.label : v;
}
function ruDifficulty(d) {
  if (d === "easy") return "Лёгкий";
  if (d === "medium") return "Средний";
  if (d === "hard") return "Сложный";
  return d;
}
function formatSecs(s) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}
