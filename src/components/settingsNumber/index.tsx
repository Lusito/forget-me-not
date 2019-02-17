import { h } from "tsx-dom";

interface SettingsNumberProps {
    key: string;
    i18n: string;
    class?: string;
}

export function SettingsNumber(props: SettingsNumberProps) {
    return <label class={props.class}><span data-i18n={props.i18n} /><input type="number" data-settings-key={props.key} /></label>;
}
