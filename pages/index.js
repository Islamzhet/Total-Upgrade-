import { useState } from 'react';

export default function Home() {
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    });
    const data = await res.json();
    setResult(data);
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial' }}>
      <h1>Upgrade Your Knowledge</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Ответ на вопрос:
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            style={{ marginLeft: 10, width: '300px' }}
          />
        </label>
        <button type="submit" style={{ marginLeft: 10 }}>Отправить</button>
      </form>
      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Результат:</h3>
          <p>Оценка: {result.score}</p>
          <p>Комментарий: {result.feedback}</p>
        </div>
      )}
    </div>
  );
}