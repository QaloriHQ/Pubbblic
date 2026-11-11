"use client";

import { useRef, type ReactNode } from "react";

type Format = "plain" | "markdown";
type Props = {
  value: string;
  format: Format;
  disabled?: boolean;
  onChange: (next: string, nextFormat: Format) => void;
};

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}

function inlineMarkdown(source: string, blockKey: string): ReactNode[] {
  const tokens = source.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g);
  return tokens.map((token, i) => {
    const key = blockKey + "-" + i;
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return <strong key={key}>{token.slice(2,-2)}</strong>;
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return <em key={key}>{token.slice(1,-1)}</em>;
    }
    const link = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
    if (link) {
      const href = safeUrl(link[2]);
      if (href) return <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">{link[1]}</a>;
    }
    return <span key={key}>{token}</span>;
  });
}

/** React escapes all stored body text. Raw HTML is never parsed or injected. */
export function renderReleaseBody(body: string, format: Format): ReactNode {
  if (format !== "markdown") return body.trim().split(/\n\s*\n/).filter(Boolean)
    .map((p, i) => <p key={"plain-"+i} style={{whiteSpace:"pre-line"}}>{p}</p>);

  const lines = body.replace(/\r\n/g,"\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let seq = 0;
  const flushParagraph = () => {
    if (paragraph.length) {
      const contents = paragraph.join("\n");
      blocks.push(<p style={{whiteSpace:"pre-line"}} key={"para-"+seq++}>{inlineMarkdown(contents,"para-"+seq)}</p>);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (!listType || !list.length) return;
    const items = list.map((line,i) => <li key={i}>{inlineMarkdown(line,"list-"+seq+"-"+i)}</li>);
    blocks.push(listType === "ul" ? <ul key={"list-"+seq++}>{items}</ul> : <ol key={"list-"+seq++}>{items}</ol>);
    list = [];
    listType = null;
  };
  for (const line of lines) {
    const trimmed=line.trim();
    if (!trimmed) { flushParagraph(); flushList(); continue; }
    const heading=/^(#{1,3})\s+(.+)$/.exec(trimmed);
    const bullet=/^[-*]\s+(.+)$/.exec(trimmed);
    const numbered=/^\d+\.\s+(.+)$/.exec(trimmed);
    const quote=/^>\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();flushList();
      const content=inlineMarkdown(heading[2],"head-"+seq);
      blocks.push(heading[1].length===1?<h2 key={"head-"+seq++}>{content}</h2>:<h3 key={"head-"+seq++}>{content}</h3>);
    } else if (bullet||numbered) {
      flushParagraph();
      const nextType=bullet?"ul":"ol";
      if(listType&&listType!==nextType)flushList();
      listType=nextType;
      list.push((bullet||numbered)![1]);
    } else if (quote) {
      flushParagraph();flushList();
      blocks.push(<blockquote key={"quote-"+seq++}>{inlineMarkdown(quote[1],"quote-"+seq)}</blockquote>);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();flushList();
  return blocks;
}

const tools = [
  {name:"Bold",title:"Bold (Ctrl/⌘+B)",kind:"wrap",before:"**",after:"**",sample:"important point"},
  {name:"Italic",title:"Italic",kind:"wrap",before:"*",after:"*",sample:"emphasis"},
  {name:"Heading",title:"Section heading",kind:"line",before:"## ",after:"",sample:"Supporting details"},
  {name:"Bullets",title:"Bulleted list",kind:"list",before:"- ",after:"",sample:"Key point"},
  {name:"Numbers",title:"Numbered list",kind:"numbers",before:"1. ",after:"",sample:"First point"},
  {name:"Quote",title:"Quoted paragraph",kind:"line",before:"> ",after:"",sample:"Relevant statement"},
  {name:"Link",title:"HTTPS link",kind:"wrap",before:"[",after:"](https://example.com)",sample:"source"}
] as const;

export function ReleaseBodyEditor({value,format,disabled=false,onChange}:Props){
  const ref=useRef<HTMLTextAreaElement>(null);
  function applyTool(tool:typeof tools[number]){
    const textarea=ref.current;
    if(!textarea||disabled)return;
    const start=textarea.selectionStart,end=textarea.selectionEnd;
    const before=value.slice(0,start),selection=value.slice(start,end),after=value.slice(end);
    let inserted="";
    if(tool.kind==="line"){
      const lineStart=before.lastIndexOf("\n")+1;
      const existing=value.slice(lineStart,start);
      const prefix=value.slice(0,lineStart);
      const selected=existing+selection||tool.sample;
      inserted=tool.before+selected;
      onChange(prefix+inserted+after,"markdown");
      requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(lineStart+inserted.length,lineStart+inserted.length);});
      return;
    }
    if(tool.kind==="list"||tool.kind==="numbers"){
      const lineStart=before.lastIndexOf("\n")+1;
      const sourceLines=(value.slice(lineStart,end)||tool.sample).split("\n");
      inserted=sourceLines.map((s,i)=>tool.kind==="numbers"?(i+1)+". "+s:"- "+s).join("\n");
      onChange(value.slice(0,lineStart)+inserted+after,"markdown");
      requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(lineStart+inserted.length,lineStart+inserted.length);});
      return;
    }
    inserted=tool.before+(selection||tool.sample)+tool.after;
    onChange(before+inserted+after,"markdown");
    const selectStart=start+tool.before.length;
    requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(selectStart,selectStart+(selection||tool.sample).length);});
  }
  return <div className="studio-body-editor">
    <div className="studio-format-toolbar" role="toolbar" aria-label="Release body formatting">
      {tools.map(tool=><button type="button" key={tool.name} title={tool.title} aria-label={tool.title}
        disabled={disabled} onClick={()=>applyTool(tool)}>{tool.name}</button>)}
    </div>
    <textarea ref={ref} rows={14} maxLength={100000} value={value} disabled={disabled}
      onChange={e=>onChange(e.target.value,format)}
      onKeyDown={e=>{
        if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="b"){
          e.preventDefault();applyTool(tools[0]);
        }
      }}
      aria-label="Press release body"
      placeholder="Start with the key announcement. Add supporting details, dates and sources. Use the toolbar for headings, lists, emphasis and links."/>
    <div className="studio-body-help">
      <span>{format==="markdown"?"Formatting enabled · Markdown source":"Plain text · format with the toolbar"} · {value.length.toLocaleString()}/100,000 characters</span>
      <span>Formatting is previewed safely. HTML and scripts are never executed.</span>
    </div>
  </div>;
}
