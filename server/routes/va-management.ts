import { Router } from 'express';
import { getDb } from '../db';
import { 
  vaProfiles, 
  taskAssignments, 
  taskDependencies, 
  founderPriorityOverrides,
  clients,
  communicationLog,
  reviewQueue,
  timeEntries,
  handoffNotes,
  dailyBriefings,
  users
} from '../../drizzle/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { sendMorningBriefing, sendEODReport, validateSendGridApiKey } from '../services/email';

const router = Router();

// ============================================
// VA PROFILES
// ============================================

// Get all VAs for the current founder
router.get('/vas', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const vas = await db.select().from(vaProfiles).where(eq(vaProfiles.founderId, user.id));
    
    res.json(vas);
  } catch (error) {
    console.error('Error fetching VAs:', error);
    res.status(500).json({ error: 'Failed to fetch VAs' });
  }
});

// Create a new VA profile
router.post('/vas', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { 
      name, email, timezone, skills, hourlyRate, currency, 
      workStartHour, workEndHour, workingDays,
      breakfastTime, breakfastDuration,
      lunchTime, lunchDuration,
      dinnerTime, dinnerDuration
    } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const result = await db.insert(vaProfiles).values({
      founderId: user.id,
      userId: user.id, // Initially same as founder, can be updated when worker creates account
      name,
      email,
      timezone: timezone || 'Asia/Manila',
      skills: skills ? JSON.stringify(skills) : null,
      hourlyRate,
      currency: currency || 'USD',
      workStartHour: workStartHour ?? 9,
      workEndHour: workEndHour ?? 18,
      workingDays: workingDays || '1,2,3,4,5',
      breakfastTime: breakfastTime ?? null,
      breakfastDuration: breakfastDuration ?? 0,
      lunchTime: lunchTime ?? 12,
      lunchDuration: lunchDuration ?? 60,
      dinnerTime: dinnerTime ?? null,
      dinnerDuration: dinnerDuration ?? 0,
    });

    res.json({ success: true, id: result[0].insertId });
  } catch (error) {
    console.error('Error creating VA:', error);
    res.status(500).json({ error: 'Failed to create VA' });
  }
});

// Update VA profile
router.put('/vas/:id', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vaId = parseInt(req.params.id);
    const updates = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Verify ownership
    const existing = await db.select().from(vaProfiles).where(
      and(eq(vaProfiles.id, vaId), eq(vaProfiles.founderId, user.id))
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'VA not found' });
    }

    await db.update(vaProfiles)
      .set({
        ...updates,
        skills: updates.skills ? JSON.stringify(updates.skills) : existing[0].skills,
      })
      .where(eq(vaProfiles.id, vaId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating VA:', error);
    res.status(500).json({ error: 'Failed to update VA' });
  }
});

// Delete VA profile
router.delete('/vas/:id', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vaId = parseInt(req.params.id);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    await db.delete(vaProfiles).where(
      and(eq(vaProfiles.id, vaId), eq(vaProfiles.founderId, user.id))
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting VA:', error);
    res.status(500).json({ error: 'Failed to delete VA' });
  }
});

// ============================================
// TIMEZONE DETECTION
// ============================================

// Get detected timezone for a VA
router.get('/vas/:id/timezone', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vaId = parseInt(req.params.id);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get VA profile
    const va = await db.select().from(vaProfiles).where(
      and(eq(vaProfiles.id, vaId), eq(vaProfiles.founderId, user.id))
    ).limit(1);

    if (va.length === 0) {
      return res.status(404).json({ error: 'VA not found' });
    }

    const profile = va[0];
    
    // Import timezone detection
    const { getVATimezone, detectTimezoneFromLocation, detectTimezoneFromEmail } = 
      await import('../services/timezone-detection');
    
    // Get detected timezone
    const detectedTimezone = await getVATimezone(vaId);
    
    // Get detection sources for display
    // Note: vaProfiles doesn't have a location field, so we use name as a fallback
    const nameTimezone = profile.name ? detectTimezoneFromLocation(profile.name) : null;
    const emailTimezone = profile.email ? detectTimezoneFromEmail(profile.email) : null;
    
    res.json({
      vaId,
      vaName: profile.name,
      currentTimezone: profile.timezone,
      detectedTimezone,
      detectionSources: {
        fromName: nameTimezone,
        fromEmail: emailTimezone,
        name: profile.name,
        email: profile.email,
      },
      isManuallySet: profile.timezone && 
        profile.timezone !== 'Asia/Manila' && 
        profile.timezone !== detectedTimezone,
    });
  } catch (error) {
    console.error('Error getting VA timezone:', error);
    res.status(500).json({ error: 'Failed to get timezone' });
  }
});

