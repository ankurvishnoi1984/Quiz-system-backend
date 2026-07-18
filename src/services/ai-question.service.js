const fs = require("fs");
const os = require("os");
const path = require("path");

const ALLOWED_UI_TYPES = [
  "MCQ",
  "Poll",
  "Word Cloud",
  "Rating",
  "Text",
  "True/False",
  "Ranking"
];

const TYPE_GUIDANCE = {
  MCQ: `Each item needs question_text and exactly 4 options. Mark exactly one option with is_correct: true (quiz).`,
  Poll: `Each item needs question_text and 3–5 opinion options. All is_correct must be false (no right answer).`,
  "Word Cloud": `Each item needs only a short prompt question_text that invites 1–3 word answers. options must be [].`,
  Rating: `Each item needs question_text. Include rating_min (1) and rating_max (5 or 10). options must be [].`,
  Text: `Each item needs an open-ended question_text. options must be [].`,
  "True/False": `Each item needs question_text and exactly two options with texts "True" and "False". Mark exactly one is_correct: true.`,
  Ranking: `Each item needs question_text and 3–6 items to rank as options. All is_correct false.`
};

function getCursorApiKey() {
  return String(process.env.CURSOR_API_KEY || "").trim();
}

function getCursorModelId() {
  const configured = String(process.env.CURSOR_MODEL || "").trim();
  // "auto" lets Cursor pick a model for the account. Explicit ids must exist for the key.
  return configured || "auto";
}

function cursorAuthHeader(apiKey) {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

function buildGenerationPrompt({ topic, count, questionType, difficulty }) {
  const guidance = TYPE_GUIDANCE[questionType] || TYPE_GUIDANCE.MCQ;
  const level = difficulty || "mixed";

  return [
    "You are a quiz content generator for a live audience polling/quiz product.",
    "Do not edit files, create PRs, browse the web, or use tools.",
    "Your entire reply must be a single JSON array — no markdown fences, no prose before/after.",
    "",
    `Topic: ${topic}`,
    `Question type: ${questionType}`,
    `Number of questions: ${count}`,
    `Difficulty: ${level}`,
    "",
    guidance,
    "",
    "JSON array item shape:",
    "{",
    '  "question_text": "string",',
    '  "options": [{ "option_text": "string", "is_correct": false }],',
    '  "rating_min": 1,',
    '  "rating_max": 5',
    "}",
    "",
    "Rules:",
    `- Exactly ${count} objects.`,
    "- question_text must be clear for a projected live session.",
    "- Omit rating_min/rating_max unless type is Rating.",
    "- Use options: [] when the type does not need options.",
    "- No duplicate option_text within a question.",
    "- No ids, explanations, or extra keys.",
    "",
    "Begin your reply with [ and end with ]."
  ].join("\n");
}

function extractJsonPayload(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw Object.assign(new Error("Cursor returned an empty response"), { statusCode: 502 });
  }

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    const preview = raw.slice(0, 240).replace(/\s+/g, " ");
    throw Object.assign(
      new Error(
        `Cursor response did not include a JSON array. Preview: ${preview || "(empty)"}`
      ),
      { statusCode: 502 }
    );
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw Object.assign(new Error("Could not parse Cursor JSON response"), { statusCode: 502 });
  }
}

function normalizeGeneratedQuestions(parsed, questionType) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw Object.assign(new Error("No questions were generated"), { statusCode: 502 });
  }

  return parsed.map((row, index) => {
    const text = String(row?.question_text || row?.text || "").trim();
    if (!text) {
      throw Object.assign(new Error(`Generated question ${index + 1} is missing text`), {
        statusCode: 502
      });
    }

    const options = Array.isArray(row?.options)
      ? row.options
          .map((opt) => ({
            text: String(opt?.option_text || opt?.text || "").trim(),
            isCorrect: Boolean(opt?.is_correct ?? opt?.isCorrect)
          }))
          .filter((opt) => opt.text)
      : [];

    const item = {
      type: questionType,
      text,
      options
    };

    if (questionType === "Rating") {
      item.ratingMin = Number(row?.rating_min ?? row?.ratingMin ?? 1) || 1;
      item.ratingMax = Number(row?.rating_max ?? row?.ratingMax ?? 5) || 5;
      item.options = [];
    }

    if (questionType === "Word Cloud" || questionType === "Text") {
      item.options = [];
    }

    if (questionType === "True/False") {
      const hasTrue = options.some((o) => o.text.toLowerCase() === "true");
      const hasFalse = options.some((o) => o.text.toLowerCase() === "false");
      if (!hasTrue || !hasFalse) {
        const correctIsTrue = options.find((o) => o.isCorrect)?.text?.toLowerCase() !== "false";
        item.options = [
          { text: "True", isCorrect: correctIsTrue },
          { text: "False", isCorrect: !correctIsTrue }
        ];
      } else {
        item.options = [
          {
            text: "True",
            isCorrect: options.some((o) => o.text.toLowerCase() === "true" && o.isCorrect)
          },
          {
            text: "False",
            isCorrect: options.some((o) => o.text.toLowerCase() === "false" && o.isCorrect)
          }
        ];
        if (!item.options.some((o) => o.isCorrect)) {
          item.options[0].isCorrect = true;
        }
      }
    }

    if (questionType === "MCQ") {
      if (item.options.length < 2) {
        throw Object.assign(new Error(`MCQ question ${index + 1} needs at least 2 options`), {
          statusCode: 502
        });
      }
      const correctCount = item.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        item.options = item.options.map((o, i) => ({ ...o, isCorrect: i === 0 }));
      }
    }

    if (questionType === "Poll" || questionType === "Ranking") {
      if (item.options.length < 2) {
        throw Object.assign(
          new Error(`${questionType} question ${index + 1} needs at least 2 options`),
          { statusCode: 502 }
        );
      }
      item.options = item.options.map((o) => ({ ...o, isCorrect: false }));
    }

    return item;
  });
}

