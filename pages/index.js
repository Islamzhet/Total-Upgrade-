import { useState, useEffect } from 'react';

export default function Home() {
  const [step, setStep] = useState('welcome');
  const [role, setRole] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const [history, setHistory] = useState([]);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let timer;
    if (question) {
      timer = setInterval(() => setSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [question]);

  const subjects = ['ОВД', 'ЛТХ самолётов', 'Навигация', 'Метео', 'ЭРТОС'];
  const levels = ['Диспетчер-стажер', 'Диспетчер', 'Диспетчер-инструктор', 'КРС'];

  const generateQuestion = async () => {
    const res = await fetch('/api/generate-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, level })
    });
    const data = await res.json();
    setQuestion(data.question);
    setAnswer('');
    setEvaluation('');
    setSeconds(0);
  };

  const evaluateAnswer = async () => {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, answer })
    });
    const data = await res.json();
    setEvaluation(data.evaluation);
    setHistory([{ question, answer, evaluation: data.evaluation, time: seconds }, ...history]);
  };

  return (
    <div className="container">
      <div className="card">
        {step === 'welcome' && (
          <>
            <h1>Добрый день!</h1>
            <p>Давай пройдем тест. Для начала укажи свою должность:</p>
            <input
              placeholder="Например: диспетчер РДЦ"
              value={role}
              onChange={e => setRole(e.target.value)}
            />
            <button disabled={!role.trim()} onClick={() => setStep('subject')}>
              Далее
            </button>
          </>
        )}

        {step === 'subject' && (
          <>
            <h2>Выбери предмет</h2>
            <div className="grid">
              {subjects.map(s => (
                <div key={s} className="option" onClick={() => { setSubject(s); setStep('level'); }}>
                  {s}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'level' && (
          <>
            <h2>Выбери уровень сложности</h2>
            <div className="grid">
              {levels.map(l => (
                <div key={l} className="option" onClick={() => { setLevel(l); setStep('question'); generateQuestion(); }}>
                  {l}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'question' && question && (
          <>
            <h3>Вопрос:</h3>
            <div className="question-box">{question}</div>
            <div className="timer">⏱ {seconds} сек.</div>

            <input
              placeholder="Твой ответ..."
              value={answer}
              onChange={e => setAnswer(e.target.value)}
            />
            <button onClick={evaluateAnswer}>Оценить</button>

            {evaluation && (
              <div className="evaluation">
                <strong>Оценка:</strong> {evaluation}
              </div>
            )}

            <button onClick={generateQuestion} style={{ background: '#34a853' }}>
              Следующий вопрос
            </button>
          </>
        )}

        {history.length > 0 && (
          <div className="history">
            <h3>История:</h3>
            {history.map((item, i) => (
              <div key={i} className="history-entry">
                <p><strong>Вопрос:</strong> {item.question}</p>
                <p><strong>Ответ:</strong> {item.answer}</p>
                <p><strong>Оценка:</strong> {item.evaluation}</p>
                <p><strong>Время:</strong> {item.time} сек.</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .container {
          background: #f0f2f5;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 600px;
        }
        h1, h2, h3 {
          text-align: center;
        }
        input {
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
          margin-top: 10px;
        }
        button {
          margin-top: 15px;
          width: 100%;
          padding: 12px;
          background: #1a73e8;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
        }
        button:hover {
          background: #1558c0;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 20px;
        }
        .option {
          background: #f9f9f9;
          padding: 15px;
          text-align: center;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.3s;
        }
        .option:hover {
          background: #e0e0e0;
        }
        .question-box {
          background: #f1f5f9;
          padding: 15px;
          border-radius: 8px;
          margin-top: 10px;
        }
        .timer {
          text-align: right;
          margin-top: 5px;
          font-size: 14px;
          color: #555;
        }
        .history {
          margin-top: 30px;
        }
        .history-entry {
          background: #fafafa;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 10px;
        }
        .evaluation {
          margin-top: 10px;
          font-size: 16px;
          background: #e8f0fe;
          padding: 10px;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
