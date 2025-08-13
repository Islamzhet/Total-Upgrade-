// pages/api/evaluate.js
import { OpenAI } from "openai";
import canon from "../../data/canon-answers.json";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Простая нормализация текста
function norm(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[«»"()[],.!?:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { question = "", answer = "", topic = "Общее", canonicalFromPdf = "" } = req.body || {};
    const topics = canon[topic] ? [topic] : Object.keys(canon);

    // Ищем канонический ответ в базе
    let canonicalAnswer = "";
    for (const tp of topics) {
      const qa = canon[tp]?.qa || [];
      const hit = qa.find((x) => norm(x.q) === norm(question));
      if (hit) {
        canonicalAnswer = hit.a;
        break;
      }
    }
    // Fallback на канон из PDF, если передан
    if (!canonicalAnswer && canonicalFromPdf) {
      canonicalAnswer = canonicalFromPdf;
    }
    // Если ничего — дефолт
    if (!canonicalAnswer) {
      canonicalAnswer = canon["Общее"].qa[0]?.a || "Канонический ответ не найден.";
    }

    // Семантическая оценка с OpenAI
    const prompt = `
Ты эксперт по авиации и авиадиспетчерам. Оцени ответ пользователя на соответствие каноническому.
Вопрос: ${question}
Канонический ответ: ${canonicalAnswer}
Ответ пользователя: ${answer}

Верни JSON: { "score": число от 0 до 1 (1=идеально, 0=неверно), "feedback": короткий текст с объяснением }
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    const score = result.score || 0;
    const feedback = result.feedback || "Оценка не удалась.";

    return res.status(200).json({
      score,
      feedback,
      canonicalAnswer,
      matchedAs: answer,
    });
  } catch (e) {
    console.error("evaluate error:", e);
    return res.status(500).json({ error: "Evaluation failed" });
  }
}
