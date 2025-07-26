import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: "Missing question or answer" });
  }

  try {
    const systemPrompt = `
Ты выступаешь как экзаменатор. Оценивай ответ пользователя на вопрос строго по 4-балльной шкале:
1.0 — Демонстрирует знание (полный, точный ответ с терминологией)
0.75 — Почти полный ответ, есть терминология, но не охватывает весь смысл
0.5 — Частично демонстрирует (суть затронута, но неполная или нечеткая формулировка)
0.0 — Не демонстрирует знание (нет сути, термины перепутаны или отсутствуют)

Выводи только число (одну строку) — без пояснений, текста и слов.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // Или gpt-3.5-turbo
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Вопрос: ${question}\nОтвет: ${answer}` }
      ],
      temperature: 0
    });

    const grade = completion.choices[0].message.content.trim();

    res.status(200).json({ evaluation: grade });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: "Failed to evaluate answer" });
  }
}
