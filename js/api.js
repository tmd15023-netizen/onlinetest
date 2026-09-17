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
    const headers = { "Content-Type": "application/json; charset=utf-8", ...(options.headers || {}) };
    if (this.token()) headers.Authorization = `Bearer ${this.token()}`;
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch (err) {
      throw new Error("서버에 연결되지 않았습니다. 잠시 후 다시 시도해 주세요.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "요청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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
  bulkQuestions(id, questions) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/questions/bulk`, {
      method: "POST",
      body: JSON.stringify({ questions }),
    });
  },
  importPdf(id, pdf, filename) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-pdf`, {
      method: "POST",
      body: JSON.stringify({ pdf, filename }),
    });
  },
  importDocx(id, docx, filename) {
    return this.request(`/api/admin/exams/${encodeURIComponent(id)}/import-docx`, {
      method: "POST",
      body: JSON.stringify({ docx, filename }),
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
