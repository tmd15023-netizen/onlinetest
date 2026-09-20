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

function uniqueSortedIndexes(list) {
  return [...new Set((list || []).map(Number).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b);
}

function mcqAnswerIndexes(question) {
  if (!question) return [];
  return uniqueSortedIndexes(Array.isArray(question.answer) ? question.answer : [question.answer]);
}

function selectedMcqIndexes(selected) {
  if (Array.isArray(selected)) return uniqueSortedIndexes(selected);
  if (selected == null || selected === "") return [];
  return uniqueSortedIndexes([selected]);
}

function isMultiMcq(question) {
  return !isShortQuestion(question) && mcqAnswerIndexes(question).length > 1;
}

function normalizeMcqAnswer(raw, choiceCount) {
  const max = Number.isFinite(Number(choiceCount)) && Number(choiceCount) > 0 ? Number(choiceCount) : 99;
  const indexes = uniqueSortedIndexes(Array.isArray(raw) ? raw : [raw]).filter((n) => n < max);
  if (!indexes.length) return null;
  return indexes.length === 1 ? indexes[0] : indexes;
}

function sameIndexSet(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, idx) => value === right[idx]);
}

function formatMcqAnswerText(question, picked) {
  const indexes = picked || mcqAnswerIndexes(question);
  const choices = (question && question.choices) || [];
  if (!indexes.length) return "";
  return indexes.map((idx) => `${idx + 1}번${choices[idx] ? ` · ${choices[idx]}` : ""}`).join(", ");
}

function hasQuestionResponse(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function gradeQuestion(question, selected) {
  if (isShortQuestion(question)) {
    const got = normalizeShortAnswer(selected);
    if (!got) return false;
    const keys = splitShortAnswers(question.answer);
    return keys.includes(got);
  }
  return sameIndexSet(mcqAnswerIndexes(question), selectedMcqIndexes(selected));
}

const QuestionUtil = {
  isShortQuestion,
  normalizeShortAnswer,
  gradeQuestion,
  mcqAnswerIndexes,
  selectedMcqIndexes,
  isMultiMcq,
  normalizeMcqAnswer,
  formatMcqAnswerText,
  hasQuestionResponse,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = QuestionUtil;
}
if (typeof window !== "undefined") {
  Object.assign(window, QuestionUtil);
}
