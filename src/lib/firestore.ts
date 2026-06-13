import {
  collection, doc, getDocs, getDoc, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import type { Part, Staff, Exam, Question, Result } from './types';

// Parts
export async function getParts(): Promise<Part[]> {
  const snap = await getDocs(query(collection(db, 'parts'), orderBy('order')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Part));
}

export async function addPart(data: Omit<Part, 'id'>) {
  return addDoc(collection(db, 'parts'), data);
}

export async function updatePart(id: string, data: Partial<Part>) {
  return updateDoc(doc(db, 'parts', id), data);
}

export async function deletePart(id: string) {
  return deleteDoc(doc(db, 'parts', id));
}

// Staff
export async function getStaffList(): Promise<Staff[]> {
  const snap = await getDocs(collection(db, 'staff'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff));
}

export async function getStaffByPartId(partId: string): Promise<Staff[]> {
  const snap = await getDocs(query(collection(db, 'staff'), where('partId', '==', partId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff));
}

export async function findStaff(name: string, employeeId: string): Promise<Staff | null> {
  const snap = await getDocs(
    query(collection(db, 'staff'), where('name', '==', name), where('employeeId', '==', employeeId))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Staff;
}

export async function addStaff(data: Omit<Staff, 'id'>) {
  return addDoc(collection(db, 'staff'), { ...data, createdAt: new Date().toISOString() });
}

export async function updateStaff(id: string, data: Partial<Staff>) {
  return updateDoc(doc(db, 'staff', id), data);
}

export async function deleteStaff(id: string) {
  return deleteDoc(doc(db, 'staff', id));
}

// Exams
export async function getExams(): Promise<Exam[]> {
  const snap = await getDocs(query(collection(db, 'exams'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
}

export async function getExam(id: string): Promise<Exam | null> {
  const snap = await getDoc(doc(db, 'exams', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Exam;
}

export async function getActiveExamsForPart(partId: string): Promise<Exam[]> {
  const snap = await getDocs(
    query(collection(db, 'exams'), where('status', '==', 'active'))
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Exam))
    .filter(e => e.targetParts.includes(partId) || e.targetParts.includes('all'));
}

export async function addExam(data: Omit<Exam, 'id'>) {
  return addDoc(collection(db, 'exams'), data);
}

export async function updateExam(id: string, data: Partial<Exam>) {
  return updateDoc(doc(db, 'exams', id), data);
}

export async function deleteExam(id: string) {
  return deleteDoc(doc(db, 'exams', id));
}

export async function getActiveExams(): Promise<Exam[]> {
  const snap = await getDocs(
    query(collection(db, 'exams'), where('status', '==', 'active'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
}

// Questions
export async function getQuestions(examId: string): Promise<Question[]> {
  const snap = await getDocs(
    query(collection(db, 'questions'), where('examId', '==', examId))
  );
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Question));
  return docs.sort((a, b) => a.order - b.order);
}

export async function addQuestion(data: Omit<Question, 'id'>) {
  return addDoc(collection(db, 'questions'), data);
}

export async function updateQuestion(id: string, data: Partial<Question>) {
  return updateDoc(doc(db, 'questions', id), data);
}

export async function deleteQuestion(id: string) {
  return deleteDoc(doc(db, 'questions', id));
}

export async function deleteQuestionsByExam(examId: string) {
  const snap = await getDocs(query(collection(db, 'questions'), where('examId', '==', examId)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

// Results
export async function getResults(): Promise<Result[]> {
  const snap = await getDocs(query(collection(db, 'results'), orderBy('submittedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Result));
}

export async function getResultsByExam(examId: string): Promise<Result[]> {
  const snap = await getDocs(query(collection(db, 'results'), where('examId', '==', examId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Result));
}

export async function getResultsByStaff(staffId: string): Promise<Result[]> {
  const snap = await getDocs(query(collection(db, 'results'), where('staffId', '==', staffId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Result));
}

export async function getResultByExamAndStaff(examId: string, staffId: string): Promise<Result | null> {
  const snap = await getDocs(
    query(collection(db, 'results'), where('examId', '==', examId), where('staffId', '==', staffId))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Result;
}

export async function addResult(data: Omit<Result, 'id'>) {
  return addDoc(collection(db, 'results'), data);
}

export async function updateResult(id: string, data: Partial<Result>) {
  return updateDoc(doc(db, 'results', id), data);
}

// Admin config
export async function getAdminConfig() {
  const snap = await getDoc(doc(db, 'admin', 'config'));
  return snap.exists() ? snap.data() : null;
}

export async function setAdminConfig(data: object) {
  return setDoc(doc(db, 'admin', 'config'), data, { merge: true });
}
