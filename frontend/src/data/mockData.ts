export interface ScanResult {
  id: string;
  type: "screenshot" | "voice" | "text";
  input: string;
  verdict: "scam" | "caution" | "safe";
  confidence: number;
  date: string;
  findings: string[];
  suspiciousItems: { label: string; type: "phone" | "url" | "company" }[];
  connectedReports: number;
}

export interface ThreatFeedItem {
  id: string;
  type: string;
  source: string;
  time: string;
  severity: "high" | "medium" | "low";
  description: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  type: "phone" | "url" | "company" | "report";
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: string[];
}

export const mockScans: ScanResult[] = [
  {
    id: "1",
    type: "screenshot",
    input: "Screenshot of IRS refund email",
    verdict: "scam",
    confidence: 97,
    date: "2026-02-27",
    findings: [
      "The email impersonates the IRS, which never contacts taxpayers by email.",
      "The link leads to a fake website designed to steal your personal information.",
      "The sender address does not match any official IRS domain.",
      "The message creates urgency to pressure you into acting quickly.",
    ],
    suspiciousItems: [
      { label: "irs-refund-claim.xyz", type: "url" },
      { label: "IRS Tax Division", type: "company" },
      { label: "+1 (800) 555-0147", type: "phone" },
    ],
    connectedReports: 23,
  },
  {
    id: "2",
    type: "voice",
    input: "Recording of Medicare benefits call",
    verdict: "scam",
    confidence: 92,
    date: "2026-02-26",
    findings: [
      "The caller claims to be from Medicare but uses an unregistered number.",
      "They asked for your Social Security number, which Medicare never does by phone.",
      "The offer of 'free benefits' is a common Medicare scam tactic.",
    ],
    suspiciousItems: [
      { label: "+1 (888) 555-0923", type: "phone" },
      { label: "Medicare Benefits Center", type: "company" },
    ],
    connectedReports: 47,
  },
  {
    id: "3",
    type: "text",
    input: "Your Amazon order #3847 has been delayed. Click here to confirm delivery: amzn-delivery.co/track",
    verdict: "caution",
    confidence: 78,
    date: "2026-02-25",
    findings: [
      "The link does not go to Amazon's official website.",
      "The order number format looks unusual.",
      "This type of message is commonly used in phishing attempts.",
    ],
    suspiciousItems: [
      { label: "amzn-delivery.co", type: "url" },
      { label: "Amazon", type: "company" },
    ],
    connectedReports: 8,
  },
  {
    id: "4",
    type: "text",
    input: "Hi Grandma, it's me! I lost my phone and I'm using a friend's. Can you send $500 via gift cards?",
    verdict: "scam",
    confidence: 99,
    date: "2026-02-24",
    findings: [
      "This is a classic 'grandparent scam' where someone pretends to be a family member.",
      "Legitimate family members would never ask for gift cards as payment.",
      "The request to keep it secret is a major red flag.",
    ],
    suspiciousItems: [
      { label: "+1 (555) 012-3456", type: "phone" },
    ],
    connectedReports: 156,
  },
  {
    id: "5",
    type: "screenshot",
    input: "Bank of America security alert",
    verdict: "safe",
    confidence: 85,
    date: "2026-02-23",
    findings: [
      "This appears to be a legitimate security alert from Bank of America.",
      "The sender domain matches official Bank of America communications.",
      "No suspicious links or requests for personal information were found.",
    ],
    suspiciousItems: [],
    connectedReports: 0,
  },
];

export const mockThreatFeed: ThreatFeedItem[] = [
  { id: "t1", type: "Phone Scam", source: "FTC Database", time: "2 min ago", severity: "high", description: "New IRS impersonation robocall campaign targeting seniors in Florida" },
  { id: "t2", type: "Phishing Site", source: "ScamAdviser", time: "8 min ago", severity: "high", description: "Fake Medicare enrollment portal discovered at medicare-benefits-2026.com" },
  { id: "t3", type: "SMS Scam", source: "Reddit Reports", time: "15 min ago", severity: "medium", description: "Package delivery scam texts impersonating USPS with tracking links" },
  { id: "t4", type: "Email Scam", source: "FBI IC3", time: "23 min ago", severity: "high", description: "Romance scam operation using AI-generated profile photos on dating apps" },
  { id: "t5", type: "Phone Scam", source: "FTC Database", time: "31 min ago", severity: "medium", description: "Tech support scam claiming computer virus detected via pop-up alerts" },
  { id: "t6", type: "Investment Scam", source: "SEC Alerts", time: "45 min ago", severity: "high", description: "Cryptocurrency investment scheme promising 500% returns in 30 days" },
  { id: "t7", type: "Phishing Site", source: "ScamAdviser", time: "1 hr ago", severity: "low", description: "Suspicious Amazon lookalike domain registered: amazzon-deals.shop" },
  { id: "t8", type: "SMS Scam", source: "Reddit Reports", time: "1.5 hr ago", severity: "medium", description: "Bank account verification texts with links to credential harvesting pages" },
];

