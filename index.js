import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState("");

  const generateQuestion = async () => {
    const res = await fetch("/api/question");
    const data = await res.json();
    setQuestion(data.question);
  };

  const evaluateAnswer = async () => {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer }),
    });
    const data = await res.json();
    setResult(data.result);
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Upgrade Your Knowledge</h1>
      <button onClick={generateQuestion}>Сгенерировать вопрос</button>
      <div style={{ margin: "20px 0" }}>{question}</div>
      <textarea
        rows={5}
        cols={50}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Ваш ответ..."
      />
      <br />
      <button onClick={evaluateAnswer}>Оценить</button>
      <div style={{ marginTop: 20 }}><strong>Оценка:</strong> {result}</div>
    </div>
  );
}
