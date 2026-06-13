import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadImage(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function uploadQuestionImage(file: File, examId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `questions/${examId}/${Date.now()}.${ext}`;
  return uploadImage(file, path);
}
