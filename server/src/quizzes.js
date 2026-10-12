// Server-only cheat sheet. Never import this from the client.
// The correct choice is `answerIndex`. Public helpers below strip it.

const QUESTIONS_PER_QUIZ = 10

export const categories = [
  {
    id: 'agent-design',
    name: 'Agent Design',
    description: 'Tools, memory, and when an agent should stop.',
  },
  {
    id: 'prompt-engineering',
    name: 'Prompt Engineering',
    description: 'How you ask changes what you get back.',
  },
  {
    id: 'workflow-automation',
    name: 'Workflow Automation',
    description: 'Triggers, retries, and handing work between steps.',
  },
]

function buildQuiz(categoryId, difficulty, rows) {
  if (rows.length !== QUESTIONS_PER_QUIZ) {
    throw new Error(`${categoryId}-${difficulty} must have ${QUESTIONS_PER_QUIZ} questions`)
  }

  return {
    id: `${categoryId}-${difficulty}`,
    categoryId,
    difficulty,
    questions: rows.map(([prompt, choices, answerIndex], index) => {
      if (!Array.isArray(choices) || choices.length < 2) {
        throw new Error(`${categoryId}-${difficulty} question ${index + 1} needs choices`)
      }
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) {
        throw new Error(`${categoryId}-${difficulty} question ${index + 1} has a bad answer`)
      }
      const shift = (index * 3 + 1) % choices.length
      return {
        id: `${categoryId}-${difficulty}-${index + 1}`,
        prompt,
        choices: choices.map((_, choiceIndex) => choices[(choiceIndex + shift) % choices.length]),
        answerIndex: (answerIndex - shift + choices.length) % choices.length,
      }
    }),
  }
}

