/**
 * Answer Validator Service
 * 
 * Validates user answers during interview to ensure:
 * 1. Specificity (no vague answers)
 * 2. Outcome-focus (not just actions)
 * 3. Measurability (can determine success)
 * 4. Completeness (all critical info present)
 */

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-100
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'vague' | 'action_not_outcome' | 'unmeasurable' | 'missing_info' | 'unrealistic';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestedQuestion: string;
}

/**
 * Vague terms that should trigger follow-up questions
 */
const VAGUE_TERMS = {
  people: ['the client', 'the customer', 'the user', 'the team', 'someone', 'they', 'he', 'she'],
  actions: ['follow up', 'check in', 'touch base', 'reach out', 'get back to', 'circle back'],
  time: ['asap', 'soon', 'later', 'eventually', 'when possible', 'sometime'],
  outcomes: ['resolve', 'fix', 'handle', 'deal with', 'take care of', 'sort out'],
  amounts: ['some', 'a few', 'several', 'many', 'a lot'],
};

/**
 * Action verbs that indicate task-focus rather than outcome-focus
 */
const ACTION_VERBS = [
  'send', 'write', 'call', 'email', 'message', 'post', 'update', 'create',
  'make', 'build', 'draft', 'prepare', 'schedule', 'book', 'arrange'
];

/**
 * Validate a user answer
 */
export function validateAnswer(
  answer: string,
  questionContext: 'goal' | 'success' | 'deadline' | 'people' | 'constraints'
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];
  let confidence = 100;

  const lowerAnswer = answer.toLowerCase().trim();

  // Check for vague terms
  const vaguenessIssues = checkVagueness(lowerAnswer, questionContext);
  issues.push(...vaguenessIssues);
  confidence -= vaguenessIssues.length * 15;

  // Check if answer is action-focused rather than outcome-focused (for goal questions)
  if (questionContext === 'goal') {
    const actionIssue = checkActionVsOutcome(lowerAnswer);
    if (actionIssue) {
      issues.push(actionIssue);
      confidence -= 20;
    }
  }

  // Check if answer is measurable (for success criteria)
  if (questionContext === 'success') {
    const measurabilityIssue = checkMeasurability(lowerAnswer);
    if (measurabilityIssue) {
      issues.push(measurabilityIssue);
      confidence -= 15;
    }
  }

  // Check for missing critical info
  const missingInfoIssues = checkMissingInfo(lowerAnswer, questionContext);
  issues.push(...missingInfoIssues);
  confidence -= missingInfoIssues.length * 10;

  // Generate suggestions based on issues
  issues.forEach(issue => {
    if (issue.severity === 'critical') {
      suggestions.push(issue.suggestedQuestion);
    }
  });

  // Clamp confidence to 0-100
  confidence = Math.max(0, Math.min(100, confidence));

  const isValid = confidence >= 70 && issues.filter(i => i.severity === 'critical').length === 0;

  return {
    isValid,
    confidence,
    issues,
    suggestions,
  };
}

/**
 * Check for vague terms in the answer
 */
function checkVagueness(answer: string, context: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for vague people references
  VAGUE_TERMS.people.forEach(term => {
    if (answer.includes(term)) {
      issues.push({
        type: 'vague',
        severity: 'critical',
        message: `"${term}" is too vague - which specific person/organization?`,
        suggestedQuestion: `You mentioned "${term}" - can you be more specific? Which person or organization exactly?`,
      });
    }
  });

  // Check for vague actions
  VAGUE_TERMS.actions.forEach(term => {
    if (answer.includes(term)) {
      issues.push({
        type: 'vague',
        severity: 'warning',
        message: `"${term}" is vague - what specifically are you trying to accomplish?`,
        suggestedQuestion: `You said "${term}" - what specifically do you want to achieve by doing that?`,
      });
    }
  });

  // Check for vague time references
  if (context === 'deadline') {
    VAGUE_TERMS.time.forEach(term => {
      if (answer.includes(term)) {
        issues.push({
          type: 'vague',
          severity: 'critical',
          message: `"${term}" is not a specific deadline`,
          suggestedQuestion: `You said "${term}" - can you give me a specific date or timeframe? For example, "by Friday" or "within 2 weeks"?`,
        });
      }
    });
  }

  // Check for vague outcomes
  VAGUE_TERMS.outcomes.forEach(term => {
    if (answer.includes(term)) {
      issues.push({
        type: 'vague',
        severity: 'warning',
        message: `"${term}" is vague - what does that look like specifically?`,
        suggestedQuestion: `You want to "${term}" something - what does that look like when it's done? What's the specific outcome?`,
      });
    }
  });

  return issues;
}

/**
 * Check if answer is action-focused rather than outcome-focused
 */
