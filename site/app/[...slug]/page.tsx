import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRightIcon, ArrowUpRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { pages, pageMap, featuredLinks } from "@/lib/pages";
import { WaitlistForm } from "@/components/Waitlist";
type Props = { params: Promise<{ slug: string[] }> };
export function generateStaticParams() { return pages.map(p => ({ slug: p.path.split("/") })); }
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {slug} = await params; const entry=pageMap.get(slug.join("/"));
  if (!entry) return { title: "Not found", robots: { index: false } };
  return { title: entry.title, description: entry.description, alternates: { canonical: "/" + entry.path }, openGraph: { title: entry.title, description: entry.description, url: "/" + entry.path } };
}
export default async function ContentPage({ params }: Props) {
  const {slug} = await params; const entry=pageMap.get(slug.join("/")); if(!entry) notFound();
  const isGuide=entry.path.startsWith("guides/");
  const base=process.env.NEXT_PUBLIC_SITE_URL || "https://pubbblic.com";
  const jsonld = [
    { "@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{ "@type":"ListItem",position:1,name:"Home",item:base },{ "@type":"ListItem",position:2,name:entry.title,item:base+"/"+entry.path }] },
    ...(isGuide ? [{ "@context":"https://schema.org","@type":"Article",headline:entry.title,description:entry.description,author:{"@type":"Organization",name:"Pubbblic"},publisher:{"@type":"Organization",name:"Pubbblic"},mainEntityOfPage:base+"/"+entry.path }] : [])
  ];
  const related=featuredLinks.filter(x=>x.href!=="/"+entry.path).slice(0,4);
  return <>
    {jsonld.map((schema,i)=><script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/>)}
    <section className="sub-hero"><div className="container"><nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>{entry.eyebrow.toLowerCase()}</span></nav><div className="sub-hero-grid"><div><span className="eyebrow">{entry.eyebrow}</span><h1>{entry.title}</h1></div><div className="sub-intro"><p>{entry.lead}</p><Link href="/#waitlist" className="button button-blue">Get launch updates <ArrowRightIcon width={18}/></Link></div></div></div></section>
    <section className="section sub-content"><div className="container content-grid"><article className="article-content">
      {entry.sections.length ? entry.sections.map((section,i)=><section key={section.heading} className="article-section"><span className="section-index">{String(i+1).padStart(2,"0")}</span><div><h2>{section.heading}</h2><p>{section.body}</p>{section.details && <ul>{section.details.map(x=><li key={x}>{x}</li>)}</ul>}</div></section>) : <div className="article-section"><span className="section-index">01</span><div><h2>What you need to know</h2><p>{entry.lead}</p></div></div>}
      {entry.faqs && <section className="faq-section"><span className="eyebrow">QUESTIONS, ANSWERED</span><h2>Common questions</h2>{entry.faqs.map(f=><details key={f.question}><summary>{f.question}</summary><p>{f.answer}</p></details>)}</section>}
      <div className="article-end"><CheckCircleIcon width={22}/><div><strong>Built for clarity</strong><p>Pubbblic is in development. We describe planned workflows as planned and verify publisher availability before offering distribution.</p></div></div>
    </article><aside className="content-aside"><div className="aside-box"><span className="eyebrow">EXPLORE MORE</span><h3>Keep reading</h3>{related.map(x=><Link key={x.href} href={x.href}>{x.label}<ArrowUpRightIcon width={16}/></Link>)}</div><div className="aside-callout"><h3>Ready for better PR workflows?</h3><p>Get launch access updates and practical guidance.</p><Link href="/#waitlist">Join the waitlist <ArrowRightIcon width={17}/></Link></div></aside></div></section>
    <section className="section sub-cta"><div className="container sub-cta-grid"><div><span className="eyebrow">GET EARLY ACCESS</span><h2>One story.<br/>A smarter next step.</h2><p>Join our launch list as we build a clearer distribution experience.</p></div><WaitlistForm compact source={"page-"+entry.path.replace(/\//g,"-")}/></div></section>
  </>;
}
