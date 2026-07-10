import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InfoTooltip } from "@/components/manus/InfoTooltip";
import { RULE_CATEGORIES } from "./RulesTab";
import {
  BookOpen,
  Shield,
  Search,
  Lightbulb,
  MessageSquare,
  DollarSign,
  Target,
  AlertTriangle,
  Clock,
  RefreshCw,
} from "lucide-react";

// ── Guidelines sub-tab ──────────────────────────────────────────────────────
function GuidelinesContent() {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600"></div>
          <h2 className="text-base font-bold text-foreground">Work Guidelines &amp; Communication</h2>
          <InfoTooltip
            content="Essential guidelines for effective communication, autonomy, and professional standards. Expand any section to read the full guideline."
            className="ml-1"
          />
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {/* Yes/No System */}
          <AccordionItem value="yesno" className="border border-blue-200/50 dark:border-blue-800/30 rounded-lg px-4 bg-blue-50/30 dark:bg-blue-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">The Yes/No Communication System</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 space-y-3 border border-border/50">
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">What Is It?</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Propose outcomes or solutions when tasks lack specific directions</li>
                    <li>Frame communications to elicit a simple "Yes" or "No" response</li>
                    <li>Provide sufficient context and detail to support decision-making</li>
                    <li>Use AI tools for any "how," "why," "where," "when," or "what" questions</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">Why It Exists:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Efficiency", desc: "Reduces time on explanations", color: "bg-blue-50 dark:bg-blue-950/20" },
                      { label: "Empowerment", desc: "Encourages initiative", color: "bg-emerald-50 dark:bg-emerald-950/20" },
                      { label: "Clarity", desc: "Reduces misunderstandings", color: "bg-violet-50 dark:bg-violet-950/20" },
                      { label: "Swift Decisions", desc: "No micromanagement", color: "bg-amber-50 dark:bg-amber-950/20" },
                    ].map((item, idx) => (
                      <div key={idx} className={`${item.color} rounded-lg p-2.5`}>
                        <p className="font-medium text-foreground text-xs">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">How to Use It:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs">
                    <li><strong className="text-foreground">Propose outcomes when unspecified:</strong> Assess tasks, develop proposals, use AI tools</li>
                    <li><strong className="text-foreground">Frame for Yes/No responses:</strong> Craft messages requiring only "Yes" or "No"</li>
                    <li><strong className="text-foreground">Use Trello for all communications:</strong> Submit proposals via Trello cards</li>
                    <li><strong className="text-foreground">Provide daily updates:</strong> Update each assigned task before end of workday</li>
                    <li><strong className="text-foreground">Adhere to core standards:</strong> Document management, traceability, data completeness</li>
                  </ol>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-lg p-3">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-xs mb-1">What if I receive "No" without explanation?</p>
                  <p className="text-[11px] text-muted-foreground">Ask a targeted yes/no question to identify the concern. Example: "Is the proposed timeline the main concern?"</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* AI Tools */}
          <AccordionItem value="ai" className="border border-purple-200/50 dark:border-purple-800/30 rounded-lg px-4 bg-purple-50/30 dark:bg-purple-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Use of AI Tools</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 space-y-3 border border-border/50">
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">Leverage AI Platforms:</p>
                  <p className="text-xs text-muted-foreground">Use ChatGPT and other AI tools to assist with tasks, formulate proposals, and answer questions.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">Effective Usage:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li><strong className="text-foreground">Specific Queries:</strong> Ask clear and specific questions for accurate answers</li>
                    <li><strong className="text-foreground">Human Judgment:</strong> Use AI as support, not replacement. Apply your own expertise</li>
                  </ul>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg p-3">
                  <p className="font-semibold text-red-900 dark:text-red-200 text-xs mb-1">Ethical Considerations:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground">
                    <li>Do not share sensitive/proprietary information with AI platforms</li>
                    <li>Use AI-generated content as reference; ensure outputs are customized and authentic</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Communication Protocol */}
          <AccordionItem value="comm" className="border border-emerald-200/50 dark:border-emerald-800/30 rounded-lg px-4 bg-emerald-50/30 dark:bg-emerald-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Communication Protocol</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 space-y-3 border border-border/50">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                    <p className="font-semibold text-foreground text-xs mb-1">Primary Channel</p>
                    <p className="text-[11px] text-muted-foreground">All communications requiring approval must use Trello cards</p>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3">
                    <p className="font-semibold text-foreground text-xs mb-1">Response Time</p>
                    <p className="text-[11px] text-muted-foreground">Respond to all messages within 24 hours</p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">Structured Inquiries:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Frame questions to elicit "yes" or "no" responses</li>
                    <li>Provide sufficient background in Trello card to demonstrate understanding</li>
                    <li>Expect replies within 24 hours</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Financial Approvals */}
          <AccordionItem value="finance" className="border border-amber-200/50 dark:border-amber-800/30 rounded-lg px-4 bg-amber-50/30 dark:bg-amber-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Financial Approval Requests</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 space-y-3 border border-border/50">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 rounded-lg p-3">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200 text-xs mb-1">Expenses ≤ $25 USD</p>
                  <p className="text-[11px] text-muted-foreground">Proceed without approval. Document and justify in bookkeeping software.</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg p-3">
                  <p className="font-semibold text-red-900 dark:text-red-200 text-xs mb-1">Expenses &gt; $25 USD</p>
                  <p className="text-[11px] text-muted-foreground mb-2">Requires prior approval via Trello. Include:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-muted-foreground">
                    <li><strong className="text-foreground">Purpose:</strong> What funds will be used for</li>
                    <li><strong className="text-foreground">Justification:</strong> Why expenditure is necessary</li>
                    <li><strong className="text-foreground">Cost Breakdown:</strong> Detailed costs and total</li>
                    <li><strong className="text-foreground">Expected Benefits:</strong> ROI or value added</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Core Standards */}
          <AccordionItem value="core-standards" className="border border-red-200/50 dark:border-red-800/30 rounded-lg px-4 bg-red-50/30 dark:bg-red-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Core Standards (CRITICAL)</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 border border-border/50">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { title: "Document Management", items: ["Keep only final versions", "Store in correct Google Drive location", "Follow file-naming conventions"], color: "bg-blue-50 dark:bg-blue-950/20" },
                    { title: "Traceability", items: ["Record all actions in Trello", "Document all communications", "Ensure processes are auditable"], color: "bg-emerald-50 dark:bg-emerald-950/20" },
                    { title: "Data Completeness", items: ["Fill all required fields", "No blanks in forms/entries", "Verify accuracy before submission"], color: "bg-violet-50 dark:bg-violet-950/20" },
                    { title: "Process Adherence", items: ["Follow all steps completely", "Reach out to all parties", "Document all responses"], color: "bg-amber-50 dark:bg-amber-950/20" },
                  ].map((standard, idx) => (
                    <div key={idx} className={`${standard.color} rounded-lg p-3`}>
                      <p className="font-semibold text-foreground text-xs mb-1.5">{standard.title}</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                        {standard.items.map((item, i) => <li key={i}>{item}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Company Accounts */}
          <AccordionItem value="accounts" className="border border-indigo-200/50 dark:border-indigo-800/30 rounded-lg px-4 bg-indigo-50/30 dark:bg-indigo-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Company Accounts &amp; Tools</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 space-y-3 border border-border/50">
                <div>
                  <p className="font-semibold text-foreground mb-2 text-sm">Before Starting a Task:</p>
                  <p className="text-xs text-muted-foreground mb-2">Ask if we have an existing account for the required tool/platform.</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                    <li><strong className="text-foreground">If yes:</strong> Use the existing account</li>
                    <li><strong className="text-foreground">If no:</strong> Create account using our email address (provided to you)</li>
                  </ul>
                </div>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg p-3">
                  <p className="font-semibold text-red-900 dark:text-red-200 text-xs mb-1">Security Rules:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                    <li>Use ONLY company-provided/approved accounts</li>
                    <li>Send all emails from company email accounts</li>
                    <li>Keep credentials confidential</li>
                    <li>No personal use of company accounts</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Core Work Standards */}
          <AccordionItem value="work-standards" className="border border-violet-200/50 dark:border-violet-800/30 rounded-lg px-4 bg-violet-50/30 dark:bg-violet-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Core Work Standards</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="space-y-1.5">
                {[
                  { title: "Communicate Proactively", desc: "If you hit a blocker or need clarification, communicate immediately via Trello. Don't wait to be asked about your progress.", icon: MessageSquare, color: "from-violet-500 to-violet-600" },
                  { title: "24-48 Hour Response Time", desc: "Respond to all emails, WhatsApp messages, and Upwork messages within 24-48 hours. This is a non-negotiable standard.", icon: Clock, color: "from-red-500 to-red-600" },
                  { title: "Follow Instructions Carefully", desc: "Before starting any task, read all instructions, watch any provided videos, and review all documents. Rework costs double the time.", icon: BookOpen, color: "from-indigo-500 to-indigo-600" },
                  { title: "Clean Up As You Go", desc: "After every card: close related tabs, delete downloaded files. This way there is nothing to clean up at end of day.", icon: RefreshCw, color: "from-teal-500 to-teal-600" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg">
                    <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <item.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="font-medium text-foreground text-sm flex-1">{item.title}</p>
                    <InfoTooltip content={item.desc} side="left" />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Emergency Procedures */}
          <AccordionItem value="emergency" className="border border-orange-200/50 dark:border-orange-800/30 rounded-lg px-4 bg-orange-50/30 dark:bg-orange-950/10">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="font-semibold text-sm text-foreground">Emergency Procedures &amp; Illness</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-3 text-sm">
              <div className="bg-card rounded-lg p-4 space-y-3 border border-border/50">
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/30 rounded-lg p-3">
                  <p className="font-semibold text-red-900 dark:text-red-200 text-xs mb-1">If Unable to Work:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                    <li>Notify via Trello within 12 hours of onset</li>
                    <li>Provide exact return date (ETA)</li>
                  </ul>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-lg p-3">
                  <p className="font-semibold text-amber-900 dark:text-amber-200 text-xs mb-1">Technical Issues:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
                    <li>Report via Trello within 12 hours</li>
                    <li>Include: issue description, steps taken, impact, proposed solutions</li>
                  </ul>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ── Rules sub-tab ────────────────────────────────────────────────────────────
function RulesContent() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCategories = RULE_CATEGORIES.map((cat) => ({
    ...cat,
    rules: searchQuery
      ? cat.rules.filter((r) =>
          r.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : cat.rules,
  })).filter((cat) => cat.rules.length > 0);

  const totalMatches = filteredCategories.reduce((sum, c) => sum + c.rules.length, 0);

  const highlightText = (text: string) => {
    if (!searchQuery) return <>{text}</>;
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/60 text-foreground rounded-sm px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-violet-500 to-indigo-600"></div>
          <h2 className="text-base font-bold text-foreground">360 Operating Rules</h2>
          <Badge variant="secondary" className="ml-1 text-xs">
            {searchQuery ? `${totalMatches} match${totalMatches !== 1 ? "es" : ""}` : "360 rules · 26 categories"}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search rules by keyword…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No rules match "<strong>{searchQuery}</strong>"
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={searchQuery ? filteredCategories.map((c) => c.id) : undefined}
            className="space-y-2"
          >
            {filteredCategories.map((category) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className={`border rounded-lg px-4 ${category.color}`}
              >
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${category.iconColor}`}>
                      <category.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{category.label}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {category.rules.length} rules
                        </Badge>
                      </div>
                      {(category as typeof category & { summary?: string }).summary && !searchQuery && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                          {(category as typeof category & { summary?: string }).summary}
                        </p>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4 space-y-3">
                  {/* Why it matters callout */}
                  {(category as typeof category & { whyItMatters?: string }).whyItMatters && (
                    <div className="flex items-start gap-2.5 bg-card border border-border/60 rounded-lg p-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px]">💡</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-foreground mb-0.5">Why this matters</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {(category as typeof category & { whyItMatters?: string }).whyItMatters}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Rule cards */}
                  <div className="space-y-1.5">
                    {category.rules.map((rule, idx) => {
                      const ruleNum = rule.match(/^(\d+)\./)?.[1] ?? String(idx + 1);
                      const ruleText = rule.replace(/^\d+\.\s*/, "");
                      return (
                        <div key={idx} className="flex items-start gap-2.5 bg-card/60 border border-border/40 rounded-lg px-3 py-2 hover:bg-card transition-colors">
                          <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 mt-0.5 w-6 shrink-0 text-right tabular-nums">
                            {ruleNum}.
                          </span>
                          <span className="text-xs text-foreground leading-relaxed">{highlightText(ruleText)}</span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

// ── StandardsTab ─────────────────────────────────────────────────────────────
export default function StandardsTab() {
  return (
    <Tabs defaultValue="guidelines" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 h-10">
        <TabsTrigger value="guidelines" className="text-sm font-medium flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Guidelines
        </TabsTrigger>
        <TabsTrigger value="rules" className="text-sm font-medium flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Rules
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">360</Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="guidelines">
        <GuidelinesContent />
      </TabsContent>

      <TabsContent value="rules">
        <RulesContent />
      </TabsContent>
    </Tabs>
  );
}
