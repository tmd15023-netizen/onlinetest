require("dotenv").config();
const fs = require("fs");
const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");

const STORE_PATH = path.join(__dirname, "data", "store.json");

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
    lastLoginAt: { type: String, default: "" },
    examNo: { type: String, default: "" },
    disabled: { type: Boolean, default: false },
  },
  { collection: "users" }
);

const attemptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: String,
    userName: String,
    examId: String,
    title: String,
    correct: Number,
    total: Number,
    percent: Number,
    at: String,
    review: { type: Array, default: [] },
  },
  { collection: "attempts" }
);

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "app", unique: true },
    entryCode: { type: String, required: true },
    adminId: { type: String, required: true },
    adminPassword: { type: String, required: true },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: "settings" }
);

const examSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: String,
    desc: String,
    category: String,
    minutes: Number,
    tag: String,
    questionCount: Number,
    seed: Number,
    demoBest: Number,
    password: { type: String, default: "" },
    questions: { type: Array, default: [] },
  },
  { collection: "exams", id: false }
);

const noticeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    pinned: { type: Boolean, default: false },
    title: String,
    date: String,
    body: String,
    createdAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: "notices" }
);

const User = mongoose.model("User", userSchema);
const Attempt = mongoose.model("Attempt", attemptSchema);
const Settings = mongoose.model("Settings", settingsSchema);
const Exam = mongoose.model("Exam", examSchema);
const Notice = mongoose.model("Notice", noticeSchema);
const mediaSchema = new mongoose.Schema(
  {
    examId: { type: String, required: true },
    name: { type: String, required: true },
    mime: String,
    data: Buffer,
  },
  { collection: "media" }
);
mediaSchema.index({ examId: 1, name: 1 }, { unique: true });
const Media = mongoose.model("Media", mediaSchema);
const LiveExam = mongoose.model(
  "LiveExam",
  new mongoose.Schema(
    {
      token: { type: String, required: true, unique: true },
      examId: String,
      title: String,
      minutes: Number,
      questions: { type: Array, default: [] },
      startedAt: Number,
      endsAt: Number,
      savedAt: { type: Date, default: Date.now, expires: 28800 },
    },
    { collection: "live_exams" }
  )
);

let connected = false;

function mongoReady() {
  return connected && mongoose.connection.readyState === 1;
}

function safeUri(uri) {
  return String(uri || "").replace(/\/\/([^/@]+)@/, "//***@");
}

async function migrateFromJson() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch (err) {
    return;
  }
  if (Array.isArray(raw.users) && raw.users.length) {
    let added = 0;
    for (const item of raw.users) {
      const name = String(item.name || "").trim();
      if (!name || name.includes("?")) continue;
      const exists = await User.findOne({
        $or: [{ id: item.id }, { name }],
      }).lean();
      if (exists) continue;
      await User.create({
        id: item.id,
        name,
        password: item.password,
        examNo: item.examNo || "",
        createdAt: item.createdAt || new Date().toISOString(),
        lastLoginAt: item.lastLoginAt || "",
        disabled: Boolean(item.disabled),
      });
      added += 1;
    }
    if (added) console.log(`회원 ${added}명을 MongoDB로 옮겼습니다.`);
  }
  if (Array.isArray(raw.attempts) && raw.attempts.length && (await Attempt.countDocuments()) === 0) {
    await Attempt.insertMany(raw.attempts);
    console.log(`응시 기록 ${raw.attempts.length}건을 MongoDB로 옮겼습니다.`);
  }
  if (raw.settings && !(await Settings.findOne({ key: "app" }).lean())) {
    await Settings.create({
      key: "app",
      entryCode: raw.settings.entryCode,
      adminId: raw.settings.adminId,
      adminPassword: raw.settings.adminPassword,
      updatedAt: new Date().toISOString(),
    });
    console.log("관리자 비밀번호·입장코드를 MongoDB로 옮겼습니다.");
  }
}

async function connectMongo() {
  const uri = process.env.MONGO_URI || (process.env.VERCEL ? "" : "mongodb://127.0.0.1:27017/oncodelab_exam");
  if (!uri) {
    connected = false;
    return false;
  }
  try {
    if (mongoose.connection.readyState === 1) {
      connected = true;
      return true;
    }
    try {
      dns.setDefaultResultOrder("ipv4first");
    } catch (err) {
      /* Node 버전에 따라 없을 수 있음 */
    }
    if (!process.env.VERCEL && String(uri).includes("mongodb+srv://")) {
      dns.setServers(["8.8.8.8", "1.1.1.1", "168.126.63.1"]);
    }
    const options = {
      serverSelectionTimeoutMS: process.env.VERCEL ? 8000 : 8000,
      maxPoolSize: process.env.VERCEL ? 1 : 10,
    };
    if (!process.env.VERCEL) options.family = 4;
    await mongoose.connect(uri, options);
    connected = true;
    if (!process.env.VERCEL) await migrateFromJson();
    console.log(`MongoDB 연결됨 ${safeUri(uri)}`);
    return true;
  } catch (err) {
    connected = false;
    console.error("MongoDB 연결 실패:", err.message);
    return false;
  }
}

