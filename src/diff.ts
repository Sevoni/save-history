import { Modal } from "obsidian";
import { SaveHistoryPlugin } from "./main";

export type DiffLine = {
	type: "add" | "remove" | "unchanged";
	oldLineNo?: number;
	newLineNo?: number;
	content: string;
};

export function computeDiff(oldText: string, newText: string): DiffLine[] {
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");

	const lcs = computeLCS(oldLines, newLines);
	return buildDiffLines(oldLines, newLines, lcs);
}

function computeLCS(a: string[], b: string[]): number[][] {
	const m = a.length;
	const n = b.length;
	const dp: number[][] = [];

	for (let i = 0; i <= m; i++) {
		dp[i] = [];
		for (let j = 0; j <= n; j++) {
			if (i === 0 || j === 0) {
				dp[i][j] = 0;
			} else if (a[i - 1] === b[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}
	return dp;
}

function buildDiffLines(
	oldLines: string[],
	newLines: string[],
	dp: number[][]
): DiffLine[] {
	const result: DiffLine[] = [];
	let i = oldLines.length;
	let j = newLines.length;

	const reversed: DiffLine[] = [];

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
			reversed.push({
				type: "unchanged",
				oldLineNo: i,
				newLineNo: j,
				content: oldLines[i - 1],
			});
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			reversed.push({
				type: "add",
				newLineNo: j,
				content: newLines[j - 1],
			});
			j--;
		} else {
			reversed.push({
				type: "remove",
				oldLineNo: i,
				content: oldLines[i - 1],
			});
			i--;
		}
	}

	for (let k = reversed.length - 1; k >= 0; k--) {
		result.push(reversed[k]);
	}

	return result;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

export function renderUnifiedDiff(el: HTMLElement, diff: DiffLine[]): void {
	el.empty();

	const table = el.createEl("table");
	table.style.width = "100%";
	table.style.borderCollapse = "collapse";
	table.style.fontSize = "0.85em";
	table.style.fontFamily = "var(--font-monospace)";

	for (const line of diff) {
		const tr = table.createEl("tr");

		if (line.type === "add") {
			tr.style.backgroundColor = "var(--background-modifier-success, rgba(0,180,0,0.12))";
		} else if (line.type === "remove") {
			tr.style.backgroundColor = "var(--background-modifier-error, rgba(180,0,0,0.12))";
		}

		const numOld = tr.createEl("td");
		numOld.style.padding = "0 6px";
		numOld.style.textAlign = "right";
		numOld.style.color = "var(--text-faint)";
		numOld.style.width = "40px";
		numOld.style.userSelect = "none";
		numOld.textContent = line.oldLineNo != null ? String(line.oldLineNo) : "";

		const numNew = tr.createEl("td");
		numNew.style.padding = "0 6px";
		numNew.style.textAlign = "right";
		numNew.style.color = "var(--text-faint)";
		numNew.style.width = "40px";
		numNew.style.userSelect = "none";
		numNew.textContent = line.newLineNo != null ? String(line.newLineNo) : "";

		const marker = tr.createEl("td");
		marker.style.padding = "0 4px";
		marker.style.textAlign = "center";
		marker.style.width = "16px";
		marker.style.userSelect = "none";
		marker.style.fontWeight = "bold";
		if (line.type === "add") {
			marker.textContent = "+";
			marker.style.color = "var(--text-success, #4caf50)";
		} else if (line.type === "remove") {
			marker.textContent = "-";
			marker.style.color = "var(--text-error, #f44336)";
		} else {
			marker.textContent = " ";
		}

		const content = tr.createEl("td");
		content.style.padding = "0 8px";
		content.style.whiteSpace = "pre-wrap";
		content.style.wordBreak = "break-all";
		content.innerHTML = escapeHtml(line.content);
	}
}

export function renderSideBySideDiff(el: HTMLElement, diff: DiffLine[]): void {
	el.empty();

	const leftLines: { lineNo?: number; content: string; type: string }[] = [];
	const rightLines: { lineNo?: number; content: string; type: string }[] = [];

	for (const line of diff) {
		if (line.type === "unchanged") {
			leftLines.push({ lineNo: line.oldLineNo, content: line.content, type: "unchanged" });
			rightLines.push({ lineNo: line.newLineNo, content: line.content, type: "unchanged" });
		} else if (line.type === "remove") {
			leftLines.push({ lineNo: line.oldLineNo, content: line.content, type: "remove" });
			rightLines.push({ lineNo: undefined, content: "", type: "empty" });
		} else if (line.type === "add") {
			leftLines.push({ lineNo: undefined, content: "", type: "empty" });
			rightLines.push({ lineNo: line.newLineNo, content: line.content, type: "add" });
		}
	}

	const maxRows = Math.max(leftLines.length, rightLines.length);
	const container = el.createDiv();
	container.style.display = "flex";
	container.style.gap = "2px";
	container.style.fontSize = "0.85em";
	container.style.fontFamily = "var(--font-monospace)";

	const renderColumn = (
		parent: HTMLElement,
		title: string,
		lines: { lineNo?: number; content: string; type: string }[]
	) => {
		const col = parent.createDiv();
		col.style.flex = "1";
		col.style.overflow = "auto";
		col.style.border = "1px solid var(--background-modifier-border)";
		col.style.borderRadius = "4px";

		const header = col.createDiv();
		header.style.padding = "4px 8px";
		header.style.fontWeight = "bold";
		header.style.fontSize = "0.8em";
		header.style.backgroundColor = "var(--background-secondary)";
		header.style.borderBottom = "1px solid var(--background-modifier-border)";
		header.textContent = title;

		for (const line of lines) {
			const row = col.createDiv();
			row.style.display = "flex";
			row.style.alignItems = "flex-start";

			if (line.type === "remove") {
				row.style.backgroundColor = "var(--background-modifier-error, rgba(180,0,0,0.12))";
			} else if (line.type === "add") {
				row.style.backgroundColor = "var(--background-modifier-success, rgba(0,180,0,0.12))";
			}

			const num = row.createEl("span");
			num.style.padding = "0 6px";
			num.style.textAlign = "right";
			num.style.color = "var(--text-faint)";
			num.style.minWidth = "36px";
			num.style.userSelect = "none";
			num.style.flexShrink = "0";
			num.textContent = line.lineNo != null ? String(line.lineNo) : "";

			const text = row.createEl("span");
			text.style.padding = "0 4px";
			text.style.whiteSpace = "pre-wrap";
			text.style.wordBreak = "break-all";
			text.innerHTML = escapeHtml(line.content);
		}
	};

	renderColumn(container, "Old", leftLines);
	renderColumn(container, "New", rightLines);
}

export class DiffModal extends Modal {
	private oldContent: string;
	private newContent: string;
	private oldLabel: string;
	private newLabel: string;
	private plugin: SaveHistoryPlugin;

	constructor(
		plugin: SaveHistoryPlugin,
		oldContent: string,
		newContent: string,
		oldLabel: string,
		newLabel: string
	) {
		super(plugin.app);
		this.plugin = plugin;
		this.oldContent = oldContent;
		this.newContent = newContent;
		this.oldLabel = oldLabel;
		this.newLabel = newLabel;
	}

	onOpen() {
		const el = this.contentEl;
		el.empty();

		const modalContainer = (this as any).modalEl as HTMLElement;
		if (modalContainer) {
			modalContainer.style.width = "90vw";
			modalContainer.style.maxWidth = "1200px";
			modalContainer.style.height = "80vh";
		}

		el.style.display = "flex";
		el.style.flexDirection = "column";
		el.style.height = "100%";
		el.style.overflow = "hidden";

		const header = el.createDiv();
		header.style.display = "flex";
		header.style.justifyContent = "space-between";
		header.style.alignItems = "center";
		header.style.flexShrink = "0";
		header.style.marginBottom = "8px";

		const titleEl = header.createEl("h3");
		titleEl.style.margin = "0";
		titleEl.textContent = `Diff: ${this.oldLabel} → ${this.newLabel}`;

		const styleToggle = header.createEl("button", {
			text: this.plugin.settings.diffStyle === "unified" ? "Switch to Side-by-Side" : "Switch to Unified",
		});
		styleToggle.style.fontSize = "0.8em";

		const diffContainer = el.createDiv();
		diffContainer.style.flex = "1";
		diffContainer.style.overflow = "auto";
		diffContainer.style.border = "1px solid var(--background-modifier-border)";
		diffContainer.style.borderRadius = "4px";
		diffContainer.style.padding = "4px";

		const renderDiff = () => {
			const diff = computeDiff(this.oldContent, this.newContent);
			if (this.plugin.settings.diffStyle === "unified") {
				renderUnifiedDiff(diffContainer, diff);
				styleToggle.textContent = "Switch to Side-by-Side";
			} else {
				renderSideBySideDiff(diffContainer, diff);
				styleToggle.textContent = "Switch to Unified";
			}
		};

		styleToggle.onclick = async () => {
			this.plugin.settings.diffStyle =
				this.plugin.settings.diffStyle === "unified" ? "side-by-side" : "unified";
			await this.plugin.saveSettings();
			renderDiff();
		};

		renderDiff();
	}
}
