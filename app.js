const fmt = (x) => (x || 0).toLocaleString("ko-KR");
const $ = (x) => document.getElementById(x);
const f = $("from"),
  t = $("to"),
  s = $("sex"),
  a = $("age");
function options(el, arr, label) {
  el.innerHTML =
    '<option value="">' +
    label +
    "</option>" +
    arr.map((x) => "<option>" + x + "</option>").join("");
}
options(f, REG, "전체 전출지");
options(t, REG, "전체 전입지");
options(a, AGES, "전체 연령");
[f, t, s, a].forEach((x) => x.addEventListener("change", render));
let current = [];
const pair = (x, y) => x + "||" + y;
function summarize() {
  const m = new Map();
  for (const [x, y, sex, age, n] of RAW) {
    if ((s.value && sex !== s.value) || (a.value && age !== a.value)) continue;
    const k = pair(x, y);
    m.set(k, (m.get(k) || 0) + n);
  }
  return m;
}
function filtered(mp) {
  return [...mp.entries()]
    .map(([k, n]) => {
      const [x, y] = k.split("||");
      return { x, y, n };
    })
    .filter(
      (r) =>
        (!f.value || f.value === r.x) &&
        (!t.value || t.value === r.y) &&
        r.n > 0,
    )
    .sort((a, b) => b.n - a.n);
}
function updateKpi(rows) {
  const total = rows.reduce((p, r) => p + r.n, 0),
    inter = rows.filter((r) => r.x !== r.y),
    cross = inter.reduce((p, r) => p + r.n, 0),
    top = inter[0];
  $("total").textContent = fmt(total) + "명";
  $("cross").textContent = fmt(cross) + "명";
  $("share").textContent = total
    ? `선택 범위의 ${((cross / total) * 100).toFixed(1)}%`
    : "데이터 없음";
  $("top").textContent = top ? `${top.x} → ${top.y}` : "없음";
  $("topCount").textContent = top ? `${fmt(top.n)}명` : "";
  $("routes").textContent = fmt(rows.length);
  $("totalHint").textContent = "선택 조건 내 이동자 합계";
}
function insights(rows, mp) {
  const inter = rows.filter((z) => z.x !== z.y),
    top = inter[0];
  const strong = [...inter].sort((a, b) => b.n - a.n);
  let mx = null;
  for (const z of strong) {
    const other = mp.get(pair(z.y, z.x)) || 0;
    const diff = z.n - other;
    if (!mx || diff > mx.diff) mx = { ...z, diff, other };
  }
  const ranks = REG.map((z) => {
    let i = 0,
      o = 0;
    for (const [k, n] of mp) {
      const [x, y] = k.split("||");
      if (x === y) continue;
      if (y === z) i += n;
      if (x === z) o += n;
    }
    return { name: z, net: i - o, i, o };
  }).sort((a, b) => b.net - a.net);
  let items = [
    [
      "최다 지역 간 이동 경로",
      top
        ? `${top.x}에서 ${top.y}(으)로 ${fmt(top.n)}명이 이동했습니다.`
        : "현재 조건에는 다른 시도 간 이동이 없습니다.",
    ],
    [
      "반대 방향과 비교",
      top
        ? `반대 방향(${top.y} → ${top.x})은 ${fmt(mp.get(pair(top.y, top.x)) || 0)}명입니다. 양방향 차이는 ${fmt(top.n - (mp.get(pair(top.y, top.x)) || 0))}명입니다.`
        : "선택 범위를 변경하면 방향별 규모를 확인할 수 있습니다.",
    ],
    [
      "지역 간 비대칭성",
      mx
        ? `${mx.x} → ${mx.y} 경로는 반대 방향보다 ${fmt(mx.diff)}명 더 많습니다.`
        : "유효 경로 없음",
    ],
  ];
  if (!f.value && !t.value)
    items.push([
      "전체 지역 기준 순유입",
      `${ranks[0].name}은 지역 간 순유입 ${fmt(ranks[0].net)}명이며, ${ranks.at(-1).name}은 ${fmt(ranks.at(-1).net)}명입니다.`,
    ]);
  $("insights").innerHTML = items
    .map(([q, v]) => `<div class="insight"><b>${q}</b>${v}</div>`)
    .join("");
  $("notice").textContent =
    `분석 기준: 2026년 8월 · ${s.value || "전체 성별"} · ${a.value || "전체 연령"} · ${f.value || "모든 전출지"} → ${t.value || "모든 전입지"}. 지역 내 이동은 지역 간 이동 통계에서는 제외했습니다. 현재 시도 선택 조건은 상세 경로에 적용되며, 아래 지역별 종합 순유입 표는 성별·연령 조건에 따른 전국 양방향 이동 기준입니다.`;
}
function bar(canvas, values) {
  const dpr = window.devicePixelRatio || 1,
    box = canvas.getBoundingClientRect(),
    w = box.width,
    h = box.height;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const c = canvas.getContext("2d");
  c.scale(dpr, dpr);
  c.clearRect(0, 0, w, h);
  const top = Math.max(...values.map((x) => x.n), 1);
  const labelWidth = Math.min(w * 0.44, 220),
    right = 70,
    step = (h - 14) / Math.max(values.length, 1);
  c.font = "11px Malgun Gothic, sans-serif";
  values.forEach((z, i) => {
    const y = i * step + 3,
      bh = Math.min(step * 0.62, 23);
    c.fillStyle = "#bcd0e6";
    c.textAlign = "right";
    let name = z.name;
    if (name.length > 25) name = name.slice(0, 22) + "…";
    c.fillText(name, labelWidth - 8, y + bh * 0.8);
    const bw = Math.max(0, ((w - labelWidth - right - 8) * z.n) / top);
    c.fillStyle = "#4ed4e7";
    c.fillRect(labelWidth, y, bw, bh);
    c.fillStyle = "#d6e9fa";
    c.textAlign = "left";
    c.fillText(fmt(z.n), labelWidth + bw + 5, y + bh * 0.8);
  });
}
function render() {
  const mp = summarize(),
    rows = filtered(mp);
  current = rows;
  updateKpi(rows);
  insights(rows, mp);
  const inter = rows.filter((r) => r.x !== r.y);
  bar(
    $("bar"),
    inter.slice(0, 12).map((z) => ({ name: z.x + " → " + z.y, n: z.n })),
  );
  const ori = new Map();
  rows.forEach((z) => ori.set(z.x, (ori.get(z.x) || 0) + z.n));
  bar(
    $("originBar"),
    [...ori]
      .map(([name, n]) => ({ name, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12),
  );
  $("routesTable").querySelector("tbody").innerHTML = rows
    .map((z) => {
      const back = mp.get(pair(z.y, z.x)) || 0,
        delta = z.n - back;
      return `<tr><td>${z.x}</td><td>${z.y}</td><td>${fmt(z.n)}</td><td>${fmt(back)}</td><td class="${delta > 0 ? "pos" : delta < 0 ? "neg" : ""}">${delta > 0 ? "+" : ""}${fmt(delta)}</td><td>${fmt(z.n + back)}</td></tr>`;
    })
    .join("");
  const allRows = [...mp].map(([k, n]) => {
    const [x, y] = k.split("||");
    return { x, y, n };
  });
  const relevant = allRows.filter(
    (z) => (!f.value || z.x === f.value) && (!t.value || z.y === t.value),
  );
  const peak = Math.max(1, ...relevant.map((z) => z.n));
  let mat =
    "<thead><tr><th>전출 ↓ / 전입 →</th>" +
    REG.map(
      (x) =>
        `<th title="${x}">${x.replace("특별자치", "").replace("광역", "").replace("특별", "")}</th>`,
    ).join("") +
    "</tr></thead><tbody>";
  for (const x of REG) {
    mat += "<tr><th>" + x + "</th>";
    for (const y of REG) {
      const n = mp.get(pair(x, y)) || 0,
        active = (!f.value || f.value === x) && (!t.value || t.value === y),
        alpha = active ? 0.12 + 0.72 * Math.sqrt(n / peak) : 0;
      mat += `<td title="${x} → ${y}: ${fmt(n)}명" style="background:rgba(78,212,231,${alpha.toFixed(3)});opacity:${active ? 1 : 0.24}">${n ? fmt(n) : "·"}</td>`;
    }
    mat += "</tr>";
  }
  $("matrix").innerHTML = mat + "</tbody>";
  const r = REG.map((x) => {
    let incoming = 0,
      outgoing = 0,
      inside = mp.get(pair(x, x)) || 0;
    for (const z of allRows) {
      if (z.x === z.y) continue;
      if (z.x === x) outgoing += z.n;
      if (z.y === x) incoming += z.n;
    }
    return { name: x, incoming, outgoing, net: incoming - outgoing, inside };
  }).sort((a, b) => b.net - a.net);
  $("regionTable").querySelector("tbody").innerHTML = r
    .map(
      (z) =>
        `<tr><td>${z.name}</td><td>${fmt(z.incoming)}</td><td>${fmt(z.outgoing)}</td><td class="${z.net > 0 ? "pos" : z.net < 0 ? "neg" : ""}">${z.net > 0 ? "+" : ""}${fmt(z.net)}</td><td>${fmt(z.inside)}</td></tr>`,
    )
    .join("");
}
window.addEventListener("resize", () => {
  clearTimeout(window.__resize);
  window.__resize = setTimeout(render, 90);
});
$("export").addEventListener("click", () => {
  const mp = summarize();
  const lines = [
    "전출지,전입지,이동자수,반대방향,방향차이,상호이동합계",
    ...current.map((z) => {
      const back = mp.get(pair(z.y, z.x)) || 0;
      return [z.x, z.y, z.n, back, z.n - back, z.n + back].join(",");
    }),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "시도간_1인이동경로_202608.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 300);
});
render();
