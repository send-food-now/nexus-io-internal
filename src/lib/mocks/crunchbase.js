const STARTUPS = [
  { name: 'NovaSpark AI', domain: 'novaspark.ai', description: 'AI-powered code review and debugging platform', industry: 'AI/ML', fundingStage: 'Series A', fundingAmount: '$12M', teamSize: '35', location: 'San Francisco', founded: '2022', techStack: ['Python', 'TypeScript', 'React', 'PyTorch', 'Kubernetes'] },
  { name: 'FinLeap', domain: 'finleap.io', description: 'Next-gen payment infrastructure for emerging markets', industry: 'Fintech', fundingStage: 'Seed', fundingAmount: '$4.5M', teamSize: '18', location: 'New York', founded: '2023', techStack: ['Go', 'React', 'PostgreSQL', 'AWS', 'Stripe'] },
  { name: 'MedSync Health', domain: 'medsync.health', description: 'AI clinical decision support for rural hospitals', industry: 'Healthcare', fundingStage: 'Series B', fundingAmount: '$28M', teamSize: '120', location: 'Boston', founded: '2020', techStack: ['Python', 'React', 'FHIR', 'AWS', 'TensorFlow'] },
  { name: 'DevForge', domain: 'devforge.dev', description: 'Cloud-native developer environments with instant preview', industry: 'DevTools', fundingStage: 'Series A', fundingAmount: '$15M', teamSize: '42', location: 'San Francisco', founded: '2021', techStack: ['Rust', 'TypeScript', 'React', 'Docker', 'WebAssembly'] },
  { name: 'CarbonPath', domain: 'carbonpath.com', description: 'Carbon credit marketplace with blockchain verification', industry: 'Climate', fundingStage: 'Seed', fundingAmount: '$6M', teamSize: '22', location: 'Austin', founded: '2023', techStack: ['TypeScript', 'Next.js', 'Solidity', 'PostgreSQL', 'GCP'] },
  { name: 'ShieldNet Cyber', domain: 'shieldnet.io', description: 'Zero-trust network security for distributed teams', industry: 'Cybersecurity', fundingStage: 'Series A', fundingAmount: '$20M', teamSize: '65', location: 'Seattle', founded: '2021', techStack: ['Go', 'Rust', 'React', 'Kubernetes', 'WireGuard'] },
  { name: 'EduBridge', domain: 'edubridge.co', description: 'Personalized learning platform powered by adaptive AI', industry: 'EdTech', fundingStage: 'Pre-seed', fundingAmount: '$1.2M', teamSize: '8', location: 'Remote', founded: '2024', techStack: ['Python', 'Next.js', 'OpenAI', 'PostgreSQL', 'Vercel'] },
  { name: 'QuickShelf', domain: 'quickshelf.com', description: 'Headless commerce platform for indie brands', industry: 'E-commerce', fundingStage: 'Series A', fundingAmount: '$11M', teamSize: '38', location: 'Los Angeles', founded: '2022', techStack: ['TypeScript', 'Next.js', 'GraphQL', 'Stripe', 'Algolia'] },
  { name: 'SynthBio Labs', domain: 'synthbio.com', description: 'AI-driven protein design for drug discovery', industry: 'Biotech', fundingStage: 'Series B', fundingAmount: '$45M', teamSize: '85', location: 'Boston', founded: '2019', techStack: ['Python', 'JAX', 'React', 'AWS', 'AlphaFold'] },
  { name: 'DataPulse', domain: 'datapulse.dev', description: 'Real-time data pipeline observability', industry: 'DevTools', fundingStage: 'Seed', fundingAmount: '$5M', teamSize: '15', location: 'San Francisco', founded: '2023', techStack: ['Rust', 'TypeScript', 'React', 'ClickHouse', 'Kafka'] },
  { name: 'PayFlow', domain: 'payflow.co', description: 'B2B invoicing and accounts receivable automation', industry: 'Fintech', fundingStage: 'Series A', fundingAmount: '$18M', teamSize: '55', location: 'New York', founded: '2021', techStack: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Plaid'] },
  { name: 'GreenGrid Energy', domain: 'greengrid.energy', description: 'Smart grid optimization for renewable energy', industry: 'Climate', fundingStage: 'Series B', fundingAmount: '$35M', teamSize: '90', location: 'Austin', founded: '2020', techStack: ['Python', 'React', 'TensorFlow', 'TimescaleDB', 'AWS'] },
];

function teamSizeInRange(size, range) {
  const num = parseInt(size);
  const ranges = { '1-10': [1, 10], '11-50': [11, 50], '51-200': [51, 200], '201-500': [201, 500], '500+': [500, 10000] };
  const [min, max] = ranges[range] || [0, 10000];
  return num >= min && num <= max;
}

export function searchStartups({ industries = [], fundingStages = [], locations = [], teamSizes = [] }) {
  return STARTUPS.filter(s => {
    if (industries.length && !industries.some(i => s.industry.toLowerCase().includes(i.toLowerCase()))) return false;
    if (fundingStages.length && !fundingStages.some(f => s.fundingStage.toLowerCase().includes(f.toLowerCase()))) return false;
    if (locations.length && !locations.some(l => s.location.toLowerCase().includes(l.toLowerCase()))) return false;
    if (teamSizes.length && !teamSizes.some(t => teamSizeInRange(s.teamSize, t))) return false;
    return true;
  });
}
