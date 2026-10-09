/* Real-host regression: preview isolation, saved state and previous Undo. */
(function(){
 var root=File($.fileName).parent.parent, previous=app.documents.length?app.activeDocument:null,d=null,lines=[],passed=0;
 function check(ok,label){if(!ok)throw new Error(label);passed++;lines.push('PASS: '+label);}
 function call(a){var r=SeamlessJSON.parse(SeamlessMaker.dispatch(SeamlessJSON.stringify(a)));if(!r.ok)throw new Error(r.error);return r.data;}
 try{
  var outputFolder=Folder(root+'/artifacts');if(!outputFolder.exists)outputFolder.create();
  $.global.SeamlessMakerExtensionPath=root+'/extension';$.evalFile(File(root+'/extension/host/main.jsx'));
  for(var space=0;space<2;space++){
   d=app.documents.add(space?DocumentColorSpace.CMYK:DocumentColorSpace.RGB,100,100);
   var art=d.pathItems.rectangle(60,30,24,18),red=new RGBColor();red.red=255;red.green=30;red.blue=30;art.fillColor=red;art.stroked=false;
   var definition=d.symbols.add(art);art.remove();var source=d.symbolItems.add(definition),sourceLayer=d.activeLayer;
   var background=d.layers.add(),blue=new RGBColor();blue.red=0;blue.green=0;blue.blue=255;var backdrop=background.pathItems.rectangle(100,0,100,100);backdrop.fillColor=blue;backdrop.stroked=false;background.locked=true;
   var hidden=d.layers.add();hidden.visible=false;hidden.locked=true;d.activeLayer=sourceLayer;
   d.selection=null;source.selected=true;d.saveAs(File(root+'/artifacts/preview-state-'+space+'.ai'));app.redraw();
   var captured=call({action:'capture'}),before=SeamlessJSON.stringify(source.visibleBounds),docs=app.documents.length;
   var settings={sizeMode:'custom',width:100,height:100,columns:2,rows:2,scale:100,rotation:0,mode:'all',layout:'grid',offsetX:0,offsetY:0};
   var p=call({action:'prepare',sourceToken:captured.sourceToken,settings:settings,refresh:true});
   check(d.saved,'Saved status unchanged '+space);check(app.documents.length===docs && app.activeDocument===d,'No preview document opened '+space);
   check(d.layers.length===3 && background.visible && background.locked && !hidden.visible && hidden.locked,'Visible/hidden/locked layers restored '+space);
   check(d.selection.length===1 && d.selection[0]===source && d.activeLayer===sourceLayer,'Selection and active layer restored '+space);
   check(SeamlessJSON.stringify(source.visibleBounds)===before,'Source unchanged '+space);
   lines.push('PNG '+p.image.uri);var imageFile=File(decodeURI(p.image.uri.replace('file:///','')));imageFile.copy(root+'/artifacts/preview-isolated-'+space+'.png');
   source.translate(7,0);app.redraw();var moved=SeamlessJSON.stringify(source.visibleBounds);
   call({action:'prepare',sourceToken:captured.sourceToken,settings:settings,refresh:true});
   check(!d.saved && SeamlessJSON.stringify(source.visibleBounds)===moved,'Previous unsaved edit retained '+space);
   app.undo();check(SeamlessJSON.stringify(source.visibleBounds)===before,'Undo targets previous user edit '+space);
   app.redo();check(SeamlessJSON.stringify(source.visibleBounds)===moved,'Redo restores previous user edit '+space);
   call({action:'release'});d.close(SaveOptions.DONOTSAVECHANGES);d=null;
  }
  lines.push('SUCCESS: '+passed+' checks passed.');
 }catch(e){lines.push('FAIL: '+e+' line '+e.line);}finally{if(d)d.close(SaveOptions.DONOTSAVECHANGES);if(previous)app.activeDocument=previous;var f=File(root+'/artifacts/preview-state-report.txt');f.open('w');f.write(lines.join('\n'));f.close();}
}());

