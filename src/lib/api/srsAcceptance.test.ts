import { describe, it, expect, beforeAll } from 'vitest';
import { authApi, tasksApi, studyPlansApi } from './client';
import type { StudyDayCode } from '../../types';

const BACKEND_UP = process.env.BACKEND_UP === 'true';
const TEST_EMAIL = `test.${Date.now()}@taskora-test.local`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Phase6 Test User';
describe.skipIf(!BACKEND_UP)('SRS Acceptance — Phase 06 Study Planner', () => {

  beforeAll(async () => {
    await authApi.register(TEST_NAME, TEST_EMAIL, TEST_PASSWORD);
    const user = await authApi.login(TEST_EMAIL, TEST_PASSWORD);
    expect(user.id).toBeTruthy();
    expect(user.email).toBe(TEST_EMAIL);
  });

  it('TC01: register and sign in with valid details', async () => {
    const current = await authApi.getCurrentUser();
    expect(current?.email).toBe(TEST_EMAIL);
  });

  it('TC02: create and edit a task', async () => {
    const task = await tasksApi.createTask({
      userId: 'ignored-backend-derives-from-jwt',
      title: 'Study Distributed Systems Raft',
      dueDate: '2026-11-20',
      priority: 'high',
      status: 'todo',
      category: 'Computer Science',
      tags: ['CS', 'Exam'],
      subtasks: [{ id: 'sub_1', title: 'Read section 3', completed: false }],
    });
    const updated = await tasksApi.updateTask(task.id, {
      title: 'Study Distributed Systems Raft & Paxos',
    });
    expect(updated.title).toBe('Study Distributed Systems Raft & Paxos');
    await tasksApi.deleteTask(task.id);
  });

  it('TC07: create plan and generate availability-based schedule', async () => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    const studyDays: StudyDayCode[] = ['MON', 'TUE', 'WED', 'THU'];
    const plan = await studyPlansApi.createPlan({
      title: 'Acceptance study plan',
      startDate: formatDate(start),
      endDate: formatDate(end),
      timeZone: 'Asia/Colombo',
      weeklyTargetMinutes: 600,
      studyDaysPerWeek: 4,
      subjects: [{ name: 'Operating Systems', code: 'OS', targetMinutesPerWeek: 600 }],
    });
    try {
      expect(plan.id).toBeTruthy();
      expect(plan.timeZone).toBe('Asia/Colombo');
      const schedule = await studyPlansApi.generateSchedule({
        plan: { weeklyTargetMinutes: plan.weeklyTargetMinutes, studyDaysPerWeek: plan.studyDaysPerWeek },
        subjects: plan.subjects.map(({ id, name, targetMinutesPerWeek }) => ({ id, name, targetMinutesPerWeek })),
        studyDays,
        scheduleSettings: {
          availabilityWindows: studyDays.map((dayOfWeek) => ({ dayOfWeek, startMinuteOfDay: 540, endMinuteOfDay: 690 })),
        },
      });
      expect(schedule.length).toBeGreaterThan(0);
      schedule.forEach((item) => {
        expect(studyDays).toContain(item.dayOfWeek);
        expect(item.startMinuteOfDay).toBeGreaterThanOrEqual(540);
        expect(item.startMinuteOfDay + item.durationMinutes).toBeLessThanOrEqual(690);
      });
    } finally {
      await studyPlansApi.deletePlan(plan.id);
    }
  });

  it('TC07b: reject schedule generation without availability windows', async () => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 14);
    const studyDays: StudyDayCode[] = ['MON', 'TUE', 'WED', 'THU'];
    const plan = await studyPlansApi.createPlan({
      title: 'Reject-case plan',
      startDate: formatDate(start),
      endDate: formatDate(end),
      timeZone: 'Asia/Colombo',
      weeklyTargetMinutes: 600,
      studyDaysPerWeek: 4,
      subjects: [{ name: 'Test', code: 'T', targetMinutesPerWeek: 600 }],
    });
    try {
      await expect(
        studyPlansApi.generateSchedule({
          plan: { weeklyTargetMinutes: plan.weeklyTargetMinutes, studyDaysPerWeek: plan.studyDaysPerWeek },
          subjects: plan.subjects.map(({ id, name, targetMinutesPerWeek }) => ({ id, name, targetMinutesPerWeek })),
          studyDays,
          scheduleSettings: { availabilityWindows: [] },
        })
      ).rejects.toThrow();
    } finally {
      await studyPlansApi.deletePlan(plan.id);
    }
  });
});
