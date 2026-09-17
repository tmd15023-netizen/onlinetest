const STORE_KEYS = {
  user: "oncodelab.user",
  attempts: "oncodelab.attempts",
  wrong: "oncodelab.wrong",
  session: "oncodelab.session",
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    if (key === STORE_KEYS.session) {
      const slim = {
        ...value,
        questions: (value.questions || []).map((item) => ({
          ...item,
          images: [],
          choiceImages: [],
        })),
      };
      try {
        localStorage.setItem(key, JSON.stringify(slim));
      } catch (ignored) {}
    }
  }
}

const Storage = {
  getUser() {
    return readJson(STORE_KEYS.user, null);
  },
  setUser(user) {
    writeJson(STORE_KEYS.user, user);
  },
  clearUser() {
    localStorage.removeItem(STORE_KEYS.user);
  },
  getAttempts() {
    return readJson(STORE_KEYS.attempts, []);
  },
  addAttempt(attempt) {
    const list = Storage.getAttempts();
    list.unshift(attempt);
    writeJson(STORE_KEYS.attempts, list.slice(0, 80));
    return list;
  },
  bestScore(examId) {
    const scores = Storage.getAttempts()
      .filter((item) => item.examId === examId)
      .map((item) => item.percent);
    return scores.length ? Math.max(...scores) : null;
  },
  getWrong() {
    return readJson(STORE_KEYS.wrong, []);
  },
  addWrong(items) {
    const current = Storage.getWrong();
    const merged = [...items, ...current].slice(0, 100);
    writeJson(STORE_KEYS.wrong, merged);
  },
  removeWrong(id) {
    writeJson(
      STORE_KEYS.wrong,
      Storage.getWrong().filter((item) => item.id !== id)
    );
  },
  saveSession(session) {
    writeJson(STORE_KEYS.session, session);
  },
  getSession() {
    const live = window.__liveExam;
    const stored = readJson(STORE_KEYS.session, null);
    if (live && stored && live.examId === stored.examId) return live;
    return live || stored;
  },
  clearSession() {
    localStorage.removeItem(STORE_KEYS.session);
  },
};
