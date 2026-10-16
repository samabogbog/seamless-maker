const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const defaults = { sizeMode: 'custom', width: 100, height: 80, columns: 3, rows: 3, scale: 100, rotation: 0, offsetX: -8, offsetY: 7, mode: 'all', layout: 'stagger' };

function fixture(options = {}) {
  const pngs = new Set(), captures = [], documents = [], backgroundDocs = [], stats={boundsReads:0,pageItemReads:0};
  let context, failingDuplicate = false;
  function File(name) {
    if (!(this instanceof File)) return new File(name);
    this.name = String(name); this.fsName = this.name.replace(/\//g, '\\');
    Object.defineProperty(this, 'parent', { get: () => new File(path.dirname(this.name)) });
    Object.defineProperty(this, 'exists', { get: () => pngs.has(this.name) || fs.existsSync(this.name) });
    this.remove = () => pngs.delete(this.name); this.toString = () => this.name;
  }
  function Folder(name) { if (!(this instanceof Folder)) return new Folder(name); this.name = String(name); this.exists = true; this.create = () => true; this.toString = () => this.name; }
  Folder.temp = 'C:/Temp';
  function children(parent) {
    return { items: [], get length(){return this.items.length;}, add() {
      const layer = container('Layer', parent); this.items.unshift(layer); return layer;
    } };
  }
  function container(type, parent) {
    const value = { typename: type, parent, items: [], name: '', clipped: false, locked: false, hidden: false, visible: true };
    value.groupItems = { add() { const group = container('GroupItem', value); value.items.unshift(group); return group; } };
    value.pathItems = { rectangle(top, left, width, height) {
      const mask = { typename: 'PathItem', visibleBounds: [left, top, left+width, top-height], clipping: false, stroked: true, filled: true,
        move(target) { const ix = value.items.indexOf(this); if (ix >= 0) value.items.splice(ix, 1); target.items.unshift(this); } };
      value.items.unshift(mask); return mask;
    } };
    value.remove = () => { const list = parent.layers ? parent.layers.items : parent.items; list.splice(list.indexOf(value), 1); value.removed = true; };
    if(options.cleanupFailure && type==='Layer' && parent.layers && parent.layers.items.length) {
      value.remove=()=>{throw new Error('Injected layer cleanup failure');};
    }
    return value;
  }
  function symbol(parent, width = 18, height = 12) {
    const value = { typename: 'SymbolItem', parent, symbol: { name: 'Test Gradient' }, hidden: false, locked: false, opacity: 80, blendingMode: 'normal',
      _matrix: { mValueA: 1, mValueB: 0, mValueC: 0, mValueD: 1, mValueTX: 0, mValueTY: 0 }, visibleBounds: [2, 35, 2+width, 35-height] };
    // Real Illustrator SymbolItem has no public matrix property; do not invent one by default.
    if(options.matrixMode==='present')Object.defineProperty(value,'matrix',{get(){return this._matrix;}});
    if(options.matrixMode==='throws')Object.defineProperty(value,'matrix',{get(){throw new Error('Unsupported property: matrix');}});
    value.translate = (x,y) => { value.visibleBounds = value.visibleBounds.map((n,i) => n + (i % 2 ? y : x)); value._matrix.mValueTX += x; value._matrix.mValueTY += y; };
    value.resize = (x,y) => { const b=value.visibleBounds, cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2; const w=(b[2]-b[0])*x/100, h=(b[1]-b[3])*y/100; value.visibleBounds=[cx-w/2,cy+h/2,cx+w/2,cy-h/2]; };
    value.rotate = angle => { const b=value.visibleBounds, w=b[2]-b[0], h=b[1]-b[3], cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2; const c=Math.abs(Math.cos(angle*Math.PI/180)), s=Math.abs(Math.sin(angle*Math.PI/180)); value.visibleBounds=[cx-(w*c+h*s)/2,cy+(w*s+h*c)/2,cx+(w*c+h*s)/2,cy-(w*s+h*c)/2]; };
    value.duplicate = (target, placement) => {
      if ((failingDuplicate && target.typename === 'GroupItem') || options.previewDuplicateFailure) throw new Error('Injected duplicate failure');
      const copy=symbol(target); target.items.pop(); copy.visibleBounds=value.visibleBounds.slice(); copy._matrix={...value._matrix}; copy.symbol=value.symbol; copy.opacity=value.opacity;
      if (placement === 'front') target.items.unshift(copy); else target.items.push(copy);
      return copy;
    };
    parent.items.push(value); return value;
  }
  function doc(colorSpace='RGB') {
    const value = { documentColorSpace: colorSpace, selection: [], artboards: [{artboardRect: [20,150,120,70]}], activeLayer: null };
    value.artboards.getActiveArtboardIndex = () => 0;
    value.layers=children(value); Object.defineProperty(value.layers,'0',{get:()=>value.layers.items[0]}); value.activeLayer=value.layers.add();
    // Illustrator Document does not expose activate(); Application.activeDocument is settable.
    value.close = () => { documents.splice(documents.indexOf(value),1); value.closed=true; if(app.activeDocument===value)app.activeDocument=documents[0]; };
    value.exportFile = (file,type,captureOptions) => { if(options.hiddenExportNoDocument && value.background)throw new Error('there is no document'); if(options.hiddenExportMissingFile && value.background)return; pngs.add(file.name); captures.push({file,bounds:value.artboards[0].artboardRect.slice(),options:captureOptions,type,doc:value}); if(options.exportFailure)throw new Error('Injected PNG export failure'); };
    Object.defineProperty(value,'visibleBounds',{get(){
      stats.boundsReads++;
      if(options.invalidDocumentBounds)return [NaN,0,0,0];
      let result=null;
      function visit(parent){for(const item of parent.items){const b=item.visibleBounds;if(b){if(!result)result=b.slice();else{result[0]=Math.min(result[0],b[0]);result[1]=Math.max(result[1],b[1]);result[2]=Math.max(result[2],b[2]);result[3]=Math.min(result[3],b[3]);}}if(item.items)visit(item);}}
      for(const layer of value.layers.items)visit(layer);return result||[0,0,0,0];
    }});
    Object.defineProperty(value,'pageItems',{get(){stats.pageItemReads++;if(options.forbidPageItemScan)throw new Error('Document item scans are forbidden');const all=[];function visit(parent){for(const item of parent.items){if(item.visibleBounds)all.push(item);if(item.items)visit(item);}}for(const layer of value.layers.items)visit(layer);return all;}});value.imageCapture=(file,bounds,captureOptions)=>{ pngs.add(file.name); captures.push({file,bounds:bounds.slice(),options:captureOptions,doc:value,visibleLayers:value.layers.items.filter(l=>l.visible)}); if(options.exportFailure)throw new Error('Injected PNG export failure'); }; documents.push(value); return value;
  }
  const app = { documents, activeDocument: null, version: '27.9', coordinateSystem: 'artboard', startupPresetsList:['Web','Print'], redraws:0,activations:0,visibleAdds:0,undos:0,undo(){this.undos++;},redraw() {this.redraws++;} };
  documents.add = (colorSpace) => { app.visibleAdds++;const value=doc(colorSpace); app.activeDocument=value; return value; };
  function hiddenDoc(preset){const value=doc(options.noUIIgnoresPreset?'RGB':preset==='Print'?'CMYK':'RGB');value.background=true;value.closeNoUI=()=>{value.closedWithoutUI=true;value.close();};backgroundDocs.push(value);return value;}
  if(!options.noBackgroundAPI)documents.addDocumentNoUI=hiddenDoc;
  if(options.dialogFactory)documents.addDocumentWithDialogOption=(preset,show)=>{assert.equal(show,false);return hiddenDoc(preset);};
  const original=doc(options.colorSpace||'RGB'); app.activeDocument=original;
  const source=symbol(original.activeLayer); original.selection=[source];
  context=vm.createContext({ app, File, Folder, ImageCaptureOptions: function(){}, ExportOptionsPNG24: function(){}, ExportType: {PNG24:'png'}, CoordinateSystem: {DOCUMENTCOORDINATESYSTEM: 'document'}, SaveOptions: { DONOTSAVECHANGES: 0 }, Transformation: { CENTER: 0 }, ElementPlacement: { PLACEATEND: 'end', PLACEATBEGINNING: 'front' } });
  const entry=path.join(root,'extension/host/main.jsx');
  context.$ = { fileName: options.missingFilename ? '' : entry, global: context,
    evalFile(file) { vm.runInContext(fs.readFileSync(file.name,'utf8'),context); } };
  if (options.missingFilename) context.SeamlessMakerExtensionPath=path.join(root,'extension');
  vm.runInContext(fs.readFileSync(entry,'utf8'),context);
  function dispatch(request) { return JSON.parse(context.SeamlessMaker.dispatch(JSON.stringify(request))); }
  function call(request) { const result=dispatch(request); if (!result.ok) throw new Error(result.error); return result.data; }
  const captured=call({action:'capture'});
  return {call,dispatch,captured,source,original,documents,captures,pngs,app,backgroundDocs,stats,failDuplicate() { failingDuplicate=true; }};
}

test('actual host initializes from explicit CEP path even when $.fileName is unavailable', () => {
  const f=fixture({missingFilename:true});
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  assert.equal(prepared.exceeded,false);assert.ok(prepared.count>0);
  const created=f.call({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings:defaults});
  assert.equal(created.count,prepared.count);
});

test('SymbolItem without a matrix property can preview and create linked artwork', () => {
  const f=fixture();assert.equal(f.source.matrix,undefined);
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  const created=f.call({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings:defaults});
  assert.equal(created.count,prepared.count);assert.ok(created.count>0);
});

test('SymbolItem whose matrix getter throws can preview and create linked artwork', () => {
  const f=fixture({matrixMode:'throws'});assert.throws(()=>f.source.matrix,/Unsupported property/);
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  const created=f.call({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings:defaults});
  assert.equal(created.count,prepared.count);
});

test('unreadable source error retains its underlying cause instead of claiming deletion', () => {
  const f=fixture();Object.defineProperty(f.source,'visibleBounds',{get(){throw new Error('Injected bounds error');}});
  const result=f.dispatch({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  assert.equal(result.ok,false);assert.match(result.error,/Cannot read the source symbol: Injected bounds error/);
});

test('host captures in the original document, caches PNG and forces refresh', () => {
  const f=fixture(), args={action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults};
  const result=f.call(args);
  assert.equal(f.documents.length,1); assert.equal(f.app.activeDocument,f.original);
  assert.equal(f.app.coordinateSystem,'artboard');
  assert.equal(f.original.layers.items.length,1); assert.equal(f.original.activeLayer.items.length,1);
  assert.equal(f.captures.length,1); assert.equal(f.captures[0].doc,f.original);
  assert.match(result.image.uri,/^file:\/\/\/C:\/Temp/);
  f.call({...args,settings:{...defaults,rows:4}}); assert.equal(f.captures.length,1);
  f.call({...args,refresh:true}); assert.equal(f.captures.length,2);
  f.call({action:'release'}); assert.equal(f.pngs.size,0);
});

test('create preserves source and linkage, positions and stacking match preview, clipping is exact', () => {
  const f=fixture(); const bounds=f.source.visibleBounds.slice();
  const settings={...defaults,scale:150,rotation:30};
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings});
  const result=f.call({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings});
  assert.deepEqual(f.source.visibleBounds,bounds); assert.equal(f.original.layers.items.length,2);
  const group=f.original.layers.items[0].items[0];
  assert.equal(group.clipped,true); assert.equal(group.name,'Seamless Repeat');
  const mask=group.items[0]; assert.equal(mask.clipping,true); assert.deepEqual(mask.visibleBounds,[20,150,120,70]);
  const points=require('../extension/shared/repeat').plan(settings,prepared.image).points;
  const copies=group.items.slice(1).reverse(); // Illustrator index zero is the frontmost object.
  assert.equal(copies.length,result.count);
  copies.forEach((copy,i)=> { assert.equal(copy.symbol,f.source.symbol); const b=copy.visibleBounds;
    assert.ok(Math.abs((b[0]+b[2])/2-(20+points[i].x))<1e-8);
    assert.ok(Math.abs((b[1]+b[3])/2-(150-points[i].y))<1e-8);
  });
});

test('stale source/artboard/document/settings refuse creation without modifying original', () => {
  for (const mutation of ['source','board','doc','settings']) {
    const f=fixture(), settings={...defaults};
    const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings});
    if(mutation==='source') f.source.translate(1,0);
    if(mutation==='board') f.original.artboards[0].artboardRect[0]+=1;
    if(mutation==='doc') f.app.activeDocument={};
    if(mutation==='settings') settings.rows+=1;
    const result=f.dispatch({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings});
    assert.equal(result.ok,false,mutation); assert.equal(f.original.layers.items.length,1);
  }
});

