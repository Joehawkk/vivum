// ─────────────────────────────────────────────
//  VIVUM — Preset scenes  (vivum WASM)
// ─────────────────────────────────────────────
import { playNotify } from './sounds.js';
const S = {
  EMPTY:0,WALL:1,SAND:2,WATER:3,GAS:4,
  CLONER:5,FIRE:6,WOOD:7,LAVA:8,ICE:9,
  PLANT:11,ACID:12,STONE:13,DUST:14,MITE:15,
  OIL:16,ROCKET:17,FUNGUS:18,SEED:19,
};
const N   = 300;
const u   = () => window.u;
const dot = (x,y,r,sp) => u()&&u().paint(x|0,y|0,r,sp);

function fill(x1,y1,x2,y2,sp) {
  const uni=u(); if(!uni) return;
  x1=Math.max(0,x1|0); y1=Math.max(0,y1|0);
  x2=Math.min(N-1,x2|0); y2=Math.min(N-1,y2|0);
  for(let y=y1;y<=y2;y++)
    for(let x=x1;x<=x2;x++)
      uni.paint(x,y,1,sp);
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ══════════════════════════════════════════════
//  🌋  VOLCANO
//  A hollow mountain with a CLONER crater that
//  erupts lava forever. Lava fills the interior,
//  pours out at the base into a deep ocean.
//  Lava hitting water solidifies — the island
//  literally grows. Coral seeds on the seabed
//  bloom around the new stone shores.
// ══════════════════════════════════════════════
async function loadVolcano() {
  const cx=N>>1;
  const peakY=10, baseY=Math.floor(N*0.67);

  // Hollow mountain — thick outer shell, empty interior for lava
  for(let y=peakY;y<=baseY;y++){
    const t=(y-peakY)/(baseY-peakY);
    const hw=Math.floor(10+108*t);
    const sw=Math.max(8, Math.floor(hw*0.10));
    fill(cx-hw,      y, cx-hw+sw,    y, S.WALL);
    fill(cx+hw-sw,   y, cx+hw,       y, S.WALL);
  }

  // Top arch + crater opening (cx-7 to cx+7 = 14px gap)
  fill(cx-12, peakY-5, cx+12, peakY-1, S.WALL);
  fill(cx-12, peakY-5, cx-6,  peakY,   S.WALL);
  fill(cx+6,  peakY-5, cx+12, peakY,   S.WALL);

  // CLONER at crater floor, LAVA above it — eruption starts immediately
  fill(cx-5, peakY+2,  cx+5, peakY+5,  S.CLONER);
  fill(cx-5, peakY+6,  cx+5, peakY+14, S.LAVA);

  // Ocean at base — fills with solidified lava over time
  const waterY=baseY+6;
  fill(0, waterY,   N-1, N-1,      S.WATER);
  fill(0, waterY-4, N-1, waterY-1, S.WALL);

  // Coral seeds + fungus on the seabed
  for(let i=0;i<8;i++) dot(12+i*37, waterY+18, 3, S.SEED);
  for(let i=0;i<6;i++) dot(25+i*50, N-8,        4, S.FUNGUS);
}

// ══════════════════════════════════════════════
//  ❄️  GLACIER
//  A massive living glacier — a CLONER strip at
//  the top endlessly replenishes ice as it melts.
//  Melt-water cascades over two stone ledges and
//  floods the valley below. Seeds and fungus
//  carpet the valley floor; they bloom into a
//  lush spring landscape as the water arrives.
// ══════════════════════════════════════════════
async function loadGlacier() {
  const iceBase=Math.floor(N*0.38);

  // Organic jagged ice mass
  for(let x=0;x<N;x++){
    const jagged=Math.floor(
      Math.sin(x*0.062)*16 + Math.cos(x*0.135)*9 + Math.sin(x*0.37)*4
    );
    const edgeY=Math.max(4, iceBase+jagged);
    fill(x, 4, x, edgeY, S.ICE);
  }

  // CLONER strip at top — always adjacent to ICE below → replenishes forever
  fill(0, 0, N-1, 3, S.CLONER);

  // Two stone ledges — create pools and stepped waterfalls
  fill(8,             Math.floor(N*0.55), Math.floor(N*0.52), Math.floor(N*0.59), S.WALL);
  fill(Math.floor(N*0.48), Math.floor(N*0.69), N-8, Math.floor(N*0.73), S.WALL);

  // Dense seed strip across valley floor — spring garden
  for(let x=8;x<N-8;x+=6)
    dot(x, Math.floor(N*0.76)+Math.floor(Math.sin(x*0.09)*5), 2, S.SEED);
  // Fungus clusters
  for(let x=12;x<N-12;x+=12)
    dot(x, Math.floor(N*0.84), 3, S.FUNGUS);
}

// ══════════════════════════════════════════════
//  🌴  OASIS
//  A desert with two sand dunes. A CLONER spring
//  at the center produces water endlessly from
//  a walled basin. Water overflows, saturates
//  the sand, and spreads outward. Seeds and
//  fungus bloom into a living oasis. Two palm
//  trees frame the scene.
// ══════════════════════════════════════════════
async function loadOasis() {
  const cx=N>>1;
  const groundY=Math.floor(N*0.60);

  // Sandy desert
  fill(0, groundY, N-1, N-1, S.SAND);

  // Two sand dunes built up on the sides
  for(let x=0;x<N;x++){
    const ld=Math.floor(62*Math.exp(-((x-42)**2)/800));
    const rd=Math.floor(58*Math.exp(-((x-(N-44))**2)/750));
    const dh=Math.max(ld,rd);
    if(dh>0) fill(x, groundY-dh, x, groundY-1, S.SAND);
  }

  // Oasis basin — walls flush with surface, open at top
  // CLONER fills interior; water above teaches it → infinite spring
  fill(cx-16, groundY,   cx-14, groundY+10, S.WALL); // left wall
  fill(cx+14, groundY,   cx+16, groundY+10, S.WALL); // right wall
  fill(cx-16, groundY+10,cx+16, groundY+11, S.WALL); // floor
  fill(cx-13, groundY,   cx+13, groundY+9,  S.CLONER);
  fill(cx-7,  groundY-5, cx+7,  groundY-1,  S.WATER); // water seed, touches CLONER

  // Left palm tree
  const lx=cx-48;
  fill(lx-3, groundY-72, lx+3, groundY-1, S.WOOD);
  fill(lx-22,groundY-90, lx+22,groundY-66,S.PLANT);
  fill(lx-14,groundY-106,lx+14,groundY-86,S.PLANT);
  fill(lx-7, groundY-118,lx+7, groundY-102,S.PLANT);
  dot(lx, groundY-124, 3, S.SEED);

  // Right palm tree
  const rx=cx+48;
  fill(rx-3, groundY-72, rx+3, groundY-1, S.WOOD);
  fill(rx-22,groundY-90, rx+22,groundY-66,S.PLANT);
  fill(rx-14,groundY-106,rx+14,groundY-86,S.PLANT);
  fill(rx-7, groundY-118,rx+7, groundY-102,S.PLANT);
  dot(rx, groundY-124, 3, S.SEED);

  // Seeds close to spring — first to bloom
  [-22,-14,14,22].forEach(dx=>dot(cx+dx, groundY-1, 2, S.SEED));
  // Fungus further out in the sand
  [-72,-56,56,72].forEach(dx=>dot(cx+dx, groundY-1, 3, S.FUNGUS));
  // Distant seeds near dune bases
  [18, N-18].forEach(x=>dot(x, groundY-16, 2, S.SEED));
}

// ══════════════════════════════════════════════
//  🌊  CASCADE
//  Four zigzag stone ledges. A CLONER at the top
//  produces water endlessly. Each ledge has a
//  hanging plant curtain, ICE blocks that add
//  melt-water, fungus clusters, and a seed strip.
//  Final: lush green waterfall with a jungle pool.
// ══════════════════════════════════════════════
async function loadCascade() {
  fill(0,0,6,N-1,S.WALL); fill(N-7,0,N-1,N-1,S.WALL);

  const ledges=[
    {y:0.18, x1:0.02, x2:0.68, drop:'right'},
    {y:0.38, x1:0.32, x2:0.98, drop:'left'},
    {y:0.58, x1:0.02, x2:0.68, drop:'right'},
    {y:0.74, x1:0.32, x2:0.98, drop:'left'},
  ];

  ledges.forEach(({y,x1,x2})=>{
    fill(Math.floor(x1*N), Math.floor(y*N),
         Math.floor(x2*N), Math.floor(y*N)+10, S.WALL);
  });

  ledges.forEach(({y,x1,x2,drop},i)=>{
    const gy=Math.floor(y*N);
    const lx1=Math.floor(x1*N), lx2=Math.floor(x2*N);
    const ex=drop==='right' ? lx2 : lx1;
    const ed=drop==='right' ? -1  : 1;

    // Hanging plant curtain at waterfall edge
    fill(ex+ed*18, gy-46, ex+ed*2, gy-1,  S.PLANT);
    fill(ex+ed*11, gy-62, ex+ed*1, gy-44, S.PLANT);
    dot(ex+ed*8,   gy-68, 3, S.SEED);

    // ICE block — melts into bonus water
    const ix=drop==='right' ? lx1+46+i*10 : lx2-46-i*10;
    fill(ix-12, gy-28, ix+12, gy-2, S.ICE);

    // Fungus cluster on sheltered side
    const fx=drop==='right' ? lx1+18 : lx2-18;
    dot(fx,    gy-3, 5, S.FUNGUS);
    dot(fx+10, gy-3, 4, S.FUNGUS);

    // Seed strip along ledge surface
    for(let sx=lx1+24;sx<lx2-24;sx+=16) dot(sx, gy-2, 2, S.SEED);
  });

  // Infinite water source — CLONER top-left
  fill(7,  0, 30, 12, S.CLONER);
  fill(31, 0, 98, 12, S.WATER);

  // Pre-seed water on each ledge for immediate flow
  ledges.forEach(({y,x1,x2,drop})=>{
    const ly=Math.floor(y*N);
    const lx1=Math.floor(x1*N), lx2=Math.floor(x2*N);
    const wx=drop==='right' ? lx1+8 : lx2-72;
    fill(wx, ly-26, wx+64, ly-1, S.WATER);
  });

  // Deep jungle pool at bottom
  fill(7, Math.floor(N*0.88), N-8, N-2, S.WATER);
  fill(7, Math.floor(N*0.85), N-8, Math.floor(N*0.88)-1, S.SAND);
  [0.14,0.27,0.41,0.55,0.69,0.83].forEach(rx=>{
    dot(Math.floor(N*rx), Math.floor(N*0.87), 3, S.SEED);
  });
  [0.21,0.35,0.49,0.63,0.77].forEach(rx=>{
    dot(Math.floor(N*rx), Math.floor(N*0.86), 5, S.FUNGUS);
  });
}

// ── Apply preset ──────────────────────────────
async function applyPreset(name) {
  if(!window.u){
    await new Promise(res=>{
      const t=setInterval(()=>{if(window.u){clearInterval(t);res();}},100);
    });
  }

  window.paused=true;
  const pb=document.getElementById('vui-pause');
  if(pb){pb.textContent='▶';pb.classList.add('selected');}

  if(window.reset) window.reset(); else window.u.reset();
  await sleep(60);

  const sb=document.getElementById('sb-status');
  if(sb) sb.textContent='Loading…';

  const scenes={
    volcano:loadVolcano, glacier:loadGlacier,
    oasis:loadOasis,     cascade:loadCascade,
  };
  if(scenes[name]) await scenes[name]();

  const pw=document.getElementById('presets-window');
  if(pw) pw.style.display='none';

  await sleep(700);
  playNotify();
  window.paused=false;
  if(pb){pb.textContent='⏸';pb.classList.remove('selected');}

  const labels={
    volcano:'🌋 Volcano', glacier:'❄️ Glacier',
    oasis:'🌴 Oasis',     cascade:'🌊 Cascade',
  };
  if(sb){
    sb.textContent=labels[name]||'Ready';
    setTimeout(()=>{if(sb.textContent===labels[name])sb.textContent='Ready';},3000);
  }
}

// Wire double-click on preset icons
document.querySelectorAll('.picon').forEach(icon=>{
  icon.addEventListener('dblclick',()=>applyPreset(icon.dataset.preset));
});
