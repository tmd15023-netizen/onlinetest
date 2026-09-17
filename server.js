require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { APP, EXAMS, NOTICES, pickQuestions, examGradeLabel } = require("./js/data.js");
const {
  parseQuestionsFromText,
  parseAnswerKeyFromText,
  parseExplainKeyFromText,
  applyAnswersToQuestions,
  applyExplainsToQuestions,
  htmlToParseText,
} = require("./parse-pdf.js");
const { isShortQuestion, gradeQuestion } = require("./js/question.js");
const dbx = require("./db.js");

const PORT = process.env.PORT || 8765;
const DATA_DIR = process.env.VERCEL ? path.join("/tmp", "oncodelab") : path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const MEDIA_ROOT = process.env.VERCEL ? path.join(DATA_DIR, "media") : path.join(__dirname, "data", "media");
const sessions = new Map();
const examSessions = new Map();

async function writeLiveExam(token, live) {
  examSessions.set(token, live);
  await dbx.saveLiveExam(token, live);
}

async function readLiveExam(token) {
  if (examSessions.has(token)) return examSessions.get(token);
  const live = await dbx.findLiveExam(token);
  if (live) examSessions.set(token, live);
  return live;
}

async function clearLiveExam(token) {
  examSessions.delete(token);
  await dbx.deleteLiveExam(token);
}

function backupAttemptJson(attempt) {
  try {
    const db = loadDb();
    db.attempts = db.attempts || [];
    db.attempts = [attempt, ...db.attempts.filter((item) => item.id !== attempt.id)].slice(0, 300);
    saveDb(db);
  } catch (err) {
    console.error("응시 기록 로컬 백업 실패:", err.message);
  }
}

function mergeAttempts(mongoList, jsonList) {
  const byId = new Map();
  [...(jsonList || []), ...(mongoList || [])].forEach((item) => {
    if (item && item.id) byId.set(item.id, item);
  });
  return [...byId.values()].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

function defaultDb() {
  return {
    settings: {
      entryCode: "ONCODE2026",
      adminId: "oncodlab",
      adminPassword: hash("oncodelab"),
    },
    users: [],
    exams: EXAMS.map((exam) => ({
      ...exam,
      password: "",
      questions: [],
    })),
    attempts: [],
    notices: NOTICES.map((item) => ({ ...item })),
  };
}

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch (err) {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
}

function saveDb(db) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2));
}

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.MONGO_URI || "oncodelab-exam-session";
}

function signSession(session) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readSession(token) {
  const cached = sessions.get(token);
  if (cached) return cached;
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const left = Buffer.from(String(sig));
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (err) {
    return null;
  }
}

function issueSession(session) {
  const token = signSession(session);
  sessions.set(token, session);
  return token;
}

function defaultSettings() {
  return {
    entryCode: "ONCODE2026",
    adminId: "oncodlab",
    adminPassword: hash("oncodelab"),
  };
}

async function getSettings() {
  if (dbx.mongoReady()) {
    const settings = await dbx.ensureSettings(loadDb().settings || defaultSettings());
    if (settings) return settings;
  }
  return loadDb().settings || defaultSettings();
}

async function writeSettings(patch) {
  const current = await getSettings();
  const next = {
    entryCode: current.entryCode,
    adminId: current.adminId,
    adminPassword: current.adminPassword,
    ...patch,
  };
  if (dbx.mongoReady()) {
    const saved = await dbx.saveSettings(next);
    const db = loadDb();
    db.settings = {
      entryCode: saved.entryCode,
      adminId: saved.adminId,
      adminPassword: saved.adminPassword,
    };
    saveDb(db);
    return saved;
  }
  const db = loadDb();
  db.settings = next;
  saveDb(db);
  return next;
}

async function listAllExams() {
  if (dbx.mongoReady()) {
    return dbx.ensureExams(loadDb().exams);
  }
  return loadDb().exams;
}

