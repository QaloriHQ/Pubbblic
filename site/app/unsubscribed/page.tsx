import Link from "next/link";
export const metadata={title:"Unsubscribed | Pubbblic",robots:{index:false}};
export default function Unsubscribed(){return <section className="section unsubscribe-section"><div className="container"><div className="unsubscribe-form"><h1>You're unsubscribed.</h1><p>You've been removed from Pubbblic's prelaunch email updates. Thanks for your interest.</p><Link href="/" className="button button-blue">Return home</Link></div></div></section>}
