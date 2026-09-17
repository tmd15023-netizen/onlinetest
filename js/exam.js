const ExamEngine = {
  async start(exam, password) {
    const payload = await Api.startExam(exam.id, password);
    const session = {
      examId: payload.examId,
      title: payload.title,
      category: payload.category || "",
      minutes: payload.minutes,
      startedAt: payload.startedAt,
      endsAt: payload.endsAt,
      index: 0,
      answers: {},
      marked: {},
      fontScale: 1,
      layout: "side",
      questions: payload.questions,
    };
    Storage.saveSession(session);
    window.__liveExam = session;
    location.hash = "#/exam";
  },

  remaining(session) {
    return Math.max(0, session.endsAt - Date.now());
  },

  formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  },

  async submit(session) {
    const attempt = await Api.submitExam(session.answers, session.examId);
    Storage.addAttempt(attempt);
    const wrong = (attempt.review || [])
      .filter((item) => !item.ok)
      .map((item) => ({
        id: `${attempt.id}-${item.no}`,
        examTitle: session.title,
        ...item,
      }));
    Storage.addWrong(wrong);
    Storage.clearSession();
    sessionStorage.setItem("oncodelab.lastResult", JSON.stringify(attempt));
    location.hash = "#/result";
  },
};
