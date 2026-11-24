/** The tips acknowledgement is an authored preference, scoped to the user on this browser. */
export function hasSeenAnnotationTips(userId: string) {
  try {
    return localStorage.getItem("aedesvision:annotation-tips:" + userId) === "seen";
  } catch (error) {
    console.warn("Unable to read annotation tips preference", error);
    return false;
  }
}
export function rememberAnnotationTips(userId: string) {
  try {
    localStorage.setItem("aedesvision:annotation-tips:" + userId, "seen");
  } catch (error) {
    console.warn("Unable to save annotation tips preference", error);
  }
}
