export default function handler(req, res) {
  const questions = [
    "Объясните принцип работы вторичного радиолокатора.",
    "Что такое эшелон перехода и как он определяется?",
    "Каковы основные обязанности диспетчера Круга?",
    "Какие элементы входят в структуру ATIS-сообщения?",
    "Опишите действия при отказе радиосвязи в районе ожидания."
  ];
  const question = questions[Math.floor(Math.random() * questions.length)];
  res.status(200).json({ question });
}