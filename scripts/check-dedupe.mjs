/**
 * 같은 가게가 여러 번 나오는 것을 걸러내는 로직 점검 (로컬 전용).
 *
 * 실물에서 같은 가게가 3개까지 보였다. 이름|주소 완전일치로는 주소 표기가
 * 도로명/지번으로 갈린 같은 집을 못 잡는다. 반대로 이름만 보면 진짜 다른 지점을
 * 지워 버린다 — 그 둘을 다 지키는지 본다.
 *
 *   node scripts/check-dedupe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const OUT="/tmp/dd"; fs.rmSync(OUT,{recursive:true,force:true});
spawnSync("npx",["tsc","src/lib/dedupePlaces.ts","--outDir",OUT,"--module","es2022","--target","es2022","--skipLibCheck"],{encoding:"utf8"});
const { dedupePlaces, normalizeStoreName } = await import(pathToFileURL(path.join(OUT,"dedupePlaces.js")).href);
const problems=[];
const ok=(c,l)=>{if(!c)problems.push(l)};
// 같은 집, 주소 표기만 다름 (도로명 vs 지번) + 좌표 거의 같음
const a=[
 {title:"역전우동", address:"서울 강남구 테헤란로 1", mapx:"127.0301", mapy:"37.4972"},
 {title:"역전우동", address:"서울 강남구 역삼동 123", mapx:"127.03011", mapy:"37.49721"},
 {title:"역전우동 본점", address:"서울 강남구 테헤란로 1", mapx:"127.0301", mapy:"37.4972"},
];
ok(dedupePlaces(a).length===1, `같은 집 3건이 하나로 안 합쳐짐(${dedupePlaces(a).length})`);
// 이름 같지만 실제 다른 지점(멀다) → 둘 다 남아야 한다
const b=[
 {title:"스타벅스 강남점", address:"강남", mapx:"127.0276", mapy:"37.4979"},
 {title:"스타벅스 강남점", address:"역삼", mapx:"127.0400", mapy:"37.5050"},
];
ok(dedupePlaces(b).length===2, "멀리 떨어진 동명 가게가 지워졌다");
// 한 건물의 다른 가게 → 둘 다 남아야 한다
const c=[
 {title:"김밥천국", address:"A빌딩 1층", mapx:"127.0276", mapy:"37.4979"},
 {title:"역전우동", address:"A빌딩 2층", mapx:"127.0276", mapy:"37.4979"},
];
ok(dedupePlaces(c).length===2, "같은 건물의 다른 가게가 합쳐졌다");
// 좌표 없음 + 주소 같음 → 하나
const d=[
 {title:"할머니국수", address:"서울 강남구 봉은사로 1"},
 {title:"할머니 국수", address:"서울 강남구 봉은사로 1"},
];
ok(dedupePlaces(d).length===1, "좌표 없을 때 주소로 합치지 못했다");
ok(normalizeStoreName("<b>버거킹</b> 강남중앙")==="버거킹강남중앙", "이름 다듬기 실패: "+normalizeStoreName("<b>버거킹</b> 강남중앙"));
console.log(problems.length? "❌\n"+problems.join("\n") : "✅ 중복 제거 확인 통과");
fs.rmSync(OUT,{recursive:true,force:true});
process.exit(problems.length?1:0);
