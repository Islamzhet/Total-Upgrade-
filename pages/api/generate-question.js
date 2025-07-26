// pages/api/generate-question.js
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", // или "gpt-3.5-turbo" если нет доступа к 4o
      messages: [
        {
          role: "system",
          content: "Ты генератор тестовых вопросов по авиации. Выдавай только один вопрос.",
        },
        {
          role: "user",
          content: "Сгенерируй один вопрос по теме ОВД.",
        },
      ],
      temperature: 0.7,
    });

    const question = completion.choices?.[0]?.message?.content?.trim() || "Ошибка";
    res.status(200).json({ question });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ question: "Ошибка генерации вопроса" });
  }
}