function checkActionVsOutcome(answer: string): ValidationIssue | null {
  // Check if answer starts with an action verb
  const startsWithAction = ACTION_VERBS.some(verb => {
    const pattern = new RegExp(`^${verb}\\s`, 'i');
    return pattern.test(answer);
  });

  if (startsWithAction) {
    return {
      type: 'action_not_outcome',
      severity: 'warning',
      message: 'This sounds like an action, not an outcome',
      suggestedQuestion: `I hear you want to ${answer}. But what do you want to ACHIEVE by doing that? What's the desired outcome?`,
    };
  }

  // Check for common action-only patterns
  if (answer.match(/^(send|write|call|email|create|make|draft)\s+\w+$/i)) {
    return {
      type: 'action_not_outcome',
      severity: 'critical',
      message: 'This is just an action - what happens after?',
      suggestedQuestion: `Okay, so you ${answer}. Then what? What do you want to happen as a result?`,
    };
  }

  return null;
}

/**
 * Check if answer is measurable
 */
function checkMeasurability(answer: string): ValidationIssue | null {
  // Check for concrete indicators of success
  const hasMeasurableIndicators = 
    answer.includes('receive') ||
    answer.includes('get') ||
    answer.includes('signed') ||
    answer.includes('approved') ||
    answer.includes('paid') ||
    answer.includes('completed') ||
    answer.includes('delivered') ||
    answer.match(/\d+/) || // Contains numbers
    answer.includes('response') ||
    answer.includes('confirmation');

  if (!hasMeasurableIndicators && answer.length > 10) {
    return {
      type: 'unmeasurable',
      severity: 'warning',
      message: 'How will you know when this is done?',
      suggestedQuestion: `How will you know when this is successfully done? What specific thing will happen or exist that proves it's complete?`,
    };
  }

  return null;
}

/**
 * Check for missing critical information
 */
function checkMissingInfo(answer: string, context: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // For goal context, check if "who" and "what" are present
  if (context === 'goal') {
    // Check if answer mentions who is involved
    const mentionsPerson = answer.match(/\b[A-Z][a-z]+\b/) || answer.includes('client') || answer.includes('customer');
    if (!mentionsPerson && answer.length > 20) {
      issues.push({
        type: 'missing_info',
        severity: 'info',
        message: 'Who is involved in this?',
        suggestedQuestion: 'Who are the key people or organizations involved in achieving this goal?',
      });
    }
  }

  // For deadline context, check if answer has a date
  if (context === 'deadline') {
    const hasDate = answer.match(/\d{1,2}\/\d{1,2}/) || 
                    answer.match(/\d{4}-\d{2}-\d{2}/) ||
                    answer.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i) ||
                    answer.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i);
    
    if (!hasDate && !answer.includes('no deadline') && answer.length > 5) {
      issues.push({
        type: 'missing_info',
        severity: 'critical',
        message: 'No specific date mentioned',
        suggestedQuestion: 'Can you give me a specific date? For example, "January 15" or "next Friday"?',
      });
    }
  }

  return issues;
}

/**
 * Calculate overall confidence for the entire interview
 */
export function calculateInterviewConfidence(
  answers: Array<{ question: string; answer: string; validation: ValidationResult }>
): number {
  if (answers.length === 0) return 0;

  // Average confidence across all answers
  const avgConfidence = answers.reduce((sum, a) => sum + a.validation.confidence, 0) / answers.length;

  // Penalize if any critical issues remain
  const criticalIssues = answers.reduce((sum, a) => 
    sum + a.validation.issues.filter(i => i.severity === 'critical').length, 0
  );

  let finalConfidence = avgConfidence - (criticalIssues * 10);

  // Bonus for having all key questions answered
  const hasGoal = answers.some(a => a.question.toLowerCase().includes('goal') || a.question.toLowerCase().includes('outcome'));
  const hasSuccess = answers.some(a => a.question.toLowerCase().includes('success') || a.question.toLowerCase().includes('done'));
  const hasDeadline = answers.some(a => a.question.toLowerCase().includes('deadline') || a.question.toLowerCase().includes('when'));

  if (hasGoal && hasSuccess && hasDeadline) {
    finalConfidence += 10;
  }

  return Math.max(0, Math.min(100, finalConfidence));
}

/**
 * Generate follow-up question based on validation issues
 */
export function generateFollowUpQuestion(validation: ValidationResult): string | null {
  // Prioritize critical issues
  const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    return criticalIssues[0].suggestedQuestion;
  }

  // Then warnings
  const warningIssues = validation.issues.filter(i => i.severity === 'warning');
  if (warningIssues.length > 0) {
    return warningIssues[0].suggestedQuestion;
  }

  // No issues
  return null;
}