async function cursorFetch(urlPath, { method = "GET", body, apiKey } = {}) {
  const response = await fetch(`https://api.cursor.com${urlPath}`, {
    method,
    headers: {
      Authorization: cursorAuthHeader(apiKey),
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error?.message ||
      `Cursor API error (${response.status})`;
    const err = new Error(message);
    err.statusCode = response.status === 401 || response.status === 403 ? response.status : 502;
    err.details = payload;
    throw err;
  }
  return payload;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildModelSelection(modelId) {
  if (!modelId || modelId === "auto") {
    return { id: "auto" };
  }
  return { id: modelId };
}

/**
 * Preferred path: Cursor SDK one-shot cloud agent (no GitHub repo required).
 */
async function generateWithSdk({ apiKey, promptText, modelId }) {
  const { Agent, CursorAgentError } = await import("@cursor/sdk");

  try {
    const result = await Agent.prompt(promptText, {
      apiKey,
      model: buildModelSelection(modelId),
      // Cloud no-repo style generation (do not attach a git repo).
      cloud: {}
    });

    if (result.status === "error") {
      throw Object.assign(
        new Error(result.result || "Cursor SDK run failed. Check your API key and plan access."),
        { statusCode: 502 }
      );
    }

    const text = String(result.result || "").trim();
    if (!text) {
      throw Object.assign(
        new Error(
          "Cursor finished but returned no text. Try CURSOR_MODEL=auto in Backend/.env, or verify Cloud Agents access for this API key."
        ),
        { statusCode: 502 }
      );
    }

    return {
      text,
      meta: {
        provider: "cursor-sdk",
        model: modelId,
        agent_id: result.agentId || null,
        run_id: result.id || null
      }
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw Object.assign(
        new Error(
          err.message ||
            "Cursor SDK could not start. Confirm CURSOR_API_KEY and Cloud Agents access."
        ),
        { statusCode: err.message?.toLowerCase().includes("auth") ? 401 : 502, cause: err }
      );
    }
    throw err;
  }
}

/**
 * Fallback: local SDK agent against an empty scratch folder (no GitHub connect needed).
 */
async function generateWithLocalSdk({ apiKey, promptText, modelId }) {
  const { Agent, CursorAgentError } = await import("@cursor/sdk");
  const cwd = path.join(os.tmpdir(), "quiz-ai-scratch");
  fs.mkdirSync(cwd, { recursive: true });

  try {
    const result = await Agent.prompt(promptText, {
      apiKey,
      model: buildModelSelection(modelId === "auto" ? "composer-2.5" : modelId),
      local: { cwd, settingSources: [] }
    });

    if (result.status === "error") {
      throw Object.assign(
        new Error(result.result || "Local Cursor agent failed"),
        { statusCode: 502 }
      );
    }

    const text = String(result.result || "").trim();
    if (!text) {
      throw Object.assign(new Error("Local Cursor agent returned an empty response"), {
        statusCode: 502
      });
    }

    return {
      text,
      meta: {
        provider: "cursor-sdk-local",
        model: modelId,
        agent_id: result.agentId || null,
        run_id: result.id || null
      }
    };
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw Object.assign(new Error(err.message || "Local Cursor agent failed to start"), {
        statusCode: 502,
        cause: err
      });
    }
    throw err;
  }
}

/**
 * REST Cloud Agents API fallback with stream text capture when `result` is empty.
 */
async function generateWithRestApi({ apiKey, promptText, modelId }) {
  const body = {
    prompt: { text: promptText },
    name: "Quiz question generation"
  };
  if (modelId && modelId !== "auto") {
    body.model = { id: modelId };
  } else {
    body.model = { id: "auto" };
  }

  const created = await cursorFetch("/v1/agents", {
    method: "POST",
    apiKey,
    body
  });

  const agentId = created?.agent?.id || created?.id;
  const runId = created?.run?.id || created?.agent?.latestRunId;
  if (!agentId || !runId) {
    throw Object.assign(new Error("Cursor did not return an agent run id"), { statusCode: 502 });
  }

  // Prefer SSE stream — often has the assistant text even when GET run.result is blank.
  let streamedText = "";
  try {
    streamedText = await collectRunStreamText(agentId, runId, apiKey);
  } catch {
    streamedText = "";
  }

  const maxAttempts = Number(process.env.CURSOR_POLL_ATTEMPTS || 60);
  const pollMs = Number(process.env.CURSOR_POLL_MS || 2500);
  let run = created.run || null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(pollMs);
      run = await cursorFetch(`/v1/agents/${agentId}/runs/${runId}`, { apiKey });
    }

    const status = String(run?.status || "").toUpperCase();
    if (status === "FINISHED") {
      const text = String(run.result || streamedText || "").trim();
      cursorFetch(`/v1/agents/${agentId}`, { method: "DELETE", apiKey }).catch(() => {});
      if (!text) {
        throw Object.assign(
          new Error(
            "Cursor run finished with an empty result. Set CURSOR_MODEL=auto and ensure this key has Cloud Agents access."
          ),
          { statusCode: 502 }
        );
      }
      return {
        text,
        meta: {
          provider: "cursor-rest",
          model: modelId,
          agent_id: agentId,
          run_id: runId
        }
      };
    }

    if (["ERROR", "CANCELLED", "EXPIRED"].includes(status)) {
      throw Object.assign(
        new Error(run?.result || streamedText || `Cursor run ended with status ${status}`),
        { statusCode: 502 }
      );
    }
  }

  throw Object.assign(new Error("Cursor question generation timed out. Try again."), {
    statusCode: 504
  });
}

