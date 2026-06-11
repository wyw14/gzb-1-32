const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPTS_DIR = __dirname;

function runScript(scriptName, description) {
  console.log('\n' + '='.repeat(50));
  console.log(`  步骤: ${description}`);
  console.log('='.repeat(50) + '\n');

  const result = spawnSync('node', [path.join(SCRIPTS_DIR, scriptName)], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  return result.status === 0;
}

function printBanner() {
  console.log('\n' + '='.repeat(50));
  console.log('  🌱 家庭绿植养护管家 - 发布检查');
  console.log('='.repeat(50));
  console.log(`  发布时间: ${new Date().toLocaleString('zh-CN')}`);
}

function printSummary(results) {
  console.log('\n' + '='.repeat(50));
  console.log('  📋 发布检查汇总');
  console.log('='.repeat(50) + '\n');

  const allPassed = results.every(r => r.passed);
  const maxLen = Math.max(...results.map(r => r.name.length));

  results.forEach(r => {
    const status = r.passed ? '✅ 通过' : '❌ 失败';
    const name = r.name.padEnd(maxLen);
    console.log(`  ${name}  ${status}`);
  });

  console.log('');

  if (allPassed) {
    console.log('🎉 所有检查都通过了！可以安全发布。');
    console.log('\n启动方式: npm start');
  } else {
    console.log('❌ 部分检查未通过，请修复后再发布。');
  }

  console.log('');
}

function main() {
  printBanner();

  const steps = [
    { script: 'check-data.js', name: '数据完整性检查', description: '检查数据格式和引用一致性' },
    { script: 'verify-service.js', name: '服务启动验证', description: '启动服务并验证 API 接口' }
  ];

  const results = [];

  for (const step of steps) {
    const passed = runScript(step.script, step.description);
    results.push({ name: step.name, passed });

    if (!passed) {
      console.log(`\n⚠️  ${step.name} 未通过，后续步骤将继续执行以便一次性发现所有问题`);
    }
  }

  printSummary(results);

  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main();
