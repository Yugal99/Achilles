Achilles
Find your app's Achilles' heel before someone else does.

Achilles is a security recon tool for vibe-coded apps. Paste in the URL of an app you built with an AI builder (Lovable, Bolt, Replit, Cursor and others). Achilles runs a safe, non-destructive scan from a Kali Linux backend and hands back a five-slide presentation: what it found, why each finding matters, and a fix prompt you can paste straight back into your AI builder.

Built for HackUTA 

The problem
AI builders let anyone ship a full-stack app in an afternoon, and most of those apps never get a security review. The same mistakes show up again and again:

.env files and .git folders exposed to the internet
Supabase service keys or OpenAI keys shipped in client-side JavaScript
Database tables with no row-level security, and open Firebase rules
Wildcard CORS, debug pages left on, missing security headers
Dev servers and database ports left open
Pentest tools like Nmap and Nuclei can find these issues, but their output is written for security professionals. Vibe coders need answers they can act on.

What Achilles does
Verify: you prove you own the app with a DNS TXT record or a file at /.well-known/achilles.txt.
Scan: a Kali worker runs five tools in parallel, each in its own sandboxed container.
Normalize: every tool's output is parsed into one common Finding format.
Explain: Grok turns the findings into plain-English fixes and paste-ready prompts. It may only explain findings the tools actually produced, never invent new ones.
Present: you get a five-slide deck covering the stack we saw, the top risks, why each one matters, how to fix it, and what you did well.
The Demo profile finishes in under 2 minutes.

Architecture
Presentation site ──► Gate API ──► Job queue ──► Kali workers ──► Target app
   (Next.js)         (FastAPI)      (Redis)      (Docker, Vultr)   (owner-verified)
       ▲                                              │
       │                                              ▼
  Tips engine  ◄──  Findings store  ◄──────────  Normalizer
 (rules + Grok)      (PostgreSQL)                  (Python)
Part	Job
Presentation site	Takes the URL, shows live progress, renders the slide deck
Gate API	Checks ownership, blocks private and internal addresses, rate-limits, queues scans
Job queue	Hands scans to free workers and retries failed steps
Kali workers	Run each tool in its own container with a time limit, allowed to reach only the verified target
Normalizer	Parses each tool's output (Nmap XML, Nuclei JSON and so on) into Findings
Tips engine	Ranks findings and writes the fixes (Grok, with Gemini or Claude as backup and a rule table as the last fallback)
The toolkit
Tool	What it catches
Nmap	Open database ports, admin panels, dev servers left running
httpx	The tech stack (Supabase, Firebase, Next.js, Vercel), so later checks know what to look for
Nuclei (curated templates)	Exposed .env and .git files, debug pages, open CORS, known CVEs
testssl.sh	Weak TLS, and expired or mismatched certificates
JS-bundle and header checker (custom)	API keys in client JavaScript and missing security headers
Built with (sponsor tech)
Sponsor	How Achilles uses it
Vultr	Hosts the Kali scanner VM, the site, the API, the queue and the database
GoDaddy Registry	The demo domain: https://github.com/zeyneplu/Capital_insight
SpaceXSI (Cursor + Grok)	Achilles was built with Cursor, and Grok writes the plain-English fixes and prompts
Solana (stretch)	Anchors a SHA-256 hash of each report on-chain as tamper-proof proof of testing. Only the hash goes on-chain, never the findings
Reliability
Partial reports, not error pages: each tool has a hard timeout, and if one tool fails the deck still ships and says which checks were cut short.
Isolated crew: one container per tool per scan, running as non-root with a read-only filesystem.
AI fallback chain: Grok, then Gemini or Claude, then rule-based tips.
Tested against known-vulnerable targets: OWASP Juice Shop, plus a seeded test app with a leaked key and an exposed .env.
Getting started
Prerequisites: Docker and Docker Compose, a Kali Linux host (we use a Vultr VM), and API keys for Grok (optionally Gemini or Claude).

git clone https://github.com/yugal99/achilles.git
cd achilles
cp .env.example .env        # add your API keys and database settings
docker compose up --build
Then open http://localhost:3000, enter the URL of an app you own, and follow the ownership-check steps.

To run the tests:

docker compose -f docker-compose.test.yml up --abort-on-container-exit
(Update these commands to match the final repo layout.)

Ethics and responsible use
Achilles only scans targets you have proven you control, and it never exploits what it finds. There is no brute force, no payloads and no writes to the target. Private, loopback and cloud-metadata addresses are blocked. Leaked secrets are masked in reports, and raw scan output is deleted after 7 days.

Scanning systems without permission is illegal in most places. Don't point Achilles, or the tools it uses, at anything you don't own.

Roadmap
Deep scan profile (all ports and the full Nuclei template set)
OWASP ZAP baseline scans
More stack-specific checks (Supabase row-level security, Firebase rules)
Rescans that show what got fixed
Solana proof of testing
