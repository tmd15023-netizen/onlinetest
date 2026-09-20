window.Api = {
  token() {
    return sessionStorage.getItem("oncodelab.token") || "";
  },
  setSession(token, user) {
    sessionStorage.setItem("oncodelab.token", token);
    sessionStorage.removeItem("oncodelab.loggedOut");
    Storage.setUser(user);
  },
  clearSession() {
    sessionStorage.removeItem("oncodelab.token");
    Storage.clearUser();
    Storage.clearSession();
  },
  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const body = options.body;
    const binary = typeof Blob !== "undefined" && (body instanceof Blob || (typeof File !== "undefined" && body instanceof File));
    if (!binary && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json; charset=utf-8";
    }
    if (this.token()) headers.Authorization = `Bearer ${this.token()}`;
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (err) {
      throw new Error("서버에 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 413) throw new Error("파일이 너무 큽니다. 문항 파일만 올리거나 이미지 용량을 줄여 주세요.");
      if (res.status === 502 || res.status === 504) {
        throw new Error("파일 분석 시간이 초과되었습니다. 파일이 크면 문항 페이지만 올려 주세요.");
      }
      throw new Error(data.error || `요청에 실패했습니다. (${res.status})`);
    }
    return data;
  },
  login(body) {
    return this.request("/api/login", { method: "POST", body: JSON.stringify(body) });
  },
  adminLogin(body) {
    return this.request("/api/admin/login", { method: "POST", body: JSON.stringify(body) });
  },
  exams() {
    return this.request("/api/exams");
  },
  notices() {
    return this.request("/api/notices");
  },
  startExam(id, password) {
    return this.request(`/api/exams/${encodeURIComponent(id)}/start`, {
      method: "POST",
      body: JSON.stringify({ password: password || "" }),
    });
  },
  liveExam() {
    return this.request("/api/exams/live");
  },
  submitExam(answers, examId) {
    return this.request("/api/exams/submit", {
      method: "POST",
      body: JSON.stringify({ answers, examId: examId || "" }),
    });
  },
  myAttempts() {
    return this.request("/api/me/attempts");
  },
  adminSettings() {
    return this.request("/api/admin/settings");
  },
  saveSettings(body) {
    return this.request("/api/admin/settings", { method: "PUT", body: JSON.stringify(body) });
  },
  adminExams() {
    return this.request("/api/admin/exams");
  },
  createExam(body) {
    return this.request("/api/admin/exams", { method: "POST", body: JSON.stringify(body) });
  },
  updateExam(id, body) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  deleteExam(id) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  examQuestions(id) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/questions`);
  },
  addQuestion(id, body) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/questions`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateQuestion(id, index, body) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/questions/${encodeURIComponent(index)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  bulkQuestions(id, questions, extra = {}) {
    const packed = (questions || []).map((item) => ({
      ...item,
      images: (item.images || []).filter((src) => String(src || "").startsWith("/media/") || String(src || "").startsWith("data:image/")),
      choiceImages: Array.isArray(item.choiceImages)
        ? item.choiceImages.map((row) =>
            (row || []).filter((src) => String(src || "").startsWith("/media/") || String(src || "").startsWith("data:image/"))
          )
        : [],
    }));
    const size = 8;
    return (async () => {
      let last = { ok: true, questions: [] };
      for (let i = 0; i < packed.length; i += size) {
        last = await this.request(`/api/admin/exams/${encodeURIComponent(id)}/questions/bulk`, {
          method: "POST",
          body: JSON.stringify({
            questions: packed.slice(i, i + size),
            title: extra.title || "",
            category: extra.category || "",
            minutes: extra.minutes,
            replace: Boolean(extra.replace) && i === 0,
          }),
        });
      }
      return last;
    })();
  },
  importPdf(id, pdf, filename) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-pdf`, {
      method: "POST",
      body: JSON.stringify({ pdf, filename }),
    });
  },
  importPdfFile(id, file) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-pdf`, {
      method: "POST",
      headers: { "X-Filename": encodeURIComponent(file && file.name ? file.name : "questions.pdf") },
      body: file,
    });
  },
  importDocx(id, docx, filename) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-docx`, {
      method: "POST",
      body: JSON.stringify({ docx, filename }),
    });
  },
  importDocxFile(id, file) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-docx`, {
      method: "POST",
      headers: { "X-Filename": encodeURIComponent(file && file.name ? file.name : "questions.docx") },
      body: file,
    });
  },
  importDocxParsed(id, payload) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-docx`, {
      method: "POST",
      body: JSON.stringify({
        filename: payload && payload.filename,
        html: payload && payload.html,
        rawText: payload && payload.rawText,
      }),
    });
  },
  uploadExamMedia(id, blob, mime) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/media`, {
      method: "POST",
      headers: { "Content-Type": mime || (blob && blob.type) || "application/octet-stream" },
      body: blob,
    });
  },
  importAnswers(id, file, filename, questions) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-answers`, {
      method: "POST",
      body: JSON.stringify({ file, filename, questions }),
    });
  },
  importExplains(id, file, filename, questions) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-explains`, {
      method: "POST",
      body: JSON.stringify({ file, filename, questions }),
    });
  },
  deleteQuestion(id, index) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/questions/${index}`, {
      method: "DELETE",
    });
  },
  adminAttempts() {
    return this.request("/api/admin/attempts");
  },
  deleteAttempt(id) {
    return this.request(`/api/admin/attempts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  adminNotices() {
    return this.request("/api/admin/notices");
  },
  createNotice(body) {
    return this.request("/api/admin/notices", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateNotice(id, body) {
    return this.request(`/api/admin/notices/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  deleteNotice(id) {
    return this.request(`/api/admin/notices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
  adminUsers() {
    return this.request("/api/admin/users");
  },
  setUserDisabled(id, disabled) {
    return this.request(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ disabled }),
    });
  },
  resetUserPassword(id, password) {
    return this.request(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
  deleteUser(id) {
    return this.request(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

const Api = window.Api;

async function loadExams() {
  const list = await Api.exams();
  window.LIVE_EXAMS = list;
  return list;
}

function getExamList() {
  return window.LIVE_EXAMS || EXAMS;
}
