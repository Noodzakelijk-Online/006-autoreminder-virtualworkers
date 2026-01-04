# Software Developer: Day-by-Day Plan
## Smart Interview System - Production Readiness

**Project:** Complete and refine the goal clarification interview system for APTLSS generation  
**Duration:** 7 working days  
**Goal:** Make the system production-ready, tested, and integrated with the full APTLSS workflow

---

## Day 1: Setup, Testing & Bug Fixes

**Objective:** Get the system running locally and fix any immediate issues

### Tasks:
1. **Local Environment Setup** (1-2 hours)
   - Clone/pull latest code from checkpoint `d962cfb3`
   - Install dependencies: `pnpm install`
   - Set up environment variables (TRELLO_API_KEY, TRELLO_TOKEN, etc.)
   - Start dev server: `pnpm dev`
   - Verify server runs without errors

2. **Test Interview Backend** (2-3 hours)
   - Test tRPC routes: `/api/trpc/interview.start` and `/api/trpc/interview.respond`
   - Use Postman/Insomnia to send test requests with a real Trello card ID
   - Verify pre-interview analysis extracts data correctly
   - Check that answer validation rejects vague responses
   - Confirm confidence scoring works (0-100%)

3. **Fix UI Integration Issues** (2-3 hours)
   - Navigate to APTLSS Management page
   - Load cards from Trello (fix any loading issues)
   - Click "Start Goal Interview" button on a card
   - Test the dialog opens and interview starts
   - Fix any TypeScript errors or runtime issues

4. **Document Bugs Found** (30 min)
   - Create a list of all bugs/issues encountered
   - Add them to `todo.md` with priority labels

**Deliverable:** System runs locally without errors, interview dialog opens

---

## Day 2: Interview Flow Testing & Refinement

**Objective:** Test the full interview flow with real cards and refine AI prompts