function noticeDateNow() {
  const d = new Date();
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

function publicNotice(item) {
  return {
    id: item.id,
    pinned: Boolean(item.pinned),
    title: item.title || "",
    date: item.date || "",
    body: item.body || "",
  };
}

async function listAllNotices() {
  if (dbx.mongoReady()) {
    const seeded = await dbx.ensureNotices(NOTICES);
    return (seeded || []).map(publicNotice);
  }
  const db = loadDb();
  if (!Array.isArray(db.notices) || !db.notices.length) {
    db.notices = NOTICES.map((item) => ({ ...item }));
    saveDb(db);
  }
  return dbx.sortNotices(db.notices).map(publicNotice);
}

async function writeNotice(notice) {
  if (dbx.mongoReady()) {
    const saved = await dbx.upsertNotice(notice);
    const db = loadDb();
    db.notices = db.notices || [];
    const index = db.notices.findIndex((item) => item.id === notice.id);
    if (index >= 0) db.notices[index] = notice;
    else db.notices.unshift(notice);
    saveDb(db);
    return publicNotice(saved);
  }
  const db = loadDb();
  db.notices = db.notices || [];
  const index = db.notices.findIndex((item) => item.id === notice.id);
  if (index >= 0) db.notices[index] = notice;
  else db.notices.unshift(notice);
  saveDb(db);
  return publicNotice(notice);
}

async function removeNotice(id) {
  if (dbx.mongoReady()) await dbx.deleteNotice(id);
  const db = loadDb();
  db.notices = (db.notices || []).filter((item) => item.id !== id);
  saveDb(db);
}

async function findExam(id) {
  if (dbx.mongoReady()) {
    const exam = await dbx.findExam(id);
    if (exam) return exam;
  }
  return loadDb().exams.find((item) => item.id === id) || null;
}

async function writeExam(exam) {
  if (dbx.mongoReady()) {
    const saved = await dbx.upsertExam(exam);
    const db = loadDb();
    const index = db.exams.findIndex((item) => item.id === exam.id);
    if (index >= 0) db.exams[index] = exam;
    else db.exams.push(exam);
    saveDb(db);
    return saved;
  }
  const db = loadDb();
  const index = db.exams.findIndex((item) => item.id === exam.id);
  if (index >= 0) db.exams[index] = exam;
  else db.exams.push(exam);
  saveDb(db);
  return exam;
}

async function removeExam(id) {
  if (dbx.mongoReady()) await dbx.deleteExam(id);
  const db = loadDb();
  const index = db.exams.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const [exam] = db.exams.splice(index, 1);
  saveDb(db);
  return exam;
}

function decodeUploadBuffer(dataUrl) {
  const raw = String(dataUrl || "");
  const base64 = raw.includes("base64,") ? raw.replace(/^data:[^;]+;base64,/, "") : "";
  if (base64) return Buffer.from(base64, "base64");
  if (raw.startsWith("data:text")) {
    const encoded = raw.replace(/^data:[^;]+;charset=[^;]+,/, "").replace(/^data:[^;]+,/, "");
    return Buffer.from(decodeURIComponent(encoded), "utf8");
  }
  return Buffer.from(raw, "utf8");
}

function safeExamId(id) {
  const value = String(id || "");
  return /^[a-zA-Z0-9._-]+$/.test(value) ? value : "";
}

function isSafeImageSrc(src) {
  const value = String(src || "").trim();
  return value.startsWith("data:image/") || value.startsWith("/media/") || /^https?:\/\//i.test(value);
}

function sanitizeImages(list) {
  if (!Array.isArray(list)) return [];
  return list.map((src) => String(src || "").trim()).filter(isSafeImageSrc);
}

function extFromMime(mime) {
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
  };
  return map[String(mime || "").toLowerCase()] || ".png";
}

function saveDataUriImage(examId, dataUri) {
  const id = safeExamId(examId);
  const match = String(dataUri || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!id || !match) return "";
  const buf = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buf.length) return "";
  const name = `${crypto.createHash("sha1").update(buf).digest("hex").slice(0, 20)}${extFromMime(match[1])}`;
  const dir = path.join(MEDIA_ROOT, id);
  fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, name);
  if (!fs.existsSync(filepath)) fs.writeFileSync(filepath, buf);
  return `/media/${id}/${name}`;
}

function persistImageSrc(examId, src) {
  const value = String(src || "").trim();
  if (value.startsWith("data:image/")) return saveDataUriImage(examId, value);
  return isSafeImageSrc(value) ? value : "";
}

function persistInlineImagesInText(examId, text) {
  return String(text || "").replace(/<<IMG\s+([\s\S]*?)>>/g, (_, src) => {
    const url = persistImageSrc(examId, src);
    return url ? `<<IMG ${url}>>` : "";
  });
}

function persistQuestionMedia(examId, question) {
  return {
    images: sanitizeImages(question && question.images).map((src) => persistImageSrc(examId, src)).filter(Boolean),
    choiceImages: Array.isArray(question && question.choiceImages)
      ? question.choiceImages.map((list) => sanitizeImages(list).map((src) => persistImageSrc(examId, src)).filter(Boolean))
      : [],
  };
}

function persistParsedQuestions(examId, questions) {
  if (!examId || !Array.isArray(questions)) return questions;
  questions.forEach((question) => {
    const media = persistQuestionMedia(examId, question);
    question.images = media.images;
    question.choiceImages = media.choiceImages;
  });
  return questions;
}

function removeExamMedia(examId) {
  const id = safeExamId(examId);
  if (!id) return;
  fs.rmSync(path.join(MEDIA_ROOT, id), { recursive: true, force: true });
}

