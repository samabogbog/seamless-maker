const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(options = {}) {
  const elements={}, requests=[], callbacks=[], timers=[], draws=[], images=[], strokes=[], listeners={}, canvases=[];
  const html=fs.readFileSync(path.join(__dirname,'../extension/index.html'),'utf8');
  const controls=[];
  function node(id, tag='div') {
    let _text = '';
    const n={ id, tagName:tag, value:'', disabled:false, className:'', style:{}, children:[], clientWidth:334, clientHeight:140,
      get textContent(){ return _text; },
      set textContent(v){ _text = v; if (!v) this.children = []; },
      setAttribute(key,value){this[key]=value;}, appendChild(child){this.children.push(child);},
      getContext(){return {scale(){},save(){},restore(){},beginPath(){},rect(){},clip(){},drawImage(...args){draws.push(args);},strokeRect(...args){strokes.push(args);}};} };
    return n;
  }
  for(const match of html.matchAll(/<(input|select|button|canvas|div|span|strong|label)[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const n=node(match[2],match[1]); const value=/\bvalue="([^"]*)"/.exec(match[0]); if(value)n.value=value[1];
    elements[n.id]=n; if(match[1]==='input'||match[1]==='select')controls.push(n);
  }
  Object.assign(elements.sizeMode,{value:'artboard'}); elements.units.value='mm'; elements.mode.value='all'; elements.layout.value=options.lattice?'lattice':'grid'; elements.background.value='transparent';
  const document={getElementById:id=>elements[id],querySelectorAll:()=>controls.filter(n=>!['background'].includes(n.id)),createElement:tag=>{const value=node('',tag);if(tag==='canvas')canvases.push(value);return value;}};
  const files=options.files||{},writes=[];const window={cep:{fs:{showOpenDialog(){return {err:0,data:options.cancel?[]:['C:/preset.json']};},showSaveDialogEx(){return {err:0,data:options.cancel?'':'C:/exported'};},readFile(p){return {err:options.readError?1:0,data:files[p]};},writeFile(p,text){writes.push({path:p,text});return {err:options.writeError?1:0};}}},devicePixelRatio:1,addEventListener(name,callback){listeners[name]=callback;}};
  const context=vm.createContext({document,window,Image:function(){images.push(this);Object.defineProperty(this,'src',{set(value){this.uri=value;this.onload();}});},
    SeamlessBridge:{call(request,callback){requests.push(request);callbacks.push(callback);}},
    setTimeout(fn){timers.push(fn);return timers.length;},clearTimeout(id){if(id)timers[id-1]=null;}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/shared/repeat.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/shared/matcher.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/js/preset.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/js/panel.js'),'utf8'),context);
  const artboard={index:0,rect:[0,options.height||80,options.width||100,0],width:options.width||100,height:options.height||80};
  function reply(data,error=null){callbacks.shift()(error,data);}
  function flush(){while(timers.length){const fn=timers.shift();if(fn)fn();}}
  function prepared(request,changes={}) {
    const s={...request.settings};if(s.sizeMode==='artboard'){s.width=artboard.width;s.height=artboard.height;}
    const image={width:18,height:12,padding:1,uri:'file:///C:/Temp/test.png'};
    const plan=context.SeamlessRepeat.plan(s,image);
    return {settings:s,artboard,image,previewToken:'snapshot',count:plan.count,exceeded:plan.exceeded,warning:plan.warning,...changes};
  }
  function load(){reply({artboard});elements.useSymbol.onclick();reply({sourceToken:'source',name:'Color Symbol',artboard});reply(prepared(requests[requests.length-1]));}
  return {elements,requests,reply,flush,prepared,load,draws,images,strokes,listeners,canvases,files,writes};
}

test('panel loads real host image and enables Create only after a complete preview', () => {
  const f=fixture(); assert.equal(f.elements.create.disabled,true); f.load();
  assert.equal(f.elements.sourceName.textContent,'Color Symbol'); assert.equal(f.elements.create.disabled,false);
  assert.equal(f.elements.emptyPreview.style.display,'none'); assert.equal(f.images[0].uri,'file:///C:/Temp/test.png');
  f.elements.create.onclick(); assert.equal(f.elements.create.disabled,true);
  assert.equal(f.requests.at(-1).action,'create');assert.equal(f.requests.at(-1).previewToken,'snapshot');
  f.reply({count:16});assert.match(f.elements.status.textContent,/Created 16/);
});

test('unit changes preserve point dimensions; blank fields invalidate preview', () => {
  const f=fixture(); f.load(); f.elements.sizeMode.value='custom';f.elements.width.value='25.4'; f.elements.units.value='in';f.elements.units.onchange();
  assert.equal(f.elements.width.value,'1'); assert.equal(f.elements.create.disabled,true); f.flush();
  assert.equal(f.requests.at(-1).settings.width,72);
  f.reply(f.prepared(f.requests.at(-1)));
  f.elements.columns.value='';f.elements.columns.oninput();f.flush();
  assert.equal(f.elements.create.disabled,true);assert.match(f.elements.status.textContent,/Enter a value/);
});

test('preview zoom has exact Fit/50%/100% scales, clamps dragging and leaves artwork unchanged',()=>{
  const f=fixture({width:1000,height:800});f.load();const requests=f.requests.length;
  assert.equal(f.elements.scale,undefined);assert.equal(f.elements.rotation,undefined);
  assert.equal(f.elements.offsetX,undefined);assert.equal(f.elements.offsetY,undefined);
  f.elements.zoom100.onclick();assert.deepEqual(f.strokes.at(-1),[-333,-330,1000,800]);
  assert.equal(f.elements.zoom100['aria-pressed'],'true');assert.equal(f.elements.previewStage.style.cursor,'grab');
  const canvasCount=f.canvases.length;
  f.elements.previewStage.onmousedown({button:0,clientX:50,clientY:50,preventDefault(){}});
  f.listeners.mousemove({clientX:10000,clientY:10000});assert.deepEqual(f.strokes.at(-1),[0,0,1000,800]);
  f.listeners.mousemove({clientX:-10000,clientY:-10000});assert.deepEqual(f.strokes.at(-1),[-666,-660,1000,800]);
  f.listeners.mouseup();assert.equal(f.elements.previewStage.style.cursor,'grab');
  assert.equal(f.canvases.length,canvasCount,'panning must not allocate full-size tile canvases');
  f.elements.zoom50.onclick();assert.deepEqual(f.strokes.at(-1),[-83,-130,500,400]);
  f.elements.zoomFit.onclick();const fit=f.strokes.at(-1);assert.ok(fit[2]<=334&&fit[3]<=140);assert.equal(f.elements.previewStage.style.cursor,'default');
  assert.equal(f.requests.length,requests,'zoom/pan must not request new host images or artwork');
  f.elements.create.onclick();const s=f.requests.at(-1).settings;
  assert.equal(s.scale,100);assert.equal(s.rotation,0);assert.equal(s.offsetX,0);assert.equal(s.offsetY,0);
});

test('zoom works in repeat view and dragging ends on window blur',()=>{
  const f=fixture({width:1000,height:800});f.load();f.elements.repeatView.onclick();f.elements.zoom100.onclick();
  assert.deepEqual(f.strokes.at(-1),[-333,-330,1000,800]);
  f.elements.previewStage.onmousedown({button:0,clientX:0,clientY:0,preventDefault(){}});
  f.listeners.mousemove({clientX:100,clientY:20});assert.deepEqual(f.strokes.at(-1),[-233,-310,1000,800]);
  f.listeners.blur();const last=f.strokes.at(-1);f.listeners.mousemove({clientX:200,clientY:40});assert.deepEqual(f.strokes.at(-1),last);
  f.elements.mode.value='vertical';f.elements.mode.onchange();f.flush();f.reply(f.prepared(f.requests.at(-1)));
  f.elements.zoom50.onclick();assert.deepEqual(f.strokes.at(-1),[-83,-130,500,400]);
});

test('stale preview response is ignored and latest settings become the create snapshot', () => {
  const f=fixture();f.load();
  f.elements.rows.value='3';f.elements.rows.oninput();f.flush();const old=f.requests.at(-1);
  f.elements.rows.value='5';f.elements.rows.oninput();f.flush();const next=f.requests.at(-1);
  f.reply(f.prepared(old));assert.equal(f.elements.create.disabled,true);
  f.reply(f.prepared(next));assert.equal(f.elements.create.disabled,false);
  f.elements.create.onclick();assert.equal(f.requests.at(-1).settings.rows,5);
});

test('over-limit and host errors cannot generate artwork; refreshing forces raster update', () => {
  const f=fixture();f.load();f.elements.rows.value='101';f.elements.columns.value='101';f.elements.rows.oninput();f.flush();
  f.reply(f.prepared(f.requests.at(-1)));assert.equal(f.elements.create.disabled,true);assert.match(f.elements.status.textContent,/Too many/);
  f.elements.refresh.onclick();assert.equal(f.requests.at(-1).refresh,true);
  f.reply(null,new Error('Source deleted'));assert.equal(f.elements.create.disabled,true);assert.equal(f.elements.status.textContent,'Source deleted');
});

test('Repeat Preview draws nine tiles in All Sides and three in Top-Bottom', () => {
  const f=fixture();f.load();f.draws.length=0;f.elements.repeatView.onclick();
  let tileCopies=f.draws.filter(args=>args.length===5 && args[0].tagName==='canvas');assert.equal(tileCopies.length,9);
  f.elements.mode.value='vertical';f.elements.mode.onchange();f.flush();f.draws.length=0;f.reply(f.prepared(f.requests.at(-1)));
  tileCopies=f.draws.filter(args=>args.length===5 && args[0].tagName==='canvas');assert.equal(tileCopies.length,3);
});

test('tilted lattice computes All Sides spacing and switches to fixed Top-Bottom vectors', () => {
  const f=fixture({lattice:true});f.load();
  assert.equal(f.elements.horizontalX.disabled,true);assert.equal(f.elements.columns.disabled,false);
  assert.ok(Math.abs(Number(f.elements.horizontalX.value)-25/(72/25.4))<0.0001);
  f.elements.rowShift.value='1';f.elements.rowCycles.value='2';f.elements.columnShift.value='-2';
  f.elements.columnShift.oninput();f.flush();
  let request=f.requests.at(-1);assert.equal(request.settings.rowShift,1);assert.equal(request.settings.rowCycles,2);
  f.reply(f.prepared(request));assert.match(f.elements.latticeInfo.textContent,/Col \+4, Row \+8/);
  assert.match(f.elements.latticeInfo.textContent,/Left → Right: Col \+2, Row -4/);
  f.elements.mode.value='vertical';f.elements.mode.onchange();f.flush();f.reply(f.prepared(f.requests.at(-1)));
  assert.equal(f.elements.horizontalX.disabled,false);assert.equal(f.elements.columns.disabled,true);
  assert.equal(f.elements.tiltRows.style.display,'none');
  f.elements.horizontalX.value='25.4';f.elements.horizontalY.value='-12.7';
  f.elements.units.value='in';f.elements.units.onchange();f.flush();
  request=f.requests.at(-1);assert.equal(request.settings.horizontalX,72);assert.equal(request.settings.horizontalY,-36);
  assert.equal(request.settings.rowShift,undefined);f.reply(f.prepared(request));
  assert.match(f.elements.latticeInfo.textContent,/Col \+2, Row \+4/);assert.equal(f.elements.create.disabled,false);
  f.elements.create.onclick();assert.equal(f.requests.at(-1).settings.horizontalX,72);
});

function preset(changes={}) {
 return {format:'seamless-maker-pattern',version:1,units:'in',settings:{sizeMode:'custom',width:144,height:216,mode:'vertical',layout:'lattice',columns:3,rows:6,rowShift:-1,rowCycles:2,columnShift:1,horizontalX:36,horizontalY:-18,...changes},preview:{background:'white'}};
}
test('white preview is the default and transparent remains selectable',()=>{
 const f=fixture();assert.equal(f.elements.background.value,'white');assert.equal(f.elements.previewStage.className,'preview-stage');
 f.elements.background.value='transparent';f.elements.background.onchange();assert.equal(f.elements.previewStage.className,'preview-stage checker');
 f.elements.bgToggle.onclick();assert.equal(f.elements.background.value,'white');assert.equal(f.elements.previewStage.className,'preview-stage');
 f.elements.bgToggle.onclick();assert.equal(f.elements.background.value,'transparent');assert.equal(f.elements.previewStage.className,'preview-stage checker');
});
test('JSON preset roundtrip preserves units, dimensions and tilted Top-Bottom settings',()=>{
 const f=fixture();f.load();f.files['C:/preset.json']=JSON.stringify(preset());f.elements.importPreset.onclick();
 assert.equal(f.elements.units.value,'in');assert.equal(f.elements.width.value,'2');assert.equal(f.elements.height.value,'3');assert.equal(f.elements.create.disabled,true);
 f.flush();const r=f.requests.at(-1);assert.equal(r.settings.horizontalX,36);assert.equal(r.settings.horizontalY,-18);assert.equal(r.settings.rows,6);assert.equal(r.settings.width,144);
 f.reply(f.prepared(r));assert.equal(f.elements.create.disabled,false);
 f.elements.exportPreset.onclick();assert.equal(f.writes[0].path,'C:/exported.json');const out=JSON.parse(f.writes[0].text);
 assert.equal(out.units,'in');assert.deepEqual(out.settings,{...preset().settings,scale:100,rotation:0,offsetX:0,offsetY:0});assert.equal(out.preview.background,'white');
 f.elements.create.onclick();assert.equal(f.requests.at(-1).settings.horizontalY,-18);
});
test('preset imports before a symbol is loaded and artboard mode follows the current document',()=>{
 const f=fixture();f.files['C:/preset.json']=JSON.stringify(preset({sizeMode:'artboard'}));f.elements.importPreset.onclick();
 assert.match(f.elements.status.textContent,/Preset imported/);assert.equal(f.elements.create.disabled,true);f.reply({artboard:{index:0,rect:[0,80,100,0],width:100,height:80}});
 assert.equal(f.elements.width.value,String(Math.round(100/72*10000)/10000));assert.equal(f.elements.width.disabled,true);
});
test('malformed, unsupported and invalid presets leave controls and existing preview intact',()=>{
 for(const value of ['{bad',JSON.stringify({...preset(),version:2}),JSON.stringify(preset({rows:0})),JSON.stringify(preset({horizontalX:0})),JSON.stringify({...preset(),units:'constructor'})]){
  const f=fixture();f.load();const before=f.elements.width.value,requests=f.requests.length;
  f.files['C:/preset.json']=value;f.elements.importPreset.onclick();assert.equal(f.elements.width.value,before);assert.equal(f.requests.length,requests);assert.equal(f.elements.create.disabled,false);assert.equal(f.elements.status.className,'error');
 }
});
test('cancelled preset dialogs are harmless and file failures are surfaced',()=>{
 const f=fixture({cancel:true});f.load();const r=f.requests.length;f.elements.importPreset.onclick();f.elements.exportPreset.onclick();assert.equal(f.requests.length,r);assert.equal(f.writes.length,0);
 const failed=fixture({writeError:true});failed.load();failed.elements.exportPreset.onclick();assert.match(failed.elements.status.textContent,/Cannot save preset/);
 const unreadable=fixture({readError:true});unreadable.load();unreadable.elements.importPreset.onclick();assert.match(unreadable.elements.status.textContent,/Cannot read preset/);
});
test('import invalidates an in-flight preview so old settings cannot enable Create',()=>{
 const f=fixture();f.load();f.elements.rows.value='8';f.elements.rows.oninput();f.flush();const old=f.requests.at(-1);
 f.files['C:/preset.json']=JSON.stringify(preset());f.elements.importPreset.onclick();f.reply(f.prepared(old));assert.equal(f.elements.create.disabled,true);
 f.flush();f.reply(f.prepared(f.requests.at(-1)));assert.equal(f.elements.create.disabled,false);f.elements.create.onclick();assert.equal(f.requests.at(-1).settings.rows,6);
});

test('matcher tab switches, solves candidate configs, and applies chosen settings', () => {
 const f = fixture({ width: 200, height: 200 });
 f.load();
 assert.equal(f.elements.tabMaker.className, 'active');
 assert.equal(f.elements.makerPane.style.display, '');

 f.elements.tabMatcher.onclick();
 assert.equal(f.elements.tabMatcher.className, 'active');
 assert.equal(f.elements.tabMaker.className, '');
 assert.equal(f.elements.makerPane.style.display, 'none');

 f.elements.matchUnits.value = 'pt';
 f.elements.matchWidth.value = '200';
 f.elements.matchHeight.value = '200';
 f.elements.matchHx.value = '50';
 f.elements.matchHy.value = '0';
 f.elements.matchVx.value = '0';
 f.elements.matchVy.value = '50';

 f.elements.btnFindMatches.onclick();
 assert.match(f.elements.matcherStatus.textContent, /Found 5 closest/);
 assert.equal(f.elements.matcherResults.children.length, 5);

 const firstCard = f.elements.matcherResults.children[0];
 const applyBtn = firstCard.applyButton || firstCard.children[0].children[1].children[1];
 applyBtn.onclick();

 assert.equal(f.elements.tabMaker.className, 'active');
 assert.equal(f.elements.makerPane.style.display, '');
 assert.equal(f.elements.columns.value, '4');
 assert.equal(f.elements.rows.value, '4');
 assert.match(f.elements.status.textContent, /Applied candidate #1/);

 // Test that matchMode is independent and not overwritten by Repeat tab
 f.elements.tabMatcher.onclick();
 f.elements.matchMode.value = 'vertical';
 f.elements.btnFindMatches.onclick();
 assert.equal(f.elements.matchMode.value, 'vertical');
 const vertCard = f.elements.matcherResults.children[0];
 const vertApply = vertCard.applyButton || vertCard.children[0].children[1].children[1];
 vertApply.onclick();
 assert.equal(f.elements.mode.value, 'vertical');
});

