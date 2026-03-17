function scoreTechnicalFit(startup, candidateProfile) {
  const candidateSkills = (candidateProfile.technicalProfile?.skills || []).map(s => s.toLowerCase());
  const companyStack = (startup.techStack || []).map(s => s.toLowerCase());
  if (!candidateSkills.length || !companyStack.length) return 50;
  const overlap = candidateSkills.filter(s => companyStack.some(cs => cs.includes(s) || s.includes(cs))).length;
  return Math.min(100, Math.round((overlap / Math.max(candidateSkills.length, 1)) * 100));
}

function scoreParameterMatch(startup, searchParams) {
  let score = 0;
  let factors = 0;

  if (searchParams.industries?.length) {
    factors++;
    if (searchParams.industries.some(i => (startup.industry || '').toLowerCase().includes(i.toLowerCase()))) score += 100;
  }
  if (searchParams.fundingStages?.length) {
    factors++;
    if (searchParams.fundingStages.some(f => (startup.fundingStage || '').toLowerCase().includes(f.toLowerCase()))) score += 100;
  }
  if (searchParams.locations?.length) {
    factors++;
    if (searchParams.locations.some(l => (startup.location || '').toLowerCase().includes(l.toLowerCase()))) score += 100;
  }
  if (searchParams.teamSizes?.length) {
    factors++;
    const size = parseInt(startup.teamSize) || 0;
    const ranges = { '1-10': [1, 10], '11-50': [11, 50], '51-200': [51, 200], '201-500': [201, 500], '500+': [500, 10000] };
    if (searchParams.teamSizes.some(t => { const [min, max] = ranges[t] || [0, 10000]; return size >= min && size <= max; })) score += 100;
  }

  return factors > 0 ? Math.round(score / factors) : 50;
}

function scoreVisaFriendliness(startup) {
  if (startup.h1b1Approvals && startup.h1b1Approvals > 0) {
    return Math.min(100, 60 + startup.h1b1Approvals * 5);
  }
  const size = parseInt(startup.teamSize) || 0;
  if (size > 200) return 70;
  if (size > 50) return 50;
  return 30;
}

function scoreTrending(startup) {
  const stage = (startup.fundingStage || '').toLowerCase();
  let score = 40;
  if (stage.includes('series b') || stage.includes('series c')) score += 30;
  else if (stage.includes('series a')) score += 20;
  else if (stage.includes('seed')) score += 10;

  const founded = parseInt(startup.founded);
  if (founded && founded >= 2023) score += 20;
  else if (founded && founded >= 2021) score += 10;

  return Math.min(100, score);
}

export function categorizeStartups({ startups, candidateProfile, searchParams }) {
  const scored = startups.map(startup => {
    const technicalFit = scoreTechnicalFit(startup, candidateProfile);
    const parameterMatch = scoreParameterMatch(startup, searchParams);
    const visaFriendliness = scoreVisaFriendliness(startup);
    const trendingSignal = scoreTrending(startup);
    const overallScore = Math.round(
      technicalFit * 0.35 + parameterMatch * 0.25 + visaFriendliness * 0.25 + trendingSignal * 0.15
    );
    return { ...startup, scores: { technicalFit, parameterMatch, visaFriendliness, trendingSignal, overall: overallScore } };
  });

  scored.sort((a, b) => b.scores.overall - a.scores.overall);

  const exact = scored.filter(s => s.scores.overall >= 75);
  const recommended = scored.filter(s => s.scores.overall >= 50 && s.scores.overall < 75);
  const luck = scored.filter(s => s.scores.overall < 50);

  return { exact, recommended, luck };
}
