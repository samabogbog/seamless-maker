const test = require('node:test');
const assert = require('node:assert/strict');
const repeat = require('../extension/shared/repeat');
const defaults={sizeMode:'custom',width:600,height:480,columns:10,rows:8,scale:100,rotation:0,offsetX:0,offsetY:0,mode:'all',layout:'lattice',rowShift:1,rowCycles:1,columnShift:-2,horizontalX:60,horizontalY:15};
function near(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);}
function translation(b,m){return {x:m.columns*b.horizontal.x+m.rows*b.vertical.x,y:m.columns*b.horizontal.y+m.rows*b.vertical.y};}

test('Top-Bottom matches Rotary calc2 with fixed Horizontal X/Y',()=>{
  const s={...defaults,mode:'vertical'},b=repeat.vectors(s);
  assert.deepEqual(b.horizontal,{x:60,y:15});assert.deepEqual(b.vertical,{x:-15,y:56.25});
  assert.deepEqual(b.verticalMatch,{columns:2,rows:8});
  const delta=translation(b,b.verticalMatch);near(delta.x,0);near(delta.y,480);
  // col1,row3 -> col3,row11: +2 horizontal steps, +8 vertical steps.
  const first={x:0*b.horizontal.x+2*b.vertical.x,y:0*b.horizontal.y+2*b.vertical.y};
  const next={x:2*b.horizontal.x+10*b.vertical.x,y:2*b.horizontal.y+10*b.vertical.y};
  near(next.x,first.x);near(next.y-first.y,s.height);
});

test('All Sides matches Rotary calc4 for Row Tilt=1 and Unit/Angle counts',()=>{
  const s={...defaults,rowCycles:3,columnShift:2},b=repeat.vectors(s);
  assert.deepEqual(b.horizontal,{x:60,y:16});assert.deepEqual(b.vertical,{x:15,y:24});
  const down=translation(b,b.verticalMatch),right=translation(b,b.horizontalMatch);
  near(down.x,0);near(down.y,480);near(right.x,600);near(right.y,0);
});

test('independent positive/negative row and column tilt close all four edges',()=>{
  for(const rowShift of [-3,-1,0,1,2])for(const columnShift of [-4,-1,0,2,5])for(const rowCycles of [1,2,3]){
    const s={...defaults,rowShift,columnShift,rowCycles},b=repeat.vectors(s);
    const down=translation(b,b.verticalMatch),right=translation(b,b.horizontalMatch);
    near(down.x,0);near(down.y,s.height);near(right.x,s.width);near(right.y,0);
  }
});

test('Top-Bottom fixed spacing stays fixed when the tile width changes',()=>{
  const a=repeat.vectors({...defaults,mode:'vertical'}),b=repeat.vectors({...defaults,mode:'vertical',width:1234});
  assert.deepEqual(a,b);
  const allA=repeat.vectors(defaults),allB=repeat.vectors({...defaults,width:1234});
  assert.notEqual(allA.horizontal.x,allB.horizontal.x);
});

function brute(s,f){
  // Independent Rotary formulas + exhaustive index scan, rather than inverse bounds.
  const unit=s.mode==='all'?s.rowCycles:1;
  const hx=s.mode==='all'?s.width/s.columns:s.horizontalX;
  const hy=s.mode==='all'?s.height*s.rowShift/unit/s.columns:s.horizontalY;
  const vx=hx*s.columnShift/s.rows,vy=(s.height/unit+hy*s.columnShift)/s.rows;
  let ox=(hx+vx)/2+s.offsetX,oy=(hy+vy)/2+s.offsetY;
  if(s.mode==='all'){ox=repeat.mod(ox,s.width);oy=repeat.mod(oy,s.height);}
  else {const phase=Math.floor(ox/hx);ox-=phase*hx;oy=repeat.mod(oy-phase*hy,s.height);}
  const points=[];
  for(let row=-100;row<=100;row++)for(let column=-100;column<=100;column++){
    const x=ox+row*vx+column*hx,y=oy+row*vy+column*hy;
    if(x+f.width/2>=-1-1e-7&&x-f.width/2<=s.width+1+1e-7&&y+f.height/2>=-1-1e-7&&y-f.height/2<=s.height+1+1e-7)points.push({x,y,column,row});
  }
  return points;
}

test('tilted lattice culling matches brute-force rows/columns, including negative indices and oversized symbols',()=>{
  for(const mode of ['all','vertical'])for(const rowShift of [-1,0,1])for(const columnShift of [-2,0,2]){
    const s={...defaults,width:100,height:80,columns:3,rows:4,rowCycles:2,mode,rowShift,columnShift,horizontalX:30,horizontalY:9,offsetX:-23,offsetY:17};
    for(const f of [{width:18,height:12},{width:260,height:190}]){
      const actual=repeat.plan(s,f).points,expected=brute(s,f);
      assert.equal(actual.length,expected.length,JSON.stringify(s));
      for(let i=0;i<actual.length;i++){near(actual[i].x,expected[i].x);near(actual[i].y,expected[i].y);assert.equal(actual[i].column,expected[i].column);assert.equal(actual[i].row,expected[i].row);}
    }
  }
});

test('opposite borders preserve contributor positions, row/column compensation and stacking order',()=>{
  const f={width:180,height:150};
  for(const mode of ['all','vertical'])for(const columnShift of [-2,2]){
    const s={...defaults,width:100,height:80,columns:3,rows:4,mode,rowCycles:2,rowShift:1,columnShift,horizontalX:30,horizontalY:9,offsetX:-23,offsetY:17};
    const p=repeat.plan(s,f);
    function contributors(x,y){return p.points.filter(q=>Math.abs(q.x-x)<f.width/2-1e-7&&Math.abs(q.y-y)<f.height/2-1e-7).map(q=>({x:q.x-x,y:q.y-y,column:q.column,row:q.row}));}
    for(const [x,y,dx,dy,match] of [[27,0,0,80,p.lattice.verticalMatch],...(mode==='all'?[[0,27,100,0,p.lattice.horizontalMatch]]:[])]){
      const a=contributors(x,y),b=contributors(x+dx,y+dy);assert.equal(a.length,b.length);
      for(let i=0;i<a.length;i++){near(a[i].x,b[i].x);near(a[i].y,b[i].y);assert.equal(b[i].column-a[i].column,match.columns);assert.equal(b[i].row-a[i].row,match.rows);}
    }
  }
});

test('lattice validation and workload limits reject invalid compensation and dangerous scans',()=>{
  for(const change of [{rowCycles:1.5},{rowShift:0.5},{columnShift:0.5},{mode:'vertical',horizontalX:0},{mode:'vertical',horizontalY:Infinity}])assert.throws(()=>repeat.plan({...defaults,...change},{width:10,height:10}));
  assert.equal(repeat.plan({...defaults,columns:100,rows:100,rowCycles:2},{width:10,height:10}).exceeded,true);
  assert.throws(()=>repeat.plan({...defaults,mode:'vertical',horizontalX:0.00001,horizontalY:1e20},{width:10,height:10}),/extreme|range/);
});
