function isShortQuestion(item) {
  if (!item) return false;
  if (item.type === "short" || item.type === "주관식" || item.type === "단답") return true;
  return !(item.choices && item.choices.length);
}

function normalizeShortAnswer(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[."""''`·・]/g, "")
    .toLowerCase();
}

function splitShortAnswers(value) {
  return String(value || "")
    .split(/\s*(?:,|，|、|\/|;|\||또는)\s*/)
    .map(normalizeShortAnswer)
    .filter(Boolean);
}

function gradeQuestion(question, selected) {
  if (isShortQuestion(question)) {
    const got = normalizeShortAnswer(selected);
    if (!got) return false;
    const keys = splitShortAnswers(question.answer);
    return keys.includes(got);
  }
  return selected === question.answer;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { isShortQuestion, normalizeShortAnswer, gradeQuestion };
}
if (typeof window !== "undefined") {
  window.isShortQuestion = isShortQuestion;
  window.normalizeShortAnswer = normalizeShortAnswer;
  window.gradeQuestion = gradeQuestion;
}
