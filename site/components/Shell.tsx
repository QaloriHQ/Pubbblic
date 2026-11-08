"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, Bars3Icon, XMarkIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
const nav = [
  { label: "Platform", links: [["How it works", "/how-it-works"],["AI rewriting", "/features/ai-rewriting"],["Publisher network", "/features/publisher-network"],["Editorial review", "/features/editorial-review"],["Reporting", "/features/reporting"]] },
  { label: "Solutions", links: [["Startups", "/solutions/startups"],["Agencies", "/solutions/agencies"],["Brands", "/solutions/brands"],["SaaS", "/solutions/saas"],["Ecommerce", "/solutions/ecommerce"]] },
  { label: "Resources", links: [["Guides", "/resources"],["Press release distribution", "/press-release-distribution"],["Press release writing", "/press-release-writing"],["FAQ", "/faq"]] },
];
export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={"wordmark" + (inverse ? " inverse" : "")} aria-label="Pubbblic home">
    <span className="wordmark-icon" aria-hidden="true"><span></span><span></span><span></span></span><span>pubbblic<span className="brand-period">.</span></span>
  </Link>;
}
export function Header() {
  const [open, setOpen] = useState(false);
  return <header className="header">
    <div className="container header-inner">
      <Wordmark />
      <nav className="nav-main" aria-label="Primary navigation">
        {nav.map(group => <div className="nav-item" key={group.label}>
          <button className="nav-parent" type="button">{group.label}<span aria-hidden="true">⌄</span></button>
          <div className="nav-dropdown">{group.links.map(([label, href]) => <Link key={href} href={href}>{label}<ArrowUpRightIcon width={15}/></Link>)}</div>
        </div>)}
        <Link href="/pricing" className="nav-simple">Pricing</Link>
        <Link href="/about" className="nav-simple">About</Link>
      </nav>
      <div className="header-actions"><Link className="button button-dark button-sm" href="/#waitlist">Join the waitlist <ArrowRightIcon width={16}/></Link></div>
      <button className="mobile-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>{open?<XMarkIcon width={25}/>:<Bars3Icon width={25}/>}</button>
    </div>
    {open && <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(g => <div key={g.label}><p>{g.label}</p>{g.links.map(([label,href]) => <Link href={href} key={href} onClick={()=>setOpen(false)}>{label}</Link>)}</div>)}<Link href="/pricing" onClick={()=>setOpen(false)}>Pricing</Link><Link href="/about" onClick={()=>setOpen(false)}>About</Link><Link href="/#waitlist" className="button button-dark" onClick={()=>setOpen(false)}>Join waitlist</Link></nav>}
  </header>;
}
const footerGroups = [
  { name:"Platform", links:[["How it works","/how-it-works"],["AI rewriting","/features/ai-rewriting"],["Publisher network","/features/publisher-network"],["Editorial review","/features/editorial-review"],["Reporting","/features/reporting"],["Pricing","/pricing"]] },
  { name:"Solutions", links:[["Startups","/solutions/startups"],["Agencies","/solutions/agencies"],["Brands","/solutions/brands"],["SaaS","/solutions/saas"],["Ecommerce","/solutions/ecommerce"]] },
  { name:"Learn", links:[["Resources","/resources"],["Distribution guide","/press-release-distribution"],["Writing guide","/press-release-writing"],["Press release format","/guides/press-release-format"],["Press release SEO","/guides/press-release-seo"],["FAQ","/faq"]] },
  { name:"Company", links:[["About","/about"],["Contact","/contact"],["Privacy","/privacy"],["Terms","/terms"]] }
];
export function Footer() {
  return <footer className="footer">
    <div className="container">
      <div className="footer-main">
        <div className="footer-intro"><Wordmark inverse/><p>Make your news count.</p><span>Thoughtful distribution. Clearer outcomes.</span><span>a <a href="https://mahtco.com" target="_blank" rel="noopener noreferrer" style={{ color: "#cbd6ef", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "3px" }}>Mahtco</a> company</span><span className="footer-prelaunch">In development · Join our launch list</span></div>
        <div className="footer-links">{footerGroups.map(g => <div key={g.name}><h3>{g.name}</h3>{g.links.map(([label,href]) => <Link key={href} href={href}>{label}</Link>)}</div>)}</div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getUTCFullYear()} Pubbblic. All rights reserved.</span><span>Planned services subject to publisher authorization and editorial acceptance.</span></div>
    </div>
  </footer>;
}
