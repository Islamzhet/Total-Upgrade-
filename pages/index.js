import { useState } from 'react';

export default function Home() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const [history, setHistory] = useState([]);

  const generateQuestion = async () => {
    const res = await fetch('/api/generate-question');
    const data = await res.json();
    setQuestion(data.question);
    setAnswer('');
    setEvaluation('');
  };

  const evaluateAnswer = async () => {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer })
    });
    const data = await res.json();
    setEvaluation(data.evaluation);
    setHistory([{ question, answer, evaluation }, ...history]);
  };

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20, fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold' }}>Upgrade Your Knowledge</h1>
      <button onClick={generateQuestion}>Сгенерировать вопрос</button>

      {question && (
        <div style={{ marginTop: 20 }}>
          <h3>Вопрос:</h3>
          <div style={{ background: '#f9f9f9', padding: 10 }}>{question}</div>

          <label style={{ display: 'block', marginTop: 10 }}>Ответ на вопрос:</label>
          <input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            style={{ width: '100%', padding: 10 }}
          />

          <button onClick={evaluateAnswer} style={{ marginTop: 10 }}>
            Оценить
          </button>

          {evaluation && (
            <div style={{ marginTop: 10 }}>
              <strong>Оценка:</strong> {evaluation}
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2>Последние ответы:</h2>
          {history.map((item, i) => (
            <div key={i} style={{ marginBottom: 20, borderTop: '1px solid #ccc', paddingTop: 10 }}>
              <p><strong>Вопрос:</strong> {item.question}</p>
              <p><strong>Ответ:</strong> {item.answer}</p>
              <p><strong>Оценка:</strong> {item.evaluation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
