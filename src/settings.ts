import { PluginSettingTab, type Plugin } from "obsidian";
import { VIEW_TYPE_SAVE_HISTORY, SaveHistoryView } from "./ui";
import { translate, setLanguage, type Language } from "./locale";
import { renameSnapshotFolder } from "./storage";
import { AutosaveManager } from "./autosave";

export class SaveHistorySettingTab extends PluginSettingTab {
	private plugin: Plugin & { settings: any; saveSettings: () => Promise<void>; toast: (msg: string) => void; autosaveManager: AutosaveManager | null; registerTabCloseListener: () => void; unregisterTabCloseListener: () => void };

	constructor(app: any, plugin: Plugin) {
		super(app, plugin);
		this.plugin = plugin as any;
	}

	display(): void {
		const el = this.containerEl;
		el.empty();

		const wrapper = el.createDiv();
		wrapper.style.padding = "12px";

		const header = wrapper.createEl("h2", { text: translate("settingsTitle") });
		header.style.marginBottom = "16px";

		// Language
		wrapper.createDiv({ text: translate("language"), cls: "setting-item-name" });
		const langDesc = wrapper.createDiv({
			text: translate("languageDesc"),
			cls: "setting-item-description",
		});
		langDesc.style.fontSize = "0.85em";
		langDesc.style.color = "var(--text-muted)";
		langDesc.style.marginBottom = "6px";

		const langSelect = wrapper.createEl("select") as HTMLSelectElement;
		langSelect.style.marginBottom = "16px";
		langSelect.style.padding = "4px 8px";
		langSelect.style.fontSize = "0.9em";
		const enOpt = langSelect.createEl("option", { text: "English" });
		enOpt.value = "en";
		const ruOpt = langSelect.createEl("option", { text: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" });
		ruOpt.value = "ru";
		langSelect.value = this.plugin.settings.language;
		langSelect.onchange = async () => {
			const lang = langSelect.value as Language;
			this.plugin.settings.language = lang;
			setLanguage(lang);
			await this.plugin.saveSettings();
			this.display();
			this.refreshSidebarViews();
		};

		// Group by
		wrapper.createDiv({ text: translate("groupVersionsBy"), cls: "setting-item-name" });
		const groupDesc = wrapper.createDiv({
			text: translate("groupVersionsDesc"),
			cls: "setting-item-description",
		});
		groupDesc.style.fontSize = "0.85em";
		groupDesc.style.color = "var(--text-muted)";
		groupDesc.style.marginBottom = "6px";

		const groupSelect = wrapper.createEl("select") as HTMLSelectElement;
		groupSelect.style.marginBottom = "16px";
		groupSelect.style.padding = "4px 8px";
		groupSelect.style.fontSize = "0.9em";
		const noneOpt = groupSelect.createEl("option", { text: translate("groupNone") });
		noneOpt.value = "none";
		const dayOpt = groupSelect.createEl("option", { text: translate("groupDay") });
		dayOpt.value = "day";
		const weekOpt = groupSelect.createEl("option", { text: translate("groupWeek") });
		weekOpt.value = "week";
		const monthOpt = groupSelect.createEl("option", { text: translate("groupMonth") });
		monthOpt.value = "month";
		const yearOpt = groupSelect.createEl("option", { text: translate("groupYear") });
		yearOpt.value = "year";
		groupSelect.value = this.plugin.settings.groupBy;
		groupSelect.onchange = async () => {
			this.plugin.settings.groupBy = groupSelect.value as "none" | "day" | "week" | "month" | "year";
			await this.plugin.saveSettings();
			this.refreshSidebarViews();
		};

		// Snapshot folder
		wrapper.createDiv({ text: translate("snapshotFolder"), cls: "setting-item-name" });
		const folderDesc = wrapper.createDiv({
			text: translate("snapshotFolderDesc"),
			cls: "setting-item-description",
		});
		folderDesc.style.fontSize = "0.85em";
		folderDesc.style.color = "var(--text-muted)";
		folderDesc.style.marginBottom = "6px";

		const folderRow = wrapper.createDiv();
		folderRow.style.display = "flex";
		folderRow.style.gap = "8px";
		folderRow.style.alignItems = "center";
		folderRow.style.marginBottom = "16px";

		const folderInput = folderRow.createEl("input") as HTMLInputElement;
		folderInput.type = "text";
		folderInput.value = this.plugin.settings.snapshotFolder;
		folderInput.style.flex = "1";
		folderInput.style.padding = "4px 8px";
		folderInput.style.fontSize = "0.9em";

		const folderSaveBtn = folderRow.createEl("button", { text: translate("save") });
		folderSaveBtn.style.flexShrink = "0";
		folderSaveBtn.onclick = async () => {
			const newName = folderInput.value.trim();
			if (!newName) return;
			if (newName === this.plugin.settings.snapshotFolder) return;

			if (/[<>:"|?*]/.test(newName) || newName.startsWith("/") || newName.endsWith("/") || newName.includes("..")) {
				this.plugin.toast(translate("snapshotFolderRenameFailed"));
				return;
			}

			const oldName = this.plugin.settings.snapshotFolder;
			const success = await renameSnapshotFolder(this.plugin.app.vault.adapter, oldName, newName);
			if (success) {
				this.plugin.settings.snapshotFolder = newName;
				await this.plugin.saveSettings();
				this.plugin.toast(translate("snapshotFolderRenamed"));
				this.refreshSidebarViews();
			} else {
				this.plugin.toast(translate("snapshotFolderRenameFailed"));
			}
		};

		// Autosave interval
		const intervalLabel = wrapper.createDiv({ text: translate("autosaveInterval"), cls: "setting-item-name" });
		intervalLabel.style.marginTop = "16px";
		const intervalDesc = wrapper.createDiv({
			text: translate("autosaveIntervalDesc"),
			cls: "setting-item-description",
		});
		intervalDesc.style.fontSize = "0.85em";
		intervalDesc.style.color = "var(--text-muted)";
		intervalDesc.style.marginBottom = "6px";

		const intervalInput = wrapper.createEl("input") as HTMLInputElement;
		intervalInput.type = "number";
		intervalInput.min = "0";
		intervalInput.value = String(this.plugin.settings.autosaveInterval);
		intervalInput.style.padding = "4px 8px";
		intervalInput.style.fontSize = "0.9em";
		intervalInput.style.marginBottom = "16px";
		intervalInput.style.width = "80px";
		intervalInput.onchange = async () => {
			const val = Math.max(0, Math.floor(Number(intervalInput.value) || 0));
			intervalInput.value = String(val);
			this.plugin.settings.autosaveInterval = val;
			await this.plugin.saveSettings();
			this.plugin.autosaveManager?.restart();
		};

		// Autosave on tab close — toggle
		const tabRow = wrapper.createDiv();
		tabRow.style.display = "flex";
		tabRow.style.alignItems = "center";
		tabRow.style.justifyContent = "space-between";
		tabRow.style.marginBottom = "12px";

		const tabTextCol = tabRow.createDiv();
		const tabLabel = tabTextCol.createDiv({ text: translate("autosaveOnTabClose"), cls: "setting-item-name" });
		const tabDesc = tabTextCol.createDiv({
			text: translate("autosaveOnTabCloseDesc"),
			cls: "setting-item-description",
		});
		tabDesc.style.fontSize = "0.85em";
		tabDesc.style.color = "var(--text-muted)";

		const tabToggle = this.createToggle(this.plugin.settings.autosaveOnTabClose, async (val) => {
			this.plugin.settings.autosaveOnTabClose = val;
			await this.plugin.saveSettings();
			if (val) {
				this.plugin.registerTabCloseListener();
			} else {
				this.plugin.unregisterTabCloseListener();
			}
		});
		tabRow.appendChild(tabToggle);

		// Max autosave versions
		const maxLabel = wrapper.createDiv({ text: translate("maxAutosaveVersions"), cls: "setting-item-name" });
		maxLabel.style.marginTop = "16px";
		const maxDesc = wrapper.createDiv({
			text: translate("maxAutosaveVersionsDesc"),
			cls: "setting-item-description",
		});
		maxDesc.style.fontSize = "0.85em";
		maxDesc.style.color = "var(--text-muted)";
		maxDesc.style.marginBottom = "6px";

		const maxInput = wrapper.createEl("input") as HTMLInputElement;
		maxInput.type = "number";
		maxInput.min = "0";
		maxInput.value = String(this.plugin.settings.maxAutosaveVersions);
		maxInput.style.padding = "4px 8px";
		maxInput.style.fontSize = "0.9em";
		maxInput.style.marginBottom = "16px";
		maxInput.style.width = "80px";
		maxInput.onchange = async () => {
			const val = Math.max(0, Math.floor(Number(maxInput.value) || 0));
			maxInput.value = String(val);
			this.plugin.settings.maxAutosaveVersions = val;
			await this.plugin.saveSettings();
		};

		// Allowed file extensions
		const extLabel = wrapper.createDiv({ text: translate("allowedExtensions"), cls: "setting-item-name" });
		extLabel.style.marginTop = "16px";
		const extDesc = wrapper.createDiv({
			text: translate("allowedExtensionsDesc"),
			cls: "setting-item-description",
		});
		extDesc.style.fontSize = "0.85em";
		extDesc.style.color = "var(--text-muted)";
		extDesc.style.marginBottom = "6px";

		const extInput = wrapper.createEl("input") as HTMLInputElement;
		extInput.type = "text";
		extInput.value = this.plugin.settings.allowedExtensions;
		extInput.style.padding = "4px 8px";
		extInput.style.fontSize = "0.9em";
		extInput.style.marginBottom = "16px";
		extInput.style.width = "300px";
		extInput.placeholder = "md";
		extInput.onchange = async () => {
			this.plugin.settings.allowedExtensions = extInput.value.trim();
			await this.plugin.saveSettings();
		};
	}

	private createToggle(checked: boolean, onChange: (val: boolean) => void): HTMLElement {
		const container = document.createElement("div");
		container.style.position = "relative";
		container.style.width = "36px";
		container.style.height = "20px";
		container.style.flexShrink = "0";
		container.style.cursor = "pointer";

		const track = document.createElement("div");
		track.style.width = "36px";
		track.style.height = "20px";
		track.style.borderRadius = "10px";
		track.style.background = checked ? "var(--interactive-accent)" : "var(--background-modifier-border)";
		track.style.transition = "background 0.2s";
		track.style.position = "absolute";
		track.style.top = "0";
		track.style.left = "0";

		const thumb = document.createElement("div");
		thumb.style.width = "16px";
		thumb.style.height = "16px";
		thumb.style.borderRadius = "50%";
		thumb.style.background = "white";
		thumb.style.position = "absolute";
		thumb.style.top = "2px";
		thumb.style.left = checked ? "18px" : "2px";
		thumb.style.transition = "left 0.2s";
		thumb.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";

		track.appendChild(thumb);
		container.appendChild(track);

		container.addEventListener("click", () => {
			checked = !checked;
			track.style.background = checked ? "var(--interactive-accent)" : "var(--background-modifier-border)";
			thumb.style.left = checked ? "18px" : "2px";
			onChange(checked);
		});

		return container;
	}

	private refreshSidebarViews() {
		const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
		for (const leaf of leaves) {
			if (leaf.view instanceof SaveHistoryView) {
				(leaf.view as SaveHistoryView).refresh();
			}
		}
	}
}
