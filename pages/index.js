// pages/index.js
import { useEffect, useMemo, useRef, useState } from "react";

// Предметы и уровни (подписей на кнопках)
const SUBJECTS = [
  "ОВД",
  "Метеорология",
  "Радиосвязь (ФРАСА)",
  "Навигация",
  "Документы (ИКАО/ФАП)"
];

const LEVELS = [
  { value: "trainee", label: "Диспетчер‑стажёр" },
  { value: "controller", label: "Диспетчер" },
  { value: "krs", label: "КРС" },
  { value: "instructor", label: "Инструктор" },
];

// Хелперы
function labelByLevel(v) {
  const f = LEVELS.find(x => x.value === v);
  return f ? f.label : v;
}
function formatSecs(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export default function Home() {
  // Шаги сценария
  // greet -> chooseLevel -> chooseSubject -> asking (идёт вопрос) -> reviewed (оценка)
  const [step, setStep] = useState("greet");

  // Состояние тестирования
  const [level, setLevel] = useState(null);
  const [subject, setSubject] = useState(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState("");

  // Секундомер
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  const elapsedStr = useMemo(() => formatSecs(elapsed), [elapsed]);

  // Лента чата
  const [chat, setChat] = useState([
    {
      who: "boss",
      text:
        "Добрый день. Я начальник смены. Проверим базу. Сначала скажи, кто ты по уровню подготовки?"
    }
  ]);

  // История вопросов/ответов в сессии
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [running]);

  // ----- Переходы по шагам -----
  const chooseLevel = (val) => {
    setLevel(val);
    pushUser(labelByLevel(val));
    pushBoss(
      "Принято. Теперь выбери предмет, по которому пройдёмся."
    );
    setStep("chooseSubject");
  };

  const chooseSubject = (subj) => {
    setSubject(subj);
    pushUser(subj);
    // Запрашиваем вопрос
    setStep("asking");
    loadQuestion(subj, level);
  };

  async function loadQuestion(subj, lvl) {
    stopTimer(); // на всякий
    setElapsed(0);
    setQuestion("");
    setEvaluation("");
    setAnswer("");

    pushBoss("Отлично. Слушай вопрос…");

    const res = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subj, level: lvl }),
    });
    const data = await res.json();

    const q = data?.question?.trim() || "Не удалось сгенерировать вопрос.";
    setQuestion(q);

    pushBoss(q, { meta: `${subj} • ${labelByLevel(lvl)} • ⏱ пошёл секундомер` });

    // запуск секундомера
    setElapsed(0);
    setRunning(true);
  }

  const sendAnswer = async () => {
    if (!answer.trim() || !question) return;

    // фиксируем ответ
    pushUser(answer);
    // стоп секундомер
    stopTimer();

    // оцениваем
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer })
    });
    const data = await res.json();
    const resultText = data.result || data.evaluation || "Оценка недоступна";

    setEvaluation(resultText);

    pushBoss(`Оценка: ${resultText}`, { meta: `Время ответа: ${elapsedStr}` });

    // в историю
    setHistory(prev => [
      {
        subject,
        level,
        question,
        answer,
        evaluation: resultText,
        time: elapsed
      },
      ...prev
    ]);

    setStep("reviewed");
  };

  const nextQuestion = () => {
    // Очередной вопрос по тем же subject/level
    setStep("asking");
    loadQuestion(subject, level);
  };

  const stopTimer = () => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // ----- чат-помощники -----
  function pushBoss(text, opts = {}) {
    setChat(prev => [...prev, { who: "boss", text, meta: opts.meta }]);
  }
  function pushUser(text) {
    setChat(prev => [...prev, { who: "you", text }]);
  }

  // ----- UI -----
  return (
    <div className="wrap">
      {/* Шапка */}
      <header className="header">
        <div className="brand">
          <span className="logo">✈️</span>
          <div className="title">
            <div className="name">Upgrade Your Knowledge</div>
            <div className="sub">Экзаменатор • Сменный начальник</div>
          </div>
        </div>
        <div className="timer">⏱ {elapsedStr}</div>
      </header>

      {/* Чат */}
      <main className="chat">
        {chat.map((m, i) => (
          <ChatBubble key={i} who={m.who} text={m.text} meta={m.meta} />
        ))}

        {/* Шаги: выбор уровня / предмета / ответ */}
        {step === "greet" && (
          <ChoiceGrid>
            {LEVELS.map((l) => (
              <button key={l.value} onClick={() => chooseLevel(l.value)}>
                {l.label}
              </button>
            ))}
          </ChoiceGrid>
        )}

        {step === "chooseLevel" && (
          <ChoiceGrid>
            {LEVELS.map((l) => (
              <button key={l.value} onClick={() => chooseLevel(l.value)}>
                {l.label}
              </button>
            ))}
          </ChoiceGrid>
        )}

        {step === "chooseSubject" && (
          <>
            <ChoiceGrid>
              {SUBJECTS.map((s) => (
                <button key={s} onClick={() => chooseSubject(s)}>
                  {s}
                </button>
              ))}
            </ChoiceGrid>
          </>
        )}

        {(step === "asking" || step === "reviewed") && !!question && (
          <div className="answerBar">
            <input
              value={answer}
              placeholder="Введите ваш ответ…"
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendAnswer();
              }}
            />
            <button className="primary" onClick={sendAnswer}>
              Отправить
            </button>
          </div>
        )}

        {step === "reviewed" && (
          <div className="controls">
            <button onClick={nextQuestion}>Следующий вопрос</button>
            <button
              className="ghost"
              onClick={() => {
                setStep("chooseSubject");
                pushBoss("Выбери следующий предмет.");
              }}
            >
              Сменить предмет
            </button>
          </div>
        )}
      </main>

      {/* История */}
      {history.length > 0 && (
        <section className="history">
          <h2>История сессии</h2>
          {history.map((h, i) => (
            <div key={i} className="histItem">
              <div className="row">
                <span className="chip">{h.subject}</span>
                <span className="chip">{labelByLevel(h.level)}</span>
                <span className="time">⏱ {formatSecs(h.time)}</span>
              </div>
              <p><b>Вопрос:</b> {h.question}</p>
              <p><b>Ответ:</b> {h.answer}</p>
              <p><b>Оценка:</b> {h.evaluation}</p>
            </div>
          ))}
        </section>
      )}

      <style jsx>{`
        :global(body) { margin: 0; background: #f7f8fb; color: #0f172a; }
        .wrap {
          max-width: 920px;
          margin: 0 auto;
          padding: 16px;
        }
        .header {
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
          color: white;
          border-radius: 16px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 10px 30px rgba(37,99,235,.25);
          position: sticky;
          top: 12px;
          z-index: 10;
        }
        .brand { display: flex; align-items: center; gap: 12px; }
        .logo { font-size: 22px; }
        .title .name { font-weight: 800; letter-spacing:.2px; }
        .title .sub { font-size: 12px; opacity: .9; }
        .timer { font-variant-numeric: tabular-nums; font-weight: 800; }

        .chat {
          margin-top: 18px;
          background: white;
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 4px 16px rgba(15,23,42,.06);
        }

        .answerBar {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          margin-top: 10px;
        }
        input {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 15px;
          outline: none;
          background: #f8fafc;
        }
        button {
          background: #111827;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 12px 16px;
          font-weight: 700;
          cursor: pointer;
        }
        button:hover { opacity: .95; }
        .primary { background: #2563eb; }
        .ghost {
          background: transparent;
          color: #111827;
          border: 1px solid #cbd5e1;
        }
        .controls {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .history { margin: 18px 0; }
        .history h2 { margin: 0 0 10px 0; }
        .histItem {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .row {
          display: flex; gap: 8px; align-items: center; margin-bottom: 6px;
        }
        .chip {
          background: #eef2ff;
          color: #1e40af;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
        }
        .time { margin-left: auto; font-variant-numeric: tabular-nums; }

        /* Сетка для вариантов выбора */
        .choices {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 10px;
        }
        @media (max-width: 560px) {
          .choices { grid-template-columns: 1fr; }
        }
        .choices button {
          background: #f1f5f9;
          color: #0f172a;
          border: 1px solid #e5e7eb;
        }
      `}</style>
    </div>
  );
}

