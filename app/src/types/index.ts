// Message types
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  icd10Codes?: string[];
  cptCodes?: string[];
  npi?: string;
  policyRefs?: string[];
}

// Conversation types
export interface Conversation {
  id: string;
  title?: string;
  status: "active" | "completed" | "archived";
  isAppeal: boolean;
  messages: Message[];
  startedAt: Date;
  completedAt?: Date;
}

// User types
export interface User {
  id: string;
  phone: string;
  email?: string;
  plan: "free" | "per_appeal" | "unlimited";
  theme: "auto" | "light" | "dark";
  textSize: number;
  highContrast: boolean;
}

// Chat response from Edge function
export interface ChatResponse {
  conversationId: string;
  message: Message;
  suggestions: string[];
  state: {
    stage: "intake" | "coverage" | "guidance" | "appeal";
    hasGuidance: boolean;
    canPrint: boolean;
  };
}

// Appeal types
export interface Appeal {
  id: string;
  conversationId: string;
  phone: string;
  denialDate?: Date;
  denialReason?: string;
  serviceDescription?: string;
  appealLetter: string;
  icd10Codes?: string[];
  cptCodes?: string[];
  ncdRefs?: string[];
  lcdRefs?: string[];
  pubmedRefs?: string[];
  deadline?: Date;
  status: "draft" | "sent" | "approved" | "denied" | "pending";
  paid: boolean;
}
