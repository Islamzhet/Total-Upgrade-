// /pages/api/evaluate.js
import canon from "../../data/canon-answers.json";

// лёгкая нормализация текста (без ИИ)
function norm(s = "") {
  return String(s)
    .toLowerCase()
    .replace(/[«»"()[],.!?:;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// привести единицы
function unifyUnits(s = "") {
  return s
    .replace(/фут(ы|ов)?/g, "футов")
    .replace(/эшелон\s*/g, "f")
    .trim();
}

// «f120» или «120» как эшелон → футы
function echelonToFeet(text = "") {
  const m = text.match(/\bf?(\d{2,3})\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (Number.isNaN(n)) return null;
  return n * 100; // F120 = 120 * 100 = 12000 футов
}

// простейший выниматель чисел (1000, 12000)
function extractInt(text = "") {
  const n = parseInt(text.replace(/\s+/g, ""), 10);
  return Number.isNaN(n) ? null : n;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { question = "", answer = "", topic = "Общее" } = req.body || {};
    const topics = canon[topic] ? [topic] : Object.keys(canon);

    // ищем канонический ответ по вопросу в рамках темы (или всех тем)
    let canonicalAnswer = "";
    for (const tp of topics) {
      const qa = canon[tp]?.qa || [];
      const hit = qa.find((x) => norm(x.q) === norm(question));
      if (hit) {
        canonicalAnswer = hit.a;
        break;
      }
    }
    // если не нашли — мягкий фолбэк: берём первый из темы
    if (!canonicalAnswer) {
      const qa = canon[topic]?.qa || canon["Общее"].qa || [];
      canonicalAnswer = qa[0]?.a || "";
    }

    // нормализуем обе строки
    const userRaw = String(answer || "").trim();
    const userN = norm(unifyUnits(userRaw));
    const canonN = norm(unifyUnits(canonicalAnswer));

    // быстрые совпадения
    let score = 0;
    let feedback = "Ответ не соответствует канонической формулировке.";
    let matchedAs = userRaw;

    if (userN === canonN) {
      score = 1.0;
      feedback = "Точный канонический ответ.";
    } else {
      // числовая эквивалентность: «A010» ~ «1000 футов»; «F120» ~ «12000 футов»
      const aFeet = echelonToFeet(userN);
      const cFeet = echelonToFeet(canonN);
      const aNum = extractInt(userN);
      const cNum = extractInt(canonN);

      const hasFeetU = /футов/.test(userN);
      const hasFeetC = /футов/.test(canonN);

      let numericMatch = false;

      // если у канона есть число/футы — сравниваем по числам
      if (hasFeetC) {
        const uVal = aFeet || aNum;
        const cVal = cFeet || cNum;
        if (uVal != null && cVal != null) {
          if (Math.abs(uVal - cVal) <= 50) numericMatch = true; // допуск
        }
      }

      // синонимы
      const synGroups = [
        ["альтиметр", "высотомер", "altimeter"],
        ["анемометр", "скоростемер", "airspeed", "питот"]
      ];
      let synonymHit = false;
      for (const g of synGroups) {
        const hasU = g.some((t) => userN.includes(t));
        const hasC = g.some((t) => canonN.includes(t));
        if (hasU && hasC) { synonymHit = true; break; }
      }

      if (numericMatch || synonymHit) {
        score = numericMatch ? 1.0 : 0.75;
        feedback = numericMatch
          ? "Числовая эквивалентность засчитана как канон."
          : "Смысл верный, допускается синоним/вариант термина.";
      } else {
        // частично по ключевым словам
        const keys = canonN.split(" ").filter((w) => w.length > 4);
        const hits = keys.filter((w) => userN.includes(w)).length;
        if (hits >= 2) {
          score = 0.5;
          feedback = "Частично по смыслу, но неканонично и неполно.";
        }
      }
    }

    return res.status(200).json({
      score,
      feedback,
      canonicalAnswer,
      matchedAs,
    });
  } catch (e) {
    console.error("evaluate error:", e);
    return res.status(500).json({ error: "Evaluation failed" });
  }
}
