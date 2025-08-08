// /pages/api/evaluate.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Безопасный парсер JSON (на случай, если модель вернёт текст вокруг JSON)
function safeParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(text.slice(start, end + 1));
      }
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { question, answer } = req.body || {};
  if (!question || !answer) {
    return res.status(400).json({ error: "question and answer are required" });
  }

  try {
    const systemPrompt = `
Ты — экзаменатор авиадиспетчеров. Оцени ответ кратко и структурировано.

Правила:
- Нормализуй числительные и единицы: "тысяча футов", "1000 футов", "A010" — эквивалент.
- "A010" = 1000 футов, "A119" = 11900 футов, "F120" = 12000 футов, и т. д. (Fxxx — эшелон).
- Игнорируй мелкие опечатки, если смысл однозначен.
- Если вопрос предполагает несколько элементов ответа — оцени полноту.
- Шкала score: 
  1.0 — полностью верно и терминологически корректно; 
  0.75 — верно, но упрощённо/неполно; 
  0.5 — частично; 
  0.25 — сильно неполно; 
  0.0 — неверно/вне темы.

Верни СТРОГО JSON следующей формы (без пояснений вне JSON):
{
  "score": <число 0..1>,
  "feedback": "<1-2 коротких предложения по-русски>",
  "canonicalAnswer": "<канонический правильный ответ>",
  "matchedAs": "<как интерпретирован ответ пользователя после нормализации>"
}
`.trim();

    const userPrompt = `
Вопрос: ${question}
Ответ пользователя: ${answer}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // можно заменить на "gpt-4o"
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "";
    const parsed = safeParseJSON(content);

    // Фолбэк, если по какой-то причине JSON не распарсился
    let score = 0;
    let feedback = "Не удалось получить структурированный ответ от модели.";
    let canonicalAnswer = "";
    let matchedAs = "";

    if (parsed && typeof parsed === "object") {
      score = Math.max(0, Math.min(1, Number(parsed.score ?? 0)));
      feedback = String(parsed.feedback ?? "").trim();
      canonicalAnswer = String(parsed.canonicalAnswer ?? "").trim();
      matchedAs = String(parsed.matchedAs ?? "").trim();
    }

    return res.status(200).json({
      score,
      feedback,
      canonicalAnswer,
      matchedAs,
      raw: content, // на всякий случай (можно убрать)
    });
  } catch (err) {
    console.error("OpenAI evaluate error:", err);
    return res.status(500).json({ error: "Evaluation failed" });
  }
}
