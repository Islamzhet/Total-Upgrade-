// /pages/index.js
import { useEffect, useRef, useState } from "react";

export default function Home() {
  // Основные состояния
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [canonical, setCanonical] = useState("");
  const [matchedAs, setMatchedAs] = useState("");
  const [history, setHistory] = useState([]);

  // Секундомер
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef(null);
  const startRef = useRef(null);

  // Цвет/текст по баллу
  function verdictClass(s) {
    if (s >= 0.9) return "success";
    if (s >= 0.75) return "good";
    if (s >= 0.5) return "fair";
    if (s >= 0.25) return "weak";
    return "error";
  }
  function verdictLabel(s) {
    if (s >= 0.9) return "Отлично";
    if (s >= 0.75) return "Почти идеально";
    if (s >= 0.5) return "В целом верно";
    if (s >= 0.25) return "Частично";
    return "Не по сути";
  }

  // формат мм:сс
  function fmt(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // тики секундомера
  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsedMs;
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current);
      }, 200);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const resetCurrent = () => {
    setAnswer("");
    setScore(null);
    setFeedback("");
    setCanonical("");
    setMatchedAs("");
    setElapsedMs(0);
  };

  // Сгенерировать вопрос
  const generateQuestion = async () => {
    try {
      const res = await fetch("/api/generate-question");
      const data = await res.json();
      setQuestion((data?.question || "").trim());
      resetCurrent();
      setRunning(true); // стартуем секундомер
    } catch (e) {
      console.error(e);
      setQuestion("Ошибка генерации вопроса");
      resetCurrent();
    }
  };

  // Оценить ответ
  const evaluateAnswer = async () => {
    if (!question || !answer) return;

    setRunning(false); // стоп секундомера
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      const data = await res.json();

      const s = typeof data.score === "number" ? data.score : 0;
      setScore(s);
      setFeedback(data.feedback || "");
      setCanonical(data.canonicalAnswer || "");
      setMatchedAs(data.matchedAs || "");

      // записать в историю
      setHistory((prev) => [
        {
          ts: Date.now(),
          question,
          answer,
          score: s,
          feedback: data.feedback || "",
          canonical: data.canonicalAnswer || "",
          matchedAs: data.matchedAs || "",
          elapsedMs,
        },
        ...prev,
      ]);
    } catch (e) {
      console.error(e);
      setScore(0);
      setFeedback("Ошибка оценки.");
    }
  };

  const nextQuestion = () => {
    generateQuestion();
  };

  return (
    <div className="wrap">
      <header className="hero">
        <h1>Upgrade Your Knowledge</h1>
        <p className="sub">Добрый день! Давай пройдём тест. Сначала сгенерируй вопрос, ответь и получи оценку от ИИ.</p>
        <div className="actions">
          <button className="primary" onClick={generateQuestion}>Сгенерировать вопрос</button>
          <div className={`timer ${running ? "on" : ""}`} title="Секундомер">
            ⏱ {fmt(elapsedMs)}
          </div>
        </div>
      </header>

      <main className="main">
        {question ? (
          <section className="card">
            <div className="card-head">
              <div className="chip hint">Вопрос</div>
              <div className="grow" />
              <div className="chip mono">{fmt(elapsedMs)}</div>
            </div>

            <div className="question">{question}</div>

            <label className="label">Ответ</label>
            <input
              className="input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Введи твой ответ…"
            />

            <div className="row">
              <button className="primary" onClick={evaluateAnswer}>Оценить</button>
              <button className="ghost" onClick={nextQuestion}>Следующий вопрос</button>
            </div>

            {score !== null && (
              <div className={`result ${verdictClass(score)}`}>
                <div className="result-row">
                  <span className="chip score">{verdictLabel(score)}</span>
                  <span className="score-num">{score.toFixed(2)}</span>
                </div>
                {feedback && <div className="feedback">{feedback}</div>}
                {(canonical || matchedAs) && (
                  <div className="canonical">
                    {canonical && (
                      <div>
                        <b>Правильный ответ:</b> {canonical}
                      </div>
                    )}
                    {matchedAs && matchedAs !== answer && (
                      <div className="muted">Ваш ответ распознан как: {matchedAs}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          <section className="empty">
            Нажми «Сгенерировать вопрос», чтобы начать.
          </section>
        )}

        {history.length > 0 && (
          <section className="history">
            <h2>История</h2>
            {history.map((h, i) => (
              <div className="history-item" key={h.ts + "_" + i}>
                <div className="history-head">
                  <div className={`chip ${verdictClass(h.score)}`}>{verdictLabel(h.score)}</div>
                  <div className="muted">⏱ {fmt(h.elapsedMs)}</div>
                </div>
                <div className="history-row"><b>Вопрос:</b> {h.question}</div>
                <div className="history-row"><b>Ответ:</b> {h.answer}</div>
                {typeof h.score === "number" && (
                  <div className="history-row">
                    <b>Оценка:</b> {h.score.toFixed(2)}{h.feedback ? ` — ${h.feedback}` : ""}
                  </div>
                )}
                {h.canonical && (
                  <div className="history-row">
                    <b>Правильный ответ:</b> {h.canonical}
                    {h.matchedAs && h.matchedAs !== h.answer && (
                      <span className="muted"> (распознан как: {h.matchedAs})</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
      </main>

      <style jsx>{`
        :global(body) { background: #0f1222; color: #e8ecf1; }
        .wrap { max-width: 900px; margin: 0 auto; padding: 24px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        .hero { text-align: center; margin-bottom: 18px; }
        h1 { font-size: 36px; margin: 0 0 8px; }
        .sub { color: #aab2c3; margin: 0 auto 12px; max-width: 680px; }
        .actions { display: flex; justify-content: center; align-items: center; gap: 12px; }
        .primary { background: #6f7dff; color: #fff; border: 0; border-radius: 10px; padding: 12px 16px; font-weight: 700; cursor: pointer; }
        .primary:hover { filter: brightness(1.08); }
        .ghost { background: transparent; color: #c7d2fe; border: 1px solid #394075; border-radius: 10px; padding: 12px 16px; cursor: pointer; }
        .ghost:hover { background: #1b2146; }
        .timer { font-variant-numeric: tabular-nums; padding: 8px 10px; border-radius: 10px; border: 1px dashed #394075; color: #c7d2fe; }
        .timer.on { border-style: solid; }

        .main { display: grid; gap: 20px; }
        .card { background: #121633; border: 1px solid #262c58; border-radius: 16px; padding: 18px; }
        .card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .grow { flex: 1; }
        .chip { font-size: 12px; border-radius: 999px; padding: 6px 10px; background: #212755; color: #c7d2fe; border: 1px solid #394075; }
        .chip.mono { font-variant-numeric: tabular-nums; }
        .chip.score { background: transparent; border-color: transparent; padding-left: 0; color: inherit; }
        .label { display: block; margin-top: 12px; margin-bottom: 6px; color: #aab2c3; }
        .input { width: 100%; padding: 12px; border-radius: 12px; background: #0c1028; border: 1px solid #37406d; color: #e8ecf1; }
        .row { display: flex; gap: 10px; margin-top: 12px; }

        .question { background: #0c1028; border: 1px solid #37406d; padding: 14px; border-radius: 12px; white-space: pre-wrap; }
        .result { margin-top: 12px; border-radius: 12px; padding: 12px; border: 1px solid; }
        .result .result-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .score-num { margin-left: auto; font-variant-numeric: tabular-nums; color: #aab2c3; }
        .feedback { color: #e8ecf1; margin-bottom: 6px; }
        .canonical { color: #cdd6f4; }
        .muted { color: #98a1b3; }

        /* Цветовые состояния */
        .success { border-color: #1dd18a; background: rgba(29,209,138,0.08); }
        .good { border-color: #5ad67e; background: rgba(90,214,126,0.08); }
        .fair { border-color: #e8c450; background: rgba(232,196,80,0.08); }
        .weak { border-color: #f59e0b; background: rgba(245,158,11,0.08); }
        .error { border-color: #ef4444; background: rgba(239,68,68,0.08); }

        .empty { text-align: center; color: #98a1b3; padding: 24px; border: 1px dashed #2b315c; border-radius: 16px; }
        .history { margin-top: 8px; }
        .history h2 { margin: 0 0 10px 2px; font-size: 20px; }
        .history-item { background: #121633; border: 1px solid #262c58; border-radius: 16px; padding: 14px 16px; margin-bottom: 12px; }
        .history-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .history-row { margin: 4px 0; }
        .hint { background: #212755; border-color: #394075; color: #c7d2fe; }
      `}</style>
    </div>
  );
}
