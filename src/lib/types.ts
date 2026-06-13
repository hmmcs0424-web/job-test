export interface Part {
  id: string;
  name: string;
  order: number;
}

export interface Staff {
  id: string;
  name: string;
  employeeId: string;
  partId: string;
  partName?: string;
  createdAt: string;
}

export type QuestionType = 'multiple' | 'short' | 'ox';

export interface Question {
  id: string;
  examId: string;
  order: number;
  type: QuestionType;
  content: string;
  options?: string[];
  answer: string;
  score: number;
}

export type ExamStatus = 'draft' | 'active' | 'closed';

export interface Exam {
  id: string;
  title: string;
  type: string;
  targetParts: string[];
  status: ExamStatus;
  timeLimit: number;
  startDate: string;
  endDate: string;
  questionCount: number;
  createdAt: string;
}

export interface AnswerRecord {
  given: string;
  isCorrect: boolean;
  score: number;
}

export interface EditHistory {
  questionId: string;
  before: AnswerRecord;
  after: AnswerRecord;
  reason: string;
  editedBy: string;
  editedAt: string;
}

export interface Result {
  id: string;
  examId: string;
  examTitle: string;
  staffId: string;
  staffName: string;
  staffEmployeeId: string;
  partId: string;
  startedAt: string;
  submittedAt: string;
  answers: Record<string, AnswerRecord>;
  totalScore: number;
  maxScore: number;
  passed: boolean;
  editHistory: EditHistory[];
}
