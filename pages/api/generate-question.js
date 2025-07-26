export default async function handler(req, res) {
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
          content: "Ты генератор тестовых вопросов для подготовки авиадиспетчеров. Сгенерируй один вопрос.",
        },
        {
          role: "user",
          content: "Сгенерируй вопрос по авиационной метеорологии.",
        },
      ],
    }),
  });

  const data = await completion.json();
  const question = data.choices?.[0]?.message?.content || "Ошибка генерации вопроса";

  res.status(200).json({ question });
}