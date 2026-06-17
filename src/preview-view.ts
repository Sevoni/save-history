import { ItemView, WorkspaceLeaf, MarkdownRenderer } from "obsidian";
import { SaveHistoryPlugin } from "./main";
import { t } from "./i18n";

export const VIEW_TYPE_SAVE_HISTORY_PREVIEW = "save-history-preview-view";

const previewData = new Map<string, { content: string; sourcePath: string; label: string }>();

export function setPreviewData(id: string, data: { content: string; sourcePath: string; label: string }) {
	previewData.set(id, data);
}

export class SaveHistoryPreviewView extends ItemView {
	private plugin: SaveHistoryPlugin;
	private contentText: string = "";
	private sourcePath: string = "";
	private label: string = "";

	constructor(leaf: WorkspaceLeaf, plugin: SaveHistoryPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_SAVE_HISTORY_PREVIEW;
	}

	getDisplayText(): string {
		return this.label || t("versionPreview");
	}

	getIcon(): string {
		return "file-text";
	}

	async onOpen() {
		const el = this.containerEl;
		el.empty();

		if (!this.contentText) {
			const data = previewData.get("latest");
			if (data) {
				previewData.delete("latest");
				this.contentText = data.content;
				this.sourcePath = data.sourcePath;
				this.label = data.label;
			}
		}

		if (!this.contentText) {
			const emptyEl = el.createDiv();
			emptyEl.style.padding = "12px";
			emptyEl.style.color = "var(--text-muted)";
			emptyEl.textContent = t("noPreviewLoaded");
			return;
		}

		const wrapper = el.createDiv();
		wrapper.style.padding = "12px";
		wrapper.style.height = "100%";
		wrapper.style.overflowY = "auto";

		const header = wrapper.createEl("h4", { text: this.label });
		header.style.margin = "0 0 8px 0";
		header.style.color = "var(--text-accent)";

		const content = wrapper.createDiv();
		content.classList.add("markdown-preview-view");
		content.style.flex = "1";
		content.style.overflowY = "auto";
		content.style.padding = "10px";
		content.style.border = "1px solid var(--background-modifier-border)";
		content.style.borderRadius = "4px";
		content.style.backgroundColor = "var(--background-primary)";

		await MarkdownRenderer.render(
			this.plugin.app,
			this.contentText,
			content,
			this.sourcePath,
			this
		);
	}
}