function previewImportedText(text) {
  return String(text || "")
    .replace(/<<IMG\s+[\s\S]*?>>/g, "[이미지]")
    .slice(0, 500);
}

function clientQuestion(item, index, exam) {
  return {
    no: item.no || index + 1,
    q: item.q,
    type: isShortQuestion(item) ? "short" : "mcq",
    choices: isShortQuestion(item) ? [] : item.choices,
    section: item.section || (exam && exam.category) || APP.category,
    images: sanitizeImages(item.images),
    choiceImages: Array.isArray(item.choiceImages) ? item.choiceImages.map(sanitizeImages) : [],
    choiceLabels: Array.isArray(item.choiceLabels) ? item.choiceLabels.map((label) => String(label || "")).filter(Boolean) : [],
  };
}

async function extractTextFromUpload(dataUrl, filename, options = {}) {
  const name = String(filename || "").toLowerCase();
  const buffer = decodeUploadBuffer(dataUrl);
  if (!buffer.length) throw new Error("파일이 비어 있습니다.");
  if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".tsv")) {
    return buffer.toString("utf8").replace(/^\uFEFF/, "");
  }
  if (name.endsWith(".docx") || String(dataUrl).includes("wordprocessingml")) {
    let mammoth;
    try {
      mammoth = require("mammoth");
    } catch (err) {
      throw new Error("Word 분석 모듈이 설치되어 있지 않습니다.");
    }
    const parsed = await mammoth.convertToHtml({ buffer }, { convertImage: mammoth.images.dataUri });
    let text = htmlToParseText(parsed.value || "", { tablesAsText: Boolean(options.tablesAsText) });
    if (options.persistImagesForExam) {
      text = persistInlineImagesInText(options.persistImagesForExam, text);
    }
    return text;
  }
  if (name.endsWith(".pdf") || String(dataUrl).includes("application/pdf")) {
    let pdfParse;
    try {
      pdfParse = require("pdf-parse");
    } catch (err) {
      throw new Error("PDF 분석 모듈이 설치되어 있지 않습니다.");
    }
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  }
  if (name.endsWith(".doc")) {
    throw new Error("옛 .doc 파일은 지원하지 않습니다. Word에서 .docx로 저장해 주세요.");
  }
  throw new Error("PDF, Word(.docx), 텍스트(.txt) 파일만 사용할 수 있습니다.");
}

function publicExam(exam) {
  const customCount = Array.isArray(exam.questions) ? exam.questions.length : 0;
  return {
    id: exam.id,
    title: exam.title,
    desc: exam.desc,
    category: examGradeLabel(exam.category),
    minutes: exam.minutes,
    tag: exam.tag || "시험",
    questionCount: customCount || exam.questionCount || 0,
    hasPassword: Boolean(exam.password),
    demoBest: exam.demoBest,
  };
}

function auth(req, res, next) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const session = readSession(token);
  if (!session) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }
  req.token = token;
  req.session = session;
  next();
}

function adminOnly(req, res, next) {
  if (req.session.role !== "admin") {
    return res.status(403).json({ error: "관리자만 사용할 수 있습니다." });
  }
  next();
}

const app = express();
const boot = dbx.connectMongo().catch((err) => {
  console.error("MongoDB 연결 실패:", err.message);
});
app.use((req, res, next) => {
  Promise.resolve(boot)
    .then(() => dbx.ensureMongo())
    .finally(() => next());
});
app.use((req, res, next) => {
  if (req.path === "/" || /\.(?:html|js|css)$/i.test(req.path)) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
  }
  next();
});
app.use(express.json({ limit: "50mb" }));
app.use("/data", (req, res) => res.sendStatus(404));
app.use("/media", express.static(MEDIA_ROOT));
app.use(express.static(__dirname));

function clientUser(user, role = "user") {
  return {
    id: user.id,
    name: user.name,
    examNo: dbx.formatExamNo(user.examNo),
    role,
  };
}

