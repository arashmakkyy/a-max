/* A.max 1.2 - Actual DOCX, downloadable PDF, multipage PNG, safe structured exports. MIT. */
(function (global) {
  'use strict';
  const A = global.AMTool, E = A.exporters, original = { ...E };
  const esc = x => String(x == null ? '' : x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const validRole = x => ['user','assistant','system','tool','unknown'].includes(x) ? x : 'unknown';
  const roleLabel = r => ({user:'کاربر / User',assistant:'دستیار / Assistant',system:'سیستم / System',tool:'ابزار / Tool',unknown:'نامشخص / Unknown'})[validRole(r)];
  const stamp = m => m.sentAt || (m.timestamp && /\d{4}-\d{2}-\d{2}T/.test(m.timestamp) ? m.timestamp : null);
  const save = (blob, name) => {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000); return name;
  };
  const nameFor = (chat, ext, cfg) => E.buildExportFilename(chat, ext, cfg.exportFilenameFormat);
  function clean(chat) {
    return { ...chat, messages: (chat.messages || []).map((m,i) => ({ ...m,
      id: m.id || 'msg_'+(i+1), role: validRole(m.role), content: String(m.content || m.markdown || ''), sentAt: stamp(m), capturedAt: m.capturedAt || chat.capturedAt || null
    })) };
  }
  function toSafeJSON(chat, cfg) {
    chat=clean(chat);
    return JSON.stringify({schemaVersion:2,generator:'A.max',author:'Arash Makki',exportedAt:new Date().toISOString(),
      platformId:chat.platformId||'unknown',platformName:chat.platformName||'Unknown',title:chat.title||'Conversation',
      sourceUrl:cfg.includeSourceUrl ? (chat.sourceUrl||chat.url||null) : undefined,
      capturedAt:chat.capturedAt||null,extractionStatus:chat.extractionStatus||'unknown',messageCount:chat.messages.length,
      messages:chat.messages.map((m,i)=>({index:i+1,id:m.id,role:m.role,content:m.content,markdown:m.markdown||m.content,
        sentAt:cfg.showMessageTimestamp?m.sentAt:undefined,capturedAt:m.capturedAt,
        thinking:cfg.includeThinkingContent&&m.thinking?m.thinking:undefined}))},null,2);
  }
  function toSafeCSV(chat,cfg) {
    const row = x => '"'+String(x ?? '').replace(/"/g,'""')+'"';
    // Explicit text prefix protects Excel against CSV formula injection; strip controls for dangerous leading chars.
    const cell = x => { let v=String(x??'');if (/^[\s\uFEFF]*[=+@\-\t\r]/.test(v)) v="'"+v; return row(v); };
    const rows=[['Index','MessageId','Role','Platform','SentAt','Content','SourceUrl']];
    clean(chat).messages.forEach((m,i)=>rows.push([i+1,m.id,m.role,chat.platformName||'',cfg.showMessageTimestamp?m.sentAt||'':'',m.content,cfg.includeSourceUrl?chat.url||'':'']));
    return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
  }
  function plain(chat,cfg) {
    const lines=[chat.title||'Conversation',chat.platformName||'AI',''];
    clean(chat).messages.forEach((m,i)=>{
      lines.push(`${i+1}. [${roleLabel(m.role)}]${cfg.showMessageTimestamp&&m.sentAt?' · '+m.sentAt:''}`);
      if (cfg.includeThinkingContent && m.thinking) lines.push('[Thinking]',m.thinking);
      lines.push(m.content,'');
    });
    if(cfg.appendBranding)lines.push(cfg.customBrandingText||'Created with A.max — Arash Makki');
    return lines.join('\n');
  }
  function safeMarkdown(chat,cfg) {
    const lines=['# '+(chat.title||'AI Conversation'),''];
    if(cfg.includeSourceUrl && chat.url && /^https?:\/\//i.test(chat.url)) lines.push('Source: '+chat.url,'');
    clean(chat).messages.forEach((m,i)=>{
      lines.push('## '+(i+1)+'. '+roleLabel(m.role)+(cfg.showMessageTimestamp&&m.sentAt?' — '+m.sentAt:''),'');
      if(cfg.includeThinkingContent&&m.thinking)lines.push('> Thinking: '+m.thinking.replace(/\n/g,'\n> '),'');
      lines.push(m.markdown||m.content,'','---','');
    });
    if(cfg.appendBranding)lines.push('*'+(cfg.customBrandingText||'A.max — Arash Makki')+'*');
    return lines.join('\n');
  }
  E.toJSON=(chat,cfg={})=>toSafeJSON(chat,{...A.storage.DEFAULT_SETTINGS,...cfg});
  E.toCSV=(chat,cfg={})=>toSafeCSV(chat,{...A.storage.DEFAULT_SETTINGS,...cfg});
  E.toPlainText=(chat,cfg={})=>plain(chat,{...A.storage.DEFAULT_SETTINGS,...cfg});
  E.toMarkdown=(chat,cfg={})=>safeMarkdown(chat,{...A.storage.DEFAULT_SETTINGS,...cfg});
  E.exportJSON=async(c,s={})=>{const cfg={...await A.storage.getSettings(),...s};return save(new Blob([toSafeJSON(c,cfg)],{type:'application/json;charset=utf-8'}),nameFor(c,'json',cfg));};
  E.exportCSV=async(c,s={})=>{const cfg={...await A.storage.getSettings(),...s};return save(new Blob([toSafeCSV(c,cfg)],{type:'text/csv;charset=utf-8'}),nameFor(c,'csv',cfg));};
  E.exportText=async(c,s={})=>{const cfg={...await A.storage.getSettings(),...s};return save(new Blob(['\uFEFF'+plain(c,cfg)],{type:'text/plain;charset=utf-8'}),nameFor(c,'txt',cfg));};
  E.exportMarkdown=async(c,s={})=>{const cfg={...await A.storage.getSettings(),...s};return save(new Blob(['\uFEFF'+safeMarkdown(c,cfg)],{type:'text/markdown;charset=utf-8'}),nameFor(c,'md',cfg));};
  // DOCX: real Office Open XML package, no HTML disguised as a .docx file.
  function wText(s) {return `<w:r><w:rPr><w:rtl/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:t xml:space="preserve">${esc(s)}</w:t></w:r>`;}
  function paragraph(s,kind='body') {
    const isRTL=/[\u0600-\u06FF]/.test(s);const styles={title:36,h1:30,h2:25,body:22,meta:19};
    const ppr=`<w:pPr><w:bidi w:val="${isRTL?1:0}"/><w:spacing w:after="140" w:line="310" w:lineRule="auto"/><w:jc w:val="${isRTL?'right':'left'}"/></w:pPr>`;
    const rpr=(kind==='title'||kind==='h1'||kind==='h2')?`<w:rPr><w:b/><w:sz w:val="${styles[kind]}"/><w:szCs w:val="${styles[kind]}"/></w:rPr>`:'';
    return `<w:p>${ppr}${rpr}${wText(s)}</w:p>`;
  }
  function markdownToWord(md) {
    let inCode=false;
    return String(md||'').split(/\r?\n/).map(line=>{
      if(/^```/.test(line)){inCode=!inCode;return paragraph(line,'meta');}
      if(!inCode&&/^#{1,3}\s/.test(line))return paragraph(line.replace(/^#+\s/,''),'h2');
      if(!inCode&&/^[-*]\s/.test(line))return paragraph('• '+line.slice(2));
      return paragraph(line);
    }).join('');
  }
  E.exportWordDocx=async(chat,s={})=>{
    const cfg={...await A.storage.getSettings(),...s};
    if(typeof JSZip==='undefined') throw new Error('DOCX ZIP dependency unavailable');
    const zip=new JSZip();
    const paragraphs=[paragraph(chat.title||'AI Conversation','title'),paragraph(chat.platformName||'AI','meta')];
    clean(chat).messages.forEach((m,i)=>{
      paragraphs.push(paragraph(`${i+1}. ${roleLabel(m.role)}${cfg.showMessageTimestamp&&m.sentAt?' · '+m.sentAt:''}`,'h2'));
      if(cfg.includeThinkingContent && m.thinking)paragraphs.push(paragraph('Thinking: '+m.thinking,'meta'));
      paragraphs.push(markdownToWord(m.markdown||m.content));
    });
    if(cfg.appendBranding) paragraphs.push(paragraph(cfg.customBrandingText||'A.max — Arash Makki','meta'));
    const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
    zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Arash Makki</dc:creator><dc:title>${esc(chat.title||'AI Conversation')}</dc:title></cp:coreProperties>`);
    zip.file('word/document.xml',documentXml);
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
    return save(blob,nameFor(chat,'docx',cfg));
  };
  function splitLines(ctx,value,maxWidth) {
    const out=[];
    for(const line of String(value||'').split(/\r?\n/)){
      if(!line){out.push('');continue;}
      let buffer='';
      for(const word of line.split(/\s+/)) {
        const next=buffer?buffer+' '+word:word;
        if(ctx.measureText(next).width>maxWidth&&buffer){out.push(buffer);buffer=word;}
        else buffer=next;
        // very long nonbreaking strings
        if(ctx.measureText(buffer).width>maxWidth){
          let part='';for(const ch of buffer){if(ctx.measureText(part+ch).width>maxWidth&&part){out.push(part);part=ch;}else part+=ch;}
          buffer=part;
        }
      }
      if(buffer)out.push(buffer);
    }
    return out;
  }
  async function renderPages(chat,cfg) {
    const pageDimensions={A4:[595,842],A3:[842,1191],A5:[420,595],Letter:[612,792],Legal:[612,1008]};
    let [pw,ph]=pageDimensions[cfg.pdfFormat]||pageDimensions.A4;
    if(cfg.pdfOrientation==='landscape') [pw,ph]=[ph,pw];
    const width=860,height=Math.round(width*ph/pw),margin=50;
    const theme=E.THEMES[cfg.exportTheme]||E.THEMES.light;
    const deviceScale=1.4;
    const c=document.createElement('canvas');c.width=Math.round(width*deviceScale);c.height=Math.round(height*deviceScale);
    const ctx=c.getContext('2d'); if(!ctx)throw new Error('Canvas not available');ctx.scale(deviceScale,deviceScale);
    const pages=[]; let y=0, pageNo=0;
    const font="16px 'Vazirmatn',Tahoma,Arial,sans-serif";
    const big="bold 26px 'Vazirmatn',Tahoma,Arial,sans-serif";
    const medium="bold 17px 'Vazirmatn',Tahoma,Arial,sans-serif";
    const rtl=s=>/[\u0600-\u06FF]/.test(s);
    const drawText=(str,x,yy,face,color)=>{ctx.font=face;ctx.fillStyle=color;const isRtl=rtl(str);ctx.direction=isRtl?'rtl':'ltr';ctx.textAlign=isRtl?'right':'left';ctx.fillText(str,isRtl?width-x:x,yy,width-2*margin);};
    const begin=()=>{
      ctx.fillStyle=theme.bg;ctx.fillRect(0,0,width,height);
      ctx.fillStyle=theme.accent;ctx.fillRect(0,0,width,6);
      ctx.font="11px Arial";ctx.fillStyle=theme.textMuted;ctx.textAlign='left';ctx.direction='ltr';
      ctx.fillText('A.max  •  '+(pageNo+1),margin,height-24); y=margin+20;
    };
    const flush=async()=>{pages.push({width:pw,height:ph,
        jpeg: await new Promise((resolve,reject)=>c.toBlob(b=>b?b.arrayBuffer().then(resolve):reject(Error('JPEG encoding failed')),'image/jpeg',.88)),
        png: await new Promise((resolve,reject)=>c.toBlob(b=>b?b.arrayBuffer().then(resolve):reject(Error('PNG encoding failed')),'image/png'))}); pageNo++;begin();};
    begin(); drawText(chat.title||'AI Conversation',margin,y,big,theme.text);y+=42;
    drawText(chat.platformName||'AI',margin,y,'13px Arial',theme.textMuted);y+=36;
    for (const [i,m] of clean(chat).messages.entries()){
      ctx.font=font;
      const lines=splitLines(ctx,m.content,width-margin*2-30);
      const headerHeight=40, lineHeight=26;
      if(y+headerHeight+lineHeight*2>height-95)await flush();
      ctx.fillStyle=theme.cardAssistantBg; ctx.strokeStyle=theme.border;
      const bodyHeight=Math.max(1,Math.min(lines.length,Math.floor((height-95-y-headerHeight)/lineHeight)))*lineHeight+10;
      ctx.fillRect(margin-12,y-24,width-2*margin+24,headerHeight+bodyHeight);
      drawText(`${i+1}. ${roleLabel(m.role)}`,margin,y,medium,theme.accent); y+=headerHeight;
      for(const line of lines){
        if(y+lineHeight>height-70)await flush();
        drawText(line,margin,y,font,theme.text);y+=lineHeight;
      }
      y+=28;
    }
    if(cfg.appendBranding){ if(y>height-95)await flush();drawText(cfg.customBrandingText||'A.max — Arash Makki',margin,y,'12px Arial',theme.textMuted); }
    pages.push({width:pw,height:ph,
      jpeg: await new Promise((resolve,reject)=>c.toBlob(b=>b?b.arrayBuffer().then(resolve):reject(Error('JPEG encoding failed')),'image/jpeg',.88)),
      png: await new Promise((resolve,reject)=>c.toBlob(b=>b?b.arrayBuffer().then(resolve):reject(Error('PNG encoding failed')),'image/png'))});
    return pages;
  }
  function pdfFromJPEGPages(pages){
    const enc = new TextEncoder(), parts=[], offsets=[0];let len=0;
    const add=x=>{const bytes=typeof x==='string'?enc.encode(x):new Uint8Array(x);parts.push(bytes);len+=bytes.byteLength;};
    const object=(id,body)=>{offsets[id]=len;add(`${id} 0 obj\n`);add(body);add('\nendobj\n');};
    add('%PDF-1.4\n');
    const pageIds=pages.map((_,i)=>3+i*3);
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,`<< /Type /Pages /Kids [${pageIds.map(i=>i+' 0 R').join(' ')}] /Count ${pages.length} >>`);
    pages.forEach((p,i)=>{
      const id=pageIds[i],imgId=id+1,contentsId=id+2,stream=`q\n${p.width} 0 0 ${p.height} 0 0 cm\n/Im${i} Do\nQ\n`;
      object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> /Contents ${contentsId} 0 R >>`);
      offsets[imgId]=len;add(`${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(860*1.4)} /Height ${Math.round((860*p.height/p.width)*1.4)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.byteLength} >>\nstream\n`);add(p.jpeg);add('\nendstream\nendobj\n');
      object(contentsId,`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
    });
    const ref=len;add(`xref\n0 ${3+3*pages.length}\n0000000000 65535 f \n`);
    for(let i=1;i<3+3*pages.length;i++)add(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    add(`trailer\n<< /Size ${3+3*pages.length} /Root 1 0 R >>\nstartxref\n${ref}\n%%EOF`);
    return new Blob(parts,{type:'application/pdf'});
  }
  E.exportPDF=async(chat,s={})=>{const cfg={...await A.storage.getSettings(),...s};if(!chat?.messages?.length)throw Error('No messages selected');const pages=await renderPages(chat,cfg);return save(pdfFromJPEGPages(pages),nameFor(chat,'pdf',cfg));};
  E.exportPNGImage=async(chat,s={})=>{
    const cfg={...await A.storage.getSettings(),...s};if(!chat?.messages?.length)throw Error('No messages selected');
    const pages=await renderPages(chat,cfg);const zip=new JSZip();const base=nameFor(chat,'png',cfg).replace(/\.png$/i,'');
    if(pages.length===1) return save(new Blob([pages[0].png],{type:'image/png'}),nameFor(chat,'png',cfg));
    // Each page is a real PNG, no truncation.
    pages.forEach((p,i)=>zip.file(`${base}-${String(i+1).padStart(3,'0')}.png`,p.png));
    return save(await zip.generateAsync({type:'blob',compression:'STORE'}),base+'-all-pages.zip');
  };
  // Reject broken source URLs in metadata; safe rendering escapes plain user content.
  const html=E.toStyledHTML;
  E.toStyledHTML=(chat,cfg,forPrint)=>{
    const safe={...chat,url:/^https?:\/\//i.test(chat?.url||'')?chat.url:''};
    return html(safe,cfg,forPrint).replace(/<script>[\s\S]*?<\/script>/gi,'');
  };
  E.exportHTML=async(chat,s={})=>{const cfg={...await A.storage.getSettings(),...s};return save(new Blob([E.toStyledHTML(chat,cfg,false)],{type:'text/html;charset=utf-8'}),nameFor(chat,'html',cfg));};
})(typeof globalThis!=='undefined'?globalThis:self);
