/**
 * 이미지를 base64 Data URL로 변환합니다.
 * Firebase Storage CORS 이슈를 피하기 위해 base64 방식을 사용합니다.
 * 스크린샷 등 일반 이미지는 300~500KB 수준으로 Firestore 문서에 저장 가능합니다.
 */
export function uploadQuestionImage(file: File, _examId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지 변환에 실패했습니다.'));
    reader.readAsDataURL(file);
  });
}
