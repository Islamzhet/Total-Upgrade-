import { useState, useEffect } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState([]);

  const generateQuestion = async () => {
    const res = await fetch("/api/question");
    const data = await res.json();
    setQuestion(data.question);
    setAnswer("");
    setResult("");
  };

  const evaluateAnswer = async () => {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    const data = await res.json();
    setResult(data.result);

    const score = parseScore(data.result);
    saveAttempt(question, answer, score);
    loadHistory();
  };

  const parseScore = (text) => {
    if (text.includes("1.0")) return 1;
    if (text.includes("0.75")) return 0.75;
    if (text.includes("0.5")) return 0.5;
    return 0;
  };

  const saveAttempt = (question, answer, evaluation) => {
    const data = localStorage.getItem("testResults");
    const parsed = data ? JSON.parse(data) : { attempts: [] };

    parsed.attempts.push({
      date: new Date().toISOString(),
      score: evaluation,
      question,
      answer,
    });

    localStorage.setItem("testResults", JSON.stringify(parsed));
  };

  const loadHistory = () => {
    const data = localStorage.getItem("testResults");
    if (!data) return;
    const parsed = JSON.parse(data);
    setHistory(parsed.attempts.reverse().slice(0, 5));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Upgrade Your Knowledge</h1>
      <button onClick={generateQuestion}>Сгенерировать вопрос</button>
      <div style={{ margin: "20px 0", fontWeight: "bold" }}>{question}</div>
      <textarea
        rows={4}
        cols={50}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Введите ответ..."
      />
      <br />
      <button onClick={evaluateAnswer} style={{ marginTop: 10 }}>
        Оценить
      </button>
      <div style={{ marginTop: 20 }}>
        <strong>Оценка:</strong> {result}
      </div>

      <div style={{ marginTop: 40 }}>
        <h3>Последние ответы:</h3>
        <ul>
          {history.map((h, i) => (
            <li key={i}>
              <strong>{new Date(h.date).toLocaleString()}</strong>: {h.score} — {h.question}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