async function ensureMongo() {
  if (mongoReady()) return true;
  if (!process.env.MONGO_URI) return false;
  return connectMongo();
}

function formatExamNo(value) {
  const n = parseInt(String(value || "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? String(n).padStart(4, "0") : "";
}

function nextExamNoFromList(users) {
  let max = 0;
  (users || []).forEach((user) => {
    const n = parseInt(formatExamNo(user.examNo), 10);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return String(max + 1).padStart(4, "0");
}

function publicUser(user, extra = {}) {
  return {
    id: user.id,
    name: user.name,
    examNo: formatExamNo(user.examNo),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || "",
    disabled: Boolean(user.disabled),
    ...extra,
  };
}

async function nextExamNo() {
  if (!mongoReady()) return "0001";
  await resequenceExamNos();
  const users = await User.find({}, { examNo: 1 }).lean();
  return nextExamNoFromList(users);
}

async function resequenceExamNos() {
  if (!mongoReady()) return;
  const users = await User.find({}).sort({ createdAt: 1, _id: 1 }).lean();
  for (let i = 0; i < users.length; i += 1) {
    const examNo = String(i + 1).padStart(4, "0");
    if (formatExamNo(users[i].examNo) !== examNo) {
      await User.updateOne({ id: users[i].id }, { $set: { examNo } });
    }
  }
}

async function ensureExamNo(user) {
  if (!user) return user;
  const current = formatExamNo(user.examNo);
  if (current) {
    user.examNo = current;
    return user;
  }
  const examNo = await nextExamNo();
  user.examNo = examNo;
  if (mongoReady() && user.id) {
    await User.updateOne({ id: user.id }, { $set: { examNo } });
  }
  return user;
}

async function findUserByName(name) {
  if (!mongoReady()) return null;
  const value = String(name || "").trim().normalize("NFC");
  if (!value) return null;
  const exact = await User.findOne({ name: value }).lean();
  if (exact) return exact;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.findOne({ name: { $regex: `^${escaped}$`, $options: "i" } }).lean();
}

async function createUser(user) {
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  await User.create(user);
  return user;
}

async function touchLogin(userId) {
  if (!mongoReady()) return;
  await User.updateOne({ id: userId }, { $set: { lastLoginAt: new Date().toISOString() } });
}

function compactAttempt(attempt) {
  return {
    ...attempt,
    review: (attempt.review || []).map((row) => ({
      no: row.no,
      q: row.q,
      type: row.type,
      choices: row.choices,
      answer: row.answer,
      selected: row.selected,
      ok: row.ok,
      explain: row.explain,
    })),
  };
}

async function saveAttempt(attempt) {
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  try {
    await Attempt.create(attempt);
  } catch (err) {
    await Attempt.create(compactAttempt(attempt));
  }
}

async function saveLiveExam(token, live) {
  if (!mongoReady()) return;
  try {
    await LiveExam.findOneAndUpdate(
      { token },
      {
        $set: {
          token,
          examId: live.examId,
          title: live.title,
          minutes: live.minutes,
          questions: live.questions,
          startedAt: live.startedAt,
          endsAt: live.endsAt,
          savedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("진행 중 시험 저장 실패:", err.message);
  }
}

async function findLiveExam(token) {
  if (!mongoReady()) return null;
  const doc = await LiveExam.findOne({ token }).lean();
  if (!doc) return null;
  return {
    examId: doc.examId,
    title: doc.title,
    minutes: doc.minutes,
    questions: doc.questions || [],
    startedAt: doc.startedAt,
    endsAt: doc.endsAt,
  };
}

async function deleteLiveExam(token) {
  if (!mongoReady()) return;
  await LiveExam.deleteOne({ token });
}

async function deleteAttempt(id) {
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  return Attempt.findOneAndDelete({ id }).lean();
}

async function listAttempts(userId) {
  if (!mongoReady()) return [];
  const query = userId ? { userId } : {};
  return Attempt.find(query).sort({ at: -1 }).limit(300).lean();
}

async function listUsers() {
  if (!mongoReady()) return [];
  await resequenceExamNos();
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  let byId = {};
  try {
    const counts = await Attempt.aggregate([{ $group: { _id: "$userId", count: { $sum: 1 }, last: { $max: "$at" } } }]);
    byId = Object.fromEntries(counts.map((item) => [item._id, item]));
  } catch (err) {
    console.error("응시 횟수를 집계하지 못했습니다:", err.message);
  }
  return users.map((user) =>
    publicUser(user, {
      attemptCount: (byId[user.id] && byId[user.id].count) || 0,
      lastAttemptAt: (byId[user.id] && byId[user.id].last) || "",
    })
  );
}

async function setUserDisabled(id, disabled) {
  const user = await User.findOneAndUpdate({ id }, { $set: { disabled: Boolean(disabled) } }, { new: true }).lean();
  return user;
}

async function resetUserPassword(id, passwordHash) {
  const user = await User.findOneAndUpdate({ id }, { $set: { password: passwordHash } }, { new: true }).lean();
  return user;
}

async function deleteUser(id) {
  const user = await User.findOneAndDelete({ id }).lean();
  if (user) await Attempt.deleteMany({ userId: id });
  await resequenceExamNos();
  return user;
}

async function getSettings() {
  if (!mongoReady()) return null;
  return Settings.findOne({ key: "app" }).lean();
}

async function saveSettings(patch) {
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  const { _id, __v, ...clean } = patch;
  const next = {
    ...clean,
    key: "app",
    updatedAt: new Date().toISOString(),
  };
  return Settings.findOneAndUpdate({ key: "app" }, { $set: next }, { upsert: true, new: true }).lean();
}

async function ensureSettings(defaults) {
  if (!mongoReady()) return defaults;
  const current = await getSettings();
  if (current) return current;
  await Settings.create({ key: "app", ...defaults, updatedAt: new Date().toISOString() });
  return getSettings();
}

async function listExams() {
  await ensureMongo();
  if (!mongoReady()) return [];
  return Exam.find({}).lean();
}

async function findExam(id) {
  await ensureMongo();
  if (!mongoReady()) return null;
  const want = decodeURIComponent(String(id || "")).trim();
  if (!want) return null;
  const found = await Exam.findOne({ id: want }).lean();
  if (found) return found;
  const all = await Exam.find({}).lean();
  return all.find((item) => String(item.id) === want || String(item._id) === want) || null;
}

function examPayload(exam) {
  const { _id, __v, ...rest } = exam || {};
  return {
    id: String(rest.id || exam.id || "").trim(),
    title: rest.title,
    desc: rest.desc,
    category: rest.category,
    minutes: rest.minutes,
    tag: rest.tag,
    questionCount: rest.questionCount,
    seed: rest.seed,
    demoBest: rest.demoBest,
    password: rest.password || "",
    questions: Array.isArray(rest.questions) ? rest.questions : [],
  };
}

async function upsertExam(exam) {
  await ensureMongo();
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  const payload = examPayload(exam);
  if (!payload.id) throw new Error("시험 ID가 없습니다.");
  return Exam.findOneAndUpdate({ id: payload.id }, { $set: payload }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
}

async function deleteExam(id) {
  await ensureMongo();
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  await Media.deleteMany({ examId: id });
  return Exam.findOneAndDelete({ id }).lean();
}

async function saveMedia(item) {
  if (!mongoReady()) await ensureMongo();
  if (!mongoReady() || !item || !item.examId || !item.name || !item.data) return false;
  await Media.findOneAndUpdate(
    { examId: item.examId, name: item.name },
    { $set: { mime: item.mime, data: item.data } },
    { upsert: true }
  );
  return true;
}

async function findMedia(examId, name) {
  if (!mongoReady()) await ensureMongo();
  if (!mongoReady()) return null;
  return Media.findOne({ examId, name }).lean();
}

async function deleteMediaByExam(examId) {
  if (!mongoReady()) await ensureMongo();
  if (!mongoReady() || !examId) return;
  await Media.deleteMany({ examId });
}

async function ensureExams(_defaults) {
  await ensureMongo();
  if (!mongoReady()) return [];
  return listExams();
}

function sortNotices(list) {
  return [...(list || [])].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return String(b.date || "").localeCompare(String(a.date || ""), "ko");
  });
}

async function listNotices() {
  if (!mongoReady()) return [];
  return sortNotices(await Notice.find({}).lean());
}

async function findNotice(id) {
  if (!mongoReady()) return null;
  return Notice.findOne({ id }).lean();
}

async function upsertNotice(notice) {
  if (!mongoReady()) throw new Error("MongoDB에 연결되지 않았습니다.");
  const { _id, __v, ...clean } = notice;
  return Notice.findOneAndUpdate({ id: clean.id }, { $set: clean }, { upsert: true, new: true }).lean();
}

async function deleteNotice(id) {
  if (!mongoReady()) return;
  await Notice.deleteOne({ id });
}

async function ensureNotices(_defaults) {
  if (!mongoReady()) return [];
  return listNotices();
}

module.exports = {
  connectMongo,
  ensureMongo,
  mongoReady,
  User,
  Attempt,
  Settings,
  Exam,
  Notice,
  publicUser,
  ensureExamNo,
  formatExamNo,
  nextExamNo,
  nextExamNoFromList,
  findUserByName,
  createUser,
  touchLogin,
  saveAttempt,
  saveLiveExam,
  findLiveExam,
  deleteLiveExam,
  deleteAttempt,
  listAttempts,
  listUsers,
  setUserDisabled,
  resetUserPassword,
  deleteUser,
  getSettings,
  saveSettings,
  ensureSettings,
  listExams,
  findExam,
  upsertExam,
  deleteExam,
  saveMedia,
  findMedia,
  deleteMediaByExam,
  ensureExams,
  listNotices,
  findNotice,
  upsertNotice,
  deleteNotice,
  ensureNotices,
  sortNotices,
};
