const Module = require('module');
const path = require('path');

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  if (request.startsWith('@/')) {
    const relativePath = request.slice(2);
    // Map to dist/src/
    const absolutePath = path.resolve(__dirname, '../dist/src', relativePath);
    return originalResolveFilename(absolutePath, parent, isMain);
  }
  return originalResolveFilename(request, parent, isMain);
};
