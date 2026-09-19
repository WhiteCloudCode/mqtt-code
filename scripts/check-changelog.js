const readline = require('node:readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Have you updated the CHANGELOG? (y/N) ', (answer) => {
  const ans = answer.trim().toLowerCase();
  if (ans === 'y' || ans === 'yes') {
    console.log('Proceeding with release...');
    process.exit(0);
  } else {
    console.error('Release aborted: Please update the CHANGELOG.md first.');
    process.exit(1);
  }
});