app.post("/api/login", async (req, res) => {
  const name = String(req.body.name || "").trim().normalize("NFC");
  const password = String(req.body.password || "");
  const entryCode = String(req.body.entryCode || "").trim();
  if (!name || !password || !entryCode) {
    return res.status(400).json({ error: "이름, 비밀번호, 입장코드를 모두 입력해 주세요." });
  }
  await dbx.ensureMongo();
  const settings = await getSettings();
  if (name.toLowerCase() === String(settings.adminId).toLowerCase()) {
    return res.status(400).json({ error: "관리자는 로그인 화면의 [관리자] 탭으로 입장해 주세요." });
  }
  if (entryCode !== settings.entryCode) {
    return res.status(403).json({ error: "입장코드가 올바르지 않습니다." });
  }
  try {
    let user;
    if (dbx.mongoReady()) {
      user = await dbx.findUserByName(name);
      if (user) {
        if (user.disabled) {
          return res.status(403).json({ error: "정지된 회원입니다. 관리자에게 문의해 주세요." });
        }
        if (user.password !== hash(password)) {
          return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
        }
        await dbx.ensureExamNo(user);
      } else {
        user = {
          id: uid("u"),
          name,
          password: hash(password),
          examNo: await dbx.nextExamNo(),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          disabled: false,
        };
        await dbx.createUser(user);
      }
      await dbx.touchLogin(user.id);
    } else if (process.env.MONGO_URI || process.env.VERCEL) {
      return res.status(503).json({ error: "회원 DB에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } else {
      const db = loadDb();
      user = db.users.find((item) => item.name === name);
      if (user) {
        if (user.disabled) {
          return res.status(403).json({ error: "정지된 회원입니다. 관리자에게 문의해 주세요." });
        }
        if (user.password !== hash(password)) {
          return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
        }
        if (!dbx.formatExamNo(user.examNo)) {
          user.examNo = dbx.nextExamNoFromList(db.users);
        }
        user.lastLoginAt = new Date().toISOString();
        saveDb(db);
      } else {
        user = {
          id: uid("u"),
          name,
          password: hash(password),
          examNo: dbx.nextExamNoFromList(db.users),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          disabled: false,
        };
        db.users.push(user);
        saveDb(db);
      }
    }
    const token = issueSession({ role: "user", userId: user.id, name: user.name, examNo: user.examNo });
    res.json({ token, user: clientUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message || "회원 정보를 저장하지 못했습니다." });
  }
});

function isAdminId(id, settings) {
  const value = String(id || "").trim().toLowerCase();
  const saved = String(settings.adminId || "").trim().toLowerCase();
  return Boolean(value) && (value === saved || value === "oncodlab" || value === "oncodelab");
}

function isAdminPassword(password, settings) {
  const value = String(password || "").trim();
  if (!value) return false;
  if (hash(value) === settings.adminPassword) return true;
  const defaultHash = hash("oncodelab");
  if (settings.adminPassword === defaultHash && hash(value) === hash("oncodlab")) return true;
  return false;
}

function publicSettings(settings) {
  return {
    entryCode: settings.entryCode,
    adminId: settings.adminId,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mongo: dbx.mongoReady() });
});

app.post("/api/admin/login", async (req, res) => {
  const id = String(req.body.id || "").trim();
  const password = String(req.body.password || "").trim();
  const settings = await getSettings();
  if (!isAdminId(id, settings) || !isAdminPassword(password, settings)) {
    return res.status(401).json({ error: "관리자 아이디 또는 비밀번호가 올바르지 않습니다." });
  }
  const token = issueSession({ role: "admin", userId: "admin", name: "관리자" });
  res.json({ token, user: { id: "admin", name: "관리자", role: "admin" } });
});

app.get("/api/exams", auth, async (req, res) => {
  const exams = await listAllExams();
  res.json(exams.map(publicExam));
});

app.get("/api/notices", auth, async (req, res) => {
  try {
    res.json(await listAllNotices());
  } catch (err) {
    res.status(500).json({ error: err.message || "공지를 불러오지 못했습니다." });
  }
});

app.get("/api/admin/notices", auth, adminOnly, async (req, res) => {
  try {
    res.json(await listAllNotices());
  } catch (err) {
    res.status(500).json({ error: err.message || "공지를 불러오지 못했습니다." });
  }
});

app.post("/api/admin/notices", auth, adminOnly, async (req, res) => {
  const title = String(req.body.title || "").trim();
  const body = String(req.body.body || "").trim();
  if (!title || !body) return res.status(400).json({ error: "제목과 내용을 입력해 주세요." });
  const notice = {
    id: uid("n"),
    title,
    body,
    pinned: Boolean(req.body.pinned),
    date: String(req.body.date || "").trim() || noticeDateNow(),
    createdAt: new Date().toISOString(),
  };
  try {
    res.json(await writeNotice(notice));
  } catch (err) {
    res.status(500).json({ error: err.message || "공지를 저장하지 못했습니다." });
  }
});

app.put("/api/admin/notices/:id", auth, adminOnly, async (req, res) => {
  const list = await listAllNotices();
  const current = list.find((item) => item.id === req.params.id);
  if (!current) return res.status(404).json({ error: "공지를 찾을 수 없습니다." });
  const title = String(req.body.title || "").trim();
  const body = String(req.body.body || "").trim();
  if (!title || !body) return res.status(400).json({ error: "제목과 내용을 입력해 주세요." });
  try {
    res.json(
      await writeNotice({
        ...current,
        title,
        body,
        pinned: Boolean(req.body.pinned),
        date: String(req.body.date || current.date || "").trim() || noticeDateNow(),
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message || "공지를 저장하지 못했습니다." });
  }
});

app.delete("/api/admin/notices/:id", auth, adminOnly, async (req, res) => {
  try {
    await removeNotice(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "공지를 삭제하지 못했습니다." });
  }
});

