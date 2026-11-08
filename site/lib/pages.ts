export type MarketingPage = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  lead: string;
  sections: { heading: string; body: string; details?: string[] }[];
  faqs?: { question: string; answer: string }[];
};
function page(path: string, eyebrow: string, title: string, description: string, lead: string,
  sections: MarketingPage["sections"], faqs?: MarketingPage["faqs"]): MarketingPage {
  return { path, eyebrow, title, description, lead, sections, faqs };
}
export const pages: MarketingPage[] = [
  page("press-release-distribution", "PRESS RELEASE DISTRIBUTION",
    "Press release distribution, built for clarity.",
    "Understand online press release distribution, publisher submission workflows, and how Pubbblic plans to show verified results.",
    "Distributing a press release is more than sending identical copy to a list of websites. Different publishers have different rules, review processes and standards for accepting announcements.",
    [
      {heading:"What press release distribution actually involves",body:"A release is drafted, checked for accuracy, prepared for each destination, submitted through an approved channel, reviewed when required, and then monitored for publication. Submission never automatically means publication. Pubbblic is being built around that distinction."},
      {heading:"Publisher-specific preparation",body:"Pubbblic's planned workflow starts with one approved source release and prepares a distinct, factually consistent version for each selected publisher. The goal is to satisfy real editorial constraints, not to manufacture coverage or duplicate keyword-stuffed content."},
      {heading:"Transparent proof of delivery",body:"Reports should distinguish attempted submissions, publisher receipts, editorial decisions and verifiable live links. Every destination must be supported by valid publisher permissions and a reliable publishing workflow."}
    ],[
      {question:"Can Pubbblic guarantee that every outlet will publish my news?",answer:"No. Third-party publishers make their own editorial and acceptance decisions unless a specific service agreement explicitly provides otherwise."},
      {question:"Is distribution the same as media coverage?",answer:"No. A syndicated or self-submitted release is not the same as an independent article written by a journalist."}
    ]),
  page("press-release-writing","PRESS RELEASE WRITING",
    "Write one strong release. Prepare it for every destination.",
    "Explore press release writing basics, editorial structure and Pubbblic's planned AI-assisted publisher adaptations.",
    "Good news distribution begins with a clear, accurate announcement. Start with a concrete story, evidence that supports it and a quote that adds genuine context.",
    [
      {heading:"Start with the news, not the adjectives",body:"A headline should identify what happened and why it matters. The opening paragraph should answer who, what, when, where and why. Supporting paragraphs can explain relevance, background, measurable details and next steps."},
      {heading:"Use a factual source of truth",body:"Pubbblic will preserve an approved master version. Proposed DeepSeek-powered publisher adaptations will be checked against its names, figures, dates, quotes and claims before distribution."},
      {heading:"Make the journalist's job easier",body:"Include a clear organization description, reachable media contact, relevant links and publication-ready images where permitted. Avoid unverified superlatives or claims that could mislead readers."}
    ]),
  page("how-it-works","PLATFORM OVERVIEW",
    "From one announcement to a clearer distribution workflow.",
    "Learn how Pubbblic will handle press release preparation, publisher-specific adaptation, submission and reporting.",
    "Pubbblic is in development. Here's the workflow we're building: simple for the customer, careful about what happens behind the scenes.",
    [
      {heading:"01 — Create and approve",body:"Write your announcement, attach supporting materials and approve the final master release. Editing history and reviews keep the source version accountable."},
      {heading:"02 — Adapt for publishers",body:"DeepSeek will prepare destination-specific versions aligned with published requirements. Automated checks and editorial escalation protect factual accuracy before submission."},
      {heading:"03 — Distribute through Pubbblic accounts",body:"Pubbblic will manage authorized destination accounts, supported publisher API connections, permitted Zyte form automation and internal manual operations. Customers do not connect publisher accounts."},
      {heading:"04 — Understand the outcome",body:"Track the difference between submitted, in review and actually published. Destination URLs and supporting evidence are the foundation of reporting."}
    ]),
  page("features/ai-rewriting","FEATURES / AI",
    "AI press release rewriting without losing the story.",
    "Discover Pubbblic's planned DeepSeek API workflow for faithful publisher-specific press release rewriting and factual validation.",
    "A press release often needs a different presentation to fit different publications. It should never need different facts.",
    [
      {heading:"One approved master release",body:"Your original message remains the source of truth. A separate rewrite is created for each eligible publisher, using that destination's editorial constraints rather than a generic spinning prompt."},
      {heading:"Editorial variation with guardrails",body:"Headlines, structure, summary length, formatting and boilerplate placement can change. Product claims, named people, attributed quotes, dates and numbers must stay consistent unless the customer approves substantive changes."},
      {heading:"Human review when it matters",body:"Uncertain or materially different variants should be held for review. Automation is not a substitute for accuracy or for a publisher's own editorial decision."}
    ]),
  page("features/publisher-network","FEATURES / NETWORK",
    "A publisher network with documented access.",
    "See how Pubbblic will evaluate publisher eligibility, manage its own destination accounts and report real outcomes.",
    "We believe a distribution network should be described by what it can legitimately do—not by unverified publisher logos.",
    [
      {heading:"Publisher eligibility before promises",body:"Every destination is reviewed for acceptable subject matter, geographic coverage, media support, fees, posting frequency and permission for Pubbblic to distribute client releases from its own account."},
      {heading:"One Pubbblic-managed relationship",body:"Customers will not need outside publisher credentials. Pubbblic handles supported API, permitted automation and internal operator workflows."},
      {heading:"Status that reflects reality",body:"A successful form submission is not the same as an accepted or published article. Our planned dashboard will make these distinctions visible."}
    ]),
  page("features/editorial-review","FEATURES / EDITORIAL",
    "Editorial safeguards built into the workflow.",
    "Learn about Pubbblic's planned press release editorial reviews, factual checks and publisher-specific compliance controls.",
    "Editorial quality matters for readers, publishers and the organizations behind the announcement.",
    [
      {heading:"Check the source",body:"Dates, company names, quotes, material figures and claim substantiation should be reviewed before release approval. A consistent master version creates a reliable reference for all destination variants."},
      {heading:"Respect publisher standards",body:"Each destination may limit content categories, links, images, word count or promotional language. Rules are checked before dispatch rather than discovered only after a rejection."},
      {heading:"Correction workflows",body:"If an error is discovered, the customer and operator should be able to identify affected destinations, record corrections and track publisher responses."}
    ]),
  page("features/reporting","FEATURES / REPORTING",
    "Know what happened after you hit distribute.",
    "Explore Pubbblic's planned press release tracking, publisher receipts, publication verification and customer-ready reports.",
    "Delivery reporting should tell the truth. Not an inflated reach estimate or a count of clicks on the Submit button.",
    [
      {heading:"Submission is only the beginning",body:"Track queued, submitted, under-review, accepted, rejected and published outcomes separately. A submission receipt proves a handoff attempt; a live URL supports a publication claim."},
      {heading:"Evidence with context",body:"Publication records should include the verified link, the destination-specific version, the time of verification and any material publisher edits or delays."},
      {heading:"Reports you can explain",body:"A clear summary should make it easy to share what was verified, what remains pending and what requires intervention. Unavailable performance metrics should be labeled unavailable rather than estimated."}
    ]),
  page("solutions/startups","SOLUTIONS / STARTUPS",
    "Make your startup announcement count.",
    "A practical guide to startup press releases for product launches, funding announcements and company milestones.",
    "A startup does not need a giant communications department to tell a clear story. It does need news that matters to the audience.",
    [
      {heading:"Make the milestone concrete",body:"Product availability, customer milestones, partnerships and verified funding events can be newsworthy when they include specifics and honest context."},
      {heading:"Prepare for targeted distribution",body:"Different publishers look for different types of announcements. Pubbblic is building destination-specific preparation and a transparent record of what gets submitted and published."},
      {heading:"Build a reusable process",body:"Keep boilerplates, quotes, links and media assets organized so future announcements are easier and more consistent."}
    ]),
  page("solutions/agencies","SOLUTIONS / AGENCIES",
    "Press release operations without the spreadsheet maze.",
    "Pubbblic for PR agencies: plan multi-client press releases, editorial review, publisher-specific versions and reporting.",
    "Agency teams need repeatable processes, clear separation between clients and evidence they can confidently share.",
    [
      {heading:"Keep client context separate",body:"Each client should have its own approved releases, brand materials, contacts and audit history. Access controls and review workflows reduce accidental cross-client mistakes."},
      {heading:"Adapt copy systematically",body:"Generate publisher-specific drafts from the correct approved client version while flagging differences that need editorial approval."},
      {heading:"Give clients a credible report",body:"Show verified placement links, what is still under review and which destinations need follow-up—without conflating syndicated announcements with earned media."}
    ]),
  page("solutions/brands","SOLUTIONS / BRANDS",
    "A consistent story across every release.",
    "Explore corporate press release workflows with Pubbblic for product news, company updates and brand communications.",
    "Corporate communications work best when teams can move quickly without losing control over public claims.",
    [
      {heading:"Control the message",body:"Versioned releases, approval checkpoints and managed boilerplates help preserve factual consistency across channels and dates."},
      {heading:"Plan carefully",body:"Embargoes, product release dates, regulated announcements and material forward-looking claims may require additional review. Distribution systems must respect those constraints."},
      {heading:"Measure what can be verified",body:"Track the publisher outcomes that can be independently confirmed instead of relying on broad reach claims with no supporting data."}
    ]),
  page("solutions/saas","SOLUTIONS / SAAS",
    "Tell the story behind your next product release.",
    "Press release strategies for SaaS product launches, integrations, partnerships and customer milestones.",
    "A feature release becomes a stronger announcement when it explains a meaningful problem and evidence of the impact.",
    [
      {heading:"Connect features to outcomes",body:"Describe who benefits, what changed, when the capability is available and any limitations. Avoid treating aspirational roadmap language as a launched product."},
      {heading:"Support technical claims",body:"Accuracy matters for performance claims, security certifications, integrations and customer quotations. These details should survive publisher-specific adaptation."},
      {heading:"Keep the story discoverable",body:"Use specific product terminology, a clear headline, contextual links and an accessible newsroom or product page when available."}
    ]),
  page("solutions/ecommerce","SOLUTIONS / ECOMMERCE",
    "Turn product news into a useful announcement.",
    "Press release guidance for ecommerce launches, retail expansions, seasonal news and business partnerships.",
    "Retail press releases work best when there is an actual event or product update—not just another promotional discount.",
    [
      {heading:"Lead with the new development",body:"A new product line, store opening, distribution partnership or verified business milestone gives readers a reason to care."},
      {heading:"Back up the details",body:"Include availability, locations, product specifications and prices accurately. Make exclusions clear when inventory or availability is limited."},
      {heading:"Respect publisher standards",body:"Some outlets reject overt advertising or unsupported product claims. Publisher-specific review is part of the planned Pubbblic workflow."}
    ]),
  page("industries/technology","INDUSTRIES / TECHNOLOGY",
    "Press releases for technology companies.",
    "How technology companies can announce launches, partnerships and innovation with credible, accessible press releases.",
    "Strong tech communication explains what works today, who can use it and why it matters.",
    [
      {heading:"Avoid technical overstatement",body:"Distinguish prototypes, beta features and generally available products. Claims about AI performance, security or uptime require substantiation."},
      {heading:"Make complex news legible",body:"Write for the intended reader and keep jargon defined. Technical specifications can support the story without burying the announcement."},
      {heading:"Preserve the important facts",body:"When adapting releases for different publishers, deployment dates, benchmark numbers and official quotes must stay consistent."}
    ]),
  page("industries/real-estate","INDUSTRIES / REAL ESTATE",
    "Real estate press releases with substance.",
    "Press release guidance for real estate developments, community projects, brokerage milestones and property announcements.",
    "Development news often affects real communities, so location, timelines and project status deserve precision.",
    [
      {heading:"State the project stage",body:"Distinguish proposed, permitted, under-construction and completed projects. Include publicly confirmed details and avoid suggesting approvals that have not been granted."},
      {heading:"Show local relevance",body:"Explain what changes for residents, businesses or customers and provide a credible local point of contact."},
      {heading:"Check commercial claims",body:"Pricing, completion dates, unit counts and investment estimates can change. Confirm them before publication and document material updates."}
    ]),
  page("pricing","PRICING",
    "Simple distribution pricing is coming.",
    "Pubbblic press release distribution pricing is being finalized. Join the waitlist for launch access and pricing announcements.",
    "We are finalizing publisher eligibility, real operating costs and reporting standards before publishing our packages. No credit card is needed to join the waitlist.",
    [
      {heading:"Designed for straightforward choices",body:"The planned experience will let customers understand what destinations are available, what their selected distribution includes and which fees apply before checkout."},
      {heading:"No invented guarantees",body:"We will distinguish submission from publication and disclose any publisher restrictions. Price, turnaround and editorial decisions will depend on approved network capabilities."},
      {heading:"Be first to see launch packages",body:"Join the waitlist to hear when pricing is finalized, access opens and early customer onboarding becomes available."}
    ],[
      {question:"Can I purchase distribution today?",answer:"Not yet. Pubbblic is in development and is currently collecting voluntary waitlist registrations."},
      {question:"Do I need a subscription to join the waitlist?",answer:"No. Joining the waitlist is free, and it does not obligate you to buy a service."}
    ]),
  page("about","ABOUT PUBBBLIC",
    "Better distribution begins with better information.",
    "Meet Pubbblic, a prelaunch press release distribution platform focused on editorial adaptation and verifiable outcomes.",
    "Pubbblic is being built around a simple belief: getting news out should be easier to understand and easier to verify.",
    [
      {heading:"Why we're building Pubbblic",body:"Press release workflows often involve multiple destination rules, unclear statuses and fragmented records. We want to bring drafting, preparation and outcome reporting into one place."},
      {heading:"What makes the approach different",body:"Our plan combines a single approved master release, publisher-specific DeepSeek adaptations, centrally managed publisher accounts, and proof-based distribution reporting."},
      {heading:"Where we are now",body:"Pubbblic is not yet available for public distribution. We're building the platform and validating authorized publisher workflows. You can join the launch list today."}
    ]),
  page("faq","COMMON QUESTIONS",
    "Questions about Pubbblic.",
    "Find answers about Pubbblic's upcoming press release distribution service, publisher accounts, AI rewriting, pricing and launch waitlist.",
    "Here's what we can share while the product is in development.",
    [],[
      {question:"Is Pubbblic live?",answer:"The marketing site and waitlist are being launched first. The distribution platform is still in development and is not yet accepting paid press release orders."},
      {question:"Will I have to create accounts at publisher websites?",answer:"No. Pubbblic plans to distribute through its own authorized publisher accounts, wherever the destination's rules allow."},
      {question:"Does AI rewrite every release?",answer:"The planned service uses DeepSeek to prepare a separate destination-specific version from the approved master, subject to factual and editorial validation."},
      {question:"Can an outlet reject my release?",answer:"Yes. Publishers retain their own eligibility and editorial discretion."},
      {question:"Can I track where my release appeared?",answer:"Verified publication links and accurate statuses are part of the planned reporting experience."},
      {question:"How do I get launch updates?",answer:"Join the waitlist and opt in to product updates. Every email includes an unsubscribe option."}
    ]),
  page("resources","RESOURCES",
    "Press release knowledge, without the jargon.",
    "Explore practical press release writing, format, launch timing, SEO and distribution guides from Pubbblic.",
    "Start with the fundamentals: write credible news, prepare useful supporting information and understand the difference between sending a release and securing coverage.",
    [
      {heading:"Learn to write a stronger release",body:"Our guides cover structure, headline writing, quotes, boilerplates and common mistakes that can undermine credibility."},
      {heading:"Understand distribution",body:"Learn what submission means, how editorial review works and why reporting should reflect verified placements rather than unsubstantiated reach claims."}
    ]),
  page("guides/how-to-write-a-press-release","GUIDE / WRITING",
    "How to write a press release that says something.",
    "Step-by-step guide to writing a press release: news angle, headline, lead, quote, boilerplate, media contacts and fact checks.",
    "An effective press release is a concise announcement written for readers who don't already know your company. Start with the news itself.",
    [
      {heading:"1. Choose an actual announcement",body:"Identify a specific event: a product availability milestone, partnership, expansion or measurable achievement. Ask who is affected and what changed."},
      {heading:"2. Write a direct headline and lead",body:"Put the central fact in the headline. In the opening paragraph, answer the most important who, what, when, where and why questions."},
      {heading:"3. Add context and attributable quotes",body:"Use evidence, context and direct quotes from people who have approved their statements. Don't invent testimonials or change numbers for effect."},
      {heading:"4. Finish with a boilerplate and media contact",body:"Explain what the organization does, provide its official website and name a contact who can answer follow-up questions."},
      {heading:"5. Review before distribution",body:"Check spelling, names, dates, links, statements and rights to any photos. Save an approved final version before publisher-specific adaptation."}
    ]),
  page("guides/press-release-format","GUIDE / FORMAT",
    "Press release format: a practical template.",
    "Learn the essential press release format, from headline and dateline to supporting details, boilerplate and media contact.",
    "Formatting creates a clear reading path. It cannot replace an honest news angle, but it helps reviewers find the facts they need.",
    [
      {heading:"The core sections",body:"Use a headline, optional deck, dateline, lead paragraph, supporting paragraphs, approved quotes, organization boilerplate and media contact. Include photo captions or links only where supported."},
      {heading:"Write for scanning",body:"Lead with the development and place context later. Avoid walls of promotional copy, unexplained acronyms and excessive links."},
      {heading:"Account for publisher rules",body:"Some outlets require a particular word range, category, image ratio or field mapping. A publisher-specific version should adapt the formatting without changing facts."}
    ]),
  page("guides/press-release-examples","GUIDE / EXAMPLES",
    "Press release examples you can learn from.",
    "Explore realistic press release structures for product launches, partnerships, new locations and leadership announcements.",
    "Examples can clarify structure, but real releases should be grounded in actual events, approved statements and accurate company details.",
    [
      {heading:"Product launch example",body:"Headline: Company introduces [product] for [audience]. Lead: [Company] announced the availability of [product] on [date], describing [specific supported benefit]. Follow with product details, availability, an approved executive quote and a media contact."},
      {heading:"Partnership announcement example",body:"Headline: [Company A] and [Company B] announce [specific collaboration]. Explain the agreement's scope, each party's role, when it takes effect and what customers should reasonably expect."},
      {heading:"New location example",body:"Headline: [Business] opens [type of facility] in [city]. Include the confirmed opening date, address, opening hours, relevant services and publicly approved comments."},
      {heading:"What all good examples share",body:"Specificity, clear sourcing, useful context and truthful claims. Remove any placeholder text before submission."}
    ]),
  page("guides/press-release-seo","GUIDE / SEO",
    "Press release SEO: visibility without shortcuts.",
    "A practical guide to press release SEO, natural keywords, useful source links and realistic expectations about search results.",
    "Press releases may be discoverable in search, but distribution does not guarantee rankings, backlinks or editorial coverage.",
    [
      {heading:"Use meaningful language",body:"Write clear headlines and descriptions that use the terms readers would naturally search for. Repeating the same keywords excessively makes the announcement harder to read."},
      {heading:"Link with purpose",body:"Use links to helpful official sources, product detail pages and supporting documents. Paid or promotional placements may need appropriate link attributes under a publisher's policy."},
      {heading:"Focus on verifiable outcomes",body:"Publication on a third-party site is not the same as search indexing. Search engines decide what to crawl, index and rank, and those decisions can change."},
      {heading:"Avoid scaled content abuse",body:"Generating numerous near-duplicate rewrites solely to manipulate search results can be counterproductive. Publisher adaptations should satisfy legitimate editorial needs and provide reader value."}
    ]),
  page("guides/when-to-send-a-press-release","GUIDE / PLANNING",
    "When should you send a press release?",
    "Plan press release timing for product launches, milestones and announcements, including embargoes and editorial review lead times.",
    "The best time depends on the announcement, your audience, and each destination's processing requirements—not a universal day-and-hour formula.",
    [
      {heading:"Work backward from the announcement",body:"Confirm the public date, internal approvals, media availability and any legal or stakeholder review. Leave room for destination-specific formatting and editorial decisions."},
      {heading:"Use embargoes carefully",body:"An embargo is a request that must be respected by the receiving parties; it is not an automatic guarantee. Do not submit sensitive information before the publisher agrees to the terms."},
      {heading:"Avoid last-minute surprises",body:"Prepare confirmed facts, quotes, visuals and a media contact in advance. Monitor status so you can respond to review questions or corrections."}
    ]),
  page("contact","CONTACT",
    "Stay close to the Pubbblic launch.",
    "Join the Pubbblic waitlist for announcements about the press release distribution platform, publisher network and launch access.",
    "For now, the best way to reach our launch team is to join the waitlist and tell us what kind of organization you represent.",
    [
      {heading:"For startups and brands",body:"Tell us what you plan to announce so we can prioritize the right workflows and resources as we build."},
      {heading:"For PR agencies",body:"Select Agency in the form so our launch updates stay relevant to multi-client operations."}
    ]),
  page("privacy","PRIVACY",
    "Privacy at Pubbblic.",
    "Read how Pubbblic's prelaunch waitlist handles email addresses, consent and launch updates.",
    "Last updated November 8, 2026. This page describes the marketing waitlist while Pubbblic's distribution product is in development.",
    [
      {heading:"Information we collect",body:"When you join the waitlist, we collect your email address, your selected organization category, the fact and time of your consent, and the page where you signed up. Technical service logs may temporarily record request metadata for security."},
      {heading:"How we use it",body:"We use this information to operate the waitlist, provide requested launch and product-development emails, prevent misuse, and maintain delivery records. We do not sell waitlist information."},
      {heading:"Processors and retention",body:"The planned implementation uses Supabase to store subscriptions, Resend to deliver emails, and Vercel to host the site. Data is retained while the waitlist is active or as needed for compliance and operational records, subject to legitimate deletion requests."},
      {heading:"Your choices",body:"Joining is voluntary. You can unsubscribe using the link in any waitlist email. If you don't opt in, we won't add you to the marketing drip sequence."}
    ]),
  page("terms","TERMS",
    "Waitlist terms.",
    "Read Pubbblic's prelaunch waitlist terms, availability notice and limitations.",
    "Last updated November 8, 2026. Pubbblic is being developed, and joining the waitlist does not purchase distribution or establish a publisher placement agreement.",
    [
      {heading:"Prelaunch status",body:"The marketing site describes planned services, not a currently operational distribution network. Features, prices, eligibility and release dates may change as we validate the platform."},
      {heading:"No placement promises",body:"Pubbblic does not promise that a third-party publisher will accept, publish, index or rank a submitted press release. Any future paid service will have separate, explicit terms."},
      {heading:"Appropriate use",body:"Do not submit false contact details, malicious material, unauthorized copyrighted content or other abusive material through the site's forms."},
      {heading:"Communications",body:"By checking the waitlist consent box, you request Pubbblic launch and educational emails. You may unsubscribe at any time."}
    ])
];
export const pageMap = new Map(pages.map((p) => [p.path, p]));
export const featuredLinks = [
 { label: "Press release distribution", href: "/press-release-distribution" },
 { label: "How it works", href: "/how-it-works" },
 { label: "AI publisher rewrites", href: "/features/ai-rewriting" },
 { label: "Distribution reporting", href: "/features/reporting" },
 { label: "Press release guides", href: "/resources" },
 { label: "Launch pricing", href: "/pricing" }
];
