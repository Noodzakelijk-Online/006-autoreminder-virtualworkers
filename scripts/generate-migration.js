import { spawn } from 'child_process';

const child = spawn('npx', ['drizzle-kit', 'generate'], {
  shell: true,
  stdio: ['pipe', 'pipe', 'inherit']
});

child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data);

  if (output.includes('created or renamed from another column?')) {
    console.log('\n[AutoMigration] Sending enter to accept default (create column)...');
    child.stdin.write('\n');
  }
});

child.on('close', (code) => {
  console.log(`\ndrizzle-kit generate exited with code ${code}`);
  if (code === 0) {
    console.log('Running drizzle-kit migrate...');
    const migrateChild = spawn('npx', ['drizzle-kit', 'migrate'], {
      shell: true,
      stdio: 'inherit'
    });
    migrateChild.on('close', (mCode) => {
      console.log(`drizzle-kit migrate exited with code ${mCode}`);
      process.exit(mCode);
    });
  } else {
    process.exit(code);
  }
});
