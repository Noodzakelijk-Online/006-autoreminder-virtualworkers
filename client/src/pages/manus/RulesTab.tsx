import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  GitBranch,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Zap,
  Users,
  Shield,
  BookOpen,
  Target,
  Clock,
  MessageSquare,
  Mail,
  FileText,
  DollarSign,
  Home,
  Gavel,
  Camera,
  Laptop,
  Heart,
  Star,
  Search,
  X,
  Sun,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";

// ─── Priority Decision Tree ───────────────────────────────────────────────────
const DECISION_TREE = [
  {
    q: "Is this a legal, housing, court, police, or insurance matter?",
    yes: { label: "P0 — Do Immediately", color: "bg-red-600", desc: "Legal/housing/court/police/insurance. Treat as preventive defense. Document everything in writing." },
    no: "next",
  },
  {
    q: "Is there an irreversible loss risk (evidence deletion, access loss, deadline expiry)?",
    yes: { label: "P0 — Do Immediately", color: "bg-red-600", desc: "Irreversible loss. Preserve evidence first, then act. Screenshot before hostile parties can delete." },
    no: "next",
  },
  {
    q: "Is the Founder waiting for this right now, or is it blocking his work?",
    yes: { label: "P1 — Do Within 1 Hour", color: "bg-orange-500", desc: "the Founder is blocked. Stop what you're doing and address this first. Send Trello link on WhatsApp if urgent." },
    no: "next",
  },
  {
    q: "Is there a client, contractor, or external party waiting for a response?",
    yes: { label: "P2 — Do Today (Before EOD)", color: "bg-amber-500", desc: "External party waiting. Reply or update them before end of day. Document in Trello." },
    no: "next",
  },
  {
    q: "Is this a recurring scheduled task (daily/weekly routine)?",
    yes: { label: "P3 — Do in Scheduled Window", color: "bg-blue-500", desc: "Routine task. Execute in its designated time slot. Do not skip — consistency is measured." },
    no: "next",
  },
  {
    q: "Can this be done in 3 minutes or less right now?",
    yes: { label: "P4 — Do It Now (3-min rule)", color: "bg-emerald-500", desc: "3-minute rule: if it takes less than 3 minutes, do it immediately. Don't defer small tasks." },
    no: "next",
  },
  {
    q: "Is this a freelancer task, idea development, or research task?",
    yes: { label: "P5 — Schedule / Defer", color: "bg-slate-500", desc: "Lower priority. Add to Trello backlog. Freelancer tasks: apply One-Chance rule before escalating." },
    no: { label: "P5 — Schedule / Defer", color: "bg-slate-500", desc: "Does not meet any urgency criteria. Log in Trello and schedule for a future slot." },
  },
];