export const mockNetworkNodes: NetworkNode[] = [
  { id: "n1", label: "+1 (800) 555-0147", type: "phone", x: 400, y: 300, vx: 0, vy: 0, connections: ["n2", "n3", "n7"] },
  { id: "n2", label: "irs-refund-claim.xyz", type: "url", x: 550, y: 200, vx: 0, vy: 0, connections: ["n1", "n4", "n5"] },
  { id: "n3", label: "IRS Tax Division", type: "company", x: 300, y: 180, vx: 0, vy: 0, connections: ["n1", "n6"] },
  { id: "n4", label: "Report #1847", type: "report", x: 650, y: 350, vx: 0, vy: 0, connections: ["n2", "n5"] },
  { id: "n5", label: "tax-help-center.co", type: "url", x: 700, y: 250, vx: 0, vy: 0, connections: ["n2", "n4", "n8"] },
  { id: "n6", label: "Report #2103", type: "report", x: 200, y: 280, vx: 0, vy: 0, connections: ["n3", "n9"] },
  { id: "n7", label: "+1 (888) 555-0923", type: "phone", x: 350, y: 420, vx: 0, vy: 0, connections: ["n1", "n10", "n11"] },
  { id: "n8", label: "Federal Tax Corp", type: "company", x: 600, y: 150, vx: 0, vy: 0, connections: ["n5", "n12"] },
  { id: "n9", label: "+1 (877) 555-0456", type: "phone", x: 150, y: 350, vx: 0, vy: 0, connections: ["n6", "n13"] },
  { id: "n10", label: "medicare-benefits-2026.com", type: "url", x: 450, y: 480, vx: 0, vy: 0, connections: ["n7", "n11"] },
  { id: "n11", label: "Medicare Benefits Center", type: "company", x: 280, y: 500, vx: 0, vy: 0, connections: ["n7", "n10", "n14"] },
  { id: "n12", label: "Report #3291", type: "report", x: 720, y: 180, vx: 0, vy: 0, connections: ["n8"] },
  { id: "n13", label: "Report #1592", type: "report", x: 100, y: 420, vx: 0, vy: 0, connections: ["n9"] },
  { id: "n14", label: "Report #4087", type: "report", x: 200, y: 550, vx: 0, vy: 0, connections: ["n11"] },
];

export const analysisSteps = [
  { name: "Reka Vision", description: "Scanning for fake logos and phishing layouts..." },
  { name: "Entity Extraction", description: "Finding phone numbers, URLs, and impersonated brands..." },
  { name: "Database Lookup", description: "Checking 47 known scam databases..." },
  { name: "Deep Research", description: "Investigating domain history and scam reports..." },
  { name: "Network Mapping", description: "Connecting to known scam networks..." },
  { name: "Verdict Engine", description: "Putting it all together..." },
];

export const analysisFindings = [
  "Detected suspicious logo resembling official IRS branding",
  "Found 3 phone numbers and 2 URLs embedded in content",
  "Matched 2 entities against known scam databases",
  "Domain registered 3 days ago with privacy protection",
  "Connected to a network of 23 related scam reports",
  "High confidence scam verdict generated",
];

export const scamTrendData = [
  { name: "Phone Scams", value: 340, fill: "hsl(193, 47%, 46%)" },
  { name: "Phishing Emails", value: 280, fill: "hsl(11, 94%, 67%)" },
  { name: "Text/SMS Scams", value: 220, fill: "hsl(39, 100%, 84%)" },
  { name: "Tech Support", value: 180, fill: "hsl(174, 38%, 63%)" },
  { name: "Romance Scams", value: 150, fill: "hsl(193, 47%, 60%)" },
  { name: "Investment Fraud", value: 120, fill: "hsl(11, 94%, 75%)" },
];
