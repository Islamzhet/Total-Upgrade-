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
  setHistory([{ question, answer, evaluation: data.evaluation }, ...history]);
};

  return (
    <div style={{ maxWidth: 800, margin: 'auto', padding: 20, fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold' }}>Upgrade Your Knowledge</h1>
      <button onClick={generateQuestion}>Сгенерировать вопрос</button>

      {question && (
        <div style={{ marginTop: 20 }}>
          <h3>Вопрос:</h3>
          <div className="question-box">{question}</div>

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
            <div key={i} className="history-entry"> }}>
              <p><strong>Вопрос:</strong> {item.question}</p>
              <p><strong>Ответ:</strong> {item.answer}</p>
              <p><strong>Оценка:</strong> {item.evaluation}</p>
            </div>
          ))}
        </div>
      )}
<style jsx>{`
  h1 {
    font-size: 36px;
    font-weight: bold;
    margin-bottom: 20px;
    text-align: center;
  }

  button {
    background-color: #1a73e8;
    color: white;
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    margin-top: 10px;
  }

  button:hover {
    background-color: #1558c0;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin-top: 4px;
    margin-bottom: 12px;
  }

  .question-box {
    background-color: #f1f5f9;
    padding: 16px;
    border-radius: 8px;
    margin-top: 10px;
    font-size: 16px;
  }

  .section {
    margin-top: 24px;
  }

  .history-entry {
    background: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 16px;
  }

  .label {
    font-weight: bold;
    margin-top: 12px;
    display: block;
  }

  strong {
    color: #111827;
  }
`}</style>

    </div>
  );
}
