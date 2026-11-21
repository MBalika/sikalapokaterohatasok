/* Sortörés-mérő: a ténylegesen megjelenített sorvégeket és kilógásokat gyűjti ki egy gyökérelem alatt. */
window.__scan = function(rootSel){
  const root = typeof rootSel==='string' ? document.querySelector(rootSel) : rootSel;
  if(!root) return {breaks:[],overflows:[],blocks:0};
  const SVGNS='http://www.w3.org/2000/svg';
  const SKIP=new Set(['SCRIPT','STYLE','TEXTAREA','INPUT','SELECT','OPTION','NOSCRIPT','CANVAS','TITLE']);
  const disp=new Map(), ovx=new Map();
  const isBlock=el=>{let d=disp.get(el);if(d===undefined){d=getComputedStyle(el).display;disp.set(el,d);}return !(d==='inline'||d==='contents');};
  const scrollBox=el=>{for(let p=el;p&&p.nodeType===1;p=p.parentElement){let o=ovx.get(p);if(o===undefined){const cs=getComputedStyle(p);o=(cs.overflowX==='auto'||cs.overflowX==='scroll')?'scroll':(cs.overflowX==='hidden'||cs.overflowX==='clip')&&p!==document.body&&p!==document.documentElement?'clip':'';ovx.set(p,o);}if(o)return {el:p,kind:o};}return null;};
  const path=el=>{const parts=[];for(let p=el;p&&p.nodeType===1&&parts.length<5;p=p.parentElement){let s=p.tagName.toLowerCase();if(p.id){s+='#'+p.id;parts.unshift(s);break;}if(p.classList.length)s+='.'+[...p.classList].slice(0,2).join('.');parts.unshift(s);}return parts.join('>');};
  /* szöveg + jelölők blokkonként: '\n' = <br> vagy beágyazott blokk határa, '\uFFFC' = kihagyott elem (svg, input…) */
  const groups=new Map();
  const blockOf=el=>{for(let p=el;p&&p.nodeType===1;p=p.parentElement){if(isBlock(p))return p;if(p===root)return root;}return root;};
  const add=(blk,item)=>{if(!groups.has(blk))groups.set(blk,[]);groups.get(blk).push(item);};
  (function walk(el){
    for(let n=el.firstChild;n;n=n.nextSibling){
      if(n.nodeType===3){add(blockOf(el),n);continue;}
      if(n.nodeType!==1)continue;
      if(SKIP.has(n.tagName)||n.namespaceURI===SVGNS){add(blockOf(el),'\uFFFC');continue;}
      if(n.tagName==='BR'){add(blockOf(el),'\n');continue;}
      if(isBlock(n)){add(blockOf(el),'\n');walk(n);add(blockOf(el),'\n');continue;}
      walk(n);
    }
  })(root);
  const rg=document.createRange(), vw=document.documentElement.clientWidth;
  const breaks=[],overflows=[];
  const fsCache=new Map(); const fsOf=el=>{let v=fsCache.get(el);if(v===undefined){v=parseFloat(getComputedStyle(el).fontSize);fsCache.set(el,v);}return v;};
  const holes=[];
  for(const [blk,nodes] of groups){
    let text='',pts=[],sp=[];
    const just=getComputedStyle(blk).textAlign==='justify';
    for(const nd of nodes){
      if(typeof nd==='string'){text+=nd;continue;}
      const v=nd.nodeValue;
      for(let i=0;i<v.length;i++){
        const ch=v[i],idx=text.length+i;
        if(ch===' '||ch==='\u00a0'){
          if(just){rg.setStart(nd,i);rg.setEnd(nd,i+1);const rs=rg.getClientRects();if(rs.length&&rs[0].width>0)sp.push({i:idx,w:rs[0].width,t:rs[0].top,fs:fsOf(nd.parentElement)});}
          continue;
        }
        if(/\s/.test(ch)||ch==='\u202f'||ch==='\u2060')continue;
        rg.setStart(nd,i);rg.setEnd(nd,i+1);
        const rs=rg.getClientRects();if(!rs.length)continue;
        const r=rs[rs.length-1];if(r.width===0&&(r.height===0||ch==='\u00ad'))continue;
        pts.push({i:idx,l:r.left,t:r.top,r:r.right,h:r.height,nd});
      }
      text+=v;
    }
    if(!pts.length)continue;
    const brs=[];
    let ovDone=false;
    for(let k=0;k<pts.length;k++){
      const c=pts[k];
      if(k>0){const p=pts[k-1];
        if(c.t>p.t+Math.max(4,p.h*0.5)&&c.l<p.l-2){
          const gap=text.slice(p.i+1,c.i);
          const type=/[\n\uFFFC]/.test(gap)?'hard':/\u200b/.test(gap)?'space':(text[p.i]==='\u00ad'||gap.indexOf('\u00ad')>=0)?'shy':/[ \t\r]/.test(gap)?'space':(gap.length===0||/^[⁠]*$/.test(gap))?(/[-–—\/‑]/.test(text[p.i])?'hyph':'emerg'):'nbsp';
          if(blk.__lc===undefined){const cs=getComputedStyle(blk),fs=parseFloat(cs.fontSize)||16,cw=blk.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);blk.__lc=cw>0?cw/(0.52*fs):80;}
          breaks.push({blk:path(blk),text,p:p.i,c:c.i,type,lc:blk.__lc});brs.push({p:p.i,c:c.i,type});
        }
      }
      if(!ovDone){
        const sb=scrollBox(c.nd.parentElement);
        let lim=vw, kind='page';
        if(sb){const br=sb.el.getBoundingClientRect();lim=Math.min(vw,br.right);kind=sb.kind;}
        if(c.r>lim+1.5){overflows.push({blk:path(blk),text:text.slice(Math.max(0,c.i-40),c.i+20),kind,by:Math.round(c.r-lim)});ovDone=true;}
      }
    }
    if(just&&sp.length&&brs.length){
      /* sorhatárok: a sor az előző törés c-jétől a következő törés p-jéig tart; az utolsó sor és a kemény törés előtti sor nem sorkizárt */
      let st=pts[0].i;
      for(let b=0;b<brs.length;b++){
        const br=brs[b];
        if(br.type!=='hard'){
          const ws=sp.filter(x=>x.i>st&&x.i<br.p);
          if(ws.length){const mx=ws.reduce((a,x)=>x.w>a.w?x:a,ws[0]);const r=mx.w/mx.fs;
            if(r>=0.6)holes.push({blk:path(blk),ratio:Math.round(r*100)/100,n:ws.length,line:text.slice(st,br.p+1).replace(/\s+/g,' ').slice(0,90),next:text.slice(br.c,br.c+40).replace(/\s+/g,' ')});}
        }
        st=br.c;
      }
    }
  }
  return {breaks,overflows,holes,blocks:groups.size};
};
