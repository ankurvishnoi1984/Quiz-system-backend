const {
  User,
  Department,
  Question,
  QuestionOption,
  Response,
  Participant,
  QaQuestion
} = require("../models");
const {
  assertStaffAccess,
  getSessionForAccess,
  buildRankingAnalytics,
  aggregateWordCloudCounts
} = require("./response.service");

function formatDurationMinutes(startedAt, endedAt) {
  if (!startedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}

function formatBucketLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function buildResponseTimeline(responses, startedAt, endedAt) {
  if (!startedAt) return [];

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (end <= start) return [];

  const durationMs = end - start;
  const bucketMs = Math.max(60_000, Math.ceil(durationMs / 12 / 60_000) * 60_000);
  const bucketCount = Math.max(1, Math.ceil(durationMs / bucketMs));

  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + index * bucketMs;
    return {
      bucket_start: new Date(bucketStart).toISOString(),
      bucket_label: formatBucketLabel(bucketStart),
      count: 0
    };
  });

  for (const row of responses) {
    if (!row.submitted_at) continue;
    const ts = new Date(row.submitted_at).getTime();
    if (ts < start || ts >= end) continue;
    const index = Math.min(bucketCount - 1, Math.floor((ts - start) / bucketMs));
    buckets[index].count += 1;
  }

  return buckets;
}

function buildQuestionResponseBreakdown(question, options, responses) {
  const questionResponses = responses.filter(
    (row) => Number(row.question_id) === Number(question.question_id)
  );
  const total = questionResponses.length;
  const type = question.question_type;

  if (["mcq", "true_false"].includes(type)) {
    return options.map((opt) => {
      const count = questionResponses.filter(
        (row) => Number(row.option_id) === Number(opt.option_id)
      ).length;
      return {
        option_id: Number(opt.option_id),
        option_text: opt.option_text,
        count,
        percent: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
      };
    });
  }

  if (type === "word_cloud") {
    return aggregateWordCloudCounts(questionResponses).map((row) => ({
      option_id: null,
      option_text: row.text,
      count: row.count,
      percent: total > 0 ? Number(((row.count / total) * 100).toFixed(2)) : 0
    }));
  }

  if (type === "rating") {
    const counts = new Map();
    for (const row of questionResponses) {
      const value = row.rating_value != null ? String(row.rating_value) : "—";
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([value, count]) => ({
        option_id: null,
        option_text: `Rating ${value}`,
        count,
        percent: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0
      }));
  }

  if (type === "ranking") {
    const analytics = buildRankingAnalytics(
      { ...question.toJSON?.() || question, QuestionOptions: options },
      questionResponses
    );
    const validResponses = analytics?.totalResponses || 0;
    return (analytics?.rankings || []).map((row) => ({
      option_id: row.optionId,
      option_text: row.optionText,
      count: row.firstPlaceCount,
      percent:
        validResponses > 0
          ? Number(((row.firstPlaceCount / validResponses) * 100).toFixed(2))
          : 0,
      average_score: row.averageScore,
      average_rank: row.averageRank
    }));
  }

  if (type === "open_text" || type === "fill_blank") {
    return [
      {
        option_id: null,
        option_text: "Text responses",
        count: total,
        percent: total > 0 ? 100 : 0
      }
    ];
  }

  return [];
}