test('create failure removes only its own layer and restores original selection/layer', () => {
  const f=fixture(); const layer=f.original.activeLayer, selection=f.original.selection;
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  f.failDuplicate();
  const result=f.dispatch({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings:defaults});
  assert.equal(result.ok,false); assert.match(result.error,/Injected/);
  assert.equal(f.original.layers.items.length,1); assert.equal(f.original.activeLayer,layer); assert.equal(f.original.selection,selection);
});

test('host refuses bad selection and enforces instance limit independently', () => {
  const f=fixture(); f.original.selection=[];
  assert.equal(f.dispatch({action:'capture'}).ok,false);
  f.original.selection=[f.source];
  const settings={...defaults,rows:101,columns:101};
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings});
  assert.equal(prepared.exceeded,true);
  assert.equal(f.dispatch({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings}).ok,false);
  assert.equal(f.original.layers.items.length,1);
});

test('large-symbol capture respects the minimum 72 PPI and legacy canvas limit', () => {
  const f=fixture();f.source.resize(20000,20000);
  const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  const capture=f.captures[0];assert.equal(capture.options.resolution,72);
  assert.ok(Math.max(prepared.image.width+2*prepared.image.padding,prepared.image.height+2*prepared.image.padding)<=16383);
});

test('host creates both tilted lattice modes at preview centers with linked symbols and exact clipping', () => {
  for(const mode of ['all','vertical']) {
    const f=fixture(), original=f.source.visibleBounds.slice();
    const settings={...defaults,mode,layout:'lattice',rowShift:1,rowCycles:2,columnShift:-2,horizontalX:23,horizontalY:6,rotation:27,scale:145};
    const prepared=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings});
    const plan=require('../extension/shared/repeat').plan(prepared.settings,prepared.image);
    const result=f.call({action:'create',sourceToken:f.captured.sourceToken,previewToken:prepared.previewToken,settings});
    const group=f.original.layers.items[0].items[0], copies=group.items.slice(1).reverse();
    assert.equal(result.count,plan.count);assert.equal(copies.length,plan.points.length);
    assert.deepEqual(group.items[0].visibleBounds,[20,150,120,70]);assert.equal(group.clipped,true);
    copies.forEach((copy,i)=>{const b=copy.visibleBounds,p=plan.points[i];assert.equal(copy.symbol,f.source.symbol);
      assert.ok(Math.abs((b[0]+b[2])/2-(20+p.x))<1e-8);assert.ok(Math.abs((b[1]+b[3])/2-(150-p.y))<1e-8);
    });
    assert.deepEqual(f.source.visibleBounds,original);assert.equal(f.documents.length,1);
  }
});

