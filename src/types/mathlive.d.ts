import 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          ref?: React.Ref<any>;
        },
        HTMLElement
      >;
    }
  }
}

declare module 'mathlive' {
  export class MathfieldElement extends HTMLElement {
    value: string;
    executeCommand(command: [string, ...any[]]): void;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  }
}

export {};
