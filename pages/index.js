"use client";

import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState("");
  const [history, setHistory] = useState([]);

  const generateQuestion = async () => {
    const res = await fetch("/api/generate-question");
    const data = await res.json();
    setQuestion(data.question.trim());
    setAnswer("");
    setResult("");
  };

  const evaluateAnswer = async () => {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, answer }),
    });

    const data = await res.json();
    setResult(data.result);
    setHistory([{ question, answer, result: data.result }, ...history]);
  };

  return (
    <main style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
      <h1>Upgrade Your Knowledge</h1>
      <button onClick={generateQuestion}>Сгенерировать вопрос</button>

      <div style={{ marginTop: "20px" }}>
        <strong>Вопрос:</strong>
        <div style={{ margin: "8px 0", background: "#f5f5f5", padding: "10px" }}>
          {question || "Нажмите кнопку для генерации вопроса"}
        </div>

        <label>
          Ответ на вопрос:
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            style={{ width: "100%", marginTop: "8px", padding: "6px" }}
          />
        </label>

        <button onClick={evaluateAnswer} style={{ marginTop: "10px" }}>
          Оценить
        </button>

        <div style={{ marginTop: "20px" }}>
          <strong>Оценка:</strong> {result}
        </div>
      </div>

      <div style={{ marginTop: "40px" }}>
        <h3>Последние ответы:</h3>
        {history.map((item, idx) => (
          <div key={idx} style={{ marginBottom: "20px" }}>
            <div><strong>Вопрос:</strong> {item.question}</div>
            <div><strong>Ответ:</strong> {item.answer}</div>
            <div><strong>Оценка:</strong> {item.result}</div>
            <hr />
          </div>
        ))}
      </div>
    </main>
  );
}