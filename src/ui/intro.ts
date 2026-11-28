// src/ui/intro.ts – einmalige Einführung „So angelst du“ (4 Schritte, Touch bzw. Tastatur), überspringbar.
import { t } from '../i18n';
import { Dialog } from './dialog';
import { button, h } from './dom';
import './styles';

export type IntroInput = 'touch' | 'keys';

export class Intro {
  private readonly dlg: Dialog;
  private readonly list = h('ol', { class: 'intro__steps' });
  private done: (() => void) | null = null;

  constructor() {
    this.dlg = new Dialog({ title: t('intro.title'), className: 'intro', onClose: () => this.finish() });
    const ok = button(t('intro.go'), { variant: 'brass', cls: 'intro__go' });
    ok.setAttribute('data-autofocus', '');
    ok.addEventListener('click', () => this.dlg.close('button'));
    const skip = button(t('intro.skip'), { variant: 'ghost', cls: 'intro__skip' });
    skip.addEventListener('click', () => this.dlg.close('button'));
    this.dlg.body.append(this.list);
    this.dlg.foot.append(skip, ok);
  }

  mount(parent: HTMLElement): void {
    this.dlg.mount(parent);
  }

  get visible(): boolean {
    return this.dlg.isOpen;
  }

  /** Zeigt die 4 Schritte; das Promise endet beim Schließen (Los/Überspringen/Escape). */
  show(input: IntroInput): Promise<void> {
    this.list.replaceChildren(
      ...[1, 2, 3, 4].map((n) => h('li', { class: 'intro__step' }, [
        h('strong', { class: 'intro__step-title', text: t(`intro.${n}.title`) }),
        h('span', { class: 'intro__step-how', text: t(`intro.${n}.${input}`) }),
      ])),
    );
    this.dlg.open();
    return new Promise((res) => { this.done = res; });
  }

  private finish(): void {
    const d = this.done;
    this.done = null;
    d?.();
  }

  destroy(): void {
    this.dlg.destroy();
  }
}