// Update VA timezone
router.put('/vas/:id/timezone', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vaId = parseInt(req.params.id);
    const { timezone } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Verify ownership
    const existing = await db.select().from(vaProfiles).where(
      and(eq(vaProfiles.id, vaId), eq(vaProfiles.founderId, user.id))
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'VA not found' });
    }

    await db.update(vaProfiles)
      .set({ timezone })
      .where(eq(vaProfiles.id, vaId));

    res.json({ success: true, timezone });
  } catch (error) {
    console.error('Error updating VA timezone:', error);
    res.status(500).json({ error: 'Failed to update timezone' });
  }
});

// ============================================
// USER LINKING
// ============================================

// Get all users for linking
router.get('/users', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users);

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Link user account to VA profile
router.post('/vas/:id/link-user', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vaId = parseInt(req.params.id);
    const { userId } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Verify ownership
    const existing = await db.select().from(vaProfiles).where(
      and(eq(vaProfiles.id, vaId), eq(vaProfiles.founderId, user.id))
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'VA not found' });
    }

    // Update the VA profile with the linked user ID
    await db.update(vaProfiles)
      .set({ userId: userId || null })
      .where(eq(vaProfiles.id, vaId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error linking user:', error);
    res.status(500).json({ error: 'Failed to link user' });
  }
});

// ============================================
// TASK ASSIGNMENTS
// ============================================

// Assign task to VA
router.post('/assignments', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, vaId, notes } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Check if already assigned
    const existing = await db.select().from(taskAssignments).where(
      and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.founderId, user.id))
    );

    if (existing.length > 0) {
      // Update existing assignment
      await db.update(taskAssignments)
        .set({ vaId, notes, assignedAt: new Date() })
        .where(eq(taskAssignments.id, existing[0].id));
    } else {
      // Create new assignment
      await db.insert(taskAssignments).values({
        taskId,
        vaId,
        founderId: user.id,
        assignedBy: user.id,
        notes,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// Get assignments for a VA
router.get('/assignments/va/:vaId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vaId = parseInt(req.params.vaId);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const assignments = await db.select().from(taskAssignments).where(
      and(eq(taskAssignments.vaId, vaId), eq(taskAssignments.founderId, user.id))
    );

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Update assignment status
router.put('/assignments/:taskId/status', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;
    const { status } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    await db.update(taskAssignments)
      .set({ status })
      .where(and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.founderId, user.id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating assignment status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ============================================
// TASK DEPENDENCIES
// ============================================

// Add dependency
router.post('/dependencies', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, blockedByTaskId, dependencyType } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    await db.insert(taskDependencies).values({
      taskId,
      blockedByTaskId,
      founderId: user.id,
      dependencyType: dependencyType || 'finish_to_start',
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding dependency:', error);
    res.status(500).json({ error: 'Failed to add dependency' });
  }
});

// Get dependencies for a task
router.get('/dependencies/:taskId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const blockedBy = await db.select().from(taskDependencies).where(
      and(eq(taskDependencies.taskId, taskId), eq(taskDependencies.founderId, user.id))
    );

    const blocks = await db.select().from(taskDependencies).where(
      and(eq(taskDependencies.blockedByTaskId, taskId), eq(taskDependencies.founderId, user.id))
    );

    res.json({ blockedBy, blocks });
  } catch (error) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch dependencies' });
  }
});

