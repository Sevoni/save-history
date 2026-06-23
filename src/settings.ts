import { PluginSettingTab, Setting, type Plugin } from "obsidian";
import { VIEW_TYPE_SAVE_HISTORY, SaveHistoryView } from "./ui";
import { translate, setLanguage, type Language } from "./locale";
import { renameSnapshotFolder, renameExportFolder } from "./storage";
import { AutosaveManager } from "./autosave";
import type { SaveHistorySettings } from "./main";
import type { GroupByMode } from "./main";

type PluginWithSettings = Plugin & {
	settings: SaveHistorySettings;
	saveSettings: () => Promise<void>;
	toast: (msg: string) => void;
	autosaveManager: AutosaveManager | null;
	registerTabCloseListener: () => void;
	unregisterTabCloseListener: () => void;
};

export class SaveHistorySettingTab extends PluginSettingTab {
	plugin: PluginWithSettings;

	constructor(app: PluginWithSettings["app"], plugin: Plugin) {
		super(app, plugin);
		this.plugin = plugin as PluginWithSettings;
	}

	display(): void {
		const el = this.containerEl;
		el.empty();

		const wrapper = el.createDiv({ cls: "sh-settings-wrapper" });

		new Setting(wrapper).setName(translate("settingsTitle")).setHeading();

		// Language
		new Setting(wrapper)
			.setName(translate("language"))
			.setDesc(translate("languageDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("en", "English");
				dropdown.addOption("ru", "\u0420\u0443\u0441\u0441\u043a\u0438\u0439");
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange((val) => {
					void (async () => {
						const lang = val as Language;
						this.plugin.settings.language = lang;
						setLanguage(lang);
						await this.plugin.saveSettings();
						this.display();
						this.refreshSidebarViews();
					})();
				});
			});

		// Group by
		new Setting(wrapper)
			.setName(translate("groupVersionsBy"))
			.setDesc(translate("groupVersionsDesc"))
			.addDropdown((dropdown) => {
				dropdown.addOption("none", translate("groupNone"));
				dropdown.addOption("day", translate("groupDay"));
				dropdown.addOption("week", translate("groupWeek"));
				dropdown.addOption("month", translate("groupMonth"));
				dropdown.addOption("year", translate("groupYear"));
				dropdown.setValue(this.plugin.settings.groupBy);
				dropdown.onChange((val) => {
					void (async () => {
						this.plugin.settings.groupBy = val as GroupByMode;
						await this.plugin.saveSettings();
						this.refreshSidebarViews();
					})();
				});
			});

		// Snapshot folder
		new Setting(wrapper)
			.setName(translate("snapshotFolder"))
			.setDesc(translate("snapshotFolderDesc"));

		const folderRow = wrapper.createDiv({ cls: "sh-settings-row" });
		const folderInput = folderRow.createEl("input", {
			cls: "sh-settings-input",
			attr: { type: "text" },
		}) as HTMLInputElement;
		folderInput.value = this.plugin.settings.snapshotFolder;

		const folderSaveBtn = folderRow.createEl("button", {
			text: translate("save"),
			cls: "sh-settings-btn",
		});
		folderSaveBtn.addEventListener("click", () => {
			void (async () => {
				const newName = folderInput.value.trim();
				if (!newName) return;
				if (newName === this.plugin.settings.snapshotFolder) return;

				if (
					/[<>:"|?*]/.test(newName) ||
					newName.startsWith("/") ||
					newName.endsWith("/") ||
					newName.includes("..")
				) {
					this.plugin.toast(translate("snapshotFolderRenameFailed"));
					return;
				}

				const oldName = this.plugin.settings.snapshotFolder;
				const success = await renameSnapshotFolder(
					this.plugin.app.vault.adapter,
					oldName,
					newName
				);
				if (success) {
					this.plugin.settings.snapshotFolder = newName;
					await this.plugin.saveSettings();
					this.plugin.toast(translate("snapshotFolderRenamed"));
					this.refreshSidebarViews();
				} else {
					this.plugin.toast(translate("snapshotFolderRenameFailed"));
				}
			})();
		});

		// Export folder
		new Setting(wrapper)
			.setName(translate("exportFolder"))
			.setDesc(translate("exportFolderDesc"));

		const exportFolderRow = wrapper.createDiv({ cls: "sh-settings-row" });
		const exportFolderInput = exportFolderRow.createEl("input", {
			cls: "sh-settings-input",
			attr: { type: "text" },
		}) as HTMLInputElement;
		exportFolderInput.value = this.plugin.settings.exportFolder;

		const exportFolderSaveBtn = exportFolderRow.createEl("button", {
			text: translate("save"),
			cls: "sh-settings-btn",
		});
		exportFolderSaveBtn.addEventListener("click", () => {
			void (async () => {
				const newName = exportFolderInput.value.trim();
				if (!newName) return;
				if (newName === this.plugin.settings.exportFolder) return;

				if (
					/[<>:"|?*]/.test(newName) ||
					newName.startsWith("/") ||
					newName.endsWith("/") ||
					newName.includes("..")
				) {
					this.plugin.toast(translate("exportFolderRenameFailed"));
					return;
				}

				const oldName = this.plugin.settings.exportFolder;
				const success = await renameExportFolder(
					this.plugin.app.vault.adapter,
					oldName,
					newName
				);
				if (success) {
					this.plugin.settings.exportFolder = newName;
					await this.plugin.saveSettings();
					this.plugin.toast(translate("exportFolderRenamed"));
				} else {
					this.plugin.toast(translate("exportFolderRenameFailed"));
				}
			})();
		});

		// Autosave interval
		new Setting(wrapper)
			.setName(translate("autosaveInterval"))
			.setDesc(translate("autosaveIntervalDesc"))
			.addText((text) => {
				text.setValue(String(this.plugin.settings.autosaveInterval));
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.classList.add("sh-settings-input-num");
				text.onChange((val) => {
					void (async () => {
						const num = Math.max(0, Math.floor(Number(val) || 0));
						text.setValue(String(num));
						this.plugin.settings.autosaveInterval = num;
						await this.plugin.saveSettings();
						this.plugin.autosaveManager?.restart();
					})();
				});
			});

		// Autosave on tab close — toggle
		const tabToggleRow = wrapper.createDiv({ cls: "sh-settings-toggle-row" });
		const tabTextCol = tabToggleRow.createDiv({ cls: "sh-settings-toggle-text" });
		tabTextCol.createDiv({
			text: translate("autosaveOnTabClose"),
			cls: "setting-item-name",
		});
		tabTextCol.createDiv({
			text: translate("autosaveOnTabCloseDesc"),
			cls: "setting-item-description",
		});

		const tabToggle = this.createToggle(
			this.plugin.settings.autosaveOnTabClose,
			(val) => {
				void (async () => {
					this.plugin.settings.autosaveOnTabClose = val;
					await this.plugin.saveSettings();
					if (val) {
						this.plugin.registerTabCloseListener();
					} else {
						this.plugin.unregisterTabCloseListener();
					}
				})();
			}
		);
		tabToggleRow.appendChild(tabToggle);

		// Max autosave versions
		new Setting(wrapper)
			.setName(translate("maxAutosaveVersions"))
			.setDesc(translate("maxAutosaveVersionsDesc"))
			.addText((text) => {
				text.setValue(String(this.plugin.settings.maxAutosaveVersions));
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.inputEl.classList.add("sh-settings-input-num");
				text.onChange((val) => {
					void (async () => {
						const num = Math.max(0, Math.floor(Number(val) || 0));
						text.setValue(String(num));
						this.plugin.settings.maxAutosaveVersions = num;
						await this.plugin.saveSettings();
					})();
				});
			});

		// Allowed file extensions
		new Setting(wrapper)
			.setName(translate("allowedExtensions"))
			.setDesc(translate("allowedExtensionsDesc"))
			.addText((text) => {
				text.setValue(this.plugin.settings.allowedExtensions);
				text.setPlaceholder("md");
				text.inputEl.classList.add("sh-settings-input-text");
				text.onChange((val) => {
					void (async () => {
						this.plugin.settings.allowedExtensions = val.trim();
						await this.plugin.saveSettings();
					})();
				});
			});
	}

	private createToggle(
		checked: boolean,
		onChange: (val: boolean) => void
	): HTMLElement {
		const doc = activeDocument;

		const container = doc.createElement("div");
		container.classList.add("sh-toggle");

		const track = doc.createElement("div");
		track.classList.add("sh-toggle-track");
		if (checked) track.classList.add("is-checked");

		const thumb = doc.createElement("div");
		thumb.classList.add("sh-toggle-thumb");
		if (checked) thumb.classList.add("is-checked");

		track.appendChild(thumb);
		container.appendChild(track);

		container.addEventListener("click", () => {
			checked = !checked;
			track.classList.toggle("is-checked", checked);
			thumb.classList.toggle("is-checked", checked);
			onChange(checked);
		});

		return container;
	}

	private refreshSidebarViews() {
		const leaves =
			this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_SAVE_HISTORY);
		for (const leaf of leaves) {
			if (leaf.view instanceof SaveHistoryView) {
				leaf.view.refresh();
			}
		}
	}
}
