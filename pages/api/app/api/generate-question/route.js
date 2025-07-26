// app/api/generate-question/route.js

export async function GET() {
  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "Ты генератор тестовых вопросов для авиадиспетчеров." },
          { role: "user", content: "Сгенерируй один короткий и точный вопрос по авиационной метеорологии." }
        ],
      }),
    });

    const data = await completion.json();
    const question = data.choices?.[0]?.message?.content?.trim();

    return Response.json({ question });
  } catch (error) {
    console.error("Ошибка при генерации вопроса:", error);
    return Response.json({ question: "Ошибка генерации вопроса" });
  }
}