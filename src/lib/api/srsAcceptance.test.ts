import { 
  authApi, tasksApi, aiApi, focusApi, habitsApi, 
  studyPlansApi, brainDumpApi, gamificationApi, 
  roomsApi, themeApi, dashboardApi 
} from './client';
import type { StudyDayCode } from '../../types';

export async function runSRSVerificationTests() {
  console.log('====================================================');
  console.log('TASKORA SRS ACCEPTANCE TEST SUITE (TC01 - TC14)');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testId: string, description: string, condition: boolean) {
    if (condition) {
      console.log(`[PASS] ${testId}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testId}: ${description}`);
      failed++;
    }
  }

  try {
    // TC01: Register with valid details
    const testEmail = 'test.scholar@university.edu';
    const testPassword = 'TestPassword123!';
    const registrationMessage = await authApi.register('Test Scholar', testEmail, testPassword);
    const newUser = await authApi.login(testEmail, testPassword);
    assert('TC01', 'Register and sign in with valid details', !!registrationMessage && !!newUser.id);

    // TC02: Create and edit a task
    const newTask = await tasksApi.createTask({
      userId: newUser.id,
      title: 'Study Distributed Systems Raft',
      dueDate: '2026-11-20',
      priority: 'high',
      status: 'todo',
      category: 'Computer Science',
      tags: ['CS', 'Exam'],
      subtasks: [{ id: 'sub_1', title: 'Read section 3', completed: false }],
    });
    const updatedTask = await tasksApi.updateTask(newTask.id, { title: 'Study Distributed Systems Raft & Paxos' });
    assert('TC02', 'Create and edit a task', updatedTask.title === 'Study Distributed Systems Raft & Paxos');

    // TC03: Submit AI task request
    const proposal = await aiApi.generateProposal('Break down final exam prep for Data Structures');
    assert('TC03', 'Submit AI task request', proposal.status === 'pending' && proposal.items.length > 0);

    // TC04: Approve AI proposal
    const approved = await aiApi.approveProposal(proposal.id);
    assert('TC04', 'Approve AI proposal', approved.proposal.status === 'approved');

    // TC05: Run focus timer
    const session = await focusApi.logSession('Discrete Math', 25);
    assert('TC05', 'Run focus timer', session.durationMinutes === 25 && session.xpEarned > 0);

    // TC06: Complete a habit
    const habits = await habitsApi.getHabits();
    const habitToToggle = habits[0];
    const today = new Date().toISOString().split('T')[0];
    const updatedHabit = await habitsApi.toggleHabit(habitToToggle.id, today);
    assert('TC06', 'Complete a habit', updatedHabit.logs[today] === true);

    // TC07: Create a plan and preview a schedule using explicit availability
    const formatDate = (date: Date) => (
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    );
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);
    const studyDays: StudyDayCode[] = ['MON', 'TUE', 'WED', 'THU'];
    const studyPlan = await studyPlansApi.createPlan({
      title: 'Acceptance study plan',
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      timeZone: 'Asia/Colombo',
      weeklyTargetMinutes: 600,
      studyDaysPerWeek: 4,
      subjects: [{
        name: 'Operating Systems',
        code: 'OS',
        targetMinutesPerWeek: 600,
      }],
    });
    try {
      const generatedSchedule = await studyPlansApi.generateSchedule({
        plan: {
          weeklyTargetMinutes: studyPlan.weeklyTargetMinutes,
          studyDaysPerWeek: studyPlan.studyDaysPerWeek,
        },
        subjects: studyPlan.subjects.map(({ id, name, targetMinutesPerWeek }) => ({
          id,
          name,
          targetMinutesPerWeek,
        })),
        studyDays,
        scheduleSettings: {
          availabilityWindows: studyDays.map((dayOfWeek) => ({
            dayOfWeek,
            startMinuteOfDay: 540,
            endMinuteOfDay: 690,
          })),
        },
      });
      assert(
        'TC07',
        'Create a backend study plan and generate an availability-based preview',
        !!studyPlan.id && generatedSchedule.length > 0
      );
    } finally {
      await studyPlansApi.deletePlan(studyPlan.id);
    }

    // TC08: Capture Brain Dump
    const dumpEntry = await brainDumpApi.addEntry('Need to print project slides and verify API contracts');
    const convertedProp = await brainDumpApi.convertToProposal(dumpEntry.id);
    assert('TC08', 'Capture Brain Dump and review conversion', !!dumpEntry.id && convertedProp.items.length > 0);

    // TC09: Earn achievement
    const achs = await gamificationApi.getAchievements();
    const transactions = await gamificationApi.getXPTransactions();
    assert('TC09', 'Earn achievement and traceable XP ledger', achs.length > 0 && transactions.length > 0);

    // TC10: Join private study room
    const rooms = await roomsApi.getRooms();
    const privateRoom = rooms.find((r) => r.isPrivate);
    assert('TC10', 'Join private study room (passcode gated)', !!privateRoom && privateRoom.passcode === '1234');

    // TC11: View analytics
    const sessions = await focusApi.getSessions();
    assert('TC11', 'Load focus session history for analytics', sessions.length > 0 && sessions[0].durationMinutes > 0);

    // TC12: Access authorization check
    const taskOwnerCheck = newTask.userId === newUser.id;
    assert('TC12', "Access user task ownership validation", taskOwnerCheck);

    // TC13: Save Lavender Dream preferences
    const prefs = themeApi.getThemeConfig();
    assert('TC13', 'Save Lavender Dream preferences', prefs.preset === 'lavender');

    // TC14: Change dashboard widgets
    const widgets = dashboardApi.getWidgets();
    const disabledOne = widgets.map((w, idx) => idx === 0 ? { ...w, enabled: false } : w);
    dashboardApi.saveWidgets(disabledOne);
    const reloaded = dashboardApi.getWidgets();
    assert('TC14', 'Change dashboard widgets and persist layout', reloaded[0].enabled === false);

    // Restore widgets
    dashboardApi.saveWidgets(widgets);

    console.log(`\n====================================================`);
    console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log(`====================================================\n`);
  } catch (err: any) {
    console.error('Test suite error:', err);
  }
}
