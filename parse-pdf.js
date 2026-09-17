function holdInlineImages(raw) {
  const bank = [];
  const text = String(raw || "").replace(/<<IMG\s+([\s\S]*?)>>/g, (_, src) => {
    bank.push(String(src || "").trim());
    return `<<IMG ${bank.length - 1}>>`;
  });
  return { text, bank };
}

function extractInlineImages(value, imageBank) {
  const images = [];
  const text = String(value || "")
    .replace(/<<IMG\s+([\s\S]*?)>>/g, (_, src) => {
      const clean = String(src || "").trim();
      if (!clean) return " ";
      if (imageBank && /^\d+$/.test(clean)) {
        const real = imageBank[Number(clean)];
        if (real) images.push(real);
      } else {
        images.push(clean);
      }
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { text, images };
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtmlToText(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function relabelItemMarker(text) {
  const map = { "①": "ㄱ", "②": "ㄴ", "③": "ㄷ", "④": "ㄹ", "⑤": "ㅁ", "❶": "ㄱ", "❷": "ㄴ", "❸": "ㄷ", "❹": "ㄹ", "❺": "ㅁ" };
  return String(text || "").replace(/^\s*([①②③④⑤❶❷❸❹❺])\s*(?:[.．、.)）]|번)?\s*/, (_, mark) => `${map[mark] || mark}. `);
}

function wrapSvgLines(text, maxChars) {
  const chars = [...String(text || "")];
  const lines = [];
  let line = "";
  chars.forEach((ch) => {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      return;
    }
    if (line.length >= maxChars) {
      lines.push(line);
      line = ch;
    } else line += ch;
  });
  if (line || !lines.length) lines.push(line);
  return lines;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsToSvgDataUri(rows) {
  const packed = (rows || [])
    .map((row) => (Array.isArray(row) ? row.map((cell) => relabelItemMarker(String(cell || "").trim())) : [relabelItemMarker(String(row || "").trim())]))
    .filter((row) => row.some(Boolean));
  if (!packed.length) return "";
  const colCount = Math.max(...packed.map((row) => row.length), 1);
  const width = 760;
  const fontSize = 16;
  const lineH = 24;
  const padX = 14;
  const padY = 12;
  const colW =
    colCount === 1
      ? [width]
      : colCount === 2
        ? [72, width - 72]
        : Array.from({ length: colCount }, () => Math.floor(width / colCount));
  const maxChars = colW.map((w) => Math.max(6, Math.floor((w - padX * 2) / (fontSize * 0.95))));
  const drawn = packed.map((row) => row.map((cell, idx) => wrapSvgLines(cell, maxChars[idx] || 24)));
  const rowHeights = drawn.map((row) => Math.max(...row.map((lines) => lines.length * lineH), lineH) + padY * 2);
  const height = rowHeights.reduce((sum, h) => sum + h, 0) + 2;
  let y = 1;
  const shapes = packed
    .map((row, rIdx) => {
      const h = rowHeights[rIdx];
      let x = 1;
      const cells = row
        .map((_, cIdx) => {
          const w = colW[cIdx] || colW[colW.length - 1];
          const lines = drawn[rIdx][cIdx] || [""];
          const text = lines
            .map(
              (line, lineIdx) =>
                `<text x="${x + padX}" y="${y + padY + fontSize + lineIdx * lineH}" font-size="${fontSize}" font-family="Malgun Gothic, Apple SD Gothic Neo, Pretendard, sans-serif" fill="#1f2430">${escapeXml(line)}</text>`
            )
            .join("");
          const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#c5cedb"/>`;
          x += w;
          return rect + text;
        })
        .join("");
      y += h;
      return cells;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width + 2}" height="${height}" viewBox="0 0 ${width + 2} ${height}">${shapes}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function htmlTableToRows(tableHtml) {
  const rows = [];
  String(tableHtml || "").replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, rowHtml) => {
    const cells = [];
    String(rowHtml || "").replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi, (_, cellHtml) => {
      cells.push(stripHtmlToText(cellHtml));
      return "";
    });
    if (cells.length) rows.push(cells);
    return "";
  });
  return rows;
}

function extractHtmlTables(html) {
  const tables = [];
  let out = "";
  let i = 0;
  const src = String(html || "");
  const lower = src.toLowerCase();
  while (i < src.length) {
    const start = lower.indexOf("<table", i);
    if (start < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, start);
    let depth = 1;
    let pos = lower.indexOf(">", start) + 1;
    while (depth > 0 && pos > 0 && pos < src.length) {
      const nextOpen = lower.indexOf("<table", pos);
      const nextClose = lower.indexOf("</table>", pos);
      if (nextClose < 0) {
        pos = src.length;
        break;
      }
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 6;
      } else {
        depth -= 1;
        if (depth === 0) {
          tables.push(src.slice(start, nextClose + 8));
          out += `\n%%TABLE${tables.length - 1}%%\n`;
          pos = nextClose + 8;
          break;
        }
        pos = nextClose + 8;
      }
    }
    i = pos;
  }
  return { html: out, tables };
}

