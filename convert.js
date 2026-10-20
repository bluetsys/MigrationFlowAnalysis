const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const inputPath = path.resolve(
  process.argv[2] || "101_DT_1B26009_20261020142711.csv",
);
const outputPath = path.resolve(process.argv[3] || "data.js");

function decodeCsv(buffer) {
  // The KOSIS download is commonly EUC-KR; support UTF-8 files as well.
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("euc-kr").decode(buffer);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function convert() {
  const csvText = decodeCsv(fs.readFileSync(inputPath));
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new Error("CSV에 변환할 데이터가 없습니다.");

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, ""));
  const findColumn = (name) => headers.findIndex((header) => header.includes(name));
  const originIndex = findColumn("전출지");
  const destinationIndex = findColumn("전입지");
  const sexIndex = findColumn("성별");
  const ageIndex = findColumn("연령별");
  const itemIndex = findColumn("항목");
  const valueIndex = headers.findIndex((header) => /\d{4}\.\d{2}/.test(header));

  const columns = [originIndex, destinationIndex, sexIndex, ageIndex, itemIndex, valueIndex];
  if (columns.some((index) => index < 0)) {
    throw new Error(`필요한 열을 찾지 못했습니다: ${headers.join(", ")}`);
  }

  const records = [];
  const regions = new Set();
  const ages = new Set();
  const itemLabel = "1인 이동자수";

  for (const row of rows.slice(1)) {
    if (row[itemIndex] !== itemLabel) continue;
    const origin = row[originIndex];
    const destination = row[destinationIndex];
    const sex = row[sexIndex];
    const age = row[ageIndex];
    const value = Number(row[valueIndex].replaceAll(",", ""));

    if (!origin || !destination || !sex || !age || !Number.isFinite(value)) continue;
    records.push([origin, destination, sex, age, value]);
    regions.add(origin);
    regions.add(destination);
    ages.add(age);
  }

  if (records.length === 0) {
    throw new Error(`'${itemLabel}' 항목 데이터를 찾지 못했습니다.`);
  }

  const output = [
    `const RAW = ${JSON.stringify(records, null, 2)};`,
    `const REG = ${JSON.stringify([...regions], null, 2)};`,
    `const AGES = ${JSON.stringify([...ages].sort(), null, 2)};`,
    "",
  ].join("\n\n");

  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`${records.length.toLocaleString("ko-KR")}개 행을 ${outputPath}에 저장했습니다.`);
}

try {
  convert();
} catch (error) {
  console.error(`변환 실패: ${error.message}`);
  process.exitCode = 1;
}


