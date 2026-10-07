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

function parseIndexList(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) return uniqueSortedIndexes(raw.flatMap(parseIndexList));
  if (typeof raw === "number") return uniqueSortedIndexes([raw]);
  const text = String(raw).trim();
  if (!text) return [];
  if (/^\d+$/.test(text)) return uniqueSortedIndexes([Number(text)]);
  const parts = text
    .split(/[,，、/|;]+/)
    .map((part) => part.replace(/번/g, "").trim())
    .filter((part) => /^\d+$/.test(part))
    .map(Number);
  return uniqueSortedIndexes(parts.length ? parts : [text]);
}

function mcqAnswerIndexes(question) {
  if (!question) return [];
  return parseIndexList(question.answer);
}

function selectedMcqIndexes(selected) {
  return parseIndexList(selected);
}

function looksLikeMultiQuestion(question) {
  const text = `${(question && question.q) || ""} ${(question && question.explain) || ""}`;
  return /(모두\s*(고르|고른|선택)|해당되는\s*것을?\s*모두|옳은\s*것(?:을|만)?\s*모두|있는\s*대로|복수\s*(정답|응답|선택))/.test(text);
}

function isMultiMcq(question) {
  return !isShortQuestion(question) && (mcqAnswerIndexes(question).length > 1 || Boolean(question && question.multi) || looksLikeMultiQuestion(question));
}

function questionAllowsMulti(question) {
  return !isShortQuestion(question);
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
  questionAllowsMulti,
  looksLikeMultiQuestion,
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
