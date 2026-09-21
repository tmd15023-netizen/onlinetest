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

function keepStoredImage(src) {
  const value = String(src || "").trim();
  return value.startsWith("/media/") || value.startsWith("/api/media/");
}

function slimImageList(list) {
  return (list || []).filter(keepStoredImage);
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
          images: slimImageList(item.images),
          choiceImages: Array.isArray(item.choiceImages) ? item.choiceImages.map(slimImageList) : [],
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
    if (live && stored && live.examId === stored.examId) {
      const liveHas = (live.questions || []).some((q) => (q.images || []).length);
      const storedHas = (stored.questions || []).some((q) => (q.images || []).length);
      if (!liveHas && storedHas) {
        live.questions = (live.questions || []).map((q, i) => {
          const src = stored.questions[i];
          if (!src) return q;
          return {
            ...q,
            images: q.images && q.images.length ? q.images : src.images || [],
            choiceImages: q.choiceImages && q.choiceImages.length ? q.choiceImages : src.choiceImages || [],
          };
        });
      }
      return live;
    }
    return live || stored;
  },
  clearSession() {
    localStorage.removeItem(STORE_KEYS.session);
  },
};