app.post("/api/exams/:id/start", auth, async (req, res) => {
  const exam = await findExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  const password = String(req.body.password || "");
  if (exam.password && hash(password) !== exam.password) {
    return res.status(403).json({ error: "시험 비밀번호가 올바르지 않습니다." });
  }
  const source =
    exam.questions && exam.questions.length
      ? exam.questions.map((item, i) => ({ ...item, no: i + 1 }))
      : pickQuestions(exam.seed || 1, exam.questionCount || 10);
  const live = {
    examId: exam.id,
    title: exam.title,
    minutes: exam.minutes,
    questions: source,
    startedAt: Date.now(),
    endsAt: Date.now() + exam.minutes * 60 * 1000,
  };
  await writeLiveExam(req.token, live);
  res.json({
    examId: live.examId,
    title: live.title,
    minutes: live.minutes,
    startedAt: live.startedAt,
    endsAt: live.endsAt,
    category: examGradeLabel(exam.category),
    questions: live.questions.map((item, index) => clientQuestion(item, index, exam)),
  });
});

app.get("/api/exams/live", auth, async (req, res) => {
  const live = await readLiveExam(req.token);
  if (!live) return res.status(404).json({ error: "진행 중인 시험이 없습니다." });
  res.json({
    examId: live.examId,
    title: live.title,
    minutes: live.minutes,
    startedAt: live.startedAt,
    endsAt: live.endsAt,
    questions: live.questions.map((item, index) => clientQuestion(item, index)),
  });
});

