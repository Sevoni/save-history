export type DiffLine = {
  type: "equal" | "add" | "remove";
  oldNo?: number;
  newNo?: number;
  text: string;
};

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  if (n === 0 && m === 0) return [];

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const edits: { type: "equal" | "add" | "remove"; oldIdx: number; newIdx: number }[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      edits.unshift({ type: "equal", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.unshift({ type: "add", oldIdx: -1, newIdx: j - 1 });
      j--;
    } else {
      edits.unshift({ type: "remove", oldIdx: i - 1, newIdx: -1 });
      i--;
    }
  }

  const result: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;

  for (const edit of edits) {
    if (edit.type === "equal") {
      result.push({ type: "equal", oldNo: oldNo++, newNo: newNo++, text: oldLines[edit.oldIdx] });
    } else if (edit.type === "add") {
      result.push({ type: "add", newNo: newNo++, text: newLines[edit.newIdx] });
    } else {
      result.push({ type: "remove", oldNo: oldNo++, text: oldLines[edit.oldIdx] });
    }
  }

  return result;
}
