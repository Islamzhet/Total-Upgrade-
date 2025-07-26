export default async function handler(req, res) {
  const { question = "Заглушка", answer } = req.body;

  const completion = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Ты эксперт по подготовке авиадиспетчеров. Оцени ответ пользователя по шкале: 1.0 — демонстрирует знание, 0.75 — почти полный ответ, 0.5 — частично, 0.0 — не демонстрирует.",
        },
        {
          role: "user",
          content: `Вопрос: ${question}\nОтвет: ${answer}\nПоставь только оценку и короткое объяснение.`,
        },
      ],
    }),
  });

  const data = await completion.json();
  const content = data.choices?.[0]?.message?.content || "Ошибка";

  // Парсим оценку и комментарий (например: "Оценка: 1.0\nКомментарий: хороший ответ.")
  const scoreMatch = content.match(/([01](?:\.0|\.25|\.5|\.75)?)/);
  const feedbackMatch = content.replace(scoreMatch?.[0], '').trim();

  res.status(200).json({
    score: scoreMatch ? parseFloat(scoreMatch[0]) : null,
    feedback: feedbackMatch || "Нет комментария",
  });
}