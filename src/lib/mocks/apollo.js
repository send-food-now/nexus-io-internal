const CONTACTS_DB = {
  'novaspark.ai': [
    { name: 'Sarah Chen', title: 'CTO', email: 'sarah@novaspark.ai', linkedin: 'https://linkedin.com/in/sarahchen' },
    { name: 'James Park', title: 'VP Engineering', email: 'james@novaspark.ai', linkedin: 'https://linkedin.com/in/jamespark' },
    { name: 'Lisa Wang', title: 'Head of Talent', email: 'lisa@novaspark.ai', linkedin: 'https://linkedin.com/in/lisawang' },
  ],
  'finleap.io': [
    { name: 'David Kumar', title: 'CEO', email: 'david@finleap.io', linkedin: 'https://linkedin.com/in/davidkumar' },
    { name: 'Maria Santos', title: 'Engineering Manager', email: 'maria@finleap.io', linkedin: 'https://linkedin.com/in/mariasantos' },
  ],
  'medsync.health': [
    { name: 'Dr. Rachel Kim', title: 'CTO', email: 'rachel@medsync.health', linkedin: 'https://linkedin.com/in/rachelkim' },
    { name: 'Tom Bradley', title: 'VP Product', email: 'tom@medsync.health', linkedin: 'https://linkedin.com/in/tombradley' },
    { name: 'Aisha Patel', title: 'Recruiting Lead', email: 'aisha@medsync.health', linkedin: 'https://linkedin.com/in/aishapatel' },
  ],
  'devforge.dev': [
    { name: 'Alex Rivera', title: 'Founder & CEO', email: 'alex@devforge.dev', linkedin: 'https://linkedin.com/in/alexrivera' },
    { name: 'Nina Zhao', title: 'Staff Engineer', email: 'nina@devforge.dev', linkedin: 'https://linkedin.com/in/ninazhao' },
  ],
  'carbonpath.com': [
    { name: 'Michael Green', title: 'CEO', email: 'michael@carbonpath.com', linkedin: 'https://linkedin.com/in/michaelgreen' },
    { name: 'Priya Sharma', title: 'CTO', email: 'priya@carbonpath.com', linkedin: 'https://linkedin.com/in/priyasharma' },
  ],
  'shieldnet.io': [
    { name: 'Chris Johnson', title: 'CTO', email: 'chris@shieldnet.io', linkedin: 'https://linkedin.com/in/chrisjohnson' },
    { name: 'Eva Martinez', title: 'Head of Engineering', email: 'eva@shieldnet.io', linkedin: 'https://linkedin.com/in/evamartinez' },
    { name: 'Ryan Lee', title: 'People Ops', email: 'ryan@shieldnet.io', linkedin: 'https://linkedin.com/in/ryanlee' },
  ],
};

function generateContacts(domain) {
  const hash = domain.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return [
    { name: `Contact A (${domain})`, title: 'Engineering Lead', email: `hiring@${domain}`, linkedin: `https://linkedin.com/company/${domain.split('.')[0]}` },
    { name: `Contact B (${domain})`, title: 'Head of Talent', email: `talent@${domain}`, linkedin: `https://linkedin.com/company/${domain.split('.')[0]}` },
  ];
}

export function searchCompanies(query) {
  return Object.keys(CONTACTS_DB).map(domain => ({
    name: domain.split('.')[0],
    domain,
    employeeCount: Math.floor(Math.random() * 200) + 10,
    industry: 'Technology',
    linkedin: `https://linkedin.com/company/${domain.split('.')[0]}`,
  }));
}

export function getContacts(domain) {
  return CONTACTS_DB[domain] || generateContacts(domain);
}