async function collectRunStreamText(agentId, runId, apiKey) {
  const response = await fetch(
    `https://api.cursor.com/v1/agents/${agentId}/runs/${runId}/stream`,
    {
      headers: {
        Authorization: cursorAuthHeader(apiKey),
        Accept: "text/event-stream"
      }
    }
  );

  if (!response.ok || !response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantText = "";
  let resultText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let eventName = "message";
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      let data;
      try {
        data = JSON.parse(dataLines.join("\n"));
      } catch {
        continue;
      }

      if (eventName === "assistant" || eventName === "message") {
        const content = data?.message?.content || data?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "text" && block.text) assistantText += block.text;
          }
        } else if (typeof data?.text === "string") {
          assistantText += data.text;
        }
      }
      if (eventName === "result" && typeof data?.text === "string") {
        resultText = data.text;
      }
    }
  }

  return String(resultText || assistantText || "").trim();
}

function validateInputs({ topic, count, questionType }) {
  const apiKey = getCursorApiKey();
  if (!apiKey) {
    throw Object.assign(
      new Error(
        "CURSOR_API_KEY is not configured. Add it to Backend/.env from Cursor Dashboard → API Keys."
      ),
      { statusCode: 503 }
    );
  }

  const trimmedTopic = String(topic || "").trim();
  if (!trimmedTopic) {
    throw Object.assign(new Error("topic is required"), { statusCode: 400 });
  }

  const n = Number(count);
  if (!Number.isFinite(n) || n < 1 || n > 20) {
    throw Object.assign(new Error("count must be between 1 and 20"), { statusCode: 400 });
  }

  if (!ALLOWED_UI_TYPES.includes(questionType)) {
    throw Object.assign(
      new Error(`question_type must be one of: ${ALLOWED_UI_TYPES.join(", ")}`),
      { statusCode: 400 }
    );
  }

  return { apiKey, trimmedTopic, n: Math.floor(n) };
}

/**
 * Generate quiz questions via Cursor (SDK cloud → local SDK → REST).
 */
async function generateQuestionsWithCursor({
  topic,
  count,
  questionType,
  difficulty = "mixed"
}) {
  const { apiKey, trimmedTopic, n } = validateInputs({ topic, count, questionType });
  const modelId = getCursorModelId();
  const promptText = buildGenerationPrompt({
    topic: trimmedTopic,
    count: n,
    questionType,
    difficulty
  });

  const preferLocal = String(process.env.CURSOR_USE_LOCAL || "").toLowerCase() === "true";
  const errors = [];

  const attempts = preferLocal
    ? [
        () => generateWithLocalSdk({ apiKey, promptText, modelId }),
        () => generateWithSdk({ apiKey, promptText, modelId }),
        () => generateWithRestApi({ apiKey, promptText, modelId })
      ]
    : [
        () => generateWithSdk({ apiKey, promptText, modelId }),
        () => generateWithRestApi({ apiKey, promptText, modelId }),
        () => generateWithLocalSdk({ apiKey, promptText, modelId })
      ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const { text, meta } = await attempt();
      const parsed = extractJsonPayload(text);
      const questions = normalizeGeneratedQuestions(parsed, questionType).slice(0, n);
      return {
        questions,
        meta: {
          ...meta,
          topic: trimmedTopic,
          question_type: questionType,
          requested_count: n
        }
      };
    } catch (err) {
      lastError = err;
      errors.push(err.message);
      // Try next strategy.
    }
  }

  throw Object.assign(
    new Error(
      lastError?.message ||
        `Unable to generate questions via Cursor. Attempts: ${errors.join(" | ")}`
    ),
    { statusCode: lastError?.statusCode || 502, details: errors }
  );
}

module.exports = {
  ALLOWED_UI_TYPES,
  generateQuestionsWithCursor
};
