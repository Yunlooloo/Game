"use strict";
const path = require("node:path"), fs = require("node:fs");
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");
const REPORTS = path.join(ROOT, "test-results");
fs.mkdirSync(REPORTS, {recursive: true});
module.exports = {ROOT, SRC, REPORTS};
