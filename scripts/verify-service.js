const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3099;
const SERVER_PATH = path.join(__dirname, '..', 'server.js');

let serverProcess = null;

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('启动服务中...');

    const env = { ...process.env, PORT };
    serverProcess = spawn('node', [SERVER_PATH], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let started = false;
    let output = '';

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(`  [server] ${text}`);
      if (text.includes('已启动') && !started) {
        started = true;
        setTimeout(resolve, 500);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(`  [server:err] ${text}`);
    });

    serverProcess.on('error', (err) => {
      reject(new Error(`启动服务失败: ${err.message}`));
    });

    serverProcess.on('exit', (code) => {
      if (!started) {
        reject(new Error(`服务意外退出，退出码: ${code}\n输出:\n${output}`));
      }
    });

    setTimeout(() => {
      if (!started) {
        reject(new Error('服务启动超时'));
      }
    }, 10000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (serverProcess && !serverProcess.killed) {
      console.log('\n正在停止服务...');
      serverProcess.on('exit', () => resolve());
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 3000);
    } else {
      resolve();
    }
  });
}

function request(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: urlPath,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.end();
  });
}

async function verifyAPI(name, urlPath, checkFn) {
  process.stdout.write(`  验证 ${name}...`);
  try {
    const res = await request(urlPath);
    if (res.statusCode !== 200) {
      console.log(` ❌ HTTP ${res.statusCode}`);
      return false;
    }
    if (checkFn) {
      let data;
      try {
        data = JSON.parse(res.data);
      } catch {
        data = res.data;
      }
      const result = checkFn(data);
      if (result === true) {
        console.log(' ✅');
        return true;
      } else {
        console.log(` ❌ ${result || '验证失败'}`);
        return false;
      }
    }
    console.log(' ✅');
    return true;
  } catch (err) {
    console.log(` ❌ ${err.message}`);
    return false;
  }
}

async function verifyService() {
  console.log('\n开始验证 API 接口...');

  const results = [];

  results.push(await verifyAPI('首页', '/', (data) => {
    return typeof data === 'string' && data.includes('<!DOCTYPE') ? true : '返回内容不是 HTML';
  }));

  results.push(await verifyAPI('植物列表', '/api/plants', (data) => {
    return Array.isArray(data) ? true : '返回不是数组';
  }));

  results.push(await verifyAPI('病虫害列表', '/api/pests', (data) => {
    return Array.isArray(data) && data.length > 0 ? true : '病虫害数据异常';
  }));

  results.push(await verifyAPI('统计数据', '/api/statistics', (data) => {
    return data && typeof data.totalPlants === 'number' ? true : '统计数据格式错误';
  }));

  results.push(await verifyAPI('养护提醒', '/api/notifications', (data) => {
    return Array.isArray(data) ? true : '提醒数据格式错误';
  }));

  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log(`\nAPI 验证结果: ${passed}/${total} 通过`);

  return passed === total;
}

async function main() {
  console.log('========================================');
  console.log('  🚀 服务启动验证');
  console.log('========================================');
  console.log(`  测试端口: ${PORT}`);

  try {
    await startServer();
    console.log('✅ 服务启动成功');

    const allPassed = await verifyService();

    await stopServer();
    console.log('✅ 服务已停止');

    if (allPassed) {
      console.log('\n🎉 服务验证全部通过');
      process.exit(0);
    } else {
      console.log('\n❌ 服务验证未完全通过');
      process.exit(1);
    }
  } catch (err) {
    console.error(`\n❌ 验证失败: ${err.message}`);
    await stopServer();
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\n收到中断信号，正在清理...');
  await stopServer();
  process.exit(1);
});

main();
