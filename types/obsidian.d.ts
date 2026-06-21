/* Minimal Obsidian API typings for plugin development/build.
   This is intentionally incomplete; it only covers what this plugin uses. */

export {};

declare global {
  var activeWindow: Window | undefined;
  var activeDocument: Document | undefined;

  interface HTMLElement {
    empty(): void;
    createDiv(options?: { cls?: string; text?: string; attr?: Record<string, string> }): HTMLDivElement;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      options?: { cls?: string; text?: string; attr?: Record<string, string> }
    ): HTMLElementTagNameMap[K];
    createEl(
      tag: string,
      options?: { cls?: string; text?: string; attr?: Record<string, string> }
    ): HTMLElement;
  }
}

declare module "obsidian" {
  
  export class EventRef {}

  export class Notice {
    constructor(message: string);
  }

  export class TFile {
    path: string;
    name: string;
    extension: string;
  }

  export class TFolder {
    path: string;
  }

  export class Debouncer {
    constructor(fn: () => void, delay: number);
    trigger(): void;
  }

  export class Component {
    load(): void;
    onload(): void;
    onunload(): void;
    unload(): void;
    registerEvent(event: EventRef): void;
  }

  export class Modal extends Component {
    constructor(app: App);
    onOpen(): void;
    onClose(): void;
    contentEl: HTMLElement;
    modalEl: HTMLElement;
    open(): void;
    close(): void;
    registerExtensions(extensions: unknown[]): void;
  }

  export class ItemView extends Component {
    constructor(leaf: WorkspaceLeaf);
    getViewType(): string;
    getDisplayText(): string;
    getIcon(): string;
    onOpen(): void;
    onClose(): void;
    containerEl: HTMLElement;
  }

  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(desc: string | DocumentFragment): this;
    setHeading(): this;
    setClass(cls: string): this;
    addToggle(callback: (toggle: ToggleComponent) => void): this;
    addText(callback: (text: TextComponent) => void): this;
    addDropdown(callback: (dropdown: DropdownComponent) => void): this;
    addSlider(callback: (slider: SliderComponent) => void): this;
    infoEl: HTMLElement;
    settingEl: HTMLElement;
  }

  export class ToggleComponent {
    setValue(value: boolean): this;
    getValue(): boolean;
    onChange(callback: (value: boolean) => void): this;
  }

  export class TextComponent {
    inputEl: HTMLInputElement;
    setValue(value: string): this;
    getValue(): string;
    onChange(callback: (value: string) => void): this;
    setPlaceholder(placeholder: string): this;
  }

  export class DropdownComponent {
    addOption(value: string, label: string): this;
    setValue(value: string): this;
    getValue(): string;
    onChange(callback: (value: string) => void): this;
  }

  export class SliderComponent {
    setLimits(min: number, max: number, step: number): this;
    setValue(value: number): this;
    getValue(): number;
    onChange(callback: (value: number) => void): this;
  }

  export class PluginSettingTab {
    app: App;
    plugin: Plugin;
    containerEl: HTMLElement;
    constructor(app: App, plugin: Plugin);
    display(): void;
    hide(): void;
  }

  export interface WorkspaceLeaf {
    view: ItemView;
    setViewState(state: Record<string, unknown>): Promise<void>;
  }

  export class Plugin extends Component {
    app: App;
    addCommand(command: Command): EventRef;
    registerInterval(id: number): void;
    registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void;
    loadData(): Promise<Record<string, unknown> | null>;
    saveData(data: Record<string, unknown>): Promise<void>;
    addSettingTab(settingTab: PluginSettingTab): void;
  }

  export interface Command {
    id: string;
    name: string;
    callback: () => void;
  }

  export class Menu {
    addItem(cb: (item: MenuItem) => void): Menu;
  }

  export class MenuItem {
    setTitle(title: string): MenuItem;
    setIcon(icon: string): MenuItem;
    onClick(callback: () => void): MenuItem;
    setDisabled(disabled: boolean): MenuItem;
  }

  export interface Workspace {
    getActiveFile(): TFile | null;
    getLeavesOfType(type: string): WorkspaceLeaf[];
    getRightLeaf(split: boolean): WorkspaceLeaf | null;
    revealLeaf(leaf: WorkspaceLeaf): void;
    on(name: "file-open", callback: (file: TFile | null) => unknown): EventRef;
    on(name: "active-leaf-change", callback: () => unknown): EventRef;
    on(name: "file-menu", callback: (menu: Menu, file: TFile | TFolder) => unknown): EventRef;
  }

  export interface DataAdapter {
    mkdir(path: string): Promise<void>;
    rmdir(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    write(path: string, data: string): Promise<void>;
    read(path: string): Promise<string>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
    remove(path: string): Promise<void>;
    rename(oldPath: string, newPath: string): Promise<void>;
  }

  export interface Vault {
    adapter: DataAdapter;
    read(file: TFile): Promise<string>;
    modify(file: TFile, data: string): Promise<void> | void;
    create(path: string, data: string): Promise<TFile>;
    exists(path: string): Promise<boolean>;
    getAbstractFileByPath(path: string): TFile | TFolder | null;
    on(name: "rename", callback: (file: TFile | TFolder, oldPath: string) => unknown): EventRef;
    on(name: "delete", callback: (file: TFile | TFolder) => unknown): EventRef;
    getFiles(): Promise<TFile[]>;
  }

  export interface App {
    workspace: Workspace;
    vault: Vault;
  }

  export class MarkdownRenderer {
    static render(
      app: App,
      markdown: string,
      el: HTMLElement,
      sourcePath: string,
      component: Component
    ): Promise<void>;
  }
}
