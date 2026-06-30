/* Minimal Obsidian API typings for plugin development/build.
   This is intentionally incomplete; it only covers what this plugin uses. */

declare let activeWindow: Window | undefined;
declare let activeDocument: Document | undefined;

interface HTMLElement {
  empty(): void;
  addClass(className: string): this;
  toggleClass(className: string, value?: boolean): this;
  createDiv(options?: { cls?: string; text?: string; attr?: Record<string, string> }): HTMLDivElement;
  createSpan(options?: { cls?: string; text?: string; attr?: Record<string, string> }): HTMLSpanElement;
  createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: { cls?: string; text?: string; attr?: Record<string, string> }
  ): HTMLElementTagNameMap[K];
  createEl(
    tag: string,
    options?: { cls?: string; text?: string; attr?: Record<string, string> }
  ): HTMLElement;
}

declare module "obsidian" {

  export class EventRef {}

  export class Notice {
    constructor(message: string);
  }

  export class TAbstractFile {
    path: string;
    name: string;
  }

  export class TFile extends TAbstractFile {
    extension: string;
  }

  export class TFolder extends TAbstractFile {}

  export class Debouncer {
    constructor(fn: () => void, delay: number);
    trigger(): void;
  }

  export class Component {
    load(): void;
    onload(): Promise<void>;
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
    onOpen(): Promise<void>;
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
    addButton(callback: (button: ButtonComponent) => void): this;
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

  export class ButtonComponent {
    buttonEl: HTMLButtonElement;
    setButtonText(name: string): this;
    onClick(callback: () => void): this;
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
    openFile(file: TFile): Promise<void>;
  }

  export class Plugin extends Component {
    app: App;
    addCommand(command: Command): EventRef;
    registerInterval(id: number): number;
    registerView(type: string, viewCreator: (leaf: WorkspaceLeaf) => ItemView): void;
    loadData(): Promise<Record<string, unknown> | null>;
    saveData(data: Record<string, unknown>): Promise<void>;
    addSettingTab(settingTab: PluginSettingTab): void;
    addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => void): HTMLElement;
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
    getLeaf(nav?: boolean | "split" | "tab" | "window"): WorkspaceLeaf;
    revealLeaf(leaf: WorkspaceLeaf): void;
    iterateAllLeaves(callback: (leaf: WorkspaceLeaf) => unknown): void;
    on(name: "file-open", callback: (file: TFile | null) => unknown): EventRef;
    on(name: "active-leaf-change", callback: () => unknown): EventRef;
    on(name: "file-menu", callback: (menu: Menu, file: TAbstractFile, source: string) => unknown): EventRef;
    offref(ref: EventRef): void;
  }

  export interface DataAdapter {
    mkdir(path: string): Promise<void>;
    rmdir(path: string, recursive?: boolean): Promise<void>;
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
    modify(file: TFile, data: string): Promise<void>;
    create(path: string, data: string): Promise<TFile>;
    getAbstractFileByPath(path: string): TFile | TFolder | null;
    on(name: "rename", callback: (file: TAbstractFile, oldPath: string) => unknown): EventRef;
    on(name: "delete", callback: (file: TAbstractFile) => unknown): EventRef;
  }

  export interface App {
    isMobile: boolean;
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

  export function setIcon(element: HTMLElement, iconId: string): void;
}
