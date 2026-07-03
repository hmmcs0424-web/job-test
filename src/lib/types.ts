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
  isActive?: boolean; // false = 비활성(퇴사 등), undefined/true = 활성
}

export type QuestionType = 'multiple' | 'short' | 'long' | 'ox';

export interface ExplanationLink {
  label: string;
  url: string;
}

export interface Explanation {
  text?: string;
  imageUrl?: string;
  links?: ExplanationLink[];
}

export interface Question {
  id: string;
  examId: string;
  order: number;
  type: QuestionType;
  content: string;
  imageUrl?: string;       // 문제 이미지
  options?: string[];
  answer: string;
  score: number;
  explanation?: Explanation; // 풀이
}

export type ExamStatus = 'draft' | 'active' | 'closed';

export interface Exam {
  id: string;
  title: string;
  type: string;
  targetParts: string[];
  targetStaffIds?: string[];          // 응시 대상 개별 인원 ID 목록
  absentReasons?: Record<string, string>; // staffId → 미응시 사유
  status: ExamStatus;
  timeLimit: number;
  startDate: string;
  endDate: string;
  questionCount: number;
  createdAt: string;
  resultVisibleUntil?: string; // 마감 후 상담사에게 결과를 노출하는 종료일(YYYY-MM-DD). 미설정 시 무기한 노출.
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
