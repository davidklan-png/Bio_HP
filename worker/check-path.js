const path = require('path');
const analysisPath = require.resolve('./src/analysis.ts');
console.log('Analysis path resolved to:', analysisPath);
console.log('Exists:', require('fs').existsSync(analysisPath));
console.log('Is in worker/src:', analysisPath.includes('worker/src'));