app.post("/api/exams/submit", auth, async (req, res) => {
  let live = await readLiveExam(req.token);
  if (!live && req.body.examId) {
    const exam = await findExam(req.body.examId);
    if (exam && Array.isArray(exam.questions) && exam.questions.length) {
      live = {
        examId: exam.id,
        title: exam.title,
        minutes: exam.minutes,
        questions: exam.questions.map((item, i) => ({ ...item, no: i + 1 })),
      };
    }
  }
  if (!live) return res.status(400).json({ error: "진행 중인 시험이 없습니다." });
  const answers = req.body.answers || {};
  let correct = 0;
  const review = live.questions.map((q) => {
    const selected = answers[q.no];
    const ok = gradeQuestion(q, selected);
    if (ok) correct += 1;
    return {
      no: q.no,
      q: q.q,
      type: isShortQuestion(q) ? "short" : "mcq",
      choices: q.choices || [],
      answer: q.answer,
      selected,
      ok,
      explain: q.explain,
      images: sanitizeImages(q.images),
      choiceImages: Array.isArray(q.choiceImages) ? q.choiceImages.map(sanitizeImages) : [],
    };
  });
  const total = live.questions.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const attempt = {
    id: uid("a"),
    userId: req.session.userId,
    userName: req.session.name,
    examId: live.examId,
    title: live.title,
    correct,
    total,
    percent,
    at: new Date().toISOString(),
    review,
  };
  try {
    await dbx.ensureMongo();
    if (dbx.mongoReady()) {
      await dbx.saveAttempt(attempt);
    } else if (process.env.MONGO_URI || process.env.VERCEL) {
      return res.status(503).json({ error: "응시 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
    backupAttemptJson(attempt);
    await clearLiveExam(req.token);
    res.json(attempt);
  } catch (err) {
    res.status(500).json({ error: err.message || "응시 결과를 저장하지 못했습니다." });
  }
});

app.get("/api/me/attempts", auth, async (req, res) => {
  try {
    await dbx.ensureMongo();
    const mongoList = dbx.mongoReady() ? await dbx.listAttempts(req.session.userId) : [];
    const jsonList = (loadDb().attempts || []).filter((item) => item.userId === req.session.userId);
    res.json(mergeAttempts(mongoList, jsonList));
  } catch (err) {
    res.status(500).json({ error: err.message || "응시 기록을 불러오지 못했습니다." });
  }
});

app.get("/api/admin/settings", auth, adminOnly, async (req, res) => {
  const settings = await getSettings();
  res.json(publicSettings(settings));
});

app.put("/api/admin/settings", auth, adminOnly, async (req, res) => {
  const patch = {};
  let passwordChanged = false;

  if (Object.prototype.hasOwnProperty.call(req.body, "entryCode")) {
    const entryCode = String(req.body.entryCode || "").trim();
    if (!entryCode) return res.status(400).json({ error: "입장코드를 입력해 주세요." });
    patch.entryCode = entryCode;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "adminPassword")) {
    const nextPassword = String(req.body.adminPassword || "").trim();
    const confirmPassword = String(req.body.adminPasswordConfirm || "").trim();
    if (nextPassword.length < 4) {
      return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
    }
    if (confirmPassword && nextPassword !== confirmPassword) {
      return res.status(400).json({ error: "비밀번호 확인이 일치하지 않습니다." });
    }
    patch.adminPassword = hash(nextPassword);
    passwordChanged = true;
  }

  const settings = await writeSettings(patch);
  res.json({
    ok: true,
    entryCode: settings.entryCode,
    passwordChanged,
  });
});

app.get("/api/admin/exams", auth, adminOnly, async (req, res) => {
  const exams = await listAllExams();
  res.json(
    exams.map((exam) => ({
      ...publicExam(exam),
      questionCount: (exam.questions && exam.questions.length) || exam.questionCount || 0,
      customQuestions: (exam.questions || []).length,
    }))
  );
});

app.post("/api/admin/exams", auth, adminOnly, async (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title) return res.status(400).json({ error: "시험 제목을 입력해 주세요." });
  const exam = {
    id: uid("exam"),
    title,
    desc: String(req.body.desc || "").trim(),
    category: examGradeLabel(req.body.category),
    minutes: Number(req.body.minutes) || 40,
    tag: String(req.body.tag || "시험").trim(),
    questionCount: 0,
    seed: Date.now() % 100000,
    password: req.body.password ? hash(req.body.password) : "",
    questions: [],
  };
  await writeExam(exam);
  res.json(publicExam(exam));
});

app.put("/api/admin/exams/:id", auth, adminOnly, async (req, res) => {
  const exam = await findExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  if (req.body.title) exam.title = String(req.body.title).trim();
  if (req.body.desc != null) exam.desc = String(req.body.desc).trim();
  if (req.body.category) exam.category = examGradeLabel(req.body.category);
  if (req.body.minutes) exam.minutes = Number(req.body.minutes) || exam.minutes;
  if (req.body.tag) exam.tag = String(req.body.tag).trim();
  if (req.body.password === "") exam.password = "";
  else if (req.body.password) exam.password = hash(req.body.password);
  await writeExam(exam);
  res.json(publicExam(exam));
});

app.delete("/api/admin/exams/:id", auth, adminOnly, async (req, res) => {
  const exam = await removeExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  removeExamMedia(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/exams/:id/questions", auth, adminOnly, async (req, res) => {
  const exam = await findExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  res.json({
    exam: publicExam(exam),
    questions: exam.questions || [],
    usingBank: !(exam.questions && exam.questions.length),
  });
});

app.post("/api/admin/exams/:id/questions", auth, adminOnly, async (req, res) => {
  const q = String(req.body.q || "").trim();
  const type = req.body.type === "short" ? "short" : "mcq";
  const explain = String(req.body.explain || "").trim();
  const section = String(req.body.section || "").trim();
  if (!q) return res.status(400).json({ error: "문제를 입력해 주세요." });
  const exam = await findExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  exam.questions = exam.questions || [];
  if (type === "short") {
    const answer = String(req.body.answerText != null ? req.body.answerText : req.body.answer || "").trim();
    if (!answer) return res.status(400).json({ error: "주관식 정답을 입력해 주세요." });
    exam.questions.push({ q, type: "short", choices: [], answer, explain, section });
  } else {
    const choices = Array.isArray(req.body.choices) ? req.body.choices.map((item) => String(item || "").trim()) : [];
    const answer = Number(req.body.answer);
    if (choices.length < 2 || choices.some((item) => !item) || Number.isNaN(answer)) {
      return res.status(400).json({ error: "문제, 보기, 정답을 모두 입력해 주세요." });
    }
    exam.questions.push({ q, type: "mcq", choices, answer, explain, section });
  }
  exam.questionCount = exam.questions.length;
  await writeExam(exam);
  res.json({ ok: true, questions: exam.questions });
});

app.post("/api/admin/exams/:id/questions/bulk", auth, adminOnly, async (req, res) => {
  const items = Array.isArray(req.body.questions) ? req.body.questions : [];
  if (!items.length) return res.status(400).json({ error: "등록할 문항이 없습니다." });
  const exam = await findExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  exam.questions = exam.questions || [];
  items.forEach((item) => {
    const q = String(item.q || "").trim();
    if (!q) return;
    const type = item.type === "short" || item.type === "주관식" || !(Array.isArray(item.choices) && item.choices.filter(Boolean).length >= 2)
      ? "short"
      : "mcq";
    if (type === "short") {
      const media = persistQuestionMedia(exam.id, item);
      exam.questions.push({
        q,
        type: "short",
        choices: [],
        answer: String(item.answer || "").trim(),
        explain: String(item.explain || "").trim(),
        section: String(item.section || "").trim(),
        images: media.images,
        choiceImages: [],
      });
      return;
    }
    const choices = Array.isArray(item.choices)
      ? item.choices.map((choice) => String(choice || "").trim()).filter(Boolean)
      : [];
    const answer = Number(item.answer);
    if (choices.length < 2 || Number.isNaN(answer)) return;
    const media = persistQuestionMedia(exam.id, item);
    exam.questions.push({
      q,
      type: "mcq",
      choices,
      answer,
      explain: String(item.explain || "").trim(),
      section: String(item.section || "").trim(),
      images: media.images,
      choiceImages: media.choiceImages,
      choiceLabels: Array.isArray(item.choiceLabels) ? item.choiceLabels.map((label) => String(label || "")) : [],
    });
  });
  exam.questionCount = exam.questions.length;
  await writeExam(exam);
  res.json({ ok: true, count: exam.questions.length, questions: exam.questions });
});

app.post("/api/admin/exams/:id/import-pdf", auth, adminOnly, async (req, res) => {
  try {
    const text = await extractTextFromUpload(req.body.pdf, req.body.filename || "questions.pdf");
    const result = parseQuestionsFromText(text);
    persistParsedQuestions(req.params.id, result.questions);
    if (!result.questions.length) {
      return res.status(400).json({
        error: "문항을 찾지 못했습니다. 글자가 선택되는 PDF인지, 1. 과 ① ② 형식으로 되어 있는지 확인해 주세요.",
        preview: previewImportedText(result.text),
      });
    }
    res.json({
      count: result.questions.length,
      answerCount: result.answerCount || 0,
      unmatched: result.unmatched || [],
      questions: result.questions,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "PDF를 읽지 못했습니다. 텍스트가 있는 PDF만 사용할 수 있습니다." });
  }
});

app.post("/api/admin/exams/:id/import-docx", auth, adminOnly, async (req, res) => {
  try {
    const text = await extractTextFromUpload(req.body.docx, req.body.filename || "questions.docx", {
      persistImagesForExam: req.params.id,
    });
    const result = parseQuestionsFromText(text);
    persistParsedQuestions(req.params.id, result.questions);
    if (!result.questions.length) {
      return res.status(400).json({
        error: "문항을 찾지 못했습니다. 1. 문제와 ① ② 또는 (1)(2) 보기 형식인지, 파일이 .docx인지 확인해 주세요.",
        preview: previewImportedText(result.text),
      });
    }
    res.json({
      count: result.questions.length,
      answerCount: result.answerCount || 0,
      unmatched: result.unmatched || [],
      questions: result.questions,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Word 파일을 읽지 못했습니다. .doc 이 아니라 .docx로 저장해 주세요." });
  }
});

app.post("/api/admin/exams/:id/import-answers", auth, adminOnly, async (req, res) => {
  try {
    const questions = Array.isArray(req.body.questions) ? req.body.questions : [];
    if (!questions.length) {
      return res.status(400).json({ error: "먼저 문항 파일을 올려 주세요." });
    }
    const text = await extractTextFromUpload(req.body.file || req.body.answers, req.body.filename || "answers.txt", {
      tablesAsText: true,
    });
    const keys = parseAnswerKeyFromText(String(text || "").replace(/<<IMG\s+[\s\S]*?>>/g, " "));
    if (!keys.length) {
      return res.status(400).json({
        error: "정답을 찾지 못했습니다. 1. ③ 또는 1번 3, 1,3 형식으로 번호와 답이 적혀 있는지 확인해 주세요.",
        preview: text.slice(0, 500),
      });
    }
    const applied = applyAnswersToQuestions(questions, keys);
    res.json({
      count: keys.length,
      answerCount: applied.matched,
      unmatched: applied.unmatched,
      questions: applied.questions,
      preview: text.slice(0, 300),
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "정답 파일을 읽지 못했습니다." });
  }
});

app.post("/api/admin/exams/:id/import-explains", auth, adminOnly, async (req, res) => {
  try {
    const questions = Array.isArray(req.body.questions) ? req.body.questions : [];
    if (!questions.length) {
      return res.status(400).json({ error: "먼저 문항 파일을 올려 주세요." });
    }
    const text = await extractTextFromUpload(req.body.file || req.body.explains, req.body.filename || "explains.txt", {
      tablesAsText: true,
    });
    const keys = parseExplainKeyFromText(String(text || "").replace(/<<IMG\s+[\s\S]*?>>/g, " "));
    if (!keys.length) {
      return res.status(400).json({
        error: "해설을 찾지 못했습니다. 1. 또는 1번 뒤에 해설이 적혀 있는지 확인해 주세요.",
        preview: text.slice(0, 500),
      });
    }
    const applied = applyExplainsToQuestions(questions, keys);
    res.json({
      count: keys.length,
      explainCount: applied.matched,
      unmatched: applied.unmatched,
      questions: applied.questions,
      preview: text.slice(0, 300),
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "해설 파일을 읽지 못했습니다." });
  }
});

app.delete("/api/admin/exams/:id/questions/:index", auth, adminOnly, async (req, res) => {
  const exam = await findExam(req.params.id);
  if (!exam) return res.status(404).json({ error: "시험을 찾을 수 없습니다." });
  const index = Number(req.params.index);
  exam.questions = exam.questions || [];
  exam.questions.splice(index, 1);
  exam.questionCount = exam.questions.length;
  await writeExam(exam);
  res.json({ ok: true, questions: exam.questions });
});

app.get("/api/admin/attempts", auth, adminOnly, async (req, res) => {
  try {
    await dbx.ensureMongo();
    const mongoList = dbx.mongoReady() ? await dbx.listAttempts() : [];
    const jsonList = loadDb().attempts || [];
    const list = mergeAttempts(mongoList, jsonList);
    res.json(
      list.map((item) => ({
        id: item.id,
        userId: item.userId,
        userName: item.userName,
        title: item.title,
        correct: item.correct,
        total: item.total,
        percent: item.percent,
        at: item.at,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message || "응시 기록을 불러오지 못했습니다." });
  }
});

app.delete("/api/admin/attempts/:id", auth, adminOnly, async (req, res) => {
  try {
    let removed = false;
    if (dbx.mongoReady()) {
      const attempt = await dbx.deleteAttempt(req.params.id);
      if (attempt) removed = true;
    }
    try {
      const db = loadDb();
      const before = (db.attempts || []).length;
      db.attempts = (db.attempts || []).filter((item) => item.id !== req.params.id);
      if (db.attempts.length !== before) {
        saveDb(db);
        removed = true;
      }
    } catch (err) {
      console.error("응시 기록 로컬 삭제 실패:", err.message);
    }
    if (!removed) return res.status(404).json({ error: "응시 기록을 찾을 수 없습니다." });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "응시 기록을 삭제하지 못했습니다." });
  }
});

function jsonUsersWithCounts(db) {
  return (db.users || []).map((user) => {
    const mine = (db.attempts || []).filter((item) => item.userId === user.id);
    const last = mine[0];
    return {
      id: user.id,
      name: user.name,
      examNo: dbx.formatExamNo(user.examNo),
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || "",
      disabled: Boolean(user.disabled),
      attemptCount: mine.length,
      lastAttemptAt: last ? last.at : "",
    };
  });
}

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  try {
    if (dbx.mongoReady()) {
      const users = await dbx.listUsers();
      return res.json({ mongo: true, users });
    }
    res.json({ mongo: false, users: jsonUsersWithCounts(loadDb()) });
  } catch (err) {
    res.status(500).json({ error: err.message || "회원 목록을 불러오지 못했습니다." });
  }
});

app.patch("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  try {
    if (dbx.mongoReady()) {
      const user = await dbx.setUserDisabled(req.params.id, Boolean(req.body.disabled));
      if (!user) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
      return res.json({ ok: true, user: dbx.publicUser(user) });
    }
    const db = loadDb();
    const user = db.users.find((item) => item.id === req.params.id);
    if (!user) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
    user.disabled = Boolean(req.body.disabled);
    saveDb(db);
    res.json({ ok: true, user: { id: user.id, name: user.name, disabled: user.disabled } });
  } catch (err) {
    res.status(500).json({ error: err.message || "회원 상태를 바꾸지 못했습니다." });
  }
});

