const fs = require('fs');
const path = 'frontend/src/app/(authenticated)/dashboard/responsable/page.tsx';
let t = fs.readFileSync(path,'utf8');
// Rename second occurrence of function ChargeBar to ChargeBar2 by replacing the second 'function ChargeBar('
let occur = 0;
t = t.replace(/function\s+ChargeBar\s*\(/g,(m)=>{
  occur++;
  if(occur===2) return 'function ChargeBar2(';
  return m;
});
fs.writeFileSync(path,t,'utf8');
console.log('done, occurrences:',occur);

