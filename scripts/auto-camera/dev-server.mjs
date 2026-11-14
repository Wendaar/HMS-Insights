// Isolated loopback demo: in-memory sessions, no database, no production credentials.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createVirtualCameraHandler} from '../../src/web/virtual-camera-handler.js';
import {cameraCSP} from '../../public/virtual-camera/policy.js';
const rows=new Map(),root=resolve('public'),port=Number(process.env.PORT??3015);
const store={async create(id,edit_hash,read_hash,state){const row={id,edit_hash,read_hash,state,revision:1,operator_at:0,output_at:0,output_status:'Neznámý'};rows.set(id,row);return row;},async get(id){return rows.get(id);},async update(id,hash,revision,state,now){const row=rows.get(id);if(!row||row.edit_hash!==hash||row.revision!==revision)return;Object.assign(row,{state,revision:revision+1,operator_at:now});return row;},async touch(id,hash,role,now,status){const row=rows.get(id);if(!row||row[role==='edit'?'edit_hash':'read_hash']!==hash)return;if(role==='edit')row.operator_at=now;else{row.output_at=now;row.output_status=status;}return row;}};
const handler=createVirtualCameraHandler({store});
http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1:'+port);
 if(u.pathname==='/api/virtual-camera'){
  let data='';for await(const chunk of req){data+=chunk;if(data.length>14000){res.writeHead(413);res.end();return;}}
  req.query=Object.fromEntries(u.searchParams);req.body=data||{};
  res.status=code=>{res.statusCode=code;return res;};res.json=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));return res;};await handler(req,res);return;
 }
 let path=decodeURIComponent(u.pathname);if(path==='/')path='/virtual-camera/';if(path==='/virtual-camera'||path==='/virtual-camera/')path='/virtual-camera/index.html';if(path==='/virtual-camera/output')path='/virtual-camera/output.html';
 const file=resolve(root,'.'+path);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
 const type={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[extname(file)]??'application/octet-stream';
 const data=await readFile(file);res.setHeader('Content-Type',type);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',cameraCSP);res.end(data);
 }catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Local isolated camera: http://127.0.0.1:'+port+'/virtual-camera/'));