app.post("/api/admin/users/:id/reset-password", auth, adminOnly, async (req, res) => {
  const password = String(req.body.password || "").trim();
  if (password.length < 4) {
    return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
  }
  try {
    if (dbx.mongoReady()) {
      const user = await dbx.resetUserPassword(req.params.id, hash(password));
      if (!user) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
      return res.json({ ok: true });
    }
    const db = loadDb();
    const user = db.users.find((item) => item.id === req.params.id);
    if (!user) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
    user.password = hash(password);
    saveDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "비밀번호를 바꾸지 못했습니다." });
  }
});

app.delete("/api/admin/users/:id", auth, adminOnly, async (req, res) => {
  try {
    if (dbx.mongoReady()) {
      const user = await dbx.deleteUser(req.params.id);
      if (!user) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
      return res.json({ ok: true });
    }
    const db = loadDb();
    const index = db.users.findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "회원을 찾을 수 없습니다." });
    const userId = db.users[index].id;
    db.users.splice(index, 1);
    db.attempts = (db.attempts || []).filter((item) => item.userId !== userId);
    saveDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "회원을 삭제하지 못했습니다." });
  }
});

if (require.main === module) {
  boot.finally(() => {
    app.listen(PORT, () => {
      loadDb();
      console.log(`온코드랩 시험장 http://127.0.0.1:${PORT}`);
      console.log(dbx.mongoReady() ? "회원 DB: MongoDB" : "회원 DB: JSON (MongoDB 미연결)");
    });
  });
}

module.exports = app;
