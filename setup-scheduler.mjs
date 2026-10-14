/**
 * Setup Windows Task Scheduler for automatic trading scans
 * Run once: node setup-scheduler.js
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🕐 Setting up Trading Scan Schedule...\n');

// Create tasks for market hours
const tasks = [
  {
    name: 'Zerodha Morning Scan',
    time: '09:00',
    desc: 'Before market opens (9:15 AM)'
  },
  {
    name: 'Zerodha Noon Scan',
    time: '12:30',
    desc: 'Mid-session check'
  },
  {
    name: 'Zerodha Evening Scan',
    time: '15:00',
    desc: 'Before market close (3:30 PM)'
  }
];

const cmdBase = `tsx src/index.ts --auto`;
const scriptPath = join(__dirname, 'src', 'index.ts');

for (const task of tasks) {
  try {
    // Use start /min to run minimized
    const command = `schtasks /create /tn "${task.name}" /tr "node \"${scriptPath}\" --auto" /sc daily /st ${task.time} /f`;

    console.log(`📋 ${task.name} (${task.time}) - ${task.desc}`);
    execSync(command, { stdio: 'inherit' });
    console.log(`   ✅ Created\n`);
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}\n`);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n✅ All tasks created!\n');
console.log('📌 NEXT STEPS:');
console.log('1. Open Task Scheduler (taskschd.msc)');
console.log('2. Find tasks starting with "Zerodha"');
console.log('3. Right-click each → Properties → Conditions tab');
console.log('4. ✅ Check "Wake the computer to run this task"');
console.log('5. ✅ Check "Start only if on AC power"');
console.log('6. Click OK\n');
console.log('📌 VIEW TASKS:');
console.log('   schtasks /query /tn "Zerodha*" /v\n');
console.log('📌 DELETE A TASK:');
console.log('   schtasks /delete /tn "Zerodha Morning Scan" /f\n');