async function getSessionSummaryReport({ sessionId, user }) {
  const session = await getSessionForAccess(sessionId);
  assertStaffAccess(user, session);

  const numericSessionId = Number(sessionId);

  const [host, questions, participants, responses, qaQuestions] = await Promise.all([
    User.findByPk(session.host_id, { attributes: ["user_id", "full_name", "email"] }),
    Question.findAll({
      where: { session_id: numericSessionId },
      include: [{ model: QuestionOption }],
      order: [["display_order", "ASC"], ["question_id", "ASC"]]
    }),
    Participant.findAll({
      where: { session_id: numericSessionId },
      attributes: ["participant_id", "nickname", "email", "is_anonymous", "score", "joined_at"]
    }),
    Response.findAll({
      where: { session_id: numericSessionId },
      attributes: [
        "response_id",
        "question_id",
        "participant_id",
        "option_id",
        "text_response",
        "rating_value",
        "ranking_order",
        "submitted_at"
      ],
      order: [["submitted_at", "ASC"]]
    }),
    QaQuestion.findAll({
      where: { session_id: numericSessionId },
      attributes: [
        "qa_id",
        "question_text",
        "upvotes",
        "status",
        "created_at",
        "answered_at",
        "is_pinned"
      ],
      order: [["created_at", "ASC"]]
    })
  ]);

  const activatedQuestions = questions.filter((q) => q.live_activated_at != null);
  const totalJoined = participants.length;
  const uniqueResponders = new Set(
    responses.map((row) => row.participant_id).filter((id) => id != null)
  ).size;

  const engagementRates = activatedQuestions.map((question) => {
    const count = responses.filter(
      (row) => Number(row.question_id) === Number(question.question_id)
    ).length;
    return totalJoined > 0 ? (count / totalJoined) * 100 : 0;
  });
  const avgEngagementRate =
    engagementRates.length > 0
      ? Number((engagementRates.reduce((sum, rate) => sum + rate, 0) / engagementRates.length).toFixed(2))
      : 0;

  const qaAsked = qaQuestions.length;
  const qaApproved = qaQuestions.filter((row) =>
    ["approved", "answered", "pinned"].includes(row.status)
  ).length;
  const qaAnswered = qaQuestions.filter(
    (row) => row.status === "answered" || row.answered_at != null
  ).length;

  const hasQuizMode = questions.some((q) => q.is_quiz_mode);
  let quizStats = null;
  if (hasQuizMode) {
    const scores = participants.map((p) => Number(p.score || 0));
    const topScore = scores.length ? Math.max(...scores) : 0;
    const avgScore =
      scores.length > 0
        ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
        : 0;
    quizStats = { has_quiz_mode: true, top_score: topScore, avg_score: avgScore };
  } else {
    quizStats = { has_quiz_mode: false, top_score: null, avg_score: null };
  }

  const responseCountsByParticipant = responses.reduce((acc, row) => {
    const pid = row.participant_id;
    if (pid == null) return acc;
    acc[pid] = (acc[pid] || 0) + 1;
    return acc;
  }, {});

  const participantSummaries = participants
    .map((participant) => {
      const nickname = participant.is_anonymous
        ? "Anonymous"
        : String(participant.nickname || participant.email || "").trim() ||
          `Participant ${participant.participant_id}`;
      return {
        participant_id: participant.participant_id,
        nickname,
        responses_submitted: responseCountsByParticipant[participant.participant_id] || 0,
        score: Number(participant.score || 0)
      };
    })
    .sort((a, b) => b.score - a.score || b.responses_submitted - a.responses_submitted);

  const questionBreakdowns = questions.map((question, index) => {
    const options = question.QuestionOptions || question.question_options || [];
    const questionResponses = responses.filter(
      (row) => Number(row.question_id) === Number(question.question_id)
    );
    return {
      question_id: question.question_id,
      question_index: index + 1,
      question_text: question.question_text,
      question_type: question.question_type,
      is_quiz_mode: Boolean(question.is_quiz_mode),
      was_activated: question.live_activated_at != null,
      total_responses: questionResponses.length,
      options: buildQuestionResponseBreakdown(question, options, responses)
    };
  });

  const department = session.department || (await Department.findByPk(session.dept_id));
  const durationMinutes = formatDurationMinutes(session.started_at, session.ended_at);

  return {
    session: {
      session_id: session.session_id,
      title: session.title,
      host_name: host?.full_name || host?.email || "—",
      department_name: department?.name || "—",
      dept_id: session.dept_id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      date: session.started_at || session.created_at,
      duration_minutes: durationMinutes,
      duration_label:
        durationMinutes < 60
          ? `${durationMinutes}m`
          : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
    },
    summary: {
      total_joined: totalJoined,
      total_responded: uniqueResponders,
      avg_engagement_rate_percent: avgEngagementRate,
      total_questions: questions.length,
      total_questions_activated: activatedQuestions.length
    },
    qa_summary: {
      asked: qaAsked,
      approved: qaApproved,
      answered: qaAnswered
    },
    quiz_stats: quizStats,
    response_timeline: buildResponseTimeline(responses, session.started_at, session.ended_at),
    question_breakdowns: questionBreakdowns,
    qa_log: qaQuestions.map((row) => ({
      qa_id: row.qa_id,
      question_text: row.question_text,
      upvotes: row.upvotes || 0,
      status: row.status,
      is_pinned: Boolean(row.is_pinned),
      created_at: row.created_at,
      answered_at: row.answered_at
    })),
    participant_summaries: participantSummaries
  };
}

module.exports = {
  getSessionSummaryReport
};
