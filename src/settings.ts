import { PluginSettingTab, type Plugin } from "obsidian";
import { VIEW_TYPE_SAVE_HISTORY, SaveHistoryView } from "./ui";
import { translate, setLanguage, type Language } from "./locale";
import { renameSnapshotFolder } from "./storage";

export class SaveHistorySettingTab extends PluginSettingTab {
	private plugin: Plugin & { settings: any; saveSettings: () => Promise<void>; toast: (msg: string) => void };

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
