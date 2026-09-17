function escapeNoticeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function noticePlainText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function noticeAlignFrom(attrs) {
  const src = String(attrs || "");
  const style = /text-align\s*:\s*(left|center|right|justify)/i.exec(src);
  if (style) return style[1].toLowerCase();
  const attr = /\balign\s*=\s*["']?(left|center|right|justify)/i.exec(src);
  return attr ? attr[1].toLowerCase() : "";
}

function noticeWeightFrom(attrs) {
  const src = String(attrs || "");
  const style = /font-weight\s*:\s*(bold|bolder|[5-9]00)/i.exec(src);
  if (!style) return "";
  return /bold/i.test(style[1]) ? "700" : style[1];
}

function sanitizeNoticeHtml(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    return escapeNoticeText(raw).replace(/\r\n|\n|\r/g, "<br>");
  }
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  const allowed = { p: true, br: true, div: true, span: true, b: true, strong: true, i: true, em: true };
  return cleaned.replace(/<\/?([a-z0-9]+)(\s[^>]*)?>/gi, (full, tag, attrs) => {
    const name = String(tag || "").toLowerCase();
    if (!allowed[name]) return "";
    if (name === "br") return "<br>";
    if (/^<\//.test(full)) return `</${name}>`;
    const styles = [];
    const align = noticeAlignFrom(attrs);
    const weight = noticeWeightFrom(attrs);
    if (align) styles.push(`text-align:${align}`);
    if (weight) styles.push(`font-weight:${weight}`);
    if ((name === "b" || name === "strong") && !weight) styles.push("font-weight:700");
    return styles.length ? `<${name} style="${styles.join(";")}">` : `<${name}>`;
  });
}

function noticeToEditorHtml(body) {
  return sanitizeNoticeHtml(body);
}

const NoticeFormat = { escapeNoticeText, noticePlainText, sanitizeNoticeHtml, noticeToEditorHtml };

if (typeof module !== "undefined" && module.exports) {
  module.exports = NoticeFormat;
}
if (typeof window !== "undefined") {
  window.NoticeFormat = NoticeFormat;
}