function htmlToParseText(html, options = {}) {
  const bank = [];
  const pushImg = (src) => {
    const clean = String(src || "").trim();
    if (!clean) return "";
    bank.push(clean);
    return `\n%%IMG${bank.length - 1}%%\n`;
  };
  const extracted = extractHtmlTables(String(html || "").replace(/\r/g, ""));
  let out = extracted.html;
  extracted.tables.forEach((tableHtml, idx) => {
    const rows = htmlTableToRows(tableHtml);
    if (options.tablesAsText) {
      const text = rows.map((row) => row.filter(Boolean).join(" ")).filter(Boolean).join("\n");
      out = out.replace(`%%TABLE${idx}%%`, text ? `\n${text}\n` : " ");
      return;
    }
    const innerImgs = [];
    String(tableHtml || "").replace(/<img\b[^>]*\bsrc\s*=\s*(["'])([\s\S]*?)\1[^>]*>/gi, (_, _q, src) => {
      innerImgs.push(String(src || "").trim());
      return "";
    });
    const svg = rowsToSvgDataUri(rows);
    const markers = [svg ? pushImg(svg) : "", ...innerImgs.map((src) => pushImg(src))].join("");
    out = out.replace(`%%TABLE${idx}%%`, markers || " ");
  });
  return out
    .replace(/<img\b[^>]*\bsrc\s*=\s*(["'])([\s\S]*?)\1[^>]*>/gi, (_, _quote, src) => pushImg(src))
    .replace(/<\/(p|div|h[1-6]|li|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/%%IMG(\d+)%%/g, (_, idx) => {
      const src = bank[Number(idx)] || "";
      return src ? `<<IMG ${src}>>` : "";
    });
}

function attachImagesToQuestion(question, stemRaw, choiceRaws, imageBank) {
  const stem = extractInlineImages(stemRaw, imageBank);
  question.q = stem.text || question.q;
  question.images = stem.images;
  if (Array.isArray(question.choices) && question.choices.length) {
    const packed = (choiceRaws || question.choices).map((choice) => extractInlineImages(choice, imageBank));
    question.choices = packed.map((item) => item.text);
    question.choiceImages = packed.map((item) => item.images);
  } else {
    question.choiceImages = [];
  }
  return question;
}

function normalizePdfText(raw) {
  return String(raw || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CHOICE_INDEX = {
  "①": 0,
  "②": 1,
  "③": 2,
  "④": 3,
  "⑤": 4,
  "❶": 0,
  "❷": 1,
  "❸": 2,
  "❹": 3,
  "❺": 4,
  "⑴": 0,
  "⑵": 1,
  "⑶": 2,
  "⑷": 3,
  "⑸": 4,
  가: 0,
  나: 1,
  다: 2,
  라: 3,
  마: 4,
  ㄱ: 0,
  ㄴ: 1,
  ㄷ: 2,
  ㄹ: 3,
  ㅁ: 4,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
};

const CHOICE_TOKEN = "①|②|③|④|⑤|❶|❷|❸|❹|❺|⑴|⑵|⑶|⑷|⑸";
const LETTER_TOKEN = "[가나다라마ㄱㄴㄷㄹㅁA-Ea-e]";

function tokenToChoiceIndex(token) {
  const t = String(token || "")
    .replace(/\s+/g, "")
    .replace(/[()[\]（）［］]/g, "")
    .replace(/번$/, "")
    .trim();
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(CHOICE_INDEX, t)) return CHOICE_INDEX[t];
  if (/^[1-5]$/.test(t)) return Number(t) - 1;
  return null;
}

function isComboChoice(text) {
  const t = String(text || "").replace(/\s+/g, "");
  return t.length > 0 && t.length <= 24 && /^[①②③④⑤ㄱㄴㄷㄹㅁ가나다라마,，./와과및~∼\-]+$/.test(t);
}

function normalizeComboToHangul(text) {
  return String(text || "")
    .replace(/①/g, "ㄱ")
    .replace(/②/g, "ㄴ")
    .replace(/③/g, "ㄷ")
    .replace(/④/g, "ㄹ")
    .replace(/⑤/g, "ㅁ");
}

function splitSequentialMarkers(body, markers) {
  const src = String(body || "");
  const hits = [];
  let expect = 0;
  for (let i = 0; i < src.length && expect < markers.length; i += 1) {
    if (src[i] !== markers[expect]) continue;
    const prev = src[i - 1] || "";
    const prev2 = src[i - 2] || "";
    if (/[,，/]/.test(prev) || (prev === " " && /[,，/]/.test(prev2))) continue;
    hits.push({ marker: src[i], at: i, label: markers[expect] });
    expect += 1;
  }
  if (hits.length < 2) return { stem: src.trim(), choices: [], labels: [] };
  const stem = src.slice(0, hits[0].at).trim();
  const choices = hits
    .map((hit, idx) => {
      const end = idx + 1 < hits.length ? hits[idx + 1].at : src.length;
      return src
        .slice(hit.at + hit.marker.length, end)
        .replace(/^[.．、.)）\s]+/, "")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(Boolean);
  return { stem, choices, labels: hits.slice(0, choices.length).map((hit) => hit.label) };
}

function peelHangulStatements(text) {
  const markers = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"];
  const src = String(text || "");
  const hits = [];
  const re = /([ㄱㄴㄷㄹㅁ])\s*(?:[.．、.)）]|번)\s+/g;
  let match;
  while ((match = re.exec(src))) {
    hits.push({ marker: match[1], at: match.index, start: match.index + match[0].length });
  }
  const ordered = [];
  let expect = 0;
  hits.forEach((hit) => {
    if (hit.marker === markers[expect]) {
      ordered.push(hit);
      expect += 1;
    }
  });
  if (ordered.length < 2) return null;
  const rows = ordered.map((hit, idx) => {
    const end = idx + 1 < ordered.length ? ordered[idx + 1].at : src.length;
    const item = src.slice(hit.start, end).replace(/\s+/g, " ").trim();
    return [hit.marker, item];
  });
  if (rows.some((row) => !row[1])) return null;
  const svg = rowsToSvgDataUri(rows);
  if (!svg) return null;
  return {
    stem: src.slice(0, ordered[0].at).trim(),
    image: svg,
    rows,
  };
}

function splitChoices(body) {
  const circled = splitSequentialMarkers(body, ["①", "②", "③", "④", "⑤"]);
  const hangul = splitSequentialMarkers(body, ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"]);
  const peeled = peelHangulStatements(circled.choices.length >= 2 ? circled.stem : body);

  if (circled.choices.length >= 2) {
    const longItems = [];
    const comboItems = [];
    circled.choices.forEach((choice, idx) => {
      if (isComboChoice(choice)) comboItems.push({ idx, choice });
      else longItems.push({ idx, choice, label: circled.labels[idx] });
    });
    if (longItems.length >= 2 && comboItems.length >= 2) {
      const rows = longItems.map((item, idx) => ["ㄱㄴㄷㄹㅁ"[idx] || item.label, item.choice]);
      const svg = rowsToSvgDataUri(rows);
      return {
        stem: `${circled.stem}\n<<IMG ${svg}>>\n`.trim(),
        choices: comboItems.map((item) => normalizeComboToHangul(item.choice)),
        labels: [],
      };
    }
    if (peeled && (comboItems.length >= 2 || circled.choices.every(isComboChoice))) {
      return {
        stem: `${peeled.stem}\n<<IMG ${peeled.image}>>\n`.trim(),
        choices: circled.choices.map((choice) => (isComboChoice(choice) ? normalizeComboToHangul(choice) : choice)),
        labels: [],
      };
    }
    return {
      stem: circled.stem,
      choices: circled.choices.map((choice) => (isComboChoice(choice) ? normalizeComboToHangul(choice) : choice)),
      labels: [],
    };
  }

  if (hangul.choices.length >= 2) {
    return { stem: hangul.stem, choices: hangul.choices, labels: hangul.labels };
  }

  const numbered = String(body || "")
    .split(/(?=(?:^|\n)\s*(?:\([1-5]\)|[1-5]\s*[)]))/)
    .filter((part) => /^\s*(?:\([1-5]\)|[1-5]\s*[)])/.test(part));
  if (numbered.length >= 2) {
    const firstAt = String(body || "").search(/(?:\([1-5]\)|[1-5]\s*[)])/);
    const stem = String(body || "").slice(0, firstAt).trim();
    const choices = numbered
      .map((part) => part.replace(/^\s*(?:\([1-5]\)|[1-5]\s*[)])\s*/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return { stem, choices, labels: [] };
  }

  if (peeled) {
    return {
      stem: `${peeled.stem}\n<<IMG ${peeled.image}>>\n`.trim(),
      choices: [],
      labels: [],
    };
  }

  return { stem: String(body || "").trim(), choices: [], labels: [] };
}

function sectionAt(text, index) {
  const before = text.slice(0, index);
  const matches = [
    ...before.matchAll(/(?:제\s*)?(\d{1,2})\s*과목\s*[.:：)\-]?\s*([^\n]*)/g),
  ];
  if (!matches.length) return "";
  const last = matches[matches.length - 1];
  const title = String(last[2] || "")
    .replace(/[=\-_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title ? `${last[1]}. ${title}` : `${last[1]}과목`;
}

function splitQuestionAndAnswerText(text) {
  const re =
    /(?:^|\n)\s*(?:\[\s*)?(?:정\s*답(?:\s*표)?|답\s*안(?:\s*표)?|정답\s*및\s*해설|정답과\s*해설)(?:\s*\])?\s*(?:\n|$)/i;
  const match = re.exec(text);
  if (!match) return { questionText: text, answerText: "" };
  return {
    questionText: text.slice(0, match.index).trim(),
    answerText: text.slice(match.index + match[0].length).trim(),
  };
}

function takeInlineAnswer(body) {
  const match = String(body || "").match(/(?:정답|답)\s*[:：]\s*([^\n]+)/);
  if (!match) return { body, inline: "" };
  return {
    body: body.replace(/(?:정답|답)\s*[:：]\s*[^\n]+/g, " ").trim(),
    inline: match[1].trim(),
  };
}

function takeInlineExplain(body) {
  const src = String(body || "");
  const re = /(?:^|\n)\s*(?:\[?\s*)?(?:해설|풀이)(?:\s*\])?\s*[:：]?\s*/;
  const idx = src.search(re);
  if (idx >= 0) {
    const cut = src.match(re);
    return {
      body: src.slice(0, idx).trim(),
      explain: src.slice(idx + (cut ? cut[0].length : 0)).replace(/\s+/g, " ").trim(),
    };
  }
  const inline = src.match(/(?:해설|풀이)\s*[:：]\s*([^\n]+)/);
  if (!inline) return { body, explain: "" };
  return {
    body: src.replace(/(?:해설|풀이)\s*[:：]\s*[^\n]+/g, " ").trim(),
    explain: inline[1].trim(),
  };
}

function splitAnswerAndExplain(value) {
  const explained = takeInlineExplain(value);
  if (explained.explain) return explained;
  const src = String(value || "").trim();
  const tokenRe = new RegExp(`^(${CHOICE_TOKEN}|[가나다라마ㄱㄴㄷㄹㅁ]|[1-5]\\s*번|[1-5]|[A-Ea-e])\\s+(.+)$`);
  const match = src.match(tokenRe);
  if (match && match[2].trim().length >= 8) {
    return { body: match[1], explain: match[2].replace(/\s+/g, " ").trim() };
  }
  return { body: src, explain: "" };
}

function interpretAnswerValue(value) {
  const cleaned = String(value || "")
    .replace(/^(?:정답\s*[:：]?)?\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;]+$/, "");
  if (!cleaned) return null;
  const direct = tokenToChoiceIndex(cleaned);
  if (direct != null) {
    return { kind: "mcq", index: direct, text: cleaned, raw: cleaned };
  }
  const lead = cleaned.match(new RegExp(`^(${CHOICE_TOKEN}|${LETTER_TOKEN}|[1-5]\\s*번)\\b`));
  if (lead) {
    const index = tokenToChoiceIndex(lead[1]);
    if (index != null) return { kind: "mcq", index, text: lead[1], raw: cleaned };
  }
  return { kind: "short", text: cleaned, raw: cleaned };
}

function parseAnswerKeyFromText(raw) {
  const text = normalizePdfText(raw);
  const answers = [];

  const push = (no, value, extraExplain) => {
    const split = splitAnswerAndExplain(value);
    const parsed = interpretAnswerValue(split.body);
    if (!parsed || !Number.isFinite(Number(no)) || Number(no) < 1) return;
    const explain = String(extraExplain || split.explain || "").trim();
    answers.push({ no: Number(no), ...parsed, explain });
  };

  const pairRe = new RegExp(
    `(\\d{1,3})\\s*(?:[.]|．|번|\\)|\\-|:|：|,)?\\s*(${CHOICE_TOKEN}|[가나다라마ㄱㄴㄷㄹㅁ]|[1-5]\\s*번|[1-5]|[A-Ea-e])(?=\\s|$|,|\\/|번)`,
    "g"
  );

  String(text)
    .split(/\n+/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (/^(?:제\s*\d+\s*과목|정답(?:표)?|답안(?:표)?|정답\s*[및과]\s*해설)\s*$/.test(trimmed)) return;

      const explainLine = trimmed.match(/^(?:\[?\s*)?(?:해설|풀이)(?:\s*\])?\s*[:：]?\s*(.*)$/);
      if (explainLine && answers.length) {
        const extra = String(explainLine[1] || "").replace(/\s+/g, " ").trim();
        if (extra) {
          const last = answers[answers.length - 1];
          last.explain = [last.explain, extra].filter(Boolean).join(" ").trim();
        }
        return;
      }

      const pairs = [...trimmed.matchAll(pairRe)];
      if (pairs.length >= 2) {
        pairs.forEach((item) => push(item[1], item[2]));
        return;
      }
      if (pairs.length === 1) {
        const leftover = trimmed.replace(pairRe, " ").replace(/\s+/g, " ").trim();
        if (!leftover || leftover.length < 8) {
          push(pairs[0][1], pairs[0][2]);
          return;
        }
        push(pairs[0][1], pairs[0][2], leftover.replace(/^(?:해설|풀이)\s*[:：]?\s*/, ""));
        return;
      }

      const csv = trimmed.match(/^(\d{1,3})\s*[,;\t]\s*(.+)$/);
      if (csv) {
        push(csv[1], csv[2]);
        return;
      }

      const one = trimmed.match(/^(?:문(?:항|제)?\s*)?(\d{1,3})\s*(?:[.]|．|번|\)|:|：|\-)\s*(.+)$/);
      if (one) push(one[1], one[2]);
    });

  if (!answers.length) {
    const global = text.matchAll(
      new RegExp(`(\\d{1,3})\\s*(?:[.]|．|번|\\-|:|：|,)?\\s*(${CHOICE_TOKEN}|[가나다라마ㄱㄴㄷㄹㅁ]|[1-5]\\s*번|[1-5])`, "g")
    );
    for (const item of global) push(item[1], item[2]);
  }

  return answers;
}

function normalizeChoice(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[."""''`·・]/g, "")
    .toLowerCase();
}

function choiceIndexFromText(choices, text) {
  const needle = normalizeChoice(text);
  if (!needle) return -1;
  const exact = choices.findIndex((item) => normalizeChoice(item) === needle);
  if (exact >= 0) return exact;
  return choices.findIndex((item) => {
    const hay = normalizeChoice(item);
    return hay.includes(needle) || needle.includes(hay);
  });
}

function applyKeyToQuestion(question, key) {
  if (key && String(key.explain || "").trim()) {
    question.explain = String(key.explain).trim();
  }
  const isShort = question.type === "short" || !(question.choices && question.choices.length >= 2);
  if (isShort) {
    const answer = String(key.text || key.raw || "").trim();
    if (!answer) return false;
    question.answer = answer;
    question.answerMatched = true;
    return true;
  }
  const choices = question.choices || [];
  let index = key.kind === "mcq" ? key.index : null;
  if (index == null || index < 0 || index >= choices.length) {
    index = choiceIndexFromText(choices, key.text || key.raw || "");
  }
  if (index == null || index < 0 || index >= choices.length) return false;
  question.answer = index;
  question.answerMatched = true;
  return true;
}

function parseExplainKeyFromText(raw) {
  const text = normalizePdfText(String(raw || "").replace(/<<IMG\s+[\s\S]*?>>/g, " "));
  const explains = [];
  const seen = new Map();

  const push = (no, body) => {
    const n = Number(no);
    if (!Number.isFinite(n) || n < 1) return;
    const explain = String(body || "")
      .replace(/^(?:\[?\s*)?(?:해설|풀이|정답\s*[및과]\s*해설)(?:\s*\])?\s*[:：]?\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!explain) return;
    const prev = seen.get(n);
    if (prev != null) {
      if (explain.length > explains[prev].explain.length) explains[prev].explain = explain;
      return;
    }
    seen.set(n, explains.length);
    explains.push({ no: n, explain });
  };

  const re =
    /(?:^|\n)\s*(?:문제\s*|문항\s*|문\s*|해설\s*)?(\d{1,3})\s*(?:[.]|．|번)\s+|(?:^|\n)\s*[\[【](\d{1,3})[\]】]\s*/g;
  const hits = [];
  let match;
  while ((match = re.exec(text))) {
    hits.push({
      no: Number(match[1] || match[2]),
      at: match.index,
      bodyStart: match.index + match[0].length,
    });
  }
  if (hits.length) {
    hits.forEach((hit, index) => {
      const end = index + 1 < hits.length ? hits[index + 1].at : text.length;
      push(hit.no, text.slice(hit.bodyStart, end).trim());
    });
  }
  if (!explains.length) {
    String(text)
      .split(/\n+/)
      .forEach((line) => {
        const one = line.trim().match(/^(?:문(?:항|제)?\s*|해설\s*)?(\d{1,3})\s*(?:[.]|．|번|\)|:|：|\-)\s*(.+)$/);
        if (one) push(one[1], one[2]);
      });
  }
  return explains;
}

function applyExplainsToQuestions(questions, explains) {
  const result = (questions || []).map((item) => ({ ...item }));
  const keys = Array.isArray(explains) ? explains.slice() : [];
  const unmatched = [];
  if (!result.length || !keys.length) {
    result.forEach((item, idx) => {
      if (!String(item.explain || "").trim()) unmatched.push(item.no || idx + 1);
    });
    return {
      questions: result,
      matched: result.filter((item) => String(item.explain || "").trim()).length,
      unmatched,
    };
  }
  const used = new Set();
  result.forEach((question, idx) => {
    const want = Number(question.no || idx + 1);
    let keyIdx = keys.findIndex((item, explainIdx) => !used.has(explainIdx) && Number(item.no) === want);
    if (keyIdx < 0 && keys.length === result.length && !used.has(idx)) keyIdx = idx;
    const key = keyIdx >= 0 ? keys[keyIdx] : null;
    if (!key || !String(key.explain || "").trim()) {
      if (!String(question.explain || "").trim()) unmatched.push(question.no || idx + 1);
      return;
    }
    used.add(keyIdx);
    question.explain = String(key.explain).trim();
    question.explainMatched = true;
  });
  return {
    questions: result,
    matched: result.filter((item) => item.explainMatched).length,
    unmatched,
  };
}

function applyAnswersToQuestions(questions, answers) {
  const result = (questions || []).map((item) => ({ ...item, answerMatched: Boolean(item.answerMatched) }));
  const keys = Array.isArray(answers) ? answers.slice() : [];
  const unmatched = [];
  if (!result.length || !keys.length) {
    result.forEach((item, idx) => {
      if (!item.answerMatched) unmatched.push(item.no || idx + 1);
    });
    return { questions: result, matched: result.filter((item) => item.answerMatched).length, unmatched };
  }

  const used = new Set();
  result.forEach((question, idx) => {
    const want = Number(question.no || idx + 1);
    let keyIdx = keys.findIndex((item, answerIdx) => !used.has(answerIdx) && Number(item.no) === want);
    if (keyIdx < 0 && keys.length === result.length && !used.has(idx)) keyIdx = idx;
    const key = keyIdx >= 0 ? keys[keyIdx] : null;
    if (!key) {
      if (!question.answerMatched) unmatched.push(question.no || idx + 1);
      return;
    }
    used.add(keyIdx);
    if (!applyKeyToQuestion(question, key) && !question.answerMatched) {
      unmatched.push(question.no || idx + 1);
    }
  });
  return {
    questions: result,
    matched: result.filter((item) => item.answerMatched).length,
    unmatched,
  };
}

function parseQuestionsFromText(raw) {
  const held = holdInlineImages(raw);
  const text = normalizePdfText(held.text);
  const imageBank = held.bank;
  const { questionText, answerText } = splitQuestionAndAnswerText(text);
  const re = /(?:^|\n)\s*(?:문제\s*|문\s*)?(\d{1,3})\s*(?:[.]|．|번)\s+/g;
  const hits = [];
  let match;
  while ((match = re.exec(questionText))) {
    hits.push({
      no: Number(match[1]),
      bodyStart: match.index + match[0].length,
      at: match.index,
    });
  }

  const questions = [];
  hits.forEach((hit, index) => {
    const end = index + 1 < hits.length ? hits[index + 1].at : questionText.length;
    let body = questionText.slice(hit.bodyStart, end).trim();
    const sectionCut = body.search(/(?:^|\n)\s*(?:제\s*)?\d{1,2}\s*과목/);
    if (sectionCut >= 0) body = body.slice(0, sectionCut).trim();
    if (!body) return;
    const inline = takeInlineAnswer(body);
    body = inline.body;
    const explained = takeInlineExplain(body);
    body = explained.body;
    const parsed = splitChoices(body);
    const labeledShort = /주관식|단답형|서술형/.test(body);
    if (parsed.choices.length >= 2 && !labeledShort) {
      const question = {
        no: hit.no,
        q: parsed.stem.replace(/\s+/g, " ").trim() || `${hit.no}번 문항`,
        type: "mcq",
        choices: parsed.choices.slice(0, 5),
        answer: 0,
        answerMatched: false,
        explain: explained.explain || "",
        section: sectionAt(questionText, hit.at),
        images: [],
        choiceImages: [],
        choiceLabels: parsed.labels || [],
      };
      attachImagesToQuestion(question, parsed.stem, parsed.choices.slice(0, 5), imageBank);
      if (inline.inline) applyKeyToQuestion(question, interpretAnswerValue(inline.inline) || { text: inline.inline, raw: inline.inline });
      questions.push(question);
      return;
    }
    const stem = parsed.stem
      .replace(/\[?\s*(?:주관식|단답형|서술형)\s*\]?/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const question = {
      no: hit.no,
      q: stem || `${hit.no}번 문항`,
      type: "short",
      choices: [],
      answer: "",
      answerMatched: false,
      explain: explained.explain || "",
      section: sectionAt(questionText, hit.at),
      images: [],
      choiceImages: [],
    };
    attachImagesToQuestion(question, stem, [], imageBank);
    if (inline.inline) applyKeyToQuestion(question, { kind: "short", text: inline.inline, raw: inline.inline });
    questions.push(question);
  });

  if (questions.length && hits.length) {
    const preface = extractInlineImages(questionText.slice(0, hits[0].at), imageBank);
    if (preface.images.length) {
      questions[0].images = [...preface.images, ...(questions[0].images || [])];
    }
  }

  const sheet = parseAnswerKeyFromText(answerText);
  const applied = applyAnswersToQuestions(questions, sheet);
  return {
    text,
    questions: applied.questions,
    answerCount: applied.matched,
    unmatched: applied.unmatched,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseQuestionsFromText,
    parseAnswerKeyFromText,
    parseExplainKeyFromText,
    applyAnswersToQuestions,
    applyExplainsToQuestions,
    normalizePdfText,
    splitQuestionAndAnswerText,
    tokenToChoiceIndex,
    htmlToParseText,
  };
}
