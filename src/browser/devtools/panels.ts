import { Events } from "../events";
import { Windows } from "../windows";

////////////////////
// Dev Tools - Panels
////////////////////
/**
 * Use the browser.devtools.panels API to integrate your extension into Developer Tools window UI: create your own panels, access existing panels, and add sidebars. */
export namespace DevtoolsPanels {
    export interface PanelShownEvent extends Events.Event<(window: Windows.Window) => void> { }

    export interface PanelHiddenEvent extends Events.Event<() => void> { }

    /** Represents a panel created by extension. */
    export interface ExtensionPanel {
        /** Fired when the user switches to the panel. */
        onShown: PanelShownEvent;
        /** Fired when the user switches away from the panel. */
        onHidden: PanelHiddenEvent;
    }

    export interface ExtensionSidebarPaneShownEvent extends Events.Event<() => void> { }

    export interface ExtensionSidebarPaneHiddenEvent extends Events.Event<() => void> { }

    /** A sidebar created by the extension. */
    export interface ExtensionSidebarPane {
        /**
         * Sets an expression that is evaluated within the inspected page. The result is displayed in the sidebar pane.
         * @param expression An expression to be evaluated in context of the inspected page. JavaScript objects and DOM nodes are displayed in an expandable tree similar to the console/watch.
         * @param rootTitle An optional title for the root of the expression tree.
         */
        setExpression(expression: string, rootTitle?: string): Promise<void>;
        /**
         * Sets a JSON-compliant object to be displayed in the sidebar pane.
         * @param jsonObject An object to be displayed in context of the inspected page. Evaluated in the context of the caller (API client).
         * @param rootTitle An optional title for the root of the expression tree.
         */
        setObject(jsonObject: Object, rootTitle?: string): Promise<void>;
        /** Fired when the sidebar pane becomes visible as a result of user switching to the panel that hosts it. */
        onShown: ExtensionSidebarPaneShownEvent;
        /** Fired when the sidebar pane becomes hidden as a result of the user switching away from the panel that hosts the sidebar pane. */
        onHidden: ExtensionSidebarPaneHiddenEvent;
    }

    export interface SelectionChangedEvent extends Events.Event<() => void> { }

    /** Represents the Elements panel. */
    export interface ElementsPanel {
        /**
         * Creates a pane within panel's sidebar.
         * @param title Text that is displayed in sidebar caption.
         * Parameter result: An ExtensionSidebarPane object for created sidebar pane.
         */
        createSidebarPane(title: string): Promise<ExtensionSidebarPane>;
        /** Fired when an object is selected in the panel. */
        onSelectionChanged: SelectionChangedEvent;
    }

    export interface ThemeChangedEvent extends Events.Event<(themeName: string) => void> { }

    export interface Static {
        /** Elements panel. */
        elements: ElementsPanel;

        /** The name of the current devtools theme. */
        themeName: "light" | "dark" | "firebug" | undefined;

        /** Fired when the theme changed. */
        onThemeChanged: ThemeChangedEvent;

        /**
         * Creates an extension panel.
         * @param title Title that is displayed next to the extension icon in the Developer Tools toolbar.
         * @param iconPath Path of the panel's icon relative to the extension directory.
         * @param pagePath Path of the panel's HTML page relative to the extension directory.
         * Parameter panel: An ExtensionPanel object representing the created panel.
         */
        create(title: string, iconPath: string, pagePath: string): Promise<ExtensionPanel>;
    }
}