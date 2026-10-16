const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script=fs.readFileSync(require('node:path').join(__dirname,'../extension/js/bridge.js'),'utf8');
test('bridge serializes calls and escapes host payloads without code injection', () => {
  const calls=[], callbacks=[];
  const window={__adobe_cep__:{evalScript(code,callback){calls.push(code); callbacks.push(callback);}}};
  vm.runInNewContext(script,{window});
  const results=[];
  const dangerous='Symbol ");throw new Error("injected"); // \u2028\u2029';
  window.SeamlessBridge.call({action:'prepare',name:dangerous},(e,d)=>results.push([e,d]));
  window.SeamlessBridge.call({action:'inspect'},(e,d)=>results.push([e,d]));
  assert.equal(calls.length,1);
  let decoded;
  vm.runInNewContext(calls[0],{$:{global:{SeamlessMaker:{version:'1.1.10',dispatch(payload){decoded=JSON.parse(payload);}}}}});
  assert.equal(decoded.name,dangerous);
  callbacks[0]('{"ok":true,"data":{"count":7}}');
  assert.equal(calls.length,2); assert.equal(results[0][0],null); assert.equal(results[0][1].count,7);
  callbacks[1]('{"ok":false,"error":"No document"}');
  assert.match(results[1][0].message,/No document/);
});

test('bridge bootstraps missing host from the actual CEP extension folder and reuses the session', () => {
  const loads=[], dispatched=[];
  const hostGlobal={};
  const hostContext={ $:{ global:hostGlobal, evalFile(file) {
    loads.push(file.fsName);
    hostGlobal.SeamlessMaker={version:'1.1.10',dispatch(payload) {
      dispatched.push(JSON.parse(payload));return '{"ok":true,"data":{"ready":true}}';
    }};
  }}, File(name){return {exists:true,fsName:name};} };
  const window={__adobe_cep__:{getSystemPath(type){assert.equal(type,'extension');return 'file:///C:/Panel%20Folder/Seamless%20Maker';},evalScript(code,callback){callback(vm.runInNewContext(code,hostContext));}}};
  vm.runInNewContext(script,{window});
  let result;
  window.SeamlessBridge.call({action:'inspect'},(error,data)=>{assert.equal(error,null);result=data;});
  window.SeamlessBridge.call({action:'capture'},error=>assert.equal(error,null));
  assert.deepEqual(loads,['C:/Panel Folder/Seamless Maker/host/main.jsx']);
  assert.equal(hostGlobal.SeamlessMakerExtensionPath,'C:/Panel Folder/Seamless Maker');
  assert.equal(result.ready,true);assert.deepEqual(dispatched,[{action:'inspect'},{action:'capture'}]);
});

test('bridge reloads obsolete host versions and reports initialization errors with their cause', () => {
  let loads=0;
  const hostGlobal={SeamlessMaker:{version:'1.0.0'}};
  const hostContext={$:{global:hostGlobal,evalFile(){loads++;throw new Error('Missing shared module: repeat.js');}},File(name){return {exists:true,fsName:name};}};
  const window={__adobe_cep__:{getSystemPath(){return 'C:\\Extensions\\SeamlessMaker';},evalScript(code,callback){callback(vm.runInNewContext(code,hostContext));}}};
  vm.runInNewContext(script,{window});
  let error;window.SeamlessBridge.call({action:'inspect'},e=>error=e);
  assert.equal(loads,1);assert.match(error.message,/Host initialization failed: Missing shared module: repeat.js/);
});

test('bridge reports a missing host file without invoking any script', () => {
  const hostContext={$:{global:{},evalFile(){throw new Error('must not run');}},File(name){return {exists:false,fsName:name};}};
  const window={__adobe_cep__:{getSystemPath(){return 'C:/Panel';},evalScript(code,callback){callback(vm.runInNewContext(code,hostContext));}}};
  vm.runInNewContext(script,{window});
  let error;window.SeamlessBridge.call({action:'capture'},e=>error=e);
  assert.match(error.message,/Missing host script: C:\/Panel\/host\/main.jsx/);
});
test('bridge reports missing CEP and malformed host responses', () => {
  const window={}; vm.runInNewContext(script,{window});
  let error; window.SeamlessBridge.call({action:'inspect'},e=>error=e); assert.match(error.message,/Open this panel in Illustrator/);
  window.__adobe_cep__={evalScript(code,callback){callback('EvalScript error.');}};
  window.SeamlessBridge.call({action:'inspect'},e=>error=e); assert.match(error.message,/Cannot connect/);
});


