// pages/api/generate-question.js
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Распределения сложности по уровням
// (инструктор — самые сложные, КРС — чуть легче)
const MIX = {
  trainee:    ["easy", "easy", "easy", "medium", "medium", "hard"],
  controller: ["easy", "medium", "medium", "medium", "hard", "hard"],
  instructor: ["medium", "medium", "hard", "hard", "hard", "hard"],
  krs:        ["easy", "medium", "medium", "hard", "hard", "hard"],
};

function pickDifficulty(level) {
  const pool = MIX[level] || MIX.trainee;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default async function handler(req, res) {
  try {
    const isPost = req.method === "POST";
    const { subject = "ОВД", level = "trainee" } = isPost ? req.body : req.query;

    const difficulty = pickDifficulty(level);

    const userPrompt = `
Ты — строгий генератор экзаменационных вопросов по авиации.
Задача: выдать ровно ОДИН вопрос.
Тема: ${subject}.
Сложность: ${difficulty} (easy/medium/hard).
Требования:
- Без ответа и подсказок.
- Без префиксов "Вопрос:" и т.п.
- Коротко и по делу (1–2 предложения).
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",        // если нет доступа — поставь "gpt-4o-mini" или "gpt-3.5-turbo"
      temperature: 0.7,
      messages: [
        { role: "system", content: "Генерируешь вопросы по авиации для тестов." },
        { role: "user", content: userPrompt },
      ],
    });

    const question =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Не удалось сгенерировать вопрос";

    res.status(200).json({ question, difficulty, subject, level });
  } catch (err) {
    console.error("OpenAI error:", err);
    res
      .status(err.status || 500)
      .json({ question: "Ошибка генерации вопроса", error: String(err) });
  }
}