// Компонент «варианты»
function ChoiceGrid({ children }) {
  return <div className="choices">{children}
    <style jsx>{`
      .choices {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0,1fr));
        gap: 10px;
      }
      @media (max-width: 560px) { .choices { grid-template-columns: 1fr; } }
      .choices :global(button){
        background:#f1f5f9; color:#0f172a; border:1px solid #e5e7eb;
        border-radius:12px; padding:12px 16px; font-weight:700; cursor:pointer;
      }
      .choices :global(button:hover){ background:#e2e8f0; }
    `}</style>
  </div>;
}

// Сообщение в чате
function ChatBubble({ who, text, meta }) {
  const isBoss = who === "boss";
  return (
    <div className={`bubble ${isBoss ? "boss" : "you"}`}>
      {isBoss && <div className="avatar">👨‍✈️</div>}
      <div className="msg">
        <div className="text">{text}</div>
        {meta && <div className="meta">{meta}</div>}
      </div>
      {!isBoss && <div className="avatar youA">🧑‍💻</div>}

      <style jsx>{`
        .bubble {
          display: flex;
          gap: 10px;
          margin-bottom: 10px;
          align-items: flex-start;
        }
        .boss { justify-content: flex-start; }
        .you { justify-content: flex-end; }
        .avatar {
          width: 34px; height: 34px; border-radius: 999px;
          display: grid; place-items: center;
          background: #e0f2fe; font-size: 18px;
        }
        .youA { background:#e2e8f0; }
        .msg {
          max-width: 76%;
          background: ${isBoss ? "#eef2ff" : "#dcfce7"};
          border: 1px solid #e5e7eb;
          padding: 10px 12px;
          border-radius: 12px;
          box-shadow: 0 1px 4px rgba(0,0,0,.04);
        }
        .text { line-height: 1.45; }
        .meta { font-size: 12px; color:#475569; margin-top: 4px; }
        @media (max-width: 560px){
          .msg { max-width: 100%; }
        }
      `}</style>
    </div>
  );
}
