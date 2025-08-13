// pages/api/generate-question.js
import { OpenAI } from "openai";
import fs from 'fs';
import pdfParse from 'pdf-parse';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Вероятностный микс сложностей (инструктор — тяжелее всех)
const MIX = {
  trainee: ["easy", "easy", "easy", "medium", "medium", "hard"],
  controller: ["easy", "medium", "medium", "medium", "hard", "hard"],
  instructor: ["medium", "hard", "hard", "hard", "hard", "hard"],
  krs: ["easy", "medium", "medium", "hard", "hard", "hard"],
};

function pickDifficulty(role) {
  const pool = MIX[role] || MIX.trainee;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Список твоих PDF-файлов (добавь все 7-8 в папку /data/pdfs/)
const PDF_FILES = [
  'data/pdfs/v1000006635.24-02-2023.rus.pdf', // Этот файл
  // Добавь другие, например: 'data/pdfs/doc2.pdf', 'data/pdfs/doc3.pdf' и т.д.
];

// Улучшенная функция извлечения текста из PDF (ищет по ключевым словам для авиадиспетчеров)
async function extractRelevantText(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const fullText = data.text.toLowerCase();
    
    // Ключевые слова из анализа PDF (фразеология, радиообмен, ОВД и т.д.)
    const keywords = ['фразеология', 'радиообмен', 'диспетчер', 'овд', 'авиадиспетчер', 'разрешение', 'запрос', 'экипаж', 'vs', 'atc'];
    let relevant = '';
    keywords.forEach(kw => {
      const regex = new RegExp(`.{0,1000}${kw}.{0,1000}`, 'gi'); // Больше контекста вокруг слова
      const matches = fullText.match(regex) || [];
      relevant += matches.join(' ').slice(0, 4000); // Ограничим для OpenAI (max ~4000 символов)
    });
    
    return relevant || fullText.slice(0, 4000); // Fallback на начало PDF, если ничего не найдено
  } catch (err) {
    console.error('PDF parse error:', err);
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { role = "trainee", ratings = [] } = req.body || {};
    const difficulty = pickDifficulty(role);

    // Выбор случайного PDF из списка
    const randomPdf = PDF_FILES[Math.floor(Math.random() * PDF_FILES.length)];
    const relevantText = await extractRelevantText(randomPdf);

    let question = 'Не удалось сгенерировать вопрос из PDF';
    let canonicalAnswer = 'Канонический ответ не найден';
    let topic = 'Фразеология радиообмена'; // По умолчанию, можно адаптировать по PDF

    if (relevantText) {
      const prompt = `
Ты эксперт по авиадиспетчерам и фразеологии радиообмена. На основе этого текста из документа: "${relevantText}"
Сгенерируй ОДИН вопрос уровня ${difficulty} для теста знаний авиадиспетчеров.
Вопрос должен быть релевантным фразеологии, радиообмену или процедурам ОВД.
Верни JSON: { "question": "текст вопроса", "canonicalAnswer": "канонический ответ из текста (коротко, на основе документа)" }
      `.trim();
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Дешёвый и быстрый модель
        temperature: 0.7,
        messages: [{ role: "system", content: "Генерируй вопросы строго по тексту, без выдумок." }, { role: "user", content: prompt }],
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      question = result.question || question;
      canonicalAnswer = result.canonicalAnswer || canonicalAnswer;
    } else {
      // Fallback на старую логику генерации (без PDF, как в твоём оригинальном коде)
      const ratingsLine = Array.isArray(ratings) && ratings.length ? ratings.join(", ") : "без указания рейтингов";
      const fallbackPrompt = `
Ты генератор экзаменационных вопросов в авиации для тренажёрного теста.
Сформируй ОДИН чёткий вопрос по тематике, соответствующей этим рейтингам: ${ratingsLine}.
Уровень сложности: ${difficulty} (easy/medium/hard).
Требования: Вопрос без ответа и без подсказок. Коротко и по делу (1–2 предложения). Без префиксов и нумерации.
Верни JSON: { "question": "текст вопроса", "canonicalAnswer": "канонический ответ (придумай на основе знаний)" }
      `.trim();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [{ role: "system", content: "Ты строго формулируешь вопросы для теста." }, { role: "user", content: fallbackPrompt }],
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      question = result.question || question;
      canonicalAnswer = result.canonicalAnswer || canonicalAnswer;
    }

    return res.status(200).json({ question, difficulty, topic, canonicalAnswer, role, ratings });
  } catch (error) {
    console.error("generate-question error:", error);
    return res.status(500).json({ error: "Ошибка генерации вопроса" });
  }
}
