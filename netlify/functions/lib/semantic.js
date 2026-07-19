// ─────────────────────────────────────────────────────────────────────────────
// Semantic keyword matching engine
// Uses TF-IDF + cosine similarity to score resume-to-job relevance.
// No external APIs or vector DBs needed — runs entirely in the function.
//
// Approach inspired by: github.com/srbhr/Resume-Matcher
// ─────────────────────────────────────────────────────────────────────────────

// ── Stop words — filtered out before analysis ─────────────────────────────────
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','shall','can',
  'not','no','nor','so','yet','both','either','neither','each','few','more',
  'most','other','some','such','than','too','very','just','because','as','until',
  'while','about','against','between','into','through','during','before','after',
  'above','below','up','down','out','off','over','under','then','once','here',
  'there','when','where','why','how','all','any','both','each','this','that',
  'these','those','i','you','he','she','it','we','they','what','which','who',
  'whom','its','our','your','their','my','his','her','we','us','them','me',
  'him','also','well','get','got','use','used','using','make','made','work',
  'working','worked','new','good','great','best','high','strong','large',
  'key','must','able','need','provide','support','ensure','help','improve',
  'including','including','across','within','following','required','preferred',
  'experience','years','year','looking','seeking','candidate','position','role',
  'team','company','business','opportunity','responsibilities','requirements',
]);

// Tech synonyms — maps variants to canonical forms for better matching
const SYNONYMS = {
  'ml': 'machine learning',
  'ai': 'artificial intelligence',
  'nlp': 'natural language processing',
  'cv': 'computer vision',
  'dl': 'deep learning',
  'nn': 'neural network',
  'bi': 'business intelligence',
  'etl': 'extract transform load',
  'ci': 'continuous integration',
  'cd': 'continuous deployment',
  'oop': 'object oriented programming',
  'api': 'application programming interface',
  'rest': 'restful api',
  'sql': 'structured query language',
  'nosql': 'non relational database',
  'aws': 'amazon web services',
  'gcp': 'google cloud platform',
  'k8s': 'kubernetes',
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'ml ops': 'mlops',
  'data eng': 'data engineer',
  'swe': 'software engineer',
};

// Tech domain keywords — given extra weight in scoring
const TECH_KEYWORDS = new Set([
  'python','java','javascript','typescript','golang','rust','scala','kotlin',
  'react','vue','angular','node','django','flask','fastapi','spring','rails',
  'sql','mysql','postgresql','mongodb','redis','elasticsearch','kafka','spark',
  'hadoop','airflow','dbt','snowflake','redshift','bigquery','databricks',
  'aws','gcp','azure','docker','kubernetes','terraform','ansible','jenkins',
  'git','ci/cd','linux','bash','rest','graphql','grpc','microservices',
  'machine learning','deep learning','tensorflow','pytorch','scikit','pandas',
  'numpy','mlops','data pipeline','etl','data warehouse','data lake',
  'tableau','powerbi','looker','dax','spark','pyspark','airflow','prefect',
  'langchain','llm','rag','vector','embedding','transformer','bert','gpt',
  'agile','scrum','kanban','devops','sre','cloud','serverless','lambda',
]);

