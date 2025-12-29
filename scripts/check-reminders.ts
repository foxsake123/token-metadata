/**
 * Check for due reminders
 * Run daily or on startup
 */

import * as fs from 'fs';
import * as path from 'path';

const REMINDERS_FILE = path.join(__dirname, '..', 'data', 'reminders.json');

interface Reminder {
  id: string;
  title: string;
  dueDate: string;
  description: string;
  action?: string;
  completed: boolean;
}

function checkReminders() {
  const data = JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf-8'));
  const today = new Date().toISOString().split('T')[0];

  console.log('\n📅 REMINDER CHECK');
  console.log('═'.repeat(50));
  console.log(`Today: ${today}\n`);

  const due = data.reminders.filter((r: Reminder) =>
    !r.completed && r.dueDate <= today
  );

  if (due.length === 0) {
    console.log('✅ No reminders due today\n');

    // Show upcoming
    const upcoming = data.reminders
      .filter((r: Reminder) => !r.completed)
      .sort((a: Reminder, b: Reminder) => a.dueDate.localeCompare(b.dueDate));

    if (upcoming.length > 0) {
      console.log('📆 Upcoming:');
      upcoming.forEach((r: Reminder) => {
        console.log(`   ${r.dueDate}: ${r.title}`);
      });
    }
    return;
  }

  console.log('🔔 DUE REMINDERS:\n');

  for (const reminder of due) {
    console.log(`⚠️  ${reminder.title}`);
    console.log(`   Due: ${reminder.dueDate}`);
    console.log(`   ${reminder.description}`);
    if (reminder.action) {
      console.log(`   Action: ${reminder.action}`);
    }
    console.log('');
  }
}

checkReminders();
