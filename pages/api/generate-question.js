export default async function handler(req, res) {
  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // или gpt-3.5-turbo, если gpt-4o недоступен
        messages: [
          {
            role: "system",
            content: "Ты генератор тестовых вопросов для авиадиспетчеров.",
          },
          {
            role: "user",
            content: "Сгенерируй один вопрос по теме авиационной метеорологии.",
          },
        ],
      }),
    });

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error("OpenAI API error:", errorText);
      return res.status(500).json({ question: "Ошибка генерации вопроса" });
    }

    const data = await completion.json();
    const question = data.choices?.[0]?.message?.content || "Ошибка генерации";
    res.status(200).json({ question });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ question: "Ошибка генерации вопроса" });
  }
}