// ── Text preprocessing ────────────────────────────────────────────────────────
function tokenize(text) {
  return text
    .toLowerCase()
    // Keep alphanumeric, spaces, forward slash (for ci/cd), dot (for node.js)
    .replace(/[^a-z0-9\s./+-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map((t) => SYNONYMS[t] || t);
}

// Extract n-grams (bigrams + unigrams) for phrase matching
function extractNgrams(tokens, n = 2) {
  const ngrams = [...tokens];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

// Term frequency — how often each term appears in document
function computeTF(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  // Normalize by doc length
  const len = tokens.length || 1;
  for (const t in tf) tf[t] /= len;
  return tf;
}

// Inverse document frequency across a corpus of docs
function computeIDF(corpus) {
  const df = {};
  const N = corpus.length;
  for (const doc of corpus) {
    const unique = new Set(doc);
    for (const t of unique) df[t] = (df[t] || 0) + 1;
  }
  const idf = {};
  for (const t in df) idf[t] = Math.log(N / df[t]) + 1;
  return idf;
}

// TF-IDF vector for a document
function tfidfVector(tf, idf, vocab) {
  const vec = {};
  for (const t of vocab) {
    const weight = TECH_KEYWORDS.has(t) ? 2.0 : 1.0; // boost tech terms
    vec[t] = (tf[t] || 0) * (idf[t] || 1) * weight;
  }
  return vec;
}

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const va = a[k] || 0, vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Main API ──────────────────────────────────────────────────────────────────

/**
 * Score semantic similarity between resume and job description.
 * Returns a score 0–100 and detailed keyword analysis.
 */
function scoreSemanticMatch(resumeText, jobText) {
  const resumeTokens = extractNgrams(tokenize(resumeText));
  const jobTokens    = extractNgrams(tokenize(jobText));

  const corpus = [resumeTokens, jobTokens];
  const idf    = computeIDF(corpus);
  const vocab  = Object.keys(idf);

  const resumeTF  = computeTF(resumeTokens);
  const jobTF     = computeTF(jobTokens);
  const resumeVec = tfidfVector(resumeTF, idf, vocab);
  const jobVec    = tfidfVector(jobTF, idf, vocab);

  const similarity = cosineSimilarity(resumeVec, jobVec);
  const score = Math.round(Math.min(100, similarity * 180)); // scale to 0-100

  // ── Keyword gap analysis ──────────────────────────────────────────────────
  // Find important job keywords missing or weak in resume
  const jobKeywords = Object.entries(jobTF)
    .filter(([t]) => !STOP_WORDS.has(t) && t.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([t]) => t);

  const matched = [];
  const missing = [];

  for (const kw of jobKeywords) {
    const inResume = resumeTF[kw] || resumeTokens.filter((t) => t.includes(kw)).length > 0;
    const isTech = TECH_KEYWORDS.has(kw) || kw.split(' ').some((w) => TECH_KEYWORDS.has(w));
    if (inResume) {
      matched.push(kw);
    } else if (isTech || kw.length > 4) {
      missing.push(kw);
    }
  }

  // ── Section-level analysis ────────────────────────────────────────────────
  // Break resume into sections and score each against job
  const sections = extractSections(resumeText);
  const sectionScores = sections.map((s) => ({
    name: s.name,
    score: Math.round(Math.min(100,
      cosineSimilarity(
        tfidfVector(computeTF(extractNgrams(tokenize(s.text))), idf, vocab),
        jobVec
      ) * 180
    )),
  }));

  return {
    score,
    similarity: Math.round(similarity * 1000) / 1000,
    matchedKeywords: matched.slice(0, 15),
    missingKeywords: missing.slice(0, 15),
    sectionScores,
    totalJobKeywords: jobKeywords.length,
    matchRate: Math.round((matched.length / Math.max(jobKeywords.length, 1)) * 100),
  };
}

// Extract named sections from resume text
function extractSections(text) {
  const sectionHeaders = [
    { pattern: /experience|work history|employment/i, name: 'Experience' },
    { pattern: /skills|technical skills|core competencies/i, name: 'Skills' },
    { pattern: /education|academic/i, name: 'Education' },
    { pattern: /projects|portfolio/i, name: 'Projects' },
    { pattern: /summary|objective|profile/i, name: 'Summary' },
    { pattern: /certifications?|credentials/i, name: 'Certifications' },
  ];

  const lines = text.split('\n');
  const sections = [];
  let currentSection = { name: 'General', text: '' };

  for (const line of lines) {
    const header = sectionHeaders.find((s) => s.pattern.test(line) && line.length < 50);
    if (header) {
      if (currentSection.text.trim()) sections.push(currentSection);
      currentSection = { name: header.name, text: '' };
    } else {
      currentSection.text += ' ' + line;
    }
  }
  if (currentSection.text.trim()) sections.push(currentSection);
  return sections.filter((s) => s.text.trim().length > 20);
}

/**
 * Score multiple jobs against a resume in batch.
 * More efficient than scoring one at a time.
 * Returns array of { idx, score, matchedKeywords, missingKeywords, matchRate }
 */
function batchScoreJobs(resumeText, jobs) {
  const resumeTokens = extractNgrams(tokenize(resumeText));

  return jobs.map((job, idx) => {
    const jobText = `${job.title} ${job.company} ${job.description}`;
    try {
      const result = scoreSemanticMatch(resumeText, jobText);
      return {
        idx,
        score: result.score,
        matchRate: result.matchRate,
        matchedKeywords: result.matchedKeywords,
        missingKeywords: result.missingKeywords,
      };
    } catch {
      return { idx, score: 65, matchRate: 50, matchedKeywords: [], missingKeywords: [] };
    }
  });
}

module.exports = { scoreSemanticMatch, batchScoreJobs, tokenize, TECH_KEYWORDS };