const quizzes = [
  buildQuiz('agent-design', 'easy', [
    ['What is an AI agent?', ['A model that picks actions to reach a goal', 'A folder of saved prompts', 'A chart of model prices', 'A keyboard shortcut'], 0],
    ['In agent design, a tool is…', ['The chat window', 'A function the agent is allowed to call', 'The user’s password', 'A longer prompt'], 1],
    ['A system prompt mainly…', ['Stores the user’s files', 'Picks the font', 'Sets the agent’s role and rules', 'Deletes old chats'], 2],
    ['Why keep an agent’s tool list short?', ['So the model can wander', 'So every tool runs at once', 'So the agent is easier to draw', 'So it chooses a relevant action'], 3],
    ['A stop condition tells the agent…', ['When to finish instead of looping', 'Which user is logged in', 'The price of the model', 'How to hide errors'], 0],
    ['Grounding an answer means…', ['Making the text longer', 'Tying it to a source or tool result', 'Turning off the model', 'Saving it as a secret'], 1],
    ['The user message is…', ['The hidden system rules', 'The database password', 'The request the person just made', 'The list of all tools'], 2],
    ['A simple agent memory is…', ['A second browser', 'A new model', 'A printed poster', 'Notes the agent can read later'], 3],
    ['A handoff is…', ['Passing the task to another agent or a person', 'Restarting the computer', 'Deleting the chat', 'A type of font'], 0],
    ['A good first agent has…', ['Every tool you can find', 'One job, a few tools, and a clear “done”', 'No instructions at all', 'Only a high temperature'], 1],
  ]),
  buildQuiz('agent-design', 'medium', [
    ['ReAct-style agents alternate between…', ['Fonts and colors', 'Reasoning and acting with tools', 'Login and logout', 'Copy and paste'], 1],
    ['A planner agent is useful when…', ['The task splits into ordered steps', 'The answer is one word', 'You want random output', 'The model is offline'], 0],
    ['Tool results should be shown to the model as…', ['A secret it cannot see', 'Observations it can use next', 'A replacement for the user', 'Only after the chat ends'], 1],
    ['Why cap the number of tool loops?', ['To spend more tokens', 'To stop runaway calls', 'To hide the system prompt', 'To skip the final answer'], 1],
    ['Scratchpad memory is best for…', ['Notes used during one task', 'Permanent user passwords', 'The model’s weights', 'Public marketing copy'], 0],
    ['A critic step in an agent…', ['Deletes the tools', 'Checks the draft before it is returned', 'Changes the user’s name', 'Turns off logging'], 1],
    ['Least-privilege tools means…', ['The agent gets every API key', 'The agent gets only the access the job needs', 'Tools run without arguments', 'Users share one password'], 1],
    ['When should an agent ask a clarifying question?', ['Never, guessing is better', 'When a missing detail would change the action', 'After every single word', 'Only if the tool fails twice'], 1],
    ['An agent eval set is…', ['A list of tasks with expected outcomes', 'The production database', 'A style guide for buttons', 'The chat scrollbar'], 0],
    ['Parallel tool calls help when…', ['The calls depend on each other', 'The calls are independent', 'You want one slow loop', 'The user is typing'], 1],
  ]),
  buildQuiz('agent-design', 'hard', [
    ['A guardrail around a tool call should…', ['Block or rewrite unsafe arguments before they run', 'Store the answer key in the browser', 'Raise the temperature', 'Remove the stop condition'], 0],
    ['Which failure is a classic agent loop bug?', ['The agent calls the same tool with the same args forever', 'The user picks a username', 'The page uses rounded corners', 'The score is saved once'], 0],
    ['Structured tool output is preferred because…', ['The next step can trust fields instead of parsing prose', 'It hides errors from logs', 'It makes prompts shorter only', 'It disables the model'], 0],
    ['A router agent…', ['Sends the task to a specialist agent', 'Replaces the database', 'Encrypts the username', 'Draws the progress bar'], 0],
    ['Idempotent tools matter because…', ['A retry should not duplicate the side effect', 'Agents cannot count', 'Prompts cannot be saved', 'Users dislike buttons'], 0],
    ['Long-term memory should be written when…', ['A fact is worth recalling in a later session', 'Every token of the scratchpad', 'The model is unsure', 'A tool returns an error'], 0],
    ['Why separate “plan” from “act” roles?', ['The actor stays narrow and the planner can be checked', 'So both share one API key in the client', 'To avoid writing tests', 'To skip tool schemas'], 0],
    ['A trace of an agent run should include…', ['Tool name, arguments, and result for each step', 'Only the final emoji', 'The correct quiz answers', 'The user’s password'], 0],
    ['Human approval fits best before…', ['An irreversible or expensive action', 'Reading a public doc', 'Formatting a list', 'Counting tokens'], 0],
    ['A strong agent definition includes…', ['Goal, tools, constraints, and a done check', 'Only a model name', 'A hidden answer sheet', 'Unlimited recursion'], 0],
  ]),
  buildQuiz('prompt-engineering', 'easy', [
    ['A prompt is…', ['The instruction you send the model', 'The model’s secret weights', 'A database table', 'A CSS color'], 0],
    ['Being specific helps because…', ['The model has a clearer target', 'It uses more passwords', 'It disables tools', 'It hides the question'], 0],
    ['Few-shot prompting means…', ['Showing a couple of examples', 'Sending one blank message', 'Training a new model', 'Deleting the chat'], 0],
    ['Delimiters like quotes or XML tags…', ['Mark which text is data, not instructions', 'Slow down the keyboard', 'Store the session key', 'Change the font'], 0],
    ['“Answer in three bullets” is…', ['An output format instruction', 'A tool schema', 'A login form', 'A score formula'], 0],
    ['A role prompt such as “You are a tutor”…', ['Sets the voice and job', 'Reveals the answer key', 'Creates a user profile', 'Turns off safety'], 0],
    ['If the output is too wild, you might…', ['Ask for a shorter, more constrained answer', 'Paste the answer key', 'Remove the question', 'Add another login'], 0],
    ['Naming the audience (“for a beginner”)…', ['Changes how deep the explanation goes', 'Stores progress in SQLite', 'Grades the quiz', 'Creates a UUID'], 0],
    ['A follow-up prompt is…', ['A later message that refines the first answer', 'The system password', 'The list of categories', 'A finished attempt'], 0],
    ['What should you not put in a prompt?', ['Secrets you would not share with the model vendor', 'The task you want done', 'The format you want', 'An example of a good answer'], 0],
  ]),
  buildQuiz('prompt-engineering', 'medium', [
    ['Chain-of-thought prompting asks the model to…', ['Show its steps before the final answer', 'Skip reasoning', 'Call every tool twice', 'Ignore the user'], 0],
    ['Temperature roughly controls…', ['How random the wording is', 'The user’s score', 'The number of quizzes', 'The session key'], 0],
    ['A negative instruction (“do not invent sources”)…', ['Tells the model what to avoid', 'Adds a correct answer to the client', 'Creates a new category', 'Renames the player'], 0],
    ['Putting instructions after a long document can fail because…', ['The model may weigh the document and miss the ask', 'SQLite rejects text', 'UUIDs expire', 'Buttons stop working'], 0],
    ['JSON mode or a schema helps when…', ['A program must read the result', 'You want a poem only', 'You are drawing a logo', 'You are renaming a user'], 0],
    ['“Use only the passage below” is a way to…', ['Reduce answers that stray outside the source', 'Increase tool loops', 'Store high scores', 'Hide the username'], 0],
    ['Iterating a prompt means…', ['Trying a change, reading the output, then adjusting', 'Shipping the first draft forever', 'Grading on the client', 'Sending the answer key'], 0],
    ['A rubric in the prompt…', ['Tells the model how a good answer is judged', 'Replaces the database', 'Lists every user', 'Sets the HTTP port'], 0],
    ['Why separate context from the question?', ['So the model can tell data apart from the task', 'So the browser can score points', 'So answers ship early', 'So tools run in secret'], 0],
    ['If a model echoes your instructions, you should…', ['Tighten the format and say not to repeat the prompt', 'Send the cheat sheet', 'Delete the category', 'Raise the max tool loops'], 0],
  ]),
  buildQuiz('prompt-engineering', 'hard', [
    ['Prompt injection is…', ['Untrusted text that tries to override your instructions', 'A friendly example', 'A database index', 'A CSS class'], 0],
    ['A defense against injection is…', ['Treating user content as data and checking tool calls', 'Putting the answer key in localStorage', 'Scoring on the client', 'Hiding the system prompt in the page'], 0],
    ['Lost-in-the-middle means…', ['Details buried in a long context are easier to miss', 'The first token is always wrong', 'Tools cannot return JSON', 'Users cannot rename profiles'], 0],
    ['A self-consistency check…', ['Samples several reasonings and keeps the common answer', 'Sends one empty prompt', 'Stores only the username', 'Disables the stop sequence'], 0],
    ['Why can “think step by step” hurt on easy facts?', ['Extra reasoning can wander away from a short known answer', 'It deletes the tools', 'It reveals other players’ keys', 'It skips the database'], 0],
    ['Constrained decoding…', ['Limits tokens so the output matches a grammar or schema', 'Lets the model invent new APIs', 'Moves grading into React', 'Publishes the cheat sheet'], 0],
    ['An eval harness for prompts compares…', ['Outputs against cases you expected', 'Font files', 'Session UUIDs', 'CSS radius tokens'], 0],
    ['Splitting a huge prompt into steps helps when…', ['Each step has a checkable output', 'You want one unreadable blob', 'The client should hold the answers', 'You need fewer tests'], 0],
    ['Citing a span of the source is useful because…', ['A wrong quote is easier to catch than a smooth paragraph', 'It hides the question', 'It raises the score automatically', 'It creates a new user'], 0],
    ['A production prompt change should be…', ['Versioned and compared on an eval set before rollout', 'Edited live with no note', 'Copied into the browser bundle', 'Scored in the React app'], 0],
  ]),
  buildQuiz('workflow-automation', 'easy', [
    ['A workflow is…', ['A series of steps that run to finish a job', 'A single chat bubble', 'A user password', 'A font file'], 0],
    ['A trigger starts a workflow when…', ['Something happens, like a form submit or a clock tick', 'The model feels like it', 'The CSS loads', 'A score is guessed'], 0],
    ['An action in a workflow is…', ['One step that does a piece of work', 'The answer key', 'The player list', 'A color token'], 0],
    ['Why show a step’s status?', ['So a person can see what finished or failed', 'So answers leak early', 'So the client can grade', 'So prompts get longer'], 0],
    ['A manual step is…', ['A pause where a person must do something', 'A hidden correct answer', 'An automatic retry forever', 'A new session key'], 0],
    ['A notification step…', ['Tells someone a run finished or needs them', 'Stores the cheat sheet', 'Renames every user', 'Deletes quizzes'], 0],
    ['Inputs to a workflow should be…', ['The fields the first step needs', 'Every secret in the repo', 'The correct choice index', 'The browser’s localStorage'], 0],
    ['A simple automation example is…', ['Save a form, then email a summary', 'Reveal all quiz answers on load', 'Score points in React', 'Share one password'], 0],
    ['If a step fails, a friendly workflow…', ['Shows the error instead of pretending it worked', 'Marks every answer correct', 'Skips the log', 'Sends the answer key'], 0],
    ['The output of a workflow is…', ['The result the later steps or the user needed', 'The system prompt', 'A list of answer indexes', 'The UUID of every player'], 0],
  ]),
  buildQuiz('workflow-automation', 'medium', [
    ['A retry policy is for…', ['Temporary failures, with a limit and a wait', 'Running a step forever', 'Hiding all errors', 'Grading on the client'], 0],
    ['Idempotency in a workflow means…', ['Running a step twice does not duplicate the effect', 'Each run invents a new user', 'Answers change every call', 'Triggers never fire'], 0],
    ['A webhook is…', ['An HTTP call that tells your app an event happened', 'A CSS animation', 'A quiz answer', 'A font weight'], 0],
    ['Branching logic is used when…', ['The next step depends on a condition', 'Every run must be identical', 'You want no logs', 'The model is the database'], 0],
    ['A queue helps when…', ['Work should wait and be processed in order', 'You need the answer key in the browser', 'Steps must share one password', 'You want to skip failures'], 0],
    ['Mapping a field between steps means…', ['Passing one step’s output into the next step’s input', 'Copying the cheat sheet', 'Storing scores in React state only', 'Deleting the trigger'], 0],
    ['A timeout on a step…', ['Stops a hung step instead of waiting forever', 'Reveals correct answers', 'Creates a profile', 'Disables retries'], 0],
    ['Human-in-the-loop is a good fit for…', ['Approving a refund or a sent email', 'Adding two numbers', 'Setting a font', 'Reading a health check'], 0],
    ['Dead-letter handling is…', ['Parking a run that failed past its retries', 'The correct quiz choice', 'A username rename', 'A progress bar color'], 0],
    ['Logging each step’s input and output helps you…', ['Replay and debug a bad run', 'Ship answers to the client', 'Score inside the browser', 'Skip tests'], 0],
  ]),
  buildQuiz('workflow-automation', 'hard', [
    ['Exactly-once delivery is hard because…', ['A crash between “do the work” and “mark done” can double or drop it', 'HTTP has no status codes', 'Queues cannot store JSON', 'Triggers cannot be clocks'], 0],
    ['A compensation step is…', ['An undo action when a later step fails', 'A second copy of the answer key', 'A client-side score', 'A font fallback'], 0],
    ['Backpressure means…', ['Slowing intake when workers are overloaded', 'Sending more events with no limit', 'Grading in the browser', 'Storing prompts in localStorage'], 0],
    ['A saga across services…', ['Coordinates several steps that each have a local commit', 'Is a single SQL column', 'Holds the quiz answers', 'Replaces the session key'], 0],
    ['Why sign webhook payloads?', ['So you can reject events that were not sent by the real source', 'So the client can see correct answers', 'So scores are computed in React', 'So usernames can be empty'], 0],
    ['A deterministic workflow replay…', ['Rebuilds state from the event log without redoing side effects blindly', 'Runs every email send again', 'Publishes the cheat sheet', 'Drops the audit trail'], 0],
    ['Fan-out / fan-in is…', ['Split work to many branches, then join the results', 'One step with no output', 'A prompt with no question', 'A score computed on the client'], 0],
    ['An idempotency key should be…', ['Stable for the same logical request, unique across different ones', 'A new random value on every retry', 'The quiz answer index', 'The user’s password'], 0],
    ['Circuit breaking a flaky dependency…', ['Stops calling it for a bit after repeated failures', 'Retries with no delay forever', 'Moves answers into the page', 'Disables logs'], 0],
    ['A safe automation rollout…', ['Runs the new path in shadow or for a small slice first', 'Replaces production with no compare', 'Puts the answer key in the client', 'Grades points in the browser'], 0],
  ]),
]

const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]))

export function listCatalog() {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    quizzes: quizzes
      .filter((quiz) => quiz.categoryId === category.id)
      .map((quiz) => ({
        id: quiz.id,
        difficulty: quiz.difficulty,
        questionCount: quiz.questions.length,
      })),
  }))
}

export function getPublicQuiz(quizId) {
  const quiz = quizById.get(quizId)
  if (!quiz) return null

  const category = categories.find((item) => item.id === quiz.categoryId)
  return {
    id: quiz.id,
    categoryId: quiz.categoryId,
    categoryName: category?.name ?? quiz.categoryId,
    difficulty: quiz.difficulty,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      choices: question.choices,
    })),
  }
}

export function getQuestion(quizId, questionId) {
  return quizById.get(quizId)?.questions.find((question) => question.id === questionId) ?? null
}

export function questionCount(quizId) {
  return quizById.get(quizId)?.questions.length ?? 0
}
