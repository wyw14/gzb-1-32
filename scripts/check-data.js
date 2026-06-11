const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

let errors = [];
let warnings = [];

function logError(msg) {
  errors.push(msg);
  console.error(`  ❌ ${msg}`);
}

function logWarning(msg) {
  warnings.push(msg);
  console.warn(`  ⚠️  ${msg}`);
}

function logSuccess(msg) {
  console.log(`  ✅ ${msg}`);
}

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function checkJSONFormat(filename) {
  const filePath = path.join(DATA_DIR, filename);
  console.log(`\n检查 ${filename}...`);

  if (!fs.existsSync(filePath)) {
    logError(`${filename} 文件不存在`);
    return null;
  }

  const data = readJSON(filePath);
  if (data === null) {
    logError(`${filename} JSON 格式错误`);
    return null;
  }

  if (!Array.isArray(data)) {
    logError(`${filename} 数据格式错误，应为数组`);
    return null;
  }

  logSuccess(`${filename} 格式正确（共 ${data.length} 条记录）`);
  return data;
}

function checkPlantData(plants) {
  console.log('\n检查植物数据完整性...');

  const requiredFields = ['id', 'name', 'species', 'difficulty', 'wateringCycle', 'fertilizingCycle'];
  const validDifficulties = ['easy', 'medium', 'hard'];
  const validStatuses = ['healthy', 'sick', 'dead'];

  const ids = new Set();

  plants.forEach((plant, index) => {
    requiredFields.forEach(field => {
      if (plant[field] === undefined || plant[field] === null || plant[field] === '') {
        logError(`植物[${index}] 缺少必填字段: ${field}`);
      }
    });

    if (plant.id && ids.has(plant.id)) {
      logError(`植物[${index}] 存在重复 ID: ${plant.id}`);
    }
    if (plant.id) ids.add(plant.id);

    if (plant.difficulty && !validDifficulties.includes(plant.difficulty)) {
      logWarning(`植物[${index}] 难度值异常: ${plant.difficulty}`);
    }

    if (plant.status && !validStatuses.includes(plant.status)) {
      logWarning(`植物[${index}] 状态值异常: ${plant.status}`);
    }

    if (plant.wateringCycle !== undefined && (typeof plant.wateringCycle !== 'number' || plant.wateringCycle <= 0)) {
      logWarning(`植物[${index}] 浇水周期异常: ${plant.wateringCycle}`);
    }

    if (plant.fertilizingCycle !== undefined && (typeof plant.fertilizingCycle !== 'number' || plant.fertilizingCycle <= 0)) {
      logWarning(`植物[${index}] 施肥周期异常: ${plant.fertilizingCycle}`);
    }
  });

  logSuccess(`植物数据检查完成（${plants.length} 条）`);
  return ids;
}

function checkCareRecords(records, plantIds) {
  console.log('\n检查养护记录...');

  const validTypes = ['watering', 'fertilizing'];

  records.forEach((record, index) => {
    if (!record.id) {
      logError(`养护记录[${index}] 缺少 ID`);
    }
    if (!record.plantId) {
      logError(`养护记录[${index}] 缺少 plantId`);
    } else if (!plantIds.has(record.plantId)) {
      logWarning(`养护记录[${index}] 引用的植物不存在: ${record.plantId}`);
    }
    if (!record.type) {
      logError(`养护记录[${index}] 缺少类型`);
    } else if (!validTypes.includes(record.type)) {
      logWarning(`养护记录[${index}] 类型异常: ${record.type}`);
    }
    if (!record.date) {
      logWarning(`养护记录[${index}] 缺少日期`);
    }
  });

  logSuccess(`养护记录检查完成（${records.length} 条）`);
}

function checkPhotos(photos, plantIds) {
  console.log('\n检查照片数据...');

  const uploadDir = path.join(PUBLIC_DIR, 'uploads');

  photos.forEach((photo, index) => {
    if (!photo.id) {
      logError(`照片[${index}] 缺少 ID`);
    }
    if (!photo.plantId) {
      logError(`照片[${index}] 缺少 plantId`);
    } else if (!plantIds.has(photo.plantId)) {
      logWarning(`照片[${index}] 引用的植物不存在: ${photo.plantId}`);
    }
    if (!photo.filename) {
      logWarning(`照片[${index}] 缺少文件名`);
    } else {
      const filePath = path.join(uploadDir, photo.filename);
      if (!fs.existsSync(filePath)) {
        logWarning(`照片[${index}] 文件不存在: ${photo.filename}`);
      }
    }
  });

  logSuccess(`照片数据检查完成（${photos.length} 条）`);
}

function checkUploadsDir(photos) {
  console.log('\n检查上传目录...');

  const uploadDir = path.join(PUBLIC_DIR, 'uploads');
  const photoFilenames = new Set(photos.map(p => p.filename).filter(Boolean));

  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir).filter(f => !f.startsWith('.'));
    const orphanFiles = files.filter(f => !photoFilenames.has(f));
    if (orphanFiles.length > 0) {
      logWarning(`上传目录存在 ${orphanFiles.length} 个未引用的文件`);
    } else {
      logSuccess('上传目录文件与数据一致');
    }
  } else {
    logWarning('上传目录不存在');
  }
}

function main() {
  console.log('========================================');
  console.log('  🔍 发布前数据检查');
  console.log('========================================');

  const plants = checkJSONFormat('plants.json');
  const careRecords = checkJSONFormat('care-records.json');
  const photos = checkJSONFormat('photos.json');

  if (plants === null || careRecords === null || photos === null) {
    console.log('\n❌ 数据格式检查失败，终止发布');
    process.exit(1);
  }

  const plantIds = checkPlantData(plants);
  checkCareRecords(careRecords, plantIds);
  checkPhotos(photos, plantIds);
  checkUploadsDir(photos);

  console.log('\n========================================');
  console.log('  📊 检查结果汇总');
  console.log('========================================');
  console.log(`  错误: ${errors.length}`);
  console.log(`  警告: ${warnings.length}`);

  if (errors.length > 0) {
    console.log('\n❌ 数据检查未通过，存在错误，请修复后再发布');
    process.exit(1);
  } else {
    console.log('\n✅ 数据检查通过');
    if (warnings.length > 0) {
      console.log(`   （有 ${warnings.length} 个警告，建议检查但不阻止发布）`);
    }
    process.exit(0);
  }
}

main();
