// /pages/api/evaluate.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({ error: 'Missing question or answer' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Ты эксперт по тестированию авиадиспетчеров. 
          Оцени ответ ученика по 4-балльной шкале:
          1.0 — Полный и точный ответ, правильная терминология.
          0.75 — Почти полный ответ, но не охватывает весь смысл.
          0.5 — Частичный ответ, суть есть, но неполный или неточный.
          0.0 — Нет сути или терминология неверная.
          
          Учитывай разные формулировки, синонимы, числа в разных форматах (например, "1000 футов" = "тысяча футов" = "1 000 ft").
          Игнорируй мелкие орфографические ошибки.`
        },
        {
          role: "user",
          content: `Вопрос: ${question}\nОтвет ученика: ${answer}`
        }
      ],
      temperature: 0
    });

    const evaluation = completion.choices[0].message.content.trim();
    res.status(200).json({ evaluation });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при оценке ответа' });
  }
}
