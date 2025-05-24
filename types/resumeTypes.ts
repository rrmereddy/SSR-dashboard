export type Suggestion = {
  id: string;
  original: string;
  suggestion: string;
  accepted?: boolean;
};

export interface ParsedContent {
  text: string;
  type: "regular" | "highlight";
  suggestionId?: string;
}

export type Section = {
  id: string;
  type: string; // e.g., "experience", "education", "skills", "projects", "certifications"
  title: string;
  subtitle?: string;
  content: string;
  startDate?: string;
  endDate?: string;
  location?: string;
};

export type ResumeScoreCriteria = {
  name: string;
  score: number;
  feedback: string;
  improvements: string[];
};

export type ResumeScore = {
  overallScore: number;
  criteria: ResumeScoreCriteria[];
};

export type ResumeContact = {
  name: string;
  email: string;
  phone: string;
  location: string;
};

export type Resume = {
  contact: ResumeContact;
  sections: Section[];
};

// Payload from the main analysis server action
export type ResumeAnalysisPayload = {
  analyzedText: string;
  suggestions: Record<string, Suggestion>;
  parsedContent: ParsedContent[];
  resumeScore: ResumeScore | null;
};

// Payload for the builder structuring server action
export type ResumeStructurePayload = Resume;