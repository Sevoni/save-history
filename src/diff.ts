export type CharRange = { start: number; end: number };

export type CharEdit = { type: "equal" | "remove" | "add"; text: string };

export type DiffLine = {
  type: "equal" | "add" | "remove" | "change";
  oldNo?: number;
  newNo?: number;
  text: string;
  oldText?: string;
  charRanges?: CharRange[];
  interleaved?: CharEdit[];
};

const MERGE_THRESHOLD = 0.3;

function charLCS(a: string, b: string): number[][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function charDiffRanges(oldStr: string, newStr: string): { oldRanges: CharRange[]; newRanges: CharRange[] } {
  if (oldStr === newStr) return { oldRanges: [], newRanges: [] };

  const dp = charLCS(oldStr, newStr);
  const oldHighlights = Array.from({ length: oldStr.length }, () => true);
  const newHighlights = Array.from({ length: newStr.length }, () => true);

  let i = oldStr.length;
  let j = newStr.length;

  while (i > 0 && j > 0) {
    if (oldStr[i - 1] === newStr[j - 1]) {
      oldHighlights[i - 1] = false;
      newHighlights[j - 1] = false;
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const toRanges = (flags: boolean[]): CharRange[] => {
    const ranges: CharRange[] = [];
    let start = -1;
    for (let k = 0; k <= flags.length; k++) {
      if (k < flags.length && flags[k]) {
        if (start === -1) start = k;
      } else {
        if (start !== -1) {
          ranges.push({ start, end: k });
          start = -1;
        }
      }
    }
    return ranges;
  };

  return { oldRanges: toRanges(oldHighlights), newRanges: toRanges(newHighlights) };
}

function computeCharSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dp = charLCS(a, b);
  return dp[a.length][b.length] / maxLen;
}

function interleaveCharDiff(oldStr: string, newStr: string): CharEdit[] {
  if (oldStr === newStr) return [{ type: "equal", text: oldStr }];

  const dp = charLCS(oldStr, newStr);
  const raw: CharEdit[] = [];
  let i = oldStr.length;
  let j = newStr.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldStr[i - 1] === newStr[j - 1]) {
      raw.unshift({ type: "equal", text: oldStr[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "add", text: newStr[j - 1] });
      j--;
    } else {
      raw.unshift({ type: "remove", text: oldStr[i - 1] });
      i--;
    }
  }

  const merged: CharEdit[] = [];
  for (const edit of raw) {
    const last = merged[merged.length - 1];
    if (last && last.type === edit.type) {
      last.text += edit.text;
    } else {
      merged.push({ ...edit });
    }
  }
  return merged;
}

function pairAndHighlight(block: DiffLine[]): [number, number][] {
  const removes = block.filter(l => l.type === "remove");
  const adds = block.filter(l => l.type === "add");

  if (removes.length === 0 || adds.length === 0) return [];

  const usedRemoves = new Set<number>();
  const usedAdds = new Set<number>();

  const pairs: [number, number][] = [];

  for (let iter = 0; iter < Math.min(removes.length, adds.length); iter++) {
    let bestScore = -1;
    let bestR = -1;
    let bestA = -1;

    for (let r = 0; r < removes.length; r++) {
      if (usedRemoves.has(r)) continue;
      for (let a = 0; a < adds.length; a++) {
        if (usedAdds.has(a)) continue;
        const score = computeCharSimilarity(removes[r].text, adds[a].text);
        if (score > bestScore) {
          bestScore = score;
          bestR = r;
          bestA = a;
        }
      }
    }

    if (bestR === -1) break;

    usedRemoves.add(bestR);
    usedAdds.add(bestA);
    pairs.push([bestR, bestA]);
  }

  for (const [rIdx, aIdx] of pairs) {
    const { oldRanges, newRanges } = charDiffRanges(removes[rIdx].text, adds[aIdx].text);
    if (oldRanges.length > 0) removes[rIdx].charRanges = oldRanges;
    if (newRanges.length > 0) adds[aIdx].charRanges = newRanges;
  }

  return pairs;
}

function mergeBlock(block: DiffLine[], pairs: [number, number][]): DiffLine[] {
  const removes = block.filter(l => l.type === "remove");
  const adds = block.filter(l => l.type === "add");

  const mergedRemoveIdx = new Set<number>();
  const consumedAddIdx = new Set<number>();
  const mergedLines: { atBlockIdx: number; line: DiffLine }[] = [];

  for (const [rIdx, aIdx] of pairs) {
    const sim = computeCharSimilarity(removes[rIdx].text, adds[aIdx].text);
    if (sim > MERGE_THRESHOLD) {
      const blockIdx = block.indexOf(removes[rIdx]);
      mergedLines.push({
        atBlockIdx: blockIdx,
        line: {
          type: "change",
          oldNo: removes[rIdx].oldNo,
          newNo: adds[aIdx].newNo,
          text: adds[aIdx].text,
          oldText: removes[rIdx].text,
          interleaved: interleaveCharDiff(removes[rIdx].text, adds[aIdx].text),
        },
      });
      mergedRemoveIdx.add(blockIdx);
      consumedAddIdx.add(block.indexOf(adds[aIdx]));
    }
  }

  if (mergedRemoveIdx.size === 0) return block;

  const result: DiffLine[] = [];
  for (let i = 0; i < block.length; i++) {
    if (consumedAddIdx.has(i)) continue;
    const merged = mergedLines.find(m => m.atBlockIdx === i);
    if (merged) {
      result.push(merged.line);
    } else {
      result.push(block[i]);
    }
  }
  return result;
}

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

  let idx = 0;
  while (idx < result.length) {
    if (result[idx].type !== "equal") {
      const blockStart = idx;
      while (idx < result.length && result[idx].type !== "equal") idx++;
      const block = result.slice(blockStart, idx);
      const hasRemove = block.some(l => l.type === "remove");
      const hasAdd = block.some(l => l.type === "add");
      if (hasRemove && hasAdd) {
        const pairs = pairAndHighlight(block);
        const merged = mergeBlock(block, pairs);
        result.splice(blockStart, block.length, ...merged);
        idx = blockStart + merged.length;
      }
    } else {
      idx++;
    }
  }

  return result;
}