test('in-document preview isolates artwork and restores layers, selection, bounds and artboards',()=>{
  for(const colorSpace of ['RGB','CMYK']){
    const f=fixture({colorSpace}),rect=f.original.artboards[0].artboardRect.slice(),selection=f.original.selection,layer=f.original.activeLayer,bounds=f.source.visibleBounds.slice();
    layer.locked=true;
    f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
    assert.equal(f.app.visibleAdds,0);assert.equal(f.app.redraws,2);assert.equal(f.app.undos,0);
    assert.equal(f.app.activeDocument,f.original);assert.equal(f.documents.length,1);
    assert.deepEqual(f.original.artboards[0].artboardRect,rect);assert.deepEqual(f.source.visibleBounds,bounds);
    assert.equal(f.original.selection,selection);assert.equal(f.original.activeLayer,layer);assert.equal(f.original.layers.items.length,1);
    assert.equal(layer.visible,true);assert.equal(layer.locked,true);
    assert.equal(f.captures[0].doc,f.original);const b=f.captures[0].bounds;
    assert.ok(b[0]>bounds[2] || b[2]<bounds[0] || b[3]>bounds[1] || b[1]<bounds[3]);assert.equal(f.backgroundDocs.length,0);
  }
});

test('capture failure removes temporary content and PNG and restores original state',()=>{
  for(const option of ['exportFailure','previewDuplicateFailure']){
    const f=fixture({[option]:true}),rect=f.original.artboards[0].artboardRect.slice(),selection=f.original.selection,layer=f.original.activeLayer;
    const result=f.dispatch({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
    assert.equal(result.ok,false);assert.match(result.error,/Injected/);
    assert.equal(f.documents.length,1);assert.equal(f.pngs.size,0);assert.equal(f.app.activeDocument,f.original);
    assert.deepEqual(f.original.artboards[0].artboardRect,rect);assert.equal(f.original.layers.items.length,1);
    assert.equal(layer.visible,true);assert.equal(f.original.selection,selection);assert.equal(f.original.activeLayer,layer);assert.equal(f.app.undos,0);
  }
});

test('canvas validation fails before starting a document transaction',()=>{
  const f=fixture();f.source.resize(100000,100000);
  const result=f.dispatch({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  assert.equal(result.ok,false);assert.match(result.error,/canvas limit/);assert.equal(f.app.undos,0);assert.equal(f.app.visibleAdds,0);
});

test('complete native bounds isolate item 151 and nested artwork without scanning pageItems',()=>{
  const f=fixture({forbidPageItemScan:true}),layer=f.original.activeLayer;
  for(let i=0;i<149;i++)layer.items.push({visibleBounds:[2,35,20,23]});
  const outside={visibleBounds:[0,22,23,0]},nested={items:[{visibleBounds:[-80,200,-40,-100]}]};
  layer.items.push(outside,nested);
  Object.defineProperty(layer,'pageItems',{get(){throw new Error('Per-layer DOM scans are forbidden');}});
  const result=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  assert.ok(result.image.uri);assert.equal(f.stats.boundsReads,1);assert.equal(f.stats.pageItemReads,0);assert.equal(f.app.undos,0);assert.equal(f.app.visibleAdds,0);
  const b=f.captures[0].bounds;
  for(const a of [outside.visibleBounds,nested.items[0].visibleBounds])assert.ok(b[0]>=a[2]||b[2]<=a[0]||b[1]<=a[3]||b[3]>=a[1]);
  f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:{...defaults,rows:4}});
  assert.equal(f.stats.boundsReads,1,'layout changes must reuse cached PNG and bounds');
});

test('50,000-item preview uses one native bounds query and keeps prior redraw count',()=>{
  const f=fixture({forbidPageItemScan:true}),layer=f.original.activeLayer;
  for(let i=0;i<50000;i++)layer.items.push({visibleBounds:[i%100,100,i%100+1,99]});
  f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  assert.equal(f.stats.boundsReads,1);assert.equal(f.stats.pageItemReads,0);assert.equal(f.app.redraws,2);assert.equal(f.app.undos,0);
  assert.equal(f.original.layers.items.length,1);assert.equal(f.documents.length,1);
});

test('cleanup failure invalidates previous preview and never marks a dirty document as saved',()=>{
  const f=fixture();const first=f.call({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  let dirty=false,savedRestores=0;Object.defineProperty(f.original,'saved',{get(){return !dirty;},set(v){if(v)savedRestores++;dirty=!v;}});
  const add=f.original.layers.add;f.original.layers.add=function(){dirty=true;const layer=add.call(this);layer.remove=()=>{throw new Error('Injected cleanup failure');};return layer;};
  const result=f.dispatch({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults,refresh:true});
  assert.equal(result.ok,false);assert.match(result.error,/cleanup failed/);assert.equal(savedRestores,0);assert.equal(f.original.saved,false);
  assert.equal(f.original.layers.items.length,2);assert.equal(f.pngs.size,1,'partial PNG is removed, prior cached image retained');
  const created=f.dispatch({action:'create',sourceToken:f.captured.sourceToken,previewToken:first.previewToken,settings:defaults});
  assert.equal(created.ok,false);assert.match(created.error,/cleanup failed/);assert.equal(f.app.undos,0);
  assert.equal(f.dispatch({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults}).ok,false);
});

test('invalid native bounds fail closed before temporary artwork is created',()=>{
  const f=fixture({invalidDocumentBounds:true});const result=f.dispatch({action:'prepare',sourceToken:f.captured.sourceToken,settings:defaults});
  assert.equal(result.ok,false);assert.match(result.error,/bounds are invalid/);assert.equal(f.original.layers.items.length,1);assert.equal(f.captures.length,0);assert.equal(f.app.undos,0);
});
