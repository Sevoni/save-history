import { PluginSettingTab } from "obsidian";
import { SaveHistoryPlugin } from "./main";

export interface SaveHistorySettings {
	diffStyle: "unified" | "side-by-side";
	previewStyle: "custom-view" | "temp-file";
	groupBy: "none" | "day" | "week";
}

export const DEFAULT_SETTINGS: SaveHistorySettings = {
	diffStyle: "unified",
	previewStyle: "custom-view",
	groupBy: "day",
};

export class SaveHistorySettingTab extends PluginSettingTab {
	private plugin: SaveHistoryPlugin;

	constructor(app: any, plugin: SaveHistoryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const el = this.containerEl;
		el.empty();

		const wrapper = el.createDiv();
		wrapper.style.padding = "12px";

		const header = wrapper.createEl("h2", { text: "Save History Settings" });
		header.style.marginBottom = "16px";

		wrapper.createDiv({ text: "Diff display style", cls: "setting-item-name" });
		const diffDesc = wrapper.createDiv({
			text: "Choose how version differences are displayed.",
			cls: "setting-item-description",
		});
		diffDesc.style.fontSize = "0.85em";
		diffDesc.style.color = "var(--text-muted)";
		diffDesc.style.marginBottom = "6px";

		const diffSelect = wrapper.createEl("select") as HTMLSelectElement;
		diffSelect.style.marginBottom = "16px";
		diffSelect.style.padding = "4px 8px";
		diffSelect.style.fontSize = "0.9em";
		const unifiedOpt = diffSelect.createEl("option", { text: "Unified (inline)" });
		unifiedOpt.value = "unified";
		const sideBySideOpt = diffSelect.createEl("option", { text: "Side-by-side" });
		sideBySideOpt.value = "side-by-side";
		diffSelect.value = this.plugin.settings.diffStyle;
		diffSelect.onchange = async () => {
			this.plugin.settings.diffStyle = diffSelect.value as "unified" | "side-by-side";
			await this.plugin.saveSettings();
		};

		wrapper.createDiv({ text: "Preview open style", cls: "setting-item-name" });
		const previewDesc = wrapper.createDiv({
			text: "How to open a version in a new pane. Custom view is cleaner; temp file uses Obsidian's native editor.",
			cls: "setting-item-description",
		});
		previewDesc.style.fontSize = "0.85em";
		previewDesc.style.color = "var(--text-muted)";
		previewDesc.style.marginBottom = "6px";

		const previewSelect = wrapper.createEl("select") as HTMLSelectElement;
		previewSelect.style.marginBottom = "16px";
		previewSelect.style.padding = "4px 8px";
		previewSelect.style.fontSize = "0.9em";
		const customViewOpt = previewSelect.createEl("option", { text: "Custom View" });
		customViewOpt.value = "custom-view";
		const tempFileOpt = previewSelect.createEl("option", { text: "Temp File" });
		tempFileOpt.value = "temp-file";
		previewSelect.value = this.plugin.settings.previewStyle;
		previewSelect.onchange = async () => {
			this.plugin.settings.previewStyle = previewSelect.value as "custom-view" | "temp-file";
			await this.plugin.saveSettings();
		};

		wrapper.createDiv({ text: "Group versions by", cls: "setting-item-name" });
		const groupDesc = wrapper.createDiv({
			text: "Group saved versions in the sidebar by time period.",
			cls: "setting-item-description",
		});
		groupDesc.style.fontSize = "0.85em";
		groupDesc.style.color = "var(--text-muted)";
		groupDesc.style.marginBottom = "6px";

		const groupSelect = wrapper.createEl("select") as HTMLSelectElement;
		groupSelect.style.marginBottom = "16px";
		groupSelect.style.padding = "4px 8px";
		groupSelect.style.fontSize = "0.9em";
		const noneOpt = groupSelect.createEl("option", { text: "No grouping" });
		noneOpt.value = "none";
		const dayOpt = groupSelect.createEl("option", { text: "Day" });
		dayOpt.value = "day";
		const weekOpt = groupSelect.createEl("option", { text: "Week" });
		weekOpt.value = "week";
		groupSelect.value = this.plugin.settings.groupBy;
		groupSelect.onchange = async () => {
			this.plugin.settings.groupBy = groupSelect.value as "none" | "day" | "week";
			await this.plugin.saveSettings();
		};
	}
}