const TASK_TYPE_MATRIX = [
  { type: "Legal / Housing / Court", priority: "P0", pace: "Immediate", note: "Written + traceable always", color: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50" },
  { type: "Irreversible-loss risk", priority: "P0", pace: "Immediate", note: "Preserve evidence first", color: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50" },
  { type: "the Founder blocked / waiting", priority: "P1", pace: "< 1 hour", note: "Send Trello link on WhatsApp", color: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/50" },
  { type: "External party waiting", priority: "P2", pace: "Before EOD", note: "Document all responses", color: "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50" },
  { type: "Scheduled routine task", priority: "P3", pace: "Scheduled window", note: "Consistency is measured", color: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50" },
  { type: "< 3-minute task", priority: "P4", pace: "Right now", note: "Do it, don't defer it", color: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50" },
  { type: "Freelancer / Research / Ideas", priority: "P5", pace: "Scheduled slot", note: "One-Chance rule for freelancers", color: "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700/50" },
];

const DAILY_EXECUTION_ORDER = [
  { step: "1", label: "Morning Ritual", desc: "Email → WhatsApp → Upwork → Trello Notifications → Major Tasks", icon: Sun, color: "from-amber-400 to-orange-500" },
  { step: "2", label: "Execute P0/P1 First", desc: "Address any immediate or the Founder-blocking tasks before anything else", icon: AlertTriangle, color: "from-red-500 to-orange-500" },
  { step: "3", label: "Work APTLSS Tasks", desc: "Assigned, Planned, Tracked, Linked, Summarised, Submitted tasks in Trello", icon: Target, color: "from-violet-500 to-purple-600" },
  { step: "4", label: "3-Minute Rule Throughout", desc: "If it takes < 3 min, do it immediately. Never defer small tasks.", icon: Zap, color: "from-emerald-500 to-teal-600" },
  { step: "5", label: "Evening Documentation", desc: "All work must be in Trello before EOD. No loose info in WhatsApp/Email.", icon: FileText, color: "from-indigo-500 to-blue-600" },
];

// ─── 360 Operating Rules by Category ─────────────────────────────────────────
export const RULE_CATEGORIES = [
  {
    id: "A",
    label: "A. Core Operating Principles",
    icon: Star,
    color: "border-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/10",
    iconColor: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
    summary: "The foundational mindset rules that define what success actually means in this working relationship.",
    whyItMatters: "Without these principles, task completion becomes the goal instead of burden reduction. These rules define the difference between doing work and doing work that actually helps.",
    rules: [
      "1. The goal is not only task completion; the goal is burden reduction for the Founder.",
      "2. Reliability is good, but visible, timely, autonomous follow-through is what creates relief.",
      "3. If the Founder still has to chase, reconstruct, clarify, or micromanage, the system has not succeeded yet.",
      "4. A task is not truly done until the result is visible, documented, linked, and usable later.",
      "5. the Founder's preferred system is bottom-up: collect facts first, organize them, connect them, identify gaps, then decide.",
      "6. Do not treat progress as sufficient if deadlines are missed or evidence remains scattered.",
      "7. Work should reduce future work, not create more work later.",
      "8. Small repeated inefficiencies are serious problems when they happen daily.",
      "9. Tools, systems, and workflows should be treated like breathing: if they add friction every time, they are broken or unfinished.",
      "10. High-risk matters require prevention, not reaction.",
      "11. When the Founder is overloaded, the worker must reduce cognitive load, not add to it.",
      "12. If the Founder is unclear, inconsistent, or gives conflicting instructions, the worker should use AI to extract the conflict and ask focused clarification questions.",
      "13. When in doubt, do not silently assume. Verify, investigate, or ask the Founder in yes/no format.",
      "14. Do not wait for perfect information if useful partial action can safely move the matter forward.",
      "15. If a matter affects housing, court, police, insurance, legal deadlines, evidence, or client relationships, raise its priority.",
    ],
  },
  {
    id: "B",
    label: "B. Communication Rules Between the Founder and the worker",
    summary: "Rules for how and when the worker communicates with the Founder — covering responsiveness, updates, and avoiding silence.",
    whyItMatters: "Silence creates uncertainty and forces the Founder to interrupt his own work to chase status. These rules ensure communication is proactive, clear, and never leaves the Founder guessing.",
    icon: MessageSquare,
    color: "border-blue-400 bg-blue-50/30 dark:bg-blue-950/10",
    iconColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    rules: [
      "16. Somebody says something = reply.",
      "17. A short acknowledgement is better than silence.",
      "18. If a WhatsApp message is read, acknowledge it with a reply or reaction.",
      "19. Because read receipts are off, the worker must manually signal that she has seen and processed important messages.",
      "20. Silence creates uncertainty and causes the Founder to interrupt later.",
      "21. If the worker sees a message late, she should still respond and explain what she will do next.",
      "22. If the worker has a counter-suggestion, she must state it clearly instead of silently following a different plan.",
      "23. If the worker cannot respond fully, she should send a short holding message with a time for follow-up.",
      "24. If the worker is blocked, she must say what blocks her, what she can still do, and when she will update.",
      "25. If the worker gives a deadline or ETA, she must update before or at that deadline.",
      "26. If the worker misses a deadline, she must proactively explain the miss and give a recovery plan.",
      "27. the Founder should not have to ask twice for the status of the same task.",
      "28. Less output with strong responsiveness is better than more output combined with silence.",
      "29. the worker should not wait until the Founder asks before sharing relevant thoughts, concerns, or feedback.",
      "30. If something affects the worker's performance, availability, or output, the Founder should be informed early.",
      "31. If the worker's personal circumstances reduce output, she must tell the Founder what can still be done and what must be postponed.",
      "32. Daily communication should be clear, concise, and actionable.",
      "33. Avoid wall-of-text updates for complex matters. Use sections, numbering, and status labels.",
      "34. When the Founder asks for a brief update, give the operational facts first.",
      "35. Personal warmth is appreciated, but active tasks must still return to operational clarity.",
    ],
  },
  {
    id: "C",
    label: "C. Yes/No Decision Rules",
    summary: "How to frame decisions and requests so the Founder can respond quickly with a simple yes or no.",
    whyItMatters: "Open-ended questions drain the Founder's cognitive energy. A well-framed yes/no request with a recommendation lets him decide in seconds instead of minutes.",
    icon: GitBranch,
    color: "border-violet-400 bg-violet-50/30 dark:bg-violet-950/10",
    iconColor: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
    rules: [
      "36. When the Founder's input is needed, the worker should frame the issue as a yes/no decision whenever possible.",
      "37. The default format should be: recommendation + yes/no approval.",
      "38. A yes/no request may contain multiple questions if the matter is complex.",
      "39. High-risk documents do not need to be reduced to one yes/no question; they can be broken into several yes/no decisions.",
      "40. the worker should use AI to convert unclear issues into yes/no questions for the Founder.",
      "41. If the Founder must decide during the workday, the question must be suitable for a quick WhatsApp answer or voice clip.",
      "42. Do not ask the Founder open-ended questions when he is overloaded.",
      "43. Do not ask 'What should I do?' if the worker can form a recommendation first.",
      "44. When the Founder's approval is required, the worker should explain the consequence of yes and no.",
      "45. If the Founder does not respond, the worker should follow up within 24 hours, or sooner if urgent.",
    ],
  },
  {
    id: "D",
    label: "D. Trello Rules",
    summary: "How to use Trello as the single source of truth — covering card updates, structure, and what belongs where.",
    whyItMatters: "If Trello is incomplete or stale, the Founder cannot trust it. These rules ensure every active task is visible, traceable, and usable without needing to ask the worker for a status.",
    icon: FileText,
    color: "border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/10",
    iconColor: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    rules: [
      "46. Trello is the operational source of truth.",
      "47. If something matters, it belongs in Trello.",
      "48. Every card touched during the day must receive a same-day update.",
      "49. Daily Trello updates are mandatory because they make progress visible.",
      "50. A Trello update may be short, but it must be useful.",
      "51. A good Trello update states: what was done, what is next, who owns it, and what is blocked.",
      "52. If the Founder's urgent attention is needed, the worker should update the Trello card first, then send the Founder the card link on WhatsApp.",
      "53. WhatsApp should point to Trello; it should not replace Trello.",
      "54. If a task is given on WhatsApp, the worker must either act immediately or convert it into Trello.",
      "55. Every active legal, client, software, or freelancer matter should have a clear Trello card or board.",
      "56. Every Trello card involving a freelancer must show the freelancer name, role, Upwork link, current task, deadline, latest update, and blocker.",
      "57. Trello descriptions should contain the important context, not only scattered comments.",
      "58. Documents, emails, screenshots, videos, and links related to a task should be attached or linked to the Trello card.",
      "59. If external input arrives on an On-Hold task, that task can become priority over current Doing tasks.",
      "60. Done cards should receive a short completion summary.",
      "61. Large tasks should be broken into checklist items inside the card, not automatically into separate cards.",
      "62. APTLSS plans are generated by AI — click the '🎯 APTLSS Plan' button on any Trello card in the Power-Up. Do NOT add APTLSS as a checklist, description, or comment.",
      "63. If a Trello card has stale information, update the card before asking the Founder to decide.",
      "64. If the Founder cannot see the status in Trello, the status is not sufficiently visible.",
      "65. Cards should include waiting status: waiting on the Founder, waiting on freelancer, waiting on third party, or blocked.",
      "66. Trello should show the latest follow-up date and next deadline.",
      "67. Old or scattered Trello cards should be consolidated when they refer to the same matter.",
    ],
  },
  {
    id: "E",
    label: "E. Daily and Weekly Workflow Rules",
    summary: "The recurring daily and weekly routines that keep work visible, consistent, and on track.",
    whyItMatters: "Consistency in daily routines prevents tasks from falling through the cracks. A close-out summary makes progress visible without the Founder having to ask.",
    icon: Clock,
    color: "border-teal-400 bg-teal-50/30 dark:bg-teal-950/10",
    iconColor: "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
    rules: [
      "68. the worker should send a daily close-out summary on workdays.",
      "69. Daily close-out should include completed, open, blocked, waiting on the Founder, waiting on others, and urgent tomorrow.",
      "70. If no visible progress was made, the worker should still report why and what the recovery plan is.",
      "71. A daily Trello update block should be scheduled, not left to chance.",
      "72. A 24-hour follow-up list should be maintained for the Founder, freelancers, lawyers, clients, and third parties.",
      "73. If something was promised yesterday and not done, it must be named and recovered today.",
      "74. If the worker works at night after her own obligations, the priorities must be clear before starting.",
      "75. When the worker has many tasks, she should use a daily cross-card schedule, not only individual APTLSS plans.",
      "76. If one task is blocked, switch to the next useful task instead of idling.",
      "77. If waiting for an email code, response, upload, or AI output, use the waiting time for another task.",
      "78. If the Founder needs the PC and the worker is blocked, hand over the PC until the worker can continue.",
      "79. When there are too many moving parts, make the first task an overview/status map.",
      "80. If the worker works long hours or crunch periods, clear handovers are required before sleeping or stepping away.",
    ],
  },
  {
    id: "F",
    label: "F. Deadline and Follow-Up Rules",
    summary: "Rules for managing deadlines, following up on commitments, and converting vague timelines into concrete dates.",
    whyItMatters: "A stated timeline creates an obligation. These rules ensure that deadlines are tracked, followed up, and never silently missed — whether by the worker, freelancers, or third parties.",
    icon: AlertTriangle,
    color: "border-orange-400 bg-orange-50/30 dark:bg-orange-950/10",
    iconColor: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    rules: [
      "81. A stated timeline creates an obligation to report back.",
      "82. If the worker says 'consider it done,' it must either be done or followed up before the deadline.",
      "83. If a freelancer promises an update, record the exact expected time.",
      "84. Vague deadlines must be converted into concrete dates or checkpoints.",
      "85. 'Third week of May' in the Dutch context should be interpreted as the third full week, not partial starting days.",
      "86. If a task is urgent/legal/client-facing, follow up sooner than 24 hours.",
      "87. If a freelancer misses a promised update, the worker should escalate rather than wait passively.",
      "88. If an external party gives a date range, record the final day as the latest follow-up point.",
      "89. If no ETA is given, the worker should ask for a checkpoint.",
      "90. Do not accept 'it can take some time' as a useful ETA.",
      "91. If something must be done today, same-day tracking is required.",
      "92. When the Founder says 'hard deadline,' avoid words like 'I believe' or 'should.' Use confirmed deadline and escalation action.",
    ],
  },
  {
    id: "G",
    label: "G. Freelancer-Management Rules",
    summary: "How to hire, manage, track, and hold accountable the freelancers working on the Founder's projects.",
    whyItMatters: "Freelancers are external and unpredictable. These rules ensure the worker maintains control, documents everything, and escalates problems before they become costly delays.",
    icon: Users,
    color: "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
    iconColor: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    rules: [
      "93. Do not accept 'done' without testing the actual workflow.",
      "94. A freelancer delivery must be tested against the Founder's real use case, not only a demo.",
      "95. If a freelancer says requirements are unclear, stop and create a written feature checklist.",
      "96. If a freelancer cannot run/debug the system, request a structured diagnostic report.",
      "97. A diagnostic report should include OS, repo/branch, command run, exact error, screenshots/video, .env variables, and what was tried.",
      "98. If a freelancer repeats the same blocker, require a missing-items list and next-action plan.",
      "99. Do not let freelancers create random repos, emails, or systems without approval.",
      "100. Every freelancer task should have acceptance criteria.",
      "101. Every fix should be tied to the agreed scope or original use case.",
      "102. Do not call broken agreed functionality a recommendation. Call it a fix.",
      "103. A recommendation is optional; a fix is required.",
      "104. Use precise wording with difficult freelancers to avoid scope arguments.",
      "105. If a freelancer misses one meeting, issue a warning or clear follow-up.",
      "106. If a freelancer misses two meetings, escalate and set a final appointment.",
      "107. If a freelancer misses three meetings, replacement/termination becomes the default unless the Founder decides otherwise.",
      "108. If a freelancer is unavailable, update the Founder immediately instead of letting the meeting silently fail.",
      "109. If a freelancer is likely to become hostile or risky, remove access before notifying them.",
      "110. Before ending a risky freelancer relationship, open all access-management pages first, then remove access rapidly.",
      "111. Remove freelancer access from GitHub, Google Drive, Trello, deployment tools, Manus, shared accounts, and any other relevant platform.",
      "112. After access removal, preserve evidence and screenshots for Upwork or dispute escalation.",
      "113. Freelancers responsible for document collation may receive temporary Drive view access if needed.",
      "114. Temporary freelancer access must be tracked and removed after the task.",
      "115. If a freelancer requires the Founder's input, the worker should filter the issue into yes/no questions first.",
      "116. the worker should protect the Founder from unnecessary freelancer back-and-forth.",
      "117. If work can be delegated without risk, the worker should consider delegating it.",
      "118. Bulk downloads, transcriptions, uploads, renaming, and simple sorting can often be delegated.",
      "119. Legal triage, sensitive access, high-risk decisions, and the Founder's decision preparation should stay closer to the worker.",
    ],
  },
  {
    id: "H",
    label: "H. Software and Development Rules",
    summary: "Standards for managing software projects, GitHub repositories, testing, and development handovers.",
    whyItMatters: "Software without proper documentation and testing creates hidden debt. These rules ensure code is traceable, tested, and never accepted as done without verification.",
    icon: Laptop,
    color: "border-cyan-400 bg-cyan-50/30 dark:bg-cyan-950/10",
    iconColor: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    rules: [
      "120. Manus is a starting/prototyping tool, not the final development environment.",
      "121. The desired path is: Manus → local code editor/version control → GitHub → local Docker deployment → usable tool.",
      "122. All code must land in the correct numbered GitHub repository.",
      "123. Project numbering must match across Manus, GitHub, Intranet, Trello, and Drive where possible.",
      "124. Do not assume a Manus thread does not exist just because the name does not match.",
      "125. Every new Manus thread should be named correctly immediately.",
      "126. Before creating new threads, inspect existing threads briefly to avoid duplicates.",
      "127. Local Docker on the Founder's Windows PC is the preferred deployment target for internal tools.",
      "128. Tools should be resource-light unless a critical path truly requires speed.",
      "129. Non-urgent background actions do not need expensive or high-speed processing.",
      "130. Persistent memory/storage is required for tools that will be reused.",
      "131. A tool that loses setup after restart is not acceptable.",
      "132. A Windows-targeted tool must be tested on Windows before being presented as ready.",
      "133. A tool must be tested after logout, restart, and reopening.",
      "134. A tool must be tested with real data, not only dummy/demo data.",
      "135. Every custom tool must have step-by-step usage instructions.",
      "136. Every tool must be checked against the Founder's development standards.",
      "137. If a tool requires an API token, .env variable, or credential, that dependency must be documented.",
      "138. If credentials are missing, the freelancer must list exact missing credential names.",
      "139. Random workarounds should not replace proper setup.",
      "140. A tool is not acceptable if it only works when the Founder or the worker performs repeated manual repair.",
    ],
  },
  {
    id: "I",
    label: "I. ShareT / Trello-Sharing Tool Rules",
    summary: "Specific rules for using the ShareT Trello-sharing tool — covering board selection, link generation, and UX standards.",
    whyItMatters: "ShareT is a custom tool with known edge cases. These rules prevent the specific bugs and workflow gaps that have caused problems in the past.",
    icon: ArrowRight,
    color: "border-sky-400 bg-sky-50/30 dark:bg-sky-950/10",
    iconColor: "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400",
    rules: [
      "141. ShareT's core purpose is to let external freelancers interact with a Trello card without needing a Trello account.",
      "142. External users should be able to comment and attach files through a shared card link.",
      "143. Board selection must show workspaces because the Founder has duplicate board names across workspaces.",
      "144. Generated links must persist after logout, app close, PC restart, and tool updates.",
      "145. Generated links may be temporarily deactivated during development, but they must not be permanently lost.",
      "146. The tool must import and display all Trello checklists, including multiple checklists.",
      "147. The tool must preserve Trello markup and formatting.",
      "148. The tool must show card members.",
      "149. The tool must show exact timestamps, not only '17 days ago.'",
      "150. The tool must load full action history, not only what is visible before 'show all actions.'",
      "151. The tool must import links attached directly to the Trello card.",
      "152. Attachment order should match Trello's order.",
      "153. Attachments must be clickable and open correctly.",
      "154. Comment formatting and attachments should work both ways: Trello to ShareT and ShareT to Trello.",
      "155. The success notification after link generation should not block clicking the link.",
      "156. Auto-copying generated links is nice-to-have, not necessarily core scope.",
      "157. The tool should auto-refresh periodically so freelancers do not work from stale card data.",
      "158. The tool should not introduce an extra credit/payment system unless the Founder approves it.",
      "159. The tool should show external commenter names clearly without forcing Trello account creation.",
    ],
  },
  {
    id: "J",
    label: "J. AI / Manus / Prompt-Work Rules",
    summary: "How to use AI tools effectively — covering prompt strategy, session management, and when to use AI vs. when to escalate.",
    whyItMatters: "AI tools are powerful but require structured prompting to produce reliable results. These rules ensure the worker uses AI to reduce the Founder's load, not to generate more work for him to review.",
    icon: Zap,
    color: "border-purple-400 bg-purple-50/30 dark:bg-purple-950/10",
    iconColor: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    rules: [
      "160. Before asking AI to build, first ask AI what it needs to know.",
      "161. Project scoping should precede project generation.",
      "162. the worker should answer the AI questions she can answer and send the Founder only the questions that require his judgment.",
      "163. Questions for the Founder should be converted into numbered yes/no format where possible.",
      "164. If a question is about the Founder's taste, strategic preference, or unknown history, the worker should mark it for the Founder.",
      "165. If a question is not needed for MVP, mark it as not needed now.",
      "166. When one Manus thread is busy, move to another thread. Do not watch AI work.",
      "167. For credit-burn sessions, use large prompts and multiple active threads.",
      "168. For big Manus sessions, use thread-hopping.",
      "169. Manus Max should be used for heavy coding, complex multi-step work, and large enhancements.",
      "170. Manus regular/1.6 should be used for lighter text, letters, analysis, and lower-credit work.",
      "171. Free or low-cost Manus credits should be preserved for urgent legal, lawyer, government, or obligation-related work.",
      "172. the Founder's ideas can wait; legal obligations cannot.",
      "173. Metered AI tools require the Founder's permission for personal use.",
      "174. Unmetered AI tools may be used more freely if the Founder has allowed it and usage limits are not an issue.",
      "175. If using AI for personal work, do not consume metered credits without permission.",
      "176. Use AI to understand unfamiliar legal, technical, or system contexts before briefing a freelancer.",
      "177. Use AI to resolve conflicting instructions into clarification questions.",
      "178. Use AI to turn broad goals into APTLSS plans (via the '🎯 APTLSS Plan' Power-Up button), checklists, and yes/no decision points.",
      "179. Temporary chats can be used for quick processing, but anything important must be saved before closing.",
      "180. AI output is not final unless the worker verifies it against the Founder's actual context.",
    ],
  },
  {
    id: "K",
    label: "K. APTLSS and Planning Rules",
    summary: "Rules for using the APTLSS planning framework — Action Plans, Timelines, and Step Sequences — for complex tasks.",
    whyItMatters: "Complex tasks without a plan create chaos. APTLSS gives the worker a structured way to break down large work into visible, trackable steps that the Founder can review at a glance.",
    icon: Target,
    color: "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10",
    iconColor: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    rules: [
      "181. the worker works better with Action Plans, Timelines, and Step Sequences.",
      "182. APTLSS should be used for large, unclear, or multi-step tasks.",
      "183. APTLSS lives as an AI-generated plan — click '🎯 APTLSS Plan' on any Trello card in the Power-Up to open it. Do NOT write APTLSS as a checklist, in the card description, or as a comment.",
      "184. The APTLSS panel defines: Action (single next step), Plan (strategy), Timeline, Links, Steps (ordered, checkable), Summary, urgency level, next checkpoint, and any the Founder decision needed.",
      "185. APTLSS per task is not enough; the worker also needs a daily cross-task schedule.",
      "186. If several APTLSS tasks are active, the worker should create a daily time-block plan.",
      "187. For each task, the worker should know whether it is urgent, important, blocked, waiting, or delegable.",
      "188. For small tasks under three minutes, do them immediately.",
      "189. If a task takes longer, place it in the right Trello card/checklist with a next action.",
      "190. When a task becomes large, break it into subtasks inside the card.",
      "191a. The APTLSS plan can be refreshed at any time by clicking '↻ Refresh' inside the panel. Plans are cached for 4 hours.",
      "191b. Completed steps inside the APTLSS panel can be ticked off directly — progress is saved per card.",
      "191c. The '📋 Copy' button in the APTLSS panel formats the full plan as a Trello comment for sharing with the Founder.",
    ],
  },
  {
    id: "L",
    label: "L. Legal, Housing, Police, Insurance, and Dispute Rules",
    summary: "How to handle legal, housing, police, insurance, and dispute matters — the highest-priority category in the system.",
    whyItMatters: "Legal and housing matters can cause severe, irreversible consequences with very little effort from the opposing institution. These rules exist because the cost of getting them wrong is catastrophic.",
    icon: Gavel,
    color: "border-red-400 bg-red-50/30 dark:bg-red-950/10",
    iconColor: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    rules: [
      "191. Legal, housing, police, court, and insurance matters require preventive urgency.",
      "192. For these matters, waiting can be dangerous because once procedures pass certain steps, damage may become irreversible.",
      "193. Vivare/housing matters are high priority because losing housing stability threatens both the Founder's life and the worker's work.",
      "194. Police/court matters are high priority because they can cause severe consequences with little effort from the institution.",
      "195. A legal reply on Trello must not sit without acknowledgement.",
      "196. If the Founder shares legal replies, the worker must triage, summarize, and identify next actions.",
      "197. Legal matters should have their own Trello board or clearly structured card system.",
      "198. Each legal case should have one central hub containing parties, documents, deadlines, correspondence, evidence, and next actions.",
      "199. Legal case information must not remain scattered across WhatsApp, Gmail, Drive, Upwork, Manus, and Trello.",
      "200. A lawyer outreach process must be managed as a queue.",
      "201. The first selected lawyer should receive full details and be engaged properly.",
      "202. Backup lawyers should receive polite queue-status emails.",
      "203. If lawyers require phone calls or physical visits, ask whether written/email communication is mandatory or negotiable.",
      "204. If a lawyer refuses written communication and that does not fit the Founder's needs, politely decline and record it.",
      "205. Record lawyer responses so Jawad and the Founder do not contact unsuitable lawyers again.",
      "206. Do not brief legal freelancers unless the worker understands the matter well enough.",
      "207. If the worker does not understand a legal issue, she and the Founder must go through it before she instructs a freelancer.",
      "208. For legal matters, written communication is preferred because it creates evidence.",
      "209. If a phone call happens, summarize it in writing afterward.",
      "210. Important legal/admin emails should be copied, linked, or summarized in Trello.",
      "211. If a deadline or ultimatum has passed, the matter becomes priority one until stabilized.",
      "212. For ASR/insurance submissions, sending is not enough; receipt or failure must be confirmed.",
      "213. If email attachments fail, do not keep retrying blindly; find an alternative route.",
      "214. For insurance claims, evidence should include receipts, invoices, bank statements, photos, police reports, and item lists where relevant.",
      "215. Additional costs caused by theft or legal/admin events should be added to the relevant claim card.",
      "216. Evidence involving burglary suspects must be preserved with source, timestamp, and original copies.",
      "217. For fake-product or marketplace disputes, preserve the product evidence, seller communication, platform messages, and police/threat evidence.",
    ],
  },
  {
    id: "M",
    label: "M. Evidence Preservation Rules",
    summary: "Rules for capturing, storing, and linking evidence before it can be deleted or lost.",
    whyItMatters: "Evidence that is not preserved immediately may be gone forever. Screenshots, recordings, and documents must be saved before hostile parties can delete them.",
    icon: Camera,
    color: "border-pink-400 bg-pink-50/30 dark:bg-pink-950/10",
    iconColor: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
    rules: [
      "218. If evidence may expire, disappear, be deleted, or become inaccessible, preserving it becomes priority one.",
      "219. ScreenPal/Loom/video evidence must be downloaded before deadlines.",
      "220. Backups should exist in more than one place when evidence is important.",
      "221. Videos should be downloaded, stored, and uploaded to the agreed destination when needed.",
      "222. Evidence should be linked to the relevant Trello card.",
      "223. Do not rely on platforms that can change storage limits without warning.",
      "224. For large evidence tasks, maintain a progress tracker: total, downloaded, uploaded, failed, remaining, deadline.",
      "225. Original files should be preserved before editing or compressing.",
      "226. Screenshots should be stored with date and context.",
      "227. If evidence belongs to a legal/insurance/police matter, treat it as sensitive and traceable.",
    ],
  },
  {
    id: "N",
    label: "N. Google Drive and File-Management Rules",
    summary: "Standards for naming, organizing, and linking files in Google Drive so they can always be found when needed.",
    whyItMatters: "A file saved in the wrong folder or with an unclear name is effectively lost. These rules ensure the file system supports legal, operational, and audit needs.",
    icon: Search,
    color: "border-lime-400 bg-lime-50/30 dark:bg-lime-950/10",
    iconColor: "bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400",
    rules: [
      "228. A task is not complete until the file is saved in the correct Drive folder and linked in Trello.",
      "229. Google Drive structure must be logical, named clearly, and consistent.",
      "230. Scattered files create legal and operational risk.",
      "231. Wrong folder placement is not a minor issue if the document must be found later.",
      "232. Receipts and invoices should be split and stored per receipt/invoice where appropriate.",
      "233. Drive folders should match Trello/legal/project structures where possible.",
      "234. Documents should be named so that the Founder or the worker can identify them later without opening each file.",
      "235. If a freelancer is sorting Drive, they need enough access to work, but not unnecessary access.",
      "236. Drive access should be temporary for freelancers.",
      "237. Files provided by email should be downloaded/saved to Drive if relevant to an ongoing matter.",
      "238. If attachments are too large, use a proper upload route instead of repeated failed email attempts.",
      "239. If Drive and Trello disagree, update both or link them clearly.",
    ],
  },
  {
    id: "O",
    label: "O. Account Access, LastPass, and Security Rules",
    summary: "How to manage account access, LastPass entries, and security so the worker is never blocked by a missing login.",
    whyItMatters: "Missing account access is one of the most common causes of task delays. These rules ensure every recurring account is documented, accessible, and secure.",
    icon: Shield,
    color: "border-slate-400 bg-slate-50/30 dark:bg-slate-950/10",
    iconColor: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400",
    rules: [
      "240. the worker needs LastPass access to recurring work accounts, otherwise tasks become blocked.",
      "241. Recurring accounts must have complete LastPass entries.",
      "242. Each account entry should include login URL, username/email, password, MFA method, recovery route, and notes.",
      "243. If a verification code is delayed, verify the email route, check spam if possible, then switch tasks while waiting.",
      "244. Do not sit idle waiting for a code.",
      "245. If access fails, document the exact issue.",
      "246. If a platform uses off-platform credentials, record the flow clearly.",
      "247. Account-sharing and third-party access should be deliberate, not casual.",
      "248. If a freelancer no longer needs access, remove it.",
      "249. If there is conflict with a freelancer, remove access before confrontation.",
      "250. Do not give broad account access when folder-specific or view-only access is enough.",
    ],
  },
  {
    id: "P",
    label: "P. Client and Business Rules",
    summary: "How to handle client relationships, deliverables, and business communications to protect long-term value.",
    whyItMatters: "Good clients are long-term assets. These rules ensure that client-facing work meets the standard required for government, legal, and client review — not just internal use.",
    icon: BookOpen,
    color: "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10",
    iconColor: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    rules: [
      "251. Good clients are long-term assets, not one-off transactions.",
      "252. If a client may bring recurring work, quality and communication must reflect that value.",
      "253. Client-facing deliverables must be accurate enough for client and government review.",
      "254. Do not assume a patient client will remain patient indefinitely.",
      "255. If a client has waited too long, asking for more money becomes risky.",
      "256. For Dutch clients, delivery and task completion often matter more than personal relationship.",
      "257. If failure could cost a major project, the task becomes high priority.",
      "258. the Founder should not promise client-facing quality unless the underlying work is accurate.",
      "259. the worker should understand the commercial consequences of client-facing delays.",
      "260. Recurring work helps fund the worker, tools, freelancers, and the Founder's broader goals.",
    ],
  },
  {
    id: "Q",
    label: "Q. Bike Shed / Design-Project Rules",
    summary: "Accuracy and documentation standards for design and permit drawings — where real-world dimensions always override aesthetics.",
    whyItMatters: "Permit drawings that don't match reality can cause legal and financial problems. Accuracy is non-negotiable when drawings are submitted to clients or government bodies.",
    icon: Home,
    color: "border-amber-400 bg-amber-50/30 dark:bg-amber-950/10",
    iconColor: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    rules: [
      "261. Accuracy beats aesthetics.",
      "262. For permit/client/government drawings, real-world dimensions and property conditions are the truth.",
      "263. Do not modify reality to make a render look cleaner.",
      "264. The drawing must match Google Maps, photos, dimensions, slopes, stairs, pathways, boundaries, and elevation differences.",
      "265. Old videos become invalid if newer written corrections override them.",
      "266. The latest written correction document is the source of truth.",
      "267. Do not mix old renders with new renders if they contain different edits.",
      "268. Do not export all final high-quality angles until the design itself is final.",
      "269. All required angles must be provided, not only one or two.",
      "270. If vegetation blocks the structure, provide both obstructed and unobstructed comparison views.",
      "271. If the side hedge blocks permit evaluation, remove enough of it in one view to show the full shed.",
      "272. If a house model is only a placeholder, the designer should still search for a better Dutch-style model within a fixed time window.",
      "273. Tool limitations are not valid excuses if the tool cannot produce accurate dimensions.",
      "274. If the software cannot do accurate technical work, the software is unsuitable.",
      "275. Before the designer edits, the worker must verify that he understands the correction document.",
      "276. If the designer repeatedly misunderstands, the worker should sit down with him and confirm point-by-point.",
      "277. If corrections affect the 3D model, the blueprint measurements must also be updated.",
      "278. If the project reaches the Founder's final boundary, the next version should be treated as client-facing, not another draft for the Founder to fix.",
    ],
  },
  {
    id: "R",
    label: "R. Work Infrastructure Rules",
    summary: "Rules for maintaining the physical and digital infrastructure the worker needs to work reliably — power, internet, equipment.",
    whyItMatters: "Infrastructure failures are operational problems, not personal inconveniences. A power outage that blocks communication affects the Founder's work too.",
    icon: Laptop,
    color: "border-cyan-400 bg-cyan-50/30 dark:bg-cyan-950/10",
    iconColor: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    rules: [
      "279. Infrastructure limitations are operational problems, not merely personal inconveniences.",
      "280. UPS was priority because power outages blocked communication and work.",
      "281. During power outages, the UPS should be used first to notify the Founder and preserve communication.",
      "282. Do not fully drain the UPS; keep enough power for phone communication.",
      "283. Dual screens are expected to improve context handling and productivity.",
      "284. If a tool or hardware investment improves reliability, the worker should report the effect.",
      "285. If hardware limitations are slowing output, the worker should raise it as an operational issue.",
      "286. A dedicated work WhatsApp account or setup is useful only if it is monitored consistently.",
      "287. Workspace setup should support focus, clarity, and quick switching between tasks.",
    ],
  },
  {
    id: "S",
    label: "S. Personal Performance and Accountability Rules",
    summary: "How the worker measures, reports, and improves her own performance — covering accountability, growth, and self-assessment.",
    whyItMatters: "Trustworthiness is the worker's biggest strength. These rules define how that trust is maintained and grown through measurable, visible improvement rather than vague promises.",
    icon: Target,
    color: "border-pink-400 bg-pink-50/30 dark:bg-pink-950/10",
    iconColor: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
    rules: [
      "288. the worker's biggest strength is trustworthiness; the next development area is autonomous effectiveness.",
      "289. the worker should make progress visible enough that the Founder can notice it without asking.",
      "290. Growth must be measurable, not only promised.",
      "291. 'I will improve communication' is too vague; 'I will update 2-5 Trello cards daily for 4 weeks' is measurable.",
      "292. the worker should define indicators for her own improvement and consistency.",
      "293. If the worker experiences a dip, she should inform the Founder before it becomes operational damage.",
      "294. Relapses in responsiveness must be treated as a system problem to solve, not only a personal intention to improve.",
      "295. the worker should consult a trusted person or use AI to build consistency systems if needed.",
      "296. the Founder may develop a baseline, merit, and demerit system.",
      "297. Baseline means no recurring preventable failures.",
      "298. Above-baseline work should be tied to measurable burden reduction, not merely doing more.",
      "299. Below-baseline work may eventually affect pay if agreed and formalized.",
      "300. Bonus/increase discussions should consider accuracy, speed, independence, progress, and reduced the Founder workload.",
      "301. The key question is: does the Founder have to do more or less work than before?",
      "302. the worker should not wait for the Founder to define the whole performance system alone; she should contribute thoughts.",
    ],
  },
  {
    id: "T",
    label: "T. Crunch-Time Rules",
    summary: "How to handle rare high-pressure periods when multiple deadlines collide and normal routines must be suspended.",
    whyItMatters: "Crunch time without structure becomes chaos. These rules ensure that even under extreme pressure, work is prioritized correctly and the Founder is never left without a status update.",
    icon: Clock,
    color: "border-red-400 bg-red-50/30 dark:bg-red-950/10",
    iconColor: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
    rules: [
      "303. Rare 20–24 hour crunch periods may happen when many deadlines collide.",
      "304. Crunch work should be structured, not chaotic.",
      "305. If the worker needs sleep during crunch time, she must hand over status before leaving.",
      "306. A suggested crunch rhythm is 20 hours work, 4 hours sleep, then continue if necessary.",
      "307. During crunch, legal obligations and irreversible-loss items outrank idea development.",
      "308. If the Founder expects the worker to stay available for a long session, clarify availability and handoff points.",
      "309. Do not disappear during a crunch without a status note.",
      "310. If multiple AI threads are running, organize tabs and workspaces so the session remains manageable.",
    ],
  },
  {
    id: "U",
    label: "U. Browser/Tab/Project-Organization Rules",
    summary: "How to organize browser tabs and desktops by project to prevent context-switching and project mixing.",
    whyItMatters: "Tab chaos leads to missed updates and project mixing. Grouping tabs by project ensures the worker can switch context cleanly without losing track of what belongs where.",
    icon: Search,
    color: "border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/10",
    iconColor: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    rules: [
      "311. Group tabs by project.",
      "312. Each project tab group should contain the intranet page, Manus thread, GitHub repo, Trello card, Drive folder, and relevant notes.",
      "313. Use separate desktops if tab groups are not enough.",
      "314. Do not let tab spam cause project mixing.",
      "315. If multiple projects are active, clearly define ownership: the Founder handles X, the worker handles Y.",
      "316. If the worker cannot track multiple projects, she should work one product at a time or group them strictly.",
      "317. When creating many Manus threads, maintain a tracking list so work is not duplicated.",
    ],
  },
  {
    id: "V",
    label: "V. Payment and Finance-Administration Rules",
    summary: "Rules for recording payment changes, equipment costs, and financial agreements between the Founder and the worker.",
    whyItMatters: "Financial agreements that are not documented in writing create disputes. These rules ensure every payment change, deduction, and cost-sharing arrangement is recorded clearly.",
    icon: DollarSign,
    color: "border-green-400 bg-green-50/30 dark:bg-green-950/10",
    iconColor: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    rules: [
      "318. Payment changes should be recorded clearly.",
      "319. If the Founder sends early payment, note the next regular payment date.",
      "320. If the worker buys work equipment with the Founder's support, clarify total cost, the worker contribution, the Founder contribution, and purpose.",
      "321. If the worker incurs travel cost due to a freelancer failing to deliver, the Founder may deduct that from the freelancer's compensation if agreed.",
      "322. Do not mix personal and project funds without clarity.",
      "323. If a tool has metered costs, permission is required before using it for non-the Founder work.",
    ],
  },
  {
    id: "W",
    label: "W. Medical / Diagnosis / Dutch-System Research Rules",
    summary: "How to navigate the Dutch healthcare system when researching medical or diagnosis matters on the Founder's behalf.",
    whyItMatters: "The Dutch referral system has specific rules that, if ignored, lead to wasted calls and dead ends. Understanding the process first saves significant time and avoids frustrating providers.",
    icon: Heart,
    color: "border-rose-400 bg-rose-50/30 dark:bg-rose-950/10",
    iconColor: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
    rules: [
      "324. Before contacting providers in the Netherlands, understand the referral system first.",
      "325. For diagnosis matters, first determine whether GP referral is required.",
      "326. Do not ask for GP contact details unless the process requires it and the reason is understood.",
      "327. When contacting doctors/providers, ask whether they can be recommended to the GP for referral.",
      "328. All medical/legal-adjacent communication should be written and traceable.",
      "329. Freelancers working on Dutch systems should receive enough explanation to avoid running in circles.",
    ],
  },
  {
    id: "X",
    label: "X. Written-Communication and Paper-Trail Rules",
    summary: "Why written communication is always preferred over calls, and how to create a traceable paper trail for every important interaction.",
    whyItMatters: "Calls are hard to prove. Written records protect the Founder in legal, insurance, and dispute situations. These rules ensure that every important communication leaves a trace.",
    icon: Mail,
    color: "border-slate-400 bg-slate-50/30 dark:bg-slate-950/10",
    iconColor: "bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400",
    rules: [
      "330. Written communication is preferred over calls for legal, government, insurance, client, and dispute matters.",
      "331. Calls are harder to prove; emails and texts create traceability.",
      "332. If a call is unavoidable, summarize the result in writing.",
      "333. Important communications should CC the Founder/the worker where appropriate.",
      "334. If a freelancer communicates externally, the Founder/the worker should remain in the loop.",
      "335. Sensitive or high-risk emails should be approved before sending unless authority was already given.",
      "336. A paper trail should exist before escalating disputes.",
      "337. Screenshots should be taken before a hostile party deletes or edits information.",
    ],
  },
  {
    id: "Y",
    label: "Y. Work-Quality Mindset Rules",
    summary: "The mindset standards that define what 'good enough' actually means — and why 'still fine' is not the same as 'done'.",
    whyItMatters: "Work that requires the Founder to inspect and correct is not finished work. These rules define the quality bar: would this make the Founder feel relieved, or would he still need to check it?",
    icon: CheckCircle,
    color: "border-violet-400 bg-violet-50/30 dark:bg-violet-950/10",
    iconColor: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
    rules: [
      "338. Do not accept 'this is still fine' if it does not meet the Founder's actual standard.",
      "339. Ask: would this make the Founder feel relieved, or would he still need to inspect and correct it?",
      "340. If the answer is that the Founder still needs to inspect heavily, the handover is not yet good enough.",
      "341. the worker should develop a sharp eye for shortcomings.",
      "342. Use AI to increase understanding, not to avoid responsibility.",
      "343. If the worker knows only 1%, she should use AI to get to enough understanding to act responsibly.",
      "344. Respect opens doors; coherent, complete, informed communication creates respect.",
      "345. Do not treat high standards as optional.",
      "346. If the Founder exports a standard into writing, use it as the operating standard.",
      "347. If a written standard exists, test against it.",
      "348. If a standard is unclear, ask for clarification or use AI to create a checklist.",
    ],
  },
  {
    id: "Z",
    label: "Z. Simple Best Dos Already Identified",
    summary: "A concise list of the most important behaviours already identified as high-value — the essentials distilled into simple, memorable rules.",
    whyItMatters: "These are the rules that have already proven their worth in practice. When in doubt, return to these basics — they cover the most common failure modes in one place.",
    icon: Star,
    color: "border-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/10",
    iconColor: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
    rules: [
      "349. What can be done in 3 minutes, do it now.",
      "350. Say what you do, do what you say.",
      "351. Do not assume silently.",
      "352. If you need the Founder, frame the question for yes/no.",
      "353. Make progress visible.",
      "354. If blocked, move another task forward.",
      "355. If it matters, put it in Trello.",
      "356. If it is urgent, send the Trello link on WhatsApp.",
      "357. If evidence can be lost, preserve it first.",
      "358. If a freelancer becomes risky, remove access first.",
      "359. If the task affects legal/housing/court/police/insurance, treat it as preventive defense.",
      "360. If the Founder feels burdened, the system needs improvement, not only more effort.",
    ],
  },
];

// ─── Quick Reference Card ─────────────────────────────────────────────────────
const QUICK_REFERENCE = [
  { rule: "3-min rule", desc: "If it takes < 3 min, do it now. Don't defer.", icon: Zap, color: "text-emerald-600" },
  { rule: "One-Chance rule", desc: "Freelancers get one clear brief. Misunderstand = escalate.", icon: Users, color: "text-orange-600" },
  { rule: "P0 always first", desc: "Legal/housing/irreversible loss trumps everything.", icon: AlertTriangle, color: "text-red-600" },
  { rule: "Say → Do", desc: "Say what you do, do what you say. No silent assumptions.", icon: CheckCircle, color: "text-blue-600" },
  { rule: "Trello = truth", desc: "If it's not in Trello, it doesn't exist.", icon: FileText, color: "text-indigo-600" },
  { rule: "Visible progress", desc: "Make progress visible without being asked.", icon: Target, color: "text-violet-600" },
  { rule: "Written > verbal", desc: "For legal/disputes/finance: always written + traceable.", icon: Mail, color: "text-slate-600" },
  { rule: "Preserve first", desc: "Evidence at risk? Screenshot and save before acting.", icon: Camera, color: "text-pink-600" },
];

// ─── Full Guide Data ─────────────────────────────────────────────────────────
const PRIORITY_LEVELS = [
  { p: "P0", type: "Emergency / irreversible loss", examples: "Legal ultimatum, housing threat, police/court deadline, evidence expiring today, hostile freelancer with access, account security risk", pace: "Immediate (0–15 min)", update: "WhatsApp the Founder if needed + Trello update as soon as safe", color: "bg-red-600" },
  { p: "P1", type: "Same-day urgent", examples: "Client-facing deadline, insurance submission, lawyer needs documents, freelancer blocked today, bike-shed final version, ASR/IND evidence", pace: "Same day — before routine work", update: "Trello update today. WhatsApp if the Founder must decide", color: "bg-orange-500" },
  { p: "P2", type: "Dependency unblocker", examples: "Freelancer needs answer, the Founder decision needed, Drive access required, missing file, Trello card unclear", pace: "Within 2–4 working hours", update: "Short status and next checkpoint", color: "bg-amber-500" },
  { p: "P3", type: "Normal scheduled work", examples: "Trello cleanup, Drive sorting, Loom/ScreenPal batches without same-day expiry, routine inbox work", pace: "Within 24–48 hours or scheduled block", update: "Daily card update if touched", color: "bg-blue-500" },
  { p: "P4", type: "Improvement / maintenance", examples: "Better templates, process cleanup, tool polish, training notes, non-urgent website treatment", pace: "Schedule weekly or after P0–P3", update: "Weekly or completion update", color: "bg-emerald-500" },
  { p: "P5", type: "Ideas / optional / personal growth", examples: "Future concepts, exploratory research, optional AI experiments, personal websites using approved tools", pace: "Only after obligations are stable", update: "No urgent update unless it affects work", color: "bg-slate-500" },
];

const TASK_TYPE_FULL = [
  { type: "Housing / Vivare", priority: "P0–P1", action: "Prevent harm before procedure advances. Keep lawyer, documents, Trello, and Drive current.", "the Founder": "Yes/no decisions only; urgent WhatsApp with card link" },
  { type: "Court / police / legal deadline", priority: "P0–P1", action: "Triage immediately. Identify deadline, document set, party, and next legal action.", "the Founder": "Ask for approval only after preparing recommendation" },
  { type: "Insurance / claim / stolen property", priority: "P1", action: "Confirm receipt, preserve evidence, attach receipts/photos/bank proof, track missing items.", "the Founder": "Ask specific yes/no questions on evidence inclusion" },
  { type: "Expiring evidence", priority: "P0–P1", action: "Download, back up, upload, and track counts before anything routine.", "the Founder": "Notify only if deadline/risk requires decision" },
  { type: "Client-facing deliverable", priority: "P1", action: "Verify quality, completeness, and acceptance criteria before sending.", "the Founder": "Only ask the Founder for final yes/no or missing preference" },
  { type: "Freelancer blocked", priority: "P1–P2", action: "Unblock with files, access, clarification, or yes/no from the Founder.", "the Founder": "Only if the worker cannot decide safely" },
  { type: "Problematic freelancer / access risk", priority: "P0", action: "Remove access first, preserve evidence, then notify/escalate.", "the Founder": "Notify the Founder before or immediately after if risk is active" },
  { type: "Software/tool testing", priority: "P2–P3", action: "Test against real workflow, not demo. List fixes vs recommendations.", "the Founder": "Bring only decision points or scope/payment questions" },
  { type: "Trello/Drive cleanup", priority: "P2–P3", action: "Make work visible and findable. Update links and status.", "the Founder": "No unless the Founder must decide structure" },
  { type: "Inbox / notification cleanup", priority: "P3", action: "Archive clutter, save relevant emails to Trello/Drive.", "the Founder": "No unless legal/client message requires decision" },
  { type: "Ideas / product development", priority: "P4–P5", action: "Use Manus/AI only after urgent obligations. Scope first, build later.", "the Founder": "Ask before metered credits or major direction choices" },
];

const PACE_RULES = [
  "Immediate means now, not later today. Stop lower-priority work and stabilize the risk.",
  "Same day means the worker must either complete the action or provide a clear recovery update before the day ends.",
  "Within 24 hours means no message, Trello update, freelancer reply, or third-party dependency should silently pass one full day.",
  "If a task takes less than three minutes and is safe to do, do it immediately.",
  "If a task cannot be done now, put the next action and follow-up time in Trello.",
  "If blocked by waiting, move to another task and leave a visible status.",
  "If the Founder needs to decide, send the card link and yes/no question instead of a broad request to review everything.",
  "If a deadline is unclear, convert it into a concrete date, time, or checkpoint.",
];

const FOUNDER_BRANCH = [
  { step: "1", q: "Can the worker decide safely from existing rules?", action: "If yes, decide and update Trello. If no, continue." },
  { step: "2", q: "Is the issue urgent today?", action: "If yes, WhatsApp the Founder with the Trello link. If no, place in daily close-out." },
  { step: "3", q: "Can the question be yes/no?", action: "Convert it into yes/no. If complex, ask several yes/no questions." },
  { step: "4", q: "Is the Founder being asked to review too much?", action: "Summarize the issue, give recommendation, ask for approval." },
  { step: "5", q: "No reply from the Founder?", action: "Follow up within 24h, sooner if legal/client/urgent." },
];

const FOUNDER_TEMPLATES = [
  "the Founder, decision needed on [card link]. I recommend [action]. Approve? Yes / No.",
  "the Founder, I found two options. My recommendation is Option A because [reason]. Approve A? Yes / No.",
  "the Founder, I reviewed the document. I need 5 decisions: 1) include X? Yes/No. 2) attach Y? Yes/No. 3) send today? Yes/No.",
];

const FREELANCER_STANDARD = [
  { situation: "Freelancer needs a file, access, or clarification", priority: "P1–P2", action: "Provide it or ask the Founder in yes/no format", escalation: "If blocked longer than 24h, escalate" },
  { situation: "Freelancer misses update once", priority: "P2", action: "Send warning/follow-up and set a new exact deadline", escalation: "Record in Trello" },
  { situation: "Freelancer misses twice", priority: "P1–P2", action: "Escalate. Set final appointment or replacement path", escalation: "Notify the Founder with recommendation" },
  { situation: "Freelancer misses three times", priority: "P1", action: "Default is termination/replacement unless the Founder says otherwise", escalation: "Prepare paper trail" },
  { situation: "Freelancer becomes hostile or access-risky", priority: "P0", action: "Remove access first, preserve evidence, then notify/escalate", escalation: "Tell the Founder immediately" },
  { situation: "Freelancer says task is done", priority: "P2–P3", action: "Test against actual workflow and acceptance criteria", escalation: "List fixes, not recommendations, if scope is incomplete" },
];

const FREELANCER_ONE_CHANCE = [
  { situation: "Freelancer needs a file, access, or clarification", priority: "P1–P2", action: "Provide it or ask the Founder in yes/no format", escalation: "If blocked longer than 24h, escalate" },
  { situation: "Freelancer misses an update, meeting, or agreed checkpoint once", priority: "P1–P2", action: "Treat this as the one and only chance: send a final warning/recovery checkpoint with exact deadline and record it in Trello", escalation: "Notify the Founder with recommendation if the miss affects legal, client, money, or timeline risk" },
  { situation: "Freelancer misses the final recovery checkpoint or repeats the failure", priority: "P1", action: "Prepare contract termination/replacement. Do not keep giving extra chances unless the Founder explicitly overrides", escalation: "Preserve paper trail. Remove access first if there is any account, code, Drive, Trello, or security risk" },
  { situation: "Freelancer becomes hostile or access-risky", priority: "P0", action: "Remove access first, preserve evidence, then notify/escalate", escalation: "Tell the Founder immediately" },
  { situation: "Freelancer says task is done", priority: "P2–P3", action: "Test against actual workflow and acceptance criteria", escalation: "List fixes, not recommendations, if scope is incomplete" },
];

const TRELLO_DRIVE_RULES = [
  "Every card touched today gets a same-day update.",
  "Every active freelancer card must show freelancer, role, Upwork link, deadline, latest update, and blocker.",
  "Every important file must be in the correct Drive folder and linked in Trello.",
  "If a task exists only in WhatsApp, convert it to Trello or attach it to an existing card.",
  "If the Founder needs urgent attention, update Trello first, then WhatsApp the card link.",
  "If Drive and Trello disagree, fix the mismatch or state clearly which is source of truth.",
];

const DAILY_ORDER_FULL = [
  { order: "1", check: "Any P0 emergency?", action: "Handle immediately" },
  { order: "2", check: "Any P1 due today/overdue?", action: "Work before routine tasks" },
  { order: "3", check: "Anyone blocked by the worker?", action: "Unblock or send status" },
  { order: "4", check: "Any the Founder decision needed?", action: "Prepare yes/no WhatsApp + Trello link" },
  { order: "5", check: "Any 24h follow-ups due?", action: "Follow up with freelancers/third parties" },
  { order: "6", check: "Any expiring evidence or access issue?", action: "Preserve/remove/secure before normal work" },
  { order: "7", check: "Scheduled Trello/Drive/admin work?", action: "Proceed in time blocks" },
  { order: "8", check: "End of day?", action: "Update all touched Trello cards and send close-out" },
];

const EXAMPLES = [
  { scenario: "Vivare lawyer deadline already passed", priority: "P0", pace: "Immediate", action: "Stop normal work. Send Honore lawyer all required documents. WhatsApp the Founder only if a yes/no decision is needed." },
  { scenario: "ScreenPal videos may be deleted by deadline", priority: "P0/P1", pace: "Immediate/same day", action: "Download, back up, track counts, delegate if possible, update Trello." },
  { scenario: "Bike shed client-ready version due tomorrow", priority: "P1", pace: "Same day", action: "Verify final corrections, confirm designer understands, update the Founder before deadline." },
  { scenario: "Freelancer asks for missing Drive access", priority: "P2", pace: "Within hours", action: "Grant correct temporary access or ask the Founder yes/no if sensitive." },
  { scenario: "the Founder sends WhatsApp task during workday", priority: "P2/P3", pace: "Acknowledge quickly", action: "React/reply, then convert to Trello if it cannot be done immediately." },
  { scenario: "Waiting for verification code", priority: "P3 unless urgent", pace: "Do not idle", action: "Notify the Founder, switch task or let the Founder use PC until code arrives." },
  { scenario: "Routine inbox notifications", priority: "P3", pace: "Scheduled block", action: "Archive clutter, save relevant emails to Trello/Drive." },
  { scenario: "New product idea website treatment", priority: "P4/P5", pace: "After obligations", action: "Scope first. Use unmetered tools freely; ask before metered credits." },
];

const QUICK_REFERENCE_FULL = [
  { condition: "Permanent loss is possible", action: "Stop and act now" },
  { condition: "Legal/housing/police/court/insurance/client risk exists", action: "Treat as P0/P1 and prevent escalation" },
  { condition: "the Founder is needed", action: "Send recommendation + yes/no question + Trello link" },
  { condition: "Freelancer is waiting", action: "Unblock within hours or explain blocker" },
  { condition: "No reply for 24 hours", action: "Follow up" },
  { condition: "Freelancer is risky", action: "Remove access before confrontation" },
  { condition: "Task was worked on today", action: "Update the Trello card today" },
  { condition: "File is important", action: "Save to correct Drive folder and link in Trello" },
  { condition: "AI/thread/tool is busy", action: "Move to another useful task" },
  { condition: "Task takes under 3 minutes", action: "Do it now, if safe" },
  { condition: "The issue is broken agreed functionality", action: "Call it a fix, not a recommendation" },
  { condition: "the worker is overloaded or personally affected", action: "Tell the Founder early with a reduced-output plan" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DecisionsTab() {
  const [treeStep, setTreeStep] = useState(0);
  const [treeResult, setTreeResult] = useState<{ label: string; color: string; desc: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"tree" | "matrix" | "quick" | "guide">("tree");
  const [guideSection, setGuideSection] = useState<string | null>(null);
  const [freelancerVariant, setFreelancerVariant] = useState<"standard" | "one-chance">("one-chance");

  const currentNode = DECISION_TREE[treeStep];

  const handleYes = () => {
    if (typeof currentNode.yes === "object") {
      setTreeResult(currentNode.yes);
    }
  };

  const handleNo = () => {
    if (currentNode.no === "next") {
      setTreeStep((s) => s + 1);
    } else if (typeof currentNode.no === "object") {
      setTreeResult(currentNode.no);
    }
  };

  const resetTree = () => {
    setTreeStep(0);
    setTreeResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Section nav */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "tree", label: "Decision Tree", icon: GitBranch },
          { id: "matrix", label: "Task Matrix", icon: Target },
          { id: "quick", label: "Quick Reference", icon: Zap },
          { id: "guide", label: "Full Guide", icon: BookOpen },
        ].map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              activeSection === section.id
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <section.icon className="w-3.5 h-3.5" />
            {section.label}
          </button>
        ))}
      </div>

      {/* ── DECISION TREE ── */}
      {activeSection === "tree" && (
        <div className="space-y-4">
          {/* Intro */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">5-Minute Task Triage</h2>
                  <p className="text-slate-400 text-xs">Answer each question to find the correct priority level.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Tree interaction */}
          {!treeResult ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                {/* Progress */}
                <div className="flex gap-1.5 mb-5">
                  {DECISION_TREE.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        idx < treeStep ? "bg-emerald-500" : idx === treeStep ? "bg-foreground" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>

                <div className="mb-5">
                  <Badge variant="outline" className="text-[10px] mb-3">Question {treeStep + 1} of {DECISION_TREE.length}</Badge>
                  <h3 className="text-base font-semibold text-foreground leading-snug">{currentNode.q}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={handleYes}
                    className="flex items-center justify-center gap-2 py-3.5 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 rounded-xl font-semibold text-sm hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> YES
                  </button>
                  <button
                    onClick={handleNo}
                    className="flex items-center justify-center gap-2 py-3.5 bg-muted/60 border-2 border-border text-foreground rounded-xl font-semibold text-sm hover:bg-muted transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" /> NO
                  </button>
                </div>
                {treeStep > 0 && (
                  <button
                    onClick={resetTree}
                    className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ↺ Start Over
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className={`${treeResult.color} p-5`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-xs font-medium uppercase tracking-wide">Priority Level</p>
                    <h3 className="text-lg font-bold text-white">{treeResult.label}</h3>
                  </div>
                </div>
                <p className="text-white/90 text-sm leading-relaxed">{treeResult.desc}</p>
              </div>
              <CardContent className="p-4">
                <button
                  onClick={resetTree}
                  className="w-full py-2.5 bg-muted/60 hover:bg-muted rounded-lg text-sm font-medium text-foreground transition-colors"
                >
                  ← Triage Another Task
                </button>
              </CardContent>
            </Card>
          )}

          {/* Daily execution order */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-semibold text-sm text-foreground mb-3">Daily Execution Order</h3>
              <div className="space-y-2">
                {DAILY_EXECUTION_ORDER.map((item) => (
                  <div key={item.step} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                      <item.icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{item.step}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* One-Chance Rule callout */}
          <Card className="border-0 shadow-sm border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground mb-1">The One-Chance Rule (Freelancers)</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Freelancers receive <strong className="text-foreground">one clear, complete brief</strong>. If they misunderstand a brief that was unambiguous, do not repeat the same explanation. Escalate to the Founder or replace the freelancer. Repeated misunderstanding after a clear brief is a signal — not a one-time mistake.
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-foreground font-medium">Before applying the One-Chance Rule, verify:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      <li>Was the brief truly clear and complete?</li>
                      <li>Did the freelancer confirm understanding?</li>
                      <li>Is this a misunderstanding or a skill gap?</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TASK MATRIX ── */}
      {activeSection === "matrix" && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-violet-500 to-purple-600"></div>
              <h2 className="text-base font-bold text-foreground">Task-Type Priority Matrix</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Use this table to instantly identify the correct priority level for any task type.</p>
            <div className="space-y-2">
              {TASK_TYPE_MATRIX.map((row, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3.5 rounded-xl border ${row.color}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{row.type}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{row.note}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <Badge className={`text-xs font-bold mb-1 ${
                      row.priority === "P0" ? "bg-red-600 text-white" :
                      row.priority === "P1" ? "bg-orange-500 text-white" :
                      row.priority === "P2" ? "bg-amber-500 text-white" :
                      row.priority === "P3" ? "bg-blue-500 text-white" :
                      row.priority === "P4" ? "bg-emerald-500 text-white" :
                      "bg-slate-500 text-white"
                    }`}>{row.priority}</Badge>
                    <p className="text-[10px] text-muted-foreground">{row.pace}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── FULL GUIDE ── */}
      {activeSection === "guide" && (
        <div className="space-y-3">
          {/* Header */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Task Prioritization Decision Tree</h2>
                  <p className="text-slate-400 text-xs">Full working guide — all 13 sections from the source document</p>
                </div>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed mt-2">
                Purpose: convert the rules from the Founder and the worker's conversations into a day-to-day decision tree. The goal is not only to finish tasks, but to reduce the Founder's burden, protect against legal/client loss, and make progress visible.
              </p>
            </div>
          </Card>

          {/* 1. Master Rule */}
          <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                The Master Rule
              </h3>
              <p className="text-xs text-muted-foreground mb-3 italic">At any moment the worker should ask: Which action prevents the greatest loss, unblocks the most people, or gives the Founder the clearest visible relief?</p>
              <div className="space-y-1.5">
                {[
                  "If failure could cause permanent loss, legal harm, evidence loss, housing risk, police/court escalation, client loss, or account/security damage: act immediately.",
                  "If someone is blocked by the worker, unblock them before starting lower-risk work.",
                  "If the Founder must decide, convert the issue into a recommendation plus yes/no questions.",
                  "If a task was touched today, update the Trello card today.",
                  "If waiting, do not idle. Switch task, prepare a fallback, or hand the PC back to the Founder.",
                ].map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 3. Priority Levels */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                Priority Levels &amp; Pace Standards
              </h3>
              <div className="space-y-2">
                {PRIORITY_LEVELS.map((level) => (
                  <div key={level.p} className="rounded-xl border border-border overflow-hidden">
                    <div className={`${level.color} px-3 py-2 flex items-center gap-2`}>
                      <span className="font-bold text-white text-sm">{level.p}</span>
                      <span className="text-white/90 text-xs font-medium">{level.type}</span>
                    </div>
                    <div className="p-3 bg-muted/20 space-y-1">
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Examples:</span> {level.examples}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Pace:</span> {level.pace}</p>
                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Update:</span> {level.update}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 4. Task-Type Decision Tree */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">4</span>
                Task-Type Decision Tree
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Use the task type to decide the minimum pace. If two rules apply, use the higher priority.</p>
              <div className="space-y-2">
                {TASK_TYPE_FULL.map((row, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className={`text-[10px] font-bold ${
                        row.priority.startsWith("P0") ? "bg-red-600 text-white" :
                        row.priority.startsWith("P1") ? "bg-orange-500 text-white" :
                        row.priority.startsWith("P2") ? "bg-amber-500 text-white" :
                        row.priority.startsWith("P3") ? "bg-blue-500 text-white" :
                        "bg-slate-500 text-white"
                      }`}>{row.priority}</Badge>
                      <p className="font-semibold text-xs text-foreground">{row.type}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">Action:</span> {row.action}</p>
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">"the Founder":</span> {row["the Founder"]}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 5. Pace Rules */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">5</span>
                The Pace Rules
              </h3>
              <div className="space-y-1.5">
                {PACE_RULES.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-teal-50 dark:bg-teal-950/20 rounded-lg">
                    <span className="w-4 h-4 rounded-full bg-teal-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-xs text-foreground">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 6. the Founder Decision Branch */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">6</span>
                the Founder-Decision Branch
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Use this branch whenever the worker thinks she needs the Founder.</p>
              <div className="space-y-2 mb-4">
                {FOUNDER_BRANCH.map((item) => (
                  <div key={item.step} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                    <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>
                    <div>
                      <p className="font-semibold text-xs text-foreground">{item.q}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.action}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3">
                <p className="text-xs font-semibold text-foreground mb-2">Standard message formats:</p>
                <div className="space-y-1.5">
                  {FOUNDER_TEMPLATES.map((tmpl, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground font-mono">{tmpl}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 7. Freelancer Branch */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">7</span>
                Freelancer Branch
              </h3>
              {/* Variant toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setFreelancerVariant("one-chance")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    freelancerVariant === "one-chance"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Shield className="w-3 h-3" /> One-Chance Rule (Active)
                </button>
                <button
                  onClick={() => setFreelancerVariant("standard")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    freelancerVariant === "standard"
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Users className="w-3 h-3" /> Standard (3-strikes)
                </button>
              </div>
              {freelancerVariant === "one-chance" && (
                <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      <strong>One-chance rule:</strong> A freelancer does not receive three chances. One missed update, meeting, or agreed checkpoint becomes the final recovery chance. If the freelancer misses that recovery checkpoint or repeats the failure, the worker prepares termination/replacement unless the Founder explicitly overrides.
                    </p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {(freelancerVariant === "one-chance" ? FREELANCER_ONE_CHANCE : FREELANCER_STANDARD).map((row, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className={`text-[10px] font-bold ${
                        row.priority.startsWith("P0") ? "bg-red-600 text-white" :
                        row.priority.startsWith("P1") ? "bg-orange-500 text-white" :
                        "bg-amber-500 text-white"
                      }`}>{row.priority}</Badge>
                      <p className="font-semibold text-xs text-foreground">{row.situation}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1"><span className="font-medium text-foreground">Action:</span> {row.action}</p>
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Escalation:</span> {row.escalation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 8. Trello & Drive Branch */}
          <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">8</span>
                Trello &amp; Drive Branch
              </h3>
              <p className="text-xs text-muted-foreground italic mb-3">A task is not complete until it is visible and findable.</p>
              <div className="space-y-1.5">
                {TRELLO_DRIVE_RULES.map((rule, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 9. Daily Execution Order */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">9</span>
                Daily Execution Order
              </h3>
              <div className="space-y-2">
                {DAILY_ORDER_FULL.map((item) => (
                  <div key={item.order} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{item.order}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-foreground">{item.check}</p>
                      <p className="text-xs text-muted-foreground">{item.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 10. Daily Close-Out Template */}
          <Card className="border-0 shadow-sm border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">10</span>
                Daily Close-Out Template
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Use this every workday:</p>
              <div className="space-y-1.5">
                {[
                  "Completed today:",
                  "Still open:",
                  "Blocked:",
                  "Waiting on the Founder:",
                  "Waiting on freelancer / third party:",
                  "Urgent tomorrow:",
                  "Cards updated today:",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                    <div className="w-3 h-3 rounded border-2 border-purple-400 flex-shrink-0" />
                    <p className="text-xs text-foreground font-medium">{item}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 11. Examples */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">11</span>
                Examples
              </h3>
              <div className="space-y-2">
                {EXAMPLES.map((ex, i) => (
                  <div key={i} className="p-3 bg-muted/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className={`text-[10px] font-bold ${
                        ex.priority.startsWith("P0") ? "bg-red-600 text-white" :
                        ex.priority.startsWith("P1") ? "bg-orange-500 text-white" :
                        ex.priority.startsWith("P2") ? "bg-amber-500 text-white" :
                        ex.priority.startsWith("P3") ? "bg-blue-500 text-white" :
                        "bg-slate-500 text-white"
                      }`}>{ex.priority}</Badge>
                      <p className="font-semibold text-xs text-foreground">{ex.scenario}</p>
                    </div>
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Pace:</span> {ex.pace}</p>
                    <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium text-foreground">Action:</span> {ex.action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 12. One-Page Quick Reference */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">12</span>
                One-Page Quick Reference
              </h3>
              <div className="space-y-1.5">
                {QUICK_REFERENCE_FULL.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                    <ArrowRight className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-foreground">If {item.condition}...</span>
                      <span className="text-xs text-muted-foreground"> → {item.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 13. Final Practical Rule */}
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground mb-1">13. Final Practical Rule</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    When uncertain, the worker should choose the action that most clearly <strong className="text-foreground">prevents loss</strong>, <strong className="text-foreground">unblocks another person</strong>, or <strong className="text-foreground">gives the Founder visible relief</strong>. Then document the action in Trello.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── QUICK REFERENCE ── */}
      {activeSection === "quick" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-yellow-500 to-amber-600"></div>
                <h2 className="text-base font-bold text-foreground">Quick Reference Card</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {QUICK_REFERENCE.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3.5 bg-muted/40 rounded-xl hover:bg-muted/60 transition-colors">
                    <item.icon className={`w-5 h-5 ${item.color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <p className="font-semibold text-sm text-foreground">{item.rule}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Z. Best Dos */}
          <Card className="border-0 shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-sm text-foreground">Z. Simple Best Dos (Always Apply)</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "What can be done in 3 minutes, do it now.",
                  "Say what you do, do what you say.",
                  "Do not assume silently.",
                  "If you need the Founder, frame the question for yes/no.",
                  "Make progress visible.",
                  "If blocked, move another task forward.",
                  "If it matters, put it in Trello.",
                  "If it is urgent, send the Trello link on WhatsApp.",
                  "If evidence can be lost, preserve it first.",
                  "If a freelancer becomes risky, remove access first.",
                  "If the task affects legal/housing/court/police/insurance, treat it as preventive defense.",
                  "If the Founder feels burdened, the system needs improvement, not only more effort.",
                ].map((rule, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