// ============================================
// FOUNDER PRIORITY OVERRIDES
// ============================================

// Set priority override
router.post('/priority-override', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, priority, reason, expiresAt } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Upsert priority override
    const existing = await db.select().from(founderPriorityOverrides).where(
      and(eq(founderPriorityOverrides.taskId, taskId), eq(founderPriorityOverrides.founderId, user.id))
    );

    if (existing.length > 0) {
      await db.update(founderPriorityOverrides)
        .set({ priority, reason, expiresAt: expiresAt ? new Date(expiresAt) : null })
        .where(eq(founderPriorityOverrides.id, existing[0].id));
    } else {
      await db.insert(founderPriorityOverrides).values({
        taskId,
        founderId: user.id,
        priority,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting priority override:', error);
    res.status(500).json({ error: 'Failed to set priority' });
  }
});

// Get all priority overrides
router.get('/priority-overrides', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const overrides = await db.select().from(founderPriorityOverrides).where(
      eq(founderPriorityOverrides.founderId, user.id)
    );

    res.json(overrides);
  } catch (error) {
    console.error('Error fetching priority overrides:', error);
    res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

// ============================================
// CLIENTS
// ============================================

// Get all clients
router.get('/clients', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const clientList = await db.select().from(clients).where(eq(clients.founderId, user.id));
    
    res.json(clientList);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Create client
router.post('/clients', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, priority, trelloBoardIds, contactEmail, notes } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const result = await db.insert(clients).values({
      founderId: user.id,
      name,
      priority: priority || 'standard',
      trelloBoardIds: trelloBoardIds ? JSON.stringify(trelloBoardIds) : null,
      contactEmail,
      notes,
    });

    res.json({ success: true, id: result[0].insertId });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// ============================================
// COMMUNICATION LOG
// ============================================

// Add message to log
router.post('/communication', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, toUserId, messageType, message, context } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    await db.insert(communicationLog).values({
      taskId,
      fromUserId: user.id,
      toUserId,
      messageType,
      message,
      context: context ? JSON.stringify(context) : null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error adding communication:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Get communication log for a task
router.get('/communication/:taskId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const messages = await db.select().from(communicationLog)
      .where(eq(communicationLog.taskId, taskId))
      .orderBy(desc(communicationLog.createdAt));

    res.json(messages);
  } catch (error) {
    console.error('Error fetching communication:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ============================================
// REVIEW QUEUE
// ============================================

// Submit task for review
router.post('/review-queue', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, vaId } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    await db.insert(reviewQueue).values({
      taskId,
      vaId,
      founderId: user.id,
      status: 'pending_review',
    });

    // Update assignment status
    await db.update(taskAssignments)
      .set({ status: 'ready_for_review' })
      .where(eq(taskAssignments.taskId, taskId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting for review:', error);
    res.status(500).json({ error: 'Failed to submit for review' });
  }
});

// Get review queue
router.get('/review-queue', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const queue = await db.select().from(reviewQueue)
      .where(eq(reviewQueue.founderId, user.id))
      .orderBy(desc(reviewQueue.submittedAt));

    res.json(queue);
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Review task (approve/reject)
router.put('/review-queue/:id', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reviewId = parseInt(req.params.id);
    const { status, feedback } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const existing = await db.select().from(reviewQueue).where(eq(reviewQueue.id, reviewId));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    await db.update(reviewQueue)
      .set({ 
        status, 
        feedback, 
        reviewedAt: new Date(),
        revisionCount: status === 'needs_revision' ? existing[0].revisionCount + 1 : existing[0].revisionCount
      })
      .where(eq(reviewQueue.id, reviewId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error reviewing task:', error);
    res.status(500).json({ error: 'Failed to review task' });
  }
});

// ============================================
// TIME TRACKING
// ============================================

// Start timer
router.post('/time-entries/start', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, vaId } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const result = await db.insert(timeEntries).values({
      taskId,
      vaId,
      founderId: user.id,
      startTime: new Date(),
    });

    res.json({ success: true, id: result[0].insertId });
  } catch (error) {
    console.error('Error starting timer:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Stop timer
router.put('/time-entries/:id/stop', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const entryId = parseInt(req.params.id);
    const { notes } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const existing = await db.select().from(timeEntries).where(eq(timeEntries.id, entryId));
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Time entry not found' });
    }

    const endTime = new Date();
    const startTime = new Date(existing[0].startTime);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    await db.update(timeEntries)
      .set({ endTime, durationMinutes, notes })
      .where(eq(timeEntries.id, entryId));

    res.json({ success: true, durationMinutes });
  } catch (error) {
    console.error('Error stopping timer:', error);
    res.status(500).json({ error: 'Failed to stop timer' });
  }
});

// Get time entries for a task
router.get('/time-entries/:taskId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const entries = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.taskId, taskId), eq(timeEntries.founderId, user.id)))
      .orderBy(desc(timeEntries.startTime));

    // Calculate total time
    const totalMinutes = entries.reduce((sum: number, e: typeof entries[0]) => sum + (e.durationMinutes || 0), 0);

    res.json({ entries, totalMinutes });
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// ============================================
// HANDOFF NOTES
// ============================================

// Create handoff note
router.post('/handoff', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId, fromVaId, toVaId, whereLeftOff, nextSteps, blockers } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    await db.insert(handoffNotes).values({
      taskId,
      fromVaId,
      toVaId,
      founderId: user.id,
      whereLeftOff,
      nextSteps,
      blockers,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating handoff:', error);
    res.status(500).json({ error: 'Failed to create handoff' });
  }
});

// Get handoff notes for a task
router.get('/handoff/:taskId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const notes = await db.select().from(handoffNotes)
      .where(and(eq(handoffNotes.taskId, taskId), eq(handoffNotes.founderId, user.id)))
      .orderBy(desc(handoffNotes.createdAt));

    res.json(notes);
  } catch (error) {
    console.error('Error fetching handoff notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// ============================================
// ASSIGNMENTS LIST (for Founder Dashboard)
// ============================================

// Get all assignments with task details
router.get('/assignments', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const assignments = await db.select().from(taskAssignments)
      .where(eq(taskAssignments.founderId, user.id))
      .orderBy(desc(taskAssignments.assignedAt));
    
    // Get VA names
    const vas = await db.select().from(vaProfiles).where(eq(vaProfiles.founderId, user.id));
    const vaMap = new Map(vas.map((v: typeof vas[0]) => [v.id, v.name]));
    
    // Get priority overrides
    const overrides = await db.select().from(founderPriorityOverrides)
      .where(eq(founderPriorityOverrides.founderId, user.id));
    const overrideMap = new Map(overrides.map((o: typeof overrides[0]) => [o.taskId, o.priority]));
    
    // Parse taskId to extract card info (format: cardId:checklistId:checkItemId)
    const result = assignments.map((a: typeof assignments[0]) => {
      const taskParts = a.taskId.split(':');
      const cardId = taskParts[0] || '';
      
      return {
        id: a.id,
        taskId: a.taskId,
        taskTitle: a.notes || 'Task from Trello',
        cardName: 'Trello Card',
        cardId: cardId,
        vaId: a.vaId,
        vaName: a.vaId ? vaMap.get(a.vaId) : null,
        priority: overrideMap.get(a.taskId) || 'normal',
        isPriorityOverride: overrideMap.has(a.taskId),
        status: a.status,
        estimatedMinutes: 60,
        scheduledStart: null,
        scheduledEnd: null,
        blockedBy: [],
        clientProject: null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Assign task to VA (update existing assignment)
router.post('/assignments/:id/assign', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const assignmentId = parseInt(req.params.id);
    const { vaId } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    await db.update(taskAssignments)
      .set({ vaId, assignedAt: new Date() })
      .where(and(eq(taskAssignments.id, assignmentId), eq(taskAssignments.founderId, user.id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// Set priority override for assignment
router.post('/assignments/:id/priority', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const assignmentId = parseInt(req.params.id);
    const { priority } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Get the task ID from the assignment
    const assignment = await db.select().from(taskAssignments)
      .where(and(eq(taskAssignments.id, assignmentId), eq(taskAssignments.founderId, user.id)));
    
    if (assignment.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    const taskId = assignment[0].taskId;
    
    // Upsert priority override
    const existing = await db.select().from(founderPriorityOverrides).where(
      and(eq(founderPriorityOverrides.taskId, taskId), eq(founderPriorityOverrides.founderId, user.id))
    );

    if (existing.length > 0) {
      await db.update(founderPriorityOverrides)
        .set({ priority })
        .where(eq(founderPriorityOverrides.id, existing[0].id));
    } else {
      await db.insert(founderPriorityOverrides).values({
        taskId,
        founderId: user.id,
        priority,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting priority:', error);
    res.status(500).json({ error: 'Failed to set priority' });
  }
});

// ============================================
// REVIEWS (for Founder Dashboard)
// ============================================

// Get reviews with VA names
router.get('/reviews', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const queue = await db.select().from(reviewQueue)
      .where(eq(reviewQueue.founderId, user.id))
      .orderBy(desc(reviewQueue.submittedAt));
    
    // Get VA names
    const vas = await db.select().from(vaProfiles).where(eq(vaProfiles.founderId, user.id));
    const vaMap = new Map(vas.map((v: typeof vas[0]) => [v.id, v.name]));
    
    // Parse taskId to extract info
    const result = queue.map((r: typeof queue[0]) => {
      const taskParts = r.taskId.split(':');
      const cardId = taskParts[0] || '';
      
      return {
        id: r.id,
        taskId: r.taskId,
        taskTitle: 'Task for Review',
        cardName: 'Trello Card',
        vaId: r.vaId,
        vaName: r.vaId ? vaMap.get(r.vaId) : 'Unknown VA',
        submittedAt: r.submittedAt,
        status: r.status === 'pending_review' ? 'pending' : r.status === 'needs_revision' ? 'revision_requested' : r.status,
        notes: r.feedback,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Approve review
router.post('/reviews/:id/approve', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reviewId = parseInt(req.params.id);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    await db.update(reviewQueue)
      .set({ status: 'approved', reviewedAt: new Date() })
      .where(and(eq(reviewQueue.id, reviewId), eq(reviewQueue.founderId, user.id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// Request revision
router.post('/reviews/:id/revision', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reviewId = parseInt(req.params.id);
    const { notes } = req.body;
    
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const existing = await db.select().from(reviewQueue).where(eq(reviewQueue.id, reviewId));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    await db.update(reviewQueue)
      .set({ 
        status: 'needs_revision', 
        feedback: notes,
        reviewedAt: new Date(),
        revisionCount: existing[0].revisionCount + 1
      })
      .where(eq(reviewQueue.id, reviewId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error requesting revision:', error);
    res.status(500).json({ error: 'Failed to request revision' });
  }
});

// ============================================
// COMMUNICATIONS (for Founder Dashboard)
// ============================================

// Get all communications
router.get('/communications', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const messages = await db.select().from(communicationLog)
      .where(eq(communicationLog.toUserId, user.id))
      .orderBy(desc(communicationLog.createdAt))
      .limit(50);
    
    // Get VA names
    const vas = await db.select().from(vaProfiles).where(eq(vaProfiles.founderId, user.id));
    const vaMap = new Map(vas.map((v: typeof vas[0]) => [v.userId, v.name]));
    
    const result = messages.map((m: typeof messages[0]) => ({
      id: m.id,
      taskId: m.taskId,
      vaId: m.fromUserId,
      vaName: vaMap.get(m.fromUserId) || 'Unknown',
      type: m.messageType || 'note',
      message: m.message,
      timestamp: m.createdAt,
      isRead: m.isRead || false,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// ============================================
// BRIEFING SETTINGS
// ============================================

// Note: Briefing settings are stored in a simple key-value approach
// For now, return static defaults - can be extended with a settings table later

// Get briefing settings
router.get('/briefing-settings', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Return defaults - briefing settings can be stored in userWorkingHours or a separate settings table
    res.json({
      morningBriefingEnabled: true,
      morningBriefingTime: '08:00',
      eodReportEnabled: true,
      eodReportTime: '18:00',
    });
  } catch (error) {
    console.error('Error fetching briefing settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Save briefing settings
router.post('/briefing-settings', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // For now, just acknowledge the save - can be persisted to a settings table later
    const { morningBriefingEnabled, morningBriefingTime, eodReportEnabled, eodReportTime } = req.body;
    
    // Log the settings for debugging
    console.log('Briefing settings saved:', { morningBriefingEnabled, morningBriefingTime, eodReportEnabled, eodReportTime });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving briefing settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ============================================
// EMAIL NOTIFICATIONS
// ============================================

// Send test email
router.post('/email/test', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isValid = await validateSendGridApiKey();
    if (!isValid) {
      return res.status(400).json({ error: 'SendGrid API key not configured or invalid' });
    }

    res.json({ success: true, message: 'SendGrid API key is valid' });
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ error: 'Failed to test email' });
  }
});

// Send morning briefing to a worker
router.post('/email/morning-briefing/:workerId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workerId = parseInt(req.params.workerId);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get worker profile
    const worker = await db.select().from(vaProfiles).where(
      and(eq(vaProfiles.id, workerId), eq(vaProfiles.founderId, user.id))
    ).limit(1);

    if (worker.length === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    if (!worker[0].email) {
      return res.status(400).json({ error: 'Worker has no email address' });
    }

    // Get worker's tasks for today
    const assignments = await db.select().from(taskAssignments).where(
      and(eq(taskAssignments.vaId, workerId), eq(taskAssignments.founderId, user.id))
    );

    const tasks = assignments.map((a: typeof assignments[0]) => ({
      title: `Task ${a.taskId.split(':').pop()}`,
      cardName: 'Project',
      startTime: '09:00',
      endTime: '10:00',
      durationHours: 1,
      priority: 'normal',
    }));

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const success = await sendMorningBriefing(worker[0].email, {
      workerName: worker[0].name,
      date: today,
      tasks,
      totalHours: tasks.reduce((sum: number, t: typeof tasks[0]) => sum + t.durationHours, 0),
      highPriorityCount: tasks.filter((t: typeof tasks[0]) => ['critical', 'urgent', 'high'].includes(t.priority)).length,
    });

    if (success) {
      res.json({ success: true, message: `Morning briefing sent to ${worker[0].email}` });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Error sending morning briefing:', error);
    res.status(500).json({ error: 'Failed to send briefing' });
  }
});

// Send EOD report to founder
router.post('/email/eod-report/:workerId', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const workerId = parseInt(req.params.workerId);
    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }

    // Get worker profile
    const worker = await db.select().from(vaProfiles).where(
      and(eq(vaProfiles.id, workerId), eq(vaProfiles.founderId, user.id))
    ).limit(1);

    if (worker.length === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Get worker's tasks
    const assignments = await db.select().from(taskAssignments).where(
      and(eq(taskAssignments.vaId, workerId), eq(taskAssignments.founderId, user.id))
    );

    const completedTasks = assignments.filter((a: typeof assignments[0]) => a.status === 'completed').map((a: typeof assignments[0]) => ({
      title: `Task ${a.taskId.split(':').pop()}`,
      cardName: 'Project',
      durationHours: 1,
      priority: 'normal',
    }));

    const incompleteTasks = assignments.filter((a: typeof assignments[0]) => a.status === 'in_progress').map((a: typeof assignments[0]) => ({
      title: `Task ${a.taskId.split(':').pop()}`,
      cardName: 'Project',
      durationHours: 1,
      priority: 'normal',
    }));

    const blockedTasks = assignments.filter((a: typeof assignments[0]) => a.status === 'blocked').map((a: typeof assignments[0]) => ({
      title: `Task ${a.taskId.split(':').pop()}`,
      cardName: 'Project',
      durationHours: 1,
      priority: 'normal',
    }));

    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const totalTasks = completedTasks.length + incompleteTasks.length + blockedTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

    // Send to founder's email (user.email)
    const founderEmail = user.email;
    if (!founderEmail) {
      return res.status(400).json({ error: 'Founder has no email address' });
    }

    const success = await sendEODReport(founderEmail, {
      workerName: worker[0].name,
      date: today,
      completedTasks,
      incompleteTasks,
      blockedTasks,
      totalHoursWorked: completedTasks.reduce((sum: number, t: typeof completedTasks[0]) => sum + t.durationHours, 0),
      completionRate,
    });

    if (success) {
      res.json({ success: true, message: `EOD report sent to ${founderEmail}` });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Error sending EOD report:', error);
    res.status(500).json({ error: 'Failed to send report' });
  }
});

// ============================================
// TIMEZONE OVERLAPS
// ============================================

// Get timezone overlaps
router.get('/timezone-overlaps', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const vas = await db.select().from(vaProfiles).where(eq(vaProfiles.founderId, user.id));
    
    // Calculate overlaps (simplified calculation)
    const overlaps = vas.map((va: typeof vas[0]) => {
      // Founder assumed to be in Europe/Amsterdam (9-18)
      const founderStart = 9;
      const founderEnd = 18;
      
      const tzOffsets: Record<string, number> = {
        'Europe/Amsterdam': 1,
        'Asia/Manila': 8,
        'Asia/Jakarta': 7,
        'Asia/Kolkata': 5.5,
        'America/New_York': -5,
        'America/Los_Angeles': -8,
        'UTC': 0,
      };
      
      const founderOffset = tzOffsets['Europe/Amsterdam'] || 0;
      const vaOffset = tzOffsets[va.timezone] || 0;
      const diff = vaOffset - founderOffset;
      
      const vaStartInFounder = va.workStartHour - diff;
      const vaEndInFounder = va.workEndHour - diff;
      
      const overlapStart = Math.max(founderStart, vaStartInFounder);
      const overlapEnd = Math.min(founderEnd, vaEndInFounder);
      const overlapHours = Math.max(0, overlapEnd - overlapStart);
      
      return {
        vaId: va.id,
        vaName: va.name,
        vaTimezone: va.timezone,
        overlapHours,
        overlapStart: `${Math.floor(overlapStart)}:00`,
        overlapEnd: `${Math.floor(overlapEnd)}:00`,
      };
    });

    res.json(overlaps);
  } catch (error) {
    console.error('Error calculating timezone overlaps:', error);
    res.status(500).json({ error: 'Failed to calculate overlaps' });
  }
});

// ============================================
// WORKLOAD OVERVIEW (Founder Dashboard)
// ============================================

// Get workload overview for all VAs
router.get('/workload-overview', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Get all VAs
    const vas = await db.select().from(vaProfiles).where(eq(vaProfiles.founderId, user.id));
    
    // Get all users for linking info
    const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
    const userMap = new Map(allUsers.map((u: typeof allUsers[0]) => [u.id, u.email]));
    
    // Get assignment counts per VA
    const workload = await Promise.all(vas.map(async (va: typeof vas[0]) => {
      const assignments = await db.select().from(taskAssignments).where(
        and(eq(taskAssignments.vaId, va.id), eq(taskAssignments.founderId, user.id))
      );
      
      const statusCounts = {
        assigned: 0,
        in_progress: 0,
        completed: 0,
        blocked: 0,
        ready_for_review: 0,
      };
      
      assignments.forEach((a: typeof assignments[0]) => {
        if (a.status in statusCounts) {
          statusCounts[a.status as keyof typeof statusCounts]++;
        }
      });

      return {
        worker: {
          ...va,
          linkedUserEmail: va.userId ? userMap.get(va.userId) || null : null,
        },
        totalTasks: assignments.length,
        statusCounts,
      };
    }));

    res.json(workload);
  } catch (error) {
    console.error('Error fetching workload overview:', error);
    res.status(500).json({ error: 'Failed to fetch workload' });
  }
});

// ============================================
// WORKER-SPECIFIC ENDPOINTS
// ============================================

// Get worker's own profile
router.get('/worker/profile', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Find the VA profile linked to this user
    const profile = await db.select().from(vaProfiles).where(eq(vaProfiles.userId, user.id)).limit(1);
    
    if (profile.length === 0) {
      return res.status(404).json({ error: 'Worker profile not found' });
    }

    res.json(profile[0]);
  } catch (error) {
    console.error('Error fetching worker profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get worker's assigned tasks
router.get('/worker/tasks', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Find the VA profile linked to this user
    const profile = await db.select().from(vaProfiles).where(eq(vaProfiles.userId, user.id)).limit(1);
    
    if (profile.length === 0) {
      // User is not a worker, return empty tasks
      return res.json({ tasks: [] });
    }
    
    const vaId = profile[0].id;
    
    // Get all assignments for this worker
    const assignments = await db.select().from(taskAssignments).where(eq(taskAssignments.vaId, vaId));
    
    // For now, return mock task data based on assignments
    // In production, this would fetch from Trello or cached tasks
    const tasks = assignments.map((a: typeof assignments[0]) => ({
      id: a.taskId,
      title: `Task ${a.taskId.split(':').pop()}`,
      cardName: 'Project Card',
      durationHours: 1,
      startTime: '09:00',
      endTime: '10:00',
      isCompleted: a.status === 'completed',
      priorityLevel: 'NORMAL',
      date: new Date().toISOString().split('T')[0],
      status: a.status,
    }));

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching worker tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Mark task as complete/incomplete
router.post('/worker/tasks/:taskId/complete', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;
    const { completed } = req.body;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Find the VA profile linked to this user
    const profile = await db.select().from(vaProfiles).where(eq(vaProfiles.userId, user.id)).limit(1);
    
    if (profile.length === 0) {
      return res.status(403).json({ error: 'Not a worker' });
    }
    
    const vaId = profile[0].id;
    
    // Update the assignment status
    await db.update(taskAssignments)
      .set({ status: completed ? 'completed' : 'in_progress' })
      .where(and(eq(taskAssignments.taskId, decodeURIComponent(taskId)), eq(taskAssignments.vaId, vaId)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Submit task for review
router.post('/worker/tasks/:taskId/review', async (req: any, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { taskId } = req.params;

    const db = await getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Find the VA profile linked to this user
    const profile = await db.select().from(vaProfiles).where(eq(vaProfiles.userId, user.id)).limit(1);
    
    if (profile.length === 0) {
      return res.status(403).json({ error: 'Not a worker' });
    }
    
    const vaId = profile[0].id;
    
    // Update the assignment status to ready_for_review
    await db.update(taskAssignments)
      .set({ status: 'ready_for_review' })
      .where(and(eq(taskAssignments.taskId, decodeURIComponent(taskId)), eq(taskAssignments.vaId, vaId)));
    
    // Also add to review queue
    const assignment = await db.select().from(taskAssignments)
      .where(and(eq(taskAssignments.taskId, decodeURIComponent(taskId)), eq(taskAssignments.vaId, vaId)))
      .limit(1);
    
    if (assignment.length > 0) {
      await db.insert(reviewQueue).values({
        taskId: decodeURIComponent(taskId),
        vaId,
        founderId: assignment[0].founderId,
        status: 'pending_review',
        revisionCount: 0,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting for review:', error);
    res.status(500).json({ error: 'Failed to submit for review' });
  }
});

export default router;
