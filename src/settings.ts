import { PluginSettingTab } from "obsidian";
import { SaveHistoryPlugin } from "./main";
import { t, setLanguage, type Language } from "./i18n";

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

		const header = wrapper.createEl("h2", { text: t("settingsTitle") });
		header.style.marginBottom = "16px";

		// Language
		wrapper.createDiv({ text: t("language"), cls: "setting-item-name" });
		const langDesc = wrapper.createDiv({
			text: t("languageDesc"),
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
		};

		// Diff style
		wrapper.createDiv({ text: t("diffDisplayStyle"), cls: "setting-item-name" });
		const diffDesc = wrapper.createDiv({
			text: t("diffDisplayDesc"),
			cls: "setting-item-description",
		});
		diffDesc.style.fontSize = "0.85em";
		diffDesc.style.color = "var(--text-muted)";
		diffDesc.style.marginBottom = "6px";

		const diffSelect = wrapper.createEl("select") as HTMLSelectElement;
		diffSelect.style.marginBottom = "16px";
		diffSelect.style.padding = "4px 8px";
		diffSelect.style.fontSize = "0.9em";
		const unifiedOpt = diffSelect.createEl("option", { text: t("unifiedInline") });
		unifiedOpt.value = "unified";
		const sideBySideOpt = diffSelect.createEl("option", { text: t("sideBySide") });
		sideBySideOpt.value = "side-by-side";
		diffSelect.value = this.plugin.settings.diffStyle;
		diffSelect.onchange = async () => {
			this.plugin.settings.diffStyle = diffSelect.value as "unified" | "side-by-side";
			await this.plugin.saveSettings();
		};

		// Preview style
		wrapper.createDiv({ text: t("previewOpenStyle"), cls: "setting-item-name" });
		const previewDesc = wrapper.createDiv({
			text: t("previewOpenDesc"),
			cls: "setting-item-description",
		});
		previewDesc.style.fontSize = "0.85em";
		previewDesc.style.color = "var(--text-muted)";
		previewDesc.style.marginBottom = "6px";

		const previewSelect = wrapper.createEl("select") as HTMLSelectElement;
		previewSelect.style.marginBottom = "16px";
		previewSelect.style.padding = "4px 8px";
		previewSelect.style.fontSize = "0.9em";
		const customViewOpt = previewSelect.createEl("option", { text: t("customView") });
		customViewOpt.value = "custom-view";
		const tempFileOpt = previewSelect.createEl("option", { text: t("tempFile") });
		tempFileOpt.value = "temp-file";
		previewSelect.value = this.plugin.settings.previewStyle;
		previewSelect.onchange = async () => {
			this.plugin.settings.previewStyle = previewSelect.value as "custom-view" | "temp-file";
			await this.plugin.saveSettings();
		};

		// Group by
		wrapper.createDiv({ text: t("groupVersionsBy"), cls: "setting-item-name" });
		const groupDesc = wrapper.createDiv({
			text: t("groupVersionsDesc"),
			cls: "setting-item-description",
		});
		groupDesc.style.fontSize = "0.85em";
		groupDesc.style.color = "var(--text-muted)";
		groupDesc.style.marginBottom = "6px";

		const groupSelect = wrapper.createEl("select") as HTMLSelectElement;
		groupSelect.style.marginBottom = "16px";
		groupSelect.style.padding = "4px 8px";
		groupSelect.style.fontSize = "0.9em";
		const noneOpt = groupSelect.createEl("option", { text: t("groupNone") });
		noneOpt.value = "none";
		const dayOpt = groupSelect.createEl("option", { text: t("groupDay") });
		dayOpt.value = "day";
		const weekOpt = groupSelect.createEl("option", { text: t("groupWeek") });
		weekOpt.value = "week";
		const monthOpt = groupSelect.createEl("option", { text: t("groupMonth") });
		monthOpt.value = "month";
		const yearOpt = groupSelect.createEl("option", { text: t("groupYear") });
		yearOpt.value = "year";
		groupSelect.value = this.plugin.settings.groupBy;
		groupSelect.onchange = async () => {
			this.plugin.settings.groupBy = groupSelect.value as "none" | "day" | "week" | "month" | "year";
			await this.plugin.saveSettings();
		};
	}
}