### Tasks:
1. **End-to-End Interview Testing** (3-4 hours)
   - Test interview with 5-10 different Trello cards (various complexity levels)
   - Document the AI's questions and your answers
   - Note where the AI accepts vague answers (shouldn't happen)
   - Note where the AI asks too many questions (over-probing)
   - Track confidence scores throughout each interview

2. **Refine Answer Validation** (2-3 hours)
   - Review `server/services/answer-validator.ts`
   - Add more vague patterns if you found any the system missed
   - Adjust confidence thresholds if needed
   - Test again with the same cards to verify improvements

3. **Improve AI Prompts** (1-2 hours)
   - Edit `server/services/conversational-interview.ts`
   - Refine the system prompt based on testing feedback
   - Make the AI more concise if it's too verbose
   - Make it probe deeper if it's accepting shallow answers

**Deliverable:** Interview flow works smoothly, AI asks smart questions, validation catches vague answers

---

## Day 3: Pre-Analysis Enhancement & Edge Cases

**Objective:** Improve pre-interview analysis and handle edge cases

### Tasks:
1. **Enhance Pre-Analysis** (3-4 hours)
   - Review `server/services/pre-interview-analysis.ts`
   - Improve evidence extraction (attachments, comments, descriptions)
   - Add detection for more patterns (deadlines, stakeholders, dependencies)
   - Test with cards that have:
     * No description
     * Many attachments
     * Long comment threads
     * Checklists already present

2. **Handle Edge Cases** (2-3 hours)
   - What if user closes dialog mid-interview?
   - What if Trello API fails during analysis?
   - What if card has no useful information?
   - Add error handling and graceful fallbacks
   - Add loading states and error messages in UI

3. **Improve Confidence Algorithm** (1 hour)
   - Review confidence calculation logic
   - Adjust weights for different validation criteria
   - Ensure 70% threshold is appropriate (not too easy/hard to reach)

**Deliverable:** System handles edge cases gracefully, pre-analysis extracts maximum information

---

## Day 4: ATIS Understanding Update (Unknowns-First Framework)

**Objective:** Update APTLSS generation to use the new "unknowns-first" framework

### Tasks:
1. **Study Current ATIS System** (1-2 hours)
   - Review `server/services/atis-understanding.ts`
   - Understand how it currently generates APTLSS checklists
   - Identify where the 21-step bloat comes from

2. **Implement Unknowns-First Prompt** (3-4 hours)
   - Replace the current prompt with the new framework:
     * **UNKNOWNS:** What questions need answers?
     * **DECISIONS:** What choices need to be made?
     * **EXECUTION:** What's the actual deliverable work?
   - Target: 3-6 items total (not 20+)
   - Each item should have:
     * A decision embedded in it
     * A tangible deliverable
     * Clear blocker identification (⏳)

3. **Test New Generation** (2 hours)
   - Generate APTLSS for 5 cards using the new system
   - Compare with old 21-step versions
   - Verify the new ones are:
     * Shorter (3-6 items)
     * More focused (no fluff)
     * Actionable (concrete deliverables)

**Deliverable:** APTLSS generation produces lean, focused 3-6 step plans

---

## Day 5: Integration & Goal-to-Execution Flow

**Objective:** Connect interview output to APTLSS generation

### Tasks:
1. **Store Interview Results** (2-3 hours)
   - When interview completes, store the final goal in database
   - Link goal to the Trello card
   - Include: goal statement, success criteria, confidence score, interview transcript

2. **Pass Goal to ATIS** (2-3 hours)
   - Modify ATIS understanding to accept a "goal" parameter
   - When goal exists, use it as primary input (not card description)
   - Generate APTLSS based on the clarified goal
   - Test: Interview → Goal → APTLSS generation (full flow)

3. **Update UI Flow** (2 hours)
   - After interview completes, show "Generate APTLSS" button
   - When clicked, use the clarified goal to generate
   - Display the generated APTLSS in the UI
   - Allow user to approve/edit before saving to Trello

**Deliverable:** Full flow works: Interview → Goal Clarification → APTLSS Generation

---

## Day 6: Testing, Polish & Documentation

**Objective:** Comprehensive testing and developer documentation

### Tasks:
1. **Write Unit Tests** (3-4 hours)
   - Test answer validation logic
   - Test confidence scoring
   - Test pre-analysis extraction
   - Test interview state management
   - Run: `pnpm test` and ensure all pass

2. **UI Polish** (2-3 hours)
   - Improve interview dialog styling
   - Add better loading states
   - Add error messages that are user-friendly
   - Ensure mobile responsiveness
   - Add keyboard shortcuts (Enter to send, Esc to close)

3. **Write Developer Documentation** (1-2 hours)
   - Document the interview system architecture
   - Explain how to add new validation patterns
   - Explain how to modify AI prompts
   - Add troubleshooting guide
   - Save as `INTERVIEW_SYSTEM_DOCS.md`

**Deliverable:** System is polished, tested, and documented

---

## Day 7: Production Readiness & Deployment Prep

**Objective:** Make the system production-ready

### Tasks:
1. **Performance Optimization** (2-3 hours)
   - Add caching for pre-analysis results
   - Optimize Trello API calls (batch requests)
   - Add rate limiting for interview endpoints
   - Test with 50+ cards to ensure it scales

2. **Monitoring & Logging** (2 hours)
   - Add structured logging for interview events
   - Track metrics: interview completion rate, average confidence, time to complete
   - Add error tracking (Sentry or similar)
   - Create admin dashboard to view interview analytics

3. **Security Review** (1-2 hours)
   - Ensure interview state is properly isolated per user
   - Validate all inputs to prevent injection attacks
   - Check that Trello tokens are not exposed in logs
   - Add rate limiting to prevent abuse

4. **Final Testing & Handoff** (2 hours)
   - Test the entire system end-to-end one more time
   - Create a demo video showing the full flow
   - Write deployment checklist
   - Prepare handoff document for founder

**Deliverable:** System is production-ready, secure, and ready to deploy

---

## Success Criteria

By the end of Day 7, the developer should have:

✅ A fully functional interview system running locally  
✅ Pre-analysis that extracts evidence from cards automatically  
✅ Answer validation that rejects vague responses  
✅ Confidence scoring that ensures goal clarity  
✅ Updated ATIS that generates lean 3-6 step plans  
✅ Full integration: Interview → Goal → APTLSS  
✅ Comprehensive unit tests (80%+ coverage)  
✅ Developer documentation  
✅ Production-ready code with monitoring  

---

## Daily Check-In Questions

At the end of each day, the developer should answer:

1. **What did I complete today?** (specific deliverables)
2. **What blockers did I encounter?** (technical issues, unclear requirements)
3. **What did I learn?** (insights about the system)
4. **What's my plan for tomorrow?** (next day's focus)
5. **Do I need help with anything?** (questions for founder/team)

---

## Key Files to Work With

**Backend:**
- `server/services/pre-interview-analysis.ts` - Card analysis
- `server/services/conversational-interview.ts` - AI interview logic
- `server/services/answer-validator.ts` - Validation rules
- `server/routes/interview.ts` - tRPC API routes
- `server/services/atis-understanding.ts` - APTLSS generation

**Frontend:**
- `client/src/components/GoalInterviewDialog.tsx` - Interview UI
- `client/src/pages/APTLSSManagement.tsx` - Main management page

**Testing:**
- Create `server/services/__tests__/` directory for unit tests

---

## Resources

**Trello API Docs:** https://developer.atlassian.com/cloud/trello/rest/  
**tRPC Docs:** https://trpc.io/docs  
**Current Checkpoint:** `d962cfb3`  
**Todo List:** `/home/ubuntu/va-dashboard/todo.md`

---

## Notes for Developer

- **Don't rush:** Quality over speed. Each day builds on the previous.
- **Test frequently:** Don't wait until Day 6 to test. Test after every change.
- **Ask questions:** If something is unclear, ask the founder immediately.
- **Document as you go:** Don't leave documentation for the end.
- **Think about the user:** Every decision should make the founder's life easier.

Good luck! 🚀
