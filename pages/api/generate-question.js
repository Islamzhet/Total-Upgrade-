// pages/api/generate-question.js
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Вероятностный микс сложностей (инструктор — тяжелее всех)
const MIX = {
  trainee:    ["easy", "easy", "easy", "medium", "medium", "hard"],
  controller: ["easy", "medium", "medium", "medium", "hard", "hard"],
  instructor: ["medium", "hard", "hard", "hard", "hard", "hard"],
  krs:        ["easy", "medium", "medium", "hard", "hard", "hard"],
};

function pickDifficulty(role) {
  const pool = MIX[role] || MIX.trainee;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { role = "trainee", ratings = [] } = req.body || {};
    const difficulty = pickDifficulty(role);

    // Человекочитаемые фразы для рейтингов
    const ratingsLine = Array.isArray(ratings) && ratings.length
      ? ratings.join(", ")
      : "без указания рейтингов";

    const prompt = `
Ты генератор экзаменационных вопросов в авиации для тренажёрного теста.

Сформируй ОДИН чёткий вопрос по тематике, соответствующей этим рейтингам: ${ratingsLine}.
Уровень сложности: ${difficulty} (easy/medium/hard).

Требования:
- Вопрос без ответа и без подсказок.
- Коротко и по делу (1–2 предложения).
- Без префиксов и нумерации, просто текст вопроса.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // можно gpt-4o-mini / gpt-3.5-turbo при желании
      temperature: 0.7,
      messages: [
        { role: "system", content: "Ты строго формулируешь вопросы для теста." },
        { role: "user", content: prompt },
      ],
    });

    const question =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Не удалось сгенерировать вопрос";

    return res.status(200).json({ question, difficulty, role, ratings });
  } catch (error) {
    console.error("generate-question error:", error);
    return res.status(500).json({ question: "Ошибка генерации вопроса" });
  }
